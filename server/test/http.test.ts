// Adapted from fluxcommunity/server/test/http.test.ts
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { API_PATHS } from '../../shared/api.ts';
import { allRoutes, REDIRECTS, SITE } from '../../shared/site.ts';
import type { RouteModule } from '../src/core/context.ts';
import { computed, HttpError } from '../src/core/context.ts';
import { clientIp } from '../src/http/client-ip.ts';
import { negotiateEncoding } from '../src/http/compress.ts';
import { buildMeta, etagMatches } from '../src/http/respond.ts';
import { CSP, PERMISSIONS_POLICY } from '../src/http/security.ts';
import {
  collectFrames,
  makeWebDist,
  postJson,
  request,
  startFixtureServer,
  type TestServer,
} from './helpers.ts';

describe('API over HTTP (fixtures runtime)', () => {
  let s: TestServer;
  before(async () => {
    const dist = await makeWebDist({ 'index.html': '<!doctype html><title>x</title>' });
    s = await startFixtureServer({ WEB_DIST: dist });
  });
  after(async () => {
    await s.stop();
  });

  it('serves /healthz as plain ok without noise', async () => {
    const r = await request(s.port, '/healthz');
    assert.equal(r.status, 200);
    assert.equal(r.text, 'ok\n');
    assert.match(String(r.headers['content-type']), /^text\/plain/);
    assert.equal(r.headers['cache-control'], 'no-store');
  });

  it('puts the security headers on every kind of response', async () => {
    const paths = [
      '/healthz',
      API_PATHS.network,
      '/api/v1/nope',
      '/',
      '/missing.png',
      '/%00',
      '/api/v2/x',
      '/sitemap.xml',
    ];
    for (const p of paths) {
      const r = await request(s.port, p);
      assert.equal(r.headers['content-security-policy'], CSP, p);
      assert.equal(r.headers['x-content-type-options'], 'nosniff', p);
      assert.equal(r.headers['referrer-policy'], 'strict-origin-when-cross-origin', p);
      assert.equal(r.headers['cross-origin-opener-policy'], 'same-origin', p);
      assert.equal(r.headers['x-frame-options'], 'SAMEORIGIN', p);
      assert.equal(r.headers['permissions-policy'], PERMISSIONS_POLICY, p);
      assert.equal(r.headers['x-powered-by'], undefined, p);
    }
  });

  it('serves exactly the CSP from the architecture document', () => {
    assert.equal(
      CSP,
      "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; script-src 'self'; worker-src 'self' blob:; " +
        "frame-ancestors 'self'; base-uri 'none'; form-action 'none'; object-src 'none'",
    );
    assert.match(PERMISSIONS_POLICY, /camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  });

  it('answers envelopes with accurate meta and conditional caching headers', async () => {
    const r = await request(s.port, API_PATHS.network);
    assert.equal(r.status, 200);
    assert.match(String(r.headers['content-type']), /^application\/json/);
    assert.match(String(r.headers['cache-control']), /max-age=\d+, stale-while-revalidate=\d+/);
    assert.match(String(r.headers.vary), /Accept-Encoding/);
    assert.match(String(r.headers.etag), /^W\/"/);
    const body = r.json<{
      data: unknown;
      meta: { generatedAt: string; asOf: string; ageMs: number; source: string; stale: boolean };
    }>();
    assert.equal(body.meta.source, 'fallback', 'fixtures are always labelled fallback');
    assert.equal(Date.parse(body.meta.generatedAt) - Date.parse(body.meta.asOf), body.meta.ageMs);
  });

  it('returns 304 for a matching If-None-Match and a fresh 200 otherwise', async () => {
    const first = await request(s.port, API_PATHS.geo);
    const etag = String(first.headers.etag);
    const second = await request(s.port, API_PATHS.geo, { headers: { 'if-none-match': etag } });
    assert.equal(second.status, 304);
    assert.equal(second.body.length, 0);
    assert.equal(second.headers.etag, etag);
    const third = await request(s.port, API_PATHS.geo, { headers: { 'if-none-match': 'W/"other"' } });
    assert.equal(third.status, 200);
  });

  it('compresses JSON over 1 KB with br or gzip and leaves small bodies alone', async () => {
    const plain = await request(s.port, API_PATHS.geo, { headers: { 'accept-encoding': 'identity' } });
    assert.equal(plain.headers['content-encoding'], undefined);
    const br = await request(s.port, API_PATHS.geo, { headers: { 'accept-encoding': 'gzip, br' } });
    assert.equal(br.headers['content-encoding'], 'br');
    assert.ok(br.body.length < plain.body.length / 2);
    assert.equal(
      JSON.parse(brotliDecompressSync(br.body).toString()).data.total,
      plain.json<{ data: { total: number } }>().data.total,
    );
    const gz = await request(s.port, API_PATHS.geo, { headers: { 'accept-encoding': 'gzip' } });
    assert.equal(gz.headers['content-encoding'], 'gzip');
    assert.ok(JSON.parse(gunzipSync(gz.body).toString()).data.points.length > 0);
    // /info is tiny: never compressed
    const info = await request(s.port, API_PATHS.info, { headers: { 'accept-encoding': 'br' } });
    assert.equal(info.headers['content-encoding'], undefined);
    assert.equal(info.headers['cache-control'], 'no-store');
  });

  it('supports HEAD and OPTIONS and rejects other methods', async () => {
    const head = await request(s.port, API_PATHS.network, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    assert.ok(Number(head.headers['content-length']) > 0 || head.headers['content-length'] === undefined);
    const opt = await request(s.port, API_PATHS.network, { method: 'OPTIONS' });
    assert.equal(opt.status, 204);
    assert.equal(opt.headers['access-control-allow-origin'], undefined, 'no CORS by default');
    for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const r = await request(s.port, API_PATHS.network, { method: m });
      assert.equal(r.status, 405, m);
      assert.match(String(r.headers.allow), /^GET, HEAD, OPTIONS$|^GET, HEAD, POST, OPTIONS$/);
      assert.equal(r.json<{ error: { code: string } }>().error.code, 'method_not_allowed');
    }
    assert.equal(
      (await request(s.port, API_PATHS.network, { method: 'POST' })).headers.allow,
      'GET, HEAD, OPTIONS',
    );
  });

  it('never sets CORS headers by default', async () => {
    const r = await request(s.port, API_PATHS.network, { headers: { origin: 'https://evil.example' } });
    assert.equal(r.headers['access-control-allow-origin'], undefined);
  });

  it('returns a JSON error body for unknown API paths', async () => {
    const r = await request(s.port, '/api/v1/unknown');
    assert.equal(r.status, 404);
    assert.equal(r.json<{ error: { code: string } }>().error.code, 'not_found');
  });

  it('treats a double leading slash as a path, never as a host', async () => {
    const r = await request(s.port, '//learn', { headers: { accept: 'text/html' } });
    assert.equal(r.status, 404);
    const api = await request(s.port, '//api/v1/network');
    assert.equal(api.status, 404);
  });

  it('rejects over-long URLs', async () => {
    const r = await request(s.port, `/api/v1/network?${'a'.repeat(3000)}`);
    assert.equal(r.status, 414);
  });
});

describe('opt-in CORS', () => {
  let s: TestServer;
  before(async () => {
    s = await startFixtureServer({
      CORS_ORIGINS: 'https://friend.example, https://other.example',
      WEB_DIST: '/nonexistent',
    });
  });
  after(async () => {
    await s.stop();
  });

  it('echoes only allow-listed origins', async () => {
    const ok = await request(s.port, API_PATHS.network, { headers: { origin: 'https://friend.example' } });
    assert.equal(ok.headers['access-control-allow-origin'], 'https://friend.example');
    assert.match(String(ok.headers.vary), /Origin/);
    const no = await request(s.port, API_PATHS.network, { headers: { origin: 'https://evil.example' } });
    assert.equal(no.headers['access-control-allow-origin'], undefined);
    const pre = await request(s.port, API_PATHS.network, {
      method: 'OPTIONS',
      headers: { origin: 'https://friend.example' },
    });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers['access-control-allow-origin'], 'https://friend.example');
    assert.equal(pre.headers['access-control-allow-methods'], 'GET, HEAD, POST, OPTIONS');
  });
});

describe('rate limiting over HTTP', () => {
  it('answers 429 with Retry-After once the burst is spent, but never limits /healthz', async () => {
    const s = await startFixtureServer({
      RATE_LIMIT_BURST: '5',
      RATE_LIMIT_RPS: '1',
      WEB_DIST: '/nonexistent',
    });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 8; i++) codes.push((await request(s.port, API_PATHS.blocks)).status);
      assert.deepEqual(codes.slice(0, 5), [200, 200, 200, 200, 200]);
      assert.ok(
        codes.slice(5).every((c) => c === 429),
        codes.join(','),
      );
      const limited = await request(s.port, API_PATHS.blocks);
      assert.equal(limited.status, 429);
      assert.ok(Number(limited.headers['retry-after']) >= 1);
      assert.equal(limited.json<{ error: { code: string } }>().error.code, 'rate_limited');
      for (let i = 0; i < 10; i++) assert.equal((await request(s.port, '/healthz')).status, 200);
    } finally {
      await s.stop();
    }
  });

  it('keeps the files a page is built from out of the page bucket, and still limits them', async () => {
    const s = await startFixtureServer({
      RATE_LIMIT_BURST: '3',
      RATE_LIMIT_RPS: '1',
      RATE_LIMIT_STATIC_BURST: '10',
      RATE_LIMIT_STATIC_RPS: '1',
      WEB_DIST: '/nonexistent',
    });
    try {
      // Pages spend the page bucket and run out after its burst.
      const pages: number[] = [];
      for (let i = 0; i < 6; i++) pages.push((await request(s.port, '/learn')).status);
      assert.ok(
        pages.slice(3).every((c) => c === 429),
        pages.join(','),
      );
      // With that bucket empty, the files of a page still load, up to their own, larger burst.
      const files: number[] = [];
      const paths = ['/assets/a.js', '/assets/b.css', '/art/c.avif', '/brand/d.svg'];
      for (let i = 0; i < 12; i++)
        files.push((await request(s.port, paths[i % paths.length] as string)).status);
      assert.ok(
        files.slice(0, 10).every((c) => c !== 429),
        files.join(','),
      );
      assert.ok(
        files.slice(10).every((c) => c === 429),
        files.join(','),
      );
    } finally {
      await s.stop();
    }
  });

  it('gives POST routes their own, smaller bucket', async () => {
    const echo: RouteModule = () => [
      {
        method: 'POST',
        path: '/api/v1/test/echo',
        handler: ({ body }) => computed({ body }, 0),
      },
    ];
    const s = await startFixtureServer(
      { RATE_LIMIT_WRITE_BURST: '3', RATE_LIMIT_WRITE_RPS: '1', WEB_DIST: '/nonexistent' },
      { extraRoutes: [echo] },
    );
    try {
      const codes: number[] = [];
      for (let i = 0; i < 5; i++) codes.push((await postJson(s.port, '/api/v1/test/echo', { i })).status);
      assert.deepEqual(codes, [200, 200, 200, 429, 429]);
      assert.equal((await request(s.port, API_PATHS.blocks)).status, 200, 'reads are a different bucket');
    } finally {
      await s.stop();
    }
  });
});

describe('request bodies on POST routes', () => {
  let s: TestServer;
  before(async () => {
    const mod: RouteModule = () => [
      { method: 'POST', path: '/api/v1/test/echo', handler: ({ body }) => computed({ body }, 0) },
      {
        method: 'POST',
        path: '/api/v1/test/small',
        maxBodyBytes: 20,
        handler: ({ body }) => computed({ body }, 0),
      },
      {
        method: 'POST',
        path: '/api/v1/test/boom',
        handler: () => {
          throw new Error('secret internal detail');
        },
      },
      {
        method: 'POST',
        path: '/api/v1/test/teapot',
        handler: () => {
          throw new HttpError(418, 'teapot', 'short and stout');
        },
      },
    ];
    s = await startFixtureServer({ WEB_DIST: '/nonexistent' }, { extraRoutes: [mod] });
  });
  after(async () => {
    await s.stop();
  });

  it('parses a JSON body and wraps the result in an envelope', async () => {
    const r = await postJson(s.port, '/api/v1/test/echo', { spec: { name: 'x' } });
    assert.equal(r.status, 200);
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.deepEqual(r.json<{ data: unknown }>().data, { body: { spec: { name: 'x' } } });
    assert.equal(r.headers.etag !== undefined, true);
    const withCharset = await request(s.port, '/api/v1/test/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: '{"a":1}',
    });
    assert.equal(withCharset.status, 200);
  });

  it('rejects the wrong content type, an empty body and malformed JSON', async () => {
    const text = await request(s.port, '/api/v1/test/echo', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: '{}',
    });
    assert.equal(text.status, 415);
    assert.equal(text.json<{ error: { code: string } }>().error.code, 'unsupported_media_type');
    const none = await request(s.port, '/api/v1/test/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(none.status, 400);
    const bad = await request(s.port, '/api/v1/test/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":',
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.json<{ error: { code: string } }>().error.code, 'bad_json');
  });

  it('caps the body at 64 KiB server-wide and at a route-specific lower cap', async () => {
    const big = await request(s.port, '/api/v1/test/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pad: 'x'.repeat(70_000) }),
    });
    assert.equal(big.status, 413);
    assert.equal(big.json<{ error: { code: string } }>().error.code, 'payload_too_large');
    const ok = await postJson(s.port, '/api/v1/test/echo', { pad: 'x'.repeat(60_000) });
    assert.equal(ok.status, 200);
    assert.equal((await postJson(s.port, '/api/v1/test/small', { a: 1 })).status, 200);
    assert.equal((await postJson(s.port, '/api/v1/test/small', { pad: 'x'.repeat(100) })).status, 413);
  });

  it('answers 405 for GET on a POST-only route and hides internal errors', async () => {
    const g = await request(s.port, '/api/v1/test/echo');
    assert.equal(g.status, 405);
    assert.equal(g.headers.allow, 'POST, OPTIONS');
    const boom = await postJson(s.port, '/api/v1/test/boom', {});
    assert.equal(boom.status, 500);
    assert.ok(!boom.text.includes('secret internal detail'));
    const tea = await postJson(s.port, '/api/v1/test/teapot', {});
    assert.equal(tea.status, 418);
    assert.equal(tea.json<{ error: { code: string; message: string } }>().error.message, 'short and stout');
  });
});

describe('redirects, sitemap and robots', () => {
  let s: TestServer;
  before(async () => {
    const dist = await makeWebDist({
      'index.html': '<!doctype html><html><head></head><body></body></html>',
    });
    s = await startFixtureServer({ WEB_DIST: dist });
  });
  after(async () => {
    await s.stop();
  });

  it('answers every old URL with a 301 to its new home, keeping the query string', async () => {
    for (const [from, to] of Object.entries(REDIRECTS)) {
      const r = await request(s.port, from);
      assert.equal(r.status, 301, from);
      assert.equal(r.headers.location, to, from);
      const q = await request(s.port, `${from}?utm_source=x&step=2`);
      assert.equal(q.headers.location, `${to}?utm_source=x&step=2`, from);
      const slash = await request(s.port, `${from}/`);
      assert.equal(slash.status, 301, `${from}/`);
    }
  });

  it('only ever redirects to a path on this site', async () => {
    for (const to of Object.values(REDIRECTS)) {
      assert.match(to, /^\/[^/]/);
      assert.notEqual(
        allRoutes().find((r) => r.path === to),
        undefined,
        `${to} is a real route`,
      );
    }
    const sneaky = await request(s.port, '/tutorials?next=//evil.example');
    assert.equal(sneaky.headers.location, '/learn?next=//evil.example');
  });

  it('generates /sitemap.xml from the route table', async () => {
    const r = await request(s.port, '/sitemap.xml');
    assert.equal(r.status, 200);
    assert.match(String(r.headers['content-type']), /^application\/xml/);
    const locs = [...r.text.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    assert.deepEqual(
      locs,
      allRoutes().map((x) => `${SITE.origin}${x.path}`),
    );
    assert.match(r.text, /<priority>1\.0<\/priority>/);
    assert.ok(!r.text.includes('/api/'));
  });

  it('generates /robots.txt pointing at the sitemap and hiding the API', async () => {
    const r = await request(s.port, '/robots.txt');
    assert.equal(r.status, 200);
    assert.match(String(r.headers['content-type']), /^text\/plain/);
    assert.match(r.text, /^User-agent: \*$/m);
    assert.match(r.text, /^Disallow: \/api\/$/m);
    assert.match(r.text, new RegExp(`^Sitemap: ${SITE.origin}/sitemap\\.xml$`, 'm'));
  });
});

describe('proxy handling', () => {
  it('adds HSTS only behind a trusted TLS-terminating proxy', async () => {
    const plain = await startFixtureServer({ WEB_DIST: '/nonexistent' });
    const proxied = await startFixtureServer({ WEB_DIST: '/nonexistent', TRUST_PROXY: '1' });
    try {
      const h = { 'x-forwarded-proto': 'https' };
      assert.equal(
        (await request(plain.port, '/healthz', { headers: h })).headers['strict-transport-security'],
        undefined,
      );
      assert.equal((await request(proxied.port, '/healthz')).headers['strict-transport-security'], undefined);
      const r = await request(proxied.port, '/healthz', { headers: h });
      assert.match(String(r.headers['strict-transport-security']), /^max-age=\d+$/);
    } finally {
      await plain.stop();
      await proxied.stop();
    }
  });

  it('rate limits the forwarded client, not the proxy', async () => {
    const s = await startFixtureServer({
      WEB_DIST: '/nonexistent',
      TRUST_PROXY: '1',
      RATE_LIMIT_BURST: '2',
      RATE_LIMIT_RPS: '1',
    });
    try {
      const as = (ip: string) => request(s.port, API_PATHS.blocks, { headers: { 'x-forwarded-for': ip } });
      assert.equal((await as('9.9.9.1')).status, 200);
      assert.equal((await as('9.9.9.1')).status, 200);
      assert.equal((await as('9.9.9.1')).status, 429);
      assert.equal((await as('9.9.9.2')).status, 200, 'another client behind the same proxy');
    } finally {
      await s.stop();
    }
  });
});

describe('SSE over HTTP', () => {
  it('streams hello first with headers and the fixtures hello payload', async () => {
    const s = await startFixtureServer({ WEB_DIST: '/nonexistent' });
    try {
      const res = await fetch(`http://127.0.0.1:${s.port}${API_PATHS.stream}`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') ?? '', /^text\/event-stream/);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(res.headers.get('x-accel-buffering'), 'no');
      await res.body?.cancel();
      const frames = await collectFrames(s.port, (f) => f.some((x) => x.event === 'hello'));
      const hello = JSON.parse(frames[0]?.data ?? 'null') as {
        serverTime: string;
        network: { chain: { height: number } };
        networkMeta: { source: string };
      };
      assert.equal(frames[0]?.event, 'hello');
      assert.ok(hello.network.chain.height > 3_000_000);
      assert.equal(hello.networkMeta.source, 'fallback', 'fixtures never claim live');
      assert.ok(Math.abs(Date.parse(hello.serverTime) - Date.now()) < 5_000);
    } finally {
      await s.stop();
    }
  });

  it('sends block and network events, then heartbeats while idle', async () => {
    const s = await startFixtureServer({ WEB_DIST: '/nonexistent', SSE_HEARTBEAT_MS: '1000' }, 150);
    try {
      const frames = await collectFrames(
        s.port,
        (f) =>
          f.some((x) => x.event === 'block') &&
          f.some((x) => x.event === 'network') &&
          f.some((x) => x.event === 'ping'),
        6_000,
      );
      const events = frames.map((f) => f.event);
      assert.equal(events[0], 'hello');
      for (const e of ['block', 'network', 'ping']) assert.ok(events.includes(e), e);
      const heights = frames
        .filter((f) => f.event === 'block')
        .map((f) => (JSON.parse(f.data) as { height: number }).height);
      assert.ok(
        heights.every((h, i) => i === 0 || h === (heights[i - 1] as number) + 1),
        'consecutive heights',
      );
    } finally {
      await s.stop();
    }
  });

  it('enforces the per-IP stream cap with a 429', async () => {
    const s = await startFixtureServer({ SSE_MAX_PER_IP: '1', WEB_DIST: '/nonexistent' });
    try {
      const a = await fetch(`http://127.0.0.1:${s.port}${API_PATHS.stream}`);
      assert.equal(a.status, 200);
      const b = await fetch(`http://127.0.0.1:${s.port}${API_PATHS.stream}`);
      assert.equal(b.status, 429);
      assert.equal(b.headers.get('retry-after'), '30');
      await a.body?.cancel();
      await b.body?.cancel();
    } finally {
      await s.stop();
    }
  });

  it('shutdown ends open streams promptly', async () => {
    const s = await startFixtureServer({ WEB_DIST: '/nonexistent' });
    const res = await fetch(`http://127.0.0.1:${s.port}${API_PATHS.stream}`);
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    await reader.read();
    const t = Date.now();
    await s.stop();
    assert.ok(Date.now() - t < 3_000, 'stop() does not wait for streams to time out');
    const end = await reader.read().catch(() => ({ done: true }));
    assert.equal(end.done, true);
  });
});

describe('helpers', () => {
  it('weak-compares ETags', () => {
    assert.equal(etagMatches('W/"a"', 'W/"a"'), true);
    assert.equal(etagMatches('"a"', 'W/"a"'), true);
    assert.equal(etagMatches('W/"b", W/"a"', 'W/"a"'), true);
    assert.equal(etagMatches('*', 'W/"a"'), true);
    assert.equal(etagMatches('W/"b"', 'W/"a"'), false);
    assert.equal(etagMatches(undefined, 'W/"a"'), false);
  });

  it('negotiates encodings with q-values', () => {
    assert.equal(negotiateEncoding('gzip, deflate, br'), 'br');
    assert.equal(negotiateEncoding('gzip'), 'gzip');
    assert.equal(negotiateEncoding('br;q=0, gzip'), 'gzip');
    assert.equal(negotiateEncoding('identity'), null);
    assert.equal(negotiateEncoding(undefined), null);
    assert.equal(negotiateEncoding('*'), 'br');
  });

  it('builds accurate meta from a quantised clock', () => {
    const m = buildMeta({ asOfMs: 10_000, source: 'cache', windowMs: 5_000, nowMs: 20_999 });
    assert.equal(m.generatedAt, new Date(20_000).toISOString());
    assert.equal(m.ageMs, 10_000);
    assert.equal(m.stale, true);
    const fresh = buildMeta({ asOfMs: 19_500, source: 'live', windowMs: 5_000, nowMs: 20_000 });
    assert.equal(fresh.ageMs, 500);
    assert.equal(fresh.stale, false);
  });

  it('honours X-Forwarded-For only for the configured number of trusted hops', () => {
    const req = (xff: string | undefined, remote = '10.0.0.9') =>
      ({ headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress: remote } }) as never;
    assert.equal(clientIp(req('1.2.3.4'), 0), '10.0.0.9', 'ignored without TRUST_PROXY');
    assert.equal(clientIp(req('6.6.6.6, 1.2.3.4'), 1), '1.2.3.4', 'rightmost entry is the trusted proxy hop');
    assert.equal(clientIp(req('1.2.3.4, 7.7.7.7'), 2), '1.2.3.4');
    assert.equal(clientIp(req('not-an-ip'), 1), '10.0.0.9');
    assert.equal(clientIp(req(undefined), 1), '10.0.0.9');
    assert.equal(clientIp(req(undefined, '::ffff:192.0.2.1'), 0), '192.0.2.1');
  });
});
