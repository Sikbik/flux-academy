import { useCallback, useRef, useState } from 'react';

/**
 * One value that is either controlled (`value` given) or uncontrolled (`defaultValue`), with
 * a stable setter that always calls `onChange`. The standard pattern for form primitives.
 */
export function useControllableState<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] {
  const [inner, setInner] = useState<T>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const latest = useRef({ controlled, onChange });
  latest.current = { controlled, onChange };
  const set = useCallback((next: T) => {
    if (!latest.current.controlled) setInner(next);
    latest.current.onChange?.(next);
  }, []);
  return [current, set];
}
