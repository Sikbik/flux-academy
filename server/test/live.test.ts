import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import type {
  BlocksSnapshot,
  Envelope,
  GeoSnapshot,
  NetworkSnapshot,
  ServiceInfo,
} from '../../shared/api.ts';
import type { FetchLike } from '../src/core/upstream.ts';
import { request, startTestServer, type TestServer } from './helpers.ts';

/**
 * The live runtime end to end against a fake Flux: real pollers, real upstream client, real HTTP. No
 * network is touched (the injected fetch is the only way out).
 */

const SAMPLES = new URL('../../docs/research/samples/', import.meta.url);
const sample = (name: string): unknown => JSON.parse(readFileSync(new URL(name, SAMPLES), 'utf8'));
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const TIP = 3_031_500;
const T0 = 1_791_900_000;

function fakeFlux(opts: { down?: boolean } = {}): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fleet = Array.from({ length: 150 }, (_, i) => ({
    ip: `10.0.0.${i}`,
    tier: ['CUMULUS', 'NIMBUS', 'STRATUS'][i % 3],
    benchmark: { bench: { status: ['CUMULUS', 'NIMBUS', 'STRATUS'][i % 3], cores: 4, ram: 8, ssd: 250 } },
    flux: { version: '8.20.0' },
    daemon: { info: { version: 9010050 } },
    geolocation: { lat: 40 + (i % 10), lon: -75 + (i % 7), country: 'United States', countryCode: 'US' },
  }));
  const apps = Array.from({ length: 80 }, (_, i) => ({ name: `app${i}` }));
  const fetchImpl: FetchLike = async (input) => {
    const url = new URL(String(input));
    calls.push(`${url.host}${url.pathname}`);
    if (opts.down) throw new TypeError('fetch failed');
    const p = url.pathname;
    if (url.host === 'api.runonflux.io') {
      if (p === '/daemon/getblockcount') return ok({ status: 'success', data: TIP });
      if (p.startsWith('/daemon/getblockhash/')) {
        const h = Number(p.split('/').pop());
        return h > TIP
          ? ok({ status: 'error', data: { code: -8, name: 'Error', message: 'Block height out of range' } })
          : ok({ status: 'success', data: h.toString(16).padStart(64, '0') });
      }
      if (p.startsWith('/daemon/getblock/')) {
        const ref = p.split('/')[3] as string;
        const h = ref.length === 64 ? Number.parseInt(ref, 16) : Number(ref);
        return ok({
          status: 'success',
          data: {
            hash: h.toString(16).padStart(64, '0'),
            height: h,
            time: T0 - (TIP - h) * 30,
            tx: ['a', 'b', 'c'],
            previousblockhash: (h - 1).toString(16).padStart(64, '0'),
          },
        });
      }
      if (p === '/daemon/getfluxnodecount') return ok(sample('daemon_getfluxnodecount.json'));
      if (p.startsWith('/daemon/getblocksubsidy/')) {
        return ok({
          status: 'success',
          data: { miner: Number(p.split('/').pop()) >= 3_071_200 ? 12.6 : 14 },
        });
      }
      if (p === '/apps/globalappsspecifications' || p === '/apps/locations') {
        return ok({ status: 'success', data: apps });
      }
    }
    if (url.host === 'stats.runonflux.io' && p === '/fluxinfo') return ok({ status: 'success', data: fleet });
    if (url.host === 'viprates.runonflux.io' && p === '/rates') {
      return ok([[{ code: 'USD', name: 'US Dollar', rate: 80_000 }], { FLUX: 1.05e-6 }, { errors: {} }]);
    }
    if (url.host === 'api.coingecko.com') {
      return ok({ zelcash: { usd: 0.0851, usd_24h_change: 1.234, usd_market_cap: 36_000_000 } });
    }
    return new Response('not found', { status: 404 });
  };
  return { fetch: fetchImpl, calls };
}

const get = async <T>(s: TestServer, path: string) =>
  (await request(s.port, path, { headers: { 'accept-encoding': 'identity' } })).json<Envelope<T>>();

async function until(cond: () => Promise<boolean>, ms = 8_000) {
  const end = Date.now() + ms;
  while (!(await cond())) {
    if (Date.now() > end) throw new Error('condition not met in time');
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe('live runtime against a healthy fake upstream', () => {
  let s: TestServer;
  let fake: ReturnType<typeof fakeFlux>;
  before(async () => {
    fake = fakeFlux();
    s = await startTestServer(
      { FIXTURES: '0', WEB_DIST: '/nonexistent', BLOCK_POLL_FAST_MS: '250', BLOCK_POLL_SLOW_MS: '500' },
      { fetch: fake.fetch },
    );
    await until(async () => (await get<NetworkSnapshot>(s, '/api/v1/network')).meta.source === 'live');
    await until(async () => (await get<GeoSnapshot>(s, '/api/v1/geo')).meta.source === 'live');
    // Slow sections (app counts) start a few seconds after boot by design.
    await until(async () => {
      const d = (await get<NetworkSnapshot>(s, '/api/v1/network')).data;
      return d.apps?.registered != null && d.apps.running != null && d.market != null;
    }, 15_000);
  });
  after(async () => {
    await s.stop();
  });

  it('network is live and assembled from the upstream parts', async () => {
    const { data, meta } = await get<NetworkSnapshot>(s, '/api/v1/network');
    assert.equal(meta.source, 'live');
    assert.equal(meta.stale, false);
    assert.equal(data.chain.height, TIP);
    assert.equal(data.chain.tipTime, new Date(T0 * 1000).toISOString());
    assert.deepEqual(data.nodes.tiers, { cumulus: 3585, nimbus: 1691, stratus: 1829 });
    assert.equal(data.nodes.total, 7105);
    assert.deepEqual(data.nodes.collateral, { cumulus: 1000, nimbus: 12500, stratus: 40000 });
    assert.equal(data.rewards.perBlock, 14);
    assert.equal(data.rewards.nextReduction?.blocksAway, 3_071_200 - TIP);
    assert.equal(data.capacity?.reporting, 150);
    assert.equal(data.apps?.registered, 80);
    assert.equal(data.versions.fluxos, '8.20.0');
    assert.equal(data.versions.daemon, '9.1.0');
    assert.ok(data.freshness?.chain && data.freshness.nodes && data.freshness.market);
  });

  it('prices FLUX from the rates service (USD.rate x FLUX) and enriches from CoinGecko', async () => {
    const { data } = await get<NetworkSnapshot>(s, '/api/v1/network');
    assert.equal(data.market?.priceUsd, 0.084);
    assert.equal(data.market?.change24hPct, 1.23);
    assert.equal(data.market?.marketCapUsd, 36_000_000);
    const px = s.ctx.market.fluxUsd();
    assert.equal(px.source, 'live');
    assert.ok(px.asOf && px.asOfMs);
  });

  it('serves live geo clustered and country keyed', async () => {
    const { data, meta } = await get<GeoSnapshot>(s, '/api/v1/geo');
    assert.equal(meta.source, 'live');
    assert.equal(data.total, 150);
    assert.equal(data.located, 150);
    assert.deepEqual(
      data.countries.map((c) => c.code),
      ['US'],
    );
    assert.ok(data.points.length > 0 && data.points.length <= 400);
    assert.equal(
      data.points.reduce((a, p) => a + p.n, 0),
      150,
    );
  });

  it('buffers blocks with measured intervals and reports upstream health', async () => {
    await until(async () => (await get<BlocksSnapshot>(s, '/api/v1/blocks')).data.blocks.length >= 20);
    const { data, meta } = await get<BlocksSnapshot>(s, '/api/v1/blocks');
    assert.equal(meta.source, 'live');
    assert.equal(data.blocks.at(-1)?.height, TIP);
    assert.ok(data.blocks.slice(1).every((b) => b.intervalSec === 30));
    const info = (await get<ServiceInfo>(s, '/api/v1/info')).data;
    assert.equal(info.mode, 'live');
    for (const name of ['flux-api', 'stats', 'market']) assert.equal(info.upstream[name]?.ok, true, name);
  });

  it('only ever talks to the configured upstream hosts', () => {
    const hosts = new Set(fake.calls.map((c) => c.split('/')[0]));
    assert.deepEqual([...hosts].sort(), [
      'api.coingecko.com',
      'api.runonflux.io',
      'stats.runonflux.io',
      'viprates.runonflux.io',
    ]);
  });
});

describe('live runtime with every upstream down (cold start)', () => {
  let s: TestServer;
  before(async () => {
    s = await startTestServer(
      { FIXTURES: '0', WEB_DIST: '/nonexistent' },
      { fetch: fakeFlux({ down: true }).fetch },
    );
    await new Promise((r) => setTimeout(r, 400));
  });
  after(async () => {
    await s.stop();
  });

  it('still answers every endpoint, labelled fallback, never as live', async () => {
    const net = await get<NetworkSnapshot>(s, '/api/v1/network');
    assert.equal(net.meta.source, 'fallback');
    assert.ok(net.data.chain.height > 3_000_000);
    assert.equal(net.data.market, null, 'no stale price is invented');
    const geo = await get<GeoSnapshot>(s, '/api/v1/geo');
    assert.equal(geo.meta.source, 'fallback');
    assert.ok(geo.data.points.length > 100);
    const blocks = await get<BlocksSnapshot>(s, '/api/v1/blocks');
    assert.equal(blocks.meta.source, 'fallback');
    assert.equal(blocks.data.blocks.length, 120);
    assert.equal(s.ctx.market.fluxUsd().source, 'fallback');
    assert.equal(s.ctx.market.fluxUsd().value, null);
  });

  it('reports the failing upstreams in /info without leaking URLs or stacks', async () => {
    const info = (await get<ServiceInfo>(s, '/api/v1/info')).data;
    assert.equal(info.mode, 'live');
    assert.equal(info.upstream['flux-api']?.ok, false);
    assert.match(info.upstream['flux-api']?.lastError ?? '', /fetch failed/);
    assert.ok(!JSON.stringify(info).includes('    at '));
  });
});
