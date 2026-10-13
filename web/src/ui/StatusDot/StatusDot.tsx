import { cn } from '../internal/cn';
import styles from './StatusDot.module.css';

export type Status = 'ok' | 'pending' | 'warn' | 'crit' | 'off';

export interface StatusDotProps {
  status: Status;
  /** A slow ring for live things only. Never for a static state. */
  pulse?: boolean;
  /** Size in px. Default 9. */
  size?: number;
  className?: string;
}

/**
 * A hexagonal status marker. It is decorative: always put the word next to it (colour is
 * never the only carrier of status).
 *
 *   <StatusDot status="ok" pulse /> Live
 */
export function StatusDot({ status, pulse = false, size = 9, className }: StatusDotProps) {
  return (
    <span
      className={cn(styles.dot, className)}
      data-status={status}
      data-pulse={pulse ? 'true' : undefined}
      style={{ '--dot': `${size}px` } as React.CSSProperties}
      aria-hidden="true"
    />
  );
}
