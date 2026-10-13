/**
 * Shared pieces of both bench builders: pillar heights, the nearest-free-cell search, and the assembly
 * of a `Bench` (region summaries, the cell-to-node lookup, user spots, totals) from a list of nodes.
 */
import type { Rng } from '../util';
import { DEG } from '../util';
import { gridAt, latToY, lonToX, NEIGHBOURS_EVEN, NEIGHBOURS_ODD } from './geometry';
import { REGION_OF_CC, USER_SEEDS } from './places';
import {
  type Bench,
  type BenchCells,
  type BenchGeometry,
  type BenchKind,
  type BenchNode,
  type Box,
  REGION_INDEX,
  REGION_NAMES,
  REGIONS,
  type Region,
  type RegionInfo,
  type Resolution,
  TIER_ORDER,
  type Tier,
} from './types';

/** Pillar height by tier in the sample world, in bench units (a terrain slab is 0.5 to 2.3 tall). */
export const TIER_HEIGHT: Readonly<Record<Tier, number>> = { cumulus: 3.6, nimbus: 5.8, stratus: 8.4 };

/** Pillar height of a live cluster: grows with the log of its node count, capped. */
export function liveHeight(count: number): number {
  return Math.min(11, 2.6 + 1.2 * Math.log2(1 + Math.max(1, count)));
}

/** The tier with the most nodes; ties go to the rarer, higher tier so a lone Stratus node is not hidden. */
export function dominantTier(mix: readonly [number, number, number]): Tier {
  const [c, n, s] = mix;
  if (s >= n && s >= c) return 'stratus';
  if (n >= c) return 'nimbus';
  return 'cumulus';
}

/** Continent of a node: the country's continent code when known, else geography. */
export function regionForCountry(cc: string): Region | null {
  return REGION_OF_CC[cc.toUpperCase()] ?? null;
}

/**
 * A free land cell near a point: the nearest ring (cube distance) of cells around the cell containing
 * the point that holds one, ties broken by `rng`. Returns -1 when the rings up to `maxRing` are all
 * water or taken.
 */
export function freeCellNear(
  g: BenchGeometry,
  cells: BenchCells,
  occupied: Uint8Array,
  lat: number,
  lon: number,
  maxRing: number,
  rng: Rng,
): number {
  const pos: [number, number] = [0, 0];
  gridAt(g, lonToX(g, lon), latToY(g, lat), pos);
  const col0 = pos[0];
  const row0 = pos[1];
  const found: number[] = [];
  for (let ring = 0; ring <= maxRing; ring++) {
    found.length = 0;
    if (ring === 0) {
      tryCell(g, cells, occupied, col0, row0, found);
    } else {
      // Walk the ring: start ring steps to the west-ish corner, then six edges of `ring` steps.
      let c = col0;
      let r = row0;
      for (let i = 0; i < ring; i++) {
        const n = (r & 1) === 0 ? NEIGHBOURS_EVEN[4] : NEIGHBOURS_ODD[4];
        c += (n as readonly [number, number])[0];
        r += (n as readonly [number, number])[1];
      }
      for (let side = 0; side < 6; side++) {
        for (let i = 0; i < ring; i++) {
          tryCell(g, cells, occupied, c, r, found);
          const n = (r & 1) === 0 ? NEIGHBOURS_EVEN[side] : NEIGHBOURS_ODD[side];
          c += (n as readonly [number, number])[0];
          r += (n as readonly [number, number])[1];
        }
      }
    }
    if (found.length > 0) return found[Math.floor(rng() * found.length)] as number;
  }
  return -1;
}

function tryCell(
  g: BenchGeometry,
  cells: BenchCells,
  occupied: Uint8Array,
  col: number,
  row: number,
  out: number[],
): void {
  if (col < 0 || row < 0 || col >= g.cols || row >= g.rows) return;
  const idx = cells.grid[row * g.cols + col] as number;
  if (idx >= 0 && occupied[idx] === 0) out.push(idx);
}

function emptyBox(): Box {
  return {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
}

/** Assembles a bench from nodes that already carry their cell, region, tier and height. */
export function assembleBench(
  kind: BenchKind,
  seed: number,
  resolution: Resolution,
  geom: BenchGeometry,
  cells: BenchCells,
  nodes: BenchNode[],
): Bench {
  nodes.forEach((n, i) => {
    n.index = i;
  });
  const cellNode = new Int32Array(cells.count).fill(-1);
  for (const n of nodes) cellNode[n.cell] = n.index;

  const extent = emptyBox();
  const boxes: Record<Region, Box> = {
    NA: emptyBox(),
    SA: emptyBox(),
    EU: emptyBox(),
    AF: emptyBox(),
    AS: emptyBox(),
    OC: emptyBox(),
  };
  const cellCounts: Record<Region, number> = { NA: 0, SA: 0, EU: 0, AF: 0, AS: 0, OC: 0 };
  for (let i = 0; i < cells.count; i++) {
    const x = cells.x[i] as number;
    const y = cells.y[i] as number;
    const region = REGIONS[cells.region[i] as number] as Region;
    cellCounts[region]++;
    const b = boxes[region];
    b.minX = Math.min(b.minX, x - 1);
    b.maxX = Math.max(b.maxX, x + 1);
    b.minY = Math.min(b.minY, y - 1);
    b.maxY = Math.max(b.maxY, y + 1);
    extent.minX = Math.min(extent.minX, x - 1);
    extent.maxX = Math.max(extent.maxX, x + 1);
    extent.minY = Math.min(extent.minY, y - 1);
    extent.maxY = Math.max(extent.maxY, y + 1);
  }

  const tiers = { cumulus: 0, nimbus: 0, stratus: 0 };
  const countries = new Set<string>();
  const nodeCounts: Record<Region, number> = { NA: 0, SA: 0, EU: 0, AF: 0, AS: 0, OC: 0 };
  const totals: Record<Region, number> = { NA: 0, SA: 0, EU: 0, AF: 0, AS: 0, OC: 0 };
  let total = 0;
  for (const n of nodes) {
    tiers.cumulus += n.mix[0];
    tiers.nimbus += n.mix[1];
    tiers.stratus += n.mix[2];
    total += n.count;
    nodeCounts[n.region]++;
    totals[n.region] += n.count;
    if (n.cc) countries.add(n.cc);
  }

  const regions = {} as Record<Region, RegionInfo>;
  for (const region of REGIONS) {
    const box = boxes[region];
    if (!Number.isFinite(box.minX)) {
      box.minX = box.minY = 0;
      box.maxX = box.maxY = 1;
    }
    regions[region] = {
      region,
      name: REGION_NAMES[region],
      cells: cellCounts[region],
      nodes: nodeCounts[region],
      total: totals[region],
      box,
      centre: { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 },
    };
  }

  const users = USER_SEEDS.map((u) => ({
    id: u.id,
    label: u.label,
    lat: u.lat,
    lon: u.lon,
    region: u.region,
    x: lonToX(geom, u.lon),
    y: latToY(geom, u.lat),
  }));

  return {
    kind,
    seed,
    resolution,
    geom,
    extent,
    cells,
    nodes,
    cellNode,
    regions,
    users,
    totals: { nodes: total, tiers, countries: countries.size },
  };
}

/** The cells of a region as indices (for highlights). */
export function cellsOfRegion(cells: BenchCells, region: Region): number[] {
  const want = REGION_INDEX[region];
  const out: number[] = [];
  for (let i = 0; i < cells.count; i++) if (cells.region[i] === want) out.push(i);
  return out;
}

/** Tier from its index. */
export function tierOf(index: 0 | 1 | 2): Tier {
  return TIER_ORDER[index] as Tier;
}

/** Degrees of arc for a bench distance at the equator, for tooltips and tests. */
export function benchToDegrees(g: BenchGeometry, units: number): number {
  return units / (g.scale * DEG);
}
