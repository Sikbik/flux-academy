// Adapted from fluxcommunity/server/test/static.test.ts, plus head injection and 404 shell cases
import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import { SITE } from '../../shared/site.ts';
import { cacheControlFor, mimeFor, parseRange, resolveSafe } from '../src/http/static.ts';
import { makeWebDist, request, startFixtureServer, type TestServer } from './helpers.ts';

const big = `${'body { color: #222; margin: 0 } '.repeat(200)}`;
const media = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251));

describe('resolveSafe', () => {
  const root = '/srv/web';
  it('maps normal paths under the root', () => {
    assert.deepEqual(resolveSafe(root, '/assets/app.js'), {
      kind: 'ok',
      path: '/srv/web/assets/app.js',
      segments: ['assets', 'app.js'],
    });
  });
  it('refuses traversal, dotfiles, NUL and backslashes', () => {
    for (const p of [
      '/../etc/passwd',
      '/assets/../../etc/passwd',
      '/%2e%2e/%2e%2e/etc/passwd',
      '/.env',
      '/assets/.git/config',
      '/a/./b',
      '/.well-known/x',
    ]) {
      assert.notEqual(resolveSafe(root, p).kind, 'ok', p);
    }
    assert.equal(resolveSafe(root, '/%00').kind, 'bad-request');
    assert.equal(resolveSafe(root, '/%E0%A4%A').kind, 'bad-request');
    assert.equal(resolveSafe(root, '/a%5Cb').kind, 'not-found');
  });
});

describe('static helpers', () => {
  it('knows MIME types', () => {
    assert.equal(mimeFor('.js'), 'text/javascript; charset=utf-8');
    assert.equal(mimeFor('.css'), 'text/css; charset=utf-8');
    assert.equal(mimeFor('.webp'), 'image/webp');
    assert.equal(mimeFor('.woff2'), 'font/woff2');
    assert.equal(mimeFor('.svg'), 'image/svg+xml');
    assert.equal(mimeFor('.zzz'), 'application/octet-stream');
  });
  it('picks cache policy by location and type', () => {
    assert.equal(cacheControlFor(['assets', 'index-abc.js'], '.js'), 'public, max-age=31536000, immutable');
    assert.equal(cacheControlFor(['index.html'], '.html'), 'no-cache');
    assert.match(cacheControlFor(['art', 'hero.webp'], '.webp'), /^public, max-age=3600/);
  });
  it('parses byte ranges', () => {
    assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
    assert.deepEqual(parseRange('bytes=900-', 1000), { start: 900, end: 999 });
    assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
    assert.deepEqual(parseRange('bytes=0-5000', 1000), { start: 0, end: 999 });
    assert.equal(parseRange('bytes=2000-3000', 1000), null);
    assert.equal(parseRange('bytes=9-1', 1000), null);
    assert.equal(parseRange('bytes=0-1,5-9', 1000), 'ignore');
    assert.equal(parseRange('items=0-1', 1000), 'ignore');
  });
});

describe('static server', () => {
  let s: TestServer;
  let dir: string;
  before(async () => {
    dir = await makeWebDist({
      'index.html':
        '<!doctype html><html><head><meta charset="utf-8"><title>Template</title></head><body><div id=root></div></body></html>',
      'assets/app-1a2b3c.js': 'console.log("hi");\n'.repeat(200),
      'assets/style-9f.css': big,
      'brand/logo.svg': `<svg xmlns="http://www.w3.org/2000/svg">${'<g/>'.repeat(400)}</svg>`,
      'previews/clip.mp4': media,
      'precomp.js': 'ORIGINAL'.repeat(300),
      'precomp.js.br': brotliCompressSync(Buffer.from('PRECOMPRESSED')),
      'robots.txt': 'User-agent: *\n',
      '.secret': 'nope',
    });
    await mkdir(join(dir, 'assets'), { recursive: true });
    await writeFile(join(dir, '..', 'outside-secret.txt'), 'outside');
    await symlink(join(dir, '..', 'outside-secret.txt'), join(dir, 'leak.txt')).catch(() => {});
    s = await startFixtureServer({ WEB_DIST: dir });
  });
  after(async () => {
    await s.stop();
  });

  it('serves index.html with no-cache and the right type', async () => {
    const r = await request(s.port, '/');
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(r.headers['cache-control'], 'no-cache');
    assert.match(r.text, /<div id=root>/);
    assert.match(r.text, new RegExp(`<title>${SITE.name}: ${SITE.tagline.replace('.', '\\.')}</title>`));
  });

  it('rewrites the head per known route and keeps the shell', async () => {
    const r = await request(s.port, '/learn', { headers: { 'accept-encoding': 'identity' } });
    assert.equal(r.status, 200);
    assert.match(r.text, /<title>The course map \| Flux Academy<\/title>/);
    assert.match(r.text, new RegExp(`<link rel="canonical" href="${SITE.origin}/learn">`));
    assert.match(
      r.text,
      /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"Course"/,
    );
    assert.equal(r.headers['cache-control'], 'no-cache');
    const slash = await request(s.port, '/learn/', { headers: { 'accept-encoding': 'identity' } });
    assert.equal(slash.status, 200);
    assert.equal(slash.text, r.text, 'a trailing slash and a query string do not change the page');
    const q = await request(s.port, '/learn?step=intro', { headers: { 'accept-encoding': 'identity' } });
    assert.equal(q.text, r.text);
    const idx = await request(s.port, '/index.html', { headers: { 'accept-encoding': 'identity' } });
    assert.equal(idx.status, 200);
    assert.match(
      idx.text,
      /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"WebSite"/,
    );
  });

  it('answers unknown routes 404 with a noindex head and never reflects the path', async () => {
    const probe = '/learn/%3Cscript%3Ealert(1)%3C%2Fscript%3E';
    const r = await request(s.port, probe, {
      headers: { accept: 'text/html', 'accept-encoding': 'identity' },
    });
    assert.equal(r.status, 404);
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.match(r.text, /<title>Page not found \| Flux Academy<\/title>/);
    assert.match(r.text, /<meta name="robots" content="noindex">/);
    assert.ok(!r.text.includes('<link rel="canonical"'));
    assert.ok(!r.text.includes('alert(1)') && !r.text.includes('script%3E'));
    assert.equal(r.headers.etag, undefined);
  });

  it('gives HTML an ETag per route, answers 304, and compresses it', async () => {
    const a = await request(s.port, '/labs', { headers: { 'accept-encoding': 'identity' } });
    const b = await request(s.port, '/glossary', { headers: { 'accept-encoding': 'identity' } });
    assert.ok(a.headers.etag && b.headers.etag && a.headers.etag !== b.headers.etag);
    const again = await request(s.port, '/labs', {
      headers: { 'if-none-match': String(a.headers.etag), 'accept-encoding': 'identity' },
    });
    assert.equal(again.status, 304);
    assert.equal(again.body.length, 0);
    assert.equal(again.headers['cache-control'], 'no-cache');
    const br = await request(s.port, '/labs', { headers: { 'accept-encoding': 'br' } });
    assert.equal(br.headers['content-encoding'], 'br');
    assert.equal(brotliDecompressSync(br.body).toString(), a.text);
  });

  it('serves hashed assets as immutable with correct MIME', async () => {
    const js = await request(s.port, '/assets/app-1a2b3c.js', { headers: { 'accept-encoding': 'identity' } });
    assert.equal(js.status, 200);
    assert.equal(js.headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(js.headers['cache-control'], 'public, max-age=31536000, immutable');
    const css = await request(s.port, '/assets/style-9f.css', { headers: { 'accept-encoding': 'identity' } });
    assert.equal(css.headers['content-type'], 'text/css; charset=utf-8');
  });

  it('falls back to index.html for extensionless routes only', async () => {
    const spa = await request(s.port, '/learn/first-deploy', { headers: { accept: 'text/html' } });
    assert.equal(spa.status, 200);
    assert.match(spa.text, /<title>Deploy your first app \| Flux Academy<\/title>/);
    const unknown = await request(s.port, '/builds/atlas', { headers: { accept: 'text/html' } });
    assert.equal(unknown.status, 404, 'unknown routes are a real 404 ...');
    assert.match(unknown.text, /<div id=root>/, '... that still carries the app shell');
    const asset = await request(s.port, '/assets/missing-abc.js');
    assert.equal(asset.status, 404);
    assert.ok(!asset.text.includes('<div id=root>'));
    const json = await request(s.port, '/learn/first-deploy', { headers: { accept: 'application/json' } });
    assert.equal(json.status, 404);
  });

  it('refuses traversal and dotfiles', async () => {
    for (const p of [
      '/../outside-secret.txt',
      '/%2e%2e/outside-secret.txt',
      '/assets/..%2f..%2foutside-secret.txt',
      '/.secret',
      '/%2esecret',
    ]) {
      const r = await request(s.port, p);
      assert.ok([400, 404].includes(r.status), `${p} -> ${r.status}`);
      assert.ok(!r.text.includes('outside') && !r.text.includes('nope'), p);
    }
  });

  it('does not follow a symlink out of the web root', async () => {
    const r = await request(s.port, '/leak.txt');
    assert.equal(r.status, 404);
    assert.ok(!r.text.includes('outside'));
  });

  it('compresses text on the fly (br preferred) and tags Vary', async () => {
    const r = await request(s.port, '/assets/style-9f.css', { headers: { 'accept-encoding': 'br, gzip' } });
    assert.equal(r.headers['content-encoding'], 'br');
    assert.match(String(r.headers.vary), /Accept-Encoding/);
    assert.equal(brotliDecompressSync(r.body).toString(), big);
    assert.equal(Number(r.headers['content-length']), r.body.length);
    const again = await request(s.port, '/assets/style-9f.css', { headers: { 'accept-encoding': 'br' } });
    assert.deepEqual(again.body, r.body, 'served from the compression cache');
  });

  it('prefers a precompressed sibling', async () => {
    const r = await request(s.port, '/precomp.js', { headers: { 'accept-encoding': 'br' } });
    assert.equal(r.headers['content-encoding'], 'br');
    assert.equal(brotliDecompressSync(r.body).toString(), 'PRECOMPRESSED');
  });

  it('does not compress binary media', async () => {
    const r = await request(s.port, '/previews/clip.mp4', { headers: { 'accept-encoding': 'br, gzip' } });
    assert.equal(r.headers['content-encoding'], undefined);
    assert.equal(r.headers['content-type'], 'video/mp4');
    assert.deepEqual(r.body, media);
  });

  it('supports Range for media (206, Content-Range, 416)', async () => {
    const r = await request(s.port, '/previews/clip.mp4', { headers: { range: 'bytes=10-19' } });
    assert.equal(r.status, 206);
    assert.equal(r.headers['content-range'], 'bytes 10-19/1000');
    assert.equal(r.headers['accept-ranges'], 'bytes');
    assert.deepEqual(r.body, media.subarray(10, 20));
    const tail = await request(s.port, '/previews/clip.mp4', { headers: { range: 'bytes=-5' } });
    assert.deepEqual(tail.body, media.subarray(995));
    const bad = await request(s.port, '/previews/clip.mp4', { headers: { range: 'bytes=5000-6000' } });
    assert.equal(bad.status, 416);
    assert.equal(bad.headers['content-range'], 'bytes */1000');
  });

  it('answers conditional requests with 304', async () => {
    const first = await request(s.port, '/assets/style-9f.css', {
      headers: { 'accept-encoding': 'identity' },
    });
    const etag = String(first.headers.etag);
    const second = await request(s.port, '/assets/style-9f.css', {
      headers: { 'if-none-match': etag, 'accept-encoding': 'identity' },
    });
    assert.equal(second.status, 304);
    assert.equal(second.body.length, 0);
    const third = await request(s.port, '/assets/style-9f.css', {
      headers: { 'if-modified-since': String(first.headers['last-modified']) },
    });
    assert.equal(third.status, 304);
  });

  it('serves HEAD without a body', async () => {
    const r = await request(s.port, '/assets/style-9f.css', {
      method: 'HEAD',
      headers: { 'accept-encoding': 'identity' },
    });
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 0);
    assert.equal(Number(r.headers['content-length']), big.length);
  });
});

describe('API-only mode', () => {
  it('runs without a dist folder: API works, pages explain, assets 404', async () => {
    const s = await startFixtureServer({ WEB_DIST: '/definitely/not/here' });
    try {
      const api = await request(s.port, '/api/v1/blocks');
      assert.equal(api.status, 200);
      const root = await request(s.port, '/');
      assert.equal(root.status, 503);
      assert.match(root.text, /web bundle is not installed/);
      assert.equal((await request(s.port, '/assets/x.js')).status, 404);
      assert.equal((await request(s.port, '/healthz')).status, 200);
    } finally {
      await s.stop();
    }
  });
});
