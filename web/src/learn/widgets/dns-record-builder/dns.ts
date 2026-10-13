/**
 * The DNS rules behind the record builder, as pure functions: normalise the lesson's case, turn what the
 * learner typed into the record a provider would store, judge whether that record points the domain at the
 * Flux app, and say what a resolver would see. No React, no DOM.
 *
 * What is a Flux fact here (docs/research/FACTS.md 6.4 and 9.7):
 *   - a custom domain is a CNAME from your domain to `<name>.app.runonflux.io`, and an A record to FDM's
 *     addresses also works because FDM looks at the domain's A answer;
 *   - the domain must also be listed in the component's `domains`, index aligned with `ports`, and FDM adds
 *     `www.<domain>` and `test.<domain>` itself;
 *   - FDM requests a certificate only while the domain resolves to FDM; with the Cloudflare proxy on it sees
 *     "not pointed" and issues none, and Cloudflare's own certificate serves visitors. That the SSL mode
 *     "Full" is the one to try (and "Flexible" can loop) is an INFERENCE that FACTS marks UNVERIFIED.
 * What is general DNS knowledge, not a Flux fact, and is labelled that way in the UI:
 *   - a CNAME cannot share a name with other records, so it cannot sit at the zone apex; providers offer
 *     ALIAS or ANAME records, or flatten a CNAME at the root, or you use an A record;
 *   - resolvers cache an answer until its time to live runs out;
 *   - how a provider treats the name you type (many append your domain to it).
 *
 * Every address in a simulated answer is from a documentation range (RFC 5737), never a real Flux address.
 */

import { LIMITS } from '@shared/flux';

// ---------------------------------------------------------------------------
// Constants of the simulation
// ---------------------------------------------------------------------------

/** FACTS 6.4: production zone `app`. */
export const APP_DOMAIN_SUFFIX = LIMITS.appDomainSuffix;

/** FACTS 6.4 (a DoH lookup of an app domain returned a CNAME to fdm-lb-1-2.runonflux.io). Same as the lesson's dig fixture. */
export const FDM_HOST = 'fdm-lb-1-2.runonflux.io';

/** A documentation address (RFC 5737). The same one the custom-domains terminal fixture answers with. */
export const FDM_ADDRESS = '203.0.113.40';

/** Documentation addresses standing in for the proxy's addresses. */
export const PROXY_ADDRESSES: readonly string[] = ['198.51.100.21', '198.51.100.22'];

/** Default simulated TTL, in seconds, when the record says "Auto". */
export const AUTO_TTL = 300;

const SECOND_LEVEL = ['co', 'com', 'org', 'net', 'gov', 'ac', 'edu'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecordType = 'A' | 'CNAME' | 'ALIAS' | 'TXT' | 'MX';
export type Provider = 'cloudflare' | 'namecheap' | 'generic';
export type DomainKind = 'subdomain' | 'apex';

/** What the lesson asks for. */
export interface DnsCase {
  /** The custom domain, lower case, no scheme, no trailing dot. */
  domain: string;
  kind: DomainKind;
  /** The provider the lesson fixed, or null when the learner may choose. */
  provider: Provider | null;
  /** The Flux app name. */
  appName: string;
}

/** What the learner typed, exactly as they typed it. */
export interface Draft {
  type: RecordType;
  name: string;
  value: string;
  /** Seconds, or `auto` for the provider's default. */
  ttl: number | 'auto';
  /** Cloudflare only: send traffic through the proxy (the orange cloud). */
  proxied: boolean;
}

export type Severity = 'error' | 'warning' | 'info';

export interface DnsIssue {
  code: string;
  severity: Severity;
  field: 'type' | 'name' | 'value' | 'ttl' | 'proxy' | 'record';
  /** What is wrong, in one kind sentence. */
  message: string;
  /** What to do about it. */
  fix?: string;
  /** True when the sentence is the learner's to verify, not an established Flux fact. */
  inference?: boolean;
}

/** One link of the answer a resolver follows. */
export interface Hop {
  name: string;
  /** `NXDOMAIN` and `NODATA` are resolver statuses rather than records. */
  type: 'CNAME' | 'A' | 'NXDOMAIN' | 'NODATA';
  data: string;
  ttl: number;
  /** Who controls this link: your record, the provider (flattening, the proxy), Flux, or DNS itself (a name that does not exist). */
  owner: 'you' | 'provider' | 'flux' | 'dns';
  /** False for the link where the chain breaks. */
  ok: boolean;
  note?: string;
}

export type Outcome =
  /** The domain resolves to Flux's load balancer. */
  | 'flux'
  /** It resolves to the provider's proxy, which forwards to Flux. */
  | 'flux-proxied'
  /** It resolves, but not to Flux. */
  | 'elsewhere'
  /** A name in the chain does not exist. */
  | 'nxdomain'
  /** The name exists but has no address record. */
  | 'no-answer'
  /** The provider would not save the record. */
  | 'refused'
  /** Nothing typed yet. */
  | 'empty';

export interface Stored {
  /** The fully qualified name the record ends up under. */
  fqdn: string;
  type: RecordType;
  value: string;
  ttl: number;
}

export interface Evaluation {
  /** The record points the case's domain at the app. This is the widget's done condition. */
  correct: boolean;
  outcome: Outcome;
  issues: DnsIssue[];
  hops: Hop[];
  stored: Stored | null;
  /** True when the record is reached through the provider's proxy. */
  proxied: boolean;
}

export interface ProviderInfo {
  id: Provider;
  label: string;
  nameLabel: string;
  /** Wording for the value field, by record type. */
  valueLabel: (type: RecordType) => string;
  /** The label of each record type in this provider's type menu. */
  typeLabel: (type: RecordType) => string;
  types: readonly RecordType[];
  /** The provider adds your domain to whatever you type in the name field. */
  appendsZone: boolean;
  /** A CNAME at the zone root is accepted and answered with addresses. */
  flattensRootCname: boolean;
  /** The provider has a proxy switch. */
  proxy: boolean;
  autoLabel: string;
  /** One sentence on what is different here. General provider behaviour, not Flux documentation. */
  quirk: string;
}

export const PROVIDERS: Readonly<Record<Provider, ProviderInfo>> = {
  cloudflare: {
    id: 'cloudflare',
    label: 'Cloudflare',
    nameLabel: 'Name',
    valueLabel: (t) =>
      t === 'A' ? 'IPv4 address' : t === 'MX' ? 'Mail server' : t === 'TXT' ? 'Content' : 'Target',
    typeLabel: (t) => t,
    types: ['A', 'CNAME', 'TXT', 'MX'],
    appendsZone: false,
    flattensRootCname: true,
    proxy: true,
    autoLabel: 'Auto',
    quirk:
      'Flux documents Cloudflare as the example provider: a CNAME named @ or a subdomain, with the proxy switched on. At the root Cloudflare answers with addresses instead of the CNAME, and it accepts the full domain in the Name field.',
  },
  namecheap: {
    id: 'namecheap',
    label: 'Namecheap',
    nameLabel: 'Host',
    valueLabel: (t) =>
      t === 'A' ? 'IP address' : t === 'MX' ? 'Mail server' : t === 'TXT' ? 'Value' : 'Target',
    typeLabel: (t) => (t === 'ALIAS' ? 'ALIAS Record' : `${t} Record`),
    types: ['A', 'CNAME', 'ALIAS', 'TXT', 'MX'],
    appendsZone: true,
    flattensRootCname: false,
    proxy: false,
    autoLabel: 'Automatic',
    quirk:
      'The field is called Host and holds only the part before your domain, with @ for the bare domain. A CNAME cannot be saved at @, so the bare domain uses an ALIAS record or an A record.',
  },
  generic: {
    id: 'generic',
    label: 'Another provider',
    nameLabel: 'Name',
    valueLabel: (t) =>
      t === 'A' ? 'IPv4 address' : t === 'MX' ? 'Mail server' : t === 'TXT' ? 'Text' : 'Value',
    typeLabel: (t) => (t === 'ALIAS' ? 'ALIAS / ANAME' : t),
    types: ['A', 'CNAME', 'ALIAS', 'TXT', 'MX'],
    appendsZone: true,
    flattensRootCname: false,
    proxy: false,
    autoLabel: 'Default',
    quirk:
      'Most providers add your domain to the end of what you type in the name field, and many refuse a CNAME at the bare domain. Some call the workaround ALIAS, some ANAME, some a flattened CNAME.',
  },
};

export const TTL_CHOICES: readonly { value: number | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Provider default' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 14400, label: '4 hours' },
  { value: 86400, label: '1 day' },
];

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

const HOST_LABEL = /^(?!-)[a-z0-9_-]{1,63}(?<!-)$/;

/** Lower case, trimmed, no scheme, no trailing dot. Does not validate. */
export function cleanName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\.+$/, '');
}

export function isIPv4(s: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return false;
  return m.slice(1).every((part) => Number(part) <= 255 && String(Number(part)) === part);
}

/** A plausible host name: dot separated labels of letters, digits and hyphens, at least two labels. */
export function isHostname(s: string): boolean {
  if (s.length === 0 || s.length > 253) return false;
  const labels = s.split('.');
  if (labels.length < 2) return false;
  return labels.every((l) => HOST_LABEL.test(l));
}

/** The DNS zone a domain belongs to: its last two labels, or three under a short second level (co.uk). */
export function zoneOf(domain: string): string {
  const labels = cleanName(domain).split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const last = labels[labels.length - 1] ?? '';
  const second = labels[labels.length - 2] ?? '';
  if (last.length === 2 && SECOND_LEVEL.includes(second)) return labels.slice(-3).join('.');
  return labels.slice(-2).join('.');
}

/** True for the bare domain of a zone. */
export function isApex(domain: string): boolean {
  const d = cleanName(domain);
  return d !== '' && zoneOf(d) === d;
}

/** The name as most providers want it: `@` for the apex, otherwise the labels left of the zone. */
export function relativeName(domain: string): string {
  const d = cleanName(domain);
  const zone = zoneOf(d);
  if (d === zone) return '@';
  return d.slice(0, d.length - zone.length - 1);
}

/** `<name>.app.runonflux.io`, lower cased as FDM does (FACTS 3.8). */
export function appDomainOf(appName: string): string {
  return `${appName.toLowerCase()}.${APP_DOMAIN_SUFFIX}`;
}

// ---------------------------------------------------------------------------
// The case: lesson props, normalised
// ---------------------------------------------------------------------------

export const DEFAULT_APP = 'lanternshop';
export const DEFAULT_SUBDOMAIN = 'shop.example.com';
export const DEFAULT_APEX = 'example.com';

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function asKind(v: unknown): DomainKind | null {
  return v === 'subdomain' || v === 'apex' ? v : null;
}

function asProvider(v: unknown): Provider | null {
  return v === 'cloudflare' || v === 'namecheap' || v === 'generic' ? v : null;
}

/**
 * Read the widget's props. Two shapes are accepted, because the brief and the lessons differ:
 *   { case: { domain, kind, provider? }, appName? }                  the object form
 *   { case: 'subdomain' | 'apex', domain?, app?, provider? }          the flat form the lessons use
 * Either may also carry `appName` or `app`. The domain's own shape decides the kind when both are given.
 */
export function readCase(props: Record<string, unknown> | undefined): DnsCase {
  const raw = props ?? {};
  const c = raw.case;
  let domain: string | null = null;
  let kind: DomainKind | null = null;
  let provider: Provider | null = asProvider(raw.provider);

  if (typeof c === 'object' && c !== null && !Array.isArray(c)) {
    const o = c as Record<string, unknown>;
    domain = str(o.domain);
    kind = asKind(o.kind);
    provider = asProvider(o.provider) ?? provider;
  } else if (typeof c === 'string') {
    kind = asKind(c);
    if (!kind && c.includes('.')) domain = c;
  }
  domain = domain ?? str(raw.domain);
  kind = kind ?? asKind(raw.kind);

  if (domain) domain = cleanName(domain);
  if (!domain) domain = kind === 'apex' ? DEFAULT_APEX : DEFAULT_SUBDOMAIN;
  // The domain's own shape is what DNS cares about.
  const shape: DomainKind = isApex(domain) ? 'apex' : 'subdomain';

  const appName = str(raw.appName) ?? str(raw.app) ?? DEFAULT_APP;
  return { domain, kind: shape, provider, appName };
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export function emptyDraft(provider: Provider): Draft {
  return { type: 'CNAME', name: '', value: '', ttl: 'auto', proxied: PROVIDERS[provider].proxy };
}

/** The record that is correct for a case at a provider: what "Show me" fills in. */
export function solutionFor(c: DnsCase, provider: Provider): Draft {
  const p = PROVIDERS[provider];
  const target = appDomainOf(c.appName);
  const name = relativeName(c.domain);
  if (c.kind === 'subdomain') {
    return { type: 'CNAME', name, value: target, ttl: 'auto', proxied: p.proxy };
  }
  if (p.flattensRootCname) return { type: 'CNAME', name, value: target, ttl: 'auto', proxied: p.proxy };
  if (p.types.includes('ALIAS')) return { type: 'ALIAS', name, value: target, ttl: 'auto', proxied: false };
  return { type: 'A', name, value: FDM_ADDRESS, ttl: 'auto', proxied: false };
}

export function ttlSeconds(ttl: number | 'auto'): number {
  return ttl === 'auto' ? AUTO_TTL : ttl;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

interface NameResult {
  fqdn: string | null;
  issues: DnsIssue[];
  /** The typed name lands on the case's domain. */
  hits: boolean;
}

function judgeName(draft: Draft, c: DnsCase, p: ProviderInfo): NameResult {
  const zone = zoneOf(c.domain);
  const typed = cleanName(draft.name);
  const issues: DnsIssue[] = [];
  const expectRel = relativeName(c.domain);
  const field = p.nameLabel;

  if (typed === '') {
    issues.push({
      code: 'NAME_EMPTY',
      severity: 'error',
      field: 'name',
      message: `The ${field.toLowerCase()} is empty, so the provider does not know which name this record is for.`,
      fix:
        c.kind === 'apex'
          ? `Type @, which stands for the bare domain ${c.domain}.`
          : `For ${c.domain}, type ${expectRel}.`,
    });
    return { fqdn: null, issues, hits: false };
  }

  if (typed !== '@' && !/^[a-z0-9_*]([a-z0-9_.*-]*[a-z0-9_*])?$/.test(typed)) {
    issues.push({
      code: 'NAME_FORMAT',
      severity: 'error',
      field: 'name',
      message:
        'Names are made of letters, digits and hyphens, separated by dots. This has something else in it.',
      fix: c.kind === 'apex' ? 'Type @ for the bare domain.' : `For ${c.domain}, type ${expectRel}.`,
    });
    return { fqdn: null, issues, hits: false };
  }

  let fqdn: string;
  let doubled = false;
  if (typed === '@') {
    fqdn = zone;
  } else if (typed === zone) {
    if (p.appendsZone) {
      fqdn = `${zone}.${zone}`;
      doubled = true;
    } else fqdn = zone;
  } else if (typed.endsWith(`.${zone}`)) {
    if (p.appendsZone) {
      fqdn = `${typed}.${zone}`;
      doubled = true;
    } else fqdn = typed;
  } else {
    fqdn = `${typed}.${zone}`;
  }

  const hits = fqdn === c.domain;
  if (doubled) {
    issues.push({
      code: 'NAME_DOUBLED',
      severity: 'error',
      field: 'name',
      message: `Most providers add ${zone} to the end of what you type, so this record would be for ${fqdn}, not for ${c.domain}.`,
      fix: c.kind === 'apex' ? 'Type @ and leave the domain out.' : `Type only ${expectRel}.`,
    });
  } else if (!hits) {
    if (typed === '@' && c.kind === 'subdomain') {
      issues.push({
        code: 'NAME_IS_APEX',
        severity: 'error',
        field: 'name',
        message: `@ is the bare domain ${zone}. This record is for ${zone} itself, not for ${c.domain}.`,
        fix: `In the ${field} field, type ${expectRel}.`,
      });
    } else if (c.kind === 'apex') {
      issues.push({
        code: 'NAME_NOT_APEX',
        severity: 'error',
        field: 'name',
        message: `${fqdn} is a subdomain. The record you want is for the bare domain ${c.domain}.`,
        fix: 'Type @ in the name field.',
      });
    } else {
      issues.push({
        code: 'NAME_OTHER',
        severity: 'error',
        field: 'name',
        message: `This record is for ${fqdn}, not for ${c.domain}, so nobody asking for ${c.domain} will find it.`,
        fix: `In the ${field} field, type ${expectRel}.`,
      });
    }
  }
  return { fqdn, issues, hits };
}

interface TargetJudgement {
  /** The value is a usable name that leads to the app. */
  ok: boolean;
  /** The value, cleaned. */
  target: string;
  issues: DnsIssue[];
  /** The chain breaks because the name does not exist. */
  nxdomain: boolean;
  /** The target is a name that is not Flux. */
  notFlux: boolean;
}

function judgeTarget(raw: string, c: DnsCase, appDomain: string): TargetJudgement {
  const issues: DnsIssue[] = [];
  const empty: TargetJudgement = { ok: false, target: '', issues, nxdomain: false, notFlux: false };
  if (raw.trim() === '') {
    issues.push({
      code: 'VALUE_EMPTY',
      severity: 'error',
      field: 'value',
      message: 'The target is empty, so the record points at nothing.',
      fix: `Type the free address of your app: ${appDomain}.`,
    });
    return empty;
  }
  const t = cleanName(raw);
  if (/\s/.test(t)) {
    issues.push({
      code: 'VALUE_FORMAT',
      severity: 'error',
      field: 'value',
      message: 'A host name has no spaces in it.',
      fix: `Type ${appDomain} with nothing around it.`,
    });
    return { ...empty, target: t };
  }
  if (/^https?:\/\//i.test(raw.trim()) || t.includes('/') || /:\d+$/.test(t)) {
    issues.push({
      code: 'VALUE_NOT_HOST',
      severity: 'error',
      field: 'value',
      message:
        'A DNS record holds a host name, not a web address. A scheme (https://), a path or a port has no place in it.',
      fix: `Type only the name: ${appDomain}.`,
    });
    return { ...empty, target: t };
  }
  if (isIPv4(t)) {
    issues.push({
      code: 'VALUE_IS_ADDRESS',
      severity: 'error',
      field: 'value',
      message: 'A CNAME holds a name, not an address. An address belongs in an A record.',
      fix: `Point the CNAME at ${appDomain}, or switch the type to A.`,
    });
    return { ...empty, target: t };
  }
  if (t === c.domain) {
    issues.push({
      code: 'VALUE_LOOP',
      severity: 'error',
      field: 'value',
      message: 'This points the domain at itself, so a resolver would go around in a circle.',
      fix: `The target is the free address of the app: ${appDomain}.`,
    });
    return { ...empty, target: t };
  }
  if (!isHostname(t)) {
    const bare = t === c.appName.toLowerCase();
    issues.push({
      code: bare ? 'VALUE_INCOMPLETE' : 'VALUE_FORMAT',
      severity: 'error',
      field: 'value',
      message: bare
        ? `${t} is only the app name. A target needs the whole address, with .${APP_DOMAIN_SUFFIX} at the end.`
        : `${t} does not look like a host name.`,
      fix: `Type ${appDomain}.`,
    });
    return { ...empty, target: t };
  }
  if (t === appDomain) return { ok: true, target: t, issues, nxdomain: false, notFlux: false };

  const base = c.appName.toLowerCase();
  const portForm = new RegExp(
    `^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\d{1,5}\\.${APP_DOMAIN_SUFFIX.replace(/\./g, '\\.')}$`,
  );
  if (portForm.test(t)) {
    issues.push({
      code: 'VALUE_PORT_ADDRESS',
      severity: 'error',
      field: 'value',
      message:
        'That is the address of one port of your app. The domains entry in the spec is what ties your domain to a port, and the documented target is the plain app address.',
      fix: `Use ${appDomain}.`,
    });
    return { ok: false, target: t, issues, nxdomain: false, notFlux: false };
  }
  if (t.endsWith(`.${APP_DOMAIN_SUFFIX}`)) {
    issues.push({
      code: 'VALUE_WRONG_APP',
      severity: 'error',
      field: 'value',
      message: `That is a Flux app address, but not the address of your app. If no app is registered under that name, it does not exist and nothing resolves.`,
      fix: `Yours is ${appDomain}. Compare it letter by letter.`,
    });
    return { ok: false, target: t, issues, nxdomain: true, notFlux: false };
  }
  if (t.startsWith(`${base}.app.`) && t.includes('runonflux.')) {
    issues.push({
      code: 'VALUE_WRONG_TLD',
      severity: 'error',
      field: 'value',
      message: t.endsWith('.app.runonflux.com')
        ? `Flux app addresses end in .io. \`*.app.runonflux.com\` did not resolve when checked on 2026-10-13, so nothing would resolve here.`
        : `Flux app addresses end in .io, so this is not your app's address.`,
      fix: `Change the ending to ${appDomain}.`,
    });
    return { ok: false, target: t, issues, nxdomain: true, notFlux: false };
  }
  if (t.endsWith('.runonflux.com') || t.endsWith('.runonflux.io')) {
    issues.push({
      code: 'VALUE_FLUX_OTHER',
      severity: 'error',
      field: 'value',
      message:
        'That is a Flux host name, but it is not the free address of your app, which is the target Flux documents.',
      fix: `Use ${appDomain}.`,
    });
    return { ok: false, target: t, issues, nxdomain: false, notFlux: true };
  }
  issues.push({
    code: 'VALUE_NOT_FLUX',
    severity: 'error',
    field: 'value',
    message: `${t} is not a Flux address, so visitors would be sent there and not to your app.`,
    fix: `The target is the free address of your app: ${appDomain}.`,
  });
  return { ok: false, target: t, issues, nxdomain: false, notFlux: true };
}

/** What the free app address resolves to: always the same two Flux links. */
function fluxTail(appDomain: string): Hop[] {
  return [
    { name: appDomain, type: 'CNAME', data: FDM_HOST, ttl: AUTO_TTL, owner: 'flux', ok: true },
    { name: FDM_HOST, type: 'A', data: FDM_ADDRESS, ttl: AUTO_TTL, owner: 'flux', ok: true },
  ];
}

/** The free address resolved on its own: what you read when you need the address for an A record. */
export function freeAddressChain(appName: string): Hop[] {
  return fluxTail(appDomainOf(appName));
}

/**
 * Judge a draft against a case at a provider, and say what a resolver would see. Never throws.
 */
export function evaluate(draft: Draft, c: DnsCase, provider: Provider): Evaluation {
  const p = PROVIDERS[provider];
  const appDomain = appDomainOf(c.appName);
  const ttl = ttlSeconds(draft.ttl);
  const issues: DnsIssue[] = [];

  const blank = draft.name.trim() === '' && draft.value.trim() === '';
  if (blank) {
    return { correct: false, outcome: 'empty', issues, hops: [], stored: null, proxied: false };
  }

  // Type must be one this provider offers (the menu cannot produce another, but props might).
  const type: RecordType = p.types.includes(draft.type) ? draft.type : (p.types[0] ?? 'A');

  const name = judgeName(draft, c, p);
  issues.push(...name.issues);

  // Value and type.
  let valueOk = false;
  let flattened = false;
  let viaAddress = false;
  let nxdomain = false;
  let target = '';
  let valueClean = cleanName(draft.value);
  let refused = false;

  if (type === 'CNAME' || type === 'ALIAS') {
    const t = judgeTarget(draft.value, c, appDomain);
    issues.push(...t.issues);
    valueOk = t.ok;
    nxdomain = t.nxdomain;
    target = t.target;
    valueClean = t.target;
    const atApex = name.fqdn !== null && name.fqdn === zoneOf(c.domain);
    if (type === 'CNAME' && atApex && !p.flattensRootCname) {
      refused = true;
      issues.push({
        code: 'APEX_CNAME',
        severity: 'error',
        field: 'type',
        message:
          "A CNAME cannot sit at the apex of a zone. The bare domain also has to carry the zone's own records, and a CNAME may not share a name with any other record, so providers refuse it.",
        fix: p.types.includes('ALIAS')
          ? `Use an ${PROVIDERS[provider].typeLabel('ALIAS')} record (some providers say flattened CNAME), or an A record.`
          : "Use the provider's flattening feature if it has one, or an A record.",
      });
    }
    flattened = type === 'ALIAS' || (atApex && type === 'CNAME' && p.flattensRootCname);
  } else if (type === 'A') {
    viaAddress = true;
    if (draft.value.trim() === '') {
      issues.push({
        code: 'VALUE_EMPTY',
        severity: 'error',
        field: 'value',
        message: 'The address is empty, so the record points at nothing.',
        fix: `Look up ${appDomain} and use the address it answers with.`,
      });
    } else if (!isIPv4(valueClean)) {
      issues.push({
        code: 'A_NEEDS_ADDRESS',
        severity: 'error',
        field: 'value',
        message: 'An A record holds an IPv4 address such as 203.0.113.40. A name belongs in a CNAME record.',
        fix:
          c.kind === 'apex'
            ? `Type the address that ${appDomain} resolves to, or use an ALIAS or flattened CNAME to ${appDomain}.`
            : `Switch the type to CNAME and point it at ${appDomain}.`,
      });
    } else if (valueClean !== FDM_ADDRESS) {
      issues.push({
        code: 'A_NOT_FLUX',
        severity: 'error',
        field: 'value',
        message: `${valueClean} is not an address that ${appDomain} resolves to, so visitors would reach some other server.`,
        fix: `Look up ${appDomain} and copy the address from the last line of the answer.`,
      });
    } else {
      valueOk = true;
      issues.push({
        code: 'A_UPKEEP',
        severity: 'info',
        field: 'value',
        message:
          "An A record works because FDM looks at the domain's A answer. The address is yours to keep current, whereas a CNAME follows the app address by itself.",
      });
    }
  } else {
    issues.push({
      code: 'TYPE_NO_ADDRESS',
      severity: 'error',
      field: 'type',
      message:
        type === 'TXT'
          ? 'A TXT record holds text. It never sends a visitor anywhere, so the domain would still have no address.'
          : 'An MX record names a mail server. It does not send visitors to a web app.',
      fix:
        c.kind === 'apex'
          ? 'Use an ALIAS record, a flattened CNAME or an A record.'
          : `Use a CNAME record that points at ${appDomain}.`,
    });
  }

  // Proxy (Cloudflare only).
  const proxied = p.proxy && draft.proxied && (type === 'A' || type === 'CNAME');
  if (p.proxy && type !== 'A' && type !== 'CNAME' && draft.proxied) {
    issues.push({
      code: 'PROXY_TYPE',
      severity: 'info',
      field: 'proxy',
      message: 'Only A and CNAME records can go through the proxy.',
    });
  }

  const hits = name.hits;
  const correct = hits && valueOk && !refused && !issues.some((i) => i.severity === 'error');

  // What the provider would store.
  let stored: Stored | null = null;
  if (name.fqdn !== null && !refused && (draft.value.trim() !== '' || type === 'TXT' || type === 'MX')) {
    stored = { fqdn: name.fqdn, type, value: valueClean, ttl };
  }

  // What a resolver sees when it asks for the case's domain.
  const hops: Hop[] = [];
  let outcome: Outcome;
  const asked = c.domain;

  if (refused) {
    outcome = 'refused';
  } else if (!hits || stored === null) {
    outcome = c.kind === 'apex' ? 'no-answer' : 'nxdomain';
    hops.push({
      name: asked,
      type: c.kind === 'apex' ? 'NODATA' : 'NXDOMAIN',
      data: c.kind === 'apex' ? 'the name exists but has no address record' : 'no such name',
      ttl,
      owner: 'provider',
      ok: false,
    });
  } else if (type === 'TXT' || type === 'MX') {
    outcome = 'no-answer';
    hops.push({
      name: asked,
      type: 'NODATA',
      data: 'the name exists but has no address record',
      ttl,
      owner: 'provider',
      ok: false,
    });
  } else if (viaAddress) {
    if (valueOk) {
      outcome = 'flux';
      hops.push({ name: asked, type: 'A', data: FDM_ADDRESS, ttl, owner: 'you', ok: true });
    } else if (isIPv4(valueClean)) {
      outcome = 'elsewhere';
      hops.push({
        name: asked,
        type: 'A',
        data: valueClean,
        ttl,
        owner: 'you',
        ok: false,
        note: 'not a Flux address',
      });
    } else {
      outcome = 'no-answer';
      hops.push({
        name: asked,
        type: 'NODATA',
        data: 'the record is not a usable address',
        ttl,
        owner: 'provider',
        ok: false,
      });
    }
  } else if (flattened) {
    if (valueOk) {
      outcome = 'flux';
      hops.push({
        name: asked,
        type: 'A',
        data: FDM_ADDRESS,
        ttl,
        owner: 'provider',
        ok: true,
        note: `flattened from ${appDomain}`,
      });
    } else if (nxdomain) {
      outcome = 'nxdomain';
      hops.push({
        name: asked,
        type: 'NXDOMAIN',
        data: `${target}: no such name (simulated)`,
        ttl,
        owner: 'provider',
        ok: false,
      });
    } else {
      outcome = 'elsewhere';
      hops.push({
        name: asked,
        type: 'NODATA',
        data: `${target} is not a Flux name`,
        ttl,
        owner: 'provider',
        ok: false,
      });
    }
  } else {
    // A CNAME chain.
    hops.push({ name: asked, type: 'CNAME', data: target, ttl, owner: 'you', ok: valueOk });
    if (valueOk) {
      outcome = 'flux';
      hops.push(...fluxTail(appDomain));
    } else if (nxdomain) {
      outcome = 'nxdomain';
      hops.push({
        name: target,
        type: 'NXDOMAIN',
        data: 'no such name',
        ttl: AUTO_TTL,
        owner: 'flux',
        ok: false,
      });
    } else {
      outcome = 'elsewhere';
      hops.push({
        name: target || asked,
        type: 'NODATA',
        data: 'not a Flux name, so the answer leads away from your app',
        ttl: AUTO_TTL,
        owner: 'provider',
        ok: false,
      });
    }
  }

  // The proxy replaces the visible answer with the provider's own addresses.
  let finalOutcome: Outcome = outcome;
  let finalHops = hops;
  if (proxied && hits && valueOk && outcome === 'flux') {
    finalOutcome = 'flux-proxied';
    finalHops = PROXY_ADDRESSES.map((addr) => ({
      name: asked,
      type: 'A' as const,
      data: addr,
      ttl: AUTO_TTL,
      owner: 'provider' as const,
      ok: true,
      note: 'Cloudflare address, the proxy forwards to your target',
    }));
  }

  // Teaching notes that depend on the whole record.
  if (correct) {
    if (finalOutcome === 'flux-proxied') {
      issues.push({
        code: 'PROXY_CERT',
        severity: 'info',
        field: 'proxy',
        message:
          "With the proxy on, a resolver gets Cloudflare's addresses, not Flux's. FDM then sees the domain as not pointed at it and issues no certificate, and Cloudflare's own certificate serves your visitors. Flux's docs show the proxy switched on.",
      });
      issues.push({
        code: 'PROXY_SSL_MODE',
        severity: 'info',
        field: 'proxy',
        message:
          "Which Cloudflare SSL mode to pick is not in Flux's docs. Reasoning from FDM's redirect of port 80 to HTTPS, Full is the one to try and Flexible may loop.",
        inference: true,
      });
    }
    issues.push({
      code: 'TTL_CACHE',
      severity: 'info',
      field: 'ttl',
      message:
        'Resolvers keep an answer until its time to live runs out, so a record you fix later can still look wrong for that long.',
    });
  }

  return { correct, outcome: finalOutcome, issues, hops: finalHops, stored, proxied };
}

// ---------------------------------------------------------------------------
// The other half: the spec's domains entry
// ---------------------------------------------------------------------------

/** The public ports of the demo component the second step edits. Index aligned with `containerPorts`. */
export const DEMO_PORTS: readonly { port: number; containerPort: number; label: string }[] = [
  { port: 31000, containerPort: 80, label: 'the website' },
  { port: 31001, containerPort: 9090, label: 'the metrics page' },
];

/** `domains` for the demo component: the domain on the chosen port, an empty string elsewhere. */
export function domainsFor(domain: string, portIndex: number, count = DEMO_PORTS.length): string[] {
  return Array.from({ length: count }, (_, i) => (i === portIndex ? domain : ''));
}
