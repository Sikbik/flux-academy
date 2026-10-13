import { describe, expect, it } from 'vitest';
import {
  crisp,
  crosshairGeometry,
  defaultSide,
  dimensionGeometry,
  fitDimension,
  fitLeader,
  flipSideX,
  flipSideY,
  labelBeside,
  leaderGeometry,
  monoWidth,
  pointOnRing,
  polyline,
  readableAngle,
  ringFits,
  routeBetween,
  rulerTicks,
  sideVector,
  tickPath,
  toFraction,
  toPx,
} from './geometry';

const near = (a: number, b: number, digits = 3) => expect(a).toBeCloseTo(b, digits);

describe('sideVector', () => {
  it('gives unit vectors in screen space', () => {
    expect(sideVector('t')).toEqual({ x: 0, y: -1 });
    expect(sideVector('r')).toEqual({ x: 1, y: 0 });
    const d = sideVector('br');
    near(d.x, Math.SQRT1_2);
    near(d.y, Math.SQRT1_2);
    near(Math.hypot(sideVector('tl').x, sideVector('tl').y), 1);
  });

  it('mirrors sides', () => {
    expect(flipSideX('tl')).toBe('tr');
    expect(flipSideY('tl')).toBe('bl');
    expect(flipSideX('t')).toBe('t');
    expect(flipSideY('l')).toBe('l');
  });
});

describe('leaderGeometry', () => {
  it('runs straight from the anchor and puts the ring on the line', () => {
    const g = leaderGeometry({ anchor: { x: 100, y: 100 }, side: 'r', length: 40, ringRadius: 12 });
    expect(g.points).toEqual([
      { x: 100, y: 100 },
      { x: 140, y: 100 },
    ]);
    expect(g.ring).toEqual({ x: 152, y: 100 });
    expect(g.path).toBe('M100 100L140 100');
  });

  it('keeps the ring tangent to the end of a diagonal leader', () => {
    const g = leaderGeometry({ anchor: { x: 0, y: 0 }, side: 'br', length: 50, ringRadius: 13 });
    const end = g.points[1];
    expect(end).toBeDefined();
    if (!end) return;
    near(Math.hypot(end.x, end.y), 50);
    near(Math.hypot(g.ring.x - end.x, g.ring.y - end.y), 13);
  });

  it('bends an elbow leader: a 45 degree run, then horizontal', () => {
    const g = leaderGeometry({
      anchor: { x: 200, y: 200 },
      side: 'br',
      length: 60,
      ringRadius: 12,
      route: 'elbow',
    });
    expect(g.points).toHaveLength(3);
    const [a, knee, end] = g.points;
    if (!a || !knee || !end) throw new Error('missing points');
    // the diagonal part: equal dx and dy
    near(knee.x - a.x, knee.y - a.y);
    // the run is horizontal and goes the same way as the diagonal
    expect(end.y).toBe(knee.y);
    expect(end.x).toBeGreaterThan(knee.x);
    expect(g.ring.y).toBe(end.y);
    near(g.ring.x - end.x, 12);
    // the whole thing is `length` long (diagonal + run)
    const total = Math.hypot(knee.x - a.x, knee.y - a.y) + (end.x - knee.x);
    near(total, 60);
  });

  it('leaves orthogonal sides straight even with the elbow route', () => {
    const g = leaderGeometry({
      anchor: { x: 0, y: 0 },
      side: 't',
      length: 30,
      ringRadius: 10,
      route: 'elbow',
    });
    expect(g.points).toHaveLength(2);
    expect(g.ring).toEqual({ x: 0, y: -40 });
  });
});

describe('fitLeader', () => {
  const box = { width: 400, height: 300 };

  it('keeps the requested side when the ring fits', () => {
    const g = fitLeader({ anchor: { x: 200, y: 150 }, side: 'tr', length: 40, ringRadius: 12 }, box);
    expect(g.side).toBe('tr');
  });

  it('flips toward open space when the ring would leave the box', () => {
    const g = fitLeader({ anchor: { x: 390, y: 20 }, side: 'tr', length: 40, ringRadius: 12 }, box);
    expect(g.side).toBe('bl');
    expect(g.fits).toBe(true);
    expect(ringFits(g.ring, 12, box)).toBe(true);
  });

  it('keeps the request when nothing fits', () => {
    const tiny = { width: 20, height: 20 };
    const g = fitLeader({ anchor: { x: 10, y: 10 }, side: 'tr', length: 60, ringRadius: 12 }, tiny);
    expect(g.side).toBe('tr');
    expect(g.fits).toBe(false);
  });

  it('flips so a label beside the ring stays inside the box', () => {
    const input = { anchor: { x: 330, y: 150 }, side: 'r' as const, length: 20, ringRadius: 12 };
    expect(fitLeader(input, box).side).toBe('r');
    const g = fitLeader(input, box, 0, 60);
    expect(g.side).toBe('l');
    expect(g.fits).toBe(true);
  });

  it('reports no fit when no side can hold the label', () => {
    const input = { anchor: { x: 100, y: 50 }, side: 'r' as const, length: 20, ringRadius: 12 };
    const g = fitLeader(input, { width: 140, height: 100 }, 0, 200);
    expect(g.fits).toBe(false);
    expect(g.side).toBe('r');
  });

  it('allows a bleed margin', () => {
    const input = { anchor: { x: 395, y: 150 }, side: 'r' as const, length: 20, ringRadius: 12 };
    expect(fitLeader(input, box, 0).side).toBe('l');
    expect(fitLeader(input, box, 60).side).toBe('r');
  });
});

describe('fitDimension', () => {
  const box = { width: 400, height: 300 };
  const run = { from: { x: 100, y: 120 }, to: { x: 300, y: 120 } };

  it('leaves a dimension that fits alone', () => {
    const input = { ...run, side: 'top' as const, offset: 40 };
    expect(fitDimension(input, box)).toBe(input);
  });

  it('shrinks the offset to the room there is', () => {
    const g = fitDimension({ ...run, side: 'top', offset: 200 }, box);
    expect(g.offset).toBe(110);
    expect(g.side).toBe('top');
  });

  it('flips to the far side when the requested side has almost no room', () => {
    const edge = { from: { x: 100, y: 16 }, to: { x: 300, y: 16 } };
    const g = fitDimension({ ...edge, side: 'top', offset: 40 }, box);
    expect(g.offset).toBe(-40);
    expect(dimensionGeometry(g).p1.y).toBe(56);
  });

  it('flips a vertical dimension off the right edge', () => {
    const edge = { from: { x: 392, y: 50 }, to: { x: 392, y: 200 } };
    const g = fitDimension({ ...edge, side: 'right', offset: 30 }, box);
    expect(g.offset).toBe(-30);
    expect(dimensionGeometry(g).p1.x).toBe(362);
  });

  it('honours a negative offset and still pulls it inside', () => {
    // negative offset: below the run (side top flipped); room below y=120 is 170
    const g = fitDimension({ ...run, side: 'top', offset: -500 }, box);
    expect(g.offset).toBe(-170);
  });

  it('does what it can when neither side has room', () => {
    const cramped = { width: 400, height: 40 };
    const g = fitDimension(
      { from: { x: 100, y: 20 }, to: { x: 300, y: 20 }, side: 'top', offset: 30 },
      cramped,
    );
    expect(g.offset).toBe(10);
  });
});

describe('routeBetween', () => {
  it('is one segment when straight', () => {
    expect(routeBetween({ x: 0, y: 0 }, { x: 10, y: 5 }, 'straight')).toHaveLength(2);
  });

  it('runs diagonal first, then along the longer axis', () => {
    const [a, knee, b] = routeBetween({ x: 0, y: 0 }, { x: 100, y: 40 }, 'elbow');
    expect(a).toEqual({ x: 0, y: 0 });
    expect(knee).toEqual({ x: 40, y: 40 });
    expect(b).toEqual({ x: 100, y: 40 });
    const v = routeBetween({ x: 0, y: 0 }, { x: -30, y: -90 }, 'elbow');
    expect(v[1]).toEqual({ x: -30, y: -30 });
  });

  it('does not bend an aligned or already 45 degree line', () => {
    expect(routeBetween({ x: 0, y: 0 }, { x: 50, y: 0 }, 'elbow')).toHaveLength(2);
    expect(routeBetween({ x: 0, y: 0 }, { x: 30, y: 30 }, 'elbow')).toHaveLength(2);
  });
});

describe('pointOnRing', () => {
  it('lies on the circle toward the target', () => {
    const p = pointOnRing({ x: 10, y: 10 }, 5, { x: 110, y: 10 });
    expect(p).toEqual({ x: 15, y: 10 });
  });
});

describe('dimensionGeometry', () => {
  it('puts a horizontal dimension line above the object by default', () => {
    const g = dimensionGeometry({ from: { x: 100, y: 200 }, to: { x: 300, y: 200 }, offset: 24 });
    near(g.p1.y, 176);
    near(g.p2.y, 176);
    expect(g.p1.x).toBe(100);
    expect(g.p2.x).toBe(300);
    expect(g.length).toBe(200);
    expect(g.normal.y).toBeLessThan(0);
  });

  it('can sit below', () => {
    const g = dimensionGeometry({
      from: { x: 100, y: 200 },
      to: { x: 300, y: 200 },
      offset: 24,
      side: 'bottom',
    });
    near(g.p1.y, 224);
  });

  it('sits to the left of a vertical measurement and rotates its label to read upward', () => {
    const g = dimensionGeometry({
      from: { x: 200, y: 100 },
      to: { x: 200, y: 300 },
      offset: 20,
      side: 'left',
      labelWidth: 40,
    });
    near(g.p1.x, 180);
    near(g.p2.x, 180);
    near(g.labelAngle, -90);
  });

  it('draws extension lines from just off the object to just past the dimension line', () => {
    const g = dimensionGeometry({
      from: { x: 100, y: 200 },
      to: { x: 300, y: 200 },
      offset: 30,
      extGap: 4,
      extOver: 6,
    });
    const [e1] = g.ext;
    near(e1[0].y, 196);
    near(e1[1].y, 164);
  });

  it('breaks the line around a label that fits', () => {
    const g = dimensionGeometry({
      from: { x: 0, y: 100 },
      to: { x: 400, y: 100 },
      offset: 20,
      labelWidth: 50,
      labelGap: 6,
    });
    expect(g.labelInline).toBe(true);
    expect(g.segments).toHaveLength(2);
    const [left, right] = g.segments;
    if (!left || !right) throw new Error('segments');
    near(left[1].x, 200 - 31);
    near(right[0].x, 200 + 31);
  });

  it('keeps one piece, and puts the label beside it, when the label does not fit', () => {
    const g = dimensionGeometry({
      from: { x: 0, y: 100 },
      to: { x: 40, y: 100 },
      offset: 20,
      labelWidth: 60,
    });
    expect(g.labelInline).toBe(false);
    expect(g.segments).toHaveLength(1);
    const beside = labelBeside(g, 10);
    expect(beside.y).toBeLessThan(g.labelAt.y);
  });

  it('points arrowheads outward with their tips on the line ends', () => {
    const g = dimensionGeometry({ from: { x: 0, y: 100 }, to: { x: 100, y: 100 }, offset: 20, arrow: 8 });
    const [a1, a2] = g.arrows;
    expect(a1.tip).toEqual(g.p1);
    expect(a2.tip).toEqual(g.p2);
    near(a1.a.x, 8);
    near(a2.a.x, 92);
  });

  it('flips with a negative offset', () => {
    const up = dimensionGeometry({ from: { x: 0, y: 100 }, to: { x: 100, y: 100 }, offset: 20 });
    const down = dimensionGeometry({ from: { x: 0, y: 100 }, to: { x: 100, y: 100 }, offset: -20 });
    near(up.p1.y, 80);
    near(down.p1.y, 120);
  });
});

describe('readableAngle', () => {
  it('never reads upside down', () => {
    near(readableAngle({ x: 1, y: 0 }), 0);
    near(readableAngle({ x: -1, y: 0 }), 0);
    near(readableAngle({ x: 0, y: 1 }), -90);
    near(readableAngle({ x: 0, y: -1 }), -90);
    near(readableAngle({ x: Math.SQRT1_2, y: Math.SQRT1_2 }), 45);
    near(readableAngle({ x: -Math.SQRT1_2, y: Math.SQRT1_2 }), -45);
  });
});

describe('rulerTicks', () => {
  it('places a tick every step with every fifth major', () => {
    const t = rulerTicks(100, 10, 5);
    expect(t).toHaveLength(11);
    expect(t[0]).toEqual({ index: 0, at: 0, major: true });
    expect(t[5]).toMatchObject({ at: 50, major: true });
    expect(t[3]).toMatchObject({ at: 30, major: false });
    expect(t[10]).toMatchObject({ at: 100, major: true });
  });

  it('does not invent a tick past the end', () => {
    const t = rulerTicks(95, 10, 5);
    expect(t[t.length - 1]?.at).toBe(90);
  });

  it('tolerates float steps and bad input', () => {
    expect(rulerTicks(1, 0.1, 5)).toHaveLength(11);
    expect(rulerTicks(100, 0)).toEqual([]);
    expect(rulerTicks(-5, 10)).toEqual([]);
  });
});

describe('tickPath', () => {
  it('draws a vertical stroke per tick of the right length', () => {
    const d = tickPath({
      x: 10,
      y: 20,
      length: 20,
      orientation: 'horizontal',
      step: 10,
      majorEvery: 2,
      minorLength: 4,
      majorLength: 8,
      side: 'down',
    });
    // ticks at 0 (major), 10 (minor), 20 (major); x values are pixel centres
    expect(d).toBe('M10.5 20.5V28.5M20.5 20.5V24.5M30.5 20.5V28.5');
  });

  it('stands ticks off the other side with up', () => {
    const d = tickPath({
      x: 0,
      y: 50,
      length: 10,
      orientation: 'horizontal',
      step: 10,
      majorEvery: 1,
      majorLength: 6,
      side: 'up',
    });
    expect(d.startsWith('M0.5 50.5V44.5')).toBe(true);
  });

  it('draws horizontal strokes for a vertical ruler', () => {
    const d = tickPath({
      x: 5,
      y: 0,
      length: 10,
      orientation: 'vertical',
      step: 10,
      majorEvery: 5,
      minorLength: 3,
      majorLength: 7,
      side: 'right',
    });
    // tick 0 is major (7 long), tick 1 is minor (3 long)
    expect(d).toBe('M5.5 0.5H12.5M5.5 10.5H8.5');
  });
});

describe('crosshairGeometry', () => {
  it('makes four arms', () => {
    const g = crosshairGeometry({ x: 50, y: 50, size: 12 });
    expect(g.ring).toBeNull();
    expect(g.arms.split('M').length - 1).toBe(4);
  });

  it('adds a ring and a centre dot for a reticle', () => {
    const g = crosshairGeometry({ x: 50, y: 50, size: 16, ring: true });
    expect(g.ring).toMatchObject({ r: 8 });
    expect(g.dot).toMatchObject({ cx: 50.5, cy: 50.5 });
  });
});

describe('fractions and helpers', () => {
  it('converts fractions to pixels and back', () => {
    const box = { width: 400, height: 200 };
    expect(toPx([0.25, 0.5], box)).toEqual({ x: 100, y: 100 });
    expect(toFraction({ x: 100, y: 100 }, box)).toEqual([0.25, 0.5]);
    expect(toFraction({ x: -10, y: 500 }, box)).toEqual([0, 1]);
    expect(toFraction({ x: 1, y: 1 }, { width: 0, height: 0 })).toEqual([0, 0]);
  });

  it('prefers the open side', () => {
    expect(defaultSide([0.1, 0.2])).toBe('tl');
    expect(defaultSide([0.9, 0.8])).toBe('br');
  });

  it('snaps to pixel centres', () => {
    expect(crisp(10)).toBe(10.5);
    expect(crisp(10.4)).toBe(10.5);
    expect(crisp(10.6)).toBe(10.5);
    expect(crisp(11.2)).toBe(11.5);
  });

  it('estimates mono width and formats paths', () => {
    near(monoWidth('120 px', 10), 36);
    expect(
      polyline([
        { x: 1, y: 2 },
        { x: 3.456, y: 4 },
      ]),
    ).toBe('M1 2L3.46 4');
  });
});
