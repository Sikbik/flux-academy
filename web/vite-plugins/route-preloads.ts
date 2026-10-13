/**
 * Build-only: tells the server which chunks each route needs, so it can put them in the HTML head and the
 * browser fetches them in parallel with the entry instead of one or two round trips after it.
 *
 * The page chunk of a route is the dynamic entry for `src/routes/<folder>/index.tsx`. Its preload set is
 * that chunk plus everything it imports statically, minus whatever the entry's initial graph already
 * loads, and the CSS files those chunks own. The result is written to `route-preloads.json` in the build
 * output with the path patterns of each route, so the server needs no knowledge of the web source tree.
 *
 * This file is erasable TypeScript with no bundler imports at runtime, so the server test suite can
 * import it and check the pure functions against fake bundles.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';

export const ROUTE_PRELOADS_FILE = 'route-preloads.json';
export const ROUTE_PRELOADS_VERSION = 1;

/** The slice of a bundle chunk this module reads (structurally compatible with Rolldown's OutputChunk). */
export interface BundleChunk {
  type: 'chunk';
  fileName: string;
  facadeModuleId: string | null;
  isEntry: boolean;
  /** Static imports only; dynamic imports are listed separately by the bundler. */
  imports: string[];
  viteMetadata?: { importedCss: Set<string> };
}

export type BundleLike = Record<string, { type: 'asset' | 'chunk' }>;

export interface RouteSource {
  folder: string;
  /** react-router path patterns of the route, `*` allowed. */
  paths: string[];
}

export interface RoutePreloadEntry {
  folder: string;
  paths: string[];
  js: string[];
  css: string[];
}

export interface RoutePreloadsFile {
  version: typeof ROUTE_PRELOADS_VERSION;
  routes: RoutePreloadEntry[];
}

const STRING_LITERAL = `(?:'[^'\\\\\\n]*'|"[^"\\\\\\n]*")`;
const ROUTE_DEF_RE = new RegExp(
  `^\\s*export\\s+default\\s*\\{\\s*path\\s*:\\s*(?:(${STRING_LITERAL})|\\[((?:\\s*${STRING_LITERAL}\\s*,?)+)\\s*\\])\\s*[,}]`,
  'm',
);
const PATH_RE = /^(?:\*|\/[A-Za-z0-9_\-./:]*)$/;

/**
 * Reads the `path` of a `route.ts` written as `export default { path: '/x' | ['/x', '/x/:y'], ... }`.
 * Anything else (a variable, a spread, a template string, a missing path) throws: the build must not
 * quietly ship a route without its preloads.
 */
export function parseRoutePaths(source: string, where: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const m = ROUTE_DEF_RE.exec(code);
  if (!m) {
    throw new Error(
      `[route-preloads] ${where}: expected \`export default { path: '/x' | ['/x', '/y'] ... }\` with string literals`,
    );
  }
  const literals = m[1] ? [m[1]] : (m[2] ?? '').match(new RegExp(STRING_LITERAL, 'g'));
  const paths = (literals ?? []).map((s) => s.slice(1, -1));
  if (paths.length === 0) throw new Error(`[route-preloads] ${where}: no path found`);
  for (const p of paths) {
    if (!PATH_RE.test(p)) throw new Error(`[route-preloads] ${where}: unsupported path ${JSON.stringify(p)}`);
  }
  return paths;
}

/** Reads `routes/<folder>/route.ts` for every folder that has one (sorted, like the client registry). */
export function readRouteSources(routesDir: string): RouteSource[] {
  const out: RouteSource[] = [];
  const folders = readdirSync(routesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
  for (const folder of folders) {
    const file = join(routesDir, folder, 'route.ts');
    if (!existsSync(file)) continue;
    out.push({ folder, paths: parseRoutePaths(readFileSync(file, 'utf8'), `routes/${folder}/route.ts`) });
  }
  return out;
}

const posix = (p: string): string => p.replace(/\\/g, '/');

function isChunk(x: { type: string }): x is BundleChunk {
  return x.type === 'chunk';
}

/**
 * A route whose page picks a lazily loaded module by a path parameter (the labs route loads
 * `src/labs/<id>/index.tsx` through `import.meta.glob`). Each such module gets its own path entry
 * (`/labs/spec-forge`) whose preload set is the route's plus the module's, so the whole chain downloads in
 * parallel. The literal path outscores the pattern, so no request input is looked up by the server.
 */
export interface ChildModules {
  /** The route folder under `src/routes`. */
  folder: string;
  /** The directory (relative to the web root) whose `<id>/index.tsx` files are the children. */
  dir: string;
}

export const CHILD_MODULES: readonly ChildModules[] = [{ folder: 'labs', dir: 'src/labs' }];

const CHILD_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** The preload set of every route (and of every child module of a route that has them). */
export function computeRoutePreloads(opts: {
  bundle: BundleLike;
  routes: RouteSource[];
  /** The module id of a route's page (`<root>/src/routes/<folder>/index.tsx`), or null when it has none. */
  pageIdFor: (folder: string) => string | null;
  /** Child ids and module ids per route folder, from `CHILD_MODULES`. */
  childrenFor?: (folder: string) => { id: string; moduleId: string }[];
  /** Public base of the build, `/` by default. Must be absolute. */
  base: string;
}): RoutePreloadsFile {
  const { bundle, routes, pageIdFor, childrenFor, base } = opts;
  if (!base.startsWith('/')) {
    throw new Error(
      `[route-preloads] base must be an absolute path such as "/", got ${JSON.stringify(base)}`,
    );
  }
  const chunks = new Map<string, BundleChunk>();
  for (const item of Object.values(bundle)) {
    if (isChunk(item)) chunks.set((item as BundleChunk).fileName, item as BundleChunk);
  }
  const url = (fileName: string): string => `${base}${fileName}`;

  // Everything the entry's static graph loads (its CSS is already linked from index.html).
  const initial = new Set<string>();
  const queue = [...chunks.values()].filter((c) => c.isEntry).map((c) => c.fileName);
  for (let i = 0; i < queue.length; i++) {
    const name = queue[i] as string;
    if (initial.has(name)) continue;
    initial.add(name);
    for (const dep of chunks.get(name)?.imports ?? []) queue.push(dep);
  }
  if (initial.size === 0) throw new Error('[route-preloads] the bundle has no entry chunk');

  const byFacade = new Map<string, BundleChunk>();
  for (const c of chunks.values()) {
    if (c.facadeModuleId) byFacade.set(posix(c.facadeModuleId), c);
  }
  const chunkFor = (moduleId: string, what: string): BundleChunk => {
    const chunk = byFacade.get(posix(moduleId));
    if (!chunk) {
      throw new Error(`[route-preloads] no chunk for ${moduleId}: ${what} must stay a dynamic entry`);
    }
    return chunk;
  };

  /** Adds `start` and its static imports (not already `seen` or initial) to `js` and `css`. */
  const collect = (start: BundleChunk, seen: Set<string>, js: string[], css: string[]): void => {
    const walk = [start.fileName];
    for (let i = 0; i < walk.length; i++) {
      const name = walk[i] as string;
      if (seen.has(name) || initial.has(name)) continue;
      seen.add(name);
      const chunk = chunks.get(name);
      if (!chunk) continue;
      js.push(url(chunk.fileName));
      for (const file of chunk.viteMetadata?.importedCss ?? []) {
        if (!css.includes(url(file))) css.push(url(file));
      }
      for (const dep of chunk.imports) walk.push(dep);
    }
  };

  const result: RoutePreloadEntry[] = [];
  for (const route of routes) {
    // `*` is the not-found page: the server serves unknown paths a fixed head and preloads nothing.
    const paths = route.paths.filter((p) => p !== '*');
    if (paths.length === 0) continue;
    const pageId = pageIdFor(route.folder);
    if (pageId === null) continue;
    const page = chunkFor(pageId, `the page of routes/${route.folder}`);
    const seen = new Set<string>();
    const js: string[] = [];
    const css: string[] = [];
    collect(page, seen, js, css);
    result.push({ folder: route.folder, paths, js, css });

    const children = childrenFor?.(route.folder) ?? [];
    if (children.length === 0) continue;
    const patterns = paths.filter((p) => (p.match(/:[^/]+/g) ?? []).length === 1);
    if (patterns.length !== 1) {
      throw new Error(
        `[route-preloads] routes/${route.folder} has child modules and needs exactly one path with one parameter`,
      );
    }
    const pattern = patterns[0] as string;
    for (const child of children) {
      if (!CHILD_ID_RE.test(child.id)) {
        throw new Error(
          `[route-preloads] unsupported child id ${JSON.stringify(child.id)} in routes/${route.folder}`,
        );
      }
      const childSeen = new Set(seen);
      const childJs = [...js];
      const childCss = [...css];
      collect(chunkFor(child.moduleId, `the module of ${child.id}`), childSeen, childJs, childCss);
      result.push({
        folder: route.folder,
        paths: [pattern.replace(/:[^/]+/, child.id)],
        js: childJs,
        css: childCss,
      });
    }
  }
  return { version: ROUTE_PRELOADS_VERSION, routes: result };
}

/** The Vite plugin: emits `route-preloads.json` next to `index.html` in a client build. */
export function routePreloadsPlugin(): Plugin {
  let root = process.cwd();
  let base = '/';
  let skip = false;
  return {
    name: 'flux-academy:route-preloads',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      base = config.base;
      skip = Boolean(config.build.ssr) || Boolean(config.build.lib);
    },
    generateBundle(_options, bundle) {
      if (skip) return;
      const routesDir = resolve(root, 'src/routes');
      if (!existsSync(routesDir)) return;
      const file = computeRoutePreloads({
        bundle: bundle as unknown as BundleLike,
        routes: readRouteSources(routesDir),
        pageIdFor: (folder) => {
          const page = join(routesDir, folder, 'index.tsx');
          if (existsSync(page)) return page;
          this.warn(`routes/${folder} has a route.ts but no index.tsx; it gets no preloads`);
          return null;
        },
        childrenFor: (folder) => {
          const spec = CHILD_MODULES.find((c) => c.folder === folder);
          const dir = spec ? resolve(root, spec.dir) : null;
          if (!dir || !existsSync(dir)) return [];
          return readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'index.tsx')))
            .map((d) => ({ id: d.name, moduleId: join(dir, d.name, 'index.tsx') }))
            .sort((a, b) => a.id.localeCompare(b.id));
        },
        base,
      });
      this.emitFile({
        type: 'asset',
        fileName: ROUTE_PRELOADS_FILE,
        source: `${JSON.stringify(file, null, 2)}\n`,
      });
    },
  };
}
