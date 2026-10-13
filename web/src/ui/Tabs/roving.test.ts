import { describe, expect, it } from 'vitest';
import { firstEnabled, keyToMove, lastEnabled, nextEnabled, rovingTarget } from './roving';

const items = [{}, { disabled: true }, {}, {}, { disabled: true }];

describe('firstEnabled / lastEnabled', () => {
  it('skips disabled items at both ends', () => {
    expect(firstEnabled(items)).toBe(0);
    expect(lastEnabled(items)).toBe(3);
    expect(firstEnabled([{ disabled: true }, {}])).toBe(1);
    expect(lastEnabled([{}, { disabled: true }])).toBe(0);
  });

  it('returns -1 when nothing is enabled', () => {
    expect(firstEnabled([{ disabled: true }])).toBe(-1);
    expect(lastEnabled([])).toBe(-1);
  });
});

describe('nextEnabled', () => {
  it('steps over disabled items', () => {
    expect(nextEnabled(items, 0, 1)).toBe(2);
    expect(nextEnabled(items, 2, 1)).toBe(3);
    expect(nextEnabled(items, 3, -1)).toBe(2);
    expect(nextEnabled(items, 2, -1)).toBe(0);
  });

  it('wraps by default', () => {
    expect(nextEnabled(items, 3, 1)).toBe(0);
    expect(nextEnabled(items, 0, -1)).toBe(3);
  });

  it('stays on the edge without wrap', () => {
    expect(nextEnabled(items, 3, 1, false)).toBe(3);
    expect(nextEnabled(items, 0, -1, false)).toBe(0);
  });

  it('starts from the ends when nothing is current', () => {
    expect(nextEnabled(items, -1, 1)).toBe(0);
    expect(nextEnabled(items, -1, -1)).toBe(3);
  });

  it('is -1 when every item is disabled or the list is empty', () => {
    expect(nextEnabled([{ disabled: true }, { disabled: true }], 0, 1)).toBe(-1);
    expect(nextEnabled([], 0, 1)).toBe(-1);
  });
});

describe('keyToMove', () => {
  it('maps arrows by orientation', () => {
    expect(keyToMove('ArrowRight', 'horizontal')).toBe('next');
    expect(keyToMove('ArrowLeft', 'horizontal')).toBe('prev');
    expect(keyToMove('ArrowDown', 'horizontal')).toBeNull();
    expect(keyToMove('ArrowDown', 'vertical')).toBe('next');
    expect(keyToMove('ArrowUp', 'vertical')).toBe('prev');
    expect(keyToMove('ArrowRight', 'vertical')).toBeNull();
    expect(keyToMove('ArrowDown', 'both')).toBe('next');
    expect(keyToMove('ArrowLeft', 'both')).toBe('prev');
  });

  it('flips horizontal arrows in rtl', () => {
    expect(keyToMove('ArrowRight', 'horizontal', true)).toBe('prev');
    expect(keyToMove('ArrowLeft', 'horizontal', true)).toBe('next');
    expect(keyToMove('ArrowDown', 'vertical', true)).toBe('next');
  });

  it('handles Home and End and ignores other keys', () => {
    expect(keyToMove('Home')).toBe('first');
    expect(keyToMove('End')).toBe('last');
    expect(keyToMove('a')).toBeNull();
    expect(keyToMove('Tab')).toBeNull();
  });
});

describe('rovingTarget', () => {
  it('returns the destination index', () => {
    expect(rovingTarget(items, 0, 'ArrowRight')).toBe(2);
    expect(rovingTarget(items, 3, 'ArrowRight')).toBe(0);
    expect(rovingTarget(items, 2, 'Home')).toBe(0);
    expect(rovingTarget(items, 0, 'End')).toBe(3);
  });

  it('returns null for keys it does not own', () => {
    expect(rovingTarget(items, 0, 'Enter')).toBeNull();
    expect(rovingTarget(items, 0, 'ArrowDown')).toBeNull();
  });

  it('returns null when nothing is enabled', () => {
    expect(rovingTarget([{ disabled: true }], 0, 'Home')).toBeNull();
  });
});
