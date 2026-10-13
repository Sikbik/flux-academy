import { useLayoutEffect, useRef } from 'react';
import { useInView } from '../hooks/useInView';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { cn } from '../internal/cn';
import { formatNumber, restRow, rollDirection, STRIP_ROWS, targetRow, toCells } from './format';
import styles from './Odometer.module.css';

export interface OdometerProps {
  value: number;
  /** Fixed decimals. Default 0. */
  decimals?: number;
  /** Thousands separators. Default true. */
  grouping?: boolean;
  /** Pad the integer part to at least this many digits with zeros (clocks: 2). Default 1. */
  minDigits?: number;
  /** Text before and after the number (a currency sign, a unit). Not animated. */
  prefix?: string;
  suffix?: string;
  /** A soft light wash when the value changes. Default true. */
  flash?: boolean;
  /** Roll duration in ms. Default 520 (the --dur-tick token). */
  duration?: number;
  /**
   * Roll in from this value the first time the number is scrolled into view, so a figure
   * "counts up the first time it appears" and then rolls on every change. Omit to start at
   * `value`.
   */
  from?: number;
  /** Pour the accent gradient across the digits (the hero count). The only text gradient. */
  gradient?: boolean;
  /** Overrides the text read by assistive tech (default: the formatted number). */
  label?: string;
  className?: string;
}

/** One strip of 30 digits (0..9 three times) in a single text node, one digit per line. */
const STRIP_TEXT = Array.from({ length: STRIP_ROWS }, (_, i) => String(i % 10)).join('\n');
/** The same 30 digits as separate one-line rows, for the gradient count (see `.row` in the stylesheet). */
const STRIP_DIGITS = Array.from({ length: STRIP_ROWS }, (_, i) => String(i % 10));
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const STAGGER_MS = 28;

/** The strip's current row, read from its computed transform so an interrupted roll continues from where it is. */
function currentRow(el: HTMLElement): number {
  const style = getComputedStyle(el);
  if (!style.transform || style.transform === 'none') return Number.NaN;
  const px = new DOMMatrixReadOnly(style.transform).m42;
  const fontSize = Number.parseFloat(style.fontSize) || 16;
  return -px / fontSize;
}

interface DigitProps {
  digit: number;
  /** +1 the number went up, -1 it went down. */
  dir: 1 | -1;
  /** Position from the right: the least significant digit settles first. */
  order: number;
  animate: boolean;
  duration: number;
  /** Paint the digits with the shared gradient: each row clips its own background to its own glyph. */
  gradient: boolean;
}

function Digit({ digit, dir, order, animate, duration, gradient }: DigitProps) {
  const strip = useRef<HTMLSpanElement>(null);
  const prev = useRef(digit);
  const running = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) return;
    const from = prev.current;
    prev.current = digit;
    if (from === digit) return;
    if (!animate) {
      running.current?.cancel();
      running.current = null;
      return;
    }
    const measured = running.current ? currentRow(el) : Number.NaN;
    const startRow = Number.isFinite(measured) ? measured : restRow(from);
    running.current?.cancel();
    const endRow = targetRow(startRow, digit, dir);
    const a = el.animate(
      [{ transform: `translateY(${-startRow}em)` }, { transform: `translateY(${-endRow}em)` }],
      { duration, delay: order * STAGGER_MS, easing: EASE, fill: 'backwards' },
    );
    running.current = a;
    a.onfinish = () => {
      if (running.current === a) running.current = null;
    };
  }, [digit, dir, order, animate, duration]);

  useLayoutEffect(
    () => () => {
      running.current?.cancel();
    },
    [],
  );

  return (
    <span className={styles.cell} data-piece="">
      <span ref={strip} className={styles.strip} style={{ transform: `translateY(${-restRow(digit)}em)` }}>
        {gradient
          ? STRIP_DIGITS.map((d, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of 30 rows
              <span key={i} className={styles.row}>
                {d}
              </span>
            ))
          : STRIP_TEXT}
      </span>
    </span>
  );
}

/**
 * A number whose digits roll like an odometer when it changes: up rolls up, down rolls down,
 * the least significant digit settles first, and a soft wash marks the change. Size it with
 * `font-size`; it measures in `em`. For live counters (block height, node count).
 *
 * The visual is hidden from assistive tech and a plain-text copy is provided with NO live
 * region: a number that changes every block never chatters. Under reduced motion it swaps
 * instantly.
 *
 *   <Odometer value={chain.height} className="t-stat" />
 *   <Odometer value={nodes} from={0} gradient />
 */
export function Odometer({
  value,
  decimals = 0,
  grouping = true,
  minDigits = 1,
  prefix,
  suffix,
  flash = true,
  duration = 520,
  from,
  gradient = false,
  label,
  className,
}: OdometerProps) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLSpanElement>(null);
  const visual = useRef<HTMLSpanElement>(null);
  const glow = useRef<HTMLSpanElement>(null);
  const seen = useInView(root, { once: true });

  // Rolling in: hold at `from` until the number is first seen, then become `value`.
  const holding = from !== undefined && !reduced && !seen;
  const shown = holding ? (from as number) : value;
  const text = formatNumber(shown, { decimals, grouping, minDigits });
  const spoken =
    label ?? `${prefix ?? ''}${formatNumber(value, { decimals, grouping, minDigits })}${suffix ?? ''}`;

  // Read during render, written after commit: pure under StrictMode's double render.
  const prevShown = useRef(shown);
  const dir = rollDirection(prevShown.current, shown);

  useLayoutEffect(() => {
    if (shown === prevShown.current) return;
    prevShown.current = shown;
    if (!flash || reduced) return;
    glow.current?.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 1100, easing: EASE });
  }, [shown, flash, reduced]);

  // Gradient across the whole number: each piece paints its own slice of one gradient.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `text` changes the pieces and their offsets
  useLayoutEffect(() => {
    const v = visual.current;
    if (!gradient || !v) return;
    const measure = () => {
      const box = v.getBoundingClientRect();
      v.style.setProperty('--odo-w', `${box.width}px`);
      for (const el of v.querySelectorAll<HTMLElement>('[data-piece]')) {
        el.style.setProperty('--ox', `${el.getBoundingClientRect().left - box.left}px`);
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(v);
    return () => ro.disconnect();
  }, [gradient, text]);

  const cells = toCells(text);
  return (
    <span
      ref={root}
      className={cn(styles.odo, className)}
      data-odometer=""
      data-gradient={gradient ? 'true' : undefined}
      aria-live="off"
    >
      <span className="sr-only">{spoken}</span>
      <span ref={glow} className={styles.glow} aria-hidden="true" />
      <span ref={visual} className={styles.visual} aria-hidden="true">
        {prefix ? (
          <span className={styles.affix} data-piece="">
            {prefix}
          </span>
        ) : null}
        <span className={styles.cells}>
          {cells.map((c) =>
            c.digit !== null ? (
              <Digit
                key={`d${c.fromRight}`}
                digit={c.digit}
                dir={dir}
                order={c.fromRight}
                animate={!reduced}
                duration={duration}
                gradient={gradient}
              />
            ) : (
              <span key={`s${c.fromRight}`} className={styles.sep} data-piece="">
                {c.ch}
              </span>
            ),
          )}
        </span>
        {suffix ? (
          <span className={styles.affix} data-piece="">
            {suffix}
          </span>
        ) : null}
      </span>
    </span>
  );
}
