import { useCallback, useEffect, useState } from 'react';
import { getFlags } from '@/lib/flags';
import { readItem, writeItem } from '@/lib/storage';
import { effectiveReducedMotion } from '@/system/motion';
import { usePrefs } from '@/system/prefs';
import { shouldPlayIntro } from './logic';

/** sessionStorage key: the epoch ms at which the intro last started in this browser session. */
export const INTRO_KEY = 'flux-academy:v2:intro';

/** The beats of the intro, in ms from its start (docs/DESIGN.md section 5.2, 1.6 s in all). */
export const INTRO_TIMING = {
  /** The white flash peaks and the page underneath starts to resolve. */
  reveal: 1120,
  /** The overlay is gone. */
  end: 1640,
  /** A skip fades out this fast. */
  skip: 220,
} as const;

/**
 * Decides, once per mount, whether the intro plays. A repeat visit in the same session, reduced motion
 * and `?intro=0` never play it. It claims the visit by writing the session key, so a reload inside the
 * same few seconds (a hot reload, a re-render) does not count as a second visit.
 */
function claim(): boolean {
  const seen = readItem(INTRO_KEY, 'session');
  const play = shouldPlayIntro({
    reducedMotion: effectiveReducedMotion(),
    flag: getFlags().intro,
    seenAt: seen === null ? null : Number(seen),
    now: Date.now(),
  });
  if (play && (seen === null || !Number.isFinite(Number(seen))))
    writeItem(INTRO_KEY, String(Date.now()), 'session');
  return play;
}

export type IntroPhase = 'off' | 'playing' | 'leaving' | 'done';

export interface IntroState {
  phase: IntroPhase;
  /** The page underneath may resolve: true from the flash on, and always when there is no intro. */
  revealed: boolean;
  skip: () => void;
}

/**
 * The intro's state machine. It never blocks: the page is in the DOM from the first frame and the overlay
 * ignores the pointer. Any key, click, tap, wheel or scroll skips it.
 */
export function useIntro(): IntroState {
  const [phase, setPhase] = useState<IntroPhase>(() => (claim() ? 'playing' : 'off'));
  const [revealed, setRevealed] = useState(phase === 'off');

  const skip = useCallback(() => {
    setRevealed(true);
    setPhase((p) => (p === 'playing' ? 'leaving' : p));
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const a = window.setTimeout(() => setRevealed(true), INTRO_TIMING.reveal);
    const b = window.setTimeout(() => setPhase('done'), INTRO_TIMING.end);
    const onAny = () => skip();
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('keydown', onAny, opts);
    window.addEventListener('pointerdown', onAny, opts);
    window.addEventListener('wheel', onAny, opts);
    window.addEventListener('touchstart', onAny, opts);
    window.addEventListener('scroll', onAny, opts);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
      window.removeEventListener('keydown', onAny, opts);
      window.removeEventListener('pointerdown', onAny, opts);
      window.removeEventListener('wheel', onAny, opts);
      window.removeEventListener('touchstart', onAny, opts);
      window.removeEventListener('scroll', onAny, opts);
    };
  }, [phase, skip]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const t = window.setTimeout(() => setPhase('done'), INTRO_TIMING.skip);
    return () => window.clearTimeout(t);
  }, [phase]);

  // The preference records that the intro has played on this device at least once.
  useEffect(() => {
    if (phase === 'done' && !usePrefs.getState().introSeen) usePrefs.getState().set({ introSeen: true });
  }, [phase]);

  return { phase, revealed, skip };
}
