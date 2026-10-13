/**
 * The typing animation behind quick-run chips and "Show me": a line appears one character at a
 * time at a human pace (engine/stream.ts `typingDelay`), so the learner sees what is being typed
 * and in what order. Framework free; the view passes a setter and a scheduler.
 */

import { realScheduler, typingDelay } from '../engine/stream';
import type { Scheduler } from '../engine/types';

export interface TypingJob {
  /** Resolves true when the whole line was typed, false when the job was cancelled. */
  readonly done: Promise<boolean>;
  /** Stop where it is. The text typed so far stays. */
  cancel(): void;
  /** Type the rest at once. */
  finish(): void;
}

export interface TypingOptions {
  /** Reduced motion or a test: the whole line appears at once. */
  instant?: boolean;
  scheduler?: Scheduler;
  seed?: number;
  /** Milliseconds before the first character. */
  lead?: number;
}

export function startTyping(
  text: string,
  set: (value: string) => void,
  options: TypingOptions = {},
): TypingJob {
  const scheduler = options.scheduler ?? realScheduler;
  const seed = options.seed ?? 7;
  let index = 0;
  let timer: unknown;
  let settled = false;
  let resolve: (v: boolean) => void = () => {};
  const done = new Promise<boolean>((r) => {
    resolve = r;
  });

  const clear = (): void => {
    if (timer !== undefined) scheduler.clearTimeout(timer);
    timer = undefined;
  };
  const settle = (ok: boolean): void => {
    settled = true;
    clear();
    resolve(ok);
  };
  const step = (): void => {
    if (settled) return;
    index += 1;
    set(text.slice(0, index));
    if (index >= text.length) {
      settle(true);
      return;
    }
    timer = scheduler.setTimeout(step, typingDelay(text, index, seed));
  };

  if (options.instant || text === '') {
    set(text);
    settle(true);
  } else {
    set('');
    timer = scheduler.setTimeout(step, options.lead ?? 90);
  }

  return {
    done,
    cancel() {
      if (!settled) settle(false);
    },
    finish() {
      if (settled) return;
      set(text);
      settle(true);
    },
  };
}
