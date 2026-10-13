import { defaultSpec } from '@shared/flux/spec';
import { describe, expect, it } from 'vitest';
import {
  describeTarget,
  gapSentence,
  meets,
  monthlyUsd,
  readSliders,
  readTarget,
  solveTarget,
} from './target';

function app(over: { instances?: number; cpu?: number; ram?: number; hdd?: number }) {
  const spec = defaultSpec();
  const c = spec.compose[0];
  if (!c) throw new Error('no component');
  return {
    ...spec,
    instances: over.instances ?? 3,
    compose: [{ ...c, cpu: over.cpu ?? 2, ram: over.ram ?? 4000, hdd: over.hdd ?? 40 }],
  };
}

describe('readTarget', () => {
  it('reads the numbers it knows and ignores the rest', () => {
    expect(readTarget({ usdMax: 1.99, color: 'red', instancesMin: 3 })).toEqual({
      usdMax: 1.99,
      instancesMin: 3,
    });
    expect(readTarget({})).toBeNull();
    expect(readTarget('x')).toBeNull();
    expect(readTarget(null)).toBeNull();
    expect(readTarget({ usdMax: 'cheap' })).toBeNull();
  });

  it('reads the slider list and falls back to all four', () => {
    expect(readSliders(['cpu', 'ram', 'nope'])).toEqual(['cpu', 'ram']);
    expect(readSliders(undefined)).toEqual(['cpu', 'ram', 'hdd', 'instances']);
    expect(readSliders([])).toEqual(['cpu', 'ram', 'hdd', 'instances']);
  });
});

describe('meets and describe', () => {
  it('checks the price and the instance bounds', () => {
    const spec = app({});
    const usd = monthlyUsd(spec);
    expect(meets({ usdMax: usd }, spec, usd)).toBe(true);
    expect(meets({ usdMax: usd - 0.5 }, spec, usd)).toBe(false);
    expect(meets({ usdMin: usd + 1 }, spec, usd)).toBe(false);
    expect(meets({ instances: 3 }, spec, usd)).toBe(true);
    expect(meets({ instancesMin: 4 }, spec, usd)).toBe(false);
    expect(meets({ instancesMax: 2 }, spec, usd)).toBe(false);
  });

  it('says the goal and the gap in plain words', () => {
    expect(describeTarget({ usdMax: 1.99, instancesMin: 3 })).toBe(
      'at most $1.99 a month and at least 3 instances',
    );
    const spec = app({});
    expect(gapSentence({ usdMax: 1 }, spec, 2.5)).toBe('$1.50 over the limit');
    expect(gapSentence({ usdMax: 5 }, spec, 2.5)).toBe('');
  });
});

describe('solveTarget', () => {
  it('sizes an app down to a price goal and keeps the instances', () => {
    const spec = app({});
    expect(monthlyUsd(spec)).toBeGreaterThan(1.99);
    const solved = solveTarget(spec, 0, { usdMax: 1.99 }, ['cpu', 'ram', 'hdd', 'instances']);
    expect(solved).not.toBeNull();
    if (!solved) return;
    expect(monthlyUsd(solved)).toBeLessThanOrEqual(1.99);
    expect(solved.instances).toBe(3);
    const c = solved.compose[0];
    expect(c?.cpu).toBeLessThanOrEqual(2);
    expect(c?.ram).toBeLessThanOrEqual(4000);
    expect(c?.hdd).toBeLessThanOrEqual(40);
    // Sized down together, not driven to the floor on one resource.
    expect(c?.cpu).toBeGreaterThan(0.1);
  });

  it('touches only the sliders the learner has', () => {
    const spec = app({});
    const solved = solveTarget(spec, 0, { usdMax: 3.49 }, ['cpu']);
    expect(solved).not.toBeNull();
    const c = solved?.compose[0];
    expect(c?.ram).toBe(4000);
    expect(c?.hdd).toBe(40);
    expect(c?.cpu).toBeLessThan(2);
  });

  it('sets the instance count the goal names', () => {
    const spec = app({ instances: 1 });
    const solved = solveTarget(spec, 0, { instances: 3 }, ['instances']);
    expect(solved?.instances).toBe(3);
    expect(solveTarget(spec, 0, { instances: 3 }, ['cpu'])).toBeNull();
  });

  it('scales up to a minimum price', () => {
    const spec = app({ cpu: 0.5, ram: 500, hdd: 5 });
    const solved = solveTarget(spec, 0, { usdMin: 5 }, ['cpu', 'ram', 'hdd']);
    expect(solved).not.toBeNull();
    if (solved) expect(monthlyUsd(solved)).toBeGreaterThanOrEqual(5);
  });

  it('returns the spec itself when the goal already holds', () => {
    const spec = app({ cpu: 0.5, ram: 500, hdd: 5 });
    expect(solveTarget(spec, 0, { usdMax: 5 }, ['cpu'])).toBe(spec);
  });

  it('gives up when the goal cannot be met', () => {
    const spec = app({});
    expect(solveTarget(spec, 0, { usdMax: 0.01 }, ['cpu', 'ram', 'hdd'])).toBeNull();
  });
});
