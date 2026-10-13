/**
 * The uptime meter: requests that were served against requests that failed, since the lab was reset and
 * over a rolling window (60 s by default). Pure bookkeeping over the simulation's `served` and `failed`
 * events, which carry simulated time, so the meter always agrees with what the diorama shows.
 *
 * It counts final outcomes only. A request that is still in flight, or was redirected and then served,
 * is one served request (the log says it was rerouted). Nothing here is a claim about the real network.
 */

export type Outcome = 'served' | 'failed';

export interface WindowStats {
  served: number;
  failed: number;
  /** `served / (served + failed)` as a fraction, or null when nothing finished in the window. */
  ratio: number | null;
}

export interface Bucket {
  served: number;
  failed: number;
}

interface Entry {
  at: number;
  outcome: Outcome;
}

export const DEFAULT_WINDOW_MS = 60_000;

export class RequestMeter {
  private entries: Entry[] = [];
  private servedTotal = 0;
  private failedTotal = 0;
  private readonly keepMs: number;

  constructor(keepMs: number = DEFAULT_WINDOW_MS * 2) {
    this.keepMs = keepMs;
  }

  /** Records one finished request at simulated time `atMs`. */
  record(outcome: Outcome, atMs: number): void {
    this.entries.push({ at: atMs, outcome });
    if (outcome === 'served') this.servedTotal++;
    else this.failedTotal++;
    this.prune(atMs);
  }

  private prune(nowMs: number): void {
    const floor = nowMs - this.keepMs;
    let drop = 0;
    while (drop < this.entries.length && (this.entries[drop] as Entry).at < floor) drop++;
    if (drop > 0) this.entries.splice(0, drop);
  }

  reset(): void {
    this.entries = [];
    this.servedTotal = 0;
    this.failedTotal = 0;
  }

  /** Totals since the last reset. */
  totals(): WindowStats {
    const sum = this.servedTotal + this.failedTotal;
    return {
      served: this.servedTotal,
      failed: this.failedTotal,
      ratio: sum > 0 ? this.servedTotal / sum : null,
    };
  }

  /** The stats of the half-open window `(nowMs - spanMs, nowMs]`. */
  window(nowMs: number, spanMs: number = DEFAULT_WINDOW_MS): WindowStats {
    const from = nowMs - spanMs;
    let served = 0;
    let failed = 0;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i] as Entry;
      if (e.at <= from) break;
      if (e.at > nowMs) continue;
      if (e.outcome === 'served') served++;
      else failed++;
    }
    const sum = served + failed;
    return { served, failed, ratio: sum > 0 ? served / sum : null };
  }

  /** One bucket per second over the last `seconds`, oldest first, for the strip under the meter. */
  buckets(nowMs: number, seconds = 60): Bucket[] {
    const out: Bucket[] = Array.from({ length: seconds }, () => ({ served: 0, failed: 0 }));
    const end = Math.floor(nowMs / 1000);
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i] as Entry;
      const sec = Math.floor(e.at / 1000);
      const back = end - sec;
      if (back >= seconds) break;
      if (back < 0) continue;
      const b = out[seconds - 1 - back] as Bucket;
      if (e.outcome === 'served') b.served++;
      else b.failed++;
    }
    return out;
  }
}

/** "99.2%" for a ratio, or "No requests yet" style text is the caller's job: this only formats numbers. */
export function percent(ratio: number | null, decimals = 1): string {
  if (ratio === null) return '--';
  const p = ratio * 100;
  // 99.96 must not print as 100.0: show what the data says.
  const floored = Math.floor(p * 10 ** decimals) / 10 ** decimals;
  const text = (ratio < 1 ? floored : p).toFixed(decimals);
  return `${text}%`;
}
