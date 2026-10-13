/**
 * The `spec` stage: the Spec Forge editor inside a lesson. Owner: the Spec Forge module (web/src/forge).
 *
 * What it adds to the bare editor
 *   - starts from `stage.spec`, merged over the defaults exactly as the lesson validator and "Show me" do
 *   - passes `editable`, `focus` and `show` straight through (locks are shown, notes are numbered)
 *   - reports every change as a `spec` task event whose `valid`, `issueCodes` and `usdPerMonth` are computed
 *     the way the lesson validator computes them (teaching lint over the normalised spec, the built-in
 *     rates, one month), so a check passes on screen if and only if it passes in the content tests
 *   - reports `instances` when the learner changes the count (the forge is listed as a source in TaskEvent)
 *   - registers the "Show me" solver: the task's `solution` applied the way a tutor would, one visible edit
 *     the learner can undo. It goes over the learner's work when that still satisfies the check, else over
 *     the spec the step was entered with, else over the stage's starting spec (see `solveSpecTask`)
 *   - unlocks `three-is-company`, `spec-whisperer` and `penny-pincher` through `host.unlock`
 *
 * Resetting. Entering a step that brings a NEW stage object resets the editor to its `spec` unless the
 * stage says `reset: false`. A step that inherits the previous stage keeps the learner's work, so a story
 * can continue. "Try again" (same step, new nonce) and the engine's own Show me override reset it.
 * Nothing is reported while the editor is being set up, so a task never completes by itself on entry.
 *
 * Rates. The price here is the built-in table (`pricing="baked"`), the same numbers the lesson text quotes
 * and the content tests assert, and there is no "Verify with Flux" in a lesson (that belongs to the lab).
 */

import type { FluxAppSpec } from '@shared/flux/types';
import { useCallback, useEffect, useRef } from 'react';
import { type ForgePanel, type ForgeState, SpecEditor, type SpecEditorHandle } from '@/forge';
import { satisfies, solveSpecTask, specEvent } from '@/forge/lessonFacts';
import { specFromPartial } from '@/forge/model';
import { useStageResets } from '@/forge/useStageResets';
import type { StageComponentProps, StageHost } from '../stage-api';
import type { SpecStage, Task } from '../types';
import styles from './spec.module.css';

/** Quiet time before a burst of edits is reported. Typing in the JSON panel is a burst. */
const REPORT_MS = 120;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * The function behind "Show me" for a task this stage can perform, else null.
 *
 * A spec task's solution is written for the spec its step starts from. The learner has usually edited
 * something by the time they ask (an attempt is what offers "Show me"), so the solution is applied over
 * their work when that still satisfies the check, and over the step's starting spec when it does not.
 */
function solverFor(
  task: Task | undefined,
  editor: { current: SpecEditorHandle | null },
  entry: { current: FluxAppSpec | null },
  start: () => SpecStage['spec'],
): (() => void) | null {
  if (!task) return null;
  if (task.kind === 'spec') {
    return () => {
      const h = editor.current;
      if (!h) return;
      const solved = solveSpecTask(task, {
        current: h.getState().spec,
        entry: entry.current,
        start: specFromPartial(start()),
      });
      h.apply(task.solution, solved.from);
    };
  }
  if (task.kind === 'set-instances') {
    return () => {
      const h = editor.current;
      if (!h) return;
      const current = h.getState().spec.instances;
      const target = task.exactly ?? clamp(current, task.min ?? 1, task.max ?? 100);
      h.apply({ instances: target });
    };
  }
  return null;
}

export default function SpecStageView({
  stage,
  host,
  task,
  stepKey,
  compact,
}: StageComponentProps<SpecStage>) {
  const editor = useRef<SpecEditorHandle>(null);

  // ---- when to start over ---------------------------------------------------------------------------------
  const resets = useStageResets(stage, stepKey, stage.reset);

  // ---- reporting ---------------------------------------------------------------------------------------------
  const hostRef = useRef<StageHost>(host);
  hostRef.current = host;
  const lastSpec = useRef<FluxAppSpec | null>(null);
  const lastInstances = useRef<number | null>(null);
  const timer = useRef(0);
  const pending = useRef<ForgeState | null>(null);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = 0;
    const state = pending.current;
    pending.current = null;
    if (!state) return;
    hostRef.current.emit(specEvent(state.spec));
  }, []);

  const onChange = useCallback(
    (state: ForgeState) => {
      // Setting the editor up is not something the learner did.
      if (state.origin === 'init' || state.origin === 'reset') {
        lastSpec.current = state.spec;
        lastInstances.current = state.spec.instances;
        pending.current = null;
        window.clearTimeout(timer.current);
        timer.current = 0;
        return;
      }
      // A broken JSON text, a new lint context: the spec did not change, so there is nothing to report.
      if (state.spec === lastSpec.current) return;
      lastSpec.current = state.spec;

      if (state.spec.instances !== lastInstances.current) {
        lastInstances.current = state.spec.instances;
        if (state.origin === 'form' || state.origin === 'json') {
          hostRef.current.emit({ type: 'instances', value: state.spec.instances });
        }
      }

      pending.current = state;
      window.clearTimeout(timer.current);
      if (state.origin === 'apply') flush();
      else timer.current = window.setTimeout(flush, REPORT_MS);
    },
    [flush],
  );

  // Nothing reported for one step may reach the next: events are dropped when the step changes or the
  // stage goes away.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stepKey is the trigger, not a value read here
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      timer.current = 0;
      pending.current = null;
    },
    [stepKey],
  );

  // The spec the step was entered with: where "Show me" falls back to when the learner's edits in this step
  // stand in the solution's way. Taken after the editor has reset for the step, if it is going to.
  const entry = useRef<FluxAppSpec | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // A step that continues the learner's work may already be satisfied by it. Tell the engine once, but only
  // when it is, so entering a step is never counted as a failed attempt.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the step changes
  useEffect(() => {
    const h = editor.current;
    if (!h) return;
    const state = h.getState();
    entry.current = state.spec;
    if (task?.kind !== 'spec') return;
    if (state.origin === 'init' || state.origin === 'reset') return;
    if (satisfies(task, state.spec)) hostRef.current.emit(specEvent(state.spec));
  }, [stepKey]);

  // ---- "Show me" -------------------------------------------------------------------------------------------------
  // The engine forgets the solver when a step is entered, so it is registered again for every step.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stepKey is the trigger, not a value read here
  useEffect(() => {
    host.registerSolver(solverFor(task, editor, entry, () => stageRef.current.spec));
    return () => host.registerSolver(null);
  }, [host, task, stepKey]);

  return (
    <div className={styles.stage} data-compact={compact ? 'true' : undefined}>
      <SpecEditor
        ref={editor}
        initial={stage.spec}
        resetKey={resets}
        editable={stage.editable}
        focus={stage.focus}
        show={stage.show as readonly ForgePanel[] | undefined}
        compact={compact}
        pricing="baked"
        onChange={onChange}
        onAchievement={host.unlock}
      />
    </div>
  );
}
