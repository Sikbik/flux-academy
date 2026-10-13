import { describe, expect, it } from 'vitest';
import { placeCard, placeRing, RING_RADIUS } from './ring';

const box = { width: 1000, height: 700 };

describe('placeRing', () => {
  it('goes up and to the right of a target with room', () => {
    const p = placeRing({ x: 300, y: 300, w: 120, h: 40 }, box);
    expect(p.ring.x).toBeGreaterThan(p.anchor.x);
    expect(p.ring.y).toBeLessThan(p.anchor.y);
    expect(p.labelSide).toBe('right');
  });

  it('flips left at the right edge and below at the top edge', () => {
    const right = placeRing({ x: 900, y: 300, w: 90, h: 30 }, box);
    expect(right.ring.x).toBeLessThan(right.anchor.x);
    expect(right.labelSide).toBe('left');
    const top = placeRing({ x: 300, y: 6, w: 120, h: 30 }, box);
    expect(top.ring.y).toBeGreaterThan(top.anchor.y);
  });

  it('keeps the ring inside the box and clear of rings already placed', () => {
    const taken = [placeRing({ x: 300, y: 300, w: 120, h: 40 }, box).ring];
    const second = placeRing({ x: 310, y: 306, w: 120, h: 40 }, box, taken);
    expect(
      Math.hypot(second.ring.x - (taken[0]?.x ?? 0), second.ring.y - (taken[0]?.y ?? 0)),
    ).toBeGreaterThanOrEqual(RING_RADIUS * 2);
    const lo = RING_RADIUS;
    expect(second.ring.x).toBeGreaterThanOrEqual(lo);
    expect(second.ring.x).toBeLessThanOrEqual(box.width - lo);
    expect(second.ring.y).toBeGreaterThanOrEqual(lo);
    expect(second.ring.y).toBeLessThanOrEqual(box.height - lo);
  });

  it('skips positions that sit on content, and falls back when all do', () => {
    const target = { x: 300, y: 300, w: 120, h: 40 };
    const free = placeRing(target, box);
    const dodged = placeRing(
      target,
      box,
      [],
      42,
      (p) => Math.hypot(p.x - free.ring.x, p.y - free.ring.y) < 8,
    );
    expect(Math.hypot(dodged.ring.x - free.ring.x, dodged.ring.y - free.ring.y)).toBeGreaterThan(8);
    const stuck = placeRing(target, box, [], 42, () => true);
    expect(stuck.ring).toEqual(free.ring);
  });

  it('clamps when nothing fits', () => {
    const tiny = placeRing({ x: 0, y: 0, w: 20, h: 20 }, { width: 50, height: 50 });
    expect(tiny.ring.x).toBeGreaterThanOrEqual(0);
    expect(tiny.ring.y).toBeGreaterThanOrEqual(0);
  });
});

describe('placeCard', () => {
  it('sits below the ring when it fits', () => {
    const c = placeCard({ x: 200, y: 100 }, { width: 280, height: 120 }, box);
    expect(c.above).toBe(false);
    expect(c.y).toBeGreaterThan(100);
  });

  it('moves above near the bottom and stays inside horizontally', () => {
    const c = placeCard({ x: 980, y: 660 }, { width: 280, height: 120 }, box);
    expect(c.above).toBe(true);
    expect(c.y).toBeLessThan(660);
    expect(c.x + 280).toBeLessThanOrEqual(box.width);
  });
});
