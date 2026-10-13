/**
 * The hex iris (docs/DESIGN.md section 4): a route change reveals the new page through a growing
 * hexagon, centred on the element that was activated (or the viewport centre), 420 ms, `--ease-out`.
 *
 * The geometry is pure and tested here. `router.tsx` records where the visitor pressed, calls
 * `prepareIris()` just before a navigation, and the View Transitions API does the rest: the global CSS
 * rule in `iris.css` animates `::view-transition-new(root)` between the two polygons.
 *
 * Browsers without view transitions get a 160 ms fade of the page instead, and reduced motion gets
 * neither (the swap is instant).
 */

import { hexVertices, type Point } from '@/lib/hex';

export const IRIS_MS = 420;
export const FADE_MS = 160;

/** A pointy-top hexagon's inscribed circle is cos(30 deg) of its circumradius. */
const INRADIUS = Math.cos(Math.PI / 6);

export interface Viewport {
  width: number;
  height: number;
}

/** The farthest viewport corner from `origin`, in px. */
export function farthestCorner(origin: Point, vp: Viewport): number {
  const dx = Math.max(origin.x, vp.width - origin.x);
  const dy = Math.max(origin.y, vp.height - origin.y);
  return Math.hypot(dx, dy);
}

/** The circumradius a hexagon needs to cover the whole viewport from `origin`, with a small margin. */
export function coverRadius(origin: Point, vp: Viewport): number {
  return farthestCorner(origin, vp) / INRADIUS + 8;
}

/** Keeps the origin inside the viewport so a header link near an edge still opens a sensible hex. */
export function clampOrigin(origin: Point, vp: Viewport): Point {
  return {
    x: Math.min(vp.width, Math.max(0, origin.x)),
    y: Math.min(vp.height, Math.max(0, origin.y)),
  };
}

function polygon(points: readonly Point[]): string {
  return `polygon(${points.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})`;
}

export interface IrisShape {
  /** The small hexagon the reveal starts from. */
  from: string;
  /** The hexagon that covers the viewport. */
  to: string;
}

/** The two `clip-path` polygons (same vertex count, so the browser interpolates them). */
export function irisShape(origin: Point, vp: Viewport, startRadius = 12): IrisShape {
  const o = clampOrigin(origin, vp);
  return {
    from: polygon(hexVertices(o.x, o.y, startRadius)),
    to: polygon(hexVertices(o.x, o.y, coverRadius(o, vp))),
  };
}

export interface Activation {
  x: number;
  y: number;
  /** Date.now() when it happened. */
  at: number;
}

/** An activation older than this is not what started the navigation. */
export const ACTIVATION_WINDOW_MS = 1200;

/**
 * Where the iris opens: the recent activation if there is one, else the viewport centre.
 * Pure: pass the clock in.
 */
export function pickOrigin(activation: Activation | null, vp: Viewport, nowMs: number): Point {
  if (activation && nowMs - activation.at <= ACTIVATION_WINDOW_MS) {
    return clampOrigin({ x: activation.x, y: activation.y }, vp);
  }
  return { x: vp.width / 2, y: vp.height / 2 };
}

/**
 * The activation point for an element: its centre, unless it is large (a card), in which case the
 * pointer position is a better centre than the middle of the card.
 */
export function activationFor(
  rect: { left: number; top: number; width: number; height: number } | null,
  pointer: Point | null,
  nowMs: number,
): Activation | null {
  const big = rect !== null && (rect.width > 360 || rect.height > 200);
  if (rect && !big) {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, at: nowMs };
  }
  if (pointer) return { x: pointer.x, y: pointer.y, at: nowMs };
  if (rect) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, at: nowMs };
  return null;
}
