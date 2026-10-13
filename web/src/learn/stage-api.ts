/**
 * The stage plug-in contract.
 *
 * A lesson step shows one `Stage` (see ./types.ts). Each stage `kind` is rendered by a React component
 * that lives in `web/src/learn/stages/<kind>.tsx` and default-exports a `StageComponent`. The lesson
 * engine finds them with `import.meta.glob('./stages/*.tsx')` (lazy), keyed by file name, so a new stage
 * is one new file and never an edit to a shared registry.
 *
 * Who writes which stage file (see docs/ARCHITECTURE.md section 5):
 *   diorama.tsx  the diorama owner      terminal.tsx  the terminal owner
 *   spec.tsx     the Spec Forge owner   diagram.tsx   the diagrams owner
 *   code.tsx, compare.tsx, widget.tsx   the lesson-engine owner
 *
 * Widgets (`stage.kind === 'widget'`) are looked up the same way in `web/src/learn/widgets/<id>/index.tsx`.
 * Diagrams (`kind === 'diagram'`) in `web/src/learn/diagrams/<id>.tsx`.
 *
 * The contract is deliberately small: a stage renders itself from its props, reports what the learner
 * did through `host.emit`, and offers a solver for "Show me". The engine owns gating, XP and feedback.
 */

import type { ComponentType } from 'react';
import type { Stage, Task } from './types';

/** What a stage tells the engine about the learner's actions. The engine matches these to the step task. */
export type TaskEvent =
  /** The learner set the number of instances (diorama, forge). */
  | { type: 'instances'; value: number }
  /** A node was killed. `count` is distinct nodes killed since the step began. */
  | { type: 'node-killed'; count: number }
  /** A request was sent in a traffic or failover scene. `count` since the step began. */
  | { type: 'request-sent'; count: number }
  /**
   * The spec in an editor changed. The forge computes lint and quote with the shared engine and passes
   * them so the engine can evaluate declarative `Check`s without recomputing.
   */
  | { type: 'spec'; spec: unknown; valid: boolean; issueCodes: string[]; usdPerMonth: number | null }
  /** A terminal goal id from the script was completed. */
  | { type: 'terminal-goal'; goalId: string }
  /** A widget reports that its own completion condition is met. */
  | { type: 'widget-done' }
  /** Anything else worth an achievement or analytics-free bookkeeping. */
  | { type: 'custom'; name: string; data?: unknown };

export interface StageHost {
  /** Report something the learner did. Cheap; call as often as needed. */
  emit(event: TaskEvent): void;
  /**
   * Register the function that performs the step's task for the learner ("Show me"). Call from an
   * effect; the engine calls it at most once per step and awards half XP. Pass `null` to clear.
   *
   * A solver that finishes at once (it sets some state and the stage reports the task done) returns
   * nothing; the engine then allows a short grace for the stage to report. A solver that keeps
   * performing for a while (a widget walking a flow, a terminal typing) should return a promise that
   * settles when it has finished: the engine waits for it, for at most 30 seconds, and says "Continue is
   * available when it finishes" truthfully. The task completes when the promise settles, or when the
   * stage reports the task done itself, whichever comes first.
   */
  registerSolver(solve: (() => void | Promise<void>) | null): void;
  /** Unlock an achievement by id (see docs/CONTENT.md section 6). Idempotent. */
  unlock(achievementId: string): void;
}

export interface StageComponentProps<S extends Stage = Stage> {
  stage: S;
  host: StageHost;
  /**
   * True while this step's task is open. A stage should make its controls available either way, but may
   * use this to draw attention (a pulsing control, a prompt).
   */
  active: boolean;
  /**
   * The active step's task, when it has one. A stage reads it to configure itself and to build its "Show me"
   * solver (for example a spec stage applies `task.solution`; a terminal stage types the next goal's
   * `example`). It is undefined for read-only steps. During a checkpoint challenge the player passes a task
   * it synthesises from the challenge, so the same stage components serve both: a `spec` task (the
   * challenge's `check`, or all requirements, and its `solution`) for spec-fix and spec-build, and a
   * `terminal` task (the challenge's `goals`) for a terminal challenge.
   */
  task?: Task;
  /** Changes when the learner enters a step, so a stage can reset per-step counters. */
  stepKey: string;
  /**
   * Hint that the stage is rendered in a short, collapsible area above the narrative. True whenever the
   * player is in its stacked layout (viewport narrower than 900 px), which covers phones and tablets in
   * portrait; false in the two-column layout.
   */
  compact?: boolean;
}

export type StageComponent<S extends Stage = Stage> = ComponentType<StageComponentProps<S>>;

/** A widget gets the same props, with `stage.kind === 'widget'`. */
export type WidgetComponent = ComponentType<StageComponentProps<Extract<Stage, { kind: 'widget' }>>>;

/** A diagram component draws one named diagram at one beat. It must be a pure function of its props. */
export interface DiagramProps {
  /** 0-based beat. Moving between beats animates the change (draw-on, highlight, transition). */
  beat: number;
  /** Optional authored props from the lesson. */
  props?: Record<string, unknown>;
  /** Reduced motion: render the beat's end state without animating. */
  reducedMotion: boolean;
}
export type DiagramComponent = ComponentType<DiagramProps>;

/** Static facts every diagram module exports alongside its default component. */
export interface DiagramMeta {
  id: string;
  title: string;
  /** One short caption per beat, shown as the figure caption (`FIG n.m`). Length is the beat count. */
  beats: string[];
  /** Alternative text for the whole diagram, for screen readers. */
  alt: string;
}
