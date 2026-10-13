/**
 * The local copy of the shared Flux engine (`shared/flux/`): price and lint computed in the browser,
 * instantly, with the same code the server runs, so a lesson never disagrees with the API.
 *
 * The engine is owned by the domain agent and may not exist yet. It is discovered at build time with a
 * glob and loaded lazily on first use; until it lands every function here reports `null`, and
 * `useQuote` falls back to asking the server. The expected module surface is the one in
 * docs/ARCHITECTURE.md section 4.2:
 *
 *   pricing.ts  quote(spec, params, { fluxUsd?, months? }) -> Quote
 *   lint.ts     lintSpec(spec, ctx?) -> LintReport
 *   spec.ts     normalizeSpec(unknown), defaultSpec()
 *
 * Everything is duck typed and wrapped in try/catch: a surprise in the engine must never take a page
 * down.
 */

import type { LintReport, PricingParams, Quote } from '@shared/flux/types';
import { isRec } from './validate';

type Loader = () => Promise<Record<string, unknown>>;

const loaders = import.meta.glob<Record<string, unknown>>('../../../shared/flux/{pricing,lint,spec}.ts');

function loaderFor(name: 'pricing' | 'lint' | 'spec'): Loader | null {
  const hit = Object.entries(loaders).find(([path]) => path.endsWith(`/${name}.ts`));
  return hit ? (hit[1] as Loader) : null;
}

export interface LocalEngine {
  quote(spec: unknown, params: PricingParams, opts: { fluxUsd: number | null; months: number }): Quote;
  lint(spec: unknown): LintReport;
}

let engine: LocalEngine | null | undefined;
let loading: Promise<LocalEngine | null> | null = null;

/** Replace the engine (tests). Pass `undefined` to re-discover. */
export function setLocalEngine(next: LocalEngine | null | undefined): void {
  engine = next;
  loading = null;
}

function build(
  pricing: Record<string, unknown> | null,
  lint: Record<string, unknown> | null,
  spec: Record<string, unknown> | null,
): LocalEngine | null {
  const quoteFn =
    pricing && typeof pricing.quote === 'function' ? (pricing.quote as (...a: unknown[]) => unknown) : null;
  const lintFn =
    lint && typeof lint.lintSpec === 'function' ? (lint.lintSpec as (...a: unknown[]) => unknown) : null;
  const normalize =
    spec && typeof spec.normalizeSpec === 'function' ? (spec.normalizeSpec as (v: unknown) => unknown) : null;

  const full = (value: unknown): unknown => {
    if (!normalize) return value;
    const n = normalize(value);
    return isRec(n) && 'spec' in n ? n.spec : n;
  };

  if (!quoteFn && !lintFn) return null;
  return {
    quote(specIn, params, opts) {
      if (!quoteFn) throw new Error('the local pricing engine is not available');
      return quoteFn(full(specIn), params, opts) as Quote;
    },
    lint(specIn) {
      if (!lintFn) throw new Error('the local lint engine is not available');
      return lintFn(full(specIn)) as LintReport;
    },
  };
}

/** Load the engine once. Resolves null when `shared/flux` does not provide it (yet). */
export function loadLocalEngine(): Promise<LocalEngine | null> {
  if (engine !== undefined) return Promise.resolve(engine);
  loading ??= (async () => {
    try {
      const [p, l, s] = await Promise.all(
        (['pricing', 'lint', 'spec'] as const).map(async (n) => {
          const load = loaderFor(n);
          return load ? await load().catch(() => null) : null;
        }),
      );
      engine = build(p ?? null, l ?? null, s ?? null);
    } catch {
      engine = null;
    }
    return engine;
  })();
  return loading;
}

/** Synchronous view of the engine: null until `loadLocalEngine()` has resolved with one. */
export function localEngineNow(): LocalEngine | null {
  return engine ?? null;
}
