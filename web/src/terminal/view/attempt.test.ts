import { describe, expect, it } from 'vitest';
import type { CommandEvent } from '../engine/session';
import { createSession } from '../engine/session';
import { FIXED_NOW, script } from '../engine/testkit';
import { isAttempt } from './attempt';

/** Run one line and hand back the command event it produced. */
function ran(lines: string[], last: string, assisted = false): CommandEvent {
  const s = createSession({ script: script(), instant: true, now: () => FIXED_NOW });
  for (const l of lines) s.submit(l);
  let seen: CommandEvent | null = null;
  s.onCommand((e) => {
    seen = e;
  });
  s.submit(last, { assisted });
  if (!seen) throw new Error('no command event');
  return seen;
}

const TASK = ['build'];

describe('isAttempt', () => {
  it('is false for a command that completed a goal of the task', () => {
    expect(isAttempt(ran([], 'docker build -t you/app:1.0.0 .'), TASK)).toBe(false);
  });

  it('is true for a command that did not move the task', () => {
    expect(isAttempt(ran([], 'docker build -x'), TASK)).toBe(true); // not found
    expect(isAttempt(ran([], 'docker push you/app:1.0.0'), TASK)).toBe(true); // runs, errors
    expect(isAttempt(ran([], 'ducker build .'), TASK)).toBe(true); // a typo
  });

  it('is true for a repeat of a goal that was already complete', () => {
    const again = ran(['docker build -t you/app:1.0.0 .'], 'docker build -t you/app:1.0.0 .');
    expect(isAttempt(again, TASK)).toBe(true);
  });

  it('is false for looking around', () => {
    for (const line of ['ls', 'pwd', 'cat Dockerfile', 'help', 'cd src', 'cat nope.txt', 'whoami']) {
      expect(isAttempt(ran([], line), TASK), line).toBe(false);
    }
  });

  it('is false for commands the host ran itself', () => {
    expect(isAttempt(ran([], 'docker push you/app:1.0.0', true), TASK)).toBe(false);
    expect(isAttempt(ran([], 'ducker', true), TASK)).toBe(false);
  });

  it('counts a command for a goal that is not part of this task', () => {
    const push = ran(['docker build -t you/app:1.0.0 .'], 'docker push you/app:1.0.0');
    expect(push.entry.goals).toEqual(['push']);
    expect(isAttempt(push, TASK)).toBe(true);
    expect(isAttempt(push, ['push'])).toBe(false);
  });
});
