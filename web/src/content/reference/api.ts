/**
 * Content of /reference/api: the hosts, the envelope and its errors, CORS and caching, rate limits, the
 * catalog (in `endpoints.data.ts`) and what is misleading. Also the Academy's own `/api/v1/*`, described
 * only as `shared/api.ts` describes it.
 *
 * Sources are FACTS.md section 10 (verified against FluxOS 8.20.0 and the live API on 2026-10-12).
 */

import { API_PATHS } from '@shared/api';
import { defaultSpec } from '@shared/flux';
import { andList } from './derive';
import { API_GROUPS, API_HOSTS, ENDPOINTS } from './endpoints.data';
import { ACADEMY_API, API_ADVICE, FDM, NODE_API, NODE_EXAMPLE_HOST, OBSERVED_API } from './facts';
import type { ApiGroupId, Endpoint, FactRow, Provenance } from './types';

export { API_GROUPS, API_HOSTS, ENDPOINTS };

export function endpointsOf(group: ApiGroupId): Endpoint[] {
  return ENDPOINTS.filter((e) => e.group === group);
}

/** The full URL of an endpoint's example. */
export function exampleUrl(e: Endpoint): string {
  return `${API_HOSTS[e.host].base}${e.example}`;
}

/** The spec the calculator example sends. A valid version 8 spec with a throwaway name. */
export function calculatorSpec(): string {
  const spec = defaultSpec();
  spec.name = 'my-price-check';
  return JSON.stringify(spec);
}

/** A runnable curl line (or two) for an endpoint. */
export function curlFor(e: Endpoint): string {
  const url = exampleUrl(e);
  if (e.method === 'POST') {
    return [
      `cat > spec.json <<'EOF'`,
      calculatorSpec(),
      'EOF',
      `curl -s -X POST -H 'Content-Type: text/plain' --data-binary @spec.json '${url}'`,
    ].join('\n');
  }
  return `curl -s${e.compressed ? ' --compressed' : ''} '${url}'`;
}

// ---------------------------------------------------------------------------
// Hosts
// ---------------------------------------------------------------------------

export interface HostRow {
  id: string;
  /** The URL or pattern, shown as code. */
  url: string;
  title: string;
  /** Markup. */
  text: string;
  prov: readonly Provenance[];
}

/** FACTS 10.1 and 10.8. */
export function buildHosts(): HostRow[] {
  return [
    {
      id: 'gateway',
      url: API_HOSTS.gateway.base,
      title: 'Gateway',
      text: `An HAProxy gateway in front of confirmed FluxNodes, which forwards to the FluxOS API of a node (the ${NODE_API.defaultPort} family of ports). Most paths are sticky by client address and a few are round robin. Every answer carries a \`${OBSERVED_API.nodeHeader}\` header that names the node that answered.`,
      prov: ['source', 'live'],
    },
    {
      id: 'stats',
      url: API_HOSTS.stats.base,
      title: 'Stats',
      text: 'A separate statistics service behind Cloudflare. It is not a FluxOS node. It answers with the same `{ status, data }` envelope.',
      prov: ['source', 'live'],
    },
    {
      id: 'node-https',
      url: 'https://<ip-with-dashes>-<port>.node.api.runonflux.io',
      title: 'One node over HTTPS',
      text: `A wrapper for one specific node, for example \`https://${NODE_EXAMPLE_HOST}-${NODE_API.defaultPort}.node.api.runonflux.io/flux/version\`. It answers with the same body as the node and \`${OBSERVED_API.corsHeader}\`. Use it from a web page.`,
      prov: ['live'],
    },
    {
      id: 'node-http',
      url: `http://<node-ip>:${NODE_API.defaultPort}`,
      title: 'One node over HTTP',
      text: 'A single node directly. A page served over HTTPS cannot call it, because browsers block mixed content, so use the wrapper above from a page.',
      prov: ['live'],
    },
    {
      id: 'rates',
      url: 'https://viprates.runonflux.io/rates',
      title: 'FLUX rate',
      text: 'The rates service the nodes use. It returns fiat rates per BTC and a BTC price per ticker. FLUX in USD is the USD rate times the FLUX price. It sets `access-control-allow-origin: *` and sits behind Cloudflare.',
      prov: ['source', 'live'],
    },
  ];
}

export function buildHostFacts(): FactRow[] {
  return [
    {
      id: 'node-ports',
      label: 'Node API ports',
      text: `${andList(NODE_API.ports.map(String))}. The default is ${NODE_API.defaultPort}. A node in the list from \`/daemon/listfluxnodes\` shows the port in \`ip\` unless it is the default.`,
      prov: ['source', 'live'],
    },
    {
      id: 'scope',
      label: 'Gateway or one node',
      text: 'Use the gateway for network wide data: chain height, node counts, app specs, locations and prices. Use one node for anything about that machine, such as its benchmark, tier or containers. Through the gateway a node local call returns whichever node was picked, so it is not about the network.',
      prov: ['docs', 'live'],
    },
    {
      id: 'sticky',
      label: 'Sticky or round robin',
      text: `The gateway keeps one client address on one node for most paths. Paths that begin with \`/apps/location\`, \`/apps/temporarymessages\` and a few more are round robin and carry \`${FDM.roundRobinHeader}\`, because each node holds its own data.`,
      prov: ['source', 'live'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Envelope and errors
// ---------------------------------------------------------------------------

export const ENVELOPE_SUCCESS = '{ "status": "success", "data": <anything> }';
export const ENVELOPE_ERROR =
  '{ "status": "error", "data": { "code": <optional>, "name": "Error", "message": "..." } }';

/** FACTS 10.2. */
export function buildEnvelopeFacts(): FactRow[] {
  return [
    {
      id: 'http-200',
      label: 'HTTP 200 for everything',
      text: 'Every handler answers HTTP 200 and puts the outcome in the body. An error is `status: "error"` with HTTP 200. Check `body.status === "success"`, never `response.ok`.',
      prov: ['source', 'live'],
    },
    {
      id: 'wire',
      label: 'When the wire status is not 200',
      text: 'Only before a handler runs: 403 for an HTTPS only endpoint over HTTP, 503 and 400 from route guards, 413 for a body that is too large, 404 for an unknown resource and 202 for a long operation.',
      prov: ['source'],
    },
    {
      id: 'html-404',
      label: 'An unknown path',
      text: 'An unknown path is an HTML 404 from Express: `Cannot GET /apps/doesnotexist`, with `content-type: text/html`. Parse JSON defensively.',
      prov: ['live'],
    },
    {
      id: 'empty',
      label: 'A filter that matches nothing',
      text: 'It is not an error: `{"status":"success","data":[]}`.',
      prov: ['live'],
    },
    {
      id: 'case',
      label: 'Names',
      text: 'App names are matched without regard to case on `/apps/appspecifications` and `/apps/location`. Pass plain names: the location route builds a regular expression from the path segment.',
      prov: ['source', 'live'],
    },
    {
      id: 'path-or-query',
      label: 'Path or query',
      text: 'A handler accepts a path segment or a query parameter of the same name: `/apps/location?appname=explorer` and `/apps/location/explorer` are the same.',
      prov: ['source'],
    },
    {
      id: 'warning',
      label: 'A third status',
      text: 'A `status: "warning"` shape exists in the source. None of the endpoints here returned it.',
      prov: ['source'],
    },
    {
      id: 'no-cache',
      label: 'Errors are not cached',
      text: 'The cache refuses a response whose status is `error`, and error responses carried `cache-control: no-cache, no-store, must-revalidate`.',
      prov: ['source', 'live'],
    },
  ];
}

/** A fetch helper that follows the envelope rules. Written for this page, not from FluxOS. */
export const FETCH_HELPER = `async function flux(path) {
  const res = await fetch('https://api.runonflux.io' + path);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('Not JSON (HTTP ' + res.status + ')');
  }
  if (body.status !== 'success') {
    throw new Error(body.data && body.data.message ? body.data.message : 'Flux API error');
  }
  return body.data;
}

const height = await flux('/daemon/getblockcount');`;

// ---------------------------------------------------------------------------
// CORS, caching, limits
// ---------------------------------------------------------------------------

/** FACTS 10.3. */
export function buildLimitFacts(): FactRow[] {
  return [
    {
      id: 'cors',
      label: 'CORS',
      text: `Every tested GET carried \`${OBSERVED_API.corsHeader}\`, on the gateway, on stats and on the rates service. A plain GET and a \`text/plain\` POST are simple requests and need no preflight. A \`zelidauth\` header or \`application/json\` would trigger one.`,
      prov: ['source', 'live'],
    },
    {
      id: 'preflight',
      label: 'Preflight and browsers',
      text: 'An OPTIONS preflight was not tested, and no fetch was run from a real browser page. The CORS statements are about response headers seen with curl.',
      prov: ['unverified'],
    },
    {
      id: 'cache',
      label: 'Server cache',
      text: `Most public GETs are cached on the node from ${OBSERVED_API.cacheShortestSec} seconds to ${OBSERVED_API.cacheLongestMin} minutes, route by route, keyed on the full URL. Only HTTP 200 and non error bodies are cached.`,
      prov: ['source'],
    },
    {
      id: 'client-cache',
      label: 'Client cache',
      text: '`cache-control: max-age=N` carries the remaining server cache life. Uncached handlers send no `cache-control` and an `etag`.',
      prov: ['live'],
    },
    {
      id: 'rate-node',
      label: 'Rate limits on a node',
      text: 'None on the read routes. The route table says "the API has no rate limiting". The only limited calls are the websocket peer messages and the payment relay, which answers 429 beyond its budget.',
      prov: ['source'],
    },
    {
      id: 'rate-gateway',
      label: 'Rate limits on the gateway and stats',
      text: 'No limit rule is in the gateway template and no `x-ratelimit` or `retry-after` header appeared on any response. The gateway may add limits outside the repository. The thresholds were not probed, so they are unknown.',
      prov: ['source', 'live', 'unverified'],
    },
    {
      id: 'timeout',
      label: 'Gateway timeout',
      text: `The sticky backend cuts a request after ${FDM.gatewayTimeoutSec} seconds and the round robin backend after ${FDM.gatewayRoundRobinTimeoutSec}. A heavy query that exceeds it is cut.`,
      prov: ['source'],
    },
    {
      id: 'compression',
      label: 'Compression',
      text: 'The server compresses with brotli when the client sends `Accept-Encoding`. With curl use `--compressed`. A browser does it for you.',
      prov: ['source', 'live'],
    },
    {
      id: 'latency',
      label: 'Latency',
      text: `Small responses took ${OBSERVED_API.latencySmall} from the test machine and 1 to 3 MB responses ${OBSERVED_API.latencyLarge} in total.`,
      prov: ['live'],
    },
  ];
}

export interface BudgetRow {
  id: string;
  pattern: string;
  advice: string;
}

/** FACTS 10.7. */
export function buildBudget(): BudgetRow[] {
  return [
    {
      id: 'counters',
      pattern: 'Counters on a landing page',
      advice: `One fetch per page view. Cache the answer for ${API_ADVICE.clientCache} in the client, and never poll faster than the server cache window.`,
    },
    {
      id: 'lookup',
      pattern: 'A lookup by app name',
      advice: 'Per user action. Debounce typing and do not fetch on every keystroke.',
    },
    {
      id: 'lists',
      pattern: 'Whole network lists',
      advice:
        'Fetch on a user action or at build time, with `Accept-Encoding` so the browser gets brotli, and prefer a filter or a projection.',
    },
    {
      id: 'quote',
      pattern: 'A price quote',
      advice: 'POST on a user action only, with `text/plain`.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Misleading
// ---------------------------------------------------------------------------

export interface MisleadingRow {
  id: string;
  item: string;
  status: string;
  prov: readonly Provenance[];
}

/** FACTS 10.9. */
export function buildMisleading(): MisleadingRow[] {
  return [
    {
      id: 'whitelist',
      item: '`/apps/whitelistedrepositories`',
      status:
        'Still routed and always `[]`. The whitelist is retired. Blocked images are a signed policy bundle.',
      prov: ['source', 'live'],
    },
    {
      id: 'blocked-routes',
      item: '`/flux/blockedrepositories` and `/flux/blockedports`',
      status: 'Deleted in FluxOS 8.19.0 and replaced by the signed policy bundle.',
      prov: ['docs'],
    },
    {
      id: 'removed',
      item: '`/apps/apppause`, `/apps/appunpause`, `/apps/appmonitorstream`, `/apps/startmonitoring` and `/apps/stopmonitoring`',
      status: 'Removed. They answer HTTP 200 with `data.code: 410`.',
      prov: ['docs', 'source'],
    },
    {
      id: 'min-instances',
      item: '`minimumInstances` in `/apps/deploymentinformation`',
      status: 'It says 3, but a version 8 spec may use 1. Docs elsewhere still say three. The source wins.',
      prov: ['source', 'docs'],
    },
    {
      id: 'fallbacks',
      item: '`fluxUSDRate` and `address` in `/apps/registrationinformation`',
      status: 'Configuration fallbacks: not the live FLUX rate and not the current payment address.',
      prov: ['source', 'live'],
    },
    {
      id: 'multiplier',
      item: '`stats` `/apps/multiplier`',
      status: 'A hard coded `8`. It has nothing to do with prices.',
      prov: ['source'],
    },
    {
      id: 'aliases',
      item: '`/zelid/*`, the `zelnode` names and `/flux/zelid`',
      status: 'Aliases of `/id/*`, the `fluxnode` names and `/flux/id`. Use the new names.',
      prov: ['source'],
    },
    {
      id: 'docs',
      item: 'The docs site',
      status:
        'It does not list endpoint URLs, apart from one link to the price table. The OpenAPI file is the only complete list.',
      prov: ['source'],
    },
  ];
}

/** FACTS 10.4: what the catalog leaves out, and why. */
export function buildExcluded(): FactRow[] {
  return [
    {
      id: 'auth',
      label: 'Anything that needs a login',
      text: 'Calls under `/id/*`, and app control, logs, file and volume routes on a node. They need a `zelidauth` header: a URL encoded `zelid`, `signature` and `loginPhrase`.',
      prov: ['source'],
    },
    {
      id: 'register',
      label: 'Registration and update',
      text: '`POST /apps/appregister`, `/apps/appupdate` and the verify calls change state or belong to the registration flow. They are not read only and are not called here.',
      prov: ['source'],
    },
    {
      id: 'admin',
      label: 'Node administration',
      text: 'Routes that update, restart, ban, sign or send a transaction. They are not reads.',
      prov: ['source'],
    },
    {
      id: 'decrypt',
      label: 'Decrypting an enterprise spec',
      text: '`?decrypt=true` is for the app owner and needs an `enterprise-key` header. Without it the answer is `Header with enterpriseKey is mandatory for enterprise Apps.`',
      prov: ['source', 'live'],
    },
  ];
}

// ---------------------------------------------------------------------------
// The Academy's own API
// ---------------------------------------------------------------------------

export interface AcademyRoute {
  id: string;
  method: 'GET' | 'POST';
  /** From `API_PATHS`. */
  path: string;
  /** The name of the shape in `shared/api.ts`. */
  shape: string;
  /** Markup. */
  text: string;
}

/** What `shared/api.ts` says about the Academy server's `/api/v1`. Nothing more. */
export function buildAcademyRoutes(): AcademyRoute[] {
  return [
    {
      id: 'network',
      method: 'GET',
      path: API_PATHS.network,
      shape: 'NetworkSnapshot',
      text: `Chain, rewards, nodes, capacity, apps, market and versions. Cached about ${ACADEMY_API.networkCacheSec} seconds on the server.`,
    },
    {
      id: 'geo',
      method: 'GET',
      path: API_PATHS.geo,
      shape: 'GeoSnapshot',
      text: 'Located nodes, countries and clustered points for the map. Cached for several minutes.',
    },
    {
      id: 'blocks',
      method: 'GET',
      path: API_PATHS.blocks,
      shape: 'BlocksSnapshot',
      text: `Recent blocks for the cadence line: whatever the server has buffered, up to ${ACADEMY_API.blocksMax}, newest last.`,
    },
    {
      id: 'pricing',
      method: 'GET',
      path: API_PATHS.pricing,
      shape: 'PricingSnapshot',
      text: 'The official per resource rates and the FLUX price, with where each came from: `live`, `cache` or `baked`.',
    },
    {
      id: 'quote',
      method: 'POST',
      path: API_PATHS.quote,
      shape: 'QuoteRequest, QuoteResponse',
      text: 'The price of a spec, with its lint. The body is `{ spec, months?, verify? }`. With `verify` the server may also confirm with the official calculator and says what happened.',
    },
    {
      id: 'lint',
      method: 'POST',
      path: API_PATHS.lint,
      shape: 'LintRequest, LintReport',
      text: 'Teachable validation of a spec. The body is `{ spec }`.',
    },
    {
      id: 'explore-app',
      method: 'GET',
      path: API_PATHS.exploreApp,
      shape: 'ExploreApp',
      text: 'Where a real running app lives now. Pass `?name=<app>`. An enterprise app only gives names and counts.',
    },
    {
      id: 'explore-search',
      method: 'GET',
      path: API_PATHS.exploreSearch,
      shape: 'ExploreSearch',
      text: `App names that start with \`?q=<prefix>\`, at most ${ACADEMY_API.searchMax}.`,
    },
    {
      id: 'stream',
      method: 'GET',
      path: API_PATHS.stream,
      shape: 'StreamEvent',
      text: `Server sent events: a \`hello\` first, then \`block\` and \`network\` events as they happen, and a ping every ${ACADEMY_API.streamPingSec} seconds.`,
    },
    {
      id: 'info',
      method: 'GET',
      path: API_PATHS.info,
      shape: 'ServiceInfo',
      text: 'The service name, version and the state of its upstream sources. Not cached.',
    },
    {
      id: 'healthz',
      method: 'GET',
      path: API_PATHS.healthz,
      shape: 'plain text',
      text: 'Liveness for the container platform. The body is `ok`.',
    },
  ];
}

export const ACADEMY_ENVELOPE =
  '{ "data": <payload>, "meta": { "generatedAt", "asOf", "ageMs", "stale", "source" } }';
export const ACADEMY_ERROR = '{ "error": { "code": "...", "message": "..." } }';
