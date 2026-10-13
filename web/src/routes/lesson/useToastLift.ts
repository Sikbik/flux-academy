/**
 * Keeps the shell's toasts clear of the lesson bar.
 *
 * The toast region is a fixed strip at the bottom centre of the viewport. In the lesson player that is
 * exactly where the bar with Back and Continue sits, so a "+10 XP" toast would cover it, and on a phone
 * (where the bar is fixed and the help ladder is right above it) the toast would also cover Hint, Show me
 * and the question for its few seconds.
 *
 *   place 'bottom' (the default, wide layouts): the strip is raised by the bar's height, so it sits just
 *     above the bar. The region reads `--safe-bottom` for its offset, so the override is set on the toast
 *     layer element only. Modals, the palette and the footer live in other layers and keep the real
 *     safe-area value.
 *   place 'top' (the compact layouts: a phone upright, where the bar is fixed, or on its side, where it
 *     sits at the foot of a short column): the strip moves to the top of the screen, under the header,
 *     where nothing the learner is working with sits (the stage's title bar or the lesson's own header
 *     is the most it covers). The layer says so with `data-place="top"` and `ToastHost` positions the
 *     strip from that.
 *
 * Both are removed again on unmount. Toasts stay dismissible and keyboard reachable in either place:
 * moving the strip does not move it in the document order and never takes focus.
 */

import { type RefObject, useEffect } from 'react';
import { getOverlayLayer } from '@/app/Portal';

export type ToastPlace = 'top' | 'bottom';

export function useToastLift(ref: RefObject<HTMLElement | null>, place: ToastPlace = 'bottom'): void {
  useEffect(() => {
    const layer = getOverlayLayer('toast');
    if (place === 'top') {
      layer.dataset.place = 'top';
      return () => {
        delete layer.dataset.place;
      };
    }
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      layer.style.setProperty('--safe-bottom', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    apply();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      layer.style.removeProperty('--safe-bottom');
    };
  }, [ref, place]);
}
