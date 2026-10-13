import { type CSSProperties, type ReactNode, useRef } from 'react';
import { CountUp } from '../CountUp/CountUp';
import { Glyph } from '../Glyph/Glyph';
import { cn } from '../internal/cn';
import { formatNumber } from '../Odometer/format';
import { fraction, HEAD_LENGTH, headOffset } from '../Progress/geometry';
import { useEntrance } from '../Progress/useEntrance';
import styles from './Gauge.module.css';
import { arcPath, degToFraction, ringPosition, tickAt } from './geometry';
import { resolveTone, type Thresholds, type ToneProp, toneWord } from './tone';

export type GaugeTier = 'cumulus' | 'nimbus' | 'stratus';

export interface GaugeProps {
  value: number;
  /** The scale. Defaults 0 and 100. */
  min?: number;
  max?: number;
  /** The accessible name, and the caption under the dial (md and lg). Required. */
  label: string;
  /** A unit shown small after the number: "%", "GB", "vCPU". */
  unit?: string;
  /** Decimals of the centre number. Default 0. */
  decimals?: number;
  /** Replaces the centre number entirely (and its count-up). */
  format?: (value: number) => string;
  /** Spoken value, for example "1.5 of 4 vCPU in use". Defaults to number, unit and status word. */
  valueText?: string;
  /** sm 48 px, md 72 px (default), lg 112 px. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * `accent` (default), a fixed status, or `auto`, which reads `thresholds`: ok below warn,
   * warn from warn, crit from crit. Status is also a glyph (md) and a word (lg), never colour alone.
   */
  tone?: ToneProp;
  /** Wear a tier colour. */
  tier?: GaugeTier;
  /** Where the status turns, in value units. Defaults to 70 and 90 percent of the range. */
  thresholds?: Thresholds;
  /** Low values are the bad ones (free space, uptime). */
  lowIsBad?: boolean;
  /** A hard limit, in value units: a long white tick with a dot, outside the ring. */
  limit?: number;
  /**
   * Where the open ring starts and how far it sweeps, in degrees of the perimeter (0 is the
   * top vertex, clockwise; 360 is once around). Default 210 and 300: open at the bottom, as
   * on the specimen. A sweep of 360 closes the ring.
   */
  startAngle?: number;
  sweep?: number;
  /** Show the caption. Default true for md and lg. */
  showLabel?: boolean;
  /** Centre content, replacing the number. */
  children?: ReactNode;
  className?: string;
}

const PX = { sm: 48, md: 72, lg: 112 } as const;
const STROKE_PX = { sm: 3, md: 4, lg: 5.5 } as const;
const R = 37;
/** The centre's width in ems of the number's font size: what fits inside the ring. */
const CENTER_EM = 2.1;

/**
 * The hex arc gauge from the specimen: a pointy-top hexagonal ring, open at the bottom, with
 * a value arc that ends in a white-hot head, a mono readout in the middle, threshold marks and
 * a limit tick outside. `role="meter"`.
 *
 *   <Gauge label="CPU" value={62} unit="%" tone="auto" />
 *   <Gauge label="RAM" value={3.1} max={4} unit="GB" decimals={1} limit={3.5} />
 */
export function Gauge({
  value,
  min = 0,
  max = 100,
  label,
  unit,
  decimals = 0,
  format,
  valueText,
  size = 'md',
  tone = 'accent',
  tier,
  thresholds,
  lowIsBad = false,
  limit,
  startAngle = 210,
  sweep = 300,
  showLabel,
  children,
  className,
}: GaugeProps) {
  const root = useRef<HTMLDivElement>(null);
  const entered = useEntrance(root);

  const f = fraction(value, min, max);
  const p = entered ? f : 0;
  const status = resolveTone({ value, min, max, tone, thresholds, lowIsBad });
  const word = toneWord(status, lowIsBad);
  const px = PX[size];
  const strokeUnits = (STROKE_PX[size] * 100) / px;

  const start = degToFraction(startAngle);
  const span = Math.min(1, Math.max(0.05, degToFraction(sweep)));
  const d = arcPath(50, 50, R, start, span);

  const numberText = format ? format(value) : formatNumber(value, { decimals });
  // The centre is a fixed hexagon: scale the number down when it and its unit would not fit.
  const emWidth = numberText.length * 0.6 + (unit ? 0.14 + unit.length * 0.33 : 0);
  const fit = Math.min(1, CENTER_EM / Math.max(1, emWidth));
  const spoken =
    valueText ??
    `${numberText}${unit ? ` ${unit}` : ''}${word && tone === 'auto' ? `, ${word.toLowerCase()}` : ''}`;

  // Marks outside the ring: where status turns, and the limit.
  const marks: { key: string; t: number; kind: 'warn' | 'crit' | 'limit' }[] = [];
  if (tone === 'auto' && thresholds) {
    if (thresholds.warn != null) {
      marks.push({
        key: 'warn',
        t: ringPosition(fraction(thresholds.warn, min, max), start, span),
        kind: 'warn',
      });
    }
    if (thresholds.crit != null) {
      marks.push({
        key: 'crit',
        t: ringPosition(fraction(thresholds.crit, min, max), start, span),
        kind: 'crit',
      });
    }
  }
  if (limit != null) {
    marks.push({ key: 'limit', t: ringPosition(fraction(limit, min, max), start, span), kind: 'limit' });
  }

  const captionVisible = showLabel ?? size !== 'sm';
  const statusGlyph = status === 'ok' ? 'status-ok' : status === 'warn' ? 'status-warn' : 'status-crit';

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
      data-empty={p <= 0.002 ? 'true' : undefined}
      data-tone={status === 'accent' ? undefined : status}
      data-tier={tier}
      style={{ '--g': `${px}px`, '--fit': fit } as CSSProperties}
    >
      <div className={styles.dial}>
        <svg className={styles.svg} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <path className={styles.track} d={d} strokeWidth={strokeUnits} />
          <g className={styles.glow}>
            <path
              className={styles.arc}
              d={d}
              pathLength={1}
              strokeWidth={strokeUnits}
              strokeDasharray={1}
              style={{ strokeDashoffset: 1 - p }}
            />
          </g>
          <path
            className={styles.head}
            d={d}
            pathLength={1}
            strokeWidth={strokeUnits}
            strokeDasharray={`${HEAD_LENGTH} 1`}
            style={{ strokeDashoffset: headOffset(p), opacity: p > 0.004 ? 1 : 0 }}
          />
          {marks.map((m) => {
            const t = tickAt(50, 50, R, m.t, strokeUnits / 2 + 2.5, m.kind === 'limit' ? 9 : 5.5);
            return (
              <g key={m.key} className={styles.mark} data-kind={m.kind}>
                <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
                {m.kind === 'limit' ? <circle cx={t.x2} cy={t.y2} r={1.9} /> : null}
              </g>
            );
          })}
        </svg>
        <div className={styles.center} aria-hidden="true">
          {children ?? (
            <>
              <span className={styles.num}>
                {format ? numberText : <CountUp value={value} decimals={decimals} duration={700} />}
                {unit ? <span className={styles.unit}>{unit}</span> : null}
              </span>
              {status !== 'accent' && size === 'md' ? (
                <span className={styles.statusGlyph}>
                  <Glyph name={statusGlyph} size={12} />
                </span>
              ) : null}
              {status !== 'accent' && size === 'lg' ? (
                <span className={styles.statusWord}>
                  <Glyph name={statusGlyph} size={9} />
                  {word}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>
      {captionVisible ? <span className={styles.caption}>{label}</span> : null}
    </div>
  );
}
