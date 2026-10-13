/**
 * The glossary page's logic, kept free of React so it can be tested: filtering, ranking, grouping by
 * letter, the track a term belongs to, and the "nearest terms" shown when a search finds nothing.
 *
 * The scoring itself lives in `@/learn/glossary` (`searchGlossary`), shared with the command deck and the
 * lesson cards, so a term ranks the same everywhere.
 */

import { lessonById, type TrackId } from '@shared/curriculum';
import { searchGlossary } from '@/learn/glossary';
import type { GlossaryCategory, GlossaryTerm } from '@/learn/types';

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export interface CategoryInfo {
  id: GlossaryCategory;
  /** Chip label. */
  label: string;
  /** One line for the filter's tooltip and the entry's meta. */
  blurb: string;
}

/** The kinds of term, in the order the filter shows them. */
export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'network', label: 'Network', blurb: 'Nodes, tiers, the chain and how they fit' },
  { id: 'app', label: 'Apps', blurb: 'The spec, components and what you configure' },
  { id: 'docker', label: 'Docker', blurb: 'Images, registries and containers' },
  { id: 'money', label: 'Money', blurb: 'Price, fees, FLUX and renewal' },
  { id: 'ops', label: 'Operations', blurb: 'Running, updating and recovering an app' },
];

export function categoryLabel(id: GlossaryCategory): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const TRACK_ORDER: readonly TrackId[] = ['cumulus', 'nimbus', 'stratus'];

export type TrackFilter = TrackId | 'all';
export type CategoryFilter = GlossaryCategory | 'all';

export interface GlossaryFilters {
  query: string;
  track: TrackFilter;
  category: CategoryFilter;
}

export const NO_FILTERS: GlossaryFilters = { query: '', track: 'all', category: 'all' };

export function isFiltered(f: GlossaryFilters): boolean {
  return f.query.trim() !== '' || f.track !== 'all' || f.category !== 'all';
}

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

/** The tracks whose lessons a term is tied to, in track order. Empty when it names no lesson. */
export function termTracks(term: GlossaryTerm): TrackId[] {
  const found = new Set<TrackId>();
  for (const id of term.lessons ?? []) {
    const lesson = lessonById(id);
    if (lesson) found.add(lesson.track);
  }
  return TRACK_ORDER.filter((t) => found.has(t));
}

/** The letter a term files under: A to Z, or `#` for anything else (a digit, a symbol). */
export function termLetter(term: GlossaryTerm): string {
  const first = term.term.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '#';
}

export interface LetterGroup {
  letter: string;
  terms: GlossaryTerm[];
}

/** Terms are already sorted by display text; group runs of the same letter. */
export function groupByLetter(terms: readonly GlossaryTerm[]): LetterGroup[] {
  const groups: LetterGroup[] = [];
  for (const term of terms) {
    const letter = termLetter(term);
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.terms.push(term);
    else groups.push({ letter, terms: [term] });
  }
  return groups;
}

export const ALPHABET: readonly string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ---------------------------------------------------------------------------
// Filtering and search
// ---------------------------------------------------------------------------

export function matchesFacets(term: GlossaryTerm, f: Pick<GlossaryFilters, 'track' | 'category'>): boolean {
  if (f.category !== 'all' && term.category !== f.category) return false;
  if (f.track !== 'all' && !termTracks(term).includes(f.track)) return false;
  return true;
}

export interface Filtered {
  /** What to list, in display order: alphabetical, or ranked when there is a query. */
  terms: GlossaryTerm[];
  /** True when `terms` is ranked by relevance rather than alphabetical. */
  ranked: boolean;
}

/** Apply the track and kind filters first, then the search over what is left. */
export function filterTerms(all: readonly GlossaryTerm[], f: GlossaryFilters): Filtered {
  const pool = all.filter((t) => matchesFacets(t, f));
  const q = f.query.trim();
  if (q === '') return { terms: pool, ranked: false };
  return { terms: searchGlossary(pool, q, pool.length), ranked: true };
}

/** How many terms each facet value would show right now (the other facet applied, the query too). */
export function facetCounts(
  all: readonly GlossaryTerm[],
  f: GlossaryFilters,
): { track: Record<TrackFilter, number>; category: Record<CategoryFilter, number> } {
  const base = f.query.trim() === '' ? all : searchGlossary(all, f.query, all.length);
  const track: Record<TrackFilter, number> = { all: 0, cumulus: 0, nimbus: 0, stratus: 0 };
  const category: Record<CategoryFilter, number> = {
    all: 0,
    network: 0,
    app: 0,
    docker: 0,
    money: 0,
    ops: 0,
  };
  for (const t of base) {
    const tracks = termTracks(t);
    if (f.category === 'all' || t.category === f.category) {
      track.all += 1;
      for (const tr of tracks) track[tr] += 1;
    }
    if (f.track === 'all' || tracks.includes(f.track)) {
      category.all += 1;
      category[t.category] += 1;
    }
  }
  return { track, category };
}

/** The count in two parts, so a narrow screen can show the figure and leave the noun to a screen reader. */
export function countParts(shown: number, total: number): { figure: string; noun: string } {
  return {
    figure: shown === total ? String(total) : `${shown} of ${total}`,
    noun: total === 1 ? 'term' : 'terms',
  };
}

/** "90 terms", "1 term" or "12 of 90 terms". Always the real number. */
export function countLabel(shown: number, total: number): string {
  const { figure, noun } = countParts(shown, total);
  return `${figure} ${noun}`;
}

// ---------------------------------------------------------------------------
// Nearest terms (when a search finds nothing)
// ---------------------------------------------------------------------------

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** Levenshtein distance, capped so a long mismatch stays cheap. */
export function editDistance(a: string, b: string, cap = 4): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length] ?? cap + 1;
}

/**
 * The terms closest to a query that matched nothing: a typo (`fluxnod`), a plural, a related word. Looks
 * at the words of each name and alias, then at a shared prefix. Returns at most `limit`, best first.
 */
export function nearestTerms(all: readonly GlossaryTerm[], query: string, limit = 4): GlossaryTerm[] {
  const qWords = words(query).filter((w) => w.length >= 2);
  if (qWords.length === 0) return [];
  const scored: Array<{ term: GlossaryTerm; score: number }> = [];
  for (const term of all) {
    const names = [term.term, term.id.replace(/-/g, ' '), ...(term.aka ?? [])].flatMap(words);
    let best = Number.POSITIVE_INFINITY;
    for (const q of qWords) {
      const allowed = q.length <= 4 ? 1 : q.length <= 7 ? 2 : 3;
      for (const n of names) {
        const d = editDistance(q, n, allowed);
        if (d <= allowed) best = Math.min(best, d);
        else if (
          q.length >= 4 &&
          n.length >= 4 &&
          (n.startsWith(q.slice(0, 4)) || q.startsWith(n.slice(0, 4)))
        ) {
          best = Math.min(best, allowed + 1);
        }
      }
    }
    if (best !== Number.POSITIVE_INFINITY) scored.push({ term, score: best });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.term.term.localeCompare(b.term.term, 'en'))
    .slice(0, limit)
    .map((s) => s.term);
}

// ---------------------------------------------------------------------------
// Highlighting
// ---------------------------------------------------------------------------

export interface Piece {
  text: string;
  hit: boolean;
}

/** Split text around the first occurrence of each query word, for `<mark>`. Case insensitive. */
export function highlightPieces(text: string, query: string): Piece[] {
  const needles = words(query).filter((w) => w.length >= 2);
  if (needles.length === 0) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const spans: Array<[number, number]> = [];
  for (const n of needles) {
    const at = lower.indexOf(n);
    if (at >= 0) spans.push([at, at + n.length]);
  }
  if (spans.length === 0) return [{ text, hit: false }];
  spans.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  const out: Piece[] = [];
  let cursor = 0;
  for (const [a, b] of merged) {
    if (a > cursor) out.push({ text: text.slice(cursor, a), hit: false });
    out.push({ text: text.slice(a, b), hit: true });
    cursor = b;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false });
  return out;
}

// ---------------------------------------------------------------------------
// Deep links
// ---------------------------------------------------------------------------

/** The term id a hash points at (`#fluxnode` or `#term-fluxnode`), or null. */
export function termIdFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  let id = raw;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // keep the raw text
  }
  id = id.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]*$/.test(id) ? id : null;
}

/** The DOM id an entry carries, so `#id` scrolls to it even before JavaScript wires anything. */
export function entryDomId(termId: string): string {
  return termId;
}

/** Link to a term on the glossary page. */
export function termHref(id: string): string {
  return `/glossary#${id}`;
}
