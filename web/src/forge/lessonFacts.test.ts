import { defaultSpec } from '@shared/flux/spec';
import { describe, expect, it } from 'vitest';
import { loadEngine, specFacts } from '@/learn/engine';
import { lessonFacts, type SpecTask, satisfies, solveSpecTask } from './lessonFacts';
import { specFromPartial } from './model';

/**
 * The forge reports what a check reads. It must equal what the lesson validator computes for the same spec,
 * or a check could pass on screen and fail in the content tests (or the other way round).
 */
describe('lessonFacts', () => {
  const cases = [
    ['the default spec', () => defaultSpec()],
    ['a spec with errors', () => ({ ...defaultSpec(), name: 'Zel-Bad_App', instances: 0, owner: 'abc' })],
    [
      'a bigger spec',
      () => {
        const s = defaultSpec();
        const c = s.compose[0];
        return { ...s, instances: 5, compose: [{ ...c!, cpu: 2, ram: 4000, hdd: 40 }] };
      },
    ],
    ['a three month subscription', () => ({ ...defaultSpec(), expire: 264_000 })],
  ] as const;

  for (const [name, make] of cases) {
    it(`matches the validator for ${name}`, async () => {
      const engine = await loadEngine();
      const spec = make();
      const mine = lessonFacts(spec);
      const theirs = specFacts(engine, spec);
      expect(mine.valid).toBe(theirs.lint?.valid);
      expect([...mine.codes].sort()).toEqual([...(theirs.lint?.codes ?? [])].sort());
      expect(mine.usd).toBeCloseTo(theirs.usdPerMonth ?? Number.NaN, 8);
    });
  }
});

describe('solveSpecTask', () => {
  // The shape of a real task: three components, the price must come under a ceiling, and the discount tier
  // depends on the total cores, so one component's edit can stand in the way of the solution.
  const start = specFromPartial({
    name: 'store',
    instances: 3,
    compose: [
      { name: 'web', cpu: 1, ram: 1000, hdd: 5, ports: [31900], containerPorts: [3000] },
      { name: 'api', cpu: 2, ram: 2000, hdd: 10, ports: [], containerPorts: [], domains: [] },
      { name: 'cache', cpu: 0.5, ram: 500, hdd: 1, ports: [], containerPorts: [], domains: [] },
    ],
  });
  const task: SpecTask = {
    kind: 'spec',
    prompt: 'Under the ceiling',
    check: {
      all: [
        { path: 'compose.length', op: 'gte', value: 3 },
        { price: 'max', usd: 5.49 },
      ],
    },
    solution: { compose: [{}, { cpu: 1.4 }, {}] },
  };

  it('the task is one the start spec fails and the solution fixes', () => {
    expect(satisfies(task, start)).toBe(false);
    const solved = solveSpecTask(task, { current: start, entry: start, start });
    expect(solved.passes).toBe(true);
  });

  it("keeps the learner's work when the solution still holds over it", () => {
    const edited = specFromPartial({ ...start, name: 'my-store' });
    const solved = solveSpecTask(task, { current: edited, entry: start, start });
    expect(solved.base).toBe('current');
    expect(solved.from).toBeUndefined();
    expect(solved.spec.name).toBe('my-store');
    expect(solved.passes).toBe(true);
  });

  it("goes back to the spec the step was entered with when the learner's edits stand in the way", () => {
    const c = start.compose[0];
    if (!c) throw new Error('fixture');
    const wrecked = { ...start, compose: [{ ...c, cpu: 8 }, ...start.compose.slice(1)] };
    expect(satisfies(task, wrecked)).toBe(false);
    const solved = solveSpecTask(task, { current: wrecked, entry: start, start });
    expect(solved.base).toBe('entry');
    expect(solved.spec.compose[0]?.cpu).toBe(1);
    expect(solved.passes).toBe(true);
  });

  it('falls back to the stage start when the entry spec cannot be solved either', () => {
    const c = start.compose[0];
    if (!c) throw new Error('fixture');
    const wrecked = { ...start, compose: [{ ...c, cpu: 8 }, ...start.compose.slice(1)] };
    const solved = solveSpecTask(task, { current: wrecked, entry: wrecked, start });
    expect(solved.base).toBe('start');
    expect(solved.passes).toBe(true);
  });

  it('still returns something deterministic when nothing satisfies the check', () => {
    const hopeless: SpecTask = { ...task, check: { price: 'max', usd: 0.01 } };
    const solved = solveSpecTask(hopeless, { current: start, entry: start, start });
    expect(solved.passes).toBe(false);
    expect(solved.base).toBe('entry');
  });
});
