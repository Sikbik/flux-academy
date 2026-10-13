/**
 * The hooks the rest of the app reads data through. Names and shapes are a stable contract: additions
 * only. Every hook holds the data layer open while mounted (see useLayer.ts) and returns referentially
 * stable values, so a component re-renders only when its own slice changes.
 *
 * Nothing here simulates a live network. When the API is unreachable the baked sample is shown with
 * `status: 'fallback'`, and the chain clock reports no countdown.
 */

import type { BlocksSnapshot, GeoSnapshot, NetworkSnapshot, PricingSnapshot } from '@shared/api';
import { useMemo, useSyncExternalStore } from 'react';
import { getSharedTicker } from './clock';
import { recordAgeMs, type SectionKey, type SectionStatus, sectionStatus } from './freshness';
import { type DataStoreState, useDataStore } from './store';
import type {
  ChainClock,
  ConnectionState,
  DataLayerDebug,
  DataState,
  DataStatus,
  ResourceKey,
} from './types';
import { useLayer } from './useLayer';

const selNetwork = (s: DataStoreState) => s.network;
const selGeo = (s: DataStoreState) => s.geo;
const selBlocks = (s: DataStoreState) => s.blocks;
const selPricing = (s: DataStoreState) => s.pricing;

/** The network snapshot: chain, rewards, nodes, capacity, apps, market, versions. */
export function useNetwork(): DataState<NetworkSnapshot> {
  useLayer();
  return useDataStore(selNetwork);
}

/** The geo snapshot: located nodes, countries and clustered points for the world map. */
export function useGeo(): DataState<GeoSnapshot> {
  useLayer();
  return useDataStore(selGeo);
}

/** Recent blocks (newest last) for the cadence sparkline. */
export function useBlocks(): DataState<BlocksSnapshot> {
  useLayer();
  return useDataStore(selBlocks);
}

/** The official per-resource pricing rates and the FLUX price. */
export function usePricing(): DataState<PricingSnapshot> {
  useLayer();
  return useDataStore(selPricing);
}

/** State of the live connection: `connecting`, `live` (SSE open), `polling` or `offline`. */
export function useConnection(): ConnectionState {
  useLayer();
  return useDataStore((s) => s.connection);
}

/** The tip height. Changes once per block. */
export function useChainHeight(): number | null {
  useLayer();
  return useDataStore((s) => s.chain.height);
}

/**
 * Read one derived value from the network snapshot without re-rendering on every refresh. Re-renders
 * only when the selected value changes. `select` must return a primitive or a stable reference.
 * Returns null until a snapshot exists (the baked sample counts, so check `useNetwork().status`).
 */
export function useNetworkSelect<T>(select: (network: NetworkSnapshot) => T): T | null {
  useLayer();
  return useDataStore((s) => (s.network.data ? select(s.network.data) : null));
}

/** Transport diagnostics for a debug overlay. */
export function useDataLayerDebug(): DataLayerDebug {
  useLayer();
  return useDataStore((s) => s.debug);
}

// ---------------------------------------------------------------------------
// Time-derived hooks (one shared ticker, snapshots cached per tick)
// ---------------------------------------------------------------------------

/**
 * Milliseconds since a resource was fetched upstream (or, for the baked sample, since its `asOf`),
 * updated on the shared one-second ticker. Null when there is nothing yet. Use it for "3 s ago" labels;
 * prefer the plain data hooks when no age is shown, because this one re-renders every second.
 */
export function useDataAge(key: ResourceKey): number | null {
  useLayer();
  const subscribe = (onChange: () => void) => {
    const offTick = getSharedTicker().subscribe(onChange);
    return offTick;
  };
  const getSnapshot = () => {
    const s = useDataStore.getState();
    const rec = s.records[key];
    const age = recordAgeMs(rec, Date.now());
    // Whole seconds, so the snapshot is stable between ticks.
    return age === null ? null : Math.floor(age / 1000) * 1000;
  };
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

const UNKNOWN_SECTION: SectionStatus = { status: 'loading', asOf: null, ageMs: null };

/**
 * Status of one section of the network snapshot. `market` is minutes old, `capacity` is a five-minute
 * figure, `apps` is slower still, so a tile can label its own number honestly. Re-renders only when the
 * status or the upstream stamp changes (not every second); use `useSectionAge` when an age is shown.
 */
export function useSectionStatus(section: SectionKey): {
  status: SectionStatus['status'];
  asOf: string | null;
} {
  useLayer();
  const status = useDataStore(
    (s) => sectionStatus(s.records.network, section, Date.now(), s.connection).status,
  );
  const asOf = useDataStore((s) => sectionStatus(s.records.network, section, Date.now(), s.connection).asOf);
  return useMemo(() => ({ status, asOf }), [status, asOf]);
}

interface SectionCache {
  record: unknown;
  connection: ConnectionState;
  tick: number;
  value: SectionStatus;
}
const sectionCache = new Map<SectionKey, SectionCache>();

function readSection(section: SectionKey): SectionStatus {
  const s = useDataStore.getState();
  const tick = getSharedTicker().tickCount();
  const c = sectionCache.get(section);
  if (c && c.record === s.records.network && c.connection === s.connection && c.tick === tick) return c.value;
  let value = sectionStatus(s.records.network, section, Date.now(), s.connection);
  if (c && c.value.status === value.status && c.value.asOf === value.asOf && c.value.ageMs === value.ageMs) {
    value = c.value;
  }
  sectionCache.set(section, { record: s.records.network, connection: s.connection, tick, value });
  return value;
}

/** A section's status with its age, at one-second resolution. */
export function useSectionAge(section: SectionKey): SectionStatus {
  useLayer();
  return useSyncExternalStore(
    subscribeTickAndNetwork,
    () => readSection(section),
    () => UNKNOWN_SECTION,
  );
}

function subscribeTickAndNetwork(onChange: () => void): () => void {
  const offTick = getSharedTicker().subscribe(onChange);
  const offStore = useDataStore.subscribe((s, p) => {
    if (s.records.network !== p.records.network || s.connection !== p.connection) onChange();
  });
  return () => {
    offTick();
    offStore();
  };
}

/** The FLUX price in USD and its 24 h change, from the network snapshot or the pricing snapshot. */
export function useFluxPrice(): { usd: number | null; change24hPct: number | null; status: DataStatus } {
  useLayer();
  const market = useNetworkSelect((n) => n.market);
  const section = useSectionStatus('market');
  const pricingUsd = useDataStore((s) => s.pricing.data?.fluxUsd ?? null);
  const pricingStatus = useDataStore((s) => s.pricing.status);
  return useMemo(() => {
    if (market) return { usd: market.priceUsd, change24hPct: market.change24hPct, status: section.status };
    if (pricingUsd !== null) return { usd: pricingUsd, change24hPct: null, status: pricingStatus };
    return { usd: null, change24hPct: null, status: pricingStatus };
  }, [market, section.status, pricingUsd, pricingStatus]);
}

// ---------------------------------------------------------------------------
// The chain clock
// ---------------------------------------------------------------------------

const SERVER_CLOCK: ChainClock = {
  height: null,
  lastBlockAt: null,
  nextBlockInMs: null,
  targetSec: 30,
  connection: 'connecting',
  intervalMs: 30_000,
  live: false,
  simulated: false,
};

/** The chain clock at `now`, from the store. Pure given the store state. */
export function readChainClock(
  now: number = Date.now(),
  state: DataStoreState = useDataStore.getState(),
): ChainClock {
  const { chain, connection } = state;
  const live = chain.live && chain.lastBlockAt !== null && connection !== 'offline';
  return {
    height: chain.height,
    lastBlockAt: live ? chain.lastBlockAt : null,
    nextBlockInMs:
      live && chain.lastBlockAt !== null ? Math.max(0, chain.lastBlockAt + chain.intervalMs - now) : null,
    targetSec: chain.targetSec,
    connection,
    intervalMs: chain.intervalMs,
    live,
    simulated: live && chain.simulated,
  };
}

let clockKey: { chain: unknown; connection: ConnectionState; tick: number } | null = null;
let clockView: ChainClock = SERVER_CLOCK;

function sameClock(a: ChainClock, b: ChainClock): boolean {
  return (
    a.height === b.height &&
    a.lastBlockAt === b.lastBlockAt &&
    a.nextBlockInMs === b.nextBlockInMs &&
    a.targetSec === b.targetSec &&
    a.connection === b.connection &&
    a.intervalMs === b.intervalMs &&
    a.live === b.live &&
    a.simulated === b.simulated
  );
}

function computeClockView(): ChainClock {
  const state = useDataStore.getState();
  const tick = getSharedTicker().tickCount();
  if (
    clockKey &&
    clockKey.chain === state.chain &&
    clockKey.connection === state.connection &&
    clockKey.tick === tick
  ) {
    return clockView;
  }
  clockKey = { chain: state.chain, connection: state.connection, tick };
  const next = readChainClock(Date.now(), state);
  if (!sameClock(clockView, next)) clockView = next;
  return clockView;
}

function subscribeClock(onChange: () => void): () => void {
  const offTick = getSharedTicker().subscribe(onChange);
  const offStore = useDataStore.subscribe((s, p) => {
    if (s.chain !== p.chain || s.connection !== p.connection) onChange();
  });
  return () => {
    offTick();
    offStore();
  };
}

/**
 * The chain clock, ticking once a second: height, the time the tip block landed, milliseconds until the
 * next one, the protocol target and the connection state.
 *
 * `lastBlockAt` and `nextBlockInMs` are null unless the clock is anchored to live observations, so a
 * baked or offline page can never show a countdown. Hold the Beat on `onBlock`, not on this hook.
 */
export function useChainClock(): ChainClock {
  useLayer();
  return useSyncExternalStore(subscribeClock, computeClockView, () => SERVER_CLOCK);
}
