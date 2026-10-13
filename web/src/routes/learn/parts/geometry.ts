/**
 * Small drawing helpers for the constellation. Pure.
 */

import { hexVertices } from '@/lib/hex';

const f = (n: number) => Number(n.toFixed(2));

/** A rectangle with the family silhouette: big cuts at the top right and bottom left, a bevel elsewhere. */
export function chamferRectPath(x: number, y: number, w: number, h: number, cut = 18, bevel = 5): string {
  const c = Math.min(cut, w / 3, h / 3);
  const m = Math.min(bevel, c / 2);
  return [
    `M${f(x)} ${f(y + m)}`,
    `L${f(x + m)} ${f(y)}`,
    `L${f(x + w - c)} ${f(y)}`,
    `L${f(x + w)} ${f(y + c)}`,
    `L${f(x + w)} ${f(y + h - m)}`,
    `L${f(x + w - m)} ${f(y + h)}`,
    `L${f(x + c)} ${f(y + h)}`,
    `L${f(x)} ${f(y + h - c)}`,
    'Z',
  ].join('');
}

export interface Facets {
  /** The lit top rhombus. */
  top: string;
  /** The left face. */
  left: string;
  /** The right face. */
  right: string;
}

/**
 * The three faces of a hexagonal gem drawn as an isometric cube: the top rhombus and the left and right
 * walls, meeting at the centre. Pointy-top, centred on the origin.
 */
export function gemFacets(r: number): Facets {
  const v = hexVertices(0, 0, r);
  const p = (i: number) => `${f(v[i]?.x ?? 0)} ${f(v[i]?.y ?? 0)}`;
  return {
    top: `M0 0L${p(5)}L${p(0)}L${p(1)}Z`,
    left: `M0 0L${p(5)}L${p(4)}L${p(3)}Z`,
    right: `M0 0L${p(1)}L${p(2)}L${p(3)}Z`,
  };
}

/** `width = height * sqrt(3) / 2` for a regular pointy-top hexagon. */
export const HEX_ASPECT = Math.sqrt(3) / 2;

/** "1 lesson", "2 lessons". */
export function plural(n: number, one: string, many: string): string {
  return n === 1 ? `${n} ${one}` : `${n} ${many}`;
}

// ---------------------------------------------------------------------------
// Where the lesson card opens
// ---------------------------------------------------------------------------

export interface CardPlan {
  /** Left and top of the card, in layout units. */
  left: number;
  top: number;
  side: 'left' | 'right';
}

export interface CardPlanInput {
  nodes: readonly { id: string; x: number; y: number }[];
  activeId: string;
  /** Lessons that help before it (lit white): hiding one is the worst outcome. */
  requires: ReadonlySet<string>;
  /** Lessons it leads to (dashed): hiding one is a smaller cost. The card's text lists them. */
  leadsTo: ReadonlySet<string>;
  /** Nothing is covered above this row (the band headers), layout units. */
  topLimit: number;
  /** Layout size of the map, the node radius, and the card size, all in layout units. */
  width: number;
  height: number;
  radius: number;
  cardWidth: number;
  cardHeight: number;
  /** Space under a node taken by its label, layout units. */
  labelSpace: number;
}

/**
 * Chooses where the card opens: left or right of the node, aligned to its top, centre or bottom, whichever
 * hides the fewest lessons (a prerequisite counts six, a lesson it leads to two). Ties go to the right and
 * the centre. Pure.
 */
export function planCard(input: CardPlanInput): CardPlan | null {
  const self = input.nodes.find((n) => n.id === input.activeId);
  if (!self) return null;
  const { width: W, height: H, radius: r, cardWidth: cw, cardHeight: ch } = input;
  const gap = 16;
  const halfHex = r * HEX_ASPECT;
  const clampTop = (t: number) => Math.max(input.topLimit + 8, Math.min(H - ch - 8, t));
  const clampLeft = (l: number) => Math.max(8, Math.min(W - cw - 8, l));

  const candidates: CardPlan[] = [];
  for (const side of ['right', 'left'] as const) {
    const left = clampLeft(side === 'right' ? self.x + halfHex + gap : self.x - halfHex - gap - cw);
    for (const top of [self.y - ch / 2, self.y - r - 6, self.y + r + input.labelSpace - ch]) {
      candidates.push({ side, left, top: clampTop(top) });
    }
  }

  let best: CardPlan | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  candidates.forEach((c, i) => {
    let cost = 0;
    for (const n of input.nodes) {
      const x0 = n.x - halfHex - 6;
      const x1 = n.x + halfHex + 6;
      const y0 = n.y - r - 4;
      const y1 = n.y + r + input.labelSpace;
      const overlaps = x1 > c.left && x0 < c.left + cw && y1 > c.top && y0 < c.top + ch;
      if (!overlaps) continue;
      cost += n.id === input.activeId ? 1000 : input.requires.has(n.id) ? 6 : input.leadsTo.has(n.id) ? 2 : 1;
    }
    // A small, stable preference: right before left, centre before top before bottom.
    cost += (i % 3) * 0.01 + (i >= 3 ? 0.02 : 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = c;
    }
  });
  return best;
}
