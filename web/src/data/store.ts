/**
 * The data store: the latest `DataState<T>` per resource, the connection state, per-resource last-
 * success times, the last error per resource and the chain tip as the page sees it.
 *
 * Design rules
 * - Each resource keeps a raw record (payload, meta, arrival time, origin). The `DataState` view
 *   components read is derived from it, and the same object is reused until something visible changes,
 *   so selectors do not cause renders by accident.
 * - Real data is never replaced by the baked sample. The sample only ever fills an empty slot.
 * - Incoming payloads are structurally shared with the previous one, so an unchanged part of a payload
 *   keeps its reference.
 * - `recompute(now)` is called from the single shared one-second ticker. No hook has its own timer.
 *
 * Adapted from fluxcommunity/web/src/data/store.ts (same owner, MIT).
 */

import type { BlockEvent, BlockSummary, Meta } from '@shared/api';
import { create } from 'zustand';
import type { BakedSet } from './baked';
import { LOADING, type Payloads, type RawRecord, viewOf } from './freshness';
import type { ConnectionState, DataLayerDebug, DataState, RecordOrigin, ResourceKey } from './types';

export const RESOURCE_KEYS: readonly ResourceKey[] = ['network', 'geo', 'blocks', 'pricing'];
const MAX_BLOCKS = 120;

export interface ChainState {
  height: number | null;
  /** Client-clock epoch ms of the tip block header, skew corrected. Null when unknown. */
  lastBlockAt: number | null;
  intervalMs: number;
  targetSec: number;
  /** True only while height and timing are confirmed by live data (or by the dev simulation). */
  live: boolean;
  /** True only for the development-only simulated beat (`?demo=1&beat=N`). */
  simulated: boolean;
}

export interface IngestOptions {
  /** Client clock (epoch ms) when the data arrived. */
  receivedAt: number;
  origin: RecordOrigin;
  /** Client clock when the request was issued, for ordering REST responses against stream events. */
  requestStartedAt?: number;
}

export type Records = { [K in ResourceKey]: RawRecord<Payloads[K]> | null };
export type Errors = Record<ResourceKey, string | null>;

export interface DataStoreState {
  network: DataState<Payloads['network']>;
  geo: DataState<Payloads['geo']>;
  blocks: DataState<Payloads['blocks']>;
  pricing: DataState<Payloads['pricing']>;
  connection: ConnectionState;
  /** Client-clock epoch ms of the last real (non-baked) update per resource. */
  lastSuccess: Record<ResourceKey, number | null>;
  /** serverClock minus clientClock, in ms. Subtract this from server times to get client time. */
  skewMs: number;
  skewSource: 'none' | 'rest' | 'hello';
  chain: ChainState;
  debug: DataLayerDebug;
  /** Internal: the raw records the views are derived from. */
  records: Records;
  errors: Errors;

  ingest: <K extends ResourceKey>(key: K, data: Payloads[K], meta: Meta, opts: IngestOptions) => boolean;
  appendBlock: (event: BlockEvent, receivedAt: number) => boolean;
  /** Fill still-empty slots with the baked sample, labelled fallback. Never replaces real data. */
  applyBaked: (set: BakedSet, keys?: readonly ResourceKey[], now?: number) => void;
  /** Mark a record as just confirmed (a simulated or no-op refresh) without changing its payload. */
  touch: (key: ResourceKey, now: number) => void;
  setError: (key: ResourceKey, message: string | null, now?: number) => void;
  setConnection: (connection: ConnectionState, now?: number) => void;
  setSkew: (skewMs: number, source: 'rest' | 'hello') => void;
  setChain: (chain: Partial<ChainState>) => void;
  setDebug: (debug: Partial<DataLayerDebug>) => void;
  recompute: (now: number) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Return `prev` (and its sub-objects) wherever `next` is deep-equal to it, so unchanged parts of a
 * payload keep their identity from one update to the next.
 */
export function shareStructure<T>(prev: unknown, next: T): T {
  if (prev === (next as unknown)) return next;
  if (Array.isArray(prev) && Array.isArray(next)) {
    let same = prev.length === next.length;
    const out = next.map((item, i) => {
      const shared = shareStructure(prev[i], item);
      if (shared !== prev[i]) same = false;
      return shared;
    });
    return (same ? prev : out) as T;
  }
  if (isPlain(prev) && isPlain(next)) {
    const nextKeys = Object.keys(next);
    let same = Object.keys(prev).length === nextKeys.length;
    const out: Record<string, unknown> = {};
    for (const k of nextKeys) {
      const shared = shareStructure(prev[k], next[k]);
      out[k] = shared;
      if (shared !== prev[k] || !(k in prev)) same = false;
    }
    return (same ? prev : out) as T;
  }
  return next;
}

/** Union of two block lists by height, newest last, capped. */
export function mergeBlocks(
  prev: readonly BlockSummary[],
  incoming: readonly BlockSummary[],
): BlockSummary[] {
  const byHeight = new Map<number, BlockSummary>();
  for (const b of prev) byHeight.set(b.height, b);
  for (const b of incoming) byHeight.set(b.height, b);
  return [...byHeight.values()].sort((a, b) => a.height - b.height).slice(-MAX_BLOCKS);
}

const EMPTY_LAST: Record<ResourceKey, number | null> = {
  network: null,
  geo: null,
  blocks: null,
  pricing: null,
};
const EMPTY_RECORDS: Records = { network: null, geo: null, blocks: null, pricing: null };
const EMPTY_ERRORS: Errors = { network: null, geo: null, blocks: null, pricing: null };

const INITIAL_DEBUG: DataLayerDebug = {
  running: false,
  demo: false,
  hidden: false,
  transport: 'none',
  sse: 'idle',
  sseFailures: 0,
  restFailStreak: 0,
};

const INITIAL_CHAIN: ChainState = {
  height: null,
  lastBlockAt: null,
  intervalMs: 30_000,
  targetSec: 30,
  live: false,
  simulated: false,
};

type Views = Pick<DataStoreState, ResourceKey>;

function deriveViews(
  records: Records,
  errors: Errors,
  views: Views,
  now: number,
  connection: ConnectionState,
): Partial<Views> {
  const out: Partial<Views> = {};
  for (const key of RESOURCE_KEYS) {
    const next = viewOf(
      key,
      records[key] as RawRecord<unknown> | null,
      errors[key],
      now,
      connection,
      views[key] as DataState<unknown>,
    );
    if (next !== views[key]) (out as Record<string, unknown>)[key] = next;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export type DataStore = ReturnType<typeof createDataStore>;

/** A fresh, isolated store. The app uses the shared `useDataStore`; tests make their own. */
export function createDataStore() {
  return create<DataStoreState>()((set, get) => ({
    network: LOADING,
    geo: LOADING,
    blocks: LOADING,
    pricing: LOADING,
    connection: 'connecting',
    lastSuccess: EMPTY_LAST,
    skewMs: 0,
    skewSource: 'none',
    chain: INITIAL_CHAIN,
    debug: INITIAL_DEBUG,
    records: EMPTY_RECORDS,
    errors: EMPTY_ERRORS,

    ingest(key, data, meta, opts) {
      const s = get();
      const prev = s.records[key] as RawRecord<unknown> | null;
      const real = prev !== null && prev.origin !== 'baked' && prev.meta.source !== 'fallback';

      // Ordering: never let an older response overwrite newer information.
      if (real && opts.origin === 'rest') {
        if (key === 'network') {
          const a = (data as Payloads['network']).chain.height;
          const b = (prev.data as Payloads['network']).chain.height;
          if (a < b) return false;
        }
      }

      let payload: unknown = data;
      if (key === 'blocks' && real) {
        const d = data as Payloads['blocks'];
        payload = { blocks: mergeBlocks((prev.data as Payloads['blocks']).blocks, d.blocks) };
      }
      if (prev) payload = shareStructure(prev.data, payload);

      const rec: RawRecord<unknown> = {
        data: payload,
        meta,
        receivedAt: opts.receivedAt,
        origin: opts.origin,
      };
      const records = { ...s.records, [key]: rec } as Records;
      const errors = s.errors[key] === null ? s.errors : { ...s.errors, [key]: null };
      // `lastSuccess` is for real data only: a payload the server itself labels fallback does not count.
      const lastSuccess =
        opts.origin === 'baked' || meta.source === 'fallback'
          ? s.lastSuccess
          : { ...s.lastSuccess, [key]: opts.receivedAt };
      set({
        records,
        errors,
        lastSuccess,
        ...deriveViews(records, errors, s, opts.receivedAt, s.connection),
      });
      return true;
    },

    appendBlock(event, receivedAt) {
      const s = get();
      const prev = s.records.blocks;
      if (!prev || prev.origin === 'baked' || prev.meta.source === 'fallback') return false;
      const list = prev.data.blocks;
      const last = list[list.length - 1];
      if (last && event.height <= last.height) return false;
      const interval =
        last && last.height === event.height - 1
          ? Math.max(0, (Date.parse(event.time) - Date.parse(last.time)) / 1000)
          : null;
      const entry: BlockSummary = {
        height: event.height,
        time: event.time,
        intervalSec: interval !== null && Number.isFinite(interval) ? interval : null,
        txCount: event.txCount,
      };
      const iso = new Date(receivedAt + s.skewMs).toISOString();
      const meta: Meta = { generatedAt: iso, asOf: iso, ageMs: 0, stale: false, source: 'live' };
      const rec: RawRecord<Payloads['blocks']> = {
        data: { blocks: [...list, entry].slice(-MAX_BLOCKS) },
        meta,
        receivedAt,
        origin: 'sse',
      };
      const records: Records = { ...s.records, blocks: rec };
      set({
        records,
        lastSuccess: { ...s.lastSuccess, blocks: receivedAt },
        ...deriveViews(records, s.errors, s, receivedAt, s.connection),
      });
      return true;
    },

    applyBaked(baked, keys = RESOURCE_KEYS, now = Date.now()) {
      const s = get();
      let records = s.records;
      for (const key of keys) {
        if (records[key] !== null) continue;
        const rec: RawRecord<unknown> = {
          data: baked[key],
          meta: baked.meta,
          receivedAt: now,
          origin: 'baked',
        };
        records = { ...records, [key]: rec } as Records;
      }
      if (records === s.records) return;
      set({ records, ...deriveViews(records, s.errors, s, now, s.connection) });
    },

    touch(key, now) {
      const s = get();
      const prev = s.records[key] as RawRecord<unknown> | null;
      if (!prev) return;
      const rec: RawRecord<unknown> = { ...prev, receivedAt: now, meta: { ...prev.meta, ageMs: 0 } };
      const records = { ...s.records, [key]: rec } as Records;
      set({
        records,
        lastSuccess: { ...s.lastSuccess, [key]: now },
        ...deriveViews(records, s.errors, s, now, s.connection),
      });
    },

    setError(key, message, now = Date.now()) {
      const s = get();
      if (s.errors[key] === message) return;
      const errors = { ...s.errors, [key]: message };
      set({ errors, ...deriveViews(s.records, errors, s, now, s.connection) });
    },

    setConnection(connection, now = Date.now()) {
      const s = get();
      if (s.connection === connection) return;
      set({ connection, ...deriveViews(s.records, s.errors, s, now, connection) });
    },

    setSkew(skewMs, source) {
      const s = get();
      if (source === 'rest' && s.skewSource === 'hello') return;
      if (s.skewMs === skewMs && s.skewSource === source) return;
      set({ skewMs, skewSource: source });
    },

    setChain(chain) {
      const s = get();
      const next = { ...s.chain, ...chain };
      if (
        next.height === s.chain.height &&
        next.lastBlockAt === s.chain.lastBlockAt &&
        next.intervalMs === s.chain.intervalMs &&
        next.targetSec === s.chain.targetSec &&
        next.live === s.chain.live &&
        next.simulated === s.chain.simulated
      ) {
        return;
      }
      set({ chain: next });
    },

    setDebug(debug) {
      const s = get();
      const next = { ...s.debug, ...debug };
      const same = (Object.keys(next) as Array<keyof DataLayerDebug>).every((k) => next[k] === s.debug[k]);
      if (!same) set({ debug: next });
    },

    recompute(now) {
      const s = get();
      const views = deriveViews(s.records, s.errors, s, now, s.connection);
      if (Object.keys(views).length > 0) set(views);
    },

    reset() {
      set({
        network: LOADING,
        geo: LOADING,
        blocks: LOADING,
        pricing: LOADING,
        connection: 'connecting',
        lastSuccess: EMPTY_LAST,
        skewMs: 0,
        skewSource: 'none',
        chain: INITIAL_CHAIN,
        debug: INITIAL_DEBUG,
        records: EMPTY_RECORDS,
        errors: EMPTY_ERRORS,
      });
    },
  }));
}

/** The app-wide store. Creating it has no side effects. */
export const useDataStore = createDataStore();
