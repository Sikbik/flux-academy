/**
 * The scene bus: the ONLY coupling between the DOM page and the WebGL (or 2D fallback) scenes.
 *
 * - The page writes what is happening: whether the stage is on screen, the accent, the scroll story's
 *   chapter and progress, the deploy controls, one-shot pulses (a real block landed), live geo data.
 * - The scene reads this store every frame and writes back ONLY the `scene` slice (readiness, tier, fps,
 *   status strings for assistive tech, how many instances are placed and healthy).
 * - Sections never import three.js and the scene never imports section code.
 *
 * Read it in a render loop with `useSceneBus.getState()`. Subscribe in React with
 * `useSceneBus((s) => s.scene.up)`. See `web/src/scenes/README.md` for the full contract.
 *
 * Controls are request counters ("nonces"): the page increments `breakNonce` to ask for one node to be
 * broken. A scene that mounts later does not replay old requests, it adopts the current counters.
 */
import type { GeoSnapshot, Tier } from '@shared/api';
import { create } from 'zustand';
import type { QualityTier } from '@/lib/quality';

export type { QualityTier, Tier };

/** The page accent. `flux` is the brand blue; the others are the node tier colours. */
export type Accent = 'flux' | 'cumulus' | 'nimbus' | 'stratus';

/**
 * Which home page section dominates the viewport. `hero` and `story` have their own camera work;
 * everything else is a calm, dim backdrop.
 */
export type SceneSection = 'hero' | 'story' | 'path' | 'labs' | 'live' | 'build' | 'close' | 'backdrop';

/** The four chapters of the scroll story: describe, register, place, run. */
export type Chapter = 0 | 1 | 2 | 3;

export type PulseKind =
  /** A real block landed: a soft ring across the bench and a luminance pulse through the hairlines. */
  | 'block'
  /** The visitor pressed the stage (the scene fires this itself for canvas clicks). */
  | 'click'
  /** Something good happened (a lesson finished): a ring through the bench. */
  | 'success'
  /** Something needs attention. Rarely used. */
  | 'warn';

export interface ScenePulse {
  id: number;
  kind: PulseKind;
  /** Position on the bench, normalised to the stage canvas (0..1, origin top left), or null for the cell. */
  x: number | null;
  y: number | null;
  /** performance.now() when fired. */
  at: number;
  /** 0..1 loudness. */
  strength: number;
}

export interface DeployControls {
  /** How many copies of the app should be placed, 1 to 12. */
  instances: number;
  /** Increment to break one random hosting node. */
  breakNonce: number;
  /** Increment to revive every broken node. */
  reviveNonce: number;
  /** Increment to remove everything and start the bench over. */
  resetNonce: number;
  /** Optional region code (`EU`, `NA`, ...) to prefer when placing. */
  region: string | null;
}

/** Pointer in viewport-normalised coordinates, -1..1 with y up. Used for parallax only. */
export interface PointerState {
  x: number;
  y: number;
}

/** The chain clock as the page knows it. `live` must be true only for real observations. */
export interface ChainState {
  height: number | null;
  /** Epoch ms of the tip block header, null when unknown. */
  lastBlockAt: number | null;
  intervalMs: number;
  live: boolean;
}

/** Fractions (0..1) of the stage that the page covers with its own content. The bench is framed in the rest. */
export interface StageInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type SceneEventKind =
  | 'placed'
  | 'retired'
  | 'node-down'
  | 'node-up'
  | 'ejected'
  | 'rerouted'
  | 'all-down'
  | 'reset'
  | 'block';

export interface SceneEvent {
  /** Increments with every event, so a live region can announce each one once. */
  id: number;
  kind: SceneEventKind;
  /** One plain sentence, safe to put in a polite live region. No dashes, no emoji. */
  text: string;
  /** performance.now() when it happened. */
  at: number;
}

/** What the pointer is over on the bench, for the figure's reticle readout. Canvas pixels. */
export interface SceneHover {
  x: number;
  y: number;
  tier: Tier;
  cc: string | null;
  /** Number of real nodes the pillar stands for, null in a sample. */
  nodes: number | null;
  /** True when one of the app's instances stands on it. */
  hosting: boolean;
  healthy: boolean;
}

export type SceneReason =
  | 'ok'
  | 'loading'
  | 'no-webgl'
  | 'context-lost'
  | 'forced-off'
  | 'too-slow'
  | 'reduced-motion';

/** Written by the scene, read by the page. Nothing here is persisted. */
export interface SceneSlice {
  /** The first frame has been drawn (WebGL) or the fallback is mounted. */
  ready: boolean;
  /** True while the WebGL scene is the thing on screen; false while the 2D fallback shows. */
  webgl: boolean;
  tier: QualityTier;
  fps: number;
  reason: SceneReason;
  /** `live` only when the bench was built from a real geo snapshot. A sample is never `live`. */
  dataMode: 'sample' | 'live';
  /** Instances currently placed (landed or in flight). */
  instancesPlaced: number;
  /** Placed instances whose node is healthy. */
  healthy: number;
  /** True while at least one placed instance is healthy. */
  up: boolean;
  /** For example `Up. 3 instances placed, 2 healthy.` Suitable for a polite live region. */
  status: string;
  lastEvent: SceneEvent | null;
  hover: SceneHover | null;
}

export interface SceneBusState {
  // ---- written by the page -------------------------------------------------
  /** The stage is on screen and the tab is visible. The scene stops rendering when false. */
  visible: boolean;
  /** Hard pause (a modal is open, an overlay covers the stage). */
  paused: boolean;
  /** prefers-reduced-motion or the visitor's choice: a calm still, controls still work. */
  reducedMotion: boolean;
  accent: Accent;
  /** Forces a quality tier (the `?q=` flag or a preference). null lets the governor decide. */
  quality: QualityTier | null;
  section: SceneSection;
  chapter: Chapter;
  /** 0..1 progress through the active chapter. */
  chapterProgress: number;
  pointer: PointerState | null;
  deploy: DeployControls;
  /** Which tier to isolate on the bench (a hovered track card), or null for all. */
  tierFocus: Tier | null;
  /** Real geo data when available. null means "use the sample bench". */
  geo: GeoSnapshot | null;
  chain: ChainState;
  insets: StageInsets;
  /** Recent one-shot pulses. The scene consumes by id; the setter keeps the last 16. */
  pulses: ScenePulse[];

  // ---- written by the scene --------------------------------------------------
  scene: SceneSlice;

  // ---- actions -----------------------------------------------------------------
  setVisible: (visible: boolean) => void;
  setPaused: (paused: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setAccent: (accent: Accent) => void;
  setQuality: (quality: QualityTier | null) => void;
  setSection: (section: SceneSection) => void;
  setChapter: (chapter: Chapter, progress?: number) => void;
  setChapterProgress: (progress: number) => void;
  setPointer: (pointer: PointerState | null) => void;
  setDeploy: (patch: Partial<DeployControls>) => void;
  /** Sets the wanted instance count (clamped to 1..12). */
  setInstances: (n: number) => void;
  requestBreak: () => void;
  requestRevive: () => void;
  requestReset: () => void;
  setTierFocus: (tier: Tier | null) => void;
  setGeo: (geo: GeoSnapshot | null) => void;
  setChain: (patch: Partial<ChainState>) => void;
  setInsets: (patch: Partial<StageInsets>) => void;
  /** Fires a one-shot pulse. `x`, `y` are canvas-normalised (0..1) or omitted for the cell. */
  pulse: (kind: PulseKind, opts?: { x?: number; y?: number; strength?: number }) => void;
  /** Scene only. */
  writeScene: (patch: Partial<SceneSlice>) => void;
  /** Back to defaults (tests, the lab). */
  reset: () => void;
}

export const MIN_INSTANCES = 1;
export const MAX_INSTANCES = 12;
export const MAX_PULSES = 16;

export const clamp01 = (x: number): number => (Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0);

/** The instance count the scene will honour: an integer from 1 to 12. */
export function clampInstances(n: number): number {
  if (!Number.isFinite(n)) return MIN_INSTANCES;
  return Math.min(MAX_INSTANCES, Math.max(MIN_INSTANCES, Math.round(n)));
}

export function clampChapter(c: number): Chapter {
  if (!Number.isFinite(c)) return 0;
  return Math.min(3, Math.max(0, Math.round(c))) as Chapter;
}

let pulseSeq = 0;

/** Appends a pulse and keeps only the newest MAX_PULSES. Pure, for tests. */
export function appendPulse(
  list: readonly ScenePulse[],
  kind: PulseKind,
  opts: { x?: number; y?: number; strength?: number } | undefined,
  now: number,
  id: number,
): ScenePulse[] {
  const pulse: ScenePulse = {
    id,
    kind,
    x: opts?.x === undefined ? null : clamp01(opts.x),
    y: opts?.y === undefined ? null : clamp01(opts.y),
    at: now,
    strength: opts?.strength === undefined ? 1 : Math.min(1.5, Math.max(0, opts.strength)),
  };
  return [...list, pulse].slice(-MAX_PULSES);
}

const INITIAL_SCENE: SceneSlice = {
  ready: false,
  webgl: false,
  tier: 0,
  fps: 0,
  reason: 'loading',
  dataMode: 'sample',
  instancesPlaced: 0,
  healthy: 0,
  up: false,
  status: '',
  lastEvent: null,
  hover: null,
};

function initialState(): Pick<
  SceneBusState,
  | 'visible'
  | 'paused'
  | 'reducedMotion'
  | 'accent'
  | 'quality'
  | 'section'
  | 'chapter'
  | 'chapterProgress'
  | 'pointer'
  | 'deploy'
  | 'tierFocus'
  | 'geo'
  | 'chain'
  | 'insets'
  | 'pulses'
  | 'scene'
> {
  return {
    visible: true,
    paused: false,
    reducedMotion: false,
    accent: 'flux',
    quality: null,
    section: 'hero',
    chapter: 0,
    chapterProgress: 0,
    pointer: null,
    deploy: { instances: 3, breakNonce: 0, reviveNonce: 0, resetNonce: 0, region: null },
    tierFocus: null,
    geo: null,
    chain: { height: null, lastBlockAt: null, intervalMs: 30_000, live: false },
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
    pulses: [],
    scene: { ...INITIAL_SCENE },
  };
}

export const useSceneBus = create<SceneBusState>((set) => ({
  ...initialState(),

  setVisible: (visible) => set({ visible }),
  setPaused: (paused) => set({ paused }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setAccent: (accent) => set({ accent }),
  setQuality: (quality) => set({ quality }),
  setSection: (section) => set({ section }),
  setChapter: (chapter, progress) =>
    set((s) => ({
      chapter: clampChapter(chapter),
      chapterProgress: progress === undefined ? s.chapterProgress : clamp01(progress),
    })),
  setChapterProgress: (progress) => set({ chapterProgress: clamp01(progress) }),
  setPointer: (pointer) =>
    set({
      pointer: pointer
        ? { x: Math.min(1, Math.max(-1, pointer.x)), y: Math.min(1, Math.max(-1, pointer.y)) }
        : null,
    }),
  setDeploy: (patch) =>
    set((s) => ({
      deploy: {
        ...s.deploy,
        ...patch,
        instances: clampInstances(patch.instances ?? s.deploy.instances),
      },
    })),
  setInstances: (n) => set((s) => ({ deploy: { ...s.deploy, instances: clampInstances(n) } })),
  requestBreak: () => set((s) => ({ deploy: { ...s.deploy, breakNonce: s.deploy.breakNonce + 1 } })),
  requestRevive: () => set((s) => ({ deploy: { ...s.deploy, reviveNonce: s.deploy.reviveNonce + 1 } })),
  requestReset: () => set((s) => ({ deploy: { ...s.deploy, resetNonce: s.deploy.resetNonce + 1 } })),
  setTierFocus: (tierFocus) => set({ tierFocus }),
  setGeo: (geo) => set({ geo }),
  setChain: (patch) => set((s) => ({ chain: { ...s.chain, ...patch } })),
  setInsets: (patch) => set((s) => ({ insets: { ...s.insets, ...patch } })),
  pulse: (kind, opts) =>
    set((s) => ({ pulses: appendPulse(s.pulses, kind, opts, performance.now(), ++pulseSeq) })),
  writeScene: (patch) => set((s) => ({ scene: { ...s.scene, ...patch } })),
  reset: () => set({ ...initialState() }),
}));

/** The id of the newest pulse, so a scene that mounts late can ignore the ones that already happened. */
export function newestPulseId(s: Pick<SceneBusState, 'pulses'>): number {
  let max = 0;
  for (const p of s.pulses) if (p.id > max) max = p.id;
  return max;
}
