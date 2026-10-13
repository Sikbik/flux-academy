/**
 * Where everything goes on the certificate canvas. Pure numbers, so the safe zone can be tested.
 *
 * The canvas is 1500 x 1000 logical pixels (the size of `certificate-backdrop`). The backdrop's clear
 * panel is about x 0.07 to 0.93, y 0.17 to 0.84; every line of text stays inside the safe zone
 * x 0.12 to 0.88, y 0.22 to 0.80 (public/art/README.md).
 */

export const CERT_WIDTH = 1500;
export const CERT_HEIGHT = 1000;

/** The safe zone, as fractions of the canvas. */
export const SAFE_ZONE = { left: 0.12, right: 0.88, top: 0.22, bottom: 0.8 } as const;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The safe zone in canvas pixels. */
export function safeRect(width = CERT_WIDTH, height = CERT_HEIGHT): Rect {
  return {
    x: width * SAFE_ZONE.left,
    y: height * SAFE_ZONE.top,
    width: width * (SAFE_ZONE.right - SAFE_ZONE.left),
    height: height * (SAFE_ZONE.bottom - SAFE_ZONE.top),
  };
}

/** The lockup's width over its height (flux-logo-blue-white.svg: 1079.738 x 335.661). */
export const LOCKUP_ASPECT = 1079.738 / 335.661;

/**
 * The rows, in canvas pixels. `*Y` values are text baselines unless noted. Sizes are font sizes.
 * Rows read top to bottom and all sit inside the safe zone (a test checks it).
 */
export const ROWS = {
  /** Top of the lockup. */
  lockupTop: 238,
  lockupHeight: 62,
  /** Hairline with a hex at its centre, between the lockup and the title. */
  ruleY: 336,
  eyebrowY: 384,
  eyebrowSize: 21,
  nameY: 494,
  nameSize: 84,
  nameMinSize: 44,
  sentenceY: 552,
  sentenceSize: 29,
  rankY: 628,
  rankSize: 46,
  factsY: 686,
  factsSize: 24,
  disclaimerY: 752,
  disclaimerSize: 22,
  detailY: 782,
  detailSize: 19,
} as const;

/** The widest a text row may be: the safe zone's width, less a little air. */
export const MAX_TEXT_WIDTH = safeRect().width - 40;

/**
 * The largest font size, between `min` and `start`, at which `text` fits in `maxWidth`. `measure` returns
 * the width of the text at a size (the canvas's `measureText` in the renderer, a stub in tests). Text that
 * does not fit even at `min` is left to the caller to truncate.
 */
export function fitSize(
  measure: (size: number) => number,
  maxWidth: number,
  start: number,
  min: number,
): { size: number; fits: boolean } {
  const natural = measure(start);
  if (natural <= maxWidth) return { size: start, fits: true };
  // Width is linear in size for one face, so one proportional step lands close; the loop settles the rest.
  let size = Math.max(min, Math.floor(start * (maxWidth / natural)));
  while (size > min && measure(size) > maxWidth) size -= 1;
  return { size, fits: measure(size) <= maxWidth };
}

/** Shortens `text` with an ellipsis until `measure(text)` fits. Works on code points, not UTF-16 units. */
export function ellipsize(text: string, measure: (t: string) => number, maxWidth: number): string {
  if (measure(text) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length > 1) {
    chars.pop();
    const candidate = `${chars.join('').trimEnd()}…`;
    if (measure(candidate) <= maxWidth) return candidate;
  }
  return '…';
}
