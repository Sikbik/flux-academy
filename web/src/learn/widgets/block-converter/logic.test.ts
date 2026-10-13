import { describe, expect, it } from 'vitest';
import {
  answerText,
  barPosition,
  type ConverterCase,
  constants,
  discountBands,
  discountFor,
  expiryFor,
  formatField,
  fromBlocks,
  gradeAnswer,
  parseNumber,
  questionFor,
  readConfig,
  SAMPLE_START_HEIGHT,
  toBlocks,
} from './logic';

const MONTHS: ConverterCase = { kind: 'months-to-blocks', value: 6 };
const DAYS: ConverterCase = { kind: 'blocks-to-days', value: 88_000 };
const EXPIRY: ConverterCase = { kind: 'expiry-height', value: 264_000, startHeight: 3_030_000 };

describe('readConfig', () => {
  it('reads the three kinds the lessons use', () => {
    expect(readConfig({ case: { kind: 'months-to-blocks', value: 6 } }).case).toEqual(MONTHS);
    expect(readConfig({ case: EXPIRY }).case).toEqual(EXPIRY);
    expect(readConfig({ case: DAYS }).case).toEqual(DAYS);
  });

  it('supplies a registration height for an expiry case that has none', () => {
    const c = readConfig({ case: { kind: 'expiry-height', value: 88_000 } }).case;
    expect(c?.startHeight).toBe(SAMPLE_START_HEIGHT);
  });

  it('ignores a malformed case and falls back to the target, then to free use', () => {
    expect(readConfig({ case: { kind: 'nope', value: 3 } }).case).toBeNull();
    expect(readConfig({ case: { kind: 'months-to-blocks', value: -1 } }).case).toBeNull();
    expect(readConfig({ target: 264_000 })).toEqual({ case: null, target: 264_000 });
    expect(readConfig(undefined)).toEqual({ case: null, target: null });
    // a case wins over a target
    expect(readConfig({ case: MONTHS, target: 5 }).target).toBeNull();
  });
});

describe('units', () => {
  it('uses a 88,000 block pricing month and 2,880 blocks a day', () => {
    expect(toBlocks('months', 1)).toBe(88_000);
    expect(toBlocks('months', 6)).toBe(528_000);
    expect(toBlocks('days', 1)).toBe(2_880);
    expect(toBlocks('hours', 1)).toBe(120);
    expect(toBlocks('blocks', 1_000.4)).toBe(1_000);
  });

  it('converts back', () => {
    expect(fromBlocks('months', 264_000)).toBe(3);
    expect(fromBlocks('days', 2_880)).toBe(1);
    expect(fromBlocks('hours', 120)).toBe(1);
    expect(fromBlocks('days', 88_000)).toBeCloseTo(30.5556, 3);
  });

  it('never goes negative or non finite', () => {
    expect(toBlocks('months', -3)).toBe(0);
    expect(toBlocks('days', Number.NaN)).toBe(0);
  });

  it('formats with grouping and few decimals', () => {
    expect(formatField('blocks', 528_000)).toBe('528,000');
    expect(formatField('months', 6)).toBe('6');
    expect(formatField('days', 30.5555)).toBe('30.56');
    expect(formatField('hours', 733.333)).toBe('733.3');
  });

  it('reads what a learner types', () => {
    expect(parseNumber('528,000')).toBe(528_000);
    expect(parseNumber(' 3 294 000 ')).toBe(3_294_000);
    expect(parseNumber('30.6')).toBe(30.6);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('six')).toBeNull();
    expect(parseNumber('1e5')).toBeNull();
    expect(parseNumber('-4')).toBeNull();
  });
});

describe('constants and discounts', () => {
  it('states the constants of FACTS 5.1 and 5.3', () => {
    const text = constants()
      .map((c) => `${c.label}: ${c.value}`)
      .join('\n');
    expect(text).toContain('about 30 seconds');
    expect(text).toContain('2,880 blocks');
    expect(text).toContain('88,000 blocks');
    expect(text).toContain('1,056,000 blocks, 12 months');
  });

  it('bands the longest subscription by discount', () => {
    expect(discountBands()).toEqual([
      { fromMonths: 0, toMonths: 3, label: 'none' },
      { fromMonths: 3, toMonths: 6, label: '3 percent' },
      { fromMonths: 6, toMonths: 9, label: '6 percent' },
      { fromMonths: 9, toMonths: 12, label: '12 percent' },
    ]);
  });

  it('finds the discount of a length', () => {
    expect(discountFor(toBlocks('months', 1))).toBeNull();
    expect(discountFor(toBlocks('months', 3))).toBe('3 percent');
    expect(discountFor(toBlocks('months', 6))).toBe('6 percent');
    expect(discountFor(toBlocks('months', 9))).toBe('12 percent');
    expect(discountFor(toBlocks('months', 12))).toBe('12 percent');
  });

  it('places a length on the bar', () => {
    expect(barPosition(0)).toBe(0);
    expect(barPosition(528_000)).toBe(0.5);
    expect(barPosition(10_000_000)).toBe(1);
  });
});

describe('cases', () => {
  it('asks the question and knows the answer', () => {
    expect(questionFor(MONTHS)).toMatchObject({ answer: 528_000, unit: 'blocks' });
    expect(questionFor(MONTHS).prompt).toBe('Convert 6 months into blocks.');
    expect(questionFor({ kind: 'months-to-blocks', value: 1 }).prompt).toBe('Convert 1 month into blocks.');
    expect(questionFor(DAYS).answer).toBeCloseTo(30.5556, 3);
    expect(questionFor(EXPIRY).answer).toBe(3_294_000);
    expect(questionFor(EXPIRY).prompt).toContain('3,030,000');
    expect(questionFor(EXPIRY).prompt).toContain('264,000');
  });

  it('accepts the right answer in any common spelling', () => {
    expect(gradeAnswer(MONTHS, '528000').ok).toBe(true);
    expect(gradeAnswer(MONTHS, '528,000').ok).toBe(true);
    expect(gradeAnswer(EXPIRY, '3,294,000').ok).toBe(true);
    expect(gradeAnswer(DAYS, '30.6').ok).toBe(true);
    expect(gradeAnswer(DAYS, '30.56').ok).toBe(true);
    expect(gradeAnswer(DAYS, '30.5').ok).toBe(true);
  });

  it('rejects near misses with a hint that does not give the answer away', () => {
    const calendar = gradeAnswer(MONTHS, String(6 * 30 * 2880));
    expect(calendar.ok).toBe(false);
    expect(calendar.hint).toMatch(/calendar/);
    expect(calendar.hint).not.toContain('528');

    expect(gradeAnswer(MONTHS, '6').hint).toMatch(/number of months/);
    expect(gradeAnswer(EXPIRY, '264000').hint).toMatch(/length/);
    expect(gradeAnswer(EXPIRY, '3030000').hint).toMatch(/starts/);
    expect(gradeAnswer(DAYS, '733.3').hint).toMatch(/hours/);
    expect(gradeAnswer(DAYS, '30').ok).toBe(false);
    expect(gradeAnswer(MONTHS, 'abc')).toMatchObject({ ok: false, value: null });
  });

  it('types the answer for "Show me"', () => {
    expect(answerText(MONTHS)).toBe('528000');
    expect(answerText(DAYS)).toBe('30.6');
    expect(answerText(EXPIRY)).toBe('3294000');
    for (const c of [MONTHS, DAYS, EXPIRY]) expect(gradeAnswer(c, answerText(c)).ok).toBe(true);
  });
});

describe('expiryFor', () => {
  it('adds the length to the start and counts the way from the tip', () => {
    const e = expiryFor(3_030_000, 264_000, 3_031_000);
    expect(e.height).toBe(3_294_000);
    expect(e.fromNow).toBe(263_000);
    expect(e.past).toBe(false);
    expect(e.inWords).toBe('91 days 7 hours');
  });

  it('says so when the end is behind the tip, and when the tip is unknown', () => {
    expect(expiryFor(100, 50, 200)).toMatchObject({ height: 150, past: true, inWords: null });
    expect(expiryFor(100, 50, null)).toMatchObject({ height: 150, fromNow: null, past: false });
  });
});
