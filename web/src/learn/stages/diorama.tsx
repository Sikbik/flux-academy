/**
 * The `diorama` stage: the Bench inside a lesson. Owner: the diorama owner (web/src/diorama).
 *
 * What it adds to the bare figure
 *   - reports the learner's actions as task events: `instances` (the slider), `node-killed` (distinct
 *     nodes since the step began, one at a time or a whole continent with "Break region") and
 *     `request-sent` (requests since the step began)
 *   - registers a "Show me" solver that performs the step's task on the real figure (a step that offers
 *     "Break region" is solved by breaking a region)
 *   - unlocks `three-is-company` at three or more instances and `first-blood` on the first kill
 *   - keeps the simulation alive across steps that share a scene, applying new props in place
 *   - for live scenes, reads the geo and network snapshots and beats on every real block
 *
 * A step that restates its starting instance count re-applies it through `resetKey`, which does not
 * report an event (so a task never completes by itself on entering a step).
 */

import { type ComponentProps, type RefObject, useCallback, useEffect, useRef } from 'react';
import { useChainHeight, useGeo, useNetwork } from '@/data';
import Diorama, {
  createKillTally,
  type DioramaHandle,
  type KillTally,
  regionToBreak,
  type SimEvent,
} from '@/diorama';
import type { StageComponentProps } from '../stage-api';
import type { DioramaStage, Task } from '../types';

type LiveData = Pick<ComponentProps<typeof Diorama>, 'geo' | 'geoMeta' | 'network'>;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** What the figure shows is a simulation unless it is a census scene on real data. */
const frameSaysSimulation = (scene: DioramaStage['scene']): boolean =>
  scene !== 'network' && scene !== 'tiers';

interface InnerProps extends StageComponentProps<DioramaStage> {
  data: LiveData;
  liveBench: boolean;
  chainHeight: number | null;
}

function DioramaInner({ stage, host, task, stepKey, compact, data, liveBench, chainHeight }: InnerProps) {
  const handle = useRef<DioramaHandle | null>(null);
  const kills = useRef<KillTally>(createKillTally());
  const requests = useRef(0);
  const solving = useRef(false);

  // Counters are "since the step began".
  // biome-ignore lint/correctness/useExhaustiveDependencies: stepKey is the trigger, not a value read here
  useEffect(() => {
    kills.current.reset();
    requests.current = 0;
  }, [stepKey]);

  const onInstances = useCallback(
    (value: number): void => {
      host.emit({ type: 'instances', value });
      if (!solving.current && value >= 3) host.unlock('three-is-company');
    },
    [host],
  );

  // Every node taken offline counts once, whatever took it: one at a time, or a whole continent (which is
  // reported once, after its nodes are counted).
  const onEvent = useCallback(
    (event: SimEvent): void => {
      const count = kills.current.apply(event);
      if (count === null) return;
      host.emit({ type: 'node-killed', count });
      if (!solving.current) host.unlock('first-blood');
    },
    [host],
  );

  const onRequest = useCallback((): void => {
    requests.current++;
    host.emit({ type: 'request-sent', count: requests.current });
  }, [host]);

  // The Beat: a real block moves the bench.
  const lastHeight = useRef<number | null>(chainHeight);
  useEffect(() => {
    if (stage.scene !== 'network') return;
    const prev = lastHeight.current;
    lastHeight.current = chainHeight;
    if (chainHeight !== null && prev !== null && chainHeight > prev) handle.current?.beat();
  }, [chainHeight, stage.scene]);

  // "Show me": perform the task on the real figure.
  useEffect(() => {
    const solve = solverFor(task, stage, handle, kills, solving);
    host.registerSolver(solve);
    return () => host.registerSolver(null);
  }, [task, stage, host]);

  const maxInstances =
    task?.kind === 'set-instances'
      ? Math.max(12, task.exactly ?? 0, task.min ?? 0, task.max ?? 0)
      : undefined;

  return (
    <Diorama
      ref={handle}
      scene={stage.scene}
      instances={stage.instances}
      controls={stage.controls}
      live={liveBench}
      geo={data.geo}
      geoMeta={data.geoMeta}
      network={data.network}
      annotate={stage.annotate}
      region={stage.region ?? null}
      volume={stage.volume}
      maxInstances={maxInstances}
      resetKey={stepKey}
      hideFreshness={frameSaysSimulation(stage.scene) && !liveBench}
      aspect={compact ? '16 / 10' : undefined}
      onInstances={onInstances}
      onEvent={onEvent}
      onRequest={onRequest}
    />
  );
}

/** The function behind "Show me" for a task the diorama can perform, else null. */
function solverFor(
  task: Task | undefined,
  stage: DioramaStage,
  handle: RefObject<DioramaHandle | null>,
  kills: RefObject<KillTally>,
  solving: RefObject<boolean>,
): (() => void) | null {
  if (!task) return null;
  const run = (fn: (h: DioramaHandle) => void): (() => void) => {
    return () => {
      const h = handle.current;
      if (!h) return;
      solving.current = true;
      try {
        fn(h);
      } finally {
        solving.current = false;
      }
    };
  };
  switch (task.kind) {
    case 'set-instances':
      return run((h) => {
        const cur = h.state()?.count ?? stage.instances ?? 3;
        const target = task.exactly !== undefined ? task.exactly : clamp(cur, task.min ?? 1, task.max ?? 100);
        h.setInstances(target);
      });
    case 'kill-nodes':
      return run((h) => {
        const st = h.state();
        const bench = h.bench;
        if (!st || !bench) return;
        if (st.app.total === 0) h.setInstances(Math.max(3, task.count));
        const fresh = h.state();
        if (!fresh) return;
        // A step that offers "Break region" is about a continent going dark: show exactly that, taking
        // the continent the app lives in (the same default the button uses).
        if (stage.controls?.includes('kill-region') && kills.current.size < task.count) {
          const region = regionToBreak(bench, fresh, null);
          if (region) h.killRegion(region);
        }
        // Instance nodes first (that is what the lesson is about), then any other node.
        const after = h.state() ?? fresh;
        const order: number[] = [];
        for (const s of after.instances) if (s.node >= 0 && after.nodeUp[s.node] === 1) order.push(s.node);
        for (const n of bench.nodes) if (!order.includes(n.index)) order.push(n.index);
        for (const index of order) {
          if (kills.current.size >= task.count) break;
          const n = bench.nodes[index];
          if (n && !kills.current.has(n.id)) h.kill(n.id);
        }
      });
    case 'send-requests':
      return run((h) => {
        if ((h.state()?.app.total ?? 0) === 0) h.setInstances(3);
        for (let i = 0; i < task.count; i++) h.send();
      });
    default:
      return null;
  }
}

/** A scene on real data reads the snapshots; the hooks hold the data layer open while mounted. */
function LiveDiorama(props: StageComponentProps<DioramaStage>) {
  const geo = useGeo();
  const network = useNetwork();
  const height = useChainHeight();
  return (
    <DioramaInner
      {...props}
      data={{ geo: geo.data, geoMeta: geo.meta, network: network.data }}
      liveBench={geo.data !== null}
      chainHeight={height}
    />
  );
}

function SampleDiorama(props: StageComponentProps<DioramaStage>) {
  return (
    <DioramaInner
      {...props}
      data={{ geo: null, geoMeta: null, network: null }}
      liveBench={false}
      chainHeight={null}
    />
  );
}

export default function DioramaStageView(props: StageComponentProps<DioramaStage>) {
  const live = props.stage.live ?? props.stage.scene === 'network';
  return live ? <LiveDiorama {...props} /> : <SampleDiorama {...props} />;
}
