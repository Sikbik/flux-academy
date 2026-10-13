/**
 * Locked fields. A lesson step lists the paths the learner may change (`editable`); everything else stays
 * as the author wrote it. The form simply disables locked controls, but text edits (the JSON panel, an
 * import, a paste) can touch anything, so they go through `restrictToEditable`, which puts every locked
 * value back and says which paths it put back.
 */

import { diffPaths, getAt, isPathEditable, removeAt, setAt } from './paths';

export interface Restricted<T> {
  value: T;
  /** Paths whose new value was refused because they are locked (shortest paths). */
  rejected: string[];
}

export function restrictToEditable<T>(
  base: T,
  next: T,
  editable: readonly string[] | undefined,
): Restricted<T> {
  if (editable === undefined) return { value: next, rejected: [] };
  const rejected: string[] = [];
  let value = next;
  for (const path of diffPaths(base, next)) {
    if (isPathEditable(path, editable)) continue;
    rejected.push(path);
    const original = getAt(base, path);
    value = original === undefined ? removeAt(value, path) : setAt(value, path, original);
  }
  return { value, rejected };
}
