/**
 * Route preloading: which chunks a route needs, read from the `route-preloads.json` the web build emits
 * (web/vite-plugins/route-preloads.ts). The server puts them in the HTML head so the browser fetches
 * them in parallel with the entry instead of after it has run.
 *
 * Nothing here reflects request input: a pathname only selects among the build's own entries, and every
 * URL comes from the JSON (validated to a plain asset path) or from one constant.
 */
import { readFile } from 'node:fs/promises';

export const ROUTE_PRELOADS_FILE = 'route-preloads.json';

/** The home route's LCP element: the bench plate. Checked against the art manifest by a test. */
export const HOME_HERO_AVIF = '/art/bg-bench.avif';

export type PreloadLink =
  | { kind: 'script'; href: string }
  | { kind: 'style'; href: string }
  | { kind: 'image'; href: string; type: string };

interface CompiledRoute {
  path: string;
  params: number;
  re: RegExp;
  links: PreloadLink[];
}

export interface RoutePreloads {
  routes: readonly CompiledRoute[];
}

// A plain asset path: segments of word characters and dashes, a file name that may contain dots. No `..`,
// no query, nothing that needs escaping in an attribute.
const ASSET_RE = /^\/(?:[\w-]+\/)*[\w.-]+\.(?:js|css)$/;
const PATTERN_RE = /^\/[A-Za-z0-9_\-./:]*$/;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `/learn/` and `/learn` are the same route; the home path stays `/`. Same rule as the client. */
export function cleanPath(path: string): string {
  if (path === '/') return path;
  return path.replace(/\/+$/, '') || '/';
}

function strings(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;
}

/** Validates the parsed JSON. Anything unexpected returns null, so a bad file preloads nothing. */
export function parseRoutePreloads(raw: unknown): RoutePreloads | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const file = raw as { version?: unknown; routes?: unknown };
  if (file.version !== 1 || !Array.isArray(file.routes)) return null;
  const routes: CompiledRoute[] = [];
  for (const entry of file.routes as unknown[]) {
    if (typeof entry !== 'object' || entry === null) return null;
    const e = entry as { paths?: unknown; js?: unknown; css?: unknown };
    const paths = strings(e.paths);
    const js = strings(e.js);
    const css = strings(e.css);
    if (!paths || !js || !css) return null;
    if (![...js, ...css].every((u) => ASSET_RE.test(u))) return null;
    if (!js.every((u) => u.endsWith('.js')) || !css.every((u) => u.endsWith('.css'))) return null;
    const links: PreloadLink[] = [
      ...js.map((href): PreloadLink => ({ kind: 'script', href })),
      ...css.map((href): PreloadLink => ({ kind: 'style', href })),
    ];
    for (const raw of paths) {
      if (!PATTERN_RE.test(raw)) return null;
      const path = cleanPath(raw);
      // Same pattern rule as web/src/app/routes.ts folderForPath: `:name` is one segment.
      const source = path
        .split(/(:[^/]+)/)
        .map((part, i) => (i % 2 === 1 ? '[^/]+' : escapeRe(part)))
        .join('');
      routes.push({
        path,
        params: (path.match(/:/g) ?? []).length,
        re: new RegExp(`^${source}$`),
        links,
      });
    }
  }
  return { routes };
}

/** Reads and validates `route-preloads.json`; null when it is absent (dev, or a build without it) or bad. */
export async function loadRoutePreloads(file: string): Promise<RoutePreloads | null> {
  try {
    return parseRoutePreloads(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    return null;
  }
}

/**
 * The route that serves a pathname, by the client's rule (`folderForPath`): fewer parameters first, then
 * the longer pattern. On a tie the first entry wins.
 */
export function matchRoute(preloads: RoutePreloads, pathname: string): CompiledRoute | null {
  const clean = cleanPath(pathname);
  let best: CompiledRoute | null = null;
  let bestScore = -1;
  for (const r of preloads.routes) {
    if (!r.re.test(clean)) continue;
    const score = 1000 - r.params * 10 + r.path.length;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

/** The links for a KNOWN route's pathname (the caller has checked the route exists). */
export function preloadLinksFor(preloads: RoutePreloads | null, pathname: string): PreloadLink[] {
  if (!preloads) return [];
  const route = matchRoute(preloads, pathname);
  if (!route) return [];
  const links: PreloadLink[] = [];
  if (cleanPath(pathname) === '/') links.push({ kind: 'image', href: HOME_HERO_AVIF, type: 'image/avif' });
  links.push(...route.links);
  return links;
}
