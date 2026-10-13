import { useSyncExternalStore } from 'react';
import { readReducedMotion, subscribeReducedMotion } from '../internal/motion';

/**
 * True when motion should be calm: the visitor's explicit choice when the shell mirrors it to
 * `html[data-motion]`, otherwise the OS `prefers-reduced-motion`. Prefer CSS (the duration and
 * distance tokens already collapse); use this where JS drives an animation.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => false);
}
