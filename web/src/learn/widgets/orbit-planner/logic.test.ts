import {
  BAKED_PRICING,
  deployToFluxUrl,
  lintSpec,
  ORBIT_CUSTOM,
  ORBIT_PLANS,
  orbitPlanQuoteUsd,
  orbitPlanSpec,
  quote,
  tryDeployToFluxUrl,
} from '@shared/flux';
import { describe, expect, it } from 'vitest';
import {
  agreement,
  atSize,
  BUTTON_PLAN_VALUES,
  buttonMatches,
  canonicalOptions,
  clampCustom,
  customGoalMet,
  differsFrom,
  draftOf,
  EMPTY_DRAFT,
  evaluateButton,
  excerptOf,
  factsOf,
  PLAN_KEYS,
  planOf,
  priceOf,
  quoteOf,
  RATE_PARAMS,
  readProps,
  STANDARD_PLAN,
  sameSize,
  sizeOf,
  solveCustom,
  specExcerpt,
  toOptions,
} from './logic';

const plan = (id: string) => {
  const p = ORBIT_PLANS.find((x) => x.id === id);
  if (!p) throw new Error(`no plan ${id}`);
  return p;
};

describe('plans and prices', () => {
  it('has a card for each published plan and for Custom', () => {
    expect(PLAN_KEYS).toEqual(['starter', 'standard', 'pro', 'custom']);
    expect(planOf('custom')).toBeUndefined();
    expect(planOf('pro')?.name).toBe('Pro');
  });

  it('prices every plan with orbitPlanQuoteUsd at the baked rates, and the page agrees', () => {
    for (const p of ORBIT_PLANS) {
      expect(priceOf(p)).toBe(orbitPlanQuoteUsd(p, BAKED_PRICING.params));
      expect(priceOf(p)).toBe(p.usd);
      expect(agreement(p)).toEqual({ published: p.usd, formula: p.usd, same: true });
      expect(quoteOf(p).usdTotal).toBe(priceOf(p));
    }
  });

  it('prices another instance count through the same function', () => {
    const std = plan('standard');
    expect(priceOf(std, 3)).toBe(orbitPlanQuoteUsd(std, RATE_PARAMS, { instances: 3 }));
    expect(priceOf(std, 3)).toBeGreaterThan(priceOf(std));
    expect(priceOf(atSize(std, { ...sizeOf(std), instances: 3 }))).toBe(priceOf(std, 3));
  });

  it('prices a size that is not in the table by the formula, never by a lookup', () => {
    const size = { vcores: 1, ramMb: 2000, storageGb: 10, instances: 2 };
    const custom = atSize(STANDARD_PLAN, size);
    const spec = orbitPlanSpec(custom);
    expect(spec.instances).toBe(2);
    expect(spec.compose[0]?.cpu).toBe(1);
    expect(priceOf(custom)).toBe(quote(spec, RATE_PARAMS).usdTotal);
    expect(priceOf(custom)).toBeLessThan(priceOf(STANDARD_PLAN));
  });

  it('keeps a Custom size inside the ranges the page states', () => {
    const big = clampCustom({ vcores: 40, ramMb: 999999, storageGb: 5000, instances: 9 });
    expect(big).toEqual({
      vcores: ORBIT_CUSTOM.vcoresMax,
      ramMb: ORBIT_CUSTOM.ramMbMax,
      storageGb: ORBIT_CUSTOM.storageGbMax,
      instances: ORBIT_CUSTOM.instancesMax,
    });
    const small = clampCustom({ vcores: 0, ramMb: 0, storageGb: 0, instances: 0 });
    expect(small.vcores).toBe(ORBIT_CUSTOM.vcoresMin);
    expect(small.storageGb).toBe(ORBIT_CUSTOM.storageGbMin);
    expect(small.instances).toBe(ORBIT_CUSTOM.instancesMin);
    expect(sameSize(sizeOf(plan('pro')), sizeOf(plan('pro')))).toBe(true);
    expect(sameSize(sizeOf(plan('pro')), sizeOf(plan('standard')))).toBe(false);
  });
});

describe('what a size means for a failing node', () => {
  it('says Starter has one instance and no failover, in the page words', () => {
    const f = factsOf('starter', sizeOf(plan('starter')));
    expect(f.survivesNodeLoss).toBe(false);
    expect(f.failover).toMatch(/brief downtime/);
    expect(f.failover).not.toMatch(/failover:/);
    expect(f.persistentFolders).toBe('No.');
    expect(f.secondPort).toBe('No.');
  });

  it('says Standard and Pro run two instances with failover', () => {
    for (const id of ['standard', 'pro']) {
      const f = factsOf(id as 'standard' | 'pro', sizeOf(plan(id)));
      expect(f.survivesNodeLoss).toBe(true);
      expect(f.failover).toMatch(/2 instances/);
      expect(f.persistentFolders).toBe('Yes.');
    }
  });

  it('follows the instance count for Custom, including the persistent folder rule', () => {
    const one = factsOf('custom', { vcores: 1, ramMb: 1000, storageGb: 5, instances: 1 });
    expect(one.survivesNodeLoss).toBe(false);
    expect(one.failover).toMatch(/down while its node is/);
    expect(one.persistentFolders).toMatch(/Not with one instance/);
    const two = factsOf('custom', { vcores: 1, ramMb: 1000, storageGb: 5, instances: 2 });
    expect(two.survivesNodeLoss).toBe(true);
    expect(two.persistentFolders).toMatch(/Yes/);
  });
});

describe('the spec excerpt', () => {
  it('is the spec Orbit registers: one component, the Orbit image, the size of the plan', () => {
    for (const p of ORBIT_PLANS) {
      const parsed = JSON.parse(excerptOf(p));
      expect(parsed.instances).toBe(p.instances);
      expect(parsed.compose).toHaveLength(1);
      expect(parsed.compose[0].repotag).toBe('runonflux/orbit:latest');
      expect([parsed.compose[0].cpu, parsed.compose[0].ram, parsed.compose[0].hdd]).toEqual([
        p.vcores,
        p.ramMb,
        p.storageGb,
      ]);
      expect(parsed.compose[0].containerPorts.at(-1)).toBe(9001);
    }
  });

  it('is plain JSON of a spec that lints without errors', () => {
    const spec = orbitPlanSpec(plan('standard'));
    expect(lintSpec(spec).errors).toBe(0);
    expect(() => JSON.parse(specExcerpt(spec))).not.toThrow();
  });
});

describe('the Deploy to Flux button', () => {
  const expected = {
    repo: 'https://github.com/RunOnFlux/deploy-with-git-samples',
    branch: 'master',
    projectPath: 'express',
    plan: 'standard',
  };

  it('leaves empty optional fields out and keeps the documented order', () => {
    expect(toOptions({ ...EMPTY_DRAFT, repo: 'https://github.com/a/b' })).toEqual({
      repo: 'https://github.com/a/b',
    });
    const ev = evaluateButton(draftOf(expected));
    expect(ev.ok).toBe(true);
    expect(ev.url).toBe(deployToFluxUrl(expected));
    expect(ev.url).toBe(
      'https://runonflux.com/apps/orbit?repo=https://github.com/RunOnFlux/deploy-with-git-samples&branch=master&projectPath=express&plan=standard',
    );
    expect(ev.markdown).toContain('[![Deploy to Flux]');
    expect(ev.markdown).toContain(ev.url ?? '');
  });

  it('reports every refused field at once, with the engine message for each', () => {
    const ev = evaluateButton({
      repo: 'git@github.com:RunOnFlux/deploy-with-git-samples.git',
      branch: 'master',
      projectPath: '/express',
      plan: 'free',
    });
    expect(ev.ok).toBe(false);
    expect(ev.url).toBeNull();
    expect(Object.keys(ev.errors).sort()).toEqual(['plan', 'projectPath', 'repo']);
    const repo = tryDeployToFluxUrl({ repo: 'git@github.com:RunOnFlux/deploy-with-git-samples.git' });
    expect(repo.ok ? '' : repo.message).toBe(ev.errors.repo);
    expect(ev.errors.plan).toMatch(/starter, standard, pro/);
  });

  it('refuses a token in the repository URL and a non-https scheme', () => {
    expect(evaluateButton({ ...EMPTY_DRAFT, repo: 'https://ghp_x@github.com/a/b' }).errors.repo).toMatch(
      /token/,
    );
    expect(evaluateButton({ ...EMPTY_DRAFT, repo: 'http://github.com/a/b' }).errors.repo).toMatch(/https/);
    expect(evaluateButton(EMPTY_DRAFT).errors.repo).toMatch(/required/);
  });

  it('offers the three plan values and the older `free` one that the page says opens Starter', () => {
    expect(BUTTON_PLAN_VALUES).toEqual(['starter', 'standard', 'pro', 'free']);
    expect(evaluateButton({ ...EMPTY_DRAFT, repo: 'https://github.com/a/b', plan: 'free' }).ok).toBe(false);
  });

  it('grades by the link the engine builds, folding `.git` and a trailing slash', () => {
    expect(buttonMatches(draftOf(expected), expected)).toBe(true);
    expect(
      buttonMatches(
        { ...draftOf(expected), repo: 'https://github.com/RunOnFlux/deploy-with-git-samples.git' },
        expected,
      ),
    ).toBe(true);
    expect(buttonMatches({ ...draftOf(expected), projectPath: 'express/' }, expected)).toBe(true);
    expect(buttonMatches({ ...draftOf(expected), plan: 'pro' }, expected)).toBe(false);
    expect(buttonMatches({ ...draftOf(expected), branch: '' }, expected)).toBe(false);
    expect(buttonMatches({ ...draftOf(expected), repo: 'git@github.com:a/b.git' }, expected)).toBe(false);
  });

  it('names what differs between a valid link and the one asked for', () => {
    expect(differsFrom(draftOf(expected), expected)).toBeNull();
    expect(differsFrom({ ...draftOf(expected), plan: 'pro' }, expected)).toBe('the plan');
    expect(differsFrom({ ...draftOf(expected), branch: 'main', projectPath: '' }, expected)).toBe(
      'the branch and the project path',
    );
    expect(canonicalOptions({ repo: 'https://github.com/a/b.git/' }).repo).toBe('https://github.com/a/b');
  });
});

describe('goals', () => {
  const goal = { kind: 'custom', minInstances: 2, cheaperThan: 'standard' } as const;

  it('is met by two instances priced under Standard, and not by Standard itself', () => {
    expect(customGoalMet(goal, sizeOf(STANDARD_PLAN))).toBe(false);
    expect(customGoalMet(goal, { vcores: 1, ramMb: 2000, storageGb: 10, instances: 2 })).toBe(true);
    // Cheap enough but only one instance: failover is the point.
    expect(customGoalMet(goal, { vcores: 0.5, ramMb: 1000, storageGb: 5, instances: 1 })).toBe(false);
  });

  it('has a "Show me" size that meets the goal, keeps two instances and starts from the current size', () => {
    const solved = solveCustom(goal, sizeOf(STANDARD_PLAN));
    expect(solved).not.toBeNull();
    if (!solved) return;
    expect(customGoalMet(goal, solved)).toBe(true);
    expect(solved.instances).toBe(2);
    expect(solved.ramMb).toBe(STANDARD_PLAN.ramMb);
    expect(solved.vcores).toBeLessThan(STANDARD_PLAN.vcores);
  });

  it('says so when no Custom size can meet the goal', () => {
    // Nothing is cheaper than the floor, which is what Starter costs.
    expect(
      solveCustom({ kind: 'custom', minInstances: 2, cheaperThan: 'starter' }, sizeOf(plan('pro'))),
    ).toBeNull();
  });
});

describe('reading props', () => {
  it('defaults to the plans view on Standard with no goal', () => {
    const p = readProps(undefined);
    expect(p).toEqual({ view: 'plans', plan: 'standard', goal: null, draft: EMPTY_DRAFT });
  });

  it('reads a button step with a planted draft and an expected link', () => {
    const p = readProps({
      view: 'button',
      draft: { repo: 'git@github.com:a/b.git', plan: 'free' },
      goal: { kind: 'url', expected: { repo: 'https://github.com/a/b', plan: 'pro' } },
    });
    expect(p.view).toBe('button');
    expect(p.draft).toEqual({ repo: 'git@github.com:a/b.git', branch: '', projectPath: '', plan: 'free' });
    expect(p.goal).toEqual({
      kind: 'url',
      expected: { repo: 'https://github.com/a/b', plan: 'pro' },
    });
  });

  it('reads a plans goal and ignores nonsense', () => {
    expect(readProps({ goal: { kind: 'custom', minInstances: 2, cheaperThan: 'standard' } }).goal).toEqual({
      kind: 'custom',
      minInstances: 2,
      cheaperThan: 'standard',
    });
    expect(readProps({ goal: { kind: 'custom', cheaperThan: 'free' } }).goal).toBeNull();
    expect(readProps({ goal: 'pro', plan: 'enterprise', view: 7 }).plan).toBe('standard');
    expect(readProps({ plan: 'custom' }).plan).toBe('custom');
  });
});
