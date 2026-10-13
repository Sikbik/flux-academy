import { describe, expect, it } from 'vitest';
import { detectAppend, indexAt, nearestPoint, sparkGeometry, stepCursor, summarize } from './geometry';

describe('sparkGeometry', () => {
  it('returns null for an empty or all-missing series', () => {
    expect(sparkGeometry([])).toBeNull();
    expect(sparkGeometry([null, Number.NaN, undefined])).toBeNull();
  });

  it('spreads points across the width and pads the domain', () => {
    const g = sparkGeometry([10, 20, 30]);
    expect(g).not.toBeNull();
    if (!g) return;
    expect(g.points.map((p) => p?.x)).toEqual([0, 50, 100]);
    // padded 12 percent of the 20 span: domain 7.6..32.4
    expect(g.lo).toBeCloseTo(7.6, 6);
    expect(g.hi).toBeCloseTo(32.4, 6);
    // higher values are higher up (smaller y)
    expect((g.points[2] as { y: number }).y).toBeLessThan((g.points[0] as { y: number }).y);
    expect(g.step).toBe(50);
    expect(g.last).toBe(2);
  });

  it('honours fixed min and max with no padding', () => {
    const g = sparkGeometry([0, 50, 100], { min: 0, max: 100 });
    expect(g?.points.map((p) => p?.y)).toEqual([100, 50, 0]);
  });

  it('includes the target in the domain and places its line', () => {
    const g = sparkGeometry([20, 21, 22], { target: 30, min: 0, max: 40 });
    expect(g?.targetY).toBe(25);
    const auto = sparkGeometry([20, 21, 22], { target: 30 });
    expect(auto && auto.hi > 30).toBe(true);
  });

  it('clamps points outside a fixed domain', () => {
    const g = sparkGeometry([-10, 200], { min: 0, max: 100 });
    expect(g?.points.map((p) => p?.y)).toEqual([100, 0]);
  });

  it('breaks the line at missing values and keeps their slot', () => {
    const g = sparkGeometry([1, 2, null, 4, 5], { min: 0, max: 10 });
    expect(g?.points[2]).toBeNull();
    expect(g?.line.match(/M/g)).toHaveLength(2);
    expect(g?.area.match(/Z/g)).toHaveLength(2);
    expect(g?.last).toBe(4);
  });

  it('handles a single point and a flat series', () => {
    const one = sparkGeometry([5]);
    expect(one?.points[0]?.x).toBe(50);
    expect(one?.line).toContain('h0.01');
    const flat = sparkGeometry([3, 3, 3]);
    expect(flat && flat.hi > flat.lo).toBe(true);
    expect(flat?.line).not.toMatch(/NaN/);
  });
});

describe('cursor helpers', () => {
  const pts = [{ x: 0, y: 0 }, null, { x: 50, y: 0 }, { x: 75, y: 0 }, null];

  it('maps a fraction to an index', () => {
    expect(indexAt(0, 5)).toBe(0);
    expect(indexAt(0.5, 5)).toBe(2);
    expect(indexAt(1.5, 5)).toBe(4);
    expect(indexAt(0.3, 1)).toBe(0);
  });

  it('finds the nearest present point', () => {
    expect(nearestPoint(pts, 1)).toBe(2);
    expect(nearestPoint(pts, 4)).toBe(3);
    expect(nearestPoint([null, null], 0)).toBe(-1);
  });

  it('steps over gaps and stops at the ends', () => {
    expect(stepCursor(pts, 0, 1)).toBe(2);
    expect(stepCursor(pts, 2, -1)).toBe(0);
    expect(stepCursor(pts, 3, 1)).toBe(3);
    expect(stepCursor(pts, 0, -1)).toBe(0);
    expect(stepCursor(pts, 0, 5)).toBe(3);
  });
});

describe('summarize', () => {
  const fmt = (n: number) => n.toFixed(1);
  it('reads latest, low, high and count', () => {
    expect(summarize('Block interval', [29, 31, 28.5], fmt)).toBe(
      'Block interval: latest 28.5, low 28.5, high 31.0, 3 points',
    );
  });

  it('says so when there is nothing', () => {
    expect(summarize('Block interval', [], fmt)).toBe('Block interval: no data yet');
  });

  it('skips gaps and uses the singular', () => {
    expect(summarize('x', [null, 4], fmt)).toBe('x: latest 4.0, low 4.0, high 4.0, 1 point');
  });
});

describe('detectAppend', () => {
  it('sees a grown series', () => {
    expect(detectAppend([1, 2, 3], [1, 2, 3, 4])).toBe('grow');
  });

  it('sees a rolling window', () => {
    expect(detectAppend([1, 2, 3], [2, 3, 4])).toBe('roll');
  });

  it('ignores anything else', () => {
    expect(detectAppend([1, 2, 3], [9, 9, 9])).toBeNull();
    expect(detectAppend([], [1])).toBeNull();
    expect(detectAppend([1, 2, 3], [1, 2, 3])).toBeNull();
  });
});
