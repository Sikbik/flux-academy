/**
 * Types of the headless simulation. Everything here is plain data: the renderer, the React layer and the
 * tests all read the same objects.
 */
import type { Bench, Region, Tier } from '../model/types';

/** Size class of the simulated app. It decides which node tiers consider it first (FACTS 2.4). */
export type AppSize = 'small' | 'medium' | 'large';

/**
 * How the app's data volume is mounted (FACTS section 7):
 * - `local`            a plain `containerData` path: one volume on one node, lost when the node is lost
 * - `replicated`       `r:` (and `s:`): every instance holds a Syncthing replica and serves
 * - `primary-standby`  `g:`: every instance holds a replica, only the elected primary runs and serves
 */
export type VolumeMode = 'local' | 'replicated' | 'primary-standby';

export type VolumeRole = 'none' | 'local' | 'active' | 'primary' | 'standby';

/**
 * `unplaced`  no eligible node was found for this slot
 * `starting`  a node picked the app up and is installing and starting it
 * `running`   the container is up (it serves when its node is up and it is in rotation)
 * `crashed`   its node went offline; the router may not know yet
 */
export type InstanceStatus = 'unplaced' | 'starting' | 'running' | 'crashed';

export interface Instance {
  /** Position in the app's instance list, 0-based and stable while the slot exists. */
  slot: number;
  /** Counts incarnations of this slot (placement, respawn): a new serial is a new container. */
  serial: number;
  /** Index into `bench.nodes`, -1 when unplaced. */
  node: number;
  nodeId: string;
  status: InstanceStatus;
  /** Whether the load balancer currently sends requests here (its belief, not the truth). */
  inRotation: boolean;
  /** Whether it can actually answer a request right now. */
  serving: boolean;
  /** Sim time of the last status change, ms. */
  since: number;
  placedAt: number;
  /** 0..1 progress of the current start. */
  startProgress: number;
  role: VolumeRole;
  /** 0..1 volume replication progress (1 for a local volume and for the first instance). */
  sync: number;
  /** This incarnation replaced a lost one. */
  respawned: boolean;
  /**
   * The replacement started with an empty volume: a plain (`local`) volume went with its lost node, or the
   * last synced copy did (FACTS 7.2). A new volume mode clears it. The figure draws it as `lost-data`.
   */
  dataLost: boolean;
  /** Minutes the app waited before a node of this tier considered it (FACTS 2.4), as modelled. */
  waitedMin: number;
  /** Requests this incarnation answered. */
  served: number;
}

export type PacketOutcome = 'flying' | 'stalled' | 'served' | 'failed';

/**
 * A request in flight. Geometry is symbolic so the renderer can draw it in any scene: the packet leaves
 * `userIndex` at `t0`, reaches the proxy (the load balancer, one schematic point above the bench) at
 * `tProxy`, and reaches the node of `target` at `tArrive`. A redirect keeps the packet moving from where
 * it is toward the new target and bumps `retargets`.
 */
export interface Packet {
  id: number;
  /** Index into `bench.users`. */
  userIndex: number;
  userId: string;
  /** Node index of the origin when the request was sent from a node (see `SimSource`), else -1. */
  originNode: number;
  /** Slot it is heading to or was served by, -1 when none. */
  slot: number;
  /** Node index it is heading to, -1 when none. */
  target: number;
  t0: number;
  tProxy: number;
  tArrive: number;
  /** Sim time of the last redirect, -1 when none. */
  redirectAt: number;
  /** Node it was heading to before the last redirect, -1 when none. */
  redirectFrom: number;
  retargets: number;
  outcome: PacketOutcome;
  /** Set when it ends (served or failed). */
  doneAt: number;
  /** Modelled round trip, ms, valid when served. */
  latencyMs: number;
  /** When a served packet's reply reaches the user (for drawing the return). */
  tReturn: number;
}

export type DeployPhase = 'spec' | 'register' | 'block' | 'select' | 'install' | 'live';

export interface DeployState {
  active: boolean;
  /** The finished deploy stays at `live` with `active` false until the next one. */
  phase: DeployPhase | null;
  /** 0-based index of the phase, -1 when idle. */
  index: number;
  /** 0..1 progress inside the current phase. */
  phaseProgress: number;
  /** 0..1 progress across the whole timeline. */
  progress: number;
  startedAt: number;
  /** Instances this deploy will place. */
  target: number;
  /** Node indices the network is "considering" during selection (for a flicker). */
  candidates: number[];
}

export interface VolumeState {
  mode: VolumeMode;
  /** Slot of the elected primary (primary-standby), -1 when there is none. */
  primarySlot: number;
  /** True while a primary-standby volume has no running primary (writes are unavailable). */
  gap: boolean;
  /** Sim time the current gap began, -1 when none. */
  gapSince: number;
  /** Total time spent without a primary, ms. */
  gapTotalMs: number;
  /** Length of the last gap, ms (0 before the first promotion). */
  lastGapMs: number;
  promotions: number;
}

export interface Counters {
  sent: number;
  served: number;
  /** Requests that reached a survivor only after the proxy redispatched them. */
  rerouted: number;
  failed: number;
  /** Nodes taken offline by `kill` or `killRegion` since the last reset (a node killed twice counts twice). */
  kills: number;
  /** Distinct nodes taken offline since the last reset. */
  distinctKills: number;
  respawns: number;
  placements: number;
}

/**
 * `idle` no instances (or a deploy that has not placed any yet), `starting` instances are installing,
 * `up` every instance is healthy, `degraded` at least one serves and at least one does not, `down` the
 * app has instances and none can answer.
 */
export type AppStatus = 'idle' | 'starting' | 'up' | 'degraded' | 'down';

export interface AppState {
  status: AppStatus;
  total: number;
  /** Instances that can answer a request now. */
  healthy: number;
  /** Instances the router sends traffic to. */
  inRotation: number;
  /** Fraction of observed time with at least one serving instance, 0..1 (1 before any observation). */
  availability: number;
  upMs: number;
  downMs: number;
}

/** What `setInstances` and friends use to choose nodes. Omitted fields keep their previous values. */
export interface PlaceOptions {
  /** Restrict to these continents (a Flux `ac<CONT>` allow list). Empty array clears the restriction. */
  regions?: readonly Region[];
  /** Restrict to these countries (ISO alpha-2), allow list. */
  countries?: readonly string[];
  /** Never place on these continents (a Flux `a!c<CONT>` deny list). */
  denyRegions?: readonly Region[];
  /** `random`: uniform among eligible nodes. `regions`: a teaching layout that fills continents evenly. */
  spread?: 'random' | 'regions';
  appSize?: AppSize;
  /** Minutes the app is assumed to have waited (see FACTS 2.4). */
  waitedMin?: number;
  volume?: VolumeMode;
}

export interface SimOptions {
  bench: Bench;
  seed?: number;
  /** Deep partial override of the default rules (see `rules.ts`). */
  rules?: import('./rules').RulesPatch;
  /** Starting options for placement (same shape as `setInstances`'s). */
  place?: PlaceOptions;
}

/** A request source: a user spot id, a coordinate, or a node id. */
export type SimSource = string | { lat: number; lon: number } | { node: string };

export interface SimState {
  /** Sim time in ms. */
  time: number;
  /** Number of instance slots (length of `instances`). */
  count: number;
  instances: Instance[];
  /** 1 where the node is up, by bench node index. */
  nodeUp: Uint8Array;
  /** Node ids currently down, in the order they went down. */
  down: string[];
  /** Requests in flight or just finished (kept for a short echo so the renderer can draw them). */
  packets: Packet[];
  volume: VolumeState;
  deploy: DeployState;
  counters: Counters;
  app: AppState;
  /** Where the proxy sits, in bench coordinates (schematic: above the middle of the bench). */
  proxy: { x: number; y: number };
  /** Current placement options in effect. */
  place: Required<Pick<PlaceOptions, 'spread' | 'appSize' | 'waitedMin' | 'volume'>> & {
    regions: readonly Region[];
    countries: readonly string[];
    denyRegions: readonly Region[];
  };
}

export type SimEvent =
  | {
      type: 'placed';
      at: number;
      slot: number;
      node: number;
      nodeId: string;
      label: string;
      region: Region;
      tier: Tier;
      respawn: boolean;
      dataLost: boolean;
    }
  | { type: 'unplaced'; at: number; slot: number; reason: string }
  | { type: 'removed'; at: number; slot: number; nodeId: string }
  | { type: 'running'; at: number; slot: number; nodeId: string }
  | { type: 'instances'; at: number; count: number }
  | {
      type: 'node-down';
      at: number;
      node: number;
      nodeId: string;
      label: string;
      region: Region;
      /** Slots whose instance was running on the node. */
      slots: number[];
      /** `region` when the whole continent was taken offline. */
      scope: 'node' | 'region';
    }
  | {
      type: 'node-up';
      at: number;
      node: number;
      nodeId: string;
      label: string;
      region: Region;
      slots: number[];
    }
  | { type: 'region-down'; at: number; region: Region; nodes: number; instances: number }
  | { type: 'ejected'; at: number; slot: number; nodeId: string }
  | { type: 'joined'; at: number; slot: number; nodeId: string }
  | {
      type: 'rerouted';
      at: number;
      packet: number;
      userId: string;
      from: number;
      to: number;
      fromNodeId: string;
      toNodeId: string;
      retries: number;
    }
  | {
      type: 'served';
      at: number;
      packet: number;
      userId: string;
      slot: number;
      nodeId: string;
      latencyMs: number;
      rerouted: boolean;
    }
  | {
      type: 'failed';
      at: number;
      packet: number;
      userId: string;
      reason: 'no-healthy-instance' | 'retries-exhausted';
    }
  | { type: 'promoted'; at: number; slot: number; nodeId: string; previousSlot: number; gapMs: number }
  | { type: 'volume-gap'; at: number; slot: number }
  | { type: 'synced'; at: number; slot: number; nodeId: string }
  | { type: 'app-status'; at: number; status: AppStatus; healthy: number; total: number }
  | { type: 'deploy-phase'; at: number; phase: DeployPhase; index: number; count: number }
  | { type: 'deploy-done'; at: number }
  | { type: 'reset'; at: number };

export type SimEventType = SimEvent['type'];

export type SimEventOf<T extends SimEventType> = Extract<SimEvent, { type: T }>;

export interface Sim {
  readonly bench: Bench;
  /** Sets how many instances the app has. Ends a running deploy. Returns the count actually placed. */
  setInstances(n: number, opts?: PlaceOptions): number;
  /** Changes placement options; instances that no longer satisfy them are re-placed. */
  configure(opts: PlaceOptions): void;
  /** Takes a node offline. False when it does not exist or is already down. */
  kill(nodeId: string): boolean;
  /** Takes the node of a random running instance offline. Returns its id, or null when none. */
  killRandomInstanceNode(): string | null;
  /** Takes the elected primary's node offline (falls back to a random instance). Returns its id. */
  killPrimary(): string | null;
  /** Takes every node of a continent offline. Returns the ids taken down. */
  killRegion(region: Region): string[];
  /** Brings a node back. False when it does not exist or is already up. */
  revive(nodeId: string): boolean;
  reviveAll(): void;
  /** Sends one request. Returns the packet id, or -1 when the packet pool is full. */
  send(from?: SimSource): number;
  /** Clears the bench and runs the deploy timeline (spec, register, block, select, install, live). */
  startDeploy(opts?: { instances?: number }): void;
  /** Advances simulated time by `dtMs` in fixed steps. */
  tick(dtMs: number): void;
  /** Runs the clock forward until nothing is pending (bounded). For tests and jumping to the end state. */
  settle(maxMs?: number): void;
  /**
   * True while anything is still in motion: a timer is queued, a replica is syncing or a request is in
   * flight. False in a steady state, so a calm (reduced motion) clock can stop ticking.
   */
  busy(): boolean;
  /** The live state object. Same reference every call; do not mutate and do not keep across ticks. */
  state(): Readonly<SimState>;
  /** Subscribes to one event type, or `'*'` for all. Returns the unsubscribe function. */
  on<T extends SimEventType>(type: T, fn: (e: SimEventOf<T>) => void): () => void;
  on(type: '*', fn: (e: SimEvent) => void): () => void;
  /** Node index by id, -1 when unknown. */
  nodeIndex(nodeId: string): number;
  /** Back to an empty, healthy bench. Keeps rules and placement options; `seed` replaces the seed. */
  reset(seed?: number): void;
}
