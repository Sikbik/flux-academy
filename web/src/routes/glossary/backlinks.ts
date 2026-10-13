/**
 * "Taught in": which lessons a glossary term belongs to.
 *
 * Three sources, strongest first:
 *   introduced   the lesson lists the term in its own `terms` ("first introduced here")
 *   listed       the glossary entry names the lesson in its `lessons` ("where it matters most")
 *   mentioned    the lesson's text uses `{{term:id}}` somewhere
 *
 * `listed` needs no lesson content, so it is there on first paint. The other two need the lesson files,
 * which are code-split, so they are loaded when the browser is idle (and not at all when the visitor asked
 * for reduced data) and folded in when they arrive. The page works the same without them.
 */

import { LESSONS, lessonById } from '@shared/curriculum';
import { useEffect, useState } from 'react';
import { allTerms } from '@/learn/glossary';
import { loadLesson } from '@/learn/loader';
import type { Lesson } from '@/learn/types';
import { prefersSaveData } from '@/lib/platform';

export type RefKind = 'introduced' | 'listed' | 'mentioned';

export interface LessonRef {
  lessonId: string;
  kind: RefKind;
}

export type BacklinkIndex = ReadonlyMap<string, readonly LessonRef[]>;

/** A lesson reduced to what the index needs. */
export interface LessonTerms {
  id: string;
  introduced: readonly string[];
  mentioned: ReadonlySet<string>;
}

// `{{term:id}}`, with the display-case modifier the inline markup allows: `{{term:id|lower}}`, `{{term:id|Cap}}`.
const TERM_DIRECTIVE = /\{\{term:([a-z0-9-]+)(?:\|[A-Za-z]+)?\}\}/g;

/** Every `{{term:id}}` in any string anywhere in a lesson, and the terms the lesson says it introduces. */
export function termsOfLesson(lesson: Pick<Lesson, 'id' | 'terms'> & Record<string, unknown>): LessonTerms {
  const mentioned = new Set<string>();
  const text = JSON.stringify(lesson);
  for (const m of text.matchAll(TERM_DIRECTIVE)) {
    if (m[1]) mentioned.add(m[1]);
  }
  return { id: lesson.id, introduced: [...(lesson.terms ?? [])], mentioned };
}

const ORDER: Record<RefKind, number> = { introduced: 0, listed: 1, mentioned: 2 };

/** Curriculum order of a lesson id (unknown ids go last). */
function lessonOrder(id: string): number {
  const found = lessonById(id);
  return found ? found.order : Number.MAX_SAFE_INTEGER;
}

/**
 * Build the index from the glossary's own `lessons` fields and whatever lesson contents are loaded.
 * Pure: pass `loaded` as the lessons you have.
 */
export function computeBacklinks(
  terms: ReadonlyArray<{ id: string; lessons?: readonly string[] }>,
  loaded: readonly LessonTerms[],
  knownLessons: ReadonlySet<string> | null = null,
): BacklinkIndex {
  const out = new Map<string, Map<string, RefKind>>();
  const put = (termId: string, lessonId: string, kind: RefKind) => {
    if (knownLessons && !knownLessons.has(lessonId)) return;
    let inner = out.get(termId);
    if (!inner) {
      inner = new Map();
      out.set(termId, inner);
    }
    const have = inner.get(lessonId);
    if (have === undefined || ORDER[kind] < ORDER[have]) inner.set(lessonId, kind);
  };

  for (const t of terms) {
    for (const l of t.lessons ?? []) put(t.id, l, 'listed');
  }
  for (const lesson of loaded) {
    for (const id of lesson.introduced) put(id, lesson.id, 'introduced');
    for (const id of lesson.mentioned) put(id, lesson.id, 'mentioned');
  }

  const result = new Map<string, LessonRef[]>();
  for (const [termId, inner] of out) {
    const refs = [...inner].map(([lessonId, kind]) => ({ lessonId, kind }));
    refs.sort((a, b) => lessonOrder(a.lessonId) - lessonOrder(b.lessonId));
    result.set(termId, refs);
  }
  return result;
}

// ---------------------------------------------------------------------------
// The browser side
// ---------------------------------------------------------------------------

let computed: BacklinkIndex | null = null;
let pending: Promise<BacklinkIndex> | null = null;

const KNOWN = new Set(LESSONS.map((l) => l.id));

function staticIndex(): BacklinkIndex {
  return computeBacklinks(allTerms(), [], KNOWN);
}

/** Load every lesson that has content and build the full index. Cached for the life of the page. */
export function loadBacklinks(): Promise<BacklinkIndex> {
  if (computed) return Promise.resolve(computed);
  if (pending) return pending;
  pending = (async () => {
    const loaded: LessonTerms[] = [];
    // A few at a time: the lessons are separate chunks, and nothing here is urgent.
    const queue = LESSONS.map((l) => l.id);
    const worker = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        const r = await loadLesson(id);
        if (r.status === 'ready') loaded.push(termsOfLesson(r.lesson as never));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    computed = computeBacklinks(allTerms(), loaded, KNOWN);
    return computed;
  })().catch(() => {
    pending = null;
    return staticIndex();
  });
  return pending;
}

function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const t = window.setTimeout(run, 400);
  return () => window.clearTimeout(t);
}

export interface Backlinks {
  index: BacklinkIndex;
  /** True while the lesson files are still being read for `mentioned` and `introduced`. */
  loading: boolean;
  /** False when the visitor asked for reduced data, so only the glossary's own lists are used. */
  complete: boolean;
}

export function useBacklinks(): Backlinks {
  const [state, setState] = useState<Backlinks>(() => {
    if (computed) return { index: computed, loading: false, complete: true };
    return { index: staticIndex(), loading: !prefersSaveData(), complete: false };
  });

  useEffect(() => {
    if (state.complete || prefersSaveData()) {
      if (state.loading) setState((s) => ({ ...s, loading: false }));
      return;
    }
    let alive = true;
    const cancel = whenIdle(() => {
      void loadBacklinks().then((index) => {
        if (alive) setState({ index, loading: false, complete: true });
      });
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [state.complete, state.loading]);

  return state;
}
