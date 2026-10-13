/**
 * The geometry behind the Backdrop: a pointy-top hexagonal lattice whose periods are whole
 * pixels, so a pre-rendered tile repeats without a seam and a CSS drift over exactly one
 * period loops without a jump. Pure functions only; the canvas work lives in paint.ts.
 *
 * A cell is 48 wide and 56 tall (side 28) on a 42 px row pitch, odd rows shifted half a cell.
 * A regular hexagon with side 28 is 48.5 wide; 48 keeps every period an integer and is 1 %
 * off regular, which the eye cannot see at hairline weight.
 */

export const CELL_W = 48;
export const SIDE = 28;
export const CELL_H = 56;
export const ROW_PITCH = 42;

export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Cell {
  c: number;
  r: number;
}

/** A lit cell: its place in the period, and how strongly it glows (0.55 to 1). */
export interface LitCell extends Cell {
  k: number;
}

/** A repeating block of the lattice. `rows` is always even so the half-cell offset repeats. */
export interface Tile {
  cols: number;
  rows: number;
  /** Period in px. */
  width: number;
  height: number;
}

export function createTile(cols = 8, rows = 6): Tile {
  const c = Math.max(3, Math.round(cols));
  const r = Math.max(2, Math.ceil(Math.round(rows) / 2) * 2);
  return { cols: c, rows: r, width: c * CELL_W, height: r * ROW_PITCH };
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

export function cellCenter(c: number, r: number): Point {
  return {
    x: c * CELL_W + CELL_W / 2 + (mod(r, 2) === 1 ? CELL_W / 2 : 0),
    y: r * ROW_PITCH + SIDE,
  };
}

/** Six vertices, clockwise from the top. `scale` shrinks or grows the cell about its centre. */
export function hexVertices(cx: number, cy: number, scale = 1): Point[] {
  const hw = (CELL_W / 2) * scale;
  const s = SIDE * scale;
  return [
    { x: cx, y: cy - s },
    { x: cx + hw, y: cy - s / 2 },
    { x: cx + hw, y: cy + s / 2 },
    { x: cx, y: cy + s },
    { x: cx - hw, y: cy + s / 2 },
    { x: cx - hw, y: cy - s / 2 },
  ];
}

/**
 * The three edges a cell draws: upper left, upper right and right. Every edge of the lattice
 * is then drawn by exactly one cell (the other three belong to the neighbours).
 */
export function cellOwnedEdges(c: number, r: number): Segment[] {
  const { x, y } = cellCenter(c, r);
  const v = hexVertices(x, y) as [Point, Point, Point, Point, Point, Point];
  const seg = (a: Point, b: Point): Segment => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  return [seg(v[5], v[0]), seg(v[0], v[1]), seg(v[1], v[2])];
}

/** Every owned edge of every cell in the tile: 3 * cols * rows segments. */
export function tileEdges(tile: Tile): Segment[] {
  const out: Segment[] = [];
  for (let r = 0; r < tile.rows; r++) {
    for (let c = 0; c < tile.cols; c++) out.push(...cellOwnedEdges(c, r));
  }
  return out;
}

/** The six neighbours of a cell in the odd-row layout (not wrapped). */
export function neighbours(c: number, r: number): Cell[] {
  const odd = mod(r, 2) === 1;
  const side = odd ? 1 : -1;
  return [
    { c: c - 1, r },
    { c: c + 1, r },
    { c: c + side, r: r - 1 },
    { c, r: r - 1 },
    { c: c + side, r: r + 1 },
    { c, r: r + 1 },
  ];
}

/** Maps any cell to its representative inside the tile. */
export function wrapCell(cols: number, rows: number, c: number, r: number): Cell {
  return { c: mod(c, cols), r: mod(r, rows) };
}

/** A small, fast, seedable generator (mulberry32). Same seed, same sequence, everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks `count` lit cells in a `cols` x `rows` period: deterministic for a seed, no two
 * adjacent (across the period wrap too), so the field stays sparse. Fewer are returned when
 * the lattice cannot hold that many apart.
 */
export function pickLitCells(cols: number, rows: number, count: number, seed: number): LitCell[] {
  const rand = mulberry32(seed);
  const total = cols * rows;
  const order = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = order[i] as number;
    order[i] = order[j] as number;
    order[j] = a;
  }
  const blocked = new Set<number>();
  const out: LitCell[] = [];
  for (const idx of order) {
    if (out.length >= count) break;
    if (blocked.has(idx)) continue;
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    out.push({ c, r, k: 0.55 + 0.45 * rand() });
    blocked.add(idx);
    for (const n of neighbours(c, r)) {
      const w = wrapCell(cols, rows, n.c, n.r);
      blocked.add(w.r * cols + w.c);
    }
  }
  return out;
}

export interface LitLayerSpec {
  cols: number;
  rows: number;
  /** Share of the cells that are lit, 0..1. */
  density: number;
  seed: number;
}

/**
 * Three breathing layers. Each period is a whole multiple of the hairline tile (cols = 4k,
 * rows = 3k keeps it parallel to the 8 x 6 tile), so all layers drift at the same velocity
 * and stay registered to the lines. Different periods keep the lit cells from repeating in an
 * obvious grid.
 */
export const LIT_LAYERS: readonly LitLayerSpec[] = [
  { cols: 24, rows: 18, density: 0.016, seed: 0x1f3a },
  { cols: 32, rows: 24, density: 0.014, seed: 0x7c11 },
  { cols: 40, rows: 30, density: 0.012, seed: 0x2b97 },
];

export function litCells(spec: LitLayerSpec): LitCell[] {
  return pickLitCells(
    spec.cols,
    spec.rows,
    Math.max(1, Math.round(spec.cols * spec.rows * spec.density)),
    spec.seed,
  );
}

/** Slow enough to read as weather, not motion: px per second along the diagonal's x axis. */
export const DRIFT_SPEED = 1.5;

/** Seconds for one loop of a period at `speed` times the base drift. */
export function driftSeconds(period: number, speed = 1): number {
  return period / (DRIFT_SPEED * Math.max(speed, 1e-6));
}

/**
 * Steps for a CSS `steps()` timing function that ticks `fps` times a second over `seconds`
 * (split across `intervals` keyframe segments, each of which gets its own `steps()`).
 */
export function stepsFor(seconds: number, fps: number, intervals = 1): number {
  return Math.max(1, Math.round((seconds / intervals) * fps));
}

/** The smallest multiple of `step` px that covers the view plus one period. */
export function extent(view: number, period: number, step = 4): number {
  return Math.ceil((view + period) / step) * step;
}

/** Device pixel budget for the hairline canvas (about 28 MB at 4 bytes a pixel). */
export const PIXEL_BUDGET = 7_000_000;

/**
 * The device pixel ratio to paint the hairlines at: capped at 2, floored to a quarter step
 * (so a period is a whole number of device pixels) and reduced until the canvas fits the
 * budget. Never below 1.
 */
export function snapDpr(dpr: number, cssW: number, cssH: number, budget = PIXEL_BUDGET, cap = 2): number {
  let d = Math.floor(Math.min(Math.max(dpr, 1), cap) * 4) / 4;
  while (d > 1 && cssW * cssH * d * d > budget) d -= 0.25;
  return Math.max(1, d);
}

/**
 * Device pixels per CSS pixel for a lit canvas. The glow is a soft gradient inside crisp
 * hairlines, so half resolution is invisible at any display density and a quarter of the
 * memory. Every layer period times this is a whole number of pixels.
 */
export const LIT_SCALE = 0.5;
