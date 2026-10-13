/**
 * Fitting emissive medal art into the hex badge. The generated medals are lit hexagons on
 * black with generous margins; `fitArt` scales and positions the square image so its lit
 * content fills the badge. Pure: no DOM.
 */

/** [left, top, right, bottom] of the lit content, as fractions of the square image. */
export type LitBox = readonly [number, number, number, number];

/** The badge is a regular pointy-top hexagon: width = height * sqrt(3) / 2. */
export const HEX_ASPECT = Math.sqrt(3) / 2;

export interface ArtFit {
  /** Image edge as a fraction of the badge height. */
  k: number;
  /** Image left edge as a fraction of the badge height (not of the width). */
  x: number;
  /** Image top edge as a fraction of the badge height. */
  y: number;
}

/**
 * @param box the lit content box in the image
 * @param fill how much of the badge the lit content may take, 0..1 (default 0.94)
 */
export function fitArt(box: LitBox, fill = 0.94): ArtFit {
  const [l, t, r, b] = box;
  const litW = Math.max(r - l, 0.01);
  const litH = Math.max(b - t, 0.01);
  // The badge is HEX_ASPECT wide per unit of height. Let the lit box fill `fill` of whichever
  // dimension is tighter.
  const k = Math.min(fill / litH, (fill * HEX_ASPECT) / litW);
  const cx = (l + r) / 2;
  const cy = (t + b) / 2;
  return { k, x: HEX_ASPECT / 2 - cx * k, y: 0.5 - cy * k };
}
