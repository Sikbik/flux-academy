/**
 * Which breadcrumb levels may fold behind the "..." button. The first item (where you came
 * from) and the last two (the parent and the page you are on) always stay; everything in
 * between is collapsible. Fewer than four items never collapse.
 */

export interface CollapseResult {
  /** Indices that may be hidden, in order. Empty when nothing collapses. */
  collapsible: number[];
  /** Indices that are always visible. */
  pinned: number[];
}

export function collapsibleIndices(count: number): number[] {
  if (count < 4) return [];
  const out: number[] = [];
  for (let i = 1; i <= count - 3; i++) out.push(i);
  return out;
}

export function isCollapsible(index: number, count: number): boolean {
  return count >= 4 && index >= 1 && index <= count - 3;
}

/**
 * With `maxItems` set, how many items render before the "..." folds the middle. The first
 * item and the last (maxItems - 2) stay; once expanded everything shows.
 */
export function visibleIndices(
  count: number,
  maxItems: number | undefined,
  expanded: boolean,
): CollapseResult {
  const all = Array.from({ length: count }, (_, i) => i);
  if (expanded || maxItems === undefined || count <= Math.max(3, maxItems)) {
    return { collapsible: collapsibleIndices(count), pinned: all.filter((i) => !isCollapsible(i, count)) };
  }
  const keepTail = Math.max(2, maxItems - 1);
  const hidden = all.filter((i) => i >= 1 && i < count - keepTail);
  return { collapsible: hidden, pinned: all.filter((i) => !hidden.includes(i)) };
}
