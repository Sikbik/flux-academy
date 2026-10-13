/**
 * The Failover Lab's event log: simulation events turned into short sentences a learner can read as
 * they happen ("Node 203.0.113.17 went dark. 3 requests rerouted, slowest 1,412 ms").
 *
 * Rules
 * - Only sample nodes appear, and only by their synthetic address from the documentation ranges
 *   (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, RFC 5737) or the shared range 100.64/10. Anything
 *   else is masked, so a real address can never reach the screen by accident.
 * - Times in the sentences are simulated time. Where the simulation compresses something Flux does
 *   slowly (replacing a lost instance, retrying a request), the sentence says so.
 * - A burst of the same kind of event is one line with a counter, so a stream of 20 requests a second
 *   cannot bury the line that matters.
 */
import type { Bench } from '@/diorama/model';
import type { SimEvent } from '@/diorama/sim';
import {
  EJECT_CHECKS_WORD,
  FDM_TIMING,
  REPLACEMENT_SENTENCE,
  RESTORE_CHECKS_WORD,
  RESTORE_SEC,
} from './words';

export type LogTone = 'info' | 'ok' | 'warn' | 'crit';

export interface LogLine {
  id: number;
  /** Simulated time of the first event of this line, ms. */
  at: number;
  /** Simulated time of the latest event folded into it, ms. */
  last: number;
  tone: LogTone;
  /** Lines with the same key within the coalescing window are folded together. */
  key: string;
  text: string;
  /** How many events this line stands for. */
  count: number;
}

const DOC_RANGE = /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/;
const SHARED_RANGE = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/;

/** The address to show for a sample node: itself when it is provably synthetic, else masked. */
export function safeIp(ip: string): string {
  if (DOC_RANGE.test(ip) || SHARED_RANGE.test(ip)) return ip;
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.x.x.x`;
  return 'a sample node';
}

/** mm:ss of simulated time. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function seconds(ms: number): string {
  const s = ms / 1000;
  return s >= 10 ? `${Math.round(s)} s` : `${(Math.round(s * 10) / 10).toString()} s`;
}

const REASON: Record<string, string> = {
  'no-healthy-instance': 'no instance was in rotation',
  'retries-exhausted': 'the load balancer ran out of retries',
};

export interface Entry {
  key: string;
  tone: LogTone;
  text: string;
  /** Replaces the text of an existing line with the same key instead of adding a new one. */
  fold?: (previous: LogLine, count: number) => string;
}

/**
 * Tracks the little state the sentences need: when each node went dark (for "dropped after 6 s") and when
 * each instance was lost (for "replaced after 20 s").
 */
export class Narrator {
  private darkAt = new Map<string, number>();
  private lostAt = new Map<number, number>();
  private slowest = new Map<string, number>();
  /** Slots the load balancer dropped, so a join afterwards reads as coming back. */
  private dropped = new Set<number>();
  /** The app has been up once: before that the start-up statuses are noise, not news. */
  private warm = false;

  constructor(private readonly bench: Bench) {}

  reset(): void {
    this.darkAt.clear();
    this.lostAt.clear();
    this.slowest.clear();
    this.dropped.clear();
    this.warm = false;
  }

  private ip(nodeId: string): string {
    const n = this.bench.nodes.find((x) => x.id === nodeId);
    return n ? safeIp(n.ip) : 'a sample node';
  }

  private place(nodeId: string): string {
    const n = this.bench.nodes.find((x) => x.id === nodeId);
    return n?.label ? `${safeIp(n.ip)} (${n.label})` : this.ip(nodeId);
  }

  /** The sentence for one event, or null when the event is not worth a line. */
  describe(e: SimEvent): Entry | null {
    switch (e.type) {
      case 'placed': {
        if (e.respawn) {
          const lost = this.lostAt.get(e.slot);
          this.lostAt.delete(e.slot);
          const took =
            lost === undefined
              ? ''
              : ` It took ${seconds(e.at - lost)} here (compressed for the screen). ${REPLACEMENT_SENTENCE}`;
          return {
            key: `placed:${e.slot}`,
            tone: 'info',
            text: `Instance ${e.slot + 1} was replaced on ${this.place(e.nodeId)}.${took}${e.dataLost ? ' Its local data did not come with it.' : ''}`,
          };
        }
        return {
          key: `placed:${e.slot}`,
          tone: 'info',
          text: `Instance ${e.slot + 1} placed on ${this.place(e.nodeId)}, a ${e.tier} node.`,
        };
      }
      case 'unplaced':
        return {
          key: `unplaced:${e.slot}`,
          tone: 'warn',
          text: `No free node matches the allowed regions for instance ${e.slot + 1}.`,
        };
      case 'instances':
        return {
          key: 'instances',
          tone: 'info',
          text: `Instances set to ${e.count}.`,
          // A slider drag is a burst of these: keep the last.
          fold: () => `Instances set to ${e.count}.`,
        };
      case 'node-down': {
        this.darkAt.set(e.nodeId, e.at);
        for (const s of e.slots) this.lostAt.set(s, e.at);
        if (e.scope === 'region') return null; // the region line below carries it
        const there =
          e.slots.length > 0
            ? ` Instance${e.slots.length > 1 ? 's' : ''} ${e.slots.map((s) => s + 1).join(', ')} ${e.slots.length > 1 ? 'were' : 'was'} running there.`
            : ' None of your instances were there.';
        return {
          key: `down:${e.nodeId}`,
          tone: e.slots.length > 0 ? 'crit' : 'info',
          text: `Node ${this.place(e.nodeId)} went dark.${there}`,
        };
      }
      case 'region-down':
        return {
          key: `region:${e.region}`,
          tone: e.instances > 0 ? 'crit' : 'info',
          text: `The whole of ${REGION_WORD[e.region]} went dark: ${e.nodes} nodes, ${e.instances} of your instance${e.instances === 1 ? '' : 's'}.`,
        };
      case 'ejected': {
        this.dropped.add(e.slot);
        const dark = this.darkAt.get(e.nodeId);
        const after = dark === undefined ? '' : ` after ${seconds(e.at - dark)}`;
        return {
          key: `ejected:${e.slot}`,
          tone: 'warn',
          text: `The load balancer dropped instance ${e.slot + 1} (${this.ip(e.nodeId)})${after}: ${EJECT_CHECKS_WORD} failed health checks, ${FDM_TIMING.healthIntervalSec} s apart.`,
        };
      }
      case 'rerouted':
        return null; // the served line below reports the outcome with its delay
      case 'served': {
        if (!e.rerouted) return null;
        const prev = this.slowest.get(e.nodeId) ?? 0;
        this.slowest.set(e.nodeId, Math.max(prev, e.latencyMs));
        return {
          key: `rerouted:${e.nodeId}`,
          tone: 'ok',
          text: `1 request rerouted to ${this.ip(e.nodeId)}, ${e.latencyMs.toLocaleString('en-US')} ms in this model.`,
          fold: (_p, count) =>
            `${count} requests rerouted to ${this.ip(e.nodeId)}, slowest ${(this.slowest.get(e.nodeId) ?? 0).toLocaleString('en-US')} ms in this model.`,
        };
      }
      case 'failed':
        return {
          key: `failed:${e.reason}`,
          tone: 'crit',
          text: `1 request failed: ${REASON[e.reason] ?? e.reason}.`,
          fold: (_p, count) => `${count} requests failed: ${REASON[e.reason] ?? e.reason}.`,
        };
      case 'node-up': {
        this.darkAt.delete(e.nodeId);
        const back =
          e.slots.length > 0
            ? ` Instance${e.slots.length > 1 ? 's' : ''} ${e.slots.map((s) => s + 1).join(', ')} restart${e.slots.length > 1 ? '' : 's'}; the load balancer needs ${RESTORE_CHECKS_WORD} good checks (about ${RESTORE_SEC} s) before it sends traffic again.`
            : '';
        return { key: `up:${e.nodeId}`, tone: 'ok', text: `Node ${this.place(e.nodeId)} is back.${back}` };
      }
      case 'joined': {
        const back = this.dropped.delete(e.slot);
        return {
          key: `joined:${e.slot}`,
          tone: 'ok',
          text: back
            ? `Instance ${e.slot + 1} (${this.ip(e.nodeId)}) is back in rotation.`
            : `Instance ${e.slot + 1} (${this.ip(e.nodeId)}) passed two health checks and is taking traffic.`,
        };
      }
      case 'app-status':
        if (e.status === 'up' && e.total > 0) {
          const first = !this.warm;
          this.warm = true;
          if (first) return null; // the start-up lines above already said it
        }
        if (!this.warm) return null;
        if (e.status === 'down') {
          return { key: 'status', tone: 'crit', text: 'The app is down: no instance can answer.' };
        }
        if (e.status === 'degraded') {
          return {
            key: 'status',
            tone: 'warn',
            text: `The app is degraded: ${e.healthy} of ${e.total} instances can answer.`,
          };
        }
        if (e.status === 'up' && e.total > 0) {
          return {
            key: 'status',
            tone: 'ok',
            text: `The app is up: ${e.total} of ${e.total} instances answer.`,
          };
        }
        return null;
      default:
        return null;
    }
  }
}

const REGION_WORD: Record<string, string> = {
  NA: 'North America',
  SA: 'South America',
  EU: 'Europe',
  AF: 'Africa',
  AS: 'Asia',
  OC: 'Oceania',
};

/** Events of one key closer together than this are folded into one line. */
export const FOLD_WINDOW_MS = 2500;
export const MAX_LINES = 120;

/**
 * Adds an entry to a newest-first list. A line with the same key whose last event was within
 * `FOLD_WINDOW_MS` is updated in place (`count` up, text refolded); otherwise a new line is put on top.
 * Returns a new array; lines are replaced, never mutated.
 */
export function appendLine(
  lines: readonly LogLine[],
  entry: Entry,
  at: number,
  id: number,
  max: number = MAX_LINES,
): LogLine[] {
  const head = lines.find((l) => l.key === entry.key);
  if (head && entry.fold && at - head.last <= FOLD_WINDOW_MS) {
    const count = head.count + 1;
    const merged: LogLine = { ...head, count, last: at, text: entry.fold(head, count), tone: entry.tone };
    return lines.map((l) => (l === head ? merged : l));
  }
  const next: LogLine = {
    id,
    at,
    last: at,
    tone: entry.tone,
    key: entry.key,
    text: entry.text,
    count: 1,
  };
  const out = [next, ...lines];
  return out.length > max ? out.slice(0, max) : out;
}
