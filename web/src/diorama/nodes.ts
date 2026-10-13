/**
 * The nodes that matter, as a short list a keyboard or screen reader user can walk: the app itself, its
 * instances, anything that is offline, and up to a dozen notable others (the tallest pillar of each
 * region first, then the biggest). The canvas is `aria-hidden`; this list is its parallel.
 */
import type { Bench, BenchNode, Region } from './model/types';
import { REGION_NAMES, REGIONS } from './model/types';
import { hasEmptyDisk } from './sim/rules';
import type { SimState } from './sim/types';

export type NodeItemKind = 'specimen' | 'instance' | 'down' | 'notable';

export interface NodeItem {
  /** Stable across rebuilds while the thing is the same. */
  key: string;
  kind: NodeItemKind;
  /** Node index into `bench.nodes`, -1 for the specimen. */
  node: number;
  /** Instance slot, -1 when not an instance. */
  slot: number;
  /** The accessible name, a full sentence fragment. */
  label: string;
  /** What Enter does, when the scene allows it. */
  action: 'kill' | 'revive' | null;
}

export interface NodeListOptions {
  /** The scene lets the visitor take nodes offline and bring them back. */
  interactive: boolean;
  /** How many notable non-instance nodes to add. Default 12. */
  notable?: number;
  /** Whether the scene shows the app (the specimen). */
  specimen: boolean;
  /**
   * Say which instances restarted with an empty disk. Pass true exactly when the figure draws the same
   * fact (the `lost-data` annotation), so the list never knows more than the picture shows.
   */
  emptyDisk?: boolean;
}

function describeNode(n: BenchNode): string {
  const place = n.label || n.id;
  return n.count > 1 ? `${place}, ${n.tier}` : `${place}, ${n.tier} node`;
}

/** The tallest pillar of each region, then the tallest overall, `limit` in all, stable order. */
export function notableNodes(bench: Bench, limit: number, exclude: ReadonlySet<number>): number[] {
  const picked: number[] = [];
  const taken = new Set<number>(exclude);
  const better = (a: BenchNode, b: BenchNode): boolean =>
    a.height > b.height || (a.height === b.height && a.count > b.count);
  for (const region of REGIONS) {
    let best: BenchNode | null = null;
    for (const n of bench.nodes) {
      if (n.region !== region || taken.has(n.index)) continue;
      if (!best || better(n, best)) best = n;
    }
    if (best && picked.length < limit) {
      picked.push(best.index);
      taken.add(best.index);
    }
  }
  if (picked.length < limit) {
    const rest = bench.nodes
      .filter((n) => !taken.has(n.index))
      .sort((a, b) => b.height - a.height || b.count - a.count || a.index - b.index);
    for (const n of rest) {
      if (picked.length >= limit) break;
      picked.push(n.index);
    }
  }
  return picked;
}

export function buildNodeItems(bench: Bench, state: Readonly<SimState>, opts: NodeListOptions): NodeItem[] {
  const items: NodeItem[] = [];
  const used = new Set<number>();
  if (opts.specimen) {
    const n = state.count;
    items.push({
      key: 'specimen',
      kind: 'specimen',
      node: -1,
      slot: -1,
      label: `Your app, ${n} ${n === 1 ? 'instance' : 'instances'}, ${state.app.status}`,
      action: null,
    });
  }
  for (const s of state.instances) {
    if (s.node < 0 || s.status === 'unplaced') continue;
    const n = bench.nodes[s.node];
    if (!n) continue;
    used.add(s.node);
    const up = state.nodeUp[s.node] === 1;
    const role = s.role === 'primary' ? ', primary' : s.role === 'standby' ? ', standby' : '';
    const status = up ? s.status : 'offline';
    const empty = opts.emptyDisk && hasEmptyDisk(s) ? ', restarted with an empty disk' : '';
    items.push({
      key: `inst:${s.slot}:${s.node}`,
      kind: 'instance',
      node: s.node,
      slot: s.slot,
      label: `Instance ${s.slot + 1}, ${describeNode(n)}${role}, ${status}${empty}`,
      action: opts.interactive ? (up ? 'kill' : 'revive') : null,
    });
  }
  for (let i = 0; i < state.nodeUp.length; i++) {
    if (state.nodeUp[i] === 1 || used.has(i)) continue;
    const n = bench.nodes[i];
    if (!n) continue;
    used.add(i);
    items.push({
      key: `down:${i}`,
      kind: 'down',
      node: i,
      slot: -1,
      label: `${describeNode(n)}, offline`,
      action: opts.interactive ? 'revive' : null,
    });
  }
  const limit = opts.notable ?? 12;
  for (const i of notableNodes(bench, limit, used)) {
    const n = bench.nodes[i];
    if (!n) continue;
    items.push({
      key: `node:${i}`,
      kind: 'notable',
      node: i,
      slot: -1,
      label: describeNode(n),
      action: null,
    });
  }
  return items;
}

/** The accessible name of a continent filter and similar bits, kept here so tests can pin the wording. */
export function regionLabel(region: Region): string {
  return REGION_NAMES[region];
}
