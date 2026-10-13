import {
  type CSSProperties,
  type FocusEvent,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useInView } from '../hooks/useInView';
import { useIsoLayoutEffect } from '../hooks/useIsoLayoutEffect';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { IconButton } from '../IconButton/IconButton';
import { cn } from '../internal/cn';
import styles from './Marquee.module.css';

export interface MarqueeProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** The items of one run. They are laid out in a row; keep ids out of them (the run is repeated). */
  children: ReactNode;
  /** Speed in px per second. Default 48. */
  speed?: number;
  /** Which way the content travels. Default `left`. */
  direction?: 'left' | 'right';
  /** Space between items, in px (also between one run and the next). Default 32. */
  gap?: number;
  /** A visible pause / play control (WCAG 2.2.2). Default true; turn it off only where the page offers another. */
  control?: boolean;
  /** Pause while the pointer is over the track or focus is inside it. Default true. */
  pauseOnHover?: boolean;
  /** Fade the left and right edges. Default true. */
  fade?: boolean;
  /** The accessible name of the region. Default "Scrolling content". */
  label?: string;
}

const MAX_COPIES = 12;

/**
 * An endless row. One run of content is measured and repeated just enough to cover the
 * viewport; a compositor `translate` moves the track by exactly one run per loop, so it
 * costs the main thread nothing. It pauses on hover and focus, with the document hidden and
 * off-screen, and with its visible control. Reduced motion gets the content as a static,
 * wrapped row (no repeats, no control).
 *
 *   <Marquee speed={40} label="Partners"><Logo .../><Logo .../></Marquee>
 */
export function Marquee({
  children,
  speed = 48,
  direction = 'left',
  gap = 32,
  control = true,
  pauseOnHover = true,
  fade = true,
  label = 'Scrolling content',
  className,
  style,
  ...rest
}: MarqueeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  const [copies, setCopies] = useState(2);
  const [userPaused, setUserPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const reduced = useReducedMotion();
  const inView = useInView(rootRef);

  useIsoLayoutEffect(() => {
    const viewport = viewportRef.current;
    const runEl = runRef.current;
    if (!viewport || !runEl) return;
    const measure = () => {
      const w = runEl.getBoundingClientRect().width;
      if (w < 1) return;
      const next = Math.round(w * 100) / 100;
      setRun((r) => (Math.abs(r - next) < 0.01 ? r : next));
      const n = Math.min(MAX_COPIES, Math.max(2, Math.ceil(viewport.clientWidth / w) + 1));
      setCopies((c) => (c === n ? c : n));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    ro.observe(runEl);
    return () => ro.disconnect();
  }, [gap, reduced]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // A focused item must never sit hidden off the edge: bring it to the left margin.
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    const runEl = runRef.current;
    if (reduced || !track || !viewport || !runEl || run <= 0) return;
    const target = e.target as HTMLElement;
    if (!runEl.contains(target)) return;
    const v = viewport.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    if (t.left >= v.left + 4 && t.right <= v.right - 4) return;
    const anim = track.getAnimations()[0];
    const dur = Number(anim?.effect?.getComputedTiming().duration);
    if (!anim || !Number.isFinite(dur)) return;
    const itemLeft = t.left - runEl.getBoundingClientRect().left;
    const p = Math.min(0.999, Math.max(0, itemLeft - 8) / run);
    anim.currentTime = (direction === 'right' ? 1 - p : p) * dur;
  };

  const moving = run > 0 && speed > 0 && !reduced;
  const vars = {
    '--gap': `${gap}px`,
    ...style,
  } as CSSProperties;
  const trackVars = {
    '--run': `${run}px`,
    '--dur': `${(run / Math.max(speed, 1)).toFixed(2)}s`,
  } as CSSProperties;

  return (
    // biome-ignore lint/a11y/useSemanticElements: a named group of arbitrary content, not form controls
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="marquee"
      aria-label={label}
      className={cn(styles.marquee, className)}
      data-direction={direction}
      data-paused={userPaused ? 'true' : undefined}
      data-hover-pause={pauseOnHover ? 'true' : undefined}
      data-fade={fade ? 'true' : undefined}
      data-live={moving && inView && !tabHidden ? 'true' : 'false'}
      style={vars}
      {...rest}
    >
      <div ref={viewportRef} className={styles.viewport} onFocusCapture={onFocus}>
        <div
          ref={trackRef}
          className={styles.track}
          data-moving={moving ? 'true' : undefined}
          style={trackVars}
        >
          <div ref={runRef} className={styles.run}>
            {children}
          </div>
          {reduced
            ? null
            : Array.from({ length: copies - 1 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: identical, inert repeats
                <div key={i} className={cn(styles.run, styles.copy)} aria-hidden="true" inert>
                  {children}
                </div>
              ))}
        </div>
      </div>
      {control && !reduced ? (
        <IconButton
          icon={userPaused ? 'play' : 'pause'}
          label={userPaused ? 'Resume scrolling' : 'Pause scrolling'}
          size="sm"
          className={styles.control}
          onClick={() => setUserPaused((p) => !p)}
        />
      ) : null}
    </div>
  );
}
