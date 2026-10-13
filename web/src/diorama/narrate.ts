/**
 * Turns the simulation's events into the sentences a screen reader hears. Events arrive in bursts (a
 * node going offline, its instance being ejected, three requests rerouted), so the narrator collects
 * them for a moment and speaks one calm paragraph: "Node in Frankfurt, Germany went offline. 2 requests
 * rerouted." Steady traffic is never announced; only requests the visitor sent themselves are.
 *
 * Pure and framework free, so it is unit tested on its own.
 */
import type { SimEvent } from './sim/types';

export interface NarratorOptions {
  /** Human label of a node id ("Frankfurt, Germany"). */
  labelOf(nodeId: string): string;
  /** Display name of a continent code. */
  regionName(region: string): string;
  /**
   * Whether to say that a replacement came back with an empty disk. The figure asks this of the same
   * switch that draws the `lost-data` tag, so what is heard matches what is seen. Default: yes.
   */
  emptyDisk?(): boolean;
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join('; ')}; and ${items[items.length - 1]}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export class Narrator {
  private placed: string[] = [];
  private replaced: string[] = [];
  private emptied: Array<{ slot: number; label: string }> = [];
  private down: string[] = [];
  private up: string[] = [];
  private regions: string[] = [];
  private regionNodes = new Set<string>();
  private rerouted = 0;
  private failed = 0;
  private served: string[] = [];
  private promoted: string[] = [];
  private gap = false;
  private unplaced = 0;
  private deploy: string[] = [];
  private status: string | null = null;
  private readonly mine = new Set<number>();

  constructor(private readonly o: NarratorOptions) {}

  /** Marks a packet as one the visitor sent, so its answer is announced. */
  expect(packetId: number): void {
    if (packetId >= 0) this.mine.add(packetId);
  }

  get pending(): boolean {
    return (
      this.placed.length +
        this.replaced.length +
        this.emptied.length +
        this.down.length +
        this.up.length +
        this.regions.length +
        this.served.length +
        this.promoted.length +
        this.deploy.length >
        0 ||
      this.rerouted > 0 ||
      this.failed > 0 ||
      this.gap ||
      this.unplaced > 0 ||
      this.status !== null
    );
  }

  push(e: SimEvent): void {
    switch (e.type) {
      case 'placed':
        if (e.respawn && e.dataLost && (this.o.emptyDisk?.() ?? true)) {
          this.emptied.push({ slot: e.slot, label: e.label });
        } else (e.respawn ? this.replaced : this.placed).push(e.label);
        break;
      case 'unplaced':
        this.unplaced++;
        break;
      case 'node-down':
        if (e.scope === 'region') this.regionNodes.add(e.nodeId);
        else this.down.push(e.label);
        break;
      case 'node-up':
        if (!this.regionNodes.has(e.nodeId)) this.up.push(e.label);
        break;
      case 'region-down':
        this.regions.push(`${this.o.regionName(e.region)} went offline: ${plural(e.nodes, 'node', 'nodes')}`);
        break;
      case 'rerouted':
        this.rerouted++;
        break;
      case 'served':
        if (this.mine.delete(e.packet)) {
          this.served.push(`${this.o.labelOf(e.nodeId)}, ${e.latencyMs} ms`);
        }
        break;
      case 'failed':
        this.failed++;
        this.mine.delete(e.packet);
        break;
      case 'promoted':
        this.promoted.push(this.o.labelOf(e.nodeId));
        break;
      case 'volume-gap':
        this.gap = true;
        break;
      case 'app-status':
        if (e.status === 'down') this.status = 'The app is down: no instance can answer.';
        else if (e.status === 'degraded') {
          this.status = `The app is degraded: ${e.healthy} of ${e.total} instances healthy.`;
        } else if (e.status === 'up' && e.total > 0) {
          this.status = `The app is up with ${plural(e.total, 'instance', 'instances')}.`;
        }
        break;
      case 'deploy-phase':
        this.deploy.push(e.phase);
        break;
      case 'reset':
        this.clear();
        break;
      default:
        break;
    }
  }

  /** The paragraph for everything collected since the last call, or '' when there is nothing to say. */
  flush(): string {
    const out: string[] = [];
    if (this.deploy.length > 0) {
      const last = this.deploy[this.deploy.length - 1] as string;
      out.push(`Deploy step: ${last}.`);
    }
    if (this.placed.length === 1) out.push(`Instance placed in ${this.placed[0]}.`);
    else if (this.placed.length > 1 && this.placed.length <= 3) {
      out.push(`${this.placed.length} instances placed: ${list(this.placed)}.`);
    } else if (this.placed.length > 3) out.push(`${this.placed.length} instances placed.`);
    if (this.unplaced > 0) {
      out.push(`${plural(this.unplaced, 'instance', 'instances')} could not find an eligible node.`);
    }
    for (const r of this.regions) out.push(`${r}.`);
    if (this.down.length === 1) out.push(`Node in ${this.down[0]} went offline.`);
    else if (this.down.length > 1) out.push(`${this.down.length} nodes went offline.`);
    if (this.up.length === 1) out.push(`Node in ${this.up[0]} is back online.`);
    else if (this.up.length > 1) out.push(`${this.up.length} nodes are back online.`);
    if (this.replaced.length === 1) out.push(`A replacement instance started in ${this.replaced[0]}.`);
    else if (this.replaced.length > 1) out.push(`${this.replaced.length} replacement instances started.`);
    const empty = this.emptied;
    if (empty.length === 1) {
      const e = empty[0] as { slot: number; label: string };
      out.push(`Instance ${e.slot + 1} restarted in ${e.label} with an empty disk.`);
    } else if (empty.length > 1) out.push(`${empty.length} instances restarted with an empty disk.`);
    if (this.rerouted > 0) out.push(`${plural(this.rerouted, 'request', 'requests')} rerouted.`);
    if (this.served.length === 1) out.push(`Request answered by ${this.served[0]}.`);
    else if (this.served.length > 1) out.push(`${this.served.length} requests answered.`);
    if (this.failed > 0) out.push(`${plural(this.failed, 'request', 'requests')} failed.`);
    if (this.gap) {
      out.push(
        'No primary: the app is down until a standby is promoted. That takes minutes on the network and is compressed for the screen.',
      );
    }
    for (const p of this.promoted) out.push(`${p} promoted to primary.`);
    if (this.status) out.push(this.status);
    this.clearCollected();
    return out.slice(0, 4).join(' ');
  }

  private clearCollected(): void {
    this.placed = [];
    this.replaced = [];
    this.emptied = [];
    this.down = [];
    this.up = [];
    this.regions = [];
    this.regionNodes.clear();
    this.rerouted = 0;
    this.failed = 0;
    this.served = [];
    this.promoted = [];
    this.gap = false;
    this.unplaced = 0;
    this.deploy = [];
    this.status = null;
  }

  clear(): void {
    this.clearCollected();
    this.mine.clear();
  }
}
