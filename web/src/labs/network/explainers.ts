/**
 * The "what does this mean?" notes of the Network Lab. Each note belongs to one number or part of the page
 * (`target` is the `data-explain` value on that element), is written in plain language and carries only
 * what the verified facts back (docs/research/FACTS.md; the section is named beside each claim).
 *
 * Numbers inside the prose come from the live snapshot passed in, never from memory. The strings use the
 * Academy's inline markup (`**bold**`, `code`, `{{term:id}}`).
 */
import type { Tier, TierCounts } from '@shared/api';
import { SPAWN_DEFERRAL_RANGE_MIN } from '@shared/flux/timing';
import { formatDecimal, formatInt } from '@/lib/format';

export type ExplainerId =
  | 'nodes-total'
  | 'countries'
  | 'tier-count'
  | 'tier-share'
  | 'collateral'
  | 'reward-block'
  | 'payout-interval'
  | 'block-dial'
  | 'block-trend'
  | 'bench-height';

export interface Explainer {
  id: ExplainerId;
  /** Short name, shown beside the number in the ring and as the note's heading. */
  title: string;
  /** One to three sentences of plain prose. */
  body: string;
  /** The `data-explain` attribute value of the element the note points at. */
  target: ExplainerId;
}

export interface ExplainContext {
  totalNodes: number | null;
  locatedNodes: number | null;
  countries: number | null;
  tiers: TierCounts | null;
  collateral: TierCounts | null;
  perBlock: TierCounts | null;
  devFund: number | null;
  perBlockTotal: number | null;
  nextReductionHeight: number | null;
  perBlockAfter: number | null;
  targetBlockSec: number;
  measuredBlockSec: number | null;
  /** The tier the filter is on, to make the tier notes talk about it. */
  focusTier: Tier | null;
}

const n = (v: number | null): string => (v === null ? 'the current number of' : formatInt(v));
const flux = (v: number | null, fallback: string): string =>
  v === null ? fallback : `${formatDecimal(v, Number.isInteger(v) ? 0 : 1)}`;

/** Reading order on the page: the headline numbers, the bench, the tier columns, then the blocks. */
const ORDER: readonly ExplainerId[] = [
  'nodes-total',
  'countries',
  'bench-height',
  'tier-count',
  'tier-share',
  'collateral',
  'reward-block',
  'payout-interval',
  'block-dial',
  'block-trend',
];

export function buildExplainers(c: ExplainContext): Explainer[] {
  const perBlock = c.perBlock;
  const split = perBlock
    ? `${flux(perBlock.cumulus, '1')}, ${flux(perBlock.nimbus, '3.5')} and ${flux(perBlock.stratus, '9')} FLUX`
    : '1, 3.5 and 9 FLUX';
  const total = c.perBlockTotal === null ? 'about 14' : formatDecimal(c.perBlockTotal, 0);
  const reduction =
    c.nextReductionHeight !== null && c.perBlockAfter !== null
      ? ` At block ${formatInt(c.nextReductionHeight)} the total drops by a tenth to ${formatDecimal(c.perBlockAfter, 1)} FLUX.`
      : '';
  const col = c.collateral;
  const collateralText = col
    ? `${formatInt(col.cumulus)}, ${formatInt(col.nimbus)} and ${formatInt(col.stratus)} FLUX`
    : '1,000, 12,500 and 40,000 FLUX';
  const located =
    c.locatedNodes !== null && c.totalNodes !== null && c.locatedNodes < c.totalNodes
      ? ` ${formatInt(c.locatedNodes)} of the ${formatInt(c.totalNodes)} nodes have a usable location. The rest are counted in the totals but cannot be drawn on the bench. The registration check still counts them as candidates for every location rule, because only a proven mismatch rules a node out.`
      : '';

  const notes: Explainer[] = [
    {
      id: 'nodes-total',
      target: 'nodes-total',
      title: 'Confirmed nodes',
      // fact: FACTS 1.4, 2.1, 6.2
      body: `Each of the ${n(c.totalNodes)} nodes is a separate machine that locked collateral, passed a hardware benchmark and confirmed it on the chain. Different nodes can still sit with the same hosting provider. There is no central scheduler: each node decides on its own which apps to run.`,
    },
    {
      id: 'countries',
      target: 'countries',
      title: 'Countries',
      // fact: FACTS Snapshot (countries by node IP geolocation), 3.5
      body: `A node is placed in a country by looking up its IP address. ${c.countries === null ? 'The nodes sit in many' : `They sit in ${formatInt(c.countries)}`} countries, and a deployer can allow or deny countries with a {{term:geolocation}} rule.${located}`,
    },
    {
      id: 'tier-count',
      target: 'tier-count',
      title: c.focusTier ? 'Nodes in this tier' : 'Nodes per tier',
      // fact: FACTS 2.1, 2.2, 2.4
      body: `There are three sizes: {{term:cumulus}}, {{term:nimbus}} and {{term:stratus}}. A bigger tier is a bigger machine (about 4, 8 and 16 threads). Tier is a soft preference: bigger nodes wait ${SPAWN_DEFERRAL_RANGE_MIN.min} to ${SPAWN_DEFERRAL_RANGE_MIN.max} minutes before they take a small app, so small apps usually land on Cumulus first.`,
    },
    {
      id: 'tier-share',
      target: 'tier-share',
      title: 'Share of the network',
      // fact: FACTS 2.1 (one node per tier is paid per block, whatever the tier's size)
      body: 'The share of all nodes that sit in this tier. It is not a share of the rewards: each tier has a fixed payout per block, one node of the tier, however many nodes it has, so a crowded tier pays each of its nodes less often.',
    },
    {
      id: 'collateral',
      target: 'collateral',
      title: 'Collateral',
      // fact: FACTS 2.1
      body: `The FLUX an operator must keep locked to run a node: ${collateralText}. The collateral amount sets the tier, and the node must also pass the hardware benchmark for that tier.`,
    },
    {
      id: 'reward-block',
      target: 'reward-block',
      title: 'Paid per block',
      // fact: FACTS 1.4, 2.1
      body: `Every block pays one node of each tier, ${split}, and ${c.devFund === null ? '0.5' : formatDecimal(c.devFund, 1)} FLUX to the development fund: ${total} FLUX in all. Nodes of a tier take turns in a queue.${reduction}`,
    },
    {
      id: 'payout-interval',
      target: 'payout-interval',
      title: 'Wait between payouts',
      // fact: FACTS 2.8 (derived, not published)
      body: 'Because only one node per tier is paid in each block, a tier with more nodes pays each of them less often. This figure is derived: the nodes in the tier divided by the blocks in a day.',
    },
    {
      id: 'block-dial',
      target: 'block-dial',
      title: 'Block cadence',
      // fact: FACTS 1.4
      body: `A new {{term:block}} about every ${c.targetBlockSec} seconds since Proof of Node began. There is no mining: in each slot every confirmed node of any tier checks whether it is eligible, eligible nodes are ranked, and the chain accepts the first valid block.${c.measuredBlockSec === null ? '' : ` Recent blocks averaged ${formatDecimal(c.measuredBlockSec, 1)} s.`}`,
    },
    {
      id: 'block-trend',
      target: 'block-trend',
      title: 'Block gaps',
      // fact: FACTS 1.4 (difficulty retargets every block over a 30-block window)
      body: 'Each point is the time between one block and the one before it. A few seconds either way is normal. The network re-sets the difficulty of qualifying for a slot at every block, from the last 30 blocks, which keeps the line near the dashed target.',
    },
    {
      id: 'bench-height',
      target: 'bench-height',
      title: 'Reading the bench',
      // fact: web/src/diorama/model/bench.ts `liveHeight` (log2, capped at 11, reached at 127 nodes)
      body: 'Each pillar stands for a cluster of nodes near one place, and its colour is the most common tier in the cluster. Height follows the logarithm of the count and stops growing at about 130 nodes, so the biggest clusters all look equally tall. The country list has the exact numbers. The bench shows where nodes are, not how busy they are.',
    },
  ];
  return [...notes].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

/** Notes keyed by id, for a lookup from a ring or a trigger. */
export function explainerMap(list: readonly Explainer[]): Map<ExplainerId, Explainer> {
  return new Map(list.map((e) => [e.id, e]));
}
