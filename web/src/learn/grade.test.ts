import { describe, expect, it } from 'vitest';
import {
  gradeChoice,
  gradeEstimate,
  gradeMatch,
  gradeMulti,
  gradeOrder,
  parseNumberInput,
  shuffledOrder,
} from './grade';
import type { EstimateChallenge, MatchChallenge, MultiChallenge, OrderChallenge } from './types';

const base = { id: 'x', prompt: 'p', explain: 'e' };

describe('choice and multi', () => {
  it('grades a single choice', () => {
    const c = { ...base, kind: 'choice' as const, options: [], answer: 'b' };
    expect(gradeChoice(c, 'b')).toBe(true);
    expect(gradeChoice(c, 'a')).toBe(false);
    expect(gradeChoice(c, null)).toBe(false);
  });

  it('grades a multi and reports what was missed and what was extra', () => {
    const c: MultiChallenge = { ...base, kind: 'multi', options: [], answers: ['a', 'b'] };
    expect(gradeMulti(c, ['b', 'a']).correct).toBe(true);
    expect(gradeMulti(c, ['a', 'c'])).toEqual({ correct: false, missing: ['b'], extra: ['c'] });
    expect(gradeMulti(c, []).missing).toEqual(['a', 'b']);
  });
});

describe('order', () => {
  const c: OrderChallenge = {
    ...base,
    kind: 'order',
    items: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
  };

  it('grades per position', () => {
    expect(gradeOrder(c, ['a', 'b', 'c']).correct).toBe(true);
    expect(gradeOrder(c, ['a', 'c', 'b'])).toEqual({ correct: false, positions: [true, false, false] });
    expect(gradeOrder(c, ['a', 'b']).correct).toBe(false);
  });

  it('shuffles deterministically and never returns the answer', () => {
    for (const seed of ['a', 'b', 'c', 'lesson:order', 'zzz']) {
      const s = shuffledOrder(c, seed);
      expect([...s].sort()).toEqual(['a', 'b', 'c']);
      expect(s).not.toEqual(['a', 'b', 'c']);
      expect(shuffledOrder(c, seed)).toEqual(s);
    }
  });
});

describe('match', () => {
  const c: MatchChallenge = {
    ...base,
    kind: 'match',
    pairs: [
      { id: 'p1', left: 'L1', right: 'R1' },
      { id: 'p2', left: 'L2', right: 'R2' },
    ],
  };

  it('needs every left matched to its own right', () => {
    expect(gradeMatch(c, { p1: 'p1', p2: 'p2' }).correct).toBe(true);
    expect(gradeMatch(c, { p1: 'p2', p2: 'p1' })).toEqual({ correct: false, right: [], wrong: ['p1', 'p2'] });
    expect(gradeMatch(c, { p1: 'p1' })).toMatchObject({ correct: false, right: ['p1'], wrong: ['p2'] });
  });
});

describe('estimate', () => {
  const c: EstimateChallenge = {
    ...base,
    kind: 'estimate',
    quantity: 'number',
    value: 100,
    tolerance: 0.1,
  };

  it('accepts answers within the tolerance and reports the range', () => {
    const near = gradeEstimate(c, 108, 100);
    expect(near.correct).toBe(true);
    expect(near.low).toBe(90);
    expect(near.high).toBe(110);
    expect(gradeEstimate(c, 111, 100).correct).toBe(false);
    expect(gradeEstimate(c, 200, 100).ratio).toBe(2);
    expect(gradeEstimate(c, Number.NaN, 100).correct).toBe(false);
  });

  it('parses what people type', () => {
    expect(parseNumberInput('$1,234.50')).toBe(1234.5);
    expect(parseNumberInput('88 000')).toBe(88000);
    expect(parseNumberInput('0.99 USD')).toBe(0.99);
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('1e3')).toBeNull();
  });
});
