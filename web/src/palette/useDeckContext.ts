import { useMemo } from 'react';
import { allTerms } from '@/learn/glossary';
import { trackCompletion, useLearner } from '@/learn/store';
import { useReducedMotionPref } from '@/system/motion';
import { ACCENTS, type AccentId, isAccentUnlocked, usePrefs } from '@/system/prefs';
import type { DeckContext } from './items';
import { pickResume } from './resume';

/** Everything the catalog depends on, from the stores. Changes only when one of those does. */
export function useDeckContext(): DeckContext {
  const lessons = useLearner((s) => s.lessons);
  const accent = usePrefs((s) => s.accent);
  const sound = usePrefs((s) => s.sound);
  const autoAmbient = usePrefs((s) => s.ambient);
  const reducedMotion = useReducedMotionPref();

  return useMemo(() => {
    const completion = trackCompletion(lessons);
    const unlocked = Object.fromEntries(
      ACCENTS.map((id) => [id, isAccentUnlocked(id, completion)]),
    ) as Record<AccentId, boolean>;
    const resume = pickResume(lessons);
    const completed = new Set<string>();
    const started = new Set<string>();
    for (const [id, p] of Object.entries(lessons)) {
      started.add(id);
      if (p.completedAt) completed.add(id);
    }
    return {
      completed,
      started,
      resumeLesson: resume.id,
      hasStarted: resume.hasStarted,
      actions: { accent, sound, autoAmbient, reducedMotion, unlocked },
      terms: allTerms(),
    } satisfies DeckContext;
  }, [lessons, accent, sound, autoAmbient, reducedMotion]);
}
