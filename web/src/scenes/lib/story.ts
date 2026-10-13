// The scroll story as a pure function: given the chapter (0 describe, 1 register, 2 place, 3 run) and the
// progress through it, what is the bench doing? The scene reconciles toward this plan, so scrolling back
// up un-does things, and the page only ever writes two numbers.

import { saturate, smoothstep } from './math';

export interface StoryPlan {
  /** Instances that should be placed. */
  instances: number;
  /** One node is broken. */
  broken: boolean;
  /** Request packets flow. */
  traffic: boolean;
  /** 0..1: the cell forms around the spec. */
  build: number;
  /** 0..1: the hash descends to the chain strip, is stamped, and a ring runs along the strip. */
  stamp: number;
}

export const STORY_BREAK_AT = 0.5;
export const STORY_HEAL_AT = 0.86;

export function storyPlan(chapter: number, progress: number): StoryPlan {
  const p = saturate(progress);
  switch (Math.round(chapter)) {
    case 0:
      return { instances: 0, broken: false, traffic: false, build: smoothstep(0.02, 0.92, p), stamp: 0 };
    case 1:
      return { instances: 0, broken: false, traffic: false, build: 1, stamp: p };
    case 2:
      return {
        instances: p < 0.1 ? 0 : p < 0.3 ? 1 : p < 0.5 ? 2 : 3,
        broken: false,
        traffic: p > 0.72,
        build: 1,
        stamp: 1,
      };
    default:
      return {
        instances: 3,
        broken: p >= STORY_BREAK_AT && p < STORY_HEAL_AT,
        traffic: true,
        build: 1,
        stamp: 1,
      };
  }
}

/** Where in the register chapter each beat happens (all in stamp units, 0..1). */
export const STAMP_BEATS = {
  /** The hash leaves the cell and travels to the head block. */
  travelEnd: 0.4,
  /** The block takes the stamp. */
  stampAt: 0.46,
  /** The ring starts to run down the strip. */
  ringStart: 0.52,
} as const;
