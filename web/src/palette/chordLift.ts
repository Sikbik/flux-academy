/**
 * Keeps the chord hint clear of toasts. Both sit at the bottom centre, and a toast can fire while a chord
 * is pending (a copied link, a locked accent), so the hint measures the toast stack and rises above it.
 * The toast host is not touched: its viewport is a fixed `<section aria-label="Notifications">` in the
 * toast layer of `#overlay-root`, and only its box is read.
 *
 * `toastClearance` and `chordBottom` are pure; `watchToastStack` is the DOM glue.
 */

/** Space between the hint and the top of the toast stack, in px. */
export const CHORD_GAP = 12;

/**
 * How far the toast stack reaches up from the bottom edge of the viewport, in px: 0 when there is no
 * stack. `top` and `height` are the stack's box, `viewportHeight` the window's inner height.
 */
export function toastClearance(top: number, height: number, viewportHeight: number): number {
  if (!(height > 0) || !Number.isFinite(top) || !Number.isFinite(viewportHeight)) return 0;
  return Math.max(0, Math.round(viewportHeight - top));
}

/** The hint's bottom offset in px given the stack's reach, or null to keep its own default. */
export function chordBottom(clearance: number): number | null {
  return clearance > 0 ? clearance + CHORD_GAP : null;
}

const TOAST_VIEWPORT = '#overlay-root > [data-layer="toast"] section[aria-label="Notifications"]';

function viewportEl(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(TOAST_VIEWPORT);
}

function measure(): number {
  const el = viewportEl();
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  return toastClearance(r.top, r.height, window.innerHeight);
}

/**
 * Calls `onChange` with the stack's reach now and whenever it changes (a toast arrives, wraps or leaves,
 * the window resizes). Returns the stop function.
 */
export function watchToastStack(onChange: (clearance: number) => void): () => void {
  let last = -1;
  const emit = () => {
    const next = measure();
    if (next === last) return;
    last = next;
    onChange(next);
  };
  emit();

  const cleanups: Array<() => void> = [];
  const el = viewportEl();
  if (el && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(emit);
    ro.observe(el);
    cleanups.push(() => ro.disconnect());
  }
  // Toasts animate in and out with transforms, which a ResizeObserver does not see; the list itself
  // changes (children added or removed), so watch that too.
  if (el && typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(emit);
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-leaving'] });
    cleanups.push(() => mo.disconnect());
  }
  window.addEventListener('resize', emit);
  cleanups.push(() => window.removeEventListener('resize', emit));
  return () => {
    for (const off of cleanups) off();
  };
}
