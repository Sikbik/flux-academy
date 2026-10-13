import { describe, expect, it } from 'vitest';
import {
  arrowHeadD,
  clamp,
  endAngle,
  group,
  hexD,
  hexPts,
  hexWidth,
  leader,
  lerp,
  MONO_ADVANCE,
  monoWidth,
  platePts,
  pointAt,
  polyD,
  polyLength,
  pt,
  r2,
  wrapMono,
} from './geometry';

describe('numbers', () => {
  it('rounds to two decimals and clamps', () => {
    expect(r2(1.23456)).toBe(1.23);
    expect(r2(-0.005)).toBe(-0);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('groups digits like the rest of the site', () => {
    expect(group(88_000)).toBe('88,000');
    expect(group(1_056_000)).toBe('1,056,000');
    expect(group(999)).toBe('999');
    expect(group(-12_500)).toBe('-12,500');
    expect(group(1234.6)).toBe('1,235');
  });
});

describe('paths', () => {
  it('writes a polyline and closes a polygon', () => {
    expect(polyD([])).toBe('');
    expect(polyD([pt(0, 0), pt(10, 5.555)])).toBe('M0 0L10 5.56');
    expect(polyD([pt(0, 0), pt(10, 0), pt(10, 10)], true)).toBe('M0 0L10 0L10 10Z');
  });

  it('builds a pointy-top hexagon', () => {
    const p = hexPts(100, 100, 10);
    expect(p).toHaveLength(6);
    expect(p[0]?.x).toBeCloseTo(100);
    expect(p[0]?.y).toBeCloseTo(90);
    expect(hexWidth(10)).toBeCloseTo(17.32, 2);
    expect(hexD(0, 0, 10).startsWith('M0 -10')).toBe(true);
    expect(hexD(0, 0, 10).endsWith('Z')).toBe(true);
  });

  it('builds the flat top face of a plate, left point first', () => {
    const p = platePts(100, 50, 80, 40);
    expect(p[0]).toEqual({ x: 60, y: 50 });
    expect(p[3]).toEqual({ x: 140, y: 50 });
    expect(p).toHaveLength(6);
  });

  it('measures and walks a polyline', () => {
    const line = [pt(0, 0), pt(30, 0), pt(30, 40)];
    expect(polyLength(line)).toBe(70);
    expect(pointAt(line, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAt(line, 15)).toEqual({ x: 15, y: 0 });
    expect(pointAt(line, 50)).toEqual({ x: 30, y: 20 });
    expect(pointAt(line, 500)).toEqual({ x: 30, y: 40 });
    expect(pointAt([], 5)).toEqual({ x: 0, y: 0 });
    expect(endAngle(line)).toBeCloseTo(Math.PI / 2);
  });

  it('draws an open arrow head back from its tip', () => {
    const d = arrowHeadD(pt(10, 0), 0, 6);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('L10 0L');
    expect(d.endsWith('Z')).toBe(false);
  });
});

describe('leader lines', () => {
  it('runs a 45 degree diagonal and then level into the marker', () => {
    const l = leader(pt(0, 0), pt(100, 20), 10);
    expect(l.end).toEqual({ x: 90, y: 20 });
    expect(l.elbow).toEqual({ x: 20, y: 20 });
    expect(l.d).toBe('M0 0L20 20L90 20');
  });

  it('goes straight when the marker is level with the anchor', () => {
    const l = leader(pt(0, 20), pt(100, 20), 10);
    expect(l.d).toBe('M0 20L90 20');
  });

  it('goes straight when there is no room for the diagonal', () => {
    const l = leader(pt(0, 0), pt(25, 40), 10);
    expect(l.d).toBe('M0 0L15 40');
  });

  it('mirrors for a marker on the left', () => {
    const l = leader(pt(100, 0), pt(0, 20), 10);
    expect(l.end).toEqual({ x: 10, y: 20 });
    expect(l.elbow).toEqual({ x: 80, y: 20 });
  });
});

describe('mono text', () => {
  it('uses the 0.6 em advance', () => {
    expect(MONO_ADVANCE).toBe(0.6);
    expect(monoWidth('abcde', 10)).toBe(30);
    expect(monoWidth('', 10)).toBe(0);
    expect(monoWidth('abcde', 10, 0.1)).toBeCloseTo(34);
  });

  it('wraps greedily and never splits a word', () => {
    const lines = wrapMono('the quick brown fox jumps over', 66, 10);
    expect(lines).toEqual(['the quick', 'brown fox', 'jumps over']);
    for (const l of lines) expect(monoWidth(l, 10)).toBeLessThanOrEqual(66);
    expect(wrapMono('supercalifragilistic', 30, 10)).toEqual(['supercalifragilistic']);
    expect(wrapMono('   ', 30, 10)).toEqual([]);
  });
});
