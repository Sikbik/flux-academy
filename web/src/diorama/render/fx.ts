/**
 * Transient effects above and between the pillars: expanding rings, light arcs from the specimen,
 * requests in flight, the proxy gate, user spots, volume roles and the deploy's candidate flicker.
 *
 * Every function draws into `v.ctx` (CSS pixel space) and allocates nothing: scratch values live at
 * module scope. Positions are computed from the camera each frame, so they follow a camera tween.
 */
import type { BenchNode } from '../model/types';
import type { SimState } from '../sim/types';
import { easeInOutCubic, easeOutCubic, smoothstep } from '../util';
import type { Palette, Ramp } from './palette';
import { FEATURED_H } from './pillars';
import { type Fx, MAX_SLOTS, RK_ACCENT, RK_CRIT, RK_HOT, RK_OK, RK_TIER, type View } from './state';

export const FLIGHT_MS = 980;
export const STAGGER_MS = 90;
/** Height of the schematic proxy gate above the bench, in bench units. */
export const GATE_Z = 26;

// ---- tiny scratch -----------------------------------------------------------------------------------
let QX = 0;
let QY = 0;
/** Quadratic bezier point into QX, QY. */
function quad(t: number, ax: number, ay: number, cx: number, cy: number, bx: number, by: number): void {
  const u = 1 - t;
  QX = u * u * ax + 2 * u * t * cx + t * t * bx;
  QY = u * u * ay + 2 * u * t * cy + t * t * by;
}

export interface Pt {
  x: number;
  y: number;
}

/** Cheap integer noise in [0, 1) for flicker (no allocation, unlike the lattice hash in util). */
export function noise(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- positions -----------------------------------------------------------------------------------------
/** Current cap height of node `i`: lifted pillars are taller. */
export function capZ(v: View, i: number): number {
  const n = v.bench.nodes[i] as BenchNode;
  return n.height * v.hBoost * (1 + (FEATURED_H - 1) * (v.lift[i] as number));
}

export function nodeTop(v: View, i: number, out: Pt): void {
  const n = v.bench.nodes[i] as BenchNode;
  v.cam.project(n.x, n.y, capZ(v, i));
  out.x = v.cam.sx;
  out.y = v.cam.sy;
}

export function nodeFoot(v: View, i: number, out: Pt, z = 0.4): void {
  const n = v.bench.nodes[i] as BenchNode;
  v.cam.project(n.x, n.y, z);
  out.x = v.cam.sx;
  out.y = v.cam.sy;
}

/**
 * The proxy gate hangs in the clear sky between the specimen and the map, on the specimen's axis. It is
 * a diagram of a role (every request passes it), so it takes no place on the map.
 */
export function gatePos(v: View, out: Pt): void {
  const s = v.specimen;
  const top = s.y + s.size * 0.62;
  const floor = v.mapBox.y0 > 0 ? v.mapBox.y0 - 22 : top + 80;
  out.x = s.x;
  out.y = top + Math.max(24, (floor - top) * 0.5);
}

/** Height of a user marker's stem above its spot on the ground, px. Markers float so pillars never hide them. */
export const USER_STEM = 14;

/** The head of a user's marker: where its requests leave from. */
export function userPos(v: View, u: number, out: Pt): boolean {
  const user = v.bench.users[u];
  if (!user) return false;
  v.cam.project(user.x, user.y, 0.2);
  out.x = v.cam.sx;
  out.y = v.cam.sy - USER_STEM;
  return true;
}

/** The point arcs leave from: the base of the specimen. */
export function specimenBase(v: View, out: Pt): void {
  const s = v.specimen;
  out.x = s.x;
  out.y = s.y + s.size * 0.46 - s.lift;
}

export function ringRamp(pal: Palette, kind: number): Ramp {
  switch (kind) {
    case RK_HOT:
      return pal.rHot;
    case RK_CRIT:
      return pal.rCrit;
    case RK_OK:
      return pal.rOk;
    case RK_ACCENT:
      return pal.rAccentHot;
    default:
      return pal.rTiersLight[(kind - RK_TIER) as 0 | 1 | 2];
  }
}

// ---- rings ---------------------------------------------------------------------------------------------
/** Expanding rings on the ground (placement lock, death, revive, block beat). */
export function drawRings(v: View, fx: Fx): void {
  fx.release();
  const { ctx, cam, pal } = v;
  let any = false;
  for (let k = 0; k < fx.rings.length; k++) {
    const r = fx.rings[k]!;
    if (!r.active) continue;
    const u = (v.t - r.t0) / r.dur;
    if (u >= 1) {
      r.active = false;
      continue;
    }
    if (u < 0) continue;
    if (!any) {
      ctx.globalCompositeOperation = 'lighter';
      any = true;
    }
    const e = easeOutCubic(u);
    const rad = r.r0 + (r.r1 - r.r0) * e;
    const a = (1 - u) ** 1.6 * r.alpha;
    ctx.strokeStyle = ringRamp(pal, r.kind).a(a);
    ctx.lineWidth = 1.2 + (1 - u) * 1.3;
    ctx.beginPath();
    const steps = r.hex ? 6 : 40;
    const off = r.hex ? Math.PI / 6 : 0;
    for (let s = 0; s <= steps; s++) {
      const ang = (s / steps) * Math.PI * 2 + off;
      cam.project(r.x + Math.cos(ang) * rad, r.y + Math.sin(ang) * rad, r.z);
      if (s === 0) ctx.moveTo(cam.sx, cam.sy);
      else ctx.lineTo(cam.sx, cam.sy);
    }
    ctx.stroke();
  }
  if (any) ctx.globalCompositeOperation = 'source-over';
}

// ---- arcs ------------------------------------------------------------------------------------------------
/**
 * One light arc: a hairline path from the start to `reach` (0..1), and optionally a comet ending at
 * `head` (0..reach). White-hot at the head, tier coloured along the tail.
 */
export function drawArc(
  v: View,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  reach: number,
  head: number,
  tierIdx: number,
  alpha: number,
  tint?: Ramp,
): void {
  const { ctx, pal } = v;
  const dist = Math.hypot(bx - ax, by - ay);
  const lift = Math.max(34, dist * 0.42);
  const cx = (ax + bx) / 2;
  const cy = Math.min(ay, by) - lift;
  const ramp = tint ?? pal.rTiersLight[tierIdx as 0 | 1 | 2];
  const segs = 22;
  ctx.beginPath();
  for (let k = 0; k <= segs; k++) {
    quad((reach * k) / segs, ax, ay, cx, cy, bx, by);
    if (k === 0) ctx.moveTo(QX, QY);
    else ctx.lineTo(QX, QY);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = ramp.a(0.36 * alpha);
  ctx.stroke();
  if (head <= 0.001) return;
  const tail = 0.34;
  const csegs = 9;
  let px = 0;
  let py = 0;
  for (let k = 0; k <= csegs; k++) {
    const tt = Math.max(0, head - tail + (tail * k) / csegs);
    quad(tt, ax, ay, cx, cy, bx, by);
    if (k > 0) {
      const f = k / csegs;
      ctx.strokeStyle = (f > 0.82 ? pal.rHot : ramp).a((0.1 + 0.9 * f * f) * alpha);
      ctx.lineWidth = 0.8 + 1.6 * f;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(QX, QY);
      ctx.stroke();
    }
    px = QX;
    py = QY;
  }
  ctx.globalCompositeOperation = 'lighter';
  const s = v.tier >= 2 ? 28 : 20;
  ctx.globalAlpha = Math.min(1, 0.85 * alpha);
  ctx.drawImage(v.sprites.hot, px - s / 2, py - s / 2, s, s);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

const A: Pt = { x: 0, y: 0 };
const B: Pt = { x: 0, y: 0 };
const C: Pt = { x: 0, y: 0 };

/** Arcs from the specimen to every instance: launch with a stagger, land with a ring, then idle pulses. */
export function drawInstanceArcs(v: View, fx: Fx, st: SimState): void {
  const n = st.instances.length;
  if (n === 0) return;
  specimenBase(v, C);
  const dense = n > 24;
  const calm = v.sceneId === 'traffic' || v.sceneId === 'failover' ? 0.6 : 1;
  const crowd = n > 8 ? 1 / Math.sqrt(n / 8) : 1;
  const base = calm * crowd;
  fx.launches = 0;
  for (let k = 0; k < n; k++) {
    const s = st.instances[k]!;
    if (s.node < 0 || s.status === 'unplaced' || s.slot >= MAX_SLOTS) continue;
    const slot = s.slot;
    const node = v.bench.nodes[s.node] as BenchNode;
    if (fx.arcNode[slot] !== s.node || fx.arcPlaced[slot] !== s.placedAt) {
      fx.arcNode[slot] = s.node;
      fx.arcPlaced[slot] = s.placedAt;
      if (v.reduced) {
        fx.arcLaunch[slot] = v.t - 1e6;
      } else {
        const stagger = fx.launches * STAGGER_MS;
        fx.launches++;
        fx.arcLaunch[slot] = v.t + stagger;
        fx.later(stagger + FLIGHT_MS * 0.9, node.x, node.y, 0.4, RK_TIER + node.tierIndex, true);
      }
    }
    const since = v.t - (fx.arcLaunch[slot] as number);
    if (since < 0) continue;
    const u = since >= FLIGHT_MS ? 1 : since / FLIGHT_MS;
    nodeTop(v, s.node, B);
    let reach = u >= 1 ? 1 : easeInOutCubic(u);
    let head = u >= 1 ? -1 : reach;
    let alpha = base;
    if (u >= 1 && !v.reduced && !dense && v.tier >= 2) {
      const cyc = ((v.t / 2600 + slot * 0.37) % 1) * 1.55;
      if (cyc < 1) head = cyc;
    }
    if (st.nodeUp[s.node] === 0) {
      const d = fx.deathAt[s.node] as number;
      const cut = v.reduced ? 1 : smoothstep(0, 500, d >= 0 ? v.t - d : 10_000);
      reach *= 1 - cut;
      head = -1;
      alpha *= 1 - 0.5 * cut;
      if (reach < 0.02) continue;
    }
    drawArc(v, C.x, C.y, B.x, B.y, reach, head < 0 ? -1 : Math.min(head, reach), node.tierIndex, alpha);
  }
}

// ---- requests ---------------------------------------------------------------------------------------------
const LEG = { ax: 0, ay: 0, bx: 0, by: 0, u: 0, lift: 0, kind: 0, alpha: 1, trail: false };

type PacketT = SimState['packets'][number];

/** Where a request started: the node that sent it, or the user's spot. */
function fromOrigin(v: View, p: PacketT, out: Pt): boolean {
  if (p.originNode >= 0) {
    nodeTop(v, p.originNode, out);
    return true;
  }
  return userPos(v, p.userIndex, out);
}

/** Kinds: 0 request in flight, 1 redirected, 2 stalled or failed, 3 reply on its way back. */
function legFor(v: View, p: PacketT, now: number): boolean {
  const L = LEG;
  if (p.outcome === 'failed') {
    const age = now - p.doneAt;
    if (age > 700) return false;
    if (p.target >= 0) nodeTop(v, p.target, A);
    else gatePos(v, A);
    L.ax = L.bx = A.x;
    L.ay = L.by = A.y;
    L.u = 0;
    L.kind = 2;
    L.alpha = 1 - age / 700;
    L.trail = false;
    return true;
  }
  if (now < p.tProxy) {
    if (!fromOrigin(v, p, A)) return false;
    gatePos(v, B);
    L.ax = A.x;
    L.ay = A.y;
    L.bx = B.x;
    L.by = B.y;
    L.u = easeInOutCubic(Math.min(1, Math.max(0, (now - p.t0) / Math.max(1, p.tProxy - p.t0))));
    L.lift = 0.3;
    L.kind = 0;
    L.alpha = 1;
    L.trail = true;
    return true;
  }
  if (p.target < 0) return false;
  nodeTop(v, p.target, B);
  if (p.outcome === 'served') {
    if (!fromOrigin(v, p, A)) return false;
    const span = Math.max(1, p.tReturn - p.doneAt);
    const age = now - p.doneAt;
    L.ax = B.x;
    L.ay = B.y;
    L.bx = A.x;
    L.by = A.y;
    L.u = easeInOutCubic(Math.min(1, Math.max(0, age / span)));
    L.lift = 0.28;
    L.kind = 3;
    L.alpha = 0.75 * (1 - Math.min(1, Math.max(0, (age - span) / 600)));
    L.trail = age < span;
    return true;
  }
  if (p.outcome === 'stalled') {
    L.ax = L.bx = B.x;
    L.ay = L.by = B.y;
    L.u = 0;
    L.kind = 2;
    L.alpha = Math.floor(v.t / 90) % 2 === 0 ? 1 : 0.35;
    L.trail = false;
    return true;
  }
  // Flying towards the node: from the gate, or from the node that did not answer.
  let start = p.tProxy;
  if (p.redirectAt >= 0 && p.redirectFrom >= 0) {
    nodeTop(v, p.redirectFrom, A);
    start = p.redirectAt;
    L.kind = 1;
  } else {
    gatePos(v, A);
    L.kind = 0;
  }
  L.ax = A.x;
  L.ay = A.y;
  L.bx = B.x;
  L.by = B.y;
  L.u = easeInOutCubic(Math.min(1, Math.max(0, (now - start) / Math.max(1, p.tArrive - start))));
  L.lift = 0.34;
  L.alpha = 1;
  L.trail = true;
  return true;
}

/** Requests as small comets: user to the gate to a node, a stalled flicker, then the reply home. */
export function drawPackets(v: View, st: SimState): void {
  const list = st.packets;
  if (list.length === 0 || v.reduced) return;
  const { ctx, pal, sprites } = v;
  const now = st.time;
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < list.length; k++) {
    const p = list[k]!;
    if (!legFor(v, p, now)) continue;
    const L = LEG;
    const ramp = L.kind === 2 ? pal.rCrit : L.kind === 1 ? pal.rWarn : L.kind === 3 ? pal.rOk : pal.rHot;
    const spr =
      L.kind === 2 ? sprites.crit : L.kind === 1 ? sprites.warn : L.kind === 3 ? sprites.ok : sprites.hot;
    const dist = Math.hypot(L.bx - L.ax, L.by - L.ay);
    const lift = Math.max(20, dist * L.lift);
    const cx = (L.ax + L.bx) / 2;
    const cy = Math.min(L.ay, L.by) - lift;
    let hx = L.ax;
    let hy = L.ay;
    const a = Math.max(0, Math.min(1, L.alpha));
    if (L.trail) {
      // The leg's whole route as a faint hairline, and the stretch already travelled drawn brighter.
      ctx.lineWidth = 1;
      ctx.strokeStyle = ramp.a(0.16 * a);
      ctx.beginPath();
      ctx.moveTo(L.ax, L.ay);
      ctx.quadraticCurveTo(cx, cy, L.bx, L.by);
      ctx.stroke();
      const steps = 10;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = ramp.a(0.62 * a);
      ctx.beginPath();
      for (let q = 0; q <= steps; q++) {
        quad((L.u * q) / steps, L.ax, L.ay, cx, cy, L.bx, L.by);
        if (q === 0) ctx.moveTo(QX, QY);
        else ctx.lineTo(QX, QY);
      }
      ctx.stroke();
      hx = QX;
      hy = QY;
    }
    ctx.globalAlpha = a;
    const s = 34;
    ctx.drawImage(spr, hx - s / 2, hy - s / 2, s, s);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ramp.a(a);
    ctx.beginPath();
    ctx.arc(hx, hy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---- gate, users, roles, candidates -------------------------------------------------------------------------
const DASH: number[] = [3, 5];
const NO_DASH: number[] = [];

function hexPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  spin = 0,
): void {
  ctx.beginPath();
  for (let k = 0; k <= 6; k++) {
    const ang = Math.PI / 6 + (k * Math.PI) / 3 + spin;
    const px = x + Math.cos(ang) * rx;
    const py = y + Math.sin(ang) * ry;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
}

/** The proxy: a schematic gate in the sky that every request passes on its way to a node. */
export function drawGate(v: View, st: SimState): void {
  const { ctx, pal, sprites } = v;
  gatePos(v, A);
  const r = Math.max(12, v.specimen.size * 0.2);
  const busy = st.packets.length > 0;
  const spin = v.reduced ? 0 : Math.sin(v.t / 900) * 0.05;
  hexPath(ctx, A.x, A.y, r, r * 0.62, spin);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = pal.rAccentHot.a(0.8);
  ctx.stroke();
  hexPath(ctx, A.x, A.y, r * 0.58, r * 0.36, spin);
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.rHot.a(busy ? 0.95 : 0.5);
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = busy ? 0.7 : 0.35;
  const s = r * 4.4;
  ctx.drawImage(sprites.accent, A.x - s / 2, A.y - s / 2, s, s);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

const litStamp = new Int32Array(64);
let litFrame = 0;

/**
 * Where requests come from: a small marker on a stem above each user spot, lit while one of its requests
 * is in flight. They are drawn after the pillars so a city that also hosts a node never hides them.
 */
export function drawUsers(v: View, st: SimState): void {
  const { ctx, pal, cam } = v;
  litFrame++;
  for (let k = 0; k < st.packets.length; k++) {
    const u = st.packets[k]!.userIndex;
    if (u >= 0 && u < litStamp.length) litStamp[u] = litFrame;
  }
  const users = v.bench.users;
  for (let u = 0; u < users.length; u++) {
    const user = users[u]!;
    cam.project(user.x, user.y, 0.2);
    const fx0 = cam.sx;
    const fy0 = cam.sy;
    const lit = u < litStamp.length && litStamp[u] === litFrame;
    const ramp = lit ? pal.rHot : pal.rText;
    // Stem and foot.
    ctx.lineWidth = 1;
    ctx.strokeStyle = ramp.a(lit ? 0.9 : 0.5);
    ctx.beginPath();
    ctx.moveTo(fx0, fy0);
    ctx.lineTo(fx0, fy0 - USER_STEM + 4);
    ctx.stroke();
    hexPath(ctx, fx0, fy0, 3.2, 2);
    ctx.stroke();
    // Head.
    const hy = fy0 - USER_STEM;
    hexPath(ctx, fx0, hy, 5, 5);
    ctx.lineWidth = lit ? 1.5 : 1.1;
    ctx.strokeStyle = ramp.a(lit ? 1 : 0.8);
    ctx.stroke();
    ctx.fillStyle = ramp.a(lit ? 0.55 : 0.18);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx0, hy, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = ramp.a(lit ? 1 : 0.8);
    ctx.fill();
  }
}

/** Replication links from the primary to each standby, a promotion in flight, and nothing else. */
export function drawRoles(v: View, fx: Fx, st: SimState): void {
  const { ctx, pal, cam, sprites } = v;
  const inst = st.instances;
  const primary = st.volume.primarySlot;
  const pSlot = primary >= 0 ? inst[primary] : undefined;
  if (pSlot && pSlot.node >= 0) {
    const pn = v.bench.nodes[pSlot.node] as BenchNode;
    cam.project(pn.x, pn.y, 0.5);
    const ax = cam.sx;
    const ay = cam.sy;
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < inst.length; k++) {
      const s = inst[k]!;
      if (s.slot === primary || s.node < 0 || st.nodeUp[s.node] !== 1) continue;
      const n = v.bench.nodes[s.node] as BenchNode;
      cam.project(n.x, n.y, 0.5);
      const bx = cam.sx;
      const by = cam.sy;
      const cx = (ax + bx) / 2;
      const cy = Math.max(ay, by) + Math.hypot(bx - ax, by - ay) * 0.1 + 4;
      ctx.setLineDash(DASH);
      ctx.lineDashOffset = v.reduced ? 0 : -((v.t / 60) % 16);
      ctx.strokeStyle = pal.rAccentHot.a(0.26 + 0.5 * s.sync);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, bx, by);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
      if (!v.reduced && s.sync < 1) {
        quad((v.t / 900) % 1, ax, ay, cx, cy, bx, by);
        ctx.fillStyle = pal.rHot.a(0.95);
        ctx.beginPath();
        ctx.arc(QX, QY, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // The crown travelling from the lost primary to the new one.
  const age = v.t - fx.promoteAt;
  if (age >= 0 && age < 1400 && fx.promoteTo >= 0 && !v.reduced) {
    const u = easeInOutCubic(age / 1400);
    nodeTop(v, fx.promoteTo, B);
    if (fx.promoteFrom >= 0) {
      nodeTop(v, fx.promoteFrom, A);
      quad(u, A.x, A.y, (A.x + B.x) / 2, Math.min(A.y, B.y) - 50, B.x, B.y);
    } else {
      QX = B.x;
      QY = B.y;
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.drawImage(sprites.hot, QX - 17, QY - 17, 34, 34);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** Nodes the network is "considering" during selection: ground hexagons that flicker. */
export function drawCandidates(v: View, st: SimState): void {
  const d = st.deploy;
  if (!d.active || d.phase !== 'select' || d.candidates.length === 0) return;
  const { ctx, pal } = v;
  ctx.globalCompositeOperation = 'lighter';
  const frame = Math.floor(v.t / 110);
  for (let k = 0; k < d.candidates.length; k++) {
    const c = d.candidates[k] as number;
    if (c < 0) continue;
    const flick = v.reduced ? 0.7 : 0.15 + 0.85 * noise(frame, c * 7 + 1);
    nodeFoot(v, c, A, 0.3);
    const ps = v.geo.ps[c] as number;
    hexPath(ctx, A.x, A.y, ps * 1.15, ps * 0.72);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = pal.rHot.a(0.15 + 0.7 * flick);
    ctx.stroke();
    ctx.fillStyle = pal.rAccentHot.a(0.06 + 0.2 * flick);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
