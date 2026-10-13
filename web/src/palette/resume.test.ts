import { describe, expect, it } from 'vitest';
import type { LessonProgress } from '@/learn/store';
import { pickResume } from './resume';

function p(startedAt: string, completedAt: string | null = null): LessonProgress {
  return { step: 0, stepsDone: [], challenges: {}, startedAt, completedAt };
}

describe('pickResume', () => {
  it('starts at the first lesson when nothing has been started', () => {
    expect(pickResume({})).toEqual({ id: 'what-is-flux', hasStarted: false });
  });

  it('prefers the lesson in progress that was started most recently', () => {
    const lessons = {
      'what-is-flux': p('2026-10-01T10:00:00Z', '2026-10-01T10:08:00Z'),
      'containers-101': p('2026-10-02T10:00:00Z'),
      'how-apps-run': p('2026-10-03T10:00:00Z'),
    };
    expect(pickResume(lessons)).toEqual({ id: 'how-apps-run', hasStarted: true });
  });

  it('moves to the next unfinished lesson when nothing is in progress', () => {
    const lessons = {
      'what-is-flux': p('2026-10-01T10:00:00Z', '2026-10-01T10:08:00Z'),
    };
    expect(pickResume(lessons)).toEqual({ id: 'how-apps-run', hasStarted: true });
  });

  it('ignores progress for lessons that no longer exist', () => {
    expect(pickResume({ 'gone-lesson': p('2026-10-01T10:00:00Z') })).toEqual({
      id: 'what-is-flux',
      hasStarted: false,
    });
  });
});
