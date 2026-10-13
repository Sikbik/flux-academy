import { type CSSProperties, type ReactNode, useId, useRef } from 'react';
import { cn } from '../internal/cn';
import { hexPath, hexSegments } from '../internal/hex';
import { doneOfTotal, fraction, HEAD_LENGTH, headOffset, percentText, segmentFills } from './geometry';
import styles from './Progress.module.css';
import { useEntrance } from './useEntrance';

export type ProgressVariant = 'bar' | 'ring' | 'hex' | 'segments';
export type ProgressTier = 'cumulus' | 'nimbus' | 'stratus';

export interface ProgressProps {
  /**
   * `bar` (a ticked rail with a white-hot leading edge), `ring` (a circular arc), `hex` (a
   * segmented hexagonal ring with a white-hot head, the blueprint gauge) or `segments` (a rail
   * of cells that fill in turn).
   */
  variant?: ProgressVariant;
  /** The current value. Omit for indeterminate (work of unknown length). */
  value?: number;
  /** The scale. Defaults 0 and 1, so `value` is a fraction; use `max={100}` for percent. */
  min?: number;
  max?: number;
  /** For `segments`: steps done of steps in all. Overrides `value`, `max` and `cells`. */
  done?: number;
  total?: number;
  /** The accessible name. Required: every progress bar says what it is progress of. */
  label: string;
  /** Spoken (and shown) value, for example "3 of 8 lessons". Defaults to a percent. */
  valueText?: string;
  /** Show the label as visible text. Default true for `bar`, false for the others. */
  showLabel?: boolean;
  /** Show the value text. Default true for `bar`; on dials only when the size has room. */
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Wear a tier colour. Tier colour means tier and track, nothing else. */
  tier?: ProgressTier;
  /** A status colour, for something that is going well or badly. */
  tone?: 'ok' | 'warn' | 'crit';
  /** `segments`: how many cells (default 10). `hex`: cells around the ring (default 12, 0 for a continuous ring). */
  cells?: number;
  /** Content for the centre of a ring or hex: a glyph, a number. Replaces the value text. */
  children?: ReactNode;
  className?: string;
}

const DIAL_PX = { sm: 40, md: 64, lg: 104 } as const;
const DIAL_STROKE_PX = { sm: 3, md: 4, lg: 6 } as const;
const R_RING = 44;
const R_HEX = 42;

/**
 * A progress indicator in four shapes. The fill is an event the learner sees: it starts empty
 * and fills when the element is first scrolled into view, then follows every change.
 * `role="progressbar"` with the name, range and text; indeterminate omits the value.
 *
 *   <Progress label="Course progress" value={0.42} />
 *   <Progress variant="hex" label="Cumulus track" value={5} max={8} tier="cumulus" />
 *   <Progress variant="segments" label="Steps" done={3} total={8} />
 *   <Progress label="Syncing with the chain" />   // indeterminate
 */
export function Progress({
  variant = 'bar',
  value,
  min = 0,
  max = 1,
  done,
  total,
  label,
  valueText,
  showLabel,
  showValue,
  size = 'md',
  tier,
  tone,
  cells,
  children,
  className,
}: ProgressProps) {
  const root = useRef<HTMLDivElement>(null);
  const entered = useEntrance(root);
  const id = useId();
  const labelId = `${id}-l`;
  const maskId = `${id}-m`;

  const stepped = done != null && total != null;
  const lo = stepped ? 0 : min;
  const hi = stepped ? total : max;
  const raw = stepped ? done : value;
  const indeterminate = raw === undefined || Number.isNaN(raw);
  const f = indeterminate ? 0 : fraction(raw, lo, hi);
  const p = entered ? f : 0;
  const text = valueText ?? (stepped ? doneOfTotal(done, total) : percentText(f));

  const isBar = variant === 'bar';
  const isDial = variant === 'ring' || variant === 'hex';
  const labelVisible = showLabel ?? isBar;
  const valueVisible = (showValue ?? (isBar || (isDial && size !== 'sm'))) && !indeterminate;

  const aria = {
    role: 'progressbar' as const,
    'aria-valuemin': lo,
    'aria-valuemax': hi,
    'aria-valuenow': indeterminate ? undefined : raw,
    'aria-valuetext': indeterminate ? undefined : text,
    'aria-labelledby': labelVisible ? labelId : undefined,
    'aria-label': labelVisible ? undefined : label,
    'aria-busy': indeterminate ? true : undefined,
  };

  const common = {
    ref: root,
    className: cn(styles.root, className),
    'data-variant': variant,
    'data-size': size,
    'data-tier': tier,
    'data-tone': tone,
    'data-indeterminate': indeterminate ? 'true' : undefined,
    'data-complete': !indeterminate && f >= 1 ? 'true' : undefined,
    'data-empty': !indeterminate && p <= 0.002 ? 'true' : undefined,
  };

  const labelEl = labelVisible ? (
    <span id={labelId} className={styles.label}>
      {label}
    </span>
  ) : null;

  // ---- bar -------------------------------------------------------------------------------
  if (isBar) {
    return (
      <div {...common} {...aria} style={{ '--p': p } as CSSProperties}>
        {labelVisible || valueVisible ? (
          <div className={styles.head}>
            {labelEl}
            {valueVisible ? <span className={styles.value}>{text}</span> : null}
          </div>
        ) : null}
        <div className={styles.track}>
          <span className={styles.rail} aria-hidden="true">
            {indeterminate ? <span className={styles.shuttle} /> : <span className={styles.fill} />}
          </span>
          {indeterminate ? null : (
            <>
              <span className={styles.glow} aria-hidden="true" />
              <span className={styles.edge} aria-hidden="true" />
            </>
          )}
        </div>
        <div className={styles.ruler} aria-hidden="true">
          <span className={styles.ticks} />
          {indeterminate ? null : <span className={cn(styles.ticks, styles.lit)} />}
        </div>
      </div>
    );
  }

  // ---- segments --------------------------------------------------------------------------
  if (variant === 'segments') {
    const n = stepped ? Math.min(40, Math.max(1, total)) : Math.max(1, Math.floor(cells ?? 10));
    const fills = segmentFills(f, n);
    return (
      <div {...common} {...aria}>
        {labelVisible || valueVisible ? (
          <div className={styles.head}>
            {labelEl}
            {valueVisible ? <span className={styles.value}>{text}</span> : null}
          </div>
        ) : null}
        <div className={styles.cellsRow} aria-hidden="true" style={{ '--n': n } as CSSProperties}>
          {fills.map((fv, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed ordered set of cells
              key={i}
              className={styles.cell}
              data-state={fv >= 1 ? 'done' : fv > 0 ? 'part' : 'todo'}
              style={{ '--i': i, '--f': entered && !indeterminate ? fv : 0 } as CSSProperties}
            />
          ))}
        </div>
      </div>
    );
  }

  // ---- ring and hex ----------------------------------------------------------------------
  const px = DIAL_PX[size];
  const strokeUnits = (DIAL_STROKE_PX[size] * 100) / px;
  const dialStyle = {
    '--dial': `${px}px`,
    '--sw': strokeUnits,
    '--p': p,
  } as CSSProperties;
  // "3 of 8" does not fit a ring: a stepped dial says 3/8 in the middle (the spoken text stays).
  const centerText = valueText === undefined && stepped ? `${done}/${total}` : text;
  const center =
    children != null ? children : valueVisible ? <span className={styles.pct}>{centerText}</span> : null;

  let svg: ReactNode;
  if (variant === 'ring') {
    const geo = { cx: 50, cy: 50, r: R_RING, pathLength: 1, strokeWidth: strokeUnits } as const;
    svg = (
      <svg className={styles.svg} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className={cn(styles.dimArc, styles.turn)} {...geo} />
        <g className={indeterminate ? styles.orbit : undefined}>
          <circle
            className={cn(styles.arc, styles.turn)}
            {...geo}
            strokeDasharray={indeterminate ? '0.28 0.72' : 1}
            style={indeterminate ? undefined : { strokeDashoffset: 1 - p }}
          />
          {indeterminate ? null : (
            <circle
              className={cn(styles.head, styles.turn)}
              {...geo}
              strokeDasharray={`${HEAD_LENGTH} 1`}
              style={{ strokeDashoffset: headOffset(p), opacity: p > 0.004 ? 1 : 0 }}
            />
          )}
        </g>
      </svg>
    );
  } else {
    const n = Math.max(0, Math.floor(cells ?? 12));
    const d = hexPath(50, 50, R_HEX);
    const arcs = n > 0 ? hexSegments(50, 50, R_HEX, n, 0.016) : [];
    const masked = arcs.length > 0;
    svg = (
      <svg className={styles.svg} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        {masked ? (
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
              {arcs.map((arc) => (
                <path key={arc} d={arc} stroke="#fff" strokeWidth={strokeUnits * 2.4} fill="none" />
              ))}
            </mask>
          </defs>
        ) : null}
        <g mask={masked ? `url(#${maskId})` : undefined}>
          <path className={styles.dimArc} d={d} pathLength={1} strokeWidth={strokeUnits} />
        </g>
        <g className={indeterminate ? styles.orbit : undefined}>
          <g className={styles.hexGlow}>
            <g mask={masked ? `url(#${maskId})` : undefined}>
              <path
                className={styles.arc}
                d={d}
                pathLength={1}
                strokeWidth={strokeUnits}
                strokeDasharray={indeterminate ? '0.3 0.7' : 1}
                style={indeterminate ? undefined : { strokeDashoffset: 1 - p }}
              />
            </g>
          </g>
        </g>
        {indeterminate ? null : (
          <path
            className={styles.head}
            d={d}
            pathLength={1}
            strokeWidth={strokeUnits}
            strokeDasharray={`${HEAD_LENGTH} 1`}
            style={{ strokeDashoffset: headOffset(p), opacity: p > 0.004 ? 1 : 0 }}
          />
        )}
      </svg>
    );
  }

  return (
    <div {...common} {...aria} style={dialStyle}>
      <div className={styles.dial}>
        {svg}
        {center ? <div className={styles.center}>{center}</div> : null}
      </div>
      {labelVisible ? labelEl : null}
    </div>
  );
}
