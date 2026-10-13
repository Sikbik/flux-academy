import { describe, expect, it } from 'vitest';
import { formatAge } from './age';

describe('formatAge', () => {
  it('formats seconds, minutes, hours and days', () => {
    expect(formatAge(0)).toBe('now');
    expect(formatAge(999)).toBe('now');
    expect(formatAge(3000)).toBe('3 s');
    expect(formatAge(59_999)).toBe('59 s');
    expect(formatAge(120_000)).toBe('2 min');
    expect(formatAge(59 * 60_000)).toBe('59 min');
    expect(formatAge(5 * 3_600_000)).toBe('5 h');
    expect(formatAge(47 * 3_600_000)).toBe('47 h');
    expect(formatAge(72 * 3_600_000)).toBe('3 d');
  });

  it('returns nothing for unknown ages', () => {
    expect(formatAge(null)).toBe('');
    expect(formatAge(undefined)).toBe('');
    expect(formatAge(-5)).toBe('');
    expect(formatAge(Number.NaN)).toBe('');
  });
});
