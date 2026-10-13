import { Chip } from '../Chip/Chip';
import { cn } from '../internal/cn';
import { type Status, StatusDot } from '../StatusDot/StatusDot';
import { formatAge } from './age';
import styles from './FreshnessChip.module.css';

/**
 * How far to trust a number. The first four are about data; the last three are the basis of
 * a price (`OFFICIAL` confirmed by Flux's calculator, `COMPUTED` by the local formula,
 * `BAKED` from the built-in rates).
 */
export type FreshnessKind =
  | 'live'
  | 'cached'
  | 'offline'
  | 'simulation'
  | 'syncing'
  | 'official'
  | 'computed'
  | 'baked';

export interface FreshnessChipProps {
  kind?: FreshnessKind;
  /**
   * Or pass the API's `meta.source` (`live | cache | fallback`) and it is mapped for you:
   * live to LIVE, cache to CACHED, fallback to OFFLINE with "last known".
   */
  source?: 'live' | 'cache' | 'fallback';
  /** Milliseconds since the data was fetched upstream (meta.ageMs). */
  ageMs?: number | null;
  /** A LIVE chip whose stream failed but polling works. */
  polling?: boolean;
  /** Hide the age text. */
  hideAge?: boolean;
  className?: string;
}

const MAP: Record<
  FreshnessKind,
  { word: string; status: Status; pulse?: boolean; age?: boolean; hint?: string }
> = {
  live: { word: 'Live', status: 'ok', pulse: true, age: true },
  cached: { word: 'Cached', status: 'warn', age: true },
  offline: { word: 'Offline', status: 'crit', hint: 'last known' },
  simulation: { word: 'Simulation', status: 'pending' },
  syncing: { word: 'Syncing', status: 'pending', pulse: true },
  official: { word: 'Official', status: 'ok' },
  computed: { word: 'Computed', status: 'pending' },
  baked: { word: 'Baked', status: 'off' },
};

const FROM_SOURCE = { live: 'live', cache: 'cached', fallback: 'offline' } as const;

/**
 * The honesty mechanism: `LIVE 3 s`, `CACHED 2 min`, `OFFLINE last known`, `SIMULATION`.
 * The word is always there, so colour is never the only signal. Put one next to every figure
 * that comes from the network.
 *
 *   <FreshnessChip source={meta.source} ageMs={meta.ageMs} />
 *   <FreshnessChip kind="simulation" />
 */
export function FreshnessChip({
  kind,
  source,
  ageMs,
  polling = false,
  hideAge = false,
  className,
}: FreshnessChipProps) {
  const k: FreshnessKind = kind ?? (source ? FROM_SOURCE[source] : 'syncing');
  const spec = MAP[k];
  const age = spec.age && !hideAge ? formatAge(ageMs) : '';
  const hint = k === 'live' && polling ? 'polling' : spec.hint;
  return (
    <Chip kind="status" status={spec.status} size="sm" className={cn(styles.fresh, className)} data-kind={k}>
      <span className={styles.parts}>
        <StatusDot status={spec.status} pulse={spec.pulse} size={7} />
        <span>{spec.word}</span>
        {age ? <span className={styles.age}>{age}</span> : null}
        {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>
    </Chip>
  );
}
