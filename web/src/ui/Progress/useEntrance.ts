import type { RefObject } from 'react';
import { useInView } from '../hooks/useInView';
import { useReducedMotion } from '../hooks/useReducedMotion';

/**
 * True once the element has been seen (or at once under reduced motion, or where there is no
 * IntersectionObserver). The instruments render empty until then and fill when they scroll
 * into view, so the fill is an event the learner sees.
 */
export function useEntrance(ref: RefObject<Element | null>): boolean {
  const reduced = useReducedMotion();
  const seen = useInView(ref, { once: true, rootMargin: '0px 0px -4% 0px' });
  return reduced || seen;
}
