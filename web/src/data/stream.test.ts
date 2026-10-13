import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getBaked } from './baked';
import {
  backoffDelay,
  type ClientStreamEvent,
  createSseClient,
  decodeFrame,
  type SseCloseInfo,
} from './stream';
import { FakeEventSource, liveMeta } from './testkit';

describe('decodeFrame', () => {
  it('decodes a network envelope with its meta', () => {
    const raw = JSON.stringify({ data: getBaked().network, meta: liveMeta(Date.now()) });
    const e = decodeFrame('network', raw);
    expect(e?.type).toBe('network');
    if (e?.type === 'network') {
      expect(e.data.chain.height).toBe(getBaked().network.chain.height);
      expect(e.meta?.source).toBe('live');
    }
  });

  it('decodes a bare network snapshot with null meta', () => {
    const e = decodeFrame('network', JSON.stringify(getBaked().network));
    expect(e?.type === 'network' && e.meta).toBeNull();
  });

  it('decodes block and ping, ignores unknown types and garbage', () => {
    expect(
      decodeFrame('block', JSON.stringify({ height: 5, time: '2026-10-12T12:00:00Z', txCount: null })),
    ).toEqual({
      type: 'block',
      data: { height: 5, time: '2026-10-12T12:00:00Z', txCount: null },
    });
    expect(decodeFrame('ping', '{}')).toEqual({ type: 'ping' });
    expect(decodeFrame('health', '{}')).toBeNull();
    expect(decodeFrame('block', 'not json')).toBeNull();
    expect(decodeFrame('block', JSON.stringify({ height: 'x' }))).toBeNull();
    expect(decodeFrame('hello', JSON.stringify({}))).toBeNull();
  });

  it('drops a malformed network inside hello but keeps the hello', () => {
    const e = decodeFrame(
      'hello',
      JSON.stringify({ serverTime: '2026-10-12T12:00:00Z', network: { nope: true } }),
    );
    expect(e?.type === 'hello' && e.data.network).toBeNull();
  });
});

describe('backoffDelay', () => {
  it('doubles from one second and caps at thirty with jitter inside bounds', () => {
    expect(backoffDelay(1, () => 0)).toBe(1000);
    expect(backoffDelay(2, () => 0)).toBe(2000);
    expect(backoffDelay(3, () => 0)).toBe(4000);
    expect(backoffDelay(10, () => 0)).toBe(22_500);
    expect(backoffDelay(10, () => 1)).toBe(30_000);
    expect(backoffDelay(2, () => 1)).toBeLessThanOrEqual(2500);
  });
});

describe('createSseClient', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(over: Partial<Parameters<typeof createSseClient>[0]> = {}) {
    const sources: FakeEventSource[] = [];
    const events: ClientStreamEvent[] = [];
    const closes: SseCloseInfo[] = [];
    const statuses: string[] = [];
    const client = createSseClient({
      url: '/api/v1/stream',
      factory: (url) => {
        const es = new FakeEventSource(url);
        sources.push(es);
        return es;
      },
      random: () => 0,
      onEvent: (e) => events.push(e),
      onStatus: (s) => statuses.push(s),
      onClose: (c) => closes.push(c),
      ...over,
    });
    return { client, sources, events, closes, statuses };
  }

  const hello = { serverTime: '2026-10-12T12:00:00.000Z', network: null };

  it('is open only after hello, and drops frames that come before it', () => {
    const t = setup();
    t.client.start();
    expect(t.statuses).toEqual(['connecting']);
    t.sources[0]?.push('block', { height: 1, time: '2026-10-12T12:00:00Z', txCount: null });
    expect(t.events).toHaveLength(0);
    t.sources[0]?.push('hello', hello);
    expect(t.client.status()).toBe('open');
    t.sources[0]?.push('block', { height: 2, time: '2026-10-12T12:00:30Z', txCount: null });
    expect(t.events.map((e) => e.type)).toEqual(['hello', 'block']);
  });

  it('reconnects with backoff after an error and resets after a stable connection', () => {
    const t = setup();
    t.client.start();
    t.sources[0]?.fail();
    expect(t.client.status()).toBe('backoff');
    expect(t.closes[0]).toMatchObject({ wasOpen: false, failures: 1, nextDelayMs: 1000 });
    vi.advanceTimersByTime(1000);
    expect(t.sources).toHaveLength(2);
    t.sources[1]?.fail();
    expect(t.closes[1]?.nextDelayMs).toBe(2000);
    vi.advanceTimersByTime(2000);
    t.sources[2]?.push('hello', hello);
    vi.advanceTimersByTime(11_000); // outlives `stableMs`
    t.sources[2]?.fail();
    expect(t.closes[2]).toMatchObject({ wasOpen: true, failures: 1 });
  });

  it('gives up on a connection that never says hello', () => {
    const t = setup();
    t.client.start();
    vi.advanceTimersByTime(10_000);
    expect(t.closes[0]?.reason).toBe('no hello');
    expect(t.sources[0]?.closed).toBe(true);
  });

  it('treats silence as a dead connection, and pings keep it alive', () => {
    const t = setup();
    t.client.start();
    t.sources[0]?.push('hello', hello);
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(20_000);
      t.sources[0]?.push('ping', {});
    }
    expect(t.client.status()).toBe('open');
    vi.advanceTimersByTime(45_000);
    expect(t.client.status()).toBe('backoff');
    expect(t.closes.at(-1)?.reason).toContain('no data');
  });

  it('stop closes the source and does not reconnect', () => {
    const t = setup();
    t.client.start();
    t.sources[0]?.push('hello', hello);
    t.client.stop();
    expect(t.sources[0]?.closed).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(t.sources).toHaveLength(1);
    expect(t.client.status()).toBe('idle');
  });

  it('restart connects at once with a fresh backoff', () => {
    const t = setup();
    t.client.start();
    t.sources[0]?.fail();
    t.client.restart();
    expect(t.sources).toHaveLength(2);
    expect(t.client.failures()).toBe(0);
  });

  it('ignores a late frame from a connection that was replaced', () => {
    const t = setup();
    t.client.start();
    t.sources[0]?.push('hello', hello);
    const old = t.sources[0];
    t.client.restart();
    t.events.length = 0;
    // `closed` stops the fake from delivering; emulate a stray delivery anyway.
    if (old) old.closed = false;
    old?.push('block', { height: 9, time: '2026-10-12T12:00:00Z', txCount: null });
    expect(t.events).toHaveLength(0);
  });
});
