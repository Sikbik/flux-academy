/**
 * Small pure helpers that turn engine values into the words and numbers the Reference prints.
 *
 * Everything here reads `@shared/flux` at call time. Nothing is a typed copy of a limit.
 */

import {
  BAKED_PRICING,
  BANNED_PORT_RANGES,
  BUNDLE_INSTANCES,
  type GeoEntry,
  LIMITS,
  type PortRange,
  parseGeolocationEntry,
} from '@shared/flux';
import { plainText } from '@/learn/markup';
import { formatInt } from '@/lib/format';

/** 88000 -> "88,000"; 0.15 -> "0.15". */
export function num(value: number): string {
  if (Number.isInteger(value)) return formatInt(value);
  return String(Number(value.toFixed(6)));
}

/** "$1.99". Prices in tables. */
export function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** "USD 2" for a flat amount in prose, "USD 0.99" for a price. */
export function usd(value: number): string {
  return `USD ${Number.isInteger(value) ? String(value) : value.toFixed(2)}`;
}

/** "1 component", "2 components". */
export function count(value: number, singular: string, plural = `${singular}s`): string {
  return `${num(value)} ${value === 1 ? singular : plural}`;
}

/** `{ from: 16100, to: 16299 }` -> "16100 to 16299"; a single port -> "22". */
export function rangeText(range: PortRange): string {
  return range.from === range.to ? String(range.from) : `${range.from} to ${range.to}`;
}

/** "a, b and c". */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "a, b or c". */
export function orList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** Ranges sorted by their first port. */
export function sortedRanges(ranges: readonly PortRange[]): PortRange[] {
  return [...ranges].sort((a, b) => a.from - b.from || a.to - b.to);
}

/** The banned public ports, in ascending order. */
export function bannedRanges(): PortRange[] {
  return sortedRanges(BANNED_PORT_RANGES);
}

/**
 * The fee ranges a deployer can use. The node's table starts at port 0, which the validator refuses, so the
 * start is clamped to the lowest accepted public port (FACTS 3.4).
 */
export function feeRanges(): PortRange[] {
  return sortedRanges(LIMITS.ports.surchargeRanges)
    .map((r) => ({ from: Math.max(r.from, LIMITS.ports.min), to: r.to }))
    .filter((r) => r.to >= r.from);
}

/** "1 to 1023, 6667, 8080, 8081 and 8443" */
export function feePortsText(): string {
  return andList(feeRanges().map(rangeText));
}

/** The rate of one fee port, from the baked official rates. It goes into the bundle, not onto the bill. */
export function feePortUsd(): number {
  return BAKED_PRICING.params.port;
}

/**
 * What a fee that goes into the three-instance bundle costs per instance: the fee divided by the bundle
 * size, "about USD 0.67" for USD 2. The bill scales with the instance count and equals the fee only at
 * three instances (FACTS 4.3, 4.4).
 */
export function perInstanceFee(feeUsd: number): string {
  return `about ${usd(feeUsd / BUNDLE_INSTANCES)} per instance`;
}

/** How many entries the banned list has. */
export function bannedCount(): number {
  return BANNED_PORT_RANGES.length;
}

/** A banned range that contains the port, or null. */
export function bannedRangeOf(port: number): PortRange | null {
  return BANNED_PORT_RANGES.find((r) => port >= r.from && port <= r.to) ?? null;
}

/** The surcharge range that contains the port, or null. */
export function feeRangeOf(port: number): PortRange | null {
  return feeRanges().find((r) => port >= r.from && port <= r.to) ?? null;
}

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------

export const CONTINENT_NAMES: Readonly<Record<string, string>> = {
  AF: 'Africa',
  AN: 'Antarctica',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
};

/**
 * Write a parsed entry back as text. `parseGeolocationEntry(formatGeoEntry(parseGeolocationEntry(x)))`
 * equals the first parse for every well formed entry, which is what the grammar table shows live.
 * Returns null for an entry the grammar does not know.
 */
export function formatGeoEntry(entry: GeoEntry): string | null {
  const { kind, continent, country, region } = entry;
  switch (kind) {
    case 'allow-all':
      return 'acALL';
    case 'allow-continent':
      return `ac${continent}`;
    case 'allow-country':
      return `ac${continent}_${country}`;
    case 'allow-region':
      return `ac${continent}_${country}_${region}`;
    case 'deny-continent':
      return `a!c${continent}`;
    case 'deny-country':
      return `a!c${continent}_${country}`;
    case 'deny-region':
      return `a!c${continent}_${country}_${region}`;
    case 'legacy-continent':
      return `a${continent}`;
    case 'legacy-country':
      return `b${country}`;
    default:
      return null;
  }
}

/** True when the entry parses cleanly and writes back to an entry that parses the same. */
export function geoRoundTrips(raw: string): boolean {
  const first = parseGeolocationEntry(raw);
  if (first.problems.length > 0) return false;
  const text = formatGeoEntry(first);
  if (text === null) return false;
  const second = parseGeolocationEntry(text);
  return (
    second.kind === first.kind &&
    second.continent === first.continent &&
    second.country === first.country &&
    second.region === first.region &&
    second.problems.length === 0
  );
}

/** A plain sentence for a parsed geolocation entry. */
export function describeGeoEntry(entry: GeoEntry): string {
  const cont = entry.continent ? (CONTINENT_NAMES[entry.continent] ?? entry.continent) : '';
  switch (entry.kind) {
    case 'allow-all':
      return 'Allow every location.';
    case 'allow-continent':
      return `Allow ${cont}.`;
    case 'allow-country':
      return `Allow the country ${entry.country}, in ${cont}.`;
    case 'allow-region':
      return `Allow the region ${entry.region} of ${entry.country}.`;
    case 'deny-continent':
      return `Deny ${cont}.`;
    case 'deny-country':
      return `Deny the country ${entry.country}, in ${cont}.`;
    case 'deny-region':
      return `Deny the region ${entry.region} of ${entry.country}.`;
    case 'legacy-continent':
      return `Old style: allow only ${cont}. The first one wins.`;
    case 'legacy-country':
      return `Old style: allow only the country ${entry.country}. The first one wins.`;
    default:
      return 'Not an entry the network is documented to understand. What it does with it is not documented: assume it matches nothing.';
  }
}

// ---------------------------------------------------------------------------
// Text for search
// ---------------------------------------------------------------------------

/** Markup to plain text: code spans keep their text, directives collapse to their id in words. */
export function plain(markup: string): string {
  return plainText(markup);
}
