import type { BlockSummary, GeoCountry } from '@shared/api';
import { describe, expect, it } from 'vitest';
import {
  blocksPerDay,
  countryRows,
  explore,
  formatWait,
  GLOBETROTTER_GOAL,
  intervalHeights,
  intervalRange,
  intervalSeries,
  meanInterval,
  restoreExplored,
  tierSummaries,
} from './model';

const countries: GeoCountry[] = [
  { code: 'DE', name: 'Germany', nodes: 1500, tiers: { cumulus: 700, nimbus: 300, stratus: 500 } },
  { code: 'US', name: 'United States', nodes: 1200, tiers: { cumulus: 600, nimbus: 360, stratus: 240 } },
  { code: 'FI', name: 'Finland', nodes: 1000, tiers: { cumulus: 300, nimbus: 170, stratus: 530 } },
  { code: 'NZ', name: 'New Zealand', nodes: 1, tiers: { cumulus: 0, nimbus: 0, stratus: 1 } },
];

describe('countryRows', () => {
  it('sorts by nodes and shares the total', () => {
    const { rows, total } = countryRows(countries, 'all');
    expect(rows.map((r) => r.code)).toEqual(['DE', 'US', 'FI', 'NZ']);
    expect(total).toBe(3701);
    expect(rows[0]?.bar).toBe(1);
    expect(rows[0]?.share).toBeCloseTo(1500 / 3701, 9);
  });

  it('restricts to a tier and drops countries without one', () => {
    const { rows, total } = countryRows(countries, 'stratus');
    expect(rows.map((r) => r.code)).toEqual(['FI', 'DE', 'US', 'NZ']);
    expect(total).toBe(500 + 240 + 530 + 1);
    const c = countryRows(countries, 'cumulus');
    expect(c.rows.map((r) => r.code)).not.toContain('NZ');
  });

  it('matches a query on name or code without changing the shares', () => {
    const all = countryRows(countries, 'all');
    const q = countryRows(countries, 'all', 'fin');
    expect(q.rows.map((r) => r.code)).toEqual(['FI']);
    expect(q.rows[0]?.share).toBe(all.rows[2]?.share);
    expect(countryRows(countries, 'all', 'us').rows.map((r) => r.code)).toEqual(['US']);
  });
});

describe('tierSummaries', () => {
  const s = tierSummaries(
    { cumulus: 3585, nimbus: 1691, stratus: 1829 },
    { cumulus: 1000, nimbus: 12_500, stratus: 40_000 },
    { cumulus: 1, nimbus: 3.5, stratus: 9 },
    30,
  );

  it('reproduces the derived figures in FACTS 2.8', () => {
    expect(blocksPerDay(30)).toBe(2880);
    expect(s[0]?.paidEveryDays).toBeCloseTo(1.245, 2);
    expect(s[1]?.paidEveryDays).toBeCloseTo(0.587, 2);
    expect(s[2]?.paidEveryDays).toBeCloseTo(0.635, 2);
  });

  it('reproduces the locked collateral of the snapshot', () => {
    const locked = s.reduce((sum, t) => sum + t.lockedFlux, 0);
    expect(locked).toBe(97_882_500);
  });

  it('shares sum to one', () => {
    expect(s.reduce((sum, t) => sum + t.share, 0)).toBeCloseTo(1, 12);
  });
});

describe('block intervals', () => {
  const blocks: BlockSummary[] = [
    { height: 10, time: 't0', intervalSec: null, txCount: null },
    { height: 11, time: 't1', intervalSec: 30, txCount: null },
    { height: 12, time: 't2', intervalSec: 33, txCount: null },
    { height: 13, time: 't3', intervalSec: 27, txCount: null },
  ];

  it('skips the block with no interval', () => {
    expect(intervalSeries(blocks)).toEqual([30, 33, 27]);
    expect(intervalHeights(blocks)).toEqual([11, 12, 13]);
  });

  it('summarises', () => {
    expect(meanInterval(blocks)).toBe(30);
    expect(intervalRange([30, 33, 27])).toEqual({ min: 27, max: 33 });
    expect(meanInterval([])).toBeNull();
    expect(intervalRange([])).toBeNull();
  });

  it('keeps the newest N', () => {
    const many: BlockSummary[] = Array.from({ length: 100 }, (_, i) => ({
      height: i,
      time: 't',
      intervalSec: 30,
      txCount: null,
    }));
    expect(intervalSeries(many, 60)).toHaveLength(60);
    expect(intervalHeights(many, 60)[59]).toBe(99);
  });
});

describe('globetrotter bookkeeping', () => {
  it('counts distinct countries', () => {
    let seen = new Set<string>();
    for (const cc of ['de', 'DE', 'us', 'fi', '', null, undefined, 'x']) seen = explore(seen, cc);
    expect([...seen].sort()).toEqual(['DE', 'FI', 'US']);
    expect(GLOBETROTTER_GOAL).toBe(15);
  });
});

describe('restoreExplored', () => {
  it('keeps two letter codes only', () => {
    expect([...restoreExplored(['de', 'US', 'usa', 7, null, ' fi '])].sort()).toEqual(['DE', 'FI', 'US']);
    expect(restoreExplored('DE').size).toBe(0);
    expect(restoreExplored(null).size).toBe(0);
  });
});

describe('formatWait', () => {
  it('reads as days, hours or minutes', () => {
    expect(formatWait(1.245)).toBe('1.2 days');
    expect(formatWait(0.587)).toBe('14 hours');
    expect(formatWait(0.635)).toBe('15 hours');
    expect(formatWait(3.4)).toBe('3 days');
    expect(formatWait(0.02)).toBe('29 min');
    expect(formatWait(null)).toBe('--');
    expect(formatWait(0)).toBe('--');
  });
});
