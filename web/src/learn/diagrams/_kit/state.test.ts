import { describe, expect, it } from 'vitest';
import { nameList, num, numberRecord, str } from './props';
import { clampBeat, isValidBeat, makeSt, stateAt } from './state';

describe('stateAt', () => {
  it('is off before it appears, focus on its beat, on after', () => {
    expect(stateAt(0, 1)).toBe('off');
    expect(stateAt(1, 1)).toBe('focus');
    expect(stateAt(2, 1)).toBe('on');
  });

  it('takes a focus beat, a list of beats or a predicate', () => {
    expect(stateAt(3, 1, 3)).toBe('focus');
    expect(stateAt(2, 1, 3)).toBe('on');
    expect(stateAt(4, 0, [1, 4])).toBe('focus');
    expect(stateAt(2, 0, [1, 4])).toBe('on');
    expect(stateAt(5, 0, (b) => b > 3)).toBe('focus');
    // an empty list is "never the focus"
    expect(stateAt(0, 0, [])).toBe('on');
  });

  it('hides a thing again from `until`', () => {
    expect(stateAt(2, 1, undefined, 3)).toBe('on');
    expect(stateAt(3, 1, undefined, 3)).toBe('off');
    expect(stateAt(9, 1, undefined, 3)).toBe('off');
  });

  it('is a pure function of the beat', () => {
    const st = makeSt(2);
    expect(st(0)).toBe('on');
    expect(st(2)).toBe('focus');
    expect(st(3)).toBe('off');
    expect(makeSt(2)(2)).toBe(st(2));
  });
});

describe('beats', () => {
  it('clamps anything to a legal index', () => {
    expect(clampBeat(2, 5)).toBe(2);
    expect(clampBeat(99, 5)).toBe(4);
    expect(clampBeat(-3, 5)).toBe(0);
    expect(clampBeat(Number.NaN, 5)).toBe(0);
    expect(clampBeat('3', 5)).toBe(0);
    expect(clampBeat(undefined, 5)).toBe(0);
    expect(clampBeat(2.6, 5)).toBe(3);
    expect(clampBeat(1, 0)).toBe(0);
  });

  it('says whether a beat is legal', () => {
    expect(isValidBeat(0, 4)).toBe(true);
    expect(isValidBeat(3, 4)).toBe(true);
    expect(isValidBeat(4, 4)).toBe(false);
    expect(isValidBeat(-1, 4)).toBe(false);
    expect(isValidBeat(1.5, 4)).toBe(false);
    expect(isValidBeat('1', 4)).toBe(false);
  });
});

describe('prop readers', () => {
  it('reads numbers within bounds and falls back on anything else', () => {
    expect(num(5, 1)).toBe(5);
    expect(num('5', 1)).toBe(1);
    expect(num(Number.NaN, 1)).toBe(1);
    expect(num(Number.POSITIVE_INFINITY, 1)).toBe(1);
    expect(num(50, 1, 0, 10)).toBe(10);
    expect(num(-5, 1, 0, 10)).toBe(0);
  });

  it('reads trimmed, capped strings', () => {
    expect(str('  hello  ', 'x')).toBe('hello');
    expect(str('', 'x')).toBe('x');
    expect(str('   ', 'x')).toBe('x');
    expect(str(7, 'x')).toBe('x');
    expect(str('abcdefghij', 'x', 4)).toBe('abcd');
  });

  it('reads a record of numbers key by key', () => {
    const fallback = { a: 1, b: 2, c: 3 };
    expect(numberRecord({ a: 10, b: 'no', c: -4 }, ['a', 'b', 'c'], fallback)).toEqual({ a: 10, b: 2, c: 3 });
    expect(numberRecord(null, ['a', 'b', 'c'], fallback)).toEqual(fallback);
    expect(numberRecord([1, 2], ['a', 'b', 'c'], fallback)).toEqual(fallback);
  });

  it('reads component names as letters and digits', () => {
    expect(nameList(['web', 'api'], ['x'])).toEqual(['web', 'api']);
    expect(nameList([{ name: 'my-db' }, 'c@che'], ['x'])).toEqual(['mydb', 'cche']);
    expect(nameList('nope', ['x'])).toEqual(['x']);
    expect(nameList([], ['x'])).toEqual(['x']);
    expect(nameList(['a', 'b', 'c', 'd'], ['x'], 2)).toEqual(['a', 'b']);
  });
});
