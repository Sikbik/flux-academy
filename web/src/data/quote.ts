/**
 * `useQuote(spec, opts)` and `useLint(spec, opts)`: the price and the teachable lint of a spec.
 *
 * Both compute locally, instantly and offline with the shared engine (`shared/flux`, see local.ts),
 * debounced so typing in an editor stays smooth. `useQuote` can additionally ask the server to confirm
 * the price with Flux's own calculator (`verify`), and shows which one you are looking at:
 *
 *   basis  'official'  the Flux calculator confirmed it
 *          'computed'  the local formula at the current official rates
 *          'baked'     the local formula at the built-in rates (the API has not answered)
 *
 * Until the shared engine lands, both hooks ask the server instead, and report `unavailable` with
 * `quote: null` when the server cannot be reached either.
 */

import type { PricingSnapshot, QuoteResponse } from '@shared/api';
import type { LintReport, Quote } from '@shared/flux/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getFlags } from '@/lib/flags';
import { loadLocalEngine } from './local';
import { postLint, postQuote } from './requests';
import { useDataStore } from './store';
import { useLayer } from './useLayer';

export type QuoteBasis = 'official' | 'computed' | 'baked';

/** What the server said about a `verify` request: confirmed, or why not (`rate_limited`, ...). */
export type QuoteVerification = NonNullable<QuoteResponse['verification']>;

export interface QuoteOptions {
  /** Subscription months to total, 1 to 12. Default 1. */
  months?: number;
  /** Ask the server to confirm with Flux's own calculator (the result may still be `computed`). */
  verify?: boolean;
  /** Debounce for the local computation, ms. Default 120. */
  debounceMs?: number;
  /** Turn the hook off (no work, `idle`). Default true. */
  enabled?: boolean;
}

export interface QuoteResult {
  quote: Quote | null;
  lint: LintReport | null;
  basis: QuoteBasis | null;
  /**
   * `idle` disabled or no spec, `pending` computing, `ready` has a quote, `unavailable` neither the
   * local engine nor the server could price it, `error` the engine threw (the spec is not priceable).
   */
  status: 'idle' | 'pending' | 'ready' | 'unavailable' | 'error';
  error: string | null;
  /** A server confirmation is in flight (the computed quote is already showing). */
  verifying: boolean;
  /** The server's answer to `verify`, when it gave one. Null until then, and without `verify`. */
  verification: QuoteVerification | null;
}

const IDLE: QuoteResult = {
  quote: null,
  lint: null,
  basis: null,
  status: 'idle',
  error: null,
  verifying: false,
  verification: null,
};

function specKey(spec: unknown): string | null {
  try {
    return JSON.stringify(spec) ?? null;
  } catch {
    return null;
  }
}

function basisOf(q: Quote): QuoteBasis {
  if (q.basis === 'official') return 'official';
  return q.paramsSource === 'baked' ? 'baked' : 'computed';
}

function clampMonths(months: number | undefined): number {
  const m = Math.floor(months ?? 1);
  return Number.isFinite(m) ? Math.min(12, Math.max(1, m)) : 1;
}

/** Whether asking the server makes sense right now. */
function serverReachable(): boolean {
  if (getFlags().demo) return false;
  return useDataStore.getState().connection !== 'offline';
}

export function useQuote(spec: unknown, opts: QuoteOptions = {}): QuoteResult {
  useLayer();
  const enabled = opts.enabled ?? true;
  const months = clampMonths(opts.months);
  const verify = opts.verify === true;
  const debounceMs = opts.debounceMs ?? 120;
  const key = enabled ? specKey(spec) : null;
  const pricing = useDataStore((s) => s.pricing.data);
  const [state, setState] = useState<QuoteResult>(IDLE);
  const specRef = useRef(spec);
  specRef.current = spec;

  useEffect(() => {
    if (key === null) {
      setState(IDLE);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setState((s) => (s.status === 'ready' ? s : { ...IDLE, status: 'pending' }));

    const timer = setTimeout(() => {
      void (async () => {
        const current = specRef.current;
        const engine = await loadLocalEngine();
        if (cancelled) return;

        // 1. Local, instant, offline.
        let local: { quote: Quote; lint: LintReport } | null = null;
        let failure: string | null = null;
        if (engine && pricing) {
          try {
            local = {
              quote: engine.quote(current, pricing.params, { fluxUsd: pricing.fluxUsd, months }),
              lint: engine.lint(current),
            };
          } catch (e) {
            failure = e instanceof Error ? e.message : 'The spec could not be priced.';
          }
        }
        if (local) {
          setState({
            quote: local.quote,
            lint: local.lint,
            basis: basisOf(local.quote),
            status: 'ready',
            error: null,
            verifying: verify && serverReachable(),
            verification: null,
          });
        } else if (failure) {
          setState({ ...IDLE, status: 'error', error: failure });
        }

        // 2. The server: confirmation when asked, or the only source until the engine exists.
        if (!local && !failure && engine) return; // engine present but pricing params not loaded yet
        if ((!local && !failure) || verify) {
          if (!serverReachable()) {
            if (!local && !failure) setState({ ...IDLE, status: 'unavailable' });
            return;
          }
          const res = await postQuote(
            { spec: current, months, verify: verify || undefined },
            { signal: controller.signal },
          );
          if (cancelled) return;
          if (res.ok) {
            const { quote, lint, verification } = res.envelope.data;
            setState({
              quote,
              lint,
              basis: basisOf(quote),
              status: 'ready',
              error: null,
              verifying: false,
              verification: verification ?? null,
            });
          } else if (res.error.kind !== 'aborted') {
            setState((s) =>
              s.status === 'ready'
                ? { ...s, verifying: false }
                : { ...IDLE, status: 'unavailable', error: res.error.message },
            );
          }
        }
      })();
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, months, verify, debounceMs, pricing]);

  return useMemo(() => state, [state]);
}

export interface LintResult {
  report: LintReport | null;
  status: 'idle' | 'pending' | 'ready' | 'unavailable';
  error: string | null;
}

/** The teachable lint of a spec: local when the shared engine exists, else the server's. */
export function useLint(spec: unknown, opts: { debounceMs?: number; enabled?: boolean } = {}): LintResult {
  useLayer();
  const enabled = opts.enabled ?? true;
  const debounceMs = opts.debounceMs ?? 120;
  const key = enabled ? specKey(spec) : null;
  const [state, setState] = useState<LintResult>({ report: null, status: 'idle', error: null });
  const specRef = useRef(spec);
  specRef.current = spec;

  useEffect(() => {
    if (key === null) {
      setState({ report: null, status: 'idle', error: null });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        const current = specRef.current;
        const engine = await loadLocalEngine();
        if (cancelled) return;
        if (engine) {
          try {
            setState({ report: engine.lint(current), status: 'ready', error: null });
            return;
          } catch (e) {
            setState({
              report: null,
              status: 'unavailable',
              error: e instanceof Error ? e.message : 'lint failed',
            });
            return;
          }
        }
        if (!serverReachable()) {
          setState({ report: null, status: 'unavailable', error: null });
          return;
        }
        const res = await postLint(current, { signal: controller.signal });
        if (cancelled) return;
        if (res.ok) setState({ report: res.envelope.data, status: 'ready', error: null });
        else if (res.error.kind !== 'aborted') {
          setState({ report: null, status: 'unavailable', error: res.error.message });
        }
      })();
    }, debounceMs);
    setState((s) => (s.status === 'ready' ? s : { report: null, status: 'pending', error: null }));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, debounceMs]);

  return state;
}

/** Pure helper for non-React callers (the command deck): the local quote of a spec, or null. */
export async function quoteLocally(
  spec: unknown,
  pricing: PricingSnapshot,
  months = 1,
): Promise<Quote | null> {
  const engine = await loadLocalEngine();
  if (!engine) return null;
  try {
    return engine.quote(spec, pricing.params, { fluxUsd: pricing.fluxUsd, months: clampMonths(months) });
  } catch {
    return null;
  }
}
