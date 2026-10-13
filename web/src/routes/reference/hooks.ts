/**
 * Behaviour shared by the Reference pages: deep links that wait for late content, scroll spy and the
 * open set of disclosures. Each one is a small effect over the DOM; the rules they apply live in
 * `model.ts`. (`/` focuses the page's search with `useHotkeyClaim`, see `Landing.tsx` and `TopicFrame.tsx`.)
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { fragmentId } from '@/content/reference';
import { computeActive, isSafeId } from './model';

const FLASH_MS = 1800;
const MAX_TRIES = 40;
const TRY_EVERY_MS = 50;
const SETTLE_MS = 350;

/** Gives focus to a deep link target without scrolling again, adding a tab index when it has none. */
function focusTarget(el: HTMLElement): void {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/** A short highlight that says "this is what the link pointed at". Cleared by itself. */
function flash(el: HTMLElement): void {
  el.dataset.flash = 'true';
  window.setTimeout(() => {
    if (el.dataset.flash === 'true') delete el.dataset.flash;
  }, FLASH_MS);
}

/**
 * Scrolls to, focuses and highlights the element named by the URL fragment.
 *
 * The router already scrolls to an element that exists at navigation time. This covers what it cannot:
 * a topic page that loads after the navigation, and a target inside a row that has to open first (the
 * rows open themselves when the fragment names them, so the element is there a moment later). It retries
 * for about two seconds, scrolls once more after fonts settle, and gives up the moment the reader
 * scrolls or presses a key.
 */
export function useHashTarget(enabled = true): void {
  const { hash, key } = useLocation();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` re-runs it when the same link is pressed again
  useEffect(() => {
    if (!enabled) return undefined;
    const id = fragmentId(hash);
    if (id === '' || !isSafeId(id)) return undefined;
    let cancelled = false;
    let moved = false;
    let tries = 0;
    let timer = 0;
    const onMove = () => {
      moved = true;
    };
    const opts = { passive: true } as const;
    window.addEventListener('wheel', onMove, opts);
    window.addEventListener('touchmove', onMove, opts);
    window.addEventListener('keydown', onMove);

    const attempt = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      if (!el) {
        tries += 1;
        if (tries < MAX_TRIES) timer = window.setTimeout(attempt, TRY_EVERY_MS);
        return;
      }
      el.scrollIntoView({ block: 'start' });
      focusTarget(el);
      flash(el);
      timer = window.setTimeout(() => {
        if (!cancelled && !moved) el.scrollIntoView({ block: 'start' });
      }, SETTLE_MS);
    };
    // Wait for the shell to place focus on the heading after a navigation, then take it.
    timer = window.setTimeout(attempt, TRY_EVERY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('wheel', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('keydown', onMove);
    };
  }, [hash, key, enabled]);
}

/**
 * The id (of `ids`) that is being read: the last heading above a line a little below the sticky header.
 * Re-measures on scroll and resize, once per frame, and when the page changes height: the sections of a
 * page whose body loads after the frame arrive without a scroll, and so does a table that turns into cards.
 */
export function useScrollSpy(ids: readonly string[], offset: number): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const items = ids.flatMap((id) => {
        const el = document.getElementById(id);
        return el ? [{ id, top: el.getBoundingClientRect().top }] : [];
      });
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight > window.innerHeight + 8;
      const atBottom = scrollable && window.innerHeight + window.scrollY >= doc.scrollHeight - 4;
      const line = offset + Math.min(160, window.innerHeight * 0.22);
      setActive((prev) => {
        const next = computeActive(items, line, atBottom);
        return next === prev ? prev : next;
      });
    };
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const heightWatch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    heightWatch?.observe(document.body);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      heightWatch?.disconnect();
    };
  }, [ids, offset]);
  return active;
}

/**
 * The open rows of a list of disclosures. A row named by the URL fragment opens itself (and the list
 * keeps it open), which is what lets `#component-ports` land on a row that is collapsed by default.
 */
export function useOpenSet(ids: readonly string[]) {
  const { hash } = useLocation();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  // biome-ignore lint/correctness/useExhaustiveDependencies: opens on the fragment, not on every id change
  useEffect(() => {
    const id = fragmentId(hash);
    if (id !== '' && ids.includes(id)) {
      setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    }
  }, [hash]);

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const set = useCallback((id: string, value: boolean) => {
    setOpen((prev) => {
      if (prev.has(id) === value) return prev;
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setAll = useCallback((value: boolean) => setOpen(value ? new Set(ids) : new Set()), [ids]);

  return { open, toggle, set, setAll };
}
