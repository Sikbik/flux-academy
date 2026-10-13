/**
 * The flat hex world the picker draws, built from the diorama's own terrain and geography (no second
 * world is hand-rolled): the same land cells, the same Miller projection, the same continents.
 *
 * One SVG path per continent holds all of its cells, so the whole map is six `<path>` elements however
 * many hexagons it has. Country pins sit at the largest real cluster of the country in the geo snapshot.
 */

import type { GeoSnapshot } from '@shared/api';
import { latToY, lonToX, REGIONS, type Region, terrainFor } from '@/diorama/model';

export interface WorldMap {
  /** `minX minY width height` for the SVG viewBox, in bench units. */
  viewBox: string;
  width: number;
  height: number;
  /** One compound path per continent. */
  paths: Record<Region, string>;
  /** Cell count per continent (for captions). */
  cells: Record<Region, number>;
  /** Projects a coordinate onto the map. */
  project: (lat: number, lon: number) => { x: number; y: number };
}

const r1 = (n: number): string => (Math.round(n * 10) / 10).toString();

/** Corner `k` of a pointy-top hexagon of circumradius `r` centred on (cx, cy); y grows south. */
const cornerX = (cx: number, r: number, k: number): number =>
  cx + r * Math.cos(Math.PI / 6 + (k * Math.PI) / 3);
const cornerY = (cy: number, r: number, k: number): number =>
  cy + r * Math.sin(Math.PI / 6 + (k * Math.PI) / 3);

let cached: WorldMap | null = null;

/** The shared map. Built on first use (about a millisecond) and kept. */
export function worldMap(): WorldMap {
  if (cached) return cached;
  const { geom, cells } = terrainFor('low');
  const parts: Record<Region, string[]> = { NA: [], SA: [], EU: [], AF: [], AS: [], OC: [] };
  const count: Record<Region, number> = { NA: 0, SA: 0, EU: 0, AF: 0, AS: 0, OC: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const radius = 0.93;
  for (let i = 0; i < cells.count; i++) {
    const cx = cells.x[i] as number;
    const cy = cells.y[i] as number;
    const region = REGIONS[cells.region[i] as number] as Region;
    let d = '';
    for (let k = 0; k < 6; k++) {
      d += `${k === 0 ? 'M' : 'L'}${r1(cornerX(cx, radius, k))} ${r1(cornerY(cy, radius, k))}`;
    }
    parts[region].push(`${d}Z`);
    count[region]++;
    minX = Math.min(minX, cx - 1);
    maxX = Math.max(maxX, cx + 1);
    minY = Math.min(minY, cy - 1);
    maxY = Math.max(maxY, cy + 1);
  }
  const pad = 1.5;
  const width = maxX - minX + 2 * pad;
  const height = maxY - minY + 2 * pad;
  cached = {
    viewBox: `${r1(minX - pad)} ${r1(minY - pad)} ${r1(width)} ${r1(height)}`,
    width,
    height,
    paths: {
      NA: parts.NA.join(''),
      SA: parts.SA.join(''),
      EU: parts.EU.join(''),
      AF: parts.AF.join(''),
      AS: parts.AS.join(''),
      OC: parts.OC.join(''),
    },
    cells: count,
    project: (lat, lon) => ({ x: lonToX(geom, lon), y: latToY(geom, lat) }),
  };
  return cached;
}

export interface CountryPin {
  code: string;
  name: string;
  nodes: number;
  x: number;
  y: number;
}

/** One pin per country that has a located cluster, at its biggest cluster, biggest countries last. */
export function countryPins(geo: GeoSnapshot | null, map: WorldMap = worldMap()): CountryPin[] {
  if (!geo) return [];
  const best = new Map<string, { n: number; lat: number; lon: number }>();
  for (const p of geo.points) {
    const cc = (p.cc ?? '').toUpperCase();
    if (!cc) continue;
    const have = best.get(cc);
    if (!have || p.n > have.n) best.set(cc, { n: p.n, lat: p.lat, lon: p.lon });
  }
  const pins: CountryPin[] = [];
  for (const c of geo.countries) {
    const at = best.get(c.code.toUpperCase());
    if (!at) continue;
    const { x, y } = map.project(at.lat, at.lon);
    pins.push({ code: c.code.toUpperCase(), name: c.name, nodes: c.nodes, x, y });
  }
  return pins.sort((a, b) => a.nodes - b.nodes);
}
