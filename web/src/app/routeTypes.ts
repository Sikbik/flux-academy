/**
 * The route module contract (docs/ARCHITECTURE.md section 4.5).
 *
 * A route is a folder: `web/src/routes/<name>/route.ts` says WHERE and `index.tsx` default-exports the
 * page. Adding a page is adding a folder; nothing shared is edited.
 *
 *   // web/src/routes/profile/route.ts
 *   import type { RouteDef } from '@/app/routeTypes';
 *   export default { path: '/profile' } satisfies RouteDef;
 *
 * `path` is a react-router path (`/learn/:lessonId`), a list of them for a page that serves several
 * (`['/labs', '/labs/:labId']`), or `*` for the not-found page. The page reads its params with
 * `useParams()`. A page is a lazily loaded, code-split chunk.
 */

export interface RouteChrome {
  /** The calm lattice backdrop behind the page. Default: on, except on the home page. */
  backdrop?: boolean;
  /** The footer. Default true. */
  footer?: boolean;
}

export interface RouteMetaOverride {
  /** Document title without the site suffix. Defaults to `shared/site.ts` route metadata. */
  title?: string;
  description?: string;
  /** Ask search engines to skip the page (the not-found page does). */
  noindex?: boolean;
  chrome?: RouteChrome;
}

export interface RouteDef {
  path: string | readonly string[];
  meta?: RouteMetaOverride;
}
