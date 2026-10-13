/**
 * The durations the Failover Lab quotes, in one place. The real ones come from `@shared/flux/timing` and
 * the simulated ones from the diorama's rules, so no sentence types "125" or "20" by hand and a change to
 * either side shows up in every caption.
 */

import { ORBIT_FACTS } from '@shared/flux/orbit';
import {
  FDM_EJECT_SEC,
  FDM_FAILOVER,
  FDM_TIMING,
  G_ELECTION_EVERY_SEC,
  G_STANDBY_WAIT_MIN_PER_POSITION,
  replacementWaitMin,
  SYNCED_RESPAWN_EXTRA_MIN,
} from '@shared/flux/timing';
import { DEFAULT_RULES } from '@/diorama/sim';

/**
 * The date of the one dated sample the lab quotes: on this day every single-instance app that was not a
 * blocklisted Orbit deployment had a running copy (FACTS 15.3.3). A snapshot, not a failure rate.
 */
export const SAMPLE_DATE = ORBIT_FACTS.oneInstanceNonOrbit.readOn;

/** A replacement copy can start to install this many minutes after a node dies (the record's lifetime). */
export const REPLACEMENT_MIN = replacementWaitMin(false);
/** Up to this many more minutes for a synced volume whose peers look unreachable. */
export const REPLACEMENT_EXTRA_MIN = SYNCED_RESPAWN_EXTRA_MIN;
/** The simulated replacement wait, in seconds. */
export const SIM_REPLACEMENT_SEC = Math.round(DEFAULT_RULES.respawn.delayMs / 1000);
/** The simulated wait of a request that reaches a dead node, in seconds, with one decimal. */
export const SIM_REDISPATCH_SEC = Math.round(DEFAULT_RULES.routing.redispatchAfterMs / 100) / 10;

export { FDM_EJECT_SEC, FDM_FAILOVER, FDM_TIMING, G_ELECTION_EVERY_SEC, G_STANDBY_WAIT_MIN_PER_POSITION };

const NUMBER_WORD = ['no', 'one', 'two', 'three', 'four', 'five'];
const wordOf = (n: number): string => NUMBER_WORD[n] ?? String(n);
/** "two": failed checks before the load balancer stops sending traffic. */
export const EJECT_CHECKS_WORD = wordOf(FDM_TIMING.ejectAfterFailures);
/** "two": passing checks before it sends traffic again. */
export const RESTORE_CHECKS_WORD = wordOf(FDM_TIMING.restoreAfterSuccesses);
/** "about 6 s": how long the load balancer takes to drop a dead instance or take a recovered one back. */
export const EJECT_SEC = FDM_EJECT_SEC;
export const RESTORE_SEC = FDM_TIMING.healthIntervalSec * FDM_TIMING.restoreAfterSuccesses;

/** "Replacing an instance can take about two hours there": the sentence both the log and the lab use. */
export const REPLACEMENT_SENTENCE = `On the network a replacement can take about two hours (${REPLACEMENT_MIN} minutes, plus the image pull).`;
