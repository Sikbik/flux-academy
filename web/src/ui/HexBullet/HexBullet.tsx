import type { CSSProperties } from 'react';
import { cn } from '../internal/cn';
import styles from './HexBullet.module.css';

export interface HexBulletProps {
  /** Width in px (the height follows: a regular pointy-top hexagon). Default 9. */
  size?: number;
  /** A solid hexagon (default) or an outline. */
  filled?: boolean;
  /** A slow ring for live things only. */
  pulse?: boolean;
  /** `accent` (default, follows the accent switch), `hot` (white-hot), `muted`, or a status. */
  tone?: 'accent' | 'hot' | 'muted' | 'ok' | 'warn' | 'crit';
  className?: string;
}

/**
 * A hexagonal bullet: list marker, eyebrow marker (`03 / DEPLOY`), separator. Decorative: it
 * is hidden from assistive tech, so the words next to it must carry the meaning.
 *
 *   <HexBullet /> Cumulus
 *   <HexBullet filled={false} tone="muted" size={7} />
 */
export function HexBullet({
  size = 9,
  filled = true,
  pulse = false,
  tone = 'accent',
  className,
}: HexBulletProps) {
  return (
    <span
      className={cn(styles.hb, className)}
      data-filled={filled ? 'true' : 'false'}
      data-pulse={pulse ? 'true' : undefined}
      data-tone={tone}
      style={{ '--hb': `${size}px` } as CSSProperties}
      aria-hidden="true"
    />
  );
}
