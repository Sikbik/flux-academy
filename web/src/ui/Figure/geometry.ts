/**
 * Geometry for the blueprint annotation parts: leader lines, callout rings, dimension lines,
 * tick rulers and crosshairs. Everything here is pure (no DOM, no React) so it is unit
 * tested in node. Coordinates are screen pixels with +y pointing down.
 *
 * The parts in `Annotations.tsx` only turn these results into SVG.
 */

export interface Point {
  x: number;
  y: number;
}

/** Eight compass directions a leader can leave an anchor in (screen space). */
export type Side8 = 'tl' | 't' | 'tr' | 'l' | 'r' | 'bl' | 'b' | 'br';

/** Which side of the measured segment a dimension line sits on. */
export type DimSide = 'top' | 'bottom' | 'left' | 'right';

export type LeaderRoute = 'straight' | 'elbow';

const SQRT1_2 = Math.SQRT1_2;

// ---------------------------------------------------------------------------
// Small vector helpers
// ---------------------------------------------------------------------------

export const pt = (x: number, y: number): Point => ({ x, y });
export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
export const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Unit vector from a to b. The zero vector when the points coincide. */
export function unit(a: Point, b: Point): Point {
  const d = dist(a, b);
  return d === 0 ? { x: 0, y: 0 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

/** Rounds a coordinate to the centre of a device pixel, so a 1 px line is crisp. */
export function crisp(v: number): number {
  return Math.round(v - 0.5) + 0.5;
}

/** Trims float noise for path data. */
export function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
}

/** An SVG path through the points: `M x y L x y ...`. */
export function polyline(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join('');
}

// ---------------------------------------------------------------------------
// Leaders
// ---------------------------------------------------------------------------

/** The unit direction of a compass side in screen space. */
export function sideVector(side: Side8): Point {
  switch (side) {
    case 't':
      return { x: 0, y: -1 };
    case 'b':
      return { x: 0, y: 1 };
    case 'l':
      return { x: -1, y: 0 };
    case 'r':
      return { x: 1, y: 0 };
    case 'tl':
      return { x: -SQRT1_2, y: -SQRT1_2 };
    case 'tr':
      return { x: SQRT1_2, y: -SQRT1_2 };
    case 'bl':
      return { x: -SQRT1_2, y: SQRT1_2 };
    case 'br':
      return { x: SQRT1_2, y: SQRT1_2 };
  }
}

export function isDiagonal(side: Side8): boolean {
  return side.length === 2;
}

export function flipSideX(side: Side8): Side8 {
  const map: Record<Side8, Side8> = {
    tl: 'tr',
    tr: 'tl',
    bl: 'br',
    br: 'bl',
    l: 'r',
    r: 'l',
    t: 't',
    b: 'b',
  };
  return map[side];
}

export function flipSideY(side: Side8): Side8 {
  const map: Record<Side8, Side8> = {
    tl: 'bl',
    bl: 'tl',
    tr: 'br',
    br: 'tr',
    t: 'b',
    b: 't',
    l: 'l',
    r: 'r',
  };
  return map[side];
}

export interface LeaderInput {
  /** The point on the thing being annotated. */
  anchor: Point;
  /** Which way the leader leaves the anchor. */
  side: Side8;
  /** Length of the line from the anchor to the edge of the ring, px. */
  length: number;
  /** Radius of the ring the leader ends at, px. */
  ringRadius: number;
  /** `elbow`: a 45 degree run, then a straight run along the x axis (diagonal sides only). */
  route?: LeaderRoute;
}

export interface LeaderGeometry {
  /** The polyline from the anchor to the ring edge. */
  points: Point[];
  /** The centre of the ring. */
  ring: Point;
  /** The polyline as SVG path data. */
  path: string;
  side: Side8;
}

/** Where the line and the ring go for a leader leaving `anchor` toward `side`. */
export function leaderGeometry({
  anchor,
  side,
  length,
  ringRadius,
  route = 'straight',
}: LeaderInput): LeaderGeometry {
  const d = sideVector(side);
  if (route === 'straight' || !isDiagonal(side)) {
    const end = add(anchor, mul(d, length));
    const ring = add(end, mul(d, ringRadius));
    const points = [anchor, end];
    return { points, ring, path: polyline(points), side };
  }
  // Elbow: the diagonal takes 55 percent of the length, then a horizontal run to the ring.
  const diagonal = length * 0.55;
  const run = length - diagonal;
  const knee = add(anchor, mul(d, diagonal));
  const hx = Math.sign(d.x);
  const end = { x: knee.x + hx * run, y: knee.y };
  const ring = { x: end.x + hx * ringRadius, y: end.y };
  const points = [anchor, knee, end];
  return { points, ring, path: polyline(points), side };
}

export interface Box {
  width: number;
  height: number;
}

/** True when a ring of `radius` centred at `c` lies inside the box grown by `margin`. */
export function ringFits(c: Point, radius: number, box: Box, margin = 0): boolean {
  return (
    c.x - radius >= -margin &&
    c.y - radius >= -margin &&
    c.x + radius <= box.width + margin &&
    c.y + radius <= box.height + margin
  );
}

/** The gap between a callout ring and the label set beside it, px. */
export const LABEL_GAP = 9;

export interface FittedLeader extends LeaderGeometry {
  /** True when the ring (and the label, if one was asked for) lie inside the box. */
  fits: boolean;
}

/**
 * Like `leaderGeometry`, but if the ring would leave the box it tries the mirrored sides
 * (flip x, flip y, both) and keeps the first that fits. `labelWidth` is the width of a label
 * set beside the ring (0 for none): it has to fit too, on the side facing away from the
 * anchor. When nothing fits, the requested side is kept and `fits` is false.
 */
export function fitLeader(input: LeaderInput, box: Box, margin = 0, labelWidth = 0): FittedLeader {
  const tries: Side8[] = [
    input.side,
    flipSideX(input.side),
    flipSideY(input.side),
    flipSideX(flipSideY(input.side)),
  ];
  const seen = new Set<Side8>();
  for (const side of tries) {
    if (seen.has(side)) continue;
    seen.add(side);
    const g = leaderGeometry({ ...input, side });
    if (!ringFits(g.ring, input.ringRadius, box, margin)) continue;
    if (labelWidth > 0) {
      const dir = g.ring.x >= input.anchor.x ? 1 : -1;
      const far = g.ring.x + dir * (input.ringRadius + LABEL_GAP + labelWidth);
      if (far < -margin || far > box.width + margin) continue;
    }
    return { ...g, fits: true };
  }
  return { ...leaderGeometry(input), fits: false };
}

/**
 * A leader between two arbitrary points: a 45 degree run from `from`, then a straight run
 * along the longer axis to `to` (the callout style of ref-blueprint-ui). With
 * `route: 'straight'` it is one segment.
 */
export function routeBetween(from: Point, to: Point, route: LeaderRoute = 'straight'): Point[] {
  if (route === 'straight') return [from, to];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax === 0 || ay === 0 || ax === ay) return [from, to];
  if (ax > ay) {
    const knee = { x: from.x + Math.sign(dx) * ay, y: to.y };
    return [from, knee, to];
  }
  const knee = { x: to.x, y: from.y + Math.sign(dy) * ax };
  return [from, knee, to];
}

/** The point where a line toward `toward` leaves a circle centred at `c`. */
export function pointOnRing(c: Point, radius: number, toward: Point): Point {
  const u = unit(c, toward);
  return { x: c.x + u.x * radius, y: c.y + u.y * radius };
}

// ---------------------------------------------------------------------------
// Dimension lines
// ---------------------------------------------------------------------------

const SIDE_SCREEN: Record<DimSide, Point> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export interface DimensionInput {
  /** The two measured points (the edges of the object). */
  from: Point;
  to: Point;
  /** How far the dimension line sits from the measured points, px. Negative flips the side. */
  offset?: number;
  /** Which screen side the dimension line sits on. Default `top` (or `left` for verticals). */
  side?: DimSide;
  /** Gap between the object and the start of each extension line, px. */
  extGap?: number;
  /** How far an extension line runs past the dimension line, px. */
  extOver?: number;
  /** Arrowhead length, px. */
  arrow?: number;
  /** Width of the label in px; the line is broken around it when it fits. 0 for no label. */
  labelWidth?: number;
  /** Clear space either side of the label, px. */
  labelGap?: number;
  /** Half-length of a perpendicular end bar, px. */
  bar?: number;
}

export interface Arrowhead {
  /** The point that touches the extension line. */
  tip: Point;
  /** The two base corners. */
  a: Point;
  b: Point;
}

export interface DimensionGeometry {
  /** The ends of the dimension line. */
  p1: Point;
  p2: Point;
  /** The unit normal the line was offset along (pointing away from the object). */
  normal: Point;
  /** The unit direction from `from` to `to`. */
  dir: Point;
  /** Extension (witness) lines, from just off the object to just past the dimension line. */
  ext: [[Point, Point], [Point, Point]];
  /** The dimension line pieces: two when the label breaks the line, otherwise one. */
  segments: [Point, Point][];
  arrows: [Arrowhead, Arrowhead];
  /** Perpendicular end bars. */
  bars: [[Point, Point], [Point, Point]];
  /** The label centre. */
  labelAt: Point;
  /** Label rotation in degrees, normalised so the text never reads upside down. */
  labelAngle: number;
  /** True when the line is broken around the label. False: the label floats beside the line. */
  labelInline: boolean;
  /** Distance between the measured points. */
  length: number;
}

/** The text rotation that keeps a label along a line readable: in [-90, 90). */
export function readableAngle(dir: Point): number {
  let a = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  if (a >= 90) a -= 180;
  if (a < -90) a += 180;
  return Math.round(a * 1000) / 1000;
}

export function dimensionGeometry({
  from,
  to,
  offset = 20,
  side,
  extGap = 4,
  extOver = 6,
  arrow = 7,
  labelWidth = 0,
  labelGap = 6,
  bar = 4,
}: DimensionInput): DimensionGeometry {
  const dir = unit(from, to);
  const length = dist(from, to);
  const n1: Point = { x: -dir.y, y: dir.x };
  const n2: Point = { x: dir.y, y: -dir.x };
  let normal: Point;
  if (side) {
    const want = SIDE_SCREEN[side];
    normal = dot(n1, want) >= dot(n2, want) ? n1 : n2;
  } else {
    // Default: above a horizontal run, to the left of a vertical one.
    normal = n1.y < 0 || (n1.y === 0 && n1.x < 0) ? n1 : n2;
  }
  const mag = Math.abs(offset);
  if (offset < 0) normal = mul(normal, -1);
  const p1 = add(from, mul(normal, mag));
  const p2 = add(to, mul(normal, mag));

  const ext: DimensionGeometry['ext'] = [
    [add(from, mul(normal, extGap)), add(p1, mul(normal, extOver))],
    [add(to, mul(normal, extGap)), add(p2, mul(normal, extOver))],
  ];

  const arrowHalf = arrow * 0.34;
  const mk = (tip: Point, inward: Point): Arrowhead => {
    const base = add(tip, mul(inward, arrow));
    return {
      tip,
      a: add(base, mul(normal, arrowHalf)),
      b: add(base, mul(normal, -arrowHalf)),
    };
  };
  const arrows: [Arrowhead, Arrowhead] = [mk(p1, dir), mk(p2, mul(dir, -1))];

  const bars: DimensionGeometry['bars'] = [
    [add(p1, mul(normal, bar)), add(p1, mul(normal, -bar))],
    [add(p2, mul(normal, bar)), add(p2, mul(normal, -bar))],
  ];

  const labelAt = mid(p1, p2);
  const room = length - 2 * arrow - 2 * labelGap;
  const labelInline = labelWidth > 0 && labelWidth <= room;
  const segments: [Point, Point][] = [];
  if (labelInline) {
    const half = labelWidth / 2 + labelGap;
    segments.push([p1, sub(labelAt, mul(dir, half))], [add(labelAt, mul(dir, half)), p2]);
  } else {
    segments.push([p1, p2]);
  }

  return {
    p1,
    p2,
    normal,
    dir,
    ext,
    segments,
    arrows,
    bars,
    labelAt,
    labelAngle: readableAngle(dir),
    labelInline,
    length,
  };
}

/**
 * Where a label goes when it does not fit inside the line: beside it, pushed along the
 * normal by `gap` px (away from the object).
 */
export function labelBeside(g: DimensionGeometry, gap = 10): Point {
  return add(g.labelAt, mul(g.normal, gap));
}

/** How far from `p` you can travel along the unit vector `n` before leaving the inset box. */
function roomAlong(p: Point, n: Point, box: Box, margin: number): number {
  const limit = (pos: number, d: number, min: number, max: number): number => {
    if (Math.abs(d) < 1e-9) return Number.POSITIVE_INFINITY;
    return d > 0 ? (max - pos) / d : (min - pos) / d;
  };
  const x = limit(p.x, n.x, margin, box.width - margin);
  const y = limit(p.y, n.y, margin, box.height - margin);
  return Math.max(0, Math.min(x, y));
}

/**
 * Pulls a dimension line back inside a box. If the line at the requested offset would leave
 * the box inset by `margin` (room for the label and the extension overshoot), the offset
 * shrinks to the room there is. When that is under `minOffset` and the other side of the
 * measured points has more room, the dimension flips to it. Returns adjusted input.
 */
export function fitDimension(input: DimensionInput, box: Box, margin = 10, minOffset = 12): DimensionInput {
  const raw = input.offset ?? 20;
  const want = Math.abs(raw);
  const sign = raw < 0 ? -1 : 1;
  const normal = mul(dimensionGeometry({ ...input, offset: want }).normal, sign);
  const room = (n: Point): number =>
    Math.min(roomAlong(input.from, n, box, margin), roomAlong(input.to, n, box, margin));
  const ahead = room(normal);
  if (want <= ahead) return input;
  if (ahead >= minOffset) return { ...input, offset: sign * Math.floor(ahead) };
  const behind = room(mul(normal, -1));
  if (behind > ahead) return { ...input, offset: -sign * Math.min(want, Math.floor(behind)) };
  return { ...input, offset: sign * Math.max(4, Math.floor(ahead)) };
}

/** A close estimate of the advance width of `text` in a monospace face (0.6 em per glyph). */
export function monoWidth(text: string, fontSize = 11, tracking = 0): number {
  const n = Array.from(text).length;
  return n * (fontSize * 0.6 + tracking);
}

// ---------------------------------------------------------------------------
// Tick rulers
// ---------------------------------------------------------------------------

export interface Tick {
  index: number;
  /** Distance along the ruler from its origin, px. */
  at: number;
  major: boolean;
}

/**
 * Tick positions for a ruler `length` px long: one every `step` px, every `majorEvery`th one
 * major (the first is major). Nothing for a non-positive step.
 */
export function rulerTicks(length: number, step: number, majorEvery = 5): Tick[] {
  if (!(step > 0) || !(length >= 0)) return [];
  const every = Math.max(1, Math.round(majorEvery));
  const count = Math.floor(length / step + 1e-9);
  const out: Tick[] = [];
  for (let i = 0; i <= count; i++) out.push({ index: i, at: i * step, major: i % every === 0 });
  return out;
}

/**
 * Path data for the ticks of a ruler: one `M ... L ...` per tick, in order, so a dash draw
 * reveals them one after another.
 *
 * `orientation` is the direction of the ruler; ticks stand off the baseline on `side`
 * (`up`/`down` for horizontal rulers, `left`/`right` for vertical ones).
 */
export function tickPath(opts: {
  x: number;
  y: number;
  length: number;
  orientation: 'horizontal' | 'vertical';
  step: number;
  majorEvery?: number;
  minorLength?: number;
  majorLength?: number;
  side?: 'up' | 'down' | 'left' | 'right';
}): string {
  const {
    x,
    y,
    length,
    orientation,
    step,
    majorEvery = 5,
    minorLength = 5,
    majorLength = 9,
    side = orientation === 'horizontal' ? 'down' : 'right',
  } = opts;
  const ticks = rulerTicks(length, step, majorEvery);
  const sign = side === 'up' || side === 'left' ? -1 : 1;
  const parts: string[] = [];
  for (const t of ticks) {
    const len = t.major ? majorLength : minorLength;
    if (orientation === 'horizontal') {
      const px = fmt(crisp(x + t.at));
      parts.push(`M${px} ${fmt(crisp(y))}V${fmt(crisp(y) + sign * len)}`);
    } else {
      const py = fmt(crisp(y + t.at));
      parts.push(`M${fmt(crisp(x))} ${py}H${fmt(crisp(x) + sign * len)}`);
    }
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Crosshairs and reticles
// ---------------------------------------------------------------------------

export interface CrosshairGeometry {
  /** The four arms as path data. */
  arms: string;
  /** Present for a reticle: the ring. */
  ring: { cx: number; cy: number; r: number } | null;
  /** The centre dot of a reticle. */
  dot: { cx: number; cy: number; r: number } | null;
}

/**
 * A "+" of overall `size`, optionally with a `gap` left open at the centre. With `ring`
 * it is a reticle: a ring of radius `size / 2` with the arms crossing it and a centre dot.
 */
export function crosshairGeometry(opts: {
  x: number;
  y: number;
  size?: number;
  gap?: number;
  ring?: boolean;
}): CrosshairGeometry {
  const { x, y, size = 13, gap = 0, ring = false } = opts;
  const cx = crisp(x);
  const cy = crisp(y);
  const half = size / 2;
  if (ring) {
    const r = half;
    const inner = Math.max(0, r - 3);
    const outer = r + 4;
    const arms = [
      `M${fmt(cx)} ${fmt(cy - outer)}V${fmt(cy - inner)}`,
      `M${fmt(cx)} ${fmt(cy + inner)}V${fmt(cy + outer)}`,
      `M${fmt(cx - outer)} ${fmt(cy)}H${fmt(cx - inner)}`,
      `M${fmt(cx + inner)} ${fmt(cy)}H${fmt(cx + outer)}`,
    ].join('');
    return { arms, ring: { cx, cy, r }, dot: { cx, cy, r: 1.25 } };
  }
  const g = Math.min(gap, half);
  const arms = [
    `M${fmt(cx)} ${fmt(cy - half)}V${fmt(cy - g)}`,
    `M${fmt(cx)} ${fmt(cy + g)}V${fmt(cy + half)}`,
    `M${fmt(cx - half)} ${fmt(cy)}H${fmt(cx - g)}`,
    `M${fmt(cx + g)} ${fmt(cy)}H${fmt(cx + half)}`,
  ].join('');
  return { arms, ring: null, dot: null };
}

// ---------------------------------------------------------------------------
// Fractions
// ---------------------------------------------------------------------------

/** A fractional coordinate (0..1 of the box) to pixels. */
export function toPx(at: readonly [number, number], box: Box): Point {
  return { x: at[0] * box.width, y: at[1] * box.height };
}

/** Pixels in the box to a clamped fraction. */
export function toFraction(p: Point, box: Box): [number, number] {
  const fx = box.width > 0 ? p.x / box.width : 0;
  const fy = box.height > 0 ? p.y / box.height : 0;
  return [Math.min(1, Math.max(0, fx)), Math.min(1, Math.max(0, fy))];
}

/** Which compass side to prefer for an anchor, so its leader points toward open space. */
export function defaultSide(at: readonly [number, number]): Side8 {
  const [fx, fy] = at;
  const h = fx < 0.5 ? 'l' : 'r';
  const v = fy < 0.5 ? 't' : 'b';
  return `${v}${h}` as Side8;
}
