/**
 * The Failover Lab's bookkeeping around the bench: the request meter, the event log and a throttled view
 * of the simulation for the panels. The bench itself (Diorama) owns the simulation and its clock; this
 * only listens to its events and reads its state, so nothing here can disagree with what is drawn.
 *
 * Renders are kept calm on purpose: a stream of 20 requests a second must not re-render the page 20
 * times a second. The log is flushed every 120 ms, the view is rebuilt when something a panel shows
 * changes, and the answered-requests counters are refreshed twice a second.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DioramaHandle } from '@/diorama';
import type { SimEvent } from '@/diorama/sim';
import { unlock } from '@/learn/achievements';
import { appendLine, type Entry, type LogLine, Narrator } from './log';
import { RequestMeter } from './meter';
import { buildView, EMPTY_VIEW, type View, viewSignature } from './view';

const LOG_FLUSH_MS = 120;
const VIEW_POLL_MS = 500;

export interface FailoverSession {
  /** Pass to `<Diorama onReady onEvent>`. */
  onReady: (handle: DioramaHandle) => void;
  onEvent: (event: SimEvent) => void;
  handle: () => DioramaHandle | null;
  meter: RequestMeter;
  /** Simulated time now, ms. */
  time: () => number;
  view: View;
  lines: readonly LogLine[];
  clearLog: () => void;
  /** Forget the counters and the log (the lab was started over). */
  resetCounters: () => void;
  /** Rebuild the view now, for after an action. */
  refresh: () => void;
}

export function useFailoverSession(): FailoverSession {
  const handleRef = useRef<DioramaHandle | null>(null);
  const meter = useMemo(() => new RequestMeter(), []);
  const narrator = useRef<Narrator | null>(null);
  const [view, setView] = useState<View>(EMPTY_VIEW);
  const [lines, setLines] = useState<readonly LogLine[]>([]);
  const queue = useRef<Array<{ entry: Entry; at: number }>>([]);
  const flushTimer = useRef(0);
  const viewTimer = useRef(0);
  const signature = useRef('');
  const lineId = useRef(0);

  const refresh = useCallback(() => {
    const h = handleRef.current;
    const state = h?.state();
    const bench = h?.bench;
    if (!state || !bench) return;
    const next = buildView(state, bench);
    const sig = viewSignature(next);
    if (sig !== signature.current) {
      signature.current = sig;
      setView(next);
    }
  }, []);

  const refreshSoon = useCallback(() => {
    if (viewTimer.current) return;
    viewTimer.current = window.setTimeout(() => {
      viewTimer.current = 0;
      refresh();
    }, 40);
  }, [refresh]);

  const flush = useCallback(() => {
    flushTimer.current = 0;
    const batch = queue.current;
    queue.current = [];
    if (batch.length === 0) return;
    setLines((prev) => {
      let out: readonly LogLine[] = prev;
      for (const b of batch) out = appendLine(out, b.entry, b.at, ++lineId.current);
      return out;
    });
  }, []);

  const clearLog = useCallback(() => {
    queue.current = [];
    setLines([]);
  }, []);

  const resetCounters = useCallback(() => {
    meter.reset();
    narrator.current?.reset();
    clearLog();
  }, [meter, clearLog]);

  const onReady = useCallback(
    (h: DioramaHandle) => {
      handleRef.current = h;
      narrator.current = h.bench ? new Narrator(h.bench) : null;
      meter.reset();
      signature.current = '';
      refresh();
    },
    [meter, refresh],
  );

  const onEvent = useCallback(
    (e: SimEvent) => {
      if (e.type === 'served') meter.record('served', e.at);
      else if (e.type === 'failed') meter.record('failed', e.at);
      else if (e.type === 'reset') {
        meter.reset();
        narrator.current?.reset();
        queue.current = [];
        setLines([]);
      } else if (e.type === 'node-down') {
        // The medal for the first node you take down in a failover scene.
        unlock('first-blood');
      }
      const entry = narrator.current?.describe(e);
      if (entry) {
        queue.current.push({ entry, at: e.at });
        if (!flushTimer.current) flushTimer.current = window.setTimeout(flush, LOG_FLUSH_MS);
      }
      // Traffic events change counters only; everything else can change what a panel shows.
      if (e.type !== 'served' && e.type !== 'failed' && e.type !== 'rerouted') refreshSoon();
    },
    [meter, flush, refreshSoon],
  );

  // The answered-request counters and rolling times move without events of their own.
  useEffect(() => {
    const id = window.setInterval(refresh, VIEW_POLL_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(flushTimer.current);
      window.clearTimeout(viewTimer.current);
    };
  }, [refresh]);

  return {
    onReady,
    onEvent,
    handle: () => handleRef.current,
    meter,
    time: () => handleRef.current?.state()?.time ?? 0,
    view,
    lines,
    clearLog,
    resetCounters,
    refresh,
  };
}
