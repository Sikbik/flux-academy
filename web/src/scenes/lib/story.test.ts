import { describe, expect, it } from 'vitest';
import { STORY_BREAK_AT, STORY_HEAL_AT, storyPlan } from './story';

describe('story plan', () => {
  it('forms the cell during describe and places nothing', () => {
    expect(storyPlan(0, 0).build).toBeLessThan(0.05);
    expect(storyPlan(0, 1).build).toBe(1);
    expect(storyPlan(0, 0.5).instances).toBe(0);
    const a = storyPlan(0, 0.3).build;
    const b = storyPlan(0, 0.6).build;
    expect(b).toBeGreaterThan(a);
  });

  it('stamps during register and keeps the cell formed', () => {
    expect(storyPlan(1, 0.7).stamp).toBeCloseTo(0.7);
    expect(storyPlan(1, 0.2).build).toBe(1);
    expect(storyPlan(1, 0.9).instances).toBe(0);
  });

  it('places up to three instances during place, then starts traffic', () => {
    expect(storyPlan(2, 0.05).instances).toBe(0);
    expect(storyPlan(2, 0.2).instances).toBe(1);
    expect(storyPlan(2, 0.4).instances).toBe(2);
    expect(storyPlan(2, 0.6).instances).toBe(3);
    expect(storyPlan(2, 0.6).traffic).toBe(false);
    expect(storyPlan(2, 0.9).traffic).toBe(true);
  });

  it('breaks a node mid run and heals it before the end', () => {
    expect(storyPlan(3, STORY_BREAK_AT - 0.01).broken).toBe(false);
    expect(storyPlan(3, STORY_BREAK_AT + 0.01).broken).toBe(true);
    expect(storyPlan(3, STORY_HEAL_AT - 0.01).broken).toBe(true);
    expect(storyPlan(3, STORY_HEAL_AT + 0.01).broken).toBe(false);
    expect(storyPlan(3, 0.6).instances).toBe(3);
    expect(storyPlan(3, 0.6).traffic).toBe(true);
  });

  it('is a pure function of its inputs and clamps progress', () => {
    expect(storyPlan(2, 0.4)).toEqual(storyPlan(2, 0.4));
    expect(storyPlan(3, 7).broken).toBe(false);
    expect(storyPlan(1, -3).stamp).toBe(0);
  });
});
