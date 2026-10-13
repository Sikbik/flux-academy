/**
 * Reduced motion, resolved in one place. The effective value is the visitor's explicit choice when they
 * made one, otherwise the OS preference. It is mirrored to `html[data-motion="reduced|full"]`, which the
 * design system's CSS and hooks read, and to the scene bus, so CSS, JS and WebGL never disagree.
 */

import { useSyncExternalStore } from 'react';
import { type MotionPref, usePrefs } from './prefs';

const QUERY = '(prefers-reduced-motion: reduce)';

export function osPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/** Pure: the effective value for a preference and the OS setting. */
export function resolveReducedMotion(pref: MotionPref, os: boolean): boolean {
  if (pref === 'reduced') return true;
  if (pref === 'full') return false;
  return os;
}

export function effectiveReducedMotion(): boolean {
  return resolveReducedMotion(usePrefs.getState().motion, osPrefersReducedMotion());
}

/** Subscribes to either source changing. Returns the unsubscribe function. */
export function subscribeReducedMotion(listener: () => void): () => void {
  const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null;
  mq?.addEventListener('change', listener);
  let last = usePrefs.getState().motion;
  const unsub = usePrefs.subscribe((s) => {
    if (s.motion !== last) {
      last = s.motion;
      listener();
    }
  });
  return () => {
    mq?.removeEventListener('change', listener);
    unsub();
  };
}

/** React hook: true when motion should be calm. */
export function useReducedMotionPref(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, effectiveReducedMotion, () => false);
}
