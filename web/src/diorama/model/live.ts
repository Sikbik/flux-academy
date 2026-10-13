/**
 * The live bench: one pillar per cluster of the API's geo snapshot, standing on the cell nearest the
 * cluster's real coordinates. Height grows with the log of the cluster size and the tier colours come
 * from the cluster's own mix. Nothing is invented: a cluster has no city name here, only its country
 * and its coordinates, because the snapshot has no more than that.
 */
import type { GeoSnapshot } from '@shared/api';
import { hashInts, mulberry32 } from '../util';
import { assembleBench, dominantTier, freeCellNear, liveHeight, regionForCountry } from './bench';
import { terrainFor } from './cells';
import { latToY, lonToX } from './geometry';
import { countryName } from './places';
import { regionOfLatLon, subregionOf } from './regions';
import { type Bench, type BenchNode, type Region, type Resolution, TIER_INDEX } from './types';

export interface LiveBenchOptions {
  resolution?: Resolution;
  /** Keeps ids and tie-breaks stable; the data itself decides everything else. Default 1. */
  seed?: number;
  /** Drop clusters smaller than this many nodes (default 1: keep every cluster). */
  minCount?: number;
  /** Keep only the biggest clusters when the snapshot has more than this many (default 400). */
  maxPillars?: number;
}

function formatCoordinates(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(1)}${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}${lon >= 0 ? 'E' : 'W'}`;
}

export function buildLiveBench(geo: GeoSnapshot, opts: LiveBenchOptions = {}): Bench {
  const resolution = opts.resolution ?? 'default';
  const seed = opts.seed ?? 1;
  const minCount = Math.max(1, opts.minCount ?? 1);
  const maxPillars = Math.max(1, opts.maxPillars ?? 400);
  const { geom, cells } = terrainFor(resolution);
  const rng = mulberry32(hashInts(seed, 0x11fe));
  const occupied = new Uint8Array(cells.count);
  const names = new Map(geo.countries.map((c) => [c.code.toUpperCase(), c.name]));

  const points = geo.points
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        Number.isFinite(p.n) &&
        p.n >= minCount &&
        p.t.length === 3,
    )
    // Biggest first: the big clusters get the cells at their true positions, small ones shuffle outward.
    .sort((a, b) => b.n - a.n || a.lat - b.lat || a.lon - b.lon)
    .slice(0, maxPillars);

  const byCell = new Map<number, BenchNode>();
  for (const p of points) {
    let cell = freeCellNear(geom, cells, occupied, p.lat, p.lon, 3, rng);
    if (cell < 0) {
      // Everything within three rings is taken or water: merge into the nearest existing pillar.
      let best = -1;
      let bestD = Number.POSITIVE_INFINITY;
      const px = lonToX(geom, p.lon);
      const py = latToY(geom, p.lat);
      for (const [idx] of byCell) {
        const dx = (cells.x[idx] as number) - px;
        const dy = (cells.y[idx] as number) - py;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = idx;
        }
      }
      cell = best;
      if (cell < 0) continue;
    }
    const existing = byCell.get(cell);
    const mix: [number, number, number] = [p.t[0] ?? 0, p.t[1] ?? 0, p.t[2] ?? 0];
    const sum = mix[0] + mix[1] + mix[2];
    if (sum <= 0) mix[0] = p.n; // a point with no tier split still counts as nodes
    if (existing) {
      existing.mix[0] += mix[0];
      existing.mix[1] += mix[1];
      existing.mix[2] += mix[2];
      existing.count += p.n;
      existing.tier = dominantTier(existing.mix);
      existing.tierIndex = TIER_INDEX[existing.tier];
      existing.height = liveHeight(existing.count);
      continue;
    }
    occupied[cell] = 1;
    const cc = (p.cc ?? '').toUpperCase();
    const geoRegion = regionOfLatLon(p.lat, p.lon);
    const region: Region = regionForCountry(cc) ?? geoRegion ?? 'AS';
    const tier = dominantTier(mix);
    const country = cc ? (names.get(cc) ?? countryName(cc)) : '';
    const node: BenchNode = {
      id: `c${cell}`,
      index: 0,
      tier,
      tierIndex: TIER_INDEX[tier],
      cc,
      country,
      city: '',
      label: '',
      lat: p.lat,
      lon: p.lon,
      region,
      subregion: subregionOf(region, p.lat, p.lon),
      x: cells.x[cell] as number,
      y: cells.y[cell] as number,
      cell,
      height: liveHeight(p.n),
      count: p.n,
      mix,
      operator: '',
      ip: '',
    };
    byCell.set(cell, node);
  }

  const nodes = [...byCell.values()].sort((a, b) => a.cell - b.cell);
  for (const n of nodes) {
    const where = n.country || `${formatCoordinates(n.lat, n.lon)}`;
    n.label = n.count > 1 ? `${where} (cluster of ${n.count} nodes)` : `${where} (1 node)`;
  }
  return assembleBench('live', seed, resolution, geom, cells, nodes);
}
