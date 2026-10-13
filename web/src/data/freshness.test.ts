import { describe, expect, it } from 'vitest';
import { getBaked } from './baked';
import {
  FRESH_WINDOW_MS,
  isFallback,
  type RawRecord,
  recordAgeMs,
  SECTION_WINDOW_MS,
  sectionStatus,
  statusOf,
} from './freshness';
import { liveMeta, networkAt } from './testkit';

const T0 = Date.parse('2026-10-12T12:00:00Z');

function rec<T>(data: T, over: Partial<RawRecord<T>> = {}): RawRecord<T> {
  return { data, meta: liveMeta(T0), receivedAt: T0, origin: 'rest', ...over };
}

describe('statusOf', () => {
  const net = networkAt(1, T0);

  it('is loading without a record', () => {
    expect(statusOf('network', null, T0, 'live')).toBe('loading');
  });

  it('is live inside the window and cache outside it', () => {
    const r = rec(net);
    expect(statusOf('network', r, T0 + FRESH_WINDOW_MS.network - 1, 'live')).toBe('live');
    expect(statusOf('network', r, T0 + FRESH_WINDOW_MS.network, 'live')).toBe('cache');
    expect(statusOf('network', r, T0 + FRESH_WINDOW_MS.network, 'polling')).toBe('cache');
  });

  it('is offline only when the connection is offline and the data is past its window', () => {
    const r = rec(net);
    expect(statusOf('network', r, T0 + 5_000, 'offline')).toBe('live');
    expect(statusOf('network', r, T0 + FRESH_WINDOW_MS.network + 1, 'offline')).toBe('offline');
  });

  it('is fallback for the baked sample whatever the connection says', () => {
    const baked = rec(net, { origin: 'baked', meta: getBaked().meta });
    for (const c of ['connecting', 'live', 'polling', 'offline'] as const) {
      expect(statusOf('network', baked, T0, c)).toBe('fallback');
    }
  });

  it('is fallback when the server itself says fallback', () => {
    const r = rec(net, { meta: liveMeta(T0, { source: 'fallback', stale: true }) });
    expect(isFallback(r)).toBe(true);
    expect(statusOf('network', r, T0, 'live')).toBe('fallback');
  });

  it('treats server stale and source cache as cache', () => {
    expect(statusOf('geo', rec(getBaked().geo, { meta: liveMeta(T0, { stale: true }) }), T0, 'live')).toBe(
      'cache',
    );
    expect(
      statusOf('geo', rec(getBaked().geo, { meta: liveMeta(T0, { source: 'cache' }) }), T0, 'live'),
    ).toBe('cache');
  });
});

describe('recordAgeMs', () => {
  it('adds time since arrival to the age the server reported', () => {
    const r = rec(networkAt(1, T0), { meta: liveMeta(T0, { ageMs: 3000 }) });
    expect(recordAgeMs(r, T0 + 2000)).toBe(5000);
  });

  it('measures a baked record from its as-of date', () => {
    const baked = rec(networkAt(1, T0), { origin: 'baked', meta: getBaked().meta });
    const asOf = Date.parse(getBaked().meta.asOf);
    expect(recordAgeMs(baked, asOf + 60_000)).toBe(60_000);
  });
});

describe('sectionStatus', () => {
  it('labels a slow section by its own window', () => {
    const net = {
      ...networkAt(1, T0),
      freshness: {
        chain: new Date(T0).toISOString(),
        nodes: new Date(T0).toISOString(),
        capacity: new Date(T0 - 10 * 60_000).toISOString(),
        apps: null,
        market: new Date(T0 - 6 * 60_000).toISOString(),
      },
    };
    const r = rec(net);
    expect(sectionStatus(r, 'chain', T0, 'live').status).toBe('live');
    // A ten minute old capacity figure is still inside its fifteen minute window.
    expect(sectionStatus(r, 'capacity', T0, 'live').status).toBe('live');
    // The price is past its five minute window.
    expect(sectionStatus(r, 'market', T0, 'live').status).toBe('cache');
    expect(sectionStatus(r, 'market', T0, 'offline').status).toBe('offline');
    // Never fetched upstream: loading, not something it is not.
    expect(sectionStatus(r, 'apps', T0, 'live').status).toBe('loading');
    expect(SECTION_WINDOW_MS.market).toBe(5 * 60_000);
  });

  it('is fallback for the whole snapshot when the sample is shown', () => {
    const baked = rec(getBaked().network, { origin: 'baked', meta: getBaked().meta });
    expect(sectionStatus(baked, 'nodes', T0, 'offline').status).toBe('fallback');
  });
});
