/**
 * Block and time arithmetic for Flux subscriptions.
 *
 * Every constant has a source. FluxOS config is `ZelBack/config/default.js` (`fluxapps`, FluxOS 8.20.0);
 * the live chain was checked on 2026-10-12 (block height about 3,031,000).
 *
 * Pure and framework-free. No Node built-ins, no DOM.
 */

/** Block height of the Proof of Node fork. From it, blocks come 4 times faster (30 s instead of 120 s). */
// source: config.fluxapps.daemonPONFork = 2020000
export const PON_FORK_HEIGHT = 2_020_000;

/** Protocol target block interval since the fork, in seconds. */
// source: docs/ARCHITECTURE.md section 4.1 (ChainInfo.targetBlockSec), FluxOS comment "chain works 4x faster"
export const TARGET_BLOCK_SEC = 30;

/** Block interval before the fork. Only useful for explaining old numbers. */
// source: 4 x faster after the fork, so 120 s before
export const LEGACY_BLOCK_SEC = 120;

/** Blocks in "one month" of subscription, the unit the price table is stated in. */
// source: config.fluxapps.blocksLasting (22000) x 4 after the PON fork, appSpecHelpers.js getAppFiatAndFluxPrice
export const BLOCKS_PER_MONTH = 88_000;

/** The same unit before the fork. */
// source: config.fluxapps.blocksLasting
export const LEGACY_BLOCKS_PER_MONTH = 22_000;

/** Shortest subscription an app may be registered or updated with (used to cancel). */
// source: config.fluxapps.cancel1BlockMinBlocksAllowance = 1 (active since block 1964447)
export const MIN_EXPIRE_BLOCKS = 1;

/** Longest subscription, roughly a year. */
// source: config.fluxapps.postPonMaxBlocksAllowance = 1056000
export const MAX_EXPIRE_BLOCKS = 1_056_000;

/** Default `expire` of a new spec: one month. */
export const DEFAULT_EXPIRE_BLOCKS = BLOCKS_PER_MONTH;

/** Subscription length discounts, applied to the whole price. Months are `expire / 88000`. */
// source: appSpecHelpers.js getAppFiatAndFluxPrice ("Apply subscription duration discount")
export const DURATION_DISCOUNTS: readonly { minMonths: number; factor: number; label: string }[] = [
  { minMonths: 9, factor: 0.88, label: '12 percent' },
  { minMonths: 6, factor: 0.94, label: '6 percent' },
  { minMonths: 3, factor: 0.97, label: '3 percent' },
];

const SECONDS_PER_DAY = 86_400;

function finitePositive(n: number, fallback: number): number {
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Blocks per day at a block interval (default 30 s gives 2880). */
export function blocksPerDay(blockSec: number = TARGET_BLOCK_SEC): number {
  return SECONDS_PER_DAY / finitePositive(blockSec, TARGET_BLOCK_SEC);
}

/** Blocks per 30-day month at a block interval (30 s gives 86400). Not the pricing month; see BLOCKS_PER_MONTH. */
export function blocksPerCalendarMonth(blockSec: number = TARGET_BLOCK_SEC): number {
  return blocksPerDay(blockSec) * 30;
}

/** Whole blocks for a number of pricing months (a pricing month is 88000 blocks). */
export function monthsToBlocks(months: number): number {
  if (!Number.isFinite(months) || months < 0) return 0;
  return Math.round(months * BLOCKS_PER_MONTH);
}

/** Pricing months for a number of blocks. */
export function blocksToMonths(blocks: number): number {
  if (!Number.isFinite(blocks) || blocks < 0) return 0;
  return blocks / BLOCKS_PER_MONTH;
}

/** Seconds that a number of blocks last at a block interval. */
export function blocksToSeconds(blocks: number, blockSec: number = TARGET_BLOCK_SEC): number {
  if (!Number.isFinite(blocks) || blocks < 0) return 0;
  return blocks * finitePositive(blockSec, TARGET_BLOCK_SEC);
}

/** Whole blocks (rounded to nearest) that fit in a number of seconds. */
export function secondsToBlocks(seconds: number, blockSec: number = TARGET_BLOCK_SEC): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.round(seconds / finitePositive(blockSec, TARGET_BLOCK_SEC));
}

export function blocksToDays(blocks: number, blockSec: number = TARGET_BLOCK_SEC): number {
  return blocksToSeconds(blocks, blockSec) / SECONDS_PER_DAY;
}

export function daysToBlocks(days: number, blockSec: number = TARGET_BLOCK_SEC): number {
  return secondsToBlocks(days * SECONDS_PER_DAY, blockSec);
}

/** The discount factor and label for a subscription of `months` pricing months, or null for none. */
export function durationDiscount(months: number): { factor: number; label: string } | null {
  for (const d of DURATION_DISCOUNTS) {
    if (months >= d.minMonths) return { factor: d.factor, label: d.label };
  }
  return null;
}

/**
 * A short human duration: "45 seconds", "3 hours 20 minutes", "30 days 14 hours". Two units at most.
 */
export function humanDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0 seconds';
  const s = Math.round(seconds);
  if (s < 60) return `${s} ${s === 1 ? 'second' : 'seconds'}`;
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (days > 0) return hours > 0 ? `${plural(days, 'day')} ${plural(hours, 'hour')}` : plural(days, 'day');
  if (hours > 0)
    return minutes > 0 ? `${plural(hours, 'hour')} ${plural(minutes, 'minute')}` : plural(hours, 'hour');
  return plural(minutes, 'minute');
}

/** "88,000 blocks, about 30 days 13 hours" for display. */
export function humanBlocks(blocks: number, blockSec: number = TARGET_BLOCK_SEC): string {
  const n = Number.isFinite(blocks) ? Math.round(blocks) : 0;
  const grouped = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}${grouped} ${n === 1 ? 'block' : 'blocks'}, about ${humanDuration(
    blocksToSeconds(n, blockSec),
  )}`;
}

/** The block height at which a subscription registered at `registeredHeight` with `expire` ends. */
export function expiryHeight(registeredHeight: number, expire: number): number {
  return Math.round(registeredHeight + expire);
}

/**
 * The height at which a subscription ends, for apps registered before the Proof of Node fork: blocks that
 * fall after the fork count four times, because the chain then runs four times faster. FluxOS
 * `registryManager.js` (checkApplicationRegistrationNameConflicts); FACTS 5.1.
 */
export function effectiveExpiryHeight(registeredHeight: number, expire: number): number {
  const end = registeredHeight + expire;
  if (registeredHeight < PON_FORK_HEIGHT && end > PON_FORK_HEIGHT) {
    return Math.round(PON_FORK_HEIGHT + (end - PON_FORK_HEIGHT) * 4);
  }
  return Math.round(end);
}

/** Blocks left on a subscription at `currentHeight`, never negative. */
export function blocksRemaining(registeredHeight: number, expire: number, currentHeight: number): number {
  return Math.max(0, expiryHeight(registeredHeight, expire) - Math.round(currentHeight));
}

/**
 * Estimated wall-clock time (epoch ms) at which `targetHeight` is mined, given the current tip.
 * Uses `blockSec` for the future; a measured mean is usually a little above 30 s.
 */
export function estimateTimeAtHeight(
  targetHeight: number,
  tipHeight: number,
  tipTimeMs: number,
  blockSec: number = TARGET_BLOCK_SEC,
): number {
  return tipTimeMs + (targetHeight - tipHeight) * finitePositive(blockSec, TARGET_BLOCK_SEC) * 1000;
}
