/**
 * The chrome the lesson page has to sit under, and what follows from it.
 *
 * The shell header is sticky and condenses from 64 to 52 px after 120 px of scroll (the same threshold as
 * `app/Header.tsx`). On the wide layout the rail sticks directly under it, and the bar with Back and Continue
 * sticks to the bottom of the narrative. On the stacked layout the stage is pinned under the header and the
 * bar is fixed to the screen, so a phone leaves the narrative a band between them.
 *
 * `pinnedBand` is that band. `usePinnedInsets` hands it to the browser as `scroll-padding`, so a control that
 * gets focus, or is scrolled into view by anything, lands inside it and not under the stage or the bar, and
 * `focusAndReveal` uses it for the heading and the task a step moves focus to.
 */

import { useEffect, useState } from 'react';
import { CONDENSE_AT } from '@/app/Header';
import { STACKED_QUERY } from './useStacked';

/** True once the shell header has condensed. Mirrors the header's own hysteresis. */
export function useCondensedHeader(): boolean {
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      setCondensed((was) => (was ? window.scrollY > CONDENSE_AT - 24 : window.scrollY > CONDENSE_AT));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return condensed;
}

const NAV = 'nav[aria-label="Lesson navigation"]';
const GAP = 8;

export interface PinnedBand {
  /** Viewport y of the lowest pinned edge at the top (header, rail, or the pinned stage). */
  top: number;
  /** Viewport y of the top edge of the bar at the bottom (the viewport's own edge when there is none). */
  bottom: number;
}

/**
 * The clear band of the viewport: below everything pinned at the top, above the bar at the bottom. The stage
 * and the bar are read by their size, not by where they are now: they are pinned where they will be once
 * the page has scrolled, which is also where scroll-padding has to put things.
 */
export function pinnedBand(): PinnedBand {
  const header = document.querySelector('header');
  const headerBottom = header instanceof HTMLElement ? header.getBoundingClientRect().bottom : 0;
  let top = headerBottom;

  const rail = document.querySelector('[data-lesson-rail]');
  if (rail instanceof HTMLElement && getComputedStyle(rail).position === 'sticky') {
    top = Math.max(top, headerBottom + rail.getBoundingClientRect().height);
  }
  const stage = document.querySelector('[data-lesson-stage]');
  if (stage instanceof HTMLElement && window.matchMedia(STACKED_QUERY).matches) {
    top = Math.max(top, headerBottom + stage.getBoundingClientRect().height);
  }

  let bottom = window.innerHeight;
  const nav = document.querySelector(NAV);
  if (nav instanceof HTMLElement) bottom -= nav.getBoundingClientRect().height;
  return { top, bottom };
}

/** Pixels of pinned chrome above the narrative at the moment: the top of the clear band. */
export function stickyChromeHeight(): number {
  return pinnedBand().top;
}

/**
 * Keeps the root's `scroll-padding` equal to the pinned chrome while the player is on the page, and
 * publishes the bar's height as `--lesson-nav-h` (the narrative reserves that much room at its end).
 * Everything is removed again on unmount. `layoutKey` re-measures when the layout changes shape (a phase
 * with no stage or bar, for instance).
 */
export function usePinnedInsets(layoutKey: string): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the layout that is measured
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const { top, bottom } = pinnedBand();
      const bar = Math.max(0, Math.ceil(window.innerHeight - bottom));
      root.style.setProperty('scroll-padding-block-start', `${Math.ceil(top) + GAP}px`);
      root.style.setProperty('scroll-padding-block-end', `${bar + GAP * 2}px`);
      root.style.setProperty('--lesson-nav-h', `${bar}px`);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    for (const selector of ['header', '[data-lesson-rail]', '[data-lesson-stage]', NAV]) {
      const el = document.querySelector(selector);
      if (el) observer?.observe(el);
    }
    window.addEventListener('resize', schedule);
    const query = window.matchMedia(STACKED_QUERY);
    query.addEventListener('change', schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      query.removeEventListener('change', schedule);
      root.style.removeProperty('scroll-padding-block-start');
      root.style.removeProperty('scroll-padding-block-end');
      root.style.removeProperty('--lesson-nav-h');
    };
  }, [layoutKey]);
}

/**
 * Focus an element and make sure it is inside the clear band: not under the header, the rail or the pinned
 * stage, and not under the bar. Scrolls only when it has to, so a step that is already in view does not
 * make the page jump. An element taller than the band is aligned by its top: its start is what is needed.
 */
export function focusAndReveal(el: HTMLElement): void {
  el.focus({ preventScroll: true });
  const { top, bottom } = pinnedBand();
  const rect = el.getBoundingClientRect();
  if (rect.top < top + GAP || rect.bottom > bottom - GAP) {
    window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - top - GAP * 2), behavior: 'auto' });
  }
}
