import { describe, expect, it } from 'vitest';
import {
  applyVerdict,
  clickItem,
  estimateDirection,
  estimateFeedback,
  freshMatch,
  holderOf,
  moveItem,
} from './logic';

describe('moveItem', () => {
  it('moves forward and backward', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });
  it('clamps and does not mutate', () => {
    const src = ['a', 'b'];
    expect(moveItem(src, 0, 9)).toEqual(['b', 'a']);
    expect(moveItem(src, -3, 1)).toEqual(['b', 'a']);
    expect(src).toEqual(['a', 'b']);
    expect(moveItem([], 0, 1)).toEqual([]);
  });
});

describe('match clicks', () => {
  it('pairs one from each column, in either order', () => {
    let s = freshMatch();
    s = clickItem(s, 'left', 'a');
    expect(s.pending).toEqual({ side: 'left', id: 'a' });
    s = clickItem(s, 'right', 'b');
    expect(s.assignment).toEqual({ a: 'b' });
    expect(s.pending).toBeNull();

    s = clickItem(s, 'right', 'c');
    s = clickItem(s, 'left', 'd');
    expect(s.assignment).toEqual({ a: 'b', d: 'c' });
  });

  it('is one to one: taking a right item releases its old holder', () => {
    let s = freshMatch();
    s = clickItem(clickItem(s, 'left', 'a'), 'right', 'x');
    s = clickItem(clickItem(s, 'left', 'b'), 'right', 'x');
    expect(s.assignment).toEqual({ b: 'x' });
    expect(holderOf(s.assignment, 'x')).toBe('b');
  });

  it('re-pairing a left item replaces its partner', () => {
    let s = freshMatch();
    s = clickItem(clickItem(s, 'left', 'a'), 'right', 'x');
    s = clickItem(s, 'left', 'a'); // breaks the pair and picks the item up
    expect(s.assignment).toEqual({});
    expect(s.pending).toEqual({ side: 'left', id: 'a' });
    s = clickItem(s, 'right', 'y');
    expect(s.assignment).toEqual({ a: 'y' });
  });

  it('a second click on the same pending item deselects it', () => {
    let s = clickItem(freshMatch(), 'left', 'a');
    s = clickItem(s, 'left', 'a');
    expect(s.pending).toBeNull();
  });

  it('switches the pending item within a column', () => {
    let s = clickItem(freshMatch(), 'left', 'a');
    s = clickItem(s, 'left', 'b');
    expect(s.pending).toEqual({ side: 'left', id: 'b' });
  });

  it('keeps confirmed pairs and frees the rest after a verdict', () => {
    let s = freshMatch();
    s = clickItem(clickItem(s, 'left', 'a'), 'right', 'a');
    s = clickItem(clickItem(s, 'left', 'b'), 'right', 'c');
    s = clickItem(clickItem(s, 'left', 'c'), 'right', 'b');
    s = applyVerdict(s, { correct: false, right: ['a'], wrong: ['b', 'c'] });
    expect(s.assignment).toEqual({ a: 'a' });
    expect(s.locked).toEqual(['a']);
    // A locked pair cannot be picked up again.
    expect(clickItem(s, 'left', 'a')).toBe(s);
    expect(clickItem(s, 'right', 'a')).toBe(s);
  });
});

describe('estimate feedback', () => {
  const verdict = (ratio: number | null, high = 11, low = 9) => ({
    correct: false,
    truth: 10,
    low,
    high,
    ratio,
  });
  it('names the direction without the number', () => {
    expect(estimateDirection(verdict(1.5), 15)).toBe('high');
    expect(estimateDirection(verdict(0.7), 7)).toBe('low');
    const text = estimateFeedback(verdict(1.5), 15, 0.1);
    expect(text).toContain('little high');
    expect(text).toContain('10 percent');
    expect(text).not.toMatch(/\b10\b(?! percent)/);
  });
  it('says double and half when the miss is large', () => {
    expect(estimateFeedback(verdict(3), 30, 0.2)).toContain('more than double');
    expect(estimateFeedback(verdict(0.2), 2, 0.2)).toContain('less than half');
  });
});
