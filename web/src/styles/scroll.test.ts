/**
 * Pins the touch scrolling rule of DESIGN section 4.
 *
 * `overscroll-behavior: contain` keeps a wheel or a trackpad inside a scroll region. On a touch screen the same
 * declaration swallows every swipe that starts on the region, even when the region cannot scroll: a form, a
 * diagram or a log is as tall as its content on a phone, covers most of the page, and leaves only its edges
 * for scrolling. So a region that sits in the page may contain the overscroll only for a fine pointer
 * (`@media (hover: hover) and (pointer: fine)`), and a swipe hands over to the page.
 *
 * What stays unconditional is listed below with the reason. A new entry belongs here only if a swipe on the
 * thing is meant to stay on it: something laid over the page, not something in it. Horizontal containment
 * (`overscroll-behavior-x`) does not touch vertical swipes and is not checked.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Files where `contain` may stay unconditional, and why. */
const OVERLAYS: Record<string, string> = {
  'palette/Deck.module.css': 'the command palette is a dialog over the page',
  'ui/internal/ModalShell.module.css': 'dialogs and sheets lock the page behind them',
  'routes/reference/frame.module.css': 'the topic menu on a phone drops over the page',
  'labs/explorer/SearchBox.module.css': 'the suggestion list is a popover over the page',
};

const FINE_POINTER = /@media[^{]*\(\s*hover\s*:\s*hover\s*\)[^{]*\(\s*pointer\s*:\s*fine\s*\)/;

function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...cssFiles(path));
    else if (entry.name.endsWith('.css')) out.push(path);
  }
  return out;
}

/** The preludes (selectors and at-rules) of every block that is open at `at`, outermost first. */
function openBlocks(css: string, at: number): string[] {
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < at; i++) {
    const c = css[i];
    if (c === '{') {
      stack.push(css.slice(start, i).trim());
      start = i + 1;
    } else if (c === '}') {
      stack.pop();
      start = i + 1;
    } else if (c === ';') {
      start = i + 1;
    }
  }
  return stack;
}

interface Contain {
  file: string;
  line: number;
  selector: string;
  fine: boolean;
}

/** Every declaration that contains the vertical overscroll (the shorthand does both axes). */
function containDeclarations(): Contain[] {
  const found: Contain[] = [];
  for (const path of cssFiles(SRC)) {
    const raw = readFileSync(path, 'utf8');
    // Blank the comments out, keeping every offset, so a comment cannot hide or fake a declaration.
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    for (const m of css.matchAll(/overscroll-behavior(?:-y|-block)?\s*:\s*contain\b/g)) {
      const blocks = openBlocks(css, m.index);
      found.push({
        file: relative(SRC, path).split('\\').join('/'),
        line: css.slice(0, m.index).split('\n').length,
        selector: blocks.at(-1) ?? '(top level)',
        fine: blocks.some((b) => FINE_POINTER.test(b)),
      });
    }
  }
  return found;
}

describe('touch scrolling (DESIGN section 4)', () => {
  const all = containDeclarations();

  it('finds the declarations it is meant to check', () => {
    // If this fails the parser broke, not the CSS: the app has many scroll regions.
    expect(all.length).toBeGreaterThan(8);
    expect(all.some((d) => d.fine)).toBe(true);
  });

  it('contains the overscroll of an in-page scroll region only for a fine pointer', () => {
    const bad = all.filter((d) => !d.fine && !(d.file in OVERLAYS));
    expect(
      bad.map((d) => `${d.file}:${d.line} ${d.selector}`),
      'put the declaration inside @media (hover: hover) and (pointer: fine), or list the file in OVERLAYS if it is laid over the page',
    ).toEqual([]);
  });

  it('keeps the overlay list honest', () => {
    for (const file of Object.keys(OVERLAYS)) {
      const own = all.filter((d) => d.file === file);
      expect(own.length, `${file} no longer contains an overscroll; remove it from OVERLAYS`).toBeGreaterThan(
        0,
      );
      expect(
        own.some((d) => !d.fine),
        `${file} only contains for a fine pointer now; remove it from OVERLAYS`,
      ).toBe(true);
    }
  });
});
