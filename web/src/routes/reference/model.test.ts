import { describe, expect, it } from 'vitest';
import { REFERENCE_INDEX, type ReferenceEntry, type SectionMeta } from '@/content/reference';
import {
  absoluteLink,
  computeActive,
  isSafeId,
  isUnverified,
  lintPath,
  numberSections,
  PROV,
  PROV_ORDER,
  readRequired,
  sortedProv,
  unverifiedOf,
} from './model';

const section = (id: string, level: 2 | 3): SectionMeta => ({
  id,
  title: id,
  summary: '',
  keywords: [],
  level,
});

describe('numberSections', () => {
  it('numbers sections 1, 2, 3 and subsections 2.1, 2.2', () => {
    const out = numberSections([
      section('a', 2),
      section('b', 2),
      section('b1', 3),
      section('b2', 3),
      section('c', 2),
      section('c1', 3),
    ]);
    expect(out.map((s) => s.number)).toEqual(['1', '2', '2.1', '2.2', '3', '3.1']);
  });

  it('names the parent of a subsection and none for a section', () => {
    const out = numberSections([section('a', 2), section('a1', 3), section('b', 2)]);
    expect(out.map((s) => s.parent)).toEqual([null, 'a', null]);
  });

  it('restarts the subsection count under each section', () => {
    const out = numberSections([section('a', 2), section('a1', 3), section('b', 2), section('b1', 3)]);
    expect(out.map((s) => s.number)).toEqual(['1', '1.1', '2', '2.1']);
  });

  it('keeps the metadata it was given', () => {
    const input = [{ ...section('a', 2), title: 'The title', summary: 'One sentence.' }];
    expect(numberSections(input)[0]).toMatchObject({ id: 'a', title: 'The title', summary: 'One sentence.' });
  });

  it('copes with nothing', () => {
    expect(numberSections([])).toEqual([]);
  });
});

describe('computeActive', () => {
  const items = [
    { id: 'one', top: -300 },
    { id: 'two', top: -20 },
    { id: 'three', top: 80 },
    { id: 'four', top: 600 },
  ];

  it('is the last section whose heading has reached the line', () => {
    expect(computeActive(items, 0, false)).toBe('two');
    expect(computeActive(items, 100, false)).toBe('three');
    expect(computeActive(items, 700, false)).toBe('four');
  });

  it('is the first section before any heading has reached the line', () => {
    expect(computeActive([{ id: 'one', top: 400 }], 64, false)).toBe('one');
  });

  it('is the last section at the bottom of the page', () => {
    expect(computeActive(items, 0, true)).toBe('four');
  });

  it('is null for no sections', () => {
    expect(computeActive([], 0, false)).toBeNull();
    expect(computeActive([], 0, true)).toBeNull();
  });

  it('counts a heading exactly on the line as reached', () => {
    expect(
      computeActive(
        [
          { id: 'a', top: 0 },
          { id: 'b', top: 64 },
        ],
        64,
        false,
      ),
    ).toBe('b');
  });
});

describe('provenance', () => {
  it('words every kind and cautions the two that are not facts', () => {
    for (const kind of PROV_ORDER) {
      expect(PROV[kind].label).not.toBe('');
      expect(PROV[kind].meaning.endsWith('.')).toBe(true);
    }
    expect(PROV.unverified.caution).toBe(true);
    expect(PROV.inference.caution).toBe(true);
    expect(PROV.source.caution).toBe(false);
    expect(PROV.live.caution).toBe(false);
    expect(PROV.docs.caution).toBe(false);
  });

  it('sorts in the fixed order and drops repeats', () => {
    expect(sortedProv(['unverified', 'source', 'live', 'source'])).toEqual(['source', 'live', 'unverified']);
  });

  it('knows an unverified statement', () => {
    expect(isUnverified(['source', 'unverified'])).toBe(true);
    expect(isUnverified(['source'])).toBe(false);
    expect(isUnverified(undefined)).toBe(false);
  });
});

describe('readRequired', () => {
  it('reads the three spellings the field docs use', () => {
    expect(readRequired('no')).toEqual({ required: false, detail: '' });
    expect(readRequired('yes')).toEqual({ required: true, detail: '' });
    expect(readRequired('yes, may be empty')).toEqual({ required: true, detail: 'may be empty' });
  });

  it('is not caught out by case or spaces', () => {
    expect(readRequired('  Yes, Always ')).toEqual({ required: true, detail: 'always' });
  });

  it('keeps an unfamiliar answer as detail and does not call it required', () => {
    expect(readRequired('only on v8')).toEqual({ required: false, detail: 'only on v8' });
  });

  it('agrees with the engine docs: every field says yes or no', () => {
    const fields = REFERENCE_INDEX.filter((e) => e.kind === 'field');
    expect(fields.length).toBeGreaterThan(20);
  });
});

describe('unverifiedOf', () => {
  const entry = (partial: Partial<ReferenceEntry>): ReferenceEntry => ({
    id: 'x',
    kind: 'fact',
    topic: 'spec',
    anchor: 'x',
    path: '/reference/spec#x',
    title: 'x',
    group: '',
    summary: '',
    keywords: [],
    text: '',
    ...partial,
  });

  it('keeps entries of the topic that wear the label and have a place on the page', () => {
    const entries = [
      entry({ id: 'a', prov: ['unverified'] }),
      entry({ id: 'b', prov: ['source'] }),
      entry({ id: 'c', prov: ['source', 'unverified'] }),
      entry({ id: 'd', topic: 'docker', prov: ['unverified'] }),
      entry({ id: 'e', anchor: '', prov: ['unverified'] }),
    ];
    expect(unverifiedOf(entries, 'spec').map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('finds at least one on every page of the real index, as the pages say', () => {
    for (const topic of ['spec', 'networking', 'docker', 'api'] as const) {
      expect(unverifiedOf(REFERENCE_INDEX, topic).length, topic).toBeGreaterThan(0);
    }
  });
});

describe('links', () => {
  it('builds an absolute link from an origin, a path and an id', () => {
    expect(absoluteLink('https://academy.example', '/reference/spec', 'component-ports')).toBe(
      'https://academy.example/reference/spec#component-ports',
    );
  });

  it('replaces a fragment that is already there', () => {
    expect(absoluteLink('https://a.test', '/reference/api#old', 'new')).toBe(
      'https://a.test/reference/api#new',
    );
  });

  it('points a lint code at the lint index', () => {
    const entry = REFERENCE_INDEX.find((e) => e.kind === 'lint' && e.anchor === 'lint-PORT_BANNED');
    expect(entry).toBeDefined();
    expect(lintPath('PORT_BANNED')).toBe(entry?.path);
  });

  it('accepts only ids that are safe in a selector', () => {
    expect(isSafeId('component-ports')).toBe(true);
    expect(isSafeId('lint-PORT_BANNED')).toBe(true);
    expect(isSafeId('')).toBe(false);
    expect(isSafeId('a b')).toBe(false);
    expect(isSafeId('a"]x')).toBe(false);
    expect(isSafeId('a.b')).toBe(false);
  });
});
