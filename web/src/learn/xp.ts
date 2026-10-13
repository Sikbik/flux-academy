/**
 * XP rules (docs/CONTENT.md section 6). Pure.
 *
 *   Lesson      `minutes x 10`, shared equally by the lesson's non-read tasks. A task finished on its own
 *               earns its whole share, a task finished with "Show me" half of it, a skipped task (or one
 *               never reached) nothing. A lesson with no tasks earns its whole base on completion.
 *   Challenge   `xp` (default 10): full when solved unaided, half (rounded down) after "Show me", nothing
 *               when skipped.
 *
 * The learner store adds challenge XP the moment a challenge is solved (`awardChallenge`) and the lesson
 * XP once, when the lesson completes (`completeLesson`), and both are idempotent, so replaying a lesson
 * never farms XP.
 */

import type { Challenge, Lesson, Task } from './types';

export const DEFAULT_CHALLENGE_XP = 10;
export const XP_PER_MINUTE = 10;

export type Assist = 'shown' | 'skipped';

export function challengeBaseXp(c: Pick<Challenge, 'xp'>): number {
  return c.xp !== undefined && c.xp > 0 ? Math.round(c.xp) : DEFAULT_CHALLENGE_XP;
}

/** XP a challenge earns given how it ended. */
export function challengeXp(c: Pick<Challenge, 'xp'>, assist: Assist | null): number {
  const base = challengeBaseXp(c);
  if (assist === 'skipped') return 0;
  if (assist === 'shown') return Math.floor(base / 2);
  return base;
}

export function lessonBaseXp(minutes: number): number {
  return Math.max(0, Math.round(minutes)) * XP_PER_MINUTE;
}

/** Steps that carry a task the learner must do (the ones that share the lesson XP). */
export function gatedSteps(lesson: Pick<Lesson, 'steps'>): { id: string; task: Task }[] {
  const out: { id: string; task: Task }[] = [];
  for (const s of lesson.steps) {
    if (s.task && s.task.kind !== 'read') out.push({ id: s.id, task: s.task });
  }
  return out;
}

export type Outcome = 'done' | Assist;

export interface LessonXpInput {
  minutes: number;
  lesson: Pick<Lesson, 'steps'>;
  /** Gated step id to how it ended. Absent means never done, which earns nothing. */
  outcomes: Readonly<Record<string, Outcome | undefined>>;
}

export interface LessonXpBreakdown {
  /** `minutes x 10`. */
  base: number;
  /** What the learner earns: base minus the share lost to "Show me" and Skip. */
  earned: number;
  /** Tasks finished with "Show me". */
  shown: number;
  /** Tasks skipped or never reached. */
  skipped: number;
  /** Non-read tasks in the lesson. */
  tasks: number;
}

export function lessonXp(input: LessonXpInput): LessonXpBreakdown {
  const base = lessonBaseXp(input.minutes);
  const gated = gatedSteps(input.lesson);
  if (gated.length === 0) return { base, earned: base, shown: 0, skipped: 0, tasks: 0 };
  let full = 0;
  let shown = 0;
  let skipped = 0;
  for (const g of gated) {
    const o = input.outcomes[g.id];
    if (o === 'done') full += 1;
    else if (o === 'shown') shown += 1;
    else skipped += 1;
  }
  const earned = Math.round((base * (full + shown * 0.5)) / gated.length);
  return { base, earned, shown, skipped, tasks: gated.length };
}
