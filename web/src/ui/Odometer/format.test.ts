import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  MINUS,
  PLACEHOLDER,
  restRow,
  rollDirection,
  STRIP_REST,
  targetRow,
  toCells,
} from './format';

describe('formatNumber', () => {
  it('groups thousands by default', () => {
    expect(formatNumber(7105)).toBe('7,105');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('honours decimals and grouping', () => {
    expect(formatNumber(1234.5, { decimals: 2 })).toBe('1,234.50');
    expect(formatNumber(1234.5, { decimals: 1, grouping: false })).toBe('1234.5');
  });

  it('pads the integer part', () => {
    expect(formatNumber(7, { minDigits: 2 })).toBe('07');
    expect(formatNumber(7, { minDigits: 4, grouping: false })).toBe('0007');
  });

  it('uses a true minus and never prints negative zero', () => {
    expect(formatNumber(-12.5, { decimals: 1 })).toBe(`${MINUS}12.5`);
    expect(formatNumber(-0.0004, { decimals: 2 })).toBe('0.00');
    expect(formatNumber(-0)).toBe('0');
  });

  it('shows a placeholder, not zero, for non-finite input', () => {
    expect(formatNumber(Number.NaN)).toBe(PLACEHOLDER);
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe(PLACEHOLDER);
  });

  it('clamps absurd decimals', () => {
    expect(formatNumber(1, { decimals: 99 }).length).toBeLessThan(20);
    expect(formatNumber(1.234, { decimals: -3 })).toBe('1');
  });
});

describe('toCells', () => {
  it('numbers cells from the right so they keep identity as a number grows', () => {
    const cells = toCells('1,234.5');
    expect(cells.map((c) => c.ch).join('')).toBe('1,234.5');
    expect(cells.map((c) => c.fromRight)).toEqual([6, 5, 4, 3, 2, 1, 0]);
    expect(cells.map((c) => c.digit)).toEqual([1, null, 2, 3, 4, null, 5]);
  });

  it('treats the minus sign as a non-digit', () => {
    expect(toCells(`${MINUS}9`).map((c) => c.digit)).toEqual([null, 9]);
  });
});

describe('rollDirection', () => {
  it('goes up for increases and equal values, down for decreases', () => {
    expect(rollDirection(1, 2)).toBe(1);
    expect(rollDirection(2, 2)).toBe(1);
    expect(rollDirection(5, 4)).toBe(-1);
  });
});

describe('targetRow', () => {
  it('rests in the middle repeat', () => {
    expect(restRow(0)).toBe(STRIP_REST);
    expect(restRow(9)).toBe(STRIP_REST + 9);
  });

  it('rolls up through the neighbours', () => {
    // 3 -> 7 going up: row 13 to row 17
    expect(targetRow(restRow(3), 7, 1)).toBe(17);
  });

  it('wraps upward past 9', () => {
    // 8 -> 2 going up passes 9, 0, 1: row 18 to row 22
    expect(targetRow(restRow(8), 2, 1)).toBe(22);
  });

  it('rolls down through the neighbours', () => {
    // 7 -> 3 going down: row 17 to row 13
    expect(targetRow(restRow(7), 3, -1)).toBe(13);
  });

  it('wraps downward past 0', () => {
    // 2 -> 8 going down passes 1, 0, 9: row 12 to row 8
    expect(targetRow(restRow(2), 8, -1)).toBe(8);
  });

  it('starts from a mid-flight position', () => {
    // interrupted at row 14.4 on its way up to a 6: the nearest 6 above is row 16
    expect(targetRow(14.4, 6, 1)).toBe(16);
    // and heading down to a 1 from 14.4: the nearest 1 below is row 11
    expect(targetRow(14.4, 1, -1)).toBe(11);
  });
});
