/**
 * Scroll-overflow helpers for a horizontally scrolling tab list. Pure: the DOM numbers are
 * passed in. Coordinates are physical (left to right); RTL scrollers report a scrollLeft
 * that is zero at the right edge and negative toward the left, which `rtl` converts.
 */

export interface OverflowEdges {
  /** There is content hidden past the physical left edge. */
  left: boolean;
  /** There is content hidden past the physical right edge. */
  right: boolean;
}

export function overflowEdges(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
  rtl = false,
  tolerance = 1,
): OverflowEdges {
  if (scrollWidth <= clientWidth + tolerance) return { left: false, right: false };
  const fromLeft = rtl ? scrollLeft + (scrollWidth - clientWidth) : scrollLeft;
  return {
    left: fromLeft > tolerance,
    right: fromLeft + clientWidth < scrollWidth - tolerance,
  };
}

/**
 * The scrollLeft (distance from the physical left edge) that centres an item in the viewport,
 * clamped to the scrollable range.
 */
export function centerScrollLeft(
  itemLeft: number,
  itemWidth: number,
  viewportWidth: number,
  contentWidth: number,
): number {
  const max = Math.max(0, contentWidth - viewportWidth);
  const target = itemLeft + itemWidth / 2 - viewportWidth / 2;
  return Math.min(max, Math.max(0, target));
}

/** Converts a distance from the physical left edge into the browser's scrollLeft. */
export function toScrollLeft(
  fromLeft: number,
  clientWidth: number,
  scrollWidth: number,
  rtl: boolean,
): number {
  return rtl ? fromLeft - (scrollWidth - clientWidth) : fromLeft;
}
