/**
 * The uptime meter: of the requests sent since the last reset, how many got an answer, and the same over
 * the last 60 seconds, with a one second strip so a dip is visible as it happens. Everything is counted
 * from the simulation's `served` and `failed` events; a request still in flight is not counted yet.
 */
import { useEffect, useState } from 'react';
import { formatInt } from '@/lib/format';
import { Chip, Meter, Stat } from '@/ui';
import { DEFAULT_WINDOW_MS, percent, type RequestMeter } from './meter';
import styles from './UptimePanel.module.css';
import type { View } from './view';
import { RESTORE_CHECKS_WORD, RESTORE_SEC } from './words';

export interface UptimePanelProps {
  meter: RequestMeter;
  /** Simulated time now, ms. */
  time: () => number;
  view: View;
  /** The instances were just placed and traffic has not started: the load balancer is still checking. */
  warming?: boolean;
}

const STATUS = {
  idle: { word: 'No instances', tone: 'off' },
  starting: { word: 'Starting', tone: 'pending' },
  up: { word: 'Up', tone: 'ok' },
  degraded: { word: 'Degraded', tone: 'warn' },
  down: { word: 'Down', tone: 'crit' },
} as const;

export function UptimePanel({ meter, time, view, warming = false }: UptimePanelProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const now = time();
  const totals = meter.totals();
  const win = meter.window(now, DEFAULT_WINDOW_MS);
  const buckets = meter.buckets(now, 60);
  const peak = Math.max(1, ...buckets.map((b) => b.served + b.failed));
  const status = STATUS[view.status];
  const empty = totals.served + totals.failed === 0;
  const windowPercent = win.ratio === null ? null : win.ratio * 100;

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <h2 className={styles.title}>Uptime</h2>
        <Chip kind="status" status={status.tone} size="sm">
          {status.word}
          {view.total > 0 ? `, ${view.healthy} of ${view.total} answering` : ''}
        </Chip>
      </div>

      <div className={styles.figures}>
        <Stat
          label="Answered since reset"
          value={percent(totals.ratio)}
          animate={false}
          size="lg"
          sub={
            empty
              ? warming
                ? `Warming up. The load balancer needs ${RESTORE_CHECKS_WORD} good checks, about ${RESTORE_SEC} seconds, before traffic starts.`
                : 'No requests yet. Turn the request rate up or send one.'
              : `${formatInt(totals.served)} answered, ${formatInt(totals.failed)} failed`
          }
        />
      </div>

      <Meter
        label="Last 60 seconds"
        value={windowPercent ?? 0}
        min={0}
        max={100}
        valueText={percent(win.ratio)}
        tone={
          windowPercent === null
            ? 'accent'
            : windowPercent >= 99
              ? 'ok'
              : windowPercent >= 90
                ? 'warn'
                : 'crit'
        }
        cells={30}
        size="sm"
      />
      <p className={styles.counts}>
        {win.ratio === null
          ? 'Nothing finished in the last 60 seconds.'
          : `${formatInt(win.served)} answered, ${formatInt(win.failed)} failed in the last 60 seconds.`}
      </p>

      <div
        className={styles.strip}
        role="img"
        aria-label={`Requests each second over the last 60 seconds. ${formatInt(win.served)} answered and ${formatInt(win.failed)} failed in that time.`}
      >
        {buckets.map((b, i) => {
          const total = b.served + b.failed;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed ring of 60 one second slots
            <span key={i} className={styles.slot} data-empty={total === 0 ? '' : undefined}>
              {b.failed > 0 ? (
                <i data-kind="failed" style={{ blockSize: `${(b.failed / peak) * 100}%` }} />
              ) : null}
              {b.served > 0 ? (
                <i data-kind="served" style={{ blockSize: `${(b.served / peak) * 100}%` }} />
              ) : null}
            </span>
          );
        })}
      </div>
      <p className={styles.legend}>
        <span>60 s ago</span>
        <span className={styles.key}>
          <i data-kind="served" /> answered <i data-kind="failed" /> failed
        </span>
        <span>now</span>
      </p>
    </div>
  );
}
