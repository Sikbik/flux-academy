import { LINT_CODES } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { REFERENCE_INDEX, searchReference, TOPICS } from './index';
import { highlight, normalise, tokensOf } from './search';

describe('REFERENCE_INDEX', () => {
  it('has unique ids', () => {
    const ids = REFERENCE_INDEX.map((e) => e.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it('has unique anchors inside each topic, so every id of a page is one element', () => {
    for (const t of TOPICS) {
      const anchors = REFERENCE_INDEX.filter((e) => e.topic === t.id && e.anchor !== '').map((e) => e.anchor);
      const dupes = anchors.filter((a, i) => anchors.indexOf(a) !== i);
      expect(dupes, t.id).toEqual([]);
    }
  });

  it('has paths that are the topic path plus the fragment', () => {
    for (const e of REFERENCE_INDEX) {
      const base = TOPICS.find((t) => t.id === e.topic)?.path;
      expect(e.path, e.id).toBe(e.anchor ? `${base}#${e.anchor}` : base);
      expect(/^[A-Za-z0-9_-]*$/.test(e.anchor), `${e.id} anchor ${e.anchor}`).toBe(true);
    }
  });

  it('has one page entry per topic and a section entry for each section', () => {
    for (const t of TOPICS) {
      expect(REFERENCE_INDEX.filter((e) => e.kind === 'page' && e.topic === t.id)).toHaveLength(1);
      for (const s of t.sections) {
        expect(
          REFERENCE_INDEX.some((e) => e.topic === t.id && e.anchor === s.id),
          `${t.id}#${s.id}`,
        ).toBe(true);
      }
    }
  });

  it('has an entry for every lint code and field', () => {
    for (const code of Object.keys(LINT_CODES)) {
      expect(
        REFERENCE_INDEX.some((e) => e.kind === 'lint' && e.title === code),
        code,
      ).toBe(true);
    }
    expect(REFERENCE_INDEX.filter((e) => e.kind === 'field').length).toBeGreaterThanOrEqual(26);
  });

  it('keeps entries short enough to be cheap to load', () => {
    const bytes = JSON.stringify(REFERENCE_INDEX).length;
    expect(bytes).toBeLessThan(400_000);
    for (const e of REFERENCE_INDEX) {
      expect(e.title.length, e.id).toBeGreaterThan(0);
      expect(e.summary.length, e.id).toBeLessThanOrEqual(260);
    }
  });
});

describe('searchReference', () => {
  const first = (q: string) => searchReference(REFERENCE_INDEX, q)[0]?.entry;

  it('finds a lint code by its name, with or without the underscore', () => {
    expect(first('PORT_BANNED')?.title).toBe('PORT_BANNED');
    expect(first('port banned')?.title).toBe('PORT_BANNED');
  });

  it('finds a field by its key', () => {
    expect(first('containerPorts')?.anchor).toBe('component-containerPorts');
    expect(first('expire')?.anchor).toBe('app-expire');
  });

  it('finds the calculator by its content type', () => {
    const hits = searchReference(REFERENCE_INDEX, 'text/plain').map((h) => h.entry.topic);
    expect(hits).toContain('api');
  });

  it('finds the networking answer to a plain question', () => {
    const hits = searchReference(REFERENCE_INDEX, 'localhost').map((h) => h.entry.anchor);
    expect(hits.some((a) => a.startsWith('binding') || a.includes('localhost'))).toBe(true);
  });

  it('filters by topic and returns nothing for an empty query', () => {
    expect(searchReference(REFERENCE_INDEX, '')).toEqual([]);
    const hits = searchReference(REFERENCE_INDEX, 'port', { topic: 'docker', limit: 50 });
    expect(hits.every((h) => h.entry.topic === 'docker')).toBe(true);
  });

  it('requires every token to hit', () => {
    expect(searchReference(REFERENCE_INDEX, 'zzzqqq nothing')).toEqual([]);
  });

  it('ranks an exact title above a body mention', () => {
    const hits = searchReference(REFERENCE_INDEX, 'staticip');
    expect(hits[0]?.entry.anchor).toBe('app-staticip');
  });
});

describe('search helpers', () => {
  it('normalises', () => {
    expect(normalise('PORT_BANNED')).toBe('port banned');
    expect(normalise('  a!c-EU/DE ')).toBe('a c eu de');
  });

  it('tokenises without duplicates', () => {
    expect(tokensOf('port Port banned')).toEqual(['port', 'banned']);
  });

  it('marks the matching runs', () => {
    expect(highlight('Banned ports', 'ban')).toEqual([
      { text: 'Ban', match: true },
      { text: 'ned ports', match: false },
    ]);
    expect(highlight('abc', '')).toEqual([{ text: 'abc', match: false }]);
  });
});
