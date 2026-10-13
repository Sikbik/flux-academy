/**
 * Pure scale and layout maths for the instruments: how full is it, how do the cells of a
 * segmented rail fill, what does it say. No DOM, unit tested in node.
 */

/** Where `value` sits between `min` and `max`, clamped to 0..1. Never NaN. */
export function fraction(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0;
  const f = (value - min) / (max - min);
  return f < 0 ? 0 : f > 1 ? 1 : f;
}

/** "58%" for a 0..1 fraction. */
export function percentText(f: number): string {
  return `${Math.round(Math.min(1, Math.max(0, f)) * 100)}%`;
}

/**
 * How full each of `count` equal cells is for an overall fraction `f`: full cells, one
 * partial cell, then empty ones. `[1, 1, 0.2, 0]` for `f = 0.55` over 4.
 */
export function segmentFills(f: number, count: number): number[] {
  const n = Math.max(0, Math.floor(count));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = (f - i / n) * n;
    out.push(v <= 0 ? 0 : v >= 1 ? 1 : Math.round(v * 1000) / 1000);
  }
  return out;
}

/** "3 of 8". */
export function doneOfTotal(done: number, total: number): string {
  return `${Math.max(0, Math.round(done))} of ${Math.max(0, Math.round(total))}`;
}

/** The length of the white-hot head on a hex or ring, as a fraction of the perimeter. */
export const HEAD_LENGTH = 0.035;

/**
 * Dash offset (for `pathLength=1` and a dash array of `[HEAD_LENGTH, 1]`) that parks the head
 * so it ends exactly at fraction `f`. Negative offsets shift the dash forward along the path.
 */
export function headOffset(f: number): number {
  const start = Math.max(0, Math.min(1, f) - HEAD_LENGTH);
  return -start;
}
