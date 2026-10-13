/**
 * The Failover Lab's scenario menu. Each scenario is a setup (instances, allowed regions), one sentence
 * of what it teaches and two or three things to do. The sentences are the claims FACTS 6.5 and 6.2
 * support, and no more: the load balancer drops a dead instance in seconds, a replacement is not seconds,
 * spread is not guaranteed, and one instance is fragile. (A `g:` app is different: moving to a standby takes
 * minutes, FACTS 6.4. These scenarios are plain copies that all serve.) Nothing here promises Flux gives a
 * guarantee it does not.
 */
import type { Region } from '@/diorama/model';
import { REPLACEMENT_MIN, SAMPLE_DATE } from './words';

export type ScenarioId = 'single' | 'one-region' | 'two-continents' | 'ten-spread';

export interface Scenario {
  id: ScenarioId;
  title: string;
  /** A few words under the title. */
  tag: string;
  instances: number;
  /** The allow list as continents: the Flux `ac<CONT>` entries. Empty means anywhere. */
  regions: Region[];
  /** What this scenario teaches, in one sentence. */
  teaches: string;
  /** What to do, in order. */
  steps: string[];
  /** The region the "Break region" step should use, when the scenario has a natural one. */
  breakRegion?: Region;
  /** A sentence of evidence, with its date, shown under the lesson when there is some. */
  evidence?: string;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'single',
    title: 'One instance',
    tag: 'Fragile',
    instances: 1,
    regions: [],
    teaches: `One instance is the whole app: when its node goes dark the app is down until a replacement is placed, which on the network can take about two hours (${REPLACEMENT_MIN} minutes plus the image pull).`,
    steps: [
      'Set the request rate to a few a second.',
      'Press Break and watch the requests fail.',
      'Wait for the replacement, then press Revive all.',
    ],
    // fact: FACTS 6.5 and 15.3.3 (read 2026-10-13: the apps with no copy were all blocklisted Orbit deployments;
    // every other single-instance app had one). A dated sample, not a failure rate: FACTS has none.
    evidence: `Baked sample, read ${SAMPLE_DATE}: every single-instance app that was not a blocklisted Orbit deployment had a running copy. That shows nodes were healthy that day, not that one instance is safe.`,
  },
  {
    id: 'one-region',
    title: 'Three in one region',
    tag: 'Same place',
    instances: 3,
    regions: ['EU'],
    teaches:
      'Three instances sit on three different machines, but if the rules allow only one region they share its fate, so failover covers a node and not a region.',
    steps: ['Press Break once: two keep serving.', 'Press Break region: all three go dark together.'],
    breakRegion: 'EU',
  },
  {
    id: 'two-continents',
    title: 'Three, two continents allowed',
    tag: 'Allowed, not guaranteed',
    instances: 3,
    regions: ['EU', 'NA'],
    teaches:
      'Allowing two continents does not put one instance on each: each eligible node decides for itself whether to take a copy, so all three can land on the same continent.',
    steps: [
      'Look at where the three landed.',
      'Press Reshuffle a few times to see other draws.',
      'Press Break region on a continent that holds instances.',
    ],
  },
  {
    id: 'ten-spread',
    title: 'Ten, spread widely',
    tag: 'Many copies',
    instances: 10,
    regions: [],
    teaches:
      'Ten instances with no location rule usually land in several places, so losing a node leaves nine serving and losing a continent leaves the rest. Where they land is not promised, and because price is close to linear in instances this is a cost choice.',
    steps: [
      'Press Break region on the continent with the most instances.',
      'Watch the uptime meter: it dips, then recovers.',
      'Press Break several times: ten instances take a lot of losing.',
    ],
  },
];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** The geolocation entries a set of allowed continents stands for: `["acEU","acNA"]`. */
export function geolocationOf(regions: readonly Region[]): string[] {
  return regions.map((r) => `ac${r}`);
}

export const MIN_INSTANCES = 1;
export const MAX_INSTANCES = 12;
export const MAX_RATE = 20;
