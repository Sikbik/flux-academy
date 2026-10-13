/**
 * The shell's side of the scene bus (`@/scenes/bus`, owned by the scenes agent): the page WRITES the
 * accent, reduced motion, the forced quality tier, the chain clock, real geo data, pause and the
 * one-shot block pulse. Sections never touch three.js and the scenes never import shell code.
 *
 * Honesty: `geo` is only written when it came from the live API. The baked sample is never handed to
 * the scenes as if it were the network (they have their own sample bench, labelled as such).
 */

import { useEffect } from 'react';
import { useDataStore } from '@/data/store';
import { onBlock } from '@/data/useLayer';
import { getFlags } from '@/lib/flags';
import { parseTierQuery, type QualityTier } from '@/lib/quality';
import { type Accent, useSceneBus } from '@/scenes/bus';
import { effectiveReducedMotion, subscribeReducedMotion } from '@/system/motion';
import { anyModalOverlayOpen, useOverlays } from '@/system/overlays';
import { type QualityPref, usePrefs } from '@/system/prefs';
import { resolveAccent, useOverclock } from '@/system/theme';

const TIER_OF_PREF: Record<QualityPref, QualityTier | null> = {
  auto: null,
  low: 1,
  medium: 2,
  high: 3,
};

/** The tier to force: the `?q=` flag wins, then the visitor's preference, else null (the governor decides). */
export function forcedTier(search: string, pref: QualityPref): QualityTier | null {
  return parseTierQuery(search) ?? TIER_OF_PREF[pref];
}

export function useSceneBridge(): void {
  useEffect(() => {
    const bus = useSceneBus.getState();

    const syncAccent = () => bus.setAccent(resolveAccent() as Accent);
    const syncMotion = () => bus.setReducedMotion(effectiveReducedMotion());
    const syncQuality = () =>
      bus.setQuality(
        forcedTier(typeof location === 'undefined' ? '' : location.search, usePrefs.getState().quality),
      );
    const syncPaused = () => {
      const o = useOverlays.getState();
      // A modal covers the stage; ambient mode owns it.
      bus.setPaused(anyModalOverlayOpen(o));
    };
    const syncChain = () => {
      const c = useDataStore.getState().chain;
      bus.setChain({
        height: c.height,
        lastBlockAt: c.live ? c.lastBlockAt : null,
        intervalMs: c.intervalMs,
        live: c.live,
      });
    };
    const syncGeo = () => {
      const g = useDataStore.getState().geo;
      const real = g.data !== null && (g.status === 'live' || g.status === 'cache' || g.status === 'offline');
      const next = real ? g.data : null;
      if (useSceneBus.getState().geo !== next) bus.setGeo(next);
    };

    syncAccent();
    syncMotion();
    syncQuality();
    syncPaused();
    syncChain();
    syncGeo();

    const offs = [
      usePrefs.subscribe((s, p) => {
        if (s.accent !== p.accent) syncAccent();
        if (s.quality !== p.quality) syncQuality();
      }),
      useOverclock.subscribe(syncAccent),
      subscribeReducedMotion(syncMotion),
      useOverlays.subscribe(syncPaused),
      useDataStore.subscribe((s, p) => {
        if (s.chain !== p.chain) syncChain();
        if (s.geo !== p.geo) syncGeo();
      }),
      onBlock(() => bus.pulse('block')),
    ];
    // The visitor's choice can arrive late (a progress import changes unlocks).
    void getFlags();
    return () => {
      for (const off of offs) off();
    };
  }, []);
}
