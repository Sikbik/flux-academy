/**
 * Pure helpers behind the interactive parts of the reference pages. They take plain values and return
 * plain values, so the rules they apply can be tested without a page.
 */

import {
  BAKED_PRICING,
  blocksToSeconds,
  daysToBlocks,
  defaultSpec,
  durationDiscount,
  EXTRA_INSTANCE_FLOOR_USD,
  type FluxAppSpec,
  humanDuration,
  LIMITS,
  type LintReport,
  lintSpec,
  type Mount,
  monthsToBlocks,
  type ParsedContainerData,
  parseGeolocationEntry,
  priceStages,
  type Quote,
  quote,
  roundUpToCharmPrice,
} from '@shared/flux';
import { CONTINENT_NAMES } from './derive';
import {
  CURVE_INSTANCES,
  FEE_EFFECT_INSTANCES,
  FEE_PORT_EXAMPLES,
  FREE_PORT_EXAMPLE,
  PRICE_EXAMPLES,
  type PriceExample,
  type PriceSize,
} from './examples';

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------

export interface GeoPlace {
  /** Two letter continent code: `EU`. */
  continent: string;
  /** Two letter country code: `DE`. */
  country: string;
  /** A region code such as `BY` or `DE-BY`, when the node's region is known. */
  region?: string;
}

export interface GeoVerdict {
  qualifies: boolean;
  /** Plain sentences, in the order the rules decide. */
  reasons: string[];
  /** Entries this check does not evaluate, with why. */
  skipped: { entry: string; why: string }[];
}

function regionCode(region: string | undefined): string | null {
  if (!region) return null;
  const last = region.split('-').pop() ?? '';
  return last === '' ? null : last.toUpperCase();
}

/**
 * Whether a node in `place` satisfies a geolocation list, by the rule of FACTS 3.5: no deny entry matches,
 * and, when there are allow entries, at least one matches. Old style `a<CONT>` and `b<CC>` entries and
 * entries that do not parse are skipped and said so.
 */
export function geoVerdict(entries: readonly string[], place: GeoPlace): GeoVerdict {
  const skipped: GeoVerdict['skipped'] = [];
  const allow: string[] = [];
  const deny: string[] = [];
  const matched = new Set<string>();
  const here = regionCode(place.region);

  for (const raw of entries) {
    const e = parseGeolocationEntry(raw);
    if (e.kind === 'unknown') {
      skipped.push({
        entry: raw,
        why: 'Not documented as understood. What the network does with it is not documented, so this check treats it as matching nothing.',
      });
      continue;
    }
    if (e.kind === 'legacy-continent' || e.kind === 'legacy-country') {
      skipped.push({
        entry: raw,
        why: 'Old style entries are not evaluated here: the first one the node meets wins.',
      });
      continue;
    }
    const isDeny = e.kind.startsWith('deny');
    (isDeny ? deny : allow).push(raw);
    let hit = false;
    switch (e.kind) {
      case 'allow-all':
        hit = true;
        break;
      case 'allow-continent':
      case 'deny-continent':
        hit = e.continent === place.continent;
        break;
      case 'allow-country':
      case 'deny-country':
        hit = e.continent === place.continent && e.country === place.country;
        break;
      case 'allow-region':
      case 'deny-region':
        hit =
          e.continent === place.continent &&
          e.country === place.country &&
          here !== null &&
          regionCode(e.region ?? undefined) === here;
        break;
      default:
        break;
    }
    if (hit) matched.add(raw);
  }

  const reasons: string[] = [];
  const deniedBy = deny.filter((d) => matched.has(d));
  const allowedBy = allow.filter((a) => matched.has(a));
  const hasRegionRule = [...allow, ...deny].some((r) => /^a!?c[A-Z]{2}_[A-Z]{2}_/.test(r));
  if (deniedBy.length > 0) {
    reasons.push(`Denied by ${deniedBy.join(', ')}.`);
  }
  if (allow.length === 0) {
    if (deniedBy.length === 0) {
      reasons.push('There is no allow entry, so any node that no deny entry matches qualifies.');
    }
  } else if (allowedBy.length === 0) {
    reasons.push(`No allow entry matches: ${allow.join(', ')}.`);
  } else if (deniedBy.length === 0) {
    reasons.push(`Allowed by ${allowedBy.join(', ')}.`);
  }
  if (hasRegionRule && here === null) {
    reasons.push(
      "The node's region is not known. A region entry matches on proof only: it would not allow this node and would not deny it.",
    );
  }
  const qualifies = deniedBy.length === 0 && (allow.length === 0 || allowedBy.length > 0);
  return { qualifies, reasons, skipped };
}

/** "Europe" for `EU`, falling back to the code. */
export function continentName(code: string): string {
  return CONTINENT_NAMES[code] ?? code;
}

// ---------------------------------------------------------------------------
// containerData
// ---------------------------------------------------------------------------

/** One plain sentence for a parsed mount. */
export function describeMount(m: Mount): string {
  const n = (i: number | null) => (i === null ? 'a component that is not named' : `component ${i}`);
  switch (m.kind) {
    case 'primary': {
      if (m.flags.length === 0)
        return `The primary mount, at ${m.path}: a plain volume that stays on this node.`;
      if (m.flags.length > 1) {
        return `The primary mount, at ${m.path}, with the flags ${m.flags.join(' and ')}. The combination parses, but its meaning is not documented.`;
      }
      if (m.flags[0] === 'r') {
        return `The primary mount, at ${m.path}: synced by Syncthing, and every instance is active and writes.`;
      }
      if (m.flags[0] === 'g') {
        return `The primary mount, at ${m.path}: primary and standby. One elected instance runs and the others hold a synced copy.`;
      }
      return `The primary mount, at ${m.path}: synced by Syncthing with no election. The meaning is inferred from the source and is not documented.`;
    }
    case 'directory':
      return `The directory ${m.name} of the same volume, at ${m.path}. It is replicated when the primary mount is synced.`;
    case 'local-directory':
      return `The directory ${m.name} of the same volume, at ${m.path}. It is never replicated.`;
    case 'file':
      return `The file ${m.name}, at ${m.path}. It starts empty, and the app has to initialise it.`;
    case 'component-primary':
      return `The primary mount of ${n(m.component)}, shown here at ${m.path}.`;
    case 'component-directory':
      return `The directory ${m.name} of the volume of ${n(m.component)}, at ${m.path}.`;
    case 'component-file':
      return `The file ${m.name} of the volume of ${n(m.component)}, at ${m.path}.`;
    default:
      return m.raw;
  }
}

/** The id of the storage guarantee row (`none`, `r`, `g`, `s`) that applies to a parsed value. */
export function guaranteeId(parsed: ParsedContainerData): 'none' | 'r' | 'g' | 's' {
  return parsed.syncMode ?? 'none';
}

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

/** Price an example at an instance count and a number of months, at the baked official rates. */
export function priceFor(example: PriceExample, instances: number, months: number): Quote {
  const spec: FluxAppSpec = { ...example.spec, instances };
  return quote(spec, BAKED_PRICING.params, {
    months,
    fluxUsd: BAKED_PRICING.fluxUsd,
    paramsSource: 'baked',
  });
}

export interface CliffExplanation {
  /** One instance, before the other rules (a third of the bundle, rounded up to the cent). */
  perInstance: number;
  /** USD for one month at 3 and at 4 instances. */
  at3: number;
  at4: number;
  /** True when one instance costs under the flat rate, so the flat rule applies from 4 instances. */
  flatRuleApplies: boolean;
  /** The flat rate per instance after the first. */
  flatRate: number;
  /** What 4 instances would cost if only the discount ended and the flat rule did not exist. */
  withoutFlatRule: number;
}

/**
 * Why a small app gets dearer from 3 to 4 instances. Two rules start at 4 instances: the small app discount
 * ends, and a cheap app pays a flat rate for every instance after the first. The numbers come from the engine.
 */
export function cliffExplanation(example: PriceExample): CliffExplanation {
  const st = priceStages({ ...example.spec, instances: 4 }, BAKED_PRICING.params, { months: 1 });
  const extra = 3; // literal: instances after the first at 4 instances
  const plain = (Math.ceil(st.perInstanceUsd * extra * 100) + Math.ceil(st.perInstanceUsd * 100)) / 100; // literal: cents
  const floored = Math.max(plain, BAKED_PRICING.params.minUSDPrice);
  return {
    perInstance: st.perInstanceUsd,
    at3: priceFor(example, 3, 1).usdTotal ?? Number.NaN,
    at4: priceFor(example, 4, 1).usdTotal ?? Number.NaN,
    flatRuleApplies: st.perInstanceUsd < EXTRA_INSTANCE_FLOOR_USD,
    flatRate: EXTRA_INSTANCE_FLOOR_USD,
    withoutFlatRule: roundUpToCharmPrice(floored),
  };
}

/** One row of "what a fee port adds": the small example on a free port and on a fee port. */
export interface FeeEffectRow {
  instances: number;
  /** USD for one month with the public port outside the fee list. */
  free: number;
  /** USD for one month with the public port inside the fee list. */
  fee: number;
  /** `fee - free`. It is not constant: the fee goes into the bundle that is divided by three. */
  added: number;
}

/**
 * The same small app priced twice, with its public port on a free port and on a fee port, at the baked
 * rates, for a one month subscription. This is the engine's own answer, not arithmetic done here.
 */
export function feePortEffect(counts: readonly number[] = FEE_EFFECT_INSTANCES): FeeEffectRow[] {
  const small = PRICE_EXAMPLES.find((e) => e.id === 'small') ?? PRICE_EXAMPLES[0];
  if (!small) return [];
  const price = (port: number, instances: number): number => {
    const spec: FluxAppSpec = {
      ...small.spec,
      instances,
      compose: small.spec.compose.map((c) => ({ ...c, ports: [port] })),
    };
    return (
      quote(spec, BAKED_PRICING.params, {
        months: 1,
        fluxUsd: BAKED_PRICING.fluxUsd,
        paramsSource: 'baked',
      }).usdTotal ?? Number.NaN
    );
  };
  return counts.map((n) => {
    const free = price(FREE_PORT_EXAMPLE, n);
    const fee = price(FEE_PORT_EXAMPLES.web, n);
    return { instances: n, free, fee, added: Math.round((fee - free) * 100) / 100 }; // literal: cents
  });
}

/** The monthly USD price of an example at each instance count of the curve table. */
export function curveFor(example: PriceExample): number[] {
  return CURVE_INSTANCES.map((n) => priceFor(example, n, 1).usdTotal ?? Number.NaN);
}

export type { PriceSize };

// ---------------------------------------------------------------------------
// Spec Forge link
// ---------------------------------------------------------------------------

/**
 * A link that opens a spec in Spec Forge. The forge reads `#s=<payload>`, where a payload that starts
 * with `r.` is the JSON itself in base64url (the form for browsers without CompressionStream).
 */
export function forgeShareLink(spec: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(spec));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `/labs/spec-forge#s=r.${b64}`;
}

// ---------------------------------------------------------------------------
// expire
// ---------------------------------------------------------------------------

export type ExpireUnit = 'blocks' | 'days' | 'months';

export interface ExpireCalc {
  /** What was typed was a usable number. */
  valid: boolean;
  /** The subscription in blocks, rounded to a whole block. Null when `valid` is false. */
  blocks: number | null;
  /** About how long that lasts, in words. */
  about: string;
  /** The pricing months it is worth (`blocks / BLOCKS_PER_MONTH`). */
  months: number | null;
  /** The discount label the length earns ("6 percent"), or null. */
  discount: string | null;
  /** The `EXPIRE_*` lint codes the engine raises for this value. */
  codes: readonly string[];
}

/**
 * Convert a subscription length between blocks, days and pricing months, and ask the linter what it
 * thinks of the result. Days use the target block time; months are the pricing month of the calculator.
 */
export function expireCalc(unit: ExpireUnit, raw: string): ExpireCalc {
  const none: ExpireCalc = { valid: false, blocks: null, about: '', months: null, discount: null, codes: [] };
  const text = raw.trim().replace(/,/g, '');
  if (text === '' || !/^\d*\.?\d+$/.test(text)) return none;
  const value = Number(text);
  if (!Number.isFinite(value)) return none;
  const blocks =
    unit === 'blocks' ? Math.round(value) : unit === 'days' ? daysToBlocks(value) : monthsToBlocks(value);
  const months = blocks / monthsToBlocks(1);
  const spec = defaultSpec();
  spec.expire = blocks;
  const codes = lintSpec(spec)
    .issues.map((i) => i.code)
    .filter((c) => c.startsWith('EXPIRE_'));
  return {
    valid: true,
    blocks,
    about: humanDuration(blocksToSeconds(blocks)),
    months,
    discount: durationDiscount(months)?.label ?? null,
    codes: [...new Set(codes)],
  };
}

// ---------------------------------------------------------------------------
// The annotated example
// ---------------------------------------------------------------------------

export interface AnnotatedLine {
  text: string;
  /** The key this line names, or null. */
  key: string | null;
  /** The field row the line belongs to (`component-ports`), or null for braces and the like. */
  field: string | null;
  /** Which scope the key sits in, when `key` is not null. */
  scope: 'app' | 'component' | null;
}

const KEY_LINE = /^( *)"([^"\\]+)":/;

/**
 * Pretty print a spec and tag every line with the field it belongs to. A line of an array or an object
 * that sits under a key belongs to that key, so highlighting `ports` lights all its lines.
 */
export function annotateSpec(spec: unknown): AnnotatedLine[] {
  const lines = JSON.stringify(spec, null, 2).split('\n');
  const appKeys = new Set(LIMITS.appKeys);
  const componentKeys = new Set(LIMITS.componentKeys);
  const stack: { indent: number; field: string | null }[] = [];
  const out: AnnotatedLine[] = [];
  for (const text of lines) {
    const indent = text.length - text.trimStart().length;
    const m = KEY_LINE.exec(text);
    if (m) {
      const key = m[2] ?? '';
      while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? -1) >= indent) stack.pop();
      const inCompose = stack.some((s) => s.field === 'app-compose');
      let scope: AnnotatedLine['scope'] = null;
      if (indent === 2 && appKeys.has(key))
        scope = 'app'; // literal: indentation of top level keys
      else if (inCompose && indent === 6 && componentKeys.has(key)) scope = 'component'; // literal: indentation of component keys
      const field = scope ? `${scope}-${key}` : null;
      stack.push({ indent, field });
      out.push({ text, key: scope ? key : null, field, scope });
      continue;
    }
    const trimmed = text.trim();
    if (/^[\]}],?$/.test(trimmed)) {
      while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? -1) > indent) stack.pop();
      const top = stack[stack.length - 1];
      out.push({ text, key: null, field: top?.field ?? null, scope: null });
      if (top && top.indent === indent) stack.pop();
      continue;
    }
    const top = stack[stack.length - 1];
    out.push({ text, key: null, field: top?.field ?? null, scope: null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The validate box
// ---------------------------------------------------------------------------

export type ValidateResult =
  | { kind: 'empty' }
  | { kind: 'syntax'; message: string; line: number | null; column: number | null }
  | { kind: 'report'; report: LintReport; spec: unknown };

/** The longest text the box lints. The engine copes with more; the page should not freeze on a paste. */
export const VALIDATE_MAX_CHARS = 60000;

/** Where `position` falls in `text`, as a 1-based line and column. */
export function lineColumn(text: string, position: number): { line: number; column: number } {
  const upTo = text.slice(0, Math.max(0, position));
  const lines = upTo.split('\n');
  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

/** Parse pasted JSON and lint it. Never throws. A syntax error says where it is. */
export function validateText(text: string): ValidateResult {
  if (text.trim() === '') return { kind: 'empty' };
  if (text.length > VALIDATE_MAX_CHARS) {
    return {
      kind: 'syntax',
      message: `That is longer than ${VALIDATE_MAX_CHARS} characters, which is more than a spec needs.`,
      line: null,
      column: null,
    };
  }
  let spec: unknown;
  try {
    spec = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The text is not valid JSON.';
    const at = /position (\d+)/.exec(message);
    const where = at?.[1] !== undefined ? lineColumn(text, Number(at[1])) : null;
    return {
      kind: 'syntax',
      message: message.replace(/ in JSON at position \d+.*$/, ''),
      line: where?.line ?? null,
      column: where?.column ?? null,
    };
  }
  return { kind: 'report', report: lintSpec(spec), spec };
}
