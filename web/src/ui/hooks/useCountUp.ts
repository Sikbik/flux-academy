import { type RefObject, useEffect, useRef, useState } from 'react';
import { easeOutExpo } from '../internal/math';
import { observe } from '../internal/observer';
import { useReducedMotion } from './useReducedMotion';

export interface CountUpOptions {
  /** Duration in ms. Default 700 (the --dur-4 token). */
  duration?: number;
  /** Where the first count starts. Default 0. */
  from?: number;
  /** Start counting on mount instead of when the element scrolls into view. */
  immediate?: boolean;
  /** Default true. When false the value is returned as is. */
  enabled?: boolean;
}

/**
 * An animated number. Counts from `from` (default 0) to `target` the first time the element
 * the returned `ref` is attached to scrolls into view (or at once with `immediate`, or when
 * no ref is attached), then eases to any new target. Under reduced motion it jumps.
 *
 *   const { value, ref } = useCountUp(7105);
 *   <span ref={ref}>{Math.round(value).toLocaleString()}</span>
 *
 * This re-renders every frame while it runs; for large text prefer the `CountUp` component,
 * which writes to the DOM directly.
 */
export function useCountUp<T extends Element = HTMLElement>(
  target: number,
  { duration = 700, from = 0, immediate = false, enabled = true }: CountUpOptions = {},
): { value: number; ref: RefObject<T | null> } {
  const reduced = useReducedMotion();
  const ref = useRef<T | null>(null);
  const [value, setValue] = useState(enabled && !reduced ? from : target);
  const shown = useRef(value);
  const started = useRef(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!enabled || reduced) {
      shown.current = target;
      setValue(target);
      return;
    }
    const run = () => {
      cancelAnimationFrame(raf.current);
      const start = shown.current;
      const t0 = performance.now();
      if (start === target) {
        setValue(target);
        return;
      }
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        shown.current = start + (target - start) * easeOutExpo(t);
        setValue(shown.current);
        if (t < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    };
    const el = ref.current;
    if (started.current || immediate || !el || typeof IntersectionObserver === 'undefined') {
      started.current = true;
      run();
      return () => cancelAnimationFrame(raf.current);
    }
    const stop = observe(el, (entry) => {
      if (!entry.isIntersecting) return;
      started.current = true;
      stop();
      run();
    });
    return () => {
      stop();
      cancelAnimationFrame(raf.current);
    };
  }, [target, duration, immediate, enabled, reduced]);

  return { value, ref };
}
