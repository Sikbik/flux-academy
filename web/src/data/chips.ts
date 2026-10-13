/**
 * How a data status is worded on a chip. One place, so every live number in the app says the same
 * thing in the same words (docs/DESIGN.md section 8, copy rules in section 12).
 *
 * Pure: pass the status, the age and the connection in, get the label out.
 */

import type { Meta } from '@shared/api';
import { formatAge, formatDateShort } from '@/lib/format';
import type { ConnectionState, DataStatus } from './types';

export type StatusTone = 'ok' | 'warn' | 'crit' | 'off' | 'info';

export interface StatusChip {
  /** The chip word, upper case: LIVE, CACHED, OFFLINE, FALLBACK, SYNCING. */
  label: string;
  /** `ok` live, `warn` cached, `off` offline or fallback, `info` loading. Never colour alone: use `label`. */
  tone: StatusTone;
  /** A short second line: "3 s old", "as of Oct 12". Empty when there is nothing to add. */
  detail: string;
  /** One sentence for screen readers and tooltips. */
  sentence: string;
}

export interface DescribeOptions {
  /** The record's `meta`, for the "as of" date of a fallback. */
  meta?: Meta | null;
  /** Age of the data in ms (from `useDataAge`), when it is shown. */
  ageMs?: number | null;
  connection?: ConnectionState;
}

export function describeStatus(status: DataStatus, opts: DescribeOptions = {}): StatusChip {
  const asOf = opts.meta?.asOf ? formatDateShort(opts.meta.asOf, '') : '';
  const age = opts.ageMs !== undefined && opts.ageMs !== null ? formatAge(opts.ageMs) : '';
  switch (status) {
    case 'live': {
      const polling = opts.connection === 'polling';
      return {
        label: 'LIVE',
        tone: 'ok',
        detail: polling ? 'polling' : age && age !== 'now' ? `${age} old` : '',
        sentence: polling ? 'Live data, refreshed by polling.' : 'Live data from the Flux network.',
      };
    }
    case 'cache':
      return {
        label: 'CACHED',
        tone: 'warn',
        detail: age ? `${age} old` : '',
        sentence: age
          ? `Cached numbers, ${age} old. A refresh is on its way.`
          : 'Cached numbers. A refresh is on its way.',
      };
    case 'offline':
      return {
        label: 'OFFLINE',
        tone: 'off',
        detail: age ? `${age} old` : asOf ? `as of ${asOf}` : '',
        sentence: 'Showing the last known numbers.',
      };
    case 'fallback': {
      const offline = opts.connection === 'offline' || opts.connection === 'connecting';
      return {
        label: offline ? 'OFFLINE' : 'FALLBACK',
        tone: 'off',
        detail: asOf ? `as of ${asOf}` : '',
        sentence: asOf
          ? `Showing the built-in sample, as of ${asOf}. It is not live.`
          : 'Showing the built-in sample. It is not live.',
      };
    }
    default:
      return { label: 'SYNCING', tone: 'info', detail: '', sentence: 'Syncing with the chain.' };
  }
}

/** The design system's `FreshnessChip` kinds that a data status can map to. */
export type FreshnessChipKind = 'live' | 'cached' | 'offline' | 'syncing';

/**
 * Maps a data status to a `FreshnessChip` kind: `<FreshnessChip kind={freshnessKind(status)} ageMs={age} />`.
 * A fallback and an offline record both read OFFLINE (the numbers are the last known ones).
 */
export function freshnessKind(status: DataStatus): FreshnessChipKind {
  switch (status) {
    case 'live':
      return 'live';
    case 'cache':
      return 'cached';
    case 'offline':
    case 'fallback':
      return 'offline';
    default:
      return 'syncing';
  }
}
