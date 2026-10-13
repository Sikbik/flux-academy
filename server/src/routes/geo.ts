import { API_PATHS } from '../../../shared/api.ts';
import type { RouteModule } from '../core/context.ts';

/** GET /api/v1/geo: nodes clustered to a coarse grid plus per-country counts. */
const routes: RouteModule = (ctx) => [
  {
    method: 'GET',
    path: API_PATHS.geo,
    cacheControl: 'public, max-age=60, stale-while-revalidate=300',
    handler: () => ctx.geo.snapshot(),
  },
];

export default routes;
