import { LESSONS } from '@shared/curriculum';
import { describe, expect, it } from 'vitest';
import type { LessonProgress } from '@/learn/store';
import {
  buildCourseModel,
  modulesOfTrack,
  progressOf,
  resumeCopy,
  resumeHref,
  resumeTarget,
  type StepInfo,
  shortDate,
  statusPhrase,
} from './model';

function progress(over: Partial<LessonProgress> = {}): LessonProgress {
  return {
    step: 0,
    stepsDone: [],
    challenges: {},
    startedAt: '2026-10-01T09:00:00.000Z',
    completedAt: null,
    ...over,
  };
}

const INFO: StepInfo = { steps: 6, challenges: 2, stepIds: ['a', 'b', 'c', 'd', 'e', 'f'] };

describe('progressOf', () => {
  it('is untouched without a record', () => {
    expect(progressOf(undefined, INFO)).toMatchObject({ status: 'untouched', fraction: 0 });
  });

  it('is complete with a completion time, exactly 1', () => {
    const r = progressOf(progress({ completedAt: '2026-10-02T09:00:00.000Z' }), INFO);
    expect(r).toMatchObject({ status: 'complete', fraction: 1, estimated: false });
  });

  it('counts steps and challenges when the lesson size is known', () => {
    const r = progressOf(progress({ step: 3, stepsDone: ['a', 'b', 'c'], challenges: { x: 10 } }), INFO);
    expect(r.status).toBe('in-progress');
    expect(r.estimated).toBe(false);
    expect(r.done).toBe(4);
    expect(r.total).toBe(8);
    expect(r.fraction).toBeCloseTo(0.5, 5);
  });

  it('uses the saved step when more steps were passed than recorded as done', () => {
    const r = progressOf(progress({ step: 4, stepsDone: ['a'] }), INFO);
    expect(r.done).toBe(4);
  });

  it('never shows a started lesson as empty or as finished', () => {
    const none = progressOf(progress(), INFO);
    expect(none.fraction).toBeGreaterThan(0);
    const almost = progressOf(
      progress({ step: 6, stepsDone: ['a', 'b', 'c', 'd', 'e', 'f'], challenges: { x: 10, y: 10 } }),
      INFO,
    );
    expect(almost.fraction).toBeLessThan(1);
  });

  it('caps counts at the lesson size', () => {
    const r = progressOf(progress({ step: 40, challenges: { a: 1, b: 1, c: 1, d: 1 } }), INFO);
    expect(r.done).toBe(8);
  });

  it('falls back to an estimate and says so when the size is unknown', () => {
    const r = progressOf(progress({ step: 2, stepsDone: ['a', 'b'] }), undefined);
    expect(r.estimated).toBe(true);
    expect(r.total).toBeNull();
    expect(r.fraction).toBeGreaterThan(0);
    expect(r.fraction).toBeLessThan(1);
  });
});

describe('buildCourseModel', () => {
  const none = buildCourseModel({ lessons: LESSONS, progress: {}, recommendedId: 'what-is-flux', steps: {} });

  it('lists every lesson in path order', () => {
    expect(none.lessons.map((l) => l.meta.id)).toEqual(
      [...LESSONS].sort((a, b) => a.order - b.order).map((l) => l.id),
    );
    expect(none.total).toBe(20);
    expect(none.completed).toBe(0);
    expect(none.startedCount).toBe(0);
  });

  it('marks the recommended lesson and lists pending prerequisites as advice', () => {
    expect(none.byId.get('what-is-flux')?.recommended).toBe(true);
    expect(none.byId.get('how-apps-run')?.recommended).toBe(false);
    expect(none.byId.get('how-apps-run')?.pending).toEqual(['what-is-flux']);
  });

  it('removes a prerequisite from pending once it is complete', () => {
    const m = buildCourseModel({
      lessons: LESSONS,
      progress: { 'what-is-flux': progress({ completedAt: '2026-10-02T09:00:00.000Z' }) },
      recommendedId: 'how-apps-run',
      steps: {},
    });
    expect(m.byId.get('how-apps-run')?.pending).toEqual([]);
    expect(m.completed).toBe(1);
    expect(m.byId.get('what-is-flux')?.status).toBe('complete');
  });

  it('flags lessons without content when asked', () => {
    const m = buildCourseModel({
      lessons: LESSONS,
      progress: {},
      recommendedId: null,
      steps: {},
      contentIds: new Set(['what-is-flux']),
    });
    expect(m.byId.get('what-is-flux')?.hasContent).toBe(true);
    expect(m.byId.get('first-deploy')?.hasContent).toBe(false);
  });

  it('knows the step number once the size is known', () => {
    const m = buildCourseModel({
      lessons: LESSONS,
      progress: { 'first-deploy': progress({ step: 2 }) },
      recommendedId: 'first-deploy',
      steps: { 'first-deploy': INFO },
    });
    expect(m.byId.get('first-deploy')?.stepNumber).toBe(3);
    expect(m.byId.get('first-deploy')?.stepCount).toBe(6);
  });
});

describe('resumeTarget', () => {
  const base = { lessons: LESSONS, recommendedId: 'what-is-flux', steps: {} };

  it('starts the recommended lesson for a new learner', () => {
    const m = buildCourseModel({ ...base, progress: {} });
    expect(resumeTarget(m, {})).toEqual({ lessonId: 'what-is-flux', kind: 'start', stepIndex: null });
  });

  it('continues the lesson started most recently', () => {
    const prog = {
      'what-is-flux': progress({ step: 1, startedAt: '2026-10-01T09:00:00.000Z' }),
      'containers-101': progress({ step: 3, startedAt: '2026-10-05T09:00:00.000Z' }),
    };
    const m = buildCourseModel({ ...base, progress: prog });
    expect(resumeTarget(m, prog)).toEqual({ lessonId: 'containers-101', kind: 'continue', stepIndex: 3 });
  });

  it('offers review when everything is done', () => {
    const prog = Object.fromEntries(
      LESSONS.map((l) => [l.id, progress({ completedAt: '2026-10-09T09:00:00.000Z' })]),
    );
    const m = buildCourseModel({ ...base, recommendedId: null, progress: prog });
    expect(resumeTarget(m, prog)).toEqual({ lessonId: 'what-is-flux', kind: 'review', stepIndex: null });
  });
});

describe('resumeHref', () => {
  it('deep links the saved step when its id is known', () => {
    const href = resumeHref({ lessonId: 'first-deploy', kind: 'continue', stepIndex: 2 }, INFO);
    expect(href).toBe('/learn/first-deploy?step=c');
  });

  it('clamps a saved step past the end to the last step', () => {
    const href = resumeHref({ lessonId: 'first-deploy', kind: 'continue', stepIndex: 99 }, INFO);
    expect(href).toBe('/learn/first-deploy?step=f');
  });

  it('is the plain lesson URL when starting or when the content is unknown', () => {
    expect(resumeHref({ lessonId: 'first-deploy', kind: 'start', stepIndex: null }, INFO)).toBe(
      '/learn/first-deploy',
    );
    expect(resumeHref({ lessonId: 'first-deploy', kind: 'continue', stepIndex: 2 }, undefined)).toBe(
      '/learn/first-deploy',
    );
  });
});

describe('words', () => {
  it('formats a short date', () => {
    expect(shortDate('2026-10-03T12:00:00.000Z')).toMatch(/^\d{1,2} Oct 2026$/);
    expect(shortDate(null)).toBe('');
    expect(shortDate('not a date')).toBe('');
  });

  it('describes each state in plain words', () => {
    const m = buildCourseModel({
      lessons: LESSONS,
      progress: {
        'what-is-flux': progress({ completedAt: '2026-10-03T12:00:00.000Z' }),
        'containers-101': progress({ step: 1 }),
      },
      recommendedId: 'how-apps-run',
      steps: { 'containers-101': INFO },
    });
    expect(statusPhrase(m.byId.get('what-is-flux') as never)).toMatch(/^Done, \d{1,2} Oct 2026$/);
    expect(statusPhrase(m.byId.get('containers-101') as never)).toBe('In progress, step 2 of 6');
    expect(statusPhrase(m.byId.get('how-apps-run') as never)).toBe('Next on the path');
    expect(statusPhrase(m.byId.get('first-deploy') as never)).toBe('Not started');
  });
});

describe('modulesOfTrack', () => {
  it('groups a track by module in path order', () => {
    const items = LESSONS.map((meta) => ({ meta }));
    const groups = modulesOfTrack(items, 'nimbus');
    expect(groups.map((g) => g.module)).toEqual(['Deploy', 'Traffic', 'Projects', 'Operate']);
    expect(groups[0]?.items.map((i) => i.meta.id)).toEqual([
      'first-deploy',
      'resources-pricing',
      'deploy-from-git',
      'ai-assisted-deploy',
    ]);
  });
});

describe('resumeCopy', () => {
  const base = { lessons: LESSONS, recommendedId: 'what-is-flux', steps: {} };

  it('invites a new learner to lesson 1', () => {
    const m = buildCourseModel({ ...base, progress: {} });
    const c = resumeCopy(m, resumeTarget(m, {}), undefined);
    expect(c.label).toBe('Start the course');
    expect(c.caption).toBe('Lesson 1: Thousands of machines, one cloud, 7 min');
  });

  it('says where a lesson in progress resumes once its size is known', () => {
    const prog = { 'first-deploy': progress({ step: 2 }) };
    const m = buildCourseModel({ ...base, recommendedId: 'first-deploy', progress: prog, steps: {} });
    const t = resumeTarget(m, prog);
    expect(resumeCopy(m, t, INFO)).toEqual({
      label: 'Resume lesson',
      caption: 'Deploy your first app, step 3 of 6',
      announcement: 'Resuming Deploy your first app at step 3 of 6.',
    });
    expect(resumeCopy(m, t, undefined).caption).toBe('Deploy your first app');
  });

  it('offers the next lesson after some are done', () => {
    const prog = { 'what-is-flux': progress({ completedAt: '2026-10-02T09:00:00.000Z' }) };
    const m = buildCourseModel({ ...base, recommendedId: 'how-apps-run', progress: prog, steps: {} });
    const c = resumeCopy(m, resumeTarget(m, prog), undefined);
    expect(c.label).toBe('Start the next lesson');
    expect(c.caption).toBe('From spec to running app, 8 min');
  });
});
