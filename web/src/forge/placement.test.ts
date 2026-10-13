import { describe, expect, it } from 'vitest';
import { appSizeFor, eligibleIndices, placeInstances, placeOptionsFor } from './placement';

const nodes = [
  { cc: 'DE', region: 'EU' as const },
  { cc: 'FR', region: 'EU' as const },
  { cc: 'GB', region: 'EU' as const },
  { cc: 'US', region: 'NA' as const },
  { cc: 'CA', region: 'NA' as const },
  { cc: 'JP', region: 'AS' as const },
  { cc: 'AU', region: 'OC' as const },
];

describe('eligibleIndices', () => {
  it('lets every node through when there are no rules', () => {
    expect(eligibleIndices(nodes, [])).toHaveLength(nodes.length);
  });

  it('applies an allow list of continents', () => {
    expect(eligibleIndices(nodes, ['acEU'])).toEqual([0, 1, 2]);
    expect(eligibleIndices(nodes, ['acEU', 'acNA'])).toEqual([0, 1, 2, 3, 4]);
  });

  it('applies country entries and region entries at country level', () => {
    expect(eligibleIndices(nodes, ['acEU_DE'])).toEqual([0]);
    expect(eligibleIndices(nodes, ['acEU_DE_BY'])).toEqual([0]);
  });

  it('applies deny entries over everything', () => {
    expect(eligibleIndices(nodes, ['a!cEU'])).toEqual([3, 4, 5, 6]);
    expect(eligibleIndices(nodes, ['acEU', 'a!cEU_FR'])).toEqual([0, 2]);
  });

  it('reads the legacy continent and country forms', () => {
    expect(eligibleIndices(nodes, ['aEU'])).toEqual([0, 1, 2]);
    expect(eligibleIndices(nodes, ['bDE'])).toEqual([0]);
  });

  it('ignores entries the network does not understand', () => {
    expect(eligibleIndices(nodes, ['nonsense'])).toHaveLength(nodes.length);
  });

  it('treats acALL as everywhere', () => {
    expect(eligibleIndices(nodes, ['acALL'])).toHaveLength(nodes.length);
  });
});

describe('placeInstances', () => {
  it('is stable for the same inputs', () => {
    const a = placeInstances(nodes, [], 4, 'my-app');
    const b = placeInstances(nodes, [], 4, 'my-app');
    expect(a).toEqual(b);
  });

  it('puts instances on distinct nodes inside the rules', () => {
    const r = placeInstances(nodes, ['acEU'], 3, 'x');
    expect(new Set(r.chosen).size).toBe(3);
    for (const i of r.chosen) expect(nodes[i]?.region).toBe('EU');
    expect(r.unplaced).toBe(0);
  });

  it('spreads over regions before doubling up', () => {
    const r = placeInstances(nodes, [], 4, 'spread');
    const regions = new Set(r.chosen.map((i) => nodes[i]?.region));
    expect(regions.size).toBe(4);
  });

  it('reports the instances that cannot be placed', () => {
    const r = placeInstances(nodes, ['acEU_DE'], 3, 'few');
    expect(r.chosen).toHaveLength(1);
    expect(r.unplaced).toBe(2);
  });

  it('keeps the earlier placements when one more instance is added', () => {
    const three = placeInstances(nodes, [], 3, 'grow').chosen;
    const four = placeInstances(nodes, [], 4, 'grow').chosen;
    expect(four.slice(0, 3)).toEqual(three);
  });

  it('places nothing when no node qualifies', () => {
    const r = placeInstances(nodes, ['acAF'], 2, 'none');
    expect(r.eligible).toEqual([]);
    expect(r.chosen).toEqual([]);
    expect(r.unplaced).toBe(2);
  });
});

describe('placeOptionsFor', () => {
  it('asks for no restriction when there are no rules', () => {
    const o = placeOptionsFor([]);
    expect(o.countries).toEqual([]);
    expect(o.none).toBe(false);
  });

  it('resolves a continent to the countries the sample world has there', () => {
    const o = placeOptionsFor(['acEU']);
    expect(o.countries.length).toBeGreaterThan(3);
    expect(o.countries).toContain('DE');
    expect(o.countries).not.toContain('US');
  });

  it('resolves deny entries to an allow list of everything else', () => {
    const o = placeOptionsFor(['a!cEU']);
    expect(o.countries).toContain('US');
    expect(o.countries).not.toContain('DE');
    const one = placeOptionsFor(['a!cNA_US']);
    expect(one.countries).toContain('CA');
    expect(one.countries).not.toContain('US');
  });

  it('says so when no country is left', () => {
    expect(placeOptionsFor(['acEU', 'a!cEU']).none).toBe(true);
  });
});

describe('appSizeFor', () => {
  it('maps the smallest fitting tier to a size class', () => {
    expect(appSizeFor({ cpu: 1, ram: 1000, hdd: 10 })).toEqual({ size: 'small', fits: true });
    expect(appSizeFor({ cpu: 5, ram: 8000, hdd: 100 })).toEqual({ size: 'medium', fits: true });
    expect(appSizeFor({ cpu: 12, ram: 40000, hdd: 400 })).toEqual({ size: 'large', fits: true });
  });

  it('says when nothing fits and defaults when the totals are unknown', () => {
    expect(appSizeFor({ cpu: 16, ram: 100, hdd: 1 }).fits).toBe(false);
    expect(appSizeFor()).toEqual({ size: 'small', fits: true });
  });
});
