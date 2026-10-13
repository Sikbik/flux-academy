/**
 * The Beat (docs/DESIGN.md section 4): every real block (about 30 s) fires one soft pulse. Here that is
 * three things, all driven by `onBlock`, so there is never a simulated beat:
 *
 * - `html[data-beat]` alternates `a` and `b`, which restarts the CSS animation that pulses `--flash`
 *   from 1 to 0 (tick marks, hairlines and counters in the design system read it);
 * - `useBeatCount()` is a counter components can key a flare on;
 * - the scene bridge fires the scenes' block pulse (see sceneBridge.ts).
 */

import { useSyncExternalStore } from 'react';
import { onBlock } from '@/data/useLayer';

let count = 0;
const listeners = new Set<() => void>();
let flip = false;

/** Starts the beat. Refcounted and idempotent; returns a stop function. */
let started = 0;
let off: (() => void) | null = null;

export function startBeat(): () => void {
  started += 1;
  if (started === 1) {
    off = onBlock(() => {
      count += 1;
      flip = !flip;
      if (typeof document !== 'undefined') document.documentElement.dataset.beat = flip ? 'a' : 'b';
      for (const l of [...listeners]) l();
    });
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    started -= 1;
    if (started === 0) {
      off?.();
      off = null;
      if (typeof document !== 'undefined') delete document.documentElement.dataset.beat;
    }
  };
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** How many real blocks have landed since the page loaded. Changes once per block. */
export function useBeatCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => count,
    () => 0,
  );
}
