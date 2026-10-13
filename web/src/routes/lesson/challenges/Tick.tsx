/** A hexagon that draws itself and then its check mark: the "right answer" beat. */

import styles from './challenges.module.css';

export function Tick({ size = 28, tone = 'ok' }: { size?: number; tone?: 'ok' | 'muted' }) {
  const color = tone === 'ok' ? 'var(--status-ok)' : 'var(--text-3)';
  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <path className={styles.tickHex} d="M14 2.5L24 8.25V19.75L14 25.5L4 19.75V8.25Z" />
      <path className={styles.tickCheck} d="M9 14.2L12.6 17.8L19.2 10.6" />
    </svg>
  );
}
