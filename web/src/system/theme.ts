/**
 * Mirrors the visitor's look preferences onto the document, so CSS, the design system's hooks and the
 * scenes all read one truth:
 *
 *   html[data-accent="flux|cumulus|nimbus|stratus"]   the accent (the unlock rules apply)
 *   html[data-motion="reduced|full"]                  the effective motion setting
 *   html[data-glass="lite|full"]                      lite swaps backdrop blur for a flat fill, for Save-Data,
 *                                                     a low quality choice or a scene that dropped to tier 1
 *
 * It also owns the Konami easter egg's effect, "overclock": the accent goes stratus gold for 20 s
 * regardless of unlock state, then reverts. Nothing here ever locks the visitor into an accent.
 */

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { useLearner } from '@/learn/store';
import { getFlags } from '@/lib/flags';
import { prefersSaveData } from '@/lib/platform';
import { useSceneBus } from '@/scenes/bus';
import { effectiveReducedMotion, subscribeReducedMotion } from './motion';
import { ACCENTS, type AccentId, currentCompletion, effectiveAccent, usePrefs } from './prefs';

export const OVERCLOCK_MS = 20_000;

interface OverclockState {
  until: number | null;
  start: (ms?: number) => void;
  stop: () => void;
}

let overclockTimer: ReturnType<typeof setTimeout> | null = null;

export const useOverclock = create<OverclockState>((set) => ({
  until: null,
  start: (ms = OVERCLOCK_MS) => {
    if (overclockTimer) clearTimeout(overclockTimer);
    set({ until: Date.now() + ms });
    overclockTimer = setTimeout(() => {
      overclockTimer = null;
      set({ until: null });
    }, ms);
  },
  stop: () => {
    if (overclockTimer) clearTimeout(overclockTimer);
    overclockTimer = null;
    set({ until: null });
  },
}));

/** The accent on the page right now: overclock, then the dev override, then the preference. */
export function resolveAccent(): AccentId {
  if (useOverclock.getState().until !== null) return 'stratus';
  const dev = getFlags().accent;
  if (dev && (ACCENTS as readonly string[]).includes(dev)) return dev as AccentId;
  return effectiveAccent(usePrefs.getState().accent, currentCompletion());
}

/** True when glass should drop its backdrop blur. Pure given the inputs, so it is easy to test. */
export function wantsLiteGlass(input: {
  saveData: boolean;
  qualityPref: string;
  qualityFlag: string | null;
  sceneReady: boolean;
  sceneTier: number;
}): boolean {
  if (input.saveData) return true;
  if (input.qualityPref === 'low') return true;
  if (input.qualityFlag === 'low' || input.qualityFlag === 'none') return true;
  return input.sceneReady && input.sceneTier <= 1;
}

function currentGlassLite(): boolean {
  const scene = useSceneBus.getState().scene;
  return wantsLiteGlass({
    saveData: prefersSaveData(),
    qualityPref: usePrefs.getState().quality,
    qualityFlag: getFlags().q,
    sceneReady: scene.ready,
    sceneTier: scene.tier,
  });
}

function subscribeAccent(listener: () => void): () => void {
  const offPrefs = usePrefs.subscribe((s, p) => {
    if (s.accent !== p.accent) listener();
  });
  const offLearner = useLearner.subscribe((s, p) => {
    if (s.lessons !== p.lessons) listener();
  });
  const offOverclock = useOverclock.subscribe((s, p) => {
    if ((s.until === null) !== (p.until === null)) listener();
  });
  return () => {
    offPrefs();
    offLearner();
    offOverclock();
  };
}

/** The effective accent, reactive. */
export function useEffectiveAccent(): AccentId {
  return useSyncExternalStore(subscribeAccent, resolveAccent, () => 'flux');
}

/** True while overclock is running. */
export function useOverclockActive(): boolean {
  return useOverclock((s) => s.until !== null);
}

let started = 0;
let stop: (() => void) | null = null;

/** Start mirroring. Refcounted and idempotent; returns a stop function. */
export function startThemeSync(): () => void {
  started += 1;
  if (started === 1 && typeof document !== 'undefined') {
    const root = document.documentElement;
    const apply = () => {
      root.dataset.accent = resolveAccent();
      root.dataset.motion = effectiveReducedMotion() ? 'reduced' : 'full';
      root.dataset.glass = currentGlassLite() ? 'lite' : 'full';
    };
    apply();
    const offAccent = subscribeAccent(apply);
    const offMotion = subscribeReducedMotion(apply);
    const offQuality = usePrefs.subscribe((s, p) => {
      if (s.quality !== p.quality) apply();
    });
    const offScene = useSceneBus.subscribe((s, p) => {
      if (s.scene.tier !== p.scene.tier || s.scene.ready !== p.scene.ready) apply();
    });
    stop = () => {
      offAccent();
      offMotion();
      offQuality();
      offScene();
    };
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    started -= 1;
    if (started === 0) {
      stop?.();
      stop = null;
    }
  };
}
