import { type ElementType, type ReactNode, type RefObject, useRef } from 'react';
import { CountUp } from '../CountUp/CountUp';
import { FreshnessChip, type FreshnessChipProps } from '../FreshnessChip/FreshnessChip';
import { useIsoLayoutEffect } from '../hooks/useIsoLayoutEffect';
import { cn } from '../internal/cn';
import { formatNumber, MINUS, PLACEHOLDER } from '../Odometer/format';
import { Odometer } from '../Odometer/Odometer';
import { Skeleton } from '../Skeleton/Skeleton';
import styles from './Stat.module.css';

export type StatSize = 'sm' | 'md' | 'lg';
export type StatTier = 'cumulus' | 'nimbus' | 'stratus';
/**
 * `div` is a plain block. `dl` is a stand-alone description list (term, definition). `dl-item`
 * is one term/definition group for a Stat placed directly inside your own `<dl>`.
 */
export type StatAs = 'div' | 'dl' | 'dl-item';

export interface StatDelta {
  /** The change in `unit`s. Its sign picks the direction; zero (after rounding) is flat. */
  value: number;
  /** Default `%`. */
  unit?: string;
  /** Decimals shown. Default 1. */
  decimals?: number;
  /** A visible caption, for example `vs 24 h`. */
  label?: string;
  /** Which direction is good news: it picks green or red. Default `up`. `neutral` keeps the accent. */
  good?: 'up' | 'down' | 'neutral';
}

export interface StatProps {
  /** The caption, set as mono caps above the figure. Required. */
  label: string;
  /**
   * The figure. A number is formatted and animated per `animate`; a string or node is shown
   * as is; `null` or `undefined` shows `--` (never a made-up zero).
   */
  value?: ReactNode;
  /** Set small and muted after the figure: `GB`, `FLUX`, `blocks`. */
  unit?: string;
  /** Numbers only. */
  decimals?: number;
  grouping?: boolean;
  prefix?: string;
  suffix?: string;
  /**
   * Numbers only. `count` (default) counts up once when scrolled into view and eases to
   * new values; `roll` is the odometer, for values that tick live; `false` is plain text.
   */
  animate?: 'count' | 'roll' | false;
  /** Pour the accent gradient across the figure. The hero numbers only. */
  gradient?: boolean;
  /** A line under the figure. */
  sub?: ReactNode;
  /** The change since a reference, with sign, glyph and a word. */
  delta?: StatDelta;
  /** A FreshnessChip beside the label: how far to trust the figure. */
  freshness?: FreshnessChipProps;
  /** Show a skeleton where the figure goes and set `aria-busy`. The label stays. */
  loading?: boolean;
  size?: StatSize;
  tier?: StatTier;
  as?: StatAs;
  /** Below the sub line: a Sparkline, a Meter. */
  children?: ReactNode;
  className?: string;
}

function deltaParts(d: StatDelta) {
  const decimals = d.decimals ?? 1;
  const abs = Math.abs(d.value);
  const rounded = Number(abs.toFixed(Math.min(12, Math.max(0, decimals))));
  const dir: 'up' | 'down' | 'flat' = rounded === 0 ? 'flat' : d.value > 0 ? 'up' : 'down';
  const good = d.good ?? 'up';
  const verdict = dir === 'flat' || good === 'neutral' ? undefined : dir === good;
  const sign = dir === 'up' ? '+' : dir === 'down' ? MINUS : '';
  const unit = d.unit ?? '%';
  const text = `${formatNumber(rounded, { decimals })}${unit.length > 1 ? ' ' : ''}${unit}`;
  const word = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'no change';
  return { dir, verdict, sign, text, word };
}

/**
 * Scales the figure down (never up) so it and its unit fit the row. Measured from a hidden
 * copy of the final text, so a count-up does not shrink as digits arrive. Writes `--fit`
 * straight to the DOM: no re-render, no flash.
 */
function useFit(
  figure: RefObject<HTMLElement | null>,
  probe: RefObject<HTMLElement | null>,
  unit: RefObject<HTMLElement | null>,
  key: string,
): void {
  useIsoLayoutEffect(() => {
    const fig = figure.current;
    const pr = probe.current;
    if (!fig || !pr) return;
    let applied = 1;
    const run = () => {
      const unitW = unit.current ? unit.current.getBoundingClientRect().width + 10 : 0;
      const room = fig.clientWidth - unitW;
      const natural = pr.getBoundingClientRect().width / applied;
      const next = room > 0 && natural > room ? Math.max(0.4, room / natural) : 1;
      if (Math.abs(next - applied) < 0.002) return;
      applied = next;
      fig.style.setProperty('--fit', next.toFixed(3));
    };
    run();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(run);
    ro.observe(fig);
    ro.observe(pr);
    return () => ro.disconnect();
  }, [figure, probe, unit, key]);
}

/**
 * A figure with its caption: mono caps label, a big tabular number, a unit, a sub line, a
 * change and how fresh the data is. Every status is a word and a glyph as well as a colour.
 *
 *   <Stat label="Block height" value={1_284_913} freshness={{ source: meta.source, ageMs: meta.ageMs }} />
 *   <Stat label="Nodes" value={7_960} delta={{ value: 2.4, label: 'vs 24 h' }} as="dl" />
 */
export function Stat({
  label,
  value,
  unit,
  decimals = 0,
  grouping = true,
  prefix,
  suffix,
  animate = 'count',
  gradient = false,
  sub,
  delta,
  freshness,
  loading = false,
  size = 'md',
  tier,
  as = 'div',
  children,
  className,
}: StatProps) {
  const semantic = as !== 'div';
  const Root: ElementType = as === 'dl' ? 'dl' : 'div';
  const Term: ElementType = semantic ? 'dt' : 'div';
  const Def: ElementType = semantic ? 'dd' : 'div';
  const d = delta ? deltaParts(delta) : null;
  const figureEl = useRef<HTMLDivElement>(null);
  const probeEl = useRef<HTMLSpanElement>(null);
  const unitEl = useRef<HTMLSpanElement>(null);

  // The text the figure will read in the end, for fitting it to the row.
  const finalText =
    typeof value === 'number' && Number.isFinite(value)
      ? `${prefix ?? ''}${formatNumber(value, { decimals, grouping })}${suffix ?? ''}`
      : typeof value === 'string'
        ? value
        : null;
  useFit(figureEl, probeEl, unitEl, `${finalText ?? ''}|${unit ?? ''}|${loading}|${size}`);

  let figure: ReactNode;
  if (loading) {
    figure = (
      <span className={styles.loadingFigure}>
        <Skeleton shape="block" width="4.2em" height="0.7em" />
      </span>
    );
  } else if (
    value === null ||
    value === undefined ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    figure = (
      <span className={styles.none}>
        <span className="sr-only">No data</span>
        <span aria-hidden="true">{PLACEHOLDER}</span>
      </span>
    );
  } else if (typeof value === 'number') {
    if (animate === 'roll') {
      figure = (
        <Odometer
          value={value}
          decimals={decimals}
          grouping={grouping}
          prefix={prefix}
          suffix={suffix}
          gradient={gradient}
          from={value}
        />
      );
    } else if (animate === 'count') {
      figure = (
        <CountUp
          value={value}
          decimals={decimals}
          grouping={grouping}
          prefix={prefix}
          suffix={suffix}
          className={gradient ? 't-grad' : undefined}
        />
      );
    } else {
      figure = (
        <span className={cn('t-num', gradient && 't-grad')}>
          {prefix}
          {formatNumber(value, { decimals, grouping })}
          {suffix}
        </span>
      );
    }
  } else {
    figure = <span className={cn('t-num', gradient && 't-grad')}>{value}</span>;
  }

  return (
    <Root
      className={cn(styles.stat, className)}
      data-size={size}
      data-tier={tier}
      data-loading={loading ? 'true' : undefined}
      aria-busy={loading ? true : undefined}
    >
      <Term className={styles.label}>{label}</Term>
      {freshness ? (
        <Def className={styles.fresh}>
          <FreshnessChip {...freshness} />
        </Def>
      ) : null}
      <Def className={styles.figure} ref={figureEl}>
        <span className={styles.value}>
          {figure}
          {finalText !== null && !loading ? (
            <span ref={probeEl} className={styles.probe} aria-hidden="true">
              {finalText}
            </span>
          ) : null}
        </span>
        {unit && !loading ? (
          <span ref={unitEl} className={styles.unit}>
            {unit}
          </span>
        ) : null}
        {d && delta && !loading ? (
          <span
            className={styles.delta}
            data-dir={d.dir}
            data-good={d.verdict === undefined ? undefined : String(d.verdict)}
          >
            <span className="sr-only">
              {d.word} {d.text}
            </span>
            <span className={styles.arrow} aria-hidden="true" />
            <span aria-hidden="true">
              {d.sign}
              {d.text}
            </span>
            {delta.label ? <span className={styles.deltaLabel}>{delta.label}</span> : null}
          </span>
        ) : null}
      </Def>
      {sub ? <Def className={styles.sub}>{sub}</Def> : null}
      {children ? <Def className={styles.extra}>{children}</Def> : null}
    </Root>
  );
}
