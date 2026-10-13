import { type RefObject, useEffect, useState } from 'react';
import { observe } from '../internal/observer';

export interface RevealTriggerOptions {
  /** Reveal on mount (above the fold) instead of on entering the viewport. */
  immediate?: boolean;
  /** Reveal again every time it re-enters. Default false: once. */
  repeat?: boolean;
  /** Hold the reveal (until an intro finishes, say). It fires as soon as `hold` clears. */
  hold?: boolean;
  /** How early to trigger, as an IntersectionObserver rootMargin. Default `0px 0px -8% 0px`. */
  rootMargin?: string;
}

/**
 * The trigger behind `Reveal` and `SplitReveal`: returns true once the element has entered
 * the viewport (and `hold` is clear). Use it with the `data-shown` pattern:
 *
 *   const shown = useReveal(ref);
 *   <div ref={ref} data-shown={shown} />
 *
 * Content is never hidden without JS: styles key off `data-shown="false"` which is only set
 * after hydration. Where IntersectionObserver is missing, everything shows at once.
 */
export function useReveal(
  ref: RefObject<Element | null>,
  {
    immediate = false,
    repeat = false,
    hold = false,
    rootMargin = '0px 0px -8% 0px',
  }: RevealTriggerOptions = {},
): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || hold) return;
    if (immediate || typeof IntersectionObserver === 'undefined') {
      // One frame, so the "before" styles are committed and the transition has a start.
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    let stop = () => {};
    stop = observe(
      el,
      (entry) => {
        if (entry.isIntersecting) {
          setShown(true);
          if (!repeat) stop();
        } else if (repeat) {
          setShown(false);
        }
      },
      { rootMargin },
    );
    return () => stop();
  }, [ref, immediate, repeat, hold, rootMargin]);

  return shown;
}
