/**
 * Typed REST client for the Academy API. The only module that issues one-shot requests; components
 * never call `fetch` (docs/ARCHITECTURE.md section 6).
 *
 * - Every call has a timeout (AbortController) and a small retry with jitter on transient failures.
 * - Every payload is validated structurally (see validate.ts). A bad payload is an error result,
 *   never a half-built object.
 * - Nothing throws: callers always get an `ApiResult`.
 * - Same origin only. There are no third-party requests anywhere in the app.
 *
 * Adapted from fluxcommunity/web/src/data/api.ts (same owner, MIT).
 */

import type {
  BlocksSnapshot,
  Envelope,
  ExploreApp,
  ExploreSearch,
  GeoSnapshot,
  NetworkSnapshot,
  PricingSnapshot,
  QuoteRequest,
  QuoteResponse,
} from '@shared/api';
import { API_PATHS } from '@shared/api';
import type { LintReport } from '@shared/flux/types';
import {
  isRec,
  type Parsed,
  parseBlocks,
  parseEnvelope,
  parseExploreApp,
  parseExploreSearch,
  parseGeo,
  parseLintReport,
  parseNetwork,
  parsePricing,
  parseQuoteResponse,
} from './validate';

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid' | 'aborted' | 'too-large';

export interface ApiError {
  kind: ApiErrorKind;
  /** A short message fit for a log or a small status line. */
  message: string;
  status?: number;
  /** The server's error code (`ApiErrorBody.error.code`), when it sent one. */
  code?: string;
  /** From a Retry-After header on 429/503, in milliseconds. */
  retryAfterMs?: number;
}

export type ApiResult<T> =
  | { ok: true; envelope: Envelope<T>; requestStartedAt: number; receivedAt: number }
  | { ok: false; error: ApiError; requestStartedAt: number; receivedAt: number };

export interface ApiOptions {
  fetch?: typeof fetch;
  /** Prefix for every path. Empty means same origin, which is what production uses. */
  baseUrl?: string;
  /** Per-attempt timeout. */
  timeoutMs?: number;
  /** Extra attempts after the first (so 1 means at most two requests). */
  retries?: number;
  /** First retry delay; doubles each time, plus up to 50 percent jitter. */
  retryBaseMs?: number;
  random?: () => number;
  /** Test seam: replaces the real delay between attempts. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface RequestOptions {
  signal?: AbortSignal;
  /** Override the client's retry count for this call. */
  retries?: number;
  /** Override the client's per-attempt timeout for this call. */
  timeoutMs?: number;
}

/** The server rejects bodies over 64 KB; refuse early with a friendly error instead of a 413. */
export const MAX_BODY_BYTES = 60_000;

export interface ApiClient {
  network(opts?: RequestOptions): Promise<ApiResult<NetworkSnapshot>>;
  geo(opts?: RequestOptions): Promise<ApiResult<GeoSnapshot>>;
  blocks(opts?: RequestOptions): Promise<ApiResult<BlocksSnapshot>>;
  pricing(opts?: RequestOptions): Promise<ApiResult<PricingSnapshot>>;
  quote(req: QuoteRequest, opts?: RequestOptions): Promise<ApiResult<QuoteResponse>>;
  lint(spec: unknown, opts?: RequestOptions): Promise<ApiResult<LintReport>>;
  exploreApp(name: string, opts?: RequestOptions): Promise<ApiResult<ExploreApp>>;
  exploreSearch(query: string, opts?: RequestOptions): Promise<ApiResult<ExploreSearch>>;
}

const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_BASE_MS = 400;

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}

function parseRetryAfter(res: Response): number | undefined {
  const h = res.headers.get('retry-after');
  if (!h) return undefined;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, Math.min(secs, 120)) * 1000;
  const when = Date.parse(h);
  return Number.isFinite(when) ? Math.max(0, Math.min(when - Date.now(), 120_000)) : undefined;
}

function retryable(e: ApiError): boolean {
  if (e.kind === 'network' || e.kind === 'timeout') return true;
  if (e.kind === 'http') return e.status === 408 || e.status === 429 || (e.status ?? 0) >= 500;
  return false;
}

/** Pulls `{ error: { code, message } }` out of an error response body, when there is one. */
async function readErrorBody(res: Response): Promise<{ code?: string; message?: string }> {
  try {
    const body: unknown = await res.json();
    if (isRec(body) && isRec(body.error)) {
      const { code, message } = body.error;
      return {
        code: typeof code === 'string' ? code.slice(0, 60) : undefined,
        message: typeof message === 'string' ? message.slice(0, 200) : undefined,
      };
    }
  } catch {
    // Not JSON: the status line is all there is.
  }
  return {};
}

type Attempt<T> = { ok: true; envelope: Envelope<T> } | { ok: false; error: ApiError };

export function createApiClient(options: ApiOptions = {}): ApiClient {
  const baseUrl = options.baseUrl ?? '';
  const defaultTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const defaultRetries = options.retries ?? DEFAULT_RETRIES;
  const retryBaseMs = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;

  async function attempt<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: string },
    parse: (v: unknown) => Parsed<T>,
    external: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<Attempt<T>> {
    const f = options.fetch ?? globalThis.fetch;
    const controller = new AbortController();
    let timedOut = false;
    const onExternalAbort = () => controller.abort();
    if (external?.aborted) return { ok: false, error: { kind: 'aborted', message: 'aborted' } };
    external?.addEventListener('abort', onExternalAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const headers: Record<string, string> = { accept: 'application/json' };
      if (init.body !== undefined) headers['content-type'] = 'application/json';
      const res = await f(`${baseUrl}${path}`, {
        method: init.method,
        signal: controller.signal,
        headers,
        body: init.body,
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const body = await readErrorBody(res);
        return {
          ok: false,
          error: {
            kind: 'http',
            message: body.message ?? `HTTP ${res.status}`,
            status: res.status,
            code: body.code,
            retryAfterMs: parseRetryAfter(res),
          },
        };
      }
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        return { ok: false, error: { kind: 'invalid', message: 'response is not JSON' } };
      }
      const parsed = parseEnvelope(body, parse);
      if (!parsed.ok) return { ok: false, error: { kind: 'invalid', message: parsed.reason } };
      return { ok: true, envelope: parsed.value };
    } catch (e) {
      if (timedOut) {
        return { ok: false, error: { kind: 'timeout', message: `timed out after ${timeoutMs} ms` } };
      }
      if (external?.aborted) return { ok: false, error: { kind: 'aborted', message: 'aborted' } };
      return {
        ok: false,
        error: { kind: 'network', message: e instanceof Error ? e.message : 'network error' },
      };
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    }
  }

  async function request<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: string },
    parse: (v: unknown) => Parsed<T>,
    opts: RequestOptions = {},
  ): Promise<ApiResult<T>> {
    const requestStartedAt = Date.now();
    const maxRetries = opts.retries ?? defaultRetries;
    const timeoutMs = opts.timeoutMs ?? defaultTimeout;
    let last: ApiError = { kind: 'network', message: 'no attempt made' };
    for (let i = 0; i <= maxRetries; i++) {
      const r = await attempt(path, init, parse, opts.signal, timeoutMs);
      if (r.ok) return { ok: true, envelope: r.envelope, requestStartedAt, receivedAt: Date.now() };
      last = r.error;
      if (!retryable(last) || i === maxRetries) break;
      const wait = Math.max(last.retryAfterMs ?? 0, retryBaseMs * 2 ** i * (1 + random() * 0.5));
      await sleep(wait, opts.signal);
      if (opts.signal?.aborted) {
        last = { kind: 'aborted', message: 'aborted' };
        break;
      }
    }
    return { ok: false, error: last, requestStartedAt, receivedAt: Date.now() };
  }

  function post<T>(
    path: string,
    payload: unknown,
    parse: (v: unknown) => Parsed<T>,
    opts?: RequestOptions,
  ): Promise<ApiResult<T>> {
    const now = Date.now();
    let body: string;
    try {
      body = JSON.stringify(payload);
    } catch {
      return Promise.resolve({
        ok: false,
        error: { kind: 'invalid', message: 'the request body is not serialisable' },
        requestStartedAt: now,
        receivedAt: now,
      });
    }
    if (body.length > MAX_BODY_BYTES) {
      return Promise.resolve({
        ok: false,
        error: { kind: 'too-large', message: 'the spec is too large to send' },
        requestStartedAt: now,
        receivedAt: now,
      });
    }
    return request(path, { method: 'POST', body }, parse, opts);
  }

  const get = <T>(path: string, parse: (v: unknown) => Parsed<T>, opts?: RequestOptions) =>
    request(path, { method: 'GET' }, parse, opts);

  return {
    network: (o) => get(API_PATHS.network, parseNetwork, o),
    geo: (o) => get(API_PATHS.geo, parseGeo, o),
    blocks: (o) => get(API_PATHS.blocks, parseBlocks, o),
    pricing: (o) => get(API_PATHS.pricing, parsePricing, o),
    quote: (req, o) => post(API_PATHS.quote, req, parseQuoteResponse, o),
    lint: (spec, o) => post(API_PATHS.lint, { spec }, parseLintReport, o),
    exploreApp: (name, o) =>
      get(`${API_PATHS.exploreApp}?name=${encodeURIComponent(name)}`, parseExploreApp, o),
    exploreSearch: (query, o) =>
      get(`${API_PATHS.exploreSearch}?q=${encodeURIComponent(query)}`, parseExploreSearch, o),
  };
}
