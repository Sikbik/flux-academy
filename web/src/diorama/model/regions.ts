/**
 * Which continent a coordinate is on, and a finer sub-region for filters and captions.
 *
 * Two sources agree for almost every point: geography (this file's `regionOfLatLon`) and the continent
 * code a geolocation service reports for a country (`REGION_OF_CC` in places.ts). They differ in a few
 * famous places: services report all of Russia as Europe, and Turkey, Georgia and Cyprus by convention.
 * Nodes take their region from the country (that is what a Flux `geolocation` entry matches on, see
 * FACTS section 3.5); terrain cells, which have no country, use geography.
 */
import type { Region } from './types';

/** Longitude of the Red Sea shore line by latitude: points east of it (and north of 12) are Asia. */
function redSeaShore(lat: number): number {
  if (lat >= 28) return 34.3;
  if (lat >= 17) return 34.3 + ((28 - lat) / 11) * 5.7;
  return 40 + ((17 - lat) / 5) * 3.3;
}

/** Latitude of the Mediterranean shore line: points north of it (at that longitude) are Europe. */
function mediterraneanShore(lon: number): number {
  if (lon < -2) return 35.9;
  if (lon < 6) return 37;
  if (lon < 11.5) return 38;
  return 34.5;
}

/**
 * The continent a point is on by geography, or null for Antarctica. Approximate at borders (a degree or
 * two) by design: bench cells are two to three degrees wide.
 */
export function regionOfLatLon(lat: number, lon: number): Region | null {
  if (lat < -60) return null;

  // Oceania: Australia, New Zealand, Melanesia, Polynesia.
  if (lon >= 110 && lat < -10.5) return 'OC';
  if (lon >= 141 && lat < 0) return 'OC';
  if (lon >= 150 && lat < 22) return 'OC';
  if (lon <= -150 && lat < 22) return 'OC';

  // The Americas (Greenland is North American, Iceland is European).
  if (lon >= -180 && lon <= -30) {
    if (lon >= -92 && lat < 12.8 && !(lat > 7.2 && lon < -77.3)) return 'SA';
    if (lat >= 63 && lat <= 67 && lon >= -25.5) return 'EU';
    return 'NA';
  }

  // Africa: south of the Mediterranean shore and west of the Red Sea.
  if (lat > -36 && lat < 38 && lon >= -26 && lon <= 52) {
    const europeanSide = lat >= 34.5 && lat >= mediterraneanShore(lon);
    const arabianSide = lat >= 12 && lon >= redSeaShore(lat);
    if (!europeanSide && !arabianSide) return 'AF';
  }
  // Madagascar's neighbours: the Mascarene islands.
  if (lat <= -10 && lon > 52 && lon < 70) return 'AF';

  // Europe versus Asia.
  if (lat >= 34.5 && lon >= -26 && lon <= 62) {
    if (lat >= 34.5 && lat <= 36 && lon >= 32 && lon <= 34.8) return 'EU'; // Cyprus
    if (lat < 43.2 && lon >= 26.2) return 'AS'; // Anatolia and the Caucasus
    if (lat >= 50 ? lon <= 60 : lon <= 50) return 'EU';
  }
  return 'AS';
}

/**
 * A finer slice of a continent, written `<REGION>-<part>`. Parts are approximate and only meant to make
 * a filter or a caption more specific ("Europe, central"), not to draw borders.
 */
export function subregionOf(region: Region, lat: number, lon: number): string {
  switch (region) {
    case 'EU':
      if (lat >= 63 || (lat >= 55 && lon >= 5)) return 'EU-N';
      if (lat < 44 && lon >= 5) return 'EU-S';
      if (lon < 5) return 'EU-W';
      if (lon >= 20) return 'EU-E';
      return 'EU-C';
    case 'NA':
      if (lat < 30 && lon > -120) return 'NA-S';
      if (lon < -100) return 'NA-W';
      if (lon < -85) return 'NA-C';
      return 'NA-E';
    case 'SA':
      if (lat > -10) return 'SA-N';
      if (lat < -30) return 'SA-S';
      return lon < -60 ? 'SA-W' : 'SA-E';
    case 'AF':
      if (lat >= 15) return 'AF-N';
      if (lat < -15) return 'AF-S';
      return lon < 15 ? 'AF-W' : 'AF-E';
    case 'AS':
      if (lon < 60) return 'AS-W';
      if (lat >= 50) return 'AS-N';
      if (lat >= 40 && lon < 90) return 'AS-C';
      if (lon < 92 && lat < 38) return 'AS-S';
      if (lat < 22 && lon >= 92) return 'AS-SE';
      return 'AS-E';
    case 'OC':
      return lon > 165 || lon < -150 ? 'OC-NZ' : 'OC-AU';
  }
}
