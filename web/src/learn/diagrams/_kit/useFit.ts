/**
 * Fit a figure to the area it is given.
 *
 * A diagram lays itself out for the width of its container and has a natural height for that width. A
 * lesson stage is a fixed-height area, so on a short screen the figure, its caption and the beat pager
 * together can be taller than the area and the caption and the pager end up under the fold. This hook
 * measures the nearest scrolling ancestor and works out one number: the scale at which the figure (painted
 * smaller with a CSS transform, never re-laid out) leaves room for the caption and the pager.
 *
 * Legibility wins over fit: the scale never goes below `FIT_MIN`. A figure that still does not fit scrolls
 * inside its own window while the caption and the pager stay where they are, and `clipped` says so, so the
 * figure can offer to open larger.
 */

import { type RefObject, useEffect, useLayoutEffect, useState } from 'react';

const useIsoLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

/** The smallest scale a figure is painted at: 11 px labels stay above 9 px. */
export const FIT_MIN = 0.84;

/**
 * The scale that makes a figure of height `natural` fit in `room`, between `min` and 1, in whole percent
 * rounded down (so a scaled figure never ends up a pixel too tall). A figure with no height or no room is
 * left alone.
 */
export function fitScale(room: number, natural: number, min: number = FIT_MIN): number {
  if (!(natural > 0) || !Number.isFinite(room)) return 1;
  const k = room / natural;
  if (k >= 1) return 1;
  const pct = Math.floor(k * 100 + 1e-9) / 100;
  return Math.min(1, Math.max(min, pct));
}

export interface Fit {
  /** The scale to paint the stage at. */
  scale: number;
  /** The stage's natural (unscaled) height in px. */
  natural: number;
  /** The most height the whole figure may take, or null when nothing constrains it. */
  limit: number | null;
  /** True when the figure, at its smallest legible scale, is still taller than the room it has. */
  clipped: boolean;
}

const FREE: Fit = { scale: 1, natural: 0, limit: null, clipped: false };

const same = (a: Fit, b: Fit): boolean =>
  a.scale === b.scale && a.natural === b.natural && a.limit === b.limit && a.clipped === b.clipped;

/** The nearest ancestor that scrolls vertically: the stage body of a lesson, a drawer, a dialog. */
export function scrollParent(el: HTMLElement): HTMLElement | null {
  for (
    let p = el.parentElement;
    p && p !== document.body && p !== document.documentElement;
    p = p.parentElement
  ) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
}

export interface FitRefs {
  /** The outer element of the figure; its `max-block-size` is what this hook sets (through `limit`). */
  host: RefObject<HTMLElement | null>;
  /** The scaled element: the diagram. */
  stage: RefObject<HTMLElement | null>;
  /** The figure's body: the window, the caption. */
  body: RefObject<HTMLElement | null>;
  /** The window the stage is seen through: the one part of the figure that scrolls. */
  window: RefObject<HTMLElement | null>;
  /** The beat pager, outside the body so it never scrolls away. */
  pager: RefObject<HTMLElement | null>;
}

/**
 * `enabled` turns the measuring on; `deps` re-measure when something that changes the caption's height
 * (the beat, the layout flag) changes.
 */
export function useFit(refs: FitRefs, enabled: boolean, deps: readonly unknown[]): Fit {
  const [fit, setFit] = useState<Fit>(FREE);

  useIsoLayoutEffect(() => {
    const host = refs.host.current;
    const stage = refs.stage.current;
    const body = refs.body.current;
    const win = refs.window.current;
    if (!enabled || !host || !stage || !body || !win) {
      setFit((p) => (p === FREE ? p : FREE));
      return;
    }
    const scroller = scrollParent(host);

    const measure = () => {
      const natural = stage.offsetHeight;
      if (!scroller) {
        const next: Fit = { scale: 1, natural, limit: null, clipped: false };
        setFit((p) => (same(p, next) ? p : next));
        return;
      }
      // The room the scroller can give: its own max height when it has one (a phone stage is capped at a
      // share of the screen and grows with its content); else what is left of its parent's max height
      // after its siblings (a dialog's body, under the dialog's header); else the height it has. Its
      // bottom padding is not room.
      const ss = getComputedStyle(scroller);
      const cap = Number.parseFloat(ss.maxHeight);
      const parent = scroller.parentElement;
      const parentCap = parent ? Number.parseFloat(getComputedStyle(parent).maxHeight) : Number.NaN;
      let area = scroller.clientHeight;
      if (Number.isFinite(cap)) {
        area = cap;
      } else if (parent && Number.isFinite(parentCap)) {
        let others = 0;
        for (const c of Array.from(parent.children)) {
          if (c !== scroller && c instanceof HTMLElement) others += c.offsetHeight;
        }
        area = Math.max(0, parentCap - others);
      }
      const below = Number.parseFloat(ss.paddingBottom) || 0;
      const top =
        host.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const limit = Math.max(0, Math.round(area - top - below));

      const hs = getComputedStyle(host);
      const gap = Number.parseFloat(hs.rowGap) || 0;
      const pad = (Number.parseFloat(hs.paddingTop) || 0) + (Number.parseFloat(hs.paddingBottom) || 0);
      const pagerH = refs.pager.current?.offsetHeight ?? 0;
      // Everything in the body that is not the window: the caption, a notice, the gaps between them.
      const others = Math.max(0, body.clientHeight - win.clientHeight);
      const room = limit - pad - (pagerH > 0 ? pagerH + gap : 0) - others;
      const scale = fitScale(room, natural);
      const next: Fit = { scale, natural, limit, clipped: natural * scale > room + 2 };
      setFit((p) => (same(p, next) ? p : next));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(body);
    if (scroller) ro.observe(scroller);
    if (refs.pager.current) ro.observe(refs.pager.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [enabled, refs.host, refs.stage, refs.body, refs.window, refs.pager, ...deps]);

  return enabled ? fit : FREE;
}
