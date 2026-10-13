import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { computed, type RouteModule } from '../src/core/context.ts';
import { listRouteFiles } from '../src/server.ts';
import { makeTempDir, postJson, request, startFixtureServer, type TestServer } from './helpers.ts';

const API_ROUTES = [
  '/api/v1/network',
  '/api/v1/geo',
  '/api/v1/blocks',
  '/api/v1/stream',
  '/api/v1/info',
  '/healthz',
];

describe('route discovery', () => {
  it('loads every module in server/src/routes with no errors and serves the core endpoints', async () => {
    const s = await startFixtureServer({ WEB_DIST: '/nonexistent' });
    try {
      assert.deepEqual(s.routeErrors, []);
      assert.ok(s.routeCount >= API_ROUTES.length);
      for (const p of API_ROUTES.filter((x) => x !== '/api/v1/stream')) {
        assert.equal((await request(s.port, p)).status, 200, p);
      }
    } finally {
      await s.stop();
    }
  });

  it('lists only route modules: skips tests, underscore files and non-TypeScript', async () => {
    const dir = await makeTempDir('routes-');
    for (const f of ['b.ts', 'a.ts', 'a.test.ts', '_shared.ts', 'README.md', 'notes.txt', 'types.d.ts']) {
      await writeFile(join(dir, f), '');
    }
    await mkdir(join(dir, 'sub'));
    assert.deepEqual(
      (await listRouteFiles(dir)).map((p) => p.slice(dir.length + 1)),
      ['a.ts', 'b.ts'],
    );
    assert.deepEqual(await listRouteFiles(join(dir, 'missing')), []);
  });
});

describe('the extension point', () => {
  let s: TestServer;
  let dir: string;
  before(async () => {
    dir = await makeTempDir('routes-');
    // A module written exactly as the README shows, found by listing the directory.
    await writeFile(
      join(dir, 'dummy.ts'),
      `import { computed, HttpError } from ${JSON.stringify(new URL('../src/core/context.ts', import.meta.url).href)};
export default (ctx) => [
  {
    method: 'GET',
    path: '/api/v1/dummy/:name',
    handler: ({ params, query }) => {
      if (!/^[a-z]{1,8}$/.test(params.name ?? '')) throw new HttpError(400, 'bad_name', 'Invalid name');
      return computed({ name: params.name, q: query.get('q'), price: ctx.market.fluxUsd().value, fixtures: ctx.fixtures }, ctx.clock.now());
    },
  },
  {
    method: 'POST',
    path: '/api/v1/dummy',
    handler: ({ body }) => computed({ got: body }, ctx.clock.now()),
  },
  {
    method: 'GET',
    path: '/api/v1/dummy/exact',
    handler: () => computed({ exact: true }, ctx.clock.now()),
  },
];
`,
    );
    await writeFile(join(dir, 'broken.ts'), 'export default 42;\n');
    await writeFile(join(dir, 'throws.ts'), "throw new Error('syntax-ish failure at import');\n");
    const dup: RouteModule = () => [
      { method: 'GET', path: '/api/v1/dummy/exact', handler: () => computed({ dup: true }, 0) },
    ];
    s = await startFixtureServer({ WEB_DIST: '/nonexistent' }, { routesDir: dir, extraRoutes: [dup] });
  });
  after(async () => {
    await s.stop();
  });

  it('registers a dropped-in module with params, query, POST and context access', async () => {
    const r = await request(s.port, '/api/v1/dummy/abc?q=hello');
    assert.equal(r.status, 200);
    const body = r.json<{ data: Record<string, unknown>; meta: { source: string } }>();
    assert.deepEqual(body.data, { name: 'abc', q: 'hello', price: 0.085, fixtures: true });
    assert.equal(body.meta.source, 'live');
    const p = await postJson(s.port, '/api/v1/dummy', { a: [1, 2] });
    assert.deepEqual(p.json<{ data: unknown }>().data, { got: { a: [1, 2] } });
  });

  it('validates params through HttpError and prefers exact paths over parameterised ones', async () => {
    const bad = await request(s.port, '/api/v1/dummy/NOPE');
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.json(), { error: { code: 'bad_name', message: 'Invalid name' } });
    const exact = await request(s.port, '/api/v1/dummy/exact');
    assert.deepEqual(exact.json<{ data: unknown }>().data, { exact: true });
  });

  it('reports a module that fails to load or collides, and keeps serving the rest', () => {
    assert.equal(s.routeErrors.length, 3, s.routeErrors.join('\n'));
    assert.ok(s.routeErrors.some((e) => e.includes('broken.ts') && /default export/.test(e)));
    assert.ok(s.routeErrors.some((e) => e.includes('throws.ts')));
    assert.ok(s.routeErrors.some((e) => e.includes('extraRoutes[0]') && /duplicate route GET/.test(e)));
  });

  it('serves nothing from the directory of the real routes when a custom one is given', async () => {
    assert.equal((await request(s.port, '/api/v1/network')).status, 404);
    assert.equal((await request(s.port, '/healthz')).status, 404);
  });
});

describe('lifecycle hooks', () => {
  it('runs onStop hooks during shutdown, after the listener closes', async () => {
    const order: string[] = [];
    const mod: RouteModule = (ctx) => {
      ctx.onStop(() => {
        order.push('stop-hook');
      });
      return [{ method: 'GET', path: '/api/v1/hooked', handler: () => computed({ ok: true }, 0) }];
    };
    const s = await startFixtureServer({ WEB_DIST: '/nonexistent' }, { extraRoutes: [mod] });
    assert.equal((await request(s.port, '/api/v1/hooked')).status, 200);
    await s.stop();
    assert.deepEqual(order, ['stop-hook']);
  });
});
