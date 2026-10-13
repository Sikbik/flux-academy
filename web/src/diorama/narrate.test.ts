import { describe, expect, it } from 'vitest';
import { Narrator } from './narrate';
import type { SimEvent } from './sim/types';

const labels: Record<string, string> = {
  n1: 'Frankfurt, Germany',
  n2: 'Toronto, Canada',
  n3: 'Lagos, Nigeria',
};

function make(): Narrator {
  return new Narrator({ labelOf: (id) => labels[id] ?? id, regionName: (r) => (r === 'EU' ? 'Europe' : r) });
}

const placed = (label: string, respawn = false, dataLost = false, slot = 0): SimEvent => ({
  type: 'placed',
  at: 0,
  slot,
  node: 0,
  nodeId: 'n1',
  label,
  region: 'EU',
  tier: 'cumulus',
  respawn,
  dataLost,
});
const down = (label: string, nodeId = 'n1', scope: 'node' | 'region' = 'node'): SimEvent => ({
  type: 'node-down',
  at: 1,
  node: 0,
  nodeId,
  label,
  region: 'EU',
  slots: [0],
  scope,
});
const rerouted: SimEvent = {
  type: 'rerouted',
  at: 2,
  packet: 1,
  userId: 'london',
  from: 0,
  to: 1,
  fromNodeId: 'n1',
  toNodeId: 'n2',
  retries: 1,
};
const served = (packet: number): SimEvent => ({
  type: 'served',
  at: 3,
  packet,
  userId: 'london',
  slot: 0,
  nodeId: 'n2',
  latencyMs: 34,
  rerouted: false,
});

describe('narrator', () => {
  it('coalesces a burst into one paragraph', () => {
    const n = make();
    n.push(placed('Frankfurt, Germany'));
    n.push(down('Toronto, Canada'));
    n.push(rerouted);
    n.push(rerouted);
    const text = n.flush();
    expect(text).toContain('Instance placed in Frankfurt, Germany.');
    expect(text).toContain('Node in Toronto, Canada went offline.');
    expect(text).toContain('2 requests rerouted.');
    expect(n.flush()).toBe('');
  });

  it('speaks only the answers to requests the visitor sent', () => {
    const n = make();
    n.push(served(5));
    expect(n.flush()).toBe('');
    n.expect(6);
    n.push(served(5));
    n.push(served(6));
    expect(n.flush()).toBe('Request answered by Toronto, Canada, 34 ms.');
  });

  it('names a continent outage once instead of every node in it', () => {
    const n = make();
    n.push(down('A', 'n1', 'region'));
    n.push(down('B', 'n2', 'region'));
    n.push({ type: 'region-down', at: 1, region: 'EU', nodes: 2, instances: 1 });
    expect(n.flush()).toBe('Europe went offline: 2 nodes.');
  });

  it('keeps long lists short', () => {
    const n = make();
    for (let i = 0; i < 6; i++) n.push(placed(`City ${i}`));
    expect(n.flush()).toBe('6 instances placed.');
    expect(n.pending).toBe(false);
  });

  it('reports the app status change and a missing primary', () => {
    const n = make();
    n.push({ type: 'volume-gap', at: 1, slot: 0 });
    n.push({ type: 'app-status', at: 1, status: 'down', healthy: 0, total: 3 });
    const text = n.flush();
    expect(text).toContain('No primary');
    expect(text).toContain('The app is down');
  });

  it('says that a replacement restarted with an empty disk, in its own sentence', () => {
    const n = make();
    n.push(placed('Frankfurt, Germany', true, true, 1));
    expect(n.pending).toBe(true);
    expect(n.flush()).toBe('Instance 2 restarted in Frankfurt, Germany with an empty disk.');
    expect(n.pending).toBe(false);
    expect(n.flush()).toBe('');
  });

  it('keeps a replacement that kept its data a plain replacement', () => {
    const n = make();
    n.push(placed('Frankfurt, Germany', true, false, 1));
    expect(n.flush()).toBe('A replacement instance started in Frankfurt, Germany.');
  });

  it('names several empty disks as a count, and keeps them apart from kept ones', () => {
    const n = make();
    n.push(placed('Frankfurt, Germany', true, true, 0));
    n.push(placed('Toronto, Canada', true, true, 2));
    n.push(placed('Lagos, Nigeria', true, false, 1));
    const text = n.flush();
    expect(text).toContain('A replacement instance started in Lagos, Nigeria.');
    expect(text).toContain('2 instances restarted with an empty disk.');
  });

  it('stays quiet about the disk when the figure does not draw it', () => {
    let shown = false;
    const n = new Narrator({
      labelOf: (id) => labels[id] ?? id,
      regionName: (r) => r,
      emptyDisk: () => shown,
    });
    n.push(placed('Frankfurt, Germany', true, true, 1));
    expect(n.flush()).toBe('A replacement instance started in Frankfurt, Germany.');
    shown = true;
    n.push(placed('Frankfurt, Germany', true, true, 1));
    expect(n.flush()).toBe('Instance 2 restarted in Frankfurt, Germany with an empty disk.');
  });

  it('forgets a pending empty disk on reset', () => {
    const n = make();
    n.push(placed('Frankfurt, Germany', true, true, 1));
    n.push({ type: 'reset', at: 0 });
    expect(n.pending).toBe(false);
    expect(n.flush()).toBe('');
  });
});
