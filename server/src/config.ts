// Adapted from fluxcommunity/server/src/config.ts
import { resolve } from 'node:path';
import type { RateClass } from './core/context.ts';
import type { LogLevel } from './core/log.ts';

export class ConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

export interface BucketConfig {
  burst: number;
  refillPerSec: number;
}

export interface Config {
  port: number;
  host: string;
  /** Absolute path of the built web bundle (may not exist: the server then serves the API only). */
  webDist: string;
  logLevel: LogLevel;
  /** Number of trusted reverse-proxy hops whose X-Forwarded-For entries are honoured. 0 = none. */
  trustProxyHops: number;
  /** Allowed CORS origins, or '*'. Empty = no CORS headers at all (the web app is same-origin). */
  corsOrigins: string[] | '*';
  /** Offline mode with deterministic simulated data, labelled `fallback`. Dev and CI only. */
  fixtures: boolean;
  upstream: {
    /** Flux API bases, tried in order on failure (api.runonflux.io fronts a load balancer). */
    fluxApi: string[];
    stats: string;
    /** The Flux rates service FluxOS itself prices with (`/rates`). */
    market: string;
    /** CoinGecko (`zelcash`): 24 h change, market cap and the price when the rates service is down. */
    marketFallback: string;
    timeoutMs: number;
    userAgent: string;
  };
  intervals: {
    /** Block detection poll gap while a block is imminent / right after one. */
    blockFastMs: number;
    blockSlowMs: number;
    networkMs: number;
    /** Stats aggregation: capacity, versions and geography. */
    geoMs: number;
    priceMs: number;
    appsRunningMs: number;
    appsRegisteredMs: number;
  };
  limits: {
    rate: Record<RateClass, BucketConfig>;
    /** POST body cap in bytes. */
    bodyBytes: number;
    sseMaxClients: number;
    sseMaxPerIp: number;
    /** Bytes buffered for one SSE client before it is dropped as a slow consumer. */
    sseMaxBufferBytes: number;
    sseHeartbeatMs: number;
    compressCacheBytes: number;
  };
}

type Env = Record<string, string | undefined>;

const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];

class Reader {
  readonly env: Env;
  readonly problems: string[] = [];
  constructor(env: Env) {
    this.env = env;
  }
  str(key: string, def: string): string {
    const v = this.env[key];
    return v === undefined || v.trim() === '' ? def : v.trim();
  }
  int(key: string, def: number, min: number, max: number): number {
    const raw = this.env[key];
    if (raw === undefined || raw.trim() === '') return def;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      this.problems.push(`${key} must be an integer between ${min} and ${max} (got "${raw}")`);
      return def;
    }
    return n;
  }
  bool(key: string, def = false): boolean {
    const raw = this.env[key];
    if (raw === undefined || raw.trim() === '') return def;
    const v = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off'].includes(v)) return false;
    this.problems.push(`${key} must be a boolean: 1/0, true/false (got "${raw}")`);
    return def;
  }
  url(key: string, def: string): string {
    const raw = this.str(key, def);
    return this.#checkUrl(key, raw, def);
  }
  urlList(key: string, def: string[]): string[] {
    const raw = this.env[key];
    if (raw === undefined || raw.trim() === '') return def;
    const out = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((u) => this.#checkUrl(key, u, ''));
    return out.filter(Boolean);
  }
  #checkUrl(key: string, raw: string, def: string): string {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('scheme');
      return raw.replace(/\/+$/, '');
    } catch {
      this.problems.push(`${key} must be an http(s) URL (got "${raw}")`);
      return def;
    }
  }
}

export const DEFAULT_WEB_DIST = resolve(import.meta.dirname, '../../web/dist');

export function loadConfig(env: Env = process.env): Config {
  const r = new Reader(env);

  const port = r.int('PORT', 42069, 0, 65535);
  const host = r.str('HOST', '0.0.0.0');
  const webDist = resolve(r.str('WEB_DIST', DEFAULT_WEB_DIST));

  const levelRaw = r.str('LOG_LEVEL', 'info').toLowerCase();
  let logLevel: LogLevel = 'info';
  if ((LOG_LEVELS as readonly string[]).includes(levelRaw)) logLevel = levelRaw as LogLevel;
  else r.problems.push(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')} (got "${levelRaw}")`);

  let trustProxyHops = 0;
  const tp = r.str('TRUST_PROXY', '').toLowerCase();
  if (tp === '' || tp === '0' || tp === 'false' || tp === 'no' || tp === 'off') trustProxyHops = 0;
  else if (tp === 'true' || tp === 'yes' || tp === 'on') trustProxyHops = 1;
  else if (/^[1-9]$/.test(tp)) trustProxyHops = Number(tp);
  else r.problems.push(`TRUST_PROXY must be false, true, or a hop count 1-9 (got "${tp}")`);

  let corsOrigins: string[] | '*' = [];
  const corsRaw = r.str('CORS_ORIGINS', '');
  if (corsRaw === '*') corsOrigins = '*';
  else if (corsRaw) {
    corsOrigins = [];
    for (const o of corsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)) {
      try {
        const u = new URL(o);
        if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.origin !== o.replace(/\/+$/, '')) {
          throw new Error('not an origin');
        }
        corsOrigins.push(u.origin);
      } catch {
        r.problems.push(`CORS_ORIGINS entry "${o}" must be a bare origin like https://example.com`);
      }
    }
  }

  const config: Config = {
    port,
    host,
    webDist,
    logLevel,
    trustProxyHops,
    corsOrigins,
    fixtures: r.bool('FIXTURES', false),
    upstream: {
      fluxApi: r.urlList('FLUX_API_URLS', ['https://api.runonflux.io']),
      stats: r.url('FLUX_STATS_URL', 'https://stats.runonflux.io'),
      market: r.url('MARKET_URL', 'https://viprates.runonflux.io'),
      marketFallback: r.url('MARKET_FALLBACK_URL', 'https://api.coingecko.com'),
      timeoutMs: r.int('UPSTREAM_TIMEOUT_MS', 10_000, 500, 60_000),
      userAgent: r.str('UPSTREAM_USER_AGENT', 'FluxAcademy/2.0 (+https://academy.app.runonflux.io)'),
    },
    intervals: {
      blockFastMs: r.int('BLOCK_POLL_FAST_MS', 3_000, 250, 30_000),
      blockSlowMs: r.int('BLOCK_POLL_SLOW_MS', 5_000, 500, 60_000),
      networkMs: r.int('NETWORK_REFRESH_MS', 10_000, 2_000, 600_000),
      geoMs: r.int('GEO_REFRESH_MS', 300_000, 30_000, 3_600_000),
      priceMs: r.int('PRICE_REFRESH_MS', 60_000, 15_000, 3_600_000),
      appsRunningMs: r.int('APPS_RUNNING_REFRESH_MS', 600_000, 60_000, 86_400_000),
      appsRegisteredMs: r.int('APPS_REGISTERED_REFRESH_MS', 1_800_000, 60_000, 86_400_000),
    },
    limits: {
      rate: {
        read: {
          burst: r.int('RATE_LIMIT_BURST', 150, 1, 100_000),
          refillPerSec: r.int('RATE_LIMIT_RPS', 30, 1, 100_000),
        },
        // POST routes do real work (pricing, lint, optional upstream confirmation): a much smaller bucket.
        write: {
          burst: r.int('RATE_LIMIT_WRITE_BURST', 30, 1, 100_000),
          refillPerSec: r.int('RATE_LIMIT_WRITE_RPS', 3, 1, 100_000),
        },
        stream: { burst: 20, refillPerSec: 1 },
        // A first visit fetches dozens of build files, and a classroom behind one address does it together:
        // they must not share the page bucket, or a 429 lands on a script and breaks the page.
        static: {
          burst: r.int('RATE_LIMIT_STATIC_BURST', 1_500, 1, 1_000_000),
          refillPerSec: r.int('RATE_LIMIT_STATIC_RPS', 300, 1, 1_000_000),
        },
        exempt: { burst: Number.MAX_SAFE_INTEGER, refillPerSec: 1 },
      },
      bodyBytes: r.int('BODY_LIMIT_BYTES', 65_536, 1_024, 1_048_576),
      sseMaxClients: r.int('SSE_MAX_CLIENTS', 2_000, 1, 100_000),
      sseMaxPerIp: r.int('SSE_MAX_PER_IP', 8, 1, 1_000),
      sseMaxBufferBytes: r.int('SSE_MAX_BUFFER_BYTES', 262_144, 4_096, 16_777_216),
      sseHeartbeatMs: r.int('SSE_HEARTBEAT_MS', 20_000, 1_000, 120_000),
      compressCacheBytes: r.int('COMPRESS_CACHE_BYTES', 33_554_432, 0, 1_073_741_824),
    },
  };

  if (config.upstream.fluxApi.length === 0) r.problems.push('FLUX_API_URLS must list at least one URL');
  if (r.problems.length > 0) throw new ConfigError(r.problems);
  return config;
}

/** Origins the upstream client may fetch from: the configured Flux, stats and market bases. */
export function upstreamOrigins(config: Config): Record<string, string> {
  const out: Record<string, string> = {};
  config.upstream.fluxApi.forEach((u, i) => {
    out[new URL(u).origin] = i === 0 ? 'flux-api' : `flux-api-${i + 1}`;
  });
  out[new URL(config.upstream.stats).origin] = 'stats';
  out[new URL(config.upstream.market).origin] = 'market';
  out[new URL(config.upstream.marketFallback).origin] = 'coingecko';
  return out;
}
