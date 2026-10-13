import { describe, expect, it } from 'vitest';
import { tourLesson } from './__fixtures__/tour';
import type { Lesson } from './types';
import { challengeBaseXp, challengeXp, DEFAULT_CHALLENGE_XP, gatedSteps, lessonBaseXp, lessonXp } from './xp';

describe('challenge XP', () => {
  it('defaults to 10, halves after Show me, and is 0 when skipped', () => {
    expect(challengeBaseXp({})).toBe(DEFAULT_CHALLENGE_XP);
    expect(challengeXp({}, null)).toBe(10);
    expect(challengeXp({}, 'shown')).toBe(5);
    expect(challengeXp({}, 'skipped')).toBe(0);
    expect(challengeXp({ xp: 25 }, null)).toBe(25);
    expect(challengeXp({ xp: 25 }, 'shown')).toBe(12);
    expect(challengeXp({ xp: 0 }, null)).toBe(10); // zero is not a valid award: use the default
  });
});

describe('lesson XP', () => {
  it('is minutes times ten', () => {
    expect(lessonBaseXp(7)).toBe(70);
  });

  const gated = gatedSteps(tourLesson).map((g) => g.id);

  it('shares the base across non-read tasks', () => {
    expect(gated.length).toBeGreaterThan(2);
    const all: Record<string, 'done'> = {};
    for (const id of gated) all[id] = 'done';
    const full = lessonXp({ minutes: 6, lesson: tourLesson, outcomes: all });
    expect(full).toMatchObject({ base: 60, earned: 60, shown: 0, skipped: 0 });
  });

  it('halves a shown task and zeroes a skipped or unreached one', () => {
    const n = gated.length;
    const outcomes: Record<string, 'done' | 'shown' | 'skipped'> = {};
    gated.forEach((id, i) => {
      outcomes[id] = i === 0 ? 'shown' : i === 1 ? 'skipped' : 'done';
    });
    const r = lessonXp({ minutes: 6, lesson: tourLesson, outcomes });
    expect(r.shown).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.earned).toBe(Math.round((60 * (n - 2 + 0.5)) / n));
    const none = lessonXp({ minutes: 6, lesson: tourLesson, outcomes: {} });
    expect(none.earned).toBe(0);
    expect(none.skipped).toBe(n);
  });

  it('a lesson with no tasks earns its whole base', () => {
    const l: Lesson = { ...tourLesson, steps: tourLesson.steps.map((s) => ({ ...s, task: undefined })) };
    expect(lessonXp({ minutes: 5, lesson: l, outcomes: {} })).toMatchObject({
      base: 50,
      earned: 50,
      tasks: 0,
    });
  });
});
