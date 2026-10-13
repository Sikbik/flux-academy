import { API_PATHS } from '../../../shared/api.ts';
import { HttpError, type RouteModule } from '../core/context.ts';
import { isValidAppName } from '../services/explore.ts';
import { servicesFor } from '../services/flux-domain.ts';

/** Search text: letters, digits and hyphens only, so nothing else is ever compared or echoed. */
const SEARCH_PATTERN = /^[A-Za-z0-9-]{0,32}$/;

/**
 * GET /api/v1/explore/app?name=  and  GET /api/v1/explore/search?q=
 *
 * Read-only views of the real network for the App Explorer. The name is validated against Flux's name rule
 * before anything is fetched; only two fixed endpoints of the configured Flux API are ever called; node
 * ports and encrypted enterprise contents are never returned.
 */
const routes: RouteModule = (ctx) => {
  const { explore } = servicesFor(ctx);
  // Keep the name index warm: a conditional request, so an unchanged catalog costs a few hundred bytes.
  ctx.schedule('explore-names', 30 * 60_000, () => explore.refreshNames());
  return [
    {
      method: 'GET',
      path: API_PATHS.exploreApp,
      // Each cold lookup makes two upstream requests: the smaller `write` bucket.
      limit: 'write',
      cacheControl: 'public, max-age=30',
      handler: async (req) => {
        const name = req.query.get('name') ?? '';
        if (!isValidAppName(name)) {
          throw new HttpError(
            400,
            'bad_name',
            'App names use letters, digits and hyphens, up to 63 characters.',
          );
        }
        const r = await explore.app(name);
        return { data: r.data, asOfMs: r.asOfMs, source: 'live', windowMs: 60_000 };
      },
    },
    {
      method: 'GET',
      path: API_PATHS.exploreSearch,
      limit: 'read',
      cacheControl: 'public, max-age=60',
      handler: async (req) => {
        const q = req.query.get('q') ?? '';
        if (!SEARCH_PATTERN.test(q)) {
          throw new HttpError(
            400,
            'bad_query',
            'Search with letters, digits and hyphens, up to 32 characters.',
          );
        }
        const r = await explore.search(q);
        return { data: r.data, asOfMs: r.asOfMs, source: r.source, windowMs: 35 * 60_000 };
      },
    },
  ];
};

export default routes;
