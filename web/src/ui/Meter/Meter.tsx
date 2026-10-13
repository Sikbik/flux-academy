import { type CSSProperties, useRef } from 'react';
import { cellTones, resolveTone, type Thresholds, type ToneProp, toneWord } from '../Gauge/tone';
import { Glyph } from '../Glyph/Glyph';
import { cn } from '../internal/cn';
import { formatNumber } from '../Odometer/format';
import { fraction, percentText, segmentFills } from '../Progress/geometry';
import { useEntrance } from '../Progress/useEntrance';
import styles from './Meter.module.css';

export type MeterTier = 'cumulus' | 'nimbus' | 'stratus';

export interface MeterProps {
  value: number;
  /** The scale. Defaults 0 and 100. */
  min?: number;
  max?: number;
  /** The accessible name and the caption on the left. Required. */
  label: string;
  /** A unit for the readout on the right: "vCPU", "GB". Without it the readout is a percent. */
  unit?: string;
  /** Show "value / max unit" rather than "value unit". Default true when there is a unit. */
  showMax?: boolean;
  decimals?: number;
  /** Replaces the readout text. */
  valueText?: string;
  /** Number of cells. Default 20. */
  cells?: number;
  /** `accent` (default), a fixed status, or `auto` (zones read `thresholds`, cell by cell). */
  tone?: ToneProp;
  tier?: MeterTier;
  thresholds?: Thresholds;
  lowIsBad?: boolean;
  /** A hard limit, in value units: a white tick across the cells. */
  limit?: number;
  limitLabel?: string;
  /** A recommended level, in value units: a dashed tick. */
  target?: number;
  targetLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * A slim segmented bar for resource usage (CPU, RAM, disk): label on the left, readout on the
 * right, cells that light with a small stagger, optional limit and target ticks. With
 * `tone="auto"` the cells are zoned (normal, high, critical) and a word says so. `role="meter"`.
 *
 *   <Meter label="CPU" value={1.5} max={4} unit="vCPU" tone="auto" limit={3.5} />
 */
export function Meter({
  value,
  min = 0,
  max = 100,
  label,
  unit,
  showMax,
  decimals = 0,
  valueText,
  cells = 20,
  tone = 'accent',
  tier,
  thresholds,
  lowIsBad = false,
  limit,
  limitLabel,
  target,
  targetLabel,
  size = 'md',
  className,
}: MeterProps) {
  const root = useRef<HTMLDivElement>(null);
  const entered = useEntrance(root);
  const n = Math.min(60, Math.max(4, Math.floor(cells)));

  const f = fraction(value, min, max);
  const fills = segmentFills(entered ? f : 0, n);
  const tones = cellTones(n, { min, max, tone, thresholds, lowIsBad });
  const status = resolveTone({ value, min, max, tone, thresholds, lowIsBad });
  const word = toneWord(status, lowIsBad);
  const litCount = fills.filter((x) => x > 0).length;

  const maxVisible = showMax ?? !!unit;
  const readout =
    valueText ??
    (unit
      ? `${formatNumber(value, { decimals })}${maxVisible ? ` / ${formatNumber(max, { decimals })}` : ''} ${unit}`
      : percentText(f));
  const spoken = `${readout}${word && tone === 'auto' ? `, ${word.toLowerCase()}` : ''}`;
  const showState = tone === 'auto' && (status === 'warn' || status === 'crit');

  const mark = (v: number) => `${fraction(v, min, max) * 100}%`;
  const edgeOf = (v: number): 'start' | 'end' | undefined => {
    const x = fraction(v, min, max);
    return x < 0.1 ? 'start' : x > 0.9 ? 'end' : undefined;
  };
  const tags = size !== 'sm' && ((target != null && !!targetLabel) || (limit != null && !!limitLabel));

  return (
    // biome-ignore lint/a11y/useSemanticElements: a drawn instrument; a native <meter> cannot take this design
    <div
      ref={root}
      className={cn(styles.root, className)}
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number.isFinite(value) ? value : undefined}
      aria-valuetext={spoken}
      data-size={size}
      data-tone={status === 'accent' ? undefined : status}
      data-tier={tier}
      style={{ '--n': n } as CSSProperties}
    >
      <div className={styles.head} aria-hidden="true">
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>
          {showState ? (
            <span className={styles.state}>
              <Glyph name={status === 'crit' ? 'status-crit' : 'status-warn'} size={12} />
              {word}
            </span>
          ) : null}
          {readout}
        </span>
      </div>
      <div className={styles.track} aria-hidden="true" data-tags={tags ? 'true' : undefined}>
        {fills.map((fv, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed ordered set of cells
            key={i}
            className={styles.cell}
            data-tone={tones[i]}
            data-head={litCount > 0 && i === litCount - 1 ? 'true' : undefined}
            style={{ '--i': i, '--f': fv } as CSSProperties}
          />
        ))}
        {target != null ? (
          <span className={styles.target} style={{ insetInlineStart: mark(target) }}>
            {targetLabel && size !== 'sm' ? (
              <span className={styles.tag} data-edge={edgeOf(target)}>
                {targetLabel}
              </span>
            ) : null}
          </span>
        ) : null}
        {limit != null ? (
          <span className={styles.limit} style={{ insetInlineStart: mark(limit) }}>
            {limitLabel && size !== 'sm' ? (
              <span className={styles.tag} data-edge={edgeOf(limit)}>
                {limitLabel}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
