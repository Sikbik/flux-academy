import { API_PATHS } from '../../../shared/api.ts';
import { lintSpec } from '../../../shared/flux/lint.ts';
import { computed, HttpError, type RouteModule } from '../core/context.ts';
import { servicesFor } from '../services/flux-domain.ts';

/**
 * POST /api/v1/lint: the teachable linter of `shared/flux`, the same code the browser runs. Takes
 * `{ spec }` (any JSON; it is normalised, never trusted) and answers a LintReport.
 */
const routes: RouteModule = (ctx) => {
  const { explore } = servicesFor(ctx);
  return [
    {
      method: 'POST',
      path: API_PATHS.lint,
      limit: 'write',
      handler: (req) => {
        const body = req.body;
        if (typeof body !== 'object' || body === null || Array.isArray(body) || !('spec' in body)) {
          throw new HttpError(400, 'missing_spec', 'Send a JSON object with a "spec" field.');
        }
        const takenNames = explore.knownNames();
        const report = lintSpec((body as { spec: unknown }).spec, takenNames ? { takenNames } : {});
        return computed(report, ctx.clock.now());
      },
    },
  ];
};

export default routes;
