# Flux Academy server

The API and static server for Flux Academy. Node 24+, TypeScript run directly (type stripping), **zero
runtime dependencies**: `node:http`, `node:zlib`, `node:fs`, `fetch`. It serves the built web app, the JSON
API and one SSE stream from a single port, and it keeps working when Flux's public APIs do not.

```
npm --prefix server run dev     # node --watch, PORT 42069, FIXTURES=1 for offline
npm --prefix server start       # production entry
npm --prefix server test        # node:test (also runs shared/**/*.test.ts)
npm --prefix server run typecheck
npm --prefix server run lint
npm --prefix server run bake    # regenerate src/data/baked.ts from the live network
```

Architecture, contracts and ports: `docs/ARCHITECTURE.md` (sections 1, 4, 5, 8, 9, 10, 11). Facts behind the
numbers: `docs/research/FACTS.md`. Adding an endpoint: `src/routes/README.md`.

## API

All JSON answers are `Envelope<T> = { data, meta }` (`shared/api.ts`). `meta.source` is `live` (fetched from
upstream inside the freshness window), `cache` (older, being served while a refresh runs) or `fallback`
(baked or simulated). `meta.stale` is `ageMs` greater than the endpoint's window. Errors are
`{ error: { code, message } }` with a real HTTP status.

| Method and path | Payload | Cache-Control | Refresh |
| --- | --- | --- | --- |
| `GET /api/v1/network` | `NetworkSnapshot`: chain, rewards, nodes by tier, capacity, apps, market, versions, per-section `freshness` | `max-age=5, swr=30` | node counts about 10 s, tip as blocks land |
| `GET /api/v1/geo` | `GeoSnapshot`: located and total nodes, countries (ISO code, name, tiers), at most 400 clustered points | `max-age=60, swr=300` | about 5 min |
| `GET /api/v1/blocks` | `BlocksSnapshot`: up to 120 recent blocks, newest last, with the measured interval | `max-age=5, swr=30` | block poll 3 to 5 s |
| `GET /api/v1/stream` | SSE: `hello`, `block`, `network`, `ping` | `no-store` | pushed |
| `GET /api/v1/info` | `ServiceInfo`: version, uptime, per-upstream health, `mode`, `sseClients` | `no-store` | n/a |
| `GET /healthz` | `ok` (never touches upstream, exempt from rate limiting) | `no-store` | n/a |

`/api/v1/pricing`, `/quote`, `/lint` and `/explore/*` are added by the Flux domain modules through the same
route extension point; `/api/v1/info` lists their upstreams automatically.

Every response carries a weak ETag (computed from the data and `asOf`, not from the ticking clock) so a
poller revalidating flat data gets `304`. JSON over 1 KB is brotli or gzip compressed.

### Stream (SSE)

`event: <type>` then one-line `data: <json>`. A `retry: 5000` line comes first.

| Event | Data | When |
| --- | --- | --- |
| `hello` | `{ serverTime, network, networkMeta }`: the same snapshot and meta REST would give right now | once, on connect (reconnects are idempotent) |
| `block` | `{ height, time, txCount }` | each new block |
| `network` | `Envelope<NetworkSnapshot>` | when the snapshot changes in substance |
| `ping` | `{}`, preceded by a `: ping` comment | every 20 s (`SSE_HEARTBEAT_MS`) |

Caps: `SSE_MAX_CLIENTS` total (503), `SSE_MAX_PER_IP` per address (429). A client whose socket queue exceeds
`SSE_MAX_BUFFER_BYTES` is dropped (EventSource reconnects). The server never labels a streamed network
payload fresher than REST would.

## Upstreams

Everything outbound goes through one client (`src/core/upstream.ts`): allow-listed origins only, a timeout,
a response size cap, jittered retry for network errors, 5xx and 429, a circuit breaker per origin, and for
cached calls single-flight, stale-while-revalidate and conditional requests. Redirects are never followed.

| Origin (label) | Call | Used for | Cadence |
| --- | --- | --- | --- |
| `api.runonflux.io` (`flux-api`) | `/daemon/getblockcount`, then `/daemon/getblockhash/<tip+1>?nc=<buster>` | detect a new block within seconds | 3 s (5 s right after a block) |
| | `/daemon/getblock/<hash or height>/1` | block time, tx count, backfill of the 120 block buffer | per block |
| | `/daemon/getfluxnodecount` | nodes by tier | 10 s |
| | `/daemon/getblocksubsidy/<height>` | verify the reward schedule against the daemon | 10 min and on a reduction boundary |
| | `/apps/globalappsspecifications` (conditional) | registered app count | 30 min |
| | `/apps/locations` | running app count | 10 min |
| `stats.runonflux.io` (`stats`) | `/fluxinfo?projection=...` | capacity, versions, geography | 5 min |
| `viprates.runonflux.io` (`market`) | `/rates` | FLUX in USD: `USD.rate * FLUX`, the price FluxOS itself uses | 60 s |
| `api.coingecko.com` (`coingecko`) | `/api/v3/simple/price?ids=zelcash` | 24 h change and market cap; the price if the rates service is down | cached 5 min, stale up to 1 h |

Quirks the code handles (verified against the live API, see FACTS.md section 10):

- Errors arrive as HTTP 200 with `{"status":"error","data":{...}}`; success is `body.status === 'success'`.
- Daemon calls sit behind a 20 s RPC cache that only stores successes. `getblockhash` for a height that does
  not exist yet is an error (code -8, "Block height out of range"), so polling `tip+1` with a unique query
  string sees a block the moment the daemon has it. That error is an expected answer, not a failure.
- Unreachable nodes in `/fluxinfo` come back with `error: {}` and zeroed placeholders: they count in
  `geo.total` and are never located or summed into capacity.
- An implausibly small answer (under 100 fleet rows, under 50 apps) is rejected so a partial outage cannot
  erase the map or the counts.

### Facts encoded here

| Constant | Value | Source |
| --- | --- | --- |
| Block interval | 30 s target (Proof of Node since height 2,020,000) | FACTS 1.4, 5.1 |
| Subsidy | 14 FLUX per block, split 9 / 3.5 / 1 / 0.5 (Stratus, Nimbus, Cumulus, dev fund) | FACTS 1.4 |
| Reductions | x 0.9 every 1,051,200 blocks from 2,020,000, at most 20; first at 3,071,200 (14 to 12.6) | FACTS 1.4 |
| Collateral | Cumulus 1,000, Nimbus 12,500, Stratus 40,000 FLUX | FACTS 2.1 |

The reward schedule is computed from these (`src/flux/rewards.ts`) and compared with `getblocksubsidy`; if
the daemon disagrees, the daemon's number wins and a warning is logged. The next-reduction ETA uses the
measured block interval when it is within 0.5x to 2x of the target (`shared/chain.ts`).

## Resilience and fallback

- **Never blocks on upstream.** Handlers read in-memory snapshots refreshed by pollers.
- **Baked fallback** (`src/data/baked.ts`, generated by `npm run bake`): network, geography and the last 120
  blocks. Served with `source: 'fallback'` whenever there is no upstream data since boot. It carries no
  price; a months-old price would mislead. Regenerate it before a release.
- **`FIXTURES=1`** disables the upstream client entirely and simulates a block every 30 s from the baked
  data, always labelled `fallback`. For development, tests and the CI smoke test.
- **Multiple instances** run in production. No instance-local state matters: each keeps its own caches.

## Static files, head injection, SEO

- `WEB_DIST` (default `../web/dist`). Missing: the API still works and `/` explains.
- `/assets/*` is immutable for a year; HTML is `no-cache`; other files get an hour with
  stale-while-revalidate. ETag and `If-None-Match`, `Last-Modified`, byte ranges (media), br or gzip for
  text over 1 KB (a precompressed `.br` or `.gz` sibling wins; otherwise an in-memory LRU).
- **Head injection.** The shell (`index.html`) is rewritten per route from `shared/site.ts` and
  `shared/curriculum.ts`: `<title>`, description, canonical, Open Graph, Twitter, plus JSON-LD (`WebSite`
  on `/`, `Course` on `/learn`, `LearningResource` for lessons, `BreadcrumbList` below the home page).
  Every value is escaped and JSON-LD cannot close its script tag. The result is cached per route (bounded
  by the route table) with its own ETag.
- **404.** A path that is not in the route table (and has no file) answers `404` with the app shell,
  `noindex`, no canonical and a fixed head: nothing from the URL is reflected.
- **Redirects.** `REDIRECTS` (old Next.js URLs) answer `301`, query string preserved, trailing slash
  tolerated.
- **`/sitemap.xml`, `/robots.txt`** are generated from `allRoutes()`; `/api/` is disallowed.

## Security

CSP exactly as in ARCHITECTURE section 8, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, a minimal `Permissions-Policy`, COOP `same-origin`, CORP `same-origin`
(static media is `cross-origin` so social cards embed), `X-Frame-Options: SAMEORIGIN`, and HSTS only when a
trusted proxy (`TRUST_PROXY`) reports HTTPS. `X-Powered-By` is never set. Per-IP token buckets: reads
(150 burst, 30/s), POST (30 burst, 3/s), streams, and `/healthz` exempt. POST bodies are JSON only
(`Content-Type: application/json`, 415 otherwise), capped at 64 KiB (413). Static paths refuse dotfiles,
traversal, NUL bytes and symlinks leaving the web root. The explore proxy and any other route reach
upstream only through the allow-listed client.

## Operations

- **Logs:** one JSON object per line on stdout (`LOG_LEVEL`). Request lines at `info` except health and
  assets (`debug`). Visitor IPs are never logged.
- **Shutdown:** `SIGTERM` or `SIGINT` stops the pollers, ends SSE streams, drains the HTTP server (10 s hard
  limit) and exits 0.
- **Health:** `GET /healthz` for the platform; `GET /api/v1/info` for upstream status
  (`ok`, `lastOkAt`, `lastError`) and connected stream clients.
- **Production start-up** (`NODE_ENV=production`) exits non-zero if a route module failed to load, rather
  than serving a partial API.
- **Black-box check of a running server or container:** `node server/scripts/smoke.ts http://127.0.0.1:42069`.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `42069` | Listen port (`0` picks a free one). |
| `HOST` | `0.0.0.0` | Listen address. |
| `WEB_DIST` | `../web/dist` | Built web app. The image sets `/app/web`. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent`. |
| `TRUST_PROXY` | off | Trusted proxy hops (`true` = 1, or 1 to 9) for client IP and HSTS. |
| `CORS_ORIGINS` | none | Allowed cross-origin readers (comma separated origins, or `*`). |
| `FIXTURES` | `0` | Offline simulated data labelled `fallback`. Never in production. |
| `FLUX_API_URLS` | `https://api.runonflux.io` | Flux API bases, tried in order. |
| `FLUX_STATS_URL` | `https://stats.runonflux.io` | Stats service. |
| `MARKET_URL` | `https://viprates.runonflux.io` | Rates service (FLUX in USD). |
| `MARKET_FALLBACK_URL` | `https://api.coingecko.com` | 24 h change, market cap, price fallback. |
| `UPSTREAM_TIMEOUT_MS` | `10000` | Per-attempt timeout. |
| `UPSTREAM_USER_AGENT` | `FluxAcademy/2.0 (...)` | Sent to upstreams. |
| `BLOCK_POLL_FAST_MS` / `BLOCK_POLL_SLOW_MS` | `3000` / `5000` | Block poll gaps. |
| `NETWORK_REFRESH_MS` | `10000` | Node counts. |
| `GEO_REFRESH_MS` | `300000` | Capacity, versions, geography. |
| `PRICE_REFRESH_MS` | `60000` | FLUX price. |
| `APPS_RUNNING_REFRESH_MS` / `APPS_REGISTERED_REFRESH_MS` | `600000` / `1800000` | App counts. |
| `RATE_LIMIT_BURST` / `RATE_LIMIT_RPS` | `150` / `30` | Read bucket per client (pages and GET routes). |
| `RATE_LIMIT_WRITE_BURST` / `RATE_LIMIT_WRITE_RPS` | `30` / `3` | POST bucket per client. |
| `RATE_LIMIT_STATIC_BURST` / `RATE_LIMIT_STATIC_RPS` | `1500` / `300` | Bucket per client for the build files a page loads (`/assets`, `/art`, `/brand`). A first visit fetches dozens, so they do not share the read bucket: a classroom behind one address would otherwise get a 429 on a script. |
| `BODY_LIMIT_BYTES` | `65536` | POST body cap. |
| `SSE_MAX_CLIENTS` / `SSE_MAX_PER_IP` | `2000` / `8` | Stream caps. |
| `SSE_MAX_BUFFER_BYTES` | `262144` | Slow consumer threshold. |
| `SSE_HEARTBEAT_MS` | `20000` | Heartbeat interval. |
| `COMPRESS_CACHE_BYTES` | `33554432` | In-memory compressed text cache. |

A copy-paste version with comments is in `server/.env.example`. Invalid values fail start-up with every
problem listed at once.

## Layout

```
src/main.ts, server.ts, config.ts    entry, wiring (route discovery, context), env parsing
src/core/                            context (the extension contract), log, clock, breaker, single-flight,
                                     swr cell, loop, upstream client
src/http/                            app (dispatch), router, static, head, seo, security, ratelimit,
                                     compress, respond, client-ip
src/flux/                            typed upstream readers (daemon, stats, apps, market) and the reward schedule
src/services/                        blocks watcher, network assembler, sse hub, runtime (live and fixtures)
src/routes/                          one module per endpoint group (README.md is the contract)
src/data/                            baked fallback (generated)
scripts/                             bake-fallback.ts, smoke.ts
test/                                node:test; helpers boot the real server on port 0
```
