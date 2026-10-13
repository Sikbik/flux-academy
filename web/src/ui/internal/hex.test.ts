import { describe, expect, it } from 'vitest';
import { hexArcPath, hexPath, hexPerimeterPoint, hexPoints, hexSegments, hexWidth } from './hex';

describe('hex geometry', () => {
  it('puts the first vertex at 12 o clock', () => {
    const pts = hexPoints(50, 50, 40);
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual([50, 10]);
    expect(pts[3]).toEqual([50, 90]);
  });

  it('is pointy-top: width is sqrt(3) r', () => {
    const pts = hexPoints(0, 0, 10);
    const xs = pts.map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(hexWidth(10), 2);
  });

  it('closes the outline path', () => {
    const d = hexPath(12, 12, 9.5);
    expect(d.startsWith('M12 2.5')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('walks the perimeter clockwise from the top vertex', () => {
    expect(hexPerimeterPoint(0, 0, 10, 0)).toEqual(hexPoints(0, 0, 10)[0]);
    expect(hexPerimeterPoint(0, 0, 10, 1 / 6)).toEqual(hexPoints(0, 0, 10)[1]);
    expect(hexPerimeterPoint(0, 0, 10, 0.5)).toEqual(hexPoints(0, 0, 10)[3]);
    expect(hexPerimeterPoint(0, 0, 10, 1)).toEqual(hexPerimeterPoint(0, 0, 10, 0));
  });

  it('includes corner vertices inside an arc', () => {
    const d = hexArcPath(0, 0, 10, 0.1, 0.4);
    // starts mid-edge, passes vertices 1 and 2 (at 1/6 and 2/6), ends mid-edge
    expect(d.split('L').length).toBe(4);
  });

  it('builds the requested number of segments', () => {
    expect(hexSegments(50, 50, 40, 12)).toHaveLength(12);
    expect(hexSegments(50, 50, 40, 6).every((d) => d.startsWith('M'))).toBe(true);
  });
});
