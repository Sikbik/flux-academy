/**
 * Keeps `?step=<id>` and the player's position in step.
 *
 *   player -> URL   every position change rewrites the param (a `replace`, so stepping through a lesson
 *                   does not fill the history; the lesson stays one entry)
 *   URL -> player   a change made from outside (a pasted link, an in-page link) moves the player
 *
 * Writes the hook makes itself are remembered, so they are never read back as outside changes.
 */

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { idAtPosition, type PlayerStore, positionForId } from '@/learn/player';
import type { Lesson } from '@/learn/types';

export function useLessonSearch(lesson: Lesson, store: PlayerStore, position: number): void {
  const [params, setParams] = useSearchParams();
  const param = params.get('step');
  const written = useRef<string | null>(param);

  // player -> URL
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a position change writes the URL.
  useEffect(() => {
    const id = idAtPosition(lesson, position);
    // The first step is the default: leave the URL clean for it.
    const want = position === 0 ? null : id;
    if (want === written.current) return;
    written.current = want;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (want) next.set('step', want);
        else next.delete('step');
        return next;
      },
      { replace: true },
    );
  }, [lesson, position]);

  // URL -> player
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the param is an outside change.
  useEffect(() => {
    if (param === written.current) return;
    written.current = param;
    const to = param === null ? 0 : positionForId(lesson, param);
    if (to !== null && to !== store.getState().position) store.getState().go(to);
  }, [param]);
}
