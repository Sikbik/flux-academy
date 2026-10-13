// Adapted from fluxcommunity/server/test/misc.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConfigError, loadConfig, upstreamOrigins } from '../src/config.ts';
import { ManualClock } from '../src/core/clock.ts';
import { createLogger } from '../src/core/log.ts';
import { RateLimiter, TokenBuckets } from '../src/http/ratelimit.ts';

describe('config', () => {
  it('has safe defaults', () => {
    const c = loadConfig({});
    assert.equal(c.port, 42069);
    assert.equal(c.host, '0.0.0.0');
    assert.equal(c.logLevel, 'info');
    assert.equal(c.fixtures, false);
    assert.equal(c.trustProxyHops, 0);
    assert.deepEqual(c.corsOrigins, []);
    assert.equal(c.upstream.fluxApi[0], 'https://api.runonflux.io');
    assert.equal(c.upstream.stats, 'https://stats.runonflux.io');
    assert.equal(c.upstream.market, 'https://viprates.runonflux.io');
    assert.equal(c.intervals.networkMs, 10_000);
    assert.equal(c.intervals.geoMs, 300_000);
    assert.equal(c.intervals.priceMs, 60_000);
    assert.equal(c.limits.bodyBytes, 65_536);
    assert.equal(c.limits.sseHeartbeatMs, 20_000);
    assert.ok(c.limits.rate.write.burst < c.limits.rate.read.burst, 'POST bucket is stricter');
    assert.ok(
      c.limits.rate.static.burst >= 10 * c.limits.rate.read.burst,
      'the files of a page have a far larger bucket than pages',
    );
    assert.match(c.webDist, /web\/dist$/);
  });

  it('parses overrides', () => {
    const c = loadConfig({
      PORT: '8080',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'DEBUG',
      TRUST_PROXY: '2',
      CORS_ORIGINS: 'https://a.example, https://b.example:8443',
      FIXTURES: 'true',
      FLUX_API_URLS: 'https://one.test/, https://two.test',
      WEB_DIST: '/app/web',
      NETWORK_REFRESH_MS: '30000',
    });
    assert.equal(c.port, 8080);
    assert.equal(c.logLevel, 'debug');
    assert.equal(c.trustProxyHops, 2);
    assert.deepEqual(c.corsOrigins, ['https://a.example', 'https://b.example:8443']);
    assert.equal(c.fixtures, true);
    assert.deepEqual(c.upstream.fluxApi, ['https://one.test', 'https://two.test']);
    assert.equal(c.webDist, '/app/web');
    assert.equal(c.intervals.networkMs, 30_000);
    assert.equal(loadConfig({ CORS_ORIGINS: '*' }).corsOrigins, '*');
    assert.equal(loadConfig({ TRUST_PROXY: 'true' }).trustProxyHops, 1);
  });

  it('allow-lists exactly the configured upstream origins, with stable labels', () => {
    const o = upstreamOrigins(loadConfig({}));
    assert.deepEqual(o, {
      'https://api.runonflux.io': 'flux-api',
      'https://stats.runonflux.io': 'stats',
      'https://viprates.runonflux.io': 'market',
      'https://api.coingecko.com': 'coingecko',
    });
  });

  it('reports every problem at once', () => {
    assert.throws(
      () =>
        loadConfig({
          PORT: 'abc',
          LOG_LEVEL: 'loud',
          TRUST_PROXY: 'maybe',
          FIXTURES: 'perhaps',
          CORS_ORIGINS: 'https://ok.example, not a url, https://x.example/path',
          FLUX_STATS_URL: 'ftp://nope',
          BODY_LIMIT_BYTES: '10',
        }),
      (err: unknown) => {
        assert.ok(err instanceof ConfigError);
        const text = err.problems.join('\n');
        for (const key of [
          'PORT',
          'LOG_LEVEL',
          'TRUST_PROXY',
          'FIXTURES',
          'CORS_ORIGINS',
          'FLUX_STATS_URL',
          'BODY_LIMIT_BYTES',
        ]) {
          assert.ok(text.includes(key), `${key} not reported`);
        }
        return true;
      },
    );
  });
});

describe('logging', () => {
  it('emits one compact JSON object per line and respects the level', () => {
    const lines: string[] = [];
    const log = createLogger('warn', (l) => lines.push(l), { app: 'x' });
    log.info('hidden');
    log.warn('shown', { n: 1 });
    log.child({ svc: 's' }).error('boom', { err: 'e' });
    assert.equal(lines.length, 2);
    const a = JSON.parse(lines[0] as string);
    assert.equal(a.msg, 'shown');
    assert.equal(a.level, 'warn');
    assert.equal(a.app, 'x');
    assert.equal(a.n, 1);
    assert.match(a.t, /^\d{4}-\d\d-\d\dT/);
    const b = JSON.parse(lines[1] as string);
    assert.equal(b.svc, 's');
    assert.ok(!lines[0]?.includes('\n'));
  });
});

describe('TokenBuckets and RateLimiter', () => {
  it('allows the burst, then refills over time', () => {
    const clock = new ManualClock(0);
    const rl = new TokenBuckets({ burst: 3, refillPerSec: 1, clock });
    assert.deepEqual(
      [rl.take('a').ok, rl.take('a').ok, rl.take('a').ok, rl.take('a').ok],
      [true, true, true, false],
    );
    const denied = rl.take('a');
    assert.equal(denied.ok, false);
    assert.equal(denied.retryAfterSec, 1);
    clock.advance(1_000);
    assert.equal(rl.take('a').ok, true);
    assert.equal(rl.take('a').ok, false);
    clock.advance(60_000);
    assert.deepEqual(
      [rl.take('a').ok, rl.take('a').ok, rl.take('a').ok, rl.take('a').ok],
      [true, true, true, false],
      'capped at burst',
    );
  });

  it('keeps clients independent and bounds memory', () => {
    const clock = new ManualClock(0);
    const rl = new TokenBuckets({ burst: 1, refillPerSec: 1, maxKeys: 100, clock });
    assert.equal(rl.take('a').ok, true);
    assert.equal(rl.take('a').ok, false);
    assert.equal(rl.take('b').ok, true, 'another IP is unaffected');
    for (let i = 0; i < 1000; i++) rl.take(`ip${i}`);
    assert.ok(rl.size <= 100);
    clock.advance(10_000);
    rl.sweep();
    assert.equal(rl.size, 0, 'idle buckets are dropped');
  });

  it('charges extra cost and keeps classes separate; exempt is never limited', () => {
    const clock = new ManualClock(0);
    const rl = new RateLimiter({
      clock,
      classes: {
        read: { burst: 10, refillPerSec: 1 },
        write: { burst: 2, refillPerSec: 1 },
        stream: { burst: 1, refillPerSec: 1 },
        static: { burst: 20, refillPerSec: 1 },
        exempt: { burst: 1, refillPerSec: 1 },
      },
    });
    assert.equal(rl.take('write', 'a', 2).ok, true);
    assert.equal(rl.take('write', 'a').ok, false);
    assert.equal(rl.take('read', 'a').ok, true, 'a spent write bucket does not limit reads');
    for (let i = 0; i < 50; i++) assert.equal(rl.take('exempt', 'a').ok, true);
  });
});
