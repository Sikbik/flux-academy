import { defaultComponent, defaultSpec } from '@shared/flux/spec';
import type { FluxAppSpec } from '@shared/flux/types';
import { describe, expect, it } from 'vitest';
import { AchievementTracker, type Observation } from './achievements';

type Over = Omit<Partial<Observation>, 'spec'> & { spec?: Partial<FluxAppSpec> };

function obs(over: Over): Observation {
  const { spec, ...rest } = over;
  return {
    origin: 'form',
    spec: { ...defaultSpec(), ...spec },
    lint: { valid: true, errors: 0 },
    quote: { usdPerMonth: 0.99 },
    changed: [],
    ...rest,
  };
}

describe('three-is-company', () => {
  it('needs the learner to set instances to 3 or more', () => {
    const got: string[] = [];
    const t = new AchievementTracker((id) => got.push(id));
    t.observe(obs({ origin: 'init' }));
    expect(got).toEqual([]);
    t.observe(obs({ origin: 'preset', changed: ['instances'], spec: { instances: 5 } }));
    expect(got).toEqual([]);
    t.observe(obs({ origin: 'form', changed: ['instances'], spec: { instances: 2 } }));
    expect(got).toEqual([]);
    t.observe(obs({ origin: 'form', changed: ['instances'], spec: { instances: 3 } }));
    expect(got).toEqual(['three-is-company']);
  });

  it('fires once', () => {
    const got: string[] = [];
    const t = new AchievementTracker((id) => got.push(id));
    t.observe(obs({ changed: ['instances'], spec: { instances: 4 } }));
    t.observe(obs({ changed: ['instances'], spec: { instances: 5 } }));
    expect(got).toEqual(['three-is-company']);
  });
});

describe('spec-whisperer', () => {
  it('goes from three errors to none through the learner edits', () => {
    const got: string[] = [];
    const t = new AchievementTracker((id) => got.push(id));
    t.observe(obs({ origin: 'init', lint: { valid: false, errors: 4 } }));
    t.observe(obs({ origin: 'form', lint: { valid: false, errors: 2 } }));
    expect(got).toEqual([]);
    t.observe(obs({ origin: 'form', lint: { valid: true, errors: 0 } }));
    expect(got).toEqual(['spec-whisperer']);
  });

  it('does not count "Show me", a preset or fewer than three errors', () => {
    const a: string[] = [];
    const t1 = new AchievementTracker((id) => a.push(id));
    t1.observe(obs({ origin: 'init', lint: { valid: false, errors: 5 } }));
    t1.observe(obs({ origin: 'apply', lint: { valid: true, errors: 0 } }));
    expect(a).toEqual([]);
    const b: string[] = [];
    const t2 = new AchievementTracker((id) => b.push(id));
    t2.observe(obs({ origin: 'init', lint: { valid: false, errors: 2 } }));
    t2.observe(obs({ origin: 'form', lint: { valid: true, errors: 0 } }));
    expect(b).toEqual([]);
  });

  it('forgets the peak when a new spec is loaded', () => {
    const got: string[] = [];
    const t = new AchievementTracker((id) => got.push(id));
    t.observe(obs({ origin: 'init', lint: { valid: false, errors: 5 } }));
    t.observe(obs({ origin: 'preset', lint: { valid: true, errors: 0 } }));
    t.observe(obs({ origin: 'form', lint: { valid: true, errors: 0 } }));
    expect(got).toEqual([]);
  });
});

describe('penny-pincher', () => {
  const sized = (cpu: number, ram: number): Partial<FluxAppSpec> => ({
    instances: 3,
    compose: [defaultComponent({ cpu, ram })],
  });

  it('wants a valid 3 instance spec with 1 core and 2 GB under $3', () => {
    const got: string[] = [];
    const t = new AchievementTracker((id) => got.push(id));
    t.observe(obs({ spec: sized(0.5, 500), quote: { usdPerMonth: 0.99 } }));
    expect(got).toEqual([]);
    t.observe(obs({ spec: sized(1, 2000), quote: { usdPerMonth: 3.49 } }));
    expect(got).toEqual([]);
    t.observe(obs({ spec: sized(1, 2000), quote: { usdPerMonth: 2.49 }, lint: { valid: false, errors: 1 } }));
    expect(got).toEqual([]);
    t.observe(obs({ spec: sized(1, 2000), quote: { usdPerMonth: 2.49 } }));
    expect(got).toEqual(['penny-pincher']);
  });

  it('needs exactly 3 instances', () => {
    const got: string[] = [];
    const t = new AchievementTracker((id) => got.push(id));
    t.observe(obs({ spec: { ...sized(1, 2000), instances: 2 }, quote: { usdPerMonth: 1.99 } }));
    expect(got).toEqual([]);
  });
});
