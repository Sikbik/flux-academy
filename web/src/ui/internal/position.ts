/**
 * Anchored positioning for tooltips, popovers and menus. Pure: give it the anchor rect, the
 * floating box size and the viewport, get back the top-left point, the side that was used
 * after flipping, and where the anchor's centre sits along the floating box (for an arrow).
 */

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';
export type Placement = Side | `${Side}-${'start' | 'end'}`;

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PositionInput {
  anchor: RectLike;
  floating: { width: number; height: number };
  viewport: { width: number; height: number };
  placement?: Placement;
  /** Gap between anchor and floating box, px. */
  offset?: number;
  /** Minimum distance kept from the viewport edge, px. */
  margin?: number;
  /** Flip to the opposite side when the preferred side overflows and the other fits. */
  flip?: boolean;
}

export interface PositionResult {
  x: number;
  y: number;
  side: Side;
  align: Align;
  /** Distance from the floating box's start edge to the anchor's centre, along the cross axis. */
  arrow: number;
  /** The anchor is wholly outside the viewport: there is nothing to point at, so hide the box. */
  hidden: boolean;
}

export function parsePlacement(p: Placement): { side: Side; align: Align } {
  const [side, align] = p.split('-') as [Side, 'start' | 'end' | undefined];
  return { side, align: align ?? 'center' };
}

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function clamp(v: number, lo: number, hi: number): number {
  return hi < lo ? lo : v < lo ? lo : v > hi ? hi : v;
}

export function computePosition({
  anchor,
  floating,
  viewport,
  placement = 'top',
  offset = 10,
  margin = 8,
  flip = true,
}: PositionInput): PositionResult {
  const parsed = parsePlacement(placement);
  const align = parsed.align;
  let side = parsed.side;
  const hidden =
    anchor.top + anchor.height <= 0 ||
    anchor.top >= viewport.height ||
    anchor.left + anchor.width <= 0 ||
    anchor.left >= viewport.width;

  const room = (s: Side): number => {
    if (s === 'top') return anchor.top - margin;
    if (s === 'bottom') return viewport.height - (anchor.top + anchor.height) - margin;
    if (s === 'left') return anchor.left - margin;
    return viewport.width - (anchor.left + anchor.width) - margin;
  };
  const need = (s: Side): number =>
    (s === 'top' || s === 'bottom' ? floating.height : floating.width) + offset;

  if (flip && room(side) < need(side) && room(OPPOSITE[side]) >= need(OPPOSITE[side])) {
    side = OPPOSITE[side];
  }

  let x: number;
  let y: number;
  if (side === 'top' || side === 'bottom') {
    y = side === 'top' ? anchor.top - floating.height - offset : anchor.top + anchor.height + offset;
    x =
      align === 'start'
        ? anchor.left
        : align === 'end'
          ? anchor.left + anchor.width - floating.width
          : anchor.left + anchor.width / 2 - floating.width / 2;
    x = clamp(x, margin, viewport.width - floating.width - margin);
    y = clamp(y, margin, viewport.height - floating.height - margin);
    return { x, y, side, align, arrow: anchor.left + anchor.width / 2 - x, hidden };
  }
  x = side === 'left' ? anchor.left - floating.width - offset : anchor.left + anchor.width + offset;
  y =
    align === 'start'
      ? anchor.top
      : align === 'end'
        ? anchor.top + anchor.height - floating.height
        : anchor.top + anchor.height / 2 - floating.height / 2;
  x = clamp(x, margin, viewport.width - floating.width - margin);
  y = clamp(y, margin, viewport.height - floating.height - margin);
  return { x, y, side, align, arrow: anchor.top + anchor.height / 2 - y, hidden };
}
