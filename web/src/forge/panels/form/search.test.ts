import { describe, expect, it } from 'vitest';
import { SEARCH_ACTIONS, searchEntries, searchResults } from './search';

describe('the form search', () => {
  const entries = searchEntries(['web', 'db']);

  it('lists the app fields, every component field and the two actions', () => {
    expect(entries.filter((e) => e.where === 'App')).toHaveLength(10);
    expect(entries.filter((e) => e.where === 'web')).toHaveLength(11);
    expect(entries.filter((e) => e.where === 'db')).toHaveLength(11);
    expect(entries.filter((e) => e.action).map((e) => e.action)).toEqual(['add-component', 'add-private']);
  });

  it('finds the private component action by what somebody would type', () => {
    for (const q of ['private', 'add private', 'database', 'cache', 'add a component']) {
      expect(searchResults(entries, q).map((e) => e.action)).toContain(
        q === 'add a component' ? 'add-component' : 'add-private',
      );
    }
  });

  it('puts the action ahead of fields that only mention private images', () => {
    const first = searchResults(entries, 'private')[0];
    expect(first?.action).toBe('add-private');
  });

  it('still finds fields by their words, in form order', () => {
    const r = searchResults(entries, 'port');
    expect(r[0]?.path).toBe('compose[0].ports');
    expect(r.some((e) => e.action === 'add-component')).toBe(true);
  });

  it('finds nothing for nothing and gives actions no path', () => {
    expect(searchResults(entries, '   ')).toEqual([]);
    expect(searchResults(entries, 'zzzz')).toEqual([]);
    for (const a of SEARCH_ACTIONS) expect(a.path).toBe('');
  });

  it('skips a component that is not named yet, except the first', () => {
    expect(searchEntries(['', '']).filter((e) => e.where.startsWith('Component '))).toHaveLength(11);
  });
});
