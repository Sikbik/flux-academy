// Choosing the hero's seed. The simulation places an instance on a random eligible node, so some seeds
// put three copies in one corner and some put them on three continents, one of each tier, left, middle
// and right. The hero does not fake anything: it runs the real simulation with a seed that reads well.
// The search is deterministic (the same bench always yields the same seed) and cheap.

import type { Bench } from '@/diorama/model';
import { createSim } from '@/diorama/sim';

export interface SpreadScore {
  total: number;
  tiers: number;
  regions: number;
  span: number;
  sides: number;
}

/** How good a set of node indices looks as a hero placement. Higher is better. */
export function scoreSpread(bench: Bench, nodes: readonly number[]): SpreadScore {
  const tiers = new Set<number>();
  const regions = new Set<string>();
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let left = 0;
  let right = 0;
  let edge = 0;
  let under = 0;
  const us: number[] = [];
  const e = bench.extent;
  const cx = (e.minX + e.maxX) / 2;
  const half = (e.maxX - e.minX) / 2;
  for (const i of nodes) {
    const n = bench.nodes[i];
    if (!n) continue;
    tiers.add(n.tierIndex);
    regions.add(n.region);
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    const u = (n.x - cx) / half;
    us.push(u);
    if (u < -0.22) left++;
    if (u > 0.22) right++;
    if (Math.abs(u) > 0.78) edge++;
    // The cell floats over the middle of the bench: a copy there would hide behind it.
    if (Math.abs(u) < 0.16) under++;
  }
  // The arcs should fan out: reward the smallest horizontal gap between neighbouring copies.
  us.sort((a, b) => a - b);
  let gap = us.length > 1 ? Number.POSITIVE_INFINITY : 0;
  for (let i = 1; i < us.length; i++) gap = Math.min(gap, (us[i] ?? 0) - (us[i - 1] ?? 0));
  const want = Math.min(3, nodes.length);
  const span = nodes.length > 1 ? Math.min(1, (maxX - minX) / (half * 1.3)) : 0;
  const sides = Math.min(1, left) + Math.min(1, right);
  const score =
    3 * Math.min(want, tiers.size) +
    2 * Math.min(want, regions.size) +
    3 * span +
    1.5 * sides +
    4 * Math.min(1, gap / 0.5) -
    2 * edge -
    8 * under;
  return { total: score, tiers: tiers.size, regions: regions.size, span, sides };
}

export interface SeedSearch {
  seed: number;
  score: SpreadScore;
  nodes: number[];
}

/** Runs the real simulation with one seed and scores where it puts `count` instances. */
export function evaluateSeed(bench: Bench, seed: number, count = 3): SeedSearch {
  const sim = createSim({ bench, seed, place: { waitedMin: 120, spread: 'random' } });
  sim.setInstances(count);
  const nodes = sim
    .state()
    .instances.filter((i) => i.node >= 0)
    .map((i) => i.node);
  return { seed, score: scoreSpread(bench, nodes), nodes };
}

/** The best of `tries` consecutive seeds starting at `from` for placing `count` instances. */
export function pickSeed(bench: Bench, count = 3, tries = 48, from = 1): SeedSearch {
  let best: SeedSearch | null = null;
  for (let s = from; s < from + tries; s++) {
    const r = evaluateSeed(bench, s, count);
    if (r.nodes.length < Math.min(count, 1)) continue;
    if (!best || r.score.total > best.score.total) best = r;
  }
  return best ?? { seed: from, score: { total: 0, tiers: 0, regions: 0, span: 0, sides: 0 }, nodes: [] };
}

/**
 * The seed the hero uses on the sample bench at its coarsest density: the best of seeds 1 to 400 (three
 * tiers on three continents, one left, one right, one between, none under the cell), found offline and
 * pinned by a test. Searching 400 seeds at startup would cost a few hundred milliseconds for nothing.
 */
export const SAMPLE_HERO_SEED = 255;
/** Below this score a pinned seed is considered stale (the model changed) and the search runs instead. */
const PINNED_MIN_SCORE = 18;

/** The hero's seed for a bench: the pinned one when it still reads well, else a short search. */
export function heroSeed(bench: Bench, count = 3): number {
  if (bench.kind === 'sample') {
    const r = evaluateSeed(bench, SAMPLE_HERO_SEED, count);
    if (r.score.total >= PINNED_MIN_SCORE) return SAMPLE_HERO_SEED;
  }
  return pickSeed(bench, count, 64).seed;
}
