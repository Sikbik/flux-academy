import { LESSONS, type LessonMeta } from '@shared/curriculum';
import * as blocksMod from '@shared/flux/blocks';
import * as lintMod from '@shared/flux/lint';
import * as pricingMod from '@shared/flux/pricing';
import * as specMod from '@shared/flux/spec';
import type { PricingParams } from '@shared/flux/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { conceptLesson, conceptMeta } from './__fixtures__/concept';
import { tourLesson, tourMeta } from './__fixtures__/tour';
import { buildEngine, type LessonEngine } from './engine';
import {
  challengeAsTask,
  challengeStage,
  continueAllowed,
  createPlayer,
  defaultLearnerPort,
  effectiveStage,
  idAtPosition,
  layoutOf,
  type PlayerEnv,
  type PlayerStore,
  positionForId,
  requirementStates,
  SOLVER_AWAIT_MAX_MS,
  SOLVER_GRACE_MAX_MS,
  SOLVER_GRACE_MS,
  SOLVER_GRACE_PER_GOAL_MS,
  STUCK_AFTER_MS,
  segmentsOf,
  solverGraceMs,
  stageIdentity,
  stepFeedback,
} from './player';
import { useLearner } from './store';
import { freshProgress } from './tasks';
import type { Lesson, SpecBuildChallenge, Task } from './types';

const asRecord = (m: unknown) => m as Record<string, unknown>;
const engine: LessonEngine = buildEngine({
  spec: asRecord(specMod),
  pricing: asRecord(pricingMod),
  blocks: asRecord(blocksMod),
  lint: asRecord(lintMod),
  catalogue: asRecord(lintMod),
});

interface Harness {
  store: PlayerStore;
  unlocked: string[];
  announced: string[];
  toasts: string[];
  /** Run every scheduled callback that was not cancelled. */
  flush(): void;
  pending(): number;
  /** The delay of every live scheduled callback. */
  delays(): number[];
}

function harness(
  lesson: Lesson,
  meta: LessonMeta,
  start?: { position?: number; id?: string },
  /** What the environment reports as the live pricing parameters (none: the baked ones). */
  pricing: PlayerEnv['pricing'] = () => undefined,
): Harness {
  const unlocked: string[] = [];
  const announced: string[] = [];
  const toasts: string[] = [];
  let timers: { fn: () => void; ms: number; live: boolean }[] = [];
  const env: PlayerEnv = {
    learner: defaultLearnerPort(),
    unlock: (id) => {
      unlocked.push(id);
    },
    syncTracks: () => [],
    announce: (m) => {
      announced.push(m);
    },
    toast: (m) => {
      toasts.push(m);
    },
    schedule: (fn, ms) => {
      const t = { fn, ms, live: true };
      timers.push(t);
      return () => {
        t.live = false;
      };
    },
    pricing,
  };
  const store = createPlayer({ lesson, meta, engine: () => engine, start }, env);
  return {
    store,
    unlocked,
    announced,
    toasts,
    flush() {
      const run = timers.filter((t) => t.live);
      timers = [];
      for (const t of run) t.fn();
    },
    pending: () => timers.filter((t) => t.live).length,
    delays: () => timers.filter((t) => t.live).map((t) => t.ms),
  };
}

const tour = () => harness(tourLesson, tourMeta);
const stepIndex = (id: string) => tourLesson.steps.findIndex((s) => s.id === id);

beforeEach(() => {
  useLearner.getState().reset();
});

describe('pure helpers', () => {
  it('lays out steps, challenges and the end', () => {
    expect(layoutOf(tourLesson)).toEqual({ steps: 9, challenges: 5, end: 14 });
  });

  it('maps ids and positions both ways', () => {
    expect(positionForId(tourLesson, 'spec')).toBe(3);
    expect(positionForId(tourLesson, 'order-lifecycle')).toBe(9);
    expect(positionForId(tourLesson, 'nope')).toBeNull();
    expect(idAtPosition(tourLesson, 3)).toBe('spec');
    expect(idAtPosition(tourLesson, 9)).toBe('order-lifecycle');
    expect(idAtPosition(tourLesson, 14)).toBeNull();
  });

  it('finds the stage in force and its identity', () => {
    expect(effectiveStage(tourLesson, 0)?.kind).toBe('diagram');
    expect(effectiveStage(tourLesson, stepIndex('place'))?.kind).toBe('diorama');
    const a = effectiveStage(tourLesson, stepIndex('place'));
    const b = effectiveStage(tourLesson, stepIndex('break'));
    expect(a && stageIdentity(a)).toBe('diorama:placement');
    expect(b && stageIdentity(b)).toBe('diorama:failover');
  });

  it('hands out one stage and one task per challenge, so a stage never sees a new object by accident', () => {
    for (const c of tourLesson.checkpoint) {
      expect(challengeStage(c)).toBe(challengeStage(c));
      expect(challengeAsTask(c)).toBe(challengeAsTask(c));
    }
    const fix = tourLesson.checkpoint.find((c) => c.id === 'fix-ports');
    expect(fix && challengeStage(fix)).toMatchObject({ kind: 'spec' });
  });

  it('turns spec and terminal challenges into tasks for their stages', () => {
    const fix = tourLesson.checkpoint.find((c) => c.id === 'fix-ports');
    const build = tourLesson.checkpoint.find((c) => c.id === 'build-budget');
    const term = tourLesson.checkpoint.find((c) => c.id === 'terminal-images');
    const order = tourLesson.checkpoint.find((c) => c.id === 'order-lifecycle');
    expect(fix && challengeAsTask(fix)?.kind).toBe('spec');
    const bt = build && challengeAsTask(build);
    expect(bt?.kind).toBe('spec');
    if (bt?.kind === 'spec') expect('all' in bt.check && bt.check.all).toHaveLength(4);
    expect(term && challengeAsTask(term)).toMatchObject({ kind: 'terminal', goals: ['list'] });
    expect(order && challengeAsTask(order)).toBeUndefined();
  });
});

describe('starting', () => {
  it('records the lesson, unlocks first light and begins at the first step', () => {
    const h = tour();
    const s = h.store.getState();
    expect(s.position).toBe(0);
    expect(useLearner.getState().lessons['fixture-tour']).toBeTruthy();
    expect(h.unlocked).toContain('first-light');
  });

  it('resumes at the saved position', () => {
    useLearner.getState().startLesson('fixture-tour');
    useLearner.getState().setStep('fixture-tour', 4);
    const h = tour();
    expect(h.store.getState().position).toBe(4);
  });

  it('starts at a deep-linked step id', () => {
    const h = harness(tourLesson, tourMeta, { id: 'place' });
    expect(h.store.getState().position).toBe(stepIndex('place'));
  });

  it('starts a finished lesson again from the first step', () => {
    useLearner.getState().startLesson('fixture-tour');
    useLearner.getState().setStep('fixture-tour', layoutOf(tourLesson).end);
    const h = tour();
    expect(h.store.getState().position).toBe(0);
    expect(h.store.getState().completion).toBeNull();
  });

  it('clamps a stale resume point', () => {
    useLearner.getState().startLesson('fixture-tour');
    useLearner.getState().setStep('fixture-tour', 99);
    const h = tour();
    expect(h.store.getState().position).toBeLessThanOrEqual(layoutOf(tourLesson).end);
  });

  it('persists the position on every move', () => {
    const h = tour();
    h.store.getState().next();
    expect(useLearner.getState().lessons['fixture-tour']?.step).toBe(1);
  });
});

describe('gating and task matching', () => {
  it('lets a read step continue and marks it done', () => {
    const h = tour();
    expect(h.store.getState().next()).toBe(true);
    expect(h.store.getState().position).toBe(1);
    expect(useLearner.getState().lessons['fixture-tour']?.stepsDone).toContain('layers');
  });

  it('blocks Continue until the terminal goals are done, with specific progress', () => {
    const h = harness(tourLesson, tourMeta, { id: 'build' });
    const s = () => h.store.getState();
    expect(s().next()).toBe(false);
    s().emit({ type: 'terminal-goal', goalId: 'build' });
    expect(s().next()).toBe(false);
    const fb = stepFeedback(tourLesson, s());
    expect(fb?.lines[0]).toContain('1 of 2 goals done');
    expect(fb?.lines[0]).toContain('Push the image');
    s().emit({ type: 'terminal-goal', goalId: 'push' });
    expect(s().steps.build?.status).toBe('done');
    expect(s().next()).toBe(true);
  });

  it('counts a failing spec as an attempt, explains it, and passes on the fix', () => {
    const h = harness(tourLesson, tourMeta, { id: 'spec' });
    const s = () => h.store.getState();
    const specEvent = (containerPort: number) => ({
      type: 'spec' as const,
      spec: {
        name: 'hello-tour',
        instances: 3,
        compose: [{ name: 'web', repotag: 'me/hello:1.0', ports: [31001], containerPorts: [containerPort] }],
      },
      valid: true,
      issueCodes: [],
      usdPerMonth: 0.99,
    });
    s().emit(specEvent(80)); // the untouched spec: not an attempt
    expect(s().steps.spec?.progress.attempts).toBe(0);
    s().emit(specEvent(8080));
    expect(s().steps.spec?.progress.attempts).toBe(1);
    expect(stepFeedback(tourLesson, s())?.lines[0]).toContain('listens on');
    expect(s().next()).toBe(false);
    s().emit(specEvent(3000));
    expect(s().steps.spec?.status).toBe('done');
    expect(s().next()).toBe(true);
  });

  it('places instances with min, and reports the value', () => {
    const h = harness(tourLesson, tourMeta, { id: 'place' });
    const s = () => h.store.getState();
    s().emit({ type: 'instances', value: 2 });
    expect(stepFeedback(tourLesson, s())?.lines[0]).toBe('That is 2. You need at least 3.');
    expect(s().steps.place?.progress.attempts).toBe(1);
    s().emit({ type: 'instances', value: 3 });
    expect(s().steps.place?.status).toBe('done');
    expect(h.unlocked).toContain('three-is-company');
  });

  it('counts kills from the stage and unlocks first blood in a failover scene', () => {
    const h = harness(tourLesson, tourMeta, { id: 'break' });
    h.store.getState().emit({ type: 'node-killed', count: 1 });
    expect(h.store.getState().steps.break?.status).toBe('done');
    expect(h.unlocked).toContain('first-blood');
  });

  it('ignores events for a different task kind', () => {
    const h = harness(tourLesson, tourMeta, { id: 'place' });
    h.store.getState().emit({ type: 'terminal-goal', goalId: 'build' });
    h.store.getState().emit({ type: 'widget-done' });
    expect(h.store.getState().steps.place?.status).toBe('open');
  });

  it('confirms an honour-system task', () => {
    const h = harness(tourLesson, tourMeta, { id: 'bind' });
    expect(h.store.getState().next()).toBe(false);
    h.store.getState().confirm();
    expect(h.store.getState().next()).toBe(true);
  });

  it('a widget task waits for widget-done', () => {
    const h = harness(tourLesson, tourMeta, { id: 'register' });
    expect(h.store.getState().next()).toBe(false);
    h.store.getState().emit({ type: 'widget-done' });
    expect(h.store.getState().steps.register?.status).toBe('done');
  });

  it('latches done: later events do not undo it', () => {
    const h = harness(tourLesson, tourMeta, { id: 'place' });
    h.store.getState().emit({ type: 'instances', value: 4 });
    h.store.getState().emit({ type: 'instances', value: 1 });
    expect(h.store.getState().steps.place?.status).toBe('done');
  });
});

describe('solverGraceMs', () => {
  const terminal: Task = { kind: 'terminal', goals: ['build', 'push'], prompt: 'Ship it.' };

  it('is the short grace for every task but a terminal one', () => {
    expect(solverGraceMs({ kind: 'set-instances', min: 3, prompt: 'Place three.' }, freshProgress())).toBe(
      SOLVER_GRACE_MS,
    );
    expect(solverGraceMs(undefined, null)).toBe(SOLVER_GRACE_MS);
  });

  it('adds time for each terminal goal still open, up to a cap', () => {
    const p = freshProgress();
    expect(solverGraceMs(terminal, p)).toBe(SOLVER_GRACE_MS + 2 * SOLVER_GRACE_PER_GOAL_MS);
    expect(solverGraceMs(terminal, { ...p, goals: ['build'] })).toBe(
      SOLVER_GRACE_MS + SOLVER_GRACE_PER_GOAL_MS,
    );
    expect(solverGraceMs(terminal, { ...p, goals: ['build', 'push'] })).toBe(SOLVER_GRACE_MS);
    const many: Task = {
      kind: 'terminal',
      goals: Array.from({ length: 12 }, (_, i) => `g${i}`),
      prompt: 'Run them all.',
    };
    expect(solverGraceMs(many, p)).toBe(SOLVER_GRACE_MAX_MS);
  });
});

describe('Show me and Skip', () => {
  it('uses the stage solver, marks the step shown and records the assist', () => {
    const h = harness(tourLesson, tourMeta, { id: 'place' });
    let called = 0;
    h.store.getState().registerSolver(() => {
      called += 1;
      h.store.getState().emit({ type: 'instances', value: 3 });
    });
    h.store.getState().showMe();
    expect(called).toBe(1);
    expect(h.store.getState().steps.place?.status).toBe('shown');
    expect(useLearner.getState().lessons['fixture-tour']?.assists?.place).toBe('shown');
    expect(useLearner.getState().lessons['fixture-tour']?.stepsDone).toContain('place');
  });

  it('finishes the task itself when the solver does nothing', () => {
    const h = harness(tourLesson, tourMeta, { id: 'place' });
    h.store.getState().registerSolver(() => {});
    h.store.getState().showMe();
    expect(h.store.getState().steps.place?.status).toBe('open');
    h.flush(); // the grace timer
    expect(h.store.getState().steps.place?.status).toBe('shown');
    expect(SOLVER_GRACE_MS).toBeGreaterThan(0);
  });

  it('ignores a second Show me while the first is still being performed', () => {
    const h = harness(tourLesson, tourMeta, { id: 'place' });
    let called = 0;
    h.store.getState().registerSolver(() => {
      called += 1;
    });
    h.store.getState().showMe();
    h.store.getState().showMe();
    expect(called).toBe(1);
    expect(h.store.getState().steps.place?.solving).toBe(true);
  });

  it('waits longer for a terminal solver, and announces that it is showing', () => {
    const h = harness(tourLesson, tourMeta, { id: 'build' });
    h.store.getState().registerSolver(() => {});
    h.store.getState().showMe();
    expect(h.delays()).toContain(SOLVER_GRACE_MS + 2 * SOLVER_GRACE_PER_GOAL_MS);
    expect(h.announced.some((m) => m.startsWith('Showing you how'))).toBe(true);
    // The terminal reports its goals as it types: the task finishes on the last one, before the grace ends.
    h.store.getState().emit({ type: 'terminal-goal', goalId: 'build' });
    expect(h.store.getState().steps.build?.status).toBe('open');
    h.store.getState().emit({ type: 'terminal-goal', goalId: 'push' });
    expect(h.store.getState().steps.build?.status).toBe('shown');
    expect(h.store.getState().steps.build?.solving).toBe(false);
  });

  it('Skip while Show me is being performed ends it and awards nothing', () => {
    const h = harness(tourLesson, tourMeta, { id: 'build' });
    h.store.getState().registerSolver(() => {});
    h.store.getState().showMe();
    h.store.getState().skip();
    expect(h.store.getState().steps.build?.status).toBe('skipped');
    expect(h.store.getState().steps.build?.solving).toBe(false);
    h.flush();
    expect(h.store.getState().steps.build?.status).toBe('skipped');
  });

  it('re-seeds a spec editor with the solution when no solver is registered', () => {
    const h = harness(tourLesson, tourMeta, { id: 'spec' });
    h.store.getState().showMe();
    const s = h.store.getState();
    expect(s.steps.spec?.status).toBe('shown');
    expect(s.stageOverride?.stage.kind).toBe('spec');
    const stage = s.stageOverride?.stage as { spec: { compose: { containerPorts: number[] }[] } } | undefined;
    expect(stage?.spec.compose[0]?.containerPorts).toEqual([3000]);
  });

  it('skip allows Continue and records the assist without marking the step done', () => {
    const h = harness(tourLesson, tourMeta, { id: 'place' });
    h.store.getState().skip();
    expect(h.store.getState().steps.place?.status).toBe('skipped');
    expect(h.store.getState().next()).toBe(true);
    const lp = useLearner.getState().lessons['fixture-tour'];
    expect(lp?.assists?.place).toBe('skipped');
    expect(lp?.stepsDone).not.toContain('place');
  });

  it('offers help after the idle timer, a hint or an attempt', () => {
    const h = harness(tourLesson, tourMeta, { id: 'place' });
    expect(h.store.getState().steps.place?.stuck).toBe(false);
    expect(h.pending()).toBe(1);
    h.flush();
    expect(h.store.getState().steps.place?.stuck).toBe(true);
    expect(STUCK_AFTER_MS).toBeGreaterThan(1000);
  });
});

describe('a solver that returns a promise', () => {
  /** A promise the test settles by hand. */
  function deferred() {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
  const widgetStep = () => harness(tourLesson, tourMeta, { id: 'register' });

  it('is awaited: the short grace is not scheduled and the task stays open while it performs', async () => {
    const h = widgetStep();
    const d = deferred();
    h.store.getState().registerSolver(() => d.promise);
    h.store.getState().showMe();
    expect(h.store.getState().steps.register?.solving).toBe(true);
    expect(h.delays()).not.toContain(SOLVER_GRACE_MS);
    expect(h.delays()).toContain(SOLVER_AWAIT_MAX_MS);
    expect(h.announced.some((m) => m.startsWith('Showing you how'))).toBe(true);
    await Promise.resolve();
    expect(h.store.getState().steps.register?.status).toBe('open');
    d.resolve();
    await d.promise;
    expect(h.store.getState().steps.register?.status).toBe('shown');
    expect(h.store.getState().steps.register?.solving).toBe(false);
    expect(useLearner.getState().lessons['fixture-tour']?.assists?.register).toBe('shown');
    // The cap timer was cancelled with the wait: running whatever is left changes nothing.
    h.flush();
    expect(h.store.getState().steps.register?.status).toBe('shown');
  });

  it('is capped: the task completes when the wait runs out', () => {
    const h = widgetStep();
    h.store.getState().registerSolver(() => new Promise<void>(() => {}));
    h.store.getState().showMe();
    expect(SOLVER_AWAIT_MAX_MS).toBe(30_000);
    expect(h.store.getState().steps.register?.status).toBe('open');
    h.flush();
    expect(h.store.getState().steps.register?.status).toBe('shown');
  });

  it('counts a rejection as the end of the performance', async () => {
    const h = widgetStep();
    const d = deferred();
    h.store.getState().registerSolver(() => d.promise);
    h.store.getState().showMe();
    d.reject(new Error('the walk gave up'));
    await d.promise.catch(() => {});
    expect(h.store.getState().steps.register?.status).toBe('shown');
  });

  it('ends at once when the stage reports the task done while it performs', async () => {
    const h = widgetStep();
    const d = deferred();
    h.store.getState().registerSolver(() => d.promise);
    h.store.getState().showMe();
    h.store.getState().emit({ type: 'widget-done' });
    expect(h.store.getState().steps.register?.status).toBe('shown');
    // The promise settling afterwards finds nothing left to do.
    d.resolve();
    await d.promise;
    h.flush();
    expect(h.store.getState().steps.register?.status).toBe('shown');
    expect(useLearner.getState().lessons['fixture-tour']?.stepsDone.filter((s) => s === 'register')).toEqual([
      'register',
    ]);
  });

  it('is abandoned when the learner skips', async () => {
    const h = widgetStep();
    const d = deferred();
    h.store.getState().registerSolver(() => d.promise);
    h.store.getState().showMe();
    h.store.getState().skip();
    expect(h.store.getState().steps.register?.status).toBe('skipped');
    d.resolve();
    await d.promise;
    h.flush();
    expect(h.store.getState().steps.register?.status).toBe('skipped');
  });

  it('is abandoned when the learner leaves the step', async () => {
    const h = widgetStep();
    const d = deferred();
    h.store.getState().registerSolver(() => d.promise);
    h.store.getState().showMe();
    h.store.getState().prev();
    d.resolve();
    await d.promise;
    h.flush();
    expect(h.store.getState().steps.register?.status).toBe('open');
  });

  it('keeps the short grace for a solver that returns nothing', () => {
    const h = widgetStep();
    h.store.getState().registerSolver(() => {});
    h.store.getState().showMe();
    expect(h.delays()).toContain(SOLVER_GRACE_MS);
    expect(h.delays()).not.toContain(SOLVER_AWAIT_MAX_MS);
  });

  it('is awaited for a checkpoint challenge too', async () => {
    const h = harness(tourLesson, tourMeta, { id: 'fix-ports' });
    const d = deferred();
    h.store.getState().registerSolver(() => d.promise);
    h.store.getState().showMe();
    expect(h.store.getState().challenges['fix-ports']?.solving).toBe(true);
    expect(h.delays()).toContain(SOLVER_AWAIT_MAX_MS);
    expect(h.store.getState().challenges['fix-ports']?.status).toBe('open');
    d.resolve();
    await d.promise;
    expect(h.store.getState().challenges['fix-ports']?.status).toBe('shown');
    expect(h.announced.some((m) => m.startsWith('Showing you how'))).toBe(true);
  });
});

describe('estimate grading is on the baked rate card', () => {
  const baked = pricingMod.BAKED_PRICING;
  // The live rates have moved well past the tolerance since the card was read: every resource is dearer.
  const live: PricingParams = {
    ...baked.params,
    cpu: baked.params.cpu * 2,
    ram: baked.params.ram * 2,
    hdd: baked.params.hdd * 2,
  };
  const found = tourLesson.checkpoint.find((c) => c.id === 'estimate-price');
  if (found?.kind !== 'estimate') throw new Error('the tour fixture has no estimate challenge');
  const challenge = found;
  // Worked out here, from the card itself, so the tests do not lean on the code that grades.
  const priceAt = (params: PricingParams) =>
    pricingMod.quoteLoose(challenge.spec, params, { fluxUsd: baked.fluxUsd, months: 1 }).usdPerMonth;
  const at = (liveParams: () => PricingParams | undefined) =>
    harness(tourLesson, tourMeta, { id: 'estimate-price' }, liveParams);

  it('has live rates that differ from the card by more than the tolerance', () => {
    const slack = priceAt(baked.params) * challenge.tolerance;
    expect(Math.abs(priceAt(live) - priceAt(baked.params))).toBeGreaterThan(slack);
  });

  it('accepts an answer worked out from BAKED_PRICING even when the live parameters differ', () => {
    const h = at(() => live);
    h.store.getState().answerEstimate(priceAt(baked.params));
    expect(h.store.getState().challenges['estimate-price']?.status).toBe('correct');
  });

  it('does not accept an answer that is right only at the live rates', () => {
    const h = at(() => live);
    h.store.getState().answerEstimate(priceAt(live));
    const rt = h.store.getState().challenges['estimate-price'];
    expect(rt?.status).toBe('open');
    // And what it grades against is the card, not the rates it was shown.
    expect(rt?.lastWrong).toMatchObject({ kind: 'estimate' });
    const verdict = rt?.lastWrong?.kind === 'estimate' ? rt.lastWrong.verdict : null;
    expect(verdict?.truth).toBeCloseTo(priceAt(baked.params), 6);
  });

  it('grades the same with no live parameters at all', () => {
    const h = at(() => undefined);
    h.store.getState().answerEstimate(priceAt(baked.params));
    expect(h.store.getState().challenges['estimate-price']?.status).toBe('correct');
  });
});

describe('checkpoint', () => {
  const at = (id: string) => harness(tourLesson, tourMeta, { id });
  const conceptAt = (id: string) => harness(conceptLesson, conceptMeta, { id });

  it('choice: a wrong answer keeps it open and teaches, a right one awards XP', () => {
    const h = conceptAt('blocks-time');
    const s = () => h.store.getState();
    s().answerChoice('a');
    expect(s().challenges['blocks-time']?.status).toBe('open');
    expect(s().challenges['blocks-time']?.attempts).toBe(1);
    expect(s().challenges['blocks-time']?.lastWrong).toMatchObject({ kind: 'choice', picked: 'a' });
    s().answerChoice('b');
    expect(s().challenges['blocks-time']?.status).toBe('correct');
    expect(useLearner.getState().lessons['fixture-concept']?.challenges['blocks-time']).toBe(10);
    expect(useLearner.getState().xp).toBe(10);
    expect(s().sessionChallengeXp).toBe(10);
  });

  it('multi, order and match grade through the same path', () => {
    const h = conceptAt('tier-members');
    const s = () => h.store.getState();
    s().answerMulti(['cumulus', 'cirrus']);
    expect(s().challenges['tier-members']?.lastWrong).toMatchObject({ kind: 'multi' });
    s().answerMulti(['cumulus', 'nimbus', 'stratus']);
    expect(s().challenges['tier-members']?.status).toBe('correct');
    s().next();
    s().answerOrder(['nimbus', 'cumulus', 'stratus']);
    expect(s().challenges['tier-order']?.lastWrong).toMatchObject({ kind: 'order' });
    s().answerOrder(['cumulus', 'nimbus', 'stratus']);
    expect(s().challenges['tier-order']?.status).toBe('correct');
    s().next();
    s().answerMatch({ cumulus: 'nimbus', nimbus: 'cumulus', stratus: 'stratus' });
    expect(s().challenges['tier-match']?.status).toBe('open');
    s().answerMatch({ cumulus: 'cumulus', nimbus: 'nimbus', stratus: 'stratus' });
    expect(s().challenges['tier-match']?.status).toBe('correct');
  });

  it('estimate accepts a price within tolerance', () => {
    const h = at('estimate-price');
    const s = () => h.store.getState();
    s().answerEstimate(50);
    expect(s().challenges['estimate-price']?.status).toBe('open');
    const verdict = s().challenges['estimate-price']?.lastWrong;
    expect(verdict && verdict.kind === 'estimate' && verdict.verdict.truth).toBeGreaterThan(0);
    const truth = verdict && verdict.kind === 'estimate' ? verdict.verdict.truth : 0;
    s().answerEstimate(truth);
    expect(s().challenges['estimate-price']?.status).toBe('correct');
  });

  it('a spec-fix challenge is solved by spec events and gives half XP after Show me', () => {
    const h = at('fix-ports');
    const s = () => h.store.getState();
    s().emit({
      type: 'spec',
      spec: { name: 'flux-hello', compose: [{ name: 'my-app', ports: [22], containerPorts: [3000] }] },
      valid: false,
      issueCodes: ['NAME_RESERVED_PREFIX', 'PORT_BANNED'],
      usdPerMonth: 0.99,
    });
    expect(s().challenges['fix-ports']?.status).toBe('open');
    s().showMe();
    expect(s().challenges['fix-ports']?.status).toBe('shown');
    expect(useLearner.getState().lessons['fixture-tour']?.challenges['fix-ports']).toBe(5);
    expect(s().stageOverride?.stage.kind).toBe('spec');
  });

  it('a spec-build challenge exposes a live requirement checklist', () => {
    const h = at('build-budget');
    const s = () => h.store.getState();
    s().emit({
      type: 'spec',
      spec: { name: 'budget-api', instances: 3, compose: [{ name: 'app', cpu: 0.1, ram: 100, hdd: 1 }] },
      valid: true,
      issueCodes: [],
      usdPerMonth: 0.99,
    });
    const c = tourLesson.checkpoint.find((x) => x.id === 'build-budget') as SpecBuildChallenge;
    const states = requirementStates(c, s().challenges['build-budget']?.facts ?? null);
    expect(states.map((r) => [r.id, r.pass])).toEqual([
      ['copies', true],
      ['cpu', false],
      ['price', true],
      ['valid', true],
    ]);
    expect(s().challenges['build-budget']?.status).toBe('open');
    s().emit({
      type: 'spec',
      spec: { name: 'budget-api', instances: 3, compose: [{ name: 'app', cpu: 0.5, ram: 500, hdd: 1 }] },
      valid: true,
      issueCodes: [],
      usdPerMonth: 0.99,
    });
    expect(s().challenges['build-budget']?.status).toBe('correct');
  });

  it('a terminal challenge completes on its goal and unlocks shell shocked', () => {
    const h = at('terminal-images');
    h.store.getState().emit({ type: 'terminal-goal', goalId: 'list' });
    expect(h.store.getState().challenges['terminal-images']?.status).toBe('correct');
    expect(h.unlocked).toContain('shell-shocked');
  });

  it('skipping a challenge earns nothing but lets the learner continue', () => {
    const h = conceptAt('blocks-time');
    h.store.getState().skip();
    expect(h.store.getState().challenges['blocks-time']?.status).toBe('skipped');
    expect(useLearner.getState().lessons['fixture-concept']?.challenges['blocks-time']).toBe(0);
    expect(h.store.getState().next()).toBe(true);
  });

  it('Show me on a choice reveals the answer for half XP', () => {
    const h = conceptAt('blocks-time');
    h.store.getState().showMe();
    expect(h.store.getState().challenges['blocks-time']?.status).toBe('shown');
    expect(useLearner.getState().lessons['fixture-concept']?.challenges['blocks-time']).toBe(5);
  });

  it('does not double award a challenge on replay', () => {
    const first = conceptAt('blocks-time');
    first.store.getState().answerChoice('b');
    const again = conceptAt('blocks-time');
    expect(again.store.getState().challenges['blocks-time']?.alreadyEarned).toBe(true);
    again.store.getState().next();
    expect(useLearner.getState().xp).toBe(10);
  });
});

describe('completion', () => {
  function solveConcept(h: Harness) {
    const s = () => h.store.getState();
    s().answerChoice('b');
    s().next();
    s().answerMulti(['cumulus', 'nimbus', 'stratus']);
    s().next();
    s().answerOrder(['cumulus', 'nimbus', 'stratus']);
    s().next();
    s().answerMatch({ cumulus: 'cumulus', nimbus: 'nimbus', stratus: 'stratus' });
    s().next();
  }

  it('awards lesson and challenge XP once and reports the summary', () => {
    const h = harness(conceptLesson, conceptMeta, { position: 4 });
    solveConcept(h);
    const s = h.store.getState();
    expect(s.position).toBe(layoutOf(conceptLesson).end);
    // minutes 4 -> 40 base, but the two confirm tasks were never done here, so none of it is earned.
    expect(s.completion).toMatchObject({ lessonBase: 40, lessonXp: 0, challengeXp: 40, total: 40 });
    expect(useLearner.getState().xp).toBe(40);
    expect(useLearner.getState().lessons['fixture-concept']?.completedAt).toBeTruthy();
    // Each solved challenge says what it earned; the lesson earned nothing here, so it does not toast.
    expect(h.toasts.filter((t) => t === '+10 XP')).toHaveLength(4);
    expect(h.toasts.some((t) => t.startsWith('Lesson complete'))).toBe(false);
  });

  it('earns the full lesson XP when every task was done, and half for Show me', () => {
    const h = harness(conceptLesson, conceptMeta);
    const s = () => h.store.getState();
    s().next(); // tiers: read
    s().confirm(); // blocks: confirm task
    s().next();
    s().next(); // collateral: read
    s().skip(); // placement: skipped
    s().next();
    solveConcept(h);
    // two gated tasks: one done (20), one skipped (0)
    expect(s().completion?.lessonBase).toBe(40);
    expect(s().completion?.lessonXp).toBe(20);
    expect(s().completion?.skipped).toBe(1);
    expect(s().completion?.total).toBe(60);
    expect(h.toasts).toContain('Lesson complete, +20 XP');
  });

  it('does not award again when the lesson is already complete', () => {
    const h = harness(conceptLesson, conceptMeta, { position: 4 });
    solveConcept(h);
    const xp = useLearner.getState().xp;
    // Resuming restarts a finished lesson, so jump to the end explicitly (a deep link to the end).
    const again = harness(conceptLesson, conceptMeta, { position: layoutOf(conceptLesson).end });
    expect(again.store.getState().position).toBe(layoutOf(conceptLesson).end);
    expect(again.store.getState().completion?.alreadyCompleted).toBe(true);
    expect(again.store.getState().completion?.total).toBe(0);
    expect(useLearner.getState().xp).toBe(xp);
  });

  it('jumping to the end lands on the first unsolved challenge', () => {
    const h = harness(conceptLesson, conceptMeta, { position: 0 });
    h.store.getState().go(99);
    expect(h.store.getState().position).toBe(layoutOf(conceptLesson).steps);
    expect(h.store.getState().completion).toBeNull();
  });

  it('reports a rank up when the lesson finishes a track', () => {
    const cumulus = LESSONS.filter((l) => l.track === 'cumulus');
    const last = cumulus[cumulus.length - 1];
    if (!last) throw new Error('no cumulus lessons');
    for (const l of cumulus) {
      if (l.id === last.id) continue;
      useLearner.getState().startLesson(l.id);
      useLearner.getState().completeLesson(l.id);
    }
    const lesson: Lesson = { ...structuredClone(conceptLesson), id: last.id };
    const h = harness(lesson, last, { position: 4 });
    solveConcept(h);
    const c = h.store.getState().completion;
    expect(c?.trackCompleted).toBe('cumulus');
    expect(c?.rankedUpFrom).toBe('Initiate');
    expect(c?.rankAfter).toBe('Cumulus Operator');
    expect(h.toasts).toContain('Rank up: Cumulus Operator');
  });

  it('review returns to the first step', () => {
    const h = harness(conceptLesson, conceptMeta, { position: 4 });
    solveConcept(h);
    h.store.getState().review();
    expect(h.store.getState().position).toBe(0);
    expect(h.store.getState().completion).toBeNull();
  });
});

describe('view helpers', () => {
  it('reports segment states for the rail', () => {
    const h = harness(conceptLesson, conceptMeta);
    const s = h.store.getState();
    const segs = segmentsOf(conceptLesson, s);
    expect(segs).toHaveLength(conceptLesson.steps.length + conceptLesson.checkpoint.length);
    expect(segs[0]?.state).toBe('current');
    expect(segs[1]?.state).toBe('todo');
  });

  it('reports whether Continue is allowed', () => {
    const h = harness(conceptLesson, conceptMeta, { id: 'blocks' });
    expect(continueAllowed(conceptLesson, h.store.getState())).toBe(false);
    h.store.getState().confirm();
    expect(continueAllowed(conceptLesson, h.store.getState())).toBe(true);
  });
});
