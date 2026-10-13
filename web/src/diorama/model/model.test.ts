import type { GeoSnapshot } from '@shared/api';
import { describe, expect, it } from 'vitest';
import { terrainFor } from './cells';
import { cellCentreX, cellCentreY, geometryFor, gridAt, latToY, lonToX, xToLon, yToLat } from './geometry';
import { LAND_MASK_LAND_CELLS } from './land-mask.data';
import { buildLiveBench } from './live';
import { getLandMask, isLand } from './mask';
import { regionOfLatLon } from './regions';
import { buildSampleBench } from './sample';
import { REGIONS, TIER_HEIGHT_ORDER_CHECK } from './test-helpers';

describe('land mask', () => {
  it('decodes to the expected number of land cells', () => {
    const mask = getLandMask();
    let land = 0;
    for (const c of mask.cells) land += c;
    expect(land).toBe(LAND_MASK_LAND_CELLS);
  });

  it('knows land from water', () => {
    const mask = getLandMask();
    expect(isLand(mask, 2.35, 48.86)).toBe(true); // Paris
    expect(isLand(mask, -140, 0)).toBe(false); // the Pacific
    expect(isLand(mask, 134, -25)).toBe(true); // central Australia
    expect(isLand(mask, -30, 30)).toBe(false); // the Atlantic
  });
});

describe('geometry', () => {
  const g = geometryFor('default');

  it('round-trips longitude and latitude', () => {
    for (const [lon, lat] of [
      [0, 0],
      [8.68, 50.11],
      [-74, 40.7],
      [151.2, -33.9],
      [-170, 65],
    ] as const) {
      const x = lonToX(g, lon);
      const y = latToY(g, lat);
      expect(xToLon(g, x)).toBeCloseTo(lon, 6);
      expect(yToLat(g, y)).toBeCloseTo(lat, 6);
    }
  });

  it('keeps y growing south', () => {
    expect(latToY(g, 50)).toBeLessThan(latToY(g, 0));
    expect(latToY(g, -30)).toBeGreaterThan(latToY(g, 0));
  });

  it('finds the cell under a cell centre', () => {
    const out: [number, number] = [0, 0];
    for (const [col, row] of [
      [0, 0],
      [10, 7],
      [11, 8],
      [g.cols - 1, g.rows - 1],
      [50, 25],
    ] as const) {
      gridAt(g, cellCentreX(g, col, row), cellCentreY(g, row), out);
      expect(out).toEqual([col, row]);
    }
  });
});

describe('terrain', () => {
  it('has about two thousand land cells at the default resolution', () => {
    const { cells } = terrainFor('default');
    expect(cells.count).toBeGreaterThanOrEqual(1500);
    expect(cells.count).toBeLessThanOrEqual(2500);
  });

  it('orders the presets low < default < high', () => {
    const lo = terrainFor('low').cells.count;
    const mid = terrainFor('default').cells.count;
    const hi = terrainFor('high').cells.count;
    expect(lo).toBeLessThan(mid);
    expect(mid).toBeLessThan(hi);
  });

  it('is shared between calls', () => {
    expect(terrainFor('default').cells).toBe(terrainFor('default').cells);
  });

  it('has a consistent grid and sane relief', () => {
    const { cells, geom } = terrainFor('default');
    let seen = 0;
    for (let i = 0; i < geom.cols * geom.rows; i++) {
      const c = cells.grid[i] as number;
      if (c < 0) continue;
      seen++;
      expect((cells.row[c] as number) * geom.cols + (cells.col[c] as number)).toBe(i);
    }
    expect(seen).toBe(cells.count);
    for (let i = 0; i < cells.count; i++) {
      expect(cells.h[i] as number).toBeGreaterThan(0.3);
      expect(cells.h[i] as number).toBeLessThan(2.4);
    }
  });

  it('puts every continent on the bench', () => {
    const { cells } = terrainFor('default');
    const seen = new Set<number>();
    for (let i = 0; i < cells.count; i++) seen.add(cells.region[i] as number);
    expect(seen.size).toBe(REGIONS.length);
  });
});

describe('regionOfLatLon', () => {
  it.each([
    ['Frankfurt', 50.11, 8.68, 'EU'],
    ['London', 51.5, -0.13, 'EU'],
    ['Madrid', 40.4, -3.7, 'EU'],
    ['Helsinki', 60.17, 24.94, 'EU'],
    ['Moscow', 55.76, 37.62, 'EU'],
    ['Reykjavik', 64.15, -21.9, 'EU'],
    ['New York', 40.71, -74.0, 'NA'],
    ['Mexico City', 19.43, -99.13, 'NA'],
    ['Panama City', 8.98, -79.5, 'NA'],
    ['Sao Paulo', -23.55, -46.63, 'SA'],
    ['Bogota', 4.71, -74.07, 'SA'],
    ['Lagos', 6.52, 3.38, 'AF'],
    ['Cairo', 30.04, 31.24, 'AF'],
    ['Cape Town', -33.9, 18.4, 'AF'],
    ['Nairobi', -1.29, 36.8, 'AF'],
    ['Tokyo', 35.68, 139.69, 'AS'],
    ['Singapore', 1.35, 103.82, 'AS'],
    ['Mumbai', 19.08, 72.88, 'AS'],
    ['Dubai', 25.2, 55.27, 'AS'],
    ['Istanbul', 41.01, 28.98, 'AS'],
    ['Jakarta', -6.2, 106.85, 'AS'],
    ['Sydney', -33.87, 151.2, 'OC'],
    ['Auckland', -36.85, 174.76, 'OC'],
  ] as const)('%s is in %s', (_name, lat, lon, expected) => {
    expect(regionOfLatLon(lat, lon)).toBe(expected);
  });

  it('has no region for Antarctica', () => {
    expect(regionOfLatLon(-75, 0)).toBeNull();
  });
});

describe('buildSampleBench', () => {
  it('is deterministic for a seed', () => {
    const a = buildSampleBench(7);
    const b = buildSampleBench(7);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.totals).toEqual(b.totals);
    expect(a.regions).toEqual(b.regions);
  });

  it('differs between seeds', () => {
    const a = buildSampleBench(1);
    const b = buildSampleBench(2);
    expect(a.nodes.map((n) => n.cell)).not.toEqual(b.nodes.map((n) => n.cell));
  });

  it('places the requested number of nodes on distinct land cells inside the extent', () => {
    const bench = buildSampleBench(3, { nodes: 150 });
    expect(bench.nodes.length).toBeGreaterThanOrEqual(150);
    expect(bench.nodes.length).toBeLessThanOrEqual(150 + 6 * 4);
    const cells = new Set(bench.nodes.map((n) => n.cell));
    expect(cells.size).toBe(bench.nodes.length);
    for (const n of bench.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(bench.extent.minX);
      expect(n.x).toBeLessThanOrEqual(bench.extent.maxX);
      expect(n.y).toBeGreaterThanOrEqual(bench.extent.minY);
      expect(n.y).toBeLessThanOrEqual(bench.extent.maxY);
      expect(bench.cellNode[n.cell]).toBe(n.index);
      expect(bench.cells.x[n.cell]).toBeCloseTo(n.x, 4);
    }
  });

  it('has unique ids and synthetic addresses', () => {
    const bench = buildSampleBench(5, { nodes: 400 });
    expect(new Set(bench.nodes.map((n) => n.id)).size).toBe(bench.nodes.length);
    expect(new Set(bench.nodes.map((n) => n.ip)).size).toBe(bench.nodes.length);
    for (const n of bench.nodes) {
      expect(n.ip).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113|100\.64)\./);
    }
  });

  it('keeps the tier mix close to the requested shares', () => {
    const bench = buildSampleBench(11, { nodes: 600 });
    const total = bench.nodes.length;
    const share = (tier: string) => bench.nodes.filter((n) => n.tier === tier).length / total;
    // FACTS Snapshot 2026-10-12: 3585 / 1691 / 1829 of 7105.
    expect(share('cumulus')).toBeGreaterThan(0.44);
    expect(share('cumulus')).toBeLessThan(0.57);
    expect(share('nimbus')).toBeGreaterThan(0.18);
    expect(share('nimbus')).toBeLessThan(0.3);
    expect(share('stratus')).toBeGreaterThan(0.19);
    expect(share('stratus')).toBeLessThan(0.32);
    expect(bench.totals.tiers.cumulus + bench.totals.tiers.nimbus + bench.totals.tiers.stratus).toBe(total);
  });

  it('orders pillar heights by tier', () => {
    const bench = buildSampleBench(2);
    expect(TIER_HEIGHT_ORDER_CHECK(bench.nodes)).toBe(true);
  });

  it('gives every continent at least a few nodes', () => {
    const bench = buildSampleBench(9, { nodes: 60 });
    for (const r of REGIONS) expect(bench.regions[r].nodes).toBeGreaterThanOrEqual(4);
  });

  it('labels nodes with their hub and country and keeps region consistent with the country', () => {
    const bench = buildSampleBench(4);
    for (const n of bench.nodes) {
      expect(n.label).toBe(`${n.city}, ${n.country}`);
      expect(n.subregion.startsWith(n.region)).toBe(true);
    }
    const frankfurt = bench.nodes.find((n) => n.city === 'Frankfurt');
    if (frankfurt) {
      expect(frankfurt.cc).toBe('DE');
      expect(frankfurt.region).toBe('EU');
    }
  });

  it('supports every resolution', () => {
    for (const resolution of ['low', 'default', 'high'] as const) {
      const bench = buildSampleBench(1, { resolution, nodes: 80 });
      expect(bench.resolution).toBe(resolution);
      expect(bench.nodes.length).toBeGreaterThan(70);
    }
  });

  it('provides user spots on the bench', () => {
    const bench = buildSampleBench(1);
    expect(bench.users.length).toBeGreaterThanOrEqual(8);
    for (const u of bench.users) {
      expect(u.x).toBeGreaterThan(bench.extent.minX - 10);
      expect(u.x).toBeLessThan(bench.extent.maxX + 10);
    }
  });
});

const GEO: GeoSnapshot = {
  located: 230,
  total: 240,
  countries: [
    { code: 'DE', name: 'Germany', nodes: 120, tiers: { cumulus: 60, nimbus: 30, stratus: 30 } },
    { code: 'US', name: 'United States', nodes: 70, tiers: { cumulus: 40, nimbus: 10, stratus: 20 } },
    { code: 'JP', name: 'Japan', nodes: 40, tiers: { cumulus: 10, nimbus: 10, stratus: 20 } },
  ],
  points: [
    { lat: 50.1, lon: 8.7, n: 90, cc: 'DE', t: [50, 20, 20] },
    { lat: 52.5, lon: 13.4, n: 30, cc: 'DE', t: [10, 10, 10] },
    { lat: 39.0, lon: -77.5, n: 40, cc: 'US', t: [20, 5, 15] },
    { lat: 37.3, lon: -121.9, n: 30, cc: 'US', t: [20, 5, 5] },
    { lat: 35.7, lon: 139.7, n: 40, cc: 'JP', t: [10, 10, 20] },
    { lat: 1.35, lon: 103.8, n: 1, t: [0, 0, 1] },
  ],
};

describe('buildLiveBench', () => {
  it('makes one pillar per cluster and keeps every node counted', () => {
    const bench = buildLiveBench(GEO);
    expect(bench.kind).toBe('live');
    expect(bench.nodes.length).toBe(GEO.points.length);
    const n = GEO.points.reduce((s, p) => s + p.n, 0);
    expect(bench.totals.nodes).toBe(n);
    expect(bench.totals.tiers.cumulus + bench.totals.tiers.nimbus + bench.totals.tiers.stratus).toBe(n);
    expect(bench.totals.countries).toBe(3);
  });

  it('is deterministic and independent of input order', () => {
    const a = buildLiveBench(GEO, { seed: 3 });
    const b = buildLiveBench({ ...GEO, points: [...GEO.points].reverse() }, { seed: 3 });
    expect(b.nodes.map((n) => [n.cell, n.count])).toEqual(a.nodes.map((n) => [n.cell, n.count]));
  });

  it('takes tier colour from the mix and height from the count', () => {
    const bench = buildLiveBench(GEO);
    const big = bench.nodes.find((n) => n.count === 90);
    const small = bench.nodes.find((n) => n.count === 1);
    expect(big?.tier).toBe('cumulus');
    expect(small?.tier).toBe('stratus');
    expect(big?.mix).toEqual([50, 20, 20]);
    expect((big?.height ?? 0) > (small?.height ?? 0)).toBe(true);
  });

  it('uses the continent of the country and never invents a city', () => {
    const bench = buildLiveBench(GEO);
    const us = bench.nodes.filter((n) => n.cc === 'US');
    expect(us.length).toBe(2);
    for (const n of us) expect(n.region).toBe('NA');
    for (const n of bench.nodes) {
      expect(n.city).toBe('');
      expect(n.label.length).toBeGreaterThan(0);
    }
    expect(bench.nodes.find((n) => n.cc === 'DE')?.label).toContain('Germany');
  });

  it('merges clusters that land on the same cell', () => {
    const crowded: GeoSnapshot = {
      ...GEO,
      points: Array.from({ length: 80 }, (_, i) => ({
        lat: 50 + (i % 5) * 0.05,
        lon: 8 + (i % 7) * 0.05,
        n: 2,
        cc: 'DE',
        t: [1, 1, 0] as [number, number, number],
      })),
    };
    const bench = buildLiveBench(crowded);
    expect(bench.nodes.length).toBeLessThan(80);
    expect(bench.totals.nodes).toBe(160);
  });

  it('honours minCount and maxPillars', () => {
    expect(buildLiveBench(GEO, { minCount: 35 }).nodes.length).toBe(3);
    expect(buildLiveBench(GEO, { maxPillars: 2 }).nodes.length).toBe(2);
  });

  it('survives an empty snapshot', () => {
    const bench = buildLiveBench({ located: 0, total: 0, countries: [], points: [] });
    expect(bench.nodes.length).toBe(0);
    expect(bench.cells.count).toBeGreaterThan(1000);
  });
});
