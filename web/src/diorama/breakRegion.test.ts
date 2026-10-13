import { describe, expect, it } from 'vitest';
import { instancesByRegion, regionHasNodeUp, regionToBreak } from './breakRegion';
import { buildSampleBench } from './model';
import { REGIONS, type Region } from './model/types';
import { createSim, DEFAULT_RULES } from './sim';

const bench = buildSampleBench(4);

function app(n: number, place: Parameters<ReturnType<typeof createSim>['setInstances']>[1]) {
  const sim = createSim({ bench, seed: 5 });
  sim.setInstances(n, { waitedMin: 120, ...place });
  sim.tick(DEFAULT_RULES.health.startMs + 200);
  return sim;
}

describe('which continent "Break region" takes offline', () => {
  it('is the one holding the most running instances when none is chosen', () => {
    const sim = app(3, { regions: ['EU'] });
    expect(instancesByRegion(bench, sim.state()).EU).toBe(3);
    expect(regionToBreak(bench, sim.state(), null)).toBe('EU');
  });

  it('counts instances, not nodes, and breaks ties in display order', () => {
    const sim = app(3, { spread: 'regions' });
    const counts = instancesByRegion(bench, sim.state());
    const used = REGIONS.filter((r) => counts[r] > 0);
    expect(used.length).toBe(3);
    // One instance each: the first continent in display order wins the tie.
    expect(regionToBreak(bench, sim.state(), null)).toBe(used[0]);
  });

  it('follows the instances when they are unevenly placed', () => {
    // Three instances over two continents: one of them holds two.
    const sim = app(3, { regions: ['EU', 'NA'], spread: 'regions' });
    const counts = instancesByRegion(bench, sim.state());
    expect(counts.EU + counts.NA).toBe(3);
    expect(Math.max(counts.EU, counts.NA)).toBe(2);
    expect(regionToBreak(bench, sim.state(), null)).toBe(counts.EU > counts.NA ? 'EU' : 'NA');
  });

  it("honours the visitor's own choice while that continent has a node up", () => {
    const sim = app(3, { regions: ['EU'] });
    expect(regionToBreak(bench, sim.state(), 'AS')).toBe('AS');
    expect(regionToBreak(bench, sim.state(), 'EU')).toBe('EU');
  });

  it('falls back to the busiest continent when the chosen one is already dark', () => {
    const sim = app(3, { spread: 'regions' });
    const dark = REGIONS.find((r) => instancesByRegion(bench, sim.state())[r] === 0) as Region;
    sim.killRegion(dark);
    expect(regionHasNodeUp(bench, sim.state(), dark)).toBe(false);
    const pick = regionToBreak(bench, sim.state(), dark);
    expect(pick).not.toBe(dark);
    expect(pick).not.toBeNull();
    expect(instancesByRegion(bench, sim.state())[pick as Region]).toBeGreaterThan(0);
  });

  it('does not count instances on nodes that are down, and is null when nothing is left to break', () => {
    const sim = app(3, { regions: ['EU'] });
    expect(sim.killRegion('EU').length).toBeGreaterThan(0);
    expect(instancesByRegion(bench, sim.state()).EU).toBe(0);
    expect(regionToBreak(bench, sim.state(), null)).toBeNull();
    // With a choice it still offers a continent that has nodes up (it is the visitor's call).
    expect(regionToBreak(bench, sim.state(), 'NA')).toBe('NA');
  });

  it('is null for an empty bench and counts a starting instance', () => {
    const empty = createSim({ bench, seed: 5 });
    expect(regionToBreak(bench, empty.state(), null)).toBeNull();
    const starting = createSim({ bench, seed: 5 });
    starting.setInstances(1, { regions: ['AS'] });
    expect(starting.state().instances[0]?.status).toBe('starting');
    expect(regionToBreak(bench, starting.state(), null)).toBe('AS');
  });

  it('takes every node of the continent and reports it once, counted by the simulation', () => {
    const sim = app(3, { regions: ['EU'] });
    const inEu = bench.nodes.filter((n) => n.region === 'EU').length;
    const ids = sim.killRegion(regionToBreak(bench, sim.state(), null) as Region);
    expect(ids).toHaveLength(inEu);
    expect(sim.state().counters.distinctKills).toBe(inEu);
    expect(sim.state().app.status).toBe('down');
  });
});
