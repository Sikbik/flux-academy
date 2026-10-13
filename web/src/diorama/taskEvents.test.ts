import { describe, expect, it } from 'vitest';
import { buildSampleBench } from './model';
import type { Region } from './model/types';
import { createSim, type SimEvent } from './sim';
import { createKillTally } from './taskEvents';

const bench = buildSampleBench(6);

const down = (nodeId: string, scope: 'node' | 'region' = 'node'): SimEvent => ({
  type: 'node-down',
  at: 0,
  node: 0,
  nodeId,
  label: nodeId,
  region: 'EU',
  slots: [],
  scope,
});
const regionDown = (nodes: number): SimEvent => ({
  type: 'region-down',
  at: 0,
  region: 'EU',
  nodes,
  instances: 0,
});

describe('the kill tally a lesson step keeps', () => {
  it('counts distinct nodes taken offline one at a time', () => {
    const t = createKillTally();
    expect(t.apply(down('a'))).toBe(1);
    expect(t.apply(down('b'))).toBe(2);
    expect(t.apply(down('a'))).toBe(2); // the same node twice is still two nodes
    expect(t.size).toBe(2);
    expect(t.has('b')).toBe(true);
    expect(t.has('z')).toBe(false);
  });

  it('counts a continent once, after all of its nodes', () => {
    const t = createKillTally();
    expect(t.apply(down('a', 'region'))).toBeNull();
    expect(t.apply(down('b', 'region'))).toBeNull();
    expect(t.apply(down('c', 'region'))).toBeNull();
    expect(t.size).toBe(3);
    expect(t.apply(regionDown(3))).toBe(3);
  });

  it('adds a continent to nodes already killed without counting them twice', () => {
    const t = createKillTally();
    t.apply(down('a'));
    t.apply(down('b', 'region'));
    t.apply(down('a', 'region'));
    expect(t.apply(regionDown(2))).toBe(2);
  });

  it('forgets everything when a step begins, and ignores other events', () => {
    const t = createKillTally();
    t.apply(down('a'));
    t.reset();
    expect(t.size).toBe(0);
    expect(t.apply({ type: 'reset', at: 0 })).toBeNull();
    expect(
      t.apply({ type: 'node-up', at: 0, node: 0, nodeId: 'a', label: 'a', region: 'EU', slots: [] }),
    ).toBeNull();
    expect(t.size).toBe(0);
  });

  it('reports what a real simulation does: one report per kill, one per continent', () => {
    const sim = createSim({ bench, seed: 2, place: { waitedMin: 120, spread: 'regions' } });
    sim.setInstances(3);
    const t = createKillTally();
    const reports: number[] = [];
    sim.on('*', (e) => {
      const n = t.apply(e);
      if (n !== null) reports.push(n);
    });
    const first = sim.killRandomInstanceNode() as string;
    expect(reports).toEqual([1]);
    expect(sim.kill(first)).toBe(false); // already down: nothing happens, nothing is reported
    expect(reports).toEqual([1]);
    const region = bench.nodes[sim.state().instances.find((i) => sim.state().nodeUp[i.node] === 1)?.node ?? 0]
      ?.region as Region;
    const upInRegion = bench.nodes.filter(
      (n) => n.region === region && sim.state().nodeUp[n.index] === 1,
    ).length;
    const ids = sim.killRegion(region);
    expect(ids).toHaveLength(upInRegion);
    // One report for the whole continent, counting the node killed before it as well.
    expect(reports).toHaveLength(2);
    const regionNodeIds = new Set(bench.nodes.filter((n) => n.region === region).map((n) => n.id));
    const distinct = new Set<string>([first, ...ids]).size;
    expect(reports[1]).toBe(distinct);
    expect(regionNodeIds.size).toBeGreaterThanOrEqual(upInRegion);
  });
});
