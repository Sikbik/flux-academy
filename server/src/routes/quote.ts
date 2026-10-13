import { API_PATHS, type QuoteRequest } from '../../../shared/api.ts';
import { HttpError, type RouteModule } from '../core/context.ts';
import { servicesFor } from '../services/flux-domain.ts';

/** Extra rate-limit tokens a request with `verify: true` costs: it can trigger an upstream call. */
export const VERIFY_COST = 6;

function parseBody(body: unknown): QuoteRequest {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'bad_body', 'Send a JSON object with a "spec" field.');
  }
  const b = body as Record<string, unknown>;
  if (!('spec' in b)) throw new HttpError(400, 'missing_spec', 'The body needs a "spec" field.');
  const out: QuoteRequest = { spec: b.spec };
  if (b.months !== undefined) {
    const m = b.months;
    if (typeof m !== 'number' || !Number.isFinite(m) || m <= 0 || m > 12) {
      throw new HttpError(400, 'bad_months', '"months" must be a number above 0 and at most 12.');
    }
    out.months = m;
  }
  if (b.verify !== undefined) {
    if (typeof b.verify !== 'boolean')
      throw new HttpError(400, 'bad_verify', '"verify" must be true or false.');
    out.verify = b.verify;
  }
  return out;
}

/**
 * POST /api/v1/quote: normalise, lint and price a spec with the shared engine. With `verify: true` the
 * answer is also confirmed against the official calculator (short timeout, result cached by spec hash,
 * charged extra rate-limit tokens); on any failure the computed quote is returned and `verification` says
 * why. If official and computed differ by more than a cent the official numbers win and a warning is logged.
 */
const routes: RouteModule = (ctx) => {
  const { pricing, explore } = servicesFor(ctx);
  return [
    {
      method: 'POST',
      path: API_PATHS.quote,
      limit: 'write',
      handler: async (req) => {
        const body = parseBody(req.body);
        let canVerify = true;
        if (body.verify) canVerify = ctx.limiter.take('write', req.ip, VERIFY_COST).ok;
        return pricing.quote({
          spec: body.spec,
          months: body.months,
          verify: body.verify,
          canVerify,
          takenNames: explore.knownNames(),
        });
      },
    },
  ];
};

export default routes;
