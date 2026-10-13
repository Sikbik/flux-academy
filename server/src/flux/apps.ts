// Adapted from fluxcommunity/server/src/flux/apps.ts
import { type UpstreamClient, UpstreamError } from '../core/upstream.ts';

/**
 * Apps registered and running. There is no cheap network-wide counter upstream, so this is computed:
 *
 *   registered = distinct `name` in GET /apps/globalappsspecifications (~1.5 MB brotli, ~2.9 MB raw)
 *   running    = distinct `name` in GET /apps/locations                (~350 KB brotli, ~2.5 MB raw)
 *
 * Costs (measured 2026-10-12, 2,074 apps, 8,764 instance rows) are why the defaults are slow: running is
 * refreshed every 10 min (~50 MB/day per server instance) and registered every 30 min with a conditional
 * request (up to ~72 MB/day per instance, much less when the ETag matches). Counts move slowly; neither
 * number is shown as a ticker.
 */

type Rows = { status?: unknown; data?: unknown };

function names(body: unknown, what: string): Set<string> {
  const b = body as Rows | null;
  if (b?.status !== 'success' || !Array.isArray(b.data)) {
    throw new UpstreamError('invalid', `${what} did not return a success envelope with rows`);
  }
  const out = new Set<string>();
  for (const row of b.data) {
    const n = (row as { name?: unknown } | null)?.name;
    if (typeof n === 'string' && n.length > 0) out.add(n);
  }
  return out;
}

export class AppsApi {
  readonly #client: UpstreamClient;
  readonly #base: string;

  constructor(client: UpstreamClient, base: string) {
    this.#client = client;
    this.#base = base;
  }

  /** Registered app names. Conditional, so an unchanged catalog costs a few hundred bytes. */
  async registered(): Promise<Set<string>> {
    // ttlMs 1 makes the entry a cache cell whose revalidation is conditional on the ETag; the SwrCell in
    // NetworkService owns the real schedule.
    const res = await this.#client.get<Set<string>>(`${this.#base}/apps/globalappsspecifications`, {
      key: 'apps:registered',
      ttlMs: 1,
      conditional: true,
      timeoutMs: 30_000,
      retries: 0,
      validate: (body) => {
        const set = names(body, 'globalappsspecifications');
        // A near-empty catalog means a broken answer, not a network with no apps.
        if (set.size < 50) throw new UpstreamError('invalid', `only ${set.size} app specs returned`);
        return set;
      },
    });
    return res.value;
  }

  /** Names with at least one announced running instance. */
  async running(): Promise<Set<string>> {
    const res = await this.#client.get<Set<string>>(`${this.#base}/apps/locations`, {
      timeoutMs: 30_000,
      retries: 0,
      validate: (body) => {
        const set = names(body, 'apps/locations');
        if (set.size < 50) throw new UpstreamError('invalid', `only ${set.size} running apps returned`);
        return set;
      },
    });
    return res.value;
  }
}
