import { type RefObject, useEffect } from 'react';
import { clamp } from '../internal/math';

export interface SpotlightOptions {
  /** Default true. */
  enabled?: boolean;
}

/**
 * Writes the pointer position inside an element to CSS custom properties (once per frame
 * while it moves) and sets `data-hover="true"` while the pointer is over it:
 *
 *   --px, --py     pixels from the element's top-left
 *   --pxp, --pyp   0..1 across and down the element
 *
 * CSS does the drawing (radial gradients under var(--px), var(--py)), so React never
 * re-renders for a pointer move. Mouse and pen only: touch has no hover.
 */
export function useSpotlight(
  ref: RefObject<HTMLElement | null>,
  { enabled = true }: SpotlightOptions = {},
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let raf = 0;
    let cx = 0;
    let cy = 0;

    const write = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const x = clamp(cx - r.left, 0, r.width);
      const y = clamp(cy - r.top, 0, r.height);
      el.style.setProperty('--px', `${x.toFixed(1)}px`);
      el.style.setProperty('--py', `${y.toFixed(1)}px`);
      el.style.setProperty('--pxp', (r.width ? x / r.width : 0.5).toFixed(3));
      el.style.setProperty('--pyp', (r.height ? y / r.height : 0.5).toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      cx = e.clientX;
      cy = e.clientY;
      if (!raf) raf = requestAnimationFrame(write);
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      el.dataset.hover = 'true';
      onMove(e);
    };
    const onLeave = () => {
      delete el.dataset.hover;
    };
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
      delete el.dataset.hover;
    };
  }, [ref, enabled]);
}
