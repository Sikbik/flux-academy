import { describe, expect, it } from 'vitest';
import { normaliseOpen, toggleOpen } from './state';

describe('toggleOpen', () => {
  it('opens one at a time in single mode', () => {
    expect(toggleOpen([], 'a', 'single')).toEqual(['a']);
    expect(toggleOpen(['a'], 'b', 'single')).toEqual(['b']);
  });

  it('closes the open item when collapsible', () => {
    expect(toggleOpen(['a'], 'a', 'single', true)).toEqual([]);
  });

  it('keeps one open when not collapsible', () => {
    expect(toggleOpen(['a'], 'a', 'single', false)).toEqual(['a']);
  });

  it('toggles independently in multiple mode', () => {
    expect(toggleOpen(['a'], 'b', 'multiple')).toEqual(['a', 'b']);
    expect(toggleOpen(['a', 'b'], 'a', 'multiple')).toEqual(['b']);
  });
});

describe('normaliseOpen', () => {
  it('handles null, strings and lists', () => {
    expect(normaliseOpen(null, 'single')).toEqual([]);
    expect(normaliseOpen(undefined, 'multiple')).toEqual([]);
    expect(normaliseOpen('a', 'single')).toEqual(['a']);
    expect(normaliseOpen(['a', 'b'], 'multiple')).toEqual(['a', 'b']);
  });

  it('trims a list to one entry in single mode', () => {
    expect(normaliseOpen(['a', 'b'], 'single')).toEqual(['a']);
  });
});
