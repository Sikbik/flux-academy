/**
 * Scale, path and summary logic for the Sparkline. Pure: no DOM, unit tested in node. Points
 * live in a 0..width by 0..height box (default 100 by 100) that the SVG stretches to its
 * container; the marker and the cursor are positioned in percent of the same box.
 */

export type SparkValue = number | null | undefined;

export interface SparkOptions {
  /** Fixed lower and upper bound of the y scale. Default: the data, padded. */
  min?: number;
  max?: number;
  /** A reference line (the 30 s block target). It is part of the default domain. */
  target?: number;
  width?: number;
  height?: number;
  /** Padding of the default domain as a fraction of its span. Default 0.12. */
  pad?: number;
}

export interface SparkPoint {
  x: number;
  y: number;
}

export interface SparkGeometry {
  count: number;
  /** One per input value; null where the value is missing (a gap in the line). */
  points: (SparkPoint | null)[];
  line: string;
  area: string;
  lo: number;
  hi: number;
  targetY: number | null;
  /** x distance between neighbouring values. */
  step: number;
  /** Index of the last value that is a number, or -1. */
  last: number;
}

const isNum = (v: SparkValue): v is number => typeof v === 'number' && Number.isFinite(v);
const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Geometry for a series, or null when it holds no numbers at all. */
export function sparkGeometry(values: readonly SparkValue[], opts: SparkOptions = {}): SparkGeometry | null {
  const W = opts.width ?? 100;
  const H = opts.height ?? 100;
  const nums = values.filter(isNum);
  if (nums.length === 0) return null;

  const withTarget = opts.target != null && Number.isFinite(opts.target) ? [opts.target] : [];
  let lo = opts.min ?? Math.min(...nums, ...withTarget);
  let hi = opts.max ?? Math.max(...nums, ...withTarget);
  if (opts.min === undefined || opts.max === undefined) {
    const span = hi - lo;
    const pad = (span || Math.abs(hi) || 1) * (opts.pad ?? 0.12);
    if (opts.min === undefined) lo -= pad;
    if (opts.max === undefined) hi += pad;
  }
  if (!(hi > lo)) hi = lo + 1;

  const n = values.length;
  const xs = (i: number): number => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const ys = (v: number): number => {
    const y = H - ((v - lo) / (hi - lo)) * H;
    return y < 0 ? 0 : y > H ? H : y;
  };

  const points: (SparkPoint | null)[] = values.map((v, i) =>
    isNum(v) ? { x: r2(xs(i)), y: r2(ys(v)) } : null,
  );

  // Contiguous runs: a missing value breaks the line.
  const runs: SparkPoint[][] = [];
  let run: SparkPoint[] = [];
  for (const p of points) {
    if (p) run.push(p);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);

  const line = runs
    .map((r) => {
      const first = r[0] as SparkPoint;
      if (r.length === 1) return `M${first.x} ${first.y}h0.01`;
      return r.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('');
    })
    .join('');

  const area = runs
    .filter((r) => r.length > 1)
    .map((r) => {
      const first = r[0] as SparkPoint;
      const last = r[r.length - 1] as SparkPoint;
      return `${r.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join('')}L${last.x} ${H}L${first.x} ${H}Z`;
    })
    .join('');

  let lastIdx = -1;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i]) {
      lastIdx = i;
      break;
    }
  }

  return {
    count: n,
    points,
    line,
    area,
    lo,
    hi,
    targetY: opts.target != null && Number.isFinite(opts.target) ? r2(ys(opts.target)) : null,
    step: n > 1 ? W / (n - 1) : 0,
    last: lastIdx,
  };
}

/** The value index under a horizontal fraction (0..1) of the plot. */
export function indexAt(fraction: number, count: number): number {
  if (count <= 1) return 0;
  const f = fraction < 0 ? 0 : fraction > 1 ? 1 : fraction;
  return Math.round(f * (count - 1));
}

/** The nearest index at or beside `from` that holds a number, searching in `dir` first. */
export function nearestPoint(points: readonly (SparkPoint | null)[], from: number, dir: 1 | -1 = 1): number {
  const n = points.length;
  for (let d = 0; d < n; d++) {
    const a = from + d * dir;
    if (a >= 0 && a < n && points[a]) return a;
    const b = from - d * dir;
    if (b >= 0 && b < n && points[b]) return b;
  }
  return -1;
}

/** Moves a keyboard cursor by `delta` steps over present values only, clamped to the ends. */
export function stepCursor(points: readonly (SparkPoint | null)[], from: number, delta: number): number {
  let i = from;
  const dir: 1 | -1 = delta >= 0 ? 1 : -1;
  let left = Math.abs(delta);
  while (left > 0) {
    let j = i + dir;
    while (j >= 0 && j < points.length && !points[j]) j += dir;
    if (j < 0 || j >= points.length) break;
    i = j;
    left--;
  }
  return i;
}

/** "Block interval: latest 29.4, low 24, high 33, 20 points" for assistive tech. */
export function summarize(
  label: string,
  values: readonly SparkValue[],
  format: (n: number) => string,
): string {
  const nums = values.filter(isNum);
  if (nums.length === 0) return `${label}: no data yet`;
  const latest = nums[nums.length - 1] as number;
  const noun = nums.length === 1 ? 'point' : 'points';
  return `${label}: latest ${format(latest)}, low ${format(Math.min(...nums))}, high ${format(Math.max(...nums))}, ${nums.length} ${noun}`;
}

/**
 * Whether `next` is `prev` with one more value on the end (`grow`) or a rolling window that
 * dropped the first value and added one (`roll`): the two cases that slide in.
 */
export function detectAppend(
  prev: readonly SparkValue[],
  next: readonly SparkValue[],
): 'grow' | 'roll' | null {
  if (prev.length === 0 || next.length === 0) return null;
  const same = (a: readonly SparkValue[], b: readonly SparkValue[]): boolean =>
    a.length === b.length && a.every((v, i) => v === b[i]);
  if (next.length === prev.length + 1 && same(next.slice(0, -1), prev)) return 'grow';
  if (next.length === prev.length && prev.length > 1 && same(next.slice(0, -1), prev.slice(1))) return 'roll';
  return null;
}
