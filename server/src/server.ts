// Adapted from fluxcommunity/server/src/server.ts (route discovery and the application context are new).
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Config, upstreamOrigins } from './config.ts';
import { type Clock, systemClock } from './core/clock.ts';
import type { AppContext, RouteDef, RouteModule } from './core/context.ts';
import { errText, type Logger } from './core/log.ts';
import { type Loop, startLoop } from './core/loop.ts';
import { type FetchLike, UpstreamClient } from './core/upstream.ts';
import { createHandler, envelopeOf } from './http/app.ts';
import { CompressCache } from './http/compress.ts';
import { RateLimiter } from './http/ratelimit.ts';
import { Router } from './http/router.ts';
import { createSecurityHeaders } from './http/security.ts';
import { StaticSite } from './http/static.ts';
import { SseHub } from './services/hub.ts';
import { createFixturesRuntime, createLiveRuntime, type Runtime } from './services/runtime.ts';

export interface RunningServer {
  server: http.Server;
  hub: SseHub;
  limiter: RateLimiter;
  ctx: AppContext;
  /** Route modules that failed to load or register (empty when healthy). */
  routeErrors: string[];
  /** Number of routes registered. */
  routeCount: number;
  /** The port actually bound (useful when `config.port` is 0). */
  port: number;
  stop(): Promise<void>;
}

export interface StartOptions {
  clock?: Clock;
  /** Replaces the global `fetch` for every upstream call (tests). */
  fetch?: FetchLike;
  /** Directory of route modules. Default: `./routes` next to this file. */
  routesDir?: string;
  /** Additional in-memory route modules (tests). */
  extraRoutes?: RouteModule[];
  /** Fixtures mode: simulated block interval (tests shorten it). */
  blockMs?: number;
}

export const DEFAULT_ROUTES_DIR = join(import.meta.dirname, 'routes');

export function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Files in `dir` that are route modules: `*.ts`, not tests, not starting with `_`. */
export async function listRouteFiles(dir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts') && !n.endsWith('.d.ts') && !n.startsWith('_'))
    .sort()
    .map((n) => join(dir, n));
}

/** Wires the HTTP server around a data runtime and starts listening. */
export async function startServer(
  config: Config,
  log: Logger,
  opts: StartOptions = {},
): Promise<RunningServer> {
  const clock = opts.clock ?? systemClock;
  const startedAt = clock.now();

  const upstream = new UpstreamClient({
    hosts: upstreamOrigins(config),
    userAgent: config.upstream.userAgent,
    timeoutMs: config.upstream.timeoutMs,
    fetch: opts.fetch,
    clock,
    log,
    disabled: config.fixtures ? 'fixtures mode: upstream disabled' : undefined,
  });
  const runtime: Runtime = config.fixtures
    ? createFixturesRuntime(config, log, clock, opts.blockMs)
    : createLiveRuntime(config, log, upstream, clock);

  const hub = new SseHub({
    maxClients: config.limits.sseMaxClients,
    maxPerIp: config.limits.sseMaxPerIp,
    maxBufferBytes: config.limits.sseMaxBufferBytes,
    heartbeatMs: config.limits.sseHeartbeatMs,
    log,
  });
  const limiter = new RateLimiter({ classes: config.limits.rate, clock });
  const compressCache = new CompressCache(config.limits.compressCacheBytes);
  const site = new StaticSite({ root: config.webDist, cache: compressCache });
  const security = createSecurityHeaders(config);

  const loops: Loop[] = [];
  const stopHooks: (() => void | Promise<void>)[] = [];

  const ctx: AppContext = {
    config,
    log,
    clock,
    fixtures: config.fixtures,
    upstream,
    limiter,
    market: runtime.market,
    network: runtime.network,
    geo: runtime.geo,
    blocks: runtime.blocks,
    hub,
    service: { name: 'flux-academy', version: readVersion(), startedAt, mode: runtime.mode },
    envelope: (served) => envelopeOf(served, clock.now()),
    upstreamStatus: () => upstream.status(),
    schedule(name, intervalMs, run) {
      // Fixtures mode has no upstream, so a poller would only record failures.
      if (config.fixtures) return;
      loops.push(
        startLoop({
          name,
          intervalMs,
          run,
          initialDelayMs: 250,
          onError: (err, failures) =>
            log.warn('poller failed', { poller: name, failures, err: errText(err) }),
        }),
      );
    },
    onStop(fn) {
      stopHooks.push(fn);
    },
  };

  // Route discovery: every module in the directory, then any injected ones.
  const router = new Router();
  const routeErrors: string[] = [];
  const modules: { name: string; mod: RouteModule }[] = [];
  for (const file of await listRouteFiles(opts.routesDir ?? DEFAULT_ROUTES_DIR)) {
    try {
      const loaded = (await import(pathToFileURL(file).href)) as { default?: unknown };
      if (typeof loaded.default !== 'function') throw new Error('has no default export function');
      modules.push({ name: file, mod: loaded.default as RouteModule });
    } catch (err) {
      routeErrors.push(`${file}: ${errText(err)}`);
    }
  }
  for (const [i, mod] of (opts.extraRoutes ?? []).entries()) modules.push({ name: `extraRoutes[${i}]`, mod });
  for (const { name, mod } of modules) {
    try {
      const defs: RouteDef[] = mod(ctx);
      for (const def of defs) router.add(def);
    } catch (err) {
      routeErrors.push(`${name}: ${errText(err)}`);
    }
  }
  for (const e of routeErrors) log.error('route module skipped', { detail: e });
  log.info('routes', { count: router.size, modules: modules.length });

  const handler = createHandler({ config, log, router, limiter, security, site, compressCache, clock });
  const server = http.createServer(
    {
      headersTimeout: 10_000,
      requestTimeout: 15_000,
      keepAliveTimeout: 65_000,
      maxHeaderSize: 8_192,
    },
    handler,
  );
  server.on('clientError', (_err, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    else socket.destroy();
  });

  const offs = [
    runtime.onBlock((e) => hub.broadcast({ type: 'block', data: e })),
    // Streamed snapshots carry the same envelope REST would return at this instant.
    runtime.onNetwork(() =>
      hub.broadcast({ type: 'network', data: ctx.envelope(runtime.network.snapshot()) }),
    ),
  ];

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  hub.start();
  limiter.startSweeper();
  runtime.start();
  const port = (server.address() as AddressInfo).port;

  let stopping: Promise<void> | null = null;
  const stop = () => {
    stopping ??= (async () => {
      for (const off of offs) off();
      for (const l of loops) l.stop();
      // Ending the SSE streams first lets server.close() finish promptly.
      hub.stop();
      limiter.stop();
      await runtime.stop();
      await new Promise<void>((resolve) => {
        const force = setTimeout(() => {
          server.closeAllConnections();
        }, 5_000);
        server.close(() => {
          clearTimeout(force);
          resolve();
        });
        server.closeIdleConnections();
      });
      for (const fn of stopHooks) {
        try {
          await fn();
        } catch (err) {
          log.warn('stop hook failed', { err: errText(err) });
        }
      }
    })();
    return stopping;
  };

  return { server, hub, limiter, ctx, routeErrors, routeCount: router.size, port, stop };
}
