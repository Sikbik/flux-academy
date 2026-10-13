/**
 * The constellation layout: a deterministic, framework-free layered drawing of the curriculum.
 *
 * Input is plain lesson metadata (`shared/curriculum.ts`), output is pixel positions for nodes, edges,
 * bands and module groups. The same inputs always give the same picture (no randomness, no clocks).
 *
 *  1. Bands. Tracks are bands, left to right (top to bottom on a phone). A lesson's column inside its band
 *     is the length of its longest prerequisite chain that stays in the band, so every band starts at its
 *     own left edge and prerequisites in an earlier track never push a band wider.
 *  2. Long edges. An edge that skips columns (including a whole band) gets one dummy slot in every column
 *     it crosses. Dummies take space like nodes do (a smaller amount), so a line is routed through free
 *     space instead of through a lesson.
 *  3. Order. Each column is ordered by barycentre sweeps. Lessons of one module stay together (a block) and
 *     modules keep the same order in every column of a band, so a module reads as one group. Dummies slot
 *     between blocks.
 *  4. Rows. Rows are found by relaxing every item toward the mean of its neighbours subject to minimum
 *     separations (an isotonic fit per column), which centres children between parents and straightens
 *     long edges.
 *  5. Check. The result is verified: no two nodes overlap and no edge passes through a node it does not
 *     end at. If a check fails the dummy separations are widened and the layout is recomputed.
 *
 * Orientation `horizontal` flows left to right (bands side by side, headers above). `vertical` flows top to
 * bottom (bands stacked, a header strip at the top of each), for phones.
 */

export type Orientation = 'horizontal' | 'vertical';

export interface LayoutLesson {
  id: string;
  track: string;
  module: string;
  /** Position in the recommended path. Prerequisites always have a lower order. */
  order: number;
  prerequisites: readonly string[];
}

export interface LayoutOptions {
  orientation?: Orientation;
  /** Node circumradius, px. */
  radius?: number;
  /** Distance between columns (along the flow), px. */
  pitchU?: number;
  /** Distance between rows (across the flow) for two nodes, px. */
  pitchV?: number;
  /** Padding inside a band before its first column, as a fraction of `pitchU`. */
  bandPad?: number;
  /** Gap between the rectangles of two bands, px. */
  bandGap?: number;
  /** A band is never narrower than this along the flow, px (room for its header). Columns are centred. */
  minBandSize?: number;
  /** Height of the band header (horizontal) or of each band's header strip (vertical), px. */
  headerSize?: number;
  /** Space under a node for its label, px. Zero on a phone where labels are not shown. */
  labelSpace?: number;
  /** Outer padding, px. */
  padding?: number;
  /** Order lessons of the same module before others (default true). Off only in tests. */
  groupModules?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutNode {
  id: string;
  track: string;
  module: string;
  x: number;
  y: number;
  /** Column index across the whole map (0 is the first column of the first band). */
  col: number;
  /** Column index inside the band. */
  layer: number;
  /** Row coordinate in units of `pitchV` (abstract, orientation independent). */
  row: number;
}

export interface LayoutEdge {
  id: string;
  /** The prerequisite. */
  from: string;
  /** The lesson that benefits. */
  to: string;
  /** Centres of `from`, any dummy slots, and `to`. */
  points: Point[];
  /** SVG path data through `points` with rounded corners. */
  path: string;
  /** Columns crossed (1 is the next column). */
  span: number;
  /** True when the prerequisite sits in a later column than the lesson (a data oddity, drawn as an arc). */
  backward: boolean;
}

export interface LayoutBand {
  track: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The part of the rectangle taken by the header. */
  headerSize: number;
  nodeIds: string[];
}

export interface LayoutModule {
  /** `${track}|${module}`. */
  id: string;
  track: string;
  module: string;
  nodeIds: string[];
  /** Bounding box of the module's nodes grown by the node radius. */
  box: { x: number; y: number; width: number; height: number };
}

export interface LayoutProblem {
  kind: 'overlap' | 'edge-through-node' | 'module-split';
  message: string;
}

export interface CourseLayout {
  orientation: Orientation;
  width: number;
  height: number;
  radius: number;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  bands: LayoutBand[];
  modules: LayoutModule[];
  /** Problems found by the final check. Empty for the real curriculum. */
  problems: LayoutProblem[];
}

interface ResolvedOptions {
  orientation: Orientation;
  radius: number;
  pitchU: number;
  pitchV: number;
  bandPad: number;
  bandGap: number;
  minBandSize: number;
  headerSize: number;
  labelSpace: number;
  padding: number;
  groupModules: boolean;
}

export const HORIZONTAL_DEFAULTS: ResolvedOptions = {
  orientation: 'horizontal',
  radius: 27,
  pitchU: 136,
  pitchV: 96,
  bandPad: 0.62,
  bandGap: 14,
  minBandSize: 336,
  headerSize: 124,
  labelSpace: 38,
  padding: 14,
  groupModules: true,
};

export const VERTICAL_DEFAULTS: ResolvedOptions = {
  orientation: 'vertical',
  radius: 23,
  pitchU: 88,
  pitchV: 66,
  bandPad: 0.55,
  bandGap: 10,
  minBandSize: 0,
  headerSize: 40,
  labelSpace: 0,
  padding: 12,
  groupModules: true,
};

function resolve(options: LayoutOptions): ResolvedOptions {
  const base = options.orientation === 'vertical' ? VERTICAL_DEFAULTS : HORIZONTAL_DEFAULTS;
  return { ...base, ...stripUndefined(options) } as ResolvedOptions;
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

// ---------------------------------------------------------------------------
// Internal model
// ---------------------------------------------------------------------------

interface Item {
  key: string;
  kind: 'node' | 'dummy';
  col: number;
  lesson: LayoutLesson | null;
  moduleKey: string | null;
  /** Module rank inside the band (dummies: -1). */
  rank: number;
  order: number;
  /** Row coordinate, units of pitchV. */
  v: number;
  left: Item[];
  right: Item[];
  wLeft: number[];
  wRight: number[];
}

interface Column {
  track: string;
  layer: number;
  items: Item[];
}

interface Separation {
  /** Row distance (units of pitchV) from a node to a dummy placed below it: clears the label. */
  nodeToDummy: number;
  /** From a dummy to the node below it. */
  dummyToNode: number;
  dummyToDummy: number;
}

const BASE_SEPARATION: Separation = { nodeToDummy: 0.92, dummyToNode: 0.5, dummyToDummy: 0.3 };

/** Minimum row distance between two vertically adjacent items, `a` above `b`. */
function minSeparation(a: Item, b: Item, s: Separation): number {
  if (a.kind === 'node' && b.kind === 'node') return 1;
  if (a.kind === 'node') return s.nodeToDummy;
  if (b.kind === 'node') return s.dummyToNode;
  return s.dummyToDummy;
}

// ---------------------------------------------------------------------------
// The algorithm
// ---------------------------------------------------------------------------

export function layoutCourse(
  lessonsIn: readonly LayoutLesson[],
  trackOrder: readonly string[],
  options: LayoutOptions = {},
): CourseLayout {
  const o = resolve(options);
  const lessons = [...lessonsIn].sort((a, b) => a.order - b.order);
  const byId = new Map(lessons.map((l) => [l.id, l]));

  // Edges that make sense: both ends exist and the prerequisite comes earlier in the path. (Order is the
  // data's guarantee of a DAG; an edge against it is dropped from the drawing rather than looping.)
  const edgesIn: { id: string; from: LayoutLesson; to: LayoutLesson }[] = [];
  for (const l of lessons) {
    for (const p of l.prerequisites) {
      const from = byId.get(p);
      if (from && from.id !== l.id && from.order < l.order) {
        edgesIn.push({ id: `${from.id}>${l.id}`, from, to: l });
      }
    }
  }

  // Bands in the given order; tracks that appear only in the lessons are appended.
  const tracks: string[] = [];
  for (const t of trackOrder) if (lessons.some((l) => l.track === t) && !tracks.includes(t)) tracks.push(t);
  for (const l of lessons) if (!tracks.includes(l.track)) tracks.push(l.track);

  // 1. Layers inside each band.
  const layerOf = new Map<string, number>();
  for (const l of lessons) {
    let best = 0;
    for (const p of l.prerequisites) {
      const pl = byId.get(p);
      if (pl && pl.track === l.track && pl.order < l.order)
        best = Math.max(best, (layerOf.get(pl.id) ?? 0) + 1);
    }
    layerOf.set(l.id, best);
  }

  // 2. Columns, band by band.
  const columns: Column[] = [];
  const colIndex = new Map<string, number>(); // `${track}:${layer}` -> index
  for (const t of tracks) {
    const inBand = lessons.filter((l) => l.track === t);
    const layers = inBand.reduce((m, l) => Math.max(m, (layerOf.get(l.id) ?? 0) + 1), 0);
    for (let k = 0; k < layers; k++) {
      colIndex.set(`${t}:${k}`, columns.length);
      columns.push({ track: t, layer: k, items: [] });
    }
  }

  // Module ranks per band: by the earliest lesson of the module.
  const moduleRank = new Map<string, number>();
  for (const t of tracks) {
    const mods = new Map<string, number>();
    for (const l of lessons) {
      if (l.track !== t) continue;
      mods.set(l.module, Math.min(mods.get(l.module) ?? Number.POSITIVE_INFINITY, l.order));
    }
    [...mods.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .forEach(([m], i) => {
        moduleRank.set(`${t}|${m}`, i);
      });
  }

  // 3. Items: nodes first.
  const nodeItem = new Map<string, Item>();
  for (const l of lessons) {
    const col = colIndex.get(`${l.track}:${layerOf.get(l.id) ?? 0}`) ?? 0;
    const mk = `${l.track}|${l.module}`;
    const it: Item = {
      key: l.id,
      kind: 'node',
      col,
      lesson: l,
      moduleKey: o.groupModules ? mk : l.id,
      rank: o.groupModules ? (moduleRank.get(mk) ?? 0) : 0,
      order: l.order,
      v: 0,
      left: [],
      right: [],
      wLeft: [],
      wRight: [],
    };
    nodeItem.set(l.id, it);
    columns[col]?.items.push(it);
  }

  // Dummies for edges that skip columns, and neighbour links.
  const link = (a: Item, b: Item) => {
    const w = a.kind === 'dummy' || b.kind === 'dummy' ? 2 : 1;
    a.right.push(b);
    a.wRight.push(w);
    b.left.push(a);
    b.wLeft.push(w);
  };
  interface EdgeChain {
    id: string;
    from: LayoutLesson;
    to: LayoutLesson;
    chain: Item[];
    backward: boolean;
    span: number;
  }
  const chains: EdgeChain[] = [];
  for (const e of edgesIn) {
    const a = nodeItem.get(e.from.id);
    const b = nodeItem.get(e.to.id);
    if (!a || !b) continue;
    if (a.col >= b.col) {
      chains.push({ id: e.id, from: e.from, to: e.to, chain: [a, b], backward: true, span: a.col - b.col });
      continue;
    }
    const chain: Item[] = [a];
    for (let c = a.col + 1; c < b.col; c++) {
      const d: Item = {
        key: `${e.id}#${c}`,
        kind: 'dummy',
        col: c,
        lesson: null,
        moduleKey: null,
        rank: -1,
        order: Math.max(e.from.order, e.to.order) + c / 1000,
        v: 0,
        left: [],
        right: [],
        wLeft: [],
        wRight: [],
      };
      columns[c]?.items.push(d);
      chain.push(d);
    }
    chain.push(b);
    for (let i = 0; i + 1 < chain.length; i++) {
      const x = chain[i];
      const y = chain[i + 1];
      if (x && y) link(x, y);
    }
    chains.push({ id: e.id, from: e.from, to: e.to, chain, backward: false, span: b.col - a.col });
  }

  // 4. Order and place, widening the dummy separations until the check passes.
  let layout: CourseLayout | null = null;
  const widen = [1, 1.2, 1.45, 1.8];
  for (const k of widen) {
    const sep: Separation = {
      nodeToDummy: BASE_SEPARATION.nodeToDummy * k,
      dummyToNode: BASE_SEPARATION.dummyToNode * k,
      dummyToDummy: BASE_SEPARATION.dummyToDummy * k,
    };
    arrange(columns, sep);
    layout = build(o, tracks, lessons, columns, chains, nodeItem);
    // Stacked bands share one width. A band with fewer rows than the widest sits in the middle of it, not
    // against the left edge. Kept only when the check still passes.
    if (o.orientation === 'vertical') {
      const before = columns.map((c) => c.items.map((it) => it.v));
      if (centreBands(columns, tracks)) {
        const centred = build(o, tracks, lessons, columns, chains, nodeItem);
        if (centred.problems.length <= layout.problems.length) {
          layout = centred;
        } else {
          columns.forEach((c, ci) => {
            c.items.forEach((it, i) => {
              it.v = before[ci]?.[i] ?? it.v;
            });
          });
        }
      }
    }
    if (layout.problems.length === 0) break;
  }
  return layout as CourseLayout;
}

/**
 * Moves each band's items across the flow so the band's rows sit in the middle of the widest band's span.
 * Order inside every column is untouched. Returns false when there was nothing to move.
 */
function centreBands(columns: readonly Column[], tracks: readonly string[]): boolean {
  let gMin = Number.POSITIVE_INFINITY;
  let gMax = Number.NEGATIVE_INFINITY;
  const extent = new Map<string, { min: number; max: number }>();
  for (const col of columns) {
    for (const it of col.items) {
      gMin = Math.min(gMin, it.v);
      gMax = Math.max(gMax, it.v);
      const e = extent.get(col.track);
      if (e) {
        e.min = Math.min(e.min, it.v);
        e.max = Math.max(e.max, it.v);
      } else extent.set(col.track, { min: it.v, max: it.v });
    }
  }
  if (!Number.isFinite(gMin)) return false;
  let moved = false;
  for (const t of tracks) {
    const e = extent.get(t);
    if (!e) continue;
    // Quarter-row steps keep the picture on a regular grid.
    const shift = Math.round(((gMin + gMax - (e.min + e.max)) / 2) * 4) / 4;
    if (Math.abs(shift) < 0.2) continue;
    moved = true;
    for (const col of columns) {
      if (col.track !== t) continue;
      for (const it of col.items) it.v += shift;
    }
  }
  return moved;
}

// ---------------------------------------------------------------------------
// Ordering and rows
// ---------------------------------------------------------------------------

function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

function barycentre(it: Item, dir: 'left' | 'right'): number {
  const ns = dir === 'left' ? it.left : it.right;
  const ws = dir === 'left' ? it.wLeft : it.wRight;
  if (ns.length === 0) return it.v;
  let s = 0;
  let w = 0;
  for (let i = 0; i < ns.length; i++) {
    const n = ns[i];
    const wi = ws[i] ?? 1;
    if (!n) continue;
    s += n.v * wi;
    w += wi;
  }
  return w === 0 ? it.v : s / w;
}

/** Orders one column: module blocks in module rank order, lessons inside a block and dummies by key. */
function orderColumn(items: Item[], dir: 'left' | 'right'): Item[] {
  const key = new Map<Item, number>();
  for (const it of items) key.set(it, barycentre(it, dir));
  const k = (it: Item) => key.get(it) ?? it.v;

  const blocks = new Map<string, Item[]>();
  const dummies: Item[] = [];
  for (const it of items) {
    if (it.kind === 'dummy') {
      dummies.push(it);
      continue;
    }
    const list = blocks.get(it.moduleKey ?? it.key);
    if (list) list.push(it);
    else blocks.set(it.moduleKey ?? it.key, [it]);
  }
  const blockList = [...blocks.values()].map((its) => {
    its.sort((a, b) => k(a) - k(b) || a.order - b.order);
    return { rank: its[0]?.rank ?? 0, items: its, centre: mean(its.map(k)) };
  });
  blockList.sort((a, b) => a.rank - b.rank || a.centre - b.centre);
  dummies.sort((a, b) => k(a) - k(b) || a.key.localeCompare(b.key));

  const out: Item[] = [];
  let di = 0;
  for (const block of blockList) {
    while (di < dummies.length && (key.get(dummies[di] as Item) ?? 0) < block.centre) {
      out.push(dummies[di] as Item);
      di++;
    }
    out.push(...block.items);
  }
  while (di < dummies.length) {
    out.push(dummies[di] as Item);
    di++;
  }
  return out;
}

/**
 * Isotonic fit of `z` (non-decreasing) by pool-adjacent-violators, with weights. Returns the fitted values.
 */
function isotonic(z: readonly number[], w: readonly number[]): number[] {
  const blocks: { sum: number; weight: number; count: number }[] = [];
  for (let i = 0; i < z.length; i++) {
    blocks.push({ sum: (z[i] ?? 0) * (w[i] ?? 1), weight: w[i] ?? 1, count: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1] as { sum: number; weight: number; count: number };
      const a = blocks[blocks.length - 2] as { sum: number; weight: number; count: number };
      if (a.sum / a.weight <= b.sum / b.weight) break;
      blocks.splice(blocks.length - 2, 2, {
        sum: a.sum + b.sum,
        weight: a.weight + b.weight,
        count: a.count + b.count,
      });
    }
  }
  const out: number[] = [];
  for (const b of blocks) for (let i = 0; i < b.count; i++) out.push(b.sum / b.weight);
  return out;
}

/** One relaxation pass over one column: pull each item toward its neighbours, keep order and spacing. */
function placeColumn(items: readonly Item[], sep: Separation): void {
  const n = items.length;
  if (n === 0) return;
  const offsets: number[] = [0];
  for (let i = 1; i < n; i++) {
    const a = items[i - 1] as Item;
    const b = items[i] as Item;
    offsets.push((offsets[i - 1] ?? 0) + minSeparation(a, b, sep));
  }
  const z: number[] = [];
  const w: number[] = [];
  for (let i = 0; i < n; i++) {
    const it = items[i] as Item;
    let s = 0;
    let weight = 0;
    for (let j = 0; j < it.left.length; j++) {
      const m = it.left[j] as Item;
      const wi = it.wLeft[j] ?? 1;
      s += m.v * wi;
      weight += wi;
    }
    for (let j = 0; j < it.right.length; j++) {
      const m = it.right[j] as Item;
      const wi = it.wRight[j] ?? 1;
      s += m.v * wi;
      weight += wi;
    }
    const want = weight > 0 ? s / weight : it.v;
    z.push(want - (offsets[i] ?? 0));
    w.push(weight > 0 ? weight : 0.25);
  }
  const fit = isotonic(z, w);
  for (let i = 0; i < n; i++) (items[i] as Item).v = (fit[i] ?? 0) + (offsets[i] ?? 0);
}

function arrange(columns: Column[], sep: Separation): void {
  // Seed: lessons stacked by module rank and order, dummies at their left neighbour's row.
  for (const col of columns) {
    const nodes = col.items
      .filter((it) => it.kind === 'node')
      .sort((a, b) => a.rank - b.rank || a.order - b.order);
    nodes.forEach((it, i) => {
      it.v = i;
    });
  }
  for (const col of columns) {
    for (const it of col.items) {
      if (it.kind === 'dummy') it.v = it.left[0]?.v ?? it.right[0]?.v ?? 0;
    }
  }
  // Order every column once, then stack it with the minimum separations.
  for (const col of columns) {
    col.items = orderColumn(col.items, 'left');
    let y = 0;
    col.items.forEach((it, i) => {
      if (i > 0) y += minSeparation(col.items[i - 1] as Item, it, sep);
      it.v = y;
    });
  }
  const relax = (rounds: number) => {
    for (let r = 0; r < rounds; r++) {
      for (let c = 0; c < columns.length; c++) placeColumn((columns[c] as Column).items, sep);
      for (let c = columns.length - 1; c >= 0; c--) placeColumn((columns[c] as Column).items, sep);
    }
  };
  relax(12);
  for (let sweep = 0; sweep < 4; sweep++) {
    for (let c = 1; c < columns.length; c++) {
      const col = columns[c] as Column;
      col.items = orderColumn(col.items, 'left');
    }
    relax(6);
    for (let c = columns.length - 2; c >= 0; c--) {
      const col = columns[c] as Column;
      col.items = orderColumn(col.items, 'right');
    }
    relax(6);
  }
  relax(30);
}

// ---------------------------------------------------------------------------
// Pixels, edges, bands and the check
// ---------------------------------------------------------------------------

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A path through `pts` with rounded corners of radius `radius` (clamped to the adjacent segments). */
export function roundedPath(pts: readonly Point[], radius: number): string {
  const first = pts[0];
  if (!first) return '';
  if (pts.length === 1) return `M${r2(first.x)} ${r2(first.y)}`;
  let d = `M${r2(first.x)} ${r2(first.y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1] as Point;
    const cur = pts[i] as Point;
    const next = pts[i + 1] as Point;
    const l1 = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const l2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const rr = Math.min(radius, l1 / 2, l2 / 2);
    if (rr < 0.5 || l1 === 0 || l2 === 0) {
      d += `L${r2(cur.x)} ${r2(cur.y)}`;
      continue;
    }
    const a = { x: cur.x + ((prev.x - cur.x) / l1) * rr, y: cur.y + ((prev.y - cur.y) / l1) * rr };
    const b = { x: cur.x + ((next.x - cur.x) / l2) * rr, y: cur.y + ((next.y - cur.y) / l2) * rr };
    d += `L${r2(a.x)} ${r2(a.y)}Q${r2(cur.x)} ${r2(cur.y)} ${r2(b.x)} ${r2(b.y)}`;
  }
  const last = pts[pts.length - 1] as Point;
  d += `L${r2(last.x)} ${r2(last.y)}`;
  return d;
}

function build(
  o: ResolvedOptions,
  tracks: readonly string[],
  lessons: readonly LayoutLesson[],
  columns: readonly Column[],
  chains: readonly {
    id: string;
    from: LayoutLesson;
    to: LayoutLesson;
    chain: Item[];
    backward: boolean;
    span: number;
  }[],
  nodeItem: ReadonlyMap<string, Item>,
): CourseLayout {
  const horizontal = o.orientation === 'horizontal';
  const { radius: r, pitchU, pitchV, padding } = o;

  // Row extent over every item (dummies included, so a channel above the first node still fits).
  let vMin = Number.POSITIVE_INFINITY;
  let vMax = Number.NEGATIVE_INFINITY;
  for (const col of columns) {
    for (const it of col.items) {
      vMin = Math.min(vMin, it.v);
      vMax = Math.max(vMax, it.v);
    }
  }
  if (!Number.isFinite(vMin)) {
    vMin = 0;
    vMax = 0;
  }
  const spanV = (vMax - vMin) * pitchV;

  // Along-flow coordinate of each column, and band rectangles.
  const bandPadPx = o.bandPad * pitchU;
  const colU: number[] = [];
  const bands: LayoutBand[] = [];
  let cursor = padding;
  for (const t of tracks) {
    const idx = columns.map((c, i) => (c.track === t ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 0) continue;
    const head = horizontal ? 0 : o.headerSize;
    const start = cursor;
    const inner = (idx.length - 1) * pitchU;
    const natural = head + 2 * bandPadPx + inner;
    const extent = Math.max(natural, o.minBandSize);
    const slack = (extent - natural) / 2;
    idx.forEach((ci, k) => {
      colU[ci] = start + slack + head + bandPadPx + k * pitchU;
    });
    bands.push({
      track: t,
      x: horizontal ? start : padding,
      y: horizontal ? padding : start,
      width: horizontal ? extent : 0,
      height: horizontal ? 0 : extent,
      headerSize: o.headerSize,
      nodeIds: [],
    });
    cursor = start + extent + o.bandGap;
  }
  const alongTotal = cursor - o.bandGap + padding;

  // Across-flow coordinate of a row.
  const across = (v: number): number => {
    if (horizontal) return padding + o.headerSize + 10 + r + (v - vMin) * pitchV;
    return padding + r + (v - vMin) * pitchV;
  };
  const acrossTotal = horizontal
    ? padding + o.headerSize + 10 + r + spanV + r + o.labelSpace + padding
    : padding + r + spanV + r + padding;

  const toPoint = (col: number, v: number): Point => {
    const u = colU[col] ?? 0;
    return horizontal ? { x: u, y: across(v) } : { x: across(v), y: u };
  };

  const width = horizontal ? alongTotal : acrossTotal;
  const height = horizontal ? acrossTotal : alongTotal;
  for (const b of bands) {
    if (horizontal) b.height = height - 2 * padding;
    else b.width = width - 2 * padding;
  }

  // Nodes.
  const nodes: LayoutNode[] = [];
  const pos = new Map<string, Point>();
  for (const l of lessons) {
    const it = nodeItem.get(l.id);
    if (!it) continue;
    const col = columns[it.col];
    const p = toPoint(it.col, it.v);
    pos.set(l.id, p);
    nodes.push({
      id: l.id,
      track: l.track,
      module: l.module,
      x: r2(p.x),
      y: r2(p.y),
      col: it.col,
      layer: col?.layer ?? 0,
      row: r2(it.v - vMin),
    });
    bands.find((b) => b.track === l.track)?.nodeIds.push(l.id);
  }

  // Edges.
  const edges: LayoutEdge[] = [];
  for (const c of chains) {
    const pts = c.chain.map((it) =>
      it.kind === 'node' && it.lesson ? (pos.get(it.lesson.id) as Point) : toPoint(it.col, it.v),
    );
    if (c.backward) {
      // Lift the middle so an oddity is visible and does not run along the lesson row.
      const a = pts[0] as Point;
      const b = pts[pts.length - 1] as Point;
      const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - (horizontal ? 2.2 * r : 0) };
      const mid2 = horizontal ? mid : { x: Math.min(a.x, b.x) - 2.2 * r, y: (a.y + b.y) / 2 };
      pts.splice(1, 0, mid2);
    }
    edges.push({
      id: c.id,
      from: c.from.id,
      to: c.to.id,
      points: pts.map((p) => ({ x: r2(p.x), y: r2(p.y) })),
      path: roundedPath(pts, 22),
      span: c.span,
      backward: c.backward,
    });
  }

  // Modules.
  const modules: LayoutModule[] = [];
  const byModule = new Map<string, LayoutNode[]>();
  for (const n of nodes) {
    const id = `${n.track}|${n.module}`;
    const list = byModule.get(id);
    if (list) list.push(n);
    else byModule.set(id, [n]);
  }
  for (const [id, list] of byModule) {
    const xs = list.map((n) => n.x);
    const ys = list.map((n) => n.y);
    const x0 = Math.min(...xs) - r;
    const y0 = Math.min(...ys) - r;
    modules.push({
      id,
      track: list[0]?.track ?? '',
      module: list[0]?.module ?? '',
      nodeIds: list.map((n) => n.id),
      box: { x: x0, y: y0, width: Math.max(...xs) + r - x0, height: Math.max(...ys) + r - y0 },
    });
  }

  const layout: CourseLayout = {
    orientation: o.orientation,
    width: r2(width),
    height: r2(height),
    radius: r,
    nodes,
    edges,
    bands,
    modules,
    problems: [],
  };
  layout.problems = checkLayout(layout, columns);
  return layout;
}

/** Minimum clearance (px) between an edge and a node it does not end at, beyond the node radius. */
export const EDGE_CLEARANCE = 6;
/** Minimum gap (px) between two node hexagons. */
export const NODE_GAP = 8;

/** Verifies the layout. Pure, so tests and development builds can call it on any layout. */
export function checkLayout(layout: CourseLayout, columns?: readonly Column[]): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  const { nodes, edges, radius: r } = layout;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i] as LayoutNode;
      const b = nodes[j] as LayoutNode;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 2 * r + NODE_GAP) {
        problems.push({ kind: 'overlap', message: `${a.id} and ${b.id} overlap` });
      }
    }
  }
  for (const e of edges) {
    for (const n of nodes) {
      if (n.id === e.from || n.id === e.to) continue;
      for (let i = 0; i + 1 < e.points.length; i++) {
        const a = e.points[i] as Point;
        const b = e.points[i + 1] as Point;
        if (distanceToSegment(n, a, b) < r + EDGE_CLEARANCE) {
          problems.push({ kind: 'edge-through-node', message: `edge ${e.id} passes through ${n.id}` });
          break;
        }
      }
    }
  }
  if (columns) {
    // Lessons of one module are contiguous (no dummy and no other module between them) in each column.
    for (const col of columns) {
      const seen = new Set<string>();
      let prev: string | null = null;
      for (const it of col.items) {
        if (it.kind !== 'node' || !it.moduleKey) {
          prev = null;
          continue;
        }
        if (it.moduleKey !== prev && seen.has(it.moduleKey)) {
          problems.push({ kind: 'module-split', message: `module ${it.moduleKey} is split in a column` });
        }
        seen.add(it.moduleKey);
        prev = it.moduleKey;
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Small helpers for the view
// ---------------------------------------------------------------------------

/** Lesson ids that are prerequisites, directly or through a chain, of `id` (not including `id`). */
export function ancestorsOf(id: string, lessons: readonly LayoutLesson[]): Set<string> {
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const out = new Set<string>();
  const stack = [...(byId.get(id)?.prerequisites ?? [])];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    if (out.has(cur) || cur === id || !byId.has(cur)) continue;
    out.add(cur);
    for (const p of byId.get(cur)?.prerequisites ?? []) stack.push(p);
  }
  return out;
}

/** Lessons that list `id` as a direct prerequisite. */
export function dependantsOf(id: string, lessons: readonly LayoutLesson[]): string[] {
  return lessons.filter((l) => l.prerequisites.includes(id)).map((l) => l.id);
}
