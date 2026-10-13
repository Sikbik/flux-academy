/**
 * The glossary registry: every `content/glossary/*.ts` file (default export `GlossaryTerm[]`), merged
 * into one lookup. Used by the inline `{{term:id}}` hover cards, the glossary page and the command deck.
 *
 *   getTerm(id)            one entry or undefined
 *   allTerms()             every term, sorted by display text
 *   searchTerms(q, limit)  ranked matches over term, aka, short and why
 *
 * The pure builders (`buildGlossary`, `searchGlossary`) take plain arrays so they can be tested without
 * the glob. Duplicate ids keep the first file (alphabetical by path); the content test fails on them.
 */

import type { GlossaryTerm } from './types';

export interface Glossary {
  terms: GlossaryTerm[];
  byId: ReadonlyMap<string, GlossaryTerm>;
}

export function buildGlossary(files: readonly (readonly GlossaryTerm[])[]): Glossary {
  const byId = new Map<string, GlossaryTerm>();
  for (const file of files) {
    if (!Array.isArray(file)) continue;
    for (const t of file) {
      if (t && typeof t.id === 'string' && !byId.has(t.id)) byId.set(t.id, t);
    }
  }
  const terms = [...byId.values()].sort((a, b) => a.term.localeCompare(b.term, 'en'));
  return { terms, byId };
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function plain(markup: string): string {
  return markup.replace(/\{\{(?:term|lesson|lab|kbd):([^}|]*)(?:\|[^}]*)?\}\}/g, '$1').replace(/[*`]/g, '');
}

/** Score a term against query tokens. 0 means no match. Higher is better. */
export function scoreTerm(t: GlossaryTerm, q: string, tokens: readonly string[]): number {
  const name = normalise(t.term);
  const id = t.id.replace(/-/g, ' ');
  const aka = (t.aka ?? []).map(normalise);
  const short = normalise(plain(t.short));
  const why = normalise(plain(t.why));
  let best = 0;
  if (name === q || id === q || aka.includes(q)) best = 1000;
  else if (name.startsWith(q) || id.startsWith(q)) best = 800;
  else if (aka.some((a) => a.startsWith(q))) best = 700;
  else if (name.split(' ').some((w) => w.startsWith(q))) best = 600;
  else if (name.includes(q) || id.includes(q)) best = 450;
  else if (aka.some((a) => a.includes(q))) best = 400;
  if (best > 0) return best;
  // Every token must hit somewhere; the score reflects where.
  let sum = 0;
  for (const tok of tokens) {
    if (name.includes(tok) || id.includes(tok)) sum += 120;
    else if (aka.some((a) => a.includes(tok))) sum += 100;
    else if (short.includes(tok)) sum += 40;
    else if (why.includes(tok)) sum += 15;
    else return 0;
  }
  return sum;
}

export function searchGlossary(terms: readonly GlossaryTerm[], query: string, limit = 20): GlossaryTerm[] {
  const q = normalise(query);
  if (q === '') return [];
  const tokens = q.split(' ');
  return terms
    .map((t) => ({ t, s: scoreTerm(t, q, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.t.term.localeCompare(b.t.term, 'en'))
    .slice(0, limit)
    .map((x) => x.t);
}

// ---------------------------------------------------------------------------
// The registry, from the glob
// ---------------------------------------------------------------------------

// No type argument on the glob (see loader.ts): Vitest must see the literal `import.meta.glob(` so that it
// never reuses a cached expansion of this folder.
const modules = import.meta.glob('../content/glossary/*.ts', { eager: true }) as Record<
  string,
  { default: GlossaryTerm[] }
>;

const registry: Glossary = buildGlossary(
  Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, m]) => m.default),
);

export function allTerms(): readonly GlossaryTerm[] {
  return registry.terms;
}

export function getTerm(id: string): GlossaryTerm | undefined {
  return registry.byId.get(id);
}

export function hasTerm(id: string): boolean {
  return registry.byId.has(id);
}

export function searchTerms(query: string, limit = 20): GlossaryTerm[] {
  return searchGlossary(registry.terms, query, limit);
}

/** Terms whose `lessons` list names this lesson. */
export function termsForLesson(lessonId: string): GlossaryTerm[] {
  return registry.terms.filter((t) => t.lessons?.includes(lessonId));
}
