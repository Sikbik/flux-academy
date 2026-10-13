/**
 * The lesson loader: finds a lesson's content by glob, loads it lazily and says plainly when it cannot.
 *
 *   useLesson(id)         `{ status: 'loading' | 'ready' | 'missing' | 'error', ... }` for the player
 *   loadLesson(id)        the same as a promise (prefetch on hover, tests)
 *   lessonHasContent(id)  true when `content/lessons/<id>.ts` exists
 *
 * Content lives in `web/src/content/lessons/*.ts` (default export `Lesson`, file name = lesson id).
 * In development only, `learn/__fixtures__/*.ts` are also served, under ids that start `fixture-`, so
 * the player can be exercised without real content (for example `/learn/fixture-tour`).
 */

import { type LessonMeta, lessonById } from '@shared/curriculum';
import { useEffect, useState } from 'react';
import type { Lesson } from './types';

type LessonModule = { default: Lesson };
type FixtureModule = { lesson: Lesson; meta: LessonMeta };

// The glob calls are written without a type argument on purpose: Vitest's on-disk module cache skips any
// file that contains the text `import.meta.glob(`, and `import.meta.glob<T>(` would slip past that check and
// freeze the list of files at whatever it was when the transform was cached.
const contentLoaders = import.meta.glob('../content/lessons/*.ts') as Record<
  string,
  () => Promise<LessonModule>
>;
const fixtureLoaders: Record<string, () => Promise<FixtureModule>> = import.meta.env.DEV
  ? (import.meta.glob('./__fixtures__/*.ts') as Record<string, () => Promise<FixtureModule>>)
  : {};

function idFromPath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.ts$/, '');
}

const contentIds = new Set(Object.keys(contentLoaders).map(idFromPath));

/** Lesson ids that have a content file. */
export function contentLessonIds(): string[] {
  return [...contentIds];
}

export function lessonHasContent(id: string): boolean {
  return contentIds.has(id);
}

export type LessonLoad =
  | { status: 'loading' }
  | { status: 'ready'; lesson: Lesson; meta: LessonMeta; fixture: boolean }
  /** `unknown` is not a lesson at all; `coming-soon` is in the curriculum with no content yet. */
  | { status: 'missing'; reason: 'unknown' | 'coming-soon'; meta: LessonMeta | null }
  | { status: 'error'; message: string };

export type LessonResult = Exclude<LessonLoad, { status: 'loading' }>;

/** A structural check so a malformed file produces an `error` state instead of a crash in the player. */
export function lessonShapeProblem(l: unknown): string | null {
  if (typeof l !== 'object' || l === null) return 'The lesson file does not export a lesson.';
  const x = l as Record<string, unknown>;
  if (typeof x.id !== 'string') return 'The lesson has no id.';
  for (const key of ['steps', 'checkpoint', 'recap', 'objectives', 'further', 'terms'] as const) {
    if (!Array.isArray(x[key])) return `The lesson has no \`${key}\` list.`;
  }
  if (typeof x.hook !== 'string') return 'The lesson has no hook.';
  if ((x.steps as unknown[]).length === 0) return 'The lesson has no steps.';
  return null;
}

const results = new Map<string, LessonResult>();
const inflight = new Map<string, Promise<LessonResult>>();

async function fetchLesson(id: string): Promise<LessonResult> {
  try {
    if (id.startsWith('fixture-')) {
      // Development fixtures: `fixture-tour` is `__fixtures__/tour.ts`.
      const file = id.slice('fixture-'.length);
      const entry = Object.entries(fixtureLoaders).find(([path]) => idFromPath(path) === file);
      if (!entry) return { status: 'missing', reason: 'unknown', meta: null };
      const mod = await entry[1]();
      const problem = lessonShapeProblem(mod.lesson);
      if (problem) return { status: 'error', message: problem };
      return { status: 'ready', lesson: mod.lesson, meta: mod.meta, fixture: true };
    }
    const meta = lessonById(id) ?? null;
    const entry = Object.entries(contentLoaders).find(([path]) => idFromPath(path) === id);
    if (!entry) return { status: 'missing', reason: meta ? 'coming-soon' : 'unknown', meta };
    if (!meta) return { status: 'missing', reason: 'unknown', meta: null };
    const mod = await entry[1]();
    const lesson = mod.default;
    const problem = lessonShapeProblem(lesson);
    if (problem) return { status: 'error', message: problem };
    if (lesson.id !== id) {
      return {
        status: 'error',
        message: `The file for "${id}" defines a lesson with the id "${lesson.id}".`,
      };
    }
    return { status: 'ready', lesson, meta, fixture: false };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'The lesson could not be loaded.' };
  }
}

/** Load a lesson (cached). Never rejects. */
export function loadLesson(id: string): Promise<LessonResult> {
  const cached = results.get(id);
  if (cached) return Promise.resolve(cached);
  let p = inflight.get(id);
  if (!p) {
    p = fetchLesson(id).then((r) => {
      // Errors are not cached, so a fixed file loads on the next visit without a reload.
      if (r.status !== 'error') results.set(id, r);
      inflight.delete(id);
      return r;
    });
    inflight.set(id, p);
  }
  return p;
}

/** Warm the cache, for example when the pointer is over a lesson card. */
export function prefetchLesson(id: string): void {
  void loadLesson(id);
}

/** The lesson for an id, as a render state. Changes when `id` changes. */
export function useLesson(id: string): LessonLoad {
  const [state, setState] = useState<{ id: string; result: LessonResult | null }>(() => ({
    id,
    result: results.get(id) ?? null,
  }));

  useEffect(() => {
    let alive = true;
    const cached = results.get(id);
    if (cached) {
      setState({ id, result: cached });
      return;
    }
    setState({ id, result: null });
    void loadLesson(id).then((r) => {
      if (alive) setState({ id, result: r });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (state.id !== id || state.result === null) {
    const cached = results.get(id);
    return cached ?? { status: 'loading' };
  }
  return state.result;
}
