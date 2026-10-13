// The director: the scene's view of the diorama's simulation. It owns no rules. It ticks the headless sim
// (`@/diorama/sim`, the same one the lessons run), reads its events and its state, and turns them into the
// choreography on the bench: copies launched from the cell, pillars that ignite, fail and come back,
// request packets that follow the router. Pure (no three, no DOM): it is told the time, it writes
// timestamps into two typed arrays the engine hands it, and it reports waves and plain sentences through
// a small host interface.
//
// The motion language it implements (docs/DESIGN.md section 4):
//   Launch      the cell lifts, splits into copies that arc to distinct pillars along bezier paths with a
//               light trail; each landing fires a ring and a short lock. 900 to 1400 ms, staggered 90 ms.
//   Break/heal  a failing node flickers three times, goes grey and cracks; its beam cuts. Packets that
//               were heading there hang for a moment, then curve to a survivor. Reviving ignites it from
//               the centre outward.
//
// Life attributes (written for the pillar shaders, scene seconds, NEVER means "has not happened"):
//   l1 = runningAt, brokenAt, revivedAt, retiredAt      per node index
//   l2 = pingAt, hover (engine), landedAt, startProgress (0..1 while starting, -1 otherwise)

import type { Bench, Region } from '@/diorama/model';
import type { Packet, PlaceOptions, Sim, SimEvent } from '@/diorama/sim';
import type { SceneEventKind } from '../bus';
import { type PillarSpecs, type WorldFrame, worldX, worldZ } from '../world/frame';
import {
  type ArcPath,
  arcAt,
  LAUNCH_ARC,
  launchDuration,
  makeArc,
  PACKET_ARC,
  type RibbonStyle,
} from './arcs';
import { clamp, easeInCubic, easeInOutCubic, easeOutBack, lerp, saturate } from './math';
import { type NarrateContext, narrate } from './narrate';
import { TIER_COLOURS } from './palette';
import { TINT, type WaveKind } from './waves';

export const NEVER = -1000;
/** Copies the cell can have in flight or landed at once (the bus caps instances at 12). */
export const MAX_COPIES = 12;
/** Ribbons the renderer draws at once (tethers, comets, packets). */
export const MAX_RIBBONS = 56;
/** Anticipation before the first copy of a batch leaves, and the stagger between copies, seconds. */
export const ANTICIPATION = 0.17;
export const STAGGER = 0.09;
/** Height of a visitor beacon, world units (the engine draws the column; packets start above it). */
export const BEACON_HEIGHT = 1.5;
/** A pillar that hosts the app stands this much taller than its resting height: `h * HOST_K + HOST_LIFT`. */
export const HOST_K = 1.22;
export const HOST_LIFT = 3.2;
/** The resting pillar is drawn this fraction of its height when it hosts nothing. */
export const REST_K = 0.56;

/** Top of a pillar that hosts the app, world units. */
export function hostHeight(h: number): number {
  return h * HOST_K + HOST_LIFT;
}

const HOVER_ABOVE = 2.5;
const COPY_R_HOVER = 1.3;
const COPY_R_FLIGHT = 1.9;
const SEND_EVERY = 0.26;
const SEND_EVERY_FAILING = 0.6;
const MAX_PACKETS_DRAWN = 20;
/** The tail of a packet streak, as a fraction of its leg. */
const TRAIL = 0.22;

export interface DirectorHost {
  wave(kind: WaveKind, x: number, z: number, strength: number, tint?: number): void;
  /** A change worth telling assistive tech about: one plain sentence. */
  event(kind: SceneEventKind, text: string): void;
}

export interface DirectorWorld {
  bench: Bench;
  frame: WorldFrame;
  pillars: PillarSpecs;
  /** Where the cell floats. */
  cell: { x: number; y: number; z: number };
  /** The proxy: where every request passes, one schematic point above the bench. */
  proxy: { x: number; y: number; z: number };
}

/** The pillar shaders' life attributes. The engine owns the arrays; the director only writes to them. */
export interface LifeBuffers {
  l1: Float32Array;
  l2: Float32Array;
  /** Index of the first visitor beacon (beacons follow the pillars, in `bench.users` order). */
  beaconBase: number;
}

export interface RibbonOut {
  path: ArcPath;
  style: RibbonStyle;
}

export interface CopyOut {
  x: number;
  y: number;
  z: number;
  radius: number;
  yaw: number;
  tier: number;
  intensity: number;
  flash: number;
  alive: number;
}

export interface CellFx {
  /** 0..1 charge before a launch. */
  charge: number;
  /** Vertical kick in world units (a small hop and settle). */
  lift: number;
  /** 0..1 white flash. */
  flash: number;
  gauge: [number, number, number];
}

export interface Collected {
  ribbons: readonly RibbonOut[];
  ribbonCount: number;
  copies: readonly CopyOut[];
  copyCount: number;
}

export interface DirectorStats {
  placed: number;
  healthy: number;
  inFlight: number;
  packets: number;
  status: string;
}

export type CopyPhase = 'queued' | 'fly' | 'landed' | 'cut' | 'return';

interface Copy {
  used: boolean;
  slot: number;
  serial: number;
  /** Bench node index, which is also the pillar index. */
  node: number;
  phase: CopyPhase;
  launchAt: number;
  t0: number;
  dur: number;
  path: ArcPath;
  /** Position along the path, 0 at the cell, 1 above the pillar. */
  p: number;
  pFrom: number;
  landedAt: number;
  cutAt: number;
  bornAt: number;
  relinkAt: number;
  /** The sim has reported this incarnation running. */
  running: boolean;
}

interface PacketMemo {
  gen: number;
}

interface Pt {
  x: number;
  y: number;
  z: number;
}

const TIER_NAMES = ['cumulus', 'nimbus', 'stratus'] as const;
const FALLBACK_TIER: readonly [number, number, number] = [0.2, 0.8, 1];

function newPath(): ArcPath {
  return { sx: 0, sy: 0, sz: 0, cx: 0, cy: 0, cz: 0, ex: 0, ey: 0, ez: 0, length: 0 };
}

function newStyle(): RibbonStyle {
  return {
    head: 1,
    tail: 0,
    width: 0.1,
    tailR: 0,
    tailG: 0,
    tailB: 0,
    headR: 1,
    headG: 1,
    headB: 1,
    alpha: 1,
    tailAlpha: 0,
    tailWidth: 0.4,
  };
}

const pt = (): Pt => ({ x: 0, y: 0, z: 0 });

export class Director {
  readonly stats: DirectorStats = { placed: 0, healthy: 0, inFlight: 0, packets: 0, status: 'idle' };
  private world: DirectorWorld;
  private sim: Sim;
  private readonly host: DirectorHost;
  private life: LifeBuffers;
  private readonly copies: Copy[] = [];
  private readonly ribbonPool: RibbonOut[] = [];
  private readonly copyPool: CopyOut[] = [];
  private readonly legA: ArcPath[] = [];
  private readonly legB: ArcPath[] = [];
  private readonly spark: ArcPath = newPath();
  private readonly memo = new Map<number, PacketMemo>();
  private readonly gauge: [number, number, number] = [0.3, 0.45, 0.3];
  private readonly collected: Collected;
  private readonly _pos = pt();
  private readonly _user = pt();
  private readonly _target = pt();
  private readonly _from = pt();
  private unsub: (() => void) | null = null;
  private queue: SimEvent[] = [];
  private reduced = false;
  private traffic = true;
  private returnLegs = true;
  private lastLaunchAt = -10;
  private lastKickAt = -10;
  private lastFlashAt = -10;
  private lastRerouteSay = -10;
  private sendAcc = 0;
  private gen = 0;
  private load = 0;
  private place: PlaceOptions = {};
  private readonly narration: NarrateContext = {
    place: (node) => this.placeName(node),
    tier: (node) => this.tierName(node),
    placed: 0,
    healthy: 0,
  };

  constructor(world: DirectorWorld, sim: Sim, host: DirectorHost, life: LifeBuffers) {
    this.world = world;
    this.sim = sim;
    this.host = host;
    this.life = life;
    for (let i = 0; i < MAX_COPIES; i++) {
      this.copies.push({
        used: false,
        slot: 0,
        serial: 0,
        node: 0,
        phase: 'queued',
        launchAt: 0,
        t0: 0,
        dur: 1,
        path: newPath(),
        p: 0,
        pFrom: 0,
        landedAt: 0,
        cutAt: 0,
        bornAt: 0,
        relinkAt: NEVER,
        running: false,
      });
      this.copyPool.push({ x: 0, y: 0, z: 0, radius: 1, yaw: 0, tier: 0, intensity: 0, flash: 0, alive: 1 });
    }
    for (let i = 0; i < MAX_RIBBONS; i++) this.ribbonPool.push({ path: newPath(), style: newStyle() });
    for (let i = 0; i < MAX_PACKETS_DRAWN + 4; i++) {
      this.legA.push(newPath());
      this.legB.push(newPath());
    }
    this.collected = { ribbons: this.ribbonPool, ribbonCount: 0, copies: this.copyPool, copyCount: 0 };
    this.attach();
  }

  private attach(): void {
    this.unsub?.();
    this.unsub = this.sim.on('*', (e) => {
      this.queue.push(e);
    });
  }

  /** Swaps the simulation and world (a new bench arrived). Visual state is cleared; nothing is announced. */
  setSim(sim: Sim, world: DirectorWorld, life: LifeBuffers): void {
    this.unsub?.();
    this.sim = sim;
    this.world = world;
    this.life = life;
    this.queue = [];
    for (const c of this.copies) c.used = false;
    this.memo.clear();
    this.clearLife();
    this.attach();
    this.refresh();
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
  }

  setTraffic(on: boolean): void {
    this.traffic = on;
  }

  setReturnLegs(on: boolean): void {
    this.returnLegs = on;
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
  }

  get simulation(): Sim {
    return this.sim;
  }

  private clearLife(): void {
    this.life.l1.fill(NEVER);
    const l2 = this.life.l2;
    for (let i = 0; i < l2.length; i += 4) {
      l2[i] = NEVER;
      l2[i + 1] = 0;
      l2[i + 2] = NEVER;
      l2[i + 3] = -1;
    }
  }

  // ---- commands ---------------------------------------------------------------------------------------

  /** Reconciles the number of instances. New copies launch; the newest are withdrawn. */
  setInstances(n: number, region: Region | null, t: number): void {
    this.place = { ...this.place, regions: region ? [region] : [] };
    this.sim.setInstances(n, this.place);
    this.afterCommand(t);
  }

  /** Changes the preferred continent. Instances that no longer satisfy it are re-placed by the sim. */
  setRegion(region: Region | null, t: number): void {
    this.place = { ...this.place, regions: region ? [region] : [] };
    this.sim.configure({ regions: region ? [region] : [] });
    this.afterCommand(t);
  }

  /** Breaks the node of a random running instance. Returns false when there is none. */
  breakOne(t: number): boolean {
    const id = this.sim.killRandomInstanceNode();
    this.afterCommand(t);
    return id !== null;
  }

  reviveAll(t: number): void {
    this.sim.reviveAll();
    this.afterCommand(t);
  }

  /** Removes everything. Instances fly home first unless motion is reduced. */
  reset(t: number, seed?: number): void {
    for (const c of this.copies) {
      if (c.used && c.phase !== 'return') this.beginReturn(c, t, false);
    }
    this.queue = [];
    this.sim.reset(seed);
    this.queue = this.queue.filter((e) => e.type === 'reset');
    this.memo.clear();
    this.drain(t);
    this.refresh();
    if (this.reduced) this.settleStill(t);
  }

  /** One request, from a random visitor spot. */
  sendOne(): void {
    this.sim.send();
  }

  private afterCommand(t: number): void {
    this.drain(t);
    this.refresh();
    if (this.reduced) this.settleStill(t);
  }

  /** Brings the picture exactly to the sim's current state, with no animation. */
  settleStill(t: number): void {
    // Long enough for a start to complete and the router to notice a failure, shorter than a respawn.
    this.sim.tick(6500);
    this.drain(t);
    this.syncFromState(t);
    this.refresh();
  }

  /** Rebuilds copies and life from the sim's instances: every copy landed, every failure shown. */
  syncFromState(t: number): void {
    this.queue = [];
    for (const c of this.copies) c.used = false;
    this.clearLife();
    const { instances, nodeUp } = this.sim.state();
    for (const inst of instances) {
      if (inst.node < 0) continue;
      const c = this.copies.find((x) => !x.used);
      if (!c) break;
      this.fillCopy(c, inst.slot, inst.node, inst.serial);
      const o = inst.node * 4;
      const up = nodeUp[inst.node] === 1;
      c.phase = up ? 'landed' : 'cut';
      c.bornAt = t - 10;
      c.landedAt = t - 10;
      c.launchAt = t - 10;
      c.t0 = t - 10;
      c.cutAt = t - 9;
      c.p = 1;
      c.running = inst.status === 'running';
      this.life.l2[o + 2] = t - 10;
      this.life.l1[o] = c.running || !up ? t - 10 : NEVER;
      if (!up) this.life.l1[o + 1] = t - 9;
      else if (!c.running) this.life.l2[o + 3] = inst.startProgress;
    }
  }

  // ---- events -------------------------------------------------------------------------------------------

  private drain(t: number): void {
    const q = this.queue;
    this.queue = [];
    for (const e of q) this.onEvent(e, t);
  }

  private fillCopy(c: Copy, slot: number, node: number, serial: number): void {
    const w = this.world;
    c.used = true;
    c.slot = slot;
    c.serial = serial;
    c.node = node;
    c.running = false;
    c.relinkAt = NEVER;
    c.cutAt = NEVER;
    const px = w.pillars.x[node] ?? 0;
    const pz = w.pillars.z[node] ?? 0;
    const top = hostHeight(w.pillars.height[node] ?? 1) + HOVER_ABOVE;
    makeArc(w.cell.x, w.cell.y, w.cell.z, px, top, pz, LAUNCH_ARC, c.path);
    c.dur = launchDuration(Math.hypot(px - w.cell.x, pz - w.cell.z));
  }

  private placeName(node: number): string {
    const n = this.world.bench.nodes[node];
    if (!n) return 'the network';
    if (n.city) return n.label;
    return n.country || 'the network';
  }

  private tierName(node: number): string {
    return TIER_NAMES[this.world.bench.nodes[node]?.tierIndex ?? 0] ?? 'cumulus';
  }

  private copyBySlot(slot: number): Copy | null {
    let fallback: Copy | null = null;
    for (const c of this.copies) {
      if (!c.used || c.slot !== slot) continue;
      if (c.phase !== 'return') return c;
      fallback = c;
    }
    return fallback;
  }

  private copyByNode(node: number): Copy | null {
    for (const c of this.copies) if (c.used && c.node === node && c.phase !== 'return') return c;
    return null;
  }

  private onEvent(e: SimEvent, t: number): void {
    const L1 = this.life.l1;
    const L2 = this.life.l2;
    const w = this.world;
    switch (e.type) {
      case 'placed': {
        const prior = this.copyBySlot(e.slot);
        if (prior && prior.phase !== 'return') this.beginReturn(prior, t, true);
        const c = this.copies.find((x) => !x.used);
        if (!c) return;
        this.fillCopy(c, e.slot, e.node, this.sim.state().instances[e.slot]?.serial ?? 0);
        c.bornAt = t;
        const o = e.node * 4;
        // The pillar is a clean slate until the copy lands.
        L1[o] = NEVER;
        L1[o + 1] = NEVER;
        L1[o + 2] = NEVER;
        L1[o + 3] = NEVER;
        L2[o + 2] = NEVER;
        L2[o + 3] = -1;
        if (this.reduced) {
          c.phase = 'landed';
          c.landedAt = t - 10;
          c.p = 1;
        } else {
          const start = Math.max(this.lastLaunchAt + STAGGER, t + ANTICIPATION);
          c.launchAt = start;
          this.lastLaunchAt = start;
          c.phase = 'queued';
          c.p = 0;
          c.t0 = start;
        }
        this.say(e);
        break;
      }
      case 'running': {
        const c = this.copyBySlot(e.slot);
        if (!c) break;
        c.running = true;
        if (c.phase === 'landed') this.ignite(c, t);
        break;
      }
      case 'removed': {
        const c = this.copyBySlot(e.slot);
        if (c && c.phase !== 'return') {
          this.beginReturn(c, t, true);
          this.say(e);
        }
        break;
      }
      case 'node-down': {
        const o = e.node * 4;
        const c = this.copyByNode(e.node);
        L1[o + 1] = t;
        if (c) {
          c.cutAt = t;
          if (c.phase === 'landed') c.phase = 'cut';
        }
        this.host.wave('break', w.pillars.x[e.node] ?? 0, w.pillars.z[e.node] ?? 0, 1);
        this.lastFlashAt = t;
        this.say(e);
        break;
      }
      case 'node-up': {
        const o = e.node * 4;
        const c = this.copyByNode(e.node);
        L1[o + 2] = t;
        if ((L1[o] ?? NEVER) <= NEVER + 1 && (L2[o + 2] ?? NEVER) > NEVER + 1) L1[o] = t;
        this.host.wave('revive', w.pillars.x[e.node] ?? 0, w.pillars.z[e.node] ?? 0, 1);
        if (c) {
          c.relinkAt = t;
          if (c.phase === 'cut') c.phase = 'landed';
        }
        this.say(e);
        break;
      }
      case 'ejected':
        this.say(e);
        break;
      case 'rerouted':
        if (t - this.lastRerouteSay > 2.5) {
          this.lastRerouteSay = t;
          this.say(e);
        }
        break;
      case 'served': {
        // A visitor's request was answered: the node it was served by takes a small ping.
        const n = this.sim.nodeIndex(e.nodeId);
        if (n >= 0) L2[n * 4] = t;
        break;
      }
      case 'reset':
        this.say(e);
        break;
      default:
        break;
    }
  }

  private say(e: SimEvent): void {
    const app = this.sim.state().app;
    this.narration.placed = app.total;
    this.narration.healthy = app.healthy;
    const n = narrate(e, this.narration);
    if (n) this.host.event(n.kind, n.text);
  }

  /** The sim says the copy that landed here runs: the pillar lights with a short lock. */
  private ignite(c: Copy, t: number): void {
    const o = c.node * 4;
    this.life.l1[o] = t;
    this.life.l2[o] = t;
    this.life.l2[o + 3] = -1;
  }

  private beginReturn(c: Copy, t: number, flash: boolean): void {
    const o = c.node * 4;
    if (this.reduced) {
      for (let i = 0; i < 4; i++) this.life.l1[o + i] = NEVER;
      this.life.l2[o + 2] = NEVER;
      this.life.l2[o + 3] = -1;
      c.used = false;
      return;
    }
    const wasP = c.phase === 'queued' ? 0 : c.phase === 'fly' || c.phase === 'return' ? c.p : 1;
    if (c.phase === 'landed' || c.phase === 'cut') {
      this.life.l1[o + 3] = t;
      this.life.l2[o + 3] = -1;
    } else {
      this.life.l2[o + 2] = NEVER;
    }
    c.phase = 'return';
    c.t0 = t;
    c.pFrom = wasP;
    c.p = wasP;
    c.dur = 0.22 + 0.42 * wasP;
    if (flash) this.lastFlashAt = t;
  }

  private refresh(): void {
    const app = this.sim.state().app;
    this.stats.placed = app.total;
    this.stats.healthy = app.healthy;
    this.stats.status = app.status;
    this.load = app.total === 0 ? 0 : clamp(1 / Math.max(1, app.healthy), 0.15, 1);
  }

  // ---- per frame ----------------------------------------------------------------------------------------

  update(t: number, dt: number): void {
    if (!this.reduced) {
      this.sim.tick(Math.min(dt, 0.1) * 1000);
      if (this.traffic) {
        const app = this.sim.state().app;
        if (app.total > 0) {
          this.sendAcc += dt;
          const every = app.status === 'down' ? SEND_EVERY_FAILING : SEND_EVERY;
          while (this.sendAcc >= every) {
            this.sendAcc -= every;
            this.sim.send();
          }
        } else this.sendAcc = 0;
      }
    }
    this.drain(t);
    this.watchPackets(t);

    const inst = this.sim.state().instances;
    const w = this.world;
    let inFlight = 0;
    for (const c of this.copies) {
      if (!c.used) continue;
      const o = c.node * 4;
      switch (c.phase) {
        case 'queued':
          if (t >= c.launchAt) {
            c.phase = 'fly';
            c.t0 = c.launchAt;
            this.lastKickAt = c.launchAt;
          }
          inFlight++;
          break;
        case 'fly': {
          const a = (t - c.t0) / c.dur;
          c.p = easeInOutCubic(a);
          if (a >= 1) {
            c.p = 1;
            c.landedAt = c.t0 + c.dur;
            this.life.l2[o + 2] = c.landedAt;
            const x = w.pillars.x[c.node] ?? 0;
            const z = w.pillars.z[c.node] ?? 0;
            this.host.wave('land', x, z, 0.9, TINT.cumulus + (w.pillars.tier[c.node] ?? 0));
            if (this.sim.state().nodeUp[c.node] !== 1) {
              c.phase = 'cut';
              c.cutAt = c.landedAt;
              this.life.l1[o] = c.landedAt;
              this.life.l1[o + 1] = c.landedAt + 0.05;
            } else {
              c.phase = 'landed';
              if (c.running) this.ignite(c, c.landedAt);
            }
          } else inFlight++;
          break;
        }
        case 'return': {
          const a = clamp((t - c.t0) / c.dur, 0, 1);
          c.p = c.pFrom * (1 - easeInCubic(a));
          if (a >= 1) {
            c.used = false;
            this.lastFlashAt = t;
          }
          break;
        }
        default:
          break;
      }
      // The start ring on a landed copy follows the sim's own progress.
      if (c.phase === 'landed' && !c.running) {
        const i = inst[c.slot];
        this.life.l2[o + 3] = i && i.serial === c.serial ? i.startProgress : 0;
      }
    }
    this.stats.inFlight = inFlight;
    this.refresh();
  }

  /** Cell effects for this frame. */
  cellFx(t: number, out: CellFx): CellFx {
    let charge = 0;
    for (const c of this.copies) {
      if (c.used && c.phase === 'queued')
        charge = Math.max(charge, saturate(1 - (c.launchAt - t) / ANTICIPATION));
    }
    const since = t - this.lastKickAt;
    const hop =
      since >= 0 && since < 1.2
        ? easeOutBack(clamp(since / 0.55, 0, 1), 2.2) * Math.exp(-since * 2.4) * 0.9
        : 0;
    out.lift = hop - charge * 0.45;
    const fl = t - this.lastFlashAt;
    out.flash = Math.max(
      since >= 0 && since < 0.4 ? (1 - since / 0.4) * 0.7 : 0,
      fl >= 0 && fl < 0.35 ? (1 - fl / 0.35) * 0.35 : 0,
    );
    out.charge = charge;
    const g = this.gauge;
    g[0] = lerp(g[0], 0.2 + 0.72 * this.load * (this.stats.placed > 0 ? 1 : 0.3), 0.05);
    g[1] = lerp(g[1], 0.34 + 0.4 * this.load, 0.04);
    g[2] = lerp(g[2], 0.26 + 0.1 * Math.min(1, this.stats.placed / 6), 0.03);
    out.gauge = g;
    return out;
  }

  /** The ribbons and copies to draw at time `t`. Valid until the next call. */
  collect(t: number): Collected {
    let r = 0;
    let c = 0;
    const w = this.world;
    const pos = this._pos;
    for (const copy of this.copies) {
      if (!copy.used || copy.phase === 'queued') continue;
      const tierIdx = w.pillars.tier[copy.node] ?? 0;
      const T = TIER_COLOURS[tierIdx] ?? FALLBACK_TIER;
      const out = this.copyPool[c++];
      if (!out) break;
      const rb = this.ribbonPool[r] ?? null;
      out.tier = tierIdx;
      if (copy.phase === 'fly' || copy.phase === 'return') {
        arcAt(copy.path, copy.p, pos);
        out.x = pos.x;
        out.y = pos.y;
        out.z = pos.z;
        out.radius = lerp(COPY_R_FLIGHT, COPY_R_HOVER, easeInOutCubic(copy.p));
        out.intensity = 1;
        out.flash = copy.phase === 'fly' ? clamp(1 - (t - copy.t0) * 5, 0, 1) * 0.6 : 0;
        out.alive = 1;
        out.yaw = (t - copy.bornAt) * 1.6 + copy.slot;
        if (rb) {
          this.comet(rb, copy.path, copy.p, T, copy.phase === 'return' ? 0.55 : 1, copy.phase === 'return');
          r++;
        }
      } else {
        const since = t - copy.landedAt;
        const settle = since < 0.5 ? easeOutBack(clamp(since / 0.4, 0, 1), 2.4) : 1;
        const bob = Math.sin(t * 1.3 + copy.slot * 1.7) * 0.12;
        const dead = copy.phase === 'cut';
        const sink = dead ? easeInOutCubic(clamp((t - copy.cutAt) / 0.5, 0, 1)) : 0;
        arcAt(copy.path, 1, pos);
        out.x = pos.x;
        out.y = pos.y - sink * 1.4 + bob * (1 - sink) + (settle - 1) * 0.6;
        out.z = pos.z;
        out.radius = COPY_R_HOVER * (0.92 + 0.08 * settle) * (1 - sink * 0.18);
        const starting = !copy.running && !dead;
        out.intensity = dead
          ? lerp(1, 0.55, sink)
          : starting
            ? 0.7
            : 0.92 + 0.08 * Math.sin(t * 2 + copy.slot);
        const relink = t - copy.relinkAt;
        out.flash =
          relink >= 0 && relink < 0.45
            ? (1 - relink / 0.45) * 0.9
            : since >= 0 && since < 0.45
              ? (1 - since / 0.45) * 0.8
              : 0;
        out.alive = dead ? 0 : 1;
        out.yaw = (t - copy.bornAt) * (dead ? 0.1 : 0.7) + copy.slot;
        if (rb && this.tether(rb, copy, T, t)) r++;
        const pr = this.ribbonPool[r];
        if (pr && r < MAX_RIBBONS - 24 && this.pulse(pr, copy, T, t)) r++;
      }
    }
    r = this.packetRibbons(r);
    this.collected.ribbonCount = r;
    this.collected.copyCount = c;
    return this.collected;
  }

  private comet(
    rb: RibbonOut,
    path: ArcPath,
    p: number,
    T: readonly number[],
    alpha: number,
    reverse: boolean,
  ): void {
    rb.path = path;
    const s = rb.style;
    s.head = clamp(p, 0.001, 1);
    s.tail = clamp(p - (reverse ? 0.22 : 0.3), 0, 1);
    s.width = 0.14;
    s.tailR = (T[0] ?? 0) * 0.7;
    s.tailG = (T[1] ?? 0) * 0.7;
    s.tailB = (T[2] ?? 0) * 0.7;
    s.headR = lerp(T[0] ?? 0, 1, 0.6) * 2.2;
    s.headG = lerp(T[1] ?? 0, 1, 0.6) * 2.2;
    s.headB = lerp(T[2] ?? 0, 1, 0.6) * 2.2;
    s.alpha = alpha;
    s.tailAlpha = 0;
    s.tailWidth = 0.25;
  }

  /** Writes the tether of a landed copy. Returns false when there is nothing to draw. */
  private tether(rb: RibbonOut, c: Copy, T: readonly number[], t: number): boolean {
    rb.path = c.path;
    const s = rb.style;
    // A tether runs from white-blue light at the cell to the tier's own colour at the pillar.
    s.tailWidth = 0.8;
    s.tailAlpha = 0.55;
    s.head = 1;
    s.tail = 0;
    s.width = 0.13;
    s.tailR = lerp(T[0] ?? 0, 0.8, 0.55) * 0.75;
    s.tailG = lerp(T[1] ?? 0, 0.9, 0.55) * 0.75;
    s.tailB = lerp(T[2] ?? 0, 1.0, 0.55) * 0.75;
    s.headR = (T[0] ?? 0) * 1.5;
    s.headG = (T[1] ?? 0) * 1.5;
    s.headB = (T[2] ?? 0) * 1.5;
    s.alpha = 0.78;
    const since = t - c.landedAt;
    if (c.phase === 'cut') {
      const age = t - c.cutAt;
      if (age > 0.7) return false;
      // The beam cuts: it snaps back toward the cell and fades, with a hot instant at the break.
      const a = clamp(age / 0.6, 0, 1);
      s.head = lerp(1, 0.45, easeInOutCubic(a));
      s.tail = lerp(0, 0.35, easeInOutCubic(a));
      s.alpha = (1 - a) * 0.95;
      const hot = Math.exp(-age * 9);
      s.headR += hot * 3;
      s.headG += hot * 1.8;
      s.headB += hot * 2;
      return true;
    }
    const relink = t - c.relinkAt;
    if (relink >= 0 && relink < 0.55) {
      // Re-established: a comet runs the arc again, then it settles into the tether.
      const a = clamp(relink / 0.5, 0, 1);
      s.head = easeInOutCubic(a);
      s.tail = clamp(s.head - 0.4, 0, 1);
      s.alpha = 1;
      s.width = 0.18;
      return s.head > 0.01;
    }
    if (since >= 0 && since < 0.7) {
      // Just landed: the tether flares and settles.
      const a = clamp(since / 0.7, 0, 1);
      s.alpha = lerp(1.25, 0.78, easeInOutCubic(a));
      s.width = lerp(0.2, 0.13, easeInOutCubic(a));
    }
    return true;
  }

  /** A short bright pulse that runs from the cell to a hosting pillar every couple of seconds. */
  private pulse(rb: RibbonOut, c: Copy, T: readonly number[], t: number): boolean {
    if (c.phase !== 'landed' || !c.running) return false;
    const period = 2.6;
    const ph = ((t - c.landedAt) / period + c.slot * 0.31) % 1;
    if (ph > 0.46) return false;
    const k = ph / 0.46;
    const head = easeInOutCubic(k);
    rb.path = c.path;
    const s = rb.style;
    s.head = clamp(head, 0.001, 1);
    s.tail = clamp(head - 0.16, 0, 1);
    s.width = 0.2;
    s.tailWidth = 0.3;
    s.tailAlpha = 0;
    s.tailR = (T[0] ?? 0) * 0.9;
    s.tailG = (T[1] ?? 0) * 0.9;
    s.tailB = (T[2] ?? 0) * 0.9;
    s.headR = lerp(T[0] ?? 0, 1, 0.55) * 2.6;
    s.headG = lerp(T[1] ?? 0, 1, 0.55) * 2.6;
    s.headB = lerp(T[2] ?? 0, 1, 0.55) * 2.6;
    s.alpha = Math.sin(k * Math.PI) * 0.95;
    return s.alpha > 0.02;
  }

  private packetRibbons(from: number): number {
    const st = this.sim.state();
    const nowMs = st.time;
    let r = from;
    let used = 0;
    for (const p of st.packets) {
      if (used >= MAX_PACKETS_DRAWN || r >= this.ribbonPool.length - 3) break;
      used++;
      r = this.drawPacket(p, nowMs, r, used);
    }
    this.stats.packets = used;
    return r;
  }

  /** Notices requests that just left a visitor: the visitor's beacon pings. */
  private watchPackets(t: number): void {
    const st = this.sim.state();
    this.gen++;
    for (const p of st.packets) {
      let memo = this.memo.get(p.id);
      if (!memo) {
        memo = { gen: this.gen };
        this.memo.set(p.id, memo);
        const b = this.life.beaconBase + p.userIndex;
        if (p.userIndex >= 0 && (b + 1) * 4 <= this.life.l2.length) this.life.l2[b * 4] = t;
      }
      memo.gen = this.gen;
    }
    if (this.memo.size > st.packets.length + 12) {
      for (const [id, m] of this.memo) if (m.gen !== this.gen) this.memo.delete(id);
    }
  }

  private userPoint(p: Packet, out: Pt): void {
    const w = this.world;
    if (p.originNode >= 0) {
      out.x = w.pillars.x[p.originNode] ?? 0;
      out.y = (w.pillars.height[p.originNode] ?? 1) * REST_K + 0.6;
      out.z = w.pillars.z[p.originNode] ?? 0;
      return;
    }
    const u = w.bench.users[p.userIndex];
    if (!u) {
      out.x = w.proxy.x;
      out.y = w.proxy.y;
      out.z = w.proxy.z;
      return;
    }
    out.x = worldX(w.frame, u.x);
    out.y = BEACON_HEIGHT + 0.2;
    out.z = worldZ(w.frame, u.y);
  }

  private nodeTop(node: number, out: Pt): void {
    const w = this.world;
    out.x = w.pillars.x[node] ?? 0;
    out.y = hostHeight(w.pillars.height[node] ?? 1) + 0.9;
    out.z = w.pillars.z[node] ?? 0;
  }

  private drawPacket(p: Packet, nowMs: number, r: number, slot: number): number {
    const w = this.world;
    const pool = this.ribbonPool;
    const idx = slot % this.legA.length;
    const user = this._user;
    const target = this._target;
    this.userPoint(p, user);
    const proxy = w.proxy;
    const failedAtProxy = p.outcome === 'failed' && p.target < 0;
    const redirected = p.retargets > 0 && p.redirectFrom >= 0;
    const hot = redirected ? 1.35 : 1;
    const tc =
      (p.target >= 0 ? TIER_COLOURS[w.pillars.tier[p.target] ?? 0] : TIER_COLOURS[0]) ?? FALLBACK_TIER;

    if (!redirected) {
      // Leg one: the visitor to the proxy.
      const a = this.legA[idx];
      if (!a) return r;
      makeArc(user.x, user.y, user.z, proxy.x, proxy.y, proxy.z, PACKET_ARC, a);
      const a1 = (nowMs - p.t0) / Math.max(1, p.tProxy - p.t0);
      const rb = pool[r];
      if (rb && a1 >= 0 && a1 < 1 + TRAIL) {
        this.packetStyle(rb, a, a1, tc, hot, failedAtProxy && a1 > 0.9);
        r++;
      }
      if (failedAtProxy || p.target < 0) return r;
      this.nodeTop(p.target, target);
      const b = this.legB[idx];
      if (!b) return r;
      makeArc(proxy.x, proxy.y, proxy.z, target.x, target.y, target.z, PACKET_ARC, b);
      const a2 = (nowMs - p.tProxy) / Math.max(1, p.tArrive - p.tProxy);
      const rb2 = pool[r];
      if (rb2 && a2 >= 0 && a2 < 1 + TRAIL) {
        this.packetStyle(rb2, b, a2, tc, hot, false);
        r++;
      }
      return this.packetEnd(p, nowMs, r, idx, tc);
    }
    // Redirected: the packet hangs at the failed node, then curves from it to the survivor.
    const from = this._from;
    this.nodeTop(p.redirectFrom, from);
    this.nodeTop(p.target, target);
    const b = this.legB[idx];
    if (!b) return r;
    makeArc(from.x, from.y, from.z, target.x, target.y, target.z, PACKET_ARC, b);
    const a2 = (nowMs - p.redirectAt) / Math.max(1, p.tArrive - p.redirectAt);
    const rb = pool[r];
    if (rb && a2 >= 0 && a2 < 1 + TRAIL) {
      this.packetStyle(rb, b, a2, tc, hot, false);
      r++;
    } else if (rb && a2 < 0) {
      // Still hanging on the dead node: the flicker.
      r = this.flicker(rb, from, nowMs, r);
    }
    return this.packetEnd(p, nowMs, r, idx, tc);
  }

  /** A small hot spark that stutters over a node that does not answer. */
  private flicker(rb: RibbonOut, at: Pt, nowMs: number, r: number): number {
    const a = this.spark;
    const fl = 0.5 + 0.5 * Math.sin(nowMs * 0.045);
    makeArc(at.x, at.y + 0.1, at.z, at.x, at.y + 1.5, at.z, PACKET_ARC, a);
    rb.path = a;
    const s = rb.style;
    s.head = 1;
    s.tail = 0.1;
    s.width = 0.1;
    s.tailR = 0.5;
    s.tailG = 0.1;
    s.tailB = 0.14;
    s.headR = 2.6;
    s.headG = 0.5;
    s.headB = 0.6;
    s.alpha = 0.35 + 0.65 * fl;
    s.tailAlpha = 0;
    s.tailWidth = 0.6;
    return r + 1;
  }

  /** The stalled spark at a dead node and the reply flying home for a served request. */
  private packetEnd(p: Packet, nowMs: number, r: number, idx: number, T: readonly number[]): number {
    const target = this._target;
    const user = this._user;
    const rb = this.ribbonPool[r];
    if (!rb) return r;
    if (p.outcome === 'stalled') return this.flicker(rb, target, nowMs, r);
    if (p.outcome === 'failed' && p.target >= 0 && nowMs - p.doneAt < 420)
      return this.flicker(rb, target, nowMs, r);
    if (p.outcome === 'served' && this.returnLegs && p.tReturn > p.doneAt) {
      const a = (nowMs - p.doneAt) / Math.max(1, p.tReturn - p.doneAt);
      const back = this.legA[idx];
      if (back && a >= 0 && a < 1 + TRAIL) {
        makeArc(target.x, target.y, target.z, user.x, user.y, user.z, PACKET_ARC, back);
        this.packetStyle(rb, back, a, T, 0.4, false);
        rb.style.alpha *= 0.45;
        return r + 1;
      }
    }
    return r;
  }

  private packetStyle(
    rb: RibbonOut,
    path: ArcPath,
    a: number,
    T: readonly number[],
    hot: number,
    fail: boolean,
  ): void {
    rb.path = path;
    const s = rb.style;
    const m = Math.min(a, 1);
    const e = a < 0.5 ? 2 * a * a : 1 - 2 * (1 - m) * (1 - m);
    s.head = clamp(a > 1 ? 1 : 0.02 + e * 0.98, 0.001, 1);
    s.tail = clamp((a > 1 ? a : e) - TRAIL, 0, 1);
    s.width = 0.13;
    s.tailR = fail ? 0.6 : (T[0] ?? 0) * 1.1;
    s.tailG = fail ? 0.12 : (T[1] ?? 0) * 1.1;
    s.tailB = fail ? 0.16 : (T[2] ?? 0) * 1.1;
    s.headR = (fail ? 2.6 : lerp(T[0] ?? 0, 1, 0.6) * 3.0) * hot;
    s.headG = (fail ? 0.55 : lerp(T[1] ?? 0, 1, 0.6) * 3.0) * hot;
    s.headB = (fail ? 0.65 : lerp(T[2] ?? 0, 1, 0.6) * 3.0) * hot;
    s.alpha = 1;
    s.tailAlpha = 0;
    s.tailWidth = 0.3;
  }

  /** Number of copies in any phase (tests and the debug overlay). */
  get usedCopies(): number {
    let n = 0;
    for (const c of this.copies) if (c.used) n++;
    return n;
  }

  /** The phase of the copy for a slot, for tests and the debug overlay. */
  phaseOfSlot(slot: number): CopyPhase | null {
    return this.copyBySlot(slot)?.phase ?? null;
  }
}
