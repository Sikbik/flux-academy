import { describe, expect, it } from 'vitest';
import { chamferRectPath, gemFacets, HEX_ASPECT, planCard, plural } from './geometry';

describe('chamferRectPath', () => {
  it('is a closed eight-sided outline inside its rectangle', () => {
    const d = chamferRectPath(10, 20, 200, 100, 20, 6);
    expect(d.startsWith('M10 26')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/L/g)).toHaveLength(7);
    // Every coordinate stays inside the rectangle.
    const nums = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    for (const [x, y] of nums) {
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(210);
      expect(y).toBeGreaterThanOrEqual(20);
      expect(y).toBeLessThanOrEqual(120);
    }
  });

  it('shrinks the cuts for a small rectangle instead of folding over', () => {
    const d = chamferRectPath(0, 0, 30, 24, 40, 12);
    const nums = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    for (const [x, y] of nums) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(30);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(24);
    }
  });
});

describe('gemFacets', () => {
  it('draws three faces that meet at the centre', () => {
    const f = gemFacets(20);
    for (const face of [f.top, f.left, f.right]) {
      expect(face.startsWith('M0 0')).toBe(true);
      expect(face.endsWith('Z')).toBe(true);
    }
  });

  it('keeps the faces inside the hexagon of that radius', () => {
    const r = 27;
    const f = gemFacets(r);
    const nums = [...`${f.top}${f.left}${f.right}`.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(
      (m) => [Number(m[1]), Number(m[2])],
    );
    for (const [x, y] of nums) {
      expect(Math.abs(x ?? 0)).toBeLessThanOrEqual(r * HEX_ASPECT + 0.01);
      expect(Math.abs(y ?? 0)).toBeLessThanOrEqual(r + 0.01);
    }
  });
});

describe('plural', () => {
  it('uses the singular for one only', () => {
    expect(plural(1, 'lesson', 'lessons')).toBe('1 lesson');
    expect(plural(0, 'lesson', 'lessons')).toBe('0 lessons');
    expect(plural(4, 'lesson', 'lessons')).toBe('4 lessons');
  });
});

describe('planCard', () => {
  const base = {
    requires: new Set<string>(),
    leadsTo: new Set<string>(),
    topLimit: 0,
    width: 1000,
    height: 600,
    radius: 27,
    cardWidth: 260,
    cardHeight: 300,
    labelSpace: 38,
  };

  it('returns null for an unknown lesson', () => {
    expect(planCard({ ...base, nodes: [{ id: 'a', x: 100, y: 100 }], activeId: 'zzz' })).toBeNull();
  });

  it('opens to the right of a lone node and stays inside the map', () => {
    const plan = planCard({ ...base, nodes: [{ id: 'a', x: 100, y: 300 }], activeId: 'a' });
    expect(plan?.side).toBe('right');
    expect(plan?.left).toBeGreaterThan(100);
    expect(plan?.left ?? 0).toBeGreaterThanOrEqual(8);
    expect((plan?.left ?? 0) + base.cardWidth).toBeLessThanOrEqual(base.width - 8);
    expect(plan?.top ?? 0).toBeGreaterThanOrEqual(8);
    expect((plan?.top ?? 0) + base.cardHeight).toBeLessThanOrEqual(base.height - 8);
  });

  it('opens to the left when a prerequisite sits on the right', () => {
    const nodes = [
      { id: 'a', x: 500, y: 300 },
      { id: 'pre', x: 620, y: 300 },
    ];
    const plan = planCard({ ...base, nodes, activeId: 'a', requires: new Set(['pre']) });
    expect(plan?.side).toBe('left');
    expect((plan?.left ?? 0) + base.cardWidth).toBeLessThan(500);
  });

  it('covers a lesson it leads to rather than one that helps before it', () => {
    // A prerequisite to the right and a dependant to the left: the card goes on the cheaper side.
    const nodes = [
      { id: 'a', x: 500, y: 300 },
      { id: 'pre', x: 620, y: 300 },
      { id: 'dep', x: 380, y: 300 },
    ];
    const plan = planCard({
      ...base,
      nodes,
      activeId: 'a',
      requires: new Set(['pre']),
      leadsTo: new Set(['dep']),
    });
    expect(plan?.side).toBe('left');
  });

  it('keeps the card under the top limit (band headers)', () => {
    const plan = planCard({ ...base, topLimit: 140, nodes: [{ id: 'a', x: 100, y: 150 }], activeId: 'a' });
    expect(plan?.top ?? 0).toBeGreaterThanOrEqual(148);
  });

  it('is deterministic', () => {
    const nodes = [
      { id: 'a', x: 300, y: 300 },
      { id: 'b', x: 420, y: 340 },
      { id: 'c', x: 180, y: 250 },
    ];
    const input = { ...base, nodes, activeId: 'a', requires: new Set(['c']), leadsTo: new Set(['b']) };
    expect(planCard(input)).toEqual(planCard(input));
  });
});
