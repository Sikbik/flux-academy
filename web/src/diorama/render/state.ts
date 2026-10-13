/**
 * State shared by the engine and its drawing helpers: the per frame `View` (what the helpers draw into
 * and with) and `Fx`, the little pile of timelines that the simulation's events set going (deaths,
 * ignitions, rings, a promotion in flight). Everything here is preallocated; a frame only writes into it.
 */
import type { ActiveTier } from '@/lib/quality';
import type { Bench, Region, Tier } from '../model/types';
import type { Sim, SimEvent } from '../sim/types';
import type { Camera } from './camera';
import type { Palette } from './palette';
import type { PillarGeo } from './pillars';
import type { SceneId, SceneSpec } from './scenes';
import type { Sprites } from './sprites';

export interface HoverInfo {
  kind: 'node' | 'cell' | 'user' | 'specimen';
  /** Node index, cell index or user index (0 for the specimen). */
  index: number;
  /** Screen anchor of the thing in canvas CSS pixels. */
  x: number;
  y: number;
}

export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface View {
  ctx: CanvasRenderingContext2D;
  cam: Camera;
  pal: Palette;
  sprites: Sprites;
  bench: Bench;
  sim: Sim;
  geo: PillarGeo;
  W: number;
  H: number;
  dpr: number;
  tier: ActiveTier;
  reduced: boolean;
  sceneId: SceneId;
  scene: SceneSpec;
  region: Region | null;
  tierFilter: Tier | 'all';
  domain: string;
  ports: { external?: number; container?: number } | undefined;
  /** Animation clock, ms. Advances only on frames that animate. */
  t: number;
  /** The specimen's resting place and size in CSS px, and its current lift. */
  specimen: { x: number; y: number; size: number; lift: number };
  /** Screen bounds of the map's land cells. */
  mapBox: ScreenBox;
  /** Per node: 0 ambient .. 1 featured (instance, hover, focus), eased. */
  lift: Float32Array;
  /** The figure is narrow (a phone column): fewer labels, taller pillars. */
  narrow: boolean;
  /** Pillar height multiplier (1 normally; more on a narrow figure so the instances read). */
  hBoost: number;
}

export const MAX_RINGS = 40;
/** The sim places at most 100 instances; this is the arc table size. */
export const MAX_SLOTS = 128;

/** Ring colours: the first four are fixed colours, the rest are tier colours (`RK_TIER + tierIndex`). */
export const RK_ACCENT = 0;
export const RK_HOT = 1;
export const RK_CRIT = 2;
export const RK_OK = 3;
export const RK_TIER = 4;

interface Ring {
  active: boolean;
  x: number;
  y: number;
  z: number;
  t0: number;
  dur: number;
  r0: number;
  r1: number;
  kind: number;
  hex: boolean;
  alpha: number;
}

interface Pending {
  at: number;
  x: number;
  y: number;
  z: number;
  kind: number;
  hex: boolean;
}

/** Timelines set going by simulation events. Times are on the animation clock (`View.t`). */
export class Fx {
  rings: Ring[] = Array.from({ length: MAX_RINGS }, () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    t0: 0,
    dur: 1,
    r0: 0,
    r1: 1,
    kind: 0,
    hex: false,
    alpha: 1,
  }));
  private cursor = 0;
  pending: Pending[] = [];
  deathAt: Float64Array;
  reviveAt: Float64Array;
  arcNode = new Int32Array(MAX_SLOTS).fill(-1);
  /** `Instance.placedAt` of the incarnation the arc was launched for (a new one relaunches the arc). */
  arcPlaced = new Float64Array(MAX_SLOTS).fill(-1);
  arcLaunch = new Float64Array(MAX_SLOTS).fill(-1e9);
  promoteAt = -1e9;
  promoteFrom = -1;
  promoteTo = -1;
  rerouteAt = -1e9;
  rerouteTo = -1;
  blockAt = -1e9;
  blockCount = 4;
  /** The specimen flashes when something lands. */
  flashAt = -1e9;
  /** The last node that answered a request (the still shown under reduced motion). */
  servedNode = -1;
  servedAt = -1e9;
  /** Instances that launched their arc during this frame (for staggering). */
  launches = 0;

  constructor(
    private readonly v: View,
    nodes: number,
  ) {
    this.deathAt = new Float64Array(nodes).fill(-1);
    this.reviveAt = new Float64Array(nodes).fill(-1);
  }

  resize(nodes: number): void {
    this.deathAt = new Float64Array(nodes).fill(-1);
    this.reviveAt = new Float64Array(nodes).fill(-1);
    this.clear();
  }

  clear(): void {
    for (const r of this.rings) r.active = false;
    this.pending.length = 0;
    this.deathAt.fill(-1);
    this.reviveAt.fill(-1);
    this.arcNode.fill(-1);
    this.arcPlaced.fill(-1);
    this.arcLaunch.fill(-1e9);
    this.promoteAt = -1e9;
    this.promoteTo = -1;
    this.promoteFrom = -1;
    this.rerouteAt = -1e9;
    this.rerouteTo = -1;
    this.servedNode = -1;
  }

  ring(
    x: number,
    y: number,
    z: number,
    kind: number,
    r0: number,
    r1: number,
    dur: number,
    hex = false,
    alpha = 1,
  ): void {
    if (this.v.reduced) return;
    const r = this.rings[this.cursor % MAX_RINGS] as Ring;
    this.cursor++;
    r.active = true;
    r.x = x;
    r.y = y;
    r.z = z;
    r.t0 = this.v.t;
    r.dur = dur;
    r.r0 = r0;
    r.r1 = r1;
    r.kind = kind;
    r.hex = hex;
    r.alpha = alpha;
  }

  /** A ring that fires `delay` ms from now (when an arc lands). */
  later(delay: number, x: number, y: number, z: number, kind: number, hex: boolean): void {
    if (this.v.reduced) return;
    this.pending.push({ at: this.v.t + delay, x, y, z, kind, hex });
  }

  /** Releases pending rings that are due. */
  release(): void {
    const p = this.pending;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i] as Pending;
      if (q.at <= this.v.t) {
        this.ring(q.x, q.y, q.z, q.kind, 0.7, 3.4, 760, q.hex);
        p.splice(i, 1);
      }
    }
  }

  onEvent(e: SimEvent): void {
    const v = this.v;
    const nodes = v.bench.nodes;
    switch (e.type) {
      case 'placed': {
        // With arcs the lock ring fires when the arc lands (see the arc drawing); without, at once.
        const n = nodes[e.node];
        if (n && !(v.scene.arcs && v.scene.specimen))
          this.ring(n.x, n.y, 0.4, RK_TIER + n.tierIndex, 0.8, 3.6, 760, true);
        this.flashAt = v.t;
        break;
      }
      case 'node-down': {
        this.deathAt[e.node] = v.t;
        this.reviveAt[e.node] = -1;
        const n = nodes[e.node];
        if (n && e.scope === 'node') this.ring(n.x, n.y, 0.4, RK_CRIT, 0.8, 4.6, 900, true);
        break;
      }
      case 'node-up': {
        this.reviveAt[e.node] = v.t;
        this.deathAt[e.node] = -1;
        const n = nodes[e.node];
        if (n) this.ring(n.x, n.y, 0.4, RK_HOT, 0.4, 4.2, 800, true);
        break;
      }
      case 'rerouted':
        this.rerouteAt = v.t;
        this.rerouteTo = v.sim.nodeIndex(e.toNodeId);
        break;
      case 'served': {
        const i = v.sim.nodeIndex(e.nodeId);
        const n = nodes[i];
        this.servedNode = i;
        this.servedAt = v.t;
        if (n) this.ring(n.x, n.y, n.height, RK_OK, 0.6, 2.4, 520, true, 0.9);
        break;
      }
      case 'promoted': {
        this.promoteAt = v.t;
        const prev = e.previousSlot >= 0 ? v.sim.state().instances[e.previousSlot] : undefined;
        this.promoteFrom = prev ? prev.node : -1;
        this.promoteTo = v.sim.nodeIndex(e.nodeId);
        break;
      }
      case 'region-down': {
        const info = v.bench.regions[e.region];
        const w = info.box.maxX - info.box.minX;
        this.ring(info.centre.x, info.centre.y, 0.2, RK_CRIT, 4, Math.max(40, w * 0.6), 1100);
        break;
      }
      case 'deploy-phase': {
        if (e.phase === 'block') {
          this.blockAt = v.t;
          this.blockCount++;
          const ext = v.bench.extent;
          this.ring(
            (ext.minX + ext.maxX) / 2,
            (ext.minY + ext.maxY) / 2,
            0.2,
            RK_ACCENT,
            2,
            (ext.maxX - ext.minX) * 0.62,
            2400,
            false,
            0.5,
          );
        }
        if (e.phase === 'live') this.flashAt = v.t;
        break;
      }
      case 'reset':
        this.clear();
        break;
      default:
        break;
    }
  }
}
