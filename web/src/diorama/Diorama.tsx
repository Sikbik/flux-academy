/**
 * The Bench: an isometric hex map of the Flux network, a simulation under it, and a small control bar.
 *
 * The canvas is decoration for the eyes (`aria-hidden`); the same facts reach everyone else through a
 * parallel DOM layer: the control bar, a focusable list of the nodes that matter, a status chip and a
 * polite live region that speaks one coalesced paragraph per burst of events.
 *
 * Rendering and simulation live outside React (`render/engine.ts`, `sim/`); this component wires them to
 * props, controls and callbacks and never re-renders per frame.
 */

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { initialPlan } from '@/lib/quality';
import { Button, Chip, FreshnessChip, Panel, Select, Slider, useReducedMotion } from '@/ui';
import { regionToBreak } from './breakRegion';
import styles from './Diorama.module.css';
import { buildLiveBench, buildSampleBench } from './model';
import {
  type Bench,
  type BenchNode,
  REGION_NAMES,
  REGIONS,
  type Region,
  type Resolution,
} from './model/types';
import { Narrator } from './narrate';
import { buildNodeItems, type NodeItem } from './nodes';
import { chosenVolume, defaultVolume, placeFor, showsVolumeChip, volumeChipText } from './place';
import { createEngine, type Engine } from './render/engine';
import { resolveAnnotations, SCENES } from './render/scenes';
import { createSim } from './sim';
import type { Sim, SimEvent, SimEventType, SimSource, VolumeMode } from './sim/types';
import type {
  DioramaControl,
  DioramaHandle,
  DioramaProps,
  HoverNodeInfo,
  NodeKilledInfo,
  TierFilter,
} from './types';

const DEFAULT_INSTANCES: Record<string, number> = {
  tiers: 0,
  network: 0,
  placement: 3,
  failover: 3,
  traffic: 3,
  sync: 3,
  deploy: 3,
};

/** Ambient requests per second by scene. Only `failover` runs traffic by itself. */
const DEFAULT_RATE: Record<string, number> = { failover: 0.9 };

const NO_CONTROLS: readonly DioramaControl[] = [];

function isRegion(s: string | null | undefined): s is Region {
  return typeof s === 'string' && (REGIONS as readonly string[]).includes(s);
}

/** Terrain density by the start quality tier: the three presets are sized to the three tiers' budgets. */
function defaultResolution(): Resolution {
  try {
    const { forced, plan } = initialPlan();
    const tier = forced && forced > 0 ? forced : plan.start;
    return tier >= 3 ? 'high' : tier === 2 ? 'default' : 'low';
  } catch {
    return 'default';
  }
}

/**
 * Whether the figure says that a replacement came back with an empty disk: exactly when the `lost-data`
 * annotation is on. The node list and the live region follow the picture, never run ahead of it.
 */
function emptyDiskShown(p: DioramaProps): boolean {
  return resolveAnnotations(p.scene, p.annotate, chosenVolume(p.volume, p.place)).includes('lost-data');
}

function hoverInfoOf(n: BenchNode): HoverNodeInfo {
  return {
    index: n.index,
    nodeId: n.id,
    cc: n.cc,
    country: n.country,
    label: n.label,
    region: n.region,
    tier: n.tier,
    count: n.count,
  };
}

interface Snapshot {
  status: string;
  total: number;
  healthy: number;
  count: number;
  /** A primary/standby volume has no primary right now. */
  gap: boolean;
  /** The volume model the simulation is running. */
  volume: VolumeMode;
  /** The continent "Break region" would take offline right now, or null when there is nothing to break. */
  breakRegion: Region | null;
  /** The deploy pipeline is running: the phase it is in, else null. */
  deploying: string | null;
  items: NodeItem[];
}

const EMPTY: Snapshot = {
  status: 'idle',
  total: 0,
  healthy: 0,
  count: 0,
  gap: false,
  volume: 'local',
  breakRegion: null,
  deploying: null,
  items: [],
};

const STATUS_TONE = { idle: 'off', starting: 'pending', up: 'ok', degraded: 'warn', down: 'crit' } as const;
const STATUS_WORD = {
  idle: 'No instances',
  starting: 'Starting',
  up: 'Up',
  degraded: 'Degraded',
  down: 'Down',
} as const;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export default function Diorama(props: DioramaProps) {
  const {
    scene,
    controls = NO_CONTROLS,
    live = false,
    geo = null,
    geoMeta = null,
    network = null,
    annotate,
    highlight,
    seed = 1,
    bare = false,
    className,
  } = props;
  const spec = SCENES[scene];
  const reducedPref = useReducedMotion();
  const reduced = props.reducedMotion ?? reducedPref;
  const paused = props.paused ?? false;
  const resolution = useMemo(() => props.resolution ?? defaultResolution(), [props.resolution]);
  const uid = useId();

  // The newest props for callbacks that outlive a render (events, timers, the engine).
  const latest = useRef(props);
  latest.current = props;

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const simRef = useRef<Sim | null>(null);
  const benchRef = useRef<Bench | null>(null);
  const hub = useRef(new Map<string, Set<(e: SimEvent) => void>>());
  const narratorRef = useRef<Narrator | null>(null);
  const liveTimer = useRef(0);
  const snapTimer = useRef(0);
  const sends = useRef(0);
  const countRef = useRef(0);
  const killSource = useRef<NodeKilledInfo['source']>('handle');

  // The first paint already names the right volume model (the sync scene is not a local volume).
  const [snap, setSnap] = useState<Snapshot>(() => ({
    ...EMPTY,
    volume: chosenVolume(props.volume, props.place) ?? defaultVolume(scene),
  }));
  const [liveText, setLiveText] = useState('');
  const [count, setCount] = useState<number>(() => props.instances ?? DEFAULT_INSTANCES[scene] ?? 3);
  const [regionSel, setRegionSel] = useState<string>(() => (isRegion(props.region) ? props.region : ''));
  const [tierState, setTierState] = useState<TierFilter>('all');
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const tier: TierFilter = props.tier ?? tierState;
  // The values the (re)creation effect needs, read without making it depend on them.
  const mirror = useRef({ tier, regionSel, reduced, paused });
  mirror.current = { tier, regionSel, reduced, paused };
  const setTier = useCallback((next: TierFilter): void => {
    setTierState(next);
    latest.current.onTierChange?.(next);
  }, []);

  const canKill = controls.includes('kill');
  const canKillRegion = controls.includes('kill-region');

  // ---- the bench: sample world, or the real clusters when live data is at hand -------------------
  const bench = useMemo<Bench>(() => {
    if (live && geo) {
      try {
        return buildLiveBench(geo, { resolution, seed });
      } catch {
        // A malformed snapshot must not take the figure down: fall back to the sample world.
      }
    }
    return buildSampleBench(seed, { resolution });
  }, [live, geo, resolution, seed]);

  // ---- snapshots for the DOM layer, throttled -----------------------------------------------------
  const takeSnapshot = useCallback((): void => {
    const sim = simRef.current;
    const b = benchRef.current;
    if (!sim || !b) return;
    const st = sim.state();
    const l = latest.current;
    const items = buildNodeItems(b, st, {
      interactive: l.controls?.includes('kill') ?? false,
      specimen: SCENES[l.scene].specimen,
      emptyDisk: emptyDiskShown(l),
    });
    const chosen = mirror.current.regionSel;
    setSnap({
      status: st.app.status,
      total: st.app.total,
      healthy: st.app.healthy,
      count: st.count,
      gap: st.volume.gap,
      volume: st.volume.mode,
      breakRegion: regionToBreak(b, st, isRegion(chosen) ? chosen : null),
      deploying: st.deploy.active ? (st.deploy.phase ?? 'spec') : null,
      items,
    });
  }, []);

  const scheduleSnapshot = useCallback((): void => {
    if (snapTimer.current) return;
    snapTimer.current = window.setTimeout(() => {
      snapTimer.current = 0;
      takeSnapshot();
    }, 120);
  }, [takeSnapshot]);

  const scheduleNarration = useCallback((): void => {
    if (liveTimer.current) return;
    liveTimer.current = window.setTimeout(() => {
      liveTimer.current = 0;
      const text = narratorRef.current?.flush();
      if (text) setLiveText(text);
    }, 700);
  }, []);

  const handleRef = useRef<DioramaHandle | null>(null);

  // ---- the simulation and the engine ----------------------------------------------------------------
  // Rebuilt only when the bench or the seed changes; every other prop is applied in place below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = stageRef.current;
    if (!canvas || !host) return;
    const p = latest.current;
    const sim = createSim({ bench, seed, place: placeFor(scene, p.place, p.volume) });
    simRef.current = sim;
    benchRef.current = bench;
    const narrator = new Narrator({
      labelOf: (id) => bench.nodes[sim.nodeIndex(id)]?.label ?? id,
      regionName: (r) => REGION_NAMES[r as Region] ?? r,
      emptyDisk: () => emptyDiskShown(latest.current),
    });
    narratorRef.current = narrator;
    sends.current = 0;

    const isInstanceNode = (index: number): boolean => {
      for (const s of sim.state().instances) if (s.node === index) return true;
      return false;
    };

    const engine = createEngine({
      canvas,
      host,
      sim,
      scene,
      annotate,
      volume: chosenVolume(p.volume, p.place),
      region: isRegion(mirror.current.regionSel) ? mirror.current.regionSel : null,
      tierFilter: mirror.current.tier,
      reducedMotion: mirror.current.reduced,
      paused: mirror.current.paused,
      domain: p.domain,
      ports: p.ports,
      onHover: (info) => {
        const l = latest.current;
        const killable = !!(
          info &&
          info.kind === 'node' &&
          l.controls?.includes('kill') &&
          isInstanceNode(info.index)
        );
        canvas.style.cursor = killable ? 'pointer' : '';
        const n = info && info.kind === 'node' ? bench.nodes[info.index] : undefined;
        l.onHoverNode?.(n ? hoverInfoOf(n) : null);
      },
      onActivate: (info) => {
        if (info.kind !== 'node' || !latest.current.controls?.includes('kill')) return;
        const n = bench.nodes[info.index];
        if (!n) return;
        killSource.current = 'canvas';
        try {
          if (sim.state().nodeUp[info.index] === 1) {
            if (isInstanceNode(info.index)) sim.kill(n.id);
          } else sim.revive(n.id);
        } finally {
          killSource.current = 'handle';
        }
      },
    });
    engineRef.current = engine;
    engine.setHighlight(p.highlight && p.highlight.length > 0 ? p.highlight : null);

    const off = sim.on('*', (e: SimEvent) => {
      const l = latest.current;
      narrator.push(e);
      scheduleNarration();
      scheduleSnapshot();
      const subs = hub.current;
      for (const fn of subs.get('*') ?? []) fn(e);
      for (const fn of subs.get(e.type) ?? []) fn(e);
      l.onEvent?.(e);
      if (e.type === 'node-down' && e.scope === 'node') {
        l.onNodeKilled?.({
          nodeId: e.nodeId,
          label: e.label,
          region: e.region,
          slots: e.slots,
          distinct: sim.state().counters.distinctKills,
          source: killSource.current,
        });
      } else if (e.type === 'promoted') {
        const i = sim.nodeIndex(e.nodeId);
        l.onPromoted?.({ nodeId: e.nodeId, label: bench.nodes[i]?.label ?? e.nodeId, gapMs: e.gapMs });
      }
    });

    // Opening state.
    const want = countRef.current > 0 ? countRef.current : (p.instances ?? DEFAULT_INSTANCES[scene] ?? 3);
    countRef.current = want;
    const startRegion = mirror.current.regionSel;
    if (isRegion(startRegion) && !SCENES[scene].census) sim.configure({ regions: [startRegion] });
    if (SCENES[scene].pipeline) {
      if (p.autoDeploy !== false && want > 0) sim.startDeploy({ instances: want });
    } else if (want > 0) {
      sim.setInstances(want);
    }
    setCount(want);
    takeSnapshot();
    setVersion((n) => n + 1);
    if (handleRef.current) p.onReady?.(handleRef.current);

    return () => {
      off();
      engine.dispose();
      engineRef.current = null;
      simRef.current = null;
      benchRef.current = null;
      narratorRef.current = null;
      window.clearTimeout(liveTimer.current);
      window.clearTimeout(snapTimer.current);
      liveTimer.current = 0;
      snapTimer.current = 0;
    };
  }, [bench, seed]);

  // ---- props applied in place -------------------------------------------------------------------------
  // (The creation effect above applies the same values to a freshly built engine.)
  // The volume a stage chose on purpose, if any. The simulation follows it (below); the engine only needs
  // it for the scene's default annotations.
  const volumeChoice = chosenVolume(props.volume, props.place);
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setVolume(volumeChoice);
    engine.setScene(scene);
    engine.setAnnotations(annotate ?? undefined);
    // The node list says what the annotations say.
    scheduleSnapshot();
  }, [scene, annotate, volumeChoice, scheduleSnapshot]);

  // A new scene starts clean: the placement options of that scene, a healthy bench, its own count.
  const lastScene = useRef(scene);
  useEffect(() => {
    if (scene === lastScene.current) return;
    lastScene.current = scene;
    const sim = simRef.current;
    if (!sim) return;
    const l = latest.current;
    sim.reset();
    sim.configure(placeFor(scene, l.place, l.volume));
    const want = l.instances ?? DEFAULT_INSTANCES[scene] ?? 3;
    countRef.current = want;
    setCount(want);
    if (SCENES[scene].pipeline) {
      if (l.autoDeploy !== false && want > 0) sim.startDeploy({ instances: want });
    } else if (want > 0) sim.setInstances(want);
    engineRef.current?.invalidate();
  }, [scene]);

  // The volume mode follows the stage: the chosen one, else what the scene does on its own.
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.configure({ volume: volumeChoice ?? defaultVolume(scene) });
    engineRef.current?.invalidate();
    scheduleSnapshot();
  }, [volumeChoice, scene, scheduleSnapshot]);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reduced);
  }, [reduced]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    engineRef.current?.setDomain(props.domain ?? 'myapp.app.runonflux.io');
    engineRef.current?.setPorts(props.ports);
  }, [props.domain, props.ports]);

  useEffect(() => {
    engineRef.current?.setTierFilter(tier);
  }, [tier]);

  useEffect(() => {
    engineRef.current?.setHighlight(highlight && highlight.length > 0 ? highlight : null);
  }, [highlight]);

  // The number of instances follows the prop when it changes.
  const lastInstances = useRef<number | undefined>(props.instances);
  useEffect(() => {
    if (props.instances === lastInstances.current) return;
    lastInstances.current = props.instances;
    const sim = simRef.current;
    if (!sim || props.instances === undefined) return;
    countRef.current = props.instances;
    setCount(props.instances);
    if (SCENES[scene].pipeline) sim.startDeploy({ instances: props.instances });
    else sim.setInstances(props.instances);
  }, [props.instances, scene]);

  // A step that restates its starting number: re-apply it (a deploy pipeline is not restarted by this).
  const lastReset = useRef<string | number | undefined>(props.resetKey);
  useEffect(() => {
    if (props.resetKey === lastReset.current) return;
    lastReset.current = props.resetKey;
    const sim = simRef.current;
    const n = props.instances;
    if (!sim || n === undefined || SCENES[scene].pipeline) return;
    countRef.current = n;
    setCount(n);
    sim.setInstances(n);
  }, [props.resetKey, props.instances, scene]);

  // The region follows the prop, and the built-in select.
  useEffect(() => {
    setRegionSel(isRegion(props.region) ? props.region : '');
  }, [props.region]);
  useEffect(() => {
    const sim = simRef.current;
    const engine = engineRef.current;
    if (!sim || !engine) return;
    const r = isRegion(regionSel) ? regionSel : null;
    engine.setRegion(r);
    if (!SCENES[scene].census) sim.configure({ regions: r ? [r] : [] });
    // "Break region" follows the chooser.
    scheduleSnapshot();
  }, [regionSel, scene, scheduleSnapshot]);

  // Accent switches re-tint the canvas.
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    let frame = 0;
    const mo = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        engineRef.current?.restyle();
      });
    });
    const opts = {
      attributes: true,
      attributeFilter: ['data-accent', 'data-tier', 'class', 'style', 'data-theme'],
    };
    mo.observe(document.documentElement, opts);
    const parent = stageRef.current?.parentElement;
    if (parent) mo.observe(parent, opts);
    return () => {
      mo.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // ---- ambient traffic -----------------------------------------------------------------------------------
  // A ref so the handle can change the rate without a render; the interval re-arms on change.
  const [rate, setRate] = useState<number>(props.requestRate ?? DEFAULT_RATE[scene] ?? 0);
  useEffect(() => {
    setRate(props.requestRate ?? DEFAULT_RATE[scene] ?? 0);
  }, [props.requestRate, scene]);
  useEffect(() => {
    if (rate <= 0 || paused) return;
    const period = Math.max(50, 1000 / rate);
    const id = window.setInterval(() => {
      const sim = simRef.current;
      if (!sim || document.hidden) return;
      if (sim.state().app.total > 0) {
        sim.send();
        // Under reduced motion no frame loop runs; this wakes the engine so the packet is settled.
        engineRef.current?.invalidate();
      }
    }, period);
    return () => window.clearInterval(id);
  }, [rate, paused]);

  // ---- the handle ----------------------------------------------------------------------------------------
  const handle = useMemo<DioramaHandle>(() => {
    const withSim = <T,>(fn: (s: Sim) => T, fallback: T): T => {
      const s = simRef.current;
      return s ? fn(s) : fallback;
    };
    const wake = (): void => engineRef.current?.invalidate();
    const h: DioramaHandle = {
      setInstances(n, place) {
        return withSim((s) => {
          const c = Math.max(0, Math.min(100, Math.round(n)));
          countRef.current = c;
          setCount(c);
          const placed = s.setInstances(c, place);
          latest.current.onInstances?.(c);
          wake();
          return placed;
        }, 0);
      },
      killRandom: () => withSim((s) => s.killRandomInstanceNode(), null),
      killPrimary: () => withSim((s) => s.killPrimary(), null),
      kill: (id) => withSim((s) => s.kill(id), false),
      killRegion: (r) => withSim((s) => s.killRegion(r), []),
      revive: (id) => withSim((s) => s.revive(id), false),
      reviveAll: () => withSim((s) => s.reviveAll(), undefined),
      send(from?: SimSource) {
        return withSim((s) => {
          const id = s.send(from);
          if (id >= 0) {
            sends.current++;
            narratorRef.current?.expect(id);
            latest.current.onRequest?.({ packet: id, count: sends.current });
            wake();
          }
          return id;
        }, -1);
      },
      setRequestRate(perSecond) {
        setRate(Math.max(0, perSecond));
      },
      reset(s) {
        withSim((sim) => sim.reset(s), undefined);
        sends.current = 0;
        wake();
      },
      replay() {
        const sim = simRef.current;
        if (!sim) return;
        sim.reset();
        sends.current = 0;
        const n = countRef.current;
        if (SCENES[latest.current.scene].pipeline) sim.startDeploy({ instances: n });
        else if (n > 0) sim.setInstances(n);
        wake();
      },
      startDeploy(o) {
        withSim((s) => s.startDeploy(o), undefined);
        wake();
      },
      beat() {
        engineRef.current?.beat();
      },
      on(type: '*' | SimEventType, fn: (e: SimEvent) => void) {
        let set = hub.current.get(type);
        if (!set) {
          set = new Set();
          hub.current.set(type, set);
        }
        set.add(fn);
        return () => {
          set?.delete(fn);
        };
      },
      state: () => simRef.current?.state() ?? null,
      get sim() {
        return simRef.current;
      },
      get bench() {
        return benchRef.current;
      },
      stats: () => engineRef.current?.stats() ?? null,
    };
    handleRef.current = h;
    return h;
  }, []);
  useImperativeHandle(props.ref, () => handle, [handle]);

  // ---- the control bar -----------------------------------------------------------------------------------
  const sliderMax = Math.max(props.maxInstances ?? 12, count, 2);
  const onSlider = useCallback((n: number): void => {
    countRef.current = n;
    setCount(n);
    const sim = simRef.current;
    // The deploy scene replays on commit; the others follow the thumb.
    if (sim && !SCENES[latest.current.scene].pipeline) sim.setInstances(n);
  }, []);
  const onSliderCommit = useCallback((n: number): void => {
    const sim = simRef.current;
    if (sim && SCENES[latest.current.scene].pipeline) sim.startDeploy({ instances: n });
    latest.current.onInstances?.(n);
  }, []);

  const doKill = useCallback((): void => {
    const sim = simRef.current;
    if (!sim) return;
    killSource.current = 'control';
    try {
      if (latest.current.scene === 'sync') sim.killPrimary();
      else sim.killRandomInstanceNode();
    } finally {
      killSource.current = 'handle';
    }
  }, []);
  const doKillRegion = useCallback((): void => {
    const sim = simRef.current;
    const b = benchRef.current;
    if (!sim || !b) return;
    const chosenRegion = mirror.current.regionSel;
    const target = regionToBreak(b, sim.state(), isRegion(chosenRegion) ? chosenRegion : null);
    if (target) sim.killRegion(target);
  }, []);
  const doRevive = useCallback((): void => {
    simRef.current?.reviveAll();
  }, []);
  const doRequest = useCallback((): void => {
    handleRef.current?.send();
  }, []);
  const doReplay = useCallback((): void => {
    handleRef.current?.replay();
  }, []);

  // ---- the node list -----------------------------------------------------------------------------------
  const listRef = useRef<HTMLUListElement>(null);
  const items = snap.items;
  const activeKey = focusKey && items.some((i) => i.key === focusKey) ? focusKey : (items[0]?.key ?? null);

  const focusItem = useCallback((item: NodeItem | undefined): void => {
    if (!item) return;
    setFocusKey(item.key);
    listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(item.key)}"]`)?.focus();
  }, []);

  const onListKey = useCallback(
    (e: ReactKeyboardEvent<HTMLUListElement>): void => {
      const idx = items.findIndex((i) => i.key === activeKey);
      let next = idx;
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          next = Math.min(items.length - 1, idx + 1);
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          next = Math.max(0, idx - 1);
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = items.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      focusItem(items[next]);
    },
    [items, activeKey, focusItem],
  );

  const activate = useCallback((item: NodeItem): void => {
    const sim = simRef.current;
    const b = benchRef.current;
    if (!sim || !b || item.node < 0 || !item.action) return;
    const n = b.nodes[item.node];
    if (!n) return;
    killSource.current = 'keyboard';
    try {
      if (item.action === 'kill') sim.kill(n.id);
      else sim.revive(n.id);
    } finally {
      killSource.current = 'handle';
    }
  }, []);

  const onItemFocus = useCallback((item: NodeItem): void => {
    setFocusKey(item.key);
    engineRef.current?.focusNode(item.node >= 0 ? item.node : null);
    const n = item.node >= 0 ? benchRef.current?.nodes[item.node] : undefined;
    latest.current.onHoverNode?.(n ? hoverInfoOf(n) : null);
  }, []);

  const onItemBlur = useCallback((): void => {
    engineRef.current?.focusNode(null);
    latest.current.onHoverNode?.(null);
  }, []);

  // ---- render ----------------------------------------------------------------------------------------------
  const statusKey = (snap.status in STATUS_TONE ? snap.status : 'idle') as keyof typeof STATUS_TONE;
  const showStatus = spec.specimen && !bare;
  const hasBar = !bare && controls.length > 0;
  const hasFilters = spec.census && !bare;
  const isLive = bench.kind === 'live';
  const tiers = network?.nodes.tiers ?? bench.totals.tiers;
  const showCounts = isLive || network !== null;
  const aspect = props.aspect ?? (spec.census ? '2 / 1' : '16 / 9');
  const aspectNarrow = props.aspect ?? (spec.census ? '16 / 10' : '4 / 3');
  const figureLabel =
    props.label ??
    (spec.census
      ? 'Map of the Flux network by node tier'
      : `Simulated Flux network with your app: ${plural(snap.count, 'instance', 'instances')}`);

  return (
    <figure
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-scene={scene}
      data-status={snap.status}
      data-instances={snap.count}
      data-ready={version > 0 ? 'true' : 'false'}
      aria-label={figureLabel}
    >
      <Panel variant="slab" padding="none" clip marks halo={false} contentClassName={styles.frame}>
        {!bare && (
          <div className={styles.chips}>
            {showStatus && (
              <Chip
                kind="status"
                status={snap.deploying ? 'pending' : snap.gap ? 'crit' : STATUS_TONE[statusKey]}
                size="sm"
              >
                {snap.deploying ? (
                  `Deploying: ${snap.deploying}`
                ) : snap.gap ? (
                  'Down, no primary (time compressed)'
                ) : snap.total > 0 ? (
                  <>
                    {STATUS_WORD[statusKey]}
                    <span className={styles.wideOnly}>, {plural(snap.total, 'instance', 'instances')}</span>,{' '}
                    {snap.healthy} healthy
                  </>
                ) : (
                  STATUS_WORD[statusKey]
                )}
              </Chip>
            )}
            {props.hideFreshness ? null : isLive ? (
              <FreshnessChip source={geoMeta?.source ?? 'cache'} ageMs={geoMeta?.ageMs ?? null} />
            ) : (
              <FreshnessChip kind="simulation" />
            )}
            {showsVolumeChip(scene, volumeChoice) && (
              <Chip size="sm" icon="volume" className={styles.volumeChip} data-volume={snap.volume}>
                {volumeChipText(snap.volume)}
              </Chip>
            )}
          </div>
        )}
        <div
          className={styles.stage}
          ref={stageRef}
          style={{ '--dio-aspect': aspect, '--dio-aspect-narrow': aspectNarrow } as CSSProperties}
        >
          {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas is not focusable; the DOM layer below is its parallel */}
          <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        </div>
      </Panel>

      {hasFilters && (
        // biome-ignore lint/a11y/useSemanticElements: a wrapping row of filter chips, not a form group
        <div className={styles.filters} role="group" aria-label="Filter nodes by tier">
          <Chip kind="filter" selected={tier === 'all'} onClick={() => setTier('all')}>
            All tiers
          </Chip>
          {(['cumulus', 'nimbus', 'stratus'] as const).map((t) => (
            <Chip
              key={t}
              kind="filter"
              tier={t}
              selected={tier === t}
              count={showCounts ? tiers[t].toLocaleString('en-US') : undefined}
              onClick={() => setTier(tier === t ? 'all' : t)}
            >
              {t === 'cumulus' ? 'Cumulus' : t === 'nimbus' ? 'Nimbus' : 'Stratus'}
            </Chip>
          ))}
          {isLive && (
            <span className={styles.totals}>
              {bench.totals.nodes.toLocaleString('en-US')} nodes in {bench.totals.countries} countries
            </span>
          )}
        </div>
      )}

      {hasBar && (
        // biome-ignore lint/a11y/useSemanticElements: a wrapping row of controls, not a form group
        <div className={styles.bar} role="group" aria-label="Figure controls">
          {controls.includes('instances') && (
            <Slider
              className={styles.slider}
              label="Instances"
              min={1}
              max={sliderMax}
              step={1}
              value={Math.max(1, count)}
              onValueChange={onSlider}
              onValueCommit={onSliderCommit}
              marks
              unit={count === 1 ? 'instance' : 'instances'}
            />
          )}
          {(controls.includes('region') || canKillRegion) && (
            <div className={styles.regionGroup}>
              {controls.includes('region') && (
                <Select
                  className={styles.region}
                  label="Region"
                  options={[
                    { value: '', label: 'Everywhere' },
                    ...REGIONS.map((r) => ({ value: r, label: REGION_NAMES[r] })),
                  ]}
                  value={regionSel}
                  onValueChange={setRegionSel}
                />
              )}
              {canKillRegion && (
                <Button
                  size="sm"
                  icon="region"
                  onClick={doKillRegion}
                  disabled={snap.breakRegion === null}
                  aria-label={
                    snap.breakRegion ? `Break region: ${REGION_NAMES[snap.breakRegion]}` : 'Break region'
                  }
                  title={
                    snap.breakRegion
                      ? `Takes every node in ${REGION_NAMES[snap.breakRegion]} offline`
                      : 'No region has anything left to break'
                  }
                >
                  Break region
                </Button>
              )}
            </div>
          )}
          <div className={styles.buttons}>
            {canKill && (
              <Button size="sm" icon="node-off" onClick={doKill} disabled={snap.total === 0}>
                {scene === 'sync' ? 'Take the primary offline' : 'Take a node offline'}
              </Button>
            )}
            {controls.includes('revive') && (
              <Button size="sm" icon="node" onClick={doRevive}>
                Bring nodes back
              </Button>
            )}
            {controls.includes('request') && (
              <Button
                size="sm"
                variant="primary"
                icon="packet"
                onClick={doRequest}
                disabled={snap.total === 0}
              >
                Send a request
              </Button>
            )}
            {controls.includes('replay') && (
              <Button size="sm" variant="ghost" icon="restart" onClick={doReplay}>
                Replay
              </Button>
            )}
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className={styles.nodesWrap}>
          <p id={`${uid}-hint`} className={styles.nodesHint}>
            Nodes that matter. Arrow keys move between them
            {canKill ? '; Enter takes an instance offline or brings it back.' : '.'}
          </p>
          <ul
            ref={listRef}
            className={styles.nodes}
            aria-label="Nodes that matter"
            aria-describedby={`${uid}-hint`}
            onKeyDown={onListKey}
          >
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={styles.node}
                  data-key={item.key}
                  data-kind={item.kind}
                  tabIndex={item.key === activeKey ? 0 : -1}
                  aria-label={
                    item.action
                      ? `${item.label}. Press Enter to ${item.action === 'kill' ? 'take it offline' : 'bring it back'}.`
                      : item.label
                  }
                  onFocus={() => onItemFocus(item)}
                  onBlur={onItemBlur}
                  onClick={() => activate(item)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={styles.live} role="status" aria-live="polite" aria-atomic="true">
        {liveText}
      </p>
    </figure>
  );
}
