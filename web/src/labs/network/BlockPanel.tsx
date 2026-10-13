/**
 * The block cadence panel: a dial for the mean gap between blocks, a sparkline of the recent gaps, the tip
 * height, and (only when the clock is anchored to live observations) the time to the next block.
 * Everything is read from `useBlocks` and the chain clock; with no live clock there is no countdown.
 */
import type { BlockSummary } from '@shared/api';
import type { ReactNode } from 'react';
import { useChainClock } from '@/data';
import { formatDecimal, formatInt } from '@/lib/format';
import { Gauge, Odometer, Skeleton, Sparkline } from '@/ui';
import styles from './BlockPanel.module.css';
import { intervalHeights, intervalRange, intervalSeries, meanInterval } from './model';

export interface BlockPanelProps {
  blocks: readonly BlockSummary[] | null;
  /** Protocol target interval, seconds. */
  targetSec: number;
  /** Tip height from the network snapshot (or the last block). */
  tipHeight: number | null;
  /** The freshness chip of the blocks feed. */
  chip: ReactNode;
  note?: ReactNode;
  loading: boolean;
}

/** Seconds to the next block, from the chain clock. Its own component: it re-renders every second. */
function NextBlock() {
  const clock = useChainClock();
  if (!clock.live || clock.nextBlockInMs === null) {
    return (
      <p className={styles.next}>
        <span className={styles.nextLabel}>Next block</span>
        <span className={styles.nextValue}>--</span>
        <span className={styles.nextHint}>No live clock, so no countdown.</span>
      </p>
    );
  }
  const s = Math.ceil(clock.nextBlockInMs / 1000);
  return (
    <p className={styles.next}>
      <span className={styles.nextLabel}>Next block</span>
      <span className={styles.nextValue}>{s > 0 ? `in about ${s} s` : 'due now'}</span>
      <span className={styles.nextHint}>
        Expected {formatDecimal(clock.intervalMs / 1000, 0)} s after the last.
      </span>
    </p>
  );
}

export function BlockPanel({ blocks, targetSec, tipHeight, chip, note, loading }: BlockPanelProps) {
  const list = blocks ?? [];
  const series = intervalSeries(list, 60);
  const heights = intervalHeights(list, 60);
  const mean = meanInterval(list.slice(-60));
  const range = intervalRange(series);
  const tip = tipHeight ?? list[list.length - 1]?.height ?? null;

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <h2 className={styles.title}>Blocks</h2>
        {chip}
      </div>

      <div className={styles.body}>
        <div className={styles.dial} data-explain="block-dial">
          {mean === null ? (
            <Skeleton shape="circle" width={112} height={112} />
          ) : (
            <Gauge
              size="lg"
              label="Mean block gap"
              unit="s"
              value={mean}
              min={0}
              max={Math.max(60, targetSec * 2)}
              decimals={1}
              limit={targetSec}
              valueText={`Blocks arrived ${formatDecimal(mean, 1)} seconds apart on average over the last ${series.length} blocks. The target is ${targetSec} seconds.`}
            />
          )}
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Target</dt>
            <dd>{targetSec} s</dd>
          </div>
          <div>
            <dt>Latest block</dt>
            <dd>{tip === null ? '--' : <Odometer value={tip} flash />}</dd>
          </div>
          {range ? (
            <div>
              <dt>Range</dt>
              <dd>
                {formatInt(range.min)} to {formatInt(range.max)} s
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className={styles.trend} data-explain="block-trend">
        {series.length >= 2 ? (
          <Sparkline
            values={series}
            height={64}
            target={targetSec}
            label={`Seconds between blocks, last ${series.length} blocks`}
            formatValue={(n) => `${formatDecimal(n, 0)} s`}
            pointLabel={(i) => `Block ${formatInt(heights[i])}`}
          />
        ) : loading ? (
          <Skeleton shape="block" height={64} />
        ) : (
          <p className={styles.empty}>No recent blocks to draw yet.</p>
        )}
        {series.length >= 2 ? (
          <p className={styles.legend}>
            Seconds between the last {series.length} blocks. The dashed line is the {targetSec} s target.
          </p>
        ) : null}
      </div>

      <NextBlock />
      <div className={styles.note}>{note}</div>
    </div>
  );
}
