import {
  type HTMLAttributes,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/**
 * Keyboard access to a region that scrolls (WCAG 2.1.1; axe `scrollable-region-focusable`). A scroll
 * container with nothing focusable inside cannot be scrolled from the keyboard, so while it actually
 * overflows it becomes a labelled, focusable region. When everything fits it stays out of the tab order:
 * a stop that does nothing is noise.
 *
 * The deck's list is a combobox popup (focus stays in the input and the list follows
 * `aria-activedescendant`), so the region is one more place Tab can reach, never a replacement for that.
 *
 *   const { ref, props } = useScrollRegion<HTMLDivElement>('Results');
 *   <div ref={ref} {...props} className={styles.list}>...</div>
 *
 * Use `scroller: 'parent'` when the element sits inside a container that does the scrolling (a dialog
 * body): the nearest scrollable ancestor is the one measured.
 */
export interface ScrollRegion<T extends HTMLElement> {
  ref: RefObject<T | null>;
  /** Spread on the element: empty while nothing scrolls. */
  props: Pick<HTMLAttributes<T>, 'tabIndex' | 'role' | 'aria-label'>;
}

/** True when the element can scroll vertically and its content is taller than its box. */
export function overflows(el: Pick<HTMLElement, 'scrollHeight' | 'clientHeight'>): boolean {
  return el.scrollHeight > el.clientHeight + 1;
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY;
    if (y === 'auto' || y === 'scroll') return p;
  }
  return null;
}

export function useScrollRegion<T extends HTMLElement>(
  label: string,
  opts: { scroller?: 'self' | 'parent' } = {},
): ScrollRegion<T> {
  const scroller = opts.scroller ?? 'self';
  const ref = useRef<T>(null);
  const [scrolls, setScrolls] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const host = scroller === 'parent' ? scrollParent(el) : el;
    const next = host ? overflows(host) : false;
    setScrolls((prev) => (prev === next ? prev : next));
  }, [scroller]);

  // Content changes every keystroke in the deck: look again after each render.
  useLayoutEffect(measure);

  // The box changes when the window or the on-screen keyboard does.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const host = scroller === 'parent' ? scrollParent(el) : el;
    const targets = [host, el.firstElementChild].filter((t): t is Element => t !== null && t !== undefined);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      for (const t of targets) ro.observe(t);
    }
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [scroller, measure]);

  return {
    ref,
    props: scrolls ? { tabIndex: 0, role: 'region', 'aria-label': label } : {},
  };
}
