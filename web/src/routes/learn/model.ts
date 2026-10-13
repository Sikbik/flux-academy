/**
 * The course map's view model: the curriculum joined with what this learner has done. Pure, so the map,
 * the list and the page header all read one truth, and it is easy to test.
 */

import type { LessonMeta, TrackId } from '@shared/curriculum';
import type { LessonProgress } from '@/learn/store';

export type LessonStatus = 'untouched' | 'in-progress' | 'complete';

/** How big a lesson is, known only once its content has loaded. */
export interface StepInfo {
  steps: number;
  challenges: number;
  /** Step ids in order, so a saved step index can become a `?step=<id>` deep link. */
  stepIds: readonly string[];
}

export interface MapLesson {
  meta: LessonMeta;
  status: LessonStatus;
  /** 0 to 1 through the lesson. Exactly 1 only when complete. */
  fraction: number;
  /** True when `fraction` is a rough guess because the lesson's size is not known yet. */
  estimated: boolean;
  /** Segments done (steps plus challenges) and segments in all, when the size is known. */
  done: number;
  total: number | null;
  /** The 1-based step the learner is on, when known. */
  stepNumber: number | null;
  stepCount: number | null;
  startedAt: string | null;
  completedAt: string | null;
  /** The lesson the path recommends next. */
  recommended: boolean;
  /** False for a lesson in the curriculum whose content has not been written yet. */
  hasContent: boolean;
  /** Prerequisites that are not complete yet. Advice, never a lock. */
  pending: string[];
}

export interface CourseModel {
  lessons: MapLesson[];
  byId: ReadonlyMap<string, MapLesson>;
  completed: number;
  total: number;
  startedCount: number;
  recommendedId: string | null;
}

/** What the first estimate assumes when a lesson's size is unknown: about ten segments. */
const GUESS_SEGMENTS = 10;

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/**
 * How far through a lesson the learner is. The progress rail has one segment per step and one per
 * checkpoint challenge, so that is what is counted. A started lesson always shows a sliver and never
 * reads as finished until it is.
 */
export function progressOf(
  p: LessonProgress | undefined,
  info: StepInfo | undefined,
): { status: LessonStatus; fraction: number; estimated: boolean; done: number; total: number | null } {
  if (p?.completedAt) {
    const total = info ? info.steps + info.challenges : null;
    return { status: 'complete', fraction: 1, estimated: false, done: total ?? 0, total };
  }
  if (!p) return { status: 'untouched', fraction: 0, estimated: false, done: 0, total: null };

  const stepsDone = Math.max(p.step, p.stepsDone.length);
  const challengesDone = Object.keys(p.challenges).length;
  if (info && info.steps + info.challenges > 0) {
    const total = info.steps + info.challenges;
    const done = Math.min(info.steps, stepsDone) + Math.min(info.challenges, challengesDone);
    return {
      status: 'in-progress',
      fraction: clamp(done / total, 0.04, 0.96),
      estimated: false,
      done,
      total,
    };
  }
  const done = stepsDone + challengesDone;
  return {
    status: 'in-progress',
    fraction: clamp(done / GUESS_SEGMENTS, 0.06, 0.9),
    estimated: true,
    done,
    total: null,
  };
}

export interface ModelInput {
  lessons: readonly LessonMeta[];
  progress: Readonly<Record<string, LessonProgress>>;
  recommendedId: string | null;
  steps: Readonly<Record<string, StepInfo | undefined>>;
  /** Ids that have content files. Omit to treat every lesson as available. */
  contentIds?: ReadonlySet<string>;
}

export function buildCourseModel(input: ModelInput): CourseModel {
  const complete = new Set(input.lessons.filter((l) => input.progress[l.id]?.completedAt).map((l) => l.id));
  const lessons: MapLesson[] = [...input.lessons]
    .sort((a, b) => a.order - b.order)
    .map((meta) => {
      const p = input.progress[meta.id];
      const info = input.steps[meta.id];
      const prog = progressOf(p, info);
      const stepCount = info ? info.steps : null;
      return {
        meta,
        status: prog.status,
        fraction: prog.fraction,
        estimated: prog.estimated,
        done: prog.done,
        total: prog.total,
        stepNumber:
          prog.status === 'in-progress' && stepCount ? clamp((p?.step ?? 0) + 1, 1, stepCount) : null,
        stepCount,
        startedAt: p?.startedAt ?? null,
        completedAt: p?.completedAt ?? null,
        recommended: meta.id === input.recommendedId,
        hasContent: input.contentIds ? input.contentIds.has(meta.id) : true,
        pending: meta.prerequisites.filter((id) => !complete.has(id)),
      };
    });
  return {
    lessons,
    byId: new Map(lessons.map((l) => [l.meta.id, l])),
    completed: lessons.filter((l) => l.status === 'complete').length,
    total: lessons.length,
    startedCount: lessons.filter((l) => l.status !== 'untouched').length,
    recommendedId: input.recommendedId,
  };
}

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export interface ResumeTarget {
  lessonId: string;
  /** `continue`: a lesson in progress. `start`: the next one on the path. `review`: everything is done. */
  kind: 'continue' | 'start' | 'review';
  /** Saved step index, for the deep link. Null when starting. */
  stepIndex: number | null;
}

/**
 * Where the main button goes. The lesson in progress that was started most recently, else the lesson
 * the path recommends, else (the whole course is done) the first lesson to review.
 */
export function resumeTarget(
  model: CourseModel,
  progress: Readonly<Record<string, LessonProgress>>,
): ResumeTarget | null {
  const inProgress = model.lessons
    .filter((l) => l.status === 'in-progress')
    .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? '') || a.meta.order - b.meta.order);
  const current = inProgress[0];
  if (current) {
    return { lessonId: current.meta.id, kind: 'continue', stepIndex: progress[current.meta.id]?.step ?? 0 };
  }
  if (model.recommendedId) return { lessonId: model.recommendedId, kind: 'start', stepIndex: null };
  const first = model.lessons[0];
  return first ? { lessonId: first.meta.id, kind: 'review', stepIndex: null } : null;
}

/** The URL for a resume target. The step id comes from loaded content; without it the player resumes itself. */
export function resumeHref(target: ResumeTarget, info: StepInfo | undefined): string {
  const base = `/learn/${target.lessonId}`;
  if (target.kind !== 'continue' || target.stepIndex === null || !info) return base;
  const id = info.stepIds[Math.min(target.stepIndex, info.stepIds.length - 1)];
  return id ? `${base}?step=${encodeURIComponent(id)}` : base;
}

export interface ResumeCopy {
  /** The main button. */
  label: string;
  /** The line under it: which lesson and where. */
  caption: string;
  /** What a screen reader hears when the button is used. */
  announcement: string;
}

/** The words for the main button, from where the learner is. */
export function resumeCopy(
  model: CourseModel,
  target: ResumeTarget | null,
  info: StepInfo | undefined,
): ResumeCopy {
  if (!target) return { label: 'Open the first lesson', caption: '', announcement: '' };
  const lesson = model.byId.get(target.lessonId);
  const title = lesson?.meta.title ?? 'the lesson';
  if (target.kind === 'continue') {
    const at =
      target.stepIndex !== null && info && info.steps > 0
        ? `step ${Math.min(target.stepIndex + 1, info.steps)} of ${info.steps}`
        : null;
    return {
      label: 'Resume lesson',
      caption: at ? `${title}, ${at}` : title,
      announcement: at ? `Resuming ${title} at ${at}.` : `Resuming ${title}.`,
    };
  }
  if (target.kind === 'review') {
    return {
      label: 'Review from the start',
      caption: 'You have finished every lesson.',
      announcement: `Opening ${title}.`,
    };
  }
  const first = model.startedCount === 0;
  const minutes = lesson ? `, ${lesson.meta.minutes} min` : '';
  return {
    label: first ? 'Start the course' : 'Start the next lesson',
    caption: first ? `Lesson 1: ${title}${minutes}` : `${title}${minutes}`,
    announcement: `Starting ${title}.`,
  };
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "3 Oct 2026" from an ISO time, in the learner's own time zone. Empty for something unparseable. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** One phrase for a lesson's state, used by cards, labels and the list. */
export function statusPhrase(l: MapLesson): string {
  if (l.status === 'complete') {
    const when = shortDate(l.completedAt);
    return when ? `Done, ${when}` : 'Done';
  }
  if (l.status === 'in-progress') {
    if (l.stepNumber !== null && l.stepCount !== null)
      return `In progress, step ${l.stepNumber} of ${l.stepCount}`;
    return 'In progress';
  }
  return l.recommended ? 'Next on the path' : 'Not started';
}

export const KIND_LABEL: Record<LessonMeta['kind'], string> = {
  concept: 'Concept',
  'hands-on': 'Hands-on',
  project: 'Project',
};

/** Module groups of a track in path order: `[{ module: 'Deploy', lessons: [...] }, ...]`. */
export function modulesOfTrack<T extends { meta: LessonMeta }>(
  items: readonly T[],
  track: TrackId,
): { module: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => a.meta.order - b.meta.order)) {
    if (it.meta.track !== track) continue;
    const list = groups.get(it.meta.module);
    if (list) list.push(it);
    else groups.set(it.meta.module, [it]);
  }
  return [...groups.entries()].map(([module, list]) => ({ module, items: list }));
}
