/**
 * The route registry, built by glob: every `routes/<name>/route.ts` registers a path and every
 * `routes/<name>/index.tsx` is its page, loaded lazily so each route is its own chunk.
 *
 * The pure parts (`normalizeRouteDef`, `compileRoutes`) are unit tested; the glob wiring is at the
 * bottom of the file.
 */

import { prefersSaveData } from '@/lib/platform';
import type { RouteDef, RouteMetaOverride } from './routeTypes';

export interface RouteEntry {
  /** The folder name under `routes/`. */
  folder: string;
  /** One react-router path (a def with several paths yields several entries). */
  path: string;
  meta: RouteMetaOverride;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validPath(p: unknown): p is string {
  return typeof p === 'string' && (p === '*' || p.startsWith('/'));
}

/**
 * Reads a route module in any of the accepted shapes: a default export `{ path, meta }`, a named
 * `route` export, or named `path` and `meta` exports. Returns null for something unusable.
 */
export function normalizeRouteDef(mod: unknown): RouteDef | null {
  if (!isRecord(mod)) return null;
  const candidate: unknown = isRecord(mod.default)
    ? mod.default
    : isRecord(mod.route)
      ? mod.route
      : 'path' in mod
        ? { path: mod.path, meta: mod.meta }
        : null;
  if (!isRecord(candidate)) return null;
  const raw = candidate.path;
  const paths = Array.isArray(raw) ? raw : [raw];
  if (paths.length === 0 || !paths.every(validPath)) return null;
  const meta = isRecord(candidate.meta) ? (candidate.meta as RouteMetaOverride) : undefined;
  return { path: Array.isArray(raw) ? (paths as string[]) : (raw as string), meta };
}

/** `/learn/` and `/learn` are the same route. The home path stays `/`. */
export function cleanPath(path: string): string {
  if (path === '*' || path === '/') return path;
  return path.replace(/\/+$/, '') || '/';
}

/** Flattens modules (by folder) into one entry per path. The first folder to claim a path keeps it. */
export function compileRoutes(modules: Record<string, unknown>): {
  entries: RouteEntry[];
  problems: string[];
} {
  const entries: RouteEntry[] = [];
  const problems: string[] = [];
  const claimed = new Map<string, string>();
  for (const [folder, mod] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
    const def = normalizeRouteDef(mod);
    if (!def) {
      problems.push(`routes/${folder}/route.ts has no usable \`path\``);
      continue;
    }
    const paths = Array.isArray(def.path) ? def.path : [def.path as string];
    for (const raw of paths) {
      const path = cleanPath(raw);
      const owner = claimed.get(path);
      if (owner) {
        problems.push(`routes/${folder} and routes/${owner} both claim ${path}; keeping ${owner}`);
        continue;
      }
      claimed.set(path, folder);
      entries.push({ folder, path, meta: def.meta ?? {} });
    }
  }
  return { entries, problems };
}

// ---------------------------------------------------------------------------
// The glob wiring
// ---------------------------------------------------------------------------

const defModules = import.meta.glob<unknown>('../routes/*/route.ts', { eager: true });
const pageLoaders = import.meta.glob<{ default: React.ComponentType }>('../routes/*/index.tsx');

function folderOf(key: string): string {
  const m = key.match(/routes\/([^/]+)\//);
  return m?.[1] ?? key;
}

const compiled = compileRoutes(
  Object.fromEntries(Object.entries(defModules).map(([key, mod]) => [folderOf(key), mod])),
);

if (import.meta.env.DEV) {
  for (const problem of compiled.problems) console.warn(`[routes] ${problem}`);
}

/** Every registered route entry. */
export const ROUTE_ENTRIES: readonly RouteEntry[] = compiled.entries;

/** The page loader for a folder, or null when `index.tsx` is missing. */
export function pageLoaderFor(folder: string): (() => Promise<{ default: React.ComponentType }>) | null {
  const hit = Object.entries(pageLoaders).find(([key]) => folderOf(key) === folder);
  return hit ? hit[1] : null;
}

/** The folder that serves a pathname, by the same specificity react-router uses (static beats dynamic). */
export function folderForPath(pathname: string): RouteEntry | null {
  const clean = cleanPath(pathname);
  const score = (e: RouteEntry): number => {
    if (e.path === '*') return 0;
    const re = new RegExp(`^${e.path.replace(/:[^/]+/g, '[^/]+').replace(/\*/g, '.*')}$`);
    if (!re.test(clean)) return -1;
    return 1000 - (e.path.match(/:/g)?.length ?? 0) * 10 + e.path.length;
  };
  let best: RouteEntry | null = null;
  let bestScore = -1;
  for (const e of ROUTE_ENTRIES) {
    const s = score(e);
    if (s > bestScore) {
      best = e;
      bestScore = s;
    }
  }
  return best;
}

const warmed = new Set<string>();

/**
 * Starts loading the chunk for a pathname, so the click that follows finds it ready. Safe to call on
 * every hover: each folder is requested once. A failed request is forgotten so it can be retried.
 */
export function preloadRoute(pathname: string): void {
  const entry = folderForPath(pathname);
  if (!entry || warmed.has(entry.folder)) return;
  const load = pageLoaderFor(entry.folder);
  if (!load) return;
  warmed.add(entry.folder);
  load().catch(() => {
    warmed.delete(entry.folder);
  });
}

/**
 * Warms a route's chunk when the visitor shows intent (pointer over, keyboard focus) on an in-app link,
 * so the click that follows finds it ready. Skipped on Save-Data connections. Returns a stop function.
 */
export function startRoutePrefetch(): () => void {
  if (typeof document === 'undefined' || prefersSaveData()) return () => {};
  const onIntent = (e: Event) => {
    const target = e.target as Element | null;
    const a = target?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank' || a.origin !== window.location.origin) return;
    preloadRoute(a.pathname);
  };
  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('focusin', onIntent);
  return () => {
    document.removeEventListener('pointerover', onIntent);
    document.removeEventListener('focusin', onIntent);
  };
}
