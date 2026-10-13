import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { cn } from '../internal/cn';
import { hexPoints, hexSegments } from '../internal/hex';
import { clamp01 } from '../internal/math';
import styles from './HexRing.module.css';

export interface HexRingProps {
  /** 0..1, how full the ring is. */
  value: number;
  /** Cells around the ring. Multiples of 6 put the gaps on the vertices. Default 12. */
  segments?: number;
  /** The square box in px; the hexagon is inscribed. Default 96. */
  size?: number;
  /** Stroke width in px. Default 5. */
  stroke?: number;
  /** Tier colour. Without it the ring wears the page accent. */
  tier?: 'cumulus' | 'nimbus' | 'stratus';
  /** Dim the ring (another tier is hovered). */
  dim?: boolean;
  /**
   * Accessible description, for example "Cumulus: 58 percent of nodes". With it the ring is a
   * `meter`; without it the ring is decorative and only the children are read.
   */
  label?: string;
  /** Fill in from empty on mount and stagger changes. Default true (never under reduced motion). */
  animate?: boolean;
  /** The six registration ticks at the vertices. Default true. */
  ticks?: boolean;
  /** Centre content: a number, a glyph, a label. */
  children?: ReactNode;
  className?: string;
}

const VIEW = 100;
const R = 43.5;

/**
 * A hexagonal segmented gauge. Segments fill clockwise from the top, staggered; the head
 * segment burns white-hot (the reference's hex ring), the one behind it is a step brighter.
 *
 *   <HexRing value={0.58} tier="cumulus" label="Cumulus: 58 percent of nodes">
 *     <b>5,812</b>
 *   </HexRing>
 */
export function HexRing({
  value,
  segments = 12,
  size = 96,
  stroke = 5,
  tier,
  dim = false,
  label,
  animate = true,
  ticks = true,
  children,
  className,
}: HexRingProps) {
  const reduced = useReducedMotion();
  const n = Math.max(3, Math.round(segments));
  const v = clamp01(Number.isFinite(value) ? value : 0);

  // Arm after the first frame so the segments transition from empty on mount.
  const intro = animate && !reduced;
  const [armed, setArmed] = useState(!intro);
  useEffect(() => {
    if (!intro) {
      setArmed(true);
      return;
    }
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, [intro]);

  // The stagger runs from the first segment when filling, from the last when emptying.
  const prev = useRef(v);
  const rising = v >= prev.current;
  useEffect(() => {
    prev.current = v;
  }, [v]);

  const shown = armed ? v : 0;
  const paths = useMemo(() => hexSegments(VIEW / 2, VIEW / 2, R, n, Math.min(0.016, 0.4 / n)), [n]);
  const vertexTicks = useMemo(() => {
    const inner = hexPoints(VIEW / 2, VIEW / 2, R + 3.5);
    const outer = hexPoints(VIEW / 2, VIEW / 2, R + 6.2);
    return inner.map(([x1, y1], i) => {
      const [x2, y2] = outer[i] as readonly [number, number];
      return `M${x1} ${y1}L${x2} ${y2}`;
    });
  }, []);

  const head = shown <= 0 ? -1 : Math.min(n - 1, Math.ceil(shown * n - 1e-9) - 1);
  const filledPct = Math.round(v * 100);

  const aria = label
    ? {
        role: 'meter' as const,
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': filledPct,
      }
    : {};

  return (
    <div
      className={cn(styles.ring, className)}
      data-tier={tier}
      data-dim={dim ? 'true' : undefined}
      data-intro={intro ? 'true' : undefined}
      style={
        {
          '--ring-size': `${size}px`,
          '--ring-stroke': `${((stroke * VIEW) / size).toFixed(3)}px`,
        } as CSSProperties
      }
      {...aria}
    >
      <svg className={styles.svg} viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true" focusable="false">
        {ticks ? (
          <g className={styles.ticks}>
            {vertexTicks.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        ) : null}
        <g className={styles.tracks}>
          {paths.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: segments are a fixed ordered set
            <path key={i} d={d} />
          ))}
        </g>
        <g className={styles.fills}>
          {paths.map((d, i) => {
            const f = clamp01(shown * n - i);
            return (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: segments are a fixed ordered set
                key={i}
                d={d}
                pathLength={1}
                strokeDasharray={`${f.toFixed(4)} 1.0001`}
                data-head={i === head ? 'true' : undefined}
                data-near={i === head - 1 ? 'true' : undefined}
                style={{ '--k': rising ? i : n - 1 - i } as CSSProperties}
              />
            );
          })}
        </g>
      </svg>
      {children != null ? <div className={styles.center}>{children}</div> : null}
    </div>
  );
}
