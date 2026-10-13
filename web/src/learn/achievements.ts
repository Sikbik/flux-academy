/**
 * Achievements: the twelve medals of docs/CONTENT.md section 6, and the runtime that grants them.
 *
 *   unlock(id)           idempotent; records it in the learner store and shows a toast the first time
 *   useAchievements()    the list with unlock state, for the profile page and the medal grid
 *   ACHIEVEMENTS         id, title, the rule (shown even while locked), tier tint, medal art id
 *
 * Who calls `unlock`
 *   engine (this module's callers in `learn/`)  first-light, cumulus-operator, nimbus-engineer,
 *                                               stratus-architect, shell-shocked (a terminal challenge),
 *                                               three-is-company, first-blood, spec-whisperer, penny-pincher
 *   stages and labs via `host.unlock(id)`        everything else, from the place it happens
 *
 * Medal art is `web/public/art/medal-<id>.webp`; `medal` below is the art id (`medal-<id>`).
 */

import { TRACKS, type TrackId } from '@shared/curriculum';
import { useMemo } from 'react';
import { ACHIEVEMENT_IDS, type AchievementId } from '@/content/catalog';
import { toast } from '@/system/toasts';
import { type LessonProgress, trackCompletion, useLearner } from './store';

export interface AchievementDef {
  id: AchievementId;
  title: string;
  /** What earns it, one line, shown while locked. */
  rule: string;
  /** The medal's tint. Tier colour means tier: this is the track where it is usually earned. */
  tier: TrackId;
  /** Art id: `medal-<id>`. */
  medal: string;
}

const defs: Omit<AchievementDef, 'medal'>[] = [
  { id: 'first-light', title: 'First light', rule: 'Open your first lesson.', tier: 'cumulus' },
  {
    id: 'three-is-company',
    title: 'Three is company',
    rule: 'Set instances to 3 or more in any scene or in the forge.',
    tier: 'nimbus',
  },
  { id: 'first-blood', title: 'First blood', rule: 'Kill a node in a failover scene.', tier: 'stratus' },
  {
    id: 'spec-whisperer',
    title: 'Spec whisperer',
    rule: 'Take a spec from 3 or more lint errors to none.',
    tier: 'nimbus',
  },
  {
    id: 'penny-pincher',
    title: 'Penny pincher',
    rule: 'Build a valid 3-instance spec with at least 1 core and 2 GB of RAM for under $3 a month.',
    tier: 'nimbus',
  },
  {
    id: 'block-watcher',
    title: 'Block watcher',
    rule: 'Be on the site for three real blocks in a row.',
    tier: 'cumulus',
  },
  {
    id: 'globetrotter',
    title: 'Globetrotter',
    rule: 'Hover 15 different countries in the Network Lab.',
    tier: 'stratus',
  },
  { id: 'shell-shocked', title: 'Shell shocked', rule: 'Finish a terminal scenario.', tier: 'cumulus' },
  { id: 'explorer', title: 'Explorer', rule: 'Look up a real app in the App Explorer.', tier: 'stratus' },
  {
    id: 'cumulus-operator',
    title: 'Cumulus Operator',
    rule: 'Finish the Cumulus track.',
    tier: 'cumulus',
  },
  {
    id: 'nimbus-engineer',
    title: 'Nimbus Engineer',
    rule: 'Finish the Nimbus track.',
    tier: 'nimbus',
  },
  {
    id: 'stratus-architect',
    title: 'Stratus Architect',
    rule: 'Finish the Stratus track.',
    tier: 'stratus',
  },
];

export const ACHIEVEMENTS: readonly AchievementDef[] = defs.map((d) => ({ ...d, medal: `medal-${d.id}` }));

const byId = new Map<string, AchievementDef>(ACHIEVEMENTS.map((a) => [a.id, a]));

export function achievementById(id: string): AchievementDef | undefined {
  return byId.get(id);
}

export function isAchievementId(id: string): id is AchievementId {
  return (ACHIEVEMENT_IDS as readonly string[]).includes(id);
}

/** The URL of a medal's art. */
export function medalSrc(id: string): string {
  return `/art/medal-${id}.webp`;
}

/** The achievement earned by finishing a track. */
export function trackAchievementId(track: TrackId): AchievementId {
  return track === 'cumulus'
    ? 'cumulus-operator'
    : track === 'nimbus'
      ? 'nimbus-engineer'
      : 'stratus-architect';
}

// ---------------------------------------------------------------------------
// Unlocking
// ---------------------------------------------------------------------------

type Notifier = (message: string) => void;

let notifier: Notifier = (message) => {
  toast.success(message, { key: 'achievement' });
};

/** Replace how an unlock is announced (tests, or a richer medal toast later). Returns the previous one. */
export function setAchievementNotifier(next: Notifier): Notifier {
  const previous = notifier;
  notifier = next;
  return previous;
}

/**
 * Grant an achievement. Idempotent: returns true only the first time. Unknown ids are ignored, so a
 * stage cannot invent a medal.
 */
export function unlock(id: string): boolean {
  if (!isAchievementId(id)) return false;
  const newly = useLearner.getState().unlock(id);
  if (!newly) return false;
  const def = byId.get(id);
  const have = Object.keys(useLearner.getState().achievements).length;
  notifier(`Achievement unlocked: ${def?.title ?? id} (${have} of ${ACHIEVEMENTS.length})`);
  return true;
}

export function isUnlocked(id: string): boolean {
  return Boolean(useLearner.getState().achievements[id]);
}

/** Unlock the track medals whose tracks are complete. Returns the ones newly granted. */
export function syncTrackAchievements(lessons: Record<string, LessonProgress>): AchievementId[] {
  const done = trackCompletion(lessons);
  const granted: AchievementId[] = [];
  for (const t of TRACKS) {
    if (done[t.id].complete) {
      const id = trackAchievementId(t.id);
      if (unlock(id)) granted.push(id);
    }
  }
  return granted;
}

// ---------------------------------------------------------------------------
// Detection the engine can do itself (pure)
// ---------------------------------------------------------------------------

/** What the engine tracks across the spec events of one editing session. */
export interface SpecWatch {
  /** The most lint errors seen. */
  maxErrors: number;
}

export interface SpecFactsLite {
  errors: number;
  valid: boolean;
  instances: number;
  cpu: number;
  ramMb: number;
  usdPerMonth: number | null;
}

export const FRESH_WATCH: SpecWatch = { maxErrors: 0 };

/** Which spec-based medals a spec grants, and the updated watch. */
export function detectSpecAchievements(
  facts: SpecFactsLite,
  watch: SpecWatch,
): { grant: AchievementId[]; watch: SpecWatch } {
  const grant: AchievementId[] = [];
  const next: SpecWatch = { maxErrors: Math.max(watch.maxErrors, facts.errors) };
  if (facts.errors === 0 && watch.maxErrors >= 3) grant.push('spec-whisperer');
  if (
    facts.valid &&
    facts.instances >= 3 &&
    facts.cpu >= 1 &&
    facts.ramMb >= 2000 &&
    facts.usdPerMonth !== null &&
    facts.usdPerMonth < 3
  ) {
    grant.push('penny-pincher');
  }
  return { grant, watch: next };
}

// ---------------------------------------------------------------------------
// For the profile page
// ---------------------------------------------------------------------------

export interface AchievementState extends AchievementDef {
  /** ISO time it was earned, or null while locked. */
  unlockedAt: string | null;
}

export function useAchievements(): {
  list: AchievementState[];
  unlocked: number;
  total: number;
} {
  const earned = useLearner((s) => s.achievements);
  return useMemo(() => {
    const list = ACHIEVEMENTS.map((a) => ({ ...a, unlockedAt: earned[a.id] ?? null }));
    return { list, unlocked: list.filter((a) => a.unlockedAt).length, total: list.length };
  }, [earned]);
}
