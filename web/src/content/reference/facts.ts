/**
 * Facts the Reference quotes that are NOT limits or prices in the shared engine: timings of the domain
 * manager, the node's restart ladder, defaults of the FluxCloud form, log sizes and so on.
 *
 * Every value has its FACTS.md section. Numbers that the engine owns (`LIMITS`, `BAKED_PRICING`,
 * `DURATION_DISCOUNTS`, `TIER_FACTS`, the blocks helpers) are NOT repeated here: the content modules
 * import them from `@shared/flux` so the reference cannot drift from the linter and the calculator.
 * `numbers.test.ts` fails the build if a content module types a number of two or more digits that is
 * not registered in this file.
 *
 * Durations and time windows are held in `shared/flux/timing.ts` (one place, one test) and read from
 * there below; this file only gives them the names the Reference pages use.
 *
 * Framework-free. Changes need a FACTS.md source.
 */

import {
  CRASH_BACKOFF_SEC,
  CRASH_RESTART_COUNT,
  CRASH_RESTART_WINDOW_MIN,
  CRASH_STABLE_RUN_MIN,
  CUSTOM_CERT_RENEW_BELOW_DAYS,
  DEPLOY_ESTIMATE_MIN,
  FDM_EJECT_SEC,
  FDM_FAILOVER,
  FDM_FETCH_SEC,
  FDM_TIMING,
  G_ELECTION_EVERY_SEC,
  G_STANDBY_WAIT_MIN_PER_POSITION,
  GATEWAY_ROUND_ROBIN_TIMEOUT_SEC,
  GATEWAY_TIMEOUT_SEC,
  IMAGE_RECHECK_HOURS,
  LOCATION_TTL_MIN,
  MESSAGE_TTL_SEC,
  PAYMENT_WINDOW_MIN,
  SPAWN_DEFERRAL_MIN,
  SYNC_STALL_NUDGE_MIN,
  SYNC_STALL_REMOVE_MIN,
  SYNCED_RESPAWN_EXTRA_MIN,
} from '@shared/flux';

/** What the pages claim to have been checked against. FACTS.md "Source key" and Snapshot. */
export const CHECKED = {
  /** Date the facts were compiled and the live API was read. */
  date: '2026-10-12',
  /** FluxOS release whose source was read. */
  fluxos: '8.20.0',
  commit: '3ca1ab9',
  /** Date of that commit. */
  sourceDate: '2026-09-25',
} as const;

/** Flux Domain Manager (HAProxy). FACTS 6.4. Source: flux-domain-manager haproxyTemplate.js. */
export const FDM = {
  /** `check inter 3s`: a TCP connect to the instance port. */
  healthIntervalSec: FDM_TIMING.healthIntervalSec,
  ejectAfterFailures: FDM_TIMING.ejectAfterFailures,
  restoreAfterSuccesses: FDM_TIMING.restoreAfterSuccesses,
  /** About 6 s to eject a dead instance and about 6 s to bring it back. */
  ejectSec: FDM_EJECT_SEC,
  /** The `FDMSERVERID` cookie pins a client to one instance for up to this long. */
  stickyHours: FDM_TIMING.stickyHours,
  retries: FDM_TIMING.retries,
  requestTimeoutSec: FDM_TIMING.requestTimeoutSec,
  serverTimeoutSec: FDM_TIMING.serverTimeoutSec,
  /** Apps with synced storage (`r:`, `g:`, `s:`). */
  syncedServerTimeoutSec: FDM_TIMING.syncedServerTimeoutSec,
  clientTimeoutSec: FDM_TIMING.clientTimeoutSec,
  connectTimeoutSec: FDM_TIMING.connectTimeoutSec,
  /** A custom domain certificate is renewed when fewer days than this are left. */
  certRenewBelowDays: CUSTOM_CERT_RENEW_BELOW_DAYS,
  /** The gateway's server timeout for `api.runonflux.io` on the sticky backend. FACTS 10.1. */
  gatewayTimeoutSec: GATEWAY_TIMEOUT_SEC,
  /** The round robin backend of the gateway. FACTS 10.1. */
  gatewayRoundRobinTimeoutSec: GATEWAY_ROUND_ROBIN_TIMEOUT_SEC,
  /** Front doors for apps in HTTP mode. FACTS 6.4. */
  httpPort: 80,
  httpsPort: 443,
  /** FDM moves away from a `g:` primary only after this many failed checks in a row and this long unhealthy. FACTS 6.4. */
  failoverFailedChecks: FDM_FAILOVER.minFailedChecks,
  failoverUnhealthySec: FDM_FAILOVER.minUnhealthySec,
  /** How often FDM fetches the app and location lists, seconds. FACTS 6.1 row 13. */
  fetchSec: FDM_FETCH_SEC,
  /** Node side: the `g:` election runs this often, and a standby waits this many minutes per place. FACTS 6.4. */
  gElectionSec: G_ELECTION_EVERY_SEC,
  gStandbyMinPerPlace: G_STANDBY_WAIT_MIN_PER_POSITION,
  /** The cookie that pins a client to one instance. */
  stickyCookie: 'FDMSERVERID',
  /** The request header the gateway adds on its round robin backend. FACTS 10.1. */
  roundRobinHeader: 'X-Flux-Mode: Roundrobin',
} as const;

/**
 * What the banned public ports are usually used for, keyed by the first port of the entry. The list
 * itself is `BANNED_PORT_RANGES` in the engine (FACTS 3.4); the names are the standard assignments of
 * each port, which Flux does not state. An entry that is not here has no explanation in the sources.
 */
/**
 * What each fee port outside 1 to 1023 is conventionally used for, so the table does not describe them all
 * as web ports. The sources give the list and the price, not the reason for either.
 */
export const FEE_PORT_NOTES: Readonly<Record<number, string>> = {
  6667: 'IRC, chat',
  8080: 'Alternative HTTP, often a second web server or a proxy',
  8081: 'Alternative HTTP, often an admin page or a second web server',
  8443: 'Alternative HTTPS',
};

export const BANNED_PORT_NOTES: Readonly<Record<number, string>> = {
  22: 'SSH, remote shell',
  23: 'Telnet, remote shell without encryption',
  25: 'SMTP, mail between servers',
  53: 'DNS',
  123: 'NTP, network time',
  161: 'SNMP, device management',
  512: 'rexec, remote execution',
  513: 'rlogin, remote login',
  3389: 'RDP, Windows remote desktop',
  5800: 'VNC over HTTP, remote desktop',
  5900: 'VNC, remote desktop',
  5901: 'VNC, remote desktop (display 1)',
  8384: 'Syncthing web interface',
  16100: 'FluxOS own services, including the node API on 16127 to 16197',
  27017: 'MongoDB',
};

/** Node behaviour. FACTS 6.1 to 6.3, 7.3. Source: FluxOS config/default.js, dockerService.js. */
export const NODE = {
  /** Nodes look for a newer image of the same tag this often. FACTS 6.3. */
  imageCheckHours: IMAGE_RECHECK_HOURS,
  /** A location record is valid this long after the last broadcast (7500 s). FACTS 6.1. */
  locationTtlMin: LOCATION_TTL_MIN,
  /** Extra wait before a synced-storage app is re-spawned when its peers look unreachable. FACTS 6.3. */
  syncedExtraWaitMin: SYNCED_RESPAWN_EXTRA_MIN,
  /** Restart back-off ladder in seconds after a crash: 0, 30 s, 5 min, 15 min, 30 min. FACTS 6.3. */
  restartLadderSec: CRASH_BACKOFF_SEC,
  /** A run this long without a crash resets the ladder. FACTS 6.3. */
  stableRunMin: CRASH_STABLE_RUN_MIN,
  /** Five automatic restarts inside five minutes count as a crash. FACTS 6.3. */
  crashRestarts: CRASH_RESTART_COUNT,
  crashWindowMin: CRASH_RESTART_WINDOW_MIN,
  /** Docker json-file log driver: files kept and total size. FACTS 7.3. */
  logFiles: 4,
  logTotalMb: 20,
  /** Swap allowance added to `ram`, MB. FACTS 3.3, 7.3. */
  swapMb: 2000,
  /** Container root filesystem cap on nodes whose Docker uses XFS project quota, GB. FACTS 7.3. */
  rootfsGb: 10,
  /** The apps one node can host at most. FACTS 6.2. */
  maxAppsPerNode: 200,
  /** Minimum Docker version the network asks of nodes. FACTS 10.6.6 (getmodulesminimumversions). */
  minDocker: '26.1.2',
  /** Host service reachable from inside a container. FACTS 8.2. */
  hostServiceIp: '169.254.43.43',
  hostServicePort: 16101,
} as const;

/** Image reference rules the engine holds as a pattern only. FACTS 3.3 (`[\w][\w.-]{0,127}`). */
export const IMAGE_TAG = {
  /** The longest tag: one first character and up to 127 more. */
  maxLength: 128,
} as const;

/** Syncthing supervision of synced volumes. FACTS 7.3 (config/default.js:697-700). */
export const SYNC = {
  /** A stalled initial sync is nudged after this long. */
  stalledNudgeMin: SYNC_STALL_NUDGE_MIN,
  /** A stalled sync is removed after this long of evidence. */
  stalledRemoveMin: SYNC_STALL_REMOVE_MIN,
} as const;

/**
 * How long a bigger node waits before it takes a small app, minutes. FACTS 2.4 and 6.1 row 10 (FluxOS
 * config/default.js capacityGap, appSpawner.js). It is a soft preference of each node, not a rule.
 */
export const SPAWN_DELAY_MIN = {
  /** Nimbus, for an app under 3 cores, 6000 MB and 150 GB. */
  nimbusSmall: SPAWN_DEFERRAL_MIN.nimbusSmallApp,
  /** Stratus, for an app under 7 cores, 29000 MB and 370 GB. */
  stratusMedium: SPAWN_DEFERRAL_MIN.stratusMediumApp,
  /** Stratus, for an app under 3 cores, 6000 MB and 150 GB. */
  stratusSmall: SPAWN_DEFERRAL_MIN.stratusSmallApp,
} as const;

/** Time windows around registration and payment. FACTS 4.7, 6.1, 9. */
export const WINDOWS = {
  /** The FluxCloud payment link says 30 minutes. */
  paymentMin: PAYMENT_WINDOW_MIN,
  /** Temporary messages live 3600 s. */
  messageTtlSec: MESSAGE_TTL_SEC,
  /** "Deployment time: up to 45 min after payment" (FluxCloud text). */
  deployUpToMin: DEPLOY_ESTIMATE_MIN,
} as const;

/** Node API ports. FACTS 10.1. Source: FluxOS config/default.js:29-30. */
export const NODE_API = {
  defaultPort: 16127,
  ports: [16127, 16137, 16147, 16157, 16167, 16177, 16187, 16197],
} as const;

/** Rules of older versions and pricing details that the engine implements without naming. FACTS 3.2, 4.4. */
export const RULES = {
  /** Version 7 and older: app names were at most this long, letters and digits only. FACTS 3.2. */
  legacyNameMaxLength: 32,
  /** Pricing: a flat rate per extra instance applies when there are more than this many extra instances. FACTS 4.4. */
  flatExtraInstancesAbove: 2,
  /** An Ethereum owner address is `0x` and this many hex digits. FACTS 3.2 (owner), spec.ts LIMITS.owner. */
  ethereumHexDigits: 40,
  /** `expire` used to have to be a multiple of this; the rule was removed at block 1,625,000. FACTS 5.3. */
  legacyExpireMultiple: 1000,
  /** The block from which `expire` no longer has to be a multiple of 1000. FACTS 5.3. */
  legacyExpireRuleEndBlock: 1625000,
  /** The block from which the smallest `expire` is one block, which cancels an app. FACTS 5.3. */
  cancelFromBlock: 1964447,
} as const;

/** The step of each field in the FluxCloud form. FACTS 3.3 (fluxos-frontend configure.vue). */
export const FORM_STEPS = {
  cpu: 0.1,
  ramMb: 100,
  hddGb: 1,
} as const;

/** What the FluxCloud form starts a new app with. FACTS 3.2, 3.3 (fluxos-frontend configure.vue). */
export const FORM_DEFAULTS = {
  instances: 1,
  cpu: 1,
  ram: 2000,
  hdd: 20,
} as const;

/**
 * Observed in the live API on CHECKED.date. FACTS 2.5, 2.9, 5.1. Volatile: say "at the time of writing".
 * Counts of single-instance apps with no running copy are not kept here: the old share was an artefact of
 * blocklisted Orbit deployments (FACTS 15.3.3). Dated Orbit samples live in `ORBIT_FACTS` (`shared/flux`).
 */
export const SNAPSHOT = {
  /** Nodes whose CPU architecture is arm64, none of them on ArcaneOS. FACTS 2.5, 2.9 snapshot, 3.7. */
  arm64Nodes: 7,
  /** The chain height when the facts were read (about). FACTS 5.1. */
  blockHeight: 3031000,
} as const;

/**
 * Where a block height first enforced each spec version. FACTS 3.1, config/default.js:380-387.
 * Bound to the engine only for the current version (`SPEC_VERSION`).
 */
export const VERSION_HISTORY = [
  {
    version: 1,
    fromBlock: 0,
    added: 'A single container with `port` and `containerPort`. Deprecated and cannot be registered.',
  },
  { version: 2, fromBlock: 0, added: '`ports[]`, `containerPorts[]` and `domains[]`.' },
  { version: 3, fromBlock: 983000, added: '`instances`.' },
  { version: 4, fromBlock: 1004000, added: '`compose[]`, so an app can have several components.' },
  { version: 5, fromBlock: 1142000, added: '`contacts[]` and `geolocation[]`.' },
  { version: 6, fromBlock: 1300000, added: '`expire`.' },
  {
    version: 7,
    fromBlock: 1420000,
    added: '`nodes[]`, `staticip`, component `secrets` and `repoauth`.',
  },
  {
    version: 8,
    fromBlock: 1932380,
    added:
      '`enterprise` (encrypted `contacts` and `compose`) and `datacenter`; hyphens in app names and names up to 63 characters. Removed `tiered`, the per-tier resource keys such as `cpubasic` and `secrets`.',
  },
] as const;

/** The block from which a v8 spec may ask for a single instance. FACTS 3.2 (config minimumInstancesV8Block). */
export const MIN_ONE_INSTANCE_FROM_BLOCK = 2176519;

/** What the read-only API did on the day it was tested. Volatile: the pages say "when tested". FACTS 10.3. */
export const OBSERVED_API = {
  latencySmall: '0.25 to 0.45 s',
  latencyLarge: '1.0 to 1.4 s',
  /** Server cache windows run from this many seconds to this many minutes, route by route. */
  cacheShortestSec: 5,
  cacheLongestMin: 30,
  /** The CORS answer header every tested GET carried. */
  corsHeader: 'access-control-allow-origin: *',
  /** The header that names the node that answered. */
  nodeHeader: 'fluxnode',
} as const;

/** What `shared/api.ts` says about this site's own server (its comments are the only source). */
export const ACADEMY_API = {
  /** The most recent blocks the server buffers for `/api/v1/blocks`. */
  blocksMax: 120,
  /** The most names `/api/v1/explore/search` returns. */
  searchMax: 25,
  /** `/api/v1/stream` sends a ping frame this often. */
  streamPingSec: 20,
  /** `/api/v1/network` is cached about this long on the server. */
  networkCacheSec: 10,
} as const;

/** Advice from FACTS 10.7, kept as the words it is given in. */
export const API_ADVICE = {
  clientCache: '30 to 60 seconds',
} as const;

/** The node used in examples of the HTTPS wrapper, with dots written as dashes. FACTS 10.1. */
export const NODE_EXAMPLE_HOST = '176-9-51-187';
