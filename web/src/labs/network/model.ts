/**
 * The Network Lab's numbers, as pure functions of the live snapshots. Nothing here invents a figure: every
 * value is read from `GeoSnapshot`, `NetworkSnapshot` or `BlocksSnapshot`, or derived from them with the
 * arithmetic stated beside it (FACTS section 2.8 for the payout interval).
 */
import type { BlockSummary, GeoCountry, Tier, TierCounts } from '@shared/api';
import { TARGET_BLOCK_SEC } from '@shared/flux/blocks';

export type TierFilter = Tier | 'all';

export const TIERS_ASC: readonly Tier[] = ['cumulus', 'nimbus', 'stratus'];

export interface CountryRow {
  code: string;
  name: string;
  /** Nodes that pass the tier filter. */
  nodes: number;
  /** All three tier counts of the country, unfiltered, for the stacked bar. */
  tiers: TierCounts;
  /** Share of the filtered total, 0..1. */
  share: number;
  /** Length relative to the biggest row, 0..1. */
  bar: number;
}

export function nodesIn(c: GeoCountry, filter: TierFilter): number {
  return filter === 'all' ? c.nodes : c.tiers[filter];
}

/**
 * Countries sorted by node count (largest first, then by name), restricted to a tier, optionally matched
 * against a query on the name or the ISO code. Rows with no node left by the tier filter are dropped.
 */
export function countryRows(
  countries: readonly GeoCountry[],
  filter: TierFilter,
  query = '',
): { rows: CountryRow[]; total: number } {
  const q = query.trim().toLowerCase();
  const withNodes = countries
    .map((c) => ({ c, n: nodesIn(c, filter) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.c.name.localeCompare(b.c.name));
  const total = withNodes.reduce((s, x) => s + x.n, 0);
  const top = withNodes[0]?.n ?? 0;
  const rows = withNodes
    .filter((x) => q === '' || x.c.name.toLowerCase().includes(q) || x.c.code.toLowerCase() === q)
    .map(({ c, n }) => ({
      code: c.code.toUpperCase(),
      name: c.name,
      nodes: n,
      tiers: c.tiers,
      share: total > 0 ? n / total : 0,
      bar: top > 0 ? n / top : 0,
    }));
  return { rows, total };
}

export interface TierSummary {
  tier: Tier;
  nodes: number;
  /** Share of all nodes, 0..1. */
  share: number;
  /** FLUX that must stay locked per node. */
  collateralFlux: number;
  /** FLUX paid to the one node of this tier in each block. */
  rewardPerBlockFlux: number;
  /** Mean days between payouts for one node: one node per tier is paid per block, in rotation. */
  paidEveryDays: number | null;
  /** FLUX locked in this tier: nodes times collateral (derived). */
  lockedFlux: number;
}

export function blocksPerDay(blockSec: number = TARGET_BLOCK_SEC): number {
  return 86_400 / (Number.isFinite(blockSec) && blockSec > 0 ? blockSec : TARGET_BLOCK_SEC);
}

export function tierSummaries(
  counts: TierCounts,
  collateral: TierCounts,
  perBlock: TierCounts,
  blockSec: number = TARGET_BLOCK_SEC,
): TierSummary[] {
  const total = counts.cumulus + counts.nimbus + counts.stratus;
  return TIERS_ASC.map((tier) => {
    const nodes = counts[tier];
    return {
      tier,
      nodes,
      share: total > 0 ? nodes / total : 0,
      collateralFlux: collateral[tier],
      rewardPerBlockFlux: perBlock[tier],
      paidEveryDays: nodes > 0 ? nodes / blocksPerDay(blockSec) : null,
      lockedFlux: nodes * collateral[tier],
    };
  });
}

/** "1.2 days", "14 hours", "40 min": how long a node waits between payouts, from days. */
export function formatWait(days: number | null | undefined): string {
  if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0) return '--';
  if (days >= 1.95) return `${Math.round(days)} days`;
  if (days >= 1) return `${days.toFixed(1)} days`;
  const hours = days * 24;
  if (hours >= 1.5) return `${Math.round(hours)} hours`;
  return `${Math.max(1, Math.round(hours * 60))} min`;
}

/** Mean seconds between blocks over the recent blocks that carry an interval, or null. */
export function meanInterval(blocks: readonly BlockSummary[]): number | null {
  const xs = blocks.map((b) => b.intervalSec).filter((x): x is number => typeof x === 'number' && x > 0);
  if (xs.length === 0) return null;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** The intervals as a sparkline series (oldest first); the oldest block has none and is skipped. */
export function intervalSeries(blocks: readonly BlockSummary[], last = 60): number[] {
  return blocks
    .map((b) => b.intervalSec)
    .filter((x): x is number => typeof x === 'number' && x > 0)
    .slice(-last);
}

/** The block heights that go with `intervalSeries`, so a point can say which block it is. */
export function intervalHeights(blocks: readonly BlockSummary[], last = 60): number[] {
  return blocks
    .filter(
      (b): b is BlockSummary & { intervalSec: number } =>
        typeof b.intervalSec === 'number' && b.intervalSec > 0,
    )
    .slice(-last)
    .map((b) => b.height);
}

/** The slowest and fastest of the series, for the dial caption. */
export function intervalRange(series: readonly number[]): { min: number; max: number } | null {
  if (series.length === 0) return null;
  return { min: Math.min(...series), max: Math.max(...series) };
}

/** Distinct countries a visitor has hovered or focused, for the globetrotter achievement. */
export const GLOBETROTTER_GOAL = 15;

/** Adds `code` to the explored set (immutable). Unknown or empty codes are ignored. */
export function explore(set: ReadonlySet<string>, code: string | null | undefined): Set<string> {
  const next = new Set(set);
  const c = (code ?? '').trim().toUpperCase();
  if (c.length === 2) next.add(c);
  return next;
}

/** Rebuilds the explored set from what storage returned. Anything that is not a two letter code is dropped. */
export function restoreExplored(raw: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(raw)) return out;
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const c = v.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(c)) out.add(c);
  }
  return out;
}
