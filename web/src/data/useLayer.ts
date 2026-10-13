/**
 * The app-wide data layer singleton and the hook that holds it open.
 *
 * Importing this module starts nothing. The engine runs while at least one component holds it (any data
 * hook does, and so does the app shell), so a lab mounted in isolation still gets data and nobody has to
 * remember to start anything. Teardown is deferred a tick, so a StrictMode double mount reuses it.
 */

import type { BlockEvent } from '@shared/api';
import { useEffect } from 'react';
import { getFlags } from '@/lib/flags';
import { browserEnv, getSharedTicker } from './clock';
import { createEngine } from './engine';
import { createLayerController } from './layer';
import { useDataStore } from './store';

const blockListeners = new Set<(event: BlockEvent) => void>();

/**
 * Subscribe to real blocks. The callback runs once per genuinely new block (never for the baked sample,
 * never on a reconnect) and returns an unsubscribe function. If the API is offline it never runs: there
 * is no simulated beat.
 */
export function onBlock(cb: (event: BlockEvent) => void): () => void {
  blockListeners.add(cb);
  return () => {
    blockListeners.delete(cb);
  };
}

const blockBus = {
  emit(event: BlockEvent) {
    for (const listener of [...blockListeners]) {
      try {
        listener(event);
      } catch (e) {
        console.error('[flux-data] a block listener threw', e);
      }
    }
  },
};

const controller = createLayerController(() => {
  const flags = getFlags();
  return createEngine({
    env: browserEnv(),
    ticker: getSharedTicker(),
    store: useDataStore,
    blocks: blockBus,
    loadBaked: async () => (await import('./baked')).getBaked(),
    demo: flags.demo,
    simulateBeatSec: flags.beatSec,
  });
});

/** Hold the layer open. Idempotent and refcounted. Returns a release function. */
export function startDataLayer(): () => void {
  return controller.acquire();
}

if (import.meta.hot) {
  // Never leak a stream or timers across hot module reloads.
  import.meta.hot.dispose(() => controller.dispose());
}

/** Internal: every data hook calls this so the layer runs while anything reads it. */
export function useLayer(): void {
  useEffect(() => controller.acquire(), []);
}
