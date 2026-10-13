/**
 * Where an explainer's numbered ring goes relative to the thing it describes. Pure geometry so it can be
 * tested: the ring sits off one corner of the target, joined to it by a leader, and stays inside the lab
 * and clear of rings already placed.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Placement {
  /** The dot on the target, where the leader starts. */
  anchor: Pt;
  /** The centre of the numbered ring. */
  ring: Pt;
  /** Which side of the ring the label reads on. */
  labelSide: 'left' | 'right';
}

export const RING_RADIUS = 13;
const EDGE = 8;

interface Candidate {
  /** Which corner of the target the leader starts at. */
  corner: 'tr' | 'tl' | 'br' | 'bl';
  dx: number;
  dy: number;
}

function cornerPoint(t: Rect, corner: Candidate['corner']): Pt {
  const inset = Math.min(10, t.w / 2, t.h / 2);
  const x = corner === 'tr' || corner === 'br' ? t.x + t.w - inset : t.x + inset;
  const y = corner === 'tr' || corner === 'tl' ? t.y + inset : t.y + t.h - inset;
  return { x, y };
}

/**
 * The first position (up and right, up, up and left, beside, then below) whose ring fits the box, does not
 * touch a ring in `taken` and, when `blocked` is given, does not sit on content. When every position is
 * blocked the first one that fits is used anyway; when nothing fits, the first candidate clamped into the
 * box.
 */
export function placeRing(
  target: Rect,
  box: { width: number; height: number },
  taken: readonly Pt[] = [],
  reach = 42,
  blocked?: (ring: Pt) => boolean,
): Placement {
  const lift = reach * 0.8;
  const candidates: Candidate[] = [
    { corner: 'tr', dx: reach, dy: -lift },
    { corner: 'tl', dx: -reach, dy: -lift },
    { corner: 'tr', dx: reach * 0.25, dy: -lift * 1.25 },
    { corner: 'tr', dx: reach * 1.6, dy: 0 },
    { corner: 'tl', dx: -reach * 1.6, dy: 0 },
    { corner: 'br', dx: reach, dy: lift },
    { corner: 'bl', dx: -reach, dy: lift },
    { corner: 'br', dx: reach * 0.25, dy: lift * 1.25 },
    { corner: 'tr', dx: reach * 2.4, dy: -lift },
    { corner: 'tl', dx: -reach * 2.4, dy: -lift },
  ];
  const lo = RING_RADIUS + EDGE;
  const fits = (p: Pt): boolean => p.x >= lo && p.x <= box.width - lo && p.y >= lo && p.y <= box.height - lo;
  const clear = (p: Pt): boolean =>
    taken.every((t) => Math.hypot(t.x - p.x, t.y - p.y) >= RING_RADIUS * 2 + 6);

  const pass = (useBlocked: boolean): Placement | null => {
    for (const c of candidates) {
      const anchor = cornerPoint(target, c.corner);
      const ring = { x: anchor.x + c.dx, y: anchor.y + c.dy };
      if (!fits(ring) || !clear(ring)) continue;
      if (useBlocked && blocked?.(ring)) continue;
      return { anchor, ring, labelSide: c.dx >= 0 ? 'right' : 'left' };
    }
    return null;
  };

  const found = (blocked ? pass(true) : null) ?? pass(false);
  if (found) return found;

  const first = candidates[0] as Candidate;
  const anchor = cornerPoint(target, first.corner);
  const ring = {
    x: Math.min(Math.max(anchor.x + first.dx, lo), Math.max(lo, box.width - lo)),
    y: Math.min(Math.max(anchor.y + first.dy, lo), Math.max(lo, box.height - lo)),
  };
  return { anchor, ring, labelSide: ring.x >= anchor.x ? 'right' : 'left' };
}

/**
 * Places a note card (a fixed width and measured height) beside its ring: below it when there is room,
 * otherwise above, kept inside the box horizontally.
 */
export function placeCard(
  ring: Pt,
  card: { width: number; height: number },
  box: { width: number; height: number },
): { x: number; y: number; above: boolean } {
  const gap = RING_RADIUS + 10;
  const width = Math.min(card.width, box.width - 2 * EDGE);
  const x = Math.min(Math.max(ring.x - 28, EDGE), Math.max(EDGE, box.width - width - EDGE));
  const below = ring.y + gap;
  if (below + card.height <= box.height - EDGE) return { x, y: below, above: false };
  const above = ring.y - gap - card.height;
  return { x, y: Math.max(EDGE, above), above: true };
}
