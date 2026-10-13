import { describe, expect, it } from 'vitest';
import type { GlossaryTerm } from '@/learn/types';
import {
  CATEGORIES,
  countLabel,
  editDistance,
  facetCounts,
  filterTerms,
  groupByLetter,
  highlightPieces,
  isFiltered,
  NO_FILTERS,
  nearestTerms,
  termIdFromHash,
  termLetter,
  termTracks,
} from './model';

function term(over: Partial<GlossaryTerm> & { id: string; term: string }): GlossaryTerm {
  return {
    short: `${over.term} is a thing.`,
    why: `You need ${over.term}.`,
    category: 'network',
    ...over,
  };
}

const TERMS: GlossaryTerm[] = [
  term({
    id: 'cname',
    term: 'CNAME',
    aka: ['canonical name'],
    category: 'network',
    lessons: ['custom-domains'],
  }),
  term({ id: 'fluxnode', term: 'FluxNode', aka: ['node'], category: 'network', lessons: ['what-is-flux'] }),
  term({ id: 'image', term: 'Image', category: 'docker', lessons: ['containers-101', 'persistent-storage'] }),
  term({ id: 'port-fee', term: 'Port fee', category: 'money', lessons: ['resources-pricing'] }),
  term({ id: 'volume', term: 'Volume', category: 'ops', short: 'A folder that survives restarts.' }),
  term({ id: '2fa', term: '2FA', category: 'ops' }),
];

describe('termTracks', () => {
  it('maps lessons to their tracks in track order', () => {
    expect(termTracks(TERMS[2] as GlossaryTerm)).toEqual(['cumulus', 'stratus']);
  });
  it('is empty for a term with no lessons', () => {
    expect(termTracks(TERMS[4] as GlossaryTerm)).toEqual([]);
  });
  it('ignores a lesson id that does not exist', () => {
    expect(termTracks(term({ id: 'x', term: 'X', lessons: ['no-such-lesson'] }))).toEqual([]);
  });
});

describe('letters', () => {
  it('files a leading digit under #', () => {
    expect(termLetter(TERMS[5] as GlossaryTerm)).toBe('#');
    expect(termLetter(TERMS[1] as GlossaryTerm)).toBe('F');
  });
  it('groups runs of the same letter', () => {
    const sorted = [...TERMS].sort((a, b) => a.term.localeCompare(b.term, 'en'));
    const groups = groupByLetter(sorted);
    expect(groups.map((g) => g.letter)).toEqual(['#', 'C', 'F', 'I', 'P', 'V']);
    expect(groups.flatMap((g) => g.terms)).toHaveLength(TERMS.length);
  });
});

describe('filterTerms', () => {
  it('returns everything, unranked, with no filters', () => {
    const r = filterTerms(TERMS, NO_FILTERS);
    expect(r.ranked).toBe(false);
    expect(r.terms).toHaveLength(TERMS.length);
  });
  it('filters by kind', () => {
    const r = filterTerms(TERMS, { ...NO_FILTERS, category: 'docker' });
    expect(r.terms.map((t) => t.id)).toEqual(['image']);
  });
  it('filters by track through the lessons a term names', () => {
    const stratus = filterTerms(TERMS, { ...NO_FILTERS, track: 'stratus' });
    expect(stratus.terms.map((t) => t.id)).toEqual(['cname', 'image']);
    const nimbus = filterTerms(TERMS, { ...NO_FILTERS, track: 'nimbus' });
    expect(nimbus.terms.map((t) => t.id)).toEqual(['port-fee']);
  });
  it('searches names, aliases and definitions, ranked', () => {
    expect(filterTerms(TERMS, { ...NO_FILTERS, query: 'node' }).terms[0]?.id).toBe('fluxnode');
    expect(filterTerms(TERMS, { ...NO_FILTERS, query: 'canonical name' }).terms[0]?.id).toBe('cname');
    const bySurvives = filterTerms(TERMS, { ...NO_FILTERS, query: 'survives' });
    expect(bySurvives.terms.map((t) => t.id)).toEqual(['volume']);
    expect(bySurvives.ranked).toBe(true);
  });
  it('applies the kind filter before the search', () => {
    const r = filterTerms(TERMS, { query: 'node', track: 'all', category: 'docker' });
    expect(r.terms).toEqual([]);
  });
});

describe('facetCounts', () => {
  it('counts each facet with the other applied', () => {
    const c = facetCounts(TERMS, { ...NO_FILTERS, category: 'docker' });
    expect(c.track.all).toBe(1);
    expect(c.track.cumulus).toBe(1);
    expect(c.track.stratus).toBe(1);
    expect(c.track.nimbus).toBe(0);
    expect(c.category.all).toBe(TERMS.length);
    expect(c.category.docker).toBe(1);
  });
  it('counts for the current query', () => {
    const c = facetCounts(TERMS, { ...NO_FILTERS, query: 'node' });
    expect(c.category.network).toBe(1);
    expect(c.category.docker).toBe(0);
  });
});

describe('countLabel', () => {
  it('says the real number', () => {
    expect(countLabel(90, 90)).toBe('90 terms');
    expect(countLabel(1, 1)).toBe('1 term');
    expect(countLabel(12, 90)).toBe('12 of 90 terms');
    expect(countLabel(0, 90)).toBe('0 of 90 terms');
  });
});

describe('isFiltered', () => {
  it('is false for blank and whitespace', () => {
    expect(isFiltered(NO_FILTERS)).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, query: '   ' })).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, track: 'nimbus' })).toBe(true);
  });
});

describe('editDistance', () => {
  it('counts single edits', () => {
    expect(editDistance('fluxnode', 'fluxnod')).toBe(1);
    expect(editDistance('image', 'imgae')).toBe(2);
    expect(editDistance('same', 'same')).toBe(0);
  });
  it('stops past the cap', () => {
    expect(editDistance('abcdefgh', 'zzzzzzzz', 2)).toBeGreaterThan(2);
  });
});

describe('nearestTerms', () => {
  it('finds a typo', () => {
    expect(nearestTerms(TERMS, 'fluxnod')[0]?.id).toBe('fluxnode');
    expect(nearestTerms(TERMS, 'imge')[0]?.id).toBe('image');
  });
  it('finds a near alias', () => {
    expect(nearestTerms(TERMS, 'canonicle name')[0]?.id).toBe('cname');
  });
  it('returns nothing for gibberish', () => {
    expect(nearestTerms(TERMS, 'qzxw')).toEqual([]);
    expect(nearestTerms(TERMS, '')).toEqual([]);
  });
  it('respects the limit', () => {
    expect(nearestTerms(TERMS, 'volum', 1)).toHaveLength(1);
  });
});

describe('highlightPieces', () => {
  it('marks the query inside the text', () => {
    expect(highlightPieces('FluxNode', 'node')).toEqual([
      { text: 'Flux', hit: false },
      { text: 'Node', hit: true },
    ]);
  });
  it('returns the text whole when nothing matches', () => {
    expect(highlightPieces('Image', 'zzz')).toEqual([{ text: 'Image', hit: false }]);
    expect(highlightPieces('Image', '')).toEqual([{ text: 'Image', hit: false }]);
  });
  it('merges overlapping hits', () => {
    const pieces = highlightPieces('network', 'net work netw');
    expect(pieces.map((p) => p.text).join('')).toBe('network');
    expect(pieces.filter((p) => p.hit)).toHaveLength(1);
  });
});

describe('termIdFromHash', () => {
  it('reads an id', () => {
    expect(termIdFromHash('#fluxnode')).toBe('fluxnode');
    expect(termIdFromHash('#Port-Fee')).toBe('port-fee');
  });
  it('rejects things that are not ids', () => {
    expect(termIdFromHash('')).toBeNull();
    expect(termIdFromHash('#')).toBeNull();
    expect(termIdFromHash('#a b')).toBeNull();
    expect(termIdFromHash('#%E0%A4%A')).toBeNull();
  });
});

describe('categories', () => {
  it('covers every glossary category once', () => {
    expect(CATEGORIES.map((c) => c.id).sort()).toEqual(['app', 'docker', 'money', 'network', 'ops']);
  });
});
