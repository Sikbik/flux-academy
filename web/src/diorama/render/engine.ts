/**
 * The diorama's Canvas 2D renderer. It owns one canvas, one rAF loop, the camera, the baked terrain
 * layer and every transient effect. The React layer hands it a simulation and some flags and listens to
 * its callbacks; nothing in the frame loop goes through React.
 *
 * Frame policy: a continuous loop runs only while the figure is on screen, the tab is visible, the stage
 * is not paused and motion is allowed. Under reduced motion (or paused) a frame is drawn on demand, once,
 * whenever something changes, so the canvas costs nothing at rest. While the loop runs it is paced: at most
 * about 60 drawn frames per second (a 120 Hz display gets every second refresh), and about 30 while the
 * figure is quiet (see `isQuiet`), which halves its cost at rest.
 */
import { type ActiveTier, Governor, initialPlan, TIER_PARAMS } from '@/lib/quality';
import { gridAt } from '../model/geometry';
import {
  type Bench,
  type BenchNode,
  REGION_INDEX,
  REGION_NAMES,
  type Region,
  type Tier,
} from '../model/types';
import { hasEmptyDisk } from '../sim/rules';
import type { Sim, SimEvent, VolumeMode } from '../sim/types';
import { easeInOutCubic, easeOutCubic, smoothstep } from '../util';
import { drawProbe } from './annotate';
import { Camera } from './camera';
import { type CellState, drawCell, makeCellState } from './cell';
import {
  drawCandidates,
  drawGate,
  drawInstanceArcs,
  drawPackets,
  drawRings,
  drawRoles,
  drawUsers,
  FLIGHT_MS,
  nodeTop,
  type Pt,
  USER_STEM,
} from './fx';
import { Annotator } from './labels';
import { type Palette, readPalette } from './palette';
import {
  AMBIENT_R,
  drawPillarGlow,
  drawPrism,
  FEATURED_H,
  FEATURED_R,
  makePillarGeo,
  makeStyle,
  type PillarGeo,
  projectPillars,
  projectPrism,
} from './pillars';
import { resolveAnnotations, SCENES, type SceneId } from './scenes';
import { makeSprites } from './sprites';
import { Fx, type HoverInfo, MAX_SLOTS, RK_ACCENT, type View } from './state';
import { bloomLayer, makeTerrainGeo, renderTerrain, type TerrainGeo } from './terrain';

export type { HoverInfo } from './state';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  /** Observed for size and visibility; CSS tokens are read from it. */
  host: HTMLElement;
  sim: Sim;
  scene: SceneId;
  annotate?: readonly string[];
  /** The volume mode a stage chose on purpose (it brings the scene's volume annotations by default). */
  volume?: VolumeMode;
  region?: Region | null;
  tierFilter?: Tier | 'all';
  reducedMotion?: boolean;
  paused?: boolean;
  domain?: string;
  ports?: { external?: number; container?: number };
  onHover?: (info: HoverInfo | null) => void;
  onActivate?: (info: HoverInfo) => void;
}

export interface EngineStats {
  /** Frames drawn per second (about 30 while `quiet`, about 60 otherwise). */
  fps: number;
  frameMs: number;
  /** True while the figure is at rest and the loop is paced to about 30 frames per second. */
  quiet: boolean;
  tier: ActiveTier;
  dpr: number;
  cells: number;
  nodes: number;
  width: number;
  height: number;
}

export interface Engine {
  /** Swaps the simulation (and with it the bench). */
  setSim(sim: Sim): void;
  setScene(scene: SceneId): void;
  setAnnotations(names: readonly string[] | undefined): void;
  /** The volume mode a stage chose on purpose, or undefined: only changes the default annotations. */
  setVolume(volume: VolumeMode | undefined): void;
  setRegion(region: Region | null): void;
  setTierFilter(tier: Tier | 'all'): void;
  /** Lights the pillars of these ISO alpha-2 country codes and dims the rest (null or empty clears it). */
  setHighlight(codes: readonly string[] | null): void;
  setReducedMotion(v: boolean): void;
  setPaused(v: boolean): void;
  setDomain(domain: string): void;
  setPorts(ports: { external?: number; container?: number } | undefined): void;
  /** Re-reads the design tokens (accent switch) and redraws. */
  restyle(): void;
  invalidate(): void;
  /** Draws a keyboard focus ring on a node (null clears it). */
  focusNode(index: number | null): void;
  /** One block pulse ring across the bench. */
  beat(): void;
  /** Screen position of a node's cap in canvas CSS pixels. */
  nodeScreen(index: number): { x: number; y: number } | null;
  stats(): EngineStats;
  dispose(): void;
}

/** Frames after a launch during which the specimen stays lifted (launches are staggered). */
const STAGGER_PAD = 400;

const HIT_CELL = 28;
const BLOOM_FULL: readonly number[] = [4, 10];
const BLOOM_LITE: readonly number[] = [6];
const TWEEN_MS = 620;

const GAUGES: Record<'small' | 'medium' | 'large', readonly [number, number, number]> = {
  small: [0.34, 0.28, 0.2],
  medium: [0.58, 0.5, 0.34],
  large: [0.82, 0.74, 0.56],
};

/** Hexagon outline in the ellipse (rx, ry) around (x, y). */
function hexLoop(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  for (let k = 0; k <= 6; k++) {
    const ang = Math.PI / 6 + (k * Math.PI) / 3;
    const px = x + Math.cos(ang) * rx;
    const py = y + Math.sin(ang) * ry;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
}

/** A hexagon outline drawn only up to fraction `f` of its perimeter. */
function hexArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  f: number,
): void {
  ctx.beginPath();
  const steps = Math.max(1, Math.ceil(6 * f));
  for (let k = 0; k <= steps; k++) {
    const g = Math.min(f * 6, k);
    const ang = Math.PI / 6 + (g * Math.PI) / 3;
    const px = x + Math.cos(ang) * rx;
    const py = y + Math.sin(ang) * ry;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
}

export function createEngine(opts: EngineOptions): Engine {
  const { canvas, host } = opts;
  let sim = opts.sim;
  const ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
  let bench: Bench = sim.bench;
  let annotateRequested: readonly string[] | undefined = opts.annotate;
  let volumeChosen: VolumeMode | undefined = opts.volume;
  let annotationNames = resolveAnnotations(opts.scene, annotateRequested, volumeChosen);
  let reduced = opts.reducedMotion ?? false;
  let paused = opts.paused ?? false;
  let onScreen = true;
  let docVisible = typeof document === 'undefined' ? true : !document.hidden;
  let disposed = false;
  let raf = 0;

  // ---- quality -------------------------------------------------------------------------------------
  const plan = initialPlan();
  const forced = plan.forced === null ? null : (Math.max(1, plan.forced) as ActiveTier);
  const governor = new Governor({
    start: forced ?? plan.plan.start,
    ceiling: forced ?? plan.plan.ceiling,
    floor: forced ?? 1,
    locked: forced !== null,
  });

  // ---- layers and geometry ---------------------------------------------------------------------------
  const camFrom = new Camera();
  const camTo = new Camera();
  let tween = -1;
  const pal0: Palette = readPalette(host);
  let terrainGeo: TerrainGeo = makeTerrainGeo(bench.cells.count);
  let pillarGeo: PillarGeo = makePillarGeo(bench.nodes.length);
  let regionWeights: Float32Array | null = null;
  const layer = document.createElement('canvas');
  const layerCtx = layer.getContext('2d') as CanvasRenderingContext2D;
  const bloomScratch: HTMLCanvasElement[] = [];
  const postScratch: HTMLCanvasElement[] = [];
  let layerValid = false;
  let lift = new Float32Array(bench.nodes.length);
  let slotOf = new Int32Array(bench.nodes.length).fill(-1);
  const instNodes = new Int32Array(MAX_SLOTS);
  let instCount = 0;
  let hoverNode = -1;
  let focusIdx = -1;
  let hiCodes: readonly string[] | null = null;
  let hiOn = false;
  let hiMask = new Uint8Array(bench.nodes.length);

  const v: View = {
    ctx,
    cam: new Camera(),
    pal: pal0,
    sprites: makeSprites(pal0),
    bench,
    sim,
    geo: pillarGeo,
    W: 0,
    H: 0,
    dpr: 1,
    tier: governor.tier,
    reduced,
    sceneId: opts.scene,
    scene: SCENES[opts.scene],
    region: opts.region ?? null,
    tierFilter: opts.tierFilter ?? 'all',
    domain: opts.domain ?? 'myapp.app.runonflux.io',
    ports: opts.ports,
    t: 0,
    specimen: { x: 0, y: 0, size: 80, lift: 0 },
    mapBox: { x0: 0, y0: 0, x1: 0, y1: 0 },
    lift,
    narrow: false,
    hBoost: 1,
  };
  const fx = new Fx(v, bench.nodes.length);
  const annot = new Annotator();
  const style = makeStyle();
  const stackTmp: [number, number, number] = [0, 0, 0];
  const featPoly = new Float32Array(24);
  const cellState: CellState = makeCellState();
  const A: Pt = { x: 0, y: 0 };

  let ambient = 1;
  let layersBuilt = 5;
  let specFlash = 0;
  let pointer: { x: number; y: number } | null = null;
  let hover: HoverInfo | null = null;
  let hoverLines: string[] = [];
  let hoverLinesAt = -1;
  let lastStats: EngineStats = {
    fps: 0,
    frameMs: 0,
    quiet: false,
    tier: v.tier,
    dpr: 1,
    cells: bench.cells.count,
    nodes: bench.nodes.length,
    width: 0,
    height: 0,
  };

  // ---- sizing ------------------------------------------------------------------------------------------
  function targetDpr(): number {
    const ratio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    return Math.min(ratio, TIER_PARAMS[v.tier].dprMax);
  }

  function continuous(): boolean {
    return !reduced && !paused && onScreen && docVisible;
  }

  /** Fit points: land cells plus the caps of pillars, so tall pillars at the north edge stay inside. */
  function viewTargetPoints(): Float32Array {
    const cells = bench.cells;
    const nodes = bench.nodes;
    const want = v.region ? REGION_INDEX[v.region] : -1;
    let count = 0;
    for (let i = 0; i < cells.count; i++) if (want < 0 || cells.region[i] === want) count++;
    for (let i = 0; i < nodes.length; i++)
      if (want < 0 || REGION_INDEX[(nodes[i] as BenchNode).region] === want) count++;
    const pts = new Float32Array(count * 3);
    let o = 0;
    for (let i = 0; i < cells.count; i++) {
      if (want >= 0 && cells.region[i] !== want) continue;
      pts[o++] = cells.x[i] as number;
      pts[o++] = cells.y[i] as number;
      pts[o++] = 0;
    }
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i] as BenchNode;
      if (want >= 0 && REGION_INDEX[n.region] !== want) continue;
      pts[o++] = n.x;
      pts[o++] = n.y;
      pts[o++] = n.height * v.hBoost * FEATURED_H;
    }
    return pts;
  }

  function frameCamera(target: Camera): void {
    const W = v.W;
    const H = v.H;
    const padX = Math.max(14, W * (v.region ? 0.07 : 0.035));
    const sSize = Math.min(96, Math.max(40, Math.min(W * 0.075, H * 0.15)));
    v.specimen.size = sSize;
    v.specimen.x = W / 2;
    v.specimen.y = 12 + sSize * 0.9;
    const bottom = v.scene.pipeline ? 62 : 26;
    const top = v.scene.specimen ? sSize * 1.55 + 18 : 28;
    target.pitch = (v.scene.specimen ? 0.7 : 0.9) + (v.narrow ? 0.12 : 0);
    target.dist = (bench.extent.maxX - bench.extent.minX) * 1.0;
    const pts = viewTargetPoints();
    target.fitPoints(pts, W, H, { left: padX, right: padX, top, bottom });
    if (v.scene.specimen) {
      // Rest the map on the bottom margin, leaving the sky to the specimen and its arcs.
      let y1 = Number.NEGATIVE_INFINITY;
      for (let i = 0; i + 2 < pts.length; i += 3) {
        target.project(pts[i] as number, pts[i + 1] as number, pts[i + 2] as number);
        if (target.sy > y1) y1 = target.sy;
      }
      const slack = H - bottom - y1;
      if (slack > 0) {
        target.oy += slack;
        target.update();
      }
    }
  }

  function computeMapBox(): void {
    const cells = bench.cells;
    const cam = v.cam;
    let x0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    const want = v.region ? REGION_INDEX[v.region] : -1;
    for (let i = 0; i < cells.count; i++) {
      if (want >= 0 && cells.region[i] !== want) continue;
      cam.project(cells.x[i] as number, cells.y[i] as number, 0);
      if (cam.sx < x0) x0 = cam.sx;
      if (cam.sx > x1) x1 = cam.sx;
      if (cam.sy < y0) y0 = cam.sy;
      if (cam.sy > y1) y1 = cam.sy;
    }
    v.mapBox.x0 = x0;
    v.mapBox.x1 = x1;
    v.mapBox.y0 = y0;
    v.mapBox.y1 = y1;
  }

  function rebuildWeights(): void {
    if (!v.region) {
      regionWeights = null;
      return;
    }
    const cells = bench.cells;
    const w = new Float32Array(cells.count);
    const want = REGION_INDEX[v.region];
    for (let i = 0; i < cells.count; i++) w[i] = cells.region[i] === want ? 1 : 0.22;
    regionWeights = w;
  }

  function bake(): void {
    const W = v.W;
    const H = v.H;
    layerCtx.setTransform(1, 0, 0, 1, 0, 0);
    layerCtx.clearRect(0, 0, layer.width, layer.height);
    layerCtx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    renderTerrain(layerCtx, v.cam, bench, v.pal, terrainGeo, { width: W, height: H, weight: regionWeights });
    if (v.tier >= 2) bloomLayer(layer, layerCtx, bloomScratch, 0.14);
    // Atmosphere: the far (north) rows sit a little deeper in the dark.
    const span = Math.max(1, v.mapBox.y1 - v.mapBox.y0);
    layerCtx.save();
    layerCtx.setTransform(1, 0, 0, 1, 0, 0);
    layerCtx.globalCompositeOperation = 'destination-in';
    const g = layerCtx.createLinearGradient(0, v.mapBox.y0 * v.dpr, 0, (v.mapBox.y0 + span * 0.85) * v.dpr);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    layerCtx.fillStyle = g;
    layerCtx.fillRect(0, 0, layer.width, layer.height);
    layerCtx.restore();
    layerValid = true;
  }

  // ---- hit testing: a spatial grid over pillar capsules --------------------------------------------------
  let hitCols = 0;
  let hitRows = 0;
  let hitStart = new Int32Array(1);
  let hitItems = new Int32Array(0);

  function pillarBox(i: number, out: Float32Array): void {
    const r = (pillarGeo.ps[i] as number) * FEATURED_R * 1.2 + 6;
    const bx = pillarGeo.baseX[i] as number;
    const by = pillarGeo.baseY[i] as number;
    const h = by - (pillarGeo.topY[i] as number);
    const ty = by - h * FEATURED_H;
    out[0] = Math.max(0, bx - r);
    out[1] = Math.max(0, ty - r);
    out[2] = Math.min(v.W, bx + r);
    out[3] = Math.min(v.H, by + r);
  }

  const boxTmp = new Float32Array(4);

  function buildHit(): void {
    hitCols = Math.ceil(v.W / HIT_CELL) + 1;
    hitRows = Math.ceil(v.H / HIT_CELL) + 1;
    const cellsN = hitCols * hitRows;
    const counts = new Int32Array(cellsN + 1);
    const n = pillarGeo.n;
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) {
        for (let c = 0; c < cellsN; c++) counts[c + 1] = (counts[c + 1] as number) + (counts[c] as number);
        hitStart = counts.slice();
        hitItems = new Int32Array(counts[cellsN] as number);
      }
      const fill = new Int32Array(cellsN);
      for (let i = 0; i < n; i++) {
        pillarBox(i, boxTmp);
        const cx0 = Math.floor((boxTmp[0] as number) / HIT_CELL);
        const cy0 = Math.floor((boxTmp[1] as number) / HIT_CELL);
        const cx1 = Math.floor((boxTmp[2] as number) / HIT_CELL);
        const cy1 = Math.floor((boxTmp[3] as number) / HIT_CELL);
        for (let cy = cy0; cy <= cy1; cy++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            if (cx < 0 || cy < 0 || cx >= hitCols || cy >= hitRows) continue;
            const c = cy * hitCols + cx;
            if (pass === 0) counts[c + 1] = (counts[c + 1] as number) + 1;
            else {
              hitItems[(hitStart[c] as number) + (fill[c] as number)] = i;
              fill[c] = (fill[c] as number) + 1;
            }
          }
        }
      }
    }
  }

  function pickNode(px: number, py: number): number {
    const cx = Math.floor(px / HIT_CELL);
    const cy = Math.floor(py / HIT_CELL);
    if (cx < 0 || cy < 0 || cx >= hitCols || cy >= hitRows) return -1;
    const c = cy * hitCols + cx;
    let best = -1;
    let bestScore = Number.POSITIVE_INFINITY;
    const end = hitStart[c + 1] as number;
    for (let k = hitStart[c] as number; k < end; k++) {
      const i = hitItems[k] as number;
      const f = lift[i] as number;
      const r = (pillarGeo.ps[i] as number) * (AMBIENT_R + (FEATURED_R - AMBIENT_R) * f) * 1.15 + 5;
      const bx = pillarGeo.baseX[i] as number;
      const by = pillarGeo.baseY[i] as number;
      const h = by - (pillarGeo.topY[i] as number);
      const ty = by - h * (1 + (FEATURED_H - 1) * f);
      // Distance from the point to the vertical segment from foot to cap.
      const len = by - ty;
      const t = len > 0 ? Math.max(0, Math.min(1, (by - py) / len)) : 0;
      const qy = by - len * t;
      const d = Math.hypot(px - bx, py - qy);
      if (d > r) continue;
      // The nearer pillar (larger foot y) wins; the axis distance breaks ties.
      const score = -by * 10 + d;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    return best;
  }

  const cellPos: [number, number] = [0, 0];

  function pickAt(px: number, py: number): HoverInfo | null {
    const sp = v.specimen;
    if (v.scene.specimen) {
      const s = sp.size;
      if (Math.abs(px - sp.x) < s * 0.55 && py > sp.y - s * 0.62 - sp.lift && py < sp.y + s * 0.62) {
        return { kind: 'specimen', index: 0, x: sp.x, y: sp.y };
      }
    }
    const n = pickNode(px, py);
    if (n >= 0)
      return { kind: 'node', index: n, x: pillarGeo.topX[n] as number, y: pillarGeo.topY[n] as number };
    if (v.scene.users) {
      const cam = v.cam;
      for (let u = 0; u < bench.users.length; u++) {
        const user = bench.users[u]!;
        cam.project(user.x, user.y, 0.2);
        const head = cam.sy - USER_STEM;
        if (Math.hypot(cam.sx - px, head - py) < 12) return { kind: 'user', index: u, x: cam.sx, y: head };
      }
    }
    v.cam.unproject(px, py, 0.4);
    gridAt(bench.geom, v.cam.gx, v.cam.gy, cellPos);
    const col = cellPos[0];
    const row = cellPos[1];
    if (col >= 0 && row >= 0 && col < bench.geom.cols && row < bench.geom.rows) {
      const ci = bench.cells.grid[row * bench.geom.cols + col] as number;
      if (ci >= 0)
        return { kind: 'cell', index: ci, x: terrainGeo.cx[ci] as number, y: terrainGeo.cy[ci] as number };
    }
    return null;
  }

  // ---- layout ---------------------------------------------------------------------------------------------
  function fullLayout(instant: boolean): void {
    if (v.W < 4 || v.H < 4) return;
    camFrom.copyFrom(v.cam);
    frameCamera(camTo);
    rebuildWeights();
    if (!instant && continuous() && layerValid) {
      tween = v.t;
    } else {
      v.cam.copyFrom(camTo);
      tween = -1;
      computeMapBox();
      bake();
      projectPillars(v.cam, bench, pillarGeo, true, v.hBoost);
      buildHit();
    }
    invalidate();
  }

  function resize(): void {
    const rect = host.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const d = targetDpr();
    if (w === v.W && h === v.H && d === v.dpr) return;
    v.W = w;
    v.H = h;
    v.dpr = d;
    v.narrow = w < 520;
    v.hBoost = v.narrow ? 1.35 : 1;
    canvas.width = Math.max(1, Math.round(w * d));
    canvas.height = Math.max(1, Math.round(h * d));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    layer.width = canvas.width;
    layer.height = canvas.height;
    layerValid = false;
    tween = -1;
    frameCamera(camTo);
    v.cam.copyFrom(camTo);
    rebuildWeights();
    computeMapBox();
    bake();
    projectPillars(v.cam, bench, pillarGeo, true, v.hBoost);
    buildHit();
  }

  function applyHighlight(): void {
    const n = bench.nodes.length;
    if (hiMask.length !== n) hiMask = new Uint8Array(n);
    hiMask.fill(0);
    hiOn = !!hiCodes && hiCodes.length > 0;
    if (!hiOn || !hiCodes) return;
    const set = new Set(hiCodes.map((c) => c.toUpperCase()));
    for (let i = 0; i < n; i++) {
      const cc = (bench.nodes[i] as BenchNode).cc;
      if (cc && set.has(cc.toUpperCase())) hiMask[i] = 1;
    }
  }

  function allocForBench(): void {
    const n = bench.nodes.length;
    terrainGeo = makeTerrainGeo(bench.cells.count);
    pillarGeo = makePillarGeo(n);
    lift = new Float32Array(n);
    slotOf = new Int32Array(n).fill(-1);
    instCount = 0;
    hoverNode = -1;
    focusIdx = -1;
    hiMask = new Uint8Array(n);
    applyHighlight();
    hover = null;
    hoverLines = [];
    v.bench = bench;
    v.geo = pillarGeo;
    v.lift = lift;
    fx.resize(n);
    annot.reset();
    regionWeights = null;
  }

  // ---- per frame ---------------------------------------------------------------------------------------------
  function describe(info: HoverInfo | null): string[] {
    if (!info) return [];
    const st = sim.state();
    if (info.kind === 'node') {
      const n = bench.nodes[info.index];
      if (!n) return [];
      const lines: string[] = [];
      lines.push(n.count > 1 ? `${n.tier.toUpperCase()}  ${n.count} NODES` : n.tier.toUpperCase());
      lines.push(n.label || n.id);
      let slot = -1;
      for (let k = 0; k < st.instances.length; k++) {
        if (st.instances[k]!.node === info.index) {
          slot = k;
          break;
        }
      }
      if (st.nodeUp[info.index] === 0) lines.push(slot >= 0 ? `INSTANCE ${slot + 1}  OFFLINE` : 'OFFLINE');
      else if (slot >= 0) lines.push(`INSTANCE ${slot + 1}  ${st.instances[slot]!.status.toUpperCase()}`);
      else if (n.operator && bench.kind === 'sample') lines.push(`HOSTING ${n.operator}`);
      // The same words the `lost-data` annotation draws: shown only where the scene says them.
      if (slot >= 0 && annotationNames.includes('lost-data') && hasEmptyDisk(st.instances[slot]!)) {
        lines.push('EMPTY DISK');
      }
      return lines;
    }
    if (info.kind === 'cell') {
      const c = bench.cells;
      const lat = c.lat[info.index] as number;
      const lon = c.lon[info.index] as number;
      const region = (['NA', 'SA', 'EU', 'AF', 'AS', 'OC'] as const)[c.region[info.index] as number];
      return [
        region ? REGION_NAMES[region].toUpperCase() : '',
        `${Math.abs(lat).toFixed(1)}${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(1)}${lon >= 0 ? 'E' : 'W'}`,
      ];
    }
    if (info.kind === 'user') {
      const u = bench.users[info.index];
      return u ? ['REQUEST SOURCE', u.label.toUpperCase()] : [];
    }
    return ['YOUR APP', `${st.count} ${st.count === 1 ? 'INSTANCE' : 'INSTANCES'}`];
  }

  function setHover(next: HoverInfo | null): void {
    const same =
      (next === null && hover === null) ||
      (next !== null && hover !== null && next.kind === hover.kind && next.index === hover.index);
    hover = next;
    hoverNode = next && next.kind === 'node' ? next.index : -1;
    if (!same) {
      hoverLines = describe(next);
      hoverLinesAt = v.t;
      opts.onHover?.(next);
    }
  }

  function applyDeath(i: number, alphaMul: { a: number }): void {
    // Sets style.dead, crack and glow from the node's death or revival timeline.
    const st = sim.state();
    if (st.nodeUp[i] === 0) {
      const d = fx.deathAt[i] as number;
      const age = d >= 0 ? v.t - d : 10_000;
      if (age < 760 && !reduced) alphaMul.a *= Math.floor(age / 126) % 2 === 0 ? 1 : 0.22;
      style.dead = reduced ? 1 : smoothstep(0, 900, age);
      style.crack = reduced ? 1 : smoothstep(260, 1000, age);
      style.glow = 0.05;
      style.lit = 0.12;
    } else {
      const r = fx.reviveAt[i] as number;
      if (r >= 0 && !reduced) {
        const age = v.t - r;
        if (age < 900) {
          style.dead = 1 - smoothstep(0, 520, age);
          style.lit = 1;
        }
      }
    }
  }
  const alphaBox = { a: 1 };

  function capRing(x: number, y: number, rpx: number, i: number, focused: boolean): void {
    const st = sim.state();
    const pal = v.pal;
    const slot = slotOf[i] as number;
    const s = slot >= 0 ? st.instances[slot] : undefined;
    const dead = st.nodeUp[i] === 0;
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(v.t / 500 + i);
    const r = rpx * 1.55;
    const ry = r * 0.62;
    ctx.lineJoin = 'round';
    if (s && !dead) {
      if (s.status === 'starting' && !reduced) {
        hexArc(ctx, x, y, r, ry, s.startProgress);
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = pal.rHot.a(0.95);
        ctx.stroke();
      } else {
        hexLoop(ctx, x, y, r, ry);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = pal.rHot.a(0.5 + 0.4 * pulse);
        ctx.stroke();
        if (v.scene.roles && s.role === 'primary') {
          hexLoop(ctx, x, y, r * 1.35, ry * 1.35);
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = pal.rHot.a(0.95);
          ctx.stroke();
          hexLoop(ctx, x, y, r * 1.7, ry * 1.7);
          ctx.lineWidth = 1;
          ctx.strokeStyle = pal.rHot.a(0.4);
          ctx.stroke();
        } else if (v.scene.roles && s.role === 'standby') {
          if (s.sync < 1) {
            hexArc(ctx, x, y, r * 1.3, ry * 1.3, s.sync);
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = pal.rAccentHot.a(0.95);
            ctx.stroke();
          } else {
            hexLoop(ctx, x, y, r * 1.3, ry * 1.3);
            ctx.lineWidth = 1;
            ctx.strokeStyle = pal.rAccentHot.a(0.55);
            ctx.stroke();
          }
        }
      }
    } else if (dead && s) {
      hexLoop(ctx, x, y, r, ry);
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.rCrit.a(0.7);
      ctx.stroke();
    }
    if (focused) {
      hexLoop(ctx, x, y, r * 1.9, ry * 1.9);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = pal.rHot.a(1);
      ctx.stroke();
      hexLoop(ctx, x, y, r * 2.35, ry * 2.35);
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.rHot.a(0.5);
      ctx.stroke();
    }
  }

  function draw(dtMs: number): void {
    const st = sim.state();
    const { W, H, cam, pal, sprites } = v;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);

    // A camera move (region change): the fast terrain path runs while it lasts.
    if (tween >= 0) {
      const u = Math.min(1, (v.t - tween) / TWEEN_MS);
      const e = easeInOutCubic(u);
      cam.tx = camFrom.tx + (camTo.tx - camFrom.tx) * e;
      cam.ty = camFrom.ty + (camTo.ty - camFrom.ty) * e;
      cam.scale = camFrom.scale + (camTo.scale - camFrom.scale) * e;
      cam.ox = camFrom.ox + (camTo.ox - camFrom.ox) * e;
      cam.oy = camFrom.oy + (camTo.oy - camFrom.oy) * e;
      cam.pitch = camTo.pitch;
      cam.dist = camTo.dist;
      cam.update();
      layerCtx.setTransform(1, 0, 0, 1, 0, 0);
      layerCtx.clearRect(0, 0, layer.width, layer.height);
      layerCtx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      renderTerrain(layerCtx, cam, bench, pal, terrainGeo, {
        width: W,
        height: H,
        weight: regionWeights,
        simple: true,
      });
      projectPillars(cam, bench, pillarGeo, false, v.hBoost);
      if (u >= 1) {
        tween = -1;
        computeMapBox();
        bake();
        buildHit();
      }
    }
    ctx.drawImage(layer, 0, 0, layer.width, layer.height, 0, 0, W, H);

    // ---- easing of scene state
    const hasInstances = st.count > 0;
    const ambTarget = hasInstances ? v.scene.ambientWithInstances : v.scene.ambientIdle;
    const k = reduced ? 1 : 1 - Math.exp(-dtMs / 160);
    ambient += (ambTarget - ambient) * k;
    const flashAge = (v.t - fx.flashAt) / 700;
    specFlash = flashAge >= 0 && flashAge < 1 ? 1 - flashAge : 0;

    // ---- which nodes are featured
    for (let j = 0; j < instCount; j++) slotOf[instNodes[j] as number] = -1;
    instCount = 0;
    for (let q = 0; q < st.instances.length; q++) {
      const s = st.instances[q]!;
      if (s.node >= 0 && s.status !== 'unplaced' && instCount < MAX_SLOTS) {
        slotOf[s.node] = s.slot;
        instNodes[instCount++] = s.node;
      }
    }
    const nodes = bench.nodes;
    const nN = nodes.length;
    const kl = reduced ? 1 : 1 - Math.exp(-dtMs / 90);
    for (let i = 0; i < nN; i++) {
      let target = slotOf[i]! >= 0 || i === hoverNode || i === focusIdx ? 1 : 0;
      // A highlighted country stands a little taller; it is not an instance, so it stays smaller and cooler.
      if (target === 0 && hiOn && hiMask[i] === 1) target = 0.55;
      let f = lift[i] as number;
      f += (target - f) * kl;
      if (Math.abs(target - f) < 0.003) f = target;
      lift[i] = f;
    }

    const regionName = v.region;
    const census = v.scene.census;
    const filter = v.tierFilter;
    const mapTop = v.mapBox.y0;
    const mapSpan = Math.max(1, v.mapBox.y1 - v.mapBox.y0);

    // ---- glow pass (additive)
    ctx.globalCompositeOperation = 'lighter';
    for (let j = 0; j < nN; j++) {
      const i = pillarGeo.order[j] as number;
      const n = nodes[i] as BenchNode;
      const f = lift[i] as number;
      if (v.tier === 1 && f < 0.02) continue;
      const depth =
        0.62 + 0.38 * Math.min(1, Math.max(0, ((pillarGeo.baseY[i] as number) - mapTop) / mapSpan));
      let a = (ambient + (1 - ambient) * f) * (f > 0.02 ? 1 : depth);
      if (census && filter !== 'all' && n.tier !== filter) a *= 0.12;
      if (regionName && n.region !== regionName) a *= 0.25;
      if (hiOn && hiMask[i] !== 1) a *= 0.14;
      const down = st.nodeUp[i] === 0;
      if (f > 0.02) {
        cam.project(n.x, n.y, n.height * v.hBoost * (1 + (FEATURED_H - 1) * f));
        drawPillarGlow(
          ctx,
          sprites,
          n.tierIndex,
          cam.sx,
          cam.sy,
          pillarGeo.baseX[i] as number,
          pillarGeo.baseY[i] as number,
          (pillarGeo.ps[i] as number) * (AMBIENT_R + (FEATURED_R - AMBIENT_R) * f),
          (down ? 0.06 : 0.9) * a,
          f > 0.75,
        );
      } else if (!down) {
        drawPillarGlow(
          ctx,
          sprites,
          n.tierIndex,
          pillarGeo.topX[i] as number,
          pillarGeo.topY[i] as number,
          pillarGeo.baseX[i] as number,
          pillarGeo.baseY[i] as number,
          (pillarGeo.ps[i] as number) * AMBIENT_R,
          (n.height > 4 ? 0.6 : 0.42) * a,
        );
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // ---- ground layer: rings, users, volume links, candidates
    drawRings(v, fx);
    if (v.scene.roles) drawRoles(v, fx, st);
    if (v.sceneId === 'deploy') drawCandidates(v, st);

    // ---- prisms, back to front
    for (let j = 0; j < nN; j++) {
      const i = pillarGeo.order[j] as number;
      const n = nodes[i] as BenchNode;
      const f = lift[i] as number;
      style.tier = n.tierIndex;
      style.crack = 0;
      style.dead = 0;
      style.stack = null;
      if (n.count > 1) {
        const sum = n.mix[0] + n.mix[1] + n.mix[2];
        const kinds = (n.mix[0] > 0 ? 1 : 0) + (n.mix[1] > 0 ? 1 : 0) + (n.mix[2] > 0 ? 1 : 0);
        if (sum > 0 && kinds > 1) {
          stackTmp[0] = n.mix[0] / sum;
          stackTmp[1] = n.mix[1] / sum;
          stackTmp[2] = n.mix[2] / sum;
          style.stack = stackTmp;
        }
      }
      const depth =
        0.62 + 0.38 * Math.min(1, Math.max(0, ((pillarGeo.baseY[i] as number) - mapTop) / mapSpan));
      alphaBox.a = (ambient + (1 - ambient) * f) * (f > 0.02 ? 1 : depth);
      if (census && filter !== 'all' && n.tier !== filter) alphaBox.a *= 0.15;
      if (regionName && n.region !== regionName) alphaBox.a *= 0.28;
      if (hiOn && hiMask[i] !== 1) alphaBox.a *= 0.16;
      style.featured = f > 0.55;
      // Quiet shimmer on a few caps in the census scenes.
      const shimmer = census && !reduced && i % 7 === 0 ? 0.25 * Math.sin(v.t / 1300 + i * 1.7) : 0;
      style.lit = (census ? 0.34 : 0.1) + shimmer + 0.6 * f;
      style.glow = 0.4;
      applyDeath(i, alphaBox);
      style.alpha = alphaBox.a;

      if (f > 0.004) {
        const slot = slotOf[i] as number;
        const s = slot >= 0 ? st.instances[slot] : undefined;
        let hMul = 1 + (FEATURED_H - 1) * f;
        const building = s !== undefined && s.status === 'starting' && !reduced;
        if (s && building) hMul *= 0.35 + 0.65 * easeOutCubic(s.startProgress);
        const r = AMBIENT_R + (FEATURED_R - AMBIENT_R) * f;
        projectPrism(cam, n.x, n.y, r, n.height * v.hBoost * hMul, featPoly, 0);
        if (s && building) style.alpha *= 0.55 + 0.45 * s.startProgress;
        drawPrism(ctx, pal, featPoly, 0, style);
        cam.project(n.x, n.y, n.height * v.hBoost * hMul);
        capRing(cam.sx, cam.sy, (pillarGeo.ps[i] as number) * r, i, i === focusIdx);
      } else {
        drawPrism(ctx, pal, pillarGeo.poly, i * 24, style);
      }
    }

    // ---- the sky: users, arcs, the gate, requests, the specimen
    if (v.scene.users) drawUsers(v, st);
    if (v.scene.specimen && v.scene.arcs) drawInstanceArcs(v, fx, st);
    if (v.scene.proxy) drawGate(v, st);
    drawPackets(v, st);
    if (reduced && fx.servedNode >= 0 && st.packets.length === 0 && v.scene.proxy) {
      // Under reduced motion no request flies; the last answer is shown as a still ring.
      nodeTop(v, fx.servedNode, A);
      hexLoop(ctx, A.x, A.y, 10, 6.2);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = pal.rOk.a(0.9);
      ctx.stroke();
    }

    if (v.scene.specimen) {
      const sp = v.specimen;
      const d = st.deploy;
      let layers = 5;
      let energy = 0.35 + Math.min(0.5, st.count * 0.08);
      if (v.sceneId === 'deploy' && d.active) {
        layers = d.index === 0 ? 5 * d.phaseProgress : 5;
        energy = 0.35 + 0.55 * Math.min(1, (d.index + d.phaseProgress) / 5);
      }
      layersBuilt += (layers - layersBuilt) * (reduced ? 1 : 1 - Math.exp(-dtMs / 110));
      let launching = false;
      for (let q = 0; q < st.instances.length && !launching; q++) {
        const slot = st.instances[q]!.slot;
        if (slot >= MAX_SLOTS) continue;
        const since = v.t - (fx.arcLaunch[slot] as number);
        if (since > -STAGGER_PAD && since < FLIGHT_MS * 0.8) launching = true;
      }
      const liftTarget = launching && !reduced ? sp.size * 0.12 : 0;
      sp.lift += (liftTarget - sp.lift) * (reduced ? 1 : 1 - Math.exp(-dtMs / 120));
      cellState.lift = sp.lift;
      cellState.energy = energy;
      cellState.layers = layersBuilt;
      const g = GAUGES[st.place.appSize];
      cellState.gauges = g;
      cellState.time = v.t / 1000;
      cellState.animate = !reduced;
      cellState.hover = hover?.kind === 'specimen' ? 1 : 0;
      cellState.flash = specFlash;
      drawCell(ctx, pal, sprites, sp.x, sp.y, sp.size, cellState);
    }

    // Bloom over everything luminous (the terrain is dim, so the glow comes from pillars, arcs and the cell).
    if (v.tier >= 2) bloomLayer(canvas, ctx, postScratch, 0.3, v.tier >= 3 ? BLOOM_FULL : BLOOM_LITE);

    annot.draw(v, fx, annotationNames, st);

    // ---- the probe: local to the figure, never replaces the cursor
    if (pointer) {
      if (hover && v.t - hoverLinesAt > 250) {
        hoverLines = describe(hover);
        hoverLinesAt = v.t;
      }
      drawProbe(ctx, pal, pointer.x, pointer.y, hoverLines, W, H);
    }
  }

  // ---- events from the simulation --------------------------------------------------------------------------
  let offSim = sim.on('*', (e: SimEvent) => {
    fx.onEvent(e);
    invalidate();
  });

  // ---- pointer ------------------------------------------------------------------------------------------------
  function local(e: PointerEvent): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const onMove = (e: PointerEvent): void => {
    const p = local(e);
    pointer = e.pointerType === 'touch' ? null : p;
    setHover(pickAt(p.x, p.y));
    invalidate();
  };
  const onLeave = (): void => {
    pointer = null;
    setHover(null);
    invalidate();
  };
  const onDown = (e: PointerEvent): void => {
    const p = local(e);
    const info = pickAt(p.x, p.y);
    if (e.pointerType === 'touch') {
      pointer = p;
      setHover(info);
      invalidate();
    }
    if (info) opts.onActivate?.(info);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onDown);

  // ---- loop -----------------------------------------------------------------------------------------------------
  let lastTs = 0;
  let fpsAcc = 0;
  let fpsFrames = 0;
  let needsFrame = true;

  // Pacing. `FULL_MS` is the frame interval of a busy figure, `QUIET_MS` of a resting one. A refresh is
  // skipped when less than the target interval (minus most of one refresh, so 60, 90 and 120 Hz displays
  // land on whole divisors) has passed since the last drawn frame. Simulation time and easing use the real
  // elapsed time, so skipped refreshes cost nothing but a slower cadence.
  const FULL_MS = 1000 / 60;
  const QUIET_MS = 1000 / 30;
  /** Every `invalidate()` keeps the figure at full rate this long (arcs, a block ring, draw-ins). */
  const WAKE_MS = 2800;
  let wakeUntil = 0;
  let lastRafTs = 0;
  let rafMs = FULL_MS;
  let quiet = false;
  let wasQuiet = false;

  /**
   * Whether the simulation state itself is animating something: a request in flight (or its short echo),
   * an instance installing, a replica syncing, the deploy pipeline. A pending timer alone is not motion:
   * when it fires it emits an event, and every event wakes the figure.
   */
  function simMoving(): boolean {
    const st = sim.state();
    if (st.packets.length > 0 || st.deploy.active) return true;
    const list = st.instances;
    for (let i = 0; i < list.length; i++) {
      const s = list[i] as (typeof list)[number];
      if (s.status === 'starting') return true;
      if (s.status === 'running' && s.sync < 1 && s.node >= 0 && st.nodeUp[s.node] === 1) return true;
    }
    return false;
  }

  /**
   * At rest: nothing was invalidated recently (a pointer move, a hover change, a key, an event, a prop),
   * no camera move, and nothing in the simulation is moving. A pointer parked on the figure is at rest.
   * What still moves (a slow shimmer on a few caps, the pulse along an arc) does not need more than 30
   * frames per second.
   */
  function isQuiet(): boolean {
    return v.t >= wakeUntil && tween < 0 && !simMoving();
  }

  // Reduced motion: no frame loop. The simulation still runs in real time on a coarse timer while
  // anything is in motion, and every state change it makes redraws once (events call `invalidate`).
  const CALM_MS = 100;
  let calm = 0;
  function stopCalm(): void {
    if (calm) window.clearInterval(calm);
    calm = 0;
  }
  function startCalm(): void {
    if (calm || disposed) return;
    calm = window.setInterval(() => {
      if (disposed || !reduced || paused || !onScreen || !docVisible) {
        stopCalm();
        return;
      }
      sim.tick(CALM_MS);
      if (!sim.busy()) stopCalm();
    }, CALM_MS);
  }

  function frame(ts: number): void {
    raf = 0;
    if (disposed) return;
    const live = continuous();
    let dt = 0;
    if (live) {
      if (lastRafTs !== 0) {
        const d = ts - lastRafTs;
        if (d > 2 && d < 50) rafMs += (d - rafMs) * 0.1;
      }
      lastRafTs = ts;
      quiet = isQuiet();
      if (lastTs !== 0 && ts - lastTs < (quiet ? QUIET_MS : FULL_MS) - rafMs * 0.75) {
        schedule();
        return;
      }
      dt = lastTs === 0 ? 16.7 : Math.min(100, Math.max(0, ts - lastTs));
      lastTs = ts;
      v.t += dt;
    } else {
      lastTs = 0;
      lastRafTs = 0;
      quiet = false;
      wasQuiet = false;
    }
    const c0 = performance.now();
    if (live) {
      stopCalm();
      sim.tick(dt);
    } else if (reduced && !paused && onScreen && docVisible && sim.busy()) {
      startCalm();
    }
    draw(dt);
    needsFrame = false;
    if (live) {
      const cost = performance.now() - c0;
      fpsAcc += dt;
      fpsFrames++;
      if (fpsAcc >= 500) {
        lastStats = {
          fps: Math.round((fpsFrames * 1000) / fpsAcc),
          frameMs: Math.round(cost * 10) / 10,
          quiet,
          tier: v.tier,
          dpr: v.dpr,
          cells: bench.cells.count,
          nodes: bench.nodes.length,
          width: v.W,
          height: v.H,
        };
        fpsAcc = 0;
        fpsFrames = 0;
      }
      // Only full rate frames are evidence: a quiet frame's long interval would read as a slow device.
      const changed = quiet || wasQuiet ? null : governor.frame(dt / 1000);
      wasQuiet = quiet;
      if (changed !== null && changed !== v.tier) {
        v.tier = changed;
        v.dpr = 0; // force a resize with the new pixel ratio
        resize();
        invalidate();
        return;
      }
      schedule();
      return;
    }
    if (tween >= 0 || needsFrame) schedule();
  }

  function schedule(): void {
    if (raf || disposed) return;
    raf = requestAnimationFrame(frame);
  }

  function invalidate(): void {
    needsFrame = true;
    wakeUntil = v.t + WAKE_MS;
    schedule();
  }

  // ---- observers --------------------------------------------------------------------------------------------------
  const ro = new ResizeObserver(() => {
    resize();
    invalidate();
  });
  ro.observe(host);
  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[entries.length - 1];
      if (!e) return;
      onScreen = e.isIntersecting;
      if (onScreen) {
        lastTs = 0;
        invalidate();
      }
    },
    { rootMargin: '80px' },
  );
  io.observe(host);
  const onVis = (): void => {
    docVisible = !document.hidden;
    if (docVisible) {
      lastTs = 0;
      invalidate();
    }
  };
  document.addEventListener('visibilitychange', onVis);

  resize();
  invalidate();

  return {
    setSim(next) {
      offSim();
      sim = next;
      v.sim = next;
      bench = next.bench;
      allocForBench();
      v.W = 0;
      resize();
      offSim = sim.on('*', (e: SimEvent) => {
        fx.onEvent(e);
        invalidate();
      });
      invalidate();
    },
    setScene(next) {
      if (next === v.sceneId) return;
      v.sceneId = next;
      v.scene = SCENES[next];
      annotateRequested = undefined;
      annotationNames = resolveAnnotations(next, undefined, volumeChosen);
      annot.reset();
      fullLayout(true);
    },
    setAnnotations(names) {
      annotateRequested = names;
      annotationNames = resolveAnnotations(v.sceneId, names, volumeChosen);
      invalidate();
    },
    setVolume(next) {
      if (next === volumeChosen) return;
      volumeChosen = next;
      annotationNames = resolveAnnotations(v.sceneId, annotateRequested, volumeChosen);
      invalidate();
    },
    setRegion(next) {
      if (next === v.region) return;
      v.region = next;
      annot.reset();
      fullLayout(false);
    },
    setTierFilter(next) {
      v.tierFilter = next;
      invalidate();
    },
    setHighlight(codes) {
      hiCodes = codes;
      applyHighlight();
      invalidate();
    },
    setReducedMotion(r) {
      reduced = r;
      v.reduced = r;
      invalidate();
    },
    setPaused(p) {
      paused = p;
      if (!p) lastTs = 0;
      invalidate();
    },
    setDomain(d) {
      v.domain = d;
      invalidate();
    },
    setPorts(p) {
      v.ports = p;
      invalidate();
    },
    restyle() {
      v.pal = readPalette(host);
      v.sprites = makeSprites(v.pal);
      bake();
      invalidate();
    },
    invalidate,
    focusNode(index) {
      focusIdx = index ?? -1;
      invalidate();
    },
    beat() {
      const e = bench.extent;
      fx.ring(
        (e.minX + e.maxX) / 2,
        (e.minY + e.maxY) / 2,
        0.2,
        RK_ACCENT,
        2,
        (e.maxX - e.minX) * 0.62,
        2600,
        false,
        0.55,
      );
      invalidate();
    },
    nodeScreen(index) {
      if (index < 0 || index >= pillarGeo.n) return null;
      return { x: pillarGeo.topX[index] as number, y: pillarGeo.topY[index] as number };
    },
    stats: () => lastStats,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      offSim();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      stopCalm();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
    },
  };
}
