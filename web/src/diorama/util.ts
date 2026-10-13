/**
 * Small, dependency-free helpers for the diorama core (model, sim and renderer): a seeded RNG, string
 * hashing and the handful of numeric helpers the maths needs. Kept local on purpose so that the
 * simulation's determinism never depends on a module somebody else may tune.
 *
 * `mulberry32` and the FNV-1a hash are adapted from fluxcommunity/web/src/lib/rng.ts (same owner, MIT).
 */

export type Rng = () => number;

/** Mulberry32: a tiny, fast, well distributed 32 bit generator. Returns numbers in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 32 bit hash of a string (FNV-1a). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A stable 32 bit hash of up to four integers (for per-cell noise and per-slot streams). */
export function hashInts(a: number, b = 0, c = 0, d = 0): number {
  let h = 0x811c9dc5;
  for (const v of [a, b, c, d]) {
    h ^= v | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
  }
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Deterministic value in [0, 1) for an integer lattice point. */
export function hash01(a: number, b = 0, c = 0): number {
  return hashInts(a, b, c) / 4294967296;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/** Index drawn from `weights` (non-negative). Returns -1 when every weight is zero. */
export function pickWeighted(weights: ArrayLike<number>, rng: Rng): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i] as number;
  if (!(total > 0)) return -1;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] as number;
    if (r < 0) return i;
  }
  // Floating point slack: the last positive weight.
  for (let i = weights.length - 1; i >= 0; i--) if ((weights[i] as number) > 0) return i;
  return -1;
}

export function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = items[i] as T;
    items[i] = items[j] as T;
    items[j] = t;
  }
  return items;
}

export const DEG = Math.PI / 180;

/** Great-circle distance in kilometres (haversine). */
export function greatCircleKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const p1 = latA * DEG;
  const p2 = latB * DEG;
  const dp = p2 - p1;
  const dl = (lonB - lonA) * DEG;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}
