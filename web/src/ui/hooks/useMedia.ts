import { useSyncExternalStore } from 'react';

/** Subscribes to a media query. `fallback` is used where there is no window. */
export function useMedia(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

/** True when the primary pointer can hover and is precise (mouse, trackpad, pen). */
export function usePointerFine(): boolean {
  return useMedia('(hover: hover) and (pointer: fine)');
}

/** Viewport at or above the desktop breakpoint (1100 px). */
export function useIsDesktop(): boolean {
  return useMedia('(min-width: 1100px)', true);
}

/** Viewport narrower than the phone breakpoint (720 px). */
export function useIsPhone(): boolean {
  return useMedia('(max-width: 719.98px)');
}
