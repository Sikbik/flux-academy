import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useElementSize } from '../hooks/useElementSize';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { cn } from '../internal/cn';
import { useEntrance } from '../Progress/useEntrance';
import {
  detectAppend,
  indexAt,
  nearestPoint,
  type SparkValue,
  sparkGeometry,
  stepCursor,
  summarize,
} from './geometry';
import styles from './Sparkline.module.css';

export type SparklineTier = 'cumulus' | 'nimbus' | 'stratus';

export interface SparklineProps {
  /** Oldest first, newest last. `null` is a gap (the line breaks). */
  values: readonly SparkValue[];
  /** Height in px. Default 56. The width is the container's. */
  height?: number;
  /** Fixed y bounds. Default: the data, padded 12 percent. */
  min?: number;
  max?: number;
  /** A dashed reference line (the 30 s block target) and its short caption. */
  target?: number;
  targetLabel?: string;
  /** The gradient area under the line. Default true. */
  area?: boolean;
  /** Slide the series in when a value is appended. Default true. */
  live?: boolean;
  /** A hex marker on the newest point. Default true. */
  showLast?: boolean;
  /** Pointer, touch and keyboard cursor with a readout. Default true. */
  interactive?: boolean;
  /** Formats values for the readout and the spoken summary. */
  formatValue?: (n: number) => string;
  /** A caption per point for the readout, for example the block height. */
  pointLabel?: (index: number, value: number) => string;
  /** Names the chart for assistive tech: "Block interval, seconds". */
  label?: string;
  tier?: SparklineTier;
  className?: string;
}

/** Vertical room for the line's stroke and the marker; horizontal room for the marker. */
const PAD = 5;
const PADX = 6;
const defaultFormat = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 1 });

/**
 * A trend line: a hairline with a gradient area, an optional target, a hex on the newest
 * point, a slide on append and a cursor with a readout. The line draws itself in when first
 * seen. Pointer and touch move the cursor; when focusable it is a slider over the points
 * (arrows, Home, End, Escape) and its value text is "Point n of N: value".
 *
 *   <Sparkline values={intervals} target={30} targetLabel="30 s" label="Block interval, seconds" />
 */
export function Sparkline({
  values,
  height = 56,
  min,
  max,
  target,
  targetLabel,
  area = true,
  live = true,
  showLast = true,
  interactive = true,
  formatValue = defaultFormat,
  pointLabel,
  label = 'Trend',
  tier,
  className,
}: SparklineProps) {
  const uid = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const entered = useEntrance(root);
  const { width } = useElementSize(root);
  const [cursor, setCursor] = useState<number | null>(null);

  const geometry = useMemo(
    () =>
      width > 0
        ? sparkGeometry(values, {
            min,
            max,
            target,
            width: Math.max(8, width - 2 * PADX),
            height: Math.max(8, height - 2 * PAD),
          })
        : null,
    [values, min, max, target, width, height],
  );

  // Slide in when the series grew or rolled by one value.
  const prev = useRef(values);
  useEffect(() => {
    const kind = detectAppend(prev.current, values);
    prev.current = values;
    if (!live || reduced || !kind || !geometry || geometry.step <= 0) return;
    const opts = { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };
    const frames = [{ transform: `translateX(${geometry.step}px)` }, { transform: 'translateX(0)' }];
    const a = plot.current?.animate(frames, opts);
    const b = marker.current?.animate(frames, opts);
    return () => {
      a?.cancel();
      b?.cancel();
    };
  }, [values, live, reduced, geometry]);

  const summary = summarize(label, values, formatValue);
  const canInteract = interactive && !!geometry && geometry.count > 1;

  if (width > 0 && !geometry) {
    return (
      <div
        ref={root}
        className={cn(styles.root, className)}
        style={{ blockSize: height }}
        role="img"
        aria-label={`${label}: no data yet`}
        data-empty="true"
      >
        <span className={styles.baseline} aria-hidden="true" />
      </div>
    );
  }

  const idx = geometry && cursor !== null ? nearestPoint(geometry.points, cursor) : -1;
  const point = geometry && idx >= 0 ? geometry.points[idx] : null;
  const value = idx >= 0 ? values[idx] : null;
  const shown = typeof value === 'number' ? value : null;
  const lastPoint = geometry && geometry.last >= 0 ? geometry.points[geometry.last] : null;

  const readout =
    shown !== null && idx >= 0
      ? `${pointLabel ? `${pointLabel(idx, shown)}  ` : ''}${formatValue(shown)}`
      : '';

  const fromEvent = (e: PointerEvent<HTMLDivElement>): number | null => {
    if (!geometry || !root.current) return null;
    const r = root.current.getBoundingClientRect();
    if (r.width <= 0) return null;
    const along = (e.clientX - r.left - PADX) / Math.max(1, r.width - 2 * PADX);
    return nearestPoint(geometry.points, indexAt(Math.min(1, Math.max(0, along)), geometry.count));
  };

  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!canInteract) return;
    const i = fromEvent(e);
    if (i !== null && i >= 0) setCursor(i);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!canInteract || !geometry) return;
    const from = cursor ?? geometry.last;
    let next: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = stepCursor(geometry.points, from, -1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = stepCursor(geometry.points, from, 1);
    else if (e.key === 'PageDown') next = stepCursor(geometry.points, from, -5);
    else if (e.key === 'PageUp') next = stepCursor(geometry.points, from, 5);
    else if (e.key === 'Home') next = nearestPoint(geometry.points, 0, 1);
    else if (e.key === 'End') next = geometry.last;
    else if (e.key === 'Escape' && cursor !== null) {
      e.preventDefault();
      setCursor(null);
      return;
    }
    if (next !== null) {
      e.preventDefault();
      setCursor(next);
    }
  };

  const spokenPoint =
    shown !== null && idx >= 0
      ? `Point ${idx + 1} of ${values.length}: ${pointLabel ? `${pointLabel(idx, shown)}, ` : ''}${formatValue(shown)}`
      : summary;

  const valueNow = idx >= 0 ? idx + 1 : (geometry?.last ?? 0) + 1;

  const edge =
    point && width > 0
      ? point.x + PADX < 56
        ? 'start'
        : point.x + PADX > width - 56
          ? 'end'
          : undefined
      : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the role is `slider` whenever handlers are live
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is `slider` or `img`; both take these
    <div
      ref={root}
      className={cn('chamfer', styles.root, className)}
      style={{ blockSize: height }}
      data-interactive={canInteract ? 'true' : undefined}
      data-active={point ? 'true' : undefined}
      data-entered={entered ? 'true' : undefined}
      data-tier={tier}
      role={canInteract ? 'slider' : 'img'}
      tabIndex={canInteract ? 0 : undefined}
      aria-label={canInteract ? label : summary}
      aria-valuemin={canInteract ? 1 : undefined}
      aria-valuemax={canInteract ? values.length : undefined}
      aria-valuenow={canInteract ? valueNow : undefined}
      aria-valuetext={canInteract ? spokenPoint : undefined}
      onPointerDown={onPointer}
      onPointerMove={onPointer}
      onPointerLeave={() => setCursor(null)}
      onKeyDown={onKey}
      onFocus={(e) => {
        if (canInteract && geometry && e.currentTarget.matches(':focus-visible') && cursor === null) {
          setCursor(geometry.last);
        }
      }}
      onBlur={() => setCursor(null)}
    >
      {geometry ? (
        <>
          <div ref={plot} className={styles.plot}>
            <svg
              className={styles.svg}
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={`${uid}a`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0.3" />
                  <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              {geometry.targetY !== null ? (
                <line
                  className={styles.target}
                  x1={0}
                  x2={width}
                  y1={geometry.targetY + PAD}
                  y2={geometry.targetY + PAD}
                />
              ) : null}
              <g transform={`translate(${PADX} ${PAD})`}>
                {area ? <path className={styles.area} d={geometry.area} fill={`url(#${uid}a)`} /> : null}
                <path className={styles.line} d={geometry.line} pathLength={1} />
              </g>
            </svg>
          </div>
          {targetLabel && geometry.targetY !== null ? (
            <span className={styles.targetLabel} style={{ insetBlockStart: geometry.targetY + PAD }}>
              {targetLabel}
            </span>
          ) : null}
          {showLast && lastPoint ? (
            <span
              ref={marker}
              className={styles.marker}
              style={{ left: lastPoint.x + PADX, top: lastPoint.y + PAD } as CSSProperties}
              aria-hidden="true"
            />
          ) : null}
          {point && shown !== null ? (
            <>
              <span className={styles.cursorLine} style={{ left: point.x + PADX }} aria-hidden="true" />
              <span
                className={styles.cursorDot}
                style={{ left: point.x + PADX, top: point.y + PAD } as CSSProperties}
                aria-hidden="true"
              />
              <span
                className={styles.readout}
                data-edge={edge}
                style={{ left: point.x + PADX }}
                aria-hidden="true"
              >
                {readout}
              </span>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
