/**
 * The headless, deterministic simulation behind the diorama: placement, node health, request routing,
 * volume replication roles and the deploy timeline. No DOM, no wall clock, no `Math.random`: the same
 * bench, seed, rules and sequence of calls always produce the same events at the same simulated times.
 *
 * The behaviours that make claims about Flux are NOT written here. They live in `rules.ts`, each with its
 * FACTS reference. This file only wires them together:
 *
 *   placement    chooseNode()       eligible nodes, then a seeded random pick (FACTS 2.4, 3.5, 6.2)
 *   health       nodeDown(), ejection and reinstatement delays (FACTS 6.4 health check)
 *   routing      send(), arrive(), redispatch() (FACTS 6.4 round robin, retries, redispatch)
 *   volumes      roles, sync, election and the write gap (FACTS 7.2 and 6.4 primary/standby)
 *   deploy       the timeline of FACTS 6.1
 */
import type { BenchNode, Region } from '../model/types';
import { greatCircleKm, hashInts, mulberry32, pickWeighted, type Rng } from '../util';
import {
  competingTiers,
  constraintFromOptions,
  DEFAULT_RULES,
  deployTotalMs,
  ejectDelayMs,
  everyInstanceServes,
  faultDomainCap,
  faultDomainsApply,
  geolocationAllows,
  ipKey,
  legDurationMs,
  mergeRules,
  modelledLatencyMs,
  nodeWeight,
  operatorKey,
  reinstateDelayMs,
  replacementStartsEmpty,
  replicatesData,
  tierSteps,
} from './rules';
import type {
  AppStatus,
  Counters,
  DeployPhase,
  Instance,
  Packet,
  PlaceOptions,
  Sim,
  SimEvent,
  SimEventType,
  SimOptions,
  SimSource,
  SimState,
} from './types';

interface Timer {
  at: number;
  seq: number;
  cancelled: boolean;
  run: () => void;
}

/** An instance plus the bookkeeping the simulation needs but the renderer does not. */
interface Slot extends Instance {
  /** Sim time the current start completes. */
  finishAt: number;
  /** The router has dropped it, so a return needs `rise` good checks. */
  ejected: boolean;
  /** The elected primary is starting to serve. */
  promoting: boolean;
  respawnTimer: Timer | null;
}

interface PacketInternal extends Packet {
  removeAt: number;
  failedSlots: number[];
  /** Serial of the incarnation the packet was last sent to. */
  serial: number;
}

function emptyCounters(): Counters {
  return {
    sent: 0,
    served: 0,
    rerouted: 0,
    failed: 0,
    kills: 0,
    distinctKills: 0,
    respawns: 0,
    placements: 0,
  };
}

export function createSim(options: SimOptions): Sim {
  const bench = options.bench;
  const rules = mergeRules(DEFAULT_RULES, options.rules);
  const nodes = bench.nodes;
  const nodeCount = nodes.length;
  const idToIndex = new Map<string, number>();
  for (const n of nodes) idToIndex.set(n.id, n.index);

  let seed = (options.seed ?? 1) >>> 0;
  let chaos: Rng = mulberry32(hashInts(seed, 0xc4a05));
  let time = 0;
  let acc = 0;
  let timerSeq = 0;
  let packetSeq = 0;
  let sendSeq = 0;
  let rr = 0;
  let appStatusKey = '';
  let lastRequested = 0;

  const timers: Timer[] = [];
  const listeners = new Map<string, Set<(e: SimEvent) => void>>();
  const killedDistinct = new Set<string>();
  const sticky = new Map<number, number>();

  const state: SimState = {
    time: 0,
    count: 0,
    instances: [],
    nodeUp: new Uint8Array(nodeCount).fill(1),
    down: [],
    packets: [],
    volume: {
      mode: 'local',
      primarySlot: -1,
      gap: false,
      gapSince: -1,
      gapTotalMs: 0,
      lastGapMs: 0,
      promotions: 0,
    },
    deploy: {
      active: false,
      phase: null,
      index: -1,
      phaseProgress: 0,
      progress: 0,
      startedAt: 0,
      target: 0,
      candidates: [],
    },
    counters: emptyCounters(),
    app: { status: 'idle', total: 0, healthy: 0, inRotation: 0, availability: 1, upMs: 0, downMs: 0 },
    proxy: {
      x: (bench.extent.minX + bench.extent.maxX) / 2,
      y: (bench.extent.minY + bench.extent.maxY) / 2,
    },
    place: {
      spread: 'random',
      appSize: 'small',
      waitedMin: 0,
      volume: 'local',
      regions: [],
      countries: [],
      denyRegions: [],
    },
  };
  const slots = state.instances as Slot[];
  const packets = state.packets as PacketInternal[];

  // ---- events and timers ---------------------------------------------------------------------------

  function emit(e: SimEvent): void {
    const exact = listeners.get(e.type);
    if (exact) for (const fn of [...exact]) fn(e);
    const all = listeners.get('*');
    if (all) for (const fn of [...all]) fn(e);
  }

  function schedule(at: number, run: () => void): Timer {
    const timer: Timer = { at, seq: timerSeq++, cancelled: false, run };
    let lo = 0;
    let hi = timers.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const t = timers[mid] as Timer;
      if (t.at < at || (t.at === at && t.seq < timer.seq)) lo = mid + 1;
      else hi = mid;
    }
    timers.splice(lo, 0, timer);
    return timer;
  }

  function cancel(timer: Timer | null): void {
    if (timer) timer.cancelled = true;
  }

  function runDue(): number {
    let fired = 0;
    while (timers.length > 0 && (timers[0] as Timer).at <= time) {
      const t = timers.shift() as Timer;
      if (!t.cancelled) {
        t.run();
        fired++;
      }
    }
    return fired;
  }

  // ---- small helpers -------------------------------------------------------------------------------

  const node = (i: number): BenchNode => nodes[i] as BenchNode;

  function isPrimarySlot(slot: number): boolean {
    return state.volume.mode === 'primary-standby' && state.volume.primarySlot === slot;
  }

  function emptySlot(slot: number): Slot {
    return {
      slot,
      serial: 0,
      node: -1,
      nodeId: '',
      status: 'unplaced',
      inRotation: false,
      serving: false,
      since: time,
      placedAt: time,
      startProgress: 0,
      role: 'none',
      sync: 1,
      respawned: false,
      dataLost: false,
      waitedMin: 0,
      served: 0,
      finishAt: 0,
      ejected: false,
      promoting: false,
      respawnTimer: null,
    };
  }

  /** Whether the slot's container can answer a request right now (the truth, not the router's belief). */
  function canServe(s: Slot): boolean {
    if (s.node < 0 || s.status !== 'running') return false;
    if (state.nodeUp[s.node] !== 1) return false;
    if (s.sync < 1) return false;
    if (state.volume.mode === 'primary-standby') return state.volume.primarySlot === s.slot && !s.promoting;
    return true;
  }

  function nodeLabel(i: number): string {
    return node(i).label || node(i).id;
  }

  // ---- placement (rules: eligibility and pick) -----------------------------------------------------

  function chooseNode(
    slot: number,
    serial: number,
    totalTarget: number,
  ): { node: number; waited: number } | null {
    const p = state.place;
    const usedNode = new Set<number>();
    const usedIp = new Set<string>();
    const usedOperator = new Map<string, number>();
    const regionUse: Record<Region, number> = { NA: 0, SA: 0, EU: 0, AF: 0, AS: 0, OC: 0 };
    for (const s of slots) {
      if (s.slot === slot || s.node < 0) continue;
      const n = node(s.node);
      usedNode.add(s.node);
      usedIp.add(ipKey(n));
      const key = operatorKey(n);
      usedOperator.set(key, (usedOperator.get(key) ?? 0) + 1);
      regionUse[n.region]++;
    }
    const geo = constraintFromOptions(p.regions, p.countries, p.denyRegions);
    const base: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      if (state.nodeUp[i] !== 1 || usedNode.has(i)) continue;
      const n = node(i);
      if (!geolocationAllows(geo, n.region, n.cc)) continue;
      if (rules.placement.distinctIp && usedIp.has(ipKey(n))) continue;
      base.push(i);
    }
    let candidates = base;
    if (faultDomainsApply(rules.placement, p.volume) && base.length > 0) {
      const domains = new Set<string>();
      for (const i of base) domains.add(operatorKey(node(i)));
      const cap = faultDomainCap(totalTarget, domains.size);
      candidates = base.filter((i) => (usedOperator.get(operatorKey(node(i))) ?? 0) < cap);
      if (candidates.length === 0) candidates = base;
    }
    if (candidates.length === 0) return null;

    // Tiers join in order of their install delay; the app "waits" until some eligible node competes.
    const waits = [p.waitedMin, ...tierSteps(rules.placement, p.appSize).filter((d) => d > p.waitedMin)];
    let weights: number[] = [];
    let waited = p.waitedMin;
    for (const w of waits) {
      const competing = competingTiers(rules.placement, p.appSize, w);
      weights = candidates.map((i) => nodeWeight(node(i), competing));
      if (weights.some((x) => x > 0)) {
        waited = w;
        break;
      }
    }
    if (!weights.some((x) => x > 0)) return null;

    if (p.spread === 'regions') {
      let least = Number.POSITIVE_INFINITY;
      candidates.forEach((i, k) => {
        if ((weights[k] as number) > 0) least = Math.min(least, regionUse[node(i).region]);
      });
      weights = weights.map((w, k) => (regionUse[node(candidates[k] as number).region] === least ? w : 0));
    }

    const rng = mulberry32(hashInts(seed, slot, serial, 0x5107));
    const k = pickWeighted(weights, rng);
    if (k < 0) return null;
    return { node: candidates[k] as number, waited };
  }

  /** Other instances that hold a copy of the data on a node that is up. */
  function survivingCopies(except: number): number {
    let n = 0;
    for (const s of slots) {
      if (s.slot === except || s.node < 0) continue;
      if (state.nodeUp[s.node] === 1 && s.sync >= 1) n++;
    }
    return n;
  }

  /**
   * Gives a slot a node and starts its container. `finishAt` overrides when the start completes (the
   * deploy timeline lands every instance together at the end of its install phase).
   */
  function placeSlot(slot: number, totalTarget: number, respawn: boolean, finishAt?: number): boolean {
    const s = slots[slot] as Slot;
    const pick = chooseNode(slot, s.serial + 1, totalTarget);
    if (!pick) {
      s.node = -1;
      s.nodeId = '';
      s.status = 'unplaced';
      s.inRotation = false;
      s.serving = false;
      s.role = 'none';
      s.since = time;
      emit({ type: 'unplaced', at: time, slot, reason: 'no eligible node' });
      return false;
    }
    s.serial++;
    s.node = pick.node;
    s.nodeId = node(pick.node).id;
    s.status = 'starting';
    s.since = time;
    s.placedAt = time;
    s.startProgress = 0;
    s.inRotation = false;
    s.serving = false;
    s.ejected = false;
    s.promoting = false;
    s.respawned = respawn;
    s.waitedMin = pick.waited;
    s.served = 0;
    cancel(s.respawnTimer);
    s.respawnTimer = null;

    const mode = state.volume.mode;
    const copies = survivingCopies(slot);
    s.dataLost = respawn && replacementStartsEmpty(mode, copies);
    if (!replicatesData(mode)) {
      s.sync = 1;
      s.role = 'local';
    } else {
      // The first instance of a replicated volume is its leader and starts with its own data.
      s.sync = copies === 0 ? 1 : 0;
      s.role = mode === 'replicated' ? 'active' : 'standby';
    }
    s.finishAt = finishAt ?? time + rules.health.startMs;
    state.counters.placements++;
    const n = node(pick.node);
    emit({
      type: 'placed',
      at: time,
      slot,
      node: pick.node,
      nodeId: n.id,
      label: nodeLabel(pick.node),
      region: n.region,
      tier: n.tier,
      respawn,
      dataLost: s.dataLost,
    });
    const serial = s.serial;
    schedule(s.finishAt, () => finishStart(slot, serial));
    return true;
  }

  function finishStart(slot: number, serial: number): void {
    const s = slots[slot];
    if (!s || s.serial !== serial || s.status !== 'starting') return;
    if (s.node < 0 || state.nodeUp[s.node] !== 1) {
      s.status = 'crashed';
      s.since = time;
      return;
    }
    s.status = 'running';
    s.since = time;
    s.startProgress = 1;
    emit({ type: 'running', at: time, slot, nodeId: s.nodeId });
    afterReady(s);
  }

  /** Called whenever an instance may have become ready: elect a primary, join rotation. */
  function afterReady(s: Slot): void {
    if (state.volume.mode === 'primary-standby') tryElect();
    maybeJoin(s);
    refreshApp();
  }

  function maybeJoin(s: Slot): void {
    if (s.status !== 'running' || s.sync < 1 || s.node < 0 || state.nodeUp[s.node] !== 1) return;
    if (state.volume.mode === 'primary-standby' && !(state.volume.primarySlot === s.slot && !s.promoting)) {
      return;
    }
    s.serving = true;
    if (s.inRotation) return;
    if (s.ejected) {
      // Back from a failure: the load balancer needs `rise` good checks first.
      const serial = s.serial;
      schedule(time + reinstateDelayMs(rules.health), () => {
        const cur = slots[s.slot];
        if (!cur || cur.serial !== serial || !canServe(cur)) return;
        cur.ejected = false;
        cur.inRotation = true;
        emit({ type: 'joined', at: time, slot: cur.slot, nodeId: cur.nodeId });
      });
      return;
    }
    s.inRotation = true;
    emit({ type: 'joined', at: time, slot: s.slot, nodeId: s.nodeId });
  }

  // ---- instances ---------------------------------------------------------------------------------

  function removeLastSlot(): void {
    const s = slots.pop() as Slot;
    cancel(s.respawnTimer);
    if (state.volume.primarySlot === s.slot) state.volume.primarySlot = -1;
    if (s.node >= 0) emit({ type: 'removed', at: time, slot: s.slot, nodeId: s.nodeId });
  }

  const sameList = (a: readonly string[], b: readonly string[]): boolean => a.join() === b.join();

  /**
   * Applies placement options. `geo` is true when the allow or deny lists changed (instances on a node
   * that no longer qualifies move); `again` is true when the app itself changed (size, wait), which is a
   * different deployment: every instance is placed afresh.
   */
  function applyOptions(opts: PlaceOptions | undefined): { geo: boolean; again: boolean } {
    const out = { geo: false, again: false };
    if (!opts) return out;
    const p = state.place;
    if (opts.regions !== undefined && !sameList(opts.regions, p.regions)) {
      p.regions = [...opts.regions];
      out.geo = true;
    }
    if (opts.countries !== undefined && !sameList(opts.countries, p.countries)) {
      p.countries = [...opts.countries];
      out.geo = true;
    }
    if (opts.denyRegions !== undefined && !sameList(opts.denyRegions, p.denyRegions)) {
      p.denyRegions = [...opts.denyRegions];
      out.geo = true;
    }
    if (opts.spread !== undefined) p.spread = opts.spread;
    if (opts.appSize !== undefined && opts.appSize !== p.appSize) {
      p.appSize = opts.appSize;
      out.again = true;
    }
    if (opts.waitedMin !== undefined && opts.waitedMin !== p.waitedMin) {
      p.waitedMin = opts.waitedMin;
      out.again = true;
    }
    if (opts.volume !== undefined && opts.volume !== state.volume.mode) {
      state.volume.mode = opts.volume;
      p.volume = opts.volume;
      resetVolumeState();
    }
    return out;
  }

  function resetVolumeState(): void {
    const v = state.volume;
    v.primarySlot = -1;
    v.gap = false;
    v.gapSince = -1;
    for (const s of slots) {
      s.promoting = false;
      // A new volume model starts a new history: an empty disk under the old one says nothing about this.
      s.dataLost = false;
      if (s.node < 0) continue;
      if (v.mode === 'local') {
        s.role = 'local';
        s.sync = 1;
      } else {
        s.role = v.mode === 'replicated' ? 'active' : 'standby';
        if (s.sync < 1) s.sync = 1;
      }
      s.serving = false;
      s.inRotation = false;
    }
    if (v.mode === 'primary-standby') tryElect();
    for (const s of slots) maybeJoin(s);
    refreshApp();
  }

  /** Re-places instances whose node no longer satisfies the placement options (or all of them). */
  function replaceViolating(total: number, all: boolean): void {
    const geo = constraintFromOptions(state.place.regions, state.place.countries, state.place.denyRegions);
    for (const s of slots) {
      if (s.node >= 0 && !all) {
        const n = node(s.node);
        if (geolocationAllows(geo, n.region, n.cc)) continue;
      }
      if (s.node >= 0) {
        const old = s.nodeId;
        s.node = -1;
        emit({ type: 'removed', at: time, slot: s.slot, nodeId: old });
      }
      placeSlot(s.slot, total, false);
    }
  }

  function setInstances(requested: number, opts?: PlaceOptions): number {
    cancelDeploy();
    const n = Math.max(0, Math.min(Math.round(requested), rules.placement.maxInstances));
    lastRequested = n;
    const changes = applyOptions(opts);
    const changed = changes.geo || changes.again;
    const before = slots.length;
    while (slots.length > n) removeLastSlot();
    if (changed) replaceViolating(n, changes.again);
    while (slots.length < n) slots.push(emptySlot(slots.length));
    for (let i = before; i < n; i++) placeSlot(i, n, false);
    // A slot that could not be placed earlier may fit now (a node came back, options changed).
    for (let i = 0; i < before && i < n; i++) {
      if ((slots[i] as Slot).status === 'unplaced') placeSlot(i, n, false);
    }
    state.count = slots.length;
    if (before !== n || changed) emit({ type: 'instances', at: time, count: n });
    refreshApp();
    return slots.filter((s) => s.node >= 0).length;
  }

  // ---- health: kill, eject, revive ---------------------------------------------------------------

  function nodeDown(i: number, scope: 'node' | 'region'): number[] {
    state.nodeUp[i] = 0;
    const n = node(i);
    state.down.push(n.id);
    state.counters.kills++;
    killedDistinct.add(n.id);
    state.counters.distinctKills = killedDistinct.size;
    const affected: number[] = [];
    for (const s of slots) {
      if (s.node !== i) continue;
      affected.push(s.slot);
      const wasPrimary = isPrimarySlot(s.slot);
      s.serving = false;
      s.promoting = false;
      if (s.status === 'running' || s.status === 'starting') {
        s.status = 'crashed';
        s.since = time;
      }
      if (wasPrimary && !state.volume.gap) {
        // Writes are unavailable from the moment the primary dies, whatever the router believes.
        state.volume.gap = true;
        state.volume.gapSince = time;
        emit({ type: 'volume-gap', at: time, slot: s.slot });
      }
      const serial = s.serial;
      // The router notices after `fall` failed checks.
      schedule(time + ejectDelayMs(rules.health), () => {
        const cur = slots[s.slot];
        if (!cur || cur.serial !== serial || cur.node !== i || state.nodeUp[i] === 1) return;
        if (cur.inRotation) {
          cur.inRotation = false;
          cur.ejected = true;
          emit({ type: 'ejected', at: time, slot: cur.slot, nodeId: cur.nodeId });
        }
        if (isPrimarySlot(cur.slot)) {
          cur.ejected = true;
          schedule(time + rules.volume.electionGraceMs, () => tryElect());
        }
      });
      // A replacement is spawned elsewhere after a while (unless the node comes back first).
      if (rules.respawn.enabled) {
        cancel(s.respawnTimer);
        s.respawnTimer = schedule(time + rules.respawn.delayMs, () => respawn(s.slot, serial));
      }
    }
    emit({
      type: 'node-down',
      at: time,
      node: i,
      nodeId: n.id,
      label: nodeLabel(i),
      region: n.region,
      slots: affected,
      scope,
    });
    return affected;
  }

  function kill(nodeId: string): boolean {
    const i = idToIndex.get(nodeId);
    if (i === undefined || state.nodeUp[i] !== 1) return false;
    nodeDown(i, 'node');
    refreshApp();
    return true;
  }

  function killRegion(region: Region): string[] {
    const ids: string[] = [];
    let instances = 0;
    for (let i = 0; i < nodeCount; i++) {
      if (state.nodeUp[i] !== 1 || node(i).region !== region) continue;
      instances += nodeDown(i, 'region').length;
      ids.push(node(i).id);
    }
    if (ids.length > 0) emit({ type: 'region-down', at: time, region, nodes: ids.length, instances });
    refreshApp();
    return ids;
  }

  function killRandomInstanceNode(): string | null {
    const options = slots.filter((s) => s.node >= 0 && state.nodeUp[s.node] === 1);
    if (options.length === 0) return null;
    const pick = options[Math.floor(chaos() * options.length)] as Slot;
    const id = pick.nodeId;
    kill(id);
    return id;
  }

  function killPrimary(): string | null {
    const p = state.volume.primarySlot;
    const s = p >= 0 ? slots[p] : undefined;
    if (!s || s.node < 0 || state.nodeUp[s.node] !== 1) return killRandomInstanceNode();
    const id = s.nodeId;
    kill(id);
    return id;
  }

  /**
   * Instances that found no node (a whole continent was lost while the app was allowed nowhere else) try
   * again once nodes are back: every node keeps running its own spawner loop, so the missing instances are
   * picked up. A slot that still has nowhere to go stays quiet, and a deploy places its own slots.
   */
  function placeWaiting(): void {
    if (state.deploy.active) return;
    let any = false;
    for (const s of slots) {
      if (s.status !== 'unplaced' || s.node >= 0) continue;
      if (!chooseNode(s.slot, s.serial + 1, slots.length)) continue;
      placeSlot(s.slot, slots.length, s.serial > 0);
      any = true;
    }
    if (any) refreshApp();
  }

  function revive(nodeId: string): boolean {
    if (!reviveNode(nodeId)) return false;
    placeWaiting();
    return true;
  }

  function reviveNode(nodeId: string): boolean {
    const i = idToIndex.get(nodeId);
    if (i === undefined || state.nodeUp[i] === 1) return false;
    state.nodeUp[i] = 1;
    const at = state.down.indexOf(nodeId);
    if (at >= 0) state.down.splice(at, 1);
    const n = node(i);
    const affected: number[] = [];
    for (const s of slots) {
      if (s.node !== i) continue;
      affected.push(s.slot);
      if (s.status === 'crashed') {
        // The container restarts in place and, if the router had dropped it, earns its way back.
        cancel(s.respawnTimer);
        s.respawnTimer = null;
        s.status = 'starting';
        s.since = time;
        s.placedAt = time;
        s.startProgress = 0;
        s.finishAt = time + rules.health.startMs;
        if (replicatesData(state.volume.mode) && !isPrimarySlot(s.slot)) {
          // A returning replica has missed writes: it catches up before it counts again.
          s.sync = Math.min(s.sync, 0.4);
        }
        const serial = s.serial;
        schedule(s.finishAt, () => finishStart(s.slot, serial));
      }
    }
    emit({
      type: 'node-up',
      at: time,
      node: i,
      nodeId,
      label: nodeLabel(i),
      region: n.region,
      slots: affected,
    });
    refreshApp();
    return true;
  }

  function reviveAll(): void {
    // Every node first, then the instances that were waiting for one, so they choose among all of them.
    for (const id of [...state.down]) reviveNode(id);
    placeWaiting();
  }

  /** A lost instance is replaced on another node (the old one is abandoned). */
  function respawn(slot: number, serial: number): void {
    const s = slots[slot];
    if (!s || s.serial !== serial || s.status !== 'crashed') return;
    if (s.node >= 0 && state.nodeUp[s.node] === 1) return;
    const lostNode = s.nodeId;
    state.counters.respawns++;
    s.node = -1;
    emit({ type: 'removed', at: time, slot, nodeId: lostNode });
    if (state.volume.primarySlot === slot) state.volume.primarySlot = -1;
    placeSlot(slot, slots.length, true);
    refreshApp();
  }

  // ---- volumes: gap, election, promotion -------------------------------------------------------------

  function eligibleForPrimary(s: Slot): boolean {
    return s.node >= 0 && s.status === 'running' && state.nodeUp[s.node] === 1 && s.sync >= 1;
  }

  function closeGap(): void {
    const v = state.volume;
    if (!v.gap) return;
    v.gap = false;
    v.lastGapMs = time - v.gapSince;
    v.gapTotalMs += v.lastGapMs;
    v.gapSince = -1;
  }

  /**
   * Elects a primary when there is none or the current one is lost. A primary that is merely down is kept
   * until the router has dropped it AND the grace period has passed (it may come straight back).
   */
  function tryElect(): void {
    const v = state.volume;
    if (v.mode !== 'primary-standby') return;
    const current = v.primarySlot >= 0 ? slots[v.primarySlot] : undefined;
    if (current && eligibleForPrimary(current)) {
      // It is (back) up and synced: the gap, if any, ends with it.
      if (v.gap) closeGap();
      maybeJoin(current);
      return;
    }
    if (current && current.node >= 0 && !current.ejected) return; // still believed alive: wait
    const candidate = slots.find((s) => s.slot !== v.primarySlot && eligibleForPrimary(s));
    if (!candidate) return;
    const previous = v.primarySlot;
    v.primarySlot = candidate.slot;
    candidate.role = 'primary';
    for (const s of slots) if (s.node >= 0 && s.slot !== candidate.slot) s.role = 'standby';
    if (!v.gap && previous < 0) {
      // The first leader of a volume: no failover, no gap.
      maybeJoin(candidate);
      return;
    }
    v.promotions++;
    candidate.promoting = true;
    const startsAt = time + rules.volume.promoteStartMs;
    if (!v.gap) {
      v.gap = true;
      v.gapSince = time;
    }
    emit({
      type: 'promoted',
      at: time,
      slot: candidate.slot,
      nodeId: candidate.nodeId,
      previousSlot: previous,
      gapMs: startsAt - v.gapSince,
    });
    const serial = candidate.serial;
    schedule(startsAt, () => {
      const cur = slots[candidate.slot];
      if (!cur || cur.serial !== serial || v.primarySlot !== cur.slot) return;
      cur.promoting = false;
      closeGap();
      maybeJoin(cur);
    });
  }

  // ---- routing -----------------------------------------------------------------------------------

  function resolveUser(from: SimSource | undefined): { index: number; origin: number } {
    const users = bench.users;
    const rotate = (): number => (users.length > 0 ? sendSeq++ % users.length : -1);
    if (from === undefined) return { index: rotate(), origin: -1 };
    if (typeof from === 'string') {
      const i = users.findIndex((u) => u.id === from);
      return { index: i >= 0 ? i : rotate(), origin: -1 };
    }
    if ('node' in from) {
      const ni = idToIndex.get(from.node);
      return ni !== undefined ? { index: -1, origin: ni } : { index: rotate(), origin: -1 };
    }
    let best = -1;
    let bestKm = Number.POSITIVE_INFINITY;
    users.forEach((u, i) => {
      const km = greatCircleKm(from.lat, from.lon, u.lat, u.lon);
      if (km < bestKm) {
        bestKm = km;
        best = i;
      }
    });
    return { index: best, origin: -1 };
  }

  function originPoint(p: Packet): { x: number; y: number; lat: number; lon: number; known: boolean } {
    if (p.originNode >= 0) {
      const n = node(p.originNode);
      return { x: n.x, y: n.y, lat: n.lat, lon: n.lon, known: true };
    }
    const u = bench.users[p.userIndex];
    if (u) return { x: u.x, y: u.y, lat: u.lat, lon: u.lon, known: true };
    return { x: state.proxy.x, y: state.proxy.y, lat: 0, lon: 0, known: false };
  }

  /** Slots the load balancer believes are up. For a primary/standby volume only the primary is active. */
  function rotation(exclude: readonly number[] = []): Slot[] {
    const out: Slot[] = [];
    for (const s of slots) {
      if (!s.inRotation || s.node < 0 || exclude.includes(s.slot)) continue;
      if (!everyInstanceServes(state.volume.mode) && state.volume.primarySlot !== s.slot) continue;
      out.push(s);
    }
    return out;
  }

  function pickRoute(userKey: number, cands: readonly Slot[]): Slot | null {
    if (cands.length === 0) return null;
    if (rules.routing.sticky) {
      const stuck = sticky.get(userKey);
      if (stuck !== undefined) {
        const found = cands.find((s) => s.slot === stuck);
        if (found) return found;
      }
    }
    const chosen = cands[rr % cands.length] as Slot;
    rr++;
    if (rules.routing.sticky) sticky.set(userKey, chosen.slot);
    return chosen;
  }

  const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

  function send(from?: SimSource): number {
    if (packets.length >= rules.routing.maxPackets) {
      // Drop the oldest finished packet; if all are in flight, refuse.
      const done = packets.findIndex((p) => p.outcome === 'served' || p.outcome === 'failed');
      if (done < 0) return -1;
      packets.splice(done, 1);
    }
    const { index, origin } = resolveUser(from);
    const user = index >= 0 ? bench.users[index] : undefined;
    const p: PacketInternal = {
      id: ++packetSeq,
      userIndex: index,
      userId: user?.id ?? (origin >= 0 ? node(origin).id : 'node'),
      originNode: origin,
      slot: -1,
      target: -1,
      t0: time,
      tProxy: 0,
      tArrive: 0,
      redirectAt: -1,
      redirectFrom: -1,
      retargets: 0,
      outcome: 'flying',
      doneAt: -1,
      latencyMs: 0,
      tReturn: 0,
      removeAt: Number.POSITIVE_INFINITY,
      failedSlots: [],
      serial: 0,
    };
    packets.push(p);
    state.counters.sent++;
    const o = originPoint(p);
    p.tProxy = time + legDurationMs(rules.routing, dist(o.x, o.y, state.proxy.x, state.proxy.y));
    const userKey = index >= 0 ? index : 1000 + origin;
    const choice = pickRoute(userKey, rotation());
    if (!choice) {
      // Nothing is in rotation: the proxy has no server to give the request to.
      p.tArrive = p.tProxy;
      schedule(p.tProxy, () => failPacket(p, 'no-healthy-instance'));
      return p.id;
    }
    aim(p, choice, p.tProxy, state.proxy.x, state.proxy.y);
    return p.id;
  }

  /** Points a packet at a slot; it arrives `legDurationMs` after it leaves `(fromX, fromY)` at `departAt`. */
  function aim(p: PacketInternal, s: Slot, departAt: number, fromX: number, fromY: number): void {
    const n = node(s.node);
    p.slot = s.slot;
    p.target = s.node;
    p.serial = s.serial;
    p.tArrive = departAt + legDurationMs(rules.routing, dist(fromX, fromY, n.x, n.y));
    const arriveAt = p.tArrive;
    schedule(arriveAt, () => {
      if (p.tArrive === arriveAt && p.outcome === 'flying') arrive(p);
    });
  }

  function arrive(p: PacketInternal): void {
    const s = slots[p.slot];
    const ok = s !== undefined && s.serial === p.serial && s.node === p.target && canServe(s);
    if (ok && s) {
      const o = originPoint(p);
      const n = node(p.target);
      const km = o.known && !(o.lat === 0 && o.lon === 0) ? greatCircleKm(o.lat, o.lon, n.lat, n.lon) : 0;
      p.outcome = 'served';
      p.doneAt = time;
      p.latencyMs = Math.round(
        modelledLatencyMs(rules.routing, km, p.retargets * rules.routing.redispatchAfterMs),
      );
      p.tReturn = time + legDurationMs(rules.routing, dist(n.x, n.y, o.x, o.y)) * 0.8;
      p.removeAt = p.tReturn + rules.routing.lingerMs;
      s.served++;
      state.counters.served++;
      if (p.retargets > 0) state.counters.rerouted++;
      emit({
        type: 'served',
        at: time,
        packet: p.id,
        userId: p.userId,
        slot: p.slot,
        nodeId: n.id,
        latencyMs: p.latencyMs,
        rerouted: p.retargets > 0,
      });
      return;
    }
    // The node does not answer: the request hangs, then the proxy redispatches it.
    p.outcome = 'stalled';
    p.failedSlots.push(p.slot);
    schedule(time + rules.routing.redispatchAfterMs, () => redispatch(p));
  }

  function redispatch(p: PacketInternal): void {
    if (p.outcome !== 'stalled') return;
    if (p.retargets >= rules.routing.retries) {
      failPacket(p, 'retries-exhausted');
      return;
    }
    const userKey = p.userIndex >= 0 ? p.userIndex : 1000 + p.originNode;
    if (rules.routing.sticky) sticky.delete(userKey);
    const choice = pickRoute(userKey, rotation(p.failedSlots));
    if (!choice) {
      failPacket(p, 'no-healthy-instance');
      return;
    }
    const fromNode = p.target;
    const from = node(fromNode);
    p.redirectAt = time;
    p.redirectFrom = fromNode;
    p.retargets++;
    p.outcome = 'flying';
    aim(p, choice, time, from.x, from.y);
    emit({
      type: 'rerouted',
      at: time,
      packet: p.id,
      userId: p.userId,
      from: p.failedSlots[p.failedSlots.length - 1] ?? -1,
      to: choice.slot,
      fromNodeId: from.id,
      toNodeId: choice.nodeId,
      retries: p.retargets,
    });
  }

  function failPacket(p: PacketInternal, reason: 'no-healthy-instance' | 'retries-exhausted'): void {
    if (p.outcome === 'served' || p.outcome === 'failed') return;
    p.outcome = 'failed';
    p.doneAt = time;
    p.removeAt = time + rules.routing.lingerMs;
    state.counters.failed++;
    emit({ type: 'failed', at: time, packet: p.id, userId: p.userId, reason });
  }

  // ---- app status ----------------------------------------------------------------------------------

  function refreshApp(): void {
    const a = state.app;
    let healthy = 0;
    let inRot = 0;
    let serving = 0;
    for (const s of slots) {
      if (s.node >= 0 && s.status === 'running' && state.nodeUp[s.node] === 1) healthy++;
      if (s.inRotation) inRot++;
      if (canServe(s)) serving++;
    }
    a.total = slots.length;
    a.healthy = healthy;
    a.inRotation = inRot;
    let status: AppStatus = 'idle';
    if (slots.length > 0) {
      if (serving > 0) status = healthy < slots.length ? 'degraded' : 'up';
      else if (slots.some((s) => s.status === 'starting')) status = 'starting';
      else status = state.deploy.active ? 'idle' : 'down';
    }
    a.status = status;
    const key = `${status}:${healthy}:${slots.length}`;
    if (key !== appStatusKey) {
      appStatusKey = key;
      emit({ type: 'app-status', at: time, status, healthy, total: slots.length });
    }
  }

  // ---- deploy ----------------------------------------------------------------------------------------

  let deployTimers: Timer[] = [];

  function cancelDeploy(): void {
    for (const t of deployTimers) cancel(t);
    deployTimers = [];
    state.deploy.active = false;
  }

  function startDeploy(opts?: { instances?: number }): void {
    cancelDeploy();
    while (slots.length > 0) removeLastSlot();
    const target = Math.max(
      0,
      Math.min(opts?.instances ?? (lastRequested > 0 ? lastRequested : 3), rules.placement.maxInstances),
    );
    const d = state.deploy;
    d.active = true;
    d.target = target;
    d.startedAt = time;
    d.candidates = [];
    d.progress = 0;
    d.phaseProgress = 0;
    d.index = 0;
    const phases = rules.deploy.phases;
    d.phase = phases[0]?.id ?? 'spec';
    state.count = 0;
    let at = time;
    const starts: number[] = [];
    for (const ph of phases) {
      starts.push(at);
      at += ph.ms;
    }
    const end = at;
    const liveStart = end - (phases[phases.length - 1]?.ms ?? 0);
    phases.forEach((ph, i) => {
      const t0 = starts[i] as number;
      deployTimers.push(
        schedule(t0, () => {
          d.phase = ph.id as DeployPhase;
          d.index = i;
          emit({
            type: 'deploy-phase',
            at: time,
            phase: ph.id as DeployPhase,
            index: i,
            count: phases.length,
          });
          if (ph.id === 'select') beginSelection(t0, ph.ms, liveStart, target);
        }),
      );
    });
    deployTimers.push(
      schedule(end, () => {
        d.active = false;
        d.progress = 1;
        d.phaseProgress = 1;
        refreshApp();
        emit({ type: 'deploy-done', at: time });
      }),
    );
    lastRequested = target;
    refreshApp();
  }

  function beginSelection(selectStart: number, selectMs: number, liveStart: number, target: number): void {
    const d = state.deploy;
    while (slots.length < target) slots.push(emptySlot(slots.length));
    state.count = target;
    // Nodes "considering" the app: a deterministic sample of up nodes (a flicker; the winners are placed).
    const rng = mulberry32(hashInts(seed, 0xde91, target));
    const pool: number[] = [];
    for (let i = 0; i < nodeCount; i++) if (state.nodeUp[i] === 1) pool.push(i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = pool[i] as number;
      pool[i] = pool[j] as number;
      pool[j] = t;
    }
    d.candidates = pool.slice(0, rules.deploy.candidates);
    for (let k = 0; k < target; k++) {
      const when = selectStart + ((k + 1) / (target + 1)) * selectMs;
      deployTimers.push(
        schedule(when, () => {
          if (!slots[k]) return;
          placeSlot(k, target, false, liveStart);
          refreshApp();
        }),
      );
    }
  }

  // ---- stepping --------------------------------------------------------------------------------------

  function advance(step: number): void {
    time += step;
    state.time = time;
    const fired = runDue();

    // Start progress and replica sync.
    let progressed = false;
    for (const s of slots) {
      if (s.status === 'starting') {
        const span = Math.max(1, s.finishAt - s.placedAt);
        s.startProgress = Math.min(1, (time - s.placedAt) / span);
      }
      if (s.status === 'running' && s.sync < 1 && s.node >= 0 && state.nodeUp[s.node] === 1) {
        s.sync = Math.min(1, s.sync + step / rules.volume.syncMs);
        if (s.sync >= 1) {
          progressed = true;
          emit({ type: 'synced', at: time, slot: s.slot, nodeId: s.nodeId });
          afterReady(s);
        }
      }
    }
    if (fired > 0 || progressed) refreshApp();

    const d = state.deploy;
    if (d.active && d.index >= 0) {
      const phases = rules.deploy.phases;
      let start = d.startedAt;
      for (let i = 0; i < d.index; i++) start += phases[i]?.ms ?? 0;
      const len = phases[d.index]?.ms ?? 1;
      d.phaseProgress = Math.min(1, Math.max(0, (time - start) / len));
      d.progress = Math.min(1, (time - d.startedAt) / deployTotalMs(rules.deploy));
    }

    // Packets: drop the ones whose echo is over.
    for (let i = packets.length - 1; i >= 0; i--) {
      if ((packets[i] as PacketInternal).removeAt <= time) packets.splice(i, 1);
    }

    // The uptime meter.
    if (slots.length > 0) {
      const a = state.app;
      if (a.status === 'up' || a.status === 'degraded') a.upMs += step;
      else if (a.status === 'down') a.downMs += step;
      const seen = a.upMs + a.downMs;
      a.availability = seen > 0 ? a.upMs / seen : 1;
    }
  }

  function tick(dtMs: number): void {
    if (!(dtMs > 0)) return;
    // The renderer clamps its own frame time; the simulation does exactly what it is told, up to 10 minutes.
    acc += Math.min(dtMs, 600_000);
    const step = rules.stepMs;
    while (acc >= step) {
      acc -= step;
      advance(step);
    }
  }

  function pending(): boolean {
    if (timers.some((t) => !t.cancelled)) return true;
    if (
      slots.some((s) => s.status === 'running' && s.sync < 1 && s.node >= 0 && state.nodeUp[s.node] === 1)
    ) {
      return true;
    }
    return packets.some((p) => p.outcome === 'flying' || p.outcome === 'stalled');
  }

  function settle(maxMs = 120_000): void {
    let spent = 0;
    const step = rules.stepMs;
    while (pending() && spent < maxMs) {
      advance(step);
      spent += step;
    }
    packets.length = 0;
    refreshApp();
  }

  function reset(newSeed?: number): void {
    cancelDeploy();
    timers.length = 0;
    for (const s of slots) cancel(s.respawnTimer);
    slots.length = 0;
    packets.length = 0;
    state.nodeUp.fill(1);
    state.down.length = 0;
    killedDistinct.clear();
    sticky.clear();
    if (newSeed !== undefined) seed = newSeed >>> 0;
    chaos = mulberry32(hashInts(seed, 0xc4a05));
    time = 0;
    acc = 0;
    rr = 0;
    sendSeq = 0;
    packetSeq = 0;
    lastRequested = 0;
    state.time = 0;
    state.count = 0;
    state.counters = emptyCounters();
    const v = state.volume;
    v.primarySlot = -1;
    v.gap = false;
    v.gapSince = -1;
    v.gapTotalMs = 0;
    v.lastGapMs = 0;
    v.promotions = 0;
    const d = state.deploy;
    d.active = false;
    d.phase = null;
    d.index = -1;
    d.phaseProgress = 0;
    d.progress = 0;
    d.candidates = [];
    state.app = { status: 'idle', total: 0, healthy: 0, inRotation: 0, availability: 1, upMs: 0, downMs: 0 };
    appStatusKey = '';
    emit({ type: 'reset', at: 0 });
  }

  // ---- public API ------------------------------------------------------------------------------------

  if (options.place) applyOptions(options.place);

  function on(type: SimEventType | '*', fn: (e: never) => void): () => void {
    let set = listeners.get(type);
    if (!set) {
      set = new Set();
      listeners.set(type, set);
    }
    const handler = fn as unknown as (e: SimEvent) => void;
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  return {
    bench,
    setInstances,
    configure(opts) {
      const changes = applyOptions(opts);
      if (changes.geo || changes.again) {
        replaceViolating(slots.length, changes.again);
        for (const s of slots) if (s.status === 'unplaced') placeSlot(s.slot, slots.length, false);
      }
      refreshApp();
    },
    kill,
    killRandomInstanceNode,
    killPrimary,
    killRegion,
    revive,
    reviveAll,
    send,
    startDeploy,
    tick,
    settle,
    busy: pending,
    state: () => state,
    on: on as Sim['on'],
    nodeIndex: (id) => idToIndex.get(id) ?? -1,
    reset,
  };
}
