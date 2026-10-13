import type { Tier } from '@shared/api';
import { useEffect, useState } from 'react';
import { buildSampleBench } from '@/diorama/model';
import { createSim } from '@/diorama/sim';
import { useSceneBus } from '@/scenes/bus';
import { hostSlots } from './liteGeometry';
import { statusSentence } from './logic';

export interface LiteInstance {
  /** Stable key: the slot position plus how many times the copy was replaced. */
  key: string;
  /** Which of the twelve pillar positions it stands on. */
  position: number;
  tier: Tier;
  cc: string;
  label: string;
  healthy: boolean;
}

export interface LiteView {
  instances: LiteInstance[];
  placed: number;
  healthy: number;
}

const EMPTY: LiteView = { instances: [], placed: 0, healthy: 0 };

/**
 * The headless simulation behind the calm 2D bench. It is driven by the same bus controls as the WebGL
 * scene (instances, break, revive, reset) and writes the same slice back (status, counts, last event), so
 * the hero's controls, status chip and live region work identically with and without WebGL.
 *
 * The sim is the diorama's (`@/diorama/sim`): placement, health and routing are the real rules, on the
 * built-in sample bench. It is labelled a sample everywhere it is shown.
 */
export function useLiteSim(enabled: boolean): LiteView {
  const [view, setView] = useState<LiteView>(EMPTY);

  useEffect(() => {
    if (!enabled) return;
    const bus = useSceneBus;
    const bench = buildSampleBench(11, { nodes: 90 });
    const sim = createSim({ bench, seed: 11, place: { spread: 'regions' } });
    let dead = false;
    let eventId = 0;

    const emit = (
      kind: 'placed' | 'retired' | 'node-down' | 'node-up' | 'rerouted' | 'all-down' | 'reset',
      text: string,
    ) => {
      bus.getState().writeScene({ lastEvent: { id: ++eventId, kind, text, at: performance.now() } });
    };

    const publish = () => {
      if (dead) return;
      const st = sim.state();
      const positions = hostSlots(st.count);
      const instances: LiteInstance[] = [];
      for (const inst of st.instances) {
        const position = positions[inst.slot];
        if (position === undefined || inst.node < 0) continue;
        const node = bench.nodes[inst.node];
        if (!node) continue;
        instances.push({
          key: `${position}:${inst.serial}`,
          position,
          tier: node.tier,
          cc: node.cc,
          label: node.label,
          healthy: inst.serving,
        });
      }
      const healthy = instances.filter((i) => i.healthy).length;
      const placed = instances.length;
      const forcedOff = bus.getState().quality === 0;
      bus.getState().writeScene({
        ready: true,
        webgl: false,
        tier: 0,
        reason: forcedOff ? 'forced-off' : 'no-webgl',
        dataMode: 'sample',
        instancesPlaced: placed,
        healthy,
        up: healthy > 0,
        status: statusSentence(placed, healthy),
        fps: 0,
        hover: null,
      });
      setView({ instances, placed, healthy });
    };

    const apply = (n: number) => {
      sim.setInstances(n, { spread: 'regions' });
      sim.settle();
    };

    // Start from the bus: the controls hold whatever the visitor last chose.
    const initial = bus.getState().deploy;
    apply(initial.instances);
    let last = { ...initial };
    publish();
    emit('placed', statusSentence(sim.state().instances.length, sim.state().app.healthy));

    const off = bus.subscribe((s) => {
      const d = s.deploy;
      if (d.resetNonce !== last.resetNonce) {
        sim.reviveAll();
        sim.reset();
        apply(d.instances);
        last = { ...d };
        publish();
        emit(
          'reset',
          `Bench reset. ${statusSentence(sim.state().instances.length, sim.state().app.healthy)}`,
        );
        return;
      }
      if (d.reviveNonce !== last.reviveNonce) {
        sim.reviveAll();
        sim.tick(6000);
        last = { ...d };
        publish();
        emit(
          'node-up',
          `Every node is back. ${statusSentence(sim.state().instances.length, sim.state().app.healthy)}`,
        );
        return;
      }
      if (d.breakNonce !== last.breakNonce) {
        last = { ...d };
        const id = sim.killRandomInstanceNode();
        if (id === null) {
          emit('all-down', 'There is no healthy instance left to break. Reset to bring them back.');
          return;
        }
        sim.tick(8000);
        const node = bench.nodes[sim.nodeIndex(id)];
        const healthy = sim.state().app.healthy;
        const where = node ? node.label : 'a node';
        publish();
        emit(
          healthy > 0 ? 'rerouted' : 'all-down',
          healthy > 0
            ? `The node in ${where} went dark. Requests moved to the ${healthy === 1 ? 'one other instance' : `${healthy} other instances`}.`
            : `The node in ${where} went dark. No healthy instance is left, so the app is down.`,
        );
        return;
      }
      if (d.instances !== last.instances) {
        const before = sim.state().instances.length;
        last = { ...d };
        apply(d.instances);
        publish();
        const after = sim.state().instances.length;
        emit(
          after >= before ? 'placed' : 'retired',
          `${after} ${after === 1 ? 'instance' : 'instances'} placed, ${sim.state().app.healthy} healthy.`,
        );
      }
    });

    return () => {
      dead = true;
      off();
    };
  }, [enabled]);

  return view;
}
