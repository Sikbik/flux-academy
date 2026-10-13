import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CELL_W,
  cellCenter,
  cellOwnedEdges,
  createTile,
  driftSeconds,
  extent,
  hexVertices,
  LIT_LAYERS,
  LIT_SCALE,
  litCells,
  mulberry32,
  neighbours,
  pickLitCells,
  ROW_PITCH,
  snapDpr,
  tileEdges,
  wrapCell,
} from './lattice';

const key = (x: number, y: number, w: number, h: number) => `${((x % w) + w) % w},${((y % h) + h) % h}`;

describe('createTile', () => {
  it('has whole-pixel periods and an even row count', () => {
    const t = createTile(8, 6);
    expect(t).toEqual({ cols: 8, rows: 6, width: 384, height: 252 });
    expect(createTile(5, 5).rows).toBe(6);
    expect(createTile(1, 1).cols).toBeGreaterThanOrEqual(3);
  });

  it('stays a whole number of device pixels at every quarter-step ratio', () => {
    const t = createTile();
    for (const dpr of [1, 1.25, 1.5, 1.75, 2]) {
      expect(Number.isInteger(t.width * dpr)).toBe(true);
      expect(Number.isInteger(t.height * dpr)).toBe(true);
    }
  });
});

describe('cells and edges', () => {
  it('shifts odd rows half a cell', () => {
    expect(cellCenter(0, 0).x).toBe(CELL_W / 2);
    expect(cellCenter(0, 1).x).toBe(CELL_W);
    expect(cellCenter(0, 1).y - cellCenter(0, 0).y).toBe(ROW_PITCH);
  });

  it('draws every edge of the lattice exactly once', () => {
    const t = createTile(8, 6);
    const edges = tileEdges(t);
    expect(edges).toHaveLength(3 * t.cols * t.rows);
    // Normalise each edge modulo the period; with exactly one owner per edge the keys are unique.
    const keys = new Set<string>();
    for (const e of edges) {
      const a = key(e.x1, e.y1, t.width, t.height);
      const b = key(e.x2, e.y2, t.width, t.height);
      keys.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
    expect(keys.size).toBe(edges.length);
  });

  it('closes the lattice: two vertices per cell on the torus', () => {
    const t = createTile(8, 6);
    const verts = new Set<string>();
    for (const e of tileEdges(t)) {
      verts.add(key(e.x1, e.y1, t.width, t.height));
      verts.add(key(e.x2, e.y2, t.width, t.height));
    }
    expect(verts.size).toBe(2 * t.cols * t.rows);
  });

  it('is periodic: a cell one period over owns the same edges, shifted', () => {
    const t = createTile(8, 6);
    const a = cellOwnedEdges(3, 2);
    const b = cellOwnedEdges(3 + t.cols, 2 + t.rows);
    a.forEach((e, i) => {
      const f = b[i];
      expect(f?.x1).toBe(e.x1 + t.width);
      expect(f?.y1).toBe(e.y1 + t.height);
      expect(f?.x2).toBe(e.x2 + t.width);
      expect(f?.y2).toBe(e.y2 + t.height);
    });
  });

  it('shares edges between neighbours (the six vertices touch the next cell)', () => {
    const c = cellCenter(2, 2);
    const n = cellCenter(3, 2);
    const v = hexVertices(c.x, c.y);
    const w = hexVertices(n.x, n.y);
    // Right vertical edge of the left cell is the left vertical edge of the right cell.
    expect(v[1]?.x).toBe(w[5]?.x);
    expect(v[2]?.x).toBe(w[4]?.x);
  });
});

describe('neighbours and wrapping', () => {
  it('gives six distinct neighbours that all list the cell back', () => {
    for (const [c, r] of [
      [4, 4],
      [4, 5],
    ] as const) {
      const ns = neighbours(c, r);
      expect(new Set(ns.map((n) => `${n.c},${n.r}`)).size).toBe(6);
      for (const n of ns) {
        expect(neighbours(n.c, n.r).some((m) => m.c === c && m.r === r)).toBe(true);
      }
    }
  });

  it('wraps into the period', () => {
    expect(wrapCell(8, 6, -1, -1)).toEqual({ c: 7, r: 5 });
    expect(wrapCell(8, 6, 8, 6)).toEqual({ c: 0, r: 0 });
  });
});

describe('lit cells', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    expect(pickLitCells(16, 12, 6, 7)).toEqual(pickLitCells(16, 12, 6, 7));
    expect(pickLitCells(16, 12, 6, 7)).not.toEqual(pickLitCells(16, 12, 6, 8));
  });

  it('keeps cells apart, across the period wrap too', () => {
    for (const spec of LIT_LAYERS) {
      const cells = litCells(spec);
      const set = new Set(cells.map((p) => `${p.c},${p.r}`));
      expect(set.size).toBe(cells.length);
      for (const p of cells) {
        for (const n of neighbours(p.c, p.r)) {
          const w = wrapCell(spec.cols, spec.rows, n.c, n.r);
          expect(set.has(`${w.c},${w.r}`)).toBe(false);
        }
        expect(p.c).toBeGreaterThanOrEqual(0);
        expect(p.c).toBeLessThan(spec.cols);
        expect(p.r).toBeLessThan(spec.rows);
        expect(p.k).toBeGreaterThanOrEqual(0.55);
        expect(p.k).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is sparse', () => {
    for (const spec of LIT_LAYERS) {
      const share = litCells(spec).length / (spec.cols * spec.rows);
      expect(share).toBeGreaterThan(0.01);
      expect(share).toBeLessThan(0.04);
    }
  });

  it('shares one drift velocity: every period is parallel to the hairline tile', () => {
    const hair = createTile(8, 6);
    for (const spec of LIT_LAYERS) {
      const t = createTile(spec.cols, spec.rows);
      expect(t.width / hair.width).toBeCloseTo(t.height / hair.height, 10);
      expect(Number.isInteger(t.width / hair.width)).toBe(true);
      // The loop times then follow, all at the same px/s.
      expect(t.width / driftSeconds(t.width)).toBeCloseTo(hair.width / driftSeconds(hair.width), 8);
    }
  });

  it('draws numbers that stay in [0, 1)', () => {
    const r = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('sizing', () => {
  it('covers the view plus one period in steps of four', () => {
    expect(extent(1920, 384)).toBe(2304);
    expect(extent(1921, 384)).toBe(2308);
    expect(extent(390, 384) % 4).toBe(0);
    expect(extent(390, 384)).toBeGreaterThanOrEqual(390 + 384);
  });

  it('snaps the density to quarter steps within the cap and the budget', () => {
    expect(snapDpr(1, 2304, 1332)).toBe(1);
    expect(snapDpr(1.3, 1000, 800)).toBe(1.25);
    expect(snapDpr(3, 1000, 800)).toBe(2);
    const big = snapDpr(2, 2304, 1332);
    expect(big).toBeLessThan(2);
    expect(2304 * 1332 * big * big).toBeLessThanOrEqual(7_000_000);
    expect(snapDpr(0.5, 100, 100)).toBe(1);
  });

  it('keeps every lit period a whole number of bitmap pixels', () => {
    for (const spec of LIT_LAYERS) {
      const t = createTile(spec.cols, spec.rows);
      expect(Number.isInteger(t.width * LIT_SCALE)).toBe(true);
      expect(Number.isInteger(t.height * LIT_SCALE)).toBe(true);
    }
  });
});

describe('the stylesheet agrees with the geometry', () => {
  const css = readFileSync(new URL('./Backdrop.module.css', import.meta.url), 'utf8');

  it('drifts each layer by exactly one period', () => {
    const tiles = [createTile(8, 6), ...LIT_LAYERS.map((s) => createTile(s.cols, s.rows))];
    for (const t of tiles) {
      expect(css).toContain(`translate3d(-${t.width}px, -${t.height}px, 0)`);
    }
  });
});
