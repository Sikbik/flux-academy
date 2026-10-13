/**
 * The lab registry, by glob: every `labs/<id>/index.tsx` is a lab (its default export is the working
 * area). The curriculum (`shared/curriculum.ts` `LABS`) says which labs EXIST; this says which have
 * shipped. A lab in the curriculum with no module shows a "being built" panel, never a blank page.
 */

import { LABS } from '@shared/curriculum';
import { type ComponentType, lazy } from 'react';

type LabModule = { default: ComponentType };

const loaders = import.meta.glob<LabModule>('../../labs/*/index.tsx');

function idOf(path: string): string {
  return path.match(/labs\/([^/]+)\/index\.tsx$/)?.[1] ?? path;
}

const byId = new Map<string, () => Promise<LabModule>>(
  Object.entries(loaders).map(([path, load]) => [idOf(path), load]),
);

/** Ids of labs that have a module. */
export function shippedLabIds(): string[] {
  return LABS.filter((l) => byId.has(l.id)).map((l) => l.id);
}

export function labIsShipped(id: string): boolean {
  return byId.has(id);
}

/** Starts loading a lab's chunk (on hover or focus of its card). */
export function preloadLab(id: string): void {
  void byId
    .get(id)?.()
    .catch(() => undefined);
}

const lazyCache = new Map<string, ComponentType>();

/** The lab's component, lazily loaded, or null when it has not shipped. Stable per id. */
export function labComponent(id: string): ComponentType | null {
  const load = byId.get(id);
  if (!load) return null;
  let component = lazyCache.get(id);
  if (!component) {
    component = lazy(load);
    lazyCache.set(id, component);
  }
  return component;
}
