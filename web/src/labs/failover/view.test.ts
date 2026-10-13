import { describe, expect, it } from 'vitest';
import { buildSampleBench, REGION_NAMES } from '@/diorama/model';
import { createSim } from '@/diorama/sim';
import {
  buildView,
  busiestRegion,
  describeInstance,
  EMPTY_VIEW,
  instancesIn,
  summarizeDraw,
  viewSignature,
} from './view';

function fixture(seed = 1) {
  const bench = buildSampleBench(seed, { resolution: 'low' });
  const sim = createSim({ bench, seed, place: { spread: 'random', waitedMin: 120 } });
  return { bench, sim };
}

describe('describeInstance', () => {
  it('tells a dark node the router has not noticed from one it has dropped', () => {
    const dark = describeInstance({ placed: true, up: false, status: 'crashed', inRotation: true });
    const dropped = describeInstance({ placed: true, up: false, status: 'crashed', inRotation: false });
    expect(dark.word).toBe('Dark');
    expect(dropped.word).toBe('Dropped');
    expect(dark.hint).not.toBe(dropped.hint);
  });

  it('separates serving, waiting for checks, starting and not placed', () => {
    expect(describeInstance({ placed: true, up: true, status: 'running', inRotation: true }).word).toBe(
      'Serving',
    );
    expect(describeInstance({ placed: true, up: true, status: 'running', inRotation: false }).word).toBe(
      'Waiting',
    );
    expect(describeInstance({ placed: true, up: true, status: 'starting', inRotation: false }).word).toBe(
      'Starting',
    );
    expect(describeInstance({ placed: false, up: false, status: 'unplaced', inRotation: false }).word).toBe(
      'Not placed',
    );
  });
});

describe('buildView', () => {
  it('lists every instance with a synthetic address and a place', () => {
    const { bench, sim } = fixture();
    sim.setInstances(3);
    sim.settle();
    const v = buildView(sim.state(), bench);
    expect(v.total).toBe(3);
    expect(v.instances).toHaveLength(3);
    for (const i of v.instances) {
      expect(i.placed).toBe(true);
      expect(i.ip).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113|100\.\d+)\./);
      expect(i.place.length).toBeGreaterThan(0);
    }
    expect(v.status).toBe('up');
    expect(v.offline).toHaveLength(0);
  });

  it('reports a killed instance node as offline and its instance as dark, then dropped', () => {
    const { bench, sim } = fixture();
    sim.setInstances(3);
    sim.settle();
    const id = sim.killRandomInstanceNode();
    expect(id).not.toBeNull();
    let v = buildView(sim.state(), bench);
    expect(v.offline.map((o) => o.nodeId)).toContain(id);
    expect(v.offline.find((o) => o.nodeId === id)?.holdsInstance).toBe(true);
    const row = v.instances.find((i) => i.nodeId === id);
    expect(row?.up).toBe(false);
    expect(row?.word).toBe('Dark');
    sim.tick(8000);
    v = buildView(sim.state(), bench);
    const after = v.instances.find((i) => i.nodeId === id);
    // Either still dropped, or already replaced on another node within the compressed respawn delay.
    expect(['Dropped', 'Starting', 'Waiting', 'Serving']).toContain(after?.word ?? 'Dropped');
  });

  it('keeps the signature still while nothing a panel shows changes', () => {
    const { bench, sim } = fixture();
    sim.setInstances(2);
    sim.settle();
    const a = viewSignature(buildView(sim.state(), bench));
    sim.tick(40);
    const b = viewSignature(buildView(sim.state(), bench));
    expect(b).toBe(a);
    sim.killRandomInstanceNode();
    expect(viewSignature(buildView(sim.state(), bench))).not.toBe(a);
  });
});

describe('regions', () => {
  it('finds the busiest continent and summarises a draw', () => {
    const { bench, sim } = fixture(3);
    sim.setInstances(3, { regions: ['EU'] });
    sim.settle();
    const v = buildView(sim.state(), bench);
    expect(busiestRegion(v)).toBe('EU');
    expect(instancesIn(v, 'EU')).toBe(3);
    expect(summarizeDraw(v, REGION_NAMES)).toBe('3 in Europe');
    expect(v.continents).toEqual(['EU']);
  });

  it('is empty for an empty view', () => {
    expect(busiestRegion(EMPTY_VIEW)).toBeNull();
    expect(summarizeDraw(EMPTY_VIEW, REGION_NAMES)).toBe('No instances');
  });
});
