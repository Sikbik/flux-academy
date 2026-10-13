import { describe, expect, it } from 'vitest';
import { doneOfTotal, fraction, HEAD_LENGTH, headOffset, percentText, segmentFills } from './geometry';

describe('fraction', () => {
  it('maps a range to 0..1', () => {
    expect(fraction(50, 0, 100)).toBe(0.5);
    expect(fraction(0.25)).toBe(0.25);
    expect(fraction(15, 10, 20)).toBe(0.5);
  });

  it('clamps and never returns NaN', () => {
    expect(fraction(-5, 0, 10)).toBe(0);
    expect(fraction(50, 0, 10)).toBe(1);
    expect(fraction(Number.NaN, 0, 10)).toBe(0);
    expect(fraction(5, 10, 10)).toBe(0);
    expect(fraction(5, 10, 0)).toBe(0);
  });
});

describe('percentText', () => {
  it('rounds to whole percent and clamps', () => {
    expect(percentText(0.584)).toBe('58%');
    expect(percentText(1.4)).toBe('100%');
    expect(percentText(-1)).toBe('0%');
  });
});

describe('segmentFills', () => {
  it('fills whole cells then one partial cell', () => {
    expect(segmentFills(0.55, 4)).toEqual([1, 1, 0.2, 0]);
    expect(segmentFills(0, 3)).toEqual([0, 0, 0]);
    expect(segmentFills(1, 3)).toEqual([1, 1, 1]);
  });

  it('handles odd counts and zero cells', () => {
    expect(segmentFills(0.5, 2)).toEqual([1, 0]);
    expect(segmentFills(0.5, 0)).toEqual([]);
    expect(segmentFills(3 / 8, 8).filter((v) => v === 1)).toHaveLength(3);
  });
});

describe('doneOfTotal', () => {
  it('reads like a person', () => {
    expect(doneOfTotal(3, 8)).toBe('3 of 8');
    expect(doneOfTotal(-1, 8)).toBe('0 of 8');
  });
});

describe('headOffset', () => {
  it('parks the head so it ends at the fraction', () => {
    expect(headOffset(0.5)).toBeCloseTo(-(0.5 - HEAD_LENGTH), 6);
    expect(headOffset(0)).toBeCloseTo(0, 6);
    expect(headOffset(1)).toBeCloseTo(-(1 - HEAD_LENGTH), 6);
  });
});
