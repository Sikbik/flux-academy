/**
 * Geolocation, read as a learner would: which continents an app may run on and roughly how many nodes
 * that leaves. The grammar itself (`acEU_DE`, `a!cNA`) is parsed by `parseGeolocationEntry` in
 * `shared/flux/spec.ts`; this file adds the geography on top.
 *
 * The country to continent table is a convenience for the forge's estimates and the placement preview.
 * The network matches a node by the continent code its location provider reports (FACTS 3.5), which can
 * differ for a handful of countries on the edges of two continents, so every figure derived from this
 * table is shown as "about".
 */

import type { GeoCountry, TierCounts } from '@shared/api';
import { parseGeolocationEntry } from '@shared/flux/spec';

export type Continent = 'EU' | 'NA' | 'SA' | 'AS' | 'AF' | 'OC';

const TABLE: Record<Continent, string> = {
  EU: 'DE FR GB NL BE LU CH AT IT ES PT IE DK SE NO FI IS PL CZ SK HU RO BG GR RS HR SI BA MK AL ME MD UA BY LT LV EE RU MT',
  NA: 'US CA MX DM CR PA GT DO PR JM CU HN SV NI BS BB TT',
  SA: 'BR AR CL CO PE UY EC VE BO PY',
  AS: 'AE BH JP SG MY IL HK TR VN TH IN KR TW CN ID PH SA QA KW OM JO LB IR IQ PK BD LK KZ GE AM AZ CY MN KH NP',
  AF: 'ZA DZ EG MA TN NG KE GH ET TZ UG SN CI CM AO MZ ZM ZW MU',
  OC: 'AU NZ PF FJ NC PG',
};

export const COUNTRY_CONTINENT: Readonly<Record<string, Continent>> = (() => {
  const out: Record<string, Continent> = {};
  for (const [continent, list] of Object.entries(TABLE) as [Continent, string][]) {
    for (const cc of list.split(' ')) out[cc] = continent;
  }
  return out;
})();

export function continentOf(cc: string): Continent | null {
  return COUNTRY_CONTINENT[cc.toUpperCase()] ?? null;
}

export const CONTINENT_NAME: Readonly<Record<string, string>> = {
  EU: 'Europe',
  NA: 'North America',
  SA: 'South America',
  AS: 'Asia',
  AF: 'Africa',
  OC: 'Oceania',
  AN: 'Antarctica',
};

export interface Eligibility {
  /** Nodes that pass every rule, as far as country level data can tell. */
  nodes: number;
  /** Nodes in the snapshot (the denominator). */
  total: number;
  /** Countries with at least one eligible node. */
  countries: number;
  tiers: TierCounts;
  /** True when a region entry (`acEU_DE_BY`) was present and could only be treated as its country. */
  approximate: boolean;
}

/**
 * How many nodes a geolocation leaves, from the country counts of a geo snapshot.
 * A node must match at least one allow entry (when there are any) and no deny entry.
 */
export function eligibleNodes(geolocation: readonly string[], countries: readonly GeoCountry[]): Eligibility {
  const entries = geolocation.map((g) => parseGeolocationEntry(g)).filter((e) => e.kind !== 'unknown');
  const allows = entries.filter(
    (e) => e.kind.startsWith('allow-') || e.kind === 'legacy-continent' || e.kind === 'legacy-country',
  );
  const denies = entries.filter((e) => e.kind.startsWith('deny-'));
  const approximate = entries.some((e) => e.kind === 'allow-region' || e.kind === 'deny-region');
  const tiers: TierCounts = { cumulus: 0, nimbus: 0, stratus: 0 };
  let nodes = 0;
  let total = 0;
  let matched = 0;
  for (const c of countries) {
    total += c.nodes;
    const cc = c.code.toUpperCase();
    const continent = continentOf(cc);
    const allowed =
      allows.length === 0 ||
      allows.some((e) => {
        if (e.kind === 'allow-all') return true;
        if (e.kind === 'allow-continent' || e.kind === 'legacy-continent') return e.continent === continent;
        return e.country === cc;
      });
    if (!allowed) continue;
    const denied = denies.some((e) => {
      if (e.kind === 'deny-continent') return e.continent === continent;
      if (e.kind === 'deny-country') return e.country === cc;
      return false;
    });
    if (denied) continue;
    nodes += c.nodes;
    matched++;
    tiers.cumulus += c.tiers.cumulus;
    tiers.nimbus += c.tiers.nimbus;
    tiers.stratus += c.tiers.stratus;
  }
  return { nodes, total, countries: matched, tiers, approximate };
}

/** The continents an app may run on, for the placement preview. Empty means "everywhere". */
export function allowedContinents(geolocation: readonly string[]): Continent[] {
  const entries = geolocation.map((g) => parseGeolocationEntry(g));
  const denied = new Set<string>();
  for (const e of entries) if (e.kind === 'deny-continent' && e.continent) denied.add(e.continent);
  const allowed = new Set<string>();
  let anyAllow = false;
  for (const e of entries) {
    if (e.kind === 'allow-all') return [];
    if (e.kind.startsWith('allow-') || e.kind === 'legacy-continent') {
      anyAllow = true;
      if (e.continent) allowed.add(e.continent);
    } else if (e.kind === 'legacy-country') {
      anyAllow = true;
      const c = e.country ? continentOf(e.country) : null;
      if (c) allowed.add(c);
    }
  }
  const all: Continent[] = ['NA', 'SA', 'EU', 'AF', 'AS', 'OC'];
  const base = anyAllow ? all.filter((c) => allowed.has(c)) : all;
  const result = base.filter((c) => !denied.has(c));
  return result.length === all.length ? [] : result;
}
