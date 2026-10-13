import { describe, expect, it } from 'vitest';
import { deriveStates, focusIndex, newlyDone, progressOf, stepAnnouncement } from './states';

const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd', kind: 'check' as const }];

describe('deriveStates', () => {
  it('derives done, current and todo around the current step', () => {
    expect(deriveStates(steps, 'c')).toEqual(['done', 'done', 'current', 'todo']);
    expect(deriveStates(steps, 'a')).toEqual(['current', 'todo', 'todo', 'todo']);
  });

  it('is all todo without a current step or with an unknown id', () => {
    expect(deriveStates(steps)).toEqual(['todo', 'todo', 'todo', 'todo']);
    expect(deriveStates(steps, 'nope')).toEqual(['todo', 'todo', 'todo', 'todo']);
  });

  it('lets an explicit state win', () => {
    const withState = [
      { id: 'a', state: 'skipped' as const },
      { id: 'b' },
      { id: 'c', state: 'locked' as const },
    ];
    expect(deriveStates(withState, 'b')).toEqual(['skipped', 'current', 'locked']);
  });
});

describe('newlyDone', () => {
  it('finds segments that became done', () => {
    expect(newlyDone(['current', 'todo'], ['done', 'current'])).toEqual([0]);
  });

  it('ignores the first render and steps that were already done', () => {
    expect(newlyDone(null, ['done', 'done'])).toEqual([]);
    expect(newlyDone(['done', 'current'], ['done', 'done'])).toEqual([1]);
    expect(newlyDone(['done', 'done'], ['done', 'done'])).toEqual([]);
  });

  it('does not report a step that went backwards', () => {
    expect(newlyDone(['done', 'done'], ['done', 'current'])).toEqual([]);
  });
});

describe('stepAnnouncement', () => {
  it('words a step', () => {
    expect(stepAnnouncement(2, 9, 'Ports and traffic', 'current')).toBe(
      'Step 3 of 9: Ports and traffic, current',
    );
  });

  it('words a checkpoint and a locked step', () => {
    expect(stepAnnouncement(8, 9, 'Question 1', 'todo', 'check')).toBe(
      'Step 9 of 9, checkpoint: Question 1, to do',
    );
    expect(stepAnnouncement(0, 2, 'Intro', 'locked')).toBe('Step 1 of 2: Intro, locked');
  });
});

describe('progressOf / focusIndex', () => {
  it('counts done and skipped as progress', () => {
    expect(progressOf(['done', 'skipped', 'current', 'todo'])).toEqual({ done: 2, total: 4, fraction: 0.5 });
    expect(progressOf([])).toEqual({ done: 0, total: 0, fraction: 0 });
  });

  it('focuses the current step, else the first todo, else the last', () => {
    expect(focusIndex(['done', 'current', 'todo'])).toBe(1);
    expect(focusIndex(['done', 'todo', 'todo'])).toBe(1);
    expect(focusIndex(['done', 'done'])).toBe(1);
  });

  it('prefers the step the host says the learner is on, even when it is done', () => {
    // Nothing is `current` (the learner is on a step they finished); the first todo is elsewhere.
    expect(focusIndex(['todo', 'done', 'todo'], 1)).toBe(1);
    expect(focusIndex(['done', 'current', 'todo'], 2)).toBe(2);
  });

  it('ignores a preferred index that is not a step', () => {
    expect(focusIndex(['done', 'current', 'todo'], -1)).toBe(1);
    expect(focusIndex(['done', 'current', 'todo'], 7)).toBe(1);
    expect(focusIndex(['done', 'todo'], Number.NaN)).toBe(1);
  });
});
