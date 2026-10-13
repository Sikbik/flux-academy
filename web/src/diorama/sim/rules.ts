/**
 * The rules of the simulation, in one place, each a small documented function or constant so a FACTS
 * correction is a one-line edit. Nothing in `createSim.ts` hard-codes a number or a behaviour that is
 * a claim about Flux: it asks this file.
 *
 * Sources are `docs/research/FACTS.md` (section numbers below). Where the facts are UNVERIFIED or the
 * real value is too slow to watch, the rule says so and the classroom value is clearly separate from the
 * real one:
 *
 *   REAL        the value Flux uses, with its FACTS reference. Never shown as a number by the diorama.
 *   SIM         the value the simulation uses so a lesson stays watchable (time compression).
 *
 * The diorama never prints a SIM number as a fact in its own captions: lesson prose carries the claims. The
 * one thing it does say on screen is that a compressed duration is compressed (`compressionNote`).
 */
import {
  FDM_FAILOVER,
  FDM_TIMING,
  G_ELECTION_EVERY_SEC,
  gStandbyWaitMin,
  replacementWaitMin,
  SPAWN_DEFERRAL_MIN,
} from '@shared/flux/timing';
import type { BenchNode, Region, Tier } from '../model/types';
import { TIER_INDEX } from '../model/types';
import type { AppSize, DeployPhase, VolumeMode } from './types';

// ---------------------------------------------------------------------------------------------------
// Time compression: the real durations (from `@shared/flux/timing`) and how much faster the screen runs
// ---------------------------------------------------------------------------------------------------

/**
 * How many times faster than the network a rule runs on screen. The durations below are far too long to
 * watch, so two of them are compressed. Every compression is stated on screen ("compressed for the
 * screen"), and each is its own factor because the real durations differ by a factor of about 40: no one
 * factor keeps both watchable. The health check itself (3 s, two fails) is NOT compressed.
 */
export const SIM_COMPRESSION = {
  /** A lost instance is replaced after its location record expires: 125 minutes there, 20 s here. */
  replacement: 375,
  /** A `g:` standby first in line waits about 3 minutes before it may start: 15 s here in total. */
  failover: 12,
} as const;

/**
 * REAL: the time a `g:` failover takes when the first standby in line must take over, in ms. A standby at
 * list position `i` waits about `i` x 3 minutes; the first is position 1. FDM itself needs at least 3
 * failed checks and 90 s of unhealthiness before it moves away from the old primary (FDM_FAILOVER), and
 * the node election runs every 30 s (G_ELECTION_EVERY_SEC), so a failover is minutes, not seconds.
 * FACTS 6.4 "Primary/standby (`g:`) apps", 7.2. Not measured live.
 */
export const REAL_G_FAILOVER_MS = Math.max(
  gStandbyWaitMin(1) * 60_000,
  (FDM_FAILOVER.minUnhealthySec + G_ELECTION_EVERY_SEC) * 1000,
);

/** REAL: the wait before a replacement copy of a lost instance starts to install, in ms. FACTS 6.3, 6.5. */
export const REAL_REPLACEMENT_MS = replacementWaitMin(false) * 60_000;

/** The router's own detection time (3 s x 2 fails = 6 s), which the simulation runs in real time. */
const EJECT_MS = FDM_TIMING.healthIntervalSec * FDM_TIMING.ejectAfterFailures * 1000;
const PROMOTE_START_MS = 1500;

/**
 * The words that say a figure is compressed, with the factor from `SIM_COMPRESSION` and the real duration
 * in minutes. Shown next to the failover so the screen never passes a few seconds off as the real time.
 */
export function compressionNote(kind: keyof typeof SIM_COMPRESSION): string {
  const real = kind === 'failover' ? REAL_G_FAILOVER_MS : REAL_REPLACEMENT_MS;
  const minutes = Math.round(real / 60_000);
  return `Compressed for the screen: about ${minutes} minutes on the network, shown about ${SIM_COMPRESSION[kind]} times faster.`;
}

// ---------------------------------------------------------------------------------------------------
// Rule tables
// ---------------------------------------------------------------------------------------------------

export interface PlacementRules {
  /**
   * How a node is chosen among the eligible ones. FACTS 6.2: "There is no central scheduler. Each node
   * decides alone ... picks one at random". `random` is uniform over eligible nodes (weighted by the
   * nodes a live cluster stands for). The competing-claims tie-break (`compareInstallingClaims`) is
   * UNVERIFIED (FACTS 14 #4) and is not modelled: the simulation has one winner per slot.
   */
  pick: 'random';
  /** FACTS 6.2: "No two instances of one app run on the same node IP." Verified live (0 violations). */
  distinctIp: boolean;
  /**
   * FACTS 6.2 "Fault domains": for apps with synced storage (`r:`, `g:`, `s:`) the spawner limits
   * instances per fault domain (hosting organisation) to `ceil(instances / domains)`.
   * `synced-only` applies it to replicated volumes only; plain volumes have no such cap.
   */
  faultDomains: 'synced-only' | 'always' | 'never';
  /**
   * FACTS 2.4: tier is a SOFT preference realised as install delays, not a rule. `soft` honours the
   * delay table below given how long the app has been waiting; `uniform` ignores tier entirely.
   */
  tier: 'soft' | 'uniform';
  /**
   * REAL minutes before a node of a tier considers an app of a size (FACTS 2.4 table and 6.1 row 10).
   * `null` means the app does not fit that tier at all (Cumulus usable CPU is 3 cores, FACTS 2.3).
   */
  tierDelayMin: Record<AppSize, Record<Tier, number | null>>;
  /** Hard cap on the instance count (FACTS 3: v8 maximum 100). */
  maxInstances: number;
}

export interface HealthRules {
  /** REAL: FDM's TCP connect check runs every 3 s (FACTS 6.4 "Health check"). */
  checkIntervalMs: number;
  /** REAL: marked down after 2 failed checks (about 6 s to eject). */
  fall: number;
  /** REAL: marked up after 2 successful checks (about 6 s to return). */
  rise: number;
  /** SIM: time for a picked node to install and start the container. The real one is seconds to minutes. */
  startMs: number;
}

export interface RoutingRules {
  /** REAL: `balance roundrobin` (FACTS 6.4 "Load balancing"). */
  balance: 'roundrobin';
  /**
   * REAL: a cookie (`FDMSERVERID`) pins a client to one instance for up to 8 hours when there is more
   * than one instance. Modelled as: a user keeps its instance while that instance stays in rotation.
   */
  sticky: boolean;
  /** REAL: `retries 3` with `option redispatch` (FACTS 6.4). */
  retries: number;
  /**
   * SIM: how long a request waits on a node that does not answer before the proxy redispatches it.
   * REAL: the connect timeout is 10 s (FACTS 6.4 "Timeouts"); compressed so the packet stays watchable.
   */
  redispatchAfterMs: number;
  /** SIM: leg duration of a packet: `legBaseMs + distance * legMsPerUnit` (distance in bench units). */
  legBaseMs: number;
  legMsPerUnit: number;
  /** SIM: modelled round trip: `latencyBaseMs + km / kmPerMs`. Not a measurement. */
  latencyBaseMs: number;
  kmPerMs: number;
  /** Packets kept in `state().packets` (running plus lingering). Older ones are dropped first. */
  maxPackets: number;
  /** How long a finished packet stays in the state so the renderer can draw its landing, ms. */
  lingerMs: number;
}

export interface RespawnRules {
  enabled: boolean;
  /**
   * SIM: how long after a node is lost another node installs a replacement. REAL: location records last
   * 7,500 s (125 min) and a missing instance is then re-spawned elsewhere (FACTS 6.3), plus install time:
   * it can take about two hours, and more for a synced volume. Compressed `SIM_COMPRESSION.replacement`
   * times (375).
   */
  delayMs: number;
}

export interface VolumeRules {
  /**
   * SIM: wait after the router drops the primary before a standby is promoted. REAL (FACTS 6.4, 7.2): FDM
   * moves away from the old primary only after at least 3 failed checks AND 90 s of unhealthiness, the node
   * election runs every 30 s, and a standby at list position `i` waits about `i` x 3 minutes before it may
   * start an empty primary. So a failover is minutes. Here the first standby takes over after
   * `REAL_G_FAILOVER_MS / SIM_COMPRESSION.failover` in total (router detection and start included), and
   * the screen says it is compressed. Position 1 only: the simulation promotes the first healthy standby.
   */
  electionGraceMs: number;
  /** SIM: time for the promoted standby to start serving after it is elected. */
  promoteStartMs: number;
  /** SIM: initial or resync time of a replica. REAL: "initial sync must reach 100 percent" (FACTS 7.3). */
  syncMs: number;
}

export interface DeployRules {
  /**
   * SIM: relative lengths of the pipeline phases (FACTS 6.1 sequence): `spec` price and validate, `register`
   * sign and broadcast, `block` payment confirmed in the next block (about 30 s), `select` nodes decide
   * for themselves (1 to 3 minutes typical), `install` image pull and start, `live` announce and publish.
   * The proportions follow the typical real durations; the total is compressed to about 15 s.
   */
  phases: ReadonlyArray<{ id: DeployPhase; ms: number }>;
  /** How many nodes flicker as "considering" during selection (besides the winners). */
  candidates: number;
}

export interface Rules {
  /** Fixed simulation step, ms. */
  stepMs: number;
  placement: PlacementRules;
  health: HealthRules;
  routing: RoutingRules;
  respawn: RespawnRules;
  volume: VolumeRules;
  deploy: DeployRules;
}

export type RulesPatch = {
  [K in keyof Rules]?: Rules[K] extends object ? Partial<Rules[K]> : Rules[K];
};

export const DEFAULT_RULES: Rules = {
  stepMs: 25,
  placement: {
    pick: 'random',
    distinctIp: true,
    faultDomains: 'synced-only',
    tier: 'soft',
    tierDelayMin: {
      small: {
        cumulus: 0,
        nimbus: SPAWN_DEFERRAL_MIN.nimbusSmallApp,
        stratus: SPAWN_DEFERRAL_MIN.stratusSmallApp,
      },
      medium: { cumulus: null, nimbus: 0, stratus: SPAWN_DEFERRAL_MIN.stratusMediumApp },
      large: { cumulus: null, nimbus: null, stratus: 0 },
    },
    maxInstances: 100,
  },
  health: {
    checkIntervalMs: FDM_TIMING.healthIntervalSec * 1000,
    fall: FDM_TIMING.ejectAfterFailures,
    rise: FDM_TIMING.restoreAfterSuccesses,
    startMs: 1500,
  },
  routing: {
    balance: 'roundrobin',
    sticky: true,
    retries: 3,
    redispatchAfterMs: 1400,
    legBaseMs: 340,
    legMsPerUnit: 5.5,
    latencyBaseMs: 12,
    kmPerMs: 100,
    maxPackets: 64,
    lingerMs: 900,
  },
  respawn: { enabled: true, delayMs: Math.round(REAL_REPLACEMENT_MS / SIM_COMPRESSION.replacement) },
  volume: {
    electionGraceMs: Math.round(REAL_G_FAILOVER_MS / SIM_COMPRESSION.failover) - EJECT_MS - PROMOTE_START_MS,
    promoteStartMs: PROMOTE_START_MS,
    syncMs: 2600,
  },
  deploy: {
    phases: [
      { id: 'spec', ms: 1800 },
      { id: 'register', ms: 1600 },
      { id: 'block', ms: 2600 },
      { id: 'select', ms: 3800 },
      { id: 'install', ms: 3200 },
      { id: 'live', ms: 1400 },
    ],
    candidates: 14,
  },
};

/** Applies a partial override one level deep (the rule groups are flat objects). */
export function mergeRules(base: Rules, patch: RulesPatch | undefined): Rules {
  if (!patch) return base;
  const out: Rules = { ...base };
  for (const key of Object.keys(patch) as Array<keyof Rules>) {
    const value = patch[key];
    if (value === undefined) continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (out as unknown as Record<string, unknown>)[key] = { ...(base[key] as object), ...(value as object) };
    } else {
      (out as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// Placement: eligibility
// ---------------------------------------------------------------------------------------------------

/** One entry of a geolocation allow or deny list (FACTS 3.5). */
export interface GeoRule {
  /** A continent code; absent or `ALL` matches any continent. */
  continent?: Region | 'ALL';
  /** An ISO alpha-2 country code. */
  country?: string;
}

export interface GeoConstraint {
  allow: readonly GeoRule[];
  deny: readonly GeoRule[];
}

const CONTINENTS = new Set(['AF', 'AS', 'EU', 'NA', 'OC', 'SA']);

/**
 * Parses Flux `geolocation` strings (FACTS 3.5): `acALL`, `ac<CONT>`, `ac<CONT>_ALL`, `ac<CONT>_<CC>`,
 * `a!c<CONT>`, `a!c<CONT>_<CC>`, plus the legacy `a<CONT>` and `b<CC>` allow forms. Region pins
 * (`ac<CONT>_<CC>_<REGION>`) are treated as their country. Unknown entries are ignored.
 */
export function parseGeolocation(entries: readonly string[]): GeoConstraint {
  const allow: GeoRule[] = [];
  const deny: GeoRule[] = [];
  for (const raw of entries) {
    const entry = raw.trim();
    if (entry === 'acALL') {
      allow.push({ continent: 'ALL' });
      continue;
    }
    const m = /^a(!?)c([A-Z]{2})(?:_([A-Z]{2,3}))?(?:_[A-Za-z0-9-]+)?$/.exec(entry);
    if (m && CONTINENTS.has(m[2] as string)) {
      const rule: GeoRule = { continent: m[2] as Region };
      const cc = m[3];
      if (cc && cc !== 'ALL') rule.country = cc;
      (m[1] === '!' ? deny : allow).push(rule);
      continue;
    }
    const legacyContinent = /^a([A-Z]{2})$/.exec(entry);
    if (legacyContinent && CONTINENTS.has(legacyContinent[1] as string)) {
      allow.push({ continent: legacyContinent[1] as Region });
      continue;
    }
    const legacyCountry = /^b([A-Z]{2})$/.exec(entry);
    if (legacyCountry) allow.push({ country: legacyCountry[1] as string });
  }
  return { allow, deny };
}

function ruleMatches(rule: GeoRule, region: Region, cc: string): boolean {
  if (rule.continent && rule.continent !== 'ALL' && rule.continent !== region) return false;
  if (rule.country && rule.country.toUpperCase() !== cc.toUpperCase()) return false;
  return true;
}

/**
 * FACTS 3.5: "A node must satisfy: not matched by any deny entry, and (if any allow entries exist)
 * matched by at least one allow entry."
 */
export function geolocationAllows(c: GeoConstraint, region: Region, cc: string): boolean {
  for (const rule of c.deny) if (ruleMatches(rule, region, cc)) return false;
  if (c.allow.length === 0) return true;
  for (const rule of c.allow) if (ruleMatches(rule, region, cc)) return true;
  return false;
}

/** Turns the simple options of `PlaceOptions` into the same constraint shape. */
export function constraintFromOptions(
  regions: readonly Region[],
  countries: readonly string[],
  denyRegions: readonly Region[],
): GeoConstraint {
  const allow: GeoRule[] = [];
  for (const r of regions) allow.push({ continent: r });
  for (const c of countries) allow.push({ country: c });
  const deny: GeoRule[] = denyRegions.map((r) => ({ continent: r }));
  return { allow, deny };
}

/**
 * Minutes after registration at which a node of `tier` starts considering an app of `size`, or null
 * when the app cannot fit that tier (FACTS 2.3 and 2.4).
 */
export function tierDelayMinutes(rules: PlacementRules, size: AppSize, tier: Tier): number | null {
  return rules.tierDelayMin[size][tier];
}

/**
 * The tiers that compete for the app after it has waited `waitedMin`, as a per-tier flag in
 * [cumulus, nimbus, stratus] order. In `uniform` mode every tier competes.
 */
export function competingTiers(
  rules: PlacementRules,
  size: AppSize,
  waitedMin: number,
): [boolean, boolean, boolean] {
  if (rules.tier === 'uniform') return [true, true, true];
  const out: [boolean, boolean, boolean] = [false, false, false];
  for (const tier of ['cumulus', 'nimbus', 'stratus'] as const) {
    const delay = tierDelayMinutes(rules, size, tier);
    out[TIER_INDEX[tier]] = delay !== null && delay <= waitedMin;
  }
  return out;
}

/** The distinct delays (ascending) at which a new tier starts competing for this app size. */
export function tierSteps(rules: PlacementRules, size: AppSize): number[] {
  const steps = new Set<number>();
  for (const tier of ['cumulus', 'nimbus', 'stratus'] as const) {
    const d = tierDelayMinutes(rules, size, tier);
    if (d !== null) steps.add(d);
  }
  return [...steps].sort((a, b) => a - b);
}

/**
 * Per-instance cap for one fault domain (hosting organisation), FACTS 6.2:
 * `ceil(instances / domains)`, never below 1.
 */
export function faultDomainCap(instances: number, domains: number): number {
  return Math.max(1, Math.ceil(instances / Math.max(1, domains)));
}

/** Whether the fault-domain cap applies to an app with this volume mode. */
export function faultDomainsApply(rules: PlacementRules, volume: VolumeMode): boolean {
  if (rules.faultDomains === 'never') return false;
  if (rules.faultDomains === 'always') return true;
  return volume !== 'local';
}

/** The key two instances must not share to count as distinct IPs (FACTS 6.2). */
export function ipKey(node: BenchNode): string {
  return node.ip || node.id;
}

/** The fault domain of a node: its hosting organisation, else the node itself. */
export function operatorKey(node: BenchNode): string {
  return node.operator || node.id;
}

/**
 * The weight of a node in the random pick: the number of nodes of a competing tier that it stands for
 * (a live cluster carries its tier mix; a sample node carries one).
 */
export function nodeWeight(node: BenchNode, competing: readonly [boolean, boolean, boolean]): number {
  return (
    (competing[0] ? node.mix[0] : 0) + (competing[1] ? node.mix[1] : 0) + (competing[2] ? node.mix[2] : 0)
  );
}

// ---------------------------------------------------------------------------------------------------
// Health and routing
// ---------------------------------------------------------------------------------------------------

/** FACTS 6.4: down after `fall` failed checks every `checkIntervalMs`: about 6 s. */
export function ejectDelayMs(h: HealthRules): number {
  return h.checkIntervalMs * h.fall;
}

/** FACTS 6.4: up again after `rise` successful checks: about 6 s. */
export function reinstateDelayMs(h: HealthRules): number {
  return h.checkIntervalMs * h.rise;
}

/** Duration of a packet leg covering `distance` bench units. */
export function legDurationMs(r: RoutingRules, distance: number): number {
  return r.legBaseMs + distance * r.legMsPerUnit;
}

/** Modelled round trip for a request that travelled `km` between the user and the node. */
export function modelledLatencyMs(r: RoutingRules, km: number, extraMs = 0): number {
  return r.latencyBaseMs + km / r.kmPerMs + extraMs;
}

// ---------------------------------------------------------------------------------------------------
// Volumes (FACTS section 7)
// ---------------------------------------------------------------------------------------------------

/** Whether every instance serves (`r:`/`s:` and plain) or only the elected primary (`g:`). */
export function everyInstanceServes(mode: VolumeMode): boolean {
  return mode !== 'primary-standby';
}

/** Whether a volume mode keeps a copy of the data on the other instances (FACTS 7.2). */
export function replicatesData(mode: VolumeMode): boolean {
  return mode !== 'local';
}

/**
 * Whether a replacement instance starts with an empty volume. FACTS 7.2: a plain volume lives on one node
 * only and "the replacement instance starts empty on another node"; replicated volumes survive while at
 * least one instance with current data remains.
 */
export function replacementStartsEmpty(mode: VolumeMode, survivingCopies: number): boolean {
  return mode === 'local' || survivingCopies === 0;
}

/**
 * Whether this incarnation of an instance came back with an empty volume: a replacement that started on
 * another node after a plain volume was lost with its node (or after the last copy of a synced one was).
 * The renderer, the node list and the live region all ask this one question (FACTS 7.2).
 */
export function hasEmptyDisk(s: { dataLost: boolean; node: number; status: string }): boolean {
  return s.dataLost && s.node >= 0 && s.status !== 'unplaced';
}

/** Total length of the deploy timeline, ms. */
export function deployTotalMs(d: DeployRules): number {
  return d.phases.reduce((s, p) => s + p.ms, 0);
}
