// Where the 2D scene's picture goes inside its host box, for the page's insets.
//
// The page writes insets as fractions of the viewport-sized stage (the area its own content leaves free).
// The WebGL scene is full bleed and frames the bench in that area with a lens shift. The 2D scene has no
// camera to shift, so it is given a smaller box instead. The host it is mounted in may already BE the free
// area (a page that insets the host element itself) or be the whole stage, so the offsets are computed from
// where the host actually sits: applying them twice is a no-op, not a double inset.

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface InsetFractions {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Each inset is clamped like the WebGL scene clamps it: the page never covers more than 80% of an axis. */
export const MAX_INSET = 0.8;

const clampInset = (n: number): number => (Number.isFinite(n) ? Math.min(MAX_INSET, Math.max(0, n)) : 0);

/**
 * Pixels to inset inside `box` (in viewport coordinates) so the picture lands in the free area described
 * by `insets` (fractions of a `viewportW` by `viewportH` stage). Zero where the box is already inside it.
 */
export function remainingInsets(insets: InsetFractions, box: Box, viewportW: number, viewportH: number): Box {
  const freeLeft = clampInset(insets.left) * viewportW;
  const freeRight = viewportW - clampInset(insets.right) * viewportW;
  const freeTop = clampInset(insets.top) * viewportH;
  const freeBottom = viewportH - clampInset(insets.bottom) * viewportH;
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  let left = Math.max(0, freeLeft - box.left);
  let right = Math.max(0, box.right - freeRight);
  let top = Math.max(0, freeTop - box.top);
  let bottom = Math.max(0, box.bottom - freeBottom);
  // Never collapse the picture: if the free area would leave under a fifth of an axis, ignore that axis.
  if (w - left - right < w * 0.2) {
    left = 0;
    right = 0;
  }
  if (h - top - bottom < h * 0.2) {
    top = 0;
    bottom = 0;
  }
  return {
    left: Math.round(left),
    top: Math.round(top),
    right: Math.round(right),
    bottom: Math.round(bottom),
  };
}
