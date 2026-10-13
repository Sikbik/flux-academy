/**
 * How trustworthy a number is right now. Pure functions over a stored record and a clock reading.
 *
 * Rules (docs/DESIGN.md section 8):
 * - `loading`   nothing has arrived and nothing is baked in yet.
 * - `fallback`  the baked sample is shown, or the server itself said `fallback`. Never live.
 * - `offline`   real data that is past its window while the connection is down.
 * - `cache`     the server said `cache`/`stale`, or the data is older than its window, and the
 *               connection is up (a refresh is on its way).
 * - `live`      the server said `live` and the data is younger than its window.
 *
 * Adapted from fluxcommunity/web/src/data/freshness.ts (same owner, MIT).
 */

import type { BlocksSnapshot, GeoSnapshot, Meta, NetworkSnapshot, PricingSnapshot } from '@shared/api';
import type { ConnectionState, DataState, DataStatus, RecordOrigin, ResourceKey } from './types';

/** How long a payload counts as fresh, per resource. */
export const FRESH_WINDOW_MS: Readonly<Record<ResourceKey, number>> = {
  network: 45_000,
  geo: 15 * 60_000,
  blocks: 90_000,
  pricing: 5 * 60_000,
};

export interface Payloads {
  network: NetworkSnapshot;
  geo: GeoSnapshot;
  blocks: BlocksSnapshot;
  pricing: PricingSnapshot;
}

export interface RawRecord<T> {
  data: T;
  meta: Meta;
  /** Client clock (epoch ms) when this arrived. Age is measured from here, so skew never matters. */
  receivedAt: number;
  origin: RecordOrigin;
}

export const LOADING: DataState<never> = { data: null, meta: null, status: 'loading', error: null };

/** True when a record is the baked sample or the server called it a fallback. */
export function isFallback(rec: RawRecord<unknown> | null): boolean {
  return rec !== null && (rec.origin === 'baked' || rec.meta.source === 'fallback');
}

/** Age of a record in milliseconds at `now`, or null when there is no record. */
export function recordAgeMs(rec: RawRecord<unknown> | null, now: number): number | null {
  if (!rec) return null;
  if (isFallback(rec)) {
    const asOf = Date.parse(rec.meta.asOf);
    return Number.isFinite(asOf) ? Math.max(0, now - asOf) : null;
  }
  return Math.max(0, rec.meta.ageMs + (now - rec.receivedAt));
}

export function statusOf(
  key: ResourceKey,
  rec: RawRecord<unknown> | null,
  now: number,
  connection: ConnectionState,
): DataStatus {
  if (!rec) return 'loading';
  if (isFallback(rec)) return 'fallback';
  const age = recordAgeMs(rec, now) ?? Number.POSITIVE_INFINITY;
  const past = rec.meta.stale || age >= FRESH_WINDOW_MS[key];
  if (past) return connection === 'offline' ? 'offline' : 'cache';
  return rec.meta.source === 'live' ? 'live' : 'cache';
}

/**
 * The `DataState` view of a record. Reuses `prev` (the same object) when nothing visible changed, so
 * selectors keep stable references between ticks and a component re-renders only when its slice does.
 */
export function viewOf<T>(
  key: ResourceKey,
  rec: RawRecord<T> | null,
  error: string | null,
  now: number,
  connection: ConnectionState,
  prev: DataState<T>,
): DataState<T> {
  if (!rec) {
    if (prev.status === 'loading' && prev.data === null && prev.error === error) return prev;
    return { data: null, meta: null, status: 'loading', error };
  }
  const status = statusOf(key, rec, now, connection);
  if (prev.data === rec.data && prev.meta === rec.meta && prev.status === status && prev.error === error) {
    return prev;
  }
  return { data: rec.data, meta: rec.meta, status, error };
}

// ---------------------------------------------------------------------------
// Per-section freshness (NetworkSnapshot.freshness)
// ---------------------------------------------------------------------------

export type SectionKey = 'chain' | 'nodes' | 'capacity' | 'apps' | 'market';

/**
 * How long each network section counts as fresh. They refresh on very different schedules (chain and
 * node counts every few seconds, price every minute, capacity every 5 minutes, app counts every 10 to
 * 30 minutes), so one window for the whole snapshot would mislabel the slow ones.
 */
export const SECTION_WINDOW_MS: Readonly<Record<SectionKey, number>> = {
  chain: 45_000,
  nodes: 45_000,
  capacity: 15 * 60_000,
  apps: 45 * 60_000,
  market: 5 * 60_000,
};

export interface SectionStatus {
  status: DataStatus;
  /** ISO time the section was last refreshed upstream, or the snapshot's own `asOf` as a fallback. */
  asOf: string | null;
  /** Milliseconds since `asOf`, as of `now`. */
  ageMs: number | null;
}

const SECTION_UNKNOWN: SectionStatus = { status: 'loading', asOf: null, ageMs: null };

/**
 * Status of one section of the network snapshot. The age is `meta.generatedAt - stamp` (both server
 * clock, so skew cancels) plus the time since the snapshot arrived. A null stamp means the section has
 * never been fetched upstream, so it is `loading` rather than something it is not.
 */
export function sectionStatus(
  rec: RawRecord<NetworkSnapshot> | null,
  section: SectionKey,
  now: number,
  connection: ConnectionState,
): SectionStatus {
  if (!rec) return SECTION_UNKNOWN;
  const whole = statusOf('network', rec, now, connection);
  const wholeAge = recordAgeMs(rec, now);
  if (isFallback(rec)) return { status: 'fallback', asOf: rec.meta.asOf, ageMs: wholeAge };
  const stamp = rec.data.freshness?.[section];
  if (stamp === undefined) {
    // A server without per-section stamps: the whole snapshot's status is all there is.
    return { status: whole, asOf: rec.meta.asOf, ageMs: wholeAge };
  }
  if (stamp === null) return SECTION_UNKNOWN;
  const stampMs = Date.parse(stamp);
  const generatedMs = Date.parse(rec.meta.generatedAt);
  if (!Number.isFinite(stampMs) || !Number.isFinite(generatedMs)) {
    return { status: whole, asOf: stamp, ageMs: null };
  }
  const sinceArrival = Math.max(0, now - rec.receivedAt);
  const ageMs = Math.max(0, generatedMs - stampMs + sinceArrival);
  const past = ageMs >= SECTION_WINDOW_MS[section];
  const status: DataStatus = past ? (connection === 'offline' ? 'offline' : 'cache') : 'live';
  return { status, asOf: stamp, ageMs };
}
