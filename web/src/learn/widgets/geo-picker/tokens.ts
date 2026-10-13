/**
 * The `geolocation` grammar as the picker uses it (FACTS 3.5), as pure functions.
 *
 *   acEU          allow a continent          a!cEU          deny a continent
 *   acEU_DE       allow a country            a!cEU_RU       deny a country
 *
 * A node must be matched by no deny entry and, when allow entries exist, by at least one allow entry.
 * An empty list means no restriction. Region pins (`acEU_DE_BY`) and the legacy `a<CONT>` and `b<CC>`
 * forms are valid on the network and are kept as typed, but the picker only builds the first four.
 *
 * Node counting reuses the simulation's own rule (`geolocationAllows`), so the picker, the failover
 * lab and the diorama can never disagree about what a token means.
 */

import { parseGeolocationEntry } from '@shared/flux/spec';
import { REGION_OF_CC, type Region } from '@/diorama/model';
import { geolocationAllows, parseGeolocation } from '@/diorama/sim/rules';

export type Mode = 'allow' | 'deny';

/** The continents the picker can build. Antarctica (AN) is valid in a spec but hosts no nodes. */
export const PICKER_REGIONS: readonly Region[] = ['NA', 'SA', 'EU', 'AF', 'AS', 'OC'];

/** A narrow pool is risky below this many eligible nodes (a teaching threshold, not a Flux rule). */
export const RISKY_BELOW = 30;
/** Below this the pool is so thin that three instances may not find three free nodes. */
export const TINY_BELOW = 6;

export function continentToken(region: Region | string, mode: Mode = 'allow'): string {
  return `${mode === 'deny' ? 'a!c' : 'ac'}${region}`;
}

export function countryToken(region: Region | string, cc: string, mode: Mode = 'allow'): string {
  return `${mode === 'deny' ? 'a!c' : 'ac'}${region}_${cc.toUpperCase()}`;
}

/** The continent a country belongs to by the geolocation convention, or null when unknown. */
export function regionOfCountry(cc: string): Region | null {
  return REGION_OF_CC[cc.toUpperCase()] ?? null;
}

/**
 * The canonical spelling of one entry. `acEU_ALL` is `acEU`; spaces go; the shape is otherwise kept so a
 * typed token round-trips. Unparseable text is returned trimmed.
 */
export function canonicalToken(raw: string): string {
  const t = raw.trim();
  // Only the allow form: `a!cEU_ALL` bans nothing and must stay visible as the mistake it is (FACTS 3.5).
  const allCont = /^ac([A-Z]{2})_ALL$/.exec(t);
  if (allCont) return `ac${allCont[1]}`;
  return t;
}

/**
 * What to tell a learner who typed an entry the network would not accept, or null when it is fine.
 * The grammar also knows the legacy `b<CC>` and `a<CONT>` forms, so a stray word like `bogus` is read as
 * `b` plus `ogus`: say so, instead of quoting a fragment of what they typed with no context.
 */
export function typedEntryProblem(raw: string): string | null {
  const t = canonicalToken(raw);
  if (t === '') return null;
  const entry = parseGeolocationEntry(t);
  const first = entry.problems[0];
  if (first === undefined && entry.kind !== 'unknown') return null;
  if (entry.kind === 'legacy-country') {
    return `${t} is read as the old form b plus a country code, and ${first}. Current entries start with ac or a!c, such as acEU_DE.`;
  }
  if (entry.kind === 'legacy-continent') {
    return `${t} is read as the old form a plus a continent code, and ${first}. Current entries start with ac or a!c, such as acEU.`;
  }
  if (entry.kind === 'unknown') {
    return `${t} ${first ?? 'is not a geolocation entry'}. Try acEU, acEU_DE or a!cEU_RU.`;
  }
  return first ?? null;
}

/** Dedupes and sorts: allow entries first, then deny, each alphabetical. The comparison form. */
export function normalizeTokens(tokens: readonly string[]): string[] {
  const set = new Set<string>();
  for (const raw of tokens) {
    const t = canonicalToken(raw);
    if (t) set.add(t);
  }
  const isDeny = (s: string) => s.startsWith('a!c');
  return [...set].sort((a, b) => Number(isDeny(a)) - Number(isDeny(b)) || a.localeCompare(b));
}

/**
 * Turns the short forms a lesson author writes into full tokens: `EU` and `acEU` are the same allow;
 * `RU`, `EU_RU` and `a!cEU_RU` are the same deny (the continent of a bare country comes from the table).
 */
export function expandTarget(entry: string, mode: Mode): string | null {
  const t = canonicalToken(entry);
  if (/^a!?c[A-Z]{2}(_[A-Z]{2,3})*$/.test(t)) return t;
  const parts = t.toUpperCase().split('_');
  if (parts.length === 1) {
    const only = parts[0] ?? '';
    if (PICKER_REGIONS.includes(only as Region)) return continentToken(only, mode);
    const region = regionOfCountry(only);
    return region ? countryToken(region, only, mode) : null;
  }
  const [cont, cc] = parts;
  if (cont && cc && PICKER_REGIONS.includes(cont as Region)) return countryToken(cont, cc, mode);
  return null;
}

export interface PickerTarget {
  allowContinents?: string[];
  deny?: string[];
}

/** The tokens a target asks for, as `{ allow, deny }` of canonical entries (null sides are unchecked). */
export function targetTokens(target: PickerTarget): { allow: string[] | null; deny: string[] | null } {
  const allow = target.allowContinents
    ? normalizeTokens(
        target.allowContinents.map((c) => expandTarget(c, 'allow')).filter((t): t is string => t !== null),
      )
    : null;
  const deny = target.deny
    ? normalizeTokens(target.deny.map((c) => expandTarget(c, 'deny')).filter((t): t is string => t !== null))
    : null;
  return { allow, deny };
}

/** True when `tokens` satisfy `target`: each side the target names must match exactly. */
export function satisfiesTarget(tokens: readonly string[], target: PickerTarget): boolean {
  const have = normalizeTokens(tokens);
  const want = targetTokens(target);
  const haveAllow = have.filter((t) => !t.startsWith('a!c'));
  const haveDeny = have.filter((t) => t.startsWith('a!c'));
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);
  if (want.allow !== null && !same(haveAllow, want.allow)) return false;
  if (want.deny !== null && !same(haveDeny, want.deny)) return false;
  return want.allow !== null || want.deny !== null;
}

// ---------------------------------------------------------------------------------------------------
// Analysis: what the set means, and where it is wrong or pointless
// ---------------------------------------------------------------------------------------------------

export interface TokenInfo {
  raw: string;
  mode: Mode;
  /** `continent`, `country`, or `other` for region pins and legacy forms. */
  level: 'continent' | 'country' | 'other' | 'all';
  continent: string | null;
  country: string | null;
  problems: string[];
}

export function describeToken(raw: string): TokenInfo {
  const e = parseGeolocationEntry(raw);
  const deny = e.kind.startsWith('deny');
  let level: TokenInfo['level'] = 'other';
  if (e.kind === 'allow-all') level = 'all';
  else if (e.kind === 'allow-continent' || e.kind === 'deny-continent') level = 'continent';
  else if (e.kind === 'allow-country' || e.kind === 'deny-country') level = 'country';
  return {
    raw,
    mode: deny ? 'deny' : 'allow',
    level,
    continent: e.continent,
    country: e.country,
    problems: e.problems,
  };
}

export interface Contradiction {
  /** The allow entry that can never match. */
  allow: string;
  /** The deny entry that cancels it. */
  by: string;
}

export interface Redundancy {
  token: string;
  /** What already covers it. */
  coveredBy: string;
}

export interface GeoAnalysis {
  tokens: string[];
  allow: TokenInfo[];
  deny: TokenInfo[];
  /** Entries the network will ignore or reject, with the reason. */
  invalid: { token: string; problems: string[] }[];
  /** Allow entries cancelled in full by a deny entry (deny always wins). */
  contradictions: Contradiction[];
  /** Allow entries that add nothing because a wider allow entry already covers them. */
  redundant: Redundancy[];
  /** Deny entries that exclude nothing because no allow entry reaches them. */
  idleDenies: string[];
  /** True when there are allow entries and every one of them is cancelled. */
  everythingCancelled: boolean;
}

function covers(wide: TokenInfo, narrow: TokenInfo): boolean {
  if (wide.level === 'all') return true;
  if (wide.level === 'continent') return narrow.continent !== null && narrow.continent === wide.continent;
  if (wide.level === 'country') {
    return (
      narrow.level === 'country' && narrow.country === wide.country && narrow.continent === wide.continent
    );
  }
  return false;
}

export function analyzeTokens(input: readonly string[]): GeoAnalysis {
  const tokens = normalizeTokens(input);
  const infos = tokens.map(describeToken);
  const invalid = infos
    .filter((i) => i.problems.length > 0)
    .map((i) => ({ token: i.raw, problems: i.problems }));
  const good = infos.filter((i) => i.problems.length === 0);
  const allow = good.filter((i) => i.mode === 'allow');
  const deny = good.filter((i) => i.mode === 'deny');

  const contradictions: Contradiction[] = [];
  for (const a of allow) {
    for (const d of deny) {
      if (covers(d, a)) {
        contradictions.push({ allow: a.raw, by: d.raw });
        break;
      }
    }
  }
  const cancelled = new Set(contradictions.map((c) => c.allow));

  const redundant: Redundancy[] = [];
  for (const a of allow) {
    const wider = allow.find((b) => b !== a && b.raw !== a.raw && covers(b, a) && !(b.level === a.level));
    if (wider) redundant.push({ token: a.raw, coveredBy: wider.raw });
  }

  const idleDenies: string[] = [];
  if (allow.length > 0) {
    for (const d of deny) {
      const reach = allow.some((a) => !cancelled.has(a.raw) && (covers(a, d) || covers(d, a)));
      if (!reach) idleDenies.push(d.raw);
    }
  }

  return {
    tokens,
    allow,
    deny,
    invalid,
    contradictions,
    redundant,
    idleDenies,
    everythingCancelled: allow.length > 0 && allow.every((a) => cancelled.has(a.raw)),
  };
}

// ---------------------------------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------------------------------

export interface EditResult {
  tokens: string[];
  /** A short sentence about what happened, for the live region. */
  message: string;
}

/** Whether `tokens` already contain this exact entry. */
function has(tokens: readonly string[], token: string): boolean {
  return normalizeTokens(tokens).includes(canonicalToken(token));
}

/** Toggle a continent. Adding an allow removes country allows it now covers. */
export function toggleContinent(
  tokens: readonly string[],
  region: Region,
  mode: Mode,
  names: { continent: (r: string) => string; country: (cc: string) => string },
): EditResult {
  const token = continentToken(region, mode);
  const name = names.continent(region);
  if (has(tokens, token)) {
    return {
      tokens: normalizeTokens(tokens.filter((t) => canonicalToken(t) !== token)),
      message: `${name} removed.`,
    };
  }
  let next = [...tokens, token];
  let message = mode === 'allow' ? `${name} allowed.` : `${name} denied.`;
  if (mode === 'allow') {
    const covered = next.filter((t) => {
      const i = describeToken(t);
      return i.mode === 'allow' && i.level === 'country' && i.continent === region;
    });
    if (covered.length > 0) {
      next = next.filter((t) => !covered.includes(t));
      const list = covered.map((t) => names.country(describeToken(t).country ?? '')).join(', ');
      message = `${name} allowed. It covers ${list}, so that entry was removed.`;
    }
  }
  return { tokens: normalizeTokens(next), message };
}

/** Toggle a country. An allow inside an allowed continent is refused with a reason. */
export function toggleCountry(
  tokens: readonly string[],
  cc: string,
  mode: Mode,
  names: { continent: (r: string) => string; country: (cc: string) => string },
): EditResult {
  const region = regionOfCountry(cc);
  const country = names.country(cc);
  if (!region) return { tokens: normalizeTokens(tokens), message: `${country} has no known continent.` };
  const token = countryToken(region, cc, mode);
  if (has(tokens, token)) {
    return {
      tokens: normalizeTokens(tokens.filter((t) => canonicalToken(t) !== token)),
      message: `${country} removed.`,
    };
  }
  if (mode === 'allow' && has(tokens, continentToken(region, 'allow'))) {
    return {
      tokens: normalizeTokens(tokens),
      message: `${names.continent(region)} is already allowed, so ${country} is already included. Switch to Deny to leave it out.`,
    };
  }
  return {
    tokens: normalizeTokens([...tokens, token]),
    message: mode === 'allow' ? `${country} allowed.` : `${country} denied.`,
  };
}

// ---------------------------------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------------------------------

export interface CountryNodes {
  code: string;
  nodes: number;
}

export interface Eligibility {
  /** Nodes whose known location matches these entries: the ones the rule proves eligible. */
  eligible: number;
  /**
   * Nodes whose country or continent cannot be resolved. The network counts them as candidates for every
   * rule, because only proven ineligibility excludes a node (FACTS 3.5). Zero when there are no entries.
   */
  unresolved: number;
  /** What the registration check counts: `eligible` plus `unresolved`. With no entries, every node. */
  candidates: number;
  /** The denominator: located nodes when there are entries, all nodes when there are none. */
  of: number;
  /** Share of `of`, 0..1. */
  share: number;
  /** Per country, for the map. */
  allowed: Record<string, number>;
  /** Located nodes whose country is not in the continent table. They can only match by country code. */
  unplaced: number;
}

/**
 * How many nodes the entries leave. `regionOf` answers a country's continent (the table, then geography
 * for a country the table lacks). With no entries every node is eligible, located or not. With entries,
 * `eligible` counts the nodes whose known location matches. A node the location table cannot resolve is
 * not excluded by any rule (FACTS 3.5): it is a candidate for the registration check, so `candidates` adds
 * it. Whether such a node would actually install the app was not tested.
 */
export function eligibility(
  tokens: readonly string[],
  countries: readonly CountryNodes[],
  totalNodes: number,
  regionOf: (cc: string) => Region | null = regionOfCountry,
): Eligibility {
  const located = countries.reduce((s, c) => s + c.nodes, 0);
  const norm = normalizeTokens(tokens);
  if (norm.length === 0) {
    const allowed: Record<string, number> = {};
    for (const c of countries) allowed[c.code.toUpperCase()] = c.nodes;
    return {
      eligible: totalNodes,
      unresolved: 0,
      candidates: totalNodes,
      of: totalNodes,
      share: totalNodes > 0 ? 1 : 0,
      allowed,
      unplaced: 0,
    };
  }
  const constraint = parseGeolocation(norm);
  const allowed: Record<string, number> = {};
  let eligible = 0;
  let unplaced = 0;
  for (const c of countries) {
    const cc = c.code.toUpperCase();
    const region = regionOf(cc);
    if (!region) {
      unplaced += c.nodes;
      continue;
    }
    if (geolocationAllows(constraint, region, cc)) {
      allowed[cc] = c.nodes;
      eligible += c.nodes;
    } else {
      allowed[cc] = 0;
    }
  }
  const of = Math.max(totalNodes, located);
  const unresolved = unplaced + Math.max(0, totalNodes - located);
  return {
    eligible,
    unresolved,
    candidates: eligible + unresolved,
    of,
    share: of > 0 ? eligible / of : 0,
    allowed,
    unplaced,
  };
}

export type RegistrationVerdict = 'accepted' | 'refused' | 'accepted-none';

/**
 * The placement feasibility check at registration (FACTS 3.5, read from FluxOS v8.20.0 and exercised live):
 * refused only when the candidates are fewer than the requested instances but more than zero. With zero
 * candidates the list is accepted and nothing is promised to run.
 */
export function registrationVerdict(candidates: number, instances: number): RegistrationVerdict {
  if (candidates <= 0) return 'accepted-none';
  return candidates < instances ? 'refused' : 'accepted';
}

export type PoolHealth = 'unrestricted' | 'ok' | 'thin' | 'tiny' | 'empty';

/** How comfortable the eligible pool is, as a word for the UI. A teaching heuristic. */
export function poolHealth(
  tokens: readonly string[],
  eligible: number,
  riskyBelow = RISKY_BELOW,
): PoolHealth {
  if (normalizeTokens(tokens).length === 0) return 'unrestricted';
  if (eligible <= 0) return 'empty';
  if (eligible < TINY_BELOW) return 'tiny';
  if (eligible < riskyBelow) return 'thin';
  return 'ok';
}

/** The `geolocation` field as a JSON line, for the copy button. */
export function geolocationJson(tokens: readonly string[]): string {
  return `"geolocation": ${JSON.stringify(normalizeTokens(tokens))}`;
}
