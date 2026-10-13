import { cloneFixture, defaultSpec } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  clock,
  eligibleSites,
  eventsUntil,
  placeInstances,
  runningAt,
  siteAllowed,
} from './timeline';

const DOC_RANGES = ['192.0.2.', '198.51.100.', '203.0.113.'];

describe('placement', () => {
  it('places distinct instances on addresses reserved for documentation', () => {
    const nodes = placeInstances({ name: 'hello-flux', geolocation: [] }, 12);
    expect(nodes).toHaveLength(12);
    expect(new Set(nodes.map((n) => n.ip)).size).toBe(12);
    for (const n of nodes) expect(DOC_RANGES.some((r) => n.ip.startsWith(r))).toBe(true);
  });

  it('spreads copies over different locations before it repeats one', () => {
    for (const name of ['hello-flux', 'academy-web', 'shop', 'x']) {
      const nodes = placeInstances({ name, geolocation: [] }, 6);
      const sites = new Set(nodes.map((n) => n.region));
      expect(sites.size).toBe(6);
    }
    const eu = placeInstances({ name: 'web', geolocation: ['acEU'] }, 5);
    expect(new Set(eu.map((n) => n.region)).size).toBe(5);
  });

  it('is a pure function of the name', () => {
    const a = placeInstances({ name: 'shop', geolocation: [] }, 5);
    const b = placeInstances({ name: 'shop', geolocation: [] }, 5);
    expect(a).toEqual(b);
    expect(placeInstances({ name: 'other', geolocation: [] }, 5)).not.toEqual(a);
  });

  it('honours allowed continents (FACTS 3.5)', () => {
    const nodes = placeInstances({ name: 'web', geolocation: ['acEU'] }, 6);
    expect(nodes.length).toBe(6);
    for (const n of nodes) expect(n.continent).toBe('EU');
  });

  it('honours a country allow and a continent deny', () => {
    const de = placeInstances({ name: 'web', geolocation: ['acEU_DE'] }, 4);
    for (const n of de) expect(n.country).toBe('DE');
    const noEu = placeInstances({ name: 'web', geolocation: ['a!cEU'] }, 8);
    for (const n of noEu) expect(n.continent).not.toBe('EU');
  });

  it('lets a deny win over an allow', () => {
    const nodes = placeInstances({ name: 'web', geolocation: ['acEU', 'a!cEU_DE'] }, 8);
    for (const n of nodes) {
      expect(n.continent).toBe('EU');
      expect(n.country).not.toBe('DE');
    }
  });

  it('places nothing when no sample location is allowed', () => {
    expect(placeInstances({ name: 'web', geolocation: ['acAN'] }, 3)).toEqual([]);
    expect(eligibleSites(['acAN'])).toBe(0);
    expect(eligibleSites([])).toBeGreaterThan(5);
  });

  it('matches a region by its ISO code with or without the country', () => {
    const site = {
      continent: 'EU',
      continentName: 'Europe',
      country: 'DE',
      countryName: 'Germany',
      region: 'DE-HE',
    };
    expect(siteAllowed(site, ['acEU_DE_HE'])).toBe(true);
    expect(siteAllowed(site, ['acEU_DE_BY'])).toBe(false);
    expect(siteAllowed(site, ['a!cEU_DE_HE'])).toBe(false);
  });
});

describe('install timeline', () => {
  const spec = { ...defaultSpec(), name: 'hello-flux', instances: 3 };
  const t = buildTimeline(spec, 'flux');

  it('goes from payment to Deployment Successful in order', () => {
    expect(t.events[0]?.kind).toBe('paid');
    expect(t.events.filter((e) => e.kind === 'done')).toHaveLength(1);
    const ats = t.events.map((e) => e.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
    expect(t.length).toBe(t.events.at(-1)?.at);
    expect(t.outcome).toBe('success');
  });

  it('reports success when ONE copy is running, at the next 30 second poll (FACTS 6.6)', () => {
    const done = t.events.find((e) => e.kind === 'done');
    const running = t.events.filter((e) => e.kind === 'running').map((e) => e.at);
    const first = Math.min(...running);
    expect(done?.title).toBe('Deployment Successful!');
    expect(done?.at).toBe(t.successAt);
    expect(t.successAt % 30).toBe(0);
    expect(t.successAt).toBeGreaterThan(first);
    expect(t.successAt - first).toBeLessThanOrEqual(30);
    // The label does not mean every copy runs: with three instances the others can still be coming up.
    for (const name of ['hello-flux', 'academy-web', 'shop', 'x', 'notes', 'quotes']) {
      const tl = buildTimeline({ ...spec, name }, 'flux');
      const last = Math.max(...tl.events.filter((e) => e.kind === 'running').map((e) => e.at));
      expect(tl.successAt).toBeLessThanOrEqual(tl.length);
      expect(runningAt(tl, tl.successAt)).toBeGreaterThanOrEqual(1);
      expect(tl.length).toBeGreaterThanOrEqual(last);
    }
    const early = ['hello-flux', 'academy-web', 'shop', 'x', 'notes', 'quotes'].some((name) => {
      const tl = buildTimeline({ ...spec, name }, 'flux');
      return runningAt(tl, tl.successAt) < spec.instances;
    });
    expect(early).toBe(true);
  });

  it('gives up after 30 minutes when no copy can be placed, without cancelling anything', () => {
    const none = buildTimeline({ ...spec, geolocation: ['acAN'] }, 'flux');
    expect(none.nodes).toEqual([]);
    expect(none.outcome).toBe('timed-out');
    expect(none.length).toBe(30 * 60);
    expect(none.successAt).toBe(none.length);
    const last = none.events.at(-1);
    expect(last?.kind).toBe('done');
    expect(last?.title).toBe('Payment monitoring timed out. Please check your application status.');
    expect(none.events.some((e) => e.kind === 'running' || e.kind === 'domain')).toBe(false);
  });

  it('has the payment seen in the next block, about 30 seconds later', () => {
    const block = t.events.find((e) => e.kind === 'block');
    expect(block?.at).toBe(30);
  });

  it('lets each node choose 1 to 3 minutes after the listing, one by one', () => {
    const chosen = t.events.filter((e) => e.kind === 'chosen');
    expect(chosen).toHaveLength(3);
    for (const e of chosen) {
      expect(e.at - 35).toBeGreaterThanOrEqual(60);
      expect(e.at - 35).toBeLessThanOrEqual(60 + 120 + 9 * 3);
    }
    const ips = chosen.map((e) => e.node?.ip);
    expect(new Set(ips).size).toBe(3);
  });

  it('starts every copy and publishes the domains afterwards', () => {
    const running = t.events.filter((e) => e.kind === 'running');
    expect(running).toHaveLength(3);
    const domains = t.events.filter((e) => e.kind === 'domain');
    expect(domains.map((d) => d.domain)).toEqual([
      'hello-flux.app.runonflux.io',
      'hello-flux_31001.app.runonflux.io',
    ]);
    const firstRunning = Math.min(...running.map((e) => e.at));
    for (const d of domains) expect(d.at).toBeGreaterThan(firstRunning);
  });

  it('names one domain per public port of a two port app, plus the alias', () => {
    const two = cloneFixture('wordpress-mysql');
    if (!two) throw new Error('fixture');
    const tl = buildTimeline(two, 'card');
    const hosts = tl.domains.map((d) => d.host);
    expect(hosts[0]).toBe('academy-blog.app.runonflux.io');
    expect(hosts.length).toBe(1 + two.compose.reduce((n, c) => n + c.ports.length, 0));
    expect(tl.domains[0]?.alias).toBe(true);
  });

  it('counts running copies as the clock advances', () => {
    expect(runningAt(t, 0)).toBe(0);
    expect(runningAt(t, t.length)).toBe(3);
    expect(eventsUntil(t, 0).map((e) => e.kind)).toEqual(['paid']);
  });

  it('words the payment by method', () => {
    expect(buildTimeline(spec, 'card').events[0]?.title).toMatch(/bridge/);
    expect(t.events[0]?.title).toMatch(/message/);
  });
});

describe('clock', () => {
  it('formats simulated seconds as m:ss', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(95)).toBe('1:35');
    expect(clock(3601)).toBe('60:01');
  });
});
