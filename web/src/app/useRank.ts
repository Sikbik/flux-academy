/**
 * Rank information for the header chip, derived from the learner store (never duplicated).
 *
 * Ranks are by tracks finished (docs/CONTENT.md section 6): Initiate, Cumulus Operator, Nimbus
 * Engineer, Stratus Architect. The ring around the rank glyph shows progress through the track the
 * learner is working on, which is the way to the next rank.
 */

import { LESSONS, TRACKS, type TrackId, trackById } from '@shared/curriculum';
import { useMemo } from 'react';
import { currentRank, type LessonProgress, trackCompletion, useLearner } from '@/learn/store';

export interface RankInfo {
  id: 'initiate' | 'cumulus' | 'nimbus' | 'stratus';
  name: string;
  /** The tier of the rank held, null for Initiate. */
  tier: TrackId | null;
  /** The track being worked on (the way to the next rank), null when all three are complete. */
  nextTrack: TrackId | null;
  nextRankName: string | null;
  /** 0..1 through `nextTrack` (lessons completed over lessons in it). 1 when everything is done. */
  progress: number;
  done: number;
  total: number;
}

export function computeRankInfo(lessons: Record<string, LessonProgress>): RankInfo {
  const rank = currentRank(lessons);
  const completion = trackCompletion(lessons);
  const next = TRACKS.find((t) => !completion[t.id].complete)?.id ?? null;
  const tier = rank.id === 'initiate' ? null : rank.id;
  if (next === null) {
    const total = LESSONS.length;
    return {
      id: rank.id,
      name: rank.name,
      tier,
      nextTrack: null,
      nextRankName: null,
      progress: 1,
      done: total,
      total,
    };
  }
  const { done, total } = completion[next];
  return {
    id: rank.id,
    name: rank.name,
    tier,
    nextTrack: next,
    nextRankName: trackById(next).rank,
    progress: total > 0 ? done / total : 0,
    done,
    total,
  };
}

export function useRankInfo(): RankInfo {
  const lessons = useLearner((s) => s.lessons);
  return useMemo(() => computeRankInfo(lessons), [lessons]);
}
