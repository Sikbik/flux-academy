/**
 * The deck's one-line terminal: `> block`, `> nodes`, `> price`, `> tiers`, `> quote 2 4000 20 3` and
 * `> help`.
 *
 * Pure. `parseAsk` turns what was typed into a command; `buildAnswer` turns a command and a plain
 * snapshot of the live data into rows of text. Nothing here reads a store or a clock, so the answers are
 * exactly as honest as the numbers handed in: a missing number is `--`, never a zero, and anything that
 * is not live says so.
 */

import type { Meta, NetworkSnapshot, PricingSnapshot, Tier } from '@shared/api';
import { TIER_FACTS, TIER_ORDER, tiersThatFit } from '@shared/flux/tiers';
import type { Quote } from '@shared/flux/types';
import { describeStatus } from '@/data/chips';
import type { ChainClock, ConnectionState, DataStatus } from '@/data/types';
import { formatDecimal, formatFlux, formatInt, formatPct, formatUsd, NONE, plural } from '@/lib/format';

/** Dollars and cents, for line items (formatUsd shows four decimals under one dollar). */
function usd2(n: number): string {
  return `$${formatDecimal(n, 2)}`;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export type AskId = 'block' | 'nodes' | 'price' | 'tiers' | 'quote' | 'help';

export interface AskSpec {
  id: AskId;
  /** What to type. */
  usage: string;
  summary: string;
  aliases: readonly string[];
}

export const ASK_COMMANDS: readonly AskSpec[] = [
  {
    id: 'block',
    usage: 'block',
    summary: 'The chain tip and the next block',
    aliases: ['height', 'tip', 'blocks'],
  },
  { id: 'nodes', usage: 'nodes', summary: 'Nodes online, by tier', aliases: ['node', 'count'] },
  {
    id: 'price',
    usage: 'price',
    summary: 'FLUX price and the 24 hour change',
    aliases: ['flux', 'usd', 'market'],
  },
  {
    id: 'tiers',
    usage: 'tiers',
    summary: 'What each tier locks, earns and needs',
    aliases: ['tier', 'collateral', 'rewards'],
  },
  {
    id: 'quote',
    usage: 'quote <cpu> <ramMB> <hddGB> <instances>',
    summary: 'A quick monthly price, for example quote 2 4000 20 3',
    aliases: ['cost', 'estimate', 'price-of'],
  },
  { id: 'help', usage: 'help', summary: 'List these commands', aliases: ['commands', '?'] },
];

export type Parsed =
  | { type: 'empty' }
  | { type: 'command'; id: AskId; arg: string }
  | { type: 'ambiguous'; word: string; candidates: AskId[] }
  | { type: 'unknown'; word: string };

/** Strips a leading `>` and surrounding space. */
export function stripPrompt(input: string): string {
  return input.replace(/^\s*>?\s*/, '').trim();
}

export function parseAsk(input: string): Parsed {
  const text = stripPrompt(input);
  if (!text) return { type: 'empty' };
  const [first = '', ...rest] = text.split(/\s+/);
  const word = first.toLowerCase();
  const arg = rest.join(' ').trim();

  const exact = ASK_COMMANDS.find((c) => c.id === word || c.aliases.includes(word));
  if (exact) return { type: 'command', id: exact.id, arg };

  // A unique prefix of a command name runs it, like shell completion.
  const matches = ASK_COMMANDS.filter(
    (c) => c.id.startsWith(word) || c.aliases.some((a) => a.startsWith(word)),
  );
  if (matches.length === 1 && matches[0]) return { type: 'command', id: matches[0].id, arg };
  if (matches.length > 1) return { type: 'ambiguous', word, candidates: matches.map((c) => c.id) };
  return { type: 'unknown', word: first };
}

// ---------------------------------------------------------------------------
// Quote arguments
// ---------------------------------------------------------------------------

export interface QuoteArgs {
  cpu: number;
  ramMb: number;
  hddGb: number;
  instances: number;
}

export type QuoteParse = { ok: true; args: QuoteArgs } | { ok: false; message: string };

const QUOTE_USAGE = 'quote <cpu cores> <RAM in MB> <disk in GB> <instances>, for example quote 2 4000 20 3';

/** Reads `2 4000 20 3`. Strict: four positive numbers, instances a whole number from 1 to 100. */
export function parseQuoteArgs(arg: string): QuoteParse {
  const parts = arg.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return { ok: false, message: `Type: ${QUOTE_USAGE}.` };
  if (parts.length !== 4) {
    return { ok: false, message: `A quote needs four numbers: ${QUOTE_USAGE}.` };
  }
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n) || n <= 0)) {
    return { ok: false, message: 'Every value must be a number above zero.' };
  }
  const [cpu, ramMb, hddGb, instances] = nums as [number, number, number, number];
  if (!Number.isInteger(instances) || instances < 1 || instances > 100) {
    return { ok: false, message: 'Instances must be a whole number from 1 to 100.' };
  }
  if (cpu > 64 || ramMb > 1_000_000 || hddGb > 10_000) {
    return {
      ok: false,
      message: 'That is larger than any app on Flux. Try cpu up to 15, RAM up to 59000 MB.',
    };
  }
  return { ok: true, args: { cpu, ramMb, hddGb, instances } };
}

// ---------------------------------------------------------------------------
// Data in, answers out
// ---------------------------------------------------------------------------

/** A plain snapshot of everything the terminal can say. Assembled from the data hooks. */
export interface AskData {
  network: NetworkSnapshot | null;
  networkStatus: DataStatus;
  networkMeta: Meta | null;
  networkAgeMs: number | null;
  pricing: PricingSnapshot | null;
  pricingStatus: DataStatus;
  pricingMeta: Meta | null;
  pricingAgeMs: number | null;
  clock: ChainClock;
  connection: ConnectionState;
}

export type RowTone = 'ok' | 'warn' | 'crit' | 'cumulus' | 'nimbus' | 'stratus';

export interface AnswerRow {
  label: string;
  value: string;
  note?: string;
  tone?: RowTone;
  /** The value is missing: shown dim, as `--`. */
  missing?: boolean;
}

export interface Answer {
  command: AskId | 'empty' | 'unknown' | 'ambiguous';
  title: string;
  rows: AnswerRow[];
  /** The status of the numbers, for the chip. Null for answers that need no data. */
  status: DataStatus | null;
  /** Which resource the chip describes, so the view can pick its age. */
  source: 'network' | 'pricing' | null;
  /** The honesty line: last known numbers, cached, syncing. Null when the numbers are live. */
  note: string | null;
  /** One sentence for screen readers. */
  summary: string;
  /** What Enter copies. */
  plain: string;
}

function honestyNote(status: DataStatus, d: AskData, which: 'network' | 'pricing'): string | null {
  if (status === 'live') return null;
  const meta = which === 'network' ? d.networkMeta : d.pricingMeta;
  const age = which === 'network' ? d.networkAgeMs : d.pricingAgeMs;
  const chip = describeStatus(status, { meta, ageMs: age, connection: d.connection });
  return chip.sentence;
}

function finish(
  command: Answer['command'],
  title: string,
  rows: AnswerRow[],
  d: AskData | null,
  source: Answer['source'],
  status: DataStatus | null,
  noteOverride?: string | null,
): Answer {
  const note =
    noteOverride !== undefined ? noteOverride : status && d && source ? honestyNote(status, d, source) : null;
  const lead = rows
    .slice(0, 4)
    .filter((r) => !r.missing)
    .map((r) => `${r.label} ${r.value}`)
    .join('. ');
  const state =
    status === 'live'
      ? 'Live data.'
      : status === 'loading'
        ? 'Syncing.'
        : status
          ? 'Last known numbers.'
          : '';
  const summary = [title, lead, state].filter(Boolean).join('. ').replace(/\.\./g, '.');
  const plain = [title, ...rows.map((r) => `${r.label}: ${r.value}${r.note ? ` (${r.note})` : ''}`)]
    .concat(note ? [note] : [])
    .join('\n');
  return { command, title, rows, status, source, note, summary, plain };
}

function trimFlux(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

const TIER_LABEL: Record<Tier, string> = { cumulus: 'Cumulus', nimbus: 'Nimbus', stratus: 'Stratus' };

function answerBlock(d: AskData): Answer {
  const chain = d.network?.chain ?? null;
  const clock = d.clock;
  const height = clock.height ?? chain?.height ?? null;
  const live = clock.live;
  const next = live && clock.nextBlockInMs !== null ? Math.ceil(clock.nextBlockInMs / 1000) : null;
  const since =
    live && clock.lastBlockAt !== null
      ? Math.max(0, Math.floor((Date.now() - clock.lastBlockAt) / 1000))
      : null;
  const measured = chain?.measuredBlockSec ?? null;
  const target = chain?.targetBlockSec ?? clock.targetSec;

  const rows: AnswerRow[] = [
    { label: 'Next block', value: next === null ? NONE : `in ${next} s`, missing: next === null },
    { label: 'Last block', value: since === null ? NONE : `${since} s ago`, missing: since === null },
    {
      label: 'Interval',
      value: measured !== null ? `${measured.toFixed(1)} s measured` : target ? `${target} s target` : NONE,
      note: measured !== null && target ? `${target} s target` : undefined,
      missing: measured === null && !target,
    },
  ];
  if (chain?.consensus) rows.push({ label: 'Consensus', value: chain.consensus });
  const status: DataStatus = d.network || height !== null ? d.networkStatus : 'loading';
  return finish(
    'block',
    height === null ? 'No block height yet' : `Block ${formatInt(height)}`,
    rows,
    d,
    'network',
    status,
  );
}

function answerNodes(d: AskData): Answer {
  const n = d.network?.nodes ?? null;
  const rewards = d.network?.rewards ?? null;
  if (!n) return finish('nodes', 'No node count yet', [], d, 'network', d.networkStatus);
  const total = Math.max(1, n.total);
  const rows: AnswerRow[] = TIER_ORDER.map((id) => {
    const count = n.tiers[id];
    const per = rewards?.perTier[id];
    const parts = [
      formatPct((count / total) * 100, { digits: 1 }),
      `${formatInt(n.collateral[id])} FLUX locked`,
    ];
    if (per !== undefined) parts.push(`${trimFlux(per)} FLUX per block`);
    return { label: TIER_LABEL[id], value: formatInt(count), note: parts.join(' · '), tone: id };
  });
  if (n.countries !== null) rows.push({ label: 'Countries', value: formatInt(n.countries) });
  return finish('nodes', `${formatInt(n.total)} nodes`, rows, d, 'network', d.networkStatus);
}

function answerPrice(d: AskData): Answer {
  const m = d.network?.market ?? null;
  if (!m) {
    const usd = d.pricing?.fluxUsd ?? null;
    if (usd === null) return finish('price', 'No price yet', [], d, 'pricing', d.pricingStatus);
    return finish('price', `FLUX ${formatUsd(usd)}`, [], d, 'pricing', d.pricingStatus);
  }
  const rows: AnswerRow[] = [
    {
      label: '24 hours',
      value: m.change24hPct === null ? NONE : formatPct(m.change24hPct, { signed: true }),
      missing: m.change24hPct === null,
    },
    {
      label: 'Market cap',
      value: m.marketCapUsd === null ? NONE : `$${formatInt(m.marketCapUsd)}`,
      missing: m.marketCapUsd === null,
    },
  ];
  return finish('price', `FLUX ${formatUsd(m.priceUsd)}`, rows, d, 'network', d.networkStatus);
}

function answerTiers(d: AskData): Answer {
  const live = d.network?.nodes ?? null;
  const rewards = d.network?.rewards ?? null;
  const rows: AnswerRow[] = TIER_ORDER.map((id) => {
    const facts = TIER_FACTS[id];
    const collateral = live?.collateral[id] ?? facts.collateralFlux;
    const payout = rewards?.perTier[id] ?? facts.payoutPerBlockFlux;
    const hw = facts.minHardware;
    const parts = [
      `${trimFlux(payout)} FLUX per block`,
      `${hw.cores} cores, ${hw.ramGb} GB RAM, ${formatInt(hw.ssdGb)} GB SSD at least`,
    ];
    if (live) parts.unshift(`${formatInt(live.tiers[id])} online`);
    return {
      label: TIER_LABEL[id],
      value: `${formatInt(collateral)} FLUX locked`,
      note: parts.join(' · '),
      tone: id,
    };
  });
  rows.push({
    label: 'Each block',
    value: 'One node of each tier is paid',
    note: 'Each tier keeps a queue: the node at the front is paid, then goes to the back',
  });
  return finish(
    'tiers',
    'The three node tiers',
    rows,
    d,
    d.network ? 'network' : null,
    d.network ? d.networkStatus : null,
  );
}

function answerQuote(d: AskData, args: QuoteArgs, quote: Quote | null, pending: boolean): Answer {
  const title = `${formatDecimal(args.cpu, args.cpu % 1 === 0 ? 0 : 1)} ${args.cpu === 1 ? 'core' : 'cores'}, ${formatInt(args.ramMb)} MB, ${formatInt(args.hddGb)} GB, ${plural(args.instances, 'instance')}`;
  if (!quote) {
    return finish(
      'quote',
      title,
      [{ label: 'Monthly price', value: pending ? 'working it out' : NONE, missing: true }],
      d,
      'pricing',
      pending ? 'loading' : d.pricingStatus,
      pending ? null : 'The pricing rates have not loaded yet, so no price can be worked out.',
    );
  }
  const fits = tiersThatFit({ cpu: args.cpu, ram: args.ramMb, hdd: args.hddGb });
  const basis =
    quote.paramsSource === 'live'
      ? 'Computed at the official rates'
      : quote.paramsSource === 'cache'
        ? 'Computed at the official rates (cached)'
        : 'Computed at the built-in rates';
  const rows: AnswerRow[] = [
    {
      label: 'Monthly price',
      value: usd2(quote.usdPerMonth),
      note: quote.fluxPerMonth !== null ? `about ${formatFlux(quote.fluxPerMonth, 1)}` : undefined,
    },
    { label: 'Basis', value: basis, note: quote.minimumApplied ? 'the minimum price applies' : undefined },
    {
      label: 'Fits on',
      value: fits.length > 0 ? fits.map((id) => TIER_LABEL[id]).join(', ') : 'No single node',
      note: fits.length > 0 ? 'per instance' : 'one instance is bigger than any node offers',
      missing: fits.length === 0,
    },
  ];
  for (const line of quote.lines.slice(0, 5)) {
    if (line.id === 'cpu' || line.id === 'ram' || line.id === 'hdd' || line.id === 'instances') {
      rows.push({ label: line.label, value: usd2(line.usd), note: line.note });
    }
  }
  return finish('quote', title, rows, d, 'pricing', d.pricingStatus);
}

function answerHelp(): Answer {
  const rows: AnswerRow[] = ASK_COMMANDS.map((c) => ({ label: c.usage, value: c.summary }));
  return finish('help', 'Ask the network', rows, null, null, null, null);
}

export interface BuildContext {
  data: AskData;
  /** The quote for a `quote` command (the view computes it asynchronously), or null. */
  quote?: Quote | null;
  /** True while that quote is being worked out. */
  quotePending?: boolean;
}

/** Turns a parsed command and the live data into an answer. */
export function buildAnswer(parsed: Parsed, ctx: BuildContext): Answer {
  const d = ctx.data;
  switch (parsed.type) {
    case 'empty':
      return answerHelp();
    case 'unknown': {
      const help = answerHelp();
      return {
        ...help,
        command: 'unknown',
        title: `No command called "${parsed.word}"`,
        summary: `No command called ${parsed.word}. ${help.summary}`,
      };
    }
    case 'ambiguous': {
      const rows: AnswerRow[] = parsed.candidates.map((id) => {
        const c = ASK_COMMANDS.find((x) => x.id === id);
        return { label: c?.usage ?? id, value: c?.summary ?? '' };
      });
      return finish('ambiguous', `"${parsed.word}" could be several things`, rows, null, null, null, null);
    }
    case 'command':
      switch (parsed.id) {
        case 'block':
          return answerBlock(d);
        case 'nodes':
          return answerNodes(d);
        case 'price':
          return answerPrice(d);
        case 'tiers':
          return answerTiers(d);
        case 'help':
          return answerHelp();
        case 'quote': {
          const args = parseQuoteArgs(parsed.arg);
          if (!args.ok) {
            return finish(
              'quote',
              'A quick quote',
              [{ label: 'Usage', value: QUOTE_USAGE }],
              null,
              null,
              null,
              args.message,
            );
          }
          return answerQuote(d, args.args, ctx.quote ?? null, ctx.quotePending === true);
        }
      }
  }
}

/** The spec the deck prices for `quote`: one nginx component at the asked size. */
export function quoteSpecFor(
  args: QuoteArgs,
  base: { defaultSpec: () => unknown; defaultComponent: (o: object) => unknown },
): unknown {
  const spec = base.defaultSpec() as Record<string, unknown>;
  return {
    ...spec,
    instances: args.instances,
    compose: [base.defaultComponent({ cpu: args.cpu, ram: args.ramMb, hdd: args.hddGb })],
  };
}
