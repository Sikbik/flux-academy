/**
 * Roving focus math shared by Tabs, SegmentedControl, Accordion and StepRail. Pure: it only
 * sees an array of "is this one disabled" flags and a key, and answers with an index.
 *
 *   rovingTarget(items, current, 'ArrowRight')  // the next enabled index, wrapping
 *   rovingTarget(items, current, 'Home')        // the first enabled index
 *
 * `null` means "this key is not for me" (do not preventDefault) or "nothing is enabled".
 */

export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

export interface RovingItem {
  disabled?: boolean;
}

export type RovingMove = 'next' | 'prev' | 'first' | 'last';

export interface RovingOptions {
  orientation?: RovingOrientation;
  /** Wrap from the last item to the first and back. Default true. */
  wrap?: boolean;
  /** Right-to-left layout: ArrowLeft goes forward. Default false. */
  rtl?: boolean;
}

/** The first enabled index, or -1. */
export function firstEnabled(items: readonly RovingItem[]): number {
  return items.findIndex((i) => !i.disabled);
}

/** The last enabled index, or -1. */
export function lastEnabled(items: readonly RovingItem[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (!items[i]?.disabled) return i;
  return -1;
}

/**
 * The next enabled index from `from` in direction `step`. `from` may be -1 (nothing current).
 * Without wrap it stays on the edge; with every item disabled it returns -1.
 */
export function nextEnabled(items: readonly RovingItem[], from: number, step: 1 | -1, wrap = true): number {
  const n = items.length;
  if (n === 0) return -1;
  if (firstEnabled(items) === -1) return -1;
  let i = from;
  if (i < 0 || i >= n) i = step === 1 ? -1 : n;
  for (let tries = 0; tries < n; tries++) {
    i += step;
    if (i >= n || i < 0) {
      if (!wrap)
        return from >= 0 && from < n && !items[from]?.disabled
          ? from
          : step === 1
            ? lastEnabled(items)
            : firstEnabled(items);
      i = step === 1 ? 0 : n - 1;
    }
    if (!items[i]?.disabled) return i;
  }
  return -1;
}

/** Maps a key to a move for the orientation, or null when the key is not a navigation key. */
export function keyToMove(
  key: string,
  orientation: RovingOrientation = 'horizontal',
  rtl = false,
): RovingMove | null {
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  const horizontal = orientation === 'horizontal' || orientation === 'both';
  const vertical = orientation === 'vertical' || orientation === 'both';
  if (horizontal) {
    if (key === 'ArrowRight') return rtl ? 'prev' : 'next';
    if (key === 'ArrowLeft') return rtl ? 'next' : 'prev';
  }
  if (vertical) {
    if (key === 'ArrowDown') return 'next';
    if (key === 'ArrowUp') return 'prev';
  }
  return null;
}

/** The index a key should move to, or null if the key is not handled or nothing is enabled. */
export function rovingTarget(
  items: readonly RovingItem[],
  current: number,
  key: string,
  { orientation = 'horizontal', wrap = true, rtl = false }: RovingOptions = {},
): number | null {
  const move = keyToMove(key, orientation, rtl);
  if (!move) return null;
  let target: number;
  if (move === 'first') target = firstEnabled(items);
  else if (move === 'last') target = lastEnabled(items);
  else target = nextEnabled(items, current, move === 'next' ? 1 : -1, wrap);
  return target < 0 ? null : target;
}
