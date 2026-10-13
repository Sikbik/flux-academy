// Adapted from fluxcommunity/server/src/http/app.ts (the route table, body reading, redirects and SEO
// documents are new; request hygiene, CORS, logging and the error boundary are carried over).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { API_PATHS, type Envelope } from '../../../shared/api.ts';
import { REDIRECTS } from '../../../shared/site.ts';
import type { Config } from '../config.ts';
import { type Clock, systemClock } from '../core/clock.ts';
import { HttpError, type JsonRouteDef, type RateClass, type RouteRequest } from '../core/context.ts';
import { errText, type Logger } from '../core/log.ts';
import { clientIp } from './client-ip.ts';
import type { CompressCache } from './compress.ts';
import type { RateLimiter } from './ratelimit.ts';
import { buildMeta, sendEnvelope, sendError, sendRedirect, sendText } from './respond.ts';
import { normalisePath, type Router } from './router.ts';
import type { SecurityHeaders } from './security.ts';
import { robotsTxt, sitemapXml } from './seo.ts';
import type { StaticSite } from './static.ts';

export interface AppDeps {
  config: Config;
  log: Logger;
  router: Router;
  limiter: RateLimiter;
  security: SecurityHeaders;
  site: StaticSite;
  compressCache: CompressCache;
  clock?: Clock;
}

const MAX_URL_LENGTH = 2048;
const NO_STORE = 'no-store';
/** Build files: hashed scripts, styles and fonts, generated art, brand marks. Pages are not in this set. */
const STATIC_FILES = /^\/(assets|art|brand)\//;

/** Builds `Envelope<T>` the same way for REST and for streamed events. */
export function envelopeOf<T>(
  s: { data: T; asOfMs: number; source: 'live' | 'cache' | 'fallback'; windowMs: number },
  nowMs: number,
): Envelope<T> {
  return {
    data: s.data,
    meta: buildMeta({ asOfMs: s.asOfMs, source: s.source, windowMs: s.windowMs, nowMs }),
  };
}

/** Reads and parses a JSON body under a byte cap. Throws HttpError with the right status. */
export async function readJsonBody(req: IncomingMessage, capBytes: number): Promise<unknown> {
  const ct = String(req.headers['content-type'] ?? '')
    .split(';')[0]
    ?.trim()
    .toLowerCase();
  if (ct !== 'application/json') {
    throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json');
  }
  const declared = Number(req.headers['content-length'] ?? 0);
  if (Number.isFinite(declared) && declared > capBytes) {
    throw new HttpError(413, 'payload_too_large', `Body must be at most ${capBytes} bytes`, {
      Connection: 'close',
    });
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > capBytes) {
      throw new HttpError(413, 'payload_too_large', `Body must be at most ${capBytes} bytes`, {
        Connection: 'close',
      });
    }
    chunks.push(buf);
  }
  if (total === 0) throw new HttpError(400, 'empty_body', 'A JSON body is required');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'bad_json', 'The body is not valid JSON');
  }
}

export function createHandler(deps: AppDeps): (req: IncomingMessage, res: ServerResponse) => void {
  const { config, log, router, limiter, security, site, compressCache } = deps;
  const clock = deps.clock ?? systemClock;
  // Snapshots are shared objects; serialise each once while it is current.
  const jsonMemo = new WeakMap<object, string>();
  const dataJson = (data: unknown): string => {
    if (typeof data !== 'object' || data === null) return JSON.stringify(data);
    let s = jsonMemo.get(data);
    if (s === undefined) {
      s = JSON.stringify(data);
      jsonMemo.set(data, s);
    }
    return s;
  };

  const corsHeaders = (req: IncomingMessage): Record<string, string> => {
    const allow = config.corsOrigins;
    if (allow === '*') return { 'Access-Control-Allow-Origin': '*' };
    if (allow.length === 0) return {};
    const origin = req.headers.origin;
    if (typeof origin === 'string' && allow.includes(origin)) {
      return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin, Accept-Encoding' };
    }
    return {};
  };

  const take = (res: ServerResponse, req: IncomingMessage, cls: RateClass, ip: string): boolean => {
    const r = limiter.take(cls, ip);
    if (r.ok) return true;
    sendError(req, res, 429, 'rate_limited', 'Too many requests, slow down', {
      'Retry-After': String(r.retryAfterSec),
    });
    return false;
  };

  async function runJson(
    req: IncomingMessage,
    res: ServerResponse,
    def: JsonRouteDef,
    params: Record<string, string>,
    url: URL,
    ip: string,
  ): Promise<void> {
    const method = def.method;
    const cors = corsHeaders(req);
    let body: unknown;
    if (method === 'POST') {
      const cap = Math.min(def.maxBodyBytes ?? config.limits.bodyBytes, config.limits.bodyBytes);
      try {
        body = await readJsonBody(req, cap);
      } catch (err) {
        if (err instanceof HttpError) {
          return sendError(req, res, err.status, err.code, err.message, { ...err.headers, ...cors });
        }
        throw err;
      }
    }
    const abort = new AbortController();
    res.once('close', () => abort.abort());
    const rr: RouteRequest = {
      method,
      params,
      query: url.searchParams,
      body,
      ip,
      signal: abort.signal,
    };
    let result: Awaited<ReturnType<JsonRouteDef['handler']>>;
    try {
      result = await def.handler(rr);
    } catch (err) {
      if (err instanceof HttpError) {
        return sendError(req, res, err.status, err.code, err.message, { ...err.headers, ...cors });
      }
      throw err;
    }
    const nowMs = clock.now();
    return sendEnvelope(req, res, {
      dataJson: dataJson(result.data),
      meta: buildMeta({
        asOfMs: result.asOfMs,
        source: result.source,
        windowMs: result.windowMs,
        nowMs,
      }),
      cacheControl: result.cacheControl ?? def.cacheControl ?? NO_STORE,
      cache: compressCache,
      headers: { ...cors, ...result.headers },
      conditional: method === 'GET',
    });
  }

  return (req, res) => {
    const started = process.hrtime.bigint();
    const method = req.method ?? 'GET';
    let logPath = '-';
    res.on('close', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      const quiet =
        logPath === '/healthz' || logPath.startsWith('/assets/') || /\.[a-z0-9]{2,5}$/.test(logPath);
      const fields = { m: method, p: logPath, s: res.statusCode, ms: Math.round(ms * 10) / 10 };
      if (res.statusCode >= 500) log.error('req', fields);
      else if (quiet || logPath === API_PATHS.stream) log.debug('req', fields);
      else log.info('req', fields);
    });

    void (async () => {
      try {
        security.apply(req, res);

        if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && method !== 'POST') {
          return sendError(req, res, 405, 'method_not_allowed', 'Method not allowed', {
            Allow: 'GET, HEAD, POST, OPTIONS',
          });
        }
        const rawUrl = req.url ?? '/';
        if (rawUrl.length > MAX_URL_LENGTH) return sendError(req, res, 414, 'uri_too_long', 'URI too long');
        let url: URL;
        try {
          // Prefixing the origin (rather than resolving against it) keeps `//host/path` a path, not a
          // network-path reference that would silently drop its first segment.
          url = new URL(`http://local${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`);
        } catch {
          return sendError(req, res, 400, 'bad_request', 'Malformed URL');
        }
        const path = url.pathname;
        logPath = path.length > 120 ? `${path.slice(0, 120)}...` : path;

        if (method === 'OPTIONS') {
          const cors = corsHeaders(req);
          res.writeHead(204, {
            Allow: 'GET, HEAD, POST, OPTIONS',
            ...cors,
            ...(cors['Access-Control-Allow-Origin']
              ? {
                  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
                  'Access-Control-Allow-Headers': 'content-type',
                  'Access-Control-Max-Age': '600',
                }
              : {}),
            'Cache-Control': NO_STORE,
          });
          return void res.end();
        }

        const ip = clientIp(req, config.trustProxyHops);
        const hit = router.lookup(method, path);

        if (hit.kind === 'match') {
          const { def, params } = hit.match;
          const cls = def.limit ?? (def.method === 'POST' ? 'write' : 'read');
          if (!take(res, req, cls, ip)) return;
          if ('raw' in def) {
            try {
              return await def.raw(req, res, ip);
            } catch (err) {
              if (err instanceof HttpError && !res.headersSent) {
                return sendError(req, res, err.status, err.code, err.message, err.headers);
              }
              throw err;
            }
          }
          return await runJson(req, res, def, params, url, ip);
        }
        if (hit.kind === 'method') {
          return sendError(req, res, 405, 'method_not_allowed', 'Method not allowed for this path', {
            Allow: [...hit.allow, 'OPTIONS'].join(', '),
          });
        }

        // Everything that is not an API route is a page, so it is a read. The files a page is built from are
        // fetched by the dozen on a first visit and are cheap to serve, so they have a bucket of their own.
        // Sharing the page bucket let a classroom behind one address, or two browsers in a test run, get a
        // 429 on a script and a broken page.
        if (!take(res, req, STATIC_FILES.test(path) ? 'static' : 'read', ip)) return;

        if (path === '/api' || path.startsWith('/api/')) {
          return sendError(req, res, 404, 'not_found', 'Unknown API endpoint');
        }
        if (method === 'POST') {
          return sendError(req, res, 405, 'method_not_allowed', 'Method not allowed for this path', {
            Allow: 'GET, HEAD, OPTIONS',
          });
        }
        if (path === '/robots.txt') {
          return sendText(req, res, 200, robotsTxt(), { 'Cache-Control': 'public, max-age=3600' });
        }
        if (path === '/sitemap.xml') {
          return sendText(req, res, 200, sitemapXml(), {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          });
        }
        const target = REDIRECTS[normalisePath(path)];
        if (target !== undefined) return sendRedirect(res, `${target}${url.search}`);

        return await site.handle(req, res, path);
      } catch (err) {
        log.error('handler error', { err: errText(err), p: logPath });
        if (!res.headersSent) sendError(req, res, 500, 'internal', 'Internal error');
        else res.destroy();
      }
    })();
  };
}
