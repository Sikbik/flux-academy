/**
 * Durations and time windows of the Flux deployment pipeline: how long a node waits before it takes an app,
 * how long a location record lives, how fast the load balancer drops a dead instance, the payment window.
 *
 * Lessons, glossary, reference and troubleshooting copy quote these. They are held here so that no page
 * types "57" or "125" by hand, and so that one test pins every value against FACTS.md.
 *
 * Naming: the unit is the suffix (`Sec`, `Min`, `Hours`, `Days`, `Blocks`). Each constant has a kind, as in
 * FACTS 6.6, because several clocks get confused and they do not share a start:
 *   `protocol`  a node or the chain enforces it (a message is dropped, a record expires)
 *   `ui-text`   a fixed string in the FluxCloud front end; no code counts it or enforces it
 *   `ui-watcher` a timer in the front end that stops watching, not the deployment
 *   `fdm`       FDM (HAProxy) configuration or its polling loops
 * `TIMING_KIND` lists the kind of every exported constant by name. Source tags as in spec.ts:
 *   `FACTS` = docs/research/FACTS.md section; `VERIFIED-SOURCE` = read in FluxOS 8.20.0 / flux-domain-manager
 *   source; `DOCS-ONLY` = only a documentation or UI string says so; `UNVERIFIED` = not observed, so copy must
 *   phrase it as guidance. None of these values is a live network figure: a copy that quotes one still says
 *   "at the time of writing" where FACTS does (FluxOS config can change in a release).
 *
 * Pure and framework-free. No Node built-ins, no DOM.
 */

import { TARGET_BLOCK_SEC } from './blocks.ts';

// ---------------------------------------------------------------------------
// Where an app lands: the soft tier preference (install delays)
// ---------------------------------------------------------------------------

/**
 * How long a node that is "too big" for an app, or of a kind the app does not need, waits before it tries to
 * install it. Minutes. The standard column of the table in FACTS 2.4 (config `capacityGap`, `spawnDelay` keys).
 * A soft preference of each node, not a rule: if the smaller nodes have not filled the instances by then, the
 * bigger ones join in. FACTS 2.4 and 6.1 row 10; VERIFIED-SOURCE config/default.js:607-615, appSpawner.js:821-905.
 *
 * "Small" is under 3 cores, 6000 MB and 150 GB (`HW_DISCOUNTS`); "medium" is under 7 cores, 29000 MB, 370 GB.
 */
export const SPAWN_DEFERRAL_MIN = {
  /** A Nimbus node, for a small app. `capacityGap.smallMs` 3,420,000 ms. */
  nimbusSmallApp: 57,
  /** A Stratus node, for a medium app. `capacityGap.mediumMs` 5,220,000 ms. */
  stratusMediumApp: 87,
  /** A Stratus node, for a small app. `capacityGap.largeMs` 7,020,000 ms. */
  stratusSmallApp: 117,
  /** A static IP node, for an app that does not ask for a static IP. FACTS 2.4, 6.1 row 10. */
  staticIpNode: 57,
  /** A data center node, for an app that does not need one. FACTS 2.4 (same file, config L607-L609). */
  dataCenterNode: 57,
  /** An ArcaneOS node, for a non-enterprise app. `nonEnterpriseSpawnDelayMs` 120,000 ms. FACTS 2.4, 2.6. */
  arcaneOsNonEnterprise: 2,
} as const;

/**
 * The same three size delays in the "Enterprise delay" column of FACTS 2.4 (minutes). The table does not say
 * more than that column title, so copy should name the standard delays and leave these to a reference page.
 * VERIFIED-SOURCE config/default.js:607-614.
 */
export const SPAWN_DEFERRAL_ENTERPRISE_MIN = {
  nimbusSmallApp: 12,
  stratusMediumApp: 21,
  stratusSmallApp: 30,
} as const;

/** The tier size delays only, shortest first. Derived from `SPAWN_DEFERRAL_MIN`. */
export const SPAWN_DEFERRAL_TIER_MINUTES: readonly number[] = [
  SPAWN_DEFERRAL_MIN.nimbusSmallApp,
  SPAWN_DEFERRAL_MIN.stratusMediumApp,
  SPAWN_DEFERRAL_MIN.stratusSmallApp,
];

/** The longest deferral a bigger node applies (117). The "57 to 117 minutes" of the copy is this range. */
export const SPAWN_DEFERRAL_RANGE_MIN = {
  min: SPAWN_DEFERRAL_MIN.nimbusSmallApp,
  max: SPAWN_DEFERRAL_MIN.stratusSmallApp,
} as const;

/**
 * Timers of the spawn loop on a node. FACTS 6.1 row 9. VERIFIED-SOURCE config/default.js:476-479,
 * appSpawner.js; the "60 s to 30 min" depends on how many apps are installable, so it is a range.
 */
export const SPAWN_LOOP = {
  /** `installation.delay`. */
  installDelaySec: 120,
  /** How often the loop runs on nodes of the enterprise network. */
  enterpriseNodeEverySec: 30,
  /** On other nodes the loop runs between these two intervals. */
  otherNodeMinEverySec: 60,
  otherNodeMaxEverySec: 1800,
} as const;

/**
 * "Usually takes 1-3 minutes": a node usually starts installing within this long of the payment
 * confirming. Kind `ui-text` (`installationStartTime`), a static label, not a protocol promise. FACTS 6.1
 * row 9, 6.6, 9.5.1; VERIFIED-SOURCE (i18n string).
 */
export const INSTALL_START_USUAL_MIN = { from: 1, to: 3 } as const;

// ---------------------------------------------------------------------------
// Registering and paying
// ---------------------------------------------------------------------------

/**
 * What FluxCloud's screen says: "Deployment time: up to 45 min after payment". Kind `ui-text`: a static
 * string (`deploymentTimeEstimate`, `upToFortyFiveMinutes`), no timer and no code that enforces it. An
 * estimate, not a guarantee: the deferrals above can add up to about two hours. FACTS 6.1 (after table),
 * 6.6, 9.5.1; VERIFIED-SOURCE (i18n string).
 */
export const DEPLOY_ESTIMATE_MIN = 45;

/**
 * The text "Payment window: 30 minutes remaining" in the review step, and "valid for the next 30 minutes"
 * in the marketplace dialog. Kind `ui-text`: a fixed string, not a counter, and nothing ties it to the
 * message lifetime below. The real node-side deadline is `MESSAGE_TTL_SEC` after registration, so 30
 * minutes is the UI's conservative wording. What the card bridge enforces for its payment link was not
 * observed (UNVERIFIED). FACTS 4.7, 6.1 row 7, 6.6, 9.5.1; VERIFIED-SOURCE (i18n `paymentWindowTime`,
 * `paymentLinksValid`).
 */
export const PAYMENT_WINDOW_MIN = 30;

/**
 * How long the temporary registration message lives. Kind `protocol`. The hour starts on EACH node when
 * that node receives the registration (seconds after the register call), not at signing and not when the
 * payment screen appears; a node deletes its copy after it and a payment confirmed later finds nothing to
 * link. FACTS 4.7, 6.1 row 7, 6.6; VERIFIED-SOURCE config/default.js:535 (`tempMsgTtlS`), messageStore.js.
 */
export const MESSAGE_TTL_SEC = 3600;

/** The same hour in minutes: the node-side deadline for the payment to be confirmed. Derived. FACTS 6.6. */
export const REGISTRATION_DEADLINE_MIN = MESSAGE_TTL_SEC / 60;

/**
 * A node that lacks the message asks its peers for it this many times, this far apart, and then gives up;
 * peers hold their temporary copies for the same hour, so the source read has no later recovery (not tested
 * live). Kind `protocol`. FACTS 6.6; VERIFIED-SOURCE serviceManager.js:L351-L356, messageVerifier.js.
 */
export const MESSAGE_PEER_FETCH = { attempts: 2, everySec: 60 } as const;

/**
 * The front end's payment and deployment watcher: it starts when you click pay (and at once for a free
 * update), polls this often, and stops after this long with "Payment monitoring timed out". Kind
 * `ui-watcher`: the deployment continues after the watcher gives up. "Deployment Successful!" at its third
 * phase means ONE copy is running. FACTS 6.6; VERIFIED-SOURCE SubscriptionManager.vue:L10515-L10690.
 */
export const UI_WATCHER_MIN = 30;
export const UI_WATCHER_POLL_SEC = 30;

/**
 * The signed timestamp must be within this long before node time and this long after it: "Message timestamp
 * is over 1 hour old" / "from future". FACTS 6.1 row 4, 11 row 23; VERIFIED-SOURCE appValidator.js:1721-1727.
 */
export const SIGN_TIMESTAMP_MAX_AGE_SEC = 3600;
export const SIGN_TIMESTAMP_MAX_AHEAD_SEC = 300;

/** A payment is seen in 1 to 3 blocks once sent (30 to 90 s at 30 s blocks). FACTS 6.1 row 7. */
export const PAYMENT_CONFIRMATION_BLOCKS = { min: 1, max: 3 } as const;

/** The same range in seconds, from the block interval. Derived. */
export const PAYMENT_CONFIRMATION_SEC = {
  min: PAYMENT_CONFIRMATION_BLOCKS.min * TARGET_BLOCK_SEC,
  max: PAYMENT_CONFIRMATION_BLOCKS.max * TARGET_BLOCK_SEC,
} as const;

/**
 * The gateway for `api.runonflux.io` gives up on a request the node never answers after its server timeout
 * on the sticky backend: the 504 of a calculator POST sent with `Content-Type: application/json`. FACTS 4.2
 * (which reconciles this with the "no response in 12 s" of 10.6.2, a curl `--max-time`), 10.1, 11 row 12;
 * VERIFIED-SOURCE haproxyTemplate.js:356 and VERIFIED-LIVE.
 */
export const GATEWAY_TIMEOUT_SEC = 30;

/** The gateway's round robin backend (the location and message paths) waits this long. FACTS 10.1; VERIFIED-SOURCE haproxyTemplate.js:380. */
export const GATEWAY_ROUND_ROBIN_TIMEOUT_SEC = 120;

// ---------------------------------------------------------------------------
// While it runs: location records, replacement, restarts, image checks
// ---------------------------------------------------------------------------

/**
 * A location record ("this node runs instance X") is valid this long after the last broadcast, and nodes
 * refresh it this often. FACTS 6.1 row 12, 6.3; VERIFIED-SOURCE appConstants.js:100-150, config/default.js:522-528.
 */
export const LOCATION_TTL_SEC = 7500;
export const LOCATION_REFRESH_SEC = 3600;
/** 125 minutes. Derived from `LOCATION_TTL_SEC`. FACTS 6.3, 6.5. */
export const LOCATION_TTL_MIN = LOCATION_TTL_SEC / 60;

/**
 * A node that shuts down cleanly announces it, and peers drop its rows after this long. FACTS 6.3;
 * VERIFIED-SOURCE config/default.js:522-528.
 */
export const LOCATION_CLEAN_SHUTDOWN_DROP_SEC = 420;

/**
 * After the location rows expire, a synced-storage app (`r:`, `g:`, `s:`) can wait up to about this long
 * more when its peers look unreachable. "About" is FACTS's own word. FACTS 6.3, 6.5;
 * VERIFIED-SOURCE appSpawner.js:760-805.
 */
export const SYNCED_RESPAWN_EXTRA_MIN = 27;

/**
 * The wait before a replacement copy starts to install after a node dies, in minutes, not counting the image
 * pull or any deferral of the node that takes it: the location record's lifetime, plus up to
 * `SYNCED_RESPAWN_EXTRA_MIN` for a synced-storage app. FACTS 6.3, 6.5 ("up to 125 min plus install time").
 * An upper bound on the record's lifetime, so say "can take". Derived.
 */
export function replacementWaitMin(synced: boolean): number {
  return LOCATION_TTL_MIN + (synced ? SYNCED_RESPAWN_EXTRA_MIN : 0);
}

/**
 * FluxOS sets the Docker restart policy to `no` and restarts crashed containers itself, with this ladder
 * (seconds after each consecutive crash). FACTS 6.3, 11 rows 20 and 21; VERIFIED-SOURCE
 * dockerService.js:1215-1217, config/default.js:137-154.
 */
export const CRASH_BACKOFF_SEC: readonly number[] = [0, 30, 300, 900, 1800];

/** The longest step of the ladder, in minutes (30). Derived. */
export const CRASH_BACKOFF_MAX_MIN = Math.max(...CRASH_BACKOFF_SEC) / 60;

/** A run this long without a crash resets the ladder. FACTS 6.3. */
export const CRASH_STABLE_RUN_MIN = 10;

/** This many automatic restarts inside this many minutes count as a crash. FACTS 6.3. */
export const CRASH_RESTART_COUNT = 5;
export const CRASH_RESTART_WINDOW_MIN = 5;

/**
 * Nodes test each other's published ports this often; an unreachable port puts the node in a DOS state and
 * its apps are removed (the consequence was read in the code, not tested live). FACTS 6.3; VERIFIED-SOURCE
 * availabilityChecker.js:55-70 for the interval, the consequence UNVERIFIED live.
 */
export const PORT_CHECK_EVERY_MIN = 60;

/**
 * Each node compares the digest of the image its container runs with the digest the registry returns for
 * the same tag every 21,600,000 ms (6 hours) and calls a soft redeploy when they differ (a soft redeploy
 * keeps volume data). The first check comes 10 to 30 minutes after the node starts and apps are walked 5 s
 * apart, so nodes do not all redeploy at once. Kind `protocol`. Read from source, NOT observed live, so copy
 * says "is set to" and "read from source". FACTS 6.3, 11 row 19; VERIFIED-SOURCE config/default.js:639-644,
 * imageUpdateService.js:L13-L21,L209-L250,L321-L340.
 */
export const IMAGE_RECHECK_HOURS = 6;
export const IMAGE_RECHECK_INTERVAL_MS = 21_600_000;
export const IMAGE_RECHECK_FIRST_MIN = { min: 10, max: 30 } as const;
export const IMAGE_RECHECK_APP_SPACING_SEC = 5;

/** A stalled initial sync of a synced volume is nudged after this long and removed after this long. FACTS 7.3. */
export const SYNC_STALL_NUDGE_MIN = 3;
export const SYNC_STALL_REMOVE_MIN = 20;

// ---------------------------------------------------------------------------
// The load balancer (FDM) in front of the instances
// ---------------------------------------------------------------------------

/**
 * Flux Domain Manager's HAProxy settings that decide how fast traffic leaves a dead instance and how a
 * browser sticks to one. FACTS 6.4; VERIFIED-SOURCE flux-domain-manager haproxyTemplate.js:64-66,214-228,
 * 260-272,289.
 */
export const FDM_TIMING = {
  /** `check inter 3s`: a TCP connect to the instance port. */
  healthIntervalSec: 3,
  /** Down after this many failed checks. */
  ejectAfterFailures: 2,
  /** Up again after this many passing checks. */
  restoreAfterSuccesses: 2,
  /** The `FDMSERVERID` cookie pins a client to one instance for up to this long. */
  stickyHours: 8,
  retries: 3,
  requestTimeoutSec: 15,
  serverTimeoutSec: 25,
  /** The server timeout for apps with synced storage. */
  syncedServerTimeoutSec: 20,
  clientTimeoutSec: 120,
  connectTimeoutSec: 10,
} as const;

/**
 * FDM renews a custom domain's Let's Encrypt certificate when fewer than this many days are left. FACTS 6.4
 * ("Custom domain TLS"); VERIFIED-SOURCE domain/cert.js:51-190.
 */
export const CUSTOM_CERT_RENEW_BELOW_DAYS = 30;

/**
 * Where FDM polls the node API for locations and specs: the fetch loops sleep the server's cache max-age,
 * 30 s by default (5 s when the origin says the data may be stale). Kind `fdm`. FACTS 6.1 row 13;
 * VERIFIED-SOURCE flux-domain-manager dataFetcher.js:L55-L90,L505-L545. A first copy therefore shows up at
 * the load balancer after tens of seconds at the earliest and it can be minutes (one non-g pass measured
 * at several minutes on a loaded FDM); the end-to-end delay was not timed (UNVERIFIED).
 */
export const FDM_FETCH_SEC = 30;
export const FDM_FETCH_STALE_RETRY_SEC = 5;

/**
 * Failover of a `g:` app. FDM keeps the previous primary (sticky) and moves away only after at least
 * `minFailedChecks` consecutive failed checks AND `minUnhealthySec` of unhealthiness; its passes are at
 * least `passSpacingSec` apart. Kind `fdm`. FACTS 6.4 ("Primary/standby"); VERIFIED-SOURCE domainService.js:
 * L36-L41,L120-L142,L831-L1000; timing not measured live.
 */
export const FDM_FAILOVER = { minFailedChecks: 3, minUnhealthySec: 90, passSpacingSec: 25 } as const;

/**
 * Node side of the same failover: the `g:` election runs this often, and a standby at list position `i`
 * waits about `i` x this many minutes before it may start an empty primary. Kind `protocol` (node
 * config). So a failover is minutes, not seconds. FACTS 6.4; VERIFIED-SOURCE advancedWorkflows.js:
 * L4838-L4840,L4975-L5530, config/default.js:L645-L646.
 */
export const G_ELECTION_EVERY_SEC = 30;
export const G_STANDBY_WAIT_MIN_PER_POSITION = 3;

/** How long a standby at a list position waits before it may start an empty primary, minutes. Derived. */
export function gStandbyWaitMin(position: number): number {
  if (!Number.isFinite(position) || position < 0) return 0;
  return position * G_STANDBY_WAIT_MIN_PER_POSITION;
}

/** About 6 s to eject a dead instance (interval x failures). Derived. FACTS 6.4. */
export const FDM_EJECT_SEC = FDM_TIMING.healthIntervalSec * FDM_TIMING.ejectAfterFailures;

/** About 6 s for a recovered instance to return (interval x successes). Derived. FACTS 6.4. */
export const FDM_RESTORE_SEC = FDM_TIMING.healthIntervalSec * FDM_TIMING.restoreAfterSuccesses;

// ---------------------------------------------------------------------------
// Subscriptions and updates, in blocks
// ---------------------------------------------------------------------------

/**
 * The free update rate limit: at most `updates` update messages inside `blocks` blocks. FACTS 4.5 says the
 * windows are "in pre-PON block units in code", so their length in wall time is a reading, not a fact
 * (UNVERIFIED): at 30 s blocks they are 6, 12 and 30 hours. VERIFIED-SOURCE appSpecHelpers.js:147-256.
 */
export const FREE_UPDATE_RATE_LIMITS: readonly { updates: number; blocks: number }[] = [
  { updates: 5, blocks: 720 },
  { updates: 8, blocks: 1440 },
  { updates: 10, blocks: 3600 },
];

/** A free update may not extend the subscription by more than this many blocks. FACTS 4.5, 9.5.4. */
export const FREE_UPDATE_MAX_EXTENSION_BLOCKS = 8;

/**
 * Every confirmed block whose height is a multiple of this removes the expired apps from the global
 * database, so an app is gone "within minutes to a few hours" after its expiry block. FACTS 5.4
 * (8 = 2 x 4 after the fork); VERIFIED-SOURCE explorerService.js:609-650.
 */
export const EXPIRY_SWEEP_EVERY_BLOCKS = 8;

/**
 * The term the FluxCloud MCP server's `flux_cancel_app` gives an app: an update whose `expire` is this many
 * blocks, so the app ends about an hour after the update's block (120 x 30 s) and nothing is refunded. The
 * console's own cancel signs 100 blocks and the old Vue front end signed 1. FACTS 15.1.8 and 4.5;
 * VERIFIED-SOURCE `@runonflux/flux-cloud-mcp` 0.2.7 (the update goes through normalizePublished() with
 * expire 120).
 */
export const MCP_CANCEL_EXPIRE_BLOCKS = 120;

// ---------------------------------------------------------------------------
// What kind of clock each constant is (FACTS 6.6)
// ---------------------------------------------------------------------------

export type TimingKind = 'protocol' | 'ui-text' | 'ui-watcher' | 'fdm';

/**
 * The kind of every duration above, by export name. Copy that quotes a `ui-text` constant says "the screen
 * says" and never presents it as a promise; a `protocol` constant is what a node or the chain enforces.
 * Derived and helper values (`LOCATION_TTL_MIN`, `FDM_EJECT_SEC`, ...) share the kind of their source.
 */
export const TIMING_KIND: Readonly<Record<string, TimingKind>> = {
  SPAWN_DEFERRAL_MIN: 'protocol',
  SPAWN_DEFERRAL_ENTERPRISE_MIN: 'protocol',
  SPAWN_LOOP: 'protocol',
  INSTALL_START_USUAL_MIN: 'ui-text',
  DEPLOY_ESTIMATE_MIN: 'ui-text',
  PAYMENT_WINDOW_MIN: 'ui-text',
  MESSAGE_TTL_SEC: 'protocol',
  REGISTRATION_DEADLINE_MIN: 'protocol',
  MESSAGE_PEER_FETCH: 'protocol',
  UI_WATCHER_MIN: 'ui-watcher',
  UI_WATCHER_POLL_SEC: 'ui-watcher',
  SIGN_TIMESTAMP_MAX_AGE_SEC: 'protocol',
  SIGN_TIMESTAMP_MAX_AHEAD_SEC: 'protocol',
  PAYMENT_CONFIRMATION_BLOCKS: 'protocol',
  GATEWAY_TIMEOUT_SEC: 'fdm',
  GATEWAY_ROUND_ROBIN_TIMEOUT_SEC: 'fdm',
  LOCATION_TTL_SEC: 'protocol',
  LOCATION_REFRESH_SEC: 'protocol',
  LOCATION_CLEAN_SHUTDOWN_DROP_SEC: 'protocol',
  SYNCED_RESPAWN_EXTRA_MIN: 'protocol',
  CRASH_BACKOFF_SEC: 'protocol',
  CRASH_STABLE_RUN_MIN: 'protocol',
  CRASH_RESTART_COUNT: 'protocol',
  CRASH_RESTART_WINDOW_MIN: 'protocol',
  PORT_CHECK_EVERY_MIN: 'protocol',
  IMAGE_RECHECK_HOURS: 'protocol',
  IMAGE_RECHECK_INTERVAL_MS: 'protocol',
  IMAGE_RECHECK_FIRST_MIN: 'protocol',
  IMAGE_RECHECK_APP_SPACING_SEC: 'protocol',
  SYNC_STALL_NUDGE_MIN: 'protocol',
  SYNC_STALL_REMOVE_MIN: 'protocol',
  FDM_TIMING: 'fdm',
  FDM_FETCH_SEC: 'fdm',
  FDM_FETCH_STALE_RETRY_SEC: 'fdm',
  FDM_FAILOVER: 'fdm',
  G_ELECTION_EVERY_SEC: 'protocol',
  G_STANDBY_WAIT_MIN_PER_POSITION: 'protocol',
  CUSTOM_CERT_RENEW_BELOW_DAYS: 'fdm',
  FREE_UPDATE_RATE_LIMITS: 'protocol',
  FREE_UPDATE_MAX_EXTENSION_BLOCKS: 'protocol',
  EXPIRY_SWEEP_EVERY_BLOCKS: 'protocol',
  MCP_CANCEL_EXPIRE_BLOCKS: 'protocol',
};
