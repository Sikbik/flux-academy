import { describe, expect, it } from 'vitest';
import {
  CERT_HEIGHT,
  CERT_WIDTH,
  ellipsize,
  fitSize,
  LOCKUP_ASPECT,
  MAX_TEXT_WIDTH,
  ROWS,
  SAFE_ZONE,
  safeRect,
} from './layout';

describe('safe zone', () => {
  it('is the zone the backdrop documents (x 0.12 to 0.88, y 0.22 to 0.80)', () => {
    expect(SAFE_ZONE).toEqual({ left: 0.12, right: 0.88, top: 0.22, bottom: 0.8 });
    const r = safeRect();
    expect(r.x).toBeCloseTo(180);
    expect(r.y).toBeCloseTo(220);
    expect(r.width).toBeCloseTo(1140);
    expect(r.height).toBeCloseTo(580);
  });

  it('keeps every row of the certificate inside it', () => {
    const r = safeRect();
    const bottom = r.y + r.height;
    // Top of the lockup and the bottom of its box.
    expect(ROWS.lockupTop).toBeGreaterThanOrEqual(r.y);
    expect(ROWS.lockupTop + ROWS.lockupHeight).toBeLessThan(ROWS.ruleY);
    // Baselines (with a descender allowance of a quarter of the size) and the rows' tops (the cap height).
    const rows: [string, number, number][] = [
      ['eyebrow', ROWS.eyebrowY, ROWS.eyebrowSize],
      ['name', ROWS.nameY, ROWS.nameSize],
      ['sentence', ROWS.sentenceY, ROWS.sentenceSize],
      ['rank', ROWS.rankY, ROWS.rankSize],
      ['facts', ROWS.factsY, ROWS.factsSize],
      ['disclaimer', ROWS.disclaimerY, ROWS.disclaimerSize],
      ['detail', ROWS.detailY, ROWS.detailSize],
    ];
    for (const [name, y, size] of rows) {
      expect(y - size * 0.75, `${name} top`).toBeGreaterThanOrEqual(r.y);
      expect(y + size * 0.25, `${name} bottom`).toBeLessThanOrEqual(bottom);
    }
  });

  it('reads top to bottom without rows overlapping', () => {
    const order = [
      ROWS.lockupTop + ROWS.lockupHeight,
      ROWS.ruleY,
      ROWS.eyebrowY,
      ROWS.nameY,
      ROWS.sentenceY,
      ROWS.rankY,
      ROWS.factsY,
      ROWS.disclaimerY,
      ROWS.detailY,
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i] ?? 0).toBeGreaterThan(order[i - 1] ?? 0);
    }
    // The name at its largest does not run into the eyebrow above or the sentence below.
    expect(ROWS.nameY - ROWS.nameSize * 0.75).toBeGreaterThan(ROWS.eyebrowY);
    expect(ROWS.sentenceY - ROWS.sentenceSize * 0.75).toBeGreaterThan(ROWS.nameY);
  });

  it('is a 3:2 plate and the lockup keeps its proportions', () => {
    expect(CERT_WIDTH / CERT_HEIGHT).toBeCloseTo(1.5);
    expect(LOCKUP_ASPECT).toBeCloseTo(3.2168, 3);
    expect(ROWS.lockupHeight * LOCKUP_ASPECT).toBeLessThan(MAX_TEXT_WIDTH);
  });
});

describe('fitSize', () => {
  const per = (charWidth: number, text: string) => (size: number) => text.length * size * charWidth;

  it('keeps the starting size when the text fits', () => {
    expect(fitSize(per(0.5, 'Alex'), 1000, 80, 40)).toEqual({ size: 80, fits: true });
  });

  it('shrinks to the largest size that fits', () => {
    const r = fitSize(per(0.5, 'A'.repeat(40)), 1000, 80, 40);
    // 40 chars at 0.5 em: width = 20 * size, so 50 px is the largest whole size under 1000.
    expect(r).toEqual({ size: 50, fits: true });
  });

  it('stops at the minimum and says it does not fit', () => {
    const r = fitSize(per(0.5, 'A'.repeat(200)), 1000, 80, 44);
    expect(r.size).toBe(44);
    expect(r.fits).toBe(false);
  });
});

describe('ellipsize', () => {
  const measure = (t: string) => Array.from(t).length * 10;

  it('leaves text that fits alone', () => {
    expect(ellipsize('short', measure, 100)).toBe('short');
  });

  it('cuts to fit and ends with an ellipsis', () => {
    const out = ellipsize('a long certificate name indeed', measure, 100);
    expect(measure(out)).toBeLessThanOrEqual(100);
    expect(out.endsWith('…')).toBe(true);
  });

  it('does not split an astral character', () => {
    const out = ellipsize('\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}', measure, 40);
    expect(out).toMatch(/^(\u{1F600})*…$/u);
  });
});
