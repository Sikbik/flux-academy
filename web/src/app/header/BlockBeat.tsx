import { Link } from 'react-router';
import { useChainClock, useNetwork } from '@/data';
import { describeStatus } from '@/data/chips';
import { formatDuration } from '@/lib/format';
import { hexPath } from '@/lib/hex';
import { Odometer } from '@/ui';
import { useBeatCount } from '../beat';
import styles from './Header.module.css';

const RING = hexPath(11, 11, 9);

/**
 * The block beat chip: a hex ring that fills toward the next block, the tip height in an odometer, and
 * a freshness word. It is a link to the Network Lab. It never counts down unless the chain clock is
 * anchored to real blocks (offline shows the last known height, dimmed, with no ring progress), and its
 * numbers are `aria-live="off"`: a counter that changes every 30 s must not chatter at a screen reader.
 */
export function BlockBeat({ onNavigate }: { onNavigate?: () => void }) {
  const clock = useChainClock();
  const network = useNetwork();
  const beat = useBeatCount();

  const live = clock.live;
  const chip = clock.simulated
    ? {
        label: 'SIM',
        tone: 'info' as const,
        detail: 'development only',
        sentence: 'Simulated blocks. Development only.',
      }
    : describeStatus(live ? 'live' : network.status, {
        meta: network.meta,
        connection: clock.connection,
      });
  const word = live ? chip.label : chip.label;
  const progress =
    live && clock.nextBlockInMs !== null
      ? Math.min(1, Math.max(0, 1 - clock.nextBlockInMs / clock.intervalMs))
      : 0;
  const nextSec = clock.nextBlockInMs !== null ? Math.ceil(clock.nextBlockInMs / 1000) : null;
  const title =
    live && nextSec !== null
      ? `Block ${clock.height ?? '--'}. ${chip.sentence} Next block in about ${formatDuration(nextSec, 2)}.`
      : `${chip.sentence}${chip.detail ? ` (${chip.detail})` : ''}`;
  const tone =
    chip.tone === 'ok' ? 'ok' : chip.tone === 'warn' ? 'warn' : chip.tone === 'info' ? 'pending' : 'off';

  return (
    <Link
      to="/labs/network"
      className={`${styles.chip} ${styles.beat}`}
      data-live={live ? 'true' : 'false'}
      title={title}
      aria-label={`Block ${clock.height ?? 'unknown'}, ${chip.sentence} Open the Network Lab.`}
      onClick={onNavigate}
    >
      <span className={styles.beatRing} aria-hidden="true">
        <svg viewBox="0 0 22 22" fill="none" strokeWidth="1.6" role="presentation" aria-hidden="true">
          <path d={RING} className={styles.ringTrack} />
          <path
            d={RING}
            className={styles.ringFill}
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - progress * 100}
          />
        </svg>
        {beat > 0 ? <span key={beat} className={styles.flare} /> : null}
      </span>
      <span className={styles.height} aria-live="off" data-num>
        {clock.height === null ? (
          <>
            <span aria-hidden="true">--</span>
            <span className="sr-only">unknown</span>
          </>
        ) : (
          // The chip has its own flare on every block, so the odometer's light wash would double it.
          <Odometer value={clock.height} flash={false} />
        )}
      </span>
      <span className={styles.status} data-tone={tone} data-status={tone} aria-hidden="true">
        <span className={styles.dot} />
        <span>{word}</span>
      </span>
    </Link>
  );
}
