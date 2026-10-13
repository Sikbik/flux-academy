import { useEffect, useRef, useState } from 'react';
import { loadLesson } from '@/learn/loader';
import type { StepInfo } from './model';

/**
 * How big each of these lessons is, loaded on demand. The course map only needs this for lessons the
 * learner has started (the ring through a lesson counts its steps and challenges), so the content of
 * lessons nobody has opened is never fetched here. Ids that have no content, or that fail, stay absent.
 */
export function useStepInfo(ids: readonly string[]): Record<string, StepInfo | undefined> {
  const [info, setInfo] = useState<Record<string, StepInfo | undefined>>({});
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  const key = ids.join('|');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the content of `ids`.
  useEffect(() => {
    for (const id of ids) {
      if (requested.current.has(id)) continue;
      requested.current.add(id);
      void loadLesson(id).then((r) => {
        if (!mounted.current || r.status !== 'ready') return;
        const next: StepInfo = {
          steps: r.lesson.steps.length,
          challenges: r.lesson.checkpoint.length,
          stepIds: r.lesson.steps.map((s) => s.id),
        };
        setInfo((prev) => ({ ...prev, [id]: next }));
      });
    }
  }, [key]);

  return info;
}
