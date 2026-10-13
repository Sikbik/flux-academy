import { describe, expect, it } from 'vitest';
import { cellTones, effectiveThresholds, resolveTone, toneWord } from './tone';

describe('resolveTone', () => {
  const base = { min: 0, max: 100, tone: 'auto' as const, thresholds: { warn: 70, crit: 90 } };

  it('returns fixed tones untouched', () => {
    expect(resolveTone({ value: 99, min: 0, max: 100, tone: 'ok' })).toBe('ok');
    expect(resolveTone({ value: 1, min: 0, max: 100 })).toBe('accent');
  });

  it('follows thresholds upward', () => {
    expect(resolveTone({ ...base, value: 40 })).toBe('ok');
    expect(resolveTone({ ...base, value: 70 })).toBe('warn');
    expect(resolveTone({ ...base, value: 89.9 })).toBe('warn');
    expect(resolveTone({ ...base, value: 90 })).toBe('crit');
  });

  it('follows thresholds downward when low is bad', () => {
    const low = {
      min: 0,
      max: 100,
      tone: 'auto' as const,
      lowIsBad: true,
      thresholds: { warn: 30, crit: 10 },
    };
    expect(resolveTone({ ...low, value: 80 })).toBe('ok');
    expect(resolveTone({ ...low, value: 30 })).toBe('warn');
    expect(resolveTone({ ...low, value: 10 })).toBe('crit');
  });

  it('defaults thresholds to 70 and 90 percent of the range', () => {
    expect(effectiveThresholds(0, 200)).toEqual({ warn: 140, crit: 180 });
    expect(effectiveThresholds(0, 100, undefined, true)).toEqual({ warn: 30, crit: 10 });
    expect(effectiveThresholds(0, 100, { warn: 50 }).crit).toBe(90);
  });
});

describe('toneWord', () => {
  it('says something for every status tone', () => {
    expect(toneWord('ok')).toBe('Normal');
    expect(toneWord('warn')).toBe('High');
    expect(toneWord('crit')).toBe('Critical');
    expect(toneWord('accent')).toBe('');
  });

  it('says Low rather than High when low is the problem', () => {
    expect(toneWord('warn', true)).toBe('Low');
    expect(toneWord('crit', true)).toBe('Critical');
    expect(toneWord('ok', true)).toBe('Normal');
  });
});

describe('cellTones', () => {
  it('paints the scale in bands', () => {
    const t = cellTones(10, { min: 0, max: 100, tone: 'auto', thresholds: { warn: 70, crit: 90 } });
    expect(t).toHaveLength(10);
    expect(t.slice(0, 6)).toEqual(Array(6).fill('ok'));
    expect(t[6]).toBe('warn'); // upper edge 70
    expect(t[7]).toBe('warn');
    expect(t[8]).toBe('crit'); // upper edge 90
    expect(t[9]).toBe('crit');
  });

  it('paints the bands from the left when low is bad', () => {
    const t = cellTones(10, {
      min: 0,
      max: 100,
      tone: 'auto',
      lowIsBad: true,
      thresholds: { warn: 30, crit: 10 },
    });
    expect(t.slice(0, 2)).toEqual(['crit', 'crit']); // lower edges 0 and 10
    expect(t.slice(2, 4)).toEqual(['warn', 'warn']); // lower edges 20 and 30
    expect(t.slice(4)).toEqual(Array(6).fill('ok'));
  });

  it('keeps one colour for a fixed tone', () => {
    expect(new Set(cellTones(5, { min: 0, max: 1, tone: 'accent' }))).toEqual(new Set(['accent']));
  });
});
