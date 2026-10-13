import { API_PATHS } from '@shared/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBaked } from './baked';
import { createTicker } from './clock';
import { createEngine, type EngineDeps, expectedIntervalMs } from './engine';
import { createDataStore } from './store';
import { createFakeEnv, createFakeServer, createRecordingBus, loadBakedSync, networkAt } from './testkit';

const START = Date.parse('2026-10-12T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => {
  vi.useRealTimers();
});

async function flush() {
  for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(0);
}
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  await flush();
}

function harness(over: Partial<EngineDeps> = {}) {
  const server = createFakeServer();
  const env = createFakeEnv();
  const blocks = createRecordingBus();
  const store = createDataStore();
  const ticker = createTicker(env);
  const engine = createEngine({
    env,
    ticker,
    store,
    blocks,
    loadBaked: loadBakedSync,
    fetch: server.fetch,
    eventSource: server.eventSource,
    random: () => 0,
    warn: () => undefined,
    ...over,
  });
  return { server, env, blocks, store, ticker, engine };
}

describe('SSE happy path', () => {
  it('connects, says live, ingests REST with real meta, and never pulses on hello', async () => {
    const h = harness();
    h.engine.start();
    await flush();
    expect(h.store.getState().connection).toBe('connecting');
    h.server.hello();
    await flush();
    const s = h.store.getState();
    expect(s.connection).toBe('live');
    expect(s.network.status).toBe('live');
    expect(s.network.meta?.source).toBe('live');
    expect(s.blocks.status).toBe('live');
    expect(s.pricing.data?.paramsSource).toBe('live');
    expect(s.geo.data).not.toBeNull();
    expect(h.blocks.events).toHaveLength(0);
    expect(s.chain).toMatchObject({ height: 3_031_000, live: true, simulated: false });
    expect(s.chain.lastBlockAt).not.toBeNull();
    h.engine.stop();
  });

  it('fires one block event per genuinely new height and never twice', async () => {
    const h = harness();
    h.engine.start();
    await flush();
    h.server.hello();
    await flush();

    h.server.blockEvent(3_031_001);
    await flush();
    expect(h.blocks.events.map((e) => e.height)).toEqual([3_031_001]);
    expect(h.store.getState().chain.height).toBe(3_031_001);

    // The same block again, and a network snapshot at the same height: nothing.
    h.server.blockEvent(3_031_001);
    h.server.networkEvent(networkAt(3_031_001, Date.now() - 1000));
    await flush();
    expect(h.blocks.events).toHaveLength(1);

    // A snapshot ahead of the block event pulses once; the block event after it does not.
    h.server.networkEvent(networkAt(3_031_002, Date.now() - 500));
    await flush();
    expect(h.blocks.events).toHaveLength(2);
    h.server.blockEvent(3_031_002);
    await flush();
    expect(h.blocks.events).toHaveLength(2);

    // An older height arriving late moves nothing.
    h.server.blockEvent(3_031_001);
    await flush();
    expect(h.blocks.events).toHaveLength(2);
    expect(h.store.getState().chain.height).toBe(3_031_002);
    h.engine.stop();
  });

  it('streamed blocks extend the blocks list and keep it live', async () => {
    const h = harness();
    h.engine.start();
    await flush();
    h.server.hello();
    await flush();
    const before = h.store.getState().blocks.data?.blocks.length ?? 0;
    h.server.blockEvent(3_031_001);
    await flush();
    expect(h.store.getState().blocks.data?.blocks.length).toBe(before + 1);
    h.engine.stop();
  });

  it('a reconnect hello with a newer height resyncs without a pulse', async () => {
    const h = harness();
    h.engine.start();
    await flush();
    h.server.hello();
    await flush();
    h.server.lastStream().fail();
    await flush();
    h.server.data.network = networkAt(3_031_006, Date.now());
    await advance(1100);
    h.server.hello();
    await flush();
    expect(h.store.getState().chain.height).toBe(3_031_006);
    expect(h.blocks.events).toHaveLength(0);
    h.engine.stop();
  });

  it('an old block (the tab was asleep) is not a beat', async () => {
    const h = harness();
    h.engine.start();
    await flush();
    h.server.hello();
    await flush();
    h.server.blockEvent(3_031_001, 5 * 60_000);
    await flush();
    expect(h.blocks.events).toHaveLength(0);
    expect(h.store.getState().chain.height).toBe(3_031_001);
    h.engine.stop();
  });
});

describe('clock skew', () => {
  it('corrects block times by the hello serverTime', async () => {
    const h = harness();
    h.server.clockOffsetMs = 60_000; // the server clock is a minute ahead
    h.engine.start();
    await flush();
    h.server.hello();
    await flush();
    h.server.blockEvent(3_031_001, 2000);
    await flush();
    expect(h.store.getState().skewMs).toBe(60_000);
    const at = h.store.getState().chain.lastBlockAt ?? 0;
    expect(Math.abs(Date.now() - at - 2000)).toBeLessThan(1500);
    h.engine.stop();
  });
});

describe('offline and fallback', () => {
  it('shows the baked sample, labelled fallback, when nothing answers', async () => {
    const h = harness();
    h.server.streamMode = 'refuse';
    h.server.restMode = 'refuse';
    h.engine.start();
    await advance(5000);
    const s = h.store.getState();
    for (const key of ['network', 'geo', 'blocks', 'pricing'] as const) {
      expect(s[key].status).toBe('fallback');
      expect(s[key].meta?.asOf).toBe(getBaked().meta.asOf);
    }
    // The baked height is shown dimmed and never anchors the clock: no countdown, no beat.
    expect(s.chain.height).toBe(getBaked().network.chain.height);
    expect(s.chain.live).toBe(false);
    expect(s.chain.lastBlockAt).toBeNull();
    expect(h.blocks.events).toHaveLength(0);
    h.engine.stop();
  });

  it('goes offline after repeated failures, and recovers when the API returns', async () => {
    const h = harness();
    h.server.streamMode = 'refuse';
    h.server.restMode = 'refuse';
    h.engine.start();
    await advance(60_000);
    expect(h.store.getState().connection).toBe('offline');
    expect(h.store.getState().network.error).toBeTruthy();

    h.server.streamMode = 'ok';
    h.server.restMode = 'ok';
    h.env.setOnline(false);
    h.env.setOnline(true);
    await flush();
    await advance(1500);
    h.server.hello();
    await flush();
    expect(h.store.getState().connection).toBe('live');
    expect(h.store.getState().network.status).toBe('live');
    expect(h.store.getState().network.error).toBeNull();
    h.engine.stop();
  });

  it('falls back to polling when the stream fails but REST works', async () => {
    const h = harness();
    h.server.streamMode = 'refuse';
    h.engine.start();
    await advance(1500);
    expect(h.store.getState().connection).toBe('polling');
    expect(h.store.getState().network.status).toBe('live');
    const calls = h.server.restCount(API_PATHS.network);
    await advance(12_000);
    expect(h.server.restCount(API_PATHS.network)).toBeGreaterThan(calls);
    h.engine.stop();
  });

  it('real data is never replaced by the sample after the grace period', async () => {
    const h = harness();
    h.engine.start();
    await flush();
    h.server.hello();
    await advance(6000);
    expect(h.store.getState().network.status).toBe('live');
    expect(h.store.getState().network.meta?.source).toBe('live');
    h.engine.stop();
  });

  it('does not treat a server-labelled fallback as live, and ignores its blocks', async () => {
    const h = harness();
    // The server in FIXTURES mode labels everything it serves as fallback.
    h.server.metaOver.network = { source: 'fallback', stale: true };
    h.server.metaOver.blocks = { source: 'fallback', stale: true };
    h.engine.start();
    await flush();
    h.server.hello();
    await flush();
    expect(h.store.getState().network.status).toBe('fallback');
    h.server.blockEvent(3_031_001);
    await flush();
    expect(h.blocks.events).toHaveLength(0);
    expect(h.store.getState().chain.live).toBe(false);
    h.engine.stop();
  });
});

describe('page environment', () => {
  it('pauses while hidden and refreshes on return', async () => {
    const h = harness();
    h.engine.start();
    await flush();
    h.server.hello();
    await flush();
    const before = h.server.requests.length;
    h.env.setHidden(true);
    await advance(120_000);
    expect(h.server.requests.length).toBe(before);
    h.env.setHidden(false);
    await flush();
    expect(h.server.requests.length).toBeGreaterThan(before);
    h.engine.stop();
  });

  it('stop releases every listener', async () => {
    const h = harness();
    h.engine.start();
    await flush();
    expect(h.env.listeners()).toBeGreaterThan(0);
    h.engine.stop();
    expect(h.env.listeners()).toBe(0);
    expect(h.ticker.size()).toBe(0);
  });
});

describe('demo mode', () => {
  it('shows the sample as fallback with no network and no beat', async () => {
    const h = harness({ demo: true });
    h.engine.start();
    await flush();
    const s = h.store.getState();
    expect(h.server.requests).toHaveLength(0);
    expect(s.connection).toBe('offline');
    expect(s.network.status).toBe('fallback');
    expect(s.chain.live).toBe(false);
    await advance(120_000);
    expect(h.blocks.events).toHaveLength(0);
    h.engine.stop();
  });

  it('simulates blocks only when asked (development), and says so', async () => {
    const warn = vi.fn();
    const h = harness({ demo: true, simulateBeatSec: 10, warn });
    h.engine.start();
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
    await advance(25_000);
    expect(h.blocks.events.length).toBeGreaterThanOrEqual(2);
    const s = h.store.getState();
    expect(s.chain.simulated).toBe(true);
    expect(s.chain.live).toBe(true);
    // The data itself is still the labelled sample.
    expect(s.network.status).toBe('fallback');
    h.engine.stop();
  });
});

describe('expectedIntervalMs', () => {
  it('prefers a sane measured mean and rounds to 100 ms', () => {
    expect(expectedIntervalMs(30, 30.14)).toBe(30_100);
    expect(expectedIntervalMs(30, null)).toBe(30_000);
    expect(expectedIntervalMs(30, 500)).toBe(30_000);
  });
});
