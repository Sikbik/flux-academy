// Arc geometry: the quadratic bezier paths that copies, tethers and request packets follow, and the
// camera-facing ribbon strip built along them. Pure numbers in, numbers out (no three), so it is unit
// tested in node. Positions are written into caller-owned buffers: no per-frame allocation.

import { clamp } from './math';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ArcPath {
  sx: number;
  sy: number;
  sz: number;
  cx: number;
  cy: number;
  cz: number;
  ex: number;
  ey: number;
  ez: number;
  /** Approximate arc length, world units. */
  length: number;
}

export interface ArcShape {
  /** Apex height as a fraction of the horizontal span. */
  apexK: number;
  minApex: number;
  maxApex: number;
}

/** Launch arcs: lofty, like the reference, rising a third of the way across. */
export const LAUNCH_ARC: ArcShape = { apexK: 0.36, minApex: 4, maxApex: 19 };
/** Tethers from the cell to a hosting pillar: the same family, a touch lower. */
export const TETHER_ARC: ArcShape = { apexK: 0.3, minApex: 3.5, maxApex: 16 };
/** Request packets: low and quick. */
export const PACKET_ARC: ArcShape = { apexK: 0.16, minApex: 1.2, maxApex: 6 };

export function makeArc(
  sx: number,
  sy: number,
  sz: number,
  ex: number,
  ey: number,
  ez: number,
  shape: ArcShape = LAUNCH_ARC,
  out: ArcPath = {} as ArcPath,
): ArcPath {
  const span = Math.hypot(ex - sx, ez - sz);
  const apex = clamp(span * shape.apexK, shape.minApex, shape.maxApex);
  // The apex of a quadratic bezier is half the control height above the chord, so double it.
  const midY = (sy + ey) / 2;
  out.sx = sx;
  out.sy = sy;
  out.sz = sz;
  out.ex = ex;
  out.ey = ey;
  out.ez = ez;
  out.cx = (sx + ex) / 2;
  out.cy = midY + apex * 2;
  out.cz = (sz + ez) / 2;
  out.length = 0;
  out.length = arcLength(out);
  return out;
}

/** Point on the arc at parameter t (0 at the start, 1 at the end). */
export function arcAt(a: ArcPath, t: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const u = 1 - t;
  const w0 = u * u;
  const w1 = 2 * u * t;
  const w2 = t * t;
  out.x = w0 * a.sx + w1 * a.cx + w2 * a.ex;
  out.y = w0 * a.sy + w1 * a.cy + w2 * a.ey;
  out.z = w0 * a.sz + w1 * a.cz + w2 * a.ez;
  return out;
}

/** Unit tangent at t. */
export function arcTangent(a: ArcPath, t: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const u = 1 - t;
  let x = 2 * u * (a.cx - a.sx) + 2 * t * (a.ex - a.cx);
  let y = 2 * u * (a.cy - a.sy) + 2 * t * (a.ey - a.cy);
  let z = 2 * u * (a.cz - a.sz) + 2 * t * (a.ez - a.cz);
  const l = Math.hypot(x, y, z) || 1;
  x /= l;
  y /= l;
  z /= l;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

/** Length by 16 chord segments, plenty for pacing. */
export function arcLength(a: ArcPath): number {
  let px = a.sx;
  let py = a.sy;
  let pz = a.sz;
  let len = 0;
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    const u = 1 - t;
    const x = u * u * a.sx + 2 * u * t * a.cx + t * t * a.ex;
    const y = u * u * a.sy + 2 * u * t * a.cy + t * t * a.ey;
    const z = u * u * a.sz + 2 * u * t * a.cz + t * t * a.ez;
    len += Math.hypot(x - px, y - py, z - pz);
    px = x;
    py = y;
    pz = z;
  }
  return len;
}

/**
 * Travel time in seconds for a launch arc: a short hop is quick, a long one takes a little longer, but
 * the whole deploy stays inside the 900 to 1400 ms the motion language allows.
 */
export function launchDuration(span: number): number {
  return clamp(0.62 + span * 0.0085, 0.7, 1.15);
}

/** Request packet travel time: fast, with a little more for distance. */
export function packetDuration(span: number): number {
  return clamp(0.28 + span * 0.006, 0.34, 0.8);
}

// ---------------------------------------------------------------------------
// Ribbons
// ---------------------------------------------------------------------------

export interface RibbonStyle {
  /** The head of the visible segment, as an arc parameter 0..1. */
  head: number;
  /** The tail of the visible segment (<= head). */
  tail: number;
  /** Half width at full strength, world units. */
  width: number;
  /** Colour at the tail and at the head, linear rgb. */
  tailR: number;
  tailG: number;
  tailB: number;
  headR: number;
  headG: number;
  headB: number;
  /** Overall alpha. */
  alpha: number;
  /** Alpha at the tail end relative to the head (0 fades out completely). */
  tailAlpha: number;
  /** Width multiplier at the tail relative to the head. */
  tailWidth: number;
}

export const RIBBON_SEGMENTS = 28;
export const RIBBON_VERTS = (RIBBON_SEGMENTS + 1) * 2;
/** Floats per vertex: position (3), uv (2: across, along), colour (4). */
export const RIBBON_STRIDE = 9;

const _p: Vec3 = { x: 0, y: 0, z: 0 };
const _t: Vec3 = { x: 0, y: 0, z: 0 };

/**
 * Writes one camera-facing strip along `path` between `style.tail` and `style.head` into `out` starting
 * at vertex `vertexOffset`. Returns the number of vertices written (always RIBBON_VERTS). The strip is
 * widened sideways of the tangent, perpendicular to the view direction, so it always faces the lens.
 */
export function writeRibbon(
  out: Float32Array,
  vertexOffset: number,
  path: ArcPath,
  style: RibbonStyle,
  camX: number,
  camY: number,
  camZ: number,
): number {
  const tail = clamp(style.tail, 0, 1);
  const head = clamp(style.head, tail, 1);
  let o = vertexOffset * RIBBON_STRIDE;
  for (let i = 0; i <= RIBBON_SEGMENTS; i++) {
    const k = i / RIBBON_SEGMENTS;
    const t = tail + (head - tail) * k;
    arcAt(path, t, _p);
    arcTangent(path, t, _t);
    // side = normalize(cross(tangent, toCamera))
    const vx = camX - _p.x;
    const vy = camY - _p.y;
    const vz = camZ - _p.z;
    let sx = _t.y * vz - _t.z * vy;
    let sy = _t.z * vx - _t.x * vz;
    let sz = _t.x * vy - _t.y * vx;
    const sl = Math.hypot(sx, sy, sz) || 1;
    sx /= sl;
    sy /= sl;
    sz /= sl;
    // Fades toward the tail, brightest at the head. The strip is widest just behind the head and comes
    // to a point at the head, so a comet reads as a streak of light rather than a cut ribbon.
    const along = k; // 0 tail .. 1 head
    const headTaper = clamp((1 - along) / 0.1, 0, 1);
    const w =
      style.width * (style.tailWidth + (1 - style.tailWidth) * along) * (0.22 + 0.78 * Math.sqrt(headTaper));
    const a = style.alpha * (style.tailAlpha + (1 - style.tailAlpha) * along * along);
    const r = style.tailR + (style.headR - style.tailR) * along;
    const g = style.tailG + (style.headG - style.tailG) * along;
    const b = style.tailB + (style.headB - style.tailB) * along;
    for (let s = -1; s <= 1; s += 2) {
      out[o++] = _p.x + sx * w * s;
      out[o++] = _p.y + sy * w * s;
      out[o++] = _p.z + sz * w * s;
      out[o++] = s;
      out[o++] = t;
      out[o++] = r;
      out[o++] = g;
      out[o++] = b;
      out[o++] = a;
    }
  }
  return RIBBON_VERTS;
}

/** The static index pattern for `n` ribbons packed back to back. */
export function buildRibbonIndex(n: number): Uint16Array {
  const per = RIBBON_SEGMENTS * 6;
  const idx = new Uint16Array(n * per);
  let o = 0;
  for (let r = 0; r < n; r++) {
    const base = r * RIBBON_VERTS;
    for (let i = 0; i < RIBBON_SEGMENTS; i++) {
      const a = base + i * 2;
      idx[o++] = a;
      idx[o++] = a + 1;
      idx[o++] = a + 2;
      idx[o++] = a + 1;
      idx[o++] = a + 3;
      idx[o++] = a + 2;
    }
  }
  return idx;
}
