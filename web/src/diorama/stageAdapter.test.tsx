// @vitest-environment jsdom
/**
 * The lesson stage adapter (`learn/stages/diorama.tsx`) against a real simulation: the figure itself is
 * replaced by a stand-in that owns a `createSim` and forwards its events and handle, so what is checked is
 * the adapter's own work: the props it passes, how it counts nodes taken offline into `node-killed`, and
 * what "Show me" does. (The tests live here because `learn/stages/` is a glob of stage components.)
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { StageHost, TaskEvent } from '@/learn/stage-api';
import DioramaStageView from '@/learn/stages/diorama';
import type { DioramaStage, Task } from '@/learn/types';
import type { Sim } from './sim';

// What the stand-in figure last rendered with, and the simulation it owns.
const figure = vi.hoisted(() => ({
  props: null as null | Record<string, unknown>,
  sim: null as null | Sim,
}));

vi.mock('@/data', () => ({
  useGeo: () => ({ data: null, meta: null }),
  useNetwork: () => ({ data: null }),
  useChainHeight: () => null,
}));

vi.mock('@/diorama', async () => {
  const { useImperativeHandle, useRef } = await import('react');
  const { createKillTally } = await import('./taskEvents');
  const { regionToBreak } = await import('./breakRegion');
  const { buildSampleBench } = await import('./model');
  const { createSim } = await import('./sim');
  const { placeFor } = await import('./place');

  function FakeDiorama(props: Record<string, unknown> & { ref?: unknown }) {
    const sim = useRef<Sim | null>(null);
    if (!sim.current) {
      const s = createSim({
        bench: buildSampleBench(1),
        seed: 1,
        place: placeFor(props.scene as never, props.place as never, props.volume as never),
      });
      if (typeof props.region === 'string') s.configure({ regions: [props.region as never] });
      s.setInstances((props.instances as number | undefined) ?? 3);
      s.tick(3000);
      s.on('*', (e) => {
        (figure.props?.onEvent as ((e: unknown) => void) | undefined)?.(e);
      });
      sim.current = s;
    }
    figure.props = props;
    figure.sim = sim.current;
    useImperativeHandle(props.ref as never, () => {
      const s = sim.current as Sim;
      return {
        state: () => s.state(),
        get bench() {
          return s.bench;
        },
        setInstances: (n: number) => s.setInstances(n),
        kill: (id: string) => s.kill(id),
        killRegion: (r: never) => s.killRegion(r),
        send: () => s.send(),
      };
    }, []);
    return null;
  }

  return { default: FakeDiorama, createKillTally, regionToBreak };
});

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  figure.props = null;
  figure.sim = null;
});

function makeHost() {
  const emitted: TaskEvent[] = [];
  const unlocked: string[] = [];
  let solver: (() => void) | null = null;
  const host: StageHost = {
    emit: (e) => emitted.push(e),
    registerSolver: (fn) => {
      solver = fn;
    },
    unlock: (id) => unlocked.push(id),
  };
  return { host, emitted, unlocked, solve: () => solver?.() };
}

function mount(stage: DioramaStage, task: Task | undefined, host: StageHost, stepKey = 'step-a') {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const render = (key: string) =>
    act(() => {
      root?.render(
        <DioramaStageView stage={stage} task={task} host={host} active stepKey={key} compact={false} />,
      );
    });
  render(stepKey);
  return { rerender: render };
}

const killed = (events: readonly TaskEvent[]) =>
  events.filter((e): e is Extract<TaskEvent, { type: 'node-killed' }> => e.type === 'node-killed');

const failover = (extra: Partial<DioramaStage> = {}): DioramaStage => ({
  kind: 'diorama',
  scene: 'failover',
  instances: 3,
  controls: ['kill', 'revive'],
  ...extra,
});

describe('the diorama stage adapter', () => {
  it('hands the figure the stage: volume, controls and annotations', () => {
    const { host } = makeHost();
    mount(
      failover({
        volume: 'local',
        controls: ['kill', 'kill-region', 'revive'],
        annotate: ['instances', 'down', 'lost-data'],
      }),
      undefined,
      host,
    );
    expect(figure.props).toMatchObject({
      scene: 'failover',
      volume: 'local',
      controls: ['kill', 'kill-region', 'revive'],
      annotate: ['instances', 'down', 'lost-data'],
    });
    // The simulation under it runs the volume the stage chose.
    expect(figure.sim?.state().volume.mode).toBe('local');
  });

  it('leaves the volume to the scene when the stage chooses none', () => {
    const { host } = makeHost();
    mount(failover(), undefined, host);
    expect(figure.props?.volume).toBeUndefined();
  });

  it('counts each node taken offline once, and reports every kill', () => {
    const { host, emitted, unlocked } = makeHost();
    mount(failover(), undefined, host);
    const sim = figure.sim as Sim;
    act(() => {
      sim.killRandomInstanceNode();
    });
    act(() => {
      sim.killRandomInstanceNode();
    });
    expect(killed(emitted).map((e) => e.count)).toEqual([1, 2]);
    expect(unlocked).toEqual(['first-blood', 'first-blood']);
  });

  it('counts a whole continent as one report of distinct nodes, adding to the ones killed before', () => {
    const { host, emitted } = makeHost();
    mount(failover({ region: 'EU' }), undefined, host);
    const sim = figure.sim as Sim;
    const bench = sim.bench;
    const first = sim.state().instances[0]?.nodeId as string;
    act(() => {
      sim.kill(first);
    });
    expect(killed(emitted).map((e) => e.count)).toEqual([1]);
    let ids: string[] = [];
    act(() => {
      ids = sim.killRegion('EU');
    });
    const reports = killed(emitted);
    // One report for the continent, not one per node, and it includes the node that was already counted.
    expect(reports).toHaveLength(2);
    const europe = bench.nodes.filter((n) => n.region === 'EU').length;
    expect(ids.length).toBe(europe - 1);
    expect(reports[1]?.count).toBe(europe);
  });

  it('starts counting again when a new step begins', () => {
    const { host, emitted } = makeHost();
    const { rerender } = mount(failover(), undefined, host, 'one');
    const sim = figure.sim as Sim;
    act(() => {
      sim.killRandomInstanceNode();
    });
    expect(killed(emitted).at(-1)?.count).toBe(1);
    rerender('two');
    act(() => {
      sim.killRandomInstanceNode();
    });
    expect(killed(emitted).at(-1)?.count).toBe(1);
  });

  it('"Show me" breaks the continent the app lives in when the step offers Break region', () => {
    const { host, emitted, unlocked, solve } = makeHost();
    const task: Task = { kind: 'kill-nodes', count: 3, prompt: 'Break the region.' };
    mount(
      failover({ region: 'EU', controls: ['kill', 'kill-region', 'revive', 'request', 'region'] }),
      task,
      host,
    );
    const sim = figure.sim as Sim;
    expect(sim.state().app.status).toBe('up');
    act(() => solve());
    const europe = sim.bench.nodes.filter((n) => n.region === 'EU');
    // Every node of the continent is down, in one report, and the app is down with it.
    for (const n of europe) expect(sim.state().nodeUp[n.index]).toBe(0);
    expect(killed(emitted)).toHaveLength(1);
    expect(killed(emitted)[0]?.count).toBe(europe.length);
    expect(sim.state().app.status).toBe('down');
    // A solver does not earn the achievement.
    expect(unlocked).toEqual([]);
  });

  it('"Show me" takes nodes one at a time when the step has no Break region', () => {
    const { host, emitted, solve } = makeHost();
    const task: Task = { kind: 'kill-nodes', count: 2, prompt: 'Kill two nodes.' };
    mount(failover(), task, host);
    const sim = figure.sim as Sim;
    act(() => solve());
    expect(killed(emitted).map((e) => e.count)).toEqual([1, 2]);
    expect(sim.state().down).toHaveLength(2);
  });

  it('"Show me" does nothing more once the task is already met', () => {
    const { host, emitted, solve } = makeHost();
    const task: Task = { kind: 'kill-nodes', count: 1, prompt: 'Kill a node.' };
    mount(failover({ controls: ['kill', 'kill-region'] }), task, host);
    const sim = figure.sim as Sim;
    act(() => {
      sim.killRandomInstanceNode();
    });
    expect(killed(emitted)).toHaveLength(1);
    act(() => solve());
    expect(killed(emitted)).toHaveLength(1);
    expect(sim.state().down).toHaveLength(1);
  });
});
