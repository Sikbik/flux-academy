import { useEffect, useLayoutEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { cn } from '../internal/cn';
import { easeOutExpo } from '../internal/math';
import { observe } from '../internal/observer';
import { formatNumber } from '../Odometer/format';
import styles from './CountUp.module.css';

export interface CountUpProps {
  value: number;
  /** Fixed decimals. Default 0. */
  decimals?: number;
  /** Thousands separators. Default true. */
  grouping?: boolean;
  /** Pad the integer part to at least this many digits. */
  minDigits?: number;
  prefix?: string;
  suffix?: string;
  /** Where the first count starts. Default 0. */
  from?: number;
  /** Duration in ms. Default 700 (the --dur-4 token). */
  duration?: number;
  /** Start counting on mount instead of when it scrolls into view. */
  immediate?: boolean;
  className?: string;
}

/**
 * Counts up the first time it scrolls into view, then eases to any new value from wherever
 * it is. It writes straight to the DOM, so a count never re-renders React. Under reduced
 * motion it shows the final value at once. A plain-text copy of the final value is always
 * present for assistive tech, so the count itself is never read out.
 *
 *   <CountUp value={network.nodes.total} className="t-stat" />
 */
export function CountUp({
  value,
  decimals = 0,
  grouping = true,
  minDigits = 1,
  prefix = '',
  suffix = '',
  from = 0,
  duration = 700,
  immediate = false,
  className,
}: CountUpProps) {
  const reduced = useReducedMotion();
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef(from);
  const started = useRef(false);
  const raf = useRef(0);
  const latest = useRef({ value, decimals, grouping, minDigits, prefix, suffix, duration, reduced });
  latest.current = { value, decimals, grouping, minDigits, prefix, suffix, duration, reduced };

  const paint = (n: number) => {
    const o = latest.current;
    if (el.current) {
      el.current.textContent = `${o.prefix}${formatNumber(n, o)}${o.suffix}`;
    }
  };

  // First paint before the browser does, so there is no flash of an empty span.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once; the effect below owns later paints
  useLayoutEffect(() => {
    paint(reduced || immediate ? value : from);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `paint` reads through the latest ref
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const run = () => {
      cancelAnimationFrame(raf.current);
      const o = latest.current;
      const start = shown.current;
      const end = o.value;
      if (o.reduced || start === end) {
        shown.current = end;
        paint(end);
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / Math.max(1, o.duration));
        shown.current = start + (end - start) * easeOutExpo(t);
        paint(shown.current);
        if (t < 1) raf.current = requestAnimationFrame(step);
        else {
          shown.current = end;
          paint(end);
        }
      };
      raf.current = requestAnimationFrame(step);
    };

    if (reduced || started.current || immediate || typeof IntersectionObserver === 'undefined') {
      started.current = true;
      run();
      return () => cancelAnimationFrame(raf.current);
    }
    paint(shown.current);
    const stop = observe(node, (entry) => {
      if (!entry.isIntersecting) return;
      started.current = true;
      stop();
      run();
    });
    return () => {
      stop();
      cancelAnimationFrame(raf.current);
    };
  }, [value, reduced, immediate, from, decimals, grouping, minDigits, prefix, suffix]);

  const final = `${prefix}${formatNumber(value, { decimals, grouping, minDigits })}${suffix}`;
  return (
    <span className={cn(styles.count, className)}>
      <span className="sr-only">{final}</span>
      <span ref={el} aria-hidden="true" />
    </span>
  );
}
