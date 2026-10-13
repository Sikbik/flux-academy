/**
 * Pure geometry for the diagram kit. Everything is in CSS pixels: a diagram's viewBox equals the width
 * it is drawn at, so hairlines are one real pixel and text is always its nominal size.
 *
 * No React, no DOM, no dependencies: unit tested in geometry.test.ts.
 */

export interface Pt {
  x: number;
  y: number;
}

export const pt = (x: number, y: number): Pt => ({ x, y });

/** Two decimals, as a number. Keeps path data short and stable for snapshots. */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/** `M x y L x y ...` for a list of points. */
export function polyD(pts: readonly Pt[], close = false): string {
  if (pts.length === 0) return '';
  const body = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${r2(p.x)} ${r2(p.y)}`).join('');
  return close ? `${body}Z` : body;
}

// ---------------------------------------------------------------------------
// Hexagons (pointy-top, the Flux symbol's own angle) and iso plates
// ---------------------------------------------------------------------------

/** The six vertices of a pointy-top hexagon of circumradius `r`, clockwise from the top. */
export function hexPts(cx: number, cy: number, r: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

export function hexD(cx: number, cy: number, r: number): string {
  return polyD(hexPts(cx, cy, r), true);
}

/** Width of a pointy-top hexagon of circumradius r. */
export const hexWidth = (r: number): number => Math.sqrt(3) * r;

/**
 * The top face of an iso plate: a flat-top hexagon squashed to height `h` (the plates inside the
 * specimen). Vertices clockwise from the left point: L, TL, TR, R, BR, BL.
 */
export function platePts(cx: number, cy: number, w: number, h: number): Pt[] {
  return [
    { x: cx - w / 2, y: cy },
    { x: cx - w / 4, y: cy - h / 2 },
    { x: cx + w / 4, y: cy - h / 2 },
    { x: cx + w / 2, y: cy },
    { x: cx + w / 4, y: cy + h / 2 },
    { x: cx - w / 4, y: cy + h / 2 },
  ];
}

export interface PlatePaths {
  /** Top face outline (closed). */
  top: string;
  /** The three visible side faces, as closed shapes (left, front, right). */
  left: string;
  front: string;
  right: string;
  /** The visible lower edge and the vertical edges: one open compound path for the stroke. */
  edges: string;
  /** Centre of the top face. */
  c: Pt;
}

/** A plate with thickness `t` seen from above and in front. */
export function plateD(cx: number, cy: number, w: number, h: number, t: number): PlatePaths {
  const [L, , , R, BR, BL] = platePts(cx, cy, w, h) as [Pt, Pt, Pt, Pt, Pt, Pt];
  const dn = (p: Pt): Pt => ({ x: p.x, y: p.y + t });
  const top = polyD(platePts(cx, cy, w, h), true);
  const left = polyD([L, BL, dn(BL), dn(L)], true);
  const front = polyD([BL, BR, dn(BR), dn(BL)], true);
  const right = polyD([BR, R, dn(R), dn(BR)], true);
  const edges =
    `${polyD([dn(L), dn(BL), dn(BR), dn(R)])}` +
    `M${r2(L.x)} ${r2(L.y)}L${r2(L.x)} ${r2(L.y + t)}` +
    `M${r2(BL.x)} ${r2(BL.y)}L${r2(BL.x)} ${r2(BL.y + t)}` +
    `M${r2(BR.x)} ${r2(BR.y)}L${r2(BR.x)} ${r2(BR.y + t)}` +
    `M${r2(R.x)} ${r2(R.y)}L${r2(R.x)} ${r2(R.y + t)}`;
  return { top, left, front, right, edges, c: { x: cx, y: cy } };
}

// ---------------------------------------------------------------------------
// Chamfered boxes
// ---------------------------------------------------------------------------

export type CutStyle = 'tr-bl' | 'tl-br' | 'all' | 'tr' | 'none';

/**
 * The family silhouette: two big diagonal cuts (top right and bottom left by default) and a micro bevel
 * on the other two corners, so a slab never has a hard 90 degree corner.
 */
export function chamferD(
  x: number,
  y: number,
  w: number,
  h: number,
  c = 10,
  cm = 3,
  cut: CutStyle = 'tr-bl',
): string {
  const big = Math.min(c, w / 2, h / 2);
  const small = Math.min(cm, w / 2, h / 2);
  const tl = cut === 'tl-br' || cut === 'all' ? big : small;
  const tr = cut === 'tr-bl' || cut === 'all' || cut === 'tr' ? big : small;
  const br = cut === 'tl-br' || cut === 'all' ? big : small;
  const bl = cut === 'tr-bl' || cut === 'all' ? big : small;
  const pts: Pt[] = [
    { x, y: y + tl },
    { x: x + tl, y },
    { x: x + w - tr, y },
    { x: x + w, y: y + tr },
    { x: x + w, y: y + h - br },
    { x: x + w - br, y: y + h },
    { x: x + bl, y: y + h },
    { x, y: y + h - bl },
  ];
  return polyD(pts, true);
}

// ---------------------------------------------------------------------------
// Annotation geometry
// ---------------------------------------------------------------------------

export interface Leader {
  /** Path from the anchor on the object to the edge of the marker circle. */
  d: string;
  /** The elbow (equal to the anchor for a straight leader). */
  elbow: Pt;
  /** Where the leader meets the circle. */
  end: Pt;
}

/**
 * A callout leader as in the blueprint reference: from an anchor on the object a 45 degree diagonal until
 * it is level with the marker, then a horizontal run into the circle. When there is no room for the
 * diagonal the leader is a single straight segment.
 */
export function leader(from: Pt, center: Pt, radius: number): Leader {
  const sx = from.x <= center.x ? 1 : -1;
  const end: Pt = { x: center.x - sx * radius, y: center.y };
  const dy = Math.abs(center.y - from.y);
  const elbow: Pt = { x: from.x + sx * dy, y: center.y };
  const room = (end.x - elbow.x) * sx;
  if (dy === 0 || room < 0) {
    return { d: polyD([from, end]), elbow: from, end };
  }
  return { d: polyD([from, elbow, end]), elbow, end };
}

/** An arrow head (open chevron) at `tip`, pointing along `angle` (radians), `size` long. */
export function arrowHeadD(tip: Pt, angle: number, size = 6, spread = Math.PI / 6): string {
  const a = angle + Math.PI;
  const p1 = { x: tip.x + size * Math.cos(a - spread), y: tip.y + size * Math.sin(a - spread) };
  const p2 = { x: tip.x + size * Math.cos(a + spread), y: tip.y + size * Math.sin(a + spread) };
  return `${polyD([p1, tip, p2])}`;
}

/** Direction of the final segment of a polyline, radians. */
export function endAngle(pts: readonly Pt[]): number {
  const n = pts.length;
  const a = pts[n - 2];
  const b = pts[n - 1];
  if (!a || !b) return 0;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function polyLength(pts: readonly Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/** The point at distance `s` along a polyline (clamped). */
export function pointAt(pts: readonly Pt[], s: number): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  let left = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= seg || i === pts.length - 1) {
      return lerpPt(a, b, seg === 0 ? 0 : Math.min(1, left / seg));
    }
    left -= seg;
  }
  return pts[pts.length - 1] as Pt;
}

/** `+` crosshair centred at (x, y) with arm length `s`. */
export function crossD(x: number, y: number, s = 4): string {
  return `M${r2(x - s)} ${r2(y)}H${r2(x + s)}M${r2(x)} ${r2(y - s)}V${r2(y + s)}`;
}

export interface RulerOptions {
  /** Tick spacing in px along the line. */
  step: number;
  /** Every n-th tick is long. */
  major?: number;
  /** Short tick length in px. */
  len?: number;
  /** Which side of the line the ticks sit on: 1 or -1 along the normal. */
  side?: 1 | -1;
}

/** A tick ruler along `a`..`b`: the base line plus perpendicular ticks, as one compound path. */
export function rulerD(a: Pt, b: Pt, o: RulerOptions): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len === 0) return '';
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const nx = -uy * (o.side ?? 1);
  const ny = ux * (o.side ?? 1);
  const short = o.len ?? 4;
  const major = o.major ?? 5;
  let d = `M${r2(a.x)} ${r2(a.y)}L${r2(b.x)} ${r2(b.y)}`;
  const n = Math.floor(len / o.step);
  for (let i = 0; i <= n; i++) {
    const s = i * o.step;
    const tl = i % major === 0 ? short * 2 : short;
    const px = a.x + ux * s;
    const py = a.y + uy * s;
    d += `M${r2(px)} ${r2(py)}L${r2(px + nx * tl)} ${r2(py + ny * tl)}`;
  }
  return d;
}

export interface DimLine {
  /** The whole dimension: extension lines, the dimension line and the end ticks. */
  d: string;
  /** Where a label should be centred (just off the dimension line). */
  label: Pt;
  /** Angle of the dimension line, radians. */
  angle: number;
}

/**
 * A dimension line between two points on an object, offset from it by `offset` px along the normal
 * (positive is to the left of the direction a to b), with extension lines and perpendicular end ticks.
 */
export function dimD(a: Pt, b: Pt, offset: number, tick = 4): DimLine {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const nx = uy;
  const ny = -ux;
  const a2 = { x: a.x + nx * offset, y: a.y + ny * offset };
  const b2 = { x: b.x + nx * offset, y: b.y + ny * offset };
  const over = offset >= 0 ? 3 : -3;
  const ext = (p: Pt, q: Pt): string =>
    `M${r2(p.x + nx * Math.sign(over) * 2)} ${r2(p.y + ny * Math.sign(over) * 2)}L${r2(q.x + nx * over)} ${r2(q.y + ny * over)}`;
  const d =
    ext(a, a2) +
    ext(b, b2) +
    `M${r2(a2.x)} ${r2(a2.y)}L${r2(b2.x)} ${r2(b2.y)}` +
    `M${r2(a2.x - nx * tick)} ${r2(a2.y - ny * tick)}L${r2(a2.x + nx * tick)} ${r2(a2.y + ny * tick)}` +
    `M${r2(b2.x - nx * tick)} ${r2(b2.y - ny * tick)}L${r2(b2.x + nx * tick)} ${r2(b2.y + ny * tick)}`;
  const mid = lerpPt(a2, b2, 0.5);
  const side = offset >= 0 ? 1 : -1;
  return {
    d,
    label: { x: mid.x + nx * 8 * side, y: mid.y + ny * 8 * side },
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

// ---------------------------------------------------------------------------
// Text metrics (IBM Plex Mono has a fixed 0.6 em advance)
// ---------------------------------------------------------------------------

export const MONO_ADVANCE = 0.6;

/** Width in px of `text` in the mono face at `size` px with `tracking` em of letter spacing. */
export function monoWidth(text: string, size: number, tracking = 0): number {
  const n = [...text].length;
  if (n === 0) return 0;
  return n * size * MONO_ADVANCE + (n - 1) * tracking * size;
}

/** Greedy word wrap for mono text. Words longer than the line are kept whole. */
export function wrapMono(text: string, maxWidth: number, size: number, tracking = 0): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && monoWidth(next, size, tracking) > maxWidth) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Wrap to at most `maxLines` lines. Text that does not fit ends in "..." instead of silently vanishing, so
 * a layout that is too tight shows it (and the tests catch it).
 */
export function wrapClamp(
  text: string,
  maxWidth: number,
  size: number,
  maxLines: number,
  tracking = 0,
): string[] {
  const lines = wrapMono(text, maxWidth, size, tracking);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, Math.max(1, maxLines));
  let last = kept[kept.length - 1] ?? '';
  while (last.length > 0 && monoWidth(`${last}...`, size, tracking) > maxWidth) {
    last = last.slice(0, -1).trimEnd();
  }
  kept[kept.length - 1] = `${last}...`;
  return kept;
}

/** Group digits: 88000 -> "88,000". */
export function group(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  return (n < 0 ? '-' : '') + s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
