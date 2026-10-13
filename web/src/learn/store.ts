/**
 * The learner store: progress, XP, rank and achievements. Local only (localStorage), versioned, and
 * written defensively: storage can be missing, full or throw, and the app must still run.
 *
 * Owner: the lesson-engine agent extends this file (selectors, achievements wiring, tests). The shape
 * of `LearnerState` is a contract with the header rank chip, the course map and the profile page, so
 * keep changes additive.
 */

import { LESSONS, TRACKS, type TrackId } from '@shared/curriculum';
import { create } from 'zustand';

const STORAGE_KEY = 'flux-academy:v2:learner';
const SCHEMA = 2;

export interface LessonProgress {
  /** Index of the step the learner is on (resume point). */
  step: number;
  /** Step ids completed (task done or read). */
  stepsDone: string[];
  /** Challenge id to the XP awarded for it (0 when skipped). */
  challenges: Record<string, number>;
  startedAt: string;
  completedAt: string | null;
  /**
   * Steps finished with "Show me" or skipped, by step id (additive, optional: older saves have none). They
   * cost their share of the lesson XP and are remembered so a reload cannot launder them.
   */
  assists?: Record<string, 'shown' | 'skipped'>;
}

export interface LearnerState {
  schema: number;
  lessons: Record<string, LessonProgress>;
  xp: number;
  achievements: Record<string, string>;
  /** ISO dates (YYYY-MM-DD, local) on which the learner did something. Capped at 400. */
  activeDays: string[];
  /** Display name for the certificate. Stays on this device. */
  name: string;
}

export interface LearnerActions {
  startLesson(id: string): void;
  setStep(id: string, step: number): void;
  completeStep(id: string, stepId: string): void;
  /** Record that a step was finished with "Show me" or skipped (additive). */
  markAssist(id: string, stepId: string, how: 'shown' | 'skipped'): void;
  awardChallenge(lessonId: string, challengeId: string, xp: number): void;
  /**
   * Mark a lesson complete and add its XP. `baseXp` overrides the curriculum default of `minutes x 10`
   * (the lesson player passes what the learner actually earned, after "Show me" and Skip).
   */
  completeLesson(id: string, bonusXp?: number, baseXp?: number): void;
  unlock(achievementId: string): boolean;
  setName(name: string): void;
  /** Replace everything from an exported blob. Returns false when the blob is not valid. */
  importState(raw: unknown): boolean;
  reset(): void;
}

function emptyState(): LearnerState {
  return { schema: SCHEMA, lessons: {}, xp: 0, achievements: {}, activeDays: [], name: '' };
}

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Validate and coerce an unknown blob into a LearnerState, or null. Never throws. */
export function parseLearnerState(raw: unknown): LearnerState | null {
  if (!isRecord(raw) || raw.schema !== SCHEMA) return null;
  const out = emptyState();
  if (typeof raw.xp === 'number' && Number.isFinite(raw.xp) && raw.xp >= 0) out.xp = Math.floor(raw.xp);
  if (typeof raw.name === 'string') out.name = raw.name.slice(0, 60);
  if (Array.isArray(raw.activeDays)) {
    out.activeDays = raw.activeDays.filter((d): d is string => typeof d === 'string').slice(-400);
  }
  if (isRecord(raw.achievements)) {
    for (const [k, v] of Object.entries(raw.achievements)) {
      if (typeof v === 'string') out.achievements[k] = v;
    }
  }
  if (isRecord(raw.lessons)) {
    for (const [id, v] of Object.entries(raw.lessons)) {
      if (!isRecord(v)) continue;
      const challenges: Record<string, number> = {};
      if (isRecord(v.challenges)) {
        for (const [cid, xp] of Object.entries(v.challenges)) {
          if (typeof xp === 'number' && Number.isFinite(xp)) challenges[cid] = xp;
        }
      }
      const assists: Record<string, 'shown' | 'skipped'> = {};
      if (isRecord(v.assists)) {
        for (const [sid, how] of Object.entries(v.assists)) {
          if (how === 'shown' || how === 'skipped') assists[sid] = how;
        }
      }
      out.lessons[id] = {
        step: typeof v.step === 'number' && v.step >= 0 ? Math.floor(v.step) : 0,
        stepsDone: Array.isArray(v.stepsDone)
          ? v.stepsDone.filter((s): s is string => typeof s === 'string')
          : [],
        challenges,
        startedAt: typeof v.startedAt === 'string' ? v.startedAt : new Date(0).toISOString(),
        completedAt: typeof v.completedAt === 'string' ? v.completedAt : null,
        ...(Object.keys(assists).length > 0 ? { assists } : {}),
      };
    }
  }
  return out;
}

/**
 * The browser's localStorage, or null where there is none. Going through `window` (never the bare global)
 * keeps Node's own experimental `localStorage` out of server-side tests, and a blocked store (private
 * mode, disabled site data) throws on access, so the lookup is guarded too.
 */
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function load(): LearnerState {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return parseLearnerState(JSON.parse(raw)) ?? emptyState();
  } catch {
    return emptyState();
  }
}

function persist(state: LearnerState): void {
  try {
    const { schema, lessons, xp, achievements, activeDays, name } = state;
    storage()?.setItem(STORAGE_KEY, JSON.stringify({ schema, lessons, xp, achievements, activeDays, name }));
  } catch {
    // Private mode or full storage: progress lives for this session only.
  }
}

function touchDay(s: LearnerState): string[] {
  const t = today();
  return s.activeDays.includes(t) ? s.activeDays : [...s.activeDays, t].slice(-400);
}

export const useLearner = create<LearnerState & LearnerActions>((set, get) => {
  const snapshot = (): LearnerState => {
    const s = get();
    return {
      schema: s.schema,
      lessons: s.lessons,
      xp: s.xp,
      achievements: s.achievements,
      activeDays: s.activeDays,
      name: s.name,
    };
  };
  const commit = (patch: Partial<LearnerState>) => {
    set(patch);
    persist(snapshot());
  };
  const lessonOf = (id: string): LessonProgress =>
    get().lessons[id] ?? {
      step: 0,
      stepsDone: [],
      challenges: {},
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

  return {
    ...load(),
    startLesson(id) {
      const s = get();
      if (s.lessons[id]) return;
      commit({ lessons: { ...s.lessons, [id]: lessonOf(id) }, activeDays: touchDay(s) });
    },
    setStep(id, step) {
      const s = get();
      commit({ lessons: { ...s.lessons, [id]: { ...lessonOf(id), step } }, activeDays: touchDay(s) });
    },
    completeStep(id, stepId) {
      const s = get();
      const lp = lessonOf(id);
      if (lp.stepsDone.includes(stepId)) return;
      commit({
        lessons: { ...s.lessons, [id]: { ...lp, stepsDone: [...lp.stepsDone, stepId] } },
        activeDays: touchDay(s),
      });
    },
    markAssist(id, stepId, how) {
      const s = get();
      const lp = lessonOf(id);
      if (lp.assists?.[stepId] === how) return;
      commit({
        lessons: { ...s.lessons, [id]: { ...lp, assists: { ...(lp.assists ?? {}), [stepId]: how } } },
        activeDays: touchDay(s),
      });
    },
    awardChallenge(lessonId, challengeId, xp) {
      const s = get();
      const lp = lessonOf(lessonId);
      if (challengeId in lp.challenges) return;
      commit({
        lessons: { ...s.lessons, [lessonId]: { ...lp, challenges: { ...lp.challenges, [challengeId]: xp } } },
        xp: s.xp + xp,
        activeDays: touchDay(s),
      });
    },
    completeLesson(id, bonusXp = 0, baseXp) {
      const s = get();
      const lp = lessonOf(id);
      if (lp.completedAt) return;
      const meta = LESSONS.find((l) => l.id === id);
      const base = baseXp ?? (meta ? meta.minutes * 10 : 0);
      commit({
        lessons: { ...s.lessons, [id]: { ...lp, completedAt: new Date().toISOString() } },
        xp: s.xp + base + bonusXp,
        activeDays: touchDay(s),
      });
    },
    unlock(achievementId) {
      const s = get();
      if (s.achievements[achievementId]) return false;
      commit({ achievements: { ...s.achievements, [achievementId]: new Date().toISOString() } });
      return true;
    },
    setName(name) {
      commit({ name: name.slice(0, 60) });
    },
    importState(raw) {
      const parsed = parseLearnerState(raw);
      if (!parsed) return false;
      commit(parsed);
      return true;
    },
    reset() {
      commit(emptyState());
    },
  };
});

// ---------------------------------------------------------------------------
// Derived values (pure, exported for tests and for the header chip)
// ---------------------------------------------------------------------------

export type RankId = 'initiate' | TrackId | 'architect';

export interface Rank {
  id: 'initiate' | 'cumulus' | 'nimbus' | 'stratus';
  name: string;
  /** Tracks finished to hold this rank. */
  tracksDone: number;
}

/** The rank held after finishing `n` tracks in order (Cumulus, then Nimbus, then Stratus). */
export function rankForTracks(done: Record<TrackId, boolean>): Rank {
  if (done.stratus && done.nimbus && done.cumulus)
    return { id: 'stratus', name: 'Stratus Architect', tracksDone: 3 };
  if (done.nimbus && done.cumulus) return { id: 'nimbus', name: 'Nimbus Engineer', tracksDone: 2 };
  if (done.cumulus) return { id: 'cumulus', name: 'Cumulus Operator', tracksDone: 1 };
  return { id: 'initiate', name: 'Initiate', tracksDone: 0 };
}

export function trackCompletion(
  lessons: Record<string, LessonProgress>,
): Record<TrackId, { done: number; total: number; complete: boolean }> {
  const out = {} as Record<TrackId, { done: number; total: number; complete: boolean }>;
  for (const t of TRACKS) {
    const ls = LESSONS.filter((l) => l.track === t.id);
    const done = ls.filter((l) => lessons[l.id]?.completedAt).length;
    out[t.id] = { done, total: ls.length, complete: ls.length > 0 && done === ls.length };
  }
  return out;
}

export function currentRank(lessons: Record<string, LessonProgress>): Rank {
  const tc = trackCompletion(lessons);
  return rankForTracks({
    cumulus: tc.cumulus.complete,
    nimbus: tc.nimbus.complete,
    stratus: tc.stratus.complete,
  });
}

/** The lesson to recommend next: the first incomplete lesson in path order. */
export function recommendedLesson(lessons: Record<string, LessonProgress>): string | null {
  const sorted = [...LESSONS].sort((a, b) => a.order - b.order);
  return sorted.find((l) => !lessons[l.id]?.completedAt)?.id ?? null;
}
