/**
 * Test doubles for the data layer: a fake API server (REST and SSE) behind a fake `fetch` and a fake
 * `EventSource`, a fake page environment, and a recording block bus. No network, no DOM.
 *
 * Responses are plain objects rather than `Response` so that nothing depends on timers or streams
 * inside the runtime, which keeps fake timers fully deterministic.
 *
 * Adapted from fluxcommunity/web/src/data/testkit.ts (same owner, MIT).
 */

import type {
  BlockEvent,
  BlocksSnapshot,
  Envelope,
  GeoSnapshot,
  Meta,
  NetworkSnapshot,
  PricingSnapshot,
} from '@shared/api';
import { API_PATHS } from '@shared/api';
import { type BakedSet, getBaked } from './baked';
import type { Env } from './clock';
import type { BlockBus } from './engine';
import type { EventSourceFactory, EventSourceLike } from './stream';

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

export function liveMeta(nowMs: number, over: Partial<Meta> = {}): Meta {
  const iso = new Date(nowMs).toISOString();
  return { generatedAt: iso, asOf: iso, ageMs: 0, stale: false, source: 'live', ...over };
}

export function networkAt(height: number, tipMs: number): NetworkSnapshot {
  const base = getBaked().network;
  return { ...base, chain: { ...base.chain, height, tipTime: new Date(tipMs).toISOString() } };
}

/** A contiguous run of `count` blocks ending at `height`, 30 s apart, the tip at `tipMs`. */
export function blocksAt(height: number, tipMs: number, count = 60): BlocksSnapshot {
  const blocks = Array.from({ length: count }, (_, i) => {
    const h = height - (count - 1 - i);
    return {
      height: h,
      time: new Date(tipMs - (count - 1 - i) * 30_000).toISOString(),
      intervalSec: i === 0 ? null : 30,
      txCount: null,
    };
  });
  return { blocks };
}

export function envelope<T>(data: T, nowMs: number, over: Partial<Meta> = {}): Envelope<T> {
  return { data, meta: liveMeta(nowMs, over) };
}

// ---------------------------------------------------------------------------
// Fake EventSource
// ---------------------------------------------------------------------------

type Listener = (event: MessageEvent<string>) => void;

export class FakeEventSource implements EventSourceLike {
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;
  private listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close(): void {
    this.closed = true;
  }

  /** Deliver an event frame. */
  push(event: string, data: unknown): void {
    if (this.closed) return;
    const message = { data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent<string>;
    for (const l of this.listeners.get(event) ?? []) l(message);
  }

  /** Simulate the connection failing (the browser fires `error`). */
  fail(): void {
    if (this.closed) return;
    this.onerror?.(new Event('error'));
  }
}

// ---------------------------------------------------------------------------
// Fake server
// ---------------------------------------------------------------------------

export type StreamMode = 'ok' | 'refuse';
export type RestMode = 'ok' | 'http500' | 'refuse';
type Key = 'network' | 'geo' | 'blocks' | 'pricing';

export interface FakeServer {
  fetch: typeof fetch;
  eventSource: EventSourceFactory;
  streams: FakeEventSource[];
  requests: string[];
  streamMode: StreamMode;
  restMode: RestMode;
  /** Send `hello` the moment a stream connects, like the real server does. */
  autoHello: boolean;
  /** Server clock offset from the test's Date.now(), in ms. */
  clockOffsetMs: number;
  data: { network: NetworkSnapshot; geo: GeoSnapshot; blocks: BlocksSnapshot; pricing: PricingSnapshot };
  /** Override meta for the next responses of a resource. */
  metaOver: Partial<Record<Key, Partial<Meta>>>;
  restCount(path: string): number;
  /** Say hello on the latest stream. */
  hello(
    stream?: FakeEventSource,
    over?: { network?: NetworkSnapshot | null; withMeta?: boolean; meta?: Partial<Meta> },
  ): void;
  /** Push a `network` envelope event, as the real server does. */
  networkEvent(data?: NetworkSnapshot, metaOver?: Partial<Meta>, stream?: FakeEventSource): void;
  /** Push a `block` event for `height`, stamped `ageMs` ago on the server clock. */
  blockEvent(height: number, ageMs?: number, stream?: FakeEventSource): BlockEvent;
  lastStream(): FakeEventSource;
}

type FetchInit = Parameters<typeof fetch>[1];

export function createFakeServer(): FakeServer {
  const base = getBaked();
  const server: FakeServer = {
    streams: [],
    requests: [],
    streamMode: 'ok',
    restMode: 'ok',
    autoHello: false,
    clockOffsetMs: 0,
    data: {
      network: networkAt(3_031_000, Date.now()),
      geo: base.geo,
      blocks: blocksAt(3_031_000, Date.now()),
      pricing: { ...base.pricing, fluxUsd: 0.5, paramsSource: 'live' },
    },
    metaOver: {},
    fetch: undefined as never,
    eventSource: undefined as never,
    restCount(path) {
      return server.requests.filter((r) => r === path).length;
    },
    lastStream() {
      const s = server.streams[server.streams.length - 1];
      if (!s) throw new Error('no stream opened');
      return s;
    },
    hello(stream, over = {}) {
      const s = stream ?? server.lastStream();
      const now = Date.now() + server.clockOffsetMs;
      const withMeta = over.withMeta !== false;
      s.push('hello', {
        serverTime: new Date(now).toISOString(),
        network: over.network === undefined ? server.data.network : over.network,
        ...(withMeta ? { networkMeta: liveMeta(now, { ...server.metaOver.network, ...over.meta }) } : {}),
      });
    },
    networkEvent(data, metaOver, stream) {
      const s = stream ?? server.lastStream();
      const now = Date.now() + server.clockOffsetMs;
      s.push('network', {
        data: data ?? server.data.network,
        meta: liveMeta(now, { ...server.metaOver.network, ...metaOver }),
      });
    },
    blockEvent(height, ageMs = 1000, stream) {
      const s = stream ?? server.lastStream();
      const event: BlockEvent = {
        height,
        time: new Date(Date.now() + server.clockOffsetMs - ageMs).toISOString(),
        txCount: 1,
      };
      s.push('block', event);
      return event;
    },
  };

  const keyByPath: Record<string, Key> = {
    [API_PATHS.network]: 'network',
    [API_PATHS.geo]: 'geo',
    [API_PATHS.blocks]: 'blocks',
    [API_PATHS.pricing]: 'pricing',
  };

  const response = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => {
      if (typeof body === 'string') throw new SyntaxError('not json');
      return body;
    },
  });

  server.eventSource = (url: string) => {
    server.requests.push(url);
    const es = new FakeEventSource(url);
    server.streams.push(es);
    if (server.streamMode === 'refuse') {
      queueMicrotask(() => es.fail());
    } else if (server.autoHello) {
      queueMicrotask(() => server.hello(es));
    }
    return es;
  };

  server.fetch = (async (input: unknown, _init?: FetchInit) => {
    const path = String(input);
    server.requests.push(path);
    const key = keyByPath[path];
    if (!key) return response(404, { error: { code: 'not_found', message: 'nope' } });
    if (server.restMode === 'refuse') throw new TypeError('fetch failed');
    if (server.restMode === 'http500') return response(500, 'boom');
    const now = Date.now() + server.clockOffsetMs;
    return response(200, envelope(server.data[key], now, server.metaOver[key]));
  }) as unknown as typeof fetch;

  return server;
}

// ---------------------------------------------------------------------------
// Fake page environment and recording bus
// ---------------------------------------------------------------------------

export interface FakeEnv extends Env {
  hidden: boolean;
  online: boolean;
  setHidden(hidden: boolean): void;
  setOnline(online: boolean): void;
  listeners(): number;
}

export function createFakeEnv(): FakeEnv {
  const vis = new Set<() => void>();
  const onl = new Set<(online: boolean) => void>();
  const env: FakeEnv = {
    hidden: false,
    online: true,
    isHidden: () => env.hidden,
    isOnline: () => env.online,
    onVisibility(cb) {
      vis.add(cb);
      return () => vis.delete(cb);
    },
    onOnline(cb) {
      onl.add(cb);
      return () => onl.delete(cb);
    },
    setHidden(h) {
      env.hidden = h;
      for (const cb of [...vis]) cb();
    },
    setOnline(o) {
      env.online = o;
      for (const cb of [...onl]) cb(o);
    },
    listeners: () => vis.size + onl.size,
  };
  return env;
}

export interface RecordingBus extends BlockBus {
  events: BlockEvent[];
}

export function createRecordingBus(): RecordingBus {
  const bus: RecordingBus = {
    events: [],
    emit(event) {
      bus.events.push(event);
    },
  };
  return bus;
}

export const loadBakedSync = async (): Promise<BakedSet> => getBaked();
