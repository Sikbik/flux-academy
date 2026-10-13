// Adapted from fluxcommunity/server/test/contract.test.ts
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { API_PATHS } from '../../shared/api.ts';
import { buildFallback } from '../src/data/fallback.ts';
import {
  ApiErrorBody,
  BlockEvent,
  BlocksSnapshot,
  envelope,
  GeoSnapshot,
  HelloEvent,
  interfaceKeys,
  NetworkEvent,
  NetworkSnapshot,
  type ObjCheck,
  ServiceInfo,
  validate,
} from './contract.ts';
import { collectFrames, request, startFixtureServer, type TestServer } from './helpers.ts';

describe('contract validator stays in sync with shared/api.ts', () => {
  const shapes: Record<string, ObjCheck> = {
    NetworkSnapshot,
    GeoSnapshot,
    BlocksSnapshot,
    ServiceInfo,
    HelloEvent,
    BlockEvent,
  };
  for (const [name, shape] of Object.entries(shapes)) {
    it(`${name} lists exactly the interface's properties`, () => {
      assert.deepEqual([...shape.keys].sort(), interfaceKeys(name).sort());
    });
  }
  for (const [name, shape] of Object.entries({ GeoPoint: null, CapacityStats: null })) {
    void shape;
    it(`${name} property list includes the additive fields`, () => {
      const keys = interfaceKeys(name);
      if (name === 'GeoPoint') assert.ok(keys.includes('cc'));
      if (name === 'CapacityStats') assert.ok(keys.includes('reporting'));
    });
  }
});

describe('every endpoint conforms to the contract', () => {
  let s: TestServer;
  before(async () => {
    s = await startFixtureServer({ WEB_DIST: '/nonexistent' }, 120);
  });
  after(async () => {
    await s.stop();
  });

  const get = async (path: string) =>
    (await request(s.port, path, { headers: { 'accept-encoding': 'identity' } })).json();

  it('GET /api/v1/network', async () => {
    const body = await get(API_PATHS.network);
    assert.deepEqual(validate(envelope(NetworkSnapshot), body), []);
  });
  it('GET /api/v1/geo', async () => {
    const body = (await get(API_PATHS.geo)) as {
      data: { points: { cc?: string }[]; located: number; countries: { nodes: number }[] };
    };
    assert.deepEqual(validate(envelope(GeoSnapshot), body), []);
    assert.ok(body.data.points.length > 100);
    assert.ok(
      body.data.points.every((p) => typeof p.cc === 'string' && /^[A-Z]{2}$/.test(p.cc)),
      'cc populated',
    );
    assert.equal(
      body.data.countries.reduce((a, c) => a + c.nodes, 0),
      body.data.located,
    );
  });
  it('GET /api/v1/blocks', async () => {
    const body = (await get(API_PATHS.blocks)) as {
      data: { blocks: { height: number; intervalSec: number | null }[] };
    };
    assert.deepEqual(validate(envelope(BlocksSnapshot), body), []);
    assert.equal(body.data.blocks.length, 120);
    assert.equal(body.data.blocks[0]?.intervalSec, null);
    assert.ok(body.data.blocks.slice(1).every((b) => b.intervalSec === 30));
    assert.equal((body as unknown as { meta: { source: string } }).meta.source, 'fallback');
  });
  it('GET /api/v1/info', async () => {
    const body = (await get(API_PATHS.info)) as { data: { mode: string } };
    assert.deepEqual(validate(envelope(ServiceInfo), body), []);
    assert.equal(body.data.mode, 'fixtures');
  });
  it('error bodies match ApiErrorBody', async () => {
    assert.deepEqual(validate(ApiErrorBody, await get('/api/v1/zzz')), []);
  });
  it('the SSE hello event conforms and labels provenance exactly like REST', async () => {
    const frames = await collectFrames(s.port, (f) => f.some((x) => x.event === 'hello'));
    const hello = JSON.parse(frames.find((f) => f.event === 'hello')?.data ?? 'null');
    assert.deepEqual(validate(HelloEvent, hello, 'hello'), []);
    assert.equal(hello.networkMeta.source, 'fallback', 'fixtures never claim live');
    const rest = (await get(API_PATHS.network)) as { meta: { source: string } };
    assert.equal(hello.networkMeta.source, rest.meta.source);
  });

  it('streamed network and block events conform, and network carries an envelope', async () => {
    const frames = await collectFrames(
      s.port,
      (f) => f.some((x) => x.event === 'network') && f.some((x) => x.event === 'block'),
    );
    const net = JSON.parse(frames.find((f) => f.event === 'network')?.data ?? 'null');
    assert.deepEqual(validate(NetworkEvent, net, 'network'), []);
    assert.equal(net.meta.source, 'fallback');
    const block = JSON.parse(frames.find((f) => f.event === 'block')?.data ?? 'null');
    assert.deepEqual(validate(BlockEvent, block, 'block'), []);
  });
});

describe('baked fallback conforms', () => {
  it('network and geo fallbacks validate', () => {
    const fb = buildFallback();
    assert.deepEqual(validate(NetworkSnapshot, fb.network, 'network'), []);
    assert.deepEqual(validate(GeoSnapshot, fb.geo, 'geo'), []);
    assert.equal(fb.network.market, null, 'no stale price in the fallback');
    assert.ok(fb.geo.points.length > 100);
    assert.deepEqual(validate(BlocksSnapshot, fb.blocks, 'blocks'), []);
    assert.equal(fb.blocks.blocks.length, 120);
    const last = fb.blocks.blocks[119];
    assert.equal(last?.height, fb.network.chain.height, 'the buffer ends at the baked tip');
    assert.ok(fb.blocks.blocks.slice(1).every((b) => b.intervalSec !== null && b.intervalSec > 0));
    assert.ok(fb.network.nodes.total > 1000 && fb.network.nodes.countries !== null);
  });
});

describe('network snapshot keeps the Flux constants honest (docs/research/FACTS.md sections 1, 2, 5)', () => {
  it('encodes the verified tier collateral, split, block time and next reduction', async () => {
    const s = await startFixtureServer({ WEB_DIST: '/nonexistent' });
    try {
      const body = (await request(s.port, API_PATHS.network)).json<{
        data: {
          chain: { targetBlockSec: number; consensus: string };
          rewards: {
            perBlock: number;
            perTier: Record<string, number>;
            devFund: number;
            nextReduction: { height: number; fraction: number; perBlockAfter: number; of: number };
          };
          nodes: { collateral: Record<string, number> };
        };
      }>();
      const d = body.data;
      assert.deepEqual(d.nodes.collateral, { cumulus: 1000, nimbus: 12500, stratus: 40000 });
      assert.equal(d.chain.targetBlockSec, 30);
      assert.equal(d.chain.consensus, 'Proof of Node');
      assert.equal(d.rewards.perBlock, 14);
      assert.deepEqual(d.rewards.perTier, { cumulus: 1, nimbus: 3.5, stratus: 9 });
      assert.equal(d.rewards.devFund, 0.5);
      assert.equal(d.rewards.nextReduction.height, 3_071_200);
      assert.equal(d.rewards.nextReduction.fraction, 0.1);
      assert.equal(d.rewards.nextReduction.perBlockAfter, 12.6);
      assert.equal(d.rewards.nextReduction.of, 20);
    } finally {
      await s.stop();
    }
  });
});
