/**
 * Failover Lab: break the app on purpose and watch what the network does about it.
 *
 * The bench is the shared diorama in its `failover` scene. This page adds what the diorama deliberately
 * does not own: the scenario menu, the uptime meter, the instance list (which is also the keyboard way to
 * break and revive nodes) and an event log. Everything is simulated and says so; the compressed times
 * are labelled where they appear.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLabFrame } from '@/app/LabFrame';
import Diorama from '@/diorama';
import { REGION_NAMES, REGIONS, type Region } from '@/diorama/model';
import { unlock } from '@/learn/achievements';
import { announce } from '@/system/announce';
import { useHotkey } from '@/system/hotkeys';
import { Panel, useIsPhone } from '@/ui';
import { ConfigPanel } from './ConfigPanel';
import { EventLog } from './EventLog';
import styles from './FailoverLab.module.css';
import { InstanceList } from './InstanceList';
import { type DrawTally, ScenarioCards } from './ScenarioCards';
import { MIN_INSTANCES, type Scenario, type ScenarioId } from './scenarios';
import { UptimePanel } from './UptimePanel';
import { useFailoverSession } from './useFailoverSession';
import { VerbsBar } from './VerbsBar';
import { buildView, busiestRegion, instancesIn, summarizeDraw } from './view';
import {
  EJECT_SEC,
  FDM_FAILOVER,
  FDM_TIMING,
  G_STANDBY_WAIT_MIN_PER_POSITION,
  REPLACEMENT_EXTRA_MIN,
  REPLACEMENT_MIN,
  SAMPLE_DATE,
  SIM_REDISPATCH_SEC,
  SIM_REPLACEMENT_SEC,
} from './words';

const NO_TALLY: DrawTally = { draws: 0, oneContinent: 0, last: '' };
const DEFAULT_RATE = 2;
const DEFAULT_COUNT = 3;

/** Placement options for every call: nodes choose at random among the eligible ones (FACTS 6.2). */
function placement(regions: readonly Region[]) {
  return { regions, spread: 'random' as const, waitedMin: 120 };
}

export default function FailoverLab() {
  const session = useFailoverSession();
  const isPhone = useIsPhone();
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [regions, setRegions] = useState<Region[]>([]);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [scenario, setScenario] = useState<ScenarioId | null>(null);
  const [picked, setPicked] = useState<Region | ''>('');
  const [tally, setTally] = useState<DrawTally>(NO_TALLY);
  // Traffic starts once the load balancer has accepted the instances: before that every request fails
  // for a reason that has nothing to do with what the learner is about to do.
  const [warm, setWarm] = useState(false);
  const seed = useRef(1);

  const { view } = session;
  const busiest = busiestRegion(view);
  const target: Region = picked || busiest || 'EU';

  useEffect(() => {
    if (!warm && view.status === 'up') setWarm(true);
  }, [warm, view.status]);

  // ---- placement -----------------------------------------------------------------------------------------
  const recordDraw = useCallback(
    (reset: boolean) => {
      const h = session.handle();
      const state = h?.state();
      if (!h || !state || !h.bench) return;
      const v = buildView(state, h.bench);
      const placed = v.instances.filter((i) => i.placed).length;
      session.refresh();
      setTally((t) => {
        const base = reset ? NO_TALLY : t;
        return {
          draws: base.draws + 1,
          oneContinent: base.oneContinent + (placed >= 2 && v.continents.length === 1 ? 1 : 0),
          last: summarizeDraw(v, REGION_NAMES),
        };
      });
    },
    [session],
  );

  /** A clean bench: everything up, counters at zero, instances placed with this seed. */
  const startFresh = useCallback(
    (n: number, allowed: readonly Region[], nextSeed: number, resetTally: boolean) => {
      const h = session.handle();
      if (!h) return;
      seed.current = nextSeed;
      setWarm(false);
      h.reset(nextSeed);
      h.setInstances(n, placement(allowed));
      session.resetCounters();
      recordDraw(resetTally);
    },
    [session, recordDraw],
  );

  const onCount = useCallback(
    (n: number) => {
      setCount(n);
      session.handle()?.setInstances(n, placement(regions));
      session.refresh();
    },
    [session, regions],
  );

  const onCountCommit = useCallback((n: number) => {
    // The medal asks for you to set three or more: a slider you moved, not the number the lab opened with.
    if (n >= 3) unlock('three-is-company');
  }, []);

  const onToggleRegion = useCallback(
    (r: Region) => {
      const next = regions.includes(r) ? regions.filter((x) => x !== r) : [...regions, r];
      setRegions(next);
      session.handle()?.setInstances(count, placement(next));
      session.refresh();
    },
    [session, regions, count],
  );

  // ---- breaking things -------------------------------------------------------------------------------------
  const breakNode = useCallback(() => {
    const id = session.handle()?.killRandom();
    if (!id) announce('There is no running instance to break.');
    session.refresh();
  }, [session]);

  const breakRegion = useCallback(() => {
    const ids = session.handle()?.killRegion(target) ?? [];
    if (ids.length === 0) announce(`${REGION_NAMES[target]} has no node that is still up.`);
    session.refresh();
  }, [session, target]);

  const reviveAll = useCallback(() => {
    session.handle()?.reviveAll();
    session.refresh();
  }, [session]);

  const sendOne = useCallback(() => {
    session.handle()?.send();
  }, [session]);

  const breakNodeById = useCallback(
    (id: string) => {
      session.handle()?.kill(id);
      session.refresh();
    },
    [session],
  );

  const reviveNodeById = useCallback(
    (id: string) => {
      session.handle()?.revive(id);
      session.refresh();
    },
    [session],
  );

  const reshuffle = useCallback(() => {
    startFresh(count, regions, 1 + Math.floor(Math.random() * 1_000_000), false);
  }, [startFresh, count, regions]);

  const startOver = useCallback(() => {
    startFresh(count, regions, seed.current, scenario === null);
  }, [startFresh, count, regions, scenario]);

  const tryScenario = useCallback(
    (s: Scenario) => {
      setScenario(s.id);
      setCount(s.instances);
      setRegions(s.regions);
      setRate(s.id === 'single' ? 3 : 4);
      setPicked(s.breakRegion ?? '');
      setTally(NO_TALLY);
      startFresh(s.instances, s.regions, 1 + Math.floor(Math.random() * 1_000_000), true);
      if (s.instances >= 3) unlock('three-is-company');
      announce(`Scenario: ${s.title}. ${s.teaches}`);
    },
    [startFresh],
  );

  // ---- keyboard --------------------------------------------------------------------------------------------
  useHotkey({
    id: 'failover.break',
    keys: 'b',
    label: 'Break a node',
    group: 'Failover Lab',
    run: breakNode,
  });
  useHotkey({
    id: 'failover.region',
    keys: 'r',
    label: 'Break the chosen region',
    group: 'Failover Lab',
    run: breakRegion,
  });
  useHotkey({
    id: 'failover.revive',
    keys: 'v',
    label: 'Revive all nodes',
    group: 'Failover Lab',
    run: reviveAll,
  });
  useHotkey({
    id: 'failover.send',
    keys: 's',
    label: 'Send one request',
    group: 'Failover Lab',
    run: sendOne,
  });

  useLabFrame({
    simulation: true,
    teach: [
      'This is a model of how Flux behaves, drawn on a made-up network. The nodes and their addresses are invented (the addresses are from the ranges reserved for documentation), and nothing on this page touches the real network.',
      `**What is the same as the network.** A load balancer ({{term:fdm}}) checks each instance every ${FDM_TIMING.healthIntervalSec} seconds and stops sending traffic after ${FDM_TIMING.ejectAfterFailures} failed checks, so a dead node is noticed in about ${EJECT_SEC} seconds. A request that reaches a dead node is retried on another instance.`,
      `**What is faster here.** On the network a lost instance is replaced only after its location record expires, so a replacement can take about two hours (${REPLACEMENT_MIN} minutes plus the image pull, and up to about ${REPLACEMENT_EXTRA_MIN} minutes more for a synced volume). Here it takes ${SIM_REPLACEMENT_SEC} seconds so you can watch it: compressed for the screen. A retried request waits ${FDM_TIMING.connectTimeoutSec} seconds on the network and about ${SIM_REDISPATCH_SEC} seconds here.`,
      `**What this lab does not model.** An app with a {{term:primary-standby}} volume (\`g:\`) is different. The load balancer lists only the primary and sends every port of the app to it, and moving to a standby is not seconds: FDM waits for at least ${FDM_FAILOVER.minFailedChecks} failed checks and ${FDM_FAILOVER.minUnhealthySec} seconds, and a standby waits about ${G_STANDBY_WAIT_MIN_PER_POSITION} minutes per place in line. Here every copy serves.`,
      '**What is not guaranteed.** Instances run on different nodes, not necessarily in different places. A {{term:geolocation}} rule says where an instance may run, and each eligible node decides for itself whether to take a copy, so allowing two continents does not put one on each.',
      '**Plan for N-1.** The replacement is not instant, so provision the app to work with one instance fewer than you run. {{term:n-minus-1}}',
      `**Why one instance is fragile.** One instance is one node, and each node belongs to an independent operator. When it stops, nothing serves the app until a replacement is placed. A count of apps on one day cannot show how often that happens: on ${SAMPLE_DATE} every single-instance app that was not a blocklisted Orbit deployment had a running copy, and that says nothing about the day a node fails.`,
    ],
    shortcuts: [
      { keys: 'b', label: 'Break a node' },
      { keys: 'r', label: 'Break the region' },
      { keys: 'v', label: 'Revive all' },
      { keys: 's', label: 'Send a request' },
    ],
  });

  const breakOptions = useMemo(
    () =>
      REGIONS.map((r) => {
        const n = instancesIn(view, r);
        return {
          value: r,
          label: n > 0 ? `${REGION_NAMES[r]} (${n} of yours)` : REGION_NAMES[r],
        };
      }),
    [view],
  );

  const hasInstances = view.total > 0 && count >= MIN_INSTANCES;

  return (
    <div className={styles.lab}>
      <div className={styles.grid}>
        <div className={styles.scenarios}>
          <ScenarioCards active={scenario} tally={tally} onTry={tryScenario} />
        </div>

        <div className={styles.bench}>
          <Diorama
            scene="failover"
            bare
            instances={DEFAULT_COUNT}
            controls={['kill']}
            place={placement([])}
            requestRate={warm ? rate : 0}
            aspect={isPhone ? '4 / 3' : '21 / 9'}
            label="Simulated Flux network. Your app's instances are lit; a request travels from a user through the load balancer to an instance."
            onReady={(h) => {
              session.onReady(h);
              recordDraw(true);
            }}
            onEvent={session.onEvent}
          />
        </div>

        <div className={styles.verbs}>
          <VerbsBar
            breakOptions={breakOptions}
            breakRegion={target}
            onBreakRegion={setPicked}
            hasInstances={hasInstances}
            anyDown={view.offline.length > 0}
            onBreakNode={breakNode}
            onBreakRegionNow={breakRegion}
            onReviveAll={reviveAll}
            onSend={sendOne}
          />
        </div>

        <div className={styles.uptime}>
          <Panel variant="slab" padding="md" halo={false} pattern="none">
            <UptimePanel
              meter={session.meter}
              time={session.time}
              view={view}
              warming={!warm && view.total > 0}
            />
          </Panel>
        </div>

        <div className={styles.config}>
          <Panel variant="slab" padding="md" cut="tl-br" halo={false} pattern="none">
            <ConfigPanel
              count={count}
              onCount={onCount}
              onCountCommit={onCountCommit}
              regions={regions}
              onToggleRegion={onToggleRegion}
              rate={rate}
              onRate={setRate}
              onReshuffle={reshuffle}
              onStartOver={startOver}
            />
          </Panel>
        </div>

        <div className={styles.instances}>
          <Panel variant="slab" padding="md" halo={false} pattern="none">
            <InstanceList view={view} onBreak={breakNodeById} onRevive={reviveNodeById} />
          </Panel>
        </div>

        <div className={styles.log}>
          <Panel variant="slab" padding="md" cut="tl-br" halo={false} pattern="none">
            <EventLog lines={session.lines} onClear={session.clearLog} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
