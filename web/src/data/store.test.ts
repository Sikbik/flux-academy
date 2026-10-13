import type { BlockSummary, Meta } from '@shared/api';
import { describe, expect, it } from 'vitest';
import { getBaked } from './baked';
import { createDataStore, mergeBlocks, shareStructure } from './store';
import { liveMeta, networkAt } from './testkit';

const T0 = Date.parse('2026-10-12T12:00:00Z');

describe('shareStructure', () => {
  it('keeps references of unchanged sub-objects', () => {
    const prev = { a: { x: 1 }, b: [{ y: 1 }, { y: 2 }], c: 3 };
    const next = { a: { x: 1 }, b: [{ y: 1 }, { y: 2 }], c: 4 };
    const shared = shareStructure(prev, next);
    expect(shared).not.toBe(prev);
    expect(shared.a).toBe(prev.a);
    expect(shared.b).toBe(prev.b);
    expect(shared.c).toBe(4);
  });

  it('returns prev itself when nothing changed', () => {
    const prev = { a: [1, 2, 3], b: { c: 'x' } };
    expect(shareStructure(prev, structuredClone(prev))).toBe(prev);
  });
});

describe('mergeBlocks', () => {
  const b = (height: number): BlockSummary => ({
    height,
    time: new Date(height * 1000).toISOString(),
    intervalSec: 30,
    txCount: null,
  });

  it('unions by height, sorts, and caps at 120', () => {
    const prev = Array.from({ length: 100 }, (_, i) => b(i));
    const incoming = Array.from({ length: 40 }, (_, i) => b(90 + i));
    const merged = mergeBlocks(prev, incoming);
    expect(merged).toHaveLength(120);
    expect(merged[merged.length - 1]?.height).toBe(129);
    expect(merged[0]?.height).toBe(10);
  });
});

describe('ingest', () => {
  it('stores a record and labels it live', () => {
    const s = createDataStore();
    const ok = s
      .getState()
      .ingest('network', networkAt(100, T0), liveMeta(T0), { receivedAt: T0, origin: 'rest' });
    expect(ok).toBe(true);
    expect(s.getState().network.status).toBe('live');
    expect(s.getState().network.error).toBeNull();
    expect(s.getState().lastSuccess.network).toBe(T0);
  });

  it('rejects an older REST network snapshot over a newer one', () => {
    const s = createDataStore();
    s.getState().ingest('network', networkAt(200, T0), liveMeta(T0), { receivedAt: T0, origin: 'sse' });
    const ok = s
      .getState()
      .ingest('network', networkAt(150, T0), liveMeta(T0), { receivedAt: T0 + 1, origin: 'rest' });
    expect(ok).toBe(false);
    expect(s.getState().network.data?.chain.height).toBe(200);
  });

  it('keeps the same `data` reference when the payload is unchanged', () => {
    const s = createDataStore();
    s.getState().ingest('geo', getBaked().geo, liveMeta(T0), { receivedAt: T0, origin: 'rest' });
    const first = s.getState().geo.data;
    s.getState().ingest('geo', structuredClone(getBaked().geo), liveMeta(T0 + 1000), {
      receivedAt: T0 + 1000,
      origin: 'rest',
    });
    expect(s.getState().geo.data).toBe(first);
  });

  it('merges a REST blocks list into what the stream already added', () => {
    const s = createDataStore();
    const list = getBaked().blocks.blocks;
    s.getState().ingest('blocks', { blocks: list.slice(0, 40) }, liveMeta(T0), {
      receivedAt: T0,
      origin: 'rest',
    });
    s.getState().ingest('blocks', { blocks: list.slice(30, 60) }, liveMeta(T0 + 1), {
      receivedAt: T0 + 1,
      origin: 'rest',
    });
    const heights = s.getState().blocks.data?.blocks.map((x) => x.height) ?? [];
    expect(heights).toHaveLength(60);
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
  });

  it('does not count a server-labelled fallback payload as a success', () => {
    const s = createDataStore();
    const meta: Meta = liveMeta(T0, { source: 'fallback', stale: true });
    s.getState().ingest('network', networkAt(100, T0), meta, { receivedAt: T0, origin: 'rest' });
    expect(s.getState().network.status).toBe('fallback');
    expect(s.getState().lastSuccess.network).toBeNull();
  });
});

describe('appendBlock', () => {
  it('extends a real list, computes the interval and stays live', () => {
    const s = createDataStore();
    const list = getBaked().blocks.blocks;
    s.getState().ingest('blocks', { blocks: list }, liveMeta(T0), { receivedAt: T0, origin: 'rest' });
    const tip = list[list.length - 1] as BlockSummary;
    const time = new Date(Date.parse(tip.time) + 31_000).toISOString();
    const ok = s.getState().appendBlock({ height: tip.height + 1, time, txCount: 2 }, T0 + 5);
    expect(ok).toBe(true);
    const added = s.getState().blocks.data?.blocks.at(-1);
    expect(added?.height).toBe(tip.height + 1);
    expect(added?.intervalSec).toBe(31);
    expect(s.getState().blocks.status).toBe('live');
  });

  it('ignores an old height and a baked list', () => {
    const s = createDataStore();
    s.getState().applyBaked(getBaked(), ['blocks'], T0);
    expect(
      s.getState().appendBlock({ height: 99_999_999, time: new Date(T0).toISOString(), txCount: null }, T0),
    ).toBe(false);
    s.getState().ingest('blocks', { blocks: getBaked().blocks.blocks }, liveMeta(T0), {
      receivedAt: T0,
      origin: 'rest',
    });
    const tip = s.getState().blocks.data?.blocks.at(-1) as BlockSummary;
    expect(s.getState().appendBlock({ height: tip.height, time: tip.time, txCount: null }, T0)).toBe(false);
  });
});

describe('baked fallback labelling', () => {
  it('fills empty slots only and labels every one as fallback with an as-of date', () => {
    const s = createDataStore();
    s.getState().applyBaked(getBaked(), undefined, T0);
    for (const key of ['network', 'geo', 'blocks', 'pricing'] as const) {
      const view = s.getState()[key];
      expect(view.status).toBe('fallback');
      expect(view.meta?.source).toBe('fallback');
      expect(view.meta?.asOf).toBe(getBaked().meta.asOf);
      expect(view.data).not.toBeNull();
    }
    expect(s.getState().lastSuccess.network).toBeNull();
  });

  it('never replaces real data', () => {
    const s = createDataStore();
    s.getState().ingest('network', networkAt(777, T0), liveMeta(T0), { receivedAt: T0, origin: 'rest' });
    s.getState().applyBaked(getBaked(), undefined, T0 + 10);
    expect(s.getState().network.data?.chain.height).toBe(777);
    expect(s.getState().network.status).toBe('live');
    expect(s.getState().geo.status).toBe('fallback');
  });

  it('is replaced by the first real payload, and the status follows', () => {
    const s = createDataStore();
    s.getState().applyBaked(getBaked(), undefined, T0);
    expect(s.getState().network.status).toBe('fallback');
    s.getState().ingest('network', networkAt(5, T0), liveMeta(T0 + 5), {
      receivedAt: T0 + 5,
      origin: 'rest',
    });
    expect(s.getState().network.status).toBe('live');
    expect(s.getState().network.meta?.source).toBe('live');
  });
});

describe('status over time and connection', () => {
  it('goes live to cache when the window passes, and to offline when the connection is down', () => {
    const s = createDataStore();
    s.getState().setConnection('live', T0);
    s.getState().ingest('network', networkAt(1, T0), liveMeta(T0), { receivedAt: T0, origin: 'sse' });
    expect(s.getState().network.status).toBe('live');
    s.getState().recompute(T0 + 40_000);
    expect(s.getState().network.status).toBe('live');
    s.getState().recompute(T0 + 50_000);
    expect(s.getState().network.status).toBe('cache');
    s.getState().setConnection('offline', T0 + 51_000);
    expect(s.getState().network.status).toBe('offline');
    // The record is still there: numbers keep showing.
    expect(s.getState().network.data?.chain.height).toBe(1);
  });

  it('honours a server that says cache or stale', () => {
    const s = createDataStore();
    s.getState().ingest('network', networkAt(1, T0), liveMeta(T0, { source: 'cache', stale: true }), {
      receivedAt: T0,
      origin: 'rest',
    });
    expect(s.getState().network.status).toBe('cache');
  });

  it('keeps one view object between ticks when nothing visible changed', () => {
    const s = createDataStore();
    s.getState().ingest('network', networkAt(1, T0), liveMeta(T0), { receivedAt: T0, origin: 'sse' });
    const a = s.getState().network;
    s.getState().recompute(T0 + 1000);
    expect(s.getState().network).toBe(a);
  });
});

describe('errors', () => {
  it('records the last error per resource and clears it on success', () => {
    const s = createDataStore();
    s.getState().setError('geo', 'timed out after 6000 ms', T0);
    expect(s.getState().geo.error).toBe('timed out after 6000 ms');
    expect(s.getState().geo.status).toBe('loading');
    s.getState().ingest('geo', getBaked().geo, liveMeta(T0), { receivedAt: T0, origin: 'rest' });
    expect(s.getState().geo.error).toBeNull();
  });
});

describe('clock skew and chain', () => {
  it('prefers the hello skew over a REST estimate', () => {
    const s = createDataStore();
    s.getState().setSkew(500, 'hello');
    s.getState().setSkew(900, 'rest');
    expect(s.getState().skewMs).toBe(500);
  });

  it('does not republish an unchanged chain', () => {
    const s = createDataStore();
    s.getState().setChain({ height: 5, live: true });
    const a = s.getState().chain;
    s.getState().setChain({ height: 5, live: true });
    expect(s.getState().chain).toBe(a);
  });
});
