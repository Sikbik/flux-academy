/**
 * How a lesson stage counts the nodes a learner took offline. Pure and framework free, so the counting the
 * `diorama` stage adapter does is unit tested without a browser.
 *
 * A step's kill task counts DISTINCT nodes since the step began, whatever took them offline: one node at
 * a time (the "Take a node offline" control, a click on the map, the node list) or a whole continent at
 * once (the "Break region" control). A continent is reported once, after all of its nodes are counted.
 */
import type { SimEvent } from './sim/types';

export interface KillTally {
  /** Forgets every node (a step began). */
  reset(): void;
  /** Distinct nodes counted so far. */
  readonly size: number;
  has(nodeId: string): boolean;
  /**
   * Feeds one simulation event. Returns the count to report as a `node-killed` task event, or null when
   * the event is not one to report (a node of a continent still being counted, or anything else).
   */
  apply(event: SimEvent): number | null;
}

export function createKillTally(): KillTally {
  const ids = new Set<string>();
  return {
    reset() {
      ids.clear();
    },
    get size() {
      return ids.size;
    },
    has: (nodeId) => ids.has(nodeId),
    apply(e) {
      if (e.type === 'node-down') {
        ids.add(e.nodeId);
        return e.scope === 'node' ? ids.size : null;
      }
      if (e.type === 'region-down') return ids.size;
      return null;
    },
  };
}
