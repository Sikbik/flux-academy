/**
 * Ranking and grouping for the command deck. Pure: items and a query in, groups of rows out.
 *
 * - Empty query: Recent first, then every group in its fixed order, items in catalog order.
 * - A query: items are scored by `scoreFields`, grouped by kind, and groups are ordered by their best
 *   hit, so "sound" leads with Actions and "atlas" leads with Apps.
 * - `deep` hits (the lazily loaded Reference and troubleshooting answers) arrive with their scores
 *   already on the deck's scale. They join the group of their kind, at most `DEEP.perGroup` of them, so
 *   a group stays scannable; an exact id carries a score that puts it first.
 */

import { DEEP, type DeepHit } from './deep';
import { highlightRanges, type Range, scoreFields, tokenize } from './fuzzy';
import { type DeckGroupId, type DeckItem, GROUP_LABEL, GROUP_ORDER } from './items';

export interface DeckRow {
  item: DeckItem;
  score: number;
  titleRanges: Range[];
  subRanges: Range[];
  /** Position in the flat, keyboard-navigable list. */
  index: number;
  /** The group this row is shown in (a Recent row keeps its own kind in `item.kind`). */
  group: DeckGroupId;
}

export interface DeckGroup {
  id: DeckGroupId;
  label: string;
  rows: DeckRow[];
}

export interface Ranked {
  groups: DeckGroup[];
  /** Every row in display order. */
  rows: DeckRow[];
  /** How many items matched before any cap. */
  total: number;
  tokens: string[];
}

export interface RankOptions {
  /** Item ids, most recent first. */
  recents?: readonly string[];
  /** Rows kept per group when searching. Default 8. */
  perGroup?: number;
  /** Rows kept in total when searching. Default 40 (24 for a single letter). */
  maxRows?: number;
  /** Hits of the on-demand Reference and troubleshooting search, with their scores. */
  deep?: readonly DeepHit[];
}

const NO_RANGES: Range[] = [];

/** Typing a whole title ("x community") must beat an item that only matches word by word ("x"). */
const PHRASE_EXACT = 500;
const PHRASE_PREFIX = 180;

/**
 * A glossary term is an answer shown in place, not a destination. Unless the query is exactly the
 * term, it ranks below pages that match as well, so "spec" leads with the Spec Forge, not the term
 * that merely lists "spec" as another name.
 */
const TERM_FACTOR = 0.7;

/** Score bonus for something the visitor used recently, newest first. */
function recentBoost(recents: readonly string[], id: string): number {
  const at = recents.indexOf(id);
  return at < 0 ? 0 : 60 - at * 8;
}

export function rank(items: readonly DeckItem[], query: string, opts: RankOptions = {}): Ranked {
  const recents = opts.recents ?? [];
  const tokens = tokenize(query);

  if (tokens.length === 0) return emptyQuery(items, recents);

  const perGroup = opts.perGroup ?? 8;
  // One letter matches half the catalog and says little: show fewer rows, which also keeps the
  // first keystroke cheap.
  const oneLetter = tokens.length === 1 && (tokens[0]?.length ?? 0) === 1;
  const maxRows = opts.maxRows ?? (oneLetter ? 24 : 40);
  const phrase = tokens.length > 1 ? tokens.join(' ') : '';

  interface Hit {
    item: DeckItem;
    score: number;
    order: number;
  }
  const byGroup = new Map<DeckGroupId, Hit[]>();
  let total = 0;
  items.forEach((item, order) => {
    const base = scoreFields(tokens, item.fields);
    if (base < 0) return;
    total++;
    let score = base + recentBoost(recents, item.id);
    const title = item.titleP.lower;
    if (phrase) {
      if (title === phrase) score += PHRASE_EXACT;
      else if (title.startsWith(phrase)) score += PHRASE_PREFIX;
    }
    if (item.kind === 'term' && title !== tokens.join(' ')) score *= TERM_FACTOR;
    const hit: Hit = { item, score, order };
    const list = byGroup.get(item.kind);
    if (list) list.push(hit);
    else byGroup.set(item.kind, [hit]);
  });

  if (opts.deep && opts.deep.length > 0) {
    // Best first, then at most `perGroup` of each kind. The catalog's own order is the tie-break, so a
    // deep hit never displaces a catalog item that scores the same.
    const taken = new Map<DeckGroupId, number>();
    const sorted = opts.deep
      .map((hit, i) => ({ hit, i }))
      .sort((a, b) => b.hit.score - a.hit.score || a.i - b.i);
    for (const { hit, i } of sorted) {
      const kind = hit.item.kind;
      const n = taken.get(kind) ?? 0;
      if (n >= DEEP.perGroup) continue;
      taken.set(kind, n + 1);
      total++;
      const entry: Hit = { item: hit.item, score: hit.score, order: items.length + i };
      const list = byGroup.get(kind);
      if (list) list.push(entry);
      else byGroup.set(kind, [entry]);
    }
  }

  const ordered = [...byGroup.entries()].map(([id, hits]) => {
    hits.sort((a, b) => b.score - a.score || a.order - b.order);
    return { id, hits: hits.slice(0, perGroup), best: hits[0]?.score ?? 0 };
  });
  ordered.sort((a, b) => b.best - a.best || GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id));

  const groups: DeckGroup[] = [];
  const rows: DeckRow[] = [];
  for (const g of ordered) {
    const gr: DeckGroup = { id: g.id, label: GROUP_LABEL[g.id], rows: [] };
    for (const hit of g.hits) {
      if (rows.length >= maxRows) break;
      const row: DeckRow = {
        item: hit.item,
        score: hit.score,
        titleRanges: highlightRanges(tokens, hit.item.titleP),
        subRanges: highlightRanges(tokens, hit.item.subtitleP, false),
        index: rows.length,
        group: g.id,
      };
      rows.push(row);
      gr.rows.push(row);
    }
    if (gr.rows.length) groups.push(gr);
  }
  return { groups, rows, total, tokens };
}

function emptyQuery(items: readonly DeckItem[], recents: readonly string[]): Ranked {
  const rows: DeckRow[] = [];
  const groups: DeckGroup[] = [];
  const byId = new Map(items.map((i) => [i.id, i] as const));

  const push = (group: DeckGroup, item: DeckItem) => {
    const row: DeckRow = {
      item,
      score: 0,
      titleRanges: NO_RANGES,
      subRanges: NO_RANGES,
      index: rows.length,
      group: group.id,
    };
    rows.push(row);
    group.rows.push(row);
  };

  const shownRecent = new Set<string>();
  const recent: DeckGroup = { id: 'recent', label: GROUP_LABEL.recent, rows: [] };
  for (const id of recents) {
    const item = byId.get(id);
    if (!item || item.transient || shownRecent.has(id)) continue;
    shownRecent.add(id);
    push(recent, item);
  }
  if (recent.rows.length) groups.push(recent);

  for (const id of GROUP_ORDER) {
    // Recent was handled above; the glossary is for searching, not for scrolling past on open.
    if (id === 'recent' || id === 'term') continue;
    const group: DeckGroup = { id, label: GROUP_LABEL[id], rows: [] };
    for (const item of items) {
      if (item.kind === id && !shownRecent.has(item.id)) push(group, item);
    }
    if (group.rows.length) groups.push(group);
  }
  return { groups, rows, total: items.length, tokens: [] };
}
