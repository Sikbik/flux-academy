/**
 * The built-in sample world: a deterministic, plausible-looking network used by every lesson and lab
 * that is offline, not marked `live`, or waiting for data. It is a SIMULATION: hubs are real hosting
 * cities so the picture reads right, but the node list is invented, seeded and labelled as such.
 *
 * Tier mix defaults to the live counts in docs/research/FACTS.md (Snapshot 2026-10-12: 3,585 Cumulus,
 * 1,691 Nimbus and 1,829 Stratus of 7,105), so the sample world has the same proportions as the real one.
 */
import { hashInts, mulberry32, pickWeighted } from '../util';
import { assembleBench, freeCellNear, TIER_HEIGHT, tierOf } from './bench';
import { terrainFor } from './cells';
import { SAMPLE_COUNTRIES } from './places';
import { subregionOf } from './regions';
import { type Bench, type BenchNode, REGIONS, type Region, type Resolution } from './types';

export interface SampleBenchOptions {
  /** Pillars to place. Default 130: about one terrain cell in sixteen carries a node. */
  nodes?: number;
  resolution?: Resolution;
  /** [cumulus, nimbus, stratus] shares. Default from FACTS Snapshot 2026-10-12. */
  tierMix?: readonly [number, number, number];
  /** Every continent gets at least this many nodes so any region filter has something to land on. */
  minPerRegion?: number;
}

export const DEFAULT_TIER_MIX: readonly [number, number, number] = [3585, 1691, 1829];

/** Documentation address ranges (RFC 5737), then the shared address space (RFC 6598). Never real nodes. */
function syntheticIp(n: number): string {
  const ranges: ReadonlyArray<readonly [number, number, number]> = [
    [192, 0, 2],
    [198, 51, 100],
    [203, 0, 113],
  ];
  const per = 253;
  const block = Math.floor(n / per);
  const host = (n % per) + 1;
  const r = ranges[block];
  if (r) return `${r[0]}.${r[1]}.${r[2]}.${host}`;
  const over = n - per * ranges.length;
  return `100.64.${(over >> 8) & 255}.${(over & 255) + 1}`;
}

export function buildSampleBench(seed = 1, opts: SampleBenchOptions = {}): Bench {
  const resolution = opts.resolution ?? 'default';
  const want = Math.max(1, Math.min(opts.nodes ?? 130, 600));
  const minPerRegion = Math.max(0, opts.minPerRegion ?? 4);
  const mix = opts.tierMix ?? DEFAULT_TIER_MIX;
  const { geom, cells } = terrainFor(resolution);
  const rng = mulberry32(hashInts(seed, 0x51ab, want));
  const occupied = new Uint8Array(cells.count);

  const countryWeights = SAMPLE_COUNTRIES.map((c) => c.weight);
  const raw: BenchNode[] = [];
  const perRegion: Record<Region, number> = { NA: 0, SA: 0, EU: 0, AF: 0, AS: 0, OC: 0 };

  const place = (countryIndex: number): boolean => {
    const country = SAMPLE_COUNTRIES[countryIndex];
    if (!country) return false;
    const hubIndex = pickWeighted(
      country.hubs.map((h) => h.w),
      rng,
    );
    const hub = country.hubs[hubIndex];
    if (!hub) return false;
    const cell = freeCellNear(geom, cells, occupied, hub.lat, hub.lon, 2, rng);
    if (cell < 0) return false;
    occupied[cell] = 1;
    const tierIndex = pickWeighted(mix, rng) as 0 | 1 | 2;
    const tier = tierOf(tierIndex);
    const jitterLat = (rng() - 0.5) * 0.4;
    const jitterLon = (rng() - 0.5) * 0.4;
    const lat = hub.lat + jitterLat;
    const lon = hub.lon + jitterLon;
    const nodeMix: [number, number, number] = [0, 0, 0];
    nodeMix[tierIndex] = 1;
    raw.push({
      id: '',
      index: 0,
      tier,
      tierIndex,
      cc: country.cc,
      country: country.name,
      city: hub.city,
      label: `${hub.city}, ${country.name}`,
      lat,
      lon,
      region: country.region,
      subregion: subregionOf(country.region, lat, lon),
      x: cells.x[cell] as number,
      y: cells.y[cell] as number,
      cell,
      height: TIER_HEIGHT[tier] * (0.94 + rng() * 0.12),
      count: 1,
      mix: nodeMix,
      operator: '',
      ip: '',
    });
    perRegion[country.region]++;
    return true;
  };

  let guard = 0;
  while (raw.length < want && guard++ < want * 40) {
    place(pickWeighted(countryWeights, rng));
  }
  // Top up thin continents so a region filter always has candidates (deterministic: same stream).
  for (const region of REGIONS) {
    const inRegion = SAMPLE_COUNTRIES.map((c, i) => (c.region === region ? i : -1)).filter((i) => i >= 0);
    const weights = inRegion.map((i) => SAMPLE_COUNTRIES[i]?.weight ?? 0);
    let tries = 0;
    while (perRegion[region] < minPerRegion && tries++ < 200) {
      const pick = inRegion[pickWeighted(weights, rng)];
      if (pick !== undefined) place(pick);
    }
  }

  // Reading order (north to south, west to east) gives stable indices and ids.
  raw.sort((a, b) => a.cell - b.cell);

  // Hosting organisations (the fault domain of a node): some host several nodes in one continent; every
  // id is synthetic. The `operator` field name is kept for the model's consumers.
  const operatorsByRegion: Record<Region, string[]> = { NA: [], SA: [], EU: [], AF: [], AS: [], OC: [] };
  let nextOperator = 1;
  const ipOrder = Array.from({ length: raw.length }, (_, i) => i);
  for (let i = ipOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = ipOrder[i] as number;
    ipOrder[i] = ipOrder[j] as number;
    ipOrder[j] = t;
  }
  raw.forEach((n, i) => {
    n.id = `n${String(i + 1).padStart(3, '0')}`;
    const pool = operatorsByRegion[n.region];
    if (pool.length > 0 && rng() < 0.32) {
      n.operator = pool[Math.floor(rng() * pool.length)] as string;
    } else {
      n.operator = `op-${String(nextOperator++).padStart(3, '0')}`;
      pool.push(n.operator);
    }
    n.ip = syntheticIp(ipOrder[i] as number);
  });

  return assembleBench('sample', seed, resolution, geom, cells, raw);
}
