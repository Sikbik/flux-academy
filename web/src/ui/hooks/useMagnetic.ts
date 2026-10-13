import { type RefObject, useEffect } from 'react';
import { clamp, damp } from '../internal/math';
import { registerPointerTick } from '../internal/pointer';
import { usePointerFine } from './useMedia';
import { useReducedMotion } from './useReducedMotion';

export interface MagneticOptions {
  /** Maximum drift in px. Default 6. */
  strength?: number;
  /** Distance from the element's edge at which the pull starts, px. Default 80. */
  field?: number;
  /** Default true. */
  enabled?: boolean;
}

/**
 * Drifts an element toward the pointer when the pointer is within `field` px of its edge.
 * Writes `--mx` and `--my` (px); the element's CSS applies them:
 *
 *   translate: var(--mx, 0px) var(--my, 0px);
 *
 * Fine pointers only, never under reduced motion. Every magnetic element shares one pointer
 * loop, and the loop is idle when the pointer is far away.
 */
export function useMagnetic(
  ref: RefObject<HTMLElement | null>,
  { strength = 6, field = 80, enabled = true }: MagneticOptions = {},
): void {
  const fine = usePointerFine();
  const reduced = useReducedMotion();
  const active = enabled && fine && !reduced;

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let x = 0;
    let y = 0;
    let rect = el.getBoundingClientRect();
    let dirty = false;
    const markDirty = () => {
      dirty = true;
    };
    window.addEventListener('scroll', markDirty, { passive: true });
    window.addEventListener('resize', markDirty);

    const unregister = registerPointerTick((dt, p) => {
      if (dirty) {
        // The element's own translate is part of its rect: measure the resting position.
        rect = el.getBoundingClientRect();
        rect = new DOMRect(rect.left - x, rect.top - y, rect.width, rect.height);
        dirty = false;
      }
      let tx = 0;
      let ty = 0;
      if (p.inside) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = p.x - cx;
        const dy = p.y - cy;
        const ex = Math.max(Math.abs(dx) - rect.width / 2, 0);
        const ey = Math.max(Math.abs(dy) - rect.height / 2, 0);
        if (Math.hypot(ex, ey) < field) {
          tx = clamp(dx / (rect.width / 2 + field), -1, 1) * strength;
          ty = clamp(dy / (rect.height / 2 + field), -1, 1) * strength;
        }
      }
      x = damp(x, tx, 12, dt);
      y = damp(y, ty, 12, dt);
      const settled = Math.abs(x - tx) < 0.02 && Math.abs(y - ty) < 0.02;
      if (settled) {
        x = tx;
        y = ty;
      }
      el.style.setProperty('--mx', `${x.toFixed(2)}px`);
      el.style.setProperty('--my', `${y.toFixed(2)}px`);
      return !settled;
    });
    return () => {
      unregister();
      window.removeEventListener('scroll', markDirty);
      window.removeEventListener('resize', markDirty);
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    };
  }, [ref, active, strength, field]);
}
