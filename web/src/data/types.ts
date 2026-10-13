/**
 * Types of the data layer. `DataState` and `ConnectionState` are a stable contract: other modules
 * (the header, the labs, the scenes, the lessons) code against them. Additions only.
 */

import type { Meta } from '@shared/api';

/**
 * State of the live connection to the API server.
 *
 * - `connecting`  nothing has answered yet
 * - `live`        the SSE stream is open
 * - `polling`     the stream is down but REST works, so numbers are fetched on a timer
 * - `offline`     nothing works (or `?demo=1`): the baked sample is shown, labelled fallback
 */
export type ConnectionState = 'connecting' | 'live' | 'polling' | 'offline';

/**
 * How a resource should be presented.
 *
 * - `loading`   nothing has arrived and no baked sample is shown yet ("Syncing with the chain")
 * - `live`      the server said live and the data is inside its freshness window
 * - `cache`     older than its window, or the server served it from cache; still being refreshed
 * - `fallback`  the baked built-in sample (or a server fallback), shown "as of <meta.asOf>"
 * - `offline`   real data that has aged out while the connection is down ("Showing the last known numbers")
 */
export type DataStatus = 'loading' | 'live' | 'cache' | 'fallback' | 'offline';

/** A payload plus how to present it. `data` is null only while `status` is `loading`. */
export interface DataState<T> {
  data: T | null;
  meta: Meta | null;
  status: DataStatus;
  /** The last request error for this resource, cleared by the next success. */
  error: string | null;
}

/** The four resources the data layer keeps. */
export type ResourceKey = 'network' | 'geo' | 'blocks' | 'pricing';

/** Where a stored payload came from. */
export type RecordOrigin = 'rest' | 'sse' | 'baked';

/** The chain clock as the hook returns it. `nextBlockInMs` is null unless the clock is live. */
export interface ChainClock {
  /** Tip height: the last live observation, or the baked sample height while offline. */
  height: number | null;
  /** Client-clock epoch ms of the tip block's header (skew corrected). Null when unknown or not live. */
  lastBlockAt: number | null;
  /** Milliseconds until the next block is expected. Holds at 0 while overdue. Null unless live. */
  nextBlockInMs: number | null;
  /** The protocol target interval in seconds (30 under Proof of Node). */
  targetSec: number;
  connection: ConnectionState;
  /** Additive: the interval the countdown uses, in ms (the measured mean when sane, else the target). */
  intervalMs: number;
  /** Additive: height and timing come from live observations. When false there is no Beat. */
  live: boolean;
  /** Additive: true only in development with `?demo=1&beat=N`. Blocks are simulated. */
  simulated: boolean;
}

/** Transport diagnostics, for a debug overlay. Not needed for ordinary rendering. */
export interface DataLayerDebug {
  running: boolean;
  demo: boolean;
  hidden: boolean;
  /** `sse` while the stream is open, `polling` while REST polling carries the load. */
  transport: 'none' | 'sse' | 'polling' | 'demo';
  sse: 'idle' | 'connecting' | 'open' | 'backoff';
  sseFailures: number;
  restFailStreak: number;
}
