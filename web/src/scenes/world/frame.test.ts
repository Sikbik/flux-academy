import { describe, expect, it } from 'vitest';
import { buildSampleBench } from '@/diorama/model';
import { buildWorld, CHAIN_BLOCKS, cellPosition } from './build';
import { castOnCells, frameFor, HEIGHT_K, pillarSpecs, WORLD_WIDTH, worldX, worldZ } from './frame';

const BENCH = buildSampleBench(1, { resolution: 'low' });

describe('frame', () => {
  it('scales the bench to the scene width and centres it on the origin', () => {
    const f = frameFor(BENCH);
    expect(f.halfW * 2).toBeCloseTo(WORLD_WIDTH, 6);
    const e = BENCH.extent;
    expect(worldX(f, e.minX)).toBeCloseTo(-f.halfW, 6);
    expect(worldX(f, e.maxX)).toBeCloseTo(f.halfW, 6);
    expect(worldZ(f, e.minY)).toBeCloseTo(-f.halfD, 6);
    expect(f.cell).toBeCloseTo(f.scale, 9);
  });

  it('puts every pillar on the land it stands on, with a height set by its tier', () => {
    const f = frameFor(BENCH);
    const p = pillarSpecs(BENCH, f);
    expect(p.count).toBe(BENCH.nodes.length);
    BENCH.nodes.forEach((n, i) => {
      expect(p.x[i]).toBeCloseTo(worldX(f, n.x), 4);
      expect(p.z[i]).toBeCloseTo(worldZ(f, n.y), 4);
      expect(p.height[i]).toBeCloseTo(n.height * f.scale * HEIGHT_K, 4);
      expect(p.radius[i]).toBeGreaterThan(0.9 * f.scale - 1e-6);
      expect(p.radius[i]).toBeLessThan(1.5 * f.scale + 1e-6);
    });
    const mean = (t: number) => {
      const xs = BENCH.nodes.filter((n) => n.tierIndex === t).map((n) => p.height[n.index] ?? 0);
      return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    };
    expect(mean(0)).toBeLessThan(mean(1));
    expect(mean(1)).toBeLessThan(mean(2));
  });

  it('hides the cells under pillars and tints their neighbours with the tier colour', () => {
    const f = frameFor(BENCH);
    const p = pillarSpecs(BENCH, f);
    const c = castOnCells(BENCH, f, p);
    for (const n of BENCH.nodes) expect(c.hidden[n.cell]).toBe(1);
    const hidden = c.hidden.reduce((a, b) => a + b, 0);
    expect(hidden).toBeGreaterThanOrEqual(BENCH.nodes.length);
    expect(hidden).toBeLessThan(BENCH.cells.count * 0.5);
    let tinted = 0;
    for (let i = 0; i < BENCH.cells.count; i++) {
      const s = (c.tint[i * 3] ?? 0) + (c.tint[i * 3 + 1] ?? 0) + (c.tint[i * 3 + 2] ?? 0);
      if (s > 0.05) tinted++;
      expect(c.tint[i * 3]).toBeLessThanOrEqual(1);
    }
    expect(tinted).toBeGreaterThan(BENCH.nodes.length);
  });
});

describe('world', () => {
  it('lays out a beacon per visitor spot, the cell above the bench and a strip beside it', () => {
    const w = buildWorld(BENCH);
    expect(w.beacons.count).toBe(BENCH.users.length);
    expect(w.cell.y).toBeGreaterThan(10);
    expect(Math.abs(w.cell.x)).toBeLessThan(w.frame.halfW * 0.2);
    expect(w.chain.blocks).toBe(CHAIN_BLOCKS);
    expect(w.chain.x).toBeGreaterThan(w.frame.halfW);
    expect(w.benchFrame.stripTail.z).toBeLessThan(w.benchFrame.stripHead.z);
    expect(w.cellX.length).toBe(BENCH.cells.count);
    const c = cellPosition(w.frame.halfW, w.frame.halfD);
    expect(c.z).toBeLessThan(0);
  });

  it('is a pure function of the bench', () => {
    const a = buildWorld(BENCH);
    const b = buildWorld(BENCH);
    expect(a.pillars.x).toEqual(b.pillars.x);
    expect(a.cast.tint).toEqual(b.cast.tint);
    expect(a.cell).toEqual(b.cell);
  });
});
