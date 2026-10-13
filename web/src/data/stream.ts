/**
 * Server-Sent Events client for `/api/v1/stream`, over the browser's `EventSource`.
 *
 * What it adds to a bare `EventSource`
 * - Its own reconnection: exponential backoff with jitter from 1 s up to 30 s. The browser's built-in
 *   retry is a fixed delay and gives up for good on a non-200 or the wrong content type.
 * - A `hello` deadline: a connection is only `open` once the server has said hello (the server sends
 *   it first, which makes a reconnect idempotent).
 * - A dead-connection watchdog: the server sends an `event: ping` frame every 20 s, so 45 s of silence
 *   means a half-open connection and the client reconnects.
 * - Validation: every frame is parsed and checked, unknown event types are ignored (a newer server),
 *   and a malformed frame never throws.
 *
 * Framework free, with the `EventSource` constructor and the timers injectable, so it runs under fake
 * timers in tests. Backoff and watchdog policy adapted from fluxcommunity/web/src/data/stream.ts
 * (same owner, MIT).
 */

import type { BlockEvent, HelloEvent, Meta, NetworkSnapshot } from '@shared/api';
import { API_PATHS, STREAM_EVENT_TYPES } from '@shared/api';
import { parseBlockEvent, parseHello, parseNetwork, parseStreamPayload } from './validate';

/** The slice of `EventSource` the client uses, so tests can supply a fake. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
}

export type EventSourceFactory = (url: string) => EventSourceLike;

/** `open` means a valid `hello` has been received on the current connection. */
export type SseStatus = 'idle' | 'connecting' | 'open' | 'backoff';

export interface SseCloseInfo {
  /** The connection had reached `open` before it ended. */
  wasOpen: boolean;
  reason: string;
  /** Consecutive failures counted so far (0 after a stable connection ended). */
  failures: number;
  nextDelayMs: number;
}

/**
 * A validated stream event. `network` carries the server's `meta` when it sent an envelope, or `null`
 * for a bare snapshot; the consumer decides how to label that. `ping` is liveness only.
 */
export type ClientStreamEvent =
  | { type: 'hello'; data: HelloEvent }
  | { type: 'block'; data: BlockEvent }
  | { type: 'network'; data: NetworkSnapshot; meta: Meta | null }
  | { type: 'ping' };

export interface SseClientOptions {
  url?: string;
  /** Defaults to `new EventSource(url)`. */
  factory?: EventSourceFactory;
  /** Called for every validated event, after `hello` has opened the connection. */
  onEvent: (event: ClientStreamEvent) => void;
  onStatus?: (status: SseStatus) => void;
  onClose?: (info: SseCloseInfo) => void;
  random?: () => number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** No frames (events or pings) for this long means the connection is dead. */
  deadAfterMs?: number;
  /** The server must say hello within this long of the connection starting. */
  helloTimeoutMs?: number;
  /** A connection that lived this long counts as healthy and resets the backoff. */
  stableMs?: number;
  /** Clock for connection age. Defaults to `Date.now`. */
  now?: () => number;
}

export interface SseClient {
  start(): void;
  stop(): void;
  /** Drop the current attempt and connect immediately with a fresh backoff. */
  restart(): void;
  status(): SseStatus;
  failures(): number;
}

type Timer = ReturnType<typeof setTimeout>;

/** Delay before retry number `failures` (1-based): 1 s, 2 s, 4 s ... capped, with jitter. */
export function backoffDelay(failures: number, random: () => number, baseMs = 1000, maxMs = 30_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, failures - 1));
  const jitter = exp >= maxMs ? 0.75 + 0.25 * random() : 1 + 0.25 * random();
  return Math.min(maxMs, Math.round(exp * jitter));
}

const KNOWN = new Set<string>(STREAM_EVENT_TYPES);

/** Decode one frame's JSON into a client event, or null when it is unusable. Pure. */
export function decodeFrame(type: string, raw: string): ClientStreamEvent | null {
  if (!KNOWN.has(type)) return null;
  if (type === 'ping') return { type: 'ping' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  switch (type) {
    case 'hello': {
      const p = parseHello(json);
      return p.ok ? { type: 'hello', data: p.value } : null;
    }
    case 'block': {
      const p = parseBlockEvent(json);
      return p.ok ? { type: 'block', data: p.value } : null;
    }
    case 'network': {
      const p = parseStreamPayload(json, parseNetwork);
      return p.ok ? { type: 'network', data: p.value.data, meta: p.value.meta } : null;
    }
    default:
      return null;
  }
}

function browserFactory(url: string): EventSourceLike {
  return new EventSource(url) as unknown as EventSourceLike;
}

export function createSseClient(options: SseClientOptions): SseClient {
  const url = options.url ?? API_PATHS.stream;
  const factory = options.factory ?? browserFactory;
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const deadAfterMs = options.deadAfterMs ?? 45_000;
  const helloTimeoutMs = options.helloTimeoutMs ?? 10_000;
  const stableMs = options.stableMs ?? 10_000;

  let status: SseStatus = 'idle';
  let failures = 0;
  let generation = 0;
  let source: EventSourceLike | null = null;
  let retryTimer: Timer | null = null;
  let helloTimer: Timer | null = null;
  let deadTimer: Timer | null = null;

  const setStatus = (s: SseStatus) => {
    if (status === s) return;
    status = s;
    options.onStatus?.(s);
  };
  const clearTimers = () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (helloTimer) clearTimeout(helloTimer);
    if (deadTimer) clearTimeout(deadTimer);
    retryTimer = helloTimer = deadTimer = null;
  };
  const closeSource = () => {
    const s = source;
    source = null;
    if (!s) return;
    s.onopen = null;
    s.onerror = null;
    try {
      s.close();
    } catch {
      // Closing twice is harmless.
    }
  };

  function connect(): void {
    const gen = ++generation;
    setStatus('connecting');
    let opened = false;
    let openedAt = 0;
    let finished = false;

    const finish = (reason: string) => {
      if (finished || gen !== generation) return;
      finished = true;
      clearTimers();
      closeSource();
      if (opened && now() - openedAt >= stableMs) failures = 0;
      failures += 1;
      const nextDelayMs = backoffDelay(failures, random, baseDelayMs, maxDelayMs);
      setStatus('backoff');
      options.onClose?.({ wasOpen: opened, reason, failures, nextDelayMs });
      if (gen !== generation) return; // the callback stopped or restarted us
      retryTimer = setTimeout(connect, nextDelayMs);
    };

    const armDead = () => {
      if (deadTimer) clearTimeout(deadTimer);
      deadTimer = setTimeout(() => finish(`no data for ${deadAfterMs} ms`), deadAfterMs);
    };

    let es: EventSourceLike;
    try {
      es = factory(url);
    } catch (e) {
      finish(e instanceof Error ? e.message : 'could not open the stream');
      return;
    }
    source = es;
    helloTimer = setTimeout(() => finish('no hello'), helloTimeoutMs);
    armDead();

    es.onerror = () => finish(opened ? 'stream error' : 'could not connect');

    const handle = (type: string) => (m: MessageEvent<string>) => {
      if (finished || gen !== generation) return;
      armDead();
      const event = decodeFrame(type, typeof m.data === 'string' ? m.data : '');
      if (!event) return;
      if (event.type === 'hello' && !opened) {
        opened = true;
        openedAt = now();
        if (helloTimer) clearTimeout(helloTimer);
        helloTimer = null;
        setStatus('open');
      }
      // Anything before the first hello is not trusted: the server always says hello first.
      if (opened) options.onEvent(event);
    };
    for (const type of STREAM_EVENT_TYPES) es.addEventListener(type, handle(type));
  }

  const teardown = () => {
    generation += 1;
    clearTimers();
    closeSource();
  };

  return {
    start() {
      if (status !== 'idle') return;
      connect();
    },
    stop() {
      teardown();
      setStatus('idle');
    },
    restart() {
      teardown();
      failures = 0;
      connect();
    },
    status: () => status,
    failures: () => failures,
  };
}
