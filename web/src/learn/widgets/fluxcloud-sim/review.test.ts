import { BAKED_PRICING, defaultComponent, defaultSpec, type FluxAppSpec } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { meetsFreeUpdateRule, type ReviewContext, review, updateChanges, updateExpire } from './review';

const params = BAKED_PRICING.params;

function ctx(over: Partial<ReviewContext> = {}): ReviewContext {
  return {
    params,
    fluxUsd: 0.085,
    paramsSource: 'baked',
    takenNames: ['explorer'],
    currentHeight: 3_031_422,
    nowMs: Date.UTC(2026, 9, 12),
    ...over,
  };
}

function running(): FluxAppSpec {
  return {
    ...defaultSpec(),
    name: 'academyweb',
    instances: 3,
    compose: [
      defaultComponent({ name: 'web', cpu: 0.5, ram: 500, hdd: 5, ports: [31010], containerPorts: [80] }),
    ],
  };
}

describe('review of a registration', () => {
  it('accepts the default spec and prices it with the engine', () => {
    const r = review(defaultSpec(), ctx());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.quote.usdTotal).toBeCloseTo(0.99, 2);
    expect(r.quote.fluxTotal).not.toBeNull();
    expect(r.credit).toBeNull();
  });

  it('dates the expiry from the tip', () => {
    const r = review({ ...defaultSpec(), expire: 88_000 }, ctx());
    expect(r.expiryHeight).toBe(3_031_422 + 88_000);
    expect(r.expiryMs).toBe(Date.UTC(2026, 9, 12) + 88_000 * 30 * 1000);
  });

  it('refuses a taken name and a banned port, with the engine messages', () => {
    const spec = { ...defaultSpec(), name: 'Explorer' };
    spec.compose = [defaultComponent({ ports: [22] })];
    const r = review(spec, ctx());
    expect(r.valid).toBe(false);
    const codes = r.errors.map((e) => e.code);
    expect(codes).toContain('NAME_TAKEN');
    expect(codes.some((c) => c.startsWith('PORT'))).toBe(true);
    for (const e of r.errors) {
      expect(e.message.length).toBeGreaterThan(10);
      expect(e.fix.length).toBeGreaterThan(5);
    }
  });

  it('answers the Enterprise lint codes when the app is registered as Enterprise', () => {
    const spec = defaultSpec();
    spec.compose = [defaultComponent({ repoauth: 'user:token' })];
    const plain = review(spec, ctx());
    expect(plain.errors.map((e) => e.code)).toContain('REPOAUTH_NEEDS_ENTERPRISE');
    const ent = review(spec, ctx({ enterprise: true }));
    expect(ent.errors.map((e) => e.code)).not.toContain('REPOAUTH_NEEDS_ENTERPRISE');
    expect(ent.quote.lines.some((l) => l.id === 'scope')).toBe(true);
    expect(ent.quote.usdTotal ?? 0).toBeGreaterThan(plain.quote.usdTotal ?? 0);
  });

  it('prices more months at a discount the engine owns', () => {
    const one = review({ ...defaultSpec(), expire: 88_000 }, ctx());
    const year = review({ ...defaultSpec(), expire: 1_056_000 }, ctx());
    expect(year.quote.lines.some((l) => l.id === 'duration')).toBe(true);
    expect(year.quote.usdTotal ?? 0).toBeGreaterThan(one.quote.usdTotal ?? 0);
  });
});

describe('review of an update', () => {
  it('counts the subscription as what is left plus the extension', () => {
    expect(updateExpire(57_200, 0)).toBe(57_200);
    expect(updateExpire(57_200, 88_000)).toBe(145_200);
    expect(updateExpire(1_000_000, 500_000)).toBe(1_056_000);
    expect(updateExpire(0, 0)).toBe(1);
  });

  it('credits the unused part of the old subscription through updateCredit', () => {
    const spec = running();
    const next: FluxAppSpec = { ...spec, compose: [{ ...spec.compose[0]!, cpu: 1, ram: 1000 }] };
    const r = review(next, ctx({ previous: { spec: { ...spec, expire: 88_000 }, blocksRemaining: 44_000 } }));
    expect(r.credit).not.toBeNull();
    expect(r.credit?.unusedFraction).toBeCloseTo(0.5, 5);
    expect(r.credit?.creditUsd ?? 0).toBeGreaterThan(0);
    expect(r.quote.lines.some((l) => l.id === 'credit')).toBe(true);
    expect(r.expireBlocks).toBe(44_000);
  });

  it('does not treat the running name as taken', () => {
    const spec = { ...running(), name: 'explorer' };
    const r = review(spec, ctx({ previous: { spec, blocksRemaining: 50_000 } }));
    expect(r.errors.map((e) => e.code)).not.toContain('NAME_TAKEN');
  });
});

describe('what an update changes', () => {
  const base = running();

  it('is soft for an image or environment change', () => {
    const next: FluxAppSpec = {
      ...base,
      compose: [{ ...base.compose[0]!, repotag: 'traefik/whoami:v1.11.0', environmentParameters: ['A=1'] }],
    };
    const c = updateChanges(base, next);
    expect(c.hard).toBe(false);
    expect(c.resourcesIncreased).toBe(false);
    expect(c.changed).toEqual(['image of web', 'environment of web']);
  });

  it('is hard when a component is renamed (FACTS 9.5.4)', () => {
    const next: FluxAppSpec = { ...base, compose: [{ ...base.compose[0]!, name: 'backend' }] };
    const c = updateChanges(base, next);
    expect(c.hard).toBe(true);
    expect(c.hardReasons[0]).toMatch(/renamed or replaced/);
  });

  it('is hard when a disk size changes, and says resources increased when it grows', () => {
    const next: FluxAppSpec = { ...base, compose: [{ ...base.compose[0]!, hdd: 10 }] };
    const c = updateChanges(base, next);
    expect(c.hard).toBe(true);
    expect(c.resourcesIncreased).toBe(true);
  });

  it('is hard when a component is added', () => {
    const next: FluxAppSpec = {
      ...base,
      compose: [...base.compose, defaultComponent({ name: 'cache', ports: [31011], containerPorts: [6379] })],
    };
    expect(updateChanges(base, next).hard).toBe(true);
  });
});

describe('the free update rule (reported, not applied)', () => {
  const base = running();
  const same = (over: Partial<FluxAppSpec>): FluxAppSpec => ({ ...base, ...over });

  it('holds for a change that adds nothing', () => {
    const next = same({ compose: [{ ...base.compose[0]!, repotag: 'traefik/whoami:v1.11.0' }] });
    expect(meetsFreeUpdateRule(base, next, 0)).toBe(true);
    expect(meetsFreeUpdateRule(base, next, 8)).toBe(true);
  });

  it('fails when the subscription is extended by more than 8 blocks', () => {
    expect(meetsFreeUpdateRule(base, base, 9)).toBe(false);
  });

  it('fails for more instances, a static IP, or more resources', () => {
    expect(meetsFreeUpdateRule(base, same({ instances: 4 }), 0)).toBe(false);
    expect(meetsFreeUpdateRule(base, same({ staticip: true }), 0)).toBe(false);
    expect(meetsFreeUpdateRule(base, same({ compose: [{ ...base.compose[0]!, cpu: 1 }] }), 0)).toBe(false);
  });

  it('holds when resources go down', () => {
    expect(meetsFreeUpdateRule(base, same({ compose: [{ ...base.compose[0]!, ram: 300 }] }), 0)).toBe(true);
  });

  it('fails when a priced port is added', () => {
    const next = same({
      compose: [{ ...base.compose[0]!, ports: [31010, 443], containerPorts: [80, 443], domains: ['', ''] }],
    });
    expect(meetsFreeUpdateRule(base, next, 0)).toBe(false);
  });
});
