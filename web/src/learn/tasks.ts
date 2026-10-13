/**
 * Task matching: how a `TaskEvent` from a stage moves a step's `Task` toward done.
 *
 * Pure. The player keeps one `TaskProgress` per step (and per checkpoint challenge that behaves like a
 * task) and feeds it every event. Done is latched: once a task is done, later events never undo it.
 *
 * Rules per task kind
 *   read           no task; Continue is always allowed
 *   set-instances  an `instances` event (or a `spec` event with a numeric `instances`) whose value is
 *                  `exactly`, or within `min` and `max`
 *   kill-nodes     a `node-killed` event with `count >= task.count` (count is distinct nodes since step start)
 *   send-requests  a `request-sent` event with `count >= task.count`
 *   spec           a `spec` event for which `evaluateCheck(task.check)` passes
 *   terminal       `terminal-goal` events until every id in `task.goals` has been seen
 *   widget         a `widget-done` event
 *   confirm        the learner ticks the honour-system box (`confirmed`)
 *
 * An "attempt" is something the learner did that did not satisfy the task (a different value that is
 * not enough, a changed spec that still fails, a stage reporting `custom` named `attempt`). The first
 * attempt unlocks "Show me".
 */

import { type CheckContext, describeCheck, evaluateCheck, failureMessages } from './checks';
import type { TaskEvent } from './stage-api';
import type { Task } from './types';

export interface TaskProgress {
  done: boolean;
  /** Distinct attempts that did not satisfy the task. */
  attempts: number;
  /** set-instances: the last value seen. */
  instances: number | null;
  kills: number;
  requests: number;
  /** terminal: goal ids completed. */
  goals: string[];
  widgetDone: boolean;
  confirmed: boolean;
  /** spec: why the last evaluated spec did not pass, as markup lines (author messages first). */
  failures: string[];
  /** spec: a key of the last spec seen, to count one attempt per distinct spec. */
  lastSpecKey: string | null;
}

export function freshProgress(): TaskProgress {
  return {
    done: false,
    attempts: 0,
    instances: null,
    kills: 0,
    requests: 0,
    goals: [],
    widgetDone: false,
    confirmed: false,
    failures: [],
    lastSpecKey: null,
  };
}

export interface MatchContext {
  /** Normalise a spec from an event so check paths always resolve (the engine's `normalizeSpec`). */
  normalize?: (spec: unknown) => unknown;
  /** The key of the spec the step started with, so the untouched spec is not an attempt. */
  entrySpecKey?: string | null;
}

export function specKey(spec: unknown): string | null {
  try {
    return JSON.stringify(spec) ?? null;
  } catch {
    return null;
  }
}

/** Whether an instance count satisfies a set-instances task. */
export function instancesSatisfy(task: Extract<Task, { kind: 'set-instances' }>, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (task.exactly !== undefined) return value === task.exactly;
  if (task.min !== undefined && value < task.min) return false;
  if (task.max !== undefined && value > task.max) return false;
  return true;
}

/** The context a spec event gives a check. */
export function eventCheckContext(ev: Extract<TaskEvent, { type: 'spec' }>, ctx: MatchContext): CheckContext {
  const spec = ctx.normalize ? ctx.normalize(ev.spec) : ev.spec;
  return {
    spec,
    lint: { valid: ev.valid, codes: ev.issueCodes },
    usdPerMonth: ev.usdPerMonth,
  };
}

function specFailureLines(task: Extract<Task, { kind: 'spec' }>, ev: CheckContext): string[] {
  const r = evaluateCheck(task.check, ev);
  if (r.pass) return [];
  const lines = failureMessages(r);
  if (lines.length > 0) return lines;
  // No author message: say what the check requires, once per leaf.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of r.failed) {
    const text = describeCheck(f.check);
    if (!seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
  }
  return out;
}

/** Feed one event to a task. Returns the same object when nothing changed. */
export function applyTaskEvent(
  task: Task | undefined,
  p: TaskProgress,
  ev: TaskEvent,
  ctx: MatchContext = {},
): TaskProgress {
  if (!task || task.kind === 'read' || p.done) return p;

  if (ev.type === 'custom' && ev.name === 'attempt') {
    return { ...p, attempts: p.attempts + 1 };
  }

  switch (task.kind) {
    case 'set-instances': {
      let value: number | null = null;
      if (ev.type === 'instances') value = ev.value;
      else if (ev.type === 'spec') {
        const s = ctx.normalize ? ctx.normalize(ev.spec) : ev.spec;
        const n = (s as { instances?: unknown } | null)?.instances;
        if (typeof n === 'number') value = n;
      }
      if (value === null) return p;
      if (instancesSatisfy(task, value)) return { ...p, instances: value, done: true };
      const fresh = p.instances !== value;
      return { ...p, instances: value, attempts: p.attempts + (fresh ? 1 : 0) };
    }
    case 'kill-nodes': {
      if (ev.type !== 'node-killed') return p;
      const kills = Math.max(p.kills, ev.count);
      return { ...p, kills, done: kills >= task.count };
    }
    case 'send-requests': {
      if (ev.type !== 'request-sent') return p;
      const requests = Math.max(p.requests, ev.count);
      return { ...p, requests, done: requests >= task.count };
    }
    case 'spec': {
      if (ev.type !== 'spec') return p;
      const cc = eventCheckContext(ev, ctx);
      const r = evaluateCheck(task.check, cc);
      if (r.pass) return { ...p, done: true, failures: [], lastSpecKey: specKey(ev.spec) };
      const key = specKey(cc.spec);
      const changed = key !== p.lastSpecKey && key !== (ctx.entrySpecKey ?? null);
      return {
        ...p,
        failures: specFailureLines(task, cc),
        lastSpecKey: key,
        attempts: p.attempts + (changed ? 1 : 0),
      };
    }
    case 'terminal': {
      if (ev.type !== 'terminal-goal') return p;
      if (!task.goals.includes(ev.goalId) || p.goals.includes(ev.goalId)) return p;
      const goals = [...p.goals, ev.goalId];
      return { ...p, goals, done: task.goals.every((g) => goals.includes(g)) };
    }
    case 'widget': {
      if (ev.type !== 'widget-done') return p;
      return { ...p, widgetDone: true, done: true };
    }
    case 'confirm':
      return p;
  }
}

/** The learner ticked the honour-system box of a confirm task. */
export function confirmTask(task: Task | undefined, p: TaskProgress): TaskProgress {
  if (task?.kind !== 'confirm' || p.done) return p;
  return { ...p, confirmed: true, done: true };
}

export interface TaskFeedback {
  /** `progress` is counting toward the goal; `fail` says what is still wrong. */
  tone: 'progress' | 'fail';
  /** Markup lines, shown one per line. */
  lines: string[];
}

/**
 * What to tell the learner about a task that is not done: specific, never scolding. Null when there is
 * nothing to say yet (the learner has not done anything).
 */
export function taskFeedback(
  task: Task | undefined,
  p: TaskProgress,
  goalLabels: Readonly<Record<string, string>> = {},
): TaskFeedback | null {
  if (!task || task.kind === 'read' || p.done) return null;
  switch (task.kind) {
    case 'set-instances': {
      if (p.instances === null) return null;
      const need =
        task.exactly !== undefined
          ? `You need exactly ${task.exactly}.`
          : task.min !== undefined && task.max !== undefined
            ? `Aim for ${task.min} to ${task.max}.`
            : task.min !== undefined
              ? `You need at least ${task.min}.`
              : task.max !== undefined
                ? `You need at most ${task.max}.`
                : '';
      return { tone: 'fail', lines: [`That is ${p.instances}. ${need}`.trim()] };
    }
    case 'kill-nodes':
      return p.kills > 0 ? { tone: 'progress', lines: [`${p.kills} of ${task.count} nodes killed.`] } : null;
    case 'send-requests':
      return p.requests > 0
        ? { tone: 'progress', lines: [`${p.requests} of ${task.count} requests sent.`] }
        : null;
    case 'spec':
      return p.failures.length > 0 ? { tone: 'fail', lines: p.failures } : null;
    case 'terminal': {
      const left = task.goals.filter((g) => !p.goals.includes(g));
      if (p.goals.length === 0) return null;
      const next = left[0];
      const label = next ? (goalLabels[next] ?? next) : '';
      return {
        tone: 'progress',
        lines: [`${p.goals.length} of ${task.goals.length} goals done.${label ? ` Next: ${label}` : ''}`],
      };
    }
    case 'widget':
    case 'confirm':
      return null;
  }
}

/** Whether the learner may move on: the task is done, or there is none. */
export function taskAllowsContinue(task: Task | undefined, p: TaskProgress | undefined): boolean {
  if (!task || task.kind === 'read') return true;
  return p?.done === true;
}
