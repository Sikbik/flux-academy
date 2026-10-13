import { describe, expect, it } from 'vitest';
import { tourLesson } from '@/learn/__fixtures__/tour';
import { createPlayer, type PlayerEnv } from '@/learn/player';
import { blockedMessage, blockedReason } from './blocked';

const env: PlayerEnv = {
  learner: {
    lessonProgress: () => undefined,
    lessons: () => ({}),
    xp: () => 0,
    startLesson: () => {},
    setStep: () => {},
    completeStep: () => {},
    markAssist: () => {},
    awardChallenge: () => {},
    completeLesson: () => {},
  },
  unlock: () => {},
  syncTracks: () => [],
  announce: () => {},
  schedule: () => () => {},
  pricing: () => undefined,
};

function at(id: string) {
  return createPlayer(
    {
      lesson: tourLesson,
      meta: {
        id: 'fixture-tour',
        track: 'nimbus',
        module: 'x',
        title: 't',
        summary: 's',
        minutes: 6,
        kind: 'project',
        prerequisites: [],
        labs: [],
        order: 99,
      },
      engine: () => null,
      start: { id },
      ephemeral: true,
    },
    env,
  );
}

describe('blocked reasons', () => {
  it('is null on a read-only step', () => {
    const s = at('layers').getState();
    expect(blockedReason(tourLesson, s)).toBeNull();
    expect(blockedMessage(tourLesson, s)).toBe('');
  });

  it('names the task kind and carries the prompt', () => {
    const s = at('build').getState();
    expect(blockedReason(tourLesson, s)).toBe('Run the commands to continue');
    expect(blockedMessage(tourLesson, s)).toContain('Build the image, then push it.');
    expect(blockedReason(tourLesson, at('spec').getState())).toBe('Edit the spec to continue');
    expect(blockedReason(tourLesson, at('break').getState())).toBe('Kill a node to continue');
    expect(blockedReason(tourLesson, at('bind').getState())).toBe('Tick the box to continue');
  });

  it('asks for an answer in the checkpoint', () => {
    const s = at('order-lifecycle').getState();
    expect(blockedReason(tourLesson, s)).toBe('Answer to continue');
    expect(blockedMessage(tourLesson, s)).toContain('Show me and Skip');
  });

  it('says it is showing while Show me is being performed', () => {
    const p = at('build');
    p.getState().registerSolver(() => {});
    p.getState().showMe();
    expect(blockedReason(tourLesson, p.getState())).toBe('Showing you how');
  });

  it('stops blocking once the step is skipped', () => {
    const p = at('break');
    p.getState().skip();
    expect(blockedReason(tourLesson, p.getState())).toBeNull();
  });
});
