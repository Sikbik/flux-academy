/**
 * Prices, terms and durations for the sessions, and the `{token}` mechanism that carries them into text.
 *
 * Scenario data never contains a computed number. It says `{usd}` or `{messageLife}` and the engine fills in
 * the value here, from `quote()` (the spec the scenario builds), `orbitPlanQuoteUsd()` (an Orbit plan) and the
 * timing constants. FLUX amounts use the baked FLUX price (`BAKED_PRICING.fluxUsd`, read on its capture
 * date), so the figure is the same every run and the screen says it is a baked rate.
 */

import {
  BAKED_PRICING,
  blocksToMonths,
  blocksToSeconds,
  DEPLOY_ESTIMATE_MIN,
  derivedNames,
  type FluxAppSpec,
  humanDuration,
  IMAGE_RECHECK_HOURS,
  MCP_CANCEL_EXPIRE_BLOCKS,
  MESSAGE_TTL_SEC,
  type OrbitPlan,
  orbitPlanQuoteUsd,
  orbitPlanSpec,
  PAYMENT_WINDOW_MIN,
  quote,
} from '@shared/flux';

/** What a price view says about where it came from. */
export const PRICE_BASIS = {
  kind: 'baked' as const,
  readOn: BAKED_PRICING.capturedAt,
  source: BAKED_PRICING.source,
};

export interface QuoteLine {
  id: string;
  label: string;
  usd: number;
}

export interface QuoteView {
  /** The whole subscription, USD, after every rule. Equals one month for a one month term. */
  usd: number;
  /** The same in FLUX at the baked FLUX price, or null. */
  flux: number | null;
  months: number;
  /** True when the network's minimum price replaced the computed one. */
  minimum: boolean;
  lines: QuoteLine[];
}

export function quoteView(spec: FluxAppSpec): QuoteView {
  const q = quote(spec, BAKED_PRICING.params, { fluxUsd: BAKED_PRICING.fluxUsd, paramsSource: 'baked' });
  return {
    usd: q.usdTotal ?? q.usdPerMonth,
    flux: q.fluxTotal ?? null,
    months: q.months,
    minimum: q.minimumApplied,
    lines: q.lines.map((l) => ({ id: l.id, label: l.label, usd: l.usd })),
  };
}

export interface PlanView {
  id: string;
  name: string;
  /** `orbitPlanQuoteUsd(plan)`: the engine's price, which equals the published one (orbit.test.ts). */
  usd: number;
  flux: number | null;
  instances: number;
  size: string;
  failover: boolean;
}

export function sizeText(cpu: number, ramMb: number, hddGb: number): string {
  return `${cpu} ${cpu === 1 ? 'core' : 'cores'}, ${group(ramMb)} MB RAM, ${hddGb} GB disk`;
}

export function planView(plan: OrbitPlan): PlanView {
  const spec = orbitPlanSpec(plan);
  const q = quoteView(spec);
  return {
    id: plan.id,
    name: plan.name,
    usd: orbitPlanQuoteUsd(plan),
    flux: q.flux,
    instances: plan.instances,
    size: sizeText(plan.vcores, plan.ramMb, plan.storageGb),
    failover: plan.failover,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function group(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatUsd(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

export function formatFlux(flux: number | null): string {
  return flux === null ? 'a FLUX amount' : `${flux.toFixed(2)} FLUX`;
}

function termText(spec: FluxAppSpec): string {
  const months = blocksToMonths(spec.expire);
  const n = Number(months.toFixed(2));
  return `${n} ${n === 1 ? 'month' : 'months'}`;
}

function instancesText(n: number): string {
  return `${n} ${n === 1 ? 'instance' : 'instances'}`;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export interface TokenContext {
  spec: FluxAppSpec;
  quote: QuoteView;
  plan: PlanView | null;
  repo: string;
}

/**
 * Every token the scenario data may use. The names are plain words; the values are text. `{usd}` and
 * `{flux}` are the spec's quote; `{planUsd}` is the Orbit plan's price from `orbitPlanQuoteUsd`.
 */
export function tokenValues(ctx: TokenContext): Record<string, string> {
  const c = ctx.spec.compose[0];
  const names = derivedNames(ctx.spec);
  const values: Record<string, string> = {
    app: ctx.spec.name,
    image: c?.repotag ?? '',
    size: c ? sizeText(c.cpu, c.ram, c.hdd) : '',
    instances: instancesText(ctx.spec.instances),
    instanceCount: String(ctx.spec.instances),
    term: termText(ctx.spec),
    termMonths: String(Number(blocksToMonths(ctx.spec.expire).toFixed(2))),
    usd: formatUsd(ctx.quote.usd),
    flux: formatFlux(ctx.quote.flux),
    url: `https://${names.appDomain}`,
    repo: ctx.repo,
    // Durations: shared/flux/timing.ts, never typed.
    messageLife: humanDuration(MESSAGE_TTL_SEC),
    deployEstimate: humanDuration(DEPLOY_ESTIMATE_MIN * 60),
    paymentWindow: humanDuration(PAYMENT_WINDOW_MIN * 60),
    cancelTerm: humanDuration(blocksToSeconds(MCP_CANCEL_EXPIRE_BLOCKS)),
    imageRecheck: `${IMAGE_RECHECK_HOURS} hours`,
    pricingDate: BAKED_PRICING.capturedAt,
  };
  if (ctx.plan) {
    values.planName = ctx.plan.name;
    values.planUsd = formatUsd(ctx.plan.usd);
    values.planFlux = formatFlux(ctx.plan.flux);
    values.planInstances = instancesText(ctx.plan.instances);
    values.planSize = ctx.plan.size;
  }
  return values;
}

const TOKEN = /\{([A-Za-z]+)\}/g;

/** Replace `{name}` with its value. An unknown token is left as it is, which the scenario test catches. */
export function resolveTokens(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(TOKEN, (whole, name: string) => values[name] ?? whole);
}

/** The names used in a string, for the test that every token a scenario uses is one the engine knows. */
export function tokensIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TOKEN)) if (m[1]) out.push(m[1]);
  return out;
}
