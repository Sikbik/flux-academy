/**
 * Step state for the lesson player's progress rail. Pure: resolve states from the current
 * step, find which steps just completed (to play the landing), and word the spoken name of
 * each segment.
 */

export type StepState = 'todo' | 'current' | 'done' | 'locked' | 'skipped';
export type StepKind = 'step' | 'check';

export interface StepLike {
  id: string;
  kind?: StepKind;
  /** An explicit state wins over the derived one. */
  state?: StepState;
}

/**
 * Resolves every step's state. A step with an explicit `state` keeps it. Otherwise, relative
 * to the current step: before it is `done`, it is `current`, after it is `todo`. With no
 * `currentId` nothing is current and everything unstated is `todo`.
 */
export function deriveStates(steps: readonly StepLike[], currentId?: string): StepState[] {
  const cur = currentId === undefined ? -1 : steps.findIndex((s) => s.id === currentId);
  return steps.map((s, i) => {
    if (s.state) return s.state;
    if (cur < 0) return 'todo';
    if (i < cur) return 'done';
    if (i === cur) return 'current';
    return 'todo';
  });
}

/** Indices that are `done` now and were not before: the segments that just landed. */
export function newlyDone(prev: readonly StepState[] | null, next: readonly StepState[]): number[] {
  if (!prev) return [];
  const out: number[] = [];
  next.forEach((s, i) => {
    if (s === 'done' && prev[i] !== undefined && prev[i] !== 'done') out.push(i);
  });
  return out;
}

const SPOKEN: Record<StepState, string> = {
  todo: 'to do',
  current: 'current',
  done: 'done',
  locked: 'locked',
  skipped: 'skipped',
};

export function spokenState(state: StepState): string {
  return SPOKEN[state];
}

/** "Step 3 of 9: Ports and traffic, current" (a checkpoint is named as one). */
export function stepAnnouncement(
  index: number,
  total: number,
  label: string,
  state: StepState,
  kind: StepKind = 'step',
): string {
  const head =
    kind === 'check' ? `Step ${index + 1} of ${total}, checkpoint` : `Step ${index + 1} of ${total}`;
  return `${head}: ${label}, ${SPOKEN[state]}`;
}

/** How many steps are done, and the fraction, for summaries and tests. */
export function progressOf(states: readonly StepState[]): { done: number; total: number; fraction: number } {
  const total = states.length;
  const done = states.filter((s) => s === 'done' || s === 'skipped').length;
  return { done, total, fraction: total === 0 ? 0 : done / total };
}

/**
 * The index the rail's single tab stop (and its caption) sits on. `preferred` is the step the learner is
 * actually on, when the host knows it: that step may be `done` (a revisited or just-completed one), in
 * which case no segment is `current` and the stop would otherwise fall on the first `todo` segment, which
 * is somewhere else entirely. Without it: the current step, or the first not-done step, or the last.
 */
export function focusIndex(states: readonly StepState[], preferred?: number): number {
  if (preferred !== undefined && Number.isInteger(preferred) && preferred >= 0 && preferred < states.length) {
    return preferred;
  }
  const cur = states.indexOf('current');
  if (cur >= 0) return cur;
  const todo = states.indexOf('todo');
  if (todo >= 0) return todo;
  return Math.max(0, states.length - 1);
}
