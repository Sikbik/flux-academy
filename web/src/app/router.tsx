/**
 * The route table and the router.
 *
 * Routes are built from the registry (`routes.ts`): every `routes/<name>/route.ts` says where a page
 * lives and every `routes/<name>/index.tsx` is its lazily loaded chunk. Everything sits under one layout
 * route (the `Shell`), so the header, footer and overlays persist across navigations. The old site's
 * URLs redirect (`shared/site.ts` `REDIRECTS`), and `*` is the not-found page.
 *
 * Two behaviours worth knowing:
 * - Pages load BEFORE the location changes (react-router's `lazy`), so the hex iris never snapshots a
 *   loading state: it reveals a finished page, or the old page stays while the chunk arrives.
 * - `router.navigate` is wrapped so every navigation that changes the pathname plays the iris, whether it
 *   came from a `<Link>`, `useNavigate`, a hotkey or the command deck. Reduced motion skips it.
 */

import { REDIRECTS } from '@shared/site';
import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject, replace } from 'react-router';
import { RootError, RouteError } from './ErrorViews';
import { setNavigator } from './navigation';
import { PlaceholderPage } from './PlaceholderPage';
import { pageLoaderFor, ROUTE_ENTRIES } from './routes';
import type { RouteMetaOverride } from './routeTypes';
import { PageSkeleton, Shell } from './Shell';
import { prepareIris, shouldIris } from './transitions';

type DataRouter = ReturnType<typeof createBrowserRouter>;

export interface RouteHandle {
  /** The folder under `routes/` that serves this route. */
  folder: string;
  meta: RouteMetaOverride;
}

function MissingPage({ folder }: { folder: string }) {
  return (
    <PlaceholderPage
      title="This page is being built"
      summary={`The ${folder} page has a route but no content yet.`}
    />
  );
}

function pageRoutes(): RouteObject[] {
  const entries = [...ROUTE_ENTRIES];
  if (!entries.some((e) => e.path === '*')) {
    entries.push({ folder: 'not-found', path: '*', meta: { noindex: true, title: 'Page not found' } });
  }
  return entries.map((entry): RouteObject => {
    const handle: RouteHandle = { folder: entry.folder, meta: entry.meta };
    const load = pageLoaderFor(entry.folder);
    const lazy: NonNullable<RouteObject['lazy']> = async () => {
      if (!load) {
        const Missing: ComponentType = () => <MissingPage folder={entry.folder} />;
        return { Component: Missing };
      }
      const mod = await load();
      return { Component: mod.default };
    };
    const shared = {
      handle,
      lazy,
      HydrateFallback: PageSkeleton,
      ErrorBoundary: RouteError,
    } as const;
    if (entry.path === '/') return { index: true, ...shared };
    return { path: entry.path.replace(/^\//, ''), ...shared };
  });
}

function redirectRoutes(): RouteObject[] {
  return Object.entries(REDIRECTS).map(([from, to]) => ({
    path: from,
    loader: ({ request }: { request: Request }) => {
      // Keep the query string and hash: `?demo=1` and anchors survive an old bookmark.
      const url = new URL(request.url);
      return replace(`${to}${url.search}${url.hash}`);
    },
  }));
}

/** Development only: the design system gallery, outside the shell (it draws its own chrome). */
function devRoutes(): RouteObject[] {
  if (!import.meta.env.DEV) return [];
  return [
    {
      path: '/kit',
      lazy: async () => {
        const mod = await import('@/ui/kit/Kit');
        return { Component: mod.default };
      },
    },
  ];
}

function buildRoutes(): RouteObject[] {
  return [
    ...redirectRoutes(),
    ...devRoutes(),
    {
      id: 'shell',
      Component: Shell,
      ErrorBoundary: RootError,
      children: pageRoutes(),
    },
  ];
}

/**
 * Wraps `navigate` so a pathname change plays the iris. The decision is `shouldIris`: supported by the
 * browser, not reduced motion, a different pathname, not a history jump.
 */
function withIris(router: DataRouter): DataRouter {
  const navigate = router.navigate.bind(router) as (
    to: unknown,
    opts?: Record<string, unknown>,
  ) => Promise<void>;
  const wrapped = (to: unknown, opts?: Record<string, unknown>) => {
    const explicit = opts?.viewTransition as boolean | undefined;
    if (typeof to !== 'number' && explicit === undefined && shouldIris(to, explicit)) {
      prepareIris();
      return navigate(to, { ...opts, viewTransition: true });
    }
    return navigate(to, opts);
  };
  router.navigate = wrapped as unknown as DataRouter['navigate'];
  return router;
}

let instance: DataRouter | null = null;

/** The app's router. Created on first use so tests and tools can import this module cheaply. */
export function getRouter(): DataRouter {
  if (!instance) {
    const router = withIris(createBrowserRouter(buildRoutes()));
    setNavigator((to, options) => {
      void router.navigate(to, options?.replace ? { replace: true } : undefined);
    });
    instance = router;
  }
  return instance;
}
