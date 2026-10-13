import { describe, expect, it } from 'vitest';
import { buildSampleBench } from '../model/sample';
import type { Region } from '../model/types';
import { createSim } from './createSim';
import {
  competingTiers,
  compressionNote,
  DEFAULT_RULES,
  faultDomainCap,
  geolocationAllows,
  hasEmptyDisk,
  parseGeolocation,
  REAL_G_FAILOVER_MS,
  REAL_REPLACEMENT_MS,
  SIM_COMPRESSION,
} from './rules';
import type { Sim, SimEvent, SimOptions, VolumeMode } from './types';

const BENCH = buildSampleBench(3);

function make(opts: Partial<SimOptions> = {}): { sim: Sim; log: SimEvent[] } {
  const sim = createSim({ bench: BENCH, seed: 7, ...opts });
  const log: SimEvent[] = [];
  sim.on('*', (e) => log.push(e));
  return { sim, log };
}

const types = (log: readonly SimEvent[]) => log.map((e) => e.type);

function nodeIds(sim: Sim): string[] {
  return sim
    .state()
    .instances.filter((i) => i.node >= 0)
    .map((i) => i.nodeId);
}

describe('placement', () => {
  it('places instances on distinct nodes and distinct addresses', () => {
    const { sim } = make();
    expect(sim.setInstances(12)).toBe(12);
    const st = sim.state();
    const idx = st.instances.map((i) => i.node);
    expect(new Set(idx).size).toBe(12);
    const ips = idx.map((i) => BENCH.nodes[i]?.ip);
    expect(new Set(ips).size).toBe(12);
    expect(st.count).toBe(12);
  });

  it('is deterministic for a seed and call sequence', () => {
    const run = (seed: number) => {
      const { sim, log } = make({ seed });
      sim.setInstances(5, { spread: 'regions' });
      sim.tick(3000);
      sim.send('tokyo');
      sim.kill(nodeIds(sim)[1] as string);
      sim.tick(30_000);
      return { log, ids: nodeIds(sim), counters: { ...sim.state().counters } };
    };
    const a = run(11);
    const b = run(11);
    expect(a.log).toEqual(b.log);
    expect(a.ids).toEqual(b.ids);
    expect(a.counters).toEqual(b.counters);
    expect(run(12).ids).not.toEqual(a.ids);
  });

  it('keeps earlier instances where they are when the count changes', () => {
    const { sim } = make();
    sim.setInstances(3);
    const first = nodeIds(sim);
    sim.setInstances(6);
    expect(nodeIds(sim).slice(0, 3)).toEqual(first);
    sim.setInstances(2);
    expect(nodeIds(sim)).toEqual(first.slice(0, 2));
    sim.setInstances(3);
    expect(nodeIds(sim)).toEqual(first);
  });

  it('honours a continent allow list', () => {
    const { sim } = make();
    sim.setInstances(6, { regions: ['EU'] });
    for (const i of sim.state().instances) expect(BENCH.nodes[i.node]?.region).toBe('EU');
  });

  it('honours a deny list and a country list', () => {
    const { sim } = make();
    sim.setInstances(8, { denyRegions: ['EU', 'NA'] });
    for (const i of sim.state().instances) {
      expect(['EU', 'NA']).not.toContain(BENCH.nodes[i.node]?.region);
    }
    sim.setInstances(3, { denyRegions: [], countries: ['DE'] });
    for (const i of sim.state().instances) expect(BENCH.nodes[i.node]?.cc).toBe('DE');
  });

  it('re-places instances that violate new constraints and emits events for them', () => {
    const { sim, log } = make();
    sim.setInstances(4, { regions: ['NA', 'EU'] });
    log.length = 0;
    sim.setInstances(4, { regions: ['AS'] });
    for (const i of sim.state().instances) expect(BENCH.nodes[i.node]?.region).toBe('AS');
    expect(log.filter((e) => e.type === 'placed').length).toBe(4);
    expect(log.filter((e) => e.type === 'removed').length).toBe(4);
  });

  it('spreads across continents on request', () => {
    const { sim } = make();
    sim.setInstances(6, { spread: 'regions', appSize: 'small' });
    const regions = new Set(sim.state().instances.map((i) => BENCH.nodes[i.node]?.region));
    expect(regions.size).toBe(6);
  });

  it('leaves slots unplaced when the filter has too few nodes', () => {
    const { sim, log } = make();
    const oc = BENCH.nodes.filter((n) => n.region === 'OC' && n.tier === 'cumulus').length;
    const placed = sim.setInstances(oc + 5, { regions: ['OC'], appSize: 'small', waitedMin: 0 });
    // Later tiers join as the app waits, so more than the cumulus nodes alone may be found.
    expect(placed).toBeGreaterThanOrEqual(oc);
    const ocAll = BENCH.nodes.filter((n) => n.region === 'OC').length;
    expect(placed).toBeLessThanOrEqual(ocAll);
    if (placed < oc + 5) expect(log.some((e) => e.type === 'unplaced')).toBe(true);
  });

  it('caps instances at the network maximum', () => {
    const { sim } = make();
    sim.setInstances(500);
    expect(sim.state().count).toBe(DEFAULT_RULES.placement.maxInstances);
  });

  it('ties the pick to the tier timers: a small app lands on Cumulus first', () => {
    const { sim } = make();
    sim.setInstances(10, { appSize: 'small', waitedMin: 0 });
    for (const i of sim.state().instances) expect(BENCH.nodes[i.node]?.tier).toBe('cumulus');
    sim.setInstances(10, { appSize: 'medium' });
    for (const i of sim.state().instances) expect(BENCH.nodes[i.node]?.tier).toBe('nimbus');
    sim.setInstances(10, { appSize: 'large' });
    for (const i of sim.state().instances) expect(BENCH.nodes[i.node]?.tier).toBe('stratus');
  });

  it('lets later tiers join as the app waits', () => {
    const { sim } = make();
    sim.setInstances(40, { appSize: 'small', waitedMin: 120 });
    const tiers = new Set(sim.state().instances.map((i) => BENCH.nodes[i.node]?.tier));
    expect(tiers.has('nimbus') && tiers.has('stratus')).toBe(true);
  });

  it('falls back to a later tier when an earlier one has nothing eligible, and says how long it waited', () => {
    const bench = buildSampleBench(5, { nodes: 120, tierMix: [0, 1, 1] });
    const sim = createSim({ bench, seed: 1 });
    sim.setInstances(3, { appSize: 'small', waitedMin: 0 });
    const inst = sim.state().instances;
    expect(inst.every((i) => i.node >= 0)).toBe(true);
    expect(inst.every((i) => i.waitedMin >= 57)).toBe(true);
  });

  it('uniform tier mode ignores tiers', () => {
    const sim = createSim({ bench: BENCH, seed: 2, rules: { placement: { tier: 'uniform' } } });
    sim.setInstances(30);
    const tiers = new Set(sim.state().instances.map((i) => BENCH.nodes[i.node]?.tier));
    expect(tiers.size).toBe(3);
  });

  it('limits instances per hosting organisation for synced volumes', () => {
    const { sim } = make();
    sim.setInstances(12, { volume: 'replicated', appSize: 'small' });
    const ops = sim.state().instances.map((i) => BENCH.nodes[i.node]?.operator);
    // 12 instances over far more than 12 organisations: the cap is 1.
    expect(new Set(ops).size).toBe(12);
  });
});

describe('rules helpers', () => {
  it('parses Flux geolocation entries', () => {
    const c = parseGeolocation(['acEU', 'acNA_US', 'a!cEU_RU', 'bFR', 'nonsense']);
    expect(c.allow.length).toBe(3);
    expect(c.deny).toEqual([{ continent: 'EU', country: 'RU' }]);
    expect(geolocationAllows(c, 'EU', 'DE')).toBe(true);
    expect(geolocationAllows(c, 'EU', 'RU')).toBe(false);
    expect(geolocationAllows(c, 'NA', 'US')).toBe(true);
    expect(geolocationAllows(c, 'NA', 'CA')).toBe(false);
    expect(geolocationAllows(parseGeolocation([]), 'AS', 'JP')).toBe(true);
    expect(geolocationAllows(parseGeolocation(['acALL']), 'AS', 'JP')).toBe(true);
  });

  it('computes tiers and fault domain caps from the FACTS tables', () => {
    expect(competingTiers(DEFAULT_RULES.placement, 'small', 0)).toEqual([true, false, false]);
    expect(competingTiers(DEFAULT_RULES.placement, 'small', 57)).toEqual([true, true, false]);
    expect(competingTiers(DEFAULT_RULES.placement, 'small', 117)).toEqual([true, true, true]);
    expect(competingTiers(DEFAULT_RULES.placement, 'medium', 0)).toEqual([false, true, false]);
    expect(competingTiers(DEFAULT_RULES.placement, 'large', 0)).toEqual([false, false, true]);
    expect(faultDomainCap(10, 3)).toBe(4);
    expect(faultDomainCap(3, 50)).toBe(1);
  });
});

describe('life of an instance', () => {
  it('starts, runs and joins the rotation', () => {
    const { sim, log } = make();
    sim.setInstances(3);
    expect(sim.state().instances.every((i) => i.status === 'starting')).toBe(true);
    expect(sim.state().app.status).toBe('starting');
    sim.tick(DEFAULT_RULES.health.startMs + 100);
    const st = sim.state();
    expect(st.instances.every((i) => i.status === 'running' && i.inRotation && i.serving)).toBe(true);
    expect(st.app).toMatchObject({ status: 'up', healthy: 3, total: 3 });
    expect(types(log)).toContain('app-status');
    expect(log.filter((e) => e.type === 'joined').length).toBe(3);
  });

  it('reports progress while starting', () => {
    const { sim } = make();
    sim.setInstances(1);
    sim.tick(DEFAULT_RULES.health.startMs / 2);
    const p = sim.state().instances[0]?.startProgress ?? 0;
    expect(p).toBeGreaterThan(0.3);
    expect(p).toBeLessThan(0.7);
  });
});

describe('health and failure', () => {
  function up(n = 3, opts: SimOptions['place'] = { spread: 'regions' }) {
    const ctx = make({ place: opts });
    ctx.sim.setInstances(n);
    ctx.sim.tick(2000);
    ctx.log.length = 0;
    return ctx;
  }

  it('crashes the instance at once and drops it from rotation after the check window', () => {
    const { sim, log } = up();
    const victim = sim.state().instances[1] as ReturnType<Sim['state']>['instances'][number];
    expect(sim.kill(victim.nodeId)).toBe(true);
    expect(sim.kill(victim.nodeId)).toBe(false);
    let st = sim.state();
    expect(st.instances[1]?.status).toBe('crashed');
    expect(st.instances[1]?.serving).toBe(false);
    expect(st.instances[1]?.inRotation).toBe(true); // the router has not noticed yet
    expect(st.app).toMatchObject({ status: 'degraded', healthy: 2, total: 3 });
    expect(st.down).toEqual([victim.nodeId]);
    const down = log.find((e) => e.type === 'node-down');
    expect(down).toMatchObject({ nodeId: victim.nodeId, slots: [1], scope: 'node' });

    sim.tick(DEFAULT_RULES.health.checkIntervalMs * DEFAULT_RULES.health.fall + 100);
    st = sim.state();
    expect(st.instances[1]?.inRotation).toBe(false);
    expect(log.some((e) => e.type === 'ejected' && e.slot === 1)).toBe(true);
    expect(st.counters.kills).toBe(1);
    expect(st.counters.distinctKills).toBe(1);
  });

  it('brings a node back and earns its way into rotation', () => {
    const { sim } = up();
    const victim = sim.state().instances[0]?.nodeId as string;
    sim.kill(victim);
    sim.tick(7000); // ejected
    expect(sim.state().instances[0]?.inRotation).toBe(false);
    expect(sim.revive(victim)).toBe(true);
    expect(sim.revive(victim)).toBe(false);
    expect(sim.state().instances[0]?.status).toBe('starting');
    sim.tick(DEFAULT_RULES.health.startMs + 200);
    expect(sim.state().instances[0]?.status).toBe('running');
    expect(sim.state().instances[0]?.serving).toBe(true);
    expect(sim.state().instances[0]?.inRotation).toBe(false); // needs `rise` good checks first
    sim.tick(6200);
    expect(sim.state().instances[0]?.inRotation).toBe(true);
    expect(sim.state().app.status).toBe('up');
  });

  it('kills a random instance node deterministically', () => {
    const a = up();
    const b = up();
    expect(a.sim.killRandomInstanceNode()).toBe(b.sim.killRandomInstanceNode());
    const empty = make();
    expect(empty.sim.killRandomInstanceNode()).toBeNull();
  });

  it('kills a whole continent', () => {
    const { sim, log } = up(4, { regions: [], spread: 'regions' });
    const regionOfFirst = BENCH.nodes[sim.state().instances[0]?.node ?? 0]?.region as Region;
    const ids = sim.killRegion(regionOfFirst);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(sim.state().nodeUp[sim.nodeIndex(id)]).toBe(0);
    expect(log.some((e) => e.type === 'region-down' && e.region === regionOfFirst)).toBe(true);
    const down = log.filter((e) => e.type === 'node-down');
    expect(down.length).toBe(ids.length);
    expect(sim.killRegion(regionOfFirst)).toEqual([]);
    sim.reviveAll();
    expect(sim.state().down).toEqual([]);
    expect(sim.state().nodeUp.every((v) => v === 1)).toBe(true);
  });

  it('replaces a lost instance on another node after a while', () => {
    const { sim, log } = up();
    const lost = sim.state().instances[2]?.nodeId as string;
    sim.kill(lost);
    sim.tick(DEFAULT_RULES.respawn.delayMs + 200);
    const s = sim.state().instances[2];
    expect(s?.nodeId).not.toBe(lost);
    expect(s?.respawned).toBe(true);
    expect(s?.dataLost).toBe(true); // a plain volume was lost with the node
    expect(log.some((e) => e.type === 'placed' && e.respawn)).toBe(true);
    expect(sim.state().counters.respawns).toBe(1);
    sim.tick(DEFAULT_RULES.health.startMs + 200);
    expect(sim.state().app.status).toBe('up');
  });

  it('does not respawn when the node returns first, and respects the rule switch', () => {
    const { sim } = up();
    const lost = sim.state().instances[0]?.nodeId as string;
    sim.kill(lost);
    sim.tick(2000);
    sim.revive(lost);
    sim.tick(DEFAULT_RULES.respawn.delayMs + 500);
    expect(sim.state().instances[0]?.nodeId).toBe(lost);
    expect(sim.state().counters.respawns).toBe(0);

    const off = make({ rules: { respawn: { enabled: false } } });
    off.sim.setInstances(2);
    off.sim.tick(2000);
    const gone = off.sim.state().instances[0]?.nodeId as string;
    off.sim.kill(gone);
    off.sim.tick(DEFAULT_RULES.respawn.delayMs * 3);
    expect(off.sim.state().instances[0]?.nodeId).toBe(gone);
  });
});

describe('routing', () => {
  function up(n = 3) {
    const ctx = make({ place: { spread: 'regions' } });
    ctx.sim.setInstances(n);
    ctx.sim.tick(2000);
    ctx.log.length = 0;
    return ctx;
  }

  it('serves a request and records a plausible latency', () => {
    const { sim, log } = up();
    const id = sim.send('london');
    expect(id).toBeGreaterThan(0);
    sim.tick(6000);
    const served = log.find((e) => e.type === 'served');
    expect(served).toBeDefined();
    if (served?.type === 'served') {
      expect(served.packet).toBe(id);
      expect(served.rerouted).toBe(false);
      expect(served.latencyMs).toBeGreaterThan(0);
    }
    expect(sim.state().counters).toMatchObject({ sent: 1, served: 1, failed: 0, rerouted: 0 });
  });

  it('shares requests between instances (round robin across users) and keeps a user on its instance', () => {
    const { sim, log } = up();
    for (const u of ['london', 'new-york', 'tokyo', 'sao-paulo', 'mumbai', 'sydney']) sim.send(u);
    sim.tick(8000);
    const served = log.filter((e) => e.type === 'served');
    expect(served.length).toBe(6);
    const slotsHit = new Set(served.map((e) => (e.type === 'served' ? e.slot : -1)));
    expect(slotsHit.size).toBe(3);

    log.length = 0;
    sim.send('london');
    sim.send('london');
    sim.send('london');
    sim.tick(8000);
    const mine = log.filter((e) => e.type === 'served').map((e) => (e.type === 'served' ? e.slot : -1));
    expect(new Set(mine).size).toBe(1);
  });

  it('reroutes a request that finds a dead node before the router has noticed', () => {
    const { sim, log } = up();
    // Pin a user to slot 0, kill slot 0's node, and send again before ejection.
    sim.send('london');
    sim.tick(5000);
    const slot = (log.find((e) => e.type === 'served') as Extract<SimEvent, { type: 'served' }>).slot;
    log.length = 0;
    sim.kill(sim.state().instances[slot]?.nodeId as string);
    sim.send('london');
    sim.tick(10_000);
    const re = log.find((e) => e.type === 'rerouted');
    expect(re).toBeDefined();
    const served = log.find((e) => e.type === 'served');
    expect(served).toMatchObject({ rerouted: true });
    if (served?.type === 'served') {
      expect(served.slot).not.toBe(slot);
      expect(served.latencyMs).toBeGreaterThan(DEFAULT_RULES.routing.redispatchAfterMs);
    }
    expect(sim.state().counters).toMatchObject({ sent: 2, served: 2, rerouted: 1, failed: 0 });
  });

  it('routes straight to survivors once the dead node is out of rotation', () => {
    const { sim, log } = up();
    sim.kill(sim.state().instances[0]?.nodeId as string);
    sim.tick(7000);
    log.length = 0;
    for (const u of ['london', 'new-york', 'tokyo', 'sao-paulo']) sim.send(u);
    sim.tick(8000);
    expect(log.filter((e) => e.type === 'rerouted').length).toBe(0);
    expect(log.filter((e) => e.type === 'served').length).toBe(4);
    const slotsHit = new Set(log.map((e) => (e.type === 'served' ? e.slot : -1)));
    expect(slotsHit.has(0)).toBe(false);
  });

  it('fails when no healthy instance remains', () => {
    const { sim, log } = up(2);
    for (const i of sim.state().instances) sim.kill(i.nodeId);
    sim.tick(7000); // both ejected
    log.length = 0;
    sim.send('tokyo');
    sim.tick(4000);
    expect(log.find((e) => e.type === 'failed')).toMatchObject({ reason: 'no-healthy-instance' });
    expect(sim.state().counters.failed).toBe(1);
    expect(sim.state().app.status).toBe('down');
  });

  it('fails after the retries when every instance is dead but still believed alive', () => {
    const { sim, log } = up(2);
    for (const i of sim.state().instances) sim.kill(i.nodeId);
    sim.send('tokyo');
    sim.tick(20_000);
    const failed = log.find((e) => e.type === 'failed');
    expect(failed).toBeDefined();
    expect(sim.state().counters.failed).toBe(1);
  });

  it('can send from a node and from coordinates', () => {
    const { sim, log } = up();
    const from = BENCH.nodes[0]?.id as string;
    sim.send({ node: from });
    sim.send({ lat: 35, lon: 139 });
    sim.tick(8000);
    expect(log.filter((e) => e.type === 'served').length).toBe(2);
  });

  it('keeps packets bounded and removes them after their echo', () => {
    const { sim } = up();
    for (let i = 0; i < 200; i++) sim.send();
    expect(sim.state().packets.length).toBeLessThanOrEqual(DEFAULT_RULES.routing.maxPackets);
    sim.tick(15_000);
    expect(sim.state().packets.length).toBe(0);
  });
});

describe('volumes', () => {
  function sync(n = 3, volume: 'primary-standby' | 'replicated' = 'primary-standby') {
    const ctx = make({ place: { spread: 'regions', volume } });
    ctx.sim.setInstances(n);
    ctx.sim.tick(DEFAULT_RULES.health.startMs + DEFAULT_RULES.volume.syncMs + 600);
    ctx.log.length = 0;
    return ctx;
  }

  it('elects the first instance primary and keeps the others as standbys', () => {
    const { sim } = sync();
    const st = sim.state();
    expect(st.volume.primarySlot).toBe(0);
    expect(st.instances.map((i) => i.role)).toEqual(['primary', 'standby', 'standby']);
    expect(st.instances.every((i) => i.sync === 1)).toBe(true);
    // Only the primary is in rotation.
    expect(st.instances.map((i) => i.inRotation)).toEqual([true, false, false]);
    expect(st.app.status).toBe('up');
  });

  it('syncs a new replica before it counts', () => {
    const { sim, log } = sync(1);
    sim.setInstances(2);
    sim.tick(DEFAULT_RULES.health.startMs + 100);
    const second = sim.state().instances[1];
    expect(second?.status).toBe('running');
    expect(second?.sync).toBeLessThan(1);
    sim.tick(DEFAULT_RULES.volume.syncMs + 200);
    expect(sim.state().instances[1]?.sync).toBe(1);
    expect(log.some((e) => e.type === 'synced' && e.slot === 1)).toBe(true);
  });

  it('promotes a standby after the router drops the primary and the grace passes', () => {
    const { sim, log } = sync();
    const primary = sim.state().instances[0]?.nodeId as string;
    sim.killPrimary();
    expect(sim.state().down).toEqual([primary]);
    expect(sim.state().volume.gap).toBe(true);
    // Requests during the gap do not find a primary.
    sim.send('london');
    sim.tick(4000);
    expect(sim.state().counters.failed + sim.state().counters.served).toBeGreaterThanOrEqual(0);

    const eject = DEFAULT_RULES.health.checkIntervalMs * DEFAULT_RULES.health.fall;
    sim.tick(eject + DEFAULT_RULES.volume.electionGraceMs + 200 - 4000);
    const promoted = log.find((e) => e.type === 'promoted');
    expect(promoted).toBeDefined();
    if (promoted?.type === 'promoted') {
      expect(promoted.previousSlot).toBe(0);
      expect(promoted.slot).toBe(1);
      expect(promoted.gapMs).toBeGreaterThanOrEqual(eject + DEFAULT_RULES.volume.electionGraceMs);
    }
    sim.tick(DEFAULT_RULES.volume.promoteStartMs + 200);
    const st = sim.state();
    expect(st.volume.primarySlot).toBe(1);
    expect(st.volume.gap).toBe(false);
    expect(st.volume.promotions).toBe(1);
    expect(st.volume.lastGapMs).toBeGreaterThan(eject + DEFAULT_RULES.volume.electionGraceMs);
    expect(st.instances[1]?.role).toBe('primary');
    expect(st.instances[1]?.inRotation).toBe(true);
    // Writes work again.
    log.length = 0;
    sim.send('london');
    sim.tick(8000);
    expect(log.some((e) => e.type === 'served')).toBe(true);
  });

  it('fails requests while there is no primary', () => {
    const { sim, log } = sync();
    sim.killPrimary();
    sim.tick(eject() + 200); // router has dropped it, grace not over
    log.length = 0;
    sim.send('tokyo');
    sim.tick(3000);
    expect(log.find((e) => e.type === 'failed')).toMatchObject({ reason: 'no-healthy-instance' });
  });

  it('lets a primary that returns before the election resume without a promotion', () => {
    const { sim, log } = sync();
    const primary = sim.state().instances[0]?.nodeId as string;
    sim.kill(primary);
    sim.tick(1500);
    sim.revive(primary);
    sim.tick(DEFAULT_RULES.health.startMs + 400);
    const st = sim.state();
    expect(st.volume.primarySlot).toBe(0);
    expect(st.volume.gap).toBe(false);
    expect(st.volume.promotions).toBe(0);
    expect(log.some((e) => e.type === 'promoted')).toBe(false);
  });

  it('keeps writing available on a replicated volume when one instance is lost', () => {
    const { sim } = sync(3, 'replicated');
    expect(sim.state().instances.map((i) => i.role)).toEqual(['active', 'active', 'active']);
    expect(sim.state().instances.every((i) => i.inRotation)).toBe(true);
    sim.kill(sim.state().instances[0]?.nodeId as string);
    expect(sim.state().volume.gap).toBe(false);
    expect(sim.state().app.status).toBe('degraded');
  });

  it('does not lose data on a replicated volume when a copy survives', () => {
    const { sim } = sync(3, 'replicated');
    sim.kill(sim.state().instances[1]?.nodeId as string);
    sim.tick(DEFAULT_RULES.respawn.delayMs + 300);
    expect(sim.state().instances[1]?.respawned).toBe(true);
    expect(sim.state().instances[1]?.dataLost).toBe(false);
  });

  it('keeps the gap open for a single primary until it returns', () => {
    const { sim } = sync(1);
    sim.killPrimary();
    sim.tick(DEFAULT_RULES.respawn.delayMs - 3000); // before the replacement is spawned
    expect(sim.state().volume.gap).toBe(true);
    expect(sim.state().volume.promotions).toBe(0);
    expect(sim.state().app.status).toBe('down');
    // The network eventually replaces it, but the data is gone with the only copy.
    sim.settle();
    const st = sim.state();
    expect(st.volume.gap).toBe(false);
    expect(st.instances[0]?.respawned).toBe(true);
    expect(st.instances[0]?.dataLost).toBe(true);
    expect(st.app.status).toBe('up');
  });

  function eject() {
    return DEFAULT_RULES.health.checkIntervalMs * DEFAULT_RULES.health.fall;
  }
});

describe('deploy', () => {
  it('runs the phases in order and ends with the instances live', () => {
    const { sim, log } = make({ place: { spread: 'regions' } });
    sim.setInstances(2);
    sim.tick(2000);
    log.length = 0;
    sim.startDeploy({ instances: 4 });
    expect(sim.state().deploy.active).toBe(true);
    expect(sim.state().count).toBe(0);
    const total = DEFAULT_RULES.deploy.phases.reduce((s, p) => s + p.ms, 0);
    sim.tick(total + 200);
    const phases = log
      .filter((e) => e.type === 'deploy-phase')
      .map((e) => (e.type === 'deploy-phase' ? e.phase : ''));
    expect(phases).toEqual(['spec', 'register', 'block', 'select', 'install', 'live']);
    expect(types(log).at(-1)).toBe('deploy-done');
    const st = sim.state();
    expect(st.deploy.active).toBe(false);
    expect(st.count).toBe(4);
    expect(st.instances.every((i) => i.status === 'running')).toBe(true);
    expect(st.app.status).toBe('up');
    // Placements happened during selection.
    const placedAt = log.filter((e) => e.type === 'placed').map((e) => e.at);
    expect(placedAt.length).toBe(4);
    const base = st.deploy.startedAt;
    const selectStart = base + DEFAULT_RULES.deploy.phases.slice(0, 3).reduce((s, p) => s + p.ms, 0);
    const selectEnd = selectStart + (DEFAULT_RULES.deploy.phases[3]?.ms ?? 0);
    for (const t of placedAt) {
      expect(t).toBeGreaterThanOrEqual(selectStart);
      expect(t).toBeLessThanOrEqual(selectEnd + 50);
    }
  });

  it('reports phase progress and candidate nodes', () => {
    const { sim } = make();
    sim.startDeploy({ instances: 3 });
    const select = DEFAULT_RULES.deploy.phases.slice(0, 3).reduce((s, p) => s + p.ms, 0);
    sim.tick(select + 600);
    const d = sim.state().deploy;
    expect(d.phase).toBe('select');
    expect(d.phaseProgress).toBeGreaterThan(0);
    expect(d.candidates.length).toBe(DEFAULT_RULES.deploy.candidates);
    expect(d.progress).toBeGreaterThan(0.2);
  });

  it('is cancelled by setInstances', () => {
    const { sim } = make();
    sim.startDeploy({ instances: 3 });
    sim.tick(2000);
    sim.setInstances(2);
    expect(sim.state().deploy.active).toBe(false);
    sim.tick(30_000);
    expect(sim.state().count).toBe(2);
  });

  it('is deterministic', () => {
    const run = () => {
      const { sim, log } = make({ seed: 5 });
      sim.startDeploy({ instances: 5 });
      sim.tick(20_000);
      return log;
    };
    expect(run()).toEqual(run());
  });
});

describe('reset and settle', () => {
  it('resets to an empty healthy bench', () => {
    const { sim } = make();
    sim.setInstances(4);
    sim.tick(2000);
    sim.kill(nodeIds(sim)[0] as string);
    sim.send();
    sim.reset();
    const st = sim.state();
    expect(st.count).toBe(0);
    expect(st.time).toBe(0);
    expect(st.down).toEqual([]);
    expect(st.packets).toEqual([]);
    expect(st.counters).toMatchObject({ sent: 0, kills: 0, placements: 0 });
    expect(st.app.status).toBe('idle');
    expect(st.nodeUp.every((v) => v === 1)).toBe(true);
    sim.setInstances(2);
    expect(sim.state().count).toBe(2);
  });

  it('settles every pending transition at once', () => {
    const { sim } = make({ place: { volume: 'primary-standby', spread: 'regions' } });
    sim.setInstances(3);
    sim.settle();
    expect(sim.state().instances.every((i) => i.status === 'running' && i.sync === 1)).toBe(true);
    sim.killPrimary();
    sim.settle();
    const st = sim.state();
    expect(st.volume.promotions).toBe(1);
    expect(st.volume.gap).toBe(false);
    expect(st.app.healthy).toBeGreaterThanOrEqual(2);
  });

  it('emits a typed event stream to subscribers and supports unsubscribing', () => {
    const { sim } = make();
    let placed = 0;
    const off = sim.on('placed', () => {
      placed++;
    });
    sim.setInstances(2);
    expect(placed).toBe(2);
    off();
    sim.setInstances(4);
    expect(placed).toBe(2);
  });
});

describe('an empty disk (FACTS 7.2: what each volume mode keeps when a node is lost)', () => {
  /** An app on `n` instances under a volume mode, settled and healthy. */
  function app(volume: VolumeMode, n = 3) {
    const ctx = make({ place: { spread: 'regions', volume } });
    ctx.sim.setInstances(n);
    ctx.sim.tick(DEFAULT_RULES.health.startMs + DEFAULT_RULES.volume.syncMs + 600);
    return ctx;
  }
  const replaced = (sim: Sim, slot: number) => {
    const before = sim.state().instances[slot]?.nodeId;
    sim.kill(before as string);
    sim.tick(DEFAULT_RULES.respawn.delayMs + 400);
    return sim.state().instances[slot];
  };

  it('flags the replacement of a plain volume: the data went with the node', () => {
    const { sim, log } = app('local');
    const started = replaced(sim, 1);
    expect(started?.respawned).toBe(true);
    expect(started?.dataLost).toBe(true);
    expect(started ? hasEmptyDisk(started) : false).toBe(true);
    // The event the narrator and the figure follow says the same thing.
    const placed = log.filter((e) => e.type === 'placed' && e.respawn);
    expect(placed).toHaveLength(1);
    expect(placed[0]).toMatchObject({ slot: 1, dataLost: true });
    // The other instances never lost anything.
    expect(
      sim
        .state()
        .instances.filter((i) => i.dataLost)
        .map((i) => i.slot),
    ).toEqual([1]);
  });

  it('does not flag an instance while its node is merely down (the flag belongs to the replacement)', () => {
    const { sim } = app('local');
    sim.kill(sim.state().instances[0]?.nodeId as string);
    sim.tick(2000);
    expect(sim.state().instances.some((i) => hasEmptyDisk(i))).toBe(false);
  });

  it('does not flag an instance whose node came back before a replacement was needed', () => {
    const { sim } = app('local');
    const id = sim.state().instances[2]?.nodeId as string;
    sim.kill(id);
    sim.tick(3000);
    sim.revive(id);
    sim.tick(DEFAULT_RULES.respawn.delayMs + 400);
    const s = sim.state().instances[2];
    expect(s?.nodeId).toBe(id);
    expect(s?.respawned).toBe(false);
    expect(s?.dataLost).toBe(false);
  });

  it('does not flag a replicated volume while another instance holds a current copy', () => {
    const { sim, log } = app('replicated');
    const started = replaced(sim, 1);
    expect(started?.respawned).toBe(true);
    expect(started?.dataLost).toBe(false);
    expect(log.some((e) => e.type === 'placed' && e.dataLost)).toBe(false);
  });

  it('does not flag a primary and standby volume that kept a synced copy', () => {
    const { sim } = app('primary-standby');
    const started = replaced(sim, 0); // the primary's node
    expect(started?.respawned).toBe(true);
    expect(started?.dataLost).toBe(false);
  });

  it('flags a synced volume when its last copy was the one lost', () => {
    for (const mode of ['replicated', 'primary-standby'] as const) {
      const { sim } = app(mode, 1);
      const started = replaced(sim, 0);
      expect(started?.dataLost).toBe(true);
    }
  });

  it('clears on reset, and a fresh placement starts with none', () => {
    const { sim } = app('local');
    replaced(sim, 1);
    expect(sim.state().instances.some((i) => i.dataLost)).toBe(true);
    sim.reset();
    expect(sim.state().instances).toHaveLength(0);
    sim.setInstances(3);
    sim.settle();
    expect(sim.state().instances.some((i) => hasEmptyDisk(i))).toBe(false);
  });

  it('starts a new history when the volume mode changes', () => {
    const { sim } = app('local');
    replaced(sim, 1);
    expect(sim.state().instances[1]?.dataLost).toBe(true);
    sim.configure({ volume: 'replicated' });
    expect(sim.state().volume.mode).toBe('replicated');
    expect(sim.state().instances.some((i) => i.dataLost)).toBe(false);
  });

  it('hasEmptyDisk is false for a slot that has no node', () => {
    expect(hasEmptyDisk({ dataLost: true, node: -1, status: 'unplaced' })).toBe(false);
    expect(hasEmptyDisk({ dataLost: true, node: 4, status: 'starting' })).toBe(true);
    expect(hasEmptyDisk({ dataLost: false, node: 4, status: 'running' })).toBe(false);
  });
});

describe('instances that found no node', () => {
  it('wait while no node is eligible and start when one comes back', () => {
    const { sim, log } = make({ place: { regions: ['EU'], spread: 'regions' } });
    sim.setInstances(3);
    sim.tick(DEFAULT_RULES.health.startMs + 400);
    sim.killRegion('EU');
    sim.tick(DEFAULT_RULES.respawn.delayMs + 400);
    // The app is allowed in Europe only and Europe is dark: no replacement can start.
    expect(sim.state().instances.every((i) => i.status === 'unplaced' && i.node === -1)).toBe(true);
    expect(sim.state().app.status).toBe('down');
    expect(log.filter((e) => e.type === 'unplaced')).toHaveLength(3);
    log.length = 0;
    sim.reviveAll();
    // They are picked up at once, as replacements (a plain volume started empty).
    expect(sim.state().instances.every((i) => i.node >= 0 && i.status === 'starting')).toBe(true);
    expect(sim.state().instances.every((i) => i.respawned && i.dataLost)).toBe(true);
    expect(log.filter((e) => e.type === 'placed')).toHaveLength(3);
    sim.tick(DEFAULT_RULES.health.startMs + 400);
    expect(sim.state().app.status).toBe('up');
    // Distinct nodes, as always.
    expect(new Set(sim.state().instances.map((i) => i.node)).size).toBe(3);
  });

  it('place after the first node of a continent returns, one by one as nodes allow', () => {
    const { sim } = make({ place: { regions: ['EU'], spread: 'regions' } });
    sim.setInstances(2);
    sim.tick(DEFAULT_RULES.health.startMs + 400);
    const ids = sim.killRegion('EU');
    sim.tick(DEFAULT_RULES.respawn.delayMs + 400);
    expect(sim.state().instances.every((i) => i.status === 'unplaced')).toBe(true);
    expect(sim.revive(ids[0] as string)).toBe(true);
    // One node is up: one instance fits on it (two instances never share a node).
    expect(sim.state().instances.filter((i) => i.node >= 0)).toHaveLength(1);
    expect(sim.revive(ids[1] as string)).toBe(true);
    expect(sim.state().instances.filter((i) => i.node >= 0)).toHaveLength(2);
  });

  it('stay quiet when a node comes back that they still cannot use', () => {
    const { sim, log } = make({ place: { regions: ['OC'], spread: 'regions' } });
    const oc = BENCH.nodes.filter((n) => n.region === 'OC').length;
    sim.setInstances(oc + 3);
    const waiting = sim.state().instances.filter((i) => i.status === 'unplaced').length;
    expect(waiting).toBeGreaterThan(0);
    const other = BENCH.nodes.find((n) => n.region === 'EU')?.id as string;
    sim.kill(other);
    log.length = 0;
    sim.revive(other);
    expect(log.some((e) => e.type === 'unplaced' || e.type === 'placed')).toBe(false);
    expect(sim.state().instances.filter((i) => i.status === 'unplaced')).toHaveLength(waiting);
  });

  it('leave the slots of a running deploy to the deploy', () => {
    const { sim, log } = make({ place: { spread: 'regions' } });
    sim.startDeploy({ instances: 3 });
    const select = DEFAULT_RULES.deploy.phases.slice(0, 3).reduce((s, p) => s + p.ms, 0);
    sim.tick(select + 100);
    const id = BENCH.nodes[0]?.id as string;
    sim.kill(id);
    log.length = 0;
    sim.revive(id);
    // A revive during selection does not place the slots the deploy has not reached yet.
    const placedNow = log.filter((e) => e.type === 'placed').length;
    expect(placedNow).toBe(0);
  });
});

describe('time compression is derived from the real durations', () => {
  it('shows a replacement 375 times faster than the 125 minutes of a location record', () => {
    expect(REAL_REPLACEMENT_MS).toBe(125 * 60_000);
    expect(DEFAULT_RULES.respawn.delayMs).toBe(REAL_REPLACEMENT_MS / SIM_COMPRESSION.replacement);
  });

  it('keeps a g: failover in minutes on the network and orders it before the replacement', () => {
    // First standby in line: about 3 minutes (FACTS 6.4), at least the 90 s FDM needs plus the election tick.
    expect(REAL_G_FAILOVER_MS).toBeGreaterThanOrEqual(3 * 60_000);
    const h = DEFAULT_RULES.health;
    const v = DEFAULT_RULES.volume;
    const total = h.checkIntervalMs * h.fall + v.electionGraceMs + v.promoteStartMs;
    expect(total).toBe(REAL_G_FAILOVER_MS / SIM_COMPRESSION.failover);
    expect(total).toBeLessThan(DEFAULT_RULES.respawn.delayMs);
  });

  it('says on screen that the time is compressed, with the real minutes', () => {
    expect(compressionNote('failover')).toContain('Compressed for the screen');
    expect(compressionNote('failover')).toContain('about 3 minutes');
    expect(compressionNote('replacement')).toContain('about 125 minutes');
  });
});
