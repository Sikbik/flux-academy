import { describe, expect, it } from 'vitest';
import {
  combinedAvailability,
  DEFAULT_NODE_AVAILABILITY,
  downtimeMinutesPerMonth,
  formatAvailability,
  formatDowntime,
  instancesFor,
  MINUTES_PER_MONTH,
  marginalSavings,
  nines,
  normalizeAvailability,
  peakShareToCarry,
  survivableLoadShare,
} from './math';

describe('combinedAvailability', () => {
  it('is 1 - (1 - a)^n', () => {
    expect(combinedAvailability(1, 0.97)).toBeCloseTo(0.97, 12);
    expect(combinedAvailability(2, 0.97)).toBeCloseTo(0.9991, 12);
    expect(combinedAvailability(3, 0.97)).toBeCloseTo(0.999973, 12);
  });

  it('is zero without instances and never leaves 0..1', () => {
    expect(combinedAvailability(0, 0.97)).toBe(0);
    expect(combinedAvailability(-3, 0.97)).toBe(0);
    expect(combinedAvailability(5, 2)).toBe(1);
    expect(combinedAvailability(5, -1)).toBe(0);
    expect(combinedAvailability(Number.NaN, 0.9)).toBe(0);
  });

  it('grows with every instance but by less each time', () => {
    const rows = marginalSavings(8, DEFAULT_NODE_AVAILABILITY);
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      const before = rows[i - 1];
      expect(row && before && row.savedMin < before.savedMin).toBe(true);
    }
    expect(rows[0]?.savedMin).toBe(0);
    expect(rows[1]?.savedMin).toBeCloseTo(MINUTES_PER_MONTH * 0.03 - MINUTES_PER_MONTH * 0.0009, 6);
  });
});

describe('downtime and nines', () => {
  it('states downtime for a 30 day month', () => {
    expect(MINUTES_PER_MONTH).toBe(43_200);
    expect(downtimeMinutesPerMonth(0.97)).toBeCloseTo(1296, 6);
    expect(downtimeMinutesPerMonth(1)).toBe(0);
  });

  it('counts nines', () => {
    expect(nines(0.9)).toBeCloseTo(1, 9);
    expect(nines(0.999)).toBeCloseTo(3, 9);
    expect(nines(1)).toBe(12);
  });
});

describe('survivableLoadShare', () => {
  it('is (n - 1) / n of the capacity of one instance', () => {
    expect(survivableLoadShare(1)).toBe(0);
    expect(survivableLoadShare(2)).toBe(0.5);
    expect(survivableLoadShare(4)).toBe(0.75);
  });
});

describe('peakShareToCarry', () => {
  it('is 1 / (n - 1): the survivors must carry the whole peak between them', () => {
    expect(peakShareToCarry(1)).toBeNull();
    expect(peakShareToCarry(2)).toBe(1);
    expect(peakShareToCarry(3)).toBe(0.5);
    expect(peakShareToCarry(4)).toBeCloseTo(1 / 3, 12);
  });

  it('agrees with the utilisation: peak / n of a capacity of peak / (n - 1) is (n - 1) / n', () => {
    for (const n of [2, 3, 4, 8]) {
      const capacity = peakShareToCarry(n) ?? 0;
      expect(1 / n / capacity).toBeCloseTo(survivableLoadShare(n), 12);
    }
  });
});

describe('targets', () => {
  it('accepts percents and fractions', () => {
    expect(normalizeAvailability(99.9)).toBeCloseTo(0.999, 12);
    expect(normalizeAvailability(0.999)).toBe(0.999);
    expect(normalizeAvailability(1)).toBe(1);
    expect(normalizeAvailability(0)).toBeNull();
    expect(normalizeAvailability(250)).toBeNull();
    expect(normalizeAvailability(undefined)).toBeNull();
  });

  it('finds the fewest instances for a target', () => {
    expect(instancesFor(99.9, 0.97)).toBe(2);
    expect(instancesFor(99.99, 0.97)).toBe(3);
    expect(instancesFor(0.99999, 0.97)).toBe(4);
    expect(instancesFor(99.9, 0.5, 5)).toBeNull();
  });
});

describe('formatting', () => {
  it('prints as many decimals as the nines need', () => {
    expect(formatAvailability(0.97)).toBe('97');
    expect(formatAvailability(0.9991)).toBe('99.91');
    expect(formatAvailability(0.999973)).toBe('99.9973');
    expect(formatAvailability(1)).toBe('99.99999+');
  });

  it('prints downtime in the unit a person would say', () => {
    expect(formatDowntime(0)).toBe('0 s');
    expect(formatDowntime(0.001)).toBe('under 1 s');
    expect(formatDowntime(0.5)).toBe('30 s');
    expect(formatDowntime(1.1664)).toBe('1.2 min');
    expect(formatDowntime(38.88)).toBe('39 min');
    expect(formatDowntime(1296)).toBe('21 h 36 min');
    expect(formatDowntime(43_200)).toBe('30 d');
    expect(formatDowntime(Number.NaN)).toBe('unknown');
  });
});
