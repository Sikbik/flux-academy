/**
 * A page that is still loading holds the footer back.
 *
 * Without this the footer is drawn under a half-built page (a skeleton, a lab's loading panel) and then
 * jumps below the fold when the real content arrives: the biggest layout shift on a cold load. A page
 * or a lab calls `useHoldFooter()` while it shows a placeholder; the shell leaves the footer out until no
 * one is holding it. The footer then appears in the same frame as the content, under it, so nothing
 * moves.
 *
 *   function Loading() {
 *     useHoldFooter();
 *     return <div className={styles.skeleton} />;
 *   }
 */

import { useLayoutEffect } from 'react';
import { create } from 'zustand';

const useHolds = create<{ count: number }>(() => ({ count: 0 }));

/** Hold the footer back while this component is mounted (and `active` is true). */
export function useHoldFooter(active = true): void {
  useLayoutEffect(() => {
    if (!active) return undefined;
    useHolds.setState((s) => ({ count: s.count + 1 }));
    return () => useHolds.setState((s) => ({ count: Math.max(0, s.count - 1) }));
  }, [active]);
}

/** True while anything is holding the footer. */
export function useFooterHeld(): boolean {
  return useHolds((s) => s.count > 0);
}
