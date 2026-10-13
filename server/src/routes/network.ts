import { API_PATHS } from '../../../shared/api.ts';
import type { RouteModule } from '../core/context.ts';

/** GET /api/v1/network: chain, rewards, nodes, capacity, apps and market in one snapshot. */
const routes: RouteModule = (ctx) => [
  {
    method: 'GET',
    path: API_PATHS.network,
    // Browsers and the CDN may reuse it for a few seconds; the pollers update about every 10 s.
    cacheControl: 'public, max-age=5, stale-while-revalidate=30',
    handler: () => ctx.network.snapshot(),
  },
];

export default routes;
