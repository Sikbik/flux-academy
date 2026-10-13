/**
 * The lesson player: the state machine behind `/learn/:lessonId`.
 *
 * A player is a small zustand store created per lesson visit (`createPlayer`). Its position is one
 * linear index over the lesson: steps first, then checkpoint challenges, then the completion moment.
 * The same index is what the learner store persists as the resume point, so the course map and the
 * profile can treat it as "how far through" without knowing the lesson.
 *
 *   position 0 .. S-1          step i
 *   position S .. S+C-1        checkpoint challenge i - S
 *   position S+C               the completion moment
 *
 * Everything with a side effect goes through `PlayerEnv`, so the machine runs in a test with fakes:
 * persistence (the learner store), achievements, the screen reader announcer and timers.
 *
 * Gating is per step: Continue is allowed when the step has no task, its task is done, or it ended
 * with "Show me" or Skip. The outline may jump anywhere (the path is advice, not a lock), and XP
 * accounting closes the loophole: a task that was never done earns nothing (see xp.ts).
 */

import { type LessonMeta, nextLesson } from '@shared/curriculum';
import type { PricingParams } from '@shared/flux/types';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { AchievementId } from '@/content/catalog';
import { announce } from '@/system/announce';
import { toast as toastStore } from '@/system/toasts';
import {
  detectSpecAchievements,
  FRESH_WATCH,
  type SpecWatch,
  syncTrackAchievements,
  unlock as unlockAchievement,
} from './achievements';
import { type CheckContext, evaluateCheck } from './checks';
import type { LessonEngine } from './engine';
import { specFacts } from './engine';
import {
  type EstimateVerdict,
  estimateTruth,
  gradeChoice,
  gradeEstimate,
  gradeMatch,
  gradeMulti,
  gradeOrder,
  type MatchVerdict,
  type MultiVerdict,
  type OrderVerdict,
} from './grade';
import { applySolution, buildSpec } from './specs';
import type { TaskEvent } from './stage-api';
import { currentRank, type LessonProgress, trackCompletion, useLearner } from './store';
import {
  applyTaskEvent,
  confirmTask,
  freshProgress,
  type MatchContext,
  specKey,
  type TaskFeedback,
  type TaskProgress,
  taskAllowsContinue,
  taskFeedback,
} from './tasks';
import type {
  Challenge,
  EstimateChallenge,
  Lesson,
  SpecBuildChallenge,
  SpecFixChallenge,
  Stage,
  Step,
  Task,
} from './types';
import { type Assist, challengeXp, lessonXp, type Outcome } from './xp';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export type Phase = 'step' | 'challenge' | 'complete';

export interface Layout {
  steps: number;
  challenges: number;
  /** The position of the completion moment. */
  end: number;
}

export function layoutOf(lesson: Pick<Lesson, 'steps' | 'checkpoint'>): Layout {
  const steps = lesson.steps.length;
  const challenges = lesson.checkpoint.length;
  return { steps, challenges, end: steps + challenges };
}

export function phaseAt(layout: Layout, position: number): Phase {
  if (position < layout.steps) return 'step';
  if (position < layout.end) return 'challenge';
  return 'complete';
}

export function clampPosition(layout: Layout, position: number): number {
  if (!Number.isFinite(position)) return 0;
  return Math.min(layout.end, Math.max(0, Math.floor(position)));
}

/** The stage in force at a step: the latest stage declared at or before it. */
export function effectiveStage(lesson: Pick<Lesson, 'steps'>, stepIndex: number): Stage | null {
  for (let i = Math.min(stepIndex, lesson.steps.length - 1); i >= 0; i -= 1) {
    const s = lesson.steps[i]?.stage;
    if (s) return s;
  }
  return null;
}

/**
 * What decides whether a stage keeps its identity between steps ("Changing `kind` or `scene` swaps the
 * stage; otherwise props update in place"). Use it as a React key.
 */
export function stageIdentity(stage: Stage): string {
  switch (stage.kind) {
    case 'diorama':
      return `diorama:${stage.scene}`;
    case 'diagram':
      return `diagram:${stage.id}`;
    case 'widget':
      return `widget:${stage.id}`;
    case 'terminal':
      return `terminal:${stage.script.id}`;
    default:
      return stage.kind;
  }
}

// The task and the stage of a challenge are derived, but a stage reads their identity: the spec editor
// starts over when it is handed a new stage object. Deriving a fresh object on every render would wipe the
// learner's edits each time the player's state changed, so each challenge keeps one of each.
const taskCache = new WeakMap<Challenge, Task | undefined>();
const stageCache = new WeakMap<Challenge, Stage | null>();

/** The task a checkpoint challenge behaves like, for the stage it is shown on. Stable per challenge. */
export function challengeAsTask(c: Challenge): Task | undefined {
  if (taskCache.has(c)) return taskCache.get(c);
  const task = deriveChallengeTask(c);
  taskCache.set(c, task);
  return task;
}

function deriveChallengeTask(c: Challenge): Task | undefined {
  switch (c.kind) {
    case 'spec-fix':
      return { kind: 'spec', check: c.check, prompt: c.prompt, hint: c.hint, solution: c.solution };
    case 'spec-build':
      return {
        kind: 'spec',
        check: { all: c.requirements.map((r) => r.check) },
        prompt: c.prompt,
        hint: c.hint,
        solution: c.solution,
      };
    case 'terminal':
      return { kind: 'terminal', goals: c.goals, prompt: c.prompt, hint: c.hint };
    default:
      return undefined;
  }
}

/**
 * The stage a checkpoint challenge uses, or null when it needs none (choice, order...). An estimate that
 * is about a spec shows the spec as the author wrote it (JSON, never its price) so the learner has the
 * numbers to estimate from. Stable per challenge: the same object every call.
 */
export function challengeStage(c: Challenge): Stage | null {
  if (stageCache.has(c)) return stageCache.get(c) ?? null;
  const stage = deriveChallengeStage(c);
  stageCache.set(c, stage);
  return stage;
}

function deriveChallengeStage(c: Challenge): Stage | null {
  switch (c.kind) {
    case 'spec-fix':
      return { kind: 'spec', spec: c.spec, reset: true };
    case 'spec-build':
      return { kind: 'spec', spec: c.spec, reset: true };
    case 'terminal':
      return { kind: 'terminal', script: c.script };
    case 'estimate': {
      if (!c.spec) return null;
      return {
        kind: 'code',
        files: [{ name: 'app-spec.json', lang: 'json', code: `${JSON.stringify(c.spec, null, 2)}\n` }],
      };
    }
    default:
      return null;
  }
}

/** Resolve `?step=<id>` (a step id or a challenge id) to a position. */
export function positionForId(
  lesson: Pick<Lesson, 'steps' | 'checkpoint'>,
  id: string | null,
): number | null {
  if (!id) return null;
  const s = lesson.steps.findIndex((x) => x.id === id);
  if (s >= 0) return s;
  const c = lesson.checkpoint.findIndex((x) => x.id === id);
  if (c >= 0) return lesson.steps.length + c;
  return null;
}

/** The id for a position, for `?step=`. Null at the completion moment. */
export function idAtPosition(lesson: Pick<Lesson, 'steps' | 'checkpoint'>, position: number): string | null {
  const layout = layoutOf(lesson);
  if (position < layout.steps) return lesson.steps[position]?.id ?? null;
  if (position < layout.end) return lesson.checkpoint[position - layout.steps]?.id ?? null;
  return null;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type StepStatus = 'open' | 'done' | 'shown' | 'skipped';

export interface StepRuntime {
  status: StepStatus;
  progress: TaskProgress;
  hintOpen: boolean;
  /** The learner has had a while with no progress: "Show me" is on offer. */
  stuck: boolean;
  /** "Show me" was invoked and the solver has not finished the task yet. */
  solving: boolean;
  /** The spec the step started with, so an untouched spec is not counted as an attempt. */
  entrySpecKey: string | null;
}

export type ChallengeStatus = 'open' | 'correct' | 'shown' | 'skipped';

export type WrongDetail =
  | { kind: 'choice'; picked: string }
  | { kind: 'multi'; verdict: MultiVerdict }
  | { kind: 'order'; verdict: OrderVerdict }
  | { kind: 'match'; verdict: MatchVerdict }
  | { kind: 'estimate'; verdict: EstimateVerdict; answer: number };

export interface ChallengeRuntime {
  status: ChallengeStatus;
  attempts: number;
  /** XP this challenge earned (persisted or this session). */
  xp: number;
  /** True when the XP was already in the learner store before this visit. */
  alreadyEarned: boolean;
  hintOpen: boolean;
  stuck: boolean;
  solving: boolean;
  lastWrong: WrongDetail | null;
  /** For spec and terminal challenges, matched like a task. */
  progress: TaskProgress;
  /** The last spec a spec challenge reported, to draw the live requirement checklist. */
  facts: CheckContext | null;
  entrySpecKey: string | null;
}

export interface CompletionSummary {
  /** XP earned for the lesson itself this visit (0 when it was already complete). */
  lessonXp: number;
  lessonBase: number;
  /** Tasks finished with Show me or skipped, for the breakdown line. */
  shown: number;
  skipped: number;
  /** Checkpoint XP earned this visit. */
  challengeXp: number;
  /** lessonXp + challengeXp. */
  total: number;
  /** The learner's XP total after this lesson. */
  xpAfter: number;
  alreadyCompleted: boolean;
  /** The rank held after, and the rank before when it changed. */
  rankAfter: string;
  rankedUpFrom: string | null;
  /** Set when this lesson finished its track. */
  trackCompleted: LessonMeta['track'] | null;
  achievements: AchievementId[];
  next: LessonMeta | null;
}

export interface PlayerState {
  lessonId: string;
  position: number;
  /** 1 moving forward, -1 back, 0 for a jump or the first position; drives the step transition. */
  direction: -1 | 0 | 1;
  steps: Record<string, StepRuntime>;
  challenges: Record<string, ChallengeRuntime>;
  /** Replaces the stage in force (Show me on a spec task re-seeds the editor). */
  stageOverride: { position: number; stage: Stage; nonce: number } | null;
  /** XP for challenges earned this visit. */
  sessionChallengeXp: number;
  completion: CompletionSummary | null;
  /** Bumps when the stage must be reset to its declared state. */
  stageNonce: number;
}

export interface PlayerActions {
  /** Called once by `createPlayer`: records the visit and enters the starting position. */
  begin(): void;
  go(position: number): void;
  next(): boolean;
  prev(): void;
  /** Feed an event from a stage (the `StageHost.emit` of the current stage). */
  emit(event: TaskEvent): void;
  confirm(): void;
  openHint(): void;
  /** The idle timer fired for the current step or challenge. */
  markStuck(): void;
  /**
   * The function that performs the open task for the learner ("Show me"). A solver that returns a promise
   * is a stage that performs for a while (a widget walking a flow): the player waits for it, at most
   * `SOLVER_AWAIT_MAX_MS`, instead of finishing the task after the short grace.
   */
  registerSolver(solve: Solver | null): void;
  showMe(): void;
  skip(): void;
  // checkpoint
  answerChoice(id: string | null): void;
  answerMulti(ids: string[]): void;
  answerOrder(ids: string[]): void;
  answerMatch(assignment: Record<string, string>): void;
  answerEstimate(value: number | null): void;
  /** Leave the completion moment for the start of the lesson, to review it. */
  review(): void;
  unlock(id: string): void;
  destroy(): void;
}

export type Player = PlayerState & PlayerActions;
export type PlayerStore = StoreApi<Player>;

/** What a stage registers for "Show me": run now, optionally say (with a promise) when it has finished. */
export type Solver = () => void | Promise<void>;

function isThenable(value: unknown): value is PromiseLike<void> {
  return (
    typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'
  );
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export interface LearnerPort {
  lessonProgress(id: string): LessonProgress | undefined;
  lessons(): Record<string, LessonProgress>;
  xp(): number;
  startLesson(id: string): void;
  setStep(id: string, position: number): void;
  completeStep(id: string, stepId: string): void;
  markAssist(id: string, stepId: string, how: 'shown' | 'skipped'): void;
  awardChallenge(lessonId: string, challengeId: string, xp: number): void;
  completeLesson(id: string, bonusXp: number, baseXp?: number): void;
}

export interface PlayerEnv {
  learner: LearnerPort;
  unlock(id: string): void;
  /** Called after a lesson completes: grant track medals. Returns the ones newly granted. */
  syncTracks(): AchievementId[];
  announce(message: string): void;
  /** A short visible note (XP earned, a rank reached). Optional: a harness may leave it out. */
  toast?(message: string, key: string): void;
  /** Run `fn` after `ms`; returns a cancel function. */
  schedule(fn: () => void, ms: number): () => void;
  /**
   * The pricing parameters the learner sees (live when available), or undefined for the baked ones. Nothing a
   * lesson grades is worked out on these: an estimate is graded on the baked rate card, which is the one the
   * lessons quote. They only feed the achievements that watch a spec's price.
   */
  pricing(): PricingParams | undefined;
}

export function defaultLearnerPort(): LearnerPort {
  return {
    lessonProgress: (id) => useLearner.getState().lessons[id],
    lessons: () => useLearner.getState().lessons,
    xp: () => useLearner.getState().xp,
    startLesson: (id) => useLearner.getState().startLesson(id),
    setStep: (id, n) => useLearner.getState().setStep(id, n),
    completeStep: (id, s) => useLearner.getState().completeStep(id, s),
    markAssist: (id, s, how) => useLearner.getState().markAssist(id, s, how),
    awardChallenge: (l, c, xp) => useLearner.getState().awardChallenge(l, c, xp),
    completeLesson: (id, b, base) => useLearner.getState().completeLesson(id, b, base),
  };
}

export function defaultPlayerEnv(): PlayerEnv {
  return {
    learner: defaultLearnerPort(),
    unlock: (id) => {
      unlockAchievement(id);
    },
    syncTracks: () => syncTrackAchievements(useLearner.getState().lessons),
    announce,
    toast: (message, key) => {
      toastStore.success(message, { key });
    },
    schedule: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    pricing: () => undefined,
  };
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export interface PlayerConfig {
  lesson: Lesson;
  meta: LessonMeta;
  /** Null until the domain engine has loaded; spec features then wait or degrade. */
  engine: () => LessonEngine | null;
  /** Where to start: a position, or a step/challenge id. Default: the saved resume point. */
  start?: { position?: number; id?: string | null };
  /** Do not write progress (fixtures and previews). */
  ephemeral?: boolean;
  /**
   * Skip the automatic `begin()` so a React component can call it from an effect (creation then has no
   * side effects and is safe to run twice in strict mode).
   */
  deferBegin?: boolean;
}

/** How long the learner can go without progress before "Show me" is offered (ms). */
export const STUCK_AFTER_MS = 25_000;
/** How long the engine waits for a stage's solver to finish the task before completing it itself. */
export const SOLVER_GRACE_MS = 1_200;
/**
 * A terminal solver types and streams one command at a time, so every goal still open adds this much
 * waiting, up to the cap. The task completes the moment the stage reports its last goal, so a working
 * solver never makes the learner wait out the whole period.
 */
export const SOLVER_GRACE_PER_GOAL_MS = 4_500;
export const SOLVER_GRACE_MAX_MS = 20_000;
/**
 * The longest the engine waits for a solver that returns a promise (a widget walking a flow). The task
 * completes when the promise settles or when this runs out, whichever is first, and it completes at once
 * when the stage reports the task done itself.
 */
export const SOLVER_AWAIT_MAX_MS = 30_000;

/** How long to wait for `task`'s solver, given the progress so far. */
export function solverGraceMs(
  task: Task | null | undefined,
  progress: TaskProgress | null | undefined,
): number {
  if (task?.kind !== 'terminal') return SOLVER_GRACE_MS;
  const done = progress?.goals ?? [];
  const open = task.goals.filter((g) => !done.includes(g)).length;
  return Math.min(SOLVER_GRACE_MAX_MS, SOLVER_GRACE_MS + open * SOLVER_GRACE_PER_GOAL_MS);
}

function freshStep(): StepRuntime {
  return {
    status: 'open',
    progress: freshProgress(),
    hintOpen: false,
    stuck: false,
    solving: false,
    entrySpecKey: null,
  };
}

function freshChallenge(): ChallengeRuntime {
  return {
    status: 'open',
    attempts: 0,
    xp: 0,
    alreadyEarned: false,
    hintOpen: false,
    stuck: false,
    solving: false,
    lastWrong: null,
    progress: freshProgress(),
    facts: null,
    entrySpecKey: null,
  };
}

function noopLearner(real: LearnerPort): LearnerPort {
  return {
    ...real,
    startLesson: () => {},
    setStep: () => {},
    completeStep: () => {},
    markAssist: () => {},
    awardChallenge: () => {},
    completeLesson: () => {},
  };
}

export function createPlayer(config: PlayerConfig, envIn: PlayerEnv = defaultPlayerEnv()): PlayerStore {
  const { lesson, meta } = config;
  const layout = layoutOf(lesson);
  const env: PlayerEnv = config.ephemeral ? { ...envIn, learner: noopLearner(envIn.learner) } : envIn;
  const learner = env.learner;

  // ---- initial state from saved progress ---------------------------------------------------------
  const saved = learner.lessonProgress(lesson.id);
  const steps: Record<string, StepRuntime> = {};
  for (const s of lesson.steps) {
    const rt = freshStep();
    const assist = saved?.assists?.[s.id];
    if (saved?.stepsDone.includes(s.id)) {
      rt.status = assist === 'shown' ? 'shown' : 'done';
      rt.progress = { ...rt.progress, done: true };
    } else if (assist === 'skipped') {
      rt.status = 'skipped';
    }
    steps[s.id] = rt;
  }
  const challenges: Record<string, ChallengeRuntime> = {};
  for (const c of lesson.checkpoint) {
    const rt = freshChallenge();
    const earned = saved?.challenges[c.id];
    if (earned !== undefined) {
      rt.alreadyEarned = true;
      rt.xp = earned;
      rt.status = earned === 0 ? 'skipped' : earned < challengeXp(c, null) ? 'shown' : 'correct';
      rt.progress = { ...rt.progress, done: true };
    }
    challenges[c.id] = rt;
  }

  // A lesson left at its completion moment starts again from the first step: the learner is here to
  // review, and the completion screen is reached by finishing, not by resuming.
  const resume = saved && saved.step < layout.end ? saved.step : 0;
  const startPos = config.start?.position ?? positionForId(lesson, config.start?.id ?? null) ?? resume;

  let cancelStuck: (() => void) | null = null;
  let cancelSolve: (() => void) | null = null;
  let solver: Solver | null = null;
  let watch: SpecWatch = FRESH_WATCH;
  let alive = true;

  const store = createStore<Player>((set, get) => {
    const engine = () => config.engine();

    const matchContext = (entrySpecKey: string | null): MatchContext => {
      const e = engine();
      return {
        normalize: e ? (spec) => e.normalizeSpec(spec).spec : undefined,
        entrySpecKey,
      };
    };

    /** The key of the spec an editor starts with, so the untouched spec is not counted as an attempt. */
    const entryKey = (partial: unknown): string | null => {
      const e = engine();
      if (!e || partial === undefined) return null;
      return specKey(buildSpec(e, partial as Parameters<typeof buildSpec>[1]));
    };

    const stepAt = (pos: number): Step | null => (pos < layout.steps ? (lesson.steps[pos] ?? null) : null);
    const challengeAt = (pos: number): Challenge | null =>
      pos >= layout.steps && pos < layout.end ? (lesson.checkpoint[pos - layout.steps] ?? null) : null;

    const patchStep = (id: string, patch: Partial<StepRuntime>) => {
      const cur = get().steps[id];
      if (!cur) return;
      set({ steps: { ...get().steps, [id]: { ...cur, ...patch } } });
    };
    const patchChallenge = (id: string, patch: Partial<ChallengeRuntime>) => {
      const cur = get().challenges[id];
      if (!cur) return;
      set({ challenges: { ...get().challenges, [id]: { ...cur, ...patch } } });
    };

    const persistPosition = (pos: number) => {
      learner.setStep(lesson.id, pos);
    };

    const armStuck = () => {
      cancelStuck?.();
      cancelStuck = null;
      const st = get();
      const step = stepAt(st.position);
      const ch = challengeAt(st.position);
      const gated =
        (step?.task && step.task.kind !== 'read' && st.steps[step.id]?.status === 'open') ||
        (ch && st.challenges[ch.id]?.status === 'open');
      if (!gated) return;
      cancelStuck = env.schedule(() => {
        if (alive) get().markStuck();
      }, STUCK_AFTER_MS);
    };

    // ---- completing -----------------------------------------------------------------------------
    const finishStep = (step: Step, how: 'done' | 'shown') => {
      const cur = get().steps[step.id];
      if (cur?.status !== 'open') return;
      patchStep(step.id, { status: how, solving: false, hintOpen: cur.hintOpen });
      learner.completeStep(lesson.id, step.id);
      if (how === 'shown') learner.markAssist(lesson.id, step.id, 'shown');
      cancelSolve?.();
      cancelSolve = null;
      env.announce(
        how === 'shown' ? 'Done for you. Continue is available.' : 'Task complete. Continue is available.',
      );
    };

    const solveChallenge = (c: Challenge, assist: Assist | null) => {
      const cur = get().challenges[c.id];
      if (cur?.status !== 'open') return;
      const xp = challengeXp(c, assist);
      const status: ChallengeStatus =
        assist === 'skipped' ? 'skipped' : assist === 'shown' ? 'shown' : 'correct';
      const had = learner.lessonProgress(lesson.id)?.challenges[c.id];
      learner.awardChallenge(lesson.id, c.id, xp);
      patchChallenge(c.id, {
        status,
        xp: had !== undefined ? had : xp,
        alreadyEarned: had !== undefined,
        solving: false,
        lastWrong: null,
        progress: { ...cur.progress, done: true },
      });
      if (had === undefined) {
        set({ sessionChallengeXp: get().sessionChallengeXp + xp });
        if (xp > 0) env.toast?.(`+${xp} XP`, 'xp');
      }
      cancelSolve?.();
      cancelSolve = null;
      if (status === 'correct' && c.kind === 'terminal') env.unlock('shell-shocked');
      if (status === 'correct') env.announce('Correct.');
    };

    /**
     * Runs the stage's solver and arranges for `finish` to run when the stage has had time to perform.
     *
     * A solver that returns a promise is a stage that performs for a while (a widget walking a flow, which
     * can take 7 to 25 seconds): the engine waits for it, at most `SOLVER_AWAIT_MAX_MS`, and the task
     * completes when it settles. Any other solver gets the short grace for its task (`solverGraceMs`; a
     * terminal types one command at a time, so it adds time per open goal). In both cases a stage that
     * reports the task done itself ends the wait at once (the finishing path cancels `cancelSolve`).
     * `waiting` is the sentence announced when the performance will take longer than the short grace.
     */
    const perform = (
      task: Task | undefined,
      progress: TaskProgress,
      finish: () => void,
      waiting: string,
    ): void => {
      let result: unknown;
      try {
        result = solver?.();
      } catch {
        // A solver that throws must not strand the learner: the engine finishes the task.
      }
      cancelSolve?.();
      cancelSolve = null;
      if (isThenable(result)) {
        let live = true;
        let cancelCap: (() => void) | null = null;
        const settle = () => {
          if (!live) return;
          live = false;
          cancelCap?.();
          cancelCap = null;
          cancelSolve = null;
          if (alive) finish();
        };
        cancelCap = env.schedule(settle, SOLVER_AWAIT_MAX_MS);
        cancelSolve = () => {
          live = false;
          cancelCap?.();
          cancelCap = null;
        };
        // A rejection is the end of the performance too: the learner is never left waiting on it.
        result.then(settle, settle);
        env.announce(waiting);
        return;
      }
      const grace = solverGraceMs(task, progress);
      cancelSolve = env.schedule(() => {
        if (alive) finish();
      }, grace);
      if (grace > SOLVER_GRACE_MS) env.announce(waiting);
    };

    // ---- detection ------------------------------------------------------------------------------
    const detect = (ev: TaskEvent) => {
      const st = get();
      if (ev.type === 'instances' && ev.value >= 3) env.unlock('three-is-company');
      if (ev.type === 'node-killed' && ev.count >= 1) {
        const stage = stageForPosition(st.position);
        if (stage?.kind === 'diorama' && stage.scene === 'failover') env.unlock('first-blood');
      }
      if (ev.type === 'spec') {
        const e = engine();
        if (!e) return;
        const facts = specFacts(e, ev.spec, env.pricing());
        const errors = facts.report ? facts.report.issues.filter((i) => i.severity === 'error').length : 0;
        const spec = facts.spec;
        const r = detectSpecAchievements(
          {
            errors: facts.report ? errors : ev.valid ? 0 : 1,
            valid: ev.valid,
            instances: spec.instances,
            cpu: spec.compose.reduce((a, c) => a + (Number.isFinite(c.cpu) ? c.cpu : 0), 0),
            ramMb: spec.compose.reduce((a, c) => a + (Number.isFinite(c.ram) ? c.ram : 0), 0),
            usdPerMonth: ev.usdPerMonth ?? facts.usdPerMonth,
          },
          watch,
        );
        watch = r.watch;
        for (const id of r.grant) env.unlock(id);
      }
    };

    const stageForPosition = (pos: number): Stage | null => {
      if (pos < layout.steps) return effectiveStage(lesson, pos);
      const c = challengeAt(pos);
      return c ? challengeStage(c) : null;
    };

    // ---- entering a position ---------------------------------------------------------------------
    const enter = (pos: number, direction: -1 | 0 | 1) => {
      const to = clampPosition(layout, pos);
      cancelSolve?.();
      cancelSolve = null;
      solver = null;
      watch = FRESH_WATCH;
      const step = stepAt(to);
      const ch = challengeAt(to);
      let steps = get().steps;
      let challenges = get().challenges;
      if (step) {
        const cur = steps[step.id];
        if (cur && cur.status === 'open') {
          // Entering an unfinished step starts it fresh: counters belong to the visit.
          steps = { ...steps, [step.id]: freshStep() };
        }
      }
      if (ch) {
        const cur = challenges[ch.id];
        if (cur && cur.status === 'open') {
          challenges = { ...challenges, [ch.id]: freshChallenge() };
        }
      }
      set({
        position: to,
        direction,
        steps,
        challenges,
        stageOverride: null,
        stageNonce: get().stageNonce + 1,
      });
      persistPosition(to);
      armStuck();
      if (to === layout.end && get().completion === null) finish();
    };

    // ---- finishing the lesson -----------------------------------------------------------------------
    const finish = () => {
      const st = get();
      if (st.completion) return;
      const prior = learner.lessonProgress(lesson.id);
      const alreadyCompleted = Boolean(prior?.completedAt);
      const rankBefore = currentRank(learner.lessons()).name;
      const tracksBefore = trackCompletion(learner.lessons());

      const outcomes: Record<string, Outcome | undefined> = {};
      for (const s of lesson.steps) {
        const rt = st.steps[s.id];
        if (!rt) continue;
        if (rt.status === 'done') outcomes[s.id] = 'done';
        else if (rt.status === 'shown') outcomes[s.id] = 'shown';
        else if (rt.status === 'skipped') outcomes[s.id] = 'skipped';
      }
      const breakdown = lessonXp({ minutes: meta.minutes, lesson, outcomes });

      if (!alreadyCompleted) {
        learner.completeLesson(lesson.id, 0, breakdown.earned);
      }
      const granted = alreadyCompleted ? [] : env.syncTracks();
      const lessonsAfter = learner.lessons();
      const rankAfter = currentRank(lessonsAfter).name;
      const tracksAfter = trackCompletion(lessonsAfter);
      const trackCompleted =
        (['cumulus', 'nimbus', 'stratus'] as const).find(
          (t) => tracksAfter[t].complete && !tracksBefore[t].complete,
        ) ?? null;
      const lessonXpEarned = alreadyCompleted ? 0 : breakdown.earned;
      const summary: CompletionSummary = {
        lessonXp: lessonXpEarned,
        lessonBase: breakdown.base,
        shown: breakdown.shown,
        skipped: breakdown.skipped,
        challengeXp: st.sessionChallengeXp,
        total: lessonXpEarned + st.sessionChallengeXp,
        xpAfter: learner.xp(),
        alreadyCompleted,
        rankAfter,
        rankedUpFrom: rankAfter !== rankBefore ? rankBefore : null,
        trackCompleted,
        achievements: granted,
        next: nextLesson(lesson.id),
      };
      set({ completion: summary });
      env.announce(alreadyCompleted ? 'Lesson complete.' : `Lesson complete. ${summary.total} XP earned.`);
      if (!alreadyCompleted && lessonXpEarned > 0)
        env.toast?.(`Lesson complete, +${lessonXpEarned} XP`, 'xp');
      if (summary.rankedUpFrom) env.toast?.(`Rank up: ${summary.rankAfter}`, 'rank');
    };

    // ---- the store ---------------------------------------------------------------------------------
    return {
      lessonId: lesson.id,
      position: clampPosition(layout, startPos),
      direction: 0,
      steps,
      challenges,
      stageOverride: null,
      sessionChallengeXp: 0,
      completion: null,
      stageNonce: 0,

      begin() {
        alive = true;
        learner.startLesson(lesson.id);
        if (!config.ephemeral) env.unlock('first-light');
        enter(get().position, 0);
      },

      go(position) {
        let to = clampPosition(layout, position);
        if (to === get().position) return;
        if (to >= layout.end) {
          // The completion moment waits for the checkpoint: land on the first challenge not yet done.
          const open = lesson.checkpoint.findIndex((c) => get().challenges[c.id]?.status === 'open');
          if (open >= 0) to = layout.steps + open;
        }
        enter(to, to > get().position ? 1 : -1);
      },

      next() {
        const st = get();
        const step = stepAt(st.position);
        if (step) {
          const rt = st.steps[step.id];
          if (!taskAllowsContinue(step.task, rt?.progress) && rt?.status === 'open') return false;
          // Passing a step with no gating task marks it done (reading counts).
          if (rt && rt.status === 'open' && (!step.task || step.task.kind === 'read')) {
            patchStep(step.id, { status: 'done' });
            learner.completeStep(lesson.id, step.id);
          }
          enter(st.position + 1, 1);
          return true;
        }
        const ch = challengeAt(st.position);
        if (ch) {
          const rt = st.challenges[ch.id];
          if (rt?.status === 'open') return false;
          enter(st.position + 1, 1);
          return true;
        }
        return false;
      },

      prev() {
        const st = get();
        if (st.position > 0) enter(st.position - 1, -1);
      },

      emit(event) {
        if (!alive) return;
        const st = get();
        detect(event);
        const step = stepAt(st.position);
        if (step) {
          const rt = st.steps[step.id];
          if (!rt || !step.task || step.task.kind === 'read') return;
          if (rt.status !== 'open') return;
          const stage = effectiveStage(lesson, st.position);
          const entry = rt.entrySpecKey ?? entryKey(stage?.kind === 'spec' ? stage.spec : undefined);
          const progress = applyTaskEvent(step.task, rt.progress, event, matchContext(entry));
          if (progress !== rt.progress || entry !== rt.entrySpecKey) {
            patchStep(step.id, { progress, entrySpecKey: entry });
          }
          if (progress.done && !rt.progress.done) finishStep(step, rt.solving ? 'shown' : 'done');
          return;
        }
        const ch = challengeAt(st.position);
        if (ch) {
          const rt = st.challenges[ch.id];
          const task = challengeAsTask(ch);
          if (!rt || !task || rt.status !== 'open') return;
          const entry =
            rt.entrySpecKey ??
            entryKey(ch.kind === 'spec-fix' || ch.kind === 'spec-build' ? ch.spec : undefined);
          const progress = applyTaskEvent(task, rt.progress, event, matchContext(entry));
          let facts = rt.facts;
          if (event.type === 'spec') {
            const e = engine();
            facts = {
              spec: e ? e.normalizeSpec(event.spec).spec : event.spec,
              lint: { valid: event.valid, codes: event.issueCodes },
              usdPerMonth: event.usdPerMonth,
            };
          }
          if (progress !== rt.progress || facts !== rt.facts || entry !== rt.entrySpecKey) {
            patchChallenge(ch.id, { progress, facts, entrySpecKey: entry });
          }
          if (progress.done && !rt.progress.done) solveChallenge(ch, rt.solving ? 'shown' : null);
        }
      },

      confirm() {
        const st = get();
        const step = stepAt(st.position);
        if (!step?.task) return;
        const rt = st.steps[step.id];
        if (rt?.status !== 'open') return;
        const progress = confirmTask(step.task, rt.progress);
        if (progress !== rt.progress) {
          patchStep(step.id, { progress });
          if (progress.done) finishStep(step, 'done');
        }
      },

      openHint() {
        const st = get();
        const step = stepAt(st.position);
        if (step) {
          patchStep(step.id, { hintOpen: true, stuck: true });
          return;
        }
        const ch = challengeAt(st.position);
        if (ch) patchChallenge(ch.id, { hintOpen: true, stuck: true });
      },

      markStuck() {
        const st = get();
        const step = stepAt(st.position);
        if (step) {
          if (st.steps[step.id]?.status === 'open') patchStep(step.id, { stuck: true });
          return;
        }
        const ch = challengeAt(st.position);
        if (ch && st.challenges[ch.id]?.status === 'open') patchChallenge(ch.id, { stuck: true });
      },

      registerSolver(solve) {
        solver = solve;
      },

      showMe() {
        const st = get();
        const e = engine();
        const step = stepAt(st.position);
        if (step?.task && step.task.kind !== 'read') {
          const rt = st.steps[step.id];
          if (rt?.status !== 'open' || rt.solving) return;
          const task = step.task;
          patchStep(step.id, { solving: true, hintOpen: true, stuck: true });
          const done = () => {
            const cur = get().steps[step.id];
            if (cur && cur.status === 'open') {
              patchStep(step.id, { progress: { ...cur.progress, done: true } });
              finishStep(step, 'shown');
            }
          };
          if (solver) {
            perform(task, rt.progress, done, 'Showing you how. Continue is available when it finishes.');
            return;
          }
          if (task.kind === 'spec' && e) {
            const stage = effectiveStage(lesson, st.position);
            if (stage?.kind === 'spec') {
              const start = buildSpec(e, stage.spec);
              const solved = applySolution(e, start, task.solution);
              set({
                stageOverride: {
                  position: st.position,
                  stage: { ...stage, spec: solved as unknown as typeof stage.spec, reset: true },
                  nonce: get().stageNonce + 1,
                },
                stageNonce: get().stageNonce + 1,
              });
            }
          }
          done();
          return;
        }
        const ch = challengeAt(st.position);
        if (ch) {
          const rt = st.challenges[ch.id];
          if (rt?.status !== 'open' || rt.solving) return;
          patchChallenge(ch.id, { solving: true, hintOpen: true, stuck: true });
          const task = challengeAsTask(ch);
          if (task && solver) {
            perform(
              task,
              rt.progress,
              () => solveChallenge(ch, 'shown'),
              'Showing you how. The result appears when it finishes.',
            );
            return;
          }
          if (task?.kind === 'spec' && e && (ch.kind === 'spec-fix' || ch.kind === 'spec-build')) {
            const start = buildSpec(e, ch.spec);
            const solved = applySolution(e, start, (ch as SpecFixChallenge | SpecBuildChallenge).solution);
            const base = challengeStage(ch);
            if (base?.kind === 'spec') {
              set({
                stageOverride: {
                  position: st.position,
                  stage: { ...base, spec: solved as unknown as typeof base.spec, reset: true },
                  nonce: get().stageNonce + 1,
                },
                stageNonce: get().stageNonce + 1,
              });
            }
          }
          solveChallenge(ch, 'shown');
        }
      },

      skip() {
        const st = get();
        const step = stepAt(st.position);
        if (step?.task && step.task.kind !== 'read') {
          const rt = st.steps[step.id];
          if (rt?.status !== 'open') return;
          patchStep(step.id, { status: 'skipped', solving: false, hintOpen: rt.hintOpen });
          cancelSolve?.();
          cancelSolve = null;
          learner.markAssist(lesson.id, step.id, 'skipped');
          env.announce('Skipped. Continue is available.');
          return;
        }
        const ch = challengeAt(st.position);
        if (ch) solveChallenge(ch, 'skipped');
      },

      answerChoice(id) {
        const ch = challengeAt(get().position);
        if (ch?.kind !== 'choice') return;
        const rt = get().challenges[ch.id];
        if (rt?.status !== 'open' || id === null) return;
        if (gradeChoice(ch, id)) solveChallenge(ch, null);
        else
          patchChallenge(ch.id, {
            attempts: rt.attempts + 1,
            lastWrong: { kind: 'choice', picked: id },
            stuck: true,
          });
      },

      answerMulti(ids) {
        const ch = challengeAt(get().position);
        if (ch?.kind !== 'multi') return;
        const rt = get().challenges[ch.id];
        if (rt?.status !== 'open') return;
        const verdict = gradeMulti(ch, ids);
        if (verdict.correct) solveChallenge(ch, null);
        else
          patchChallenge(ch.id, {
            attempts: rt.attempts + 1,
            lastWrong: { kind: 'multi', verdict },
            stuck: true,
          });
      },

      answerOrder(ids) {
        const ch = challengeAt(get().position);
        if (ch?.kind !== 'order') return;
        const rt = get().challenges[ch.id];
        if (rt?.status !== 'open') return;
        const verdict = gradeOrder(ch, ids);
        if (verdict.correct) solveChallenge(ch, null);
        else
          patchChallenge(ch.id, {
            attempts: rt.attempts + 1,
            lastWrong: { kind: 'order', verdict },
            stuck: true,
          });
      },

      answerMatch(assignment) {
        const ch = challengeAt(get().position);
        if (ch?.kind !== 'match') return;
        const rt = get().challenges[ch.id];
        if (rt?.status !== 'open') return;
        const verdict = gradeMatch(ch, assignment);
        if (verdict.correct) solveChallenge(ch, null);
        else
          patchChallenge(ch.id, {
            attempts: rt.attempts + 1,
            lastWrong: { kind: 'match', verdict },
            stuck: true,
          });
      },

      answerEstimate(value) {
        const ch = challengeAt(get().position);
        if (ch?.kind !== 'estimate' || value === null) return;
        const rt = get().challenges[ch.id];
        const e = engine();
        if (rt?.status !== 'open' || !e) return;
        // Always the baked rate card, never `env.pricing()`: the lesson text, the explains and FACTS quote
        // "the rates read on <date>", and the spec stage prices on the same card, so an answer the lesson
        // teaches has to stay right when the live rates move.
        const truth = estimateTruth(ch as EstimateChallenge, e);
        if (truth === null) return;
        const verdict = gradeEstimate(ch, value, truth);
        if (verdict.correct) solveChallenge(ch, null);
        else
          patchChallenge(ch.id, {
            attempts: rt.attempts + 1,
            lastWrong: { kind: 'estimate', verdict, answer: value },
            stuck: true,
          });
      },

      review() {
        set({ completion: null });
        enter(0, -1);
      },

      unlock(id) {
        env.unlock(id);
      },

      destroy() {
        alive = false;
        cancelStuck?.();
        cancelSolve?.();
        cancelStuck = null;
        cancelSolve = null;
        solver = null;
      },
    };
  });

  if (!config.deferBegin) store.getState().begin();
  return store;
}

// ---------------------------------------------------------------------------
// Derived values for the UI (pure over a Player snapshot)
// ---------------------------------------------------------------------------

export interface Segment {
  /** `step:<id>` or `challenge:<id>`. */
  key: string;
  position: number;
  kind: 'step' | 'challenge';
  state: 'done' | 'current' | 'todo' | 'skipped' | 'assisted';
  label: string;
}

export function segmentsOf(lesson: Lesson, state: PlayerState): Segment[] {
  const out: Segment[] = [];
  lesson.steps.forEach((s, i) => {
    const rt = state.steps[s.id];
    const gated = Boolean(s.task && s.task.kind !== 'read');
    let st: Segment['state'] = 'todo';
    if (rt?.status === 'shown') st = 'assisted';
    else if (rt?.status === 'skipped') st = 'skipped';
    else if (rt?.status === 'done') st = 'done';
    else if (!gated && rt?.progress.done) st = 'done';
    if (state.position === i) st = st === 'todo' ? 'current' : st;
    out.push({ key: `step:${s.id}`, position: i, kind: 'step', state: st, label: s.title });
  });
  lesson.checkpoint.forEach((c, i) => {
    const rt = state.challenges[c.id];
    const pos = lesson.steps.length + i;
    let st: Segment['state'] = 'todo';
    if (rt?.status === 'correct') st = 'done';
    else if (rt?.status === 'shown') st = 'assisted';
    else if (rt?.status === 'skipped') st = 'skipped';
    if (state.position === pos && st === 'todo') st = 'current';
    out.push({
      key: `challenge:${c.id}`,
      position: pos,
      kind: 'challenge',
      state: st,
      label: `Checkpoint ${i + 1}`,
    });
  });
  return out;
}

/** Whether Continue is available at the current position. */
export function continueAllowed(lesson: Lesson, state: PlayerState): boolean {
  const layout = layoutOf(lesson);
  if (state.position >= layout.end) return false;
  if (state.position < layout.steps) {
    const step = lesson.steps[state.position];
    if (!step) return false;
    const rt = state.steps[step.id];
    if (!rt) return true;
    return rt.status !== 'open' || taskAllowsContinue(step.task, rt.progress);
  }
  const c = lesson.checkpoint[state.position - layout.steps];
  return c ? state.challenges[c.id]?.status !== 'open' : false;
}

/** The feedback line for the current step's task. */
export function stepFeedback(lesson: Lesson, state: PlayerState): TaskFeedback | null {
  const step = lesson.steps[state.position];
  if (!step?.task) return null;
  const rt = state.steps[step.id];
  if (!rt) return null;
  const stage = effectiveStage(lesson, state.position);
  const labels: Record<string, string> = {};
  if (stage?.kind === 'terminal') for (const g of stage.script.goals) labels[g.id] = g.label;
  return taskFeedback(step.task, rt.progress, labels);
}

/** The checks for a spec challenge's requirement checklist, evaluated against the last reported spec. */
export function requirementStates(
  c: SpecBuildChallenge,
  facts: CheckContext | null,
): { id: string; label: string; pass: boolean | null; message?: string }[] {
  return c.requirements.map((r) => {
    if (!facts) return { id: r.id, label: r.label, pass: null };
    const res = evaluateCheck(r.check, facts);
    return {
      id: r.id,
      label: r.label,
      pass: res.pass,
      message: res.pass ? undefined : res.failed.find((f) => f.message)?.message,
    };
  });
}
