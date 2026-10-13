// Adapted from fluxcommunity/server/src/http/ratelimit.ts

import { type Clock, systemClock } from '../core/clock.ts';
import type { RateClass } from '../core/context.ts';

export interface TakeResult {
  ok: boolean;
  /** Whole seconds until a token is available again (0 when ok). */
  retryAfterSec: number;
}

/**
 * Token bucket per key (client IP). `burst` tokens, refilled at `refillPerSec`. Memory is bounded: when
 * the table is full the least recently used buckets are evicted, and idle buckets are dropped on a timer.
 */
export class TokenBuckets {
  readonly #burst: number;
  readonly #rate: number;
  readonly #max: number;
  readonly #clock: Clock;
  readonly #buckets = new Map<string, { tokens: number; at: number }>();
  #sweeper: NodeJS.Timeout | null = null;

  constructor(opts: { burst: number; refillPerSec: number; maxKeys?: number; clock?: Clock }) {
    this.#burst = opts.burst;
    this.#rate = opts.refillPerSec;
    this.#max = opts.maxKeys ?? 50_000;
    this.#clock = opts.clock ?? systemClock;
  }

  get size(): number {
    return this.#buckets.size;
  }

  take(key: string, cost = 1): TakeResult {
    const now = this.#clock.now();
    let b = this.#buckets.get(key);
    if (b) {
      b.tokens = Math.min(this.#burst, b.tokens + ((now - b.at) / 1000) * this.#rate);
      b.at = now;
      // Re-insert so Map iteration order is least- to most-recently used.
      this.#buckets.delete(key);
    } else {
      b = { tokens: this.#burst, at: now };
      if (this.#buckets.size >= this.#max) {
        const oldest = this.#buckets.keys().next().value;
        if (oldest !== undefined) this.#buckets.delete(oldest);
      }
    }
    this.#buckets.set(key, b);
    if (b.tokens >= cost) {
      b.tokens -= cost;
      return { ok: true, retryAfterSec: 0 };
    }
    const missing = cost - b.tokens;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(missing / this.#rate)) };
  }

  /** Drop buckets that have fully refilled (they are indistinguishable from new ones). */
  sweep(): void {
    const now = this.#clock.now();
    const fullAfterMs = (this.#burst / this.#rate) * 1000;
    for (const [k, b] of this.#buckets) {
      if (now - b.at >= fullAfterMs) this.#buckets.delete(k);
    }
  }

  startSweeper(everyMs = 60_000): void {
    if (this.#sweeper) return;
    this.#sweeper = setInterval(() => this.sweep(), everyMs);
    this.#sweeper.unref();
  }

  stop(): void {
    if (this.#sweeper) clearInterval(this.#sweeper);
    this.#sweeper = null;
  }
}

export interface RateLimiterOptions {
  classes: Record<RateClass, { burst: number; refillPerSec: number }>;
  maxKeys?: number;
  clock?: Clock;
}

/**
 * One token bucket table per rate class, all keyed by client IP. `exempt` is never limited. Routes pick
 * their class; POST routes are `write`, which is deliberately small.
 */
export class RateLimiter {
  readonly #tables: Record<RateClass, TokenBuckets>;

  constructor(opts: RateLimiterOptions) {
    const mk = (c: RateClass) =>
      new TokenBuckets({ ...opts.classes[c], maxKeys: opts.maxKeys, clock: opts.clock });
    this.#tables = {
      read: mk('read'),
      write: mk('write'),
      stream: mk('stream'),
      static: mk('static'),
      exempt: mk('exempt'),
    };
  }

  take(cls: RateClass, ip: string, cost = 1): TakeResult {
    if (cls === 'exempt') return { ok: true, retryAfterSec: 0 };
    return this.#tables[cls].take(ip, cost);
  }

  /** Total tracked clients across classes (diagnostics and tests). */
  get size(): number {
    return (
      this.#tables.read.size + this.#tables.write.size + this.#tables.stream.size + this.#tables.static.size
    );
  }

  startSweeper(everyMs = 60_000): void {
    for (const t of Object.values(this.#tables)) t.startSweeper(everyMs);
  }

  stop(): void {
    for (const t of Object.values(this.#tables)) t.stop();
  }
}
