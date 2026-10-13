import { describe, expect, it } from 'vitest';
import { clamp, clamp01, damp, decimalsOf, easeOutExpo, invLerp, lerp, snap } from './math';

describe('math', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
  });

  it('interpolates', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(invLerp(10, 20, 15)).toBe(0.5);
    expect(invLerp(5, 5, 9)).toBe(0);
  });

  it('damps toward the target without overshooting', () => {
    const a = damp(0, 10, 12, 0.016);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(10);
    expect(damp(10, 10, 12, 0.016)).toBe(10);
  });

  it('snaps to a step anchored at min', () => {
    expect(snap(7, 5, 0)).toBe(5);
    expect(snap(8, 5, 0)).toBe(10);
    expect(snap(0.34, 0.1, 0)).toBe(0.3);
    expect(snap(2.3, 1, 1)).toBe(2);
    expect(snap(3, 0, 0)).toBe(3);
  });

  it('counts decimals', () => {
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(0.25)).toBe(2);
    expect(decimalsOf(0.001)).toBe(3);
  });

  it('eases', () => {
    expect(easeOutExpo(0)).toBeCloseTo(0, 2);
    expect(easeOutExpo(1)).toBe(1);
    expect(easeOutExpo(0.5)).toBeGreaterThan(0.9);
  });
});
