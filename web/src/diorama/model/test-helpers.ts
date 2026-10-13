/** Tiny helpers shared by the model tests (not part of the public API). */

import type { BenchNode } from './types';
import { REGIONS } from './types';

export { REGIONS };

/** True when the mean height of nodes rises with tier: cumulus < nimbus < stratus. */
export function TIER_HEIGHT_ORDER_CHECK(nodes: readonly BenchNode[]): boolean {
  const mean = (tier: string): number => {
    const sel = nodes.filter((n) => n.tier === tier);
    return sel.reduce((s, n) => s + n.height, 0) / Math.max(1, sel.length);
  };
  return mean('cumulus') < mean('nimbus') && mean('nimbus') < mean('stratus');
}
