/**
 * Verified node tier facts, for diagrams, the diorama and the tier ladder.
 *
 * Counts of nodes change by the hour and live in the API (`/api/v1/network`); nothing here is a count.
 * Source tags as in spec.ts: FluxOS = RunOnFlux/flux v8.20.0, FACTS = docs/research/FACTS.md.
 *
 * Pure and framework-free. No Node built-ins, no DOM.
 */

export type TierId = 'cumulus' | 'nimbus' | 'stratus';

export interface TierFacts {
  id: TierId;
  /** Display name. */
  name: string;
  /** Name used by the daemon API counters and by v1 to v7 specs (`cpubasic`, `ramsuper`, `hddbamf`). */
  apiName: 'basic' | 'super' | 'bamf';
  /** Other API aliases the daemon uses for the same tier. */
  aliases: readonly string[];
  /** FLUX that must be locked as collateral. FACTS 2.1; fluxd fluxnode.h. */
  collateralFlux: number;
  /** FLUX paid to the one node of this tier chosen each block (before the 10 percent reduction due at height 3071200). FACTS 2.1. */
  payoutPerBlockFlux: number;
  /** Share of the 14 FLUX block subsidy. FACTS 2.1. */
  subsidyShare: number;
  /** What a node must show in the benchmark. Whitepaper thresholds (DOCS-ONLY), consistent with live nodes. FACTS 2.2. */
  minHardware: {
    cores: number;
    threads: number;
    ramGb: number;
    ssdGb: number;
    eventsPerSecond: number;
    diskWriteMbS: number;
    bandwidthMbit: number;
  };
  /** Nominal size FluxOS accounts for, before system reservation. FluxOS config.fluxSpecifics. */
  nominal: { threads: number; ramMb: number; ssdGb: number };
  /**
   * The per-app validator ceiling for a node of this tier: nominal size minus the locked system share
   * (1 core, 2000 MB, 60 GB). A spec can pass the validator at this size. FluxOS appValidator.js; FACTS 2.3.
   * `hddGb` is only a ceiling: see `usableHddGb` for what a nominal node really has.
   */
  appCapacity: { cpu: number; ramMb: number; hddGb: number };
  /**
   * Disk an app can actually get on a nominal node at runtime: 0.95 x SSD - 60 locked - 20 margin
   * (FluxOS hwRequirements.js, config.lockedSystemResources; FACTS 2.3): 129, 338 and 756 GB. Below
   * `appCapacity.hddGb`, so a spec can validate and still be unplaceable on a nominal node. Nodes can exceed
   * their tier, so this is "about", not a promise.
   */
  usableHddGb: number;
}

export const TIER_FACTS: Readonly<Record<TierId, TierFacts>> = {
  cumulus: {
    id: 'cumulus',
    name: 'Cumulus',
    apiName: 'basic',
    aliases: ['cumulus', 'basic'],
    collateralFlux: 1000,
    payoutPerBlockFlux: 1,
    subsidyShare: 1 / 14,
    minHardware: {
      cores: 2,
      threads: 4,
      ramGb: 7,
      ssdGb: 220,
      eventsPerSecond: 240,
      diskWriteMbS: 180,
      bandwidthMbit: 25,
    },
    nominal: { threads: 4, ramMb: 7000, ssdGb: 220 },
    appCapacity: { cpu: 3, ramMb: 5000, hddGb: 160 },
    usableHddGb: 129,
  },
  nimbus: {
    id: 'nimbus',
    name: 'Nimbus',
    apiName: 'super',
    aliases: ['nimbus', 'super'],
    collateralFlux: 12_500,
    payoutPerBlockFlux: 3.5,
    subsidyShare: 3.5 / 14,
    minHardware: {
      cores: 4,
      threads: 8,
      ramGb: 30,
      ssdGb: 440,
      eventsPerSecond: 640,
      diskWriteMbS: 180,
      bandwidthMbit: 50,
    },
    nominal: { threads: 8, ramMb: 30_000, ssdGb: 440 },
    appCapacity: { cpu: 7, ramMb: 28_000, hddGb: 380 },
    usableHddGb: 338,
  },
  stratus: {
    id: 'stratus',
    name: 'Stratus',
    apiName: 'bamf',
    aliases: ['stratus', 'bamf'],
    collateralFlux: 40_000,
    payoutPerBlockFlux: 9,
    subsidyShare: 9 / 14,
    minHardware: {
      cores: 8,
      threads: 16,
      ramGb: 61,
      ssdGb: 880,
      eventsPerSecond: 1520,
      diskWriteMbS: 400,
      bandwidthMbit: 100,
    },
    nominal: { threads: 16, ramMb: 61_000, ssdGb: 880 },
    appCapacity: { cpu: 15, ramMb: 59_000, hddGb: 820 },
    usableHddGb: 756,
  },
};

/** Tiers in ladder order, smallest first. */
export const TIER_ORDER: readonly TierId[] = ['cumulus', 'nimbus', 'stratus'];

/** FLUX created per block in total and the part that goes to the development fund. FACTS 1.4, 2.1. */
export const BLOCK_SUBSIDY = { totalFlux: 14, devFundFlux: 0.5 } as const;

/**
 * Which tiers have room for an app of the given total size (cores, MB, GB), smallest first.
 *
 * CPU and RAM use the validator ceiling. Disk uses what a nominal node really has (`usableHddGb`, 129 GB for
 * Cumulus), because a spec between that and the validator's 160 GB passes validation and still has no node.
 * Stratus is the largest tier and the validator caps every app at its ceiling, so a spec that validates is
 * never reported as unplaceable by this helper.
 */
export function tiersThatFit(totals: { cpu: number; ram: number; hdd: number }): TierId[] {
  return TIER_ORDER.filter((id) => {
    const f = TIER_FACTS[id];
    const c = f.appCapacity;
    const hdd = id === 'stratus' ? c.hddGb : f.usableHddGb;
    return totals.cpu <= c.cpu + 1e-9 && totals.ram <= c.ramMb && totals.hdd <= hdd;
  });
}
