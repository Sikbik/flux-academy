import { describe, expect, it } from 'vitest';
import { buildSampleBench } from '@/diorama/model';
import { createSim } from '@/diorama/sim';
import type { SceneEventKind } from '../bus';
import { frameFor, pillarSpecs, worldX, worldZ } from '../world/frame';
import { Director, type DirectorWorld, MAX_COPIES, MAX_RIBBONS, NEVER } from './director';
import type { WaveKind } from './waves';

const BENCH = buildSampleBench(1, { resolution: 'low' });

interface Rig {
  d: Director;
  l1: Float32Array;
  l2: Float32Array;
  waves: { kind: WaveKind; x: number; z: number }[];
  events: { kind: SceneEventKind; text: string }[];
  world: DirectorWorld;
  clock: { t: number };
  step(seconds: number, dt?: number): void;
}

function rig(seed = 4, reduced = false): Rig {
  const frame = frameFor(BENCH);
  const pillars = pillarSpecs(BENCH, frame);
  const world: DirectorWorld = {
    bench: BENCH,
    frame,
    pillars,
    cell: { x: 0, y: 16, z: -7 },
    proxy: { x: worldX(frame, BENCH.extent.minX + 30), y: 14, z: worldZ(frame, BENCH.extent.minY + 10) },
  };
  const n = BENCH.nodes.length + BENCH.users.length;
  const l1 = new Float32Array(n * 4).fill(NEVER);
  const l2 = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    l2[i * 4] = NEVER;
    l2[i * 4 + 2] = NEVER;
    l2[i * 4 + 3] = -1;
  }
  const waves: Rig['waves'] = [];
  const events: Rig['events'] = [];
  const sim = createSim({ bench: BENCH, seed, place: { waitedMin: 120 } });
  const d = new Director(
    world,
    sim,
    {
      wave: (kind, x, z) => waves.push({ kind, x, z }),
      event: (kind, text) => events.push({ kind, text }),
    },
    { l1, l2, beaconBase: BENCH.nodes.length },
  );
  d.setReducedMotion(reduced);
  const clock = { t: 0 };
  return {
    d,
    l1,
    l2,
    waves,
    events,
    world,
    clock,
    step(seconds, dt = 1 / 60) {
      const steps = Math.round(seconds / dt);
      for (let i = 0; i < steps; i++) {
        clock.t += dt;
        d.update(clock.t, dt);
      }
    },
  };
}

function hostedNodes(r: Rig): number[] {
  return r.d.simulation
    .state()
    .instances.filter((i) => i.node >= 0)
    .map((i) => i.node);
}

describe('director launch', () => {
  it('queues a copy per instance, anticipates, then lands them one after another', () => {
    const r = rig();
    r.d.setInstances(3, null, r.clock.t);
    expect(r.d.usedCopies).toBe(3);
    expect(r.d.stats.placed).toBe(3);
    // Nothing has left the cell yet: the cell charges first.
    r.step(0.05);
    expect([0, 1, 2].map((s) => r.d.phaseOfSlot(s))).toEqual(['queued', 'queued', 'queued']);
    r.step(0.3);
    expect(r.d.phaseOfSlot(0)).toBe('fly');
    // By two seconds every copy has landed and the sim reports them running.
    r.step(2.0);
    expect([0, 1, 2].map((s) => r.d.phaseOfSlot(s))).toEqual(['landed', 'landed', 'landed']);
    for (const n of hostedNodes(r)) {
      expect(r.l1[n * 4]).toBeGreaterThan(NEVER);
      expect(r.l2[n * 4 + 2]).toBeGreaterThan(NEVER);
      expect(r.l2[n * 4 + 3]).toBe(-1);
    }
    expect(r.waves.filter((w) => w.kind === 'land')).toHaveLength(3);
    expect(r.d.stats.status).toBe('up');
    expect(r.d.stats.healthy).toBe(3);
  });

  it('staggers the copies and keeps every flight inside the motion language', () => {
    const r = rig();
    r.d.setInstances(5, null, 0);
    const launches: number[] = [];
    const seen = new Set<number>();
    const dt = 1 / 120;
    let landedAt = 0;
    for (let i = 0; i < 400; i++) {
      r.clock.t += dt;
      r.d.update(r.clock.t, dt);
      for (let s = 0; s < 5; s++) {
        if (!seen.has(s) && r.d.phaseOfSlot(s) === 'fly') {
          seen.add(s);
          launches.push(r.clock.t);
        }
      }
      if (r.d.phaseOfSlot(4) === 'landed' && landedAt === 0) landedAt = r.clock.t;
    }
    expect(launches).toHaveLength(5);
    for (let i = 1; i < launches.length; i++) {
      const gap = (launches[i] ?? 0) - (launches[i - 1] ?? 0);
      expect(gap).toBeGreaterThan(0.05);
      expect(gap).toBeLessThan(0.14);
    }
    // The last copy lands within about 1.5 s of leaving.
    expect(landedAt - (launches[4] ?? 0)).toBeLessThan(1.5);
    expect(landedAt - (launches[4] ?? 0)).toBeGreaterThan(0.6);
  });

  it('shows a starting ring between landing and running when the sim is slower', () => {
    const r = rig();
    r.d.setInstances(1, null, 0);
    const node = hostedNodes(r)[0] ?? 0;
    let sawStarting = false;
    for (let i = 0; i < 240; i++) {
      r.clock.t += 1 / 60;
      r.d.update(r.clock.t, 1 / 60);
      const p = r.l2[node * 4 + 3] ?? -1;
      if (p >= 0 && p < 1 && r.l2[node * 4 + 2]! > NEVER) sawStarting = true;
    }
    // A single copy lands at about 1.2 s and the sim runs it at 1.5 s: there is a moment of starting.
    expect(sawStarting).toBe(true);
    expect(r.l1[node * 4]).toBeGreaterThan(NEVER);
  });
});

describe('director break and heal', () => {
  function placed(): Rig {
    const r = rig();
    r.d.setInstances(3, null, 0);
    r.step(2.5);
    r.waves.length = 0;
    r.events.length = 0;
    return r;
  }

  it('marks the node broken, fires a wave and announces it in plain words', () => {
    const r = placed();
    expect(r.d.breakOne(r.clock.t)).toBe(true);
    const broken = hostedNodes(r).filter((n) => r.l1[n * 4 + 1]! > NEVER);
    expect(broken).toHaveLength(1);
    expect(r.waves.some((w) => w.kind === 'break')).toBe(true);
    const down = r.events.find((e) => e.kind === 'node-down');
    expect(down?.text).toMatch(/went dark/);
    expect(down?.text).toMatch(/2 of 3 instances still serve/);
  });

  it('cuts the tether for a moment and then draws nothing for the dead copy', () => {
    const r = placed();
    r.d.breakOne(r.clock.t);
    const count = (t: number) => r.d.collect(t).ribbonCount;
    r.step(0.1);
    const during = count(r.clock.t);
    expect(during).toBeGreaterThan(0);
    r.d.setTraffic(false);
    r.step(3);
    // Only the two live tethers remain, plus at most a data pulse on each (no packets in flight).
    const n = r.d.collect(r.clock.t).ribbonCount;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(4);
  });

  it('keeps serving: packets that met the dead node are redirected to a survivor', () => {
    const r = placed();
    r.d.breakOne(r.clock.t);
    r.step(10);
    const c = r.d.simulation.state().counters;
    expect(c.rerouted).toBeGreaterThan(0);
    expect(r.d.stats.status).toBe('degraded');
    expect(r.d.stats.healthy).toBe(2);
    expect(r.events.some((e) => e.kind === 'ejected')).toBe(true);
  });

  it('revives from the centre and restarts the instance', () => {
    const r = placed();
    r.d.breakOne(r.clock.t);
    r.step(1);
    r.d.reviveAll(r.clock.t);
    const revived = hostedNodes(r).filter((n) => r.l1[n * 4 + 2]! > NEVER);
    expect(revived).toHaveLength(1);
    expect(r.waves.some((w) => w.kind === 'revive')).toBe(true);
    r.step(2.5);
    expect(r.d.stats.healthy).toBe(3);
    expect(r.d.stats.status).toBe('up');
    expect(r.events.some((e) => e.kind === 'node-up')).toBe(true);
  });

  it('reports every instance down when the last healthy one fails', () => {
    const r = placed();
    for (let i = 0; i < 3; i++) r.d.breakOne(r.clock.t);
    expect(r.d.stats.healthy).toBe(0);
    expect(r.events.some((e) => e.kind === 'all-down')).toBe(true);
    r.step(1);
    // With traffic and no survivors the scene still draws something: failed packets.
    expect(r.d.stats.status).toBe('down');
  });
});

describe('director reconcile', () => {
  it('withdraws the newest copies when the count drops and retires their pillars', () => {
    const r = rig();
    r.d.setInstances(4, null, 0);
    r.step(2.5);
    const before = hostedNodes(r);
    r.d.setInstances(2, null, r.clock.t);
    r.step(1.2);
    expect(r.d.usedCopies).toBe(2);
    const retired = before.filter((n) => r.l1[n * 4 + 3]! > NEVER);
    expect(retired).toHaveLength(2);
    expect(r.events.filter((e) => e.kind === 'retired')).toHaveLength(2);
  });

  it('reset sends copies home and clears the sim', () => {
    const r = rig();
    r.d.setInstances(3, null, 0);
    r.step(2.5);
    r.d.reset(r.clock.t, 9);
    expect(r.d.simulation.state().app.total).toBe(0);
    r.step(1.2);
    expect(r.d.usedCopies).toBe(0);
    expect(r.events.some((e) => e.kind === 'reset')).toBe(true);
  });

  it('adopts a region preference when placing', () => {
    const r = rig(11);
    r.d.setInstances(3, 'EU', 0);
    for (const n of hostedNodes(r)) expect(BENCH.nodes[n]?.region).toBe('EU');
  });
});

describe('director reduced motion', () => {
  it('lands everything immediately with no flight and no waves', () => {
    const r = rig(4, true);
    r.d.setInstances(3, null, 0);
    expect([0, 1, 2].map((s) => r.d.phaseOfSlot(s))).toEqual(['landed', 'landed', 'landed']);
    for (const n of hostedNodes(r)) expect(r.l1[n * 4]).toBeGreaterThan(NEVER);
    expect(r.d.stats.status).toBe('up');
    const n = r.d.collect(1).ribbonCount;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(6);
  });

  it('shows a failure as a settled state and a revive as a settled recovery', () => {
    const r = rig(4, true);
    r.d.setInstances(3, null, 0);
    r.d.breakOne(0);
    const broken = hostedNodes(r).filter((n) => r.l1[n * 4 + 1]! > NEVER);
    expect(broken).toHaveLength(1);
    expect(r.d.stats.healthy).toBe(2);
    r.d.reviveAll(0);
    expect(r.d.stats.healthy).toBe(3);
  });
});

describe('director output', () => {
  it('never exceeds its pools and keeps copy and ribbon values finite', () => {
    const r = rig();
    r.d.setInstances(12, null, 0);
    for (let i = 0; i < 600; i++) {
      r.clock.t += 1 / 60;
      r.d.update(r.clock.t, 1 / 60);
      const out = r.d.collect(r.clock.t);
      expect(out.ribbonCount).toBeLessThanOrEqual(MAX_RIBBONS);
      expect(out.copyCount).toBeLessThanOrEqual(MAX_COPIES);
      for (let k = 0; k < out.copyCount; k++) {
        const c = out.copies[k];
        expect(Number.isFinite((c?.x ?? 0) + (c?.y ?? 0) + (c?.z ?? 0))).toBe(true);
      }
      for (let k = 0; k < out.ribbonCount; k++) {
        const s = out.ribbons[k]?.style;
        expect(Number.isFinite((s?.head ?? 0) + (s?.tail ?? 0) + (s?.alpha ?? 0))).toBe(true);
        expect(s?.head).toBeGreaterThanOrEqual(s?.tail ?? 0);
      }
    }
  });

  it('pings the visitor beacons when requests leave and keeps copy texts clean', () => {
    const r = rig();
    r.d.setInstances(3, null, 0);
    r.step(4);
    const base = BENCH.nodes.length;
    let pinged = 0;
    for (let u = 0; u < BENCH.users.length; u++) if ((r.l2[(base + u) * 4] ?? NEVER) > NEVER) pinged++;
    expect(pinged).toBeGreaterThan(0);
    for (const e of r.events) {
      expect(e.text).not.toMatch(/[‒-―]/);
      expect(e.text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(e.text.length).toBeGreaterThan(8);
    }
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const r = rig(7);
      r.d.setInstances(3, null, 0);
      r.step(3);
      return hostedNodes(r).join(',');
    };
    expect(run()).toBe(run());
  });
});
