// The scene engine: one WebGL context, one rAF loop, the bench and everything that lives on it. It reads
// the bus every frame (what the page wants), steps the director (what the simulation says), moves the
// camera, writes a handful of uniforms and draws. Nothing here knows about React; the host component
// creates it with a canvas and a sized element and disposes it on unmount.
//
// Frame order: reconcile bus -> director/sim -> chain -> camera -> uniforms -> draw -> governor -> stats.

import { PerspectiveCamera, Scene, type Texture, TextureLoader, Vector3, WebGLRenderer } from 'three';
import { ART } from '@/content/art';
import {
  type Bench,
  buildLiveBench,
  buildSampleBench,
  REGIONS,
  type Region,
  type Resolution,
} from '@/diorama/model';
import { createSim } from '@/diorama/sim';
import { type ActiveTier, Governor, initialPlan, type QualityTier, TIER_PARAMS } from '@/lib/quality';
import {
  type DeployControls,
  type PulseKind,
  type SceneEventKind,
  type SceneSection,
  type SceneSlice,
  useSceneBus,
} from '../bus';
import { onCoverChange, stageCovered } from '../cover';
import { type ArcPath, makeArc, type RibbonStyle } from '../lib/arcs';
import {
  ambientPose,
  CameraRig,
  cameraPosition,
  freeAspect,
  freeRect,
  makePose,
  type Pose,
  type PresetId,
  type PresetShape,
  parallaxOffsets,
  presetFor,
  presetShape,
  resolvePose,
} from '../lib/camera';
import { ChainModel } from '../lib/chain';
import { type CellFx, Director, type LifeBuffers, MAX_COPIES } from '../lib/director';
import { clamp, damp, smoothstep } from '../lib/math';
import { statusLine } from '../lib/narrate';
import { AccentBlender, type AccentPalette, readAccentPalette } from '../lib/palette';
import { chooseDpr } from '../lib/resolution';
import { heroSeed } from '../lib/spread';
import { storyPlan } from '../lib/story';
import { MAX_WAVES, type WaveKind, WaveTracker } from '../lib/waves';
import { buildWorld, CHAIN_BLOCKS, proxyFromSim, type World } from '../world/build';
import { CellMesh, type CellState } from './cell';
import { DebugOverlay, type DebugStats } from './debug';
import { DustMesh } from './dust';
import { ChainStrip, FloorMesh, FrameLines } from './extras';
import { GpuTimer } from './gpu';
import { PillarMesh } from './pillars';
import { Post } from './post';
import { RibbonMesh } from './ribbons';
import { TerrainMesh } from './terrain';
import { createSharedUniforms, type SharedUniforms } from './uniforms';

export type EngineMode = 'hero' | 'ambient';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  /** The element that gives the stage its size and visibility. */
  host: HTMLElement;
  mode: EngineMode;
  /** Show the stats overlay. */
  debug?: boolean;
  /** Tests and the lab: nothing renders until `advance` or `renderOnce` is called. */
  manual?: boolean;
  /** Tier override (the `?q=` flag, already parsed). null lets the device policy and governor decide. */
  tier?: QualityTier | null;
  /** Terrain density override (the lab compares them); default follows the start tier. */
  resolution?: Resolution;
  /** Called once when the GL context is lost for good (the host switches to the 2D scene). */
  onContextLost?: () => void;
  /** Called when the context comes back after a loss. */
  onContextRestored?: () => void;
  /** Called when even the lowest tier cannot hold a usable frame rate (the host shows the 2D scene). */
  onTooSlow?: () => void;
}

export interface EngineStats {
  tier: ActiveTier;
  fps: number;
  frameMs: number;
  gpuMs: number | null;
  drawCalls: number;
  triangles: number;
  cells: number;
  pillars: number;
  particles: number;
  ribbons: number;
  dpr: number;
  width: number;
  height: number;
  preset: PresetId;
  placed: number;
  healthy: number;
  status: string;
  clock: number;
  /** Frames drawn since the engine started. */
  frames: number;
}

const HERO_COPIES_AT = 1.25;
const REVEAL_SECONDS = 2.1;
const BUILD_AT = 0.3;
const BUILD_SECONDS = 1.0;
const CELL_RADIUS = 6.2;
/**
 * A small canvas (a phone in portrait) may draw above its tier's DPR cap (see `lib/resolution.ts`). That
 * extra resolution is the first thing to go when the device cannot hold the frame rate: below BOOST_FPS for
 * BOOST_SLOW_SECONDS it is withdrawn, before the governor is allowed to touch the tier.
 */
const BOOST_FPS = 45;
const BOOST_SLOW_SECONDS = 2;
const BOOST_WARMUP_SECONDS = 2.5;

interface TierConfig {
  samples: number;
  levels: number;
  quarter: boolean;
  motes: number;
  bloom: number;
}

const TIER_CONFIG: Record<ActiveTier, TierConfig> = {
  3: { samples: 4, levels: 5, quarter: false, motes: 56, bloom: 1.0 },
  2: { samples: 2, levels: 5, quarter: true, motes: 44, bloom: 0.95 },
  1: { samples: 0, levels: 0, quarter: true, motes: 28, bloom: 0 },
};

/**
 * The hero draws the bench at its coarsest density on every tier: chunky crystals read as a skyline, a
 * fine mesh reads as noise (and costs more). Quality goes into resolution, post and particles instead.
 */
function resolutionFor(_tier: ActiveTier): Resolution {
  return 'low';
}

function isRegion(s: string | null): s is Region {
  return s !== null && (REGIONS as readonly string[]).includes(s);
}

export class SceneEngine {
  readonly mode: EngineMode;
  private readonly canvas: HTMLCanvasElement;
  private readonly host: HTMLElement;
  private readonly opts: EngineOptions;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(34, 1, 1, 700);
  private readonly shared: SharedUniforms = createSharedUniforms();
  private readonly post: Post;
  private readonly terrain: TerrainMesh;
  private readonly floor: FloorMesh;
  private readonly frameLines: FrameLines;
  private readonly pillars: PillarMesh;
  private readonly chainStrip: ChainStrip;
  private readonly cellMesh: CellMesh;
  private readonly ribbons: RibbonMesh;
  private readonly dust: DustMesh;
  private readonly gpu: GpuTimer | null;
  private readonly debug: DebugOverlay | null;
  private readonly governor: Governor;
  private readonly rig = new CameraRig(0.42);
  private readonly waves = new WaveTracker();
  private readonly blender: AccentBlender;
  private readonly chain = new ChainModel(CHAIN_BLOCKS);
  private readonly textures: Texture[] = [];

  private world: World;
  private director: Director;
  private life: LifeBuffers;
  private tier: ActiveTier;
  private readonly ceiling: ActiveTier;
  private config: TierConfig;
  private dpr = 1;
  private width = 1;
  private height = 1;
  private usePost: boolean;

  // timeline
  private clock = 0;
  private lastNow = 0;
  private raf = 0;
  private started = false;
  private disposed = false;
  private contextLost = false;
  private onScreen = true;
  private frames = 0;
  private needsFrame = true;
  private introT = 0;
  private reveal = 0;
  private build = 0;
  private dim = 1;
  private frozenClock = 9.4;

  // bus bookkeeping
  private seenBreak: number;
  private seenRevive: number;
  private seenReset: number;
  private lastPulseId: number;
  private lastChainHeight: number | null;
  private lastChainAt: number | null;
  private lastBlockWave = -10;
  private lastGeo: unknown = null;
  private wantInstances: number | null = null;
  private wantRegion: Region | null = null;
  private storyBroken = false;
  private lastSection: SceneSection = 'hero';
  private lastAccent = '';
  private lastReduced = false;
  private eventSeq = 0;
  private ambientCycle = -1;
  private ambientStep = 0;
  private slowSeconds = 0;
  private slowFired = false;
  private dprBoost = true;
  private boostSlow = 0;

  // camera
  private preset: PresetId = 'hero';
  private targetPose: Pose = makePose();
  private livePose: Pose = makePose();
  private poseKey = '';
  private shape: PresetShape | null = null;
  private readonly parallax = { yaw: 0, elev: 0, shiftX: 0, shiftY: 0 };
  private px = 0;
  private py = 0;
  private pointerInside = false;
  private pointerNx = 0;
  private pointerNy = 0;
  private pointerFine = true;
  private cursorStrength = 0;
  private cursorX = 0;
  private cursorZ = 0;
  private hoverIndex = -1;
  private hoverAmount = 0;
  private lastHoverKey = '';

  // scratch
  private readonly v = new Vector3();
  private readonly fx: CellFx = { charge: 0, lift: 0, flash: 0, gauge: [0.3, 0.4, 0.3] };
  private readonly cellState: CellState = {
    x: 0,
    y: 0,
    z: 0,
    radius: CELL_RADIUS,
    yaw: 0,
    build: 0,
    charge: 0,
    flash: 0,
    intensity: 1,
    time: 0,
  };
  private readonly hashPath: ArcPath = {
    sx: 0,
    sy: 0,
    sz: 0,
    cx: 0,
    cy: 0,
    cz: 0,
    ex: 0,
    ey: 0,
    ez: 0,
    length: 0,
  };
  private readonly hashStyle: RibbonStyle = {
    head: 0,
    tail: 0,
    width: 0.16,
    tailR: 0.2,
    tailG: 0.4,
    tailB: 0.9,
    headR: 1.6,
    headG: 2.2,
    headB: 3.2,
    alpha: 1,
    tailAlpha: 0,
    tailWidth: 0.3,
  };

  // fps
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 0;
  private frameMs = 0;
  private lastStatsWrite = 0;
  private lastStatus = '';
  private lastPlaced = -1;
  private lastHealthy = -1;

  private readonly unsubBus: () => void;
  private readonly offCover: () => void;
  private readonly io: IntersectionObserver | null;
  private readonly ro: ResizeObserver | null;
  private readonly mo: MutationObserver | null;
  private readonly onVisibility = (): void => this.wake();
  private readonly onPointerMove = (e: PointerEvent): void => this.pointerMove(e);
  private readonly onPointerDown = (e: PointerEvent): void => this.pointerDown(e);
  private readonly onPointerLeave = (): void => {
    this.pointerInside = false;
  };
  private readonly onLost = (e: Event): void => {
    // preventDefault tells the browser the context may be restored.
    e.preventDefault();
    this.contextLost = true;
    this.opts.onContextLost?.();
  };
  private readonly onRestored = (): void => {
    this.contextLost = false;
    this.lastNow = 0;
    this.lastPlaced = -1;
    this.lastStatus = '';
    this.opts.onContextRestored?.();
    this.needsFrame = true;
    this.wake();
  };

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.mode = opts.mode;
    this.canvas = opts.canvas;
    this.host = opts.host;

    const plan = initialPlan();
    const forced = opts.tier ?? plan.forced;
    const startTier = (forced && forced > 0 ? forced : plan.plan.start) as ActiveTier;
    this.ceiling = (forced && forced > 0 ? forced : plan.plan.ceiling) as ActiveTier;
    this.tier = startTier;
    this.config = TIER_CONFIG[startTier];
    this.usePost = TIER_PARAMS[startTier].post;
    this.governor = new Governor({
      start: startTier,
      ceiling: this.ceiling,
      floor: 1,
      locked: forced !== null && forced > 0,
    });

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: startTier === 1,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.autoClear = true;
    // One logical frame is several render calls (scene, bloom passes, composite): the stats add them up.
    this.renderer.info.autoReset = false;

    const bus = useSceneBus.getState();
    let attr: string | undefined;
    try {
      attr = document.documentElement.dataset.accent;
    } catch {
      attr = undefined;
    }
    const initial = readAccentPalette(
      bus.accent,
      attr === undefined || attr === bus.accent ? this.readStyle() : null,
    );
    this.blender = new AccentBlender(initial, 0.6);
    this.lastAccent = bus.accent;

    const u = this.shared;
    this.post = new Post(this.renderer);
    this.terrain = new TerrainMesh(u);
    this.floor = new FloorMesh(u);
    this.frameLines = new FrameLines(u);
    this.pillars = new PillarMesh(u);
    this.chainStrip = new ChainStrip(u, CHAIN_BLOCKS);
    this.cellMesh = new CellMesh(u, this.config.motes);
    this.ribbons = new RibbonMesh(u);
    this.dust = new DustMesh(u, TIER_PARAMS[3].particles);
    this.scene.add(
      this.terrain.mesh,
      this.floor.mesh,
      this.frameLines.lines,
      this.pillars.column,
      this.pillars.halo,
      this.pillars.shaft,
      this.chainStrip.mesh,
      this.ribbons.mesh,
      this.cellMesh.group,
      this.dust.points,
    );

    // The world: sample until the page hands over real data.
    const bench = this.makeBench(bus.geo);
    this.world = buildWorld(bench);
    const sim = createSim({
      bench,
      seed: heroSeed(bench, 3),
      place: { waitedMin: 120, spread: 'random' },
    });
    this.life = this.pillars.life;
    this.director = new Director(
      this.world,
      sim,
      {
        wave: (kind, x, z, strength, tint) => this.waves.add(kind, x, z, this.clock, strength, tint),
        event: (kind, text) => this.announce(kind, text),
      },
      this.life,
    );
    this.applyWorld(true);
    this.lastGeo = bus.geo;

    // Bus adoption: requests made before this engine existed are not replayed.
    this.seenBreak = bus.deploy.breakNonce;
    this.seenRevive = bus.deploy.reviveNonce;
    this.seenReset = bus.deploy.resetNonce;
    this.lastPulseId = bus.pulses.reduce((m, p) => Math.max(m, p.id), 0);
    this.lastChainHeight = bus.chain.height;
    this.lastChainAt = bus.chain.lastBlockAt;
    this.lastSection = bus.section;
    // Motion is "full" until the first frame says otherwise, so a scene that mounts while reduced motion is
    // already on goes through the same transition as one toggled later: the director settles to a still.
    this.lastReduced = false;

    this.gpu = opts.debug ? new GpuTimer(this.renderer.getContext() as WebGL2RenderingContext) : null;
    this.debug = opts.debug ? new DebugOverlay(this.host) : null;

    this.loadArt();
    this.applyTier(startTier, true);
    this.resize();

    // Observers and listeners.
    this.unsubBus = useSceneBus.subscribe((s, prev) => {
      if (s.visible !== prev.visible || s.paused !== prev.paused || s.reducedMotion !== prev.reducedMotion) {
        this.needsFrame = true;
        this.wake();
      } else if (s.scene === prev.scene) {
        // A page write: in reduced motion the still frame must follow it.
        this.needsFrame = true;
        this.wake();
      }
    });
    // An ambient scene covering the page stops this (hero) scene; when it closes this one picks up again.
    this.offCover = onCoverChange(() => {
      this.lastNow = 0;
      this.needsFrame = true;
      this.wake();
    });
    this.ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            this.resize();
            this.needsFrame = true;
            this.wake();
          });
    this.ro?.observe(this.host);
    this.io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              const e = entries[entries.length - 1];
              if (!e) return;
              this.onScreen = e.isIntersecting;
              if (this.onScreen) {
                this.lastNow = 0;
                this.needsFrame = true;
                this.wake();
              }
            },
            { rootMargin: '60px' },
          );
    this.io?.observe(this.host);
    this.mo =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            this.retarget();
            this.needsFrame = true;
            this.wake();
          });
    this.mo?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-accent', 'class', 'style'],
    });
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('webglcontextlost', this.onLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.onRestored, false);
  }

  // ---- setup -------------------------------------------------------------------------------------------

  private readStyle(): { getPropertyValue(name: string): string } | null {
    try {
      return getComputedStyle(document.documentElement);
    } catch {
      return null;
    }
  }

  private makeBench(geo: ReturnType<typeof useSceneBus.getState>['geo']): Bench {
    const resolution = this.opts.resolution ?? resolutionFor(this.tier);
    if (geo) {
      try {
        return buildLiveBench(geo, { resolution });
      } catch {
        // A malformed snapshot must never break the hero: fall back to the sample.
      }
    }
    return buildSampleBench(1, { resolution });
  }

  /** Uploads a world to the GPU meshes and points the director at it. */
  private applyWorld(first: boolean): void {
    const w = this.world;
    this.terrain.setTerrain(w.bench, w.frame, w.cast);
    this.floor.setCells(w.cellX, w.cellZ, w.bench.cells.count, w.frame.cell, w.frame.halfW, w.frame.halfD);
    this.frameLines.setBounds(w.frame.halfW, w.frame.halfD);
    this.life = this.pillars.setLayout(w.pillars, w.beacons, 0.1 * w.frame.cell * 1.85);
    this.chainStrip.setLayout(w.chain.x, w.chain.headZ, w.chain.step);
    const sim = this.director.simulation;
    const p = proxyFromSim(w.frame, sim.state().proxy, 9.5);
    w.proxy.x = p.x;
    w.proxy.y = p.y;
    w.proxy.z = p.z;
    // The reach of the intro front: it must pass every cell and every pillar before it ends.
    const reach = Math.hypot(w.frame.halfW, w.frame.halfD) + 20;
    this.shared.uRevealC.value.set(0, 0, reach);
    this.dust.uniforms.uBox.value.set(w.frame.halfW * 2.5, 36, w.frame.halfD * 3.4);
    this.dust.uniforms.uBoxC.value.set(0, 15, 0);
    this.shared.uFogScale.value = 280;
    this.poseKey = '';
    this.shape = null;
    if (!first) this.director.setSim(sim, this.directorWorld(), this.life);
    this.updateCellUniforms();
  }

  private directorWorld() {
    return {
      bench: this.world.bench,
      frame: this.world.frame,
      pillars: this.world.pillars,
      cell: this.world.cell,
      proxy: this.world.proxy,
    };
  }

  private loadArt(): void {
    const loader = new TextureLoader();
    const load = (src: string, use: (t: Texture) => void) => {
      loader.load(
        src,
        (t) => {
          if (this.disposed) {
            t.dispose();
            return;
          }
          this.textures.push(t);
          use(t);
          this.needsFrame = true;
        },
        undefined,
        () => {
          // The art is an enhancement: the procedural sprite and no dirt are fine.
        },
      );
    };
    load(ART['sprite-bokeh'].src, (t) => this.dust.setSprite(t));
    load(ART['sprite-dirt'].src, (t) => this.post.setDirt(t));
  }

  // ---- quality -------------------------------------------------------------------------------------------

  private applyTier(tier: ActiveTier, force = false): void {
    if (!force && tier === this.tier) return;
    this.tier = tier;
    this.config = TIER_CONFIG[tier];
    const p = TIER_PARAMS[tier];
    this.usePost = p.post;
    this.shared.uDirect.value = p.post ? 0 : 1;
    this.dust.setCount(p.particles);
    this.cellMesh.setMoteCount(this.config.motes);
    this.post.weight = tier === 3 ? 0.64 : 0.6;
    this.resize(true);
  }

  private targetDpr(w: number, h: number): number {
    return chooseDpr({
      deviceRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
      tierCap: TIER_PARAMS[this.tier].dprMax,
      width: w,
      height: h,
      boost: this.dprBoost,
    });
  }

  /** Withdraws the extra resolution when the device shows it cannot afford it. Called once per frame. */
  private watchBoost(dt: number): void {
    if (!this.dprBoost || this.clock < BOOST_WARMUP_SECONDS) return;
    const fps = this.governor.fps;
    if (fps > 0 && fps < BOOST_FPS) this.boostSlow += dt;
    else this.boostSlow = Math.max(0, this.boostSlow - dt);
    if (this.boostSlow < BOOST_SLOW_SECONDS) return;
    this.dprBoost = false;
    this.boostSlow = 0;
    const before = this.dpr;
    this.resize(true);
    // The resolution that was just withdrawn is not evidence against the tier: forget it.
    if (this.dpr !== before) this.governor.force(this.tier);
  }

  resize(force = false): void {
    const rect = this.host.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width));
    const h = Math.max(2, Math.round(rect.height));
    const d = this.targetDpr(w, h);
    if (!force && w === this.width && h === this.height && d === this.dpr) return;
    this.width = w;
    this.height = h;
    this.dpr = d;
    this.renderer.setPixelRatio(d);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    const pw = Math.round(w * d);
    const ph = Math.round(h * d);
    if (this.usePost) {
      this.post.configure({
        width: pw,
        height: ph,
        samples: this.config.samples,
        levels: this.config.levels,
        quarter: this.config.quarter,
      });
    }
    this.camera.aspect = w / h;
    this.shared.uDpr.value = d;
    this.shared.uViewport.value.set(pw, ph);
    this.poseKey = '';
    this.needsFrame = true;
  }

  // ---- loop ----------------------------------------------------------------------------------------------

  /** Begins rendering. In manual mode only the first frame is drawn. */
  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    if (this.opts.manual) {
      this.renderFrame(0);
      return;
    }
    const begin = (): void => {
      if (this.disposed) return;
      this.wake();
    };
    // Compile every program without blocking the thread, so the first frame is not a hitch.
    this.renderer
      .compileAsync(this.scene, this.camera)
      .then(() => this.post.warm())
      .then(begin, begin);
  }

  private shouldRun(): boolean {
    if (this.disposed || this.contextLost || !this.started) return false;
    const s = useSceneBus.getState();
    if (!s.visible || s.paused || !this.onScreen) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    if (this.mode === 'hero' && stageCovered()) return false;
    return true;
  }

  private wake(): void {
    if (this.raf !== 0 || this.opts.manual || !this.shouldRun()) return;
    this.raf = requestAnimationFrame(this.loop);
  }

  private readonly loop = (now: number): void => {
    this.raf = 0;
    if (!this.shouldRun()) return;
    const reduced = useSceneBus.getState().reducedMotion;
    const dtRaw = this.lastNow === 0 ? 1 / 60 : (now - this.lastNow) / 1000;
    this.lastNow = now;
    if (reduced && !this.needsFrame) return;
    const t0 = performance.now();
    this.renderFrame(Math.min(0.1, Math.max(0, dtRaw)));
    this.frameMs = performance.now() - t0;
    if (!reduced) {
      this.fpsAcc += dtRaw;
      this.fpsFrames++;
      if (this.fpsAcc >= 0.5) {
        this.fps = this.fpsFrames / this.fpsAcc;
        this.fpsAcc = 0;
        this.fpsFrames = 0;
      }
      if (this.frames > 4) {
        this.watchBoost(dtRaw);
        const changed = this.governor.frame(dtRaw);
        if (changed !== null) this.applyTier(changed);
        this.watchSlow(dtRaw);
      }
      this.wake();
    } else {
      this.lastNow = 0;
    }
  };

  /**
   * Even the lowest tier can be too much for some hardware. After five seconds below 20 fps at tier 1
   * the 2D scene is offered instead (never when a tier was forced, which is a developer's choice).
   */
  private watchSlow(dt: number): void {
    if (this.slowFired || this.governor.locked || this.tier !== 1) {
      this.slowSeconds = 0;
      return;
    }
    const fps = this.governor.fps;
    if (fps > 0 && fps < 20) this.slowSeconds += dt;
    else this.slowSeconds = Math.max(0, this.slowSeconds - dt * 2);
    if (this.slowSeconds > 5) {
      this.slowFired = true;
      this.opts.onTooSlow?.();
    }
  }

  /** Manual clock: advances the scene by `seconds` in steps and draws the final frame. */
  advance(seconds: number, step = 1 / 60): void {
    if (this.disposed) return;
    const n = Math.max(1, Math.round(seconds / step));
    for (let i = 0; i < n; i++) this.renderFrame(step, i === n - 1);
  }

  renderOnce(): void {
    this.renderFrame(0, true);
  }

  // ---- the frame -------------------------------------------------------------------------------------------

  private renderFrame(dt: number, draw = true): void {
    if (this.disposed) return;
    const s = useSceneBus.getState();
    const reduced = s.reducedMotion;
    this.needsFrame = false;
    if (reduced !== this.lastReduced) this.onReducedChange(reduced);

    const step = reduced ? 0 : dt;
    if (!reduced) this.clock += step;
    const t = reduced ? this.frozenClock : this.clock;

    this.consumePulses(s, t);
    this.consumeChain(s, t);
    this.reconcile(s, step, t);
    this.director.update(t, step);
    this.chain.step(step);
    this.updateCamera(s, step, t, reduced);
    this.updateUniforms(s, step, t, reduced);
    this.pillars.flush();
    this.updateDirectorVisuals(t);
    this.updatePicking(s, step);
    if (draw) this.draw(t);
    this.publish(s);
    this.frames++;
  }

  private onReducedChange(reduced: boolean): void {
    this.lastReduced = reduced;
    this.director.setReducedMotion(reduced);
    if (reduced) {
      this.director.settleStill(this.frozenClock);
      this.chain.settle();
      this.reveal = 1;
      this.build = 1;
      this.rig.snap(this.targetPose);
    }
    this.blender.step(0, true);
    this.poseKey = '';
  }

  // ---- bus -> engine ---------------------------------------------------------------------------------------

  private announce(kind: SceneEventKind, text: string): void {
    // Only the hero scene speaks: an ambient scene must not put its events in the page's live region.
    if (this.mode === 'ambient') return;
    useSceneBus.getState().writeScene({
      lastEvent: { id: ++this.eventSeq, kind, text, at: performance.now() },
    });
  }

  private wave(kind: WaveKind, x: number, z: number, strength = 1): void {
    this.waves.add(kind, x, z, this.clock, strength);
  }

  /** Canvas-normalised (0..1, origin top left) to a point on the bench plane, or null above the horizon. */
  private benchPoint(nx: number, ny: number, out: { x: number; z: number }): boolean {
    this.v.set(nx * 2 - 1, -(ny * 2 - 1), 0.5).unproject(this.camera);
    const o = this.camera.position;
    const dx = this.v.x - o.x;
    const dy = this.v.y - o.y;
    const dz = this.v.z - o.z;
    if (dy >= -1e-4) return false;
    const k = -o.y / dy;
    out.x = o.x + dx * k;
    out.z = o.z + dz * k;
    return true;
  }

  private readonly _bp = { x: 0, z: 0 };

  private consumePulses(s: ReturnType<typeof useSceneBus.getState>, t: number): void {
    let newest = this.lastPulseId;
    for (const p of s.pulses) {
      if (p.id <= this.lastPulseId) continue;
      newest = Math.max(newest, p.id);
      const kind: PulseKind = p.kind;
      let x = this.world.cell.x;
      let z = this.world.cell.z;
      if (p.x !== null && p.y !== null && this.benchPoint(p.x, p.y, this._bp)) {
        x = this._bp.x;
        z = this._bp.z;
      }
      if (kind === 'block') {
        this.fireBlock(t, p.strength);
      } else if (kind === 'click') {
        this.wave('click', x, z, p.strength);
      } else if (kind === 'success') {
        this.wave('success', x, z, p.strength);
      } else {
        this.wave('warn', x, z, p.strength);
      }
    }
    this.lastPulseId = newest;
  }

  /** The Beat: a soft ring from the head of the chain across the bench. Never simulated. */
  private fireBlock(t: number, strength = 1): void {
    if (t - this.lastBlockWave < 1) return;
    this.lastBlockWave = t;
    this.waves.add('block', this.world.chain.x, this.world.chain.headZ, t, strength);
    this.chain.push();
  }

  private consumeChain(s: ReturnType<typeof useSceneBus.getState>, t: number): void {
    const c = s.chain;
    const heightChanged =
      c.height !== null && this.lastChainHeight !== null && c.height > this.lastChainHeight;
    const timeChanged =
      c.lastBlockAt !== null && this.lastChainAt !== null && c.lastBlockAt > this.lastChainAt;
    if (c.live && (heightChanged || timeChanged)) this.fireBlock(t);
    this.lastChainHeight = c.height;
    this.lastChainAt = c.lastBlockAt;
  }

  private reconcile(s: ReturnType<typeof useSceneBus.getState>, dt: number, t: number): void {
    // New geo data: rebuild the bench around it once.
    if (s.geo !== this.lastGeo) {
      this.lastGeo = s.geo;
      this.rebuildWorld(s.geo);
    }
    if (s.accent !== this.lastAccent) {
      this.lastAccent = s.accent;
      this.retarget();
    }
    if (s.quality !== null && s.quality > 0 && s.quality !== this.tier) {
      this.governor.locked = true;
      this.applyTier(s.quality as ActiveTier);
    }

    const ambient = this.mode === 'ambient';
    const reduced = s.reducedMotion;
    const inStory = !ambient && s.section === 'story';

    // Intro: the bench ignites, the cell forms, then the copies leave.
    if (reduced) {
      this.reveal = 1;
    } else {
      this.introT += dt;
      const k = clamp(this.introT / REVEAL_SECONDS, 0, 1);
      this.reveal = 1 - (1 - k) * (1 - k);
    }

    // What the picture should show.
    let want: number;
    let region: Region | null = isRegion(s.deploy.region) ? s.deploy.region : null;
    let traffic = true;
    let buildTarget = 1;
    let stamp: number | null = null;
    let breakPlan = false;
    if (ambient) {
      want = this.ambientScript(t);
      region = null;
    } else if (inStory) {
      const plan = storyPlan(s.chapter, s.chapterProgress);
      want = plan.instances;
      traffic = plan.traffic;
      buildTarget = plan.build;
      stamp = plan.stamp;
      breakPlan = plan.broken;
    } else {
      want = this.introT >= HERO_COPIES_AT || reduced ? s.deploy.instances : 0;
      buildTarget = this.introT >= BUILD_AT || reduced ? 1 : 0;
    }

    // Cell build: eased toward its target; in the story it follows the scroll with a little lag.
    if (reduced) this.build = buildTarget;
    else if (inStory) this.build = damp(this.build, buildTarget, 5, dt);
    else {
      const k = smoothstep(BUILD_AT, BUILD_AT + BUILD_SECONDS, this.introT);
      this.build = ambient ? 1 : Math.min(buildTarget, k);
    }
    this.chain.setStamp(inStory ? stamp : null);

    // Section changes: leaving the story starts the bench clean; entering it from a manual break too.
    if (s.section !== this.lastSection) {
      if (this.lastSection === 'story' && s.section !== 'story' && this.storyBroken) {
        this.director.reviveAll(t);
        this.storyBroken = false;
      }
      this.lastSection = s.section;
    }

    this.director.setTraffic(traffic && !reduced);
    // A reset request (free play) empties the bench first; the wanted copies are then placed again below,
    // in this same pass, so a still frame is never left empty while the slider says three.
    if (!ambient && !inStory && s.deploy.resetNonce !== this.seenReset) {
      this.seenReset = s.deploy.resetNonce;
      this.director.reset(t);
      this.wantInstances = null;
    }
    if (region !== this.wantRegion) {
      this.wantRegion = region;
      if (this.wantInstances !== null) this.director.setRegion(region, t);
    }
    if (want !== this.wantInstances) {
      this.wantInstances = want;
      this.director.setInstances(want, region, t);
    }

    if (inStory) {
      if (breakPlan !== this.storyBroken) {
        this.storyBroken = breakPlan;
        if (breakPlan) this.director.breakOne(t);
        else this.director.reviveAll(t);
      }
    } else if (!ambient) {
      // Free play: the page's own requests.
      const d: DeployControls = s.deploy;
      if (d.breakNonce !== this.seenBreak) {
        this.seenBreak = d.breakNonce;
        if (this.wantInstances) this.director.breakOne(t);
      }
      if (d.reviveNonce !== this.seenRevive) {
        this.seenRevive = d.reviveNonce;
        this.director.reviveAll(t);
      }
    }
  }

  /**
   * The ambient scene's own script, as a pure function of the clock: a bench that deploys, serves, fails
   * and heals on a long loop. Returns how many instances should be placed; failures are edge triggered.
   */
  private ambientScript(t: number): number {
    const period = 36;
    const cycle = Math.floor(t / period);
    const local = t - cycle * period;
    if (cycle !== this.ambientCycle) {
      this.ambientCycle = cycle;
      this.ambientStep = 0;
      if (cycle > 0) {
        // A new loop starts from an empty bench with a different spread.
        this.director.reset(t, 7 + cycle * 13);
        this.wantInstances = null;
      }
    }
    if (this.ambientStep < 1 && local >= 16) {
      this.ambientStep = 1;
      if (this.wantInstances) this.director.breakOne(t);
    }
    if (this.ambientStep < 2 && local >= 23) {
      this.ambientStep = 2;
      this.director.reviveAll(t);
    }
    return local >= 2.4 ? 3 : 0;
  }

  private rebuildWorld(geo: ReturnType<typeof useSceneBus.getState>['geo']): void {
    const bench = this.makeBench(geo);
    this.world = buildWorld(bench);
    const seed = heroSeed(bench, 3);
    const sim = createSim({ bench, seed, place: { waitedMin: 120, spread: 'random' } });
    this.director.setSim(sim, this.directorWorld(), this.life);
    this.applyWorld(false);
    // Ignite again from the middle: new data arriving is an event worth seeing, once.
    this.introT = Math.min(this.introT, HERO_COPIES_AT - 0.6);
    this.wantInstances = null;
    if (this.mode === 'hero') {
      useSceneBus.getState().writeScene({ dataMode: bench.kind === 'live' ? 'live' : 'sample' });
    }
  }

  /**
   * The palette for the page's accent. The `--accent-*` custom properties are the source when they belong
   * to the same accent the bus asks for; if the document's `data-accent` says otherwise (a page that
   * updates the bus first, or not at all) the built-in palette for the bus accent is used instead.
   */
  private retarget(): void {
    const s = useSceneBus.getState();
    let attr: string | undefined;
    try {
      attr = document.documentElement.dataset.accent;
    } catch {
      attr = undefined;
    }
    const css = attr === undefined || attr === s.accent;
    this.blender.setTarget(readAccentPalette(s.accent, css ? this.readStyle() : null));
  }

  // ---- camera --------------------------------------------------------------------------------------------

  private updateCamera(
    s: ReturnType<typeof useSceneBus.getState>,
    dt: number,
    t: number,
    reduced: boolean,
  ): void {
    const ambient = this.mode === 'ambient';
    const preset = presetFor(s.section, s.chapter, ambient);
    const aspect = this.width / this.height;
    const rect = freeRect(s.insets, 0.04);
    const key = `${preset}|${aspect.toFixed(3)}|${rect.x0.toFixed(3)}|${rect.x1.toFixed(3)}|${rect.y0.toFixed(3)}|${rect.y1.toFixed(3)}`;
    if (key !== this.poseKey) {
      this.poseKey = key;
      this.preset = preset;
      if (preset !== 'ambient') {
        const fa = freeAspect(aspect, rect);
        this.shape = presetShape(preset, this.world.benchFrame, fa);
        resolvePose(this.shape, aspect, rect, this.targetPose);
      }
    }
    const pose = this.livePose;
    if (preset === 'ambient') {
      ambientPose(reduced ? 14 : t, this.world.benchFrame, aspect, this.targetPose);
    }
    const target = this.targetPose;
    if (reduced || this.frames === 0) {
      this.rig.snap(target);
    } else {
      this.rig.step(target, dt);
    }
    const rp = this.rig.pose;
    // Scrolling through a chapter nudges the camera: a slow push in and a little swing.
    let yaw = rp.yaw;
    let dist = rp.dist;
    if (s.section === 'story' && !ambient) {
      const p = s.chapterProgress;
      yaw += (p - 0.5) * 0.07;
      dist *= 1 - 0.05 * p;
    }
    // Pointer parallax: a few hundredths of a radian, fine pointers only.
    const fine = this.pointerFine && !reduced && !ambient;
    const pointer =
      s.pointer ?? (this.pointerInside ? { x: this.pointerNx * 2 - 1, y: -(this.pointerNy * 2 - 1) } : null);
    const tx = pointer && fine ? pointer.x : 0;
    const ty = pointer && fine ? pointer.y : 0;
    this.px = damp(this.px, tx, 3.2, dt || 1 / 60);
    this.py = damp(this.py, ty, 3.2, dt || 1 / 60);
    parallaxOffsets(this.px, this.py, fine ? 1 : 0, this.parallax);

    pose.tx = rp.tx;
    pose.ty = rp.ty;
    pose.tz = rp.tz;
    pose.yaw = yaw + this.parallax.yaw;
    pose.elev = rp.elev + this.parallax.elev;
    pose.dist = dist;
    pose.fov = rp.fov;
    pose.shiftX = rp.shiftX + this.parallax.shiftX;
    pose.shiftY = rp.shiftY + this.parallax.shiftY;

    const cam = this.camera;
    cameraPosition(pose, this.v);
    cam.position.copy(this.v);
    cam.lookAt(pose.tx, pose.ty, pose.tz);
    cam.fov = pose.fov;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    // Lens shift: the picture moves inside the canvas, the perspective does not change.
    const e = cam.projectionMatrix.elements;
    e[8] = (e[8] ?? 0) - pose.shiftX;
    e[9] = (e[9] ?? 0) - pose.shiftY;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.updateMatrixWorld();
    this.shared.uFogScale.value = Math.max(80, pose.dist * 2.1);
  }

  // ---- uniforms ------------------------------------------------------------------------------------------

  private updateCellUniforms(): void {
    const c = this.world.cell;
    this.shared.uCell.value.set(c.x, c.y, c.z, 7.5);
  }

  private updateUniforms(
    s: ReturnType<typeof useSceneBus.getState>,
    dt: number,
    t: number,
    reduced: boolean,
  ): void {
    const u = this.shared;
    const ambient = this.mode === 'ambient';
    u.uTime.value = t;
    u.uMotion.value = reduced ? 0 : 1;
    this.blender.step(dt, reduced);
    const pal: AccentPalette = this.blender.current;
    u.uAccent.value.set(pal.base[0], pal.base[1], pal.base[2]);
    u.uAccentHot.value.set(pal.hot[0], pal.hot[1], pal.hot[2]);
    u.uAccentCore.value.set(pal.core[0], pal.core[1], pal.core[2]);
    u.uHaze.value.set(pal.haze[0], pal.haze[1], pal.haze[2]);

    const dimTarget = ambient ? 1 : s.section === 'hero' || s.section === 'story' ? 1 : 0.5;
    this.dim = reduced ? dimTarget : damp(this.dim, dimTarget, 2.2, dt);
    const dimmed = ambient && reduced ? 0.6 : 1;
    u.uGlow.value = this.dim * dimmed;
    u.uBeat.value = reduced ? 0 : this.waves.beat(t);
    u.uExposure.value = 1.0;
    u.uReveal.value = this.reveal;
    u.uCellGlow.value = this.build * (ambient ? 0.7 : 1);
    u.uWaveCount.value = this.waves.pack(t, u.uWaveA.value, u.uWaveB.value);
    if (u.uWaveCount.value > MAX_WAVES) u.uWaveCount.value = MAX_WAVES;

    // Tier isolation (a hovered track card on the page).
    const tf = s.tierFocus;
    const want = (name: string) => (tf === null || tf === name ? 1 : 0.18);
    const f = u.uTierFocus.value;
    f.x = damp(f.x, want('cumulus'), 6, dt || 1 / 60);
    f.y = damp(f.y, want('nimbus'), 6, dt || 1 / 60);
    f.z = damp(f.z, want('stratus'), 6, dt || 1 / 60);

    // The hairline frame is a little quieter once the page is past the hero and the story.
    this.frameLines.uniforms.uFrameGain.value = s.section === 'hero' || s.section === 'story' ? 1 : 0.6;
  }

  // ---- director -> meshes ---------------------------------------------------------------------------------

  private updateDirectorVisuals(t: number): void {
    const ambient = this.mode === 'ambient';
    const fx = this.director.cellFx(t, this.fx);
    const c = this.world.cell;
    const cs = this.cellState;
    const bob = Math.sin(t * 0.55) * 0.35 * this.shared.uMotion.value;
    cs.x = c.x;
    cs.y = c.y + fx.lift + bob;
    cs.z = c.z;
    cs.radius = CELL_RADIUS * (ambient ? 0.78 : 1);
    cs.yaw = t * 0.13 + 0.35;
    cs.build = this.build;
    cs.charge = fx.charge;
    cs.flash = fx.flash;
    cs.intensity = ambient ? 0.82 : 1;
    cs.time = t;
    this.cellMesh.setCell(cs, fx.gauge);
    this.shared.uCell.value.set(cs.x, cs.y, cs.z, 7.5);

    const col = this.director.collect(t);
    for (let i = 0; i < MAX_COPIES; i++) {
      if (i < col.copyCount) {
        const k = col.copies[i];
        if (k) {
          this.cellMesh.setCopy(i, k.x, k.y, k.z, k.radius, k.yaw, k.tier, k.intensity, k.flash, k.alive);
          continue;
        }
      }
      this.cellMesh.hideCopy(i);
    }

    const cam = this.camera.position;
    this.ribbons.begin();
    for (let i = 0; i < col.ribbonCount; i++) {
      const r = col.ribbons[i];
      if (r) this.ribbons.add(r.path, r.style, cam.x, cam.y, cam.z);
    }
    // The hash on its way to the chain during the register chapter.
    const st = this.chain.stampState;
    if (st && st.travel > 0.001 && st.travel < 0.999) {
      const head = this.chainStrip.slot(0, this.chain.slide, { x: 0, z: 0 });
      makeArc(cs.x, cs.y, cs.z, head.x, 2.2, head.z, { apexK: 0.34, minApex: 5, maxApex: 20 }, this.hashPath);
      const h = this.hashStyle;
      h.head = clamp(st.travel, 0.001, 1);
      h.tail = clamp(st.travel - 0.3, 0, 1);
      this.ribbons.add(this.hashPath, h, cam.x, cam.y, cam.z);
    }
    this.ribbons.end();

    // The chain strip: visible in every state; brighter during the register chapter.
    this.chainStrip.upload(this.chain, ambient ? 0.75 : 1);
  }

  // ---- picking ------------------------------------------------------------------------------------------

  private pointerMove(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    this.pointerFine = e.pointerType !== 'touch';
    this.pointerInside = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1;
    this.pointerNx = nx;
    this.pointerNy = ny;
    if (this.pointerInside && this.opts.manual) this.needsFrame = true;
  }

  private pointerDown(e: PointerEvent): void {
    if (this.mode === 'ambient') return;
    const r = this.canvas.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
    const target = e.target as Element | null;
    if (target?.closest?.('a,button,input,select,textarea,summary,label,[role="button"],[data-no-stage]'))
      return;
    useSceneBus.getState().pulse('click', { x: nx, y: ny, strength: 0.9 });
  }

  private updatePicking(s: ReturnType<typeof useSceneBus.getState>, dt: number): void {
    const u = this.shared;
    const interactive =
      this.mode === 'hero' &&
      this.pointerFine &&
      this.pointerInside &&
      !s.reducedMotion &&
      (s.section === 'hero' || s.section === 'story');
    // The cursor lifts the bench under it.
    let strength = 0;
    if (interactive && this.benchPoint(this.pointerNx, this.pointerNy, this._bp)) {
      this.cursorX = this._bp.x;
      this.cursorZ = this._bp.z;
      strength = 1;
    }
    this.cursorStrength = damp(this.cursorStrength, strength, 7, dt || 1 / 60);
    u.uCursor.value.set(this.cursorX, this.cursorZ, this.cursorStrength * 0.8, 5.5);

    // Nearest pillar in screen space.
    let best = -1;
    if (interactive) {
      const p = this.world.pillars;
      const rw = this.width;
      const rh = this.height;
      const mx = this.pointerNx * rw;
      const my = this.pointerNy * rh;
      let bestD = 22 * 22;
      for (let i = 0; i < p.count; i++) {
        this.v.set(p.x[i] ?? 0, (p.height[i] ?? 1) * 0.6, p.z[i] ?? 0).project(this.camera);
        if (this.v.z > 1) continue;
        const sx = (this.v.x * 0.5 + 0.5) * rw;
        const sy = (-this.v.y * 0.5 + 0.5) * rh;
        const d = (sx - mx) ** 2 + (sy - my) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    if (best >= 0) this.hoverIndex = best;
    this.hoverAmount = damp(this.hoverAmount, best >= 0 ? 1 : 0, 10, dt || 1 / 60);
    if (best < 0 && this.hoverAmount < 0.01) this.hoverIndex = -1;
    u.uHover.value.set(this.hoverIndex, this.hoverAmount);
    this.publishHover(best);
  }

  private publishHover(best: number): void {
    const bus = useSceneBus.getState();
    if (best < 0) {
      if (this.lastHoverKey !== '') {
        this.lastHoverKey = '';
        bus.writeScene({ hover: null });
      }
      return;
    }
    const node = this.world.bench.nodes[best];
    if (!node) return;
    const inst = this.director.simulation.state().instances;
    const hosting = inst.some((i) => i.node === best);
    const up = this.director.simulation.state().nodeUp[best] === 1;
    const sx = Math.round(this.pointerNx * this.width);
    const sy = Math.round(this.pointerNy * this.height);
    this.lastHoverKey = `${best}`;
    bus.writeScene({
      hover: {
        x: sx,
        y: sy,
        tier: node.tier,
        cc: node.cc || null,
        nodes: this.world.bench.kind === 'live' ? node.count : null,
        hosting,
        healthy: up,
      },
    });
  }

  // ---- draw -----------------------------------------------------------------------------------------------

  private draw(t: number): void {
    const r = this.renderer;
    r.info.reset();
    this.gpu?.begin();
    if (this.usePost && this.post.target) {
      r.setRenderTarget(this.post.target);
      r.clear();
      r.render(this.scene, this.camera);
      const ambient = this.mode === 'ambient';
      const d = this.dim;
      this.post.finish(
        {
          exposure: 1,
          bloom: this.config.bloom * (ambient ? 1.35 : 1.15) * (0.55 + 0.45 * d),
          chroma: ambient ? 0.0048 : 0.0042,
          grain: 0.55,
          vignette: 0.82,
          fade: 1,
          time: t,
          threshold: 0.7,
          dirt: 0.55,
          veil: [0, 0, 0],
        },
        Math.round(this.width * this.dpr),
        Math.round(this.height * this.dpr),
      );
    } else {
      r.setRenderTarget(null);
      r.clear();
      r.render(this.scene, this.camera);
    }
    this.gpu?.end();
    this.gpu?.poll();
  }

  // ---- outputs --------------------------------------------------------------------------------------------

  private publish(s: ReturnType<typeof useSceneBus.getState>): void {
    const st = this.director.stats;
    const now = performance.now();
    const patch: Partial<SceneSlice> = {};
    if (!s.scene.ready && this.frames >= 1) {
      patch.ready = true;
      patch.webgl = true;
      patch.reason = 'ok';
      patch.tier = this.tier;
      patch.dataMode = this.world.bench.kind === 'live' ? 'live' : 'sample';
    }
    if (st.placed !== this.lastPlaced || st.healthy !== this.lastHealthy || st.status !== this.lastStatus) {
      this.lastPlaced = st.placed;
      this.lastHealthy = st.healthy;
      this.lastStatus = st.status;
      patch.instancesPlaced = st.placed;
      patch.healthy = st.healthy;
      patch.up = st.healthy > 0;
      patch.status = statusLine(st.status, st.placed, st.healthy);
    }
    if (now - this.lastStatsWrite > 500) {
      this.lastStatsWrite = now;
      if (s.scene.tier !== this.tier) patch.tier = this.tier;
      const f = Math.round(this.fps);
      if (s.scene.fps !== f) patch.fps = f;
    }
    // The hero scene owns the slice; an ambient scene only reads the bus (see host.tsx).
    if (this.mode === 'hero' && Object.keys(patch).length > 0) useSceneBus.getState().writeScene(patch);

    if (this.debug) {
      const info = this.renderer.info;
      const ds: DebugStats = {
        tier: this.tier,
        fps: this.fps,
        frameMs: this.frameMs,
        gpuMs: this.gpu?.ms ?? null,
        gpuTimer: this.gpu?.available ?? false,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        cells: this.terrain.count,
        pillars: this.pillars.count,
        particles: this.dust.count,
        ribbons: this.ribbons.count,
        waves: this.waves.activeCount(),
        dpr: this.dpr,
        width: Math.round(this.width * this.dpr),
        height: Math.round(this.height * this.dpr),
        preset: this.preset,
        dataMode: this.world.bench.kind,
        placed: st.placed,
        healthy: st.healthy,
        status: st.status,
        post: this.usePost,
      };
      this.debug.update(now, ds);
    }
  }

  get stats(): EngineStats {
    const info = this.renderer.info;
    const st = this.director.stats;
    return {
      tier: this.tier,
      fps: this.fps,
      frameMs: this.frameMs,
      gpuMs: this.gpu?.ms ?? null,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      cells: this.terrain.count,
      pillars: this.pillars.count,
      particles: this.dust.count,
      ribbons: this.ribbons.count,
      dpr: this.dpr,
      width: this.width,
      height: this.height,
      preset: this.preset,
      placed: st.placed,
      healthy: st.healthy,
      status: st.status,
      clock: this.clock,
      frames: this.frames,
    };
  }

  /** Screen position (CSS px in the stage) of a node pillar's top, or null when it is behind the camera. */
  projectNode(index: number): { x: number; y: number } | null {
    const p = this.world.pillars;
    if (index < 0 || index >= p.count) return null;
    this.v.set(p.x[index] ?? 0, (p.height[index] ?? 1) * 0.6, p.z[index] ?? 0).project(this.camera);
    if (this.v.z > 1) return null;
    return { x: (this.v.x * 0.5 + 0.5) * this.width, y: (-this.v.y * 0.5 + 0.5) * this.height };
  }

  /** The simulation behind the picture (the lab and tests read it). */
  get simulation() {
    return this.director.simulation;
  }

  get directorRef(): Director {
    return this.director;
  }

  // ---- teardown ---------------------------------------------------------------------------------------------

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unsubBus();
    this.offCover();
    this.io?.disconnect();
    this.ro?.disconnect();
    this.mo?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.director.dispose();
    this.debug?.dispose();
    this.gpu?.dispose();
    this.terrain.dispose();
    this.floor.dispose();
    this.frameLines.dispose();
    this.pillars.dispose();
    this.chainStrip.dispose();
    this.cellMesh.dispose();
    this.ribbons.dispose();
    this.dust.dispose();
    this.post.dispose();
    for (const t of this.textures) t.dispose();
    this.textures.length = 0;
    this.renderer.dispose();
    try {
      this.renderer.forceContextLoss();
    } catch {
      // The context may already be gone.
    }
  }
}
