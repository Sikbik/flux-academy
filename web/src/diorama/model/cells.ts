/**
 * Terrain: the land cells of the hex grid, derived from the land bitmap. A cell is land when enough of
 * its hexagon is. Terrain is independent of any node data and of the seed, so it is built once per
 * resolution and shared by every bench of that resolution (the arrays are read-only by contract).
 */
import { hash01, smoothstep } from '../util';
import { cellCentreX, cellCentreY, geometryFor, HEX_W, xToLon, yToLat } from './geometry';
import { getLandMask, isLand, type LandMask } from './mask';
import { regionOfLatLon } from './regions';
import { type BenchCells, type BenchGeometry, REGION_INDEX, type Resolution } from './types';

/** Land share of a hexagon at or above which the cell is part of the bench. */
export const LAND_THRESHOLD = 0.38;

// Sample offsets inside a unit hexagon: the centre, an inner ring and an outer ring.
const SAMPLES: ReadonlyArray<readonly [number, number]> = (() => {
  const out: Array<[number, number]> = [[0, 0]];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    out.push([Math.cos(a) * 0.5, Math.sin(a) * 0.5]);
  }
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    out.push([Math.cos(a) * 0.88, Math.sin(a) * 0.88]);
  }
  return out;
})();

function coverageAt(g: BenchGeometry, mask: LandMask, cx: number, cy: number): number {
  let hits = 0;
  for (const [dx, dy] of SAMPLES) {
    const lon = xToLon(g, cx + dx);
    const lat = yToLat(g, cy + dy);
    if (isLand(mask, lon, lat)) hits++;
  }
  return hits / SAMPLES.length;
}

/** Smooth value noise over the cell grid, 0..1. */
function valueNoise(u: number, v: number): number {
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const fu = smoothstep(0, 1, u - iu);
  const fv = smoothstep(0, 1, v - iv);
  const a = hash01(iu, iv, 11);
  const b = hash01(iu + 1, iv, 11);
  const c = hash01(iu, iv + 1, 11);
  const d = hash01(iu + 1, iv + 1, 11);
  return a + (b - a) * fu + (c - a) * fv + (a - b - c + d) * fu * fv;
}

/** Relief of a slab: broad undulation plus per-cell jitter, in bench units (short glass, 0.4 to 1.65). */
export function reliefAt(col: number, row: number, coverage: number): number {
  const broad = valueNoise(col * 0.2, row * 0.2);
  const fine = hash01(col, row, 29);
  const h = 0.7 + 1.0 * broad + 0.5 * fine;
  return coverage < 0.62 ? h * 0.78 : h;
}

export function buildCells(g: BenchGeometry, mask: LandMask = getLandMask()): BenchCells {
  const total = g.cols * g.rows;
  const grid = new Int32Array(total).fill(-1);
  const xs: number[] = [];
  const ys: number[] = [];
  const hs: number[] = [];
  const cs: number[] = [];
  const rs: number[] = [];
  const lons: number[] = [];
  const lats: number[] = [];
  const regs: number[] = [];
  const covs: number[] = [];
  for (let row = 0; row < g.rows; row++) {
    const cy = cellCentreY(g, row);
    for (let col = 0; col < g.cols; col++) {
      const cx = cellCentreX(g, col, row);
      const cov = coverageAt(g, mask, cx, cy);
      if (cov < LAND_THRESHOLD) continue;
      const lon = xToLon(g, cx);
      const lat = yToLat(g, cy);
      const region = regionOfLatLon(lat, lon);
      if (region === null) continue;
      grid[row * g.cols + col] = xs.length;
      xs.push(cx);
      ys.push(cy);
      hs.push(reliefAt(col, row, cov));
      cs.push(col);
      rs.push(row);
      lons.push(lon);
      lats.push(lat);
      regs.push(REGION_INDEX[region]);
      covs.push(cov);
    }
  }
  return {
    count: xs.length,
    cols: g.cols,
    rows: g.rows,
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    h: Float32Array.from(hs),
    col: Uint16Array.from(cs),
    row: Uint16Array.from(rs),
    lon: Float32Array.from(lons),
    lat: Float32Array.from(lats),
    region: Uint8Array.from(regs),
    coverage: Float32Array.from(covs),
    grid,
  };
}

const cache = new Map<Resolution, { geom: BenchGeometry; cells: BenchCells }>();

/** The shared terrain of a resolution (built on first use). */
export function terrainFor(resolution: Resolution): { geom: BenchGeometry; cells: BenchCells } {
  let hit = cache.get(resolution);
  if (!hit) {
    const geom = geometryFor(resolution);
    hit = { geom, cells: buildCells(geom) };
    cache.set(resolution, hit);
  }
  return hit;
}

/** Hexagon width in bench units, re-exported for the renderer. */
export const CELL_WIDTH = HEX_W;
