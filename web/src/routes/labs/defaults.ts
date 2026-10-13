/**
 * What the frame says about each lab before the lab says anything itself: whether it is a simulation
 * and which live resources it shows. Labs refine this from inside with `useLabFrame`; these defaults
 * make the index cards and the frame honest from the first paint, even while a lab chunk loads.
 */

import type { ResourceKey } from '@/data';

export interface LabDefaults {
  simulation: boolean;
  data: readonly ResourceKey[];
  /** Short tags for the index card. */
  tags: readonly string[];
}

export const LAB_DEFAULTS: Readonly<Record<string, LabDefaults>> = {
  'spec-forge': { simulation: false, data: ['pricing'], tags: ['Price engine'] },
  network: { simulation: false, data: ['network', 'geo'], tags: ['Network data'] },
  failover: { simulation: true, data: [], tags: ['Simulation'] },
  terminal: { simulation: true, data: [], tags: ['Simulation'] },
  explorer: { simulation: false, data: ['network'], tags: ['Network data'] },
  'agent-desk': { simulation: true, data: [], tags: ['Simulation'] },
};

const NONE: LabDefaults = { simulation: false, data: [], tags: [] };

export function labDefaults(id: string): LabDefaults {
  return LAB_DEFAULTS[id] ?? NONE;
}
