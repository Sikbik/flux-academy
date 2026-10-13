/**
 * The bench model: what the diorama (and the hero scene) draws and what the simulation reasons about.
 *
 * Coordinates. The bench is a flat plane measured in **hex circumradii**: one unit is the distance from
 * the centre of a terrain cell to one of its corners (pointy-top hexagons, horizontal pitch sqrt(3),
 * row pitch 1.5, odd rows shifted half a pitch to the right). `x` grows east and `y` grows SOUTH, so a
 * 3D scene can use (x, y) directly as (x, z). The origin is the geographic (lon 0, lat 0) point of the
 * projection, which is a Miller cylindrical projection (see `geometry.ts`).
 */

import type { Tier, TierCounts } from '@shared/api';

export type { Tier, TierCounts };

export type Region = 'NA' | 'SA' | 'EU' | 'AF' | 'AS' | 'OC';

/** Display order everywhere (lists, region selects). */
export const REGIONS: readonly Region[] = ['NA', 'SA', 'EU', 'AF', 'AS', 'OC'];

export const REGION_NAMES: Readonly<Record<Region, string>> = {
  NA: 'North America',
  SA: 'South America',
  EU: 'Europe',
  AF: 'Africa',
  AS: 'Asia',
  OC: 'Oceania',
};

export const REGION_INDEX: Readonly<Record<Region, number>> = { NA: 0, SA: 1, EU: 2, AF: 3, AS: 4, OC: 5 };

export const TIER_ORDER: readonly Tier[] = ['cumulus', 'nimbus', 'stratus'];
export const TIER_INDEX: Readonly<Record<Tier, 0 | 1 | 2>> = { cumulus: 0, nimbus: 1, stratus: 2 };
export const TIER_LABEL: Readonly<Record<Tier, string>> = {
  cumulus: 'Cumulus',
  nimbus: 'Nimbus',
  stratus: 'Stratus',
};

/** `sample` is the built-in simulated world; `live` is clustered from a real geo snapshot. */
export type BenchKind = 'sample' | 'live';

/** Terrain density presets: roughly 1.3k, 2k and 3.4k land cells. */
export type Resolution = 'low' | 'default' | 'high';

export interface BenchNode {
  /** Stable id. Sample: `n001`... Live: `c<cell index>` (a cluster pillar). */
  id: string;
  /** Position in `bench.nodes`. */
  index: number;
  /** The dominant tier (ties go to the rarer tier, so a lone Stratus node is not hidden). */
  tier: Tier;
  tierIndex: 0 | 1 | 2;
  /** ISO 3166-1 alpha-2, or '' when unknown. */
  cc: string;
  country: string;
  /** Hub city (sample only; live clusters have no honest city name). */
  city: string;
  /** Human label: "Frankfurt, Germany" or "Germany (cluster of 312 nodes)". */
  label: string;
  lat: number;
  lon: number;
  region: Region;
  /** A finer sub-region such as `EU-C` or `NA-W` (approximate, for filters and captions). */
  subregion: string;
  /** Bench coordinates of the cell the pillar stands on. */
  x: number;
  y: number;
  /** Index into `bench.cells`. */
  cell: number;
  /** Pillar height in bench units: by tier in the sample, by log of the count in live clusters. */
  height: number;
  /** Real nodes this pillar stands for: 1 in the sample world, the cluster size in a live bench. */
  count: number;
  /** [cumulus, nimbus, stratus] counts inside the pillar. A single 1 in the sample world. */
  mix: [number, number, number];
  /** The hosting organisation (a fault domain). Synthetic ids in the sample, '' in live clusters. */
  operator: string;
  /** A synthetic address from the documentation ranges (sample), '' in live clusters. */
  ip: string;
}

/** Struct-of-arrays terrain: one entry per land cell. Shared between benches of one resolution. */
export interface BenchCells {
  count: number;
  cols: number;
  rows: number;
  /** Centre in bench units. */
  x: Float32Array;
  y: Float32Array;
  /** Relief height of the cell's glass slab, bench units. */
  h: Float32Array;
  col: Uint16Array;
  row: Uint16Array;
  lon: Float32Array;
  lat: Float32Array;
  /** Index into `REGIONS`. */
  region: Uint8Array;
  /** Land share of the hexagon, 0..1. */
  coverage: Float32Array;
  /** `cols * rows` lookup: land cell index, or -1 for water and cropped cells. */
  grid: Int32Array;
}

export interface BenchGeometry {
  /** Longitude degrees per cell column at the equator. */
  pitchDeg: number;
  /** Bench units per radian of longitude (and of Miller y). */
  scale: number;
  cols: number;
  rows: number;
  /** Centre of cell (col 0, row 0). */
  x0: number;
  y0: number;
  latMax: number;
  latMin: number;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RegionInfo {
  region: Region;
  name: string;
  /** Land cells whose centre lies in the region. */
  cells: number;
  /** Pillars (nodes) in the region. */
  nodes: number;
  /** Real nodes, summing cluster counts. */
  total: number;
  /** Bounding box of the region's land cells, bench units. */
  box: Box;
  centre: { x: number; y: number };
}

/** A fixed spot a request can come from (a visitor somewhere in the world). */
export interface UserSpot {
  id: string;
  label: string;
  lat: number;
  lon: number;
  region: Region;
  /** Bench coordinates of the spot's own position (not snapped to a cell). */
  x: number;
  y: number;
}

export interface Bench {
  kind: BenchKind;
  seed: number;
  resolution: Resolution;
  geom: BenchGeometry;
  /** Bounding box of every land cell. */
  extent: Box;
  cells: BenchCells;
  nodes: BenchNode[];
  /** Per land cell: the node standing on it, or -1. */
  cellNode: Int32Array;
  regions: Record<Region, RegionInfo>;
  users: UserSpot[];
  totals: {
    /** Real nodes the pillars stand for. */
    nodes: number;
    tiers: TierCounts;
    countries: number;
  };
}
