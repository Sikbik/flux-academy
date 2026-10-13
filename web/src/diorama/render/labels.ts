/**
 * The scene annotations: blueprint leaders, dimension lines, brackets and strips that *draw themselves in*
 * when a name appears in the `annotate` list, and draw again if it leaves and returns. They label
 * objects and mechanics only (a lesson's prose carries the claims). The names are documented per scene
 * in ../README.md.
 */
import { type Bench, type BenchNode, REGION_NAMES, REGIONS } from '../model/types';
import { hasEmptyDisk } from '../sim/rules';
import type { SimState } from '../sim/types';
import {
  drawBrackets,
  drawDimension,
  drawLeader,
  drawRuler,
  type LeaderSpec,
  measureLabel,
  setLabelFont,
} from './annotate';
import { capZ, drawArc, gatePos, nodeFoot, nodeTop, type Pt, userPos } from './fx';
import type { Fx, View } from './state';

const DRAW_MS = 760;

/** Offsets tried, in order, for a marker relative to what it points at. */
const OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [36, -30],
  [-36, -30],
  [52, -54],
  [-52, -54],
  [36, 30],
  [-36, 30],
  [74, -14],
  [-74, -14],
  [64, 56],
  [-64, 56],
  [96, -36],
  [-96, -36],
];

const PHASES = ['SPEC', 'REGISTER', 'BLOCK', 'SELECT', 'INSTALL', 'LIVE'] as const;

/** How an annotation that reports a loss looks: the warning colour and a hollow disk in the marker. */
const LOST_LOOK: Pick<LeaderSpec, 'glyph' | 'tone'> = { glyph: 'disk', tone: 'warn' };

/** Marker positions remembered per frame (the instance leaders are capped at eight). */
const MAX_SPOTS = 24;

/** Distances below and above a marker at which a dependent tag is tried, px. */
const STACK_DY: readonly number[] = [27, -27];

const A: Pt = { x: 0, y: 0 };
const B: Pt = { x: 0, y: 0 };

export class Annotator {
  private since = new Map<string, number>();
  private seen = new Set<string>();
  private boxes = new Float32Array(4 * 80);
  private nBoxes = 0;
  private leader: LeaderSpec = { ax: 0, ay: 0, mx: 0, my: 0, marker: '', label: '', side: 'right' };
  private upper: string[] = [];
  private upperBench: Bench | null = null;
  private rep = new Int32Array(3).fill(-1);
  private repBench: Bench | null = null;
  /** Where this frame's leaders put their markers, so a dependent tag can sit right under one. */
  private spotKeys: string[] = [];
  private spotX = new Float64Array(MAX_SPOTS);
  private spotY = new Float64Array(MAX_SPOTS);
  private spotLeft = new Uint8Array(MAX_SPOTS);
  private nSpots = 0;

  reset(): void {
    this.since.clear();
  }

  private prog(v: View, key: string): number {
    this.seen.add(key);
    let s = this.since.get(key);
    if (s === undefined) {
      s = v.reduced ? v.t - DRAW_MS * 2 : v.t;
      this.since.set(key, s);
    }
    const p = (v.t - s) / DRAW_MS;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  private reserve(x0: number, y0: number, x1: number, y1: number): void {
    if (this.nBoxes >= 80) return;
    const o = this.nBoxes * 4;
    this.boxes[o] = x0;
    this.boxes[o + 1] = y0;
    this.boxes[o + 2] = x1;
    this.boxes[o + 3] = y1;
    this.nBoxes++;
  }

  private free(x0: number, y0: number, x1: number, y1: number): boolean {
    for (let i = 0; i < this.nBoxes; i++) {
      const o = i * 4;
      if (x0 < (this.boxes[o + 2] as number) && x1 > (this.boxes[o] as number)) {
        if (y0 < (this.boxes[o + 3] as number) && y1 > (this.boxes[o + 1] as number)) return false;
      }
    }
    return true;
  }

  private cityOf(v: View, node: number): string {
    if (this.upperBench !== v.bench) {
      this.upperBench = v.bench;
      this.upper = [];
    }
    let s = this.upper[node];
    if (s === undefined) {
      const n = v.bench.nodes[node] as BenchNode;
      s = (n.city || n.country || n.cc || n.id).toUpperCase();
      this.upper[node] = s;
    }
    return s;
  }

  /** Draws a numbered leader from (ax, ay), placing its marker where there is room. */
  private leaderAt(
    v: View,
    key: string,
    ax: number,
    ay: number,
    marker: string,
    label: string,
    hot = false,
    down = false,
    look: Pick<LeaderSpec, 'glyph' | 'tone'> | null = null,
  ): void {
    const p = this.prog(v, key);
    const ctx = v.ctx;
    setLabelFont(ctx, v.pal, v.narrow ? 9 : 10.5);
    const w = measureLabel(ctx, label);
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
    let best = -1;
    let bx = 0;
    let by = 0;
    let bside: 'left' | 'right' = 'right';
    for (let k = 0; k < OFFSETS.length; k++) {
      const off = OFFSETS[(k + (down ? 4 : 0)) % OFFSETS.length] as readonly [number, number];
      const mx = ax + off[0];
      const my = ay + off[1];
      const side: 'left' | 'right' = off[0] >= 0 ? 'right' : 'left';
      const x0 = side === 'right' ? mx - 10 : mx - 18 - w - 2;
      const x1 = side === 'right' ? mx + 18 + w + 2 : mx + 10;
      const y0 = my - 12;
      const y1 = my + 14;
      if (x0 < 4 || x1 > v.W - 4 || y0 < 4 || y1 > v.H - 4) continue;
      if (!this.free(x0, y0, x1, y1)) continue;
      best = k;
      bx = mx;
      by = my;
      bside = side;
      this.reserve(x0, y0, x1, y1);
      break;
    }
    if (best < 0) {
      // No clear spot: take the first offset, kept inside the frame.
      const off = OFFSETS[0] as readonly [number, number];
      bx = Math.max(14, Math.min(v.W - 14, ax + off[0]));
      by = Math.max(14, Math.min(v.H - 14, ay + off[1]));
      bside = bx > v.W / 2 ? 'left' : 'right';
    }
    this.noteSpot(key, bx, by, bside);
    if (p <= 0) return;
    const L = this.leader;
    L.ax = ax;
    L.ay = ay;
    L.mx = bx;
    L.my = by;
    L.marker = marker;
    L.label = label;
    L.side = bside;
    L.hot = hot;
    L.glyph = look?.glyph;
    L.tone = look?.tone;
    L.px = v.narrow ? 9 : 10.5;
    drawLeader(ctx, v.pal, L, p);
  }

  private noteSpot(key: string, x: number, y: number, side: 'left' | 'right'): void {
    const i = this.nSpots;
    if (i >= MAX_SPOTS) return;
    this.spotKeys[i] = key;
    this.spotX[i] = x;
    this.spotY[i] = y;
    this.spotLeft[i] = side === 'left' ? 1 : 0;
    this.nSpots = i + 1;
  }

  private spotOf(key: string): number {
    for (let i = 0; i < this.nSpots; i++) if (this.spotKeys[i] === key) return i;
    return -1;
  }

  /**
   * Draws a tag directly under (or, with no room, over) a leader that was drawn earlier this frame, on the
   * same side and hanging from its marker, so it reads as part of that leader: "2 FRANKFURT" and, under it,
   * "EMPTY DISK". Returns false when that leader was not drawn or there is no room, and the caller places
   * the tag on its own.
   */
  private tagUnder(
    v: View,
    key: string,
    underKey: string,
    label: string,
    look: Pick<LeaderSpec, 'glyph' | 'tone'>,
  ): boolean {
    const k = this.spotOf(underKey);
    if (k < 0) return false;
    const p = this.prog(v, key);
    const ctx = v.ctx;
    const px = v.narrow ? 9 : 10.5;
    setLabelFont(ctx, v.pal, px);
    const w = measureLabel(ctx, label);
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
    const mx = this.spotX[k] as number;
    const baseY = this.spotY[k] as number;
    const left = this.spotLeft[k] === 1;
    const x0 = left ? mx - 18 - w - 2 : mx - 10;
    const x1 = left ? mx + 10 : mx + 18 + w + 2;
    for (let d = 0; d < STACK_DY.length; d++) {
      const dy = STACK_DY[d] as number;
      const my = baseY + dy;
      const y0 = my - 12;
      const y1 = my + 14;
      if (x0 < 4 || x1 > v.W - 4 || y0 < 4 || y1 > v.H - 4) continue;
      if (!this.free(x0, y0, x1, y1)) continue;
      this.reserve(x0, y0, x1, y1);
      if (p > 0) {
        const L = this.leader;
        L.ax = mx;
        L.ay = baseY + (dy > 0 ? 9 : -9);
        L.mx = mx;
        L.my = my;
        L.marker = '';
        L.label = label;
        L.side = left ? 'left' : 'right';
        L.hot = false;
        L.glyph = look.glyph;
        L.tone = look.tone;
        L.px = px;
        drawLeader(ctx, v.pal, L, p);
      }
      return true;
    }
    return false;
  }

  /** Representative nodes per tier, spread west to east so their leaders do not stack. */
  private representatives(v: View): Int32Array {
    if (this.repBench === v.bench) return this.rep;
    this.repBench = v.bench;
    const nodes = v.bench.nodes;
    const ext = v.bench.extent;
    const targets = [0.2, 0.52, 0.8];
    for (let t = 0; t < 3; t++) {
      let best = -1;
      let score = Number.NEGATIVE_INFINITY;
      const tx = ext.minX + (ext.maxX - ext.minX) * (targets[t] as number);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i] as BenchNode;
        if (n.tierIndex !== t) continue;
        const s = n.height * 4 - Math.abs(n.x - tx) * 0.5 + n.count * 0.002;
        if (s > score) {
          score = s;
          best = i;
        }
      }
      this.rep[t] = best;
    }
    return this.rep;
  }

  begin(v: View): void {
    this.nBoxes = 0;
    this.nSpots = 0;
    this.seen.clear();
    if (v.scene.specimen) {
      const s = v.specimen;
      this.reserve(
        s.x - s.size * 0.62,
        s.y - s.size * 0.68 - s.lift,
        s.x + s.size * 0.62,
        s.y + s.size * 0.62,
      );
    }
    if (v.scene.pipeline) this.reserve(0, v.H - 54, v.W, v.H);
  }

  private end(): void {
    if (this.since.size !== this.seen.size) {
      for (const key of this.since.keys()) if (!this.seen.has(key)) this.since.delete(key);
    }
  }

  draw(v: View, fx: Fx, names: readonly string[], st: SimState): void {
    this.begin(v);
    const { ctx, pal } = v;
    const inst = st.instances;
    // Region names are placed first so every leader finds a clear spot around them.
    const order = names.includes('regions') ? ['regions', ...names.filter((n) => n !== 'regions')] : names;
    for (let ni = 0; ni < order.length; ni++) {
      const name = order[ni] as string;
      switch (name) {
        case 'frame': {
          const b = v.mapBox;
          drawBrackets(ctx, pal, b.x0 - 14, b.y0 - 18, b.x1 + 14, b.y1 + 16, this.prog(v, 'frame'), 14, 0.5);
          drawRuler(ctx, pal, b.x0 - 14, b.x1 + 14, b.y1 + 22, this.prog(v, 'frame-ruler'), 0.34);
          break;
        }
        case 'regions': {
          const wide = v.W >= 620;
          for (let r = 0; r < REGIONS.length; r++) {
            const region = REGIONS[r]!;
            if (v.region && v.region !== region) continue;
            const info = v.bench.regions[region];
            if (info.cells === 0) continue;
            const p = this.prog(v, `region:${region}`);
            v.cam.project(info.centre.x, info.centre.y, 0);
            const text = wide ? REGION_NAMES[region].toUpperCase() : region;
            setLabelFont(ctx, pal, 10);
            const w = measureLabel(ctx, text);
            this.reserve(v.cam.sx - w / 2 - 6, v.cam.sy - 10, v.cam.sx + w / 2 + 6, v.cam.sy + 10);
            if (p <= 0) continue;
            ctx.save();
            ctx.beginPath();
            ctx.rect(v.cam.sx - w / 2 - 6, v.cam.sy - 12, (w + 12) * p, 24);
            ctx.clip();
            ctx.fillStyle = pal.rInk.a(0.7);
            ctx.fillRect(v.cam.sx - w / 2 - 5, v.cam.sy - 8, w + 10, 17);
            ctx.fillStyle = pal.rAccentHot.a(0.9);
            ctx.fillText(text, v.cam.sx - w / 2, v.cam.sy + 1);
            ctx.restore();
            (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
          }
          break;
        }
        case 'tiers': {
          const rep = this.representatives(v);
          const labels = ['CUMULUS', 'NIMBUS', 'STRATUS'];
          for (let t = 0; t < 3; t++) {
            const i = rep[t] as number;
            if (i < 0) continue;
            if (
              v.tierFilter !== 'all' &&
              (v.bench.nodes[i] as BenchNode).tierIndex !==
                ['cumulus', 'nimbus', 'stratus'].indexOf(v.tierFilter)
            )
              continue;
            nodeTop(v, i, A);
            this.leaderAt(v, `tier:${t}`, A.x, A.y, String(t + 1), labels[t] as string, t === 2);
          }
          break;
        }
        case 'height': {
          const rep = this.representatives(v);
          const i = rep[2] as number;
          if (i < 0) break;
          const n = v.bench.nodes[i] as BenchNode;
          v.cam.project(n.x, n.y, 0);
          const fx0 = v.cam.sx + v.cam.ps * 1.5;
          const fy0 = v.cam.sy;
          v.cam.project(n.x, n.y, capZ(v, i));
          const text = v.bench.kind === 'live' ? 'NODES, LOG SCALE' : 'TIER CLASS';
          setLabelFont(ctx, pal, 10);
          const w = measureLabel(ctx, text);
          (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
          drawDimension(
            ctx,
            pal,
            { ax: fx0, ay: fy0, bx: fx0, by: v.cam.sy, label: text, lift: w / 2 + 12 },
            this.prog(v, 'height'),
          );
          break;
        }
        case 'specimen': {
          if (!v.scene.specimen) break;
          const s = v.specimen;
          this.leaderAt(
            v,
            'specimen',
            s.x - s.size * 0.42,
            s.y - s.lift - s.size * 0.1,
            'A',
            'YOUR APP',
            false,
            false,
          );
          break;
        }
        case 'instances': {
          let shown = 0;
          for (let k = 0; k < inst.length && shown < (v.narrow ? 5 : 8); k++) {
            const s = inst[k]!;
            if (s.node < 0 || s.status === 'unplaced') continue;
            nodeTop(v, s.node, A);
            this.leaderAt(
              v,
              `inst:${s.slot}:${s.placedAt}`,
              A.x,
              A.y,
              String(s.slot + 1),
              this.cityOf(v, s.node),
              false,
              k % 2 === 1,
            );
            shown++;
          }
          break;
        }
        case 'span': {
          let x0 = Number.POSITIVE_INFINITY;
          let x1 = Number.NEGATIVE_INFINITY;
          let count = 0;
          for (let k = 0; k < inst.length; k++) {
            const s = inst[k]!;
            if (s.node < 0 || s.status === 'unplaced') continue;
            nodeFoot(v, s.node, A, 0);
            if (A.x < x0) x0 = A.x;
            if (A.x > x1) x1 = A.x;
            count++;
          }
          if (count >= 2 && x1 - x0 > 30) {
            const y = Math.min(v.H - 14, v.mapBox.y1 + 34);
            drawDimension(
              ctx,
              pal,
              { ax: x0, ay: y, bx: x1, by: y, label: `${count} INSTANCES`, lift: -12 },
              this.prog(v, `span:${count}`),
            );
          }
          break;
        }
        case 'down': {
          for (let k = 0; k < inst.length; k++) {
            const s = inst[k]!;
            if (s.node < 0 || st.nodeUp[s.node] === 1) continue;
            nodeTop(v, s.node, A);
            this.leaderAt(v, `down:${s.slot}:${s.placedAt}`, A.x, A.y, '!', 'OFFLINE', false, true);
          }
          break;
        }
        case 'lost-data': {
          // A replacement that started with an empty volume (a plain one was lost with its node). It stays
          // while that incarnation runs, so reading the prose and finding the tag are not a race.
          let shown = 0;
          for (let k = 0; k < inst.length && shown < (v.narrow ? 4 : 8); k++) {
            const s = inst[k]!;
            if (!hasEmptyDisk(s)) continue;
            const key = `lost:${s.slot}:${s.placedAt}`;
            // Hung under the instance's own label when that is drawn, else at the node on its own.
            if (!this.tagUnder(v, key, `inst:${s.slot}:${s.placedAt}`, 'EMPTY DISK', LOST_LOOK)) {
              nodeTop(v, s.node, A);
              this.leaderAt(v, key, A.x, A.y, '', 'EMPTY DISK', false, true, LOST_LOOK);
            }
            shown++;
          }
          break;
        }
        case 'reroute': {
          if (v.t - fx.rerouteAt < 3200 && fx.rerouteTo >= 0) {
            nodeTop(v, fx.rerouteTo, A);
            this.leaderAt(v, `reroute:${Math.round(fx.rerouteAt)}`, A.x, A.y, 'R', 'REROUTED', true);
          }
          break;
        }
        case 'user': {
          const last = st.packets[st.packets.length - 1];
          if (last) {
            if (last.originNode >= 0) nodeTop(v, last.originNode, A);
            else if (!userPos(v, last.userIndex, A)) break;
            const label = (v.bench.users[last.userIndex]?.label ?? last.userId).toUpperCase();
            this.leaderAt(v, `user:${last.userIndex}`, A.x, A.y, 'U', label, false, true);
          }
          break;
        }
        case 'proxy': {
          if (!v.scene.proxy) break;
          gatePos(v, A);
          this.leaderAt(v, 'proxy', A.x + 9, A.y - 4, 'P', 'PROXY');
          break;
        }
        case 'domain': {
          if (!v.scene.proxy) break;
          gatePos(v, A);
          this.leaderAt(v, 'domain', A.x - 10, A.y, 'D', v.domain, false, true);
          break;
        }
        case 'ports': {
          if (!v.scene.proxy) break;
          let first = -1;
          for (let k = 0; k < inst.length; k++) {
            const s = inst[k]!;
            if (s.node >= 0 && s.status !== 'unplaced') {
              first = s.node;
              break;
            }
          }
          if (first < 0) break;
          nodeTop(v, first, A);
          const ext = v.ports?.external !== undefined ? ` ${v.ports.external}` : '';
          const cont = v.ports?.container !== undefined ? ` ${v.ports.container}` : '';
          this.leaderAt(v, 'ports:ext', A.x, A.y, '1', `PUBLIC PORT${ext}`, false, true);
          this.leaderAt(v, 'ports:cont', A.x, A.y + 6, '2', `CONTAINER PORT${cont}`, false, false);
          break;
        }
        case 'primary': {
          if (!v.scene.roles) break;
          const slot = st.volume.primarySlot;
          const s = slot >= 0 ? inst[slot] : undefined;
          if (s && s.node >= 0 && st.nodeUp[s.node] === 1) {
            nodeTop(v, s.node, A);
            this.leaderAt(v, `primary:${slot}:${s.placedAt}`, A.x, A.y, 'P', 'PRIMARY', true);
          }
          break;
        }
        case 'standby': {
          if (!v.scene.roles) break;
          for (let k = 0; k < inst.length; k++) {
            const s = inst[k]!;
            if (s.node < 0 || s.role !== 'standby' || st.nodeUp[s.node] !== 1) continue;
            nodeTop(v, s.node, A);
            this.leaderAt(v, `standby:${s.slot}:${s.placedAt}`, A.x, A.y, 'S', 'STANDBY', false, true);
          }
          break;
        }
        case 'replication': {
          if (!v.scene.roles) break;
          const pSlot = st.volume.primarySlot;
          const p = pSlot >= 0 ? inst[pSlot] : undefined;
          if (!p || p.node < 0) break;
          for (let k = 0; k < inst.length; k++) {
            const s = inst[k]!;
            if (s.slot === pSlot || s.node < 0 || st.nodeUp[s.node] !== 1) continue;
            nodeFoot(v, p.node, A, 0.5);
            nodeFoot(v, s.node, B, 0.5);
            this.leaderAt(
              v,
              `repl:${pSlot}:${s.slot}`,
              (A.x + B.x) / 2,
              (A.y + B.y) / 2 + 6,
              'R',
              'REPLICATION',
              false,
              true,
            );
            break;
          }
          break;
        }
        case 'promotion': {
          if (v.t - fx.promoteAt < 3800 && fx.promoteTo >= 0) {
            nodeTop(v, fx.promoteTo, A);
            this.leaderAt(v, `promo:${Math.round(fx.promoteAt)}`, A.x, A.y, 'N', 'PROMOTED', true);
          }
          break;
        }
        case 'gap': {
          if (!st.volume.gap) break;
          for (let k = 0; k < inst.length; k++) {
            const s = inst[k]!;
            if (s.node >= 0 && st.nodeUp[s.node] === 0) {
              nodeTop(v, s.node, A);
              this.leaderAt(v, `gap:${s.slot}:${s.placedAt}`, A.x, A.y, '!', 'NO PRIMARY', false, true);
              break;
            }
          }
          break;
        }
        case 'pipeline':
          this.pipeline(v, st);
          break;
        case 'block':
          this.blockStrip(v, fx, st);
          break;
        case 'candidates': {
          const d = st.deploy;
          if (d.active && d.phase === 'select' && d.candidates.length > 0) {
            nodeTop(v, d.candidates[0] as number, A);
            this.leaderAt(v, 'cand', A.x, A.y, '?', 'CONSIDERING');
          }
          break;
        }
        default:
          break;
      }
    }
    this.end();
  }

  /** Six steps along the bottom edge, each drawn on as the deploy reaches it. */
  private pipeline(v: View, st: SimState): void {
    const { ctx, pal } = v;
    const d = st.deploy;
    const y = v.H - 30;
    const x0 = Math.max(18, v.W * 0.06);
    const x1 = v.W - x0;
    const p = this.prog(v, 'pipeline');
    if (p <= 0) return;
    const n = PHASES.length;
    const seg = (x1 - x0) / n;
    setLabelFont(ctx, pal, v.W < 520 ? 8.5 : 9.5);
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.rAccentHot.a(0.35);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + (x1 - x0) * Math.min(1, p * 1.4), y);
    ctx.stroke();
    const finished = !d.active && d.phase === 'live';
    for (let i = 0; i < n; i++) {
      const cx = x0 + seg * i;
      const done = d.index > i || finished;
      const active = d.active && d.index === i;
      ctx.lineWidth = 1;
      ctx.strokeStyle = (done || active ? pal.rHot : pal.rAccentHot).a(done || active ? 0.95 : 0.45);
      ctx.beginPath();
      ctx.moveTo(cx, y - 5);
      ctx.lineTo(cx, y + 5);
      ctx.stroke();
      if (done || active) {
        const frac = done ? 1 : d.phaseProgress;
        ctx.strokeStyle = pal.rHot.a(0.95);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx + seg * frac, y);
        ctx.stroke();
      }
      const label = `${i + 1} ${PHASES[i]}`;
      const w = measureLabel(ctx, label);
      const wipe = Math.min(1, Math.max(0, p * 2 - i / n));
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx + 4, y + 7, (w + 2) * wipe, 16);
      ctx.clip();
      ctx.fillStyle = (done || active ? pal.rHot : pal.rText).a(done || active ? 0.98 : 0.6);
      ctx.fillText(label, cx + 4, y + 17);
      ctx.restore();
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.rAccentHot.a(0.45);
    ctx.beginPath();
    ctx.moveTo(x1, y - 5);
    ctx.lineTo(x1, y + 5);
    ctx.stroke();
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
  }

  /** A short chain of blocks at the top right; the newest is stamped when the deploy reaches the block step. */
  private blockStrip(v: View, fx: Fx, st: SimState): void {
    const { ctx, pal } = v;
    const x = v.W - 24;
    const y = 26;
    const count = 5;
    const r = 8;
    const p = this.prog(v, 'block');
    if (p <= 0) return;
    const age = (v.t - fx.blockAt) / 900;
    const d = st.deploy;
    const pending = d.active && d.index < 2;
    if (d.active && d.phase === 'register' && p > 0.5) {
      // The spec travels from the specimen to the chain: a light arc that draws itself out.
      const sp = v.specimen;
      const f = d.phaseProgress;
      drawArc(v, sp.x + sp.size * 0.46, sp.y - sp.size * 0.3, x, y + r, f, f, 0, 0.9, pal.rAccentHot);
    }
    for (let i = 0; i < count; i++) {
      const bx = x - (count - 1 - i) * (r * 2.1);
      const newest = i === count - 1;
      const stamped = newest && age >= 0 && age < 1.2;
      const grow = newest ? (pending ? 0.5 : Math.min(1, 0.45 + (age < 0 ? 1 : age) * 1.4)) : 1;
      const rr = r * grow * Math.min(1, p * 1.5);
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const ang = Math.PI / 6 + (k * Math.PI) / 3;
        const px = bx + Math.cos(ang) * rr;
        const py = y + Math.sin(ang) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      const flash = stamped ? 1 - age / 1.2 : 0;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = (flash > 0 ? pal.rHot : pal.rAccentHot).a(
        Math.min(1, (newest && pending ? 0.35 : 0.55) + 0.45 * flash),
      );
      ctx.stroke();
      if (i > 0) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = pal.rAccentHot.a(0.35);
        ctx.beginPath();
        ctx.moveTo(bx - r * 2.1 + r * 0.87, y);
        ctx.lineTo(bx - r * 0.87, y);
        ctx.stroke();
      }
    }
    if (p > 0.6) {
      setLabelFont(ctx, pal, 9.5);
      ctx.fillStyle = pal.rText.a(0.8);
      ctx.textAlign = 'right';
      ctx.fillText('CHAIN', x + r, y + 20);
      ctx.textAlign = 'left';
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
    }
  }
}
