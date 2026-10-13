import { LESSONS, TRACKS } from '@shared/curriculum';
import { describe, expect, it } from 'vitest';
import {
  ancestorsOf,
  checkLayout,
  dependantsOf,
  EDGE_CLEARANCE,
  type LayoutLesson,
  layoutCourse,
  NODE_GAP,
  roundedPath,
} from './layout';

const TRACK_IDS = TRACKS.map((t) => t.id);
/** The across-flow distance of two rows on a phone (VERTICAL_DEFAULTS.pitchV). */
const VERTICAL_PITCH = 66;

/** Distance from a point to a segment, written independently of the implementation under test. */
function dist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function lesson(
  id: string,
  track: string,
  module: string,
  order: number,
  prerequisites: string[] = [],
): LayoutLesson {
  return { id, track, module, order, prerequisites };
}

describe('layoutCourse: the real curriculum', () => {
  for (const orientation of ['horizontal', 'vertical'] as const) {
    describe(orientation, () => {
      const layout = layoutCourse(LESSONS, TRACK_IDS, { orientation });

      it('places every lesson exactly once, inside the canvas', () => {
        expect(layout.nodes.map((n) => n.id).sort()).toEqual(LESSONS.map((l) => l.id).sort());
        for (const n of layout.nodes) {
          expect(n.x - layout.radius).toBeGreaterThanOrEqual(0);
          expect(n.y - layout.radius).toBeGreaterThanOrEqual(0);
          expect(n.x + layout.radius).toBeLessThanOrEqual(layout.width);
          expect(n.y + layout.radius).toBeLessThanOrEqual(layout.height);
        }
      });

      it('has no overlaps and no edge through a lesson it does not join (checked independently)', () => {
        expect(layout.problems).toEqual([]);
        expect(checkLayout(layout)).toEqual([]);
        const r = layout.radius;
        for (let i = 0; i < layout.nodes.length; i++) {
          for (let j = i + 1; j < layout.nodes.length; j++) {
            const a = layout.nodes[i];
            const b = layout.nodes[j];
            if (!a || !b) continue;
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * r + NODE_GAP);
          }
        }
        for (const e of layout.edges) {
          for (const n of layout.nodes) {
            if (n.id === e.from || n.id === e.to) continue;
            for (let i = 0; i + 1 < e.points.length; i++) {
              const a = e.points[i];
              const b = e.points[i + 1];
              if (!a || !b) continue;
              expect(dist(n.x, n.y, a.x, a.y, b.x, b.y)).toBeGreaterThanOrEqual(r + EDGE_CLEARANCE);
            }
          }
        }
      });

      it('draws one edge per prerequisite and ends each at its two lessons', () => {
        const expected = LESSONS.flatMap((l) => l.prerequisites.map((p) => `${p}>${l.id}`)).sort();
        expect(layout.edges.map((e) => e.id).sort()).toEqual(expected);
        const at = new Map(layout.nodes.map((n) => [n.id, n]));
        for (const e of layout.edges) {
          const from = at.get(e.from);
          const to = at.get(e.to);
          expect(e.points[0]).toEqual({ x: from?.x, y: from?.y });
          expect(e.points[e.points.length - 1]).toEqual({ x: to?.x, y: to?.y });
          expect(e.backward).toBe(false);
          expect(e.path.startsWith('M')).toBe(true);
        }
      });

      it('keeps the bands in track order along the flow', () => {
        const key = (n: { x: number; y: number }) => (orientation === 'horizontal' ? n.x : n.y);
        const spans = TRACK_IDS.map((t) => {
          const ks = layout.nodes.filter((n) => n.track === t).map(key);
          return { min: Math.min(...ks), max: Math.max(...ks) };
        });
        for (let i = 0; i + 1 < spans.length; i++) {
          expect((spans[i] as { max: number }).max).toBeLessThan((spans[i + 1] as { min: number }).min);
        }
        expect(layout.bands.map((b) => b.track)).toEqual(TRACK_IDS);
      });

      it('puts a lesson after its in-band prerequisites', () => {
        const at = new Map(layout.nodes.map((n) => [n.id, n]));
        for (const l of LESSONS) {
          for (const p of l.prerequisites) {
            const a = at.get(p);
            const b = at.get(l.id);
            if (!a || !b) continue;
            expect(b.col).toBeGreaterThan(a.col);
          }
        }
      });

      it('groups every module', () => {
        const ids = new Set(LESSONS.map((l) => `${l.track}|${l.module}`));
        expect(new Set(layout.modules.map((m) => m.id))).toEqual(ids);
        for (const m of layout.modules) {
          const count = LESSONS.filter((l) => `${l.track}|${l.module}` === m.id).length;
          expect(m.nodeIds).toHaveLength(count);
          expect(m.box.width).toBeGreaterThan(0);
        }
      });

      it('is deterministic', () => {
        const again = layoutCourse(LESSONS, TRACK_IDS, { orientation });
        expect(JSON.stringify(again)).toEqual(JSON.stringify(layout));
        const reversed = layoutCourse([...LESSONS].reverse(), TRACK_IDS, { orientation });
        expect(JSON.stringify(reversed)).toEqual(JSON.stringify(layout));
      });
    });
  }

  it('fits a 390 px phone without scaling down, and stays a reasonable height', () => {
    const v = layoutCourse(LESSONS, TRACK_IDS, { orientation: 'vertical' });
    expect(v.width).toBeLessThanOrEqual(390 - 32);
    expect(v.height).toBeLessThan(1100);
  });

  it('is about the width of the page container on a desktop', () => {
    const h = layoutCourse(LESSONS, TRACK_IDS, { orientation: 'horizontal' });
    expect(h.width).toBeGreaterThan(1000);
    expect(h.width).toBeLessThan(1400);
    expect(h.height).toBeLessThan(720);
  });

  it('gives every band room for its header, with the columns centred in it', () => {
    const h = layoutCourse(LESSONS, TRACK_IDS, { orientation: 'horizontal', minBandSize: 400 });
    expect(h.problems).toEqual([]);
    for (const b of h.bands) {
      expect(b.width).toBeGreaterThanOrEqual(400);
      const xs = h.nodes.filter((n) => n.track === b.track).map((n) => n.x);
      const left = Math.min(...xs) - h.radius - b.x;
      const right = b.x + b.width - (Math.max(...xs) + h.radius);
      expect(Math.abs(left - right)).toBeLessThan(1);
    }
  });
});

describe('layoutCourse: stacked bands', () => {
  it('centres each band across the shared width, so a narrow band does not hug the left edge', () => {
    const v = layoutCourse(LESSONS, TRACK_IDS, { orientation: 'vertical' });
    expect(v.problems).toEqual([]);
    const middle = v.width / 2;
    for (const b of v.bands) {
      const xs = v.nodes.filter((n) => n.track === b.track).map((n) => n.x);
      const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
      // Within one column pitch of the middle (rows are relaxed, not snapped, so not exact).
      expect(Math.abs(centre - middle)).toBeLessThan(VERTICAL_PITCH);
    }
  });

  it('only changes coordinates between orientations: the same lessons share a layer and a band', () => {
    const v = layoutCourse(LESSONS, TRACK_IDS, { orientation: 'vertical' });
    const h = layoutCourse(LESSONS, TRACK_IDS, { orientation: 'horizontal' });
    const layerOf = (l: typeof v) => new Map(l.nodes.map((n) => [n.id, `${n.track}:${n.layer}`]));
    expect(layerOf(v)).toEqual(layerOf(h));
  });
});

describe('layoutCourse: shapes', () => {
  it('handles a single lesson', () => {
    const l = layoutCourse([lesson('a', 't', 'm', 1)], ['t']);
    expect(l.nodes).toHaveLength(1);
    expect(l.edges).toHaveLength(0);
    expect(l.bands).toHaveLength(1);
    expect(l.problems).toEqual([]);
  });

  it('handles nothing at all', () => {
    const l = layoutCourse([], ['t']);
    expect(l.nodes).toEqual([]);
    expect(l.width).toBeGreaterThan(0);
  });

  it('lays a diamond out with the two middle lessons on either side of the axis', () => {
    const l = layoutCourse(
      [
        lesson('a', 't', 'm', 1),
        lesson('b', 't', 'n', 2, ['a']),
        lesson('c', 't', 'o', 3, ['a']),
        lesson('d', 't', 'm', 4, ['b', 'c']),
      ],
      ['t'],
    );
    expect(l.problems).toEqual([]);
    const at = new Map(l.nodes.map((n) => [n.id, n]));
    const a = at.get('a') as { y: number; x: number };
    const b = at.get('b') as { y: number };
    const c = at.get('c') as { y: number };
    const d = at.get('d') as { y: number; x: number };
    expect(Math.min(b.y, c.y)).toBeLessThan(a.y);
    expect(Math.max(b.y, c.y)).toBeGreaterThan(a.y);
    expect(d.x).toBeGreaterThan(a.x);
  });

  it('routes an edge that skips a whole band around the lessons in it', () => {
    const l = layoutCourse(
      [
        lesson('a', 'one', 'm', 1),
        lesson('b', 'two', 'm', 2, ['a']),
        lesson('c', 'two', 'm', 3, ['b']),
        lesson('d', 'two', 'n', 4, ['c']),
        lesson('e', 'three', 'm', 5, ['a', 'd']),
      ],
      ['one', 'two', 'three'],
    );
    expect(l.problems).toEqual([]);
    const long = l.edges.find((e) => e.id === 'a>e');
    expect(long?.span).toBeGreaterThan(2);
    expect(long?.points.length).toBeGreaterThan(2);
  });

  it('keeps lessons of one module together and modules in the same order down a band', () => {
    const l = layoutCourse(
      [
        lesson('a1', 't', 'A', 1),
        lesson('b1', 't', 'B', 2),
        lesson('a2', 't', 'A', 3),
        lesson('b2', 't', 'B', 4),
      ],
      ['t'],
    );
    expect(l.problems).toEqual([]);
    const row = (id: string) => l.nodes.find((n) => n.id === id)?.row ?? -1;
    // Everything is in layer 0: A's lessons sit above B's.
    expect(Math.max(row('a1'), row('a2'))).toBeLessThan(Math.min(row('b1'), row('b2')));
  });

  it('ignores prerequisites that do not exist, point at itself or run against the path order', () => {
    const l = layoutCourse(
      [lesson('a', 't', 'm', 1, ['ghost', 'a', 'b']), lesson('b', 't', 'm', 2, ['a'])],
      ['t'],
    );
    expect(l.edges.map((e) => e.id)).toEqual(['a>b']);
    expect(l.problems).toEqual([]);
  });

  it('appends tracks that are missing from the track order', () => {
    const l = layoutCourse([lesson('a', 'x', 'm', 1), lesson('b', 'y', 'm', 2, ['a'])], ['y']);
    expect(l.bands.map((b) => b.track)).toEqual(['y', 'x']);
  });
});

describe('roundedPath', () => {
  it('is a straight line for two points', () => {
    expect(
      roundedPath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 5 },
        ],
        8,
      ),
    ).toBe('M0 0L10 5');
  });

  it('rounds interior corners with quadratic curves', () => {
    const d = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      10,
    );
    expect(d).toBe('M0 0L90 0Q100 0 100 10L100 100');
  });

  it('clamps the radius to half of the adjacent segment', () => {
    const d = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      50,
    );
    expect(d).toBe('M0 0L5 0Q10 0 10 5L10 10');
  });
});

describe('prerequisite helpers', () => {
  const lessons: LayoutLesson[] = [
    lesson('a', 't', 'm', 1),
    lesson('b', 't', 'm', 2, ['a']),
    lesson('c', 't', 'm', 3, ['b']),
    lesson('d', 't', 'm', 4, ['a']),
  ];

  it('finds ancestors through chains', () => {
    expect([...ancestorsOf('c', lessons)].sort()).toEqual(['a', 'b']);
    expect([...ancestorsOf('a', lessons)]).toEqual([]);
  });

  it('finds direct dependants', () => {
    expect(dependantsOf('a', lessons).sort()).toEqual(['b', 'd']);
    expect(dependantsOf('c', lessons)).toEqual([]);
  });
});
