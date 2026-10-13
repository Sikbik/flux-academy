/**
 * Flux Academy API contract, v1.
 *
 * The single source of truth for the shapes exchanged between `server/` and `web/`.
 * Both sides import this file. Changes must be ADDITIVE (new optional fields, new
 * endpoints); never rename or remove a field without updating both sides in the
 * same change.
 *
 * ERASABLE TYPESCRIPT ONLY: no enums, namespaces or parameter properties, and
 * no imports of runtime packages. Node runs this file directly with type
 * stripping, and Vite bundles it as-is. Relative imports use the `.ts` extension.
 */

import type { LintReport, PricingParams, Quote } from './flux/types.ts';

export const API_VERSION = 1 as const;
export const API_PREFIX = '/api/v1' as const;

/** Endpoint paths, relative to the site origin. */
export const API_PATHS = {
  /** GET: NetworkSnapshot (cached ~10 s server side). */
  network: `${API_PREFIX}/network`,
  /** GET: GeoSnapshot (cached several minutes). */
  geo: `${API_PREFIX}/geo`,
  /** GET: recent blocks for the cadence sparkline. */
  blocks: `${API_PREFIX}/blocks`,
  /** GET: PricingSnapshot, the official per-resource rates plus the FLUX price. */
  pricing: `${API_PREFIX}/pricing`,
  /** POST: QuoteRequest -> Envelope<QuoteResponse>. The price of a spec. */
  quote: `${API_PREFIX}/quote`,
  /** POST: LintRequest -> Envelope<LintReport>. Teachable validation of a spec. */
  lint: `${API_PREFIX}/lint`,
  /** GET ?name=<app>: ExploreApp. Where a real, running app lives right now. */
  exploreApp: `${API_PREFIX}/explore/app`,
  /** GET ?q=<prefix>: ExploreSearch. Find real app names to look at. */
  exploreSearch: `${API_PREFIX}/explore/search`,
  /** GET (text/event-stream): StreamEvent frames. */
  stream: `${API_PREFIX}/stream`,
  /** GET: ServiceInfo. Not cached. */
  info: `${API_PREFIX}/info`,
  /** GET: liveness for the container platform. Plain `ok`. */
  healthz: '/healthz',
} as const;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type Tier = 'cumulus' | 'nimbus' | 'stratus';
export const TIERS: readonly Tier[] = ['cumulus', 'nimbus', 'stratus'];

export interface TierCounts {
  cumulus: number;
  nimbus: number;
  stratus: number;
}

/**
 * Where a payload came from. The UI must be honest about this:
 * `live`     fetched from upstream within the freshness window
 * `cache`    older than the window, still being served (stale-while-revalidate)
 * `fallback` the server has no upstream data at all and is serving a baked-in
 *            snapshot (also what the web app uses when the API is unreachable)
 */
export type DataSource = 'live' | 'cache' | 'fallback';

export interface Meta {
  /** ISO-8601 UTC time the server produced this response. */
  generatedAt: string;
  /** ISO-8601 UTC time the underlying data was fetched from upstream. */
  asOf: string;
  /** Milliseconds between `asOf` and `generatedAt`. */
  ageMs: number;
  /** True when `ageMs` exceeds the endpoint's freshness window. */
  stale: boolean;
  source: DataSource;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// GET /api/v1/network
// ---------------------------------------------------------------------------

export interface ChainInfo {
  /** Tip block height. */
  height: number;
  /** ISO-8601 UTC time of the tip block header. */
  tipTime: string;
  /** Protocol target block interval in seconds (30 under Proof of Node). */
  targetBlockSec: number;
  /** Measured mean interval over the most recent blocks the server has seen. */
  measuredBlockSec: number | null;
  /** Display label for the consensus mechanism, e.g. "Proof of Node". */
  consensus: string;
}

export interface NextReduction {
  /** Block height at which the subsidy steps down. */
  height: number;
  blocksAway: number;
  /** Estimated ISO-8601 UTC time (see `effectiveBlockSec` in shared/chain.ts). */
  etaIso: string;
  /** Fractional cut, 0.1 means the subsidy drops by 10 percent. */
  fraction: number;
  /** Total FLUX created per block after the reduction. */
  perBlockAfter: number;
  epochStartHeight?: number;
  epochBlocks?: number;
  index?: number;
  of?: number;
}

export interface RewardSchedule {
  /** FLUX created per block now, all outputs included. */
  perBlock: number;
  /** FLUX paid per block to the one node of each tier. */
  perTier: TierCounts;
  /** FLUX per block to the development fund. */
  devFund: number;
  /** null when unknown or when the schedule has no further reductions. */
  nextReduction: NextReduction | null;
}

export interface NodeStats {
  total: number;
  tiers: TierCounts;
  /** Collateral in FLUX needed per tier. */
  collateral: TierCounts;
  /** Distinct countries with a located node, null until geo data exists. */
  countries: number | null;
}

export interface CapacityStats {
  cores: number;
  ramTb: number;
  ssdTb: number;
  /** Nodes whose benchmark passed and that are summed above (a subset of nodes.total). */
  reporting?: number;
}

export interface AppsStats {
  /** Apps registered on chain. */
  registered: number | null;
  /** Apps with at least one running instance. */
  running: number | null;
}

export interface MarketStats {
  priceUsd: number;
  change24hPct: number | null;
  marketCapUsd: number | null;
}

export interface NetworkSnapshot {
  chain: ChainInfo;
  rewards: RewardSchedule;
  nodes: NodeStats;
  capacity: CapacityStats | null;
  apps: AppsStats | null;
  market: MarketStats | null;
  versions: { fluxos: string | null; daemon: string | null };
  /**
   * When each section was last refreshed from upstream (ISO-8601 UTC), null when the section is null or
   * has never been fetched. The envelope `meta` describes the snapshot as a whole; this lets the UI label
   * individual tiles honestly.
   */
  freshness?: {
    chain: string | null;
    nodes: string | null;
    capacity: string | null;
    apps: string | null;
    market: string | null;
  };
}

// ---------------------------------------------------------------------------
// GET /api/v1/geo
// ---------------------------------------------------------------------------

export interface GeoPoint {
  lat: number;
  lon: number;
  /** Nodes clustered into this point. */
  n: number;
  /** ISO 3166-1 alpha-2 of the dominant country among the nodes in this point. Omitted when unknown. */
  cc?: string;
  /** [cumulus, nimbus, stratus] counts inside this point. */
  t: [number, number, number];
}

export interface GeoCountry {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  nodes: number;
  tiers: TierCounts;
}

export interface GeoSnapshot {
  /** Nodes with a usable location. */
  located: number;
  /** All nodes the server counted, located or not. */
  total: number;
  countries: GeoCountry[];
  /** Clustered to a coarse grid server side; at most a few hundred points. */
  points: GeoPoint[];
}

// ---------------------------------------------------------------------------
// GET /api/v1/blocks
// ---------------------------------------------------------------------------

export interface BlockSummary {
  height: number;
  /** ISO-8601 UTC. */
  time: string;
  /** Seconds since the previous block, null for the oldest entry. */
  intervalSec: number | null;
  txCount: number | null;
}

export interface BlocksSnapshot {
  /** Newest last. Whatever the server has buffered, up to 120 entries. */
  blocks: BlockSummary[];
}

// ---------------------------------------------------------------------------
// GET /api/v1/pricing
// ---------------------------------------------------------------------------

export interface PricingSnapshot {
  /** The official per-resource rates currently in force. */
  params: PricingParams;
  /** FLUX/USD price used for conversions, null when unknown. */
  fluxUsd: number | null;
  /** Where `params` came from: the live API, the server cache, or the baked-in snapshot. */
  paramsSource: 'live' | 'cache' | 'baked';
  /**
   * Where `fluxUsd` came from. `baked` means no live price is known and `fluxUsd` is the built-in snapshot
   * (see `BAKED_PRICING.capturedAt`); the UI must say so. Added after v1; absent from older servers.
   */
  fluxSource?: 'live' | 'cache' | 'baked';
  /** ISO-8601 UTC date of the baked snapshot, present when `paramsSource` or `fluxSource` is `baked`. */
  bakedAt?: string;
}

// ---------------------------------------------------------------------------
// POST /api/v1/quote
// ---------------------------------------------------------------------------

export interface QuoteRequest {
  /** A full or partial spec; missing fields are defaulted and reported, never trusted. */
  spec: unknown;
  /** Subscription months to total (1 to 12). Defaults to 1. */
  months?: number;
  /**
   * Ask the server to also confirm the price with the official Flux calculator. The server may decline
   * (rate limit, upstream down) and return the locally computed quote with `basis: 'computed'`.
   */
  verify?: boolean;
}

export interface QuoteResponse {
  quote: Quote;
  /** Lint of the same spec, so one round trip is enough for a calculator UI. */
  lint: LintReport;
  /**
   * What happened to `verify: true`. Absent when verification was not requested. `confirmed` means the
   * official calculator agreed within a cent (or its numbers replaced ours, see `drift`).
   */
  verification?: {
    requested: boolean;
    confirmed: boolean;
    /** Why it could not be confirmed: `rate_limited`, `upstream_unavailable`, `enterprise`, `fixtures`. */
    reason?: string;
    /** The official USD answer, when one was obtained. */
    officialUsd?: number;
    /** True when the official number differed from the computed one by more than a cent. */
    drift?: boolean;
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/lint
// ---------------------------------------------------------------------------

export interface LintRequest {
  spec: unknown;
}

export type LintResponse = LintReport;

// ---------------------------------------------------------------------------
// GET /api/v1/explore/app  and  /api/v1/explore/search
// ---------------------------------------------------------------------------

export interface ExploreInstance {
  /** Node IP (the public identity of a FluxNode). Ports are never included. */
  ip: string;
  tier: Tier | null;
  /** ISO 3166-1 alpha-2, null when unknown. */
  cc: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  /** ISO-8601 UTC time the node broadcast that it runs the app, when known. */
  broadcastedAt: string | null;
}

export interface ExploreComponent {
  name: string;
  /** Image reference, as registered. */
  repotag: string;
  cpu: number;
  ram: number;
  hdd: number;
  /** Public ports. */
  ports: number[];
}

export interface ExploreApp {
  name: string;
  description: string;
  version: number;
  instancesWanted: number;
  instancesRunning: number;
  /** Block height of the registration or last update, when known. */
  height: number | null;
  /** Remaining subscription in blocks, null when unknown. */
  blocksRemaining: number | null;
  components: ExploreComponent[];
  instances: ExploreInstance[];
  /** Enterprise apps hide their spec: only names and counts are available. */
  enterprise: boolean;
  /** Where this lookup can be repeated by hand, so learners see the real call. */
  docs: { specUrl: string; locationUrl: string };
}

export interface ExploreSearch {
  query: string;
  /** Matching app names, capped (at most 25), sorted by running instance count when known. */
  names: { name: string; instances: number | null }[];
}

// ---------------------------------------------------------------------------
// GET /api/v1/stream   (Server-Sent Events)
// ---------------------------------------------------------------------------
// Wire format is standard SSE: `event: <type>` then `data: <json>`. The server
// sends a `hello` first, then events as they happen, plus a `: ping` comment
// and an `event: ping` frame every 20 s. Browsers reconnect on their own;
// `hello` makes that idempotent.
//
// `network` events carry the SAME Envelope<T> the REST endpoint returns, with
// `meta.source` exactly what REST would say at that moment, so a streamed
// payload is never labelled `live` unless it came from a live upstream fetch
// within its freshness window.

export interface BlockEvent {
  height: number;
  /** ISO-8601 UTC time of the block header. */
  time: string;
  txCount: number | null;
}

export interface HelloEvent {
  /** ISO-8601 UTC server clock, so clients can correct for skew. */
  serverTime: string;
  network: NetworkSnapshot | null;
  /** Same semantics as `Envelope.meta` for `network`. */
  networkMeta?: Meta | null;
}

export type StreamEvent =
  | { type: 'hello'; data: HelloEvent }
  | { type: 'block'; data: BlockEvent }
  | { type: 'network'; data: Envelope<NetworkSnapshot> }
  | { type: 'ping'; data: Record<string, never> };

export const STREAM_EVENT_TYPES = ['hello', 'block', 'network', 'ping'] as const;

// ---------------------------------------------------------------------------
// GET /api/v1/info
// ---------------------------------------------------------------------------

export interface UpstreamStatus {
  ok: boolean;
  lastOkAt: string | null;
  lastError: string | null;
}

export interface ServiceInfo {
  name: string;
  version: string;
  startedAt: string;
  uptimeSec: number;
  upstream: Record<string, UpstreamStatus>;
  /** `fixtures` when the server runs offline with simulated data (dev and CI only). */
  mode?: 'live' | 'fixtures';
  /** Currently connected SSE clients. */
  sseClients?: number;
}
