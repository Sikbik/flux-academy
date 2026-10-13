// Adapted from fluxcommunity/server/src/core/upstream.ts (transport, size cap, status), extended with a keyed
// stale-while-revalidate cache, conditional requests, retry with jitter and per-host breakers.
import { BreakerOpenError, CircuitBreaker } from './breaker.ts';
import { type Clock, jitter, sleep, systemClock } from './clock.ts';
import { errText, type Logger, silentLogger } from './log.ts';
import { KeyedSingleFlight } from './singleflight.ts';

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type UpstreamErrorKind =
  | 'http'
  | 'timeout'
  | 'network'
  | 'parse'
  | 'size'
  | 'envelope'
  | 'invalid'
  /**
   * A POST answered HTTP 200 with `status: "error"`: the upstream understood and refused the request body.
   * Not retried, and not counted against the host's breaker (the input was at fault, not the upstream).
   */
  | 'rejected'
  /** The URL is not on the allow-list (a bug in the caller, never user-reachable). */
  | 'blocked'
  /** FIXTURES=1: upstream calls are switched off. */
  | 'disabled';

export class UpstreamError extends Error {
  readonly kind: UpstreamErrorKind;
  readonly status?: number;
  constructor(kind: UpstreamErrorKind, message: string, extra: { status?: number } = {}) {
    super(message);
    this.name = 'UpstreamError';
    this.kind = kind;
    this.status = extra.status;
  }
}

export interface GetOptions<T = unknown> {
  /**
   * Cache key. Required for caching (with `ttlMs` > 0). Make it specific to the URL and anything that
   * changes the answer; the cache is bounded and evicts least recently used keys.
   */
  key?: string;
  /** Freshness window. Younger than this is returned without a request. 0 or absent: never cached. */
  ttlMs?: number;
  /**
   * Stale-while-revalidate window beyond `ttlMs`: an entry this old is returned at once (source `cache`)
   * while one background refresh runs. Older than ttl + stale, the call waits for upstream.
   */
  staleMs?: number;
  timeoutMs?: number;
  /** Extra attempts after a transport failure, 5xx or 429 (default 1). Backoff is jittered. */
  retries?: number;
  /**
   * Turn the parsed JSON into your type, or throw to reject the answer (nothing is cached, the previous
   * value stays). Without it the body is returned as `unknown` cast to T.
   */
  validate?: (raw: unknown) => T;
  /** Classify an otherwise successful parsed body as an upstream failure (envelope-level errors). */
  isFailure?: (raw: unknown) => boolean;
  /** Send If-None-Match when a stale entry has an ETag; a 304 renews the entry for the cost of headers. */
  conditional?: boolean;
  headers?: Record<string, string>;
  /** Response size cap in bytes (default 16 MiB). */
  maxBytes?: number;
}

/** Options of `post`: everything `get` takes except conditional requests. */
export type PostOptions<T = unknown> = Omit<GetOptions<T>, 'conditional'>;

/** What differs between a GET and a POST on the wire. */
interface Send {
  body: string;
  contentType: string;
}

export interface Fetched<T> {
  value: T;
  /** Epoch ms the value was fetched (or last revalidated by a 304). */
  fetchedAt: number;
  ageMs: number;
  /** `live`: within `ttlMs`. `cache`: older, served stale while a refresh runs. */
  source: 'live' | 'cache';
  /** `ageMs` exceeds `ttlMs`. */
  stale: boolean;
}

export interface UpstreamClientOptions {
  /** Allowed origins mapped to a short label used for status, logs and breakers. */
  hosts: Record<string, string>;
  userAgent: string;
  timeoutMs: number;
  maxBytes?: number;
  maxEntries?: number;
  fetch?: FetchLike;
  clock?: Clock;
  log?: Logger;
  rand?: () => number;
  /** First retry delay (doubles per attempt, jittered). */
  retryBaseMs?: number;
  /** When set, every call rejects with kind `disabled` (FIXTURES=1). The value is the error text. */
  disabled?: string;
  breaker?: { failureThreshold?: number; baseCooldownMs?: number; maxCooldownMs?: number };
}

export interface HostStatus {
  ok: boolean;
  lastOkAt: string | null;
  lastError: string | null;
}

interface Entry {
  value: unknown;
  at: number;
  etag: string | null;
  /** After a failed background refresh, do not retry before this. */
  retryAt: number;
}

interface HostState {
  label: string;
  breaker: CircuitBreaker;
  ok: boolean;
  lastOkAt: number | null;
  lastError: string | null;
}

const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;

/** True for failures worth another attempt: the network, timeouts, 5xx and 429. */
function retryable(err: unknown): boolean {
  if (!(err instanceof UpstreamError)) return false;
  if (err.kind === 'network' || err.kind === 'timeout') return true;
  return err.kind === 'http' && (err.status === 429 || (err.status ?? 0) >= 500);
}

/** 4xx other than 429 is the caller's problem, not the upstream's health. */
function blamesHost(err: unknown): boolean {
  if (err instanceof UpstreamError && err.kind === 'rejected') return false;
  if (err instanceof UpstreamError && err.kind === 'http') {
    return err.status === 429 || (err.status ?? 0) >= 500 || err.status === undefined;
  }
  return true;
}

/**
 * The only way server code talks to the outside world. GET JSON from allow-listed origins with a timeout,
 * a size cap, jittered retry and a circuit breaker per origin; optional keyed cache with single-flight,
 * stale-while-revalidate and conditional requests. Never follows redirects.
 */
export class UpstreamClient {
  readonly #o: UpstreamClientOptions;
  readonly #fetch: FetchLike;
  readonly #clock: Clock;
  readonly #log: Logger;
  readonly #rand: () => number;
  readonly #hosts = new Map<string, HostState>();
  readonly #cache = new Map<string, Entry>();
  readonly #flight = new KeyedSingleFlight<Entry>();
  readonly #maxEntries: number;

  constructor(opts: UpstreamClientOptions) {
    this.#o = opts;
    this.#fetch = opts.fetch ?? ((i, init) => fetch(i, init));
    this.#clock = opts.clock ?? systemClock;
    this.#log = (opts.log ?? silentLogger).child({ svc: 'upstream' });
    this.#rand = opts.rand ?? Math.random;
    this.#maxEntries = opts.maxEntries ?? 256;
    for (const [origin, label] of Object.entries(opts.hosts)) {
      this.#hosts.set(origin, {
        label,
        ok: false,
        lastOkAt: null,
        lastError: opts.disabled ?? null,
        breaker: new CircuitBreaker({
          name: label,
          clock: this.#clock,
          rand: this.#rand,
          ...opts.breaker,
          onChange: (state, info) => {
            this.#log[state === 'open' ? 'warn' : 'info']('circuit', { upstream: label, state, ...info });
          },
        }),
      });
    }
  }

  /** Per-upstream health, keyed by label, for `/api/v1/info`. */
  status(): Record<string, HostStatus> {
    const out: Record<string, HostStatus> = {};
    for (const h of this.#hosts.values()) {
      out[h.label] = {
        ok: h.ok,
        lastOkAt: h.lastOkAt === null ? null : new Date(h.lastOkAt).toISOString(),
        lastError: h.lastError,
      };
    }
    return out;
  }

  get cacheSize(): number {
    return this.#cache.size;
  }

  /** The breaker for an origin label, for tests and diagnostics. */
  breaker(label: string): CircuitBreaker | undefined {
    for (const h of this.#hosts.values()) if (h.label === label) return h.breaker;
    return undefined;
  }

  /** GET `url` as JSON. Rejects with UpstreamError or BreakerOpenError; resolves only on a usable answer. */
  async get<T = unknown>(url: string | URL, opts: GetOptions<T> = {}): Promise<Fetched<T>> {
    return this.#request<T>(url, opts, null);
  }

  /**
   * POST `body` (JSON text) to `url` and read the answer as JSON. Same allow-list, timeout, size cap, retry,
   * breaker and optional keyed cache as `get` (key the cache on everything that changes the answer).
   *
   * The body is sent as `text/plain`: the Flux API's gateway hangs until a 504 when it sees
   * `application/json` on the price calculator (FACTS 4.2, 11 row 12). HTTP 200 with `status: "error"` is
   * a failure of kind `rejected`. Use only for read-only endpoints: retries re-send the request.
   */
  async post<T = unknown>(url: string | URL, body: string, opts: PostOptions<T> = {}): Promise<Fetched<T>> {
    return this.#request<T>(url, opts, { body, contentType: 'text/plain;charset=UTF-8' });
  }

  async #request<T>(url: string | URL, opts: GetOptions<T>, send: Send | null): Promise<Fetched<T>> {
    if (this.#o.disabled !== undefined) throw new UpstreamError('disabled', this.#o.disabled);
    const u = typeof url === 'string' ? new URL(url) : url;
    const host = this.#hosts.get(u.origin);
    if (!host) throw new UpstreamError('blocked', `origin ${u.origin} is not an allowed upstream`);

    const ttl = opts.ttlMs ?? 0;
    if (ttl <= 0 || !opts.key) {
      const e = await this.#network(host, u, opts, null, send);
      return this.#view<T>(e, 0);
    }

    const key = opts.key;
    const now = this.#clock.now();
    const have = this.#cache.get(key);
    if (have) {
      const age = Math.max(0, now - have.at);
      if (age <= ttl) {
        this.#touch(key, have);
        return this.#view<T>(have, ttl);
      }
      if (age <= ttl + (opts.staleMs ?? 0)) {
        if (now >= have.retryAt) {
          void this.#refresh(key, host, u, opts, have, send).catch((err: unknown) => {
            have.retryAt = this.#clock.now() + Math.min(ttl, 5_000);
            this.#log.debug('background refresh failed', { upstream: host.label, err: errText(err) });
          });
        }
        this.#touch(key, have);
        return this.#view<T>(have, ttl);
      }
    }
    const fresh = await this.#refresh(key, host, u, opts, have ?? null, send);
    return this.#view<T>(fresh, ttl);
  }

  // ---- internals ---------------------------------------------------------

  #view<T>(e: Entry, ttl: number): Fetched<T> {
    const ageMs = Math.max(0, this.#clock.now() - e.at);
    const stale = ttl > 0 && ageMs > ttl;
    return { value: e.value as T, fetchedAt: e.at, ageMs, source: stale ? 'cache' : 'live', stale };
  }

  #touch(key: string, e: Entry): void {
    this.#cache.delete(key);
    this.#cache.set(key, e);
  }

  #refresh<T>(
    key: string,
    host: HostState,
    u: URL,
    opts: GetOptions<T>,
    prior: Entry | null,
    send: Send | null = null,
  ): Promise<Entry> {
    return this.#flight.run(key, async () => {
      const e = await this.#network(host, u, opts, prior, send);
      this.#cache.delete(key);
      this.#cache.set(key, e);
      while (this.#cache.size > this.#maxEntries) {
        const oldest = this.#cache.keys().next().value;
        if (oldest === undefined) break;
        this.#cache.delete(oldest);
      }
      return e;
    });
  }

  async #network<T>(
    host: HostState,
    u: URL,
    opts: GetOptions<T>,
    prior: Entry | null,
    send: Send | null = null,
  ): Promise<Entry> {
    if (!host.breaker.allow()) {
      const err = new BreakerOpenError(host.label, host.breaker.retryAfterMs);
      host.ok = false;
      host.lastError ??= errText(err);
      throw err;
    }
    const attempts = 1 + Math.max(0, opts.retries ?? 1);
    const base = this.#o.retryBaseMs ?? 150;
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        const e = await this.#once(host, u, opts, prior, send);
        host.ok = true;
        host.lastOkAt = this.#clock.now();
        host.lastError = null;
        host.breaker.success();
        return e;
      } catch (err) {
        lastErr = err;
        if (!retryable(err) || i === attempts - 1) break;
        await sleep(jitter(base * 2 ** i, 0.3, this.#rand));
      }
    }
    host.lastError = errText(lastErr);
    if (blamesHost(lastErr)) {
      host.ok = false;
      host.breaker.failure();
    } else {
      // A 4xx proves the host is up; release a half-open trial without counting a failure.
      host.breaker.success();
    }
    throw lastErr;
  }

  async #once<T>(
    host: HostState,
    u: URL,
    opts: GetOptions<T>,
    prior: Entry | null,
    send: Send | null = null,
  ): Promise<Entry> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'accept-encoding': 'br, gzip',
      'user-agent': this.#o.userAgent,
      ...opts.headers,
    };
    if (send) headers['content-type'] = send.contentType;
    if (opts.conditional && prior?.etag) headers['if-none-match'] = prior.etag;
    const label = host.label;
    let res: Response;
    try {
      res = await this.#fetch(u, {
        method: send ? 'POST' : 'GET',
        headers,
        body: send ? send.body : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(opts.timeoutMs ?? this.#o.timeoutMs),
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new UpstreamError('timeout', `timeout calling ${label} ${u.pathname}`);
      }
      throw new UpstreamError('network', `${label} ${u.pathname}: ${errText(err)}`);
    }
    if (res.status === 304 && prior) {
      void res.body?.cancel().catch(() => {});
      return { value: prior.value, at: this.#clock.now(), etag: prior.etag, retryAt: 0 };
    }
    if (!res.ok) {
      void res.body?.cancel().catch(() => {});
      throw new UpstreamError('http', `${label} ${u.pathname}: HTTP ${res.status}`, { status: res.status });
    }
    const max = opts.maxBytes ?? this.#o.maxBytes ?? DEFAULT_MAX_BYTES;
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > max) {
      void res.body?.cancel().catch(() => {});
      throw new UpstreamError('size', `${label} ${u.pathname}: response too large (${declared} bytes)`);
    }
    const text = await this.#readText(res, label, u.pathname, max);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new UpstreamError('parse', `${label} ${u.pathname}: body is not JSON`);
    }
    if (send && (raw as { status?: unknown } | null)?.status === 'error') {
      const msg = (raw as { data?: { message?: unknown } }).data?.message;
      const text = typeof msg === 'string' ? msg.slice(0, 200) : 'the request was refused';
      throw new UpstreamError('rejected', `${label} ${u.pathname}: ${text}`);
    }
    if (opts.isFailure?.(raw)) {
      throw new UpstreamError('envelope', `${label} reported an error for ${u.pathname}`);
    }
    let value: unknown = raw;
    if (opts.validate) {
      try {
        value = opts.validate(raw);
      } catch (err) {
        throw new UpstreamError('invalid', `${label} ${u.pathname}: ${errText(err)}`);
      }
    }
    return { value, at: this.#clock.now(), etag: res.headers.get('etag'), retryAt: 0 };
  }

  async #readText(res: Response, label: string, path: string, max: number): Promise<string> {
    if (!res.body) return '';
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > max) {
          void reader.cancel().catch(() => {});
          throw new UpstreamError('size', `${label} ${path}: response exceeds ${max} bytes`);
        }
        chunks.push(value);
      }
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      const name = (err as { name?: string })?.name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new UpstreamError('timeout', `timeout reading ${label} ${path}`);
      }
      throw new UpstreamError('network', `${label} ${path}: ${errText(err)}`);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
}
