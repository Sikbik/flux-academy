/**
 * What a lesson reads from a spec, computed the way the lesson validator computes it (`learn/engine.ts`
 * `specFacts`): the teaching lint over the normalised spec, and the monthly price at the built-in rates for
 * one month. The spec stage and the lesson widgets report these in their task events, so a check passes on
 * screen if and only if it passes in the content tests.
 */

import type { FluxAppSpec } from '@shared/flux/types';
import { evaluateCheck } from '@/learn/checks';
import { applySolution } from '@/learn/specs';
import type { TaskEvent } from '@/learn/stage-api';
import type { DeepPartial, Task } from '@/learn/types';
import { BAKED_CONTEXT, BLOCKS_PER_MONTH, lintInput, priceSpec, SPEC_TOOLS } from './model';

export interface LessonFacts {
  valid: boolean;
  /** Every issue code present, any severity. */
  codes: string[];
  /** Monthly USD at the built-in rates, one month. */
  usd: number;
}

export function lessonFacts(spec: FluxAppSpec): LessonFacts {
  const report = lintInput(spec, { teaching: true });
  const usd = priceSpec({ ...spec, expire: BLOCKS_PER_MONTH }, BAKED_CONTEXT).usdPerMonth;
  return { valid: report.valid, codes: report.issues.map((i) => i.code), usd };
}

/** The `spec` task event for a spec. */
export function specEvent(spec: FluxAppSpec): Extract<TaskEvent, { type: 'spec' }> {
  const f = lessonFacts(spec);
  return { type: 'spec', spec, valid: f.valid, issueCodes: f.codes, usdPerMonth: f.usd };
}

export type SpecTask = Extract<Task, { kind: 'spec' }>;

export interface Solved {
  /** The spec the editor ends up with. */
  spec: FluxAppSpec;
  /** Which candidate it was built on. */
  base: 'current' | 'entry' | 'start';
  /** What to merge the solution over: `undefined` means the spec on screen. */
  from: FluxAppSpec | DeepPartial<FluxAppSpec> | undefined;
  /** Whether it satisfies the task's check at the built-in rates. */
  passes: boolean;
}

/** Whether `spec` satisfies the task's check, evaluated the way the lesson validator evaluates it. */
export function satisfies(task: SpecTask, spec: FluxAppSpec): boolean {
  const f = lessonFacts(spec);
  return evaluateCheck(task.check, { spec, lint: { valid: f.valid, codes: f.codes }, usdPerMonth: f.usd })
    .pass;
}

/**
 * What "Show me" should leave a spec task with.
 *
 * A task's `solution` is written for the spec its step starts from, and the validator proves it there. Over
 * the learner's own edits it may not hold (they changed the very field it relies on), so the candidates are
 * tried in order and the first that satisfies the check wins:
 *
 *   current   the spec on screen: the learner's work is kept
 *   entry     the spec the step was entered with: this step's attempts are dropped, earlier steps' work stays
 *   start     the stage's own starting spec, which is what the engine's fallback uses
 *
 * When none satisfies the check the entry (else start) candidate is returned with `passes: false`, so the
 * caller still shows something deterministic.
 */
export function solveSpecTask(
  task: SpecTask,
  candidates: {
    current: FluxAppSpec;
    entry: FluxAppSpec | null;
    start: DeepPartial<FluxAppSpec> | FluxAppSpec;
  },
): Solved {
  const order: { base: Solved['base']; from: FluxAppSpec | DeepPartial<FluxAppSpec> }[] = [
    { base: 'current', from: candidates.current },
  ];
  if (candidates.entry) order.push({ base: 'entry', from: candidates.entry });
  order.push({ base: 'start', from: candidates.start });

  let fallback: Solved | null = null;
  for (const c of order) {
    const spec = applySolution(SPEC_TOOLS, c.from, task.solution);
    const passes = satisfies(task, spec);
    const from = c.base === 'current' ? undefined : c.from;
    if (passes) return { spec, base: c.base, from, passes };
    if (c.base !== 'current' && fallback === null) fallback = { spec, base: c.base, from, passes };
  }
  return (
    fallback ?? {
      spec: applySolution(SPEC_TOOLS, candidates.current, task.solution),
      base: 'current',
      from: undefined,
      passes: false,
    }
  );
}
