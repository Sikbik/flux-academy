/**
 * Pricing for the API: the official parameter table (cached with stale-while-revalidate, baked fallback),
 * the FLUX price from the market reader, and quotes computed with the shared engine, optionally confirmed
 * against the official calculator.
 *
 * Honesty rules, each covered by tests:
 * - `paramsSource` and `fluxSource` say where each number came from; a baked number is never labelled live.
 * - A confirmed quote that disagrees with the official one by more than a cent returns the OFFICIAL
 *   numbers, with `basis: 'official'`, and logs a warning so drift is visible.
 * - Verification never blocks a quote: any failure returns the computed quote and says why.
 */
import type { DataSource, PricingSnapshot, QuoteResponse } from '../../../shared/api.ts';
import { BLOCKS_PER_MONTH } from '../../../shared/flux/blocks.ts';
import { lintSpec } from '../../../shared/flux/lint.ts';
import { BAKED_PRICING, marketplaceMultiplier, quote } from '../../../shared/flux/pricing.ts';
import { normalizeSpec, specSignature } from '../../../shared/flux/spec.ts';
import type { FluxAppSpec, PricingParams, Quote, QuoteLineItem } from '../../../shared/flux/types.ts';
import type { Clock } from '../core/clock.ts';
import type { MarketReader, Served } from '../core/context.ts';
import { errText, type Logger } from '../core/log.ts';
import type { UpstreamClient } from '../core/upstream.ts';

const PARAMS_TTL_MS = 10 * 60_000;
const PARAMS_STALE_MS = 6 * 60 * 60_000;
const OFFICIAL_TTL_MS = 10 * 60_000;
const OFFICIAL_TIMEOUT_MS = 4_000;
/** The window after which the pricing snapshot is reported stale. */
export const PRICING_WINDOW_MS = PARAMS_TTL_MS;

export interface PricingDeps {
  upstream: Pick<UpstreamClient, 'get' | 'post'>;
  apiBase: string;
  market: MarketReader;
  clock: Clock;
  log: Logger;
}

type ParamsSource = 'live' | 'cache' | 'baked';

interface ParamsResult {
  params: PricingParams;
  source: ParamsSource;
  asOfMs: number;
}

const numField = (o: Record<string, unknown>, k: string, fallback?: number): number => {
  const v = o[k];
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`pricing field ${k} missing`);
};

/** Turn the `getappspecsusdprice` envelope into PricingParams or throw. */
export function parseParams(raw: unknown): PricingParams {
  const body = raw as { status?: unknown; data?: unknown } | null;
  if (body?.status !== 'success' || typeof body.data !== 'object' || body.data === null) {
    throw new Error('not a success envelope');
  }
  const d = body.data as Record<string, unknown>;
  const p: PricingParams = {
    height: typeof d.height === 'number' ? d.height : -1,
    cpu: numField(d, 'cpu'),
    ram: numField(d, 'ram'),
    hdd: numField(d, 'hdd'),
    minPrice: numField(d, 'minPrice', 0.01),
    port: numField(d, 'port'),
    scope: numField(d, 'scope'),
    staticip: numField(d, 'staticip'),
    fluxmultiplier: numField(d, 'fluxmultiplier'),
    multiplier: numField(d, 'multiplier'),
    minUSDPrice: numField(d, 'minUSDPrice'),
  };
  if (p.cpu <= 0 || p.ram <= 0 || p.hdd <= 0) throw new Error('resource rates must be positive');
  if (p.fluxmultiplier <= 0 || p.fluxmultiplier > 2) throw new Error('fluxmultiplier out of range');
  if (p.multiplier <= 0 || p.multiplier > 20) throw new Error('multiplier out of range');
  return p;
}

/**
 * One `meta.source` for a response built from the table and the FLUX price: `fallback` when the table is
 * baked, `cache` when either part is not current, `live` otherwise. The per-part labels carry the detail.
 */
function combineSource(params: ParamsSource, flux: ParamsSource): DataSource {
  if (params === 'baked') return 'fallback';
  return params === 'live' && flux === 'live' ? 'live' : 'cache';
}

export class PricingService {
  readonly #d: PricingDeps;
  #last: { params: PricingParams; at: number } | null = null;

  constructor(deps: PricingDeps) {
    this.#d = deps;
  }

  /** The official table: live, then the last good one, then the baked snapshot. Never throws. */
  async params(): Promise<ParamsResult> {
    try {
      const res = await this.#d.upstream.get<PricingParams>(`${this.#d.apiBase}/apps/getappspecsusdprice`, {
        key: 'pricing:params',
        ttlMs: PARAMS_TTL_MS,
        staleMs: PARAMS_STALE_MS,
        timeoutMs: 6_000,
        retries: 1,
        maxBytes: 64 * 1024,
        validate: parseParams,
      });
      this.#last = { params: res.value, at: res.fetchedAt };
      return { params: res.value, source: res.source, asOfMs: res.fetchedAt };
    } catch (err) {
      this.#d.log.debug('pricing params unavailable', { err: errText(err) });
      if (this.#last) return { params: this.#last.params, source: 'cache', asOfMs: this.#last.at };
      return { params: BAKED_PRICING.params, source: 'baked', asOfMs: Date.parse(BAKED_PRICING.capturedAt) };
    }
  }

  /** FLUX price, labelled. Falls back to the baked snapshot when the market reader has nothing. */
  fluxUsd(): { value: number; source: 'live' | 'cache' | 'baked'; asOfMs: number } {
    const m = this.#d.market.fluxUsd();
    if (m.value !== null && m.value > 0 && m.asOfMs !== null && m.source !== 'fallback') {
      return { value: m.value, source: m.source === 'live' ? 'live' : 'cache', asOfMs: m.asOfMs };
    }
    return { value: BAKED_PRICING.fluxUsd, source: 'baked', asOfMs: Date.parse(BAKED_PRICING.capturedAt) };
  }

  async snapshot(): Promise<Served<PricingSnapshot>> {
    const [p, f] = [await this.params(), this.fluxUsd()];
    const baked = p.source === 'baked' || f.source === 'baked';
    const data: PricingSnapshot = {
      params: p.params,
      fluxUsd: f.value,
      paramsSource: p.source,
      fluxSource: f.source,
    };
    if (baked) data.bakedAt = BAKED_PRICING.capturedAt;
    return {
      data,
      asOfMs: Math.min(p.asOfMs, f.asOfMs),
      source: combineSource(p.source, f.source),
      windowMs: PRICING_WINDOW_MS,
    };
  }

  /**
   * Normalise, lint and price a spec. With `verify`, also ask the official calculator (once per distinct
   * spec for ten minutes). `canVerify` lets the route say the caller's rate budget is spent.
   */
  async quote(input: {
    spec: unknown;
    months?: number;
    verify?: boolean;
    canVerify?: boolean;
    takenNames?: ReadonlySet<string>;
  }): Promise<Served<QuoteResponse>> {
    let spec = input.spec;
    if (typeof spec === 'string') {
      try {
        spec = JSON.parse(spec);
      } catch {
        /* normalizeSpec reports it */
      }
    }
    if (input.months !== undefined && typeof spec === 'object' && spec !== null && !Array.isArray(spec)) {
      spec = { ...(spec as Record<string, unknown>), expire: Math.round(input.months * BLOCKS_PER_MONTH) };
    }
    const normalized = normalizeSpec(spec).spec;
    const lint = lintSpec(spec, input.takenNames ? { takenNames: input.takenNames } : {});

    const [p, f] = [await this.params(), this.fluxUsd()];
    let q: Quote = quote(normalized, p.params, {
      fluxUsd: f.value,
      paramsSource: p.source,
    });
    let verification: QuoteResponse['verification'];

    if (input.verify) {
      verification = { requested: true, confirmed: false };
      if (normalized.enterprise) {
        verification.reason = 'enterprise';
      } else if (normalized.compose.length === 0) {
        verification.reason = 'empty';
      } else if (input.canVerify === false) {
        verification.reason = 'rate_limited';
      } else {
        const probe = this.#probeSpec(normalized);
        const probeQuote = quote(probe, p.params, { fluxUsd: f.value, paramsSource: p.source });
        const official = await this.#official(probe);
        if ('error' in official) {
          verification.reason = official.error;
        } else {
          verification.officialUsd = official.usd;
          const drift = Math.abs(official.usd - (probeQuote.usdTotal ?? 0)) > 0.005;
          verification.drift = drift;
          verification.confirmed = true;
          const mult = marketplaceMultiplier(normalized.name);
          if (!drift) {
            q = { ...q, basis: 'official' };
          } else if (mult === 1) {
            this.#d.log.warn('pricing drift: official and computed quotes differ', {
              signature: specSignature(normalized),
              officialUsd: official.usd,
              computedUsd: probeQuote.usdTotal,
              officialFlux: official.flux,
              instances: normalized.instances,
              components: normalized.compose.length,
              paramsSource: p.source,
            });
            q = this.#withOfficial(q, official.usd, official.flux);
          } else {
            // The probe name carries no marketplace multiplier, so the comparison does not transfer.
            verification.confirmed = false;
            verification.reason = 'marketplace_name';
          }
        }
      }
    }

    const data: QuoteResponse = verification ? { quote: q, lint, verification } : { quote: q, lint };
    return {
      data,
      asOfMs: Math.min(p.asOfMs, f.asOfMs),
      source: combineSource(p.source, f.source),
      windowMs: PRICING_WINDOW_MS,
    };
  }

  /**
   * The spec to send to the official calculator: the same resources under a neutral name, because the
   * calculator prices an existing app's name as an UPDATE (crediting the old subscription), which is not
   * what a learner asking "what does this cost" means.
   */
  #probeSpec(spec: FluxAppSpec): FluxAppSpec {
    return { ...spec, name: `acadquote${specSignature({ ...spec, name: '' })}` };
  }

  async #official(spec: FluxAppSpec): Promise<{ usd: number; flux: number } | { error: string }> {
    try {
      const res = await this.#d.upstream.post<{ usd: number; flux: number }>(
        `${this.#d.apiBase}/apps/calculatefiatandfluxprice`,
        JSON.stringify(spec),
        {
          key: `quote:${spec.name}`,
          ttlMs: OFFICIAL_TTL_MS,
          timeoutMs: OFFICIAL_TIMEOUT_MS,
          retries: 0,
          maxBytes: 16 * 1024,
          validate: (raw) => {
            const d = (raw as { data?: { usd?: unknown; flux?: unknown } } | null)?.data;
            if (typeof d?.usd !== 'number' || !Number.isFinite(d.usd) || d.usd <= 0)
              throw new Error('no usd');
            if (typeof d.flux !== 'number' || !Number.isFinite(d.flux)) throw new Error('no flux');
            return { usd: d.usd, flux: d.flux };
          },
        },
      );
      return res.value;
    } catch (err) {
      this.#d.log.debug('official calculator unavailable', { err: errText(err) });
      return { error: 'upstream_unavailable' };
    }
  }

  /** Replace the computed total with the official one, keeping the lines summing to it. */
  #withOfficial(q: Quote, usd: number, flux: number): Quote {
    const computed = q.usdTotal ?? 0;
    const lines: QuoteLineItem[] = q.lines.slice();
    const delta = Math.round((usd - computed) * 1e6) / 1e6;
    if (delta !== 0) {
      lines.push({
        id: 'official-adjustment',
        label: 'Official calculator difference',
        usd: delta,
        note: "The official calculator gave a different total than this page's formula, so its figure is shown.",
      });
    }
    const months = q.months > 0 ? q.months : 1;
    return {
      ...q,
      usdTotal: usd,
      usdPerMonth: Number((usd / months).toFixed(2)),
      fluxTotal: flux,
      fluxPerMonth: Number((flux / months).toFixed(2)),
      lines,
      basis: 'official',
    };
  }
}
