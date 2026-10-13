import { type RefObject, useEffect } from 'react';
import { clamp, damp } from '../internal/math';
import { usePointerFine } from './useMedia';
import { useReducedMotion } from './useReducedMotion';

export interface TiltOptions {
  /** Maximum rotation in degrees. Default 5. */
  max?: number;
  /** Default true. */
  enabled?: boolean;
}

/**
 * Tilts an element up to `max` degrees toward the pointer. Writes `--rx` and `--ry` (deg) and
 * `--tilt-on` (0 or 1, for a specular highlight); the element's CSS applies them:
 *
 *   transform: perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
 *
 * Fine pointers only, never under reduced motion. Eases back to flat on leave, and the
 * frame loop sleeps once it has settled.
 */
export function useTilt(
  ref: RefObject<HTMLElement | null>,
  { max = 5, enabled = true }: TiltOptions = {},
): void {
  const fine = usePointerFine();
  const reduced = useReducedMotion();
  const active = enabled && fine && !reduced;

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    let tx = 0;
    let ty = 0;
    let rx = 0;
    let ry = 0;
    let hovering = false;
    let raf = 0;
    let last = 0;

    const apply = () => {
      el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    };
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      rx = damp(rx, tx, 14, dt);
      ry = damp(ry, ty, 14, dt);
      apply();
      const settled = Math.abs(rx - tx) < 0.01 && Math.abs(ry - ty) < 0.01;
      if (settled && !hovering) {
        rx = 0;
        ry = 0;
        apply();
        el.style.setProperty('--tilt-on', '0');
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(step);
    };
    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      const nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      const ny = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      ty = nx * max; // pointer on the right tilts the right edge away
      tx = -ny * max;
      hovering = true;
      el.style.setProperty('--tilt-on', '1');
      wake();
    };
    const onLeave = () => {
      hovering = false;
      tx = 0;
      ty = 0;
      wake();
    };
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
      el.style.removeProperty('--tilt-on');
    };
  }, [ref, active, max]);
}
