import { describe, expect, it } from 'vitest';
import {
  ACTIVATION_WINDOW_MS,
  activationFor,
  clampOrigin,
  coverRadius,
  farthestCorner,
  irisShape,
  pickOrigin,
} from './iris';

const VP = { width: 1440, height: 900 };

describe('iris geometry', () => {
  it('finds the farthest corner', () => {
    expect(farthestCorner({ x: 0, y: 0 }, VP)).toBeCloseTo(Math.hypot(1440, 900), 5);
    expect(farthestCorner({ x: 720, y: 450 }, VP)).toBeCloseTo(Math.hypot(720, 450), 5);
  });

  it('covers every corner with the hexagon from any origin', () => {
    for (const origin of [
      { x: 0, y: 0 },
      { x: 1440, y: 900 },
      { x: 720, y: 450 },
      { x: 100, y: 800 },
    ]) {
      const r = coverRadius(origin, VP);
      // The inscribed circle of the hexagon must reach the farthest corner.
      expect(r * Math.cos(Math.PI / 6)).toBeGreaterThanOrEqual(farthestCorner(origin, VP));
    }
  });

  it('builds two six-point polygons', () => {
    const shape = irisShape({ x: 300, y: 200 }, VP);
    for (const p of [shape.from, shape.to]) {
      expect(p.startsWith('polygon(')).toBe(true);
      expect(p.match(/px/g)?.length).toBe(12);
    }
    expect(shape.from).not.toBe(shape.to);
  });

  it('starts pointy-top: the first vertex is straight above the origin', () => {
    const shape = irisShape({ x: 300, y: 200 }, VP, 10);
    expect(shape.from.startsWith('polygon(300.0px 190.0px')).toBe(true);
  });

  it('clamps an origin that is off screen', () => {
    expect(clampOrigin({ x: -50, y: 2000 }, VP)).toEqual({ x: 0, y: 900 });
  });
});

describe('origin choice', () => {
  it('uses a recent activation, else the centre', () => {
    const a = { x: 200, y: 40, at: 1000 };
    expect(pickOrigin(a, VP, 1500)).toEqual({ x: 200, y: 40 });
    expect(pickOrigin(a, VP, 1000 + ACTIVATION_WINDOW_MS + 1)).toEqual({ x: 720, y: 450 });
    expect(pickOrigin(null, VP, 0)).toEqual({ x: 720, y: 450 });
  });

  it('centres on a small element and on the pointer for a big card', () => {
    const small = { left: 100, top: 20, width: 80, height: 40 };
    expect(activationFor(small, { x: 5, y: 5 }, 10)).toEqual({ x: 140, y: 40, at: 10 });
    const card = { left: 0, top: 0, width: 600, height: 400 };
    expect(activationFor(card, { x: 33, y: 44 }, 10)).toEqual({ x: 33, y: 44, at: 10 });
    expect(activationFor(null, null, 10)).toBeNull();
  });
});
