/**
 * The data engine: wires the REST client, the SSE client, the page environment and the store together.
 *
 * Transport policy
 * - The SSE stream is preferred. While it is open, REST runs only as a slow safety net (the stream has
 *   no `blocks` list, `geo` or `pricing`, and a quiet stream must not make fresh data look old).
 * - When the stream cannot be established or drops, REST polling takes over at its normal cadence, and
 *   the SSE client keeps retrying with backoff in the background (that is the periodic attempt to return
 *   to SSE). When a `hello` arrives, polling relaxes back to the safety net.
 * - While the page is hidden nothing runs. Becoming visible refreshes immediately.
 *
 * Honesty rules (docs/DESIGN.md section 8)
 * - The baked sample only fills empty slots and is always tagged `fallback`.
 * - A block pulse fires once per genuinely new live block, never from hello, never from the sample.
 * - If the API is offline there is NO simulated beat. The one exception is development-only
 *   (`?demo=1&beat=N`), which says so in the console and flags the clock as `simulated`.
 * - Block times are corrected for client and server clock skew using `hello.serverTime`.
 *
 * Adapted from fluxcommunity/web/src/data/engine.ts (same owner, MIT).
 */

import type { BlockEvent, NetworkSnapshot } from '@shared/api';
import { effectiveBlockSec } from '@shared/chain';
import { type ApiClient, createApiClient } from './api';
import type { BakedSet } from './baked';
import { createChainTracker } from './chain';
import type { Env, Ticker } from './clock';
import { FRESH_WINDOW_MS } from './freshness';
import type { DataStore } from './store';
import { RESOURCE_KEYS } from './store';
import {
  type ClientStreamEvent,
  createSseClient,
  type EventSourceFactory,
  type SseClient,
  type SseCloseInfo,
  type SseStatus,
} from './stream';
import type { ConnectionState, ResourceKey } from './types';

type Timer = ReturnType<typeof setTimeout>;

/** Where new blocks are announced. The module-level `onBlock` subscribes to the app's one bus. */
export interface BlockBus {
  emit(event: BlockEvent): void;
}

export interface EngineTuning {
  /** How long to wait for a first response before showing the baked sample. */
  initialGraceMs: number;
  /** REST cadence while the stream is not open. */
  pollMs: Record<ResourceKey, number>;
  /** REST cadence while the stream is open (a safety net, not the primary path). */
  safetyMs: Record<ResourceKey, number>;
  /** The chain clock counts as live while a live observation is younger than this. */
  chainLiveWindowMs: number;
  /** Ceiling for per-resource failure backoff. */
  maxFailureBackoffMs: number;
  /** Consecutive failed REST calls (with no stream) before the connection is `offline`. */
  offlineAfterFailures: number;
}

export const ENGINE_DEFAULTS: EngineTuning = {
  initialGraceMs: 4000,
  pollMs: { network: 10_000, blocks: 15_000, pricing: 60_000, geo: 300_000 },
  safetyMs: { network: 30_000, blocks: 120_000, pricing: 120_000, geo: 300_000 },
  chainLiveWindowMs: FRESH_WINDOW_MS.network,
  maxFailureBackoffMs: 60_000,
  offlineAfterFailures: 3,
};

export interface EngineDeps {
  env: Env;
  ticker: Ticker;
  store: DataStore;
  blocks: BlockBus;
  /** Loads the baked sample (lazy, so the main bundle does not carry it). */
  loadBaked: () => Promise<BakedSet>;
  /** Defaults to a client built on `fetch`. */
  api?: ApiClient;
  fetch?: typeof fetch;
  random?: () => number;
  /** `?demo=1`: show the baked sample and never touch the network. */
  demo?: boolean;
  /** Development only: with `demo`, simulate a block every N seconds. */
  simulateBeatSec?: number | null;
  tuning?: Partial<EngineTuning>;
  /** Called once when the dev simulation starts. Defaults to `console.warn`. */
  warn?: (message: string) => void;
  /** Overrides the stream URL (tests). */
  streamUrl?: string;
  /** Overrides the EventSource constructor (tests). */
  eventSource?: EventSourceFactory;
}

export interface Engine {
  start(): void;
  stop(): void;
  running(): boolean;
}

/**
 * The block interval the clock should use. The protocol target is 30 s, but real chains run a little
 * over it (slot skips), so the measured mean is preferred when it is sane. Rounded to 100 ms so a
 * drifting mean does not republish the chain state on every block.
 */
export function expectedIntervalMs(targetSec: number, measuredSec: number | null): number {
  const measured = effectiveBlockSec(targetSec, measuredSec).seconds;
  return Math.round(measured * 10) * 100;
}

export function createEngine(deps: EngineDeps): Engine {
  const { env, ticker, store, blocks } = deps;
  const random = deps.random ?? Math.random;
  const tuning: EngineTuning = { ...ENGINE_DEFAULTS, ...deps.tuning };
  const demo = deps.demo === true;
  const api = deps.api ?? createApiClient({ fetch: deps.fetch, random });
  const warn = deps.warn ?? ((m: string) => console.warn(m));

  let running = false;
  let hidden = false;
  let offlineSince: number | null = null;
  let abort = new AbortController();
  const timers: Partial<Record<ResourceKey, Timer>> = {};
  const inFlight = new Set<ResourceKey>();
  const lastAttemptAt: Record<ResourceKey, number> = { network: 0, geo: 0, blocks: 0, pricing: 0 };
  const failStreak: Record<ResourceKey, number> = { network: 0, geo: 0, blocks: 0, pricing: 0 };
  const retryAfter: Record<ResourceKey, number> = { network: 0, geo: 0, blocks: 0, pricing: 0 };
  let restFailStreak = 0;
  let lastRestOkAt: number | null = null;
  let sseOpen = false;
  let sseSettled = false;
  let sseStatus: SseStatus = 'idle';
  let sseFailures = 0;
  /** The server itself labelled its latest network payload `fallback` (FIXTURES mode or no upstream). */
  let serverFallback = false;
  let intervalMs = 30_000;
  let targetSec = 30;
  /** Development only: blocks are simulated on top of the baked sample (`?demo=1&beat=N`). */
  let simulating = false;
  let graceTimer: Timer | null = null;
  let unsubTicker: (() => void) | null = null;
  let unsubVisibility: (() => void) | null = null;
  let unsubOnline: (() => void) | null = null;
  let tracker = createChainTracker(intervalMs);
  let sse: SseClient | null = null;
  let bakedLoad: Promise<BakedSet> | null = null;
  let published = {
    height: -1 as number | null,
    lastBlockAt: -1 as number | null,
    intervalMs: -1,
    targetSec: -1,
    live: false,
    simulated: false,
  };

  const loadBaked = (): Promise<BakedSet> => {
    bakedLoad ??= deps.loadBaked();
    return bakedLoad;
  };

  // -------------------------------------------------------------------------
  // Chain feed
  // -------------------------------------------------------------------------

  function publishChain(now: number): void {
    const tip = tracker.tip();
    if (!tip) return;
    const simulated = simulating;
    const live =
      (simulated || tracker.isLive(now, tuning.chainLiveWindowMs)) &&
      store.getState().connection !== 'offline';
    const next = {
      height: tip.height as number | null,
      lastBlockAt: tip.at,
      intervalMs,
      targetSec,
      live,
      simulated,
    };
    if (
      published.height === next.height &&
      published.lastBlockAt === next.lastBlockAt &&
      published.intervalMs === next.intervalMs &&
      published.targetSec === next.targetSec &&
      published.live === next.live &&
      published.simulated === next.simulated
    ) {
      return;
    }
    published = next;
    store.getState().setChain(next);
  }

  function observeTip(
    height: number,
    timeIso: string | null,
    now: number,
    allowBeat: boolean,
    txCount: number | null = null,
  ): void {
    const header = timeIso === null ? null : Date.parse(timeIso);
    let atMs = header !== null && Number.isFinite(header) ? header - store.getState().skewMs : null;
    if (atMs !== null && atMs > now) atMs = now; // a header cannot be from the future
    const result = tracker.observe({ height, atMs, nowMs: now, allowBeat });
    publishChain(now);
    if (result.beat) {
      blocks.emit({ height, time: timeIso ?? new Date(now).toISOString(), txCount });
    }
  }

  function noteNetwork(net: NetworkSnapshot, now: number, allowBeat: boolean): void {
    targetSec = net.chain.targetBlockSec;
    intervalMs = expectedIntervalMs(net.chain.targetBlockSec, net.chain.measuredBlockSec);
    observeTip(net.chain.height, net.chain.tipTime, now, allowBeat);
  }

  /** The baked height is shown dimmed and labelled; it never anchors the clock. */
  function showBakedChain(baked: BakedSet): void {
    if (tracker.tip() !== null) return;
    targetSec = baked.network.chain.targetBlockSec;
    const chain = {
      height: baked.network.chain.height,
      lastBlockAt: null,
      intervalMs,
      targetSec,
      live: false,
      simulated: false,
    };
    published = { ...chain };
    store.getState().setChain(chain);
  }

  async function fillBaked(keys: readonly ResourceKey[]): Promise<void> {
    let baked: BakedSet;
    try {
      baked = await loadBaked();
    } catch {
      return;
    }
    if (!running) return;
    const s = store.getState();
    const missing = keys.filter((k) => s.records[k] === null);
    if (missing.length === 0) return;
    s.applyBaked(baked, missing, Date.now());
    if (missing.includes('network')) showBakedChain(baked);
  }

  // -------------------------------------------------------------------------
  // Connection state
  // -------------------------------------------------------------------------

  function pushDebug(): void {
    store.getState().setDebug({
      running,
      demo,
      hidden,
      transport: !running ? 'none' : demo ? 'demo' : sseOpen ? 'sse' : sseSettled ? 'polling' : 'none',
      sse: sseStatus,
      sseFailures,
      restFailStreak,
    });
  }

  function updateConnection(): void {
    let next: ConnectionState;
    if (demo) next = simulating ? 'live' : 'offline';
    else if (offlineSince !== null) next = 'offline';
    else if (sseOpen) next = 'live';
    else if (restFailStreak >= tuning.offlineAfterFailures) next = 'offline';
    else if (!sseSettled) next = 'connecting';
    else if (lastRestOkAt !== null) next = 'polling';
    else next = 'connecting';
    store.getState().setConnection(next, Date.now());
    publishChain(Date.now());
    pushDebug();
  }

  // -------------------------------------------------------------------------
  // REST
  // -------------------------------------------------------------------------

  function intervalFor(key: ResourceKey): number {
    const base = sseOpen || !sseSettled ? tuning.safetyMs[key] : tuning.pollMs[key];
    const streak = failStreak[key];
    if (streak === 0) return base;
    const backoff = Math.min(tuning.maxFailureBackoffMs, base * 2 ** Math.min(streak, 6));
    return Math.max(base, backoff, retryAfter[key]);
  }

  function schedule(key: ResourceKey): void {
    const prev = timers[key];
    if (prev) clearTimeout(prev);
    delete timers[key];
    if (!running || hidden || demo) return;
    const interval = intervalFor(key);
    const due = Math.max(0, lastAttemptAt[key] + interval - Date.now());
    const jitter = random() * Math.min(1000, interval * 0.1);
    timers[key] = setTimeout(() => void refresh(key), due + jitter);
  }

  function scheduleAll(): void {
    for (const key of RESOURCE_KEYS) schedule(key);
  }

  async function refresh(key: ResourceKey): Promise<void> {
    if (!running || hidden || demo || inFlight.has(key)) return;
    inFlight.add(key);
    lastAttemptAt[key] = Date.now();
    const signal = abort.signal;
    const generation = abort;
    try {
      const res = await api[key]({ signal });
      if (!running || generation !== abort) return;
      const s = store.getState();
      if (res.ok) {
        failStreak[key] = 0;
        retryAfter[key] = 0;
        restFailStreak = 0;
        lastRestOkAt = res.receivedAt;
        offlineSince = null;
        if (s.skewSource !== 'hello') {
          // The response was generated about half a round trip before it arrived.
          const mid = res.requestStartedAt + (res.receivedAt - res.requestStartedAt) / 2;
          const generated = Date.parse(res.envelope.meta.generatedAt);
          if (Number.isFinite(generated)) s.setSkew(generated - mid, 'rest');
        }
        const { data, meta } = res.envelope;
        const applied = s.ingest(key, data as never, meta, {
          receivedAt: res.receivedAt,
          origin: 'rest',
          requestStartedAt: res.requestStartedAt,
        });
        // A payload the server itself labels `fallback` is baked data: it never drives the chain
        // clock or a pulse (the store still shows it, labelled fallback).
        const liveChain = meta.source !== 'fallback';
        if (key === 'network' && applied) serverFallback = !liveChain;
        if (applied && liveChain && key === 'network') {
          noteNetwork(data as NetworkSnapshot, res.receivedAt, true);
        }
        if (applied && liveChain && key === 'blocks') {
          const list = (data as { blocks: Array<{ height: number; time: string }> }).blocks;
          const tipBlock = list[list.length - 1];
          if (tipBlock) observeTip(tipBlock.height, tipBlock.time, res.receivedAt, true);
        }
      } else if (res.error.kind !== 'aborted') {
        failStreak[key] += 1;
        restFailStreak += 1;
        if (res.error.retryAfterMs) retryAfter[key] = res.error.retryAfterMs;
        s.setError(key, res.error.message, Date.now());
        if (s.records[key] === null) void fillBaked([key]);
      }
    } finally {
      // A newer generation (after pause/resume) owns the set now; leave its entries alone.
      if (generation === abort) inFlight.delete(key);
    }
    if (!running || generation !== abort) return;
    updateConnection();
    schedule(key);
  }

  function refreshAll(): void {
    for (const key of RESOURCE_KEYS) void refresh(key);
  }

  // -------------------------------------------------------------------------
  // Stream
  // -------------------------------------------------------------------------

  function liveMeta(now: number) {
    const iso = new Date(now + store.getState().skewMs).toISOString();
    return { generatedAt: iso, asOf: iso, ageMs: 0, stale: false, source: 'live' as const };
  }

  function onStreamEvent(event: ClientStreamEvent): void {
    const now = Date.now();
    const s = store.getState();
    switch (event.type) {
      case 'hello': {
        const { serverTime, network, networkMeta } = event.data;
        const serverMs = Date.parse(serverTime);
        if (Number.isFinite(serverMs)) s.setSkew(serverMs - now, 'hello');
        // Hello is a resync: it may populate the store and the chain clock but never fires a pulse.
        if (network && networkMeta) {
          s.ingest('network', network, networkMeta, { receivedAt: now, origin: 'sse' });
          serverFallback = networkMeta.source === 'fallback';
          if (!serverFallback) noteNetwork(network, now, false);
        } else if (network && !serverFallback) {
          // No meta: usable for the chain clock only. The REST refresh below supplies the meta.
          noteNetwork(network, now, false);
        }
        for (const key of RESOURCE_KEYS) {
          const rec = store.getState().records[key];
          const stale =
            rec === null || rec.origin === 'baked' || (key !== 'geo' && now - rec.receivedAt > 5000);
          if (stale) void refresh(key);
        }
        break;
      }
      case 'block': {
        // Blocks carry no meta. While the server is serving baked or simulated data they are not
        // evidence of a live network, so they do not drive the clock, the list, or a pulse.
        if (serverFallback) break;
        observeTip(event.data.height, event.data.time, now, true, event.data.txCount);
        s.appendBlock(event.data, now);
        break;
      }
      case 'network': {
        const meta = event.meta ?? liveMeta(now);
        s.ingest('network', event.data, meta, { receivedAt: now, origin: 'sse' });
        serverFallback = meta.source === 'fallback';
        if (!serverFallback) noteNetwork(event.data, now, true);
        break;
      }
      case 'ping':
        break;
    }
    restFailStreak = 0;
    updateConnection();
  }

  function onStreamStatus(status: SseStatus): void {
    sseStatus = status;
    pushDebug();
    if (status === 'open') {
      sseOpen = true;
      sseSettled = true;
      sseFailures = 0;
      offlineSince = null;
      restFailStreak = 0;
      scheduleAll();
      updateConnection();
    }
  }

  function onStreamClose(info: SseCloseInfo): void {
    sseFailures = info.failures;
    sseOpen = false;
    sseSettled = true;
    scheduleAll(); // overdue resources refresh right away, at polling cadence
    updateConnection();
  }

  // -------------------------------------------------------------------------
  // Page environment
  // -------------------------------------------------------------------------

  function pause(): void {
    for (const key of RESOURCE_KEYS) {
      const t = timers[key];
      if (t) clearTimeout(t);
      delete timers[key];
    }
    abort.abort();
    abort = new AbortController();
    inFlight.clear();
    sse?.stop();
  }

  function resume(): void {
    if (demo) return;
    for (const key of RESOURCE_KEYS) lastAttemptAt[key] = 0;
    if (RESOURCE_KEYS.some((k) => store.getState().records[k] === null)) armGrace();
    refreshAll();
    sse?.restart();
    scheduleAll();
  }

  function onVisibility(): void {
    if (!running) return;
    const nowHidden = env.isHidden();
    if (nowHidden === hidden) return;
    hidden = nowHidden;
    if (hidden) pause();
    else resume();
    pushDebug();
  }

  function onOnline(online: boolean): void {
    if (!running) return;
    if (!online) {
      offlineSince = Date.now();
      updateConnection();
      return;
    }
    offlineSince = null;
    restFailStreak = 0;
    updateConnection();
    if (!hidden) {
      for (const key of RESOURCE_KEYS) {
        failStreak[key] = 0;
        lastAttemptAt[key] = 0;
      }
      refreshAll();
      sse?.restart();
      scheduleAll();
    }
  }

  /** If nothing has answered after the grace period, show the baked sample, labelled. */
  function armGrace(): void {
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = setTimeout(() => {
      graceTimer = null;
      if (!running) return;
      void fillBaked(RESOURCE_KEYS);
    }, tuning.initialGraceMs);
  }

  // -------------------------------------------------------------------------
  // Demo (?demo=1)
  // -------------------------------------------------------------------------

  function startDemo(): void {
    store.getState().setConnection('offline', Date.now());
    void loadBaked().then((baked) => {
      if (!running) return;
      store.getState().applyBaked(baked, RESOURCE_KEYS, Date.now());
      showBakedChain(baked);
      updateConnection();
      const beatSec = deps.simulateBeatSec ?? null;
      if (beatSec === null) return;
      warn(
        `[flux-data] development only: simulating a block every ${beatSec} s on top of the baked sample. ` +
          'The data is still labelled fallback and nothing here is real network data.',
      );
      let height = baked.network.chain.height;
      let lastBlockAt = Date.now();
      intervalMs = beatSec * 1000;
      tracker = createChainTracker(intervalMs);
      tracker.observe({ height, atMs: lastBlockAt, nowMs: lastBlockAt, allowBeat: false });
      simulating = true;
      updateConnection();
      unsubTicker?.();
      unsubTicker = ticker.subscribe((now) => {
        if (now - lastBlockAt >= intervalMs) {
          height += 1;
          lastBlockAt = now;
          const r = tracker.observe({ height, atMs: now, nowMs: now, allowBeat: true });
          publishChain(now);
          if (r.beat) blocks.emit({ height, time: new Date(now).toISOString(), txCount: null });
        } else {
          publishChain(now);
        }
        store.getState().recompute(now);
      });
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  return {
    running: () => running,

    start() {
      if (running) return;
      running = true;
      tracker = createChainTracker(intervalMs);
      published = {
        height: -1,
        lastBlockAt: -1,
        intervalMs: -1,
        targetSec: -1,
        live: false,
        simulated: false,
      };
      abort = new AbortController();
      hidden = env.isHidden();
      offlineSince = env.isOnline() ? null : Date.now();
      sseOpen = false;
      sseSettled = false;
      restFailStreak = 0;
      lastRestOkAt = null;
      serverFallback = false;
      simulating = false;

      if (demo) {
        startDemo();
        pushDebug();
        return;
      }

      store.getState().setConnection(offlineSince !== null ? 'offline' : 'connecting', Date.now());
      sse = createSseClient({
        url: deps.streamUrl,
        factory: deps.eventSource,
        random,
        onEvent: onStreamEvent,
        onStatus: onStreamStatus,
        onClose: onStreamClose,
      });
      unsubTicker = ticker.subscribe((now) => {
        store.getState().recompute(now);
        publishChain(now);
      });
      unsubVisibility = env.onVisibility(onVisibility);
      unsubOnline = env.onOnline(onOnline);

      if (!hidden) {
        armGrace();
        refreshAll();
        sse.start();
        scheduleAll();
      }
      pushDebug();
    },

    stop() {
      if (!running) return;
      running = false;
      pause();
      if (graceTimer) clearTimeout(graceTimer);
      graceTimer = null;
      unsubTicker?.();
      unsubVisibility?.();
      unsubOnline?.();
      unsubTicker = unsubVisibility = unsubOnline = null;
      sse = null;
      sseStatus = 'idle';
      store.getState().setChain({ live: false });
      pushDebug();
    },
  };
}
