/**
 * Numbers the troubleshooting copy quotes, read from the engine in `shared/flux` so the words cannot drift
 * from the code: protocol limits (`LIMITS`), the baked rate card (`BAKED_PRICING`, read on 2026-10-12) and
 * the price of the small example app (`quote`). A price is a figure at those rates, so the copy says
 * "at the rates read on" the date in `RATES_DATE`.
 *
 * Durations (the install waits, the location record lifetime, the image re-check, the load balancer's
 * timers, the payment window) come from `shared/flux/timing.ts`, which gives each its FACTS section.
 * Phrases that quote the product's own screen text word for word (for example "Up to 45 min after
 * payment") stay literal on purpose: they are what the screen says, not what we compute.
 */

import type { FluxAppSpec, FluxComponentSpec } from '@shared/flux';
import {
  BAKED_PRICING,
  BLOCKS_PER_MONTH,
  BUNDLE_INSTANCES,
  blocksPerDay,
  blocksToSeconds,
  CRASH_BACKOFF_SEC,
  DEPLOY_ESTIMATE_MIN,
  DURATION_DISCOUNTS,
  defaultComponent,
  defaultSpec,
  EXTRA_INSTANCE_FLOOR_USD,
  FDM_EJECT_SEC,
  FDM_TIMING,
  FREE_UPDATE_RATE_LIMITS,
  GATEWAY_TIMEOUT_SEC,
  HW_DISCOUNTS,
  IMAGE_RECHECK_HOURS,
  INSTALL_START_USUAL_MIN,
  LEGACY_BLOCK_SEC,
  LIMITS,
  LOCATION_TTL_MIN,
  MESSAGE_TTL_SEC,
  PAYMENT_WINDOW_MIN,
  priceStages,
  quote,
  REGISTRATION_DEADLINE_MIN,
  roundUpToCharmPrice,
  SIGN_TIMESTAMP_MAX_AGE_SEC,
  SIGN_TIMESTAMP_MAX_AHEAD_SEC,
  SPAWN_DEFERRAL_MIN,
  SPAWN_DEFERRAL_RANGE_MIN,
  SYNCED_RESPAWN_EXTRA_MIN,
  TARGET_BLOCK_SEC,
} from '@shared/flux';

/** The date the baked rate card was read from the network. */
export const RATES_DATE = BAKED_PRICING.capturedAt;

const P = BAKED_PRICING.params;

export const usd = (n: number): string => `USD ${n.toFixed(2)}`;
const grouped = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---- the small example app: 0.5 core, 500 MB, 5 GB, public port 31001 ------------------------------

const SMALL: Partial<FluxComponentSpec> = {
  cpu: 0.5,
  ram: 500,
  hdd: 5,
  ports: [31001],
  containerPorts: [3000],
};

function smallSpec(
  instances: number,
  comp: Partial<FluxComponentSpec> = {},
  over: Partial<FluxAppSpec> = {},
) {
  return {
    ...defaultSpec(),
    instances,
    ...over,
    compose: [defaultComponent({ ...SMALL, ...comp })],
  } satisfies FluxAppSpec;
}

/** The monthly price, at the baked rates, of the small example app. */
function small(instances: number, comp: Partial<FluxComponentSpec> = {}, over: Partial<FluxAppSpec> = {}) {
  return quote(smallSpec(instances, comp, over), P, { fluxUsd: BAKED_PRICING.fluxUsd }).usdPerMonth;
}

const four = priceStages(smallSpec(4), P);
const three = priceStages(smallSpec(3), P);
/** What four instances would cost without the flat fee for each extra instance: the bundle share times four. */
const fourWithoutFlatFee = roundUpToCharmPrice(
  (Math.ceil(four.perInstanceUsd * 3 * 100) + Math.ceil(four.perInstanceUsd * 100)) / 100,
);

const hoursOf = (blocks: number): number => blocksToSeconds(blocks) / 3600;
/** "30 seconds, 5, 15 and 30 minutes": the crash restart ladder after the first immediate restart. */
const CRASH_LADDER_TEXT: string = (() => {
  const steps = CRASH_BACKOFF_SEC.filter((sec) => sec > 0);
  const parts = steps.map((sec) => (sec < 60 ? `${sec} seconds` : `${sec / 60}`));
  const last = steps[steps.length - 1] ?? 0;
  const lead = parts.slice(0, -1).join(', ');
  return `${lead} and ${last / 60} minutes`;
})();

export const FIGURES = {
  ratesDate: RATES_DATE,

  // fees, as the rate card states them (added to the bundle, then divided by the bundle size)
  portFee: usd(P.port),
  scopeFee: usd(P.scope),
  staticIpFee: usd(P.staticip),
  staticIpPerInstance: usd(P.staticip / BUNDLE_INSTANCES),
  portFeePerInstance: usd(P.port / BUNDLE_INSTANCES),
  scopeFeePerInstance: usd(P.scope / BUNDLE_INSTANCES),
  bundle: BUNDLE_INSTANCES,
  minPrice: usd(P.minUSDPrice),
  /** "3 percent off from 3 months, 6 percent off from 6 months, 12 percent off from 9 months". */
  durationDiscounts: [...DURATION_DISCOUNTS]
    .sort((a, b) => a.minMonths - b.minMonths)
    .map((d) => `${d.label} off from ${d.minMonths} months`)
    .join(', '),
  fluxDiscountPercent: Math.round((1 - P.fluxmultiplier) * 100),
  extraInstanceFloor: usd(EXTRA_INSTANCE_FLOOR_USD),

  // the small example app
  small1: usd(small(1)),
  small3: usd(small(3)),
  small4: usd(small(4)),
  small5: usd(small(5)),
  small3Port8080: usd(small(3, { ports: [8080], containerPorts: [8080] })),
  small3Static: usd(small(3, {}, { staticip: true })),
  smallOneInstance: usd(four.perInstanceUsd),
  smallFourBeforeRounding: usd(four.instancePriceUsd),
  /** At three instances the discounted total, before the minimum price lifts it. */
  small3Discounted: usd(three.afterMultiplierRawUsd),
  smallFourWithoutFlatFee: usd(fourWithoutFlatFee),

  // durations (shared/flux timing.ts; FACTS 2.4, 4.5, 4.7, 6.1, 6.3, 6.4, 9.5.1)
  /** The FluxCloud screen's estimate, minutes. */
  deployEstimateMin: DEPLOY_ESTIMATE_MIN,
  /** "1 to 3": the usual wait before a node starts installing. */
  installStartUsual: `${INSTALL_START_USUAL_MIN.from} to ${INSTALL_START_USUAL_MIN.to}`,
  spawnNimbusMin: SPAWN_DEFERRAL_MIN.nimbusSmallApp,
  spawnStratusMediumMin: SPAWN_DEFERRAL_MIN.stratusMediumApp,
  spawnStratusSmallMin: SPAWN_DEFERRAL_MIN.stratusSmallApp,
  /** "57 to 117". */
  spawnRange: `${SPAWN_DEFERRAL_RANGE_MIN.min} to ${SPAWN_DEFERRAL_RANGE_MIN.max}`,
  /** "57, 87 or 117". */
  spawnList: `${SPAWN_DEFERRAL_MIN.nimbusSmallApp}, ${SPAWN_DEFERRAL_MIN.stratusMediumApp} or ${SPAWN_DEFERRAL_MIN.stratusSmallApp}`,
  paymentWindowMin: PAYMENT_WINDOW_MIN,
  /** The node-side deadline for the payment, minutes after registration (the message lifetime). */
  registrationDeadlineMin: REGISTRATION_DEADLINE_MIN,
  /** "1 hour": how old a signed message may be. */
  signMaxAge: `${SIGN_TIMESTAMP_MAX_AGE_SEC / 3600} hour`,
  /** "5 minutes": how far ahead of the node clock it may be. */
  signMaxAhead: `${SIGN_TIMESTAMP_MAX_AHEAD_SEC / 60} minutes`,
  messageTtlSec: MESSAGE_TTL_SEC,
  /** The block interval in seconds (30) and before the fork in minutes (2). */
  blockSec: TARGET_BLOCK_SEC,
  legacyBlockMin: LEGACY_BLOCK_SEC / 60,
  locationTtlMin: LOCATION_TTL_MIN,
  syncedExtraMin: SYNCED_RESPAWN_EXTRA_MIN,
  imageRecheckHours: IMAGE_RECHECK_HOURS,
  stickyHours: FDM_TIMING.stickyHours,
  ejectSec: FDM_EJECT_SEC,
  gatewayTimeoutSec: GATEWAY_TIMEOUT_SEC,
  fdmConnectSec: FDM_TIMING.connectTimeoutSec,
  fdmRequestSec: FDM_TIMING.requestTimeoutSec,
  fdmServerSec: FDM_TIMING.serverTimeoutSec,
  fdmSyncedServerSec: FDM_TIMING.syncedServerTimeoutSec,
  fdmClientSec: FDM_TIMING.clientTimeoutSec,
  /** "30 seconds, 5, 15 and 30 minutes". */
  crashLadder: CRASH_LADDER_TEXT,
  /** "at most 5 update messages in the last 720 blocks, 8 in 1440 and 10 in 3600". */
  freeUpdateWindows: `at most ${FREE_UPDATE_RATE_LIMITS[0]?.updates} update messages in the last ${FREE_UPDATE_RATE_LIMITS[0]?.blocks} blocks, ${FREE_UPDATE_RATE_LIMITS[1]?.updates} in ${FREE_UPDATE_RATE_LIMITS[1]?.blocks} and ${FREE_UPDATE_RATE_LIMITS[2]?.updates} in ${FREE_UPDATE_RATE_LIMITS[2]?.blocks}`,
  /** "6 hours, 12 hours and 30 hours": the windows above at the current block interval. */
  freeUpdateHours: `${hoursOf(FREE_UPDATE_RATE_LIMITS[0]?.blocks ?? 0)} hours, ${hoursOf(FREE_UPDATE_RATE_LIMITS[1]?.blocks ?? 0)} hours and ${hoursOf(FREE_UPDATE_RATE_LIMITS[2]?.blocks ?? 0)} hours`,
  /** Blocks in one week and in one pricing month, grouped. */
  blocksPerWeek: grouped(blocksPerDay() * 7),
  blocksPerMonth: grouped(BLOCKS_PER_MONTH),

  // the discount thresholds (FACTS 4.3 step D, 2.4)
  discountSmall: `under ${HW_DISCOUNTS[0]?.maxCpu} cores, ${grouped(HW_DISCOUNTS[0]?.maxRam ?? 0)} MB of RAM and ${HW_DISCOUNTS[0]?.maxHdd} GB of disk`,
  discountMedium: `under ${HW_DISCOUNTS[1]?.maxCpu} cores, ${grouped(HW_DISCOUNTS[1]?.maxRam ?? 0)} MB and ${HW_DISCOUNTS[1]?.maxHdd} GB`,
  discountSmallLabel: HW_DISCOUNTS[0]?.label ?? '',
  discountMediumLabel: HW_DISCOUNTS[1]?.label ?? '',
  discountBelowInstances: LIMITS.instances.smallAppDiscountBelow,

  // protocol limits
  maxInstances: LIMITS.instances.max,
  minInstances: LIMITS.instances.min,
  legacyMinInstances: LIMITS.instances.legacyMin,
  maxComponents: LIMITS.component.max,
  maxPortsPerComponent: LIMITS.ports.perComponentMax,
  maxEnv: LIMITS.environment.maxCount,
  maxEnvLength: LIMITS.environment.maxLength,
  maxCommands: LIMITS.commands.maxCount,
  maxCommandLength: LIMITS.commands.maxLength,
  maxNameLength: LIMITS.name.maxLength,
  maxImageBytes: grouped(LIMITS.repotag.maxImageBytes),
  totalCpu: LIMITS.totals.cpu,
  totalRam: grouped(LIMITS.totals.ram),
  totalHdd: LIMITS.totals.hdd,
  portMin: LIMITS.ports.min,
  portMax: LIMITS.ports.max,

  // what a nominal Cumulus node offers an app (FACTS 2.3)
  cumulusCpu: LIMITS.tierCapacity.cumulus.cpu,
  cumulusRam: grouped(LIMITS.tierCapacity.cumulus.ram),
  cumulusHdd: LIMITS.tierCapacity.cumulus.hdd,
  cumulusHddCeiling: LIMITS.tierCapacity.cumulus.hddCeiling,
} as const;

/** The fee ports as a sentence part: "1 to 1023, 8080, 8081, 8443 and 6667". Port 0 is refused, so it is left out. */
export const FEE_PORTS_TEXT: string = (() => {
  const parts = LIMITS.ports.surchargeRanges.map((r) =>
    r.from === r.to ? String(r.from) : `${Math.max(r.from, LIMITS.ports.min)} to ${r.to}`,
  );
  const last = parts.pop();
  return parts.length > 0 ? `${parts.join(', ')} and ${last}` : (last ?? '');
})();
