import type { Ref, RefCallback } from 'react';

/** Merges several refs (callback or object) into one callback ref. */
export function mergeRefs<T>(...refs: (Ref<T> | undefined | null)[]): RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as { current: T | null }).current = node;
    }
  };
}
