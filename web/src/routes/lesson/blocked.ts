/**
 * Why Continue is not available yet, in words: a short reason for the status line beside the buttons and
 * a fuller sentence that is spoken when the learner presses Continue anyway. Pure.
 */

import { plainText } from '@/learn/markup';
import { continueAllowed, layoutOf, type PlayerState } from '@/learn/player';
import type { Lesson, Task } from '@/learn/types';

const SHORT: Record<Task['kind'], string> = {
  read: '',
  'set-instances': 'Set the instances to continue',
  'kill-nodes': 'Kill a node to continue',
  'send-requests': 'Send a request to continue',
  spec: 'Edit the spec to continue',
  terminal: 'Run the commands to continue',
  widget: 'Finish the exercise to continue',
  confirm: 'Tick the box to continue',
};

/** Said while "Show me" is being performed on the stage. */
const SHOWING = 'Showing you how';

/** The short reason Continue is blocked, or null when it is not. */
export function blockedReason(lesson: Lesson, state: PlayerState): string | null {
  if (continueAllowed(lesson, state)) return null;
  const layout = layoutOf(lesson);
  if (state.position >= layout.steps) {
    const ch = lesson.checkpoint[state.position - layout.steps];
    return ch && state.challenges[ch.id]?.solving ? SHOWING : 'Answer to continue';
  }
  const step = lesson.steps[state.position];
  if (step && state.steps[step.id]?.solving) return SHOWING;
  const task = step?.task;
  return task ? SHORT[task.kind] || 'Finish the task to continue' : 'Finish the task to continue';
}

/** What to say when Continue is pressed while blocked: the reason, the ask and the way out. */
export function blockedMessage(lesson: Lesson, state: PlayerState): string {
  const layout = layoutOf(lesson);
  if (state.position >= layout.steps) {
    return 'Answer the challenge to continue. Show me and Skip appear after a first try.';
  }
  const task = lesson.steps[state.position]?.task;
  if (!task || task.kind === 'read') return '';
  const reason = SHORT[task.kind] || 'Finish the task to continue';
  const prompt = 'prompt' in task ? plainText(task.prompt) : '';
  return `${reason}. ${prompt}`.trim();
}
