// Camera maths and presets. A pose is a point to look at, an orbit (yaw, elevation, distance), a lens
// (field of view) and a lens shift that moves the picture inside the canvas so the bench can sit beside
// the page's text without the perspective being distorted.
//
// Everything is plain numbers (no three), so it is unit tested in node. The rig eases between poses with
// a cascade of two critically damped springs per channel, which gives the S curve of a cinematic move
// and keeps velocity continuous when the target changes in mid flight (a scroll that reverses).

import { clamp, DEG, lerp, smoothDamp, smoothstep, type Velocity } from './math';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Pose {
  /** The point the camera looks at. */
  tx: number;
  ty: number;
  tz: number;
  /** Orbit angle around the target, radians. 0 is straight on from the south (+z), positive swings east. */
  yaw: number;
  /** Angle above the horizon, radians. */
  elev: number;
  /** Distance from the target, world units. */
  dist: number;
  /** Vertical field of view, degrees. */
  fov: number;
  /** Lens shift in NDC units (the picture moves by this much, -1..1 is the whole canvas). */
  shiftX: number;
  shiftY: number;
}

export function makePose(): Pose {
  return { tx: 0, ty: 0, tz: 0, yaw: 0, elev: 0.6, dist: 90, fov: 34, shiftX: 0, shiftY: 0 };
}

export interface Basis {
  fx: number;
  fy: number;
  fz: number;
  rx: number;
  ry: number;
  rz: number;
  ux: number;
  uy: number;
  uz: number;
}

/** Forward, right and up of the camera for an orbit (yaw, elevation). */
export function basisFor(yaw: number, elev: number, out: Basis = {} as Basis): Basis {
  const ce = Math.cos(elev);
  const se = Math.sin(elev);
  // The camera sits at target + (sin(yaw) cos(e), sin(e), cos(yaw) cos(e)) * dist and looks back at it.
  out.fx = -Math.sin(yaw) * ce;
  out.fy = -se;
  out.fz = -Math.cos(yaw) * ce;
  // right = normalize(cross(forward, worldUp)): horizontal.
  const rx = -out.fz;
  const rz = out.fx;
  const rl = Math.hypot(rx, rz) || 1;
  out.rx = rx / rl;
  out.ry = 0;
  out.rz = rz / rl;
  // up = cross(right, forward)
  out.ux = out.ry * out.fz - out.rz * out.fy;
  out.uy = out.rz * out.fx - out.rx * out.fz;
  out.uz = out.rx * out.fy - out.ry * out.fx;
  return out;
}

export function cameraPosition(p: Pose, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const ce = Math.cos(p.elev);
  out.x = p.tx + Math.sin(p.yaw) * ce * p.dist;
  out.y = p.ty + Math.sin(p.elev) * p.dist;
  out.z = p.tz + Math.cos(p.yaw) * ce * p.dist;
  return out;
}

/** A rectangle of the canvas, in NDC (-1..1, y up), that the framed content must stay inside. */
export interface NdcRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The free rectangle for the page's insets (fractions of the canvas covered by page content). */
export function freeRect(
  insets: { left: number; right: number; top: number; bottom: number },
  margin = 0.05,
): NdcRect {
  const l = clamp(insets.left, 0, 0.8);
  const r = clamp(insets.right, 0, 0.8);
  const t = clamp(insets.top, 0, 0.8);
  const b = clamp(insets.bottom, 0, 0.8);
  const m = margin * 2;
  return {
    x0: -1 + 2 * l + m,
    x1: 1 - 2 * r - m,
    y0: -1 + 2 * b + m,
    y1: 1 - 2 * t - m,
  };
}

const _b: Basis = {} as Basis;

/**
 * The smallest orbit distance at which every point of `points` projects inside `rect` for a camera at
 * (yaw, elevation) looking at the target, given the canvas aspect. The lens shift moves the picture so
 * the rect's centre is the principal point; the fit then only has to cover the points' spread about it.
 */
export function fitDistance(
  p: Pick<Pose, 'tx' | 'ty' | 'tz' | 'yaw' | 'elev' | 'fov'>,
  aspect: number,
  rect: NdcRect,
  points: readonly Vec3[],
): number {
  basisFor(p.yaw, p.elev, _b);
  const th = Math.tan((p.fov * DEG) / 2);
  const hw = Math.max(1e-3, (rect.x1 - rect.x0) / 2);
  const hh = Math.max(1e-3, (rect.y1 - rect.y0) / 2);
  // Required distance so that the point lies at most (hw, hh) from the rect centre in NDC:
  //   ndc.x - shiftedCentre = (R . right) / (depth * th * aspect)
  // depth = d + (P - T) . forward  =>  d >= |R.right| / (hw * th * aspect) - (P - T) . forward
  let d = 1;
  for (const pt of points) {
    const rx = pt.x - p.tx;
    const ry = pt.y - p.ty;
    const rz = pt.z - p.tz;
    const px = rx * _b.rx + ry * _b.ry + rz * _b.rz;
    const py = rx * _b.ux + ry * _b.uy + rz * _b.uz;
    const pf = rx * _b.fx + ry * _b.fy + rz * _b.fz;
    const dx = Math.abs(px) / (hw * th * aspect) - pf;
    const dy = Math.abs(py) / (hh * th) - pf;
    if (dx > d) d = dx;
    if (dy > d) d = dy;
  }
  return d;
}

/** Lens shift (NDC) that puts the principal point at the centre of `rect`. */
export function shiftFor(rect: NdcRect): { x: number; y: number } {
  return { x: (rect.x0 + rect.x1) / 2, y: (rect.y0 + rect.y1) / 2 };
}

// ---------------------------------------------------------------------------
// The rig
// ---------------------------------------------------------------------------

const CHANNELS = ['tx', 'ty', 'tz', 'yaw', 'elev', 'dist', 'fov', 'shiftX', 'shiftY'] as const;
type Channel = (typeof CHANNELS)[number];

/**
 * Eases the live pose toward a target pose. Two critically damped springs in series per channel: the
 * first smooths the target, the second follows it, so a move starts gently, accelerates, and settles
 * without overshoot. `smoothTime` is per spring; the whole move takes about 3 times that.
 */
export class CameraRig {
  readonly pose: Pose = makePose();
  private readonly mid: Pose = makePose();
  private readonly v1: Record<Channel, Velocity>;
  private readonly v2: Record<Channel, Velocity>;
  private started = false;

  constructor(public smoothTime = 0.38) {
    const a = {} as Record<Channel, Velocity>;
    const b = {} as Record<Channel, Velocity>;
    for (const c of CHANNELS) {
      a[c] = { v: 0 };
      b[c] = { v: 0 };
    }
    this.v1 = a;
    this.v2 = b;
  }

  /** Jumps to a pose with no motion (first frame, reduced motion). */
  snap(target: Pose): Pose {
    for (const c of CHANNELS) {
      this.pose[c] = target[c];
      this.mid[c] = target[c];
      this.v1[c].v = 0;
      this.v2[c].v = 0;
    }
    this.started = true;
    return this.pose;
  }

  step(target: Pose, dt: number): Pose {
    if (!this.started) return this.snap(target);
    for (const c of CHANNELS) {
      const t = c === 'yaw' ? this.nearestYaw(this.mid.yaw, target.yaw) : target[c];
      this.mid[c] = smoothDamp(this.mid[c], t, this.v1[c], this.smoothTime, dt);
      this.pose[c] = smoothDamp(this.pose[c], this.mid[c], this.v2[c], this.smoothTime, dt);
    }
    return this.pose;
  }

  /** The yaw representation of `to` that is closest to `from` (so a swing never takes the long way). */
  private nearestYaw(from: number, to: number): number {
    const tau = Math.PI * 2;
    return to + tau * Math.round((from - to) / tau);
  }
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export type PresetId = 'hero' | 'describe' | 'register' | 'place' | 'run' | 'backdrop' | 'ambient';

/** The scroll story chapters in order. */
export const CHAPTER_PRESETS: readonly PresetId[] = ['describe', 'register', 'place', 'run'];

export interface BenchFrame {
  /** Half width and half depth of the bench, world units. */
  halfW: number;
  halfD: number;
  /** Where the cell floats. */
  cell: Vec3;
  /** The head of the chain strip. */
  stripHead: Vec3;
  stripTail: Vec3;
}

/** A preset's resolved look: orbit angles, lens, a target and the points that must stay in frame. */
export interface PresetShape {
  tx: number;
  ty: number;
  tz: number;
  yaw: number;
  elev: number;
  fov: number;
  focus: Vec3[];
}

function pts(...a: [number, number, number][]): Vec3[] {
  return a.map(([x, y, z]) => ({ x, y, z }));
}

/** 0 for a wide frame, 1 for a tall one. Drives how far the bench is turned and tilted. */
export function narrowness(aspect: number): number {
  return smoothstep(1.7, 0.55, aspect);
}

/**
 * Preset geometry for a frame. `aspect` is the aspect of the free rectangle (not the whole canvas).
 * The hero is nearly frontal on a wide frame, as in the look target, and turns into an isometric corner
 * view on a tall one so the long bench still fills the stage.
 */
export function presetShape(id: PresetId, frame: BenchFrame, aspect: number): PresetShape {
  const n = narrowness(aspect);
  const { halfW: w, halfD: d, cell, stripHead, stripTail } = frame;
  const cx = cell.x;
  const cy = cell.y;
  const cz = cell.z;
  switch (id) {
    case 'hero': {
      // A tall frame crops the far east and west a little: the cell, its arcs and the middle of the world
      // matter more than the edges, and a thin map in a portrait frame is a waste of the screen.
      const k = lerp(1, 0.7, n);
      return {
        tx: 0,
        ty: 3.4,
        tz: -1,
        yaw: lerp(0.05, 0.92, n),
        elev: lerp(0.92, 1.0, n),
        fov: 30,
        focus: pts(
          [(-w - 3) * k, 0, d + 2],
          [(w + 3) * k, 0, d + 2],
          [(-w - 3) * k, 0, -d - 2],
          [(w + 3) * k, 0, -d - 2],
          [cx - 18, cy + 9, cz],
          [cx + 18, cy + 9, cz],
          [cx, cy + 12, cz],
          [0, 0, d + 7],
          [lerp(stripHead.x + 3, 0, n * 0.8), 0, stripHead.z + 3],
          [lerp(stripTail.x + 3, 0, n * 0.8), 0, stripTail.z - 1],
        ),
      };
    }
    case 'describe':
      return {
        tx: cx,
        ty: cy + 0.4,
        tz: cz,
        yaw: lerp(0.4, 0.5, n),
        elev: lerp(0.3, 0.38, n),
        fov: 30,
        focus: pts(
          [cx - 10, cy - 8, cz - 5],
          [cx + 10, cy - 8, cz + 5],
          [cx - 10, cy + 8.5, cz - 5],
          [cx + 10, cy + 8.5, cz + 5],
        ),
      };
    case 'register':
      return {
        tx: lerp(stripHead.x, cx, 0.5),
        ty: 5,
        tz: lerp(stripHead.z, stripTail.z, 0.42),
        yaw: lerp(0.66, 0.74, n),
        elev: lerp(0.4, 0.5, n),
        fov: 30,
        focus: pts(
          [stripHead.x + 3, 0, stripHead.z + 5],
          [stripTail.x + 3, 0, stripTail.z - 3],
          [cx, cy + 9, cz],
          [cx, cy - 7, cz],
          [stripHead.x - 24, 4, stripHead.z + 2],
          [stripTail.x - 24, 4, stripTail.z - 2],
        ),
      };
    case 'place':
      return {
        tx: 0,
        ty: 4.2,
        tz: -2,
        yaw: lerp(-0.2, -0.9, n),
        elev: lerp(0.78, 0.92, n),
        fov: 34,
        focus: pts(
          [-w, 0, d],
          [w, 0, d],
          [-w, 0, -d],
          [w, 0, -d],
          [cx, cy + 10, cz],
          [cx - 16, cy + 6, cz],
          [cx + 16, cy + 6, cz],
        ),
      };
    case 'run':
      return {
        tx: lerp(-4, -2, n),
        ty: 2.2,
        tz: 4,
        yaw: lerp(-0.1, 0.85, n),
        elev: lerp(0.5, 0.8, n),
        fov: 36,
        focus: pts(
          [-w * 0.98, 0, d * 0.95],
          [w * 0.98, 0, d * 0.95],
          [-w * 0.92, 0, -d * 0.8],
          [w * 0.92, 0, -d * 0.8],
          [cx, cy + 7, cz],
          [0, 0, d + 7],
        ),
      };
    case 'backdrop':
      return {
        tx: 0,
        ty: 2,
        tz: 0,
        yaw: lerp(-0.08, 0.7, n),
        elev: lerp(0.5, 0.9, n),
        fov: 38,
        focus: pts([-w - 6, 0, d + 4], [w + 6, 0, d + 4], [-w - 6, 0, -d - 4], [w + 6, 0, -d - 4]),
      };
    default:
      return presetShape('hero', frame, aspect);
  }
}

/** Resolves a preset to a full pose for a canvas aspect and the page's insets. */
export function resolvePose(
  shape: PresetShape,
  canvasAspect: number,
  rect: NdcRect,
  out: Pose = makePose(),
): Pose {
  out.tx = shape.tx;
  out.ty = shape.ty;
  out.tz = shape.tz;
  out.yaw = shape.yaw;
  out.elev = shape.elev;
  out.fov = shape.fov;
  const s = shiftFor(rect);
  out.shiftX = s.x;
  out.shiftY = s.y;
  out.dist = fitDistance(shape, canvasAspect, rect, shape.focus);
  return out;
}

/** The aspect of the free rect, which is what decides how the bench is turned. */
export function freeAspect(canvasAspect: number, rect: NdcRect): number {
  const w = Math.max(1e-3, rect.x1 - rect.x0);
  const h = Math.max(1e-3, rect.y1 - rect.y0);
  return (canvasAspect * w) / h;
}

/** Which preset the page state asks for. */
export function presetFor(section: string, chapter: number, ambient: boolean): PresetId {
  if (ambient) return 'ambient';
  if (section === 'hero') return 'hero';
  if (section === 'story') return CHAPTER_PRESETS[Math.min(3, Math.max(0, Math.round(chapter)))] ?? 'place';
  return 'backdrop';
}

/**
 * The ambient camera: a slow drift across the bench. A pure function of time, so it needs no state and a
 * screenshot at a given time is reproducible. Periods are long and co-prime so the path does not repeat
 * for minutes. It stays low and wide: the bench is a landscape the camera flies over, not a map.
 */
export function ambientPose(t: number, frame: BenchFrame, aspect: number, out: Pose = makePose()): Pose {
  const n = narrowness(aspect);
  const sweep = Math.sin(t * 0.021 * Math.PI) * 0.5 + Math.sin(t * 0.0083 * Math.PI + 1.3) * 0.5;
  // Always high enough to keep the cell in the top of the picture, wide enough to read as a landscape.
  out.tx = sweep * frame.halfW * lerp(0.42, 0.3, n);
  out.ty = 6.5 + Math.sin(t * 0.05) * 1.2;
  out.tz = Math.sin(t * 0.017 * Math.PI + 0.6) * frame.halfD * 0.16;
  out.yaw = Math.sin(t * 0.013 * Math.PI + 0.9) * 0.3 + lerp(0.08, 0.5, n);
  out.elev = 0.54 + Math.sin(t * 0.027 * Math.PI) * 0.06 + n * 0.2;
  out.dist = lerp(98, 128, n) + Math.sin(t * 0.019 * Math.PI + 2.1) * 8;
  out.fov = 32;
  out.shiftX = 0;
  out.shiftY = 0;
  return out;
}

/** Pointer parallax offsets: tiny orbit and target shifts, in radians and world units. */
export function parallaxOffsets(
  x: number,
  y: number,
  strength: number,
  out: { yaw: number; elev: number; shiftX: number; shiftY: number } = {
    yaw: 0,
    elev: 0,
    shiftX: 0,
    shiftY: 0,
  },
): { yaw: number; elev: number; shiftX: number; shiftY: number } {
  const k = clamp(strength, 0, 1);
  out.yaw = -x * 0.05 * k;
  out.elev = y * 0.03 * k;
  out.shiftX = -x * 0.012 * k;
  out.shiftY = -y * 0.008 * k;
  return out;
}
