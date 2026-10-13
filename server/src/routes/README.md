# Server routes

Every file in this directory (except this README and files starting with `_`) is a **route module**. It is
discovered by listing the directory when the server starts, so adding an endpoint is adding a file; no
central registry is edited.

```ts
// server/src/routes/example.ts
import { API_PREFIX } from '../../../shared/api.ts';
import { computed, HttpError, type RouteModule } from '../core/context.ts';

const routes: RouteModule = (ctx) => [
  {
    method: 'GET',
    path: `${API_PREFIX}/example/:name`,
    handler: async ({ params, query }) => {
      if (!/^[a-z0-9]{1,24}$/.test(params.name ?? '')) throw new HttpError(400, 'bad_name', 'Invalid name');
      return computed({ hello: params.name, price: ctx.market.fluxUsd().value }, ctx.clock.now());
    },
  },
];

export default routes;
```

## Contract

- **Module**: `export default (ctx: AppContext) => RouteDef[]`. Called once at start-up. Build services and
  start pollers here (`ctx.schedule`, `ctx.onStop`); do not do work at import time.
- **Types** live in `server/src/core/context.ts`: `RouteModule`, `RouteDef` (`JsonRouteDef` or
  `RawRouteDef`), `RouteRequest`, `RouteResult`, `Served`, `AppContext`, `HttpError`, `computed()`.
- **Path**: exact, or with `:param` segments. API paths start with `/api/v1/` (use `API_PATHS` from
  `shared/api.ts`). Exact paths win over parameterised ones; two modules may not claim the same
  method and path (start-up fails loudly).
- **Rate limit**: `limit` is `'read'` (default for GET), `'write'` (default for POST, stricter), `'stream'`
  or `'exempt'` (`'static'` is for the build files the server itself serves, not for routes). The per-IP token bucket is applied before your handler runs.
- **Body**: POST only. JSON, `Content-Type: application/json`, capped at 64 KiB (`maxBodyBytes` may lower
  it). Your handler receives the parsed value as `req.body: unknown`; validate it.
- **Result**: return `{ data, asOfMs, source, windowMs }` (a `Served<T>`). The server wraps it as
  `Envelope<T>` with `meta` (`source` live/cache/fallback, `ageMs`, `stale`), a weak ETag, br/gzip and the
  cache headers. For something computed from the request alone use `computed(data, ctx.clock.now())`.
  Return `source: 'fallback'` whenever the data is baked in or simulated; never label it `live`.
- **Errors**: `throw new HttpError(status, code, message)` becomes `{ error: { code, message } }`. Any
  other thrown error becomes a 500 with a generic message (and is logged).
- **Streaming or text**: use `raw: (req, res, ip) => void` instead of `handler`; you own the response.
- **Never reflect input** (query, params, body fields) into a response without validating it against a
  strict pattern first.

## What the context gives you

| Member | Use |
| --- | --- |
| `ctx.config` | Parsed env (`config.upstream.fluxApi`, `config.limits`, ...). Read only. |
| `ctx.log`, `ctx.clock` | JSON logger; injectable time. |
| `ctx.fixtures` | `FIXTURES=1`: no upstream calls succeed, data is simulated and labelled `fallback`. |
| `ctx.upstream.get(url, { key, ttlMs, staleMs, timeoutMs, validate })` | Cached, single-flight, retrying, circuit-broken GET of an allow-listed host. Returns `{ value, fetchedAt, ageMs, source, stale }`. Throws `UpstreamError` or `BreakerOpenError`; catch and serve a fallback. |
| `ctx.limiter.take(class, ip, cost)` | Charge extra tokens for an expensive handler. |
| `ctx.market.fluxUsd()` | `{ value, asOf, asOfMs, source }`, synchronous, from the price poller. |
| `ctx.network.snapshot()`, `ctx.geo.snapshot()`, `ctx.blocks.snapshot()` | The pollers' latest data, as `Served<T>`. |
| `ctx.hub.broadcast(event)` | Push a `StreamEvent` to every SSE client. |
| `ctx.schedule(name, ms, fn)`, `ctx.onStop(fn)` | Pollers and shutdown hooks, owned by the server lifecycle. |

Allow-listed upstream hosts are the origins of `config.upstream.*` (`FLUX_API_URLS`, `FLUX_STATS_URL`,
`MARKET_URL`, `MARKET_FALLBACK_URL`). To reach another host add it to the allow-list in `server/src/config.ts`; a route cannot
fetch an arbitrary URL.

## Testing a route

`server/test/helpers.ts` boots the real server on port 0 with `FIXTURES=1`. To test a module of your own
without touching this directory, pass it in:

```ts
const s = await startFixtureServer({}, { extraRoutes: [myModule] });
```

and use `request(s.port, '/api/v1/example/abc')`. A fake `fetch` can be injected with `{ fetch }` so
`ctx.upstream` answers canned responses.
