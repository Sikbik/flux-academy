import { describe, expect, it } from 'vitest';
import { buildSampleBench } from '@/diorama/model';
import { createSim } from '@/diorama/sim';
import { evaluateSeed, heroSeed, pickSeed, SAMPLE_HERO_SEED, scoreSpread } from './spread';

const BENCH = buildSampleBench(1, { resolution: 'low' });

describe('spread score', () => {
  it('prefers three tiers on three continents across the bench', () => {
    const byTier = (t: number, side: 'left' | 'right' | 'mid') => {
      const e = BENCH.extent;
      const cx = (e.minX + e.maxX) / 2;
      const half = (e.maxX - e.minX) / 2;
      const want = side === 'left' ? -0.5 : side === 'right' ? 0.5 : 0;
      return BENCH.nodes
        .filter((n) => n.tierIndex === t)
        .sort((a, b) => Math.abs((a.x - cx) / half - want) - Math.abs((b.x - cx) / half - want))[0];
    };
    const good = [byTier(0, 'left'), byTier(1, 'mid'), byTier(2, 'right')].map((n) => n?.index ?? 0);
    const t0 = BENCH.nodes.filter((n) => n.tierIndex === 0).map((n) => n.index);
    const bad = [t0[0] ?? 0, t0[1] ?? 0, t0[2] ?? 0];
    expect(scoreSpread(BENCH, good).total).toBeGreaterThan(scoreSpread(BENCH, bad).total);
  });
});

describe('seed search', () => {
  it('is deterministic and no worse than the first seed', () => {
    const a = pickSeed(BENCH, 3, 24);
    const b = pickSeed(BENCH, 3, 24);
    expect(a.seed).toBe(b.seed);
    expect(a.nodes).toEqual(b.nodes);
    const first = pickSeed(BENCH, 3, 1);
    expect(a.score.total).toBeGreaterThanOrEqual(first.score.total);
  });

  it('reproduces the same placement in a sim built with that seed', () => {
    const r = pickSeed(BENCH, 3, 24);
    const sim = createSim({ bench: BENCH, seed: r.seed, place: { waitedMin: 120, spread: 'random' } });
    sim.setInstances(3);
    expect(sim.state().instances.map((i) => i.node)).toEqual(r.nodes);
    // Growing the count later keeps the first three where they were.
    sim.setInstances(5);
    expect(
      sim
        .state()
        .instances.slice(0, 3)
        .map((i) => i.node),
    ).toEqual(r.nodes);
  });

  it('finds a placement across several continents within 48 seeds', () => {
    const r = pickSeed(BENCH, 3, 48);
    expect(r.score.regions).toBeGreaterThanOrEqual(2);
    expect(r.score.span).toBeGreaterThan(0.4);
  });
});

describe('pinned hero seed', () => {
  it('reads well on the sample bench: three tiers, three continents, none under the cell', () => {
    const r = evaluateSeed(BENCH, SAMPLE_HERO_SEED, 3);
    expect(r.score.tiers).toBe(3);
    expect(r.score.regions).toBe(3);
    expect(r.score.total).toBeGreaterThan(20);
    expect(heroSeed(BENCH, 3)).toBe(SAMPLE_HERO_SEED);
  });

  it('is within reach of the best of 400 seeds (so a stale pin is noticed)', () => {
    const best = pickSeed(BENCH, 3, 400);
    const pinned = evaluateSeed(BENCH, SAMPLE_HERO_SEED, 3);
    expect(pinned.score.total).toBeGreaterThanOrEqual(best.score.total - 0.5);
  });

  it('falls back to a search for a bench it was not tuned on', () => {
    const other = buildSampleBench(5, { resolution: 'default' });
    const seed = heroSeed(other, 3);
    expect(seed).toBeGreaterThanOrEqual(1);
    expect(evaluateSeed(other, seed, 3).nodes).toHaveLength(3);
  });
});
