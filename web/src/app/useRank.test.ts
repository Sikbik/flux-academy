import { LESSONS } from '@shared/curriculum';
import { describe, expect, it } from 'vitest';
import type { LessonProgress } from '@/learn/store';
import { computeRankInfo } from './useRank';

function done(ids: string[]): Record<string, LessonProgress> {
  return Object.fromEntries(
    ids.map((id) => [
      id,
      { step: 0, stepsDone: [], challenges: {}, startedAt: 'x', completedAt: '2026-10-12T00:00:00Z' },
    ]),
  );
}

describe('computeRankInfo', () => {
  it('starts as an Initiate working on Cumulus', () => {
    const r = computeRankInfo({});
    expect(r).toMatchObject({ id: 'initiate', tier: null, nextTrack: 'cumulus', progress: 0 });
  });

  it('shows progress through the current track', () => {
    const cumulus = LESSONS.filter((l) => l.track === 'cumulus').map((l) => l.id);
    const r = computeRankInfo(done(cumulus.slice(0, 1)));
    expect(r.id).toBe('initiate');
    expect(r.progress).toBeCloseTo(1 / cumulus.length, 5);
  });

  it('is a Cumulus Operator once that track is done, now working on Nimbus', () => {
    const cumulus = LESSONS.filter((l) => l.track === 'cumulus').map((l) => l.id);
    const r = computeRankInfo(done(cumulus));
    expect(r).toMatchObject({ id: 'cumulus', tier: 'cumulus', nextTrack: 'nimbus', progress: 0 });
    expect(r.nextRankName).toBe('Nimbus Engineer');
  });

  it('is complete when every lesson is done', () => {
    const r = computeRankInfo(done(LESSONS.map((l) => l.id)));
    expect(r).toMatchObject({ id: 'stratus', nextTrack: null, progress: 1 });
  });
});
