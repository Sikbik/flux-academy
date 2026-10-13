import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type {
  Envelope,
  ExploreApp,
  ExploreSearch,
  PricingSnapshot,
  QuoteResponse,
} from '../../shared/api.ts';
import { BAKED_PRICING } from '../../shared/flux/pricing.ts';
import { defaultComponent, defaultSpec } from '../../shared/flux/spec.ts';
import type { LintReport } from '../../shared/flux/types.ts';
import { ManualClock } from '../src/core/clock.ts';
import { createLogger } from '../src/core/log.ts';
import type { FetchLike } from '../src/core/upstream.ts';
import { UpstreamError } from '../src/core/upstream.ts';
import { bareIp, ExploreService, isValidAppName } from '../src/services/explore.ts';
import { PricingService, parseParams } from '../src/services/pricing.ts';
import { postJson, request, startTestServer, type TestServer } from './helpers.ts';

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const PARAMS = {
  height: -1,
  cpu: 0.15,
  ram: 0.05,
  hdd: 0.02,
  minPrice: 0.01,
  port: 2,
  scope: 4,
  staticip: 2,
  fluxmultiplier: 0.95,
  multiplier: 1,
  minUSDPrice: 0.99,
};

const TIP = 3_031_500;

interface FakeOpts {
  down?: boolean;
  calculator?: (spec: Record<string, unknown>) => { usd: number; flux: number } | 'error' | 'hang';
  params?: Record<string, unknown>;
}

function fakeFlux(opts: FakeOpts = {}) {
  const calls: { host: string; path: string; method: string; body?: string; type?: string }[] = [];
  const fleet = Array.from({ length: 150 }, (_, i) => ({
    ip: `10.0.${Math.floor(i / 200)}.${i}:16127`,
    tier: ['CUMULUS', 'NIMBUS', 'STRATUS'][i % 3],
    geolocation: { lat: 48.123456, lon: 11.654321, country: 'Germany', countryCode: 'DE' },
  }));
  const names = Array.from({ length: 80 }, (_, i) => ({ name: `app${i}` })).concat([
    { name: 'helloworld' },
    { name: 'HelloFlux' },
    { name: 'zzz-hello' },
    { name: 'entapp' },
  ]);
  const locs = [
    ...Array.from({ length: 5 }, (_, i) => ({
      name: 'HelloFlux',
      ip: `10.0.0.${i}:16127`,
      broadcastedAt: '2026-10-12T10:00:00.000Z',
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      name: 'helloworld',
      ip: `10.0.0.${10 + i}:16137`,
      broadcastedAt: '2026-10-12T10:00:00.000Z',
    })),
    ...Array.from({ length: 80 }, (_, i) => ({ name: `app${i}`, ip: `10.0.0.${i}:16127` })),
  ];
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(String(input));
    const entry: (typeof calls)[number] = {
      host: url.host,
      path: url.pathname,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
      type: (init?.headers as Record<string, string> | undefined)?.['content-type'],
    };
    calls.push(entry);
    if (opts.down) throw new TypeError('fetch failed');
    const p = url.pathname;
    if (url.host === 'api.runonflux.io') {
      if (p === '/apps/getappspecsusdprice')
        return ok({ status: 'success', data: { ...PARAMS, ...opts.params } });
      if (p === '/apps/calculatefiatandfluxprice') {
        const spec = JSON.parse(entry.body ?? '{}') as Record<string, unknown>;
        const r = opts.calculator?.(spec);
        if (r === 'hang') {
          return new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const e = new Error('aborted');
              e.name = 'TimeoutError';
              reject(e);
            });
          });
        }
        if (r === 'error') return ok({ status: 'error', data: { name: 'Error', message: 'nope' } });
        return ok({ status: 'success', data: { ...(r ?? { usd: 0.99, flux: 11.1 }), fluxDiscount: 5 } });
      }
      if (p === '/apps/globalappsspecifications') return ok({ status: 'success', data: names });
      if (p === '/apps/locations') return ok({ status: 'success', data: locs });
      if (p === '/apps/appspecifications/HelloFlux') {
        return ok({
          status: 'success',
          data: {
            version: 8,
            name: 'HelloFlux',
            description: 'hi',
            owner: '1hjy4bCYBJr4mny4zCE85J94RXa8W6q37',
            compose: [
              {
                name: 'web',
                repotag: 'nginx:1.27',
                ports: [31001],
                containerPorts: [80],
                domains: [''],
                environmentParameters: ['SECRET=do-not-leak'],
                commands: [],
                containerData: '/tmp',
                cpu: 0.5,
                ram: 500,
                hdd: 5,
                repoauth: '',
              },
            ],
            instances: 5,
            contacts: ['ops@example.com'],
            geolocation: [],
            expire: 88000,
            nodes: [],
            staticip: false,
            enterprise: '',
            height: TIP - 1000,
            hash: 'abc',
          },
        });
      }
      if (p === '/apps/appspecifications/entapp') {
        return ok({
          status: 'success',
          data: {
            version: 8,
            name: 'entapp',
            description: 'enterprise',
            owner: '1hjy4bCYBJr4mny4zCE85J94RXa8W6q37',
            compose: [],
            instances: 3,
            contacts: [],
            geolocation: [],
            expire: 88000,
            nodes: [],
            staticip: false,
            enterprise: 'A'.repeat(400),
            height: TIP - 10,
          },
        });
      }
      if (p.startsWith('/apps/appspecifications/')) {
        return ok({
          status: 'error',
          data: { name: 'Error', message: `Application: ${p.split('/').pop()} not found` },
        });
      }
      if (p === '/apps/location/HelloFlux')
        return ok({ status: 'success', data: locs.filter((l) => l.name === 'HelloFlux') });
      if (p.startsWith('/apps/location/')) return ok({ status: 'success', data: [] });
      if (p === '/daemon/getblockcount') return ok({ status: 'success', data: TIP });
    }
    if (url.host === 'stats.runonflux.io' && p === '/fluxinfo') return ok({ status: 'success', data: fleet });
    if (url.host === 'viprates.runonflux.io' && p === '/rates') {
      return ok([[{ code: 'USD', name: 'US Dollar', rate: 80_000 }], { FLUX: 1.05e-6 }, { errors: {} }]);
    }
    return new Response('not found', { status: 404 });
  };
  return { fetch: fetchImpl, calls };
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

describe('parseParams', () => {
  it('accepts the official table and rejects nonsense', () => {
    assert.deepEqual(parseParams({ status: 'success', data: PARAMS }), PARAMS);
    assert.throws(() => parseParams({ status: 'error', data: {} }));
    assert.throws(() => parseParams({ status: 'success', data: { ...PARAMS, cpu: 0 } }));
    assert.throws(() => parseParams({ status: 'success', data: { ...PARAMS, fluxmultiplier: 5 } }));
    assert.throws(() => parseParams({ status: 'success', data: { ...PARAMS, port: 'x' } }));
    assert.throws(() => parseParams(null));
  });
});

describe('app name rule', () => {
  it('matches the network rule and nothing else', () => {
    for (const n of ['a', 'HelloFlux', 'my-app-2', 'x'.repeat(63)]) assert.ok(isValidAppName(n), n);
    for (const n of [
      '',
      'a'.repeat(64),
      '-a',
      'a-',
      'a b',
      'a/b',
      '../etc',
      'a%2Fb',
      'a?b=1',
      'é',
      'a\nb',
      5,
      null,
    ]) {
      assert.ok(!isValidAppName(n), String(n));
    }
  });
  it('bareIp cuts node ports and refuses anything that is not an IPv4 address', () => {
    assert.equal(bareIp('1.2.3.4:16127'), '1.2.3.4');
    assert.equal(bareIp('1.2.3.4'), '1.2.3.4');
    assert.equal(bareIp('999.1.1.1'), null);
    assert.equal(bareIp('http://evil'), null);
    assert.equal(bareIp('1.2.3.4:16127/x'), null);
  });
});

function pricingService(fake: ReturnType<typeof fakeFlux>, opts: { fluxUsd?: number | null } = {}) {
  const warnings: { msg: string; fields?: Record<string, unknown> }[] = [];
  const log = createLogger('warn', () => {}).child({});
  const capture = {
    ...log,
    warn: (msg: string, fields?: Record<string, unknown>) => warnings.push({ msg, fields }),
    child: () => capture,
  };
  const clock = new ManualClock(1_000_000);
  // A tiny upstream stand-in that routes through the fake fetch with the real client semantics.
  const clientPromise = import('../src/core/upstream.ts').then(
    ({ UpstreamClient }) =>
      new UpstreamClient({
        hosts: { 'https://api.runonflux.io': 'api', 'https://stats.runonflux.io': 'stats' },
        userAgent: 't',
        timeoutMs: 400,
        fetch: fake.fetch,
        clock,
        retryBaseMs: 1,
      }),
  );
  return { warnings, clock, clientPromise, capture, opts };
}

describe('PricingService', () => {
  it('serves live params, a labelled FLUX price and falls back to the baked snapshot when upstream is down', async () => {
    const fake = fakeFlux({ params: { cpu: 0.2 } });
    const { clientPromise, capture, clock } = pricingService(fake);
    const upstream = await clientPromise;
    const svc = new PricingService({
      upstream,
      apiBase: 'https://api.runonflux.io',
      market: { fluxUsd: () => ({ value: 0.1, asOf: 'x', asOfMs: clock.now(), source: 'live' }) },
      clock,
      log: capture,
    });
    const snap = await svc.snapshot();
    assert.equal(snap.data.paramsSource, 'live');
    assert.equal(snap.data.params.cpu, 0.2);
    assert.equal(snap.data.fluxUsd, 0.1);
    assert.equal(snap.data.fluxSource, 'live');
    assert.equal(snap.source, 'live');
    assert.equal(snap.data.bakedAt, undefined);

    const down = fakeFlux({ down: true });
    const d = pricingService(down);
    const svc2 = new PricingService({
      upstream: await d.clientPromise,
      apiBase: 'https://api.runonflux.io',
      market: { fluxUsd: () => ({ value: null, asOf: null, asOfMs: null, source: 'fallback' }) },
      clock: d.clock,
      log: d.capture,
    });
    const s2 = await svc2.snapshot();
    assert.equal(s2.data.paramsSource, 'baked');
    assert.equal(s2.data.fluxSource, 'baked');
    assert.equal(s2.data.fluxUsd, BAKED_PRICING.fluxUsd);
    assert.equal(s2.data.bakedAt, '2026-10-12');
    assert.equal(s2.source, 'fallback');
  });

  it('keeps the last good table as `cache` once upstream goes away', async () => {
    let fail = false;
    const fake = fakeFlux();
    const wrapped: typeof fake = {
      calls: fake.calls,
      fetch: async (i, init) => {
        if (fail) throw new TypeError('down');
        return fake.fetch(i, init);
      },
    };
    const p = pricingService(wrapped);
    const svc = new PricingService({
      upstream: await p.clientPromise,
      apiBase: 'https://api.runonflux.io',
      market: { fluxUsd: () => ({ value: null, asOf: null, asOfMs: null, source: 'fallback' }) },
      clock: p.clock,
      log: p.capture,
    });
    assert.equal((await svc.params()).source, 'live');
    fail = true;
    p.clock.advance(10 * 3600_000);
    const r = await svc.params();
    assert.equal(r.source, 'cache');
    assert.deepEqual(r.params, PARAMS);
  });

  it('confirms a quote with the official calculator and keeps computed lines', async () => {
    const fake = fakeFlux({ calculator: () => ({ usd: 0.99, flux: 11.2 }) });
    const p = pricingService(fake);
    const svc = new PricingService({
      upstream: await p.clientPromise,
      apiBase: 'https://api.runonflux.io',
      market: { fluxUsd: () => ({ value: 0.0852, asOf: 'x', asOfMs: p.clock.now(), source: 'live' }) },
      clock: p.clock,
      log: p.capture,
    });
    const r = await svc.quote({ spec: defaultSpec(), verify: true });
    assert.equal(r.data.quote.basis, 'official');
    assert.equal(r.data.verification?.confirmed, true);
    assert.equal(r.data.verification?.drift, false);
    assert.equal(r.data.quote.usdTotal, 0.99);
    assert.equal(p.warnings.length, 0);
    const calc = fake.calls.find((c) => c.path === '/apps/calculatefiatandfluxprice');
    assert.ok(calc);
    assert.match(calc.type ?? '', /^text\/plain/);
    assert.equal(calc.method, 'POST');
    const sent = JSON.parse(calc.body ?? '{}') as { name: string };
    assert.match(sent.name, /^acadquote[0-9a-f]{16}$/, "the user's app name is never sent to the calculator");
    // same spec again: cached by spec hash, no second POST
    await svc.quote({ spec: defaultSpec(), verify: true });
    assert.equal(fake.calls.filter((c) => c.path === '/apps/calculatefiatandfluxprice').length, 1);
  });

  it('returns the official numbers and logs a warning when they differ by more than a cent', async () => {
    const fake = fakeFlux({ calculator: () => ({ usd: 7.49, flux: 83.1 }) });
    const p = pricingService(fake);
    const svc = new PricingService({
      upstream: await p.clientPromise,
      apiBase: 'https://api.runonflux.io',
      market: { fluxUsd: () => ({ value: 0.0852, asOf: 'x', asOfMs: p.clock.now(), source: 'live' }) },
      clock: p.clock,
      log: p.capture,
    });
    const r = await svc.quote({ spec: defaultSpec(), verify: true });
    const q = r.data.quote;
    assert.equal(q.basis, 'official');
    assert.equal(q.usdTotal, 7.49);
    assert.equal(q.fluxTotal, 83.1);
    assert.equal(r.data.verification?.drift, true);
    assert.ok(q.lines.some((l) => l.id === 'official-adjustment'));
    assert.ok(Math.abs(q.lines.reduce((n, l) => n + l.usd, 0) - 7.49) < 1e-4, 'lines still sum to the total');
    assert.equal(p.warnings.length, 1);
    assert.match(p.warnings[0]?.msg ?? '', /drift/);
    assert.equal(
      JSON.stringify(p.warnings[0]?.fields).includes('hello-flux'),
      false,
      'no spec content in logs',
    );
  });

  it('falls back to the computed quote, saying why, when the calculator fails, times out or refuses', async () => {
    for (const mode of ['error', 'hang'] as const) {
      const fake = fakeFlux({ calculator: () => mode });
      const p = pricingService(fake);
      const svc = new PricingService({
        upstream: await p.clientPromise,
        apiBase: 'https://api.runonflux.io',
        market: { fluxUsd: () => ({ value: 0.0852, asOf: 'x', asOfMs: p.clock.now(), source: 'live' }) },
        clock: p.clock,
        log: p.capture,
      });
      const r = await svc.quote({ spec: defaultSpec(), verify: true });
      assert.equal(r.data.quote.basis, 'computed', mode);
      assert.equal(r.data.verification?.confirmed, false);
      assert.equal(r.data.verification?.reason, 'upstream_unavailable');
      assert.equal(r.data.quote.usdTotal, 0.99);
    }
  });

  it('does not verify enterprise or rate limited requests, and months set the length', async () => {
    const fake = fakeFlux();
    const p = pricingService(fake);
    const svc = new PricingService({
      upstream: await p.clientPromise,
      apiBase: 'https://api.runonflux.io',
      market: { fluxUsd: () => ({ value: 0.0852, asOf: 'x', asOfMs: p.clock.now(), source: 'live' }) },
      clock: p.clock,
      log: p.capture,
    });
    const ent = await svc.quote({ spec: { ...defaultSpec(), enterprise: 'A'.repeat(400) }, verify: true });
    assert.equal(ent.data.verification?.reason, 'enterprise');
    const limited = await svc.quote({ spec: defaultSpec(), verify: true, canVerify: false });
    assert.equal(limited.data.verification?.reason, 'rate_limited');
    assert.equal(fake.calls.filter((c) => c.path.includes('calculate')).length, 0);
    const spec = { ...defaultSpec(), compose: [defaultComponent({ cpu: 1, ram: 1000, hdd: 10 })] };
    const one = await svc.quote({ spec });
    const year = await svc.quote({ spec, months: 12 });
    assert.equal(year.data.quote.months, 12);
    assert.ok(year.data.quote.usdPerMonth < one.data.quote.usdPerMonth);
    assert.equal(one.data.verification, undefined);
  });

  it('lints in the same response and flags a taken name when it knows the names', async () => {
    const fake = fakeFlux();
    const p = pricingService(fake);
    const svc = new PricingService({
      upstream: await p.clientPromise,
      apiBase: 'https://api.runonflux.io',
      market: { fluxUsd: () => ({ value: null, asOf: null, asOfMs: null, source: 'fallback' }) },
      clock: p.clock,
      log: p.capture,
    });
    const r = await svc.quote({ spec: defaultSpec(), takenNames: new Set(['hello-FLUX']) });
    assert.ok(r.data.lint.issues.some((i) => i.code === 'NAME_TAKEN'));
    assert.equal(r.data.quote.fluxUsd, BAKED_PRICING.fluxUsd, 'baked FLUX price, labelled by the snapshot');
  });
});

describe('ExploreService', () => {
  function explore(fake: ReturnType<typeof fakeFlux>) {
    const p = pricingService(fake);
    return p.clientPromise.then(
      (upstream) =>
        new ExploreService({
          upstream,
          apiBase: 'https://api.runonflux.io',
          statsBase: 'https://stats.runonflux.io',
          clock: p.clock,
          log: p.capture,
          tipHeight: () => TIP,
          fixtures: false,
        }),
    );
  }

  it('rejects bad names before any upstream call', async () => {
    const fake = fakeFlux();
    const svc = await explore(fake);
    for (const bad of ['', '../etc/passwd', 'a b', 'a?b', 'x'.repeat(64), 'a/../b']) {
      await assert.rejects(svc.app(bad), (e: unknown) => (e as { status?: number }).status === 400);
    }
    assert.equal(fake.calls.length, 0);
  });

  it('builds an app view without node ports, joined to locations by IP', async () => {
    const fake = fakeFlux();
    const svc = await explore(fake);
    const { data } = await svc.app('HelloFlux');
    assert.equal(data.name, 'HelloFlux');
    assert.equal(data.instancesWanted, 5);
    assert.equal(data.instancesRunning, 5);
    assert.equal(data.enterprise, false);
    assert.deepEqual(data.components, [
      { name: 'web', repotag: 'nginx:1.27', cpu: 0.5, ram: 500, hdd: 5, ports: [31001] },
    ]);
    assert.equal(data.blocksRemaining, 88000 - 1000);
    for (const i of data.instances) {
      assert.match(i.ip, /^\d+\.\d+\.\d+\.\d+$/, 'no port');
      assert.equal(i.cc, 'DE');
      assert.equal(i.lat, 48.12);
      assert.equal(i.lon, 11.65);
      assert.ok(i.tier);
    }
    const blob = JSON.stringify(data);
    for (const leak of ['16127', 'do-not-leak', 'ops@example.com', 'owner', '1hjy4bCYBJr4']) {
      assert.equal(blob.includes(leak), false, `leaked ${leak}`);
    }
    assert.equal(data.docs.specUrl, 'https://api.runonflux.io/apps/appspecifications/HelloFlux');
  });

  it('returns counts only for enterprise apps', async () => {
    const svc = await explore(fakeFlux());
    const { data } = await svc.app('entapp');
    assert.equal(data.enterprise, true);
    assert.deepEqual(data.components, []);
    assert.equal(JSON.stringify(data).includes('AAAA'), false);
    assert.equal(data.instancesWanted, 3);
  });

  it('answers 404 for an unknown app and 503 when upstream is down', async () => {
    const svc = await explore(fakeFlux());
    await assert.rejects(svc.app('nosuchapp'), (e: unknown) => (e as { status?: number }).status === 404);
    const down = await explore(fakeFlux({ down: true }));
    await assert.rejects(down.app('HelloFlux'), (e: unknown) => (e as { status?: number }).status === 503);
  });

  it('caches a result for a minute and bounds memory', async () => {
    const fake = fakeFlux();
    const svc = await explore(fake);
    await svc.app('HelloFlux');
    const n = fake.calls.length;
    await svc.app('HelloFlux');
    assert.equal(fake.calls.length, n);
  });

  it('searches the cached index: prefix first, then by running instances, capped at 25', async () => {
    const svc = await explore(fakeFlux());
    const r = await svc.search('hello');
    assert.equal(r.source, 'live');
    const names = r.data.names.map((n) => n.name);
    assert.deepEqual(names, ['HelloFlux', 'helloworld', 'zzz-hello']);
    assert.equal(r.data.names[0]?.instances, 5);
    assert.equal(r.data.names[2]?.instances, 0);
    const all = await svc.search('');
    assert.equal(all.data.names.length, 25);
    assert.equal(all.data.names[0]?.name, 'HelloFlux');
  });

  it('falls back to a tiny baked list when the index cannot be fetched', async () => {
    const svc = await explore(fakeFlux({ down: true }));
    const r = await svc.search('mine');
    assert.equal(r.source, 'fallback');
    assert.ok(r.data.names.length > 0);
    assert.ok(r.data.names.every((n) => n.instances === null));
  });
});

// ---------------------------------------------------------------------------
// Routes, through the real server
// ---------------------------------------------------------------------------

describe('flux domain routes', () => {
  let s: TestServer;
  let fake: ReturnType<typeof fakeFlux>;
  before(async () => {
    fake = fakeFlux({ calculator: () => ({ usd: 0.99, flux: 11.11 }) });
    s = await startTestServer({ FIXTURES: '0', WEB_DIST: '/nonexistent' }, { fetch: fake.fetch });
    // let the first pollers settle so the market price is known
    await new Promise((r) => setTimeout(r, 600));
  });
  after(async () => {
    await s.stop();
  });

  it('GET /api/v1/pricing returns the table, the FLUX price and their sources', async () => {
    const r = await request(s.port, '/api/v1/pricing');
    assert.equal(r.status, 200);
    const e = r.json<Envelope<PricingSnapshot>>();
    assert.equal(e.data.paramsSource, 'live');
    assert.equal(e.data.params.minUSDPrice, 0.99);
    assert.ok(typeof e.data.fluxUsd === 'number' && e.data.fluxUsd > 0);
    assert.ok(['live', 'cache', 'baked'].includes(e.data.fluxSource ?? ''));
    assert.ok(['live', 'cache', 'fallback'].includes(e.meta.source));
  });

  it('POST /api/v1/quote prices, lints and optionally verifies', async () => {
    const r = await postJson(s.port, '/api/v1/quote', { spec: defaultSpec() });
    assert.equal(r.status, 200);
    const e = r.json<Envelope<QuoteResponse>>();
    assert.equal(e.data.quote.usdTotal, 0.99);
    assert.equal(e.data.quote.basis, 'computed');
    assert.equal(e.data.lint.valid, true);
    assert.equal(e.data.verification, undefined);

    const v = await postJson(s.port, '/api/v1/quote', { spec: defaultSpec(), verify: true });
    const ev = v.json<Envelope<QuoteResponse>>();
    assert.equal(ev.data.quote.basis, 'official');
    assert.equal(ev.data.verification?.confirmed, true);
  });

  it('quote accepts partial and hostile specs without a 500, and validates its own fields', async () => {
    const partial = await postJson(s.port, '/api/v1/quote', { spec: { name: 'x' } });
    assert.equal(partial.status, 200);
    assert.equal(partial.json<Envelope<QuoteResponse>>().data.lint.valid, false);
    for (const spec of [null, 5, 'junk', [], { compose: 'x' }, { instances: 'many' }]) {
      assert.equal((await postJson(s.port, '/api/v1/quote', { spec })).status, 200, JSON.stringify(spec));
    }
    assert.equal((await postJson(s.port, '/api/v1/quote', {})).status, 400);
    assert.equal((await postJson(s.port, '/api/v1/quote', [])).status, 400);
    assert.equal((await postJson(s.port, '/api/v1/quote', { spec: {}, months: 13 })).status, 400);
    assert.equal((await postJson(s.port, '/api/v1/quote', { spec: {}, months: 'x' })).status, 400);
    assert.equal((await postJson(s.port, '/api/v1/quote', { spec: {}, verify: 'yes' })).status, 400);
  });

  it('POST /api/v1/lint answers a LintReport', async () => {
    const r = await postJson(s.port, '/api/v1/lint', { spec: { ...defaultSpec(), instances: 0 } });
    assert.equal(r.status, 200);
    const rep = r.json<Envelope<LintReport>>().data;
    assert.equal(rep.valid, false);
    assert.ok(rep.issues.some((i) => i.code === 'INSTANCES_LOW'));
    assert.equal((await postJson(s.port, '/api/v1/lint', { nospec: 1 })).status, 400);
  });

  it('GET /api/v1/explore/app validates the name and returns the app', async () => {
    const before = fake.calls.length;
    for (const bad of ['', '..%2Fetc', 'a%20b', 'x'.repeat(64)]) {
      const r = await request(s.port, `/api/v1/explore/app?name=${bad}`);
      assert.equal(r.status, 400, bad);
    }
    assert.equal(
      fake.calls
        .slice(before)
        .some((c) => c.path.startsWith('/apps/appspecifications') || c.path.startsWith('/apps/location')),
      false,
    );
    const ok2 = await request(s.port, '/api/v1/explore/app?name=HelloFlux');
    assert.equal(ok2.status, 200);
    const app = ok2.json<Envelope<ExploreApp>>().data;
    assert.equal(app.instancesRunning, 5);
    assert.equal((await request(s.port, '/api/v1/explore/app?name=nosuchapp')).status, 404);
  });

  it('GET /api/v1/explore/search validates q and lists names', async () => {
    const r = await request(s.port, '/api/v1/explore/search?q=hello');
    assert.equal(r.status, 200);
    const e = r.json<Envelope<ExploreSearch>>();
    assert.equal(e.data.query, 'hello');
    assert.ok(e.data.names.some((n) => n.name === 'HelloFlux'));
    assert.equal((await request(s.port, '/api/v1/explore/search?q=%3Cscript%3E')).status, 400);
    assert.equal((await request(s.port, `/api/v1/explore/search?q=${'a'.repeat(33)}`)).status, 400);
  });

  it('only ever calls the allow-listed hosts', () => {
    const hosts = new Set(fake.calls.map((c) => c.host));
    for (const h of hosts)
      assert.ok(
        ['api.runonflux.io', 'stats.runonflux.io', 'viprates.runonflux.io', 'api.coingecko.com'].includes(h),
        h,
      );
  });
});

describe('flux domain routes in fixtures mode', () => {
  let s: TestServer;
  before(async () => {
    s = await startTestServer({ WEB_DIST: '/nonexistent' });
  });
  after(async () => {
    await s.stop();
  });

  it('works offline and labels everything as fallback', async () => {
    const p = await request(s.port, '/api/v1/pricing');
    const pe = p.json<Envelope<PricingSnapshot>>();
    assert.equal(pe.meta.source, 'fallback');
    assert.equal(pe.data.paramsSource, 'baked');
    assert.equal(pe.data.fluxSource, 'baked');
    const q = await postJson(s.port, '/api/v1/quote', { spec: defaultSpec(), verify: true });
    assert.equal(q.status, 200);
    const qe = q.json<Envelope<QuoteResponse>>();
    assert.equal(qe.data.quote.paramsSource, 'baked');
    assert.equal(qe.data.quote.basis, 'computed');
    assert.equal(qe.data.verification?.confirmed, false);
    const search = await request(s.port, '/api/v1/explore/search?q=mine');
    assert.equal(search.json<Envelope<ExploreSearch>>().meta.source, 'fallback');
    assert.equal((await request(s.port, '/api/v1/explore/app?name=HelloFlux')).status, 503);
  });
});

it('UpstreamError is exported for callers that classify rejections', () => {
  assert.equal(new UpstreamError('rejected', 'x').kind, 'rejected');
});
