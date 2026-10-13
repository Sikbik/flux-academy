import { describe, expect, it } from 'vitest';
import { collapsibleIndices, isCollapsible, visibleIndices } from './collapse';

describe('collapsibleIndices', () => {
  it('does not collapse short trails', () => {
    expect(collapsibleIndices(0)).toEqual([]);
    expect(collapsibleIndices(2)).toEqual([]);
    expect(collapsibleIndices(3)).toEqual([]);
  });

  it('keeps the first and the last two', () => {
    expect(collapsibleIndices(4)).toEqual([1]);
    expect(collapsibleIndices(5)).toEqual([1, 2]);
    expect(collapsibleIndices(7)).toEqual([1, 2, 3, 4]);
  });

  it('agrees with isCollapsible', () => {
    for (const n of [1, 3, 4, 6]) {
      const set = collapsibleIndices(n);
      for (let i = 0; i < n; i++) expect(isCollapsible(i, n)).toBe(set.includes(i));
    }
  });
});

describe('visibleIndices', () => {
  it('uses the default collapsible set without maxItems', () => {
    expect(visibleIndices(6, undefined, false).collapsible).toEqual([1, 2, 3]);
  });

  it('folds to maxItems when the trail is longer', () => {
    const r = visibleIndices(7, 4, false);
    expect(r.pinned).toEqual([0, 4, 5, 6]);
    expect(r.collapsible).toEqual([1, 2, 3]);
  });

  it('shows the trail when it already fits', () => {
    expect(visibleIndices(4, 4, false).collapsible).toEqual([1]);
    expect(visibleIndices(3, 2, false).collapsible).toEqual([]);
  });

  it('keeps the parent and the page at the smallest maxItems', () => {
    const r = visibleIndices(6, 2, false);
    expect(r.pinned).toEqual([0, 4, 5]);
  });

  it('lifts the forced fold when expanded (the default pinned set remains)', () => {
    const r = visibleIndices(7, 4, true);
    expect(r.pinned).toEqual([0, 5, 6]);
    expect(r.collapsible).toEqual([1, 2, 3, 4]);
  });
});
