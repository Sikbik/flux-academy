/**
 * Rhythm. Output that arrives at a perfectly even pace looks fake, so each line gets a delay
 * around the command's `stream` value with a deterministic wobble: bursts for layer and progress
 * lines, a short breath before a new section. Pure and seeded, so tests and replays agree.
 */

import type { OutLine, Scheduler } from './types';

/** mulberry32: a tiny seeded PRNG returning [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BURST =
  /(Pulling fs layer|Waiting|Layer already exists|Mounted from|Preparing|=> => |resolve |transferring )/;
const SECTION = /^(\s*=> \[|#\d+ \[|Step \d+|Status:|Digest:|Successfully |The push refers)/;

/** Per-line delays in milliseconds. `base` 0 means everything prints at once. */
export function lineDelays(lines: readonly OutLine[], base: number, seed = 1): number[] {
  if (base <= 0) return lines.map(() => 0);
  const rnd = seeded(seed + lines.length * 31);
  return lines.map((l, i) => {
    let f = 0.6 + rnd() * 0.9;
    if (BURST.test(l.text)) f *= 0.35;
    if (SECTION.test(l.text)) f *= 2.2;
    if (l.text === '') f *= 0.4;
    const ms = Math.round(base * f);
    // A process takes a moment to start.
    const startup = i === 0 ? Math.min(220, base * 3) : 0;
    return Math.min(700, Math.max(6, ms)) + startup;
  });
}

/** The delay before typing character `i` of a command, like a person who knows what they want. */
export function typingDelay(text: string, i: number, seed = 7): number {
  const rnd = seeded(seed + i * 17 + text.length);
  const prev = i > 0 ? text[i - 1] : '';
  let ms = 34 + rnd() * 40;
  if (prev === ' ') ms += 26;
  if (prev === '-' || prev === '/' || prev === ':') ms += 14;
  if (rnd() < 0.06) ms += 90;
  return Math.round(ms);
}

/** Real timers. */
export const realScheduler: Scheduler = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

/** A scheduler driven by hand, for deterministic tests. `advance` runs everything due. */
export class ManualScheduler implements Scheduler {
  private now = 0;
  private seq = 0;
  private tasks = new Map<number, { at: number; fn: () => void }>();

  setTimeout(fn: () => void, ms: number): unknown {
    const id = ++this.seq;
    this.tasks.set(id, { at: this.now + Math.max(0, ms), fn });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  get pending(): number {
    return this.tasks.size;
  }

  /** Move time forward, running tasks in order (including ones they schedule). */
  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      let nextId = -1;
      let nextAt = Number.POSITIVE_INFINITY;
      for (const [id, t] of this.tasks) {
        if (t.at <= target && (t.at < nextAt || (t.at === nextAt && id < nextId))) {
          nextId = id;
          nextAt = t.at;
        }
      }
      if (nextId < 0) break;
      const task = this.tasks.get(nextId);
      this.tasks.delete(nextId);
      this.now = nextAt;
      task?.fn();
    }
    this.now = target;
  }

  /** Run until nothing is scheduled (with a safety limit). */
  flush(): void {
    for (let i = 0; i < 10_000 && this.tasks.size > 0; i += 1) this.advance(1000);
  }
}
