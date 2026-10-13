/**
 * Where instances could land for a set of geolocation rules, on the diorama's sample world.
 *
 * This is a preview, not a prediction: there is no scheduler, each node that qualifies decides for itself
 * (FACTS 6.1, 6.2), so the picture is one possible outcome, seeded by the app name so it does not jump around
 * while editing. The rules are the network's (FACTS 3.5): a node must match at least one allow entry when
 * there are any, and no deny entry. Region entries are matched at country level because the sample world has
 * no regions, and every sample node has a known country. The real registration check also counts nodes whose
 * location is unknown as candidates and refuses only when 0 < candidates < instances; this module does not
 * model that, the caption says it in words.
 */

import { parseGeolocationEntry } from '@shared/flux/spec';
import { tiersThatFit } from '@shared/flux/tiers';
import { type BenchNode, type Region, SAMPLE_COUNTRIES } from '@/diorama/model';

export interface PlacementResult {
  /** Indices (into the nodes list) of every node that satisfies the rules. */
  eligible: number[];
  /** Indices of the nodes chosen for the instances, in landing order. */
  chosen: number[];
  /** Instances that could not be placed because fewer nodes qualify than were asked for. */
  unplaced: number;
}

interface Rule {
  type: 'allow' | 'deny';
  continent: string | null;
  country: string | null;
  all: boolean;
}

function rulesOf(geolocation: readonly string[]): Rule[] {
  const out: Rule[] = [];
  for (const raw of geolocation) {
    const e = parseGeolocationEntry(raw);
    switch (e.kind) {
      case 'allow-all':
        out.push({ type: 'allow', continent: null, country: null, all: true });
        break;
      case 'allow-continent':
      case 'legacy-continent':
        out.push({ type: 'allow', continent: e.continent, country: null, all: false });
        break;
      case 'allow-country':
      case 'allow-region':
      case 'legacy-country':
        out.push({ type: 'allow', continent: null, country: e.country, all: false });
        break;
      case 'deny-continent':
        out.push({ type: 'deny', continent: e.continent, country: null, all: false });
        break;
      case 'deny-country':
      case 'deny-region':
        out.push({ type: 'deny', continent: null, country: e.country, all: false });
        break;
      default:
        // An entry the network does not understand is ignored by the network too.
        break;
    }
  }
  return out;
}

function matches(rule: Rule, node: Pick<BenchNode, 'cc' | 'region'>): boolean {
  if (rule.all) return true;
  if (rule.country) return node.cc.toUpperCase() === rule.country.toUpperCase();
  if (rule.continent) return node.region === rule.continent;
  return false;
}

/** The nodes that satisfy the rules. */
export function eligibleIndices(
  nodes: readonly Pick<BenchNode, 'cc' | 'region'>[],
  geolocation: readonly string[],
): number[] {
  const rules = rulesOf(geolocation);
  const allows = rules.filter((r) => r.type === 'allow');
  const denies = rules.filter((r) => r.type === 'deny');
  const out: number[] = [];
  nodes.forEach((n, i) => {
    if (denies.some((r) => matches(r, n))) return;
    if (allows.length > 0 && !allows.some((r) => matches(r, n))) return;
    out.push(i);
  });
  return out;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Choose `count` distinct nodes among the eligible ones, round-robin over the regions that have one so a
 * wide rule set shows a spread, with a seeded shuffle inside each region. The same inputs always give the
 * same picture, and adding one instance keeps the earlier ones where they were.
 */
export function placeInstances(
  nodes: readonly Pick<BenchNode, 'cc' | 'region'>[],
  geolocation: readonly string[],
  count: number,
  seedText: string,
): PlacementResult {
  const eligible = eligibleIndices(nodes, geolocation);
  const rng = mulberry(hash(seedText || 'app'));
  const byRegion = new Map<string, number[]>();
  for (const i of eligible) {
    const region = nodes[i]?.region ?? '';
    const list = byRegion.get(region) ?? [];
    list.push(i);
    byRegion.set(region, list);
  }
  // Shuffle each region's list, and the order the regions are visited in, once: stable per seed.
  const regions = [...byRegion.keys()].sort();
  const order = regions
    .map((r) => ({ r, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
  for (const r of order) {
    const list = byRegion.get(r) ?? [];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = list[i] as number;
      list[i] = list[j] as number;
      list[j] = t;
    }
  }
  const chosen: number[] = [];
  const cursor = new Map<string, number>();
  const want = Math.max(0, Math.min(Math.floor(count), 100));
  let progressed = true;
  while (chosen.length < want && progressed) {
    progressed = false;
    for (const r of order) {
      if (chosen.length >= want) break;
      const list = byRegion.get(r) ?? [];
      const at = cursor.get(r) ?? 0;
      if (at < list.length) {
        chosen.push(list[at] as number);
        cursor.set(r, at + 1);
        progressed = true;
      }
    }
  }
  return { eligible, chosen, unplaced: Math.max(0, want - chosen.length) };
}

// ---------------------------------------------------------------------------
// Options for the diorama's placement scene
// ---------------------------------------------------------------------------

export interface DioramaPlaceOptions {
  /** Allow list of countries (ISO alpha-2). Empty when the rules do not restrict anything. */
  countries: string[];
  /** The rules leave no country at all: nothing can be placed. */
  none: boolean;
  /** Always empty: every rule is resolved to countries so the scene applies exactly the same rules. */
  regions: Region[];
  denyRegions: Region[];
}

/**
 * Resolve geolocation entries to what the diorama's placement scene takes. The scene's own options cannot
 * say "every country except these", so the rules are applied here over the countries of the sample world and
 * the scene is given the resulting allow list. That way the picture and the node count come from one rule set.
 */
export function placeOptionsFor(geolocation: readonly string[]): DioramaPlaceOptions {
  const pseudo = SAMPLE_COUNTRIES.map((c) => ({ cc: c.cc, region: c.region }));
  const eligible = eligibleIndices(pseudo, geolocation);
  const restricted = eligible.length < pseudo.length;
  return {
    countries: restricted ? eligible.map((i) => (pseudo[i] as { cc: string }).cc) : [],
    none: eligible.length === 0,
    regions: [],
    denyRegions: [],
  };
}

export type AppSizeClass = 'small' | 'medium' | 'large';

/**
 * Which size class the placement scene should use for an app of these totals: the smallest node tier that
 * has room decides how early it can be picked up (FACTS 2.4). `fits` is false when no tier has room.
 */
export function appSizeFor(totals?: { cpu: number; ram: number; hdd: number }): {
  size: AppSizeClass;
  fits: boolean;
} {
  if (!totals) return { size: 'small', fits: true };
  const tiers = tiersThatFit(totals);
  const first = tiers[0];
  if (!first) return { size: 'large', fits: false };
  return { size: first === 'cumulus' ? 'small' : first === 'nimbus' ? 'medium' : 'large', fits: true };
}
