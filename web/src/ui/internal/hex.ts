/**
 * Hexagon geometry. All shapes are pointy-top (a vertex at 12 o'clock), the angle of the
 * Flux symbol's own shards. Pure functions; no DOM.
 */

export type Point = readonly [number, number];

const SQRT3 = Math.sqrt(3);

const round = (n: number): number => Math.round(n * 1000) / 1000;

/** The six vertices of a pointy-top hexagon of circumradius `r`, clockwise from the top. */
export function hexPoints(cx: number, cy: number, r: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    pts.push([round(cx + r * Math.cos(a)), round(cy + r * Math.sin(a))]);
  }
  return pts;
}

/** A closed SVG path for the hexagon outline. */
export function hexPath(cx: number, cy: number, r: number): string {
  return `${hexPoints(cx, cy, r)
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`)
    .join('')}Z`;
}

/** Width of a pointy-top hexagon of circumradius r. */
export function hexWidth(r: number): number {
  return SQRT3 * r;
}

/**
 * A point on the hexagon's perimeter. `t` in [0, 1) walks clockwise from the top vertex.
 * The perimeter is six equal edges, so every vertex sits at a multiple of 1/6.
 */
export function hexPerimeterPoint(cx: number, cy: number, r: number, t: number): Point {
  const pts = hexPoints(cx, cy, r);
  const u = (((t % 1) + 1) % 1) * 6;
  const i = Math.floor(u);
  const f = u - i;
  const a = pts[i % 6] as Point;
  const b = pts[(i + 1) % 6] as Point;
  return [round(a[0] + (b[0] - a[0]) * f), round(a[1] + (b[1] - a[1]) * f)];
}

/** An open path along the perimeter from t0 to t1 (both in [0, 1], t0 < t1). */
export function hexArcPath(cx: number, cy: number, r: number, t0: number, t1: number): string {
  const pts = hexPoints(cx, cy, r);
  const out: Point[] = [hexPerimeterPoint(cx, cy, r, t0)];
  const first = Math.floor(t0 * 6) + 1;
  const last = Math.ceil(t1 * 6) - 1;
  for (let i = first; i <= last; i++) {
    if (i / 6 > t0 && i / 6 < t1) out.push(pts[i % 6] as Point);
  }
  out.push(hexPerimeterPoint(cx, cy, r, t1));
  return out.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join('');
}

/**
 * `count` equal arcs around the hexagon with a small gap (fraction of the perimeter) between
 * them: the segments of a hex gauge. Arc i covers [i/count + gap/2, (i+1)/count - gap/2].
 */
export function hexSegments(cx: number, cy: number, r: number, count: number, gap = 0.012): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(hexArcPath(cx, cy, r, i / count + gap / 2, (i + 1) / count - gap / 2));
  }
  return out;
}
