/**
 * Visitor preferences, persisted to localStorage (every access guarded). The only things the Academy
 * remembers about how you like the page: accent, sound, motion, quality, ambient and whether the intro
 * has played. Progress lives in the learner store (`@/learn/store`), not here.
 *
 *   const accent = usePrefs((s) => s.accent);
 *   usePrefs.getState().set({ sound: true });
 *   usePrefs.getState().setAccent('nimbus');   // false (and nothing changes) while it is locked
 *
 * Accent unlock rules (docs/DESIGN.md section 3.1): `flux` is always available; a tier accent unlocks
 * when the learner finishes that track. The rules gate CHOOSING an accent. They never trap anyone:
 * `effectiveAccent` falls back to `flux` when a stored accent is locked (a progress reset, a tampered
 * value), and `flux` can always be picked.
 */

import type { TrackId } from '@shared/curriculum';
import { create } from 'zustand';
import { trackCompletion, useLearner } from '@/learn/store';
import { readJson, writeJson } from '@/lib/storage';

export type AccentId = 'flux' | TrackId;
export type MotionPref = 'system' | 'reduced' | 'full';
export type QualityPref = 'auto' | 'low' | 'medium' | 'high';

export const ACCENTS: readonly AccentId[] = ['flux', 'cumulus', 'nimbus', 'stratus'];
export const MOTION_PREFS: readonly MotionPref[] = ['system', 'reduced', 'full'];
export const QUALITY_PREFS: readonly QualityPref[] = ['auto', 'low', 'medium', 'high'];

export interface Prefs {
  accent: AccentId;
  /** Sound effects. Off by default; never autoplays. */
  sound: boolean;
  /** `system` follows the OS; `reduced` and `full` override it. */
  motion: MotionPref;
  /** `auto` lets the governor decide; the others force a tier. */
  quality: QualityPref;
  /** Start ambient mode after 120 s without input. On by default. */
  ambient: boolean;
  /** The first-visit intro has played at least once on this device. */
  introSeen: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  accent: 'flux',
  sound: false,
  motion: 'system',
  quality: 'auto',
  ambient: true,
  introSeen: false,
};

export const PREFS_KEY = 'flux-academy:v2:prefs';

function oneOf<T extends string>(list: readonly T[], v: unknown, fallback: T): T {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Coerces anything (a parsed JSON blob, garbage, null) into a valid `Prefs`. */
export function sanitizePrefs(raw: unknown): Prefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_PREFS };
  const r = raw as Record<string, unknown>;
  return {
    accent: oneOf(ACCENTS, r.accent, DEFAULT_PREFS.accent),
    sound: typeof r.sound === 'boolean' ? r.sound : DEFAULT_PREFS.sound,
    motion: oneOf(MOTION_PREFS, r.motion, DEFAULT_PREFS.motion),
    quality: oneOf(QUALITY_PREFS, r.quality, DEFAULT_PREFS.quality),
    ambient: typeof r.ambient === 'boolean' ? r.ambient : DEFAULT_PREFS.ambient,
    introSeen: typeof r.introSeen === 'boolean' ? r.introSeen : DEFAULT_PREFS.introSeen,
  };
}

// ---------------------------------------------------------------------------
// Unlock rules (pure)
// ---------------------------------------------------------------------------

export type TrackCompletion = Record<TrackId, { complete: boolean }>;

/** The rule for an accent, as one sentence for the switcher's tooltip and the locked toast. */
export function unlockRule(accent: AccentId): string {
  switch (accent) {
    case 'cumulus':
      return 'Finish the Cumulus track to unlock this accent.';
    case 'nimbus':
      return 'Finish the Nimbus track to unlock this accent.';
    case 'stratus':
      return 'Finish the Stratus track to unlock this accent.';
    default:
      return 'Always available.';
  }
}

export function isAccentUnlocked(accent: AccentId, completion: TrackCompletion): boolean {
  if (accent === 'flux') return true;
  return completion[accent]?.complete === true;
}

/** The accent to actually apply: the stored one when unlocked, else `flux`. Never throws, never traps. */
export function effectiveAccent(stored: AccentId, completion: TrackCompletion): AccentId {
  return isAccentUnlocked(stored, completion) ? stored : 'flux';
}

/** The learner's track completion right now, for the unlock rules. */
export function currentCompletion(): TrackCompletion {
  return trackCompletion(useLearner.getState().lessons);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface PrefsActions {
  /** Merge a patch. Values are sanitised. An `accent` that is locked is ignored (use `setAccent`). */
  set: (patch: Partial<Prefs>) => void;
  /** Choose an accent. Returns false, changing nothing, when it is locked. */
  setAccent: (accent: AccentId) => boolean;
  reset: () => void;
}

export type PrefsState = Prefs & PrefsActions;

function pick(state: Prefs): Prefs {
  return {
    accent: state.accent,
    sound: state.sound,
    motion: state.motion,
    quality: state.quality,
    ambient: state.ambient,
    introSeen: state.introSeen,
  };
}

export const usePrefs = create<PrefsState>((set, get) => ({
  ...sanitizePrefs(typeof window === 'undefined' ? null : readJson(PREFS_KEY)),
  set: (patch) => {
    const next = sanitizePrefs({ ...pick(get()), ...patch });
    if (patch.accent !== undefined && !isAccentUnlocked(next.accent, currentCompletion())) {
      next.accent = get().accent;
    }
    set(next);
  },
  setAccent: (accent) => {
    if (!isAccentUnlocked(accent, currentCompletion())) return false;
    set({ accent });
    return true;
  },
  reset: () => set({ ...DEFAULT_PREFS }),
}));

if (typeof window !== 'undefined') {
  let queued = false;
  usePrefs.subscribe(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      writeJson(PREFS_KEY, pick(usePrefs.getState()));
    });
  });
  // Keep tabs in step.
  window.addEventListener('storage', (e) => {
    if (e.key !== PREFS_KEY || e.newValue == null) return;
    try {
      usePrefs.setState(sanitizePrefs(JSON.parse(e.newValue) as unknown));
    } catch {
      // A malformed write from elsewhere: ignore it.
    }
  });
}
