import { describe, expect, it } from 'vitest';
import { BAKED_AS_OF, bakedMeta, getBaked } from './baked';

describe('baked sample', () => {
  const b = getBaked();

  it('is labelled fallback and dated', () => {
    expect(b.meta.source).toBe('fallback');
    expect(bakedMeta().asOf).toBe(BAKED_AS_OF);
    expect(Number.isFinite(Date.parse(BAKED_AS_OF))).toBe(true);
  });

  it('has about 150 geo points that add up', () => {
    expect(b.geo.points.length).toBe(150);
    const inPoints = b.geo.points.reduce((s, p) => s + p.n, 0);
    expect(inPoints).toBeLessThanOrEqual(b.geo.located);
    expect(inPoints).toBeGreaterThan(b.geo.located * 0.9);
    for (const p of b.geo.points) {
      expect(p.n).toBe(p.t[0] + p.t[1] + p.t[2]);
      expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lon)).toBeLessThanOrEqual(180);
    }
  });

  it('has consistent tier counts and no invented price', () => {
    const t = b.network.nodes.tiers;
    expect(t.cumulus + t.nimbus + t.stratus).toBe(b.network.nodes.total);
    expect(b.network.market).toBeNull();
    expect(b.pricing.fluxUsd).toBeNull();
    expect(b.pricing.paramsSource).toBe('baked');
  });

  it('has contiguous recent blocks and a sane reduction countdown', () => {
    const list = b.blocks.blocks;
    expect(list.length).toBe(60);
    for (let i = 1; i < list.length; i++) expect(list[i]?.height).toBe((list[i - 1]?.height ?? 0) + 1);
    expect(b.network.chain.height).toBe(list.at(-1)?.height);
    const r = b.network.rewards.nextReduction;
    expect(r?.blocksAway).toBe((r?.height ?? 0) - b.network.chain.height);
  });

  it('carries the verified pricing rates', () => {
    expect(b.pricing.params).toMatchObject({
      cpu: 0.15,
      ram: 0.05,
      hdd: 0.02,
      minUSDPrice: 0.99,
      fluxmultiplier: 0.95,
    });
  });
});
