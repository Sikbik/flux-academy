/**
 * Which lesson "Resume" goes to. Pure.
 *
 * The lesson in progress (started and not finished) that was started most recently, else the first
 * lesson in path order that is not finished, else nothing (everything is done).
 */

import { LESSONS } from '@shared/curriculum';
import type { LessonProgress } from '@/learn/store';

export interface ResumeTarget {
  /** The lesson to open, or null when every lesson is done. */
  id: string | null;
  /** The learner has started at least one lesson. */
  hasStarted: boolean;
}

export function pickResume(lessons: Record<string, LessonProgress>): ResumeTarget {
  const known = new Set(LESSONS.map((l) => l.id));
  const progress = Object.entries(lessons).filter(([id]) => known.has(id));
  const hasStarted = progress.length > 0;

  const inProgress = progress
    .filter(([, p]) => !p.completedAt)
    .sort(([, a], [, b]) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  const first = inProgress[0];
  if (first) return { id: first[0], hasStarted };

  const next = [...LESSONS].sort((a, b) => a.order - b.order).find((l) => !lessons[l.id]?.completedAt);
  return { id: next?.id ?? null, hasStarted };
}
