/**
 * Search over reference entries. Pure, with no dependency on the page: the Reference's own search field
 * uses it, and so can anything that holds `REFERENCE_INDEX` (the command deck ranks with its own fuzzy
 * matcher and only needs the entries).
 *
 * Every query token must hit somewhere; the score says where. Exact titles and codes come first, then
 * prefixes of a title word, then keywords, then the summary, then the body text.
 */

import type { ReferenceEntry, ReferenceKind, TopicId } from './types';

export interface SearchOptions {
  limit?: number;
  topic?: TopicId;
  kinds?: readonly ReferenceKind[];
}

export interface SearchHit {
  entry: ReferenceEntry;
  score: number;
}

/** Lower case, punctuation to single spaces, accents and underscores folded. */
export function normalise(input: string): string {
  return input
    .toLowerCase()
    .replace(/[_./:-]+/g, ' ')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The tokens of a query, normalised, deduplicated and capped. */
export function tokensOf(query: string): string[] {
  return [...new Set(normalise(query).split(' ').filter(Boolean))].slice(0, 8);
}

/** Kinds in the order they win a tie. */
const KIND_RANK: Readonly<Record<ReferenceKind, number>> = {
  field: 0,
  lint: 1,
  endpoint: 2,
  tool: 3,
  section: 4,
  fact: 5,
  page: 6,
};

interface Prepared {
  entry: ReferenceEntry;
  title: string;
  titleWords: string[];
  keywords: string[];
  summary: string;
  group: string;
  text: string;
}

const CACHE = new WeakMap<readonly ReferenceEntry[], Prepared[]>();

function prepare(entries: readonly ReferenceEntry[]): Prepared[] {
  const hit = CACHE.get(entries);
  if (hit) return hit;
  const out = entries.map((entry) => {
    const title = normalise(entry.title);
    return {
      entry,
      title,
      titleWords: title.split(' '),
      keywords: entry.keywords.map(normalise),
      summary: normalise(entry.summary),
      group: normalise(entry.group),
      text: normalise(entry.text),
    };
  });
  CACHE.set(entries, out);
  return out;
}

function scoreOne(p: Prepared, q: string, tokens: readonly string[]): number {
  if (p.title === q) return 1000;
  if (p.keywords.includes(q)) return 900;
  if (p.title.startsWith(q)) return 800;
  if (p.titleWords.some((w) => w.startsWith(q))) return 650;
  if (p.title.includes(q)) return 500;
  if (p.keywords.some((k) => k.startsWith(q))) return 450;
  let sum = 0;
  for (const t of tokens) {
    if (p.titleWords.includes(t)) sum += 140;
    else if (p.titleWords.some((w) => w.startsWith(t))) sum += 110;
    else if (p.title.includes(t)) sum += 90;
    else if (p.keywords.some((k) => k === t || k.split(' ').includes(t))) sum += 100;
    else if (p.keywords.some((k) => k.includes(t))) sum += 70;
    else if (p.group.includes(t)) sum += 30;
    else if (p.summary.includes(t)) sum += 40;
    else if (p.text.includes(t)) sum += 15;
    else return 0;
  }
  return sum;
}

/** Ranked matches for a query. An empty query returns nothing. */
export function searchReference(
  entries: readonly ReferenceEntry[],
  query: string,
  opts: SearchOptions = {},
): SearchHit[] {
  const q = normalise(query);
  if (q === '') return [];
  const tokens = tokensOf(query);
  const limit = opts.limit ?? 20;
  const hits: SearchHit[] = [];
  for (const p of prepare(entries)) {
    if (opts.topic && p.entry.topic !== opts.topic) continue;
    if (opts.kinds && !opts.kinds.includes(p.entry.kind)) continue;
    const score = scoreOne(p, q, tokens);
    if (score > 0) hits.push({ entry: p.entry, score });
  }
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      KIND_RANK[a.entry.kind] - KIND_RANK[b.entry.kind] ||
      a.entry.title.localeCompare(b.entry.title, 'en'),
  );
  return hits.slice(0, limit);
}

export interface Segment {
  text: string;
  match: boolean;
}

/** Splits `text` into runs, marking the parts that match a query token, for highlighting. */
export function highlight(text: string, query: string): Segment[] {
  const tokens = tokensOf(query)
    .filter((t) => t.length > 0)
    .sort((a, b) => b.length - a.length);
  if (tokens.length === 0 || text === '') return [{ text, match: false }];
  const lower = text.toLowerCase();
  const marks: boolean[] = new Array(text.length).fill(false);
  for (const t of tokens) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(t, from);
      if (i < 0) break;
      for (let k = i; k < i + t.length; k++) marks[k] = true;
      from = i + t.length;
    }
  }
  const out: Segment[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marks[i] !== marks[start]) {
      out.push({ text: text.slice(start, i), match: marks[start] === true });
      start = i;
    }
  }
  return out;
}
