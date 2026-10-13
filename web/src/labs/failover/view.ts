/**
 * What the Failover Lab's panels read from the simulation: the instances as rows (where, on what, in what
 * state), the offline nodes, and a few counts. A pure function of the sim state and the bench, so the
 * words the lab uses for each state live in one place and are tested without a browser.
 *
 * The states are the ones FACTS 6.3 and 6.4 support: a node can be dark while the load balancer still
 * sends it traffic (it needs two failed checks, about 6 s), and a node that comes back needs two good
 * checks before it is trusted again.
 */
import type { Bench, Region, Tier } from '@/diorama/model';
import { REGIONS } from '@/diorama/model';
import type { AppStatus, SimState } from '@/diorama/sim';

export type RowTone = 'ok' | 'pending' | 'warn' | 'crit' | 'off';

export interface InstanceView {
  slot: number;
  nodeId: string;
  /** Synthetic address of the node, or '' when unplaced. */
  ip: string;
  /** "Frankfurt, Germany" in the sample world. */
  place: string;
  region: Region | null;
  tier: Tier | null;
  /** The node is up. */
  up: boolean;
  placed: boolean;
  word: string;
  hint: string;
  tone: RowTone;
  serving: boolean;
  served: number;
}

export interface OfflineView {
  nodeId: string;
  ip: string;
  place: string;
  region: Region;
  /** One of your instances is (was) on it. */
  holdsInstance: boolean;
}

export interface View {
  status: AppStatus;
  total: number;
  healthy: number;
  inRotation: number;
  instances: InstanceView[];
  offline: OfflineView[];
  /** Distinct continents that hold a placed instance, in display order. */
  continents: Region[];
}

export const EMPTY_VIEW: View = {
  status: 'idle',
  total: 0,
  healthy: 0,
  inRotation: 0,
  instances: [],
  offline: [],
  continents: [],
};

/** The word, the tone and a one-line hint for an instance, from what the router knows and the truth. */
export function describeInstance(s: { placed: boolean; up: boolean; status: string; inRotation: boolean }): {
  word: string;
  tone: RowTone;
  hint: string;
} {
  if (!s.placed) {
    return { word: 'Not placed', tone: 'off', hint: 'No free node matches the allowed regions.' };
  }
  if (!s.up) {
    return s.inRotation
      ? {
          word: 'Dark',
          tone: 'crit',
          hint: 'The node is gone but the load balancer has not noticed yet. Requests sent here are retried.',
        }
      : {
          word: 'Dropped',
          tone: 'crit',
          hint: 'The load balancer stopped sending traffic after two failed checks.',
        };
  }
  if (s.status === 'starting') {
    return { word: 'Starting', tone: 'pending', hint: 'A replacement is installing and starting.' };
  }
  if (!s.inRotation) {
    return {
      word: 'Waiting',
      tone: 'warn',
      hint: 'Running, but the load balancer needs two good checks before it sends traffic.',
    };
  }
  return { word: 'Serving', tone: 'ok', hint: 'In rotation and answering requests.' };
}

export function buildView(state: Readonly<SimState>, bench: Bench): View {
  const instances: InstanceView[] = state.instances.map((s) => {
    const node = s.node >= 0 ? bench.nodes[s.node] : undefined;
    const placed = s.status !== 'unplaced' && node !== undefined;
    const up = placed && state.nodeUp[s.node] === 1;
    const d = describeInstance({ placed, up, status: s.status, inRotation: s.inRotation });
    return {
      slot: s.slot,
      nodeId: node?.id ?? '',
      ip: node?.ip ?? '',
      place: node?.label ?? '',
      region: node?.region ?? null,
      tier: node?.tier ?? null,
      up,
      placed,
      word: d.word,
      hint: d.hint,
      tone: d.tone,
      serving: s.serving,
      served: s.served,
    };
  });

  const holding = new Set(instances.filter((i) => i.placed).map((i) => i.nodeId));
  const offline: OfflineView[] = [];
  for (const id of state.down) {
    const node = bench.nodes.find((n) => n.id === id);
    if (!node) continue;
    offline.push({
      nodeId: node.id,
      ip: node.ip,
      place: node.label,
      region: node.region,
      holdsInstance: holding.has(node.id),
    });
  }

  const seen = new Set<Region>();
  for (const i of instances) if (i.placed && i.region) seen.add(i.region);

  return {
    status: state.app.status,
    total: state.app.total,
    healthy: state.app.healthy,
    inRotation: state.app.inRotation,
    instances,
    offline,
    continents: REGIONS.filter((r) => seen.has(r)),
  };
}

/** Changes only when something a panel shows changes (never with the clock), so a poll can skip renders. */
export function viewSignature(v: View): string {
  const rows = v.instances.map((i) => `${i.slot}:${i.nodeId}:${i.word}:${i.served}`).join('|');
  const off = v.offline.map((o) => `${o.nodeId}${o.holdsInstance ? '*' : ''}`).join(',');
  return `${v.status}/${v.total}/${v.healthy}/${v.inRotation}#${rows}#${off}`;
}

/** The continent holding most of the placed instances (ties: display order), or null with none placed. */
export function busiestRegion(v: View): Region | null {
  const count = new Map<Region, number>();
  for (const i of v.instances) if (i.placed && i.region) count.set(i.region, (count.get(i.region) ?? 0) + 1);
  let best: Region | null = null;
  let bestN = 0;
  for (const r of REGIONS) {
    const n = count.get(r) ?? 0;
    if (n > bestN) {
      best = r;
      bestN = n;
    }
  }
  return best;
}

/** How many of your placed instances stand on a continent. */
export function instancesIn(v: View, region: Region): number {
  return v.instances.filter((i) => i.placed && i.region === region).length;
}

/** The one-line summary of a draw: "2 in Europe, 1 in North America". */
export function summarizeDraw(v: View, names: Readonly<Record<Region, string>>): string {
  const parts: string[] = [];
  for (const r of REGIONS) {
    const n = instancesIn(v, r);
    if (n > 0) parts.push(`${n} in ${names[r]}`);
  }
  const unplaced = v.instances.filter((i) => !i.placed).length;
  if (unplaced > 0) parts.push(`${unplaced} not placed`);
  return parts.length > 0 ? parts.join(', ') : 'No instances';
}
