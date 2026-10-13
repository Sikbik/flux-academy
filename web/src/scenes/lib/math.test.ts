import { describe, expect, it } from 'vitest';
import {
  clamp,
  damp,
  easeInOutCubic,
  easeInOutSine,
  easeOutBack,
  easeOutCubic,
  easeOutElastic,
  easeOutQuart,
  hash2,
  hashString,
  invLerp,
  lerp,
  mulberry32,
  saturate,
  smoothDamp,
  smoothstep,
  TAU,
  wrapAngle,
} from './math';

describe('scalar helpers', () => {
  it('clamps and saturates', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
    expect(saturate(-0.2)).toBe(0);
    expect(saturate(1.4)).toBe(1);
    expect(saturate(0.25)).toBe(0.25);
  });

  it('lerps and inverts', () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(invLerp(10, 20, 12.5)).toBeCloseTo(0.25, 10);
    expect(invLerp(10, 20, 99)).toBe(1);
    // An empty range must not divide by zero.
    expect(invLerp(4, 4, 4)).toBe(0);
  });

  it('smoothstep is monotone with flat ends', () => {
    expect(smoothstep(0.2, 0.8, 0)).toBe(0);
    expect(smoothstep(0.2, 0.8, 1)).toBe(1);
    let prev = -1;
    for (let i = 0; i <= 40; i++) {
      const v = smoothstep(0.2, 0.8, i / 40);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 10);
  });
});

describe('easings', () => {
  it('start at 0 and end at 1', () => {
    for (const f of [
      easeOutCubic,
      easeOutQuart,
      easeInOutCubic,
      easeInOutSine,
      easeOutBack,
      easeOutElastic,
    ]) {
      expect(f(0)).toBeCloseTo(0, 6);
      expect(f(1)).toBeCloseTo(1, 6);
    }
  });

  it('clamp their input instead of extrapolating', () => {
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(5)).toBe(1);
  });

  it('easeOutBack overshoots once, then settles', () => {
    let peak = 0;
    for (let i = 0; i <= 100; i++) peak = Math.max(peak, easeOutBack(i / 100));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.15);
  });
});

describe('damp', () => {
  it('approaches the target', () => {
    let x = 0;
    for (let i = 0; i < 240; i++) x = damp(x, 10, 6, 1 / 60);
    expect(x).toBeCloseTo(10, 3);
  });

  it('is frame-rate independent', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 1, 5, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = damp(b, 1, 5, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('wrapAngle', () => {
  it('returns an equivalent angle in -PI..PI', () => {
    for (const a of [0, 1, -1, 3.5, -3.5, 7, -7, 100, -100, TAU * 3 + 0.1]) {
      const w = wrapAngle(a);
      expect(w).toBeGreaterThanOrEqual(-Math.PI - 1e-9);
      expect(w).toBeLessThanOrEqual(Math.PI + 1e-9);
      expect(Math.cos(w)).toBeCloseTo(Math.cos(a), 6);
      expect(Math.sin(w)).toBeCloseTo(Math.sin(a), 6);
    }
  });
});

describe('smoothDamp', () => {
  it('arrives without overshoot from rest', () => {
    const vel = { v: 0 };
    let x = 0;
    let peak = 0;
    for (let i = 0; i < 600; i++) {
      x = smoothDamp(x, 5, vel, 0.4, 1 / 60);
      peak = Math.max(peak, x);
    }
    expect(x).toBeCloseTo(5, 3);
    expect(peak).toBeLessThanOrEqual(5 + 1e-6);
  });

  it('keeps its velocity when the target moves', () => {
    const vel = { v: 0 };
    let x = 0;
    for (let i = 0; i < 20; i++) x = smoothDamp(x, 5, vel, 0.4, 1 / 60);
    const before = vel.v;
    expect(before).toBeGreaterThan(0);
    // Retarget behind the mover: velocity decays smoothly, it does not snap.
    x = smoothDamp(x, -5, vel, 0.4, 1 / 60);
    expect(Math.abs(vel.v - before)).toBeLessThan(Math.abs(before));
  });

  it('does nothing for a zero step', () => {
    const vel = { v: 1 };
    expect(smoothDamp(3, 9, vel, 0.4, 0)).toBe(3);
    expect(vel.v).toBe(1);
  });
});

describe('deterministic hashes', () => {
  it('hash2 is stable and inside 0..1', () => {
    for (let x = -5; x < 5; x++) {
      for (let y = -5; y < 5; y++) {
        const h = hash2(x, y);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThanOrEqual(1);
        expect(hash2(x, y)).toBe(h);
      }
    }
    expect(hash2(1, 2)).not.toBe(hash2(2, 1));
  });

  it('mulberry32 repeats for a seed and differs between seeds', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const sa = Array.from({ length: 8 }, () => a());
    const sb = Array.from({ length: 8 }, () => b());
    const sc = Array.from({ length: 8 }, () => c());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const v of sa) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hashString is stable', () => {
    expect(hashString('flux')).toBe(hashString('flux'));
    expect(hashString('flux')).not.toBe(hashString('flus'));
    // FNV-1a of the empty string is the offset basis.
    expect(hashString('')).toBe(0x811c9dc5);
  });
});
