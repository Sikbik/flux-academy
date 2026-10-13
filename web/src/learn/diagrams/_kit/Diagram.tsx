/**
 * The diagram root: measures the width it is given, lays the figure out in real pixels, owns the svg
 * (`role="img"` with a title and a desc), and turns the beat into element states.
 *
 * A diagram is `meta` plus a component that renders `<DiagramRoot>` with a render function. The
 * render function receives `{ W, H, narrow, beat, st, uid }`:
 *
 *   st(at, focus?, until?)  the state ('off' | 'on' | 'focus') of something that first appears at `at`
 *   beat                    the real beat, for choosing text and positions
 *   uid(name)               a document-unique id for gradients and clip paths
 *
 * Why pixels: a viewBox that equals the drawn width keeps hairlines at one real pixel and text at its
 * nominal size at every width, so layout is a function of `W` and nothing is ever shrunk to unreadable.
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { DiagramMeta } from '@/learn/stage-api';
import styles from './kit.module.css';
import { clampBeat, makeSt, type StFn } from './state';

const useIsoLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

/** Width used before the first measurement, and on the server (tests). */
export const FALLBACK_WIDTH = 640;
/** Below this width a diagram uses its stacked, phone layout. */
export const NARROW_MAX = 480;
/** Smallest width a layout is asked to handle (a 320 px phone minus the page gutters). */
export const MIN_WIDTH = 288;

export interface DiagramCtx {
  /** Drawing width in px (also the viewBox width). */
  W: number;
  /** Drawing height in px. */
  H: number;
  /** True for the phone layout. */
  narrow: boolean;
  /** The real, clamped beat. */
  beat: number;
  /** State of an element that first appears at `at`. */
  st: StFn;
  /** Unique id helper. */
  uid: (name: string) => string;
}

const Ctx = createContext<DiagramCtx | null>(null);

/**
 * Pins the width a diagram is laid out at, instead of measuring it. For tests (server rendering has no
 * layout to measure) and for the lab.
 */
export const WidthOverride = createContext<number | null>(null);

/** Read the diagram context from a custom part component. */
export function useDiagram(): DiagramCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDiagram must be used inside a DiagramRoot');
  return c;
}

function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The layout width, not the painted one: a figure that is scaled down to fit its frame (a CSS
    // transform) must still be laid out at the width it is given, or it would switch layouts as it shrinks.
    const read = () => {
      const cw = el.offsetWidth;
      if (cw > 0) setW((p) => (p === cw ? p : cw));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export interface DiagramRootProps {
  meta: DiagramMeta;
  beat: number;
  reducedMotion: boolean;
  /** Figure height for a width. Must be a pure function of its arguments. */
  height: (W: number, narrow: boolean) => number;
  children: (ctx: DiagramCtx) => ReactNode;
  /** Forwarded to the root element: lets a host pin an accent or a tier on the whole figure. */
  tier?: 'cumulus' | 'nimbus' | 'stratus';
}

export function DiagramRoot({ meta, beat, reducedMotion, height, children, tier }: DiagramRootProps) {
  const ref = useRef<HTMLDivElement>(null);
  const measured = useWidth(ref);
  const forced = useContext(WidthOverride);
  const W = Math.max(MIN_WIDTH, forced ?? (measured || FALLBACK_WIDTH));
  const narrow = W < NARROW_MAX;
  const H = Math.round(height(W, narrow));
  const real = clampBeat(beat, meta.beats.length);
  const id = useId().replace(/:/g, '');

  // Arm after the first paint so the figure draws itself in when it enters. Reduced motion skips it.
  const [armed, setArmed] = useState(reducedMotion);
  useEffect(() => {
    if (armed) return;
    const raf = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(raf);
  }, [armed]);
  const eff = armed || reducedMotion ? real : -1;

  const ctx: DiagramCtx = {
    W,
    H,
    narrow,
    beat: real,
    st: makeSt(eff),
    uid: (name) => `${id}-${name}`,
  };

  return (
    <div
      ref={ref}
      className={styles.root}
      data-reduced={reducedMotion ? 'true' : 'false'}
      data-diagram={meta.id}
      data-tier={tier}
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${id}-t`}
        aria-describedby={`${id}-d`}
        data-beat={real}
        data-w={W}
        data-h={H}
        focusable="false"
      >
        <title id={`${id}-t`}>{meta.title}</title>
        <desc id={`${id}-d`}>{meta.alt}</desc>
        <Ctx.Provider value={ctx}>{children(ctx)}</Ctx.Provider>
      </svg>
    </div>
  );
}
