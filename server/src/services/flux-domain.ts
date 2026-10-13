/**
 * One PricingService and one ExploreService per AppContext, shared by the four route modules of the Flux
 * domain (pricing, quote, lint, explore). Route modules are loaded independently, so the pair is created on
 * first use and remembered on the context object itself (a WeakMap, so tests with many contexts are fine).
 */
import type { AppContext } from '../core/context.ts';
import { ExploreService } from './explore.ts';
import { PricingService } from './pricing.ts';

export interface FluxDomainServices {
  pricing: PricingService;
  explore: ExploreService;
}

const made = new WeakMap<AppContext, FluxDomainServices>();

export function servicesFor(ctx: AppContext): FluxDomainServices {
  const have = made.get(ctx);
  if (have) return have;
  const apiBase = ctx.config.upstream.fluxApi[0] as string;
  const svc: FluxDomainServices = {
    pricing: new PricingService({
      upstream: ctx.upstream,
      apiBase,
      market: ctx.market,
      clock: ctx.clock,
      log: ctx.log.child({ svc: 'pricing' }),
    }),
    explore: new ExploreService({
      upstream: ctx.upstream,
      apiBase,
      statsBase: ctx.config.upstream.stats,
      clock: ctx.clock,
      log: ctx.log.child({ svc: 'explore' }),
      tipHeight: () => ctx.blocks.tip()?.height ?? null,
      fixtures: ctx.fixtures,
    }),
  };
  made.set(ctx, svc);
  return svc;
}
