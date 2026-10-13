/**
 * The `terminal` stage: the sandbox terminal (web/src/terminal) inside a lesson step.
 *
 * - Goals the learner completes are reported as `terminal-goal` events; goals completed earlier in the
 *   same terminal session are reported again when a step is entered, so a step never waits for a command
 *   the learner already ran.
 * - A command the learner ran that did not move the task (an unknown command, a failed one, a build for
 *   the wrong platform) is reported as a `custom` `attempt`, which is what opens "Show me" in the player.
 *   Looking around (`ls`, `cat`, `help`) and anything the player ran itself are not attempts.
 * - "Show me" types the step's remaining goals, in the script's order, with the typing animation.
 * - There is no next-step chip here: the player's own ladder (Hint, then Show me for half XP) is how a
 *   learner gets a command typed for them, and a chip that ran it for full XP would sidestep that. The
 *   lab, which has no XP, keeps the chip.
 * - The session lives as long as this stage stays mounted, which is as long as consecutive steps show
 *   the same script id: the learner's files, goals and history carry from step to step.
 * - Finishing every goal of the script unlocks `shell-shocked` ("Finish a terminal scenario").
 *
 * Owner: the terminal owner. See web/src/terminal for the engine and the view.
 */

import { useEffect, useRef } from 'react';
import { makeSolver, type TerminalHandle, TerminalView } from '@/terminal/TerminalView';
import { isAttempt } from '@/terminal/view/attempt';
import { MarkupText } from '../MarkupText';
import type { StageComponentProps } from '../stage-api';
import type { TerminalStage } from '../types';

const renderMarkup = (text: string) => <MarkupText text={text} plain />;

export default function TerminalStageView({
  stage,
  host,
  active,
  task,
  stepKey,
  compact,
}: StageComponentProps<TerminalStage>) {
  const handle = useRef<TerminalHandle | null>(null);
  const taskGoals = task?.kind === 'terminal' ? task.goals : undefined;
  const goalsKey = taskGoals?.join('|') ?? '';
  const hostRef = useRef(host);
  hostRef.current = host;
  const goalsRef = useRef(taskGoals);
  goalsRef.current = taskGoals;

  // "Show me": type what is still open for this step. The solver reads the goals from a ref, so it
  // is registered again only when the task's goal list (its key) or the step changes.
  const hasTask = taskGoals !== undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: goalsKey stands for the goal list, stepKey is a trigger
  useEffect(() => {
    if (!hasTask) {
      host.registerSolver(null);
      return;
    }
    host.registerSolver(
      makeSolver(
        () => handle.current,
        () => {
          const done = new Set(handle.current?.session.getState().completed ?? []);
          return (goalsRef.current ?? []).filter((g) => !done.has(g));
        },
      ),
    );
    return () => host.registerSolver(null);
  }, [host, hasTask, goalsKey, stepKey]);

  // Entering a step: tell the engine about goals the learner already completed in this session.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stepKey is the trigger
  useEffect(() => {
    const done = handle.current?.session.getState().completed ?? [];
    for (const goalId of done) hostRef.current.emit({ type: 'terminal-goal', goalId });
  }, [stepKey]);

  return (
    <TerminalView
      ref={handle}
      script={stage.script}
      variant="embedded"
      compact={compact}
      active={active}
      goals={taskGoals ? 'strip' : 'none'}
      goalFilter={taskGoals}
      hints="never"
      renderMarkup={renderMarkup}
      onGoal={(goalId) => {
        hostRef.current.emit({ type: 'terminal-goal', goalId });
        if (handle.current?.session.getState().allDone) hostRef.current.unlock('shell-shocked');
      }}
      onCommand={(event) => {
        const goals = goalsRef.current;
        if (goals && isAttempt(event, goals)) hostRef.current.emit({ type: 'custom', name: 'attempt' });
      }}
    />
  );
}
