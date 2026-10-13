/**
 * Where stage components are found. A stage kind is a file: `learn/stages/<kind>.tsx` default-exporting
 * a `StageComponent` (see stage-api.ts). The registry is built with a glob, so a new stage is one new
 * file and nothing here changes. A kind with no file is simply "not built yet": the player shows a
 * friendly panel instead of failing, and the rest of the lesson still works.
 */

import { type LazyExoticComponent, lazy } from 'react';
import type { StageComponent } from './stage-api';

// No type argument on the glob: Vitest's disk cache skips files that contain the literal `import.meta.glob(`.
const loaders = import.meta.glob('./stages/*.tsx') as Record<
  string,
  () => Promise<{ default: StageComponent }>
>;

function kindOf(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.tsx$/, '');
}

const byKind = new Map<string, () => Promise<{ default: StageComponent }>>(
  Object.entries(loaders).map(([path, load]) => [kindOf(path), load]),
);

const lazies = new Map<string, LazyExoticComponent<StageComponent>>();

/** True when `learn/stages/<kind>.tsx` exists. */
export function stageAvailable(kind: string): boolean {
  return byKind.has(kind);
}

/** The kinds that have a component, for diagnostics. */
export function availableStageKinds(): string[] {
  return [...byKind.keys()].sort();
}

/** A lazy component for a stage kind, or null when it has not been built yet. Stable across calls. */
export function stageComponent(kind: string): LazyExoticComponent<StageComponent> | null {
  const load = byKind.get(kind);
  if (!load) return null;
  let c = lazies.get(kind);
  if (!c) {
    c = lazy(load);
    lazies.set(kind, c);
  }
  return c;
}
