import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blocksToSeconds, LEGACY_BLOCK_SEC, TARGET_BLOCK_SEC } from './blocks.ts';
import * as Flux from './index.ts';
import * as Timing from './timing.ts';
import {
  CRASH_BACKOFF_MAX_MIN,
  CRASH_BACKOFF_SEC,
  CRASH_RESTART_COUNT,
  CRASH_RESTART_WINDOW_MIN,
  CRASH_STABLE_RUN_MIN,
  CUSTOM_CERT_RENEW_BELOW_DAYS,
  DEPLOY_ESTIMATE_MIN,
  EXPIRY_SWEEP_EVERY_BLOCKS,
  FDM_EJECT_SEC,
  FDM_FAILOVER,
  FDM_FETCH_SEC,
  FDM_FETCH_STALE_RETRY_SEC,
  FDM_RESTORE_SEC,
  FDM_TIMING,
  FREE_UPDATE_MAX_EXTENSION_BLOCKS,
  FREE_UPDATE_RATE_LIMITS,
  G_ELECTION_EVERY_SEC,
  G_STANDBY_WAIT_MIN_PER_POSITION,
  GATEWAY_ROUND_ROBIN_TIMEOUT_SEC,
  GATEWAY_TIMEOUT_SEC,
  gStandbyWaitMin,
  IMAGE_RECHECK_APP_SPACING_SEC,
  IMAGE_RECHECK_FIRST_MIN,
  IMAGE_RECHECK_HOURS,
  IMAGE_RECHECK_INTERVAL_MS,
  INSTALL_START_USUAL_MIN,
  LOCATION_CLEAN_SHUTDOWN_DROP_SEC,
  LOCATION_REFRESH_SEC,
  LOCATION_TTL_MIN,
  LOCATION_TTL_SEC,
  MCP_CANCEL_EXPIRE_BLOCKS,
  MESSAGE_PEER_FETCH,
  MESSAGE_TTL_SEC,
  PAYMENT_CONFIRMATION_BLOCKS,
  PAYMENT_CONFIRMATION_SEC,
  PAYMENT_WINDOW_MIN,
  PORT_CHECK_EVERY_MIN,
  REGISTRATION_DEADLINE_MIN,
  replacementWaitMin,
  SIGN_TIMESTAMP_MAX_AGE_SEC,
  SIGN_TIMESTAMP_MAX_AHEAD_SEC,
  SPAWN_DEFERRAL_ENTERPRISE_MIN,
  SPAWN_DEFERRAL_MIN,
  SPAWN_DEFERRAL_RANGE_MIN,
  SPAWN_DEFERRAL_TIER_MINUTES,
  SPAWN_LOOP,
  SYNC_STALL_NUDGE_MIN,
  SYNC_STALL_REMOVE_MIN,
  SYNCED_RESPAWN_EXTRA_MIN,
  TIMING_KIND,
  UI_WATCHER_MIN,
  UI_WATCHER_POLL_SEC,
} from './timing.ts';

test('install deferrals match FACTS 2.4 and 6.1 row 10', () => {
  assert.deepEqual(
    { ...SPAWN_DEFERRAL_MIN },
    {
      nimbusSmallApp: 57,
      stratusMediumApp: 87,
      stratusSmallApp: 117,
      staticIpNode: 57,
      dataCenterNode: 57,
      arcaneOsNonEnterprise: 2,
    },
  );
  assert.deepEqual(
    { ...SPAWN_DEFERRAL_ENTERPRISE_MIN },
    { nimbusSmallApp: 12, stratusMediumApp: 21, stratusSmallApp: 30 },
  );
});

test('deferrals grow with the size of the node, and the enterprise column is shorter', () => {
  assert.ok(117 > 87 && 87 > 57 && 57 > 2);
  assert.ok(SPAWN_DEFERRAL_MIN.stratusSmallApp > SPAWN_DEFERRAL_MIN.stratusMediumApp);
  assert.ok(SPAWN_DEFERRAL_MIN.stratusMediumApp > SPAWN_DEFERRAL_MIN.nimbusSmallApp);
  assert.ok(SPAWN_DEFERRAL_MIN.nimbusSmallApp > SPAWN_DEFERRAL_MIN.arcaneOsNonEnterprise);
  assert.deepEqual([...SPAWN_DEFERRAL_TIER_MINUTES], [57, 87, 117]);
  assert.deepEqual({ ...SPAWN_DEFERRAL_RANGE_MIN }, { min: 57, max: 117 });
  for (const k of ['nimbusSmallApp', 'stratusMediumApp', 'stratusSmallApp'] as const) {
    assert.ok(SPAWN_DEFERRAL_ENTERPRISE_MIN[k] < SPAWN_DEFERRAL_MIN[k], k);
  }
});

test('the longest deferral plus the usual start fits "about two hours" (FACTS 6.1 row 10)', () => {
  const worst = SPAWN_DEFERRAL_RANGE_MIN.max + INSTALL_START_USUAL_MIN.to;
  assert.ok(worst > DEPLOY_ESTIMATE_MIN, 'the UI estimate is shorter than the worst deferral');
  assert.ok(worst <= 120, 'still about two hours');
});

test('spawn loop and install start', () => {
  assert.deepEqual(
    { ...SPAWN_LOOP },
    {
      installDelaySec: 120,
      enterpriseNodeEverySec: 30,
      otherNodeMinEverySec: 60,
      otherNodeMaxEverySec: 1800,
    },
  );
  assert.ok(SPAWN_LOOP.otherNodeMinEverySec < SPAWN_LOOP.otherNodeMaxEverySec);
  assert.deepEqual({ ...INSTALL_START_USUAL_MIN }, { from: 1, to: 3 });
});

test('payment and registration windows (FACTS 4.7, 9.5.1)', () => {
  assert.equal(DEPLOY_ESTIMATE_MIN, 45);
  assert.equal(PAYMENT_WINDOW_MIN, 30);
  assert.equal(MESSAGE_TTL_SEC, 3600);
  assert.equal(SIGN_TIMESTAMP_MAX_AGE_SEC, 3600);
  assert.equal(SIGN_TIMESTAMP_MAX_AHEAD_SEC, 300);
  assert.equal(GATEWAY_TIMEOUT_SEC, 30);
  assert.equal(GATEWAY_ROUND_ROBIN_TIMEOUT_SEC, 120);
  assert.ok(GATEWAY_ROUND_ROBIN_TIMEOUT_SEC > GATEWAY_TIMEOUT_SEC);
  // The UI window is inside the message lifetime, so a payment inside it always meets a live message.
  assert.ok(PAYMENT_WINDOW_MIN * 60 < MESSAGE_TTL_SEC);
  assert.ok(PAYMENT_WINDOW_MIN < DEPLOY_ESTIMATE_MIN);
});

test('payment confirms in 1 to 3 blocks, 30 to 90 s (FACTS 6.1 row 7)', () => {
  assert.deepEqual({ ...PAYMENT_CONFIRMATION_BLOCKS }, { min: 1, max: 3 });
  assert.deepEqual({ ...PAYMENT_CONFIRMATION_SEC }, { min: 30, max: 90 });
  assert.equal(PAYMENT_CONFIRMATION_SEC.max, blocksToSeconds(3));
  assert.equal(TARGET_BLOCK_SEC, 30);
});

test('location record lifetime: 7500 s is 125 minutes, refreshed hourly (FACTS 6.1 row 12, 6.3)', () => {
  assert.equal(LOCATION_TTL_SEC, 7500);
  assert.equal(LOCATION_TTL_MIN, 125);
  assert.equal(LOCATION_TTL_SEC / 60, LOCATION_TTL_MIN);
  assert.equal(LOCATION_REFRESH_SEC, 3600);
  assert.equal(LOCATION_CLEAN_SHUTDOWN_DROP_SEC, 420);
  // A record has to survive more than one refresh, and a clean shutdown is faster than an expiry.
  assert.ok(LOCATION_TTL_SEC > LOCATION_REFRESH_SEC * 2);
  assert.ok(LOCATION_CLEAN_SHUTDOWN_DROP_SEC < LOCATION_TTL_SEC);
});

test('replacement wait: 125 minutes, up to 27 more for a synced app (FACTS 6.3, 6.5)', () => {
  assert.equal(SYNCED_RESPAWN_EXTRA_MIN, 27);
  assert.equal(replacementWaitMin(false), 125);
  assert.equal(replacementWaitMin(true), 152);
  assert.ok(replacementWaitMin(true) > replacementWaitMin(false));
});

test('crash backoff ladder (FACTS 6.3)', () => {
  assert.deepEqual([...CRASH_BACKOFF_SEC], [0, 30, 300, 900, 1800]);
  assert.equal(CRASH_BACKOFF_MAX_MIN, 30);
  assert.equal(CRASH_STABLE_RUN_MIN, 10);
  assert.equal(CRASH_RESTART_COUNT, 5);
  assert.equal(CRASH_RESTART_WINDOW_MIN, 5);
  const ladder = [...CRASH_BACKOFF_SEC];
  assert.deepEqual(
    ladder,
    [...ladder].sort((a, b) => a - b),
    'the ladder only grows',
  );
  // A run that resets the ladder is longer than the shortest wait that is not the first retry.
  assert.ok(CRASH_STABLE_RUN_MIN * 60 > CRASH_BACKOFF_SEC[2]!);
});

test('health checks, image re-check and sync stalls', () => {
  assert.equal(PORT_CHECK_EVERY_MIN, 60);
  assert.equal(IMAGE_RECHECK_HOURS, 6);
  assert.equal(SYNC_STALL_NUDGE_MIN, 3);
  assert.equal(SYNC_STALL_REMOVE_MIN, 20);
  assert.ok(SYNC_STALL_NUDGE_MIN < SYNC_STALL_REMOVE_MIN);
});

test('load balancer timings (FACTS 6.4)', () => {
  assert.deepEqual(
    { ...FDM_TIMING },
    {
      healthIntervalSec: 3,
      ejectAfterFailures: 2,
      restoreAfterSuccesses: 2,
      stickyHours: 8,
      retries: 3,
      requestTimeoutSec: 15,
      serverTimeoutSec: 25,
      syncedServerTimeoutSec: 20,
      clientTimeoutSec: 120,
      connectTimeoutSec: 10,
    },
  );
  assert.equal(CUSTOM_CERT_RENEW_BELOW_DAYS, 30);
  assert.equal(FDM_EJECT_SEC, 6);
  assert.equal(FDM_RESTORE_SEC, 6);
  // Dropping a dead instance is seconds; replacing it is hours.
  assert.ok(FDM_EJECT_SEC * 100 < LOCATION_TTL_SEC);
  assert.ok(FDM_TIMING.syncedServerTimeoutSec < FDM_TIMING.serverTimeoutSec);
  assert.ok(FDM_TIMING.serverTimeoutSec < FDM_TIMING.clientTimeoutSec);
});

test('free update rate limit and expiry sweep (FACTS 4.5, 5.4)', () => {
  assert.deepEqual(
    FREE_UPDATE_RATE_LIMITS.map((r) => [r.updates, r.blocks]),
    [
      [5, 720],
      [8, 1440],
      [10, 3600],
    ],
  );
  assert.equal(FREE_UPDATE_MAX_EXTENSION_BLOCKS, 8);
  assert.equal(EXPIRY_SWEEP_EVERY_BLOCKS, 8);
  // At 30 s blocks the windows are 6, 12 and 30 hours.
  assert.deepEqual(
    FREE_UPDATE_RATE_LIMITS.map((r) => blocksToSeconds(r.blocks) / 3600),
    [6, 12, 30],
  );
  // 8 blocks after the fork is 2 pre-fork multiples of 4.
  assert.equal(EXPIRY_SWEEP_EVERY_BLOCKS, 2 * (LEGACY_BLOCK_SEC / TARGET_BLOCK_SEC));
});

test('the index exports the timing constants', () => {
  assert.equal(Flux.LOCATION_TTL_SEC, LOCATION_TTL_SEC);
  assert.equal(Flux.IMAGE_RECHECK_HOURS, 6);
  assert.equal(Flux.SPAWN_DEFERRAL_MIN.stratusSmallApp, 117);
  assert.equal(typeof Flux.replacementWaitMin, 'function');
});

test('the clocks of FACTS 6.6: the UI text is not the node deadline', () => {
  assert.equal(REGISTRATION_DEADLINE_MIN, 60);
  assert.equal(REGISTRATION_DEADLINE_MIN * 60, MESSAGE_TTL_SEC);
  assert.deepEqual({ ...MESSAGE_PEER_FETCH }, { attempts: 2, everySec: 60 });
  assert.equal(UI_WATCHER_MIN, 30);
  assert.equal(UI_WATCHER_POLL_SEC, 30);
  // The UI payment text is shorter than the real node-side deadline, and it is text, not a protocol clock.
  assert.ok(PAYMENT_WINDOW_MIN < REGISTRATION_DEADLINE_MIN);
  assert.equal(TIMING_KIND.PAYMENT_WINDOW_MIN, 'ui-text');
  assert.equal(TIMING_KIND.DEPLOY_ESTIMATE_MIN, 'ui-text');
  assert.equal(TIMING_KIND.INSTALL_START_USUAL_MIN, 'ui-text');
  assert.equal(TIMING_KIND.MESSAGE_TTL_SEC, 'protocol');
  assert.equal(TIMING_KIND.UI_WATCHER_MIN, 'ui-watcher');
  assert.equal(TIMING_KIND.FDM_FAILOVER, 'fdm');
  // The MCP cancel is a 120 block term: an hour of 30 second blocks.
  assert.equal(MCP_CANCEL_EXPIRE_BLOCKS, 120);
  assert.equal(MCP_CANCEL_EXPIRE_BLOCKS * TARGET_BLOCK_SEC, 3600);
  assert.equal(TIMING_KIND.MCP_CANCEL_EXPIRE_BLOCKS, 'protocol');
});

test('FDM polling and g: failover are minutes, not seconds (FACTS 6.1 row 13, 6.4)', () => {
  assert.equal(FDM_FETCH_SEC, 30);
  assert.equal(FDM_FETCH_STALE_RETRY_SEC, 5);
  assert.deepEqual({ ...FDM_FAILOVER }, { minFailedChecks: 3, minUnhealthySec: 90, passSpacingSec: 25 });
  assert.equal(G_ELECTION_EVERY_SEC, 30);
  assert.equal(G_STANDBY_WAIT_MIN_PER_POSITION, 3);
  assert.equal(gStandbyWaitMin(0), 0);
  assert.equal(gStandbyWaitMin(2), 6);
  // Three failed checks at the 3 s interval alone take 9 s, but FDM also waits 90 s: far slower than eject.
  assert.ok(FDM_FAILOVER.minUnhealthySec > FDM_EJECT_SEC * 10);
  // A check pass is further apart than the health check interval.
  assert.ok(FDM_FAILOVER.passSpacingSec > FDM_TIMING.healthIntervalSec);
});

test('registry re-check: 21,600,000 ms is 6 hours, first check 10 to 30 minutes after start (FACTS 6.3)', () => {
  assert.equal(IMAGE_RECHECK_INTERVAL_MS, 21_600_000);
  assert.equal(IMAGE_RECHECK_INTERVAL_MS / 3_600_000, IMAGE_RECHECK_HOURS);
  assert.deepEqual({ ...IMAGE_RECHECK_FIRST_MIN }, { min: 10, max: 30 });
  assert.equal(IMAGE_RECHECK_APP_SPACING_SEC, 5);
});

test('every kind-tagged constant exists, and every duration export has a kind', () => {
  const kinds = new Set(['protocol', 'ui-text', 'ui-watcher', 'fdm']);
  for (const [name, kind] of Object.entries(TIMING_KIND)) {
    assert.ok(name in Timing, `${name} is not exported`);
    assert.ok(kinds.has(kind), `${name}: ${kind}`);
  }
  // Derived values (and helpers) are the only exports allowed without their own entry.
  const derived = new Set([
    'TIMING_KIND',
    'replacementWaitMin',
    'gStandbyWaitMin',
    'SPAWN_DEFERRAL_TIER_MINUTES',
    'SPAWN_DEFERRAL_RANGE_MIN',
    'PAYMENT_CONFIRMATION_SEC',
    'LOCATION_TTL_MIN',
    'CRASH_BACKOFF_MAX_MIN',
    'FDM_EJECT_SEC',
    'FDM_RESTORE_SEC',
  ]);
  for (const name of Object.keys(Timing)) {
    assert.ok(name in TIMING_KIND || derived.has(name), `${name} has no kind`);
  }
});
