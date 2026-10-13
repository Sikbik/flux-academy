/**
 * The price of a Flux app, reproduced from the official calculator.
 *
 * The network's own code path is `POST /apps/calculatefiatandfluxprice` in FluxOS
 * (`ZelBack/src/services/utils/appSpecHelpers.js`, `getAppFiatAndFluxPrice`) which calls
 * `appPricePerMonth` (`utils/appUtilities.js`). This module is a line-for-line port, including the places
 * where JavaScript's `toFixed` rounding decides a cent. It is verified against live responses in
 * `pricing.fixtures.ts` (tests) and, against the running network, by `server/scripts/verify-pricing.ts`.
 *
 * The formula, for a NEW registration (an update of an existing app additionally credits the unused part of
 * the old subscription; see `quoteUpdate`):
 *
 *   bundle      = cpuCores*rate.cpu*10 + ramMB*rate.ram/100 + hddGB*rate.hdd      (summed over components)
 *                 + rate.scope  if nodes are pinned or the app is enterprise
 *                 + rate.staticip if staticip
 *                 + rate.port * (number of "enterprise" ports: 1-1023, 8080, 8081, 8443, 6667)
 *   perInstance = ceil(bundle / 3 * 100) / 100                    the rates buy a bundle of three instances
 *                 the fees above are part of the bundle, so a fee of USD 2 costs about USD 0.67 per instance
 *                 and scales with the instance count (it equals USD 2 only at 3 instances)
 *   n = instances; extra = n - 1
 *   instancePrice = perInstance                                    when extra is 0
 *                 = perInstance + extra * 0.50                     when perInstance < 0.50 and extra > 2
 *                 = (ceil(perInstance*extra*100) + ceil(perInstance*100)) / 100   otherwise
 *   instancePrice = max(instancePrice, minUSDPrice)                the monthly floor
 *   scaled   = toFixed2(instancePrice * expire / 88000)            expire defaults to 88000 blocks (a month)
 *   if instances < 4:  scaled *= 0.8  when cpu < 3 and ram < 6000 and hdd < 150 (totals)
 *                      scaled *= 0.9  when cpu < 7 and ram < 29000 and hdd < 370
 *   scaled *= marketplaceMultiplier (only for names starting with a Flux marketplace app that has > 1)
 *   scaled  = max(toFixed2(scaled * rate.multiplier), minUSDPrice)
 *   scaled *= 0.97 (>= 3 months) | 0.94 (>= 6) | 0.88 (>= 9)       then toFixed2, floor again
 *   usd     = round up to the next price ending .49 or .99
 *   flux    = toFixed2(usd / fluxUsd * rate.fluxmultiplier)
 *
 * Pure and framework-free. No Node built-ins, no DOM.
 */

import { BLOCKS_PER_MONTH, DEFAULT_EXPIRE_BLOCKS, durationDiscount } from './blocks.ts';
import { normalizeSpec } from './spec.ts';
import type { FluxAppSpec, PricingParams, Quote, QuoteLineItem } from './types.ts';

// ---------------------------------------------------------------------------
// Baked snapshot
// ---------------------------------------------------------------------------

export interface BakedPricing {
  /** ISO date the numbers were read from the live API. */
  capturedAt: string;
  params: PricingParams;
  /** USD per FLUX at capture time, from viprates (USD rate x FLUX/BTC rate). */
  fluxUsd: number;
  /** Where the numbers came from. */
  source: string;
}

/**
 * The official parameters as read from `GET https://api.runonflux.io/apps/getappspecsusdprice` on
 * 2026-10-12 (height -1 means "current"), and the FLUX price the official calculator used on that day.
 * Used when the API is unreachable. The UI must label anything computed from this as a snapshot.
 */
export const BAKED_PRICING: BakedPricing = {
  capturedAt: '2026-10-12',
  params: {
    height: -1,
    cpu: 0.15,
    ram: 0.05,
    hdd: 0.02,
    minPrice: 0.01,
    port: 2,
    scope: 4,
    staticip: 2,
    fluxmultiplier: 0.95,
    multiplier: 1,
    minUSDPrice: 0.99,
  },
  fluxUsd: 0.0854344504,
  source: 'api.runonflux.io /apps/getappspecsusdprice and viprates.runonflux.io /rates, 2026-10-12',
};

// ---------------------------------------------------------------------------
// Constants (each ported from FluxOS)
// ---------------------------------------------------------------------------

/**
 * Public ports that carry the "enterprise port" surcharge.
 * source: config.fluxapps.enterprisePorts = ['0-1023', 8080, 8081, 8443, 6667]; fluxNetworkHelper.isPortEnterprise
 * The node's table starts at 0, but the validator refuses port 0, so a deployer's range is 1 to 1023.
 */
export const ENTERPRISE_PORT_RANGES: readonly (readonly [number, number])[] = [
  [0, 1023],
  [8080, 8080],
  [8081, 8081],
  [8443, 8443],
  [6667, 6667],
];

export function isEnterprisePort(port: number): boolean {
  if (!Number.isFinite(port)) return false;
  for (const [lo, hi] of ENTERPRISE_PORT_RANGES) {
    if (port >= lo && port <= hi) return true;
  }
  return false;
}

/** Number of instances the rates are stated for. source: `pricePerInstance = totalPrice / 3` */
export const BUNDLE_INSTANCES = 3;

/**
 * When one instance costs under this and there are more than 2 extra instances (4 or more instances), every
 * extra instance is billed this flat amount instead of the instance price. FACTS 4.3 step A, 4.4;
 * source: appPricePerMonth (appUtilities.js:126-127).
 */
export const EXTRA_INSTANCE_FLOOR_USD = 0.5;

/** Small-app discounts for fewer than 4 instances. source: getAppFiatAndFluxPrice `applyHWDiscount` */
export const HW_DISCOUNTS: readonly {
  maxCpu: number;
  maxRam: number;
  maxHdd: number;
  factor: number;
  label: string;
}[] = [
  { maxCpu: 3, maxRam: 6000, maxHdd: 150, factor: 0.8, label: '20 percent' },
  { maxCpu: 7, maxRam: 29000, maxHdd: 370, factor: 0.9, label: '10 percent' },
];

/** Apps with at least this many instances do not get the small-app discount. */
export const HW_DISCOUNT_MAX_INSTANCES = 3;

/**
 * Names that start with one of these (case-insensitive) are Flux marketplace apps whose price is multiplied.
 * Snapshot of `GET https://stats.runonflux.io/marketplace/listapps` on 2026-10-12, entries with
 * multiplier > 1 only (every other marketplace entry has multiplier 1 or none). Order is the API order,
 * because the official code takes the FIRST prefix match.
 */
export const MARKETPLACE_MULTIPLIERS: readonly { name: string; multiplier: number }[] = [
  { name: 'FoldingAtFluxCloud', multiplier: 1.56 },
  { name: 'PresearchNodeLegacy', multiplier: 1.71 },
  { name: 'PresearchNode', multiplier: 1.71 },
  { name: 'TimpiCollector', multiplier: 1.12 },
  { name: 'FiroMN', multiplier: 1.89 },
  { name: 'PIVXMN', multiplier: 1.04 },
  { name: 'NeoxaNode', multiplier: 1.1 },
  { name: 'AlephiumNode', multiplier: 1.55 },
  { name: 'Palworld4Slots', multiplier: 1.39 },
  { name: 'Palworld8Slots', multiplier: 1.8 },
  { name: 'Palworld16Slots', multiplier: 1.57 },
  { name: 'Palworld32Slots', multiplier: 1.49 },
  { name: 'Enshrouded4Slots', multiplier: 1.66 },
  { name: 'Enshrouded8Slots', multiplier: 1.72 },
  { name: 'Enshrouded16Slots', multiplier: 1.76 },
  { name: 'BittensorFN', multiplier: 1.09 },
  { name: 'Minecraft8GB', multiplier: 1.99 },
];

/** The marketplace multiplier the official calculator would apply to an app name (1 when none). */
export function marketplaceMultiplier(
  appName: string,
  list: readonly { name: string; multiplier: number }[] = MARKETPLACE_MULTIPLIERS,
): number {
  const lower = String(appName ?? '').toLowerCase();
  if (!lower) return 1;
  for (const entry of list) {
    if (lower.startsWith(entry.name.toLowerCase())) {
      return entry.multiplier > 1 ? entry.multiplier : 1;
    }
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Number helpers (JavaScript semantics on purpose: they decide cents)
// ---------------------------------------------------------------------------

/** `Number(x.toFixed(2))`, exactly as FluxOS rounds. */
function toFixed2(x: number): number {
  return Number(x.toFixed(2));
}

/** Round up to the next price ending in .49 or .99. Ported from `roundUpToCharmPrice`. */
export function roundUpToCharmPrice(usd: number): number {
  const cents = Math.round(Number(usd) * 100);
  const dollars = Math.floor(cents / 100);
  const charmCents = cents % 100 <= 49 ? 49 : 99;
  return (dollars * 100 + charmCents) / 100;
}

function r6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

function num(x: unknown, fallback = 0): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : fallback;
}

function fmtUsd(x: number): string {
  return `$${x.toFixed(2)}`;
}

function fmtNum(x: number): string {
  return Number.isInteger(x) ? String(x) : String(Number(x.toFixed(2)));
}

// ---------------------------------------------------------------------------
// The formula, stage by stage
// ---------------------------------------------------------------------------

export interface QuoteOptions {
  /** USD per FLUX for the conversion. Omit or pass null for a USD-only quote. */
  fluxUsd?: number | null;
  /**
   * Override the subscription length in pricing months (1 to 12). When omitted the spec's own `expire`
   * decides, as it does on the network.
   */
  months?: number;
  /** Marketplace multiplier to apply (default: looked up from the baked list by app name). */
  marketplaceMultiplier?: number;
  /** Provenance label for the result. Default `baked`. */
  paramsSource?: 'live' | 'cache' | 'baked';
  /** Label the result `official` (set by the server when numbers came from the official calculator). */
  basis?: 'official' | 'computed';
  /** USD credit for the unused part of a previous subscription (an update). See `updateCredit`. */
  creditUsd?: number;
}

/** Detailed stages, exposed for tests and for teaching diagrams. */
export interface PriceStages {
  cpuCores: number;
  ramMb: number;
  hddGb: number;
  enterprisePorts: number;
  scoped: boolean;
  staticip: boolean;
  /** Rates applied to the resources, for three instances. */
  bundleUsd: number;
  perInstanceUsd: number;
  instances: number;
  instancePriceUsd: number;
  afterMonthlyFloorUsd: number;
  expireBlocks: number;
  monthsExact: number;
  afterDurationScaleUsd: number;
  /** Credit for the unused part of a previous subscription (updates only), 0 for new registrations. */
  creditUsd: number;
  afterCreditUsd: number;
  hwFactor: number;
  afterHwUsd: number;
  marketplace: number;
  afterMarketUsd: number;
  /** After `toFixed(2)` of the multiplier step, before the second floor. */
  afterMultiplierRawUsd: number;
  afterMultiplierUsd: number;
  discountFactor: number;
  afterDiscountUsd: number;
  usdTotal: number;
}

/**
 * Compute the stage values of the official formula for a spec.
 * Never throws: non-finite numbers count as 0 and instances below 1 count as 1.
 */
export function priceStages(
  spec: FluxAppSpec,
  params: PricingParams,
  opts: Pick<QuoteOptions, 'months' | 'marketplaceMultiplier' | 'creditUsd'> = {},
): PriceStages {
  let cpuCores = 0;
  let ramMb = 0;
  let hddGb = 0;
  let enterprisePorts = 0;
  const compose = Array.isArray(spec.compose) ? spec.compose : [];
  for (const c of compose) {
    cpuCores += num(c?.cpu);
    ramMb += num(c?.ram);
    hddGb += num(c?.hdd);
    const ports = Array.isArray(c?.ports) ? c.ports : [];
    for (const p of ports) if (isEnterprisePort(p)) enterprisePorts += 1;
  }
  const scoped = (Array.isArray(spec.nodes) && spec.nodes.length > 0) || Boolean(spec.enterprise);
  const staticip = spec.staticip === true;

  // The official code sums cpu*rate*10, ram*rate/100 and hdd*rate over the totals.
  let bundle = cpuCores * params.cpu * 10 + (ramMb * params.ram) / 100 + hddGb * params.hdd;
  if (scoped) bundle += params.scope;
  if (staticip) bundle += params.staticip;
  bundle += enterprisePorts * params.port;

  const perInstance = Math.ceil((bundle / BUNDLE_INSTANCES) * 100) / 100;
  const instances = Math.max(1, Math.trunc(num(spec.instances, 1)));
  const extra = instances - 1;
  let instancePrice = perInstance;
  if (extra > 0) {
    if (perInstance < EXTRA_INSTANCE_FLOOR_USD && extra > 2) {
      instancePrice = perInstance + extra * EXTRA_INSTANCE_FLOOR_USD;
    } else {
      instancePrice = (Math.ceil(perInstance * extra * 100) + Math.ceil(perInstance * 100)) / 100;
    }
  }
  const minUsd = params.minUSDPrice;
  const afterMonthlyFloor = minUsd && instancePrice < minUsd ? toFixed2(minUsd) : instancePrice;

  const defaultExpire = DEFAULT_EXPIRE_BLOCKS;
  let expireBlocks = Math.trunc(num(spec.expire, 0)) || defaultExpire;
  if (opts.months !== undefined && Number.isFinite(opts.months) && opts.months > 0) {
    expireBlocks = Math.round(opts.months * BLOCKS_PER_MONTH);
  }
  const monthsExact = expireBlocks / defaultExpire;
  const afterDuration = toFixed2(afterMonthlyFloor * monthsExact);

  const creditUsd =
    Number.isFinite(opts.creditUsd) && (opts.creditUsd as number) > 0 ? (opts.creditUsd as number) : 0;
  const afterCredit = afterDuration - creditUsd;

  let hwFactor = 1;
  if (instances <= HW_DISCOUNT_MAX_INSTANCES) {
    for (const d of HW_DISCOUNTS) {
      if (cpuCores < d.maxCpu && ramMb < d.maxRam && hddGb < d.maxHdd) {
        hwFactor = d.factor;
        break;
      }
    }
  }
  const afterHw = afterCredit * hwFactor;

  const marketplace =
    opts.marketplaceMultiplier !== undefined ? opts.marketplaceMultiplier : marketplaceMultiplier(spec.name);
  const afterMarket = marketplace > 1 ? afterHw * marketplace : afterHw;

  const afterMultiplierRaw = toFixed2(afterMarket * params.multiplier);
  const afterMultiplier = afterMultiplierRaw < minUsd ? toFixed2(minUsd) : afterMultiplierRaw;

  const disc = durationDiscount(monthsExact);
  const discountFactor = disc ? disc.factor : 1;
  let afterDiscount = toFixed2(afterMultiplier * discountFactor);
  if (afterDiscount < minUsd) afterDiscount = toFixed2(minUsd);

  const usdTotal = roundUpToCharmPrice(afterDiscount);

  return {
    cpuCores,
    ramMb,
    hddGb,
    enterprisePorts,
    scoped,
    staticip,
    bundleUsd: bundle,
    perInstanceUsd: perInstance,
    instances,
    instancePriceUsd: instancePrice,
    afterMonthlyFloorUsd: afterMonthlyFloor,
    expireBlocks,
    monthsExact,
    afterDurationScaleUsd: afterDuration,
    creditUsd,
    afterCreditUsd: afterCredit,
    hwFactor,
    afterHwUsd: afterHw,
    marketplace: marketplace > 1 ? marketplace : 1,
    afterMarketUsd: afterMarket,
    afterMultiplierRawUsd: afterMultiplierRaw,
    afterMultiplierUsd: afterMultiplier,
    discountFactor,
    afterDiscountUsd: afterDiscount,
    usdTotal,
  };
}

function group(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The price of a spec, itemised.
 *
 * `lines` sum (within 1e-4) to `usdTotal`. For a one month subscription `usdTotal` equals `usdPerMonth`.
 * FLUX figures use `opts.fluxUsd`; the official calculator also compares against an on-chain price in FLUX
 * which only exceeds the USD-derived figure when FLUX trades above roughly USD 14, so it is not modelled.
 */
export function quote(
  spec: FluxAppSpec,
  params: PricingParams = BAKED_PRICING.params,
  opts: QuoteOptions = {},
): Quote {
  const st = priceStages(spec, params, opts);
  const lines: QuoteLineItem[] = [];
  const compose = Array.isArray(spec.compose) ? spec.compose : [];
  const monthsRounded = Number(st.monthsExact.toFixed(2));

  // The base resources are shown per component, at the rates for a bundle of three instances.
  for (const c of compose) {
    const name = String(c?.name ?? '');
    const cpu = num(c?.cpu);
    const ram = num(c?.ram);
    const hdd = num(c?.hdd);
    lines.push({
      id: 'cpu',
      label: `CPU, ${fmtNum(cpu)} ${cpu === 1 ? 'core' : 'cores'}`,
      usd: r6(cpu * params.cpu * 10),
      component: name,
      note: `${fmtUsd(params.cpu)} per 0.1 core for a bundle of three instances, so ${fmtNum(cpu)} cores cost ${fmtUsd(cpu * params.cpu * 10)}.`,
    });
    lines.push({
      id: 'ram',
      label: `RAM, ${fmtNum(ram)} MB`,
      usd: r6((ram * params.ram) / 100),
      component: name,
      note: `${fmtUsd(params.ram)} per 100 MB for a bundle of three instances, so ${fmtNum(ram)} MB cost ${fmtUsd((ram * params.ram) / 100)}.`,
    });
    lines.push({
      id: 'hdd',
      label: `Disk, ${fmtNum(hdd)} GB`,
      usd: r6(hdd * params.hdd),
      component: name,
      note: `${fmtUsd(params.hdd)} per GB for a bundle of three instances, so ${fmtNum(hdd)} GB cost ${fmtUsd(hdd * params.hdd)}.`,
    });
  }
  if (st.staticip) {
    lines.push({
      id: 'staticip',
      label: 'Static IP',
      usd: r6(params.staticip),
      note: `Asking for a static IP adds ${fmtUsd(params.staticip)} to the bundle of three instances (about a third of that per instance), so it grows with the instance count. Only some nodes can offer one.`,
    });
  }
  if (st.scoped) {
    lines.push({
      id: 'scope',
      label: spec.enterprise ? 'Enterprise app' : 'Pinned nodes',
      usd: r6(params.scope),
      note: `Enterprise apps and apps pinned to specific nodes add ${fmtUsd(params.scope)} to the bundle of three instances (about a third of that per instance), so it grows with the instance count.`,
    });
  }
  if (st.enterprisePorts > 0) {
    lines.push({
      id: 'ports',
      label: `Restricted ports, ${st.enterprisePorts}`,
      usd: r6(st.enterprisePorts * params.port),
      note: `Each public port from 1 to 1023, or 8080, 8081, 8443 or 6667, adds ${fmtUsd(params.port)} to the bundle of three instances (about a third of that per instance). Other ports above 1023 add nothing.`,
    });
  }

  // Walk the official stages. Each change becomes a line, so the lines telescope to the total.
  let running = 0;
  for (const l of lines) running += l.usd;
  const push = (id: string, label: string, to: number, note: string) => {
    const delta = r6(to - running);
    running += delta;
    if (delta !== 0) lines.push({ id, label, usd: delta, note });
  };

  {
    const n = st.instances;
    let note: string;
    if (n === 1) {
      note = `One instance costs a third of the three-instance bundle (${fmtUsd(st.bundleUsd)}), rounded up to the cent.`;
    } else if (n === 3) {
      note = `Three instances is what the rates are stated for: ${fmtUsd(st.perInstanceUsd)} each, each third rounded up to the cent.`;
    } else if (st.perInstanceUsd < EXTRA_INSTANCE_FLOOR_USD && n - 1 > 2) {
      note = `One instance is ${fmtUsd(st.perInstanceUsd)}; because that is under ${fmtUsd(EXTRA_INSTANCE_FLOOR_USD)}, each of the other ${n - 1} costs a flat ${fmtUsd(EXTRA_INSTANCE_FLOOR_USD)}.`;
    } else {
      note = `${n} instances at ${fmtUsd(st.perInstanceUsd)} each (a third of the bundle, rounded up to the cent).`;
    }
    push('instances', `${n} ${n === 1 ? 'instance' : 'instances'}`, st.instancePriceUsd, note);
  }

  let minimumApplied = false;
  if (st.afterMonthlyFloorUsd !== st.instancePriceUsd) {
    minimumApplied = true;
    push(
      'minimum',
      'Monthly minimum',
      st.afterMonthlyFloorUsd,
      `No app costs less than ${fmtUsd(params.minUSDPrice)} a month, so the price is raised to that.`,
    );
  }
  if (st.monthsExact !== 1) {
    push(
      'duration',
      `Subscription, ${fmtNum(monthsRounded)} months`,
      st.afterDurationScaleUsd,
      `${group(st.expireBlocks)} blocks is ${fmtNum(monthsRounded)} times the one-month length of 88,000 blocks, so the monthly price is multiplied by ${fmtNum(monthsRounded)}.`,
    );
  }
  if (st.creditUsd > 0) {
    push(
      'credit',
      'Credit for the unused subscription',
      st.afterCreditUsd,
      `An update is credited with the unused part of the old subscription, ${fmtUsd(st.creditUsd)}.`,
    );
  }
  if (st.hwFactor !== 1) {
    const pct = st.hwFactor === 0.8 ? '20' : '10';
    push(
      'hw-discount',
      `Small app discount, ${pct} percent`,
      st.afterHwUsd,
      `Apps under ${st.hwFactor === 0.8 ? '3 cores, 6 GB of RAM and 150 GB of disk' : '7 cores, 29 GB of RAM and 370 GB of disk'} with fewer than 4 instances get ${pct} percent off.`,
    );
  }
  if (st.marketplace > 1) {
    push(
      'marketplace',
      'Marketplace multiplier',
      st.afterMarketUsd,
      `The name starts with a Flux marketplace app, which carries a price multiplier of ${st.marketplace}.`,
    );
  }
  if (st.afterMultiplierRawUsd < params.minUSDPrice) {
    minimumApplied = true;
    push(
      'minimum-final',
      'Minimum price',
      st.afterMultiplierUsd,
      `After the discounts the price is under ${fmtUsd(params.minUSDPrice)}, the least the network charges, so it is raised to that.`,
    );
  }
  if (st.discountFactor !== 1) {
    const d = durationDiscount(st.monthsExact);
    push(
      'duration-discount',
      `Long subscription discount, ${d ? d.label : ''}`,
      st.afterDiscountUsd,
      'Subscriptions of 3, 6 and 9 months or more get 3, 6 and 12 percent off the whole price.',
    );
  }
  {
    const delta = r6(st.usdTotal - running);
    if (delta !== 0) {
      running += delta;
      lines.push({
        id: 'rounding',
        label: 'Rounded up to .49 or .99',
        usd: delta,
        note: 'The network rounds every price up to the next amount ending in .49 or .99.',
      });
    }
  }

  const months = st.monthsExact;
  const fluxUsd =
    opts.fluxUsd !== undefined && opts.fluxUsd !== null && opts.fluxUsd > 0 ? opts.fluxUsd : null;
  const fluxTotal =
    fluxUsd === null ? null : Number(((st.usdTotal / fluxUsd) * params.fluxmultiplier).toFixed(2));
  const divisor = months > 0 ? months : 1;
  return {
    usdPerMonth: Number((st.usdTotal / divisor).toFixed(2)),
    fluxPerMonth: fluxTotal === null ? null : Number((fluxTotal / divisor).toFixed(2)),
    fluxUsd,
    months: Number(months.toFixed(4)),
    usdTotal: st.usdTotal,
    fluxTotal,
    expireBlocks: st.expireBlocks,
    instances: st.instances,
    lines,
    minimumApplied,
    basis: opts.basis ?? 'computed',
    paramsSource: opts.paramsSource ?? 'baked',
  };
}

/** Normalise loose input and quote it in one step. Never throws. */
export function quoteLoose(
  input: unknown,
  params: PricingParams = BAKED_PRICING.params,
  opts: QuoteOptions = {},
): Quote {
  return quote(normalizeSpec(input).spec, params, opts);
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

export interface UpdateCredit {
  /** USD credited for the unused part of the old subscription. */
  creditUsd: number;
  /** Fraction of the old subscription still unused, 0 to 1. */
  unusedFraction: number;
  /** What the old spec would cost for its whole subscription at today's rates. */
  previousTotalUsd: number;
}

/**
 * The credit an update earns: the unused fraction of the previous subscription, priced at today's rates.
 * Ported from `getAppFiatAndFluxPrice` ("previousSpecsPrice"). Ignores the PON fork adjustment for apps
 * registered before block 2020000 (all of which have long expired or been renewed).
 *
 * `blocksRemaining` is how many blocks the existing subscription has left; `previousExpire` its length.
 */
export function updateCredit(
  previous: FluxAppSpec,
  params: PricingParams,
  blocksRemaining: number,
  previousExpire: number = previous.expire,
): UpdateCredit {
  const st = priceStages(previous, params, { marketplaceMultiplier: 1 });
  const prevExpire = Math.trunc(num(previousExpire, 0)) || DEFAULT_EXPIRE_BLOCKS;
  // previousSpecsPrice = appPricePerMonth(previous) * previousExpire / 88000, then toFixed(2)
  const previousTotal = toFixed2(st.afterMonthlyFloorUsd * (prevExpire / BLOCKS_PER_MONTH));
  const remaining = Math.max(0, Math.min(prevExpire, num(blocksRemaining, 0)));
  const unused = remaining / prevExpire;
  return { creditUsd: r6(unused * previousTotal), unusedFraction: unused, previousTotalUsd: previousTotal };
}
