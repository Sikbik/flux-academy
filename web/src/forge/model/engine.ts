/**
 * The forge's view of the shared Flux engine (`shared/flux`): lint, price and normalise, synchronously.
 *
 * Everything here is a thin, never-throwing wrapper so the UI can call it on every keystroke. The rules
 * themselves live in `shared/flux` and are shared with the server, which is why a lesson, the forge and the
 * API always agree on a price or a verdict.
 */

import { LINT_CODES, type LintContext, lintSpec } from '@shared/flux/lint';
import { BAKED_PRICING, quote as quoteSpec } from '@shared/flux/pricing';
import { defaultSpec, normalizeSpec } from '@shared/flux/spec';
import type { FluxAppSpec, LintReport, PricingParams, Quote } from '@shared/flux/types';

export { LINT_CODES, type LintContext };

/** Where the numbers a price was computed from came from. */
export type ParamsSource = 'live' | 'cache' | 'baked';

export interface PricingContext {
  /** Official per-resource rates. */
  params: PricingParams;
  /** USD per FLUX, or null when unknown (the FLUX figure is then hidden, not guessed). */
  fluxUsd: number | null;
  /** Where the rates came from. */
  source: ParamsSource;
  /** Where `fluxUsd` came from, when it differs from `source` (live rates with a built-in FLUX price). */
  fluxSource?: ParamsSource;
  /** ISO date the baked numbers were captured, when `source` is `baked`. */
  asOf?: string;
}

/** The built-in snapshot: used until live rates arrive and whenever the API cannot be reached. */
export const BAKED_CONTEXT: PricingContext = {
  params: BAKED_PRICING.params,
  fluxUsd: BAKED_PRICING.fluxUsd,
  source: 'baked',
  asOf: BAKED_PRICING.capturedAt,
};

/** An empty valid report, for the impossible case that the engine throws. */
const EMPTY_REPORT: LintReport = { valid: true, errors: 0, warnings: 0, infos: 0, issues: [] };

/** Lint anything. `input` may be the raw parsed JSON so dropped and missing keys are reported. */
export function lintInput(input: unknown, ctx: LintContext = {}): LintReport {
  try {
    return lintSpec(input, ctx);
  } catch {
    return EMPTY_REPORT;
  }
}

/** The price of a spec at a set of rates. The spec's own `expire` decides the subscription length. */
export function priceSpec(spec: FluxAppSpec, pricing: PricingContext = BAKED_CONTEXT): Quote {
  try {
    return quoteSpec(spec, pricing.params, {
      fluxUsd: pricing.fluxUsd,
      paramsSource: pricing.source,
    });
  } catch {
    // quote() is total; this keeps the promise if a future change breaks it.
    return {
      usdPerMonth: 0,
      fluxPerMonth: null,
      fluxUsd: pricing.fluxUsd,
      months: 1,
      lines: [],
      minimumApplied: false,
      basis: 'computed',
      paramsSource: pricing.source,
    };
  }
}

/** One point of the "price versus instances" curve. */
export interface CurvePoint {
  instances: number;
  usdPerMonth: number;
  /** True when the small app discount (20 or 10 percent) is part of this price. */
  discounted: boolean;
}

/** Price the same spec at 1 to `max` instances. Pure; ten quotes cost well under a millisecond. */
export function priceCurve(
  spec: FluxAppSpec,
  pricing: PricingContext = BAKED_CONTEXT,
  max = 10,
): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let n = 1; n <= max; n++) {
    const q = priceSpec({ ...spec, instances: n }, pricing);
    out.push({
      instances: n,
      usdPerMonth: q.usdPerMonth,
      discounted: q.lines.some((l) => l.id === 'hw-discount'),
    });
  }
  return out;
}

/** Normalise loose input; never throws. */
export function normalizeLoose(input: unknown): ReturnType<typeof normalizeSpec> {
  return normalizeSpec(input);
}

/** A fresh default spec (a valid hello world). */
export function freshSpec(): FluxAppSpec {
  return defaultSpec();
}
