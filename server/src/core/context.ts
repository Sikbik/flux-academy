/**
 * The extension point. A route module (`server/src/routes/<name>.ts`) default-exports
 * `(ctx: AppContext) => RouteDef[]` and is discovered by listing that directory at start-up; nobody edits a
 * central file to add an endpoint. Everything a route needs arrives through `AppContext`, so a route never
 * imports infrastructure directly and tests can hand it fakes.
 *
 * See `server/src/routes/README.md` for the walkthrough.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  BlocksSnapshot,
  DataSource,
  Envelope,
  GeoSnapshot,
  NetworkSnapshot,
} from '../../../shared/api.ts';
import type { Config } from '../config.ts';
import type { RateLimiter } from '../http/ratelimit.ts';
import type { SseHub } from '../services/hub.ts';
import type { Clock } from './clock.ts';
import type { Logger } from './log.ts';
import type { UpstreamClient } from './upstream.ts';

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/**
 * A value together with where it came from. The HTTP layer turns this into `Envelope<T>`:
 * `meta.asOf` and `meta.ageMs` come from `asOfMs` and the response time, `meta.stale` is `ageMs > windowMs`,
 * `meta.source` is `source`. Readers on the context return this, so a route can return one unchanged.
 */
export interface Served<T> {
  data: T;
  /** Epoch ms the underlying data was fetched from upstream (or baked, for `fallback`). */
  asOfMs: number;
  source: DataSource;
  /** Freshness window in ms: older than this and `meta.stale` is true. */
  windowMs: number;
}

/** What a JSON route handler returns. `cacheControl` defaults to `no-store`. */
export type RouteResult<T> = Served<T> & {
  cacheControl?: string;
  /** Extra response headers (never user input). */
  headers?: Record<string, string>;
};

/** A value computed right now from the request alone (nothing upstream): live, window 60 s. */
export function computed<T>(data: T, nowMs: number, windowMs = 60_000): Served<T> {
  return { data, asOfMs: nowMs, source: 'live', windowMs };
}

/** Throw from a handler to answer with an `ApiErrorBody` and this status. The message is shown to clients. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Record<string, string>;
  constructor(status: number, code: string, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Per-IP token-bucket class. `read` (GET), `write` (POST: stricter), `stream` (SSE connects), `static` (the
 * files a page is built from: scripts, styles, fonts, art; much larger than `read`), `exempt` (liveness
 * only). Defaults: GET routes are `read`, POST routes are `write`.
 */
export type RateClass = 'read' | 'write' | 'stream' | 'static' | 'exempt';

export interface RouteRequest {
  method: 'GET' | 'POST';
  /** `:name` segments of the route path, URI-decoded (at most 200 chars each). */
  params: Readonly<Record<string, string>>;
  /** Parsed query string. Never echo it into a response without validating it. */
  query: URLSearchParams;
  /**
   * POST only: the parsed JSON body (content type, size and JSON syntax already checked by the server).
   * Treat it as hostile: validate or normalise before use. `undefined` for GET.
   */
  body: unknown;
  /** The client address after proxy handling, for per-client logic. Never log or store it. */
  ip: string;
  /** Aborts when the client disconnects. */
  signal: AbortSignal;
}

interface RouteBase {
  method: 'GET' | 'POST';
  /**
   * Exact (`/api/v1/network`) or with `:param` segments (`/api/v1/explore/app/:name`). Exact paths win
   * over parameterised ones. Must start with `/api/` unless it is a platform path such as `/healthz`.
   */
  path: string;
  limit?: RateClass;
}

/** A JSON route: the server builds `Envelope<T>`, ETag, compression, CORS and error bodies. */
export interface JsonRouteDef<T = unknown> extends RouteBase {
  /** POST body cap in bytes. Default 65536; may only be lowered below the server-wide cap. */
  maxBodyBytes?: number;
  /** Default `no-store`. A result's own `cacheControl` wins. */
  cacheControl?: string;
  handler: (req: RouteRequest) => Promise<RouteResult<T>> | RouteResult<T>;
}

/**
 * A raw route for streaming (SSE) or plain text. It owns the response and must end it, except that it may
 * `throw new HttpError(...)` before writing anything and the server will answer with that error.
 */
export interface RawRouteDef extends RouteBase {
  raw: (req: IncomingMessage, res: ServerResponse, ip: string) => void | Promise<void>;
}

export type RouteDef<T = unknown> = JsonRouteDef<T> | RawRouteDef;

/** The default export of every file in `server/src/routes/`. */
export type RouteModule = (ctx: AppContext) => RouteDef[];

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface MarketPrice {
  /** USD per FLUX, null when no price has ever been fetched (then `source` is `fallback`). */
  value: number | null;
  /** ISO-8601 UTC time of the quote, null when `value` is null. */
  asOf: string | null;
  asOfMs: number | null;
  /** `live` within the refresh window, `cache` older, `fallback` when there is no price (or FIXTURES). */
  source: DataSource;
}

export interface MarketReader {
  /** Synchronous, never throws, never blocks on the network. */
  fluxUsd(): MarketPrice;
}

export interface BlocksReader {
  snapshot(): Served<BlocksSnapshot>;
  /** The newest block the server has seen, null before the first one. */
  tip(): { height: number; timeMs: number; txCount: number | null } | null;
  /** Mean seconds between buffered blocks, null while there are too few. */
  measuredBlockSec(): number | null;
}

export interface UpstreamHealth {
  ok: boolean;
  lastOkAt: string | null;
  lastError: string | null;
}

export interface AppContext {
  config: Config;
  /** Structured JSON logger. Use `ctx.log.child({ route: 'x' })`. Never log request bodies or IPs. */
  log: Logger;
  /** Injectable time source. Use it instead of `Date.now()` so tests can control time. */
  clock: Clock;
  /** True when running with FIXTURES=1: upstream calls fail fast and data is simulated. */
  fixtures: boolean;
  /**
   * Typed, cached client for allow-listed upstream hosts: single-flight, stale-while-revalidate, timeout,
   * jittered retry and a per-host circuit breaker. See `UpstreamClient.get`.
   */
  upstream: UpstreamClient;
  /** The per-IP token buckets. A route may charge extra for an expensive call: `take('write', ip, 5)`. */
  limiter: RateLimiter;
  market: MarketReader;
  network: { snapshot(): Served<NetworkSnapshot> };
  geo: { snapshot(): Served<GeoSnapshot> };
  blocks: BlocksReader;
  /** The SSE hub (`broadcast`, `size`, `add`). The server already streams block and network events. */
  hub: Pick<SseHub, 'add' | 'broadcast' | 'size'>;
  /** Identity of this process, for `/api/v1/info`. `startedAt` is epoch ms. */
  service: { name: string; version: string; startedAt: number; mode: 'live' | 'fixtures' };
  /** `Envelope<T>` exactly as REST would send it now (same `meta` rules), for streamed events. */
  envelope<T>(served: Served<T>): Envelope<T>;
  /** Upstream health for `/api/v1/info`; a route that adds an upstream appears here automatically. */
  upstreamStatus(): Record<string, UpstreamHealth>;
  /**
   * Run `fn` now-ish and then every `intervalMs` (jittered, never overlapping, exponential backoff on
   * failure; return false or throw to count a failure) until the server stops. For pollers.
   */
  schedule(name: string, intervalMs: number, fn: () => Promise<boolean | undefined>): void;
  /** Run `fn` during graceful shutdown (after the HTTP server stops accepting). */
  onStop(fn: () => void | Promise<void>): void;
}
