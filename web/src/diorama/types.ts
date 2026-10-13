/**
 * The public types of the diorama component. Import from `@/diorama`.
 */
import type { GeoSnapshot, Meta, NetworkSnapshot } from '@shared/api';
import type { Ref } from 'react';
import type { Bench, Region, Resolution, Tier } from './model/types';
import type { EngineStats } from './render/engine';
import type { SceneId } from './render/scenes';
import type { PlaceOptions, Sim, SimEvent, SimEventType, SimSource, SimState, VolumeMode } from './sim/types';

export type { SceneId } from './render/scenes';
export { SCENE_IDS } from './render/scenes';

/**
 * The built-in controls a scene can show. Omit them all for a non-interactive illustration.
 *
 * `kill` takes one instance's node offline; `kill-region` ("Break region") takes every node of one
 * continent offline: the chosen one (`region`), else the one holding the most running instances.
 */
export type DioramaControl =
  | 'instances'
  | 'kill'
  | 'kill-region'
  | 'revive'
  | 'request'
  | 'region'
  | 'replay';

/** The tier filter of the census scenes. */
export type TierFilter = Tier | 'all';

/** A node that was taken offline. `distinct` counts distinct nodes since the last reset. */
export interface NodeKilledInfo {
  nodeId: string;
  label: string;
  region: Region;
  /** Instances that were running on it. */
  slots: number[];
  distinct: number;
  /** Where the kill came from. */
  source: 'control' | 'canvas' | 'keyboard' | 'handle';
}

/** A request the visitor sent (explicit sends only, never the ambient traffic). */
export interface RequestInfo {
  packet: number;
  /** Explicit sends since mount or the last reset. */
  count: number;
}

export interface PromotedInfo {
  nodeId: string;
  label: string;
  gapMs: number;
}

/** The node under the pointer or in keyboard focus. */
export interface HoverNodeInfo {
  /** Index into `bench.nodes`. */
  index: number;
  nodeId: string;
  /** ISO 3166-1 alpha-2, or '' when unknown. */
  cc: string;
  country: string;
  /** "Frankfurt, Germany" in the sample world; "Germany (cluster of 312 nodes)" on a live bench. */
  label: string;
  region: Region;
  /** The dominant tier of the pillar. */
  tier: Tier;
  /** Real nodes the pillar stands for (1 in the sample world). */
  count: number;
}

export interface DioramaProps {
  /** Which scene to show. See web/src/diorama/README.md for each scene and its named annotations. */
  scene: SceneId;
  /**
   * The number of app instances. Applied on mount and again whenever the value changes; the built-in
   * slider (when `controls` has `instances`) moves away from it and reports through `onInstances`.
   * Default depends on the scene: 0 for `tiers` and `network`, 3 for the rest.
   */
  instances?: number;
  /** Built-in controls to show in the bar under the figure. */
  controls?: readonly DioramaControl[];
  /** Use the real geography when `geo` is provided (clusters of real nodes) instead of the sample world. */
  live?: boolean;
  /** The geo snapshot to build the live bench from (from `useGeo().data`). */
  geo?: GeoSnapshot | null;
  /** Its envelope meta, for the LIVE or CACHED chip (from `useGeo().meta`). */
  geoMeta?: Meta | null;
  /** The network snapshot, for the headline totals of the `tiers` and `network` scenes. */
  network?: NetworkSnapshot | null;
  /** Named annotations to draw. Omit for the scene's defaults; unknown names are ignored. */
  annotate?: readonly string[];
  /** A continent code (`EU`, `NA`, ...) to frame and, in placement scenes, to restrict instances to. */
  region?: string | null;
  /**
   * ISO alpha-2 country codes to light up; every other pillar dims. Empty or omitted means no highlight.
   * Works on both benches (a live cluster carries its dominant country).
   */
  highlight?: readonly string[];
  /** Controlled tier filter for the census scenes (`tiers`, `network`). Omit to let the built-in chips own it. */
  tier?: TierFilter;
  /** Fires when the built-in tier chips change the filter. */
  onTierChange?: (tier: TierFilter) => void;
  /** Simulation seed (default 1): the same seed gives the same placement and the same failures. */
  seed?: number;
  /** Placement options (spread, app size, waited minutes, volume mode). */
  place?: PlaceOptions;
  /**
   * The volume mode of the app's data (FACTS 7): `local` (a plain path, lost with its node), `replicated`
   * (`r:`) or `primary-standby` (`g:`). Default is what each scene does today: `primary-standby` in `sync`,
   * `local` elsewhere. Choosing one shows the "Volume: ..." chip, and in `failover` with `local` it turns
   * the `lost-data` annotation on. Wins over `place.volume`.
   */
  volume?: VolumeMode;
  /** Terrain density. Default follows the quality tier: low, default, high. */
  resolution?: Resolution;
  /** The domain shown by the `domain` annotation. Default `myapp.app.runonflux.io`. */
  domain?: string;
  /** Port numbers shown by the `ports` annotation. */
  ports?: { external?: number; container?: number };
  /** Upper bound of the built-in instances slider. Default 12. */
  maxInstances?: number;
  /**
   * Ambient requests per second while the app runs (default 0.9 in `failover`, none elsewhere). They emit
   * the same `served` and `failed` events as any request but are never reported through `onRequest`.
   */
  requestRate?: number;
  /** In the `deploy` scene, run the pipeline when the figure mounts (default true). */
  autoDeploy?: boolean;
  /** Hide the built-in control bar and chips (for pages that draw their own around the handle). */
  bare?: boolean;
  /** Hide the data freshness chip (a frame that already says SIMULATION). The status chip stays. */
  hideFreshness?: boolean;
  /**
   * When this value changes the figure re-applies `instances` as if freshly mounted, without reporting
   * it through `onInstances` (a lesson step that restates its starting number). Kills and the clock stay.
   */
  resetKey?: string | number;
  /** Freeze the figure (the stage is off screen or a dialog is open). */
  paused?: boolean;
  /** Overrides the visitor's reduced motion preference (tests and the lab). */
  reducedMotion?: boolean;
  /** CSS aspect ratio of the figure, for example `16 / 9`. */
  aspect?: string;
  /** Accessible name of the figure. */
  label?: string;
  className?: string;
  /** Fires when the visitor commits a new instance count (slider) or `handle.setInstances` is called. */
  onInstances?: (count: number) => void;
  onNodeKilled?: (info: NodeKilledInfo) => void;
  onRequest?: (info: RequestInfo) => void;
  onPromoted?: (info: PromotedInfo) => void;
  /** Fires on canvas hover and on keyboard focus of the node list; null on leave or blur. */
  onHoverNode?: (info: HoverNodeInfo | null) => void;
  /** Every simulation event, for logs and meters. */
  onEvent?: (event: SimEvent) => void;
  /** Called with the handle once the simulation exists (and again if the bench is rebuilt). */
  onReady?: (handle: DioramaHandle) => void;
  /** The imperative handle. */
  ref?: Ref<DioramaHandle>;
}

/**
 * The imperative handle. Methods are stable for the life of the component and are safe to call before
 * the figure is ready (they do nothing and return the "nothing happened" value).
 */
export interface DioramaHandle {
  /** Sets the number of instances. Returns how many were placed. */
  setInstances(count: number, place?: PlaceOptions): number;
  /** Takes the node of a random running instance offline. Returns its id. */
  killRandom(): string | null;
  /** Takes the elected primary's node offline (a random instance when there is none). */
  killPrimary(): string | null;
  /** Takes a node offline by id. */
  kill(nodeId: string): boolean;
  /** Takes every node of a continent offline. Returns the ids. */
  killRegion(region: Region): string[];
  /** Brings a node back. */
  revive(nodeId: string): boolean;
  reviveAll(): void;
  /** Sends one request from a user spot, a coordinate or a node. Returns the packet id, or -1. */
  send(from?: SimSource): number;
  /** Ambient traffic in requests per second (0 stops it). */
  setRequestRate(perSecond: number): void;
  /** Clears the bench and the counters. Keeps rules and options; a seed replaces the seed. */
  reset(seed?: number): void;
  /** Starts the figure over: reset, then the scene's opening (instances, or the deploy pipeline). */
  replay(): void;
  /** Runs the deploy pipeline (spec, register, block, select, install, live). */
  startDeploy(opts?: { instances?: number }): void;
  /** One block pulse across the bench. */
  beat(): void;
  /** Subscribes to simulation events (one type or `'*'`). Survives the simulation being rebuilt. */
  on(type: '*' | SimEventType, fn: (e: SimEvent) => void): () => void;
  /** The live simulation state, or null before the figure is ready. Do not mutate. */
  state(): Readonly<SimState> | null;
  readonly sim: Sim | null;
  readonly bench: Bench | null;
  /** Frames per second, quality tier and so on, for the dev overlay. */
  stats(): EngineStats | null;
}
