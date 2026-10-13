/**
 * Hexagon-arc geometry for the Gauge. Positions along the ring are fractions of the
 * perimeter (0 is the top vertex, clockwise); degrees are the same thing times 360, so a
 * pointy-top hexagon has a vertex every 60 degrees. Pure; unit tested in node.
 */
import { hexPerimeterPoint, hexPoints, type Point } from '../internal/hex';

const round = (n: number): number => Math.round(n * 100) / 100;

/** Wraps a perimeter fraction into [0, 1). */
export function wrap01(t: number): number {
  return ((t % 1) + 1) % 1;
}

/**
 * One continuous open path along the hexagon from `start` for `sweep` (both fractions of
 * the perimeter; sweep may wrap past the top vertex). A sweep of 1 or more is the closed ring.
 */
export function arcPath(cx: number, cy: number, r: number, start: number, sweep: number): string {
  const s = sweep >= 1 ? 1 : Math.max(0, sweep);
  const t0 = wrap01(start);
  const verts = hexPoints(cx, cy, r);
  const pts: Point[] = [hexPerimeterPoint(cx, cy, r, t0)];
  // Vertices strictly inside (t0, t0 + s), in travel order, wrapping past 1.
  const end = t0 + s;
  for (let k = Math.floor(t0 * 6 + 1e-9) + 1; k / 6 < end - 1e-9; k++) {
    pts.push(verts[k % 6] as Point);
  }
  pts.push(hexPerimeterPoint(cx, cy, r, t0 + s));
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`).join('');
  return s >= 1 ? `${d}Z` : d;
}

/** Index of the hexagon edge (0 is top to upper right) that the perimeter fraction lies on. */
export function edgeIndex(t: number): number {
  return Math.floor(wrap01(t) * 6 + 1e-9) % 6;
}

/** Outward unit normal of edge `i` of a pointy-top hexagon: 30, 90, 150, ... degrees clockwise from up. */
export function edgeNormal(i: number): Point {
  const a = ((30 + 60 * i - 90) * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a)];
}

export interface Tick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A tick standing on the ring at perimeter fraction `t`, pointing outward `gap` to `gap + length`. */
export function tickAt(cx: number, cy: number, r: number, t: number, gap: number, length: number): Tick {
  const [px, py] = hexPerimeterPoint(cx, cy, r, wrap01(t));
  const [nx, ny] = edgeNormal(edgeIndex(t));
  return {
    x1: round(px + nx * gap),
    y1: round(py + ny * gap),
    x2: round(px + nx * (gap + length)),
    y2: round(py + ny * (gap + length)),
  };
}

/** The ring position of a value: `start + f * sweep`. */
export function ringPosition(f: number, start: number, sweep: number): number {
  return start + Math.min(1, Math.max(0, f)) * sweep;
}

/** Degrees to a perimeter fraction. */
export function degToFraction(deg: number): number {
  return deg / 360;
}
