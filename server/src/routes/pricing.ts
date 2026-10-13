import { API_PATHS } from '../../../shared/api.ts';
import type { RouteModule } from '../core/context.ts';
import { servicesFor } from '../services/flux-domain.ts';

/**
 * GET /api/v1/pricing: the official per-resource rates (cached ten minutes with stale-while-revalidate)
 * plus the FLUX price, each labelled with where it came from. Falls back to a baked snapshot.
 */
const routes: RouteModule = (ctx) => {
  const { pricing } = servicesFor(ctx);
  return [
    {
      method: 'GET',
      path: API_PATHS.pricing,
      cacheControl: 'public, max-age=30, stale-while-revalidate=300',
      handler: () => pricing.snapshot(),
    },
  ];
};

export default routes;
