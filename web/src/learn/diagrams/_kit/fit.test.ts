import { describe, expect, it } from 'vitest';
import { FIT_MIN, fitScale } from './useFit';

describe('fitScale', () => {
  it('leaves a figure that fits alone', () => {
    expect(fitScale(400, 300)).toBe(1);
    expect(fitScale(300, 300)).toBe(1);
  });

  it('scales a figure that is a little too tall, in whole percent rounded down', () => {
    expect(fitScale(270, 300)).toBe(0.9);
    expect(fitScale(271, 300)).toBe(0.9);
    expect(fitScale(299, 300)).toBe(0.99);
    expect(fitScale(251, 300)).toBe(0.84);
  });

  it('never paints a scaled figure taller than the room', () => {
    for (let room = 260; room < 300; room++) {
      expect(300 * fitScale(room, 300)).toBeLessThanOrEqual(room + 1e-6);
    }
  });

  it('never goes below the smallest legible scale', () => {
    expect(fitScale(100, 500)).toBe(FIT_MIN);
    expect(fitScale(0, 500)).toBe(FIT_MIN);
    expect(fitScale(-40, 500)).toBe(FIT_MIN);
  });

  it('ignores a figure with no height and a room that is not a number', () => {
    expect(fitScale(100, 0)).toBe(1);
    expect(fitScale(Number.NaN, 300)).toBe(1);
    expect(fitScale(Number.POSITIVE_INFINITY, 300)).toBe(1);
  });

  it('honours another floor', () => {
    expect(fitScale(100, 500, 0.5)).toBe(0.5);
  });
});
