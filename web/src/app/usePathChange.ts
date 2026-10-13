import { useEffect, useRef } from 'react';

/**
 * Runs `callback` when `pathname` changes, never for the value the component mounted with.
 *
 * It remembers the last pathname instead of a "first render" flag on purpose: StrictMode runs every
 * effect twice on mount in development, and a flag flips on the first pass so the second pass would
 * look like a navigation (stealing focus to the heading on a fresh load, which skips the skip link).
 * The callback may return a cleanup, which runs before the next change or on unmount.
 */
export function usePathChange(pathname: string, callback: () => undefined | (() => void)): void {
  const last = useRef<string | null>(null);
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(() => {
    if (last.current === pathname) return undefined;
    const initial = last.current === null;
    last.current = pathname;
    if (initial) return undefined;
    return latest.current();
  }, [pathname]);
}
