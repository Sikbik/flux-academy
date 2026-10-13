import { API_PATHS, type StreamEvent } from '../../../shared/api.ts';
import { HttpError, type RouteModule } from '../core/context.ts';

/**
 * GET /api/v1/stream (SSE). `hello` first (server clock plus the network snapshot with the same meta REST
 * would give), then `block` and `network` events broadcast by the server wiring, and a 20 s heartbeat from
 * the hub. Capacity and per-IP caps answer 503 and 429 before any stream bytes are written.
 */
const routes: RouteModule = (ctx) => [
  {
    method: 'GET',
    path: API_PATHS.stream,
    limit: 'stream',
    raw: (req, res, ip) => {
      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Accel-Buffering': 'no',
        });
        res.end();
        return;
      }
      const now = ctx.clock.now();
      const env = ctx.envelope(ctx.network.snapshot());
      const hello: StreamEvent = {
        type: 'hello',
        data: { serverTime: new Date(now).toISOString(), network: env.data, networkMeta: env.meta },
      };
      const r = ctx.hub.add(req, res, ip, hello);
      if (r.ok) return;
      if (r.reason === 'per-ip') {
        throw new HttpError(429, 'too_many_streams', 'Too many open streams from this address', {
          'Retry-After': '30',
        });
      }
      throw new HttpError(503, 'stream_capacity', 'The stream is at capacity, try again shortly', {
        'Retry-After': '30',
      });
    },
  },
];

export default routes;
