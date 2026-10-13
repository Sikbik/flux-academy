import { BAKED_PRICING } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { fixtureResources, priceCliff, priceLadder } from './cost';

describe('priceLadder', () => {
  const rows = priceLadder(8, BAKED_PRICING.params);

  it('prices every count from the shared engine', () => {
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.instances)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const r of rows) expect(r.usdPerMonth).toBeGreaterThanOrEqual(BAKED_PRICING.params.minUSDPrice);
  });

  it('sits on the floor for a small app, then steps up at four', () => {
    expect(rows[0]?.usdPerMonth).toBe(0.99);
    expect(rows[2]?.usdPerMonth).toBe(0.99);
    expect(rows[3]?.usdPerMonth).toBeGreaterThan(rows[2]?.usdPerMonth ?? 0);
    expect(priceCliff(rows)).toBe(4);
  });

  it('never gets cheaper with more instances', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]?.usdPerMonth ?? 0).toBeGreaterThanOrEqual(rows[i - 1]?.usdPerMonth ?? 0);
    }
  });
});

describe('fixtureResources', () => {
  it('describes the fixture app', () => {
    expect(fixtureResources()).toEqual({ cpu: 0.5, ramMb: 500, hddGb: 5 });
  });
});
