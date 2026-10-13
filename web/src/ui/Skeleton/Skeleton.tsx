import type { CSSProperties } from 'react';
import { cn } from '../internal/cn';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /**
   * `line` (text, one or more lines), `block` (a chamfered slab), `circle`, `hex` (an avatar
   * or medal) or `stat` (a label, a big number and a sub line, as in Stat).
   */
  shape?: 'line' | 'block' | 'circle' | 'hex' | 'stat';
  /** px or any CSS length. Defaults depend on the shape; lines fill the container. */
  width?: number | string;
  height?: number | string;
  /** `line`: how many lines. The last one is shorter. Default 1. */
  lines?: number;
  /**
   * When set, the skeleton announces itself: a `role="status"` region with this text for
   * assistive tech. Without it the skeleton is decorative (`aria-hidden`): mark the
   * container `aria-busy="true"` instead and say what is loading once, nearby.
   */
  label?: string;
  className?: string;
}

const px = (v: number | string | undefined): string | undefined =>
  v === undefined ? undefined : typeof v === 'number' ? `${v}px` : v;

/**
 * A placeholder shaped like the content it stands in for, so nothing jumps when the data
 * lands. The shimmer is a transform-only sweep; under reduced motion it is a static dim fill.
 *
 *   <Skeleton shape="stat" />
 *   <Skeleton shape="line" lines={3} />
 *   <Skeleton shape="block" height={160} label="Loading the lesson" />
 */
export function Skeleton({ shape = 'line', width, height, lines = 1, label, className }: SkeletonProps) {
  const style = { '--sk-w': px(width), '--sk-h': px(height) } as CSSProperties;
  let body: React.ReactNode;

  if (shape === 'line') {
    const n = Math.max(1, Math.floor(lines));
    body = (
      <span className={cn(styles.lines, className)} style={style} data-shape="line">
        {Array.from({ length: n }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed ordered set of lines
            key={i}
            className={styles.sk}
            data-last={n > 1 && i === n - 1 ? 'true' : undefined}
            style={{ '--i': i } as CSSProperties}
          />
        ))}
      </span>
    );
  } else if (shape === 'stat') {
    body = (
      <span className={cn(styles.stat, className)} style={style} data-shape="stat">
        <span className={styles.sk} data-part="label" />
        <span className={styles.sk} data-part="value" style={{ '--i': 1 } as CSSProperties} />
        <span className={styles.sk} data-part="sub" style={{ '--i': 2 } as CSSProperties} />
      </span>
    );
  } else {
    body = <span className={cn(styles.sk, styles.solo, className)} style={style} data-shape={shape} />;
  }

  if (label) {
    return (
      <span role="status" className={styles.wrap}>
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className={styles.wrap}>
          {body}
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={styles.wrap}>
      {body}
    </span>
  );
}
