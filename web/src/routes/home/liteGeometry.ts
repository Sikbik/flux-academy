/**
 * Geometry of the calm 2D bench (the no-WebGL hero): twelve slots along a gentle arc, extruded hex
 * pillars, and the arcs from the cell to the pillars that host a copy. Pure numbers, tested in node.
 */

export const LITE_W = 640;
export const LITE_H = 380;
export const SLOTS = 12;

export interface Pt {
  x: number;
  y: number;
}

/** The cell (the specimen) floats above the middle of the bench. */
export const CELL: Pt = { x: LITE_W / 2, y: 86 };

/** Where slot `i` (0..11) stands: ends a little lower than the middle, like the look target's arc. */
export function slotPoint(i: number): Pt {
  const t = i / (SLOTS - 1);
  return { x: 54 + t * (LITE_W - 108), y: 312 - 26 * Math.sin(Math.PI * t) };
}

/**
 * The order in which copies take slots: the first three stand far apart, and adding or removing a copy
 * never moves another one (instance `i` always stands in `SLOT_ORDER[i]`).
 */
export const SLOT_ORDER: readonly number[] = [1, 6, 10, 3, 8, 0, 5, 11, 2, 7, 9, 4];

/** The slots that host `n` copies, in instance order. */
export function hostSlots(n: number): number[] {
  const count = Math.max(0, Math.min(SLOTS, Math.round(n)));
  return SLOT_ORDER.slice(0, count);
}

export const PILLAR_HEIGHT = { cumulus: 26, nimbus: 44, stratus: 66 } as const;
export const PILLAR_R = 15;

const f = (n: number) => Number(n.toFixed(1));

/**
 * Points of a pointy-top hex prism seen from above and in front: the top face, and the two front
 * faces that meet at the bottom vertex. `base` is the centre of the bottom face.
 */
export function prism(base: Pt, r: number, h: number): { top: string; left: string; right: string } {
  const sy = 0.5; // the hexagon is squashed to read as lying on a ground plane
  const cx = base.x;
  const cy = base.y - h;
  const v = (a: number): Pt => {
    const rad = ((-90 + a) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) * sy };
  };
  const p = [0, 60, 120, 180, 240, 300].map(v);
  const [t, ur, lr, b, ll, ul] = p as [Pt, Pt, Pt, Pt, Pt, Pt];
  const down = (q: Pt): Pt => ({ x: q.x, y: q.y + h });
  const poly = (pts: Pt[]) => pts.map((q) => `${f(q.x)},${f(q.y)}`).join(' ');
  return {
    top: poly([t, ur, lr, b, ll, ul]),
    left: poly([ul, ll, b, down(b), down(ll), down(ul)]),
    right: poly([ur, lr, b, down(b), down(lr), down(ur)]),
  };
}

/** The arc from the cell to the top of a pillar: a quadratic Bezier that rises first. */
export function arcPath(to: Pt): string {
  const from = { x: CELL.x, y: CELL.y + 26 };
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) - 34 - Math.abs(to.x - from.x) * 0.06;
  return `M${f(from.x)} ${f(from.y)}Q${f(mx)} ${f(my)} ${f(to.x)} ${f(to.y)}`;
}

/** Background cells: a calm hex field behind the pillars (flat 2D, three rows). */
export function fieldCells(): Pt[] {
  const out: Pt[] = [];
  const dx = 44;
  const rows = [250, 276, 302, 330, 356];
  rows.forEach((y, r) => {
    const n = 15 - (r % 2);
    const off = r % 2 ? dx / 2 : 0;
    for (let i = 0; i < n; i++) out.push({ x: 10 + off + i * dx, y });
  });
  return out;
}
