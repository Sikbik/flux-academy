import { describe, expect, it } from 'vitest';
import { arcPath, degToFraction, edgeIndex, edgeNormal, ringPosition, tickAt, wrap01 } from './geometry';

describe('wrap01', () => {
  it('wraps into [0, 1)', () => {
    expect(wrap01(1.25)).toBeCloseTo(0.25, 6);
    expect(wrap01(-0.25)).toBeCloseTo(0.75, 6);
    expect(wrap01(0)).toBe(0);
  });
});

describe('arcPath', () => {
  it('starts at the requested perimeter fraction', () => {
    // 0.5 is the bottom vertex of a pointy-top hexagon at (50,50) r=40
    const d = arcPath(50, 50, 40, 0.5, 0.25);
    expect(d.startsWith('M50 90')).toBe(true);
  });

  it('passes through the vertices it crosses, wrapping past the top', () => {
    // from the lower-left vertex (4/6) 0.4 of a turn: crosses upper-left (5/6) and the top (1)
    const d = arcPath(50, 50, 40, 4 / 6, 0.4);
    const points = d.split('L');
    expect(points.length).toBe(4); // start, upper-left, top, end
    expect(points[1]).toBe('15.36 30');
    expect(points[2]).toBe('50 10');
  });

  it('closes the ring for a full sweep', () => {
    expect(arcPath(50, 50, 40, 0, 1).endsWith('Z')).toBe(true);
    expect(arcPath(50, 50, 40, 0, 0.5).endsWith('Z')).toBe(false);
  });

  it('never emits NaN', () => {
    expect(arcPath(50, 50, 40, 0.3, 0)).not.toMatch(/NaN/);
    expect(arcPath(50, 50, 40, -0.2, 0.9)).not.toMatch(/NaN/);
  });
});

describe('edges and ticks', () => {
  it('numbers the edges clockwise from the top', () => {
    expect(edgeIndex(0)).toBe(0);
    expect(edgeIndex(0.17)).toBe(1);
    expect(edgeIndex(0.99)).toBe(5);
    expect(edgeIndex(1)).toBe(0);
  });

  it('has outward normals at 30, 90 and 150 degrees', () => {
    const [x0, y0] = edgeNormal(0);
    expect(x0).toBeCloseTo(Math.sin((30 * Math.PI) / 180), 6);
    expect(y0).toBeCloseTo(-Math.cos((30 * Math.PI) / 180), 6);
    const [x1, y1] = edgeNormal(1);
    expect(x1).toBeCloseTo(1, 6);
    expect(y1).toBeCloseTo(0, 6);
  });

  it('stands a tick outside the ring', () => {
    // a point on the right vertical edge (edge 1): the tick points straight right
    const t = tickAt(50, 50, 40, 0.25, 3, 5);
    expect(t.y1).toBeCloseTo(t.y2, 1);
    expect(t.x2 - t.x1).toBeCloseTo(5, 1);
    expect(t.x1).toBeGreaterThan(50 + 34);
  });
});

describe('ringPosition', () => {
  it('places a value along the sweep', () => {
    expect(ringPosition(0.5, 0.25, 0.5)).toBeCloseTo(0.5, 6);
    expect(ringPosition(2, 0, 1)).toBe(1);
    expect(degToFraction(270)).toBeCloseTo(0.75, 6);
  });
});
