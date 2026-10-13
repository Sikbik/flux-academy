import { API_PATHS, type ServiceInfo } from '../../../shared/api.ts';
import { computed, type RouteModule } from '../core/context.ts';

/** GET /api/v1/info: build, uptime, upstream health and connected stream clients. Never cached. */
const routes: RouteModule = (ctx) => [
  {
    method: 'GET',
    path: API_PATHS.info,
    cacheControl: 'no-store',
    handler: () => {
      const now = ctx.clock.now();
      const info: ServiceInfo = {
        name: ctx.service.name,
        version: ctx.service.version,
        startedAt: new Date(ctx.service.startedAt).toISOString(),
        uptimeSec: Math.floor((now - ctx.service.startedAt) / 1000),
        upstream: ctx.upstreamStatus(),
        mode: ctx.service.mode,
        sseClients: ctx.hub.size,
      };
      return computed(info, now);
    },
  },
];

export default routes;
