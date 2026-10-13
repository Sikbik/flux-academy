import { useBeatCount } from '@/app/beat';
import { describeStatus, useChainClock, useConnection, useDataAge, useNetwork } from '@/data';
import { formatInt, NONE } from '@/lib/format';
import { StatusDot } from '@/ui';
import styles from './Ambient.module.css';

/**
 * Block height, the countdown and the connection: the quiet instrument under the clock. Each REAL block
 * lights a bloom behind the number (the Beat). No block, no flare: offline has no simulated beat.
 */
export function Chain() {
  const clock = useChainClock();
  const connection = useConnection();
  const network = useNetwork();
  const age = useDataAge('network');
  const beat = useBeatCount();

  const offline = connection === 'offline';
  const chip = describeStatus(network.status, { meta: network.meta, ageMs: age, connection });
  const dot =
    connection === 'live' || connection === 'polling'
      ? 'ok'
      : connection === 'connecting'
        ? 'pending'
        : 'crit';
  const word =
    connection === 'live'
      ? 'Live'
      : connection === 'polling'
        ? 'Live'
        : connection === 'connecting'
          ? 'Connecting'
          : 'Offline';
  const note = connection === 'polling' ? 'polling' : offline ? chip.sentence : '';

  const height = clock.height;
  const next =
    clock.live && clock.nextBlockInMs !== null
      ? clock.nextBlockInMs > 0
        ? `next block in ${Math.ceil(clock.nextBlockInMs / 1000)} s`
        : 'next block due'
      : null;

  return (
    <>
      <p className={styles.chain} data-beat={beat === 0 || offline ? undefined : beat % 2 === 1 ? 'a' : 'b'}>
        <span className={styles.flare} aria-hidden="true" />
        <span className={styles.sweep} aria-hidden="true" />
        {height === null ? (
          <span>Syncing with the chain</span>
        ) : (
          <>
            <span className={styles.chainLabel}>Block</span>
            <span className={styles.height}>{formatInt(height) || NONE}</span>
            {next ? <span>{next}</span> : offline ? <span>last known</span> : null}
          </>
        )}
      </p>
      <p className={styles.conn}>
        <StatusDot status={dot} pulse={connection === 'live'} size={9} />
        <span>{word}</span>
        {note ? <span className={styles.connNote}>{note}</span> : null}
      </p>
    </>
  );
}
