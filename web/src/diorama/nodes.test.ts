import { describe, expect, it } from 'vitest';
import { buildSampleBench } from './model';
import { buildNodeItems, notableNodes } from './nodes';
import { createSim, DEFAULT_RULES, type VolumeMode } from './sim';

const bench = buildSampleBench(2);

describe('node list', () => {
  it('lists the specimen first, then the instances, then notable nodes', () => {
    const sim = createSim({ bench, seed: 3 });
    sim.setInstances(3);
    sim.tick(8000);
    const items = buildNodeItems(bench, sim.state(), { interactive: true, specimen: true });
    expect(items[0]?.kind).toBe('specimen');
    expect(items.filter((i) => i.kind === 'instance')).toHaveLength(3);
    expect(items.filter((i) => i.kind === 'notable').length).toBeLessThanOrEqual(12);
    for (const i of items.filter((x) => x.kind === 'instance')) expect(i.action).toBe('kill');
    const keys = new Set(items.map((i) => i.key));
    expect(keys.size).toBe(items.length);
  });

  it('offers to bring a killed instance back, and lists the offline node once', () => {
    const sim = createSim({ bench, seed: 3 });
    sim.setInstances(2);
    sim.tick(8000);
    const id = sim.killRandomInstanceNode();
    expect(id).not.toBeNull();
    const items = buildNodeItems(bench, sim.state(), { interactive: true, specimen: true });
    const dead = items.filter((i) => i.action === 'revive');
    expect(dead.length).toBeGreaterThanOrEqual(1);
    expect(items.filter((i) => i.node === bench.nodes[sim.nodeIndex(id as string)]?.index)).toHaveLength(1);
  });

  it('is read-only when the scene has no controls', () => {
    const sim = createSim({ bench, seed: 3 });
    sim.setInstances(2);
    sim.tick(8000);
    const items = buildNodeItems(bench, sim.state(), { interactive: false, specimen: false });
    expect(items.some((i) => i.action !== null)).toBe(false);
    expect(items.some((i) => i.kind === 'specimen')).toBe(false);
  });

  it('picks the tallest pillar of each region first', () => {
    const picked = notableNodes(bench, 12, new Set());
    expect(picked.length).toBeLessThanOrEqual(12);
    const regions = new Set(picked.slice(0, 6).map((i) => bench.nodes[i]?.region));
    expect(regions.size).toBeGreaterThanOrEqual(5);
  });

  describe('an empty disk', () => {
    function afterLoss(volume: VolumeMode) {
      const sim = createSim({ bench, seed: 3, place: { spread: 'regions', volume } });
      sim.setInstances(3);
      sim.tick(DEFAULT_RULES.health.startMs + DEFAULT_RULES.volume.syncMs + 600);
      sim.kill(sim.state().instances[1]?.nodeId as string);
      sim.tick(DEFAULT_RULES.respawn.delayMs + 400);
      return sim;
    }
    const instance = (items: ReturnType<typeof buildNodeItems>, slot: number) =>
      items.find((i) => i.kind === 'instance' && i.slot === slot);

    it('is said in the label of the instance that restarted empty, when the figure draws it', () => {
      const sim = afterLoss('local');
      const items = buildNodeItems(bench, sim.state(), {
        interactive: true,
        specimen: true,
        emptyDisk: true,
      });
      expect(instance(items, 1)?.label).toContain('restarted with an empty disk');
      expect(instance(items, 0)?.label).not.toContain('empty disk');
      expect(instance(items, 2)?.label).not.toContain('empty disk');
    });

    it('is left out when the figure does not draw it, so the list never knows more than the picture', () => {
      const sim = afterLoss('local');
      const items = buildNodeItems(bench, sim.state(), { interactive: true, specimen: true });
      expect(items.some((i) => i.label.includes('empty disk'))).toBe(false);
    });

    it('is not said for a volume that kept its data', () => {
      for (const mode of ['replicated', 'primary-standby'] as const) {
        const sim = afterLoss(mode);
        const items = buildNodeItems(bench, sim.state(), {
          interactive: true,
          specimen: true,
          emptyDisk: true,
        });
        expect(items.some((i) => i.label.includes('empty disk'))).toBe(false);
      }
    });

    it('goes away on reset', () => {
      const sim = afterLoss('local');
      sim.reset();
      sim.setInstances(3);
      sim.settle();
      const items = buildNodeItems(bench, sim.state(), {
        interactive: true,
        specimen: true,
        emptyDisk: true,
      });
      expect(items.some((i) => i.label.includes('empty disk'))).toBe(false);
    });
  });
});
