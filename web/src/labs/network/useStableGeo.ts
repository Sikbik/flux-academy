/**
 * The geo snapshot with a stable identity. The data layer hands out a new object on every refresh, but the
 * bench rebuilds its terrain, its pillars and its engine when the object changes, which would flash the
 * figure for no reason. This keeps the first object until the content actually differs.
 */
import type { GeoSnapshot } from '@shared/api';
import { useMemo } from 'react';

/** A cheap content signature: counts and every point's position, size and tier mix. */
export function geoSignature(g: GeoSnapshot | null): string {
  if (!g) return '';
  let h = 2166136261;
  const mix = (n: number): void => {
    h ^= Math.round(n * 100) | 0;
    h = Math.imul(h, 16777619);
  };
  mix(g.located);
  mix(g.total);
  mix(g.countries.length);
  for (const p of g.points) {
    mix(p.lat);
    mix(p.lon);
    mix(p.n);
    mix(p.t[0]);
    mix(p.t[1]);
    mix(p.t[2]);
  }
  return `${g.points.length}:${h >>> 0}`;
}

export function useStableGeo(geo: GeoSnapshot | null): GeoSnapshot | null {
  const signature = geoSignature(geo);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the signature is the identity of the content
  return useMemo(() => geo, [signature]);
}
