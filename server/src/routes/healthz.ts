import { API_PATHS } from '../../../shared/api.ts';
import type { RouteModule } from '../core/context.ts';

/** GET /healthz: process liveness for the container platform. Plain `ok`, never touches upstream. */
const routes: RouteModule = () => [
  {
    method: 'GET',
    path: API_PATHS.healthz,
    limit: 'exempt',
    raw: (req, res) => {
      const body = Buffer.from('ok\n');
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    },
  },
];

export default routes;
