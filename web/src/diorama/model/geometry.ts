/**
 * Bench geometry: the Miller projection, the hex grid laid over it, and the conversions between
 * longitude/latitude, bench coordinates and cell indices. Pure maths, no allocation in the lookups.
 *
 * Why Miller: it stretches the high latitudes a little (Europe and North America, where most of the
 * network sits, get more cells) without Mercator's blow-up, and its inverse is closed form.
 */
import { DEG } from '../util';
import type { BenchGeometry, Resolution } from './types';

export const HEX_W = Math.sqrt(3);
export const HEX_ROW = 1.5;

/** The latitude band of the bench. Antarctica and the far Arctic carry no nodes and cost cells. */
export const LAT_MAX = 72;
export const LAT_MIN = -56;

/** Terrain pitch in degrees of longitude per resolution preset (about 1.3k, 2k and 3.2k land cells). */
export const RESOLUTION_PITCH: Readonly<Record<Resolution, number>> = {
  low: 4.2,
  default: 3.3,
  high: 2.7,
};

function miller(latDeg: number): number {
  return 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * latDeg * DEG));
}

function millerInverseDeg(y: number): number {
  return (2.5 * Math.atan(Math.exp(0.8 * y)) - 0.625 * Math.PI) / DEG;
}

export function makeGeometry(pitchDeg: number): BenchGeometry {
  const scale = HEX_W / (pitchDeg * DEG);
  const cols = Math.floor(360 / pitchDeg);
  const yTop = -scale * miller(LAT_MAX);
  const yBottom = -scale * miller(LAT_MIN);
  const y0 = yTop + 1;
  const rows = Math.floor((yBottom - y0) / HEX_ROW) + 1;
  const x0 = (-180 + 0.5 * pitchDeg) * DEG * scale;
  return { pitchDeg, scale, cols, rows, x0, y0, latMax: LAT_MAX, latMin: LAT_MIN };
}

export function geometryFor(resolution: Resolution): BenchGeometry {
  return makeGeometry(RESOLUTION_PITCH[resolution]);
}

export function lonToX(g: BenchGeometry, lon: number): number {
  return lon * DEG * g.scale;
}

export function latToY(g: BenchGeometry, lat: number): number {
  return -g.scale * miller(lat);
}

export function xToLon(g: BenchGeometry, x: number): number {
  return x / (g.scale * DEG);
}

export function yToLat(g: BenchGeometry, y: number): number {
  return millerInverseDeg(-y / g.scale);
}

/** Centre of a cell by grid position. */
export function cellCentreX(g: BenchGeometry, col: number, row: number): number {
  return g.x0 + HEX_W * (col + 0.5 * (row & 1));
}

export function cellCentreY(g: BenchGeometry, row: number): number {
  return g.y0 + HEX_ROW * row;
}

const SQRT3_3 = Math.sqrt(3) / 3;

/**
 * The grid position (col, row) of the hexagon containing a bench point, written into `out`
 * (`out[0] = col`, `out[1] = row`). Not range checked. Cube rounding on odd-r offset coordinates.
 */
export function gridAt(g: BenchGeometry, x: number, y: number, out: [number, number]): void {
  const px = x - g.x0;
  const py = y - g.y0;
  const qf = SQRT3_3 * px - py / 3;
  const rf = (2 / 3) * py;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  out[0] = q + (r - (r & 1)) / 2;
  out[1] = r;
}

/** The six grid neighbours of (col, row) as (dcol, drow) pairs, for odd and even rows. */
export const NEIGHBOURS_EVEN: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];
export const NEIGHBOURS_ODD: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 1],
];

/** Cube distance between two grid positions (odd-r offset). */
export function gridDistance(c0: number, r0: number, c1: number, r1: number): number {
  const q0 = c0 - (r0 - (r0 & 1)) / 2;
  const q1 = c1 - (r1 - (r1 & 1)) / 2;
  const dq = q1 - q0;
  const dr = r1 - r0;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

/** Where a hexagon corner sits: corner `k` (0..5) of a pointy-top hexagon of circumradius `r`. */
export function cornerX(cx: number, r: number, k: number): number {
  return cx + r * Math.cos(Math.PI / 6 + (k * Math.PI) / 3);
}

export function cornerY(cy: number, r: number, k: number): number {
  // y grows south, so a corner at math angle 30 degrees + k*60 is mirrored: use the same angle with y down.
  return cy + r * Math.sin(Math.PI / 6 + (k * Math.PI) / 3);
}
