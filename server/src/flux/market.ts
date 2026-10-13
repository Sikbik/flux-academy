// Adapted from fluxcommunity/server/src/flux/market.ts (the price source differs: see below)
import type { MarketStats } from '../../../shared/api.ts';
import { type UpstreamClient, UpstreamError } from '../core/upstream.ts';

/** How long a CoinGecko answer (24 h change and market cap) is reused. The price itself is not cached. */
const ENRICH_TTL_MS = 5 * 60_000;

interface Enrichment {
  priceUsd: number | null;
  change24hPct: number | null;
  marketCapUsd: number | null;
}

/**
 * FLUX in USD.
 *
 * The price is the one FluxOS itself uses to turn a USD quote into FLUX: `viprates.runonflux.io/rates`
 * returns `[ [ {code, name, rate} ... fiat per BTC ], { <ticker>: <BTC price> }, { errors } ]`, so
 * USD per FLUX is `USD.rate * FLUX` (FACTS.md section 10.8, VERIFIED-SOURCE and VERIFIED-LIVE). It has
 * about three significant digits and no 24 h change or market cap, so those two fields come from
 * CoinGecko (coin id `zelcash`, no key, rate limited) on a slow cache and are null when it is down.
 * CoinGecko's price is also the fallback when viprates is unreachable.
 */
export class MarketApi {
  readonly #client: UpstreamClient;
  readonly #rates: string;
  readonly #gecko: string;

  constructor(client: UpstreamClient, ratesBase: string, geckoBase: string) {
    this.#client = client;
    this.#rates = ratesBase;
    this.#gecko = geckoBase;
  }

  async #viprates(): Promise<number> {
    const res = await this.#client.get<unknown>(`${this.#rates}/rates`, { retries: 0 });
    const price = usdPerFlux(res.value);
    if (price === null) throw new UpstreamError('invalid', 'rates service returned no usable FLUX price');
    return price;
  }

  async #enrichment(): Promise<Enrichment> {
    const url = new URL(`${this.#gecko}/api/v3/simple/price`);
    url.searchParams.set('ids', 'zelcash');
    url.searchParams.set('vs_currencies', 'usd');
    url.searchParams.set('include_24hr_change', 'true');
    url.searchParams.set('include_market_cap', 'true');
    const res = await this.#client.get<Enrichment>(url, {
      key: 'market:coingecko',
      ttlMs: ENRICH_TTL_MS,
      // A 429 must not become a hot loop: serve the last answer for up to an hour while it recovers.
      staleMs: 60 * 60_000,
      retries: 0,
      validate: (raw) => {
        const z = (raw as { zelcash?: Record<string, unknown> } | null)?.zelcash;
        const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
        const price = num(z?.usd);
        const cap = num(z?.usd_market_cap);
        const change = num(z?.usd_24h_change);
        if (price === null || price <= 0) throw new Error('no zelcash price');
        return {
          priceUsd: price,
          change24hPct: change === null ? null : Math.round(change * 100) / 100,
          marketCapUsd: cap !== null && cap > 0 ? Math.round(cap) : null,
        };
      },
    });
    return res.value;
  }

  async flux(): Promise<MarketStats> {
    const [rates, gecko] = await Promise.allSettled([this.#viprates(), this.#enrichment()]);
    const extra = gecko.status === 'fulfilled' ? gecko.value : null;
    const priceUsd = rates.status === 'fulfilled' ? rates.value : (extra?.priceUsd ?? null);
    if (priceUsd === null) {
      throw rates.status === 'rejected'
        ? rates.reason
        : new UpstreamError('invalid', 'no FLUX price from any source');
    }
    return {
      priceUsd,
      change24hPct: extra?.change24hPct ?? null,
      marketCapUsd: extra?.marketCapUsd ?? null,
    };
  }
}

/** USD per FLUX from the rates document, or null when it is not in the expected shape. */
export function usdPerFlux(doc: unknown): number | null {
  if (!Array.isArray(doc) || !Array.isArray(doc[0])) return null;
  const usd = (doc[0] as { code?: unknown; rate?: unknown }[]).find((r) => r?.code === 'USD');
  if (typeof usd?.rate !== 'number' || !Number.isFinite(usd.rate) || usd.rate <= 0) return null;
  for (const part of doc.slice(1)) {
    const flux = (part as Record<string, unknown> | null)?.FLUX;
    // Six decimals: the source has three significant digits, the rest is float noise.
    if (typeof flux === 'number' && Number.isFinite(flux) && flux > 0) {
      return Math.round(usd.rate * flux * 1e6) / 1e6;
    }
  }
  return null;
}
