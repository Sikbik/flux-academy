/** Small, pure numeric helpers shared by the primitives. */

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Inverse of lerp: where `v` sits between `a` and `b` (not clamped). */
export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

/** Frame-rate independent exponential approach: `lambda` is the stiffness per second. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Rounds to a multiple of `step` anchored at `min`, trimming float noise. */
export function snap(v: number, step: number, min = 0): number {
  if (!(step > 0)) return v;
  const n = Math.round((v - min) / step);
  const decimals = decimalsOf(step);
  return Number((min + n * step).toFixed(decimals));
}

/** Number of decimal places needed to print `n` exactly (up to 8). */
export function decimalsOf(n: number): number {
  if (!Number.isFinite(n)) return 0;
  let d = 0;
  let x = Math.abs(n);
  while (d < 8 && Math.abs(Math.round(x) - x) > 1e-9) {
    x *= 10;
    d++;
  }
  return d;
}

export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}
