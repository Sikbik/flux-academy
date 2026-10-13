/**
 * The App Explorer's data: a cached index of registered app names, and a read-only lookup of one app
 * (its public spec and where its instances run) from the official Flux API.
 *
 * Safety properties, each covered by tests:
 * - The app name is validated against Flux's own name rule BEFORE any upstream call, and is only ever
 *   placed in the URL path of two fixed endpoints on the configured API origin.
 * - Everything returned is rebuilt field by field from the upstream rows with caps; nothing is passed
 *   through. Node ports are removed (the row's `ip:port` is cut to the bare address).
 * - Enterprise apps return counts only: the encrypted blob and contacts never leave this module.
 * - Memory is bounded: one names array, one running-count map, one fleet map and a 128 entry app cache.
 */
import type {
  ExploreApp,
  ExploreComponent,
  ExploreInstance,
  ExploreSearch,
  Tier,
} from '../../../shared/api.ts';
import { effectiveExpiryHeight } from '../../../shared/flux/blocks.ts';
import { MARKETPLACE_MULTIPLIERS } from '../../../shared/flux/pricing.ts';
import { LIMITS } from '../../../shared/flux/spec.ts';
import type { Clock } from '../core/clock.ts';
import { HttpError } from '../core/context.ts';
import { errText, type Logger } from '../core/log.ts';
import type { UpstreamClient } from '../core/upstream.ts';
import { FLEET_PROJECTION } from '../flux/stats.ts';

/** Is `name` something the network could have registered? Letters, digits, inner hyphens, at most 63. */
export function isValidAppName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length >= 1 &&
    name.length <= LIMITS.name.maxLength &&
    LIMITS.name.pattern.test(name)
  );
}

export const SEARCH_MAX_RESULTS = 25;
const NAMES_TTL_MS = 30 * 60_000;
const RUNNING_TTL_MS = 15 * 60_000;
const FLEET_TTL_MS = 10 * 60_000;
const APP_TTL_MS = 60_000;
const APP_CACHE_MAX = 128;
/** The generous ceilings protect memory if upstream ever misbehaves. */
const NAMES_MAX_BYTES = 12 * 1024 * 1024;
const ROWS_MAX_BYTES = 12 * 1024 * 1024;

export interface ExploreDeps {
  upstream: Pick<UpstreamClient, 'get'>;
  /** Base of the Flux API, no trailing slash. */
  apiBase: string;
  /** Base of stats.runonflux.io. */
  statsBase: string;
  clock: Clock;
  log: Logger;
  /** Latest block height, for the remaining subscription. */
  tipHeight: () => number | null;
  /** FIXTURES=1: no upstream; search serves a tiny baked list and lookups answer 503. */
  fixtures: boolean;
}

interface FleetEntry {
  tier: Tier | null;
  cc: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const IPV4 = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?$/;
/** The bare IPv4 address of an `ip` or `ip:port` row value, or null. Node ports are never kept. */
export function bareIp(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = IPV4.exec(v.trim());
  if (!m) return null;
  const ip = m[1] as string;
  return ip.split('.').every((o) => Number(o) <= 255) ? ip : null;
}

const TIERS: Record<string, Tier> = { CUMULUS: 'cumulus', NIMBUS: 'nimbus', STRATUS: 'stratus' };

const BAKED_NAMES: readonly string[] = [
  'HelloWorldParams',
  ...MARKETPLACE_MULTIPLIERS.map((m) => m.name),
  'Minecraft2GB',
  'Minecraft4GB',
  'Valheim',
  'Terraria',
  'Teamspeak',
];

export class ExploreService {
  readonly #d: ExploreDeps;
  #names: { list: string[]; at: number } | null = null;
  #running: { counts: Map<string, number>; at: number } | null = null;
  #fleet: { byIp: Map<string, FleetEntry>; at: number } | null = null;
  readonly #apps = new Map<string, { value: ExploreApp; at: number }>();
  readonly #flight = new Map<string, Promise<unknown>>();

  constructor(deps: ExploreDeps) {
    this.#d = deps;
  }

  // ---- names index ---------------------------------------------------------------------------------

  /** Refresh the name index (a conditional request: an unchanged catalog costs a few hundred bytes). */
  async refreshNames(): Promise<boolean> {
    if (this.#d.fixtures) return false;
    const res = await this.#d.upstream.get<string[]>(`${this.#d.apiBase}/apps/globalappsspecifications`, {
      key: 'explore:names',
      ttlMs: 1,
      conditional: true,
      timeoutMs: 30_000,
      retries: 0,
      maxBytes: NAMES_MAX_BYTES,
      validate: (raw) => {
        const body = raw as { status?: unknown; data?: unknown } | null;
        if (body?.status !== 'success' || !Array.isArray(body.data))
          throw new Error('not a success envelope');
        const seen = new Set<string>();
        for (const row of body.data) {
          const n = isObj(row) ? row.name : null;
          if (isValidAppName(n)) seen.add(n);
          if (seen.size >= 20_000) break;
        }
        if (seen.size < 50) throw new Error(`only ${seen.size} app names`);
        return [...seen].sort((a, b) => a.localeCompare(b));
      },
    });
    this.#names = { list: res.value, at: this.#d.clock.now() };
    return true;
  }

  /** The names already known, without touching the network. Used by lint to flag a taken name. */
  knownNames(): ReadonlySet<string> | undefined {
    return this.#names ? new Set(this.#names.list) : undefined;
  }

  async #runningCounts(): Promise<Map<string, number> | null> {
    const now = this.#d.clock.now();
    if (this.#running && now - this.#running.at < RUNNING_TTL_MS) return this.#running.counts;
    if (this.#d.fixtures) return null;
    try {
      const counts = await this.#once('running', async () => {
        const res = await this.#d.upstream.get<Map<string, number>>(`${this.#d.apiBase}/apps/locations`, {
          timeoutMs: 20_000,
          retries: 0,
          maxBytes: ROWS_MAX_BYTES,
          validate: (raw) => {
            const body = raw as { status?: unknown; data?: unknown } | null;
            if (body?.status !== 'success' || !Array.isArray(body.data))
              throw new Error('not a success envelope');
            const m = new Map<string, number>();
            for (const row of body.data) {
              const n = isObj(row) ? row.name : null;
              if (isValidAppName(n)) m.set(n, (m.get(n) ?? 0) + 1);
            }
            if (m.size < 50) throw new Error(`only ${m.size} running apps`);
            return m;
          },
        });
        return res.value;
      });
      this.#running = { counts, at: this.#d.clock.now() };
      return counts;
    } catch (err) {
      this.#d.log.debug('running counts unavailable', { err: errText(err) });
      return this.#running?.counts ?? null;
    }
  }

  async search(
    q: string,
  ): Promise<{ data: ExploreSearch; asOfMs: number; source: 'live' | 'cache' | 'fallback' }> {
    const query = q.trim();
    let source: 'live' | 'cache' | 'fallback' = 'live';
    let list: string[];
    let asOfMs: number;
    const now = this.#d.clock.now();
    if (!this.#names && !this.#d.fixtures) {
      try {
        await this.#once('names', () => this.refreshNames());
      } catch (err) {
        this.#d.log.warn('names index unavailable', { err: errText(err) });
      }
    }
    if (this.#names) {
      list = this.#names.list;
      asOfMs = this.#names.at;
      source = now - asOfMs <= 2 * NAMES_TTL_MS ? 'live' : 'cache';
    } else {
      list = [...BAKED_NAMES];
      asOfMs = 0;
      source = 'fallback';
    }
    const lower = query.toLowerCase();
    const prefix: string[] = [];
    const inner: string[] = [];
    for (const n of list) {
      const ln = n.toLowerCase();
      if (lower === '' || ln.startsWith(lower)) prefix.push(n);
      else if (ln.includes(lower)) inner.push(n);
    }
    const counts = source === 'fallback' ? null : await this.#runningCounts();
    const rank = (n: string) => counts?.get(n) ?? 0;
    const order = (a: string, b: string) => rank(b) - rank(a) || a.localeCompare(b);
    prefix.sort(order);
    inner.sort(order);
    const names = [...prefix, ...inner].slice(0, SEARCH_MAX_RESULTS).map((name) => ({
      name,
      instances: counts ? (counts.get(name) ?? 0) : null,
    }));
    return { data: { query, names }, asOfMs, source };
  }

  // ---- one app -------------------------------------------------------------------------------------

  async #fleetByIp(): Promise<Map<string, FleetEntry>> {
    const now = this.#d.clock.now();
    if (this.#fleet && now - this.#fleet.at < FLEET_TTL_MS) return this.#fleet.byIp;
    if (this.#d.fixtures) return new Map();
    try {
      const byIp = await this.#once('fleet', async () => {
        const url = new URL(`${this.#d.statsBase}/fluxinfo`);
        url.searchParams.set('projection', FLEET_PROJECTION);
        const res = await this.#d.upstream.get<Map<string, FleetEntry>>(url, {
          timeoutMs: 30_000,
          retries: 0,
          maxBytes: ROWS_MAX_BYTES,
          validate: (raw) => {
            const body = raw as { status?: unknown; data?: unknown } | null;
            if (body?.status !== 'success' || !Array.isArray(body.data))
              throw new Error('not a success envelope');
            const m = new Map<string, FleetEntry>();
            for (const row of body.data) {
              if (!isObj(row)) continue;
              const ip = bareIp(row.ip);
              if (!ip) continue;
              const geo = isObj(row.geolocation) ? row.geolocation : {};
              const lat = num(geo.lat);
              const lon = num(geo.lon);
              const placed = lat !== null && lon !== null && !(lat === 0 && lon === 0);
              m.set(ip, {
                tier: TIERS[str(row.tier, 12).toUpperCase()] ?? null,
                cc: /^[A-Z]{2}$/.test(str(geo.countryCode, 2)) ? str(geo.countryCode, 2) : null,
                country: str(geo.country, 60) || null,
                lat: placed ? Math.round((lat as number) * 100) / 100 : null,
                lon: placed ? Math.round((lon as number) * 100) / 100 : null,
              });
            }
            if (m.size < 100) throw new Error(`only ${m.size} nodes`);
            return m;
          },
        });
        return res.value;
      });
      this.#fleet = { byIp, at: this.#d.clock.now() };
      return byIp;
    } catch (err) {
      this.#d.log.debug('fleet locations unavailable', { err: errText(err) });
      return this.#fleet?.byIp ?? new Map();
    }
  }

  /** Run `fn` once for concurrent callers with the same key. */
  async #once<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const have = this.#flight.get(key) as Promise<T> | undefined;
    if (have) return have;
    const p = fn().finally(() => this.#flight.delete(key));
    this.#flight.set(key, p);
    return p;
  }

  /**
   * Look an app up. Throws HttpError 400 for a bad name, 404 for an unknown app and 503 when the Flux API
   * cannot be reached.
   */
  async app(name: string): Promise<{ data: ExploreApp; asOfMs: number }> {
    if (!isValidAppName(name)) {
      throw new HttpError(400, 'bad_name', 'App names use letters, digits and hyphens, up to 63 characters.');
    }
    const now = this.#d.clock.now();
    const hit = this.#apps.get(name);
    if (hit && now - hit.at < APP_TTL_MS) return { data: hit.value, asOfMs: hit.at };
    if (this.#d.fixtures) {
      throw new HttpError(
        503,
        'upstream_unavailable',
        'The Flux API is not reachable from this server mode.',
      );
    }
    const value = await this.#once(`app:${name}`, () => this.#fetchApp(name));
    const at = this.#d.clock.now();
    this.#apps.delete(name);
    this.#apps.set(name, { value, at });
    while (this.#apps.size > APP_CACHE_MAX) {
      const oldest = this.#apps.keys().next().value;
      if (oldest === undefined) break;
      this.#apps.delete(oldest);
    }
    return { data: value, asOfMs: at };
  }

  async #fetchApp(name: string): Promise<ExploreApp> {
    const base = this.#d.apiBase;
    const specUrl = `${base}/apps/appspecifications/${name}`;
    const locUrl = `${base}/apps/location/${name}`;
    let specBody: unknown;
    let locBody: unknown;
    try {
      const [s, l] = await Promise.all([
        this.#d.upstream.get<unknown>(specUrl, { retries: 0, timeoutMs: 8_000, maxBytes: 512 * 1024 }),
        this.#d.upstream.get<unknown>(locUrl, { retries: 0, timeoutMs: 8_000, maxBytes: 512 * 1024 }),
      ]);
      specBody = s.value;
      locBody = l.value;
    } catch (err) {
      // The API answers HTTP 200 with status "error" for an unknown app, so a throw here is a real outage.
      this.#d.log.warn('explore lookup failed', { err: errText(err) });
      throw new HttpError(503, 'upstream_unavailable', 'The Flux API did not answer. Try again in a moment.');
    }
    const sb = isObj(specBody) ? specBody : {};
    if (sb.status !== 'success' || !isObj(sb.data)) {
      throw new HttpError(404, 'app_not_found', 'No registered app has that name.');
    }
    const spec = sb.data;
    const enterprise = typeof spec.enterprise === 'string' && spec.enterprise.length > 0;

    const components: ExploreComponent[] = [];
    if (!enterprise && Array.isArray(spec.compose)) {
      for (const c of spec.compose.slice(0, LIMITS.component.max)) {
        if (!isObj(c)) continue;
        components.push({
          name: str(c.name, LIMITS.component.nameMaxLength),
          repotag: str(c.repotag, LIMITS.repotag.maxLength),
          cpu: num(c.cpu) ?? 0,
          ram: num(c.ram) ?? 0,
          hdd: num(c.hdd) ?? 0,
          ports: (Array.isArray(c.ports) ? c.ports : [])
            .filter((p): p is number => typeof p === 'number' && Number.isInteger(p) && p >= 0 && p <= 65535)
            .slice(0, LIMITS.ports.perComponentMax),
        });
      }
    }

    const fleet = await this.#fleetByIp();
    const rows =
      isObj(locBody) && locBody.status === 'success' && Array.isArray(locBody.data) ? locBody.data : [];
    const seen = new Set<string>();
    const instances: ExploreInstance[] = [];
    for (const row of rows.slice(0, 500)) {
      if (!isObj(row)) continue;
      const ip = bareIp(row.ip);
      if (!ip || seen.has(ip)) continue;
      seen.add(ip);
      const f = fleet.get(ip);
      const when = typeof row.broadcastedAt === 'string' ? Date.parse(row.broadcastedAt) : Number.NaN;
      instances.push({
        ip,
        tier: f?.tier ?? null,
        cc: f?.cc ?? null,
        country: f?.country ?? null,
        lat: f?.lat ?? null,
        lon: f?.lon ?? null,
        broadcastedAt: Number.isFinite(when) ? new Date(when).toISOString() : null,
      });
      if (instances.length >= LIMITS.instances.max) break;
    }

    const height = num(spec.height);
    const expire = num(spec.expire);
    const tip = this.#d.tipHeight();
    let blocksRemaining: number | null = null;
    if (height !== null && expire !== null && tip !== null) {
      blocksRemaining = Math.max(0, effectiveExpiryHeight(height, expire) - tip);
    }
    return {
      name: str(spec.name, LIMITS.name.maxLength) || name,
      description: str(spec.description, LIMITS.descriptionMaxLength),
      version: num(spec.version) ?? 0,
      instancesWanted: Math.max(0, Math.trunc(num(spec.instances) ?? 0)),
      instancesRunning: instances.length,
      height,
      blocksRemaining,
      components,
      instances,
      enterprise,
      docs: { specUrl, locationUrl: locUrl },
    };
  }
}
