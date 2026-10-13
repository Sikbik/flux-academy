import { describe, expect, it } from 'vitest';
import { buildGlossary, searchGlossary } from './glossary';
import type { GlossaryTerm } from './types';

const t = (id: string, term: string, short: string, extra: Partial<GlossaryTerm> = {}): GlossaryTerm => ({
  id,
  term,
  short,
  why: `Why ${term} matters to a deployer.`,
  category: 'network',
  ...extra,
});

const files = [
  [
    t('fluxnode', 'FluxNode', 'A server run by an independent operator.', { aka: ['node'] }),
    t('collateral', 'Collateral', 'FLUX locked to run a node.'),
  ],
  [
    t('fdm', 'FDM', 'The domain manager that routes web traffic to your app.', {
      aka: ['flux domain manager'],
    }),
    t('fluxnode', 'Duplicate', 'Ignored: the first file wins.'),
    t('repotag', 'Repotag', 'The image name and tag, like nginx:1.27.'),
  ],
];

describe('glossary registry', () => {
  const g = buildGlossary(files);

  it('merges files, keeps the first of a duplicate id and sorts by term', () => {
    expect(g.terms.map((x) => x.id)).toEqual(['collateral', 'fdm', 'fluxnode', 'repotag']);
    expect(g.byId.get('fluxnode')?.term).toBe('FluxNode');
  });

  it('ranks exact and prefix matches above text matches', () => {
    expect(searchGlossary(g.terms, 'fluxnode')[0]?.id).toBe('fluxnode');
    expect(searchGlossary(g.terms, 'flux')[0]?.id).toBe('fluxnode');
    expect(searchGlossary(g.terms, 'node')[0]?.id).toBe('fluxnode'); // via aka
  });

  it('finds by akas and by words in the definition, and needs every token', () => {
    expect(searchGlossary(g.terms, 'domain manager').map((x) => x.id)).toContain('fdm');
    expect(searchGlossary(g.terms, 'image tag').map((x) => x.id)).toEqual(['repotag']);
    expect(searchGlossary(g.terms, 'image zebra')).toEqual([]);
  });

  it('returns nothing for a blank query and honours the limit', () => {
    expect(searchGlossary(g.terms, '  ')).toEqual([]);
    expect(searchGlossary(g.terms, 'a', 1)).toHaveLength(1);
  });
});
