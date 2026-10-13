/**
 * The Flux domain engine as the lesson runtime sees it: normalise, default, lint and price a spec.
 *
 * `shared/flux` is pure and shared with the server. The lesson route loads it lazily (it is not part of
 * the route's first chunk) and everything that needs it takes a `LessonEngine` argument, so the logic stays
 * pure and testable with a fake. A fake may leave `lintSpec` null: lint checks then cannot be evaluated
 * and validation reports "not verified" instead of a false result.
 */

import type { FluxAppSpec, LintReport, PricingParams, Quote } from '@shared/flux/types';
import type { CheckContext, CheckLint } from './checks';

export interface NormalizeOutcome {
  spec: FluxAppSpec;
  defaulted: string[];
  notes: string[];
  coerced: string[];
  dropped: string[];
}

export interface QuoteOpts {
  fluxUsd?: number | null;
  months?: number;
}

export interface LessonEngine {
  normalizeSpec(input: unknown): NormalizeOutcome;
  defaultSpec(): FluxAppSpec;
  /** Null only in a fake engine. */
  lintSpec: ((spec: FluxAppSpec) => LintReport) | null;
  quote(spec: FluxAppSpec, params?: PricingParams, opts?: QuoteOpts): Quote;
  /** The built-in pricing snapshot, used when the live parameters are not available. */
  baked: { params: PricingParams; fluxUsd: number; capturedAt: string };
  /** Known lint codes, or null when the catalogue is not available. */
  lintCodes: ReadonlySet<string> | null;
  /** Blocks in one subscription month (88,000). */
  blocksPerMonth: number;
}

type Mod = Record<string, unknown>;

let loading: Promise<LessonEngine> | null = null;
let ready: LessonEngine | null = null;

/** Build an engine from already imported modules (tests and the content test use this). */
export function buildEngine(mods: {
  spec: Mod;
  pricing: Mod;
  blocks?: Mod | null;
  lint?: Mod | null;
  catalogue?: Mod | null;
}): LessonEngine {
  const { spec, pricing, lint, catalogue, blocks } = mods;
  const normalizeSpec = spec.normalizeSpec as (v: unknown) => NormalizeOutcome;
  const defaultSpec = spec.defaultSpec as () => FluxAppSpec;
  const quote = pricing.quote as LessonEngine['quote'];
  const bakedModule = pricing.BAKED_PRICING as {
    params: PricingParams;
    fluxUsd: number;
    capturedAt: string;
  };
  // Lessons lint with the teaching infos included: the superset of codes a check can ever see.
  const rawLint =
    lint && typeof lint.lintSpec === 'function'
      ? (lint.lintSpec as (spec: unknown, ctx?: { teaching?: boolean }) => LintReport)
      : null;
  const lintFn: LessonEngine['lintSpec'] = rawLint ? (spec) => rawLint(spec, { teaching: true }) : null;
  const codeSource =
    (catalogue && (catalogue.LINT_CODES as unknown)) || (lint && (lint.LINT_CODES as unknown)) || null;
  const codes =
    typeof codeSource === 'object' && codeSource !== null ? new Set(Object.keys(codeSource)) : null;
  const perMonth =
    blocks && typeof blocks.BLOCKS_PER_MONTH === 'number' ? (blocks.BLOCKS_PER_MONTH as number) : 88_000;
  return {
    normalizeSpec,
    defaultSpec,
    lintSpec: lintFn,
    quote,
    baked: bakedModule,
    lintCodes: codes,
    blocksPerMonth: perMonth,
  };
}

/** Load the engine once (a separate chunk: it is not part of the lesson route's first paint). */
export function loadEngine(): Promise<LessonEngine> {
  loading ??= (async () => {
    const [spec, pricing, blocks, lint] = await Promise.all([
      import('@shared/flux/spec') as Promise<Mod>,
      import('@shared/flux/pricing') as Promise<Mod>,
      import('@shared/flux/blocks') as Promise<Mod>,
      import('@shared/flux/lint') as Promise<Mod>,
    ]);
    ready = buildEngine({ spec, pricing, blocks, lint, catalogue: lint });
    return ready;
  })();
  return loading;
}

/** The engine when it has finished loading, else null. */
export function engineNow(): LessonEngine | null {
  return ready;
}

// ---------------------------------------------------------------------------
// Facts about one spec
// ---------------------------------------------------------------------------

export interface SpecFacts {
  spec: FluxAppSpec;
  report: LintReport | null;
  lint: CheckLint | null;
  quote: Quote | null;
  usdPerMonth: number | null;
}

/** Normalise a loose spec and compute what checks read: lint codes and the monthly price. Never throws. */
export function specFacts(engine: LessonEngine, input: unknown, params?: PricingParams): SpecFacts {
  const spec = engine.normalizeSpec(input).spec;
  let report: LintReport | null = null;
  if (engine.lintSpec) {
    try {
      report = engine.lintSpec(spec);
    } catch {
      report = null;
    }
  }
  let quote: Quote | null = null;
  try {
    quote = engine.quote(spec, params ?? engine.baked.params, { months: 1 });
  } catch {
    quote = null;
  }
  return {
    spec,
    report,
    lint: report ? { valid: report.valid, codes: report.issues.map((i) => i.code) } : null,
    quote,
    usdPerMonth: quote ? quote.usdPerMonth : null,
  };
}

/** The context a `Check` is evaluated in, for a spec. */
export function checkContext(engine: LessonEngine, input: unknown, params?: PricingParams): CheckContext {
  const f = specFacts(engine, input, params);
  return { spec: f.spec, lint: f.lint, usdPerMonth: f.usdPerMonth };
}
