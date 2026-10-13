import type { CommandEvent } from '../engine/session';

/**
 * Did the learner run something aimed at a task that did not satisfy it? A lesson host reports this
 * (the player opens "Show me" after the first one).
 *
 * Not an attempt: an empty line, a builtin (looking around with `ls`, `cat`, `help`), a command the host
 * ran itself ("Show me", a chip), or one that completed a goal of the task.
 */
export function isAttempt(event: CommandEvent, taskGoals: readonly string[]): boolean {
  const { entry } = event;
  if (entry.assisted) return false;
  if (entry.runKind === 'empty' || entry.runKind === 'builtin') return false;
  return !entry.goals.some((g) => taskGoals.includes(g));
}
