import { describe, expect, it } from 'vitest';
import { isMajorTick, pageStep, pctOf, snapValue, stepCount, tickValues } from './slider';

describe('snapValue', () => {
  it('snaps to the step grid and clamps', () => {
    expect(snapValue(3.4, 0, 12, 1)).toBe(3);
    expect(snapValue(3.6, 0, 12, 1)).toBe(4);
    expect(snapValue(-4, 0, 12, 1)).toBe(0);
    expect(snapValue(99, 0, 12, 1)).toBe(12);
  });

  it('anchors the grid at min', () => {
    expect(snapValue(7, 1, 12, 2)).toBe(7);
    expect(snapValue(5.4, 1, 12, 2)).toBe(5);
  });

  it('rounds an exact tie up, like a native range input', () => {
    expect(snapValue(6, 1, 12, 2)).toBe(7);
  });

  it('trims float noise', () => {
    expect(snapValue(0.30000000000000004, 0, 1, 0.1)).toBe(0.3);
    expect(snapValue(0.25, 0, 1, 0.05)).toBe(0.25);
  });

  it('never exceeds max when the last step falls short', () => {
    expect(snapValue(10, 0, 10, 3)).toBe(9);
  });
});

describe('pctOf', () => {
  it('maps into 0..1', () => {
    expect(pctOf(5, 0, 10)).toBe(0.5);
    expect(pctOf(0, 0, 10)).toBe(0);
    expect(pctOf(20, 0, 10)).toBe(1);
    expect(pctOf(3, 3, 3)).toBe(0);
  });
});

describe('tickValues', () => {
  it('gives every step for a short range', () => {
    expect(tickValues(1, 12, 1)).toHaveLength(12);
    expect(tickValues(1, 12, 1)[0]).toBe(1);
    expect(tickValues(1, 12, 1).at(-1)).toBe(12);
  });

  it('thins long ranges and keeps both ends', () => {
    const t = tickValues(0, 100, 1, 20);
    expect(t.length).toBeLessThanOrEqual(21);
    expect(t[0]).toBe(0);
    expect(t.at(-1)).toBe(100);
  });

  it('handles a zero range', () => {
    expect(tickValues(5, 5, 1)).toEqual([5]);
  });
});

describe('helpers', () => {
  it('counts steps', () => {
    expect(stepCount(1, 12, 1)).toBe(11);
    expect(stepCount(0, 1, 0.1)).toBe(10);
  });

  it('marks major ticks', () => {
    expect(isMajorTick(0, 12, 5)).toBe(true);
    expect(isMajorTick(11, 12, 5)).toBe(true);
    expect(isMajorTick(5, 12, 5)).toBe(true);
    expect(isMajorTick(3, 12, 5)).toBe(false);
  });

  it('pages by ten steps', () => {
    expect(pageStep(0, 100, 1)).toBe(10);
    expect(pageStep(1, 12, 1)).toBe(1);
  });
});
