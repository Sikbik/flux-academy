/**
 * Which continent the "Break region" control takes offline. Pure and framework free, so the rule is unit
 * tested on its own.
 *
 * The visitor's own choice (the Region select) wins while that continent still has a node that is up.
 * Otherwise the figure picks the continent holding the most running instances, so the control always
 * does something that matters to the app. With no running instance and no choice there is nothing to
 * break and the control is disabled.
 */
import { type Bench, REGIONS, type Region } from './model/types';
import type { SimState } from './sim/types';

/** Running (or starting) instances on a node that is up, per continent. */
export function instancesByRegion(bench: Bench, state: Readonly<SimState>): Record<Region, number> {
  const out: Record<Region, number> = { NA: 0, SA: 0, EU: 0, AF: 0, AS: 0, OC: 0 };
  for (const s of state.instances) {
    if (s.node < 0 || (s.status !== 'running' && s.status !== 'starting')) continue;
    if (state.nodeUp[s.node] !== 1) continue;
    const n = bench.nodes[s.node];
    if (n) out[n.region]++;
  }
  return out;
}

/** True when the continent still has at least one node that is up. */
export function regionHasNodeUp(bench: Bench, state: Readonly<SimState>, region: Region): boolean {
  for (const n of bench.nodes) if (n.region === region && state.nodeUp[n.index] === 1) return true;
  return false;
}

/**
 * The continent "Break region" takes offline: `chosen` when it still has a node up, else the one with
 * the most running instances (ties go to the first in display order), else null.
 */
export function regionToBreak(bench: Bench, state: Readonly<SimState>, chosen: Region | null): Region | null {
  if (chosen && regionHasNodeUp(bench, state, chosen)) return chosen;
  const counts = instancesByRegion(bench, state);
  let best: Region | null = null;
  let most = 0;
  for (const r of REGIONS) {
    if (counts[r] > most) {
      most = counts[r];
      best = r;
    }
  }
  return best;
}
