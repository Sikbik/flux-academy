/**
 * The ambient tour's playlist: "did you know" facts drawn from the curriculum, the glossary, the
 * protocol (every figure traced to docs/research/FACTS.md through `shared/flux`) and the live network.
 * Pure.
 *
 * The playlist is stable in length: live captions are listed by METRIC, and the view fills in the number
 * from the data layer when it renders, so a number arriving mid tour never reshuffles the order. A metric
 * that has no data yet says so ("Syncing with the chain") rather than showing a zero.
 */

import type { NetworkSnapshot } from '@shared/api';
import type { LessonMeta } from '@shared/curriculum';
import { BLOCKS_PER_MONTH } from '@shared/flux/blocks';
import { LIMITS } from '@shared/flux/spec';
import { TIER_FACTS, TIER_ORDER } from '@shared/flux/tiers';
import type { ChainClock, DataStatus } from '@/data/types';
import type { GlossaryTerm } from '@/learn/types';
import { formatCompact, formatInt, formatPct, formatUsd, NONE } from '@/lib/format';

export type LiveMetric = 'height' | 'nodes' | 'price' | 'apps' | 'capacity';
export type TextSource = 'glossary' | 'course' | 'protocol';

export type Caption =
  | { id: string; kind: 'live'; label: string; metric: LiveMetric }
  | { id: string; kind: 'text'; label: string; source: TextSource; headline: string; body: string };

export const LIVE_METRICS: readonly LiveMetric[] = ['height', 'nodes', 'price', 'apps', 'capacity'];

const LIVE_LABEL: Record<LiveMetric, string> = {
  height: 'The chain',
  nodes: 'The network',
  price: 'The market',
  apps: 'On the network',
  capacity: 'Capacity',
};

/** Plain text of a markup string: directives collapse to their words, emphasis marks go. */
function plain(markup: string): string {
  return markup
    .replace(/\{\{(?:term|lesson|lab):([^}|]*)(?:\|[^}]*)?\}\}/g, (_m, id: string) => id.replace(/-/g, ' '))
    .replace(/\{\{kbd:([^}]*)\}\}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*`]/g, '');
}

/** Protocol and limit facts. Each is derived from `shared/flux`, which cites its source. */
export function protocolCaptions(): Caption[] {
  const collateral = TIER_ORDER.map(
    (id) => `${TIER_FACTS[id].name} ${formatInt(TIER_FACTS[id].collateralFlux)}`,
  ).join(', ');
  const comp = LIMITS.component;
  const inst = LIMITS.instances;
  return [
    {
      id: 'fact:rotation',
      kind: 'text',
      source: 'protocol',
      label: 'How the chain pays',
      headline: 'One node per tier, every block',
      body: 'Each tier keeps a queue of confirmed nodes. The one at the front is paid, then goes to the back.',
    },
    {
      id: 'fact:collateral',
      kind: 'text',
      source: 'protocol',
      label: 'What a node locks',
      headline: 'Collateral, in FLUX',
      body: `${collateral}. The coins stay locked for as long as the node runs.`,
    },
    {
      id: 'fact:components',
      kind: 'text',
      source: 'protocol',
      label: 'What an app can be',
      headline: `Up to ${comp.max} containers in one app`,
      body: `A Flux app holds ${comp.min} to ${comp.max} components, each with its own image, ports and resources.`,
    },
    {
      id: 'fact:instances',
      kind: 'text',
      source: 'protocol',
      label: 'How it spreads',
      headline: `${inst.min} to ${inst.max} copies of your app`,
      body: 'Each copy runs on its own node. No two instances of one app share a node.',
    },
    {
      id: 'fact:month',
      kind: 'text',
      source: 'protocol',
      label: 'How long it lasts',
      headline: `${formatInt(BLOCKS_PER_MONTH)} blocks is a month`,
      body: 'A subscription is counted in blocks. At about thirty seconds each, that is roughly thirty days.',
    },
  ];
}

export function termCaptions(terms: readonly GlossaryTerm[], limit = 14): Caption[] {
  // A spread through the (alphabetical) list, so the tour is not twelve terms starting with "A".
  const step = Math.max(1, Math.floor(terms.length / Math.max(1, limit)));
  const picked: GlossaryTerm[] = [];
  for (let i = 0; i < terms.length && picked.length < limit; i += step) {
    const t = terms[i];
    if (t) picked.push(t);
  }
  return picked.map((t) => ({
    id: `term:${t.id}`,
    kind: 'text' as const,
    source: 'glossary' as const,
    label: 'Glossary',
    headline: t.term,
    body: plain(t.short),
  }));
}

export function lessonCaptions(lessons: readonly LessonMeta[]): Caption[] {
  return [...lessons]
    .sort((a, b) => a.order - b.order)
    .map((l) => ({
      id: `lesson:${l.id}`,
      kind: 'text' as const,
      source: 'course' as const,
      label: `Lesson ${l.order} of ${lessons.length}`,
      headline: l.title,
      body: `${l.summary} ${l.minutes} minutes.`,
    }));
}

export function liveCaptions(): Caption[] {
  return LIVE_METRICS.map((metric) => ({
    id: `live:${metric}`,
    kind: 'live' as const,
    label: LIVE_LABEL[metric],
    metric,
  }));
}

/** Round robin across lists, so no two neighbours are of the same kind for long. */
export function interleave<T>(lists: ReadonlyArray<readonly T[]>): T[] {
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const item = list[i];
      if (item !== undefined) out.push(item);
    }
  }
  return out;
}

export interface PlaylistInput {
  terms: readonly GlossaryTerm[];
  lessons: readonly LessonMeta[];
}

/** The whole tour, in order. Live numbers lead each round so they are never far apart. */
export function buildPlaylist(input: PlaylistInput): Caption[] {
  return interleave([
    liveCaptions(),
    protocolCaptions(),
    lessonCaptions(input.lessons),
    termCaptions(input.terms),
  ]);
}

// ---------------------------------------------------------------------------
// Filling in a live caption
// ---------------------------------------------------------------------------

export interface LiveData {
  network: NetworkSnapshot | null;
  /** Status of the network snapshot. */
  status: DataStatus;
  clock: ChainClock;
}

export interface LiveCaption {
  headline: string;
  body: string;
  /** For the honesty chip. `loading` shows "Syncing". */
  status: DataStatus;
}

const SYNCING: LiveCaption = { headline: NONE, body: 'Syncing with the chain.', status: 'loading' };

/** The words of one live metric. Pure: a missing number is `--`, never a zero. */
export function describeLive(metric: LiveMetric, d: LiveData): LiveCaption {
  const n = d.network;
  switch (metric) {
    case 'height': {
      const height = d.clock.height ?? n?.chain.height ?? null;
      if (height === null) return SYNCING;
      const target = n?.chain.targetBlockSec ?? d.clock.targetSec;
      const next =
        d.clock.live && d.clock.nextBlockInMs !== null ? Math.ceil(d.clock.nextBlockInMs / 1000) : null;
      const base = `A new block arrives about every ${target} seconds.`;
      return {
        headline: `Block ${formatInt(height)}`,
        body: next === null ? base : `${base} The next is due in ${next} s.`,
        status: d.status,
      };
    }
    case 'nodes': {
      if (!n) return SYNCING;
      const t = n.nodes.tiers;
      const where = n.nodes.countries !== null ? ` in ${formatInt(n.nodes.countries)} countries` : '';
      return {
        headline: `${formatInt(n.nodes.total)} nodes online`,
        body: `Cumulus ${formatInt(t.cumulus)}, Nimbus ${formatInt(t.nimbus)}, Stratus ${formatInt(t.stratus)}${where}.`,
        status: d.status,
      };
    }
    case 'price': {
      if (!n?.market) return SYNCING;
      const change = n.market.change24hPct;
      return {
        headline: `FLUX ${formatUsd(n.market.priceUsd)}`,
        body:
          change === null
            ? 'The price in US dollars.'
            : `${formatPct(change, { signed: true })} over the last 24 hours.`,
        status: d.status,
      };
    }
    case 'apps': {
      const apps = n?.apps ?? null;
      if (!apps || apps.running === null) return SYNCING;
      return {
        headline: `${formatInt(apps.running)} apps running`,
        body:
          apps.registered !== null
            ? `${formatInt(apps.registered)} are registered on the chain.`
            : 'On the network right now.',
        status: d.status,
      };
    }
    case 'capacity': {
      const c = n?.capacity ?? null;
      if (!c) return SYNCING;
      return {
        headline: `${formatCompact(c.cores)} CPU cores`,
        body: `${formatInt(c.ramTb)} TB of RAM and ${formatInt(c.ssdTb)} TB of SSD, from the nodes that passed the benchmark.`,
        status: d.status,
      };
    }
  }
}
