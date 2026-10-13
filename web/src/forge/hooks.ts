/**
 * React bindings for the forge's framework-free session: creating one per editor, keeping it fed with the
 * live rates, reading it with `useSyncExternalStore`, and the optional server confirmation of a price.
 */

import type { PricingSnapshot } from '@shared/api';
import type { FluxAppSpec, Quote } from '@shared/flux/types';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { postQuote, usePricing } from '@/data';
import type { DeepPartial } from '@/learn/types';
import {
  BAKED_CONTEXT,
  createSession,
  DEFAULT_LINT_CONTEXT,
  type ForgeSession,
  type ForgeSnapshot,
  type LintContext,
  type PricingContext,
  specFromPartial,
} from './model';

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

/**
 * Until the data layer has answered the rates are the built-in ones and there is no FLUX price: the data
 * layer bakes none either ("a stale price is worse than none"), so the two never disagree.
 */
const UNLOADED: PricingContext = { ...BAKED_CONTEXT, fluxUsd: null };

/** The data layer's pricing snapshot as the forge's pricing context. */
export function pricingContextOf(data: PricingSnapshot | null): PricingContext {
  if (!data) return UNLOADED;
  return {
    params: data.params,
    fluxUsd: data.fluxUsd,
    source: data.paramsSource,
    fluxSource: data.fluxSource ?? data.paramsSource,
    asOf: data.bakedAt,
  };
}

export function usePricingContext(): PricingContext {
  const state = usePricing();
  return useMemo(() => pricingContextOf(state.data), [state.data]);
}

/** Which rates an editor prices with. `baked` is for lessons: the numbers the lesson text and its checks use. */
export type RatesMode = 'live' | 'baked';

/**
 * The context for a mode. `baked` keeps the built-in rates, so the price on screen is the price the lesson
 * validator computes (and the numbers in the lesson text), and still takes the FLUX price from the data
 * layer when it knows one, since there is no baked FLUX price.
 */
export function useRatesContext(mode: RatesMode): PricingContext {
  const live = usePricingContext();
  return useMemo(
    () =>
      mode === 'baked'
        ? {
            ...BAKED_CONTEXT,
            fluxUsd: live.fluxUsd,
            fluxSource: live.fluxUsd === null ? undefined : (live.fluxSource ?? live.source),
          }
        : live,
    [mode, live],
  );
}

// ---------------------------------------------------------------------------
// The session
// ---------------------------------------------------------------------------

export interface UseForgeSessionOptions {
  initial?: DeepPartial<FluxAppSpec> | FluxAppSpec | null;
  /** Which rates to price with. Default `live`. */
  pricing?: RatesMode;
  /** Changing this puts the editor back to `initial` (and clears history). */
  resetKey?: string | number;
  editable?: readonly string[];
  readOnly?: boolean;
  lintContext?: LintContext;
}

export function useForgeSession(opts: UseForgeSessionOptions): ForgeSession {
  const pricing = useRatesContext(opts.pricing ?? 'live');
  const [session] = useState(() =>
    createSession(opts.initial, {
      editable: opts.editable,
      readOnly: opts.readOnly,
      pricing,
      lintContext: opts.lintContext ?? DEFAULT_LINT_CONTEXT,
    }),
  );

  // Rates, rules and locks follow the props. These are cheap and idempotent.
  useLayoutEffect(() => {
    session.setPricing(pricing);
  }, [session, pricing]);
  useLayoutEffect(() => {
    session.setOptions({ editable: opts.editable, readOnly: opts.readOnly });
  }, [session, opts.editable, opts.readOnly]);
  useLayoutEffect(() => {
    session.setLintContext(opts.lintContext ?? DEFAULT_LINT_CONTEXT);
  }, [session, opts.lintContext]);

  // A new reset key starts over from `initial`. The first value is the mount, which is not a reset.
  const lastKey = useRef(opts.resetKey);
  useLayoutEffect(() => {
    if (Object.is(lastKey.current, opts.resetKey)) return;
    lastKey.current = opts.resetKey;
    session.reset(specFromPartial(opts.initial));
  }, [session, opts.resetKey, opts.initial]);

  return session;
}

export function useSnapshot(session: ForgeSession): ForgeSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}

// ---------------------------------------------------------------------------
// Asking Flux's own calculator
// ---------------------------------------------------------------------------

export type VerifyStatus = 'idle' | 'pending' | 'official' | 'unconfirmed' | 'unavailable';

export interface VerifyState {
  status: VerifyStatus;
  /** What was verified: the compact JSON of the spec. The result is stale when the spec no longer matches. */
  forKey: string | null;
  /** The server's quote for that spec (its `basis` is `official` when confirmed). */
  quote: Quote | null;
  officialUsd?: number;
  /** The official total differed from the computed one by more than a cent. */
  drift?: boolean;
  /** A sentence for the learner. */
  message: string;
  /** The server said it cannot be asked right now; do not keep asking automatically. */
  backoff?: boolean;
}

const IDLE: VerifyState = { status: 'idle', forKey: null, quote: null, message: '' };

const REASONS: Record<string, string> = {
  enterprise:
    'The official calculator cannot price an encrypted enterprise spec here, so this price stays computed from the official rates.',
  empty: 'A spec with no components has nothing to price.',
  rate_limited:
    'Too many confirmations just now. This price stays computed from the official rates; try again in a minute.',
  upstream_unavailable:
    "Flux's calculator did not answer. This price stays computed from the official rates.",
  marketplace_name:
    'A name that starts like a marketplace app carries a multiplier the calculator cannot confirm here, so this stays computed.',
};

function keyOf(spec: FluxAppSpec): string {
  try {
    return JSON.stringify(spec);
  } catch {
    return '';
  }
}

export function useVerify(spec: FluxAppSpec): {
  state: VerifyState;
  /** The result belongs to the spec on screen right now. */
  current: boolean;
  run: () => void;
} {
  const [state, setState] = useState<VerifyState>(IDLE);
  const controller = useRef<AbortController | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const run = useCallback(() => {
    const target = specRef.current;
    const forKey = keyOf(target);
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setState({ status: 'pending', forKey, quote: null, message: 'Asking the Flux calculator.' });
    void postQuote({ spec: target, verify: true }, { signal: ac.signal }).then((res) => {
      if (ac.signal.aborted) return;
      if (!res.ok) {
        const message =
          res.error.kind === 'aborted'
            ? ''
            : /demo/i.test(res.error.message)
              ? 'Demo mode: the API is off, so there is nothing to confirm against. The price stays computed.'
              : `Could not reach the Academy server (${res.error.message}). The price stays computed.`;
        setState({ status: 'unavailable', forKey, quote: null, message, backoff: true });
        return;
      }
      const { quote, verification } = res.envelope.data;
      if (verification?.confirmed) {
        setState({
          status: 'official',
          forKey,
          quote,
          officialUsd: verification.officialUsd,
          drift: verification.drift,
          message: verification.drift
            ? "Flux's calculator gave a slightly different total, so its figure is shown."
            : "Flux's calculator agrees with this price.",
        });
      } else {
        const reason = verification?.reason ?? 'upstream_unavailable';
        setState({
          status: 'unconfirmed',
          forKey,
          quote,
          message: REASONS[reason] ?? REASONS.upstream_unavailable ?? '',
          backoff: reason === 'rate_limited' || reason === 'upstream_unavailable',
        });
      }
    });
  }, []);

  const current = state.forKey !== null && state.forKey === keyOf(spec);
  return { state, current, run };
}
