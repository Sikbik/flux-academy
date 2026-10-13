/**
 * Reference and troubleshooting answers in the deck, on demand.
 *
 * The Reference has 550 entries (every field, limit, endpoint and rule) and troubleshooting has 230
 * (symptoms, error messages and lint codes). That is a lot of text for a command deck to carry, so none of
 * it is in the deck's chunk: this module only knows the shape of a match and how to turn one into a deck
 * row. The sources are loaded by `deepLoaders.ts` with a dynamic `import()` the first time they are
 * wanted, and the matching is the pages' own (`searchReference` and the troubleshooting `search`), so a
 * result in the deck is a result on the page and the two can never disagree about what is found first.
 *
 * Loading
 *   - started shortly after the deck opens, or at once on a query of two characters or more;
 *   - skipped on a metered connection (`navigator.connection.saveData`) until the visitor asks for it;
 *   - cached for the life of the page, and a failed load is retried, but not on every keystroke.
 *
 * Ranking (see `scoreDeep`)
 *   - the pages' scores are scaled down, so a lesson or a page that matches as well still leads;
 *   - an exact id (a lint code in any case, a pasted error message, a symptom or anchor written as it is
 *     in the address, a field key) goes first.
 *
 * Pure apart from the loading state, which takes its loaders and its clock as arguments so tests can
 * inject both.
 */

import type { GlyphName } from '@/ui';
import { prepare } from './fuzzy';
import type { DeckItem } from './items';

// ---------------------------------------------------------------------------
// What a source returns
// ---------------------------------------------------------------------------

/** One hit of the Reference's own search. */
export interface ReferenceMatch {
  /** Unique and stable: `spec/component-ports`. */
  id: string;
  /** `page`, `section`, `field`, `lint`, `endpoint`, `tool` or `fact`. */
  kind: string;
  /** `spec`, `networking`, `docker` or `api`. */
  topic: string;
  /** The topic as people read it: "Application spec". */
  topicName: string;
  title: string;
  /** One plain sentence. */
  summary: string;
  /** Where it sits: "Application spec, component fields". */
  group: string;
  /** Site path with the fragment: `/reference/spec#component-ports`. */
  path: string;
  /** The Reference search's own score: 1000 is an exact title, 900 an exact keyword. */
  score: number;
  /** Marked unverified in FACTS: say so in the row. */
  unverified: boolean;
}

/** One hit of the troubleshooting search. */
export interface FixMatch {
  kind: 'symptom' | 'message' | 'code';
  /** The id the page uses in the address: `app-stuck-installing`, `message-<id>`, `code-<CODE>`. */
  id: string;
  title: string;
  summary: string;
  /** Right-hand text: the stage, "Error message", "Lint code". */
  meta: string;
  path: string;
  /** The troubleshooting search's own score. */
  score: number;
  /** A code named outright, a message pasted whole, or an address fragment typed as it is. */
  exact: boolean;
}

export interface ReferenceSource {
  search(query: string, limit: number): readonly ReferenceMatch[];
}

export interface FixSource {
  search(query: string): readonly FixMatch[];
}

export interface DeepLoaders {
  reference(): Promise<ReferenceSource>;
  fix(): Promise<FixSource>;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * The deck's scale, as `scoreFields` produces it: a title that is exactly the query is about 650, a
 * prefix about 400 and two words that both land about 800. A deep hit is placed on it here.
 */
export const DEEP = {
  /**
   * A Reference hit's score is scaled down: the pages' own scale tops out at an exact title (1000), and
   * a keyword that merely equals a common word ("node") must not lead the lessons and terms that match
   * as well. An exact keyword lands at 315, a title prefix at 280.
   */
  referenceScale: 0.35,
  /** A troubleshooting hit: a floor and a slope over that search's own tens-to-hundreds scale. */
  fixFloor: 60,
  fixSlope: 2,
  /** Most a hit that is not exact can reach, so it never passes a page that matches as well. */
  ceiling: 380,
  /** A field, endpoint or section whose title is the plain words typed: level with a term, below a lesson. */
  exactPlain: 560,
  /** A code written out in spaced words ("port fee"): behind a glossary entry of the same name. */
  exactSpaced: 1150,
  /** An id: a lint code with its underscore, a pasted message, a symptom or anchor, a camelCase key. */
  exactId: 1500,
  /** How many deep rows one group shows. */
  perGroup: 5,
  /** How many matches to ask the Reference search for, before pages and lint codes are set aside. */
  referenceFetch: 14,
  /** Shortest query that is worth a look in the deep sources. */
  minQuery: 2,
} as const;

/** A query that reads as an identifier rather than as words: `PORT_FEE`, `containerPorts`, `/daemon/x`. */
export function looksLikeId(query: string): boolean {
  const q = query.trim();
  if (q === '' || /\s/.test(q)) return false;
  return /[_/]/.test(q) || /[a-z][A-Z]/.test(q) || /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(q);
}

/**
 * True when the query is the entry's title or its anchor exactly as it is written (case aside). The
 * Reference search folds hyphens, underscores and dots to spaces, so "image-architecture" also "equals" the
 * title "Image architecture"; that is a plain-words match, not the id of anything.
 */
function writtenAs(m: ReferenceMatch, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return false;
  const fragment = m.path.split('#')[1] ?? '';
  return m.title.toLowerCase() === q || fragment.toLowerCase() === q;
}

/** Where a Reference hit lands on the deck's scale. */
export function scoreReference(m: ReferenceMatch, query: string): number {
  if (m.score >= 1000) return looksLikeId(query) && writtenAs(m, query) ? DEEP.exactId : DEEP.exactPlain;
  return Math.min(DEEP.ceiling, m.score * DEEP.referenceScale);
}

/** Where a troubleshooting hit lands on the deck's scale. */
export function scoreFix(m: FixMatch, query: string): number {
  if (m.exact) {
    // A pasted message or a fragment of the address is unmistakable; a code is exact whenever its name
    // is, but "port fee" is also a glossary entry and may share the first place.
    if (m.kind === 'code' && !/[_]/.test(query) && !looksLikeId(query)) return DEEP.exactSpaced;
    return DEEP.exactId;
  }
  return Math.min(DEEP.ceiling, DEEP.fixFloor + m.score * DEEP.fixSlope);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface DeepHit {
  item: DeckItem;
  score: number;
}

const TOPIC_GLYPH: Readonly<Record<string, GlyphName>> = {
  spec: 'code',
  networking: 'route',
  docker: 'container',
  api: 'terminal',
};

const FIX_GLYPH: Readonly<Record<FixMatch['kind'], GlyphName>> = {
  symptom: 'help',
  message: 'terminal',
  code: 'shield',
};

function deepItem(
  base: Pick<
    DeckItem,
    'id' | 'kind' | 'ref' | 'to' | 'title' | 'subtitle' | 'meta' | 'description' | 'tile'
  > &
    Partial<Pick<DeckItem, 'badge' | 'badgeTone'>>,
): DeckItem {
  return {
    ...base,
    external: false,
    // A deep row is found by searching, not browsed to, and its id is not in the catalog the recents
    // list is checked against: it is not worth remembering there.
    transient: true,
    deep: true,
    fields: [],
    titleP: prepare(base.title),
    subtitleP: prepare(base.subtitle),
  };
}

export function referenceItem(m: ReferenceMatch): DeckItem {
  return deepItem({
    id: `ref:${m.id}`,
    kind: 'reference',
    ref: m.path,
    to: m.path,
    title: m.title,
    subtitle: m.summary,
    meta: m.topicName,
    description: `${m.group}. ${m.summary}`,
    tile: { glyph: TOPIC_GLYPH[m.topic] ?? 'layers' },
    ...(m.unverified ? { badge: 'Unverified', badgeTone: 'warn' as const } : {}),
  });
}

export function fixItem(m: FixMatch): DeckItem {
  return deepItem({
    id: `fix:${m.id}`,
    kind: 'fix',
    ref: m.path,
    to: m.path,
    title: m.title,
    subtitle: m.summary,
    meta: m.meta,
    description: `${m.meta}. ${m.summary}`,
    tile: { glyph: FIX_GLYPH[m.kind] },
  });
}

/**
 * The deck rows for a query, from what the two sources found. The Reference's page entries and its lint
 * codes are left out: the deck already lists the pages, and a lint code is answered under Fix it.
 */
export function deepHits(
  query: string,
  reference: readonly ReferenceMatch[],
  fix: readonly FixMatch[],
): DeepHit[] {
  const out: DeepHit[] = [];
  for (const m of reference) {
    if (m.kind === 'page' || m.kind === 'lint') continue;
    out.push({ item: referenceItem(m), score: scoreReference(m, query) });
  }
  for (const m of fix) out.push({ item: fixItem(m), score: scoreFix(m, query) });
  return out;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * `idle` nothing asked yet, `loading` a source is on its way, `ready` both are here, `skipped` held back
 * because the connection is metered, `error` a source could not be loaded (retried later).
 */
export type DeepStatus = 'idle' | 'loading' | 'ready' | 'skipped' | 'error';

export interface DeepSearch {
  /**
   * Begins loading what is not loaded yet, unless the connection is metered. Safe to call on every
   * keystroke: a load in flight or finished is reused. Resolves when both sources have settled.
   */
  start(): Promise<void>;
  /** The same, on the visitor's say-so: ignores a metered connection. */
  load(): Promise<void>;
  status(): DeepStatus;
  /** Changes whenever the status or a source does (for `useSyncExternalStore`). */
  version(): number;
  subscribe(listener: () => void): () => void;
  /** Rows for a query from whatever is loaded now. Empty while nothing is, or for a short query. */
  search(query: string): DeepHit[];
}

export interface DeepOptions {
  /** True on a metered connection. Default: never. */
  saveData?: () => boolean;
  /** Milliseconds before a failed load is tried again by `start`. Default 5000. */
  retryAfterMs?: number;
  now?: () => number;
}

interface Slot<T> {
  value: T | null;
  promise: Promise<void> | null;
  failedAt: number | null;
}

export function createDeepSearch(loaders: DeepLoaders, options: DeepOptions = {}): DeepSearch {
  const saveData = options.saveData ?? (() => false);
  const retryAfter = options.retryAfterMs ?? 5000;
  const now = options.now ?? Date.now;
  const listeners = new Set<() => void>();
  let version = 0;
  let skipped = false;

  const reference: Slot<ReferenceSource> = { value: null, promise: null, failedAt: null };
  const fix: Slot<FixSource> = { value: null, promise: null, failedAt: null };

  const bump = () => {
    version += 1;
    for (const l of [...listeners]) l();
  };

  const begin = <T>(slot: Slot<T>, load: () => Promise<T>, force: boolean): Promise<void> => {
    if (slot.value || slot.promise) return slot.promise ?? Promise.resolve();
    if (!force && slot.failedAt !== null && now() - slot.failedAt < retryAfter) return Promise.resolve();
    slot.failedAt = null;
    slot.promise = (async () => {
      try {
        slot.value = await load();
      } catch {
        slot.failedAt = now();
      } finally {
        slot.promise = null;
        bump();
      }
    })();
    return slot.promise;
  };

  const run = async (force: boolean): Promise<void> => {
    if (!force && saveData()) {
      if (!skipped) {
        skipped = true;
        bump();
      }
      return;
    }
    if (skipped) {
      skipped = false;
      bump();
    }
    const pending = [begin(reference, loaders.reference, force), begin(fix, loaders.fix, force)];
    if (reference.promise || fix.promise) bump();
    await Promise.all(pending);
  };

  return {
    start: () => run(false),
    load: () => run(true),
    status() {
      if (reference.value && fix.value) return 'ready';
      if (reference.promise || fix.promise) return 'loading';
      if (skipped) return 'skipped';
      if (reference.failedAt !== null || fix.failedAt !== null) return 'error';
      return 'idle';
    },
    version: () => version,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    search(query) {
      const q = query.trim();
      if (q.length < DEEP.minQuery) return [];
      const refs = reference.value?.search(q, DEEP.referenceFetch) ?? [];
      const fixes = fix.value?.search(q) ?? [];
      return deepHits(q, refs, fixes);
    },
  };
}
