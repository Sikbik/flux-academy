/**
 * Flux application model: the shapes the academy teaches, edits, lints and prices.
 *
 * Owner: the flux domain engineer (see docs/ARCHITECTURE.md section 5). Verified against FluxOS 8.20.0
 * (`ZelBack/src/services/appRequirements/appValidator.js`, `utils/appUtilities.js`, `utils/appSpecHelpers.js`)
 * and the live API on 2026-10-12. Changes from here on are ADDITIVE only.
 *
 * Corrections made to the orchestrator's skeleton (all verified in FluxOS source, see spec.ts LIMITS):
 * - component `secrets` removed: v7 only. A v8 component accepts exactly name, description, repotag, ports,
 *   containerPorts, domains, environmentParameters, commands, containerData, repoauth, cpu, ram, hdd.
 * - `datacenter` added (v8, optional boolean, privileged).
 * - `PricingParams.scope` is the surcharge for `nodes` pinning and enterprise apps, not for geolocation.
 * - `Quote.lines` sum to `usdTotal` (the whole subscription), which equals one month when `months` is 1.
 *
 * ERASABLE TYPESCRIPT ONLY: no enums, namespaces or parameter properties, and no runtime imports.
 * Node runs these files directly with type stripping and Vite bundles them as-is. Pure and
 * framework-free: nothing here may touch `window`, `document` or Node built-ins.
 */

// ---------------------------------------------------------------------------
// The specification
// ---------------------------------------------------------------------------

/** One container of an app (a "component" in the spec's `compose` array). */
export interface FluxComponentSpec {
  /**
   * Component name, unique inside the app. Letters and digits only (even in v8), at most 63 characters,
   * must not start with `zel` or `flux`. Becomes part of the container name `flux<component>_<app>`.
   */
  name: string;
  /** Free text, at most 256 characters. */
  description: string;
  /** Docker image reference: `[registry/][namespace/]image[:tag]`. At most 200 characters. */
  repotag: string;
  /**
   * Registry credentials for a private image. Only allowed on enterprise apps (v8), where it is stored
   * encrypted. Empty string for public images. NEVER put real credentials in a spec you share.
   */
  repoauth: string;
  /** Public ports the network exposes for this component, 1 to 65535, at most 5 per component. */
  ports: number[];
  /** Ports the container listens on (0 to 65535), index-aligned with `ports`. */
  containerPorts: number[];
  /** Custom domains, index-aligned with `ports`. An empty string means no custom domain. */
  domains: string[];
  /** Environment variables as `KEY=value` strings, at most 20, each at most 400 characters. */
  environmentParameters: string[];
  /** Arguments passed to the image's entrypoint (docker `Cmd`), at most 20, each at most 400 characters. */
  commands: string[];
  /**
   * Persistent data mounts, pipe separated: `[flags]:<path>` for the primary mount (flags `r`, `g`, `s`),
   * then optional `m:`, `ml:`, `f:`, `c:`, `cf:` and `<n>:` mounts. At least 2 and at most 200 characters.
   */
  containerData: string;
  /** CPU cores. The FluxCloud form uses steps of 0.1; the network sums them against the node limit. */
  cpu: number;
  /** RAM in MB. The FluxCloud form uses steps of 100. */
  ram: number;
  /** Disk in GB. The FluxCloud form uses steps of 1. */
  hdd: number;
}

/** A full application specification (v8, the only version the network accepts for new work). */
export interface FluxAppSpec {
  /** Always 8 for what this engine produces. */
  version: number;
  /** Letters, digits and inner hyphens, at most 63 characters, must not start with `zel` or `flux`. */
  name: string;
  /** Free text, at most 256 characters. */
  description: string;
  /** The Flux ID (or Ethereum address) that signs registration and updates. */
  owner: string;
  /** Number of running copies across the network. 1 to 100 for v8 (minimum was 3 before block 2176519). */
  instances: number;
  /** Ask for nodes with a static, directly reachable public address. A priced add-on. */
  staticip: boolean;
  /**
   * Encrypted enterprise blob (v8). Empty string for a regular app. When set, compose and contacts are
   * sealed inside it on chain; the Academy only models the empty case in detail.
   */
  enterprise: string;
  /** Up to 5 contact strings (email or URL), each at most 75 characters. */
  contacts: string[];
  /** Placement constraints, for example `acEU`, `acEU_DE`, `a!cNA_US` (see `parseGeolocationEntry`). At most 10 entries. */
  geolocation: string[];
  /** Subscription length in blocks. 1 to 1056000. One month is 88000 blocks at the 30 s block time. */
  expire: number;
  /** Node pinning (outpoints or IPs). Enterprise owners only for v8. At most 120 entries. */
  nodes: string[];
  compose: FluxComponentSpec[];
  /** Require a data center node (v8, optional, privileged like `nodes`). Omitted means no requirement. */
  datacenter?: boolean;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/**
 * The official pricing parameters, as served by the Flux API (`/apps/getappspecsusdprice`).
 * Rates are USD for a bundle of three instances, before the instance and add-on rules in `quote()`.
 */
export interface PricingParams {
  /** Height the parameters apply from; -1 means "current". */
  height: number;
  /** USD per 0.1 CPU core for three instances (so USD 1.50 per core). */
  cpu: number;
  /** USD per 100 MB of RAM for three instances (so USD 0.50 per GB). */
  ram: number;
  /** USD per GB of disk for three instances. */
  hdd: number;
  /** Minimum price in FLUX units used by the on-chain calculation; the USD path ignores it. */
  minPrice: number;
  /** USD surcharge for each public port in 1 to 1023, 8080, 8081, 8443 or 6667 ("enterprise ports"). */
  port: number;
  /** USD surcharge for pinning to specific `nodes` or running an enterprise app. */
  scope: number;
  /** USD surcharge for a static IP. */
  staticip: number;
  /** Multiplier applied when paying in FLUX (0.95 is a 5 percent discount). */
  fluxmultiplier: number;
  /** Global multiplier the network can raise. 1 today. */
  multiplier: number;
  /** Floor for the monthly USD price of any app. */
  minUSDPrice: number;
}

export interface QuoteLineItem {
  /**
   * Stable id: `cpu`, `ram`, `hdd`, `staticip`, `scope`, `ports`, `instances`, `duration`, `hw-discount`,
   * `duration-discount`, `marketplace`, `minimum`, `rounding`.
   */
  id: string;
  /** Human label, for example "CPU, 2 cores". */
  label: string;
  /** Contribution in USD to `Quote.usdTotal`; negative for discounts. */
  usd: number;
  /** The component the line belongs to, when it is per component. */
  component?: string;
  /** One sentence on how the number came about, in plain language. */
  note?: string;
}

export interface Quote {
  /** Monthly price in USD after every rule (`usdTotal / months`). */
  usdPerMonth: number;
  /** Monthly price in FLUX at `fluxUsd`, or null when no FLUX price was supplied. */
  fluxPerMonth: number | null;
  /** The FLUX/USD price used for the conversion. */
  fluxUsd: number | null;
  /** How many months the subscription covers (`expire / 88000`), at least 1 for reporting. */
  months: number;
  /** `lines` sum to this: the USD price of the whole subscription, rounded up to .49 or .99. */
  usdTotal?: number;
  /** FLUX price of the whole subscription, or null without a FLUX price. */
  fluxTotal?: number | null;
  /** Subscription length that was priced, in blocks. */
  expireBlocks?: number;
  /** Instance count that was priced. */
  instances?: number;
  lines: QuoteLineItem[];
  /** True when the floor price replaced the computed total. */
  minimumApplied: boolean;
  /** `official` comes from the Flux API's calculator, `computed` from the local formula. */
  basis: 'official' | 'computed';
  /** Which params produced this quote (`live` from the API, `cache`, or `baked` from the built-in snapshot). */
  paramsSource: 'live' | 'cache' | 'baked';
}

// ---------------------------------------------------------------------------
// Lint
// ---------------------------------------------------------------------------

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintIssue {
  /** Stable machine code, for example `PORT_RANGE`, `NAME_FORMAT`, `INSTANCES_LOW`. */
  code: string;
  severity: LintSeverity;
  /** JSON path of the offending value, for example `compose[0].ports[1]`. Empty for whole-spec issues. */
  path: string;
  /** What is wrong, in one plain sentence. */
  message: string;
  /** Why it matters to a deployer, one or two plain sentences. This is the teaching text. */
  why: string;
  /** What to do about it. */
  fix: string;
  /** A suggested replacement value for `path`, when there is an obvious one. */
  suggestion?: unknown;
  /** A docs URL, when one exists. */
  docs?: string;
}

export interface LintReport {
  /**
   * True when there are no `error` issues. That is not acceptance: the network also checks the image, the
   * name, placement and payment when you register (FACTS 3.10).
   */
  valid: boolean;
  errors: number;
  warnings: number;
  infos: number;
  issues: LintIssue[];
}
