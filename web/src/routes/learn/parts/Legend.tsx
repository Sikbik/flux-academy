import { hexPath } from '@/lib/hex';
import styles from './Legend.module.css';

const HEX = hexPath(0, 0, 8.5);
const HEX_RING = hexPath(0, 0, 11);

/**
 * The map's key. Each state is a shape as well as a light: an outline, a partial ring, a filled hex with a
 * tick, a white rim. None of them depends on colour.
 */
export function Legend() {
  return (
    <ul className={styles.legend} aria-label="Key to the map">
      <li>
        <svg viewBox="-13 -13 26 26" width="22" height="22" aria-hidden="true" focusable="false">
          <path d={HEX} className={styles.idle} />
        </svg>
        Not started
      </li>
      <li>
        <svg viewBox="-13 -13 26 26" width="22" height="22" aria-hidden="true" focusable="false">
          <path d={HEX_RING} className={styles.track} />
          <path d={HEX_RING} className={styles.arc} pathLength={1} strokeDasharray="0.5 1.01" />
          <path d={HEX} className={styles.started} />
        </svg>
        In progress
      </li>
      <li>
        <svg viewBox="-13 -13 26 26" width="22" height="22" aria-hidden="true" focusable="false">
          <path d={HEX} className={styles.done} />
        </svg>
        Done
      </li>
      <li>
        <svg viewBox="-13 -13 26 26" width="22" height="22" aria-hidden="true" focusable="false">
          <path d={HEX_RING} className={styles.next} />
          <path d={HEX} className={styles.idle} />
        </svg>
        Next
      </li>
      <li>
        <svg viewBox="0 -4 26 8" width="26" height="8" aria-hidden="true" focusable="false">
          <path d="M0 0H26" className={styles.line} />
        </svg>
        Helps before
      </li>
    </ul>
  );
}
