import { API_PATHS } from '../../../shared/api.ts';
import type { RouteModule } from '../core/context.ts';

/** GET /api/v1/blocks: the rolling buffer of recent blocks, newest last. */
const routes: RouteModule = (ctx) => [
  {
    method: 'GET',
    path: API_PATHS.blocks,
    cacheControl: 'public, max-age=5, stale-while-revalidate=30',
    handler: () => ctx.blocks.snapshot(),
  },
];

export default routes;
