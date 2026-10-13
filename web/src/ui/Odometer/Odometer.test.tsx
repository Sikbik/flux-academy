import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STRIP_ROWS } from './format';
import { Odometer } from './Odometer';

const CSS = readFileSync(new URL('./Odometer.module.css', import.meta.url), 'utf8');

interface DigitCell {
  /** The strip's resting offset in em (negative: the strip is pulled up). */
  offset: number;
  /** The digits of the one-line rows, in order (empty when the strip is a single text node). */
  rows: string;
  /** The single text node of a plain strip (empty when the strip is made of rows). */
  text: string;
}

/** The digit cells in the markup, in reading order. Separators and affixes have no strip. */
function digitCells(html: string): DigitCell[] {
  return html
    .split('data-piece=""')
    .slice(1)
    .filter((segment) => segment.includes('translateY('))
    .map((segment) => ({
      offset: Number(/translateY\((-?\d+)em\)/.exec(segment)?.[1]),
      rows: [...segment.matchAll(/<span class="[^"]*">(\d)<\/span>/g)].map((m) => m[1]).join(''),
      text: /translateY\(-?\d+em\)">([\d\n]+)</.exec(segment)?.[1] ?? '',
    }));
}

const THREE_TURNS = '012345678901234567890123456789';

describe('Odometer markup', () => {
  it('keeps one strip of thirty digits in a single text node by default', () => {
    const cells = digitCells(renderToStaticMarkup(<Odometer value={7068} />));
    expect(cells).toHaveLength(4);
    for (const c of cells) {
      expect(c.rows).toBe('');
      expect(c.text.split('\n')).toHaveLength(STRIP_ROWS);
      expect(c.text.replace(/\n/g, '')).toBe(THREE_TURNS);
    }
  });

  it('rests each strip on the middle repeat of its digit', () => {
    const cells = digitCells(renderToStaticMarkup(<Odometer value={7068} />));
    expect(cells.map((c) => c.offset)).toEqual([-17, -10, -16, -18]);
  });

  it('splits a gradient number into one-line rows, thirty per digit', () => {
    const cells = digitCells(renderToStaticMarkup(<Odometer value={7068} gradient />));
    expect(cells).toHaveLength(4);
    for (const c of cells) {
      expect(c.text).toBe('');
      expect(c.rows).toBe(THREE_TURNS);
    }
    expect(cells.map((c) => c.offset)).toEqual([-17, -10, -16, -18]);
  });

  it('keeps the spoken value as plain text', () => {
    const html = renderToStaticMarkup(<Odometer value={7068} gradient />);
    expect(html).toContain('<span class="sr-only">7,068</span>');
  });
});

describe('Odometer stylesheet', () => {
  /**
   * The text clip behind the gradient count must sit on the one-line row (or on a piece with no digit
   * strip below it). On the strip, Firefox drops glyphs far down the 30-line box; on the cell, the strip
   * is a transformed descendant and Chromium paints the clip without the transform, so every digit
   * read as "0". Neither failure shows in a node test, so the selector is pinned here.
   */
  it('clips the gradient to the row, never to the cell or the strip', () => {
    const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const clipped = [...css.matchAll(/([^{}]+)\{[^{}]*background-clip:\s*text[^{}]*\}/g)].map((m) =>
      (m[1] as string).trim(),
    );
    expect(clipped.length).toBeGreaterThan(0);
    for (const selector of clipped) {
      expect(selector).not.toMatch(/\.(cell|strip|cells|visual)\b/);
      expect(selector).toMatch(/\.row\b/);
    }
  });
});
