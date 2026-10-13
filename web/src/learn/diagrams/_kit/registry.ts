/**
 * Finds the diagrams. A diagram is a file `web/src/learn/diagrams/<id>.tsx` that default-exports a
 * `DiagramComponent` and exports `meta`. The glob is lazy (each diagram is its own chunk) and keyed by
 * file name, so adding a diagram is adding a file.
 */

import type { DiagramComponent, DiagramMeta } from '@/learn/stage-api';

export interface DiagramModule {
  default: DiagramComponent;
  meta: DiagramMeta;
}

// No type argument on the glob: Vitest's disk cache skips files that contain the literal `import.meta.glob(`.
const loaders = import.meta.glob(['../*.tsx', '!../*.test.tsx']) as Record<
  string,
  () => Promise<DiagramModule>
>;

/** The catalog order of docs/CONTENT.md section 4. It sets the figure number (`FIG n`). */
export const CATALOG_ORDER: readonly string[] = [
  'flux-layers',
  'tier-ladder',
  'lifecycle',
  'request-path',
  'container-layers',
  'repotag-anatomy',
  'port-mapping',
  'internal-dns',
  'dns-cname',
  'spec-anatomy',
  'volume-prefixes',
  'block-clock',
  'price-waterfall',
  'failure-modes',
];

function idOf(path: string): string {
  const m = /([^/]+)\.tsx$/.exec(path);
  return m?.[1] ?? path;
}

const byId = new Map<string, () => Promise<DiagramModule>>();
for (const [path, load] of Object.entries(loaders)) byId.set(idOf(path), load);

/** Every diagram id that exists, catalog order first. */
export function diagramIds(): string[] {
  const all = [...byId.keys()];
  const known = CATALOG_ORDER.filter((id) => byId.has(id));
  const extra = all.filter((id) => !CATALOG_ORDER.includes(id)).sort();
  return [...known, ...extra];
}

export function hasDiagram(id: string): boolean {
  return byId.has(id);
}

const cache = new Map<string, Promise<DiagramModule>>();

/** Load a diagram module (memoised). Rejects for an unknown id. */
export function loadDiagram(id: string): Promise<DiagramModule> {
  const hit = cache.get(id);
  if (hit) return hit;
  const load = byId.get(id);
  const p = load ? load() : Promise.reject(new Error(`Unknown diagram "${id}"`));
  cache.set(id, p);
  return p;
}

/** The figure number for a diagram: its 1-based place in the catalog. */
export function figureNumber(id: string): number {
  const i = CATALOG_ORDER.indexOf(id);
  if (i >= 0) return i + 1;
  const extra = diagramIds().filter((d) => !CATALOG_ORDER.includes(d));
  return CATALOG_ORDER.length + extra.indexOf(id) + 1;
}
