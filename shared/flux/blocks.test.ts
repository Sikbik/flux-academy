import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BLOCKS_PER_MONTH,
  blocksPerDay,
  blocksRemaining,
  blocksToDays,
  blocksToMonths,
  blocksToSeconds,
  daysToBlocks,
  durationDiscount,
  estimateTimeAtHeight,
  expiryHeight,
  humanBlocks,
  humanDuration,
  MAX_EXPIRE_BLOCKS,
  monthsToBlocks,
  secondsToBlocks,
} from './blocks.ts';

test('a pricing month is 88000 blocks and a year 1056000', () => {
  assert.equal(BLOCKS_PER_MONTH, 88_000);
  assert.equal(monthsToBlocks(12), MAX_EXPIRE_BLOCKS);
  assert.equal(monthsToBlocks(3), 264_000);
  assert.equal(monthsToBlocks(0.5), 44_000);
});

test('blocks per day at 30 s is 2880', () => {
  assert.equal(blocksPerDay(), 2880);
  assert.equal(blocksPerDay(120), 720);
  assert.equal(blocksPerDay(0), 2880, 'a bad interval falls back to the target');
});

test('conversions round trip', () => {
  assert.equal(blocksToSeconds(88_000), 2_640_000);
  assert.equal(secondsToBlocks(2_640_000), 88_000);
  assert.equal(daysToBlocks(7), 20_160);
  assert.equal(blocksToDays(20_160), 7);
  assert.equal(blocksToMonths(264_000), 3);
  for (const n of [0, 1, 2880, 88_000, 1_056_000]) assert.equal(secondsToBlocks(blocksToSeconds(n)), n);
});

test('non finite input is treated as zero', () => {
  assert.equal(blocksToSeconds(Number.NaN), 0);
  assert.equal(monthsToBlocks(-1), 0);
  assert.equal(blocksToMonths(Number.POSITIVE_INFINITY), 0);
});

test('duration discounts follow the official tiers', () => {
  assert.equal(durationDiscount(1), null);
  assert.equal(durationDiscount(2.99), null);
  assert.equal(durationDiscount(3)?.factor, 0.97);
  assert.equal(durationDiscount(6)?.factor, 0.94);
  assert.equal(durationDiscount(9)?.factor, 0.88);
  assert.equal(durationDiscount(12)?.factor, 0.88);
});

test('humanDuration uses at most two units', () => {
  assert.equal(humanDuration(1), '1 second');
  assert.equal(humanDuration(45), '45 seconds');
  assert.equal(humanDuration(60), '1 minute');
  assert.equal(humanDuration(3600), '1 hour');
  assert.equal(humanDuration(3720), '1 hour 2 minutes');
  assert.equal(humanDuration(86_400), '1 day');
  assert.equal(humanDuration(2_640_000), '30 days 13 hours');
  assert.equal(humanDuration(-5), '0 seconds');
});

test('humanBlocks groups digits', () => {
  assert.equal(humanBlocks(88_000), '88,000 blocks, about 30 days 13 hours');
  assert.equal(humanBlocks(1), '1 block, about 30 seconds');
});

test('expiry arithmetic', () => {
  assert.equal(expiryHeight(3_000_000, 88_000), 3_088_000);
  assert.equal(blocksRemaining(3_000_000, 88_000, 3_080_000), 8000);
  assert.equal(blocksRemaining(3_000_000, 88_000, 3_100_000), 0);
  const t = estimateTimeAtHeight(3_000_100, 3_000_000, 1_000_000, 30);
  assert.equal(t, 1_000_000 + 100 * 30 * 1000);
});
