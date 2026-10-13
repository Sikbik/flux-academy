/**
 * The draft of a registration in the FluxCloud simulator, and the rules that connect FluxCloud's two forms
 * (Simple and Advanced) to one Flux app spec. Pure functions only: no React, no DOM.
 *
 * Everything quoted from FluxCloud comes from docs/research/FACTS.md section 9 (9.4.2 Simple mode, 9.4.3
 * Advanced mode, 9.5 payment). Prices, validation and durations are never computed here: they come from
 * `shared/flux` (`quote`, `lintSpec`, the blocks helpers).
 *
 * Where the real UI's behaviour is not in FACTS, the simulator's choice is marked `// sim:`.
 */

import {
  BLOCKS_PER_MONTH,
  blocksToMonths,
  DEFAULT_EXPIRE_BLOCKS,
  daysToBlocks,
  defaultComponent,
  durationDiscount,
  EXAMPLE_OWNER,
  type FluxAppSpec,
  type FluxComponentSpec,
  isBannedPort,
  isSurchargePort,
  MAX_EXPIRE_BLOCKS,
  monthsToBlocks,
  parseContainerData,
} from '@shared/flux';

export type Flow = 'register' | 'manage' | 'update';
export type Account = 'sso' | 'wallet';
export type Mode = 'simple' | 'advanced';

/** The address an SSO account signs in with. example.com is reserved for documentation. */
export const SIM_EMAIL = 'you@example.com';

/**
 * Names the simulator treats as already registered, so the "already registered" refusal can be met.
 * Both are real apps named in FACTS (10.6 E15 uses `explorer`, 6.4 resolves `helloworldparams`).
 */
export const TAKEN_NAMES: readonly string[] = ['explorer', 'helloworldparams'];

/** FACTS 9.4.2: the six continent buttons of Simple mode, stored as `ac<CODE>`. */
export const CONTINENTS: readonly { code: string; label: string }[] = [
  { code: 'EU', label: 'Europe' },
  { code: 'NA', label: 'North America' },
  { code: 'SA', label: 'South America' },
  { code: 'AS', label: 'Asia' },
  { code: 'AF', label: 'Africa' },
  { code: 'OC', label: 'Oceania' },
];

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export interface Period {
  id: string;
  /** Simple mode wording (FACTS 9.4.2). */
  label: string;
  /** Advanced slider wording (FACTS 9.6 Subscription: "1 Week" to "1 Year"). */
  longLabel: string;
  blocks: number;
}

/** FACTS 5.3 "UI choices": 1 week, 2 weeks, 1 month, 3 months, 6 months, 1 year. Blocks come from the helpers. */
export const PERIODS: readonly Period[] = [
  { id: '1w', label: '1 week', longLabel: '1 Week', blocks: daysToBlocks(7) },
  { id: '2w', label: '2 weeks', longLabel: '2 Weeks', blocks: daysToBlocks(14) },
  { id: '1m', label: '1 month', longLabel: '1 Month', blocks: BLOCKS_PER_MONTH },
  { id: '3m', label: '3 months', longLabel: '3 Months', blocks: monthsToBlocks(3) },
  { id: '6m', label: '6 months', longLabel: '6 Months', blocks: monthsToBlocks(6) },
  { id: '1y', label: '1 year', longLabel: '1 Year', blocks: MAX_EXPIRE_BLOCKS },
];

/** "3% off" for a period, from the engine's duration discounts. Null when there is none. */
export function discountPercent(blocks: number): number | null {
  const d = durationDiscount(blocksToMonths(blocks));
  return d ? Math.round((1 - d.factor) * 100) : null;
}

export function periodOf(blocks: number): Period | null {
  return PERIODS.find((p) => p.blocks === blocks) ?? null;
}

/** "1 month" for a standard period, else the block count. */
export function periodLabelOf(blocks: number): string {
  return periodOf(blocks)?.label ?? `${Math.round(blocks).toLocaleString('en-US')} blocks`;
}

// ---------------------------------------------------------------------------
// Small rules of the forms
// ---------------------------------------------------------------------------

/** FACTS 9.4.2: "lowercased and stripped to a-z0-9 (no hyphens in Simple mode)". */
export function slugifyAppName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** FACTS 9.4.2: the Contact email regex. */
export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** A port row's text as an integer 1 to 65535, or null. FACTS 9.4.2: "Enter a valid port (1-65535)." */
export function parsePortRow(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d{1,5}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= 65535 ? n : null;
}

/** The exact message of FACTS 9.4.2, with the en dash the real string has. */
export const PORT_ERROR = 'Enter a valid port (1–65535).';

const SECRET_WORDS = ['secret', 'pass', 'token', 'key', 'auth', 'credential', 'seed', 'mnemonic'];

/**
 * FACTS 9.4.2: names matching secret, pass, token, api key, access key, private key, credential, auth, key,
 * seed or mnemonic trigger the Enterprise notice. (`key` already covers the three key phrases.)
 */
export function looksSecret(name: string): boolean {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SECRET_WORDS.some((w) => n.includes(w));
}

/** `KEY=value` to a pair. Anything without an `=` is a key with no value. */
export function splitEnv(entry: string): { key: string; value: string } {
  const i = entry.indexOf('=');
  return i < 0 ? { key: entry, value: '' } : { key: entry.slice(0, i), value: entry.slice(i + 1) };
}

export function joinEnv(key: string, value: string): string {
  return `${key}=${value}`;
}

/** A small stable hash, so "random" public ports are the same on every render. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * FACTS 9.4.2: "Public port is assigned for you: mirrored if allowed, else random 30000 to 39999."
 * Allowed means not banned, not a priced port (1-1023, 8080, 8081, 8443, 6667; port 0 is refused) and not already taken.
 * The "random" port is a stable function of the app name and the container port.
 */
export function assignPublicPorts(containerPorts: readonly number[], seed: string): number[] {
  const taken = new Set<number>();
  const out: number[] = [];
  for (const cp of containerPorts) {
    const ok = (p: number) =>
      p >= 1 && p <= 65535 && !isBannedPort(p) && !isSurchargePort(p) && !taken.has(p);
    let pub = cp;
    if (!ok(pub)) {
      // sim: start from a hash and walk to the first free, allowed port in 30100..39999
      let p = 30100 + (hash(`${seed}:${cp}`) % 9900);
      while (!ok(p)) p = p >= 39999 ? 30100 : p + 1;
      pub = p;
    }
    taken.add(pub);
    out.push(pub);
  }
  return out;
}

/** The free domain of the first port and of each later port. FACTS 6.4 and 9.4.2. */
export function freeDomains(name: string, publicPorts: readonly number[]): string[] {
  const n = name.toLowerCase();
  return publicPorts.map((p, i) => (i === 0 ? `${n}.app.runonflux.io` : `${n}_${p}.app.runonflux.io`));
}

// ---------------------------------------------------------------------------
// The draft
// ---------------------------------------------------------------------------

export interface Draft {
  mode: Mode;
  /** The plain spec. `enterprise` stays an empty string here; the flag below carries the intent. */
  spec: FluxAppSpec;
  /** Register as an Enterprise app (the spec is encrypted). Priced as such. */
  enterprise: boolean;
  /** Simple mode: "This image is private". */
  privateImage: boolean;
  /** Simple mode: "This app stores data", "Folder to keep" and "Keep it safe across node failures". */
  storeData: boolean;
  folder: string;
  keepSafe: boolean;
  /** Simple mode: "Run only in specific regions". */
  regionsOn: boolean;
  /** "I accept the Terms & Conditions". */
  tos: boolean;
  /** Simple mode: the text of each "Port your app listens on" row. */
  portRows: string[];
  /** Simple mode: the KEY / value rows of "Environment variables". A row with no key stays in the form only. */
  envRows: { key: string; value: string }[];
}

/** FACTS 9.4.2 seed values: version 8, 1 instance, 88000 blocks, 1 vCPU, 2000 MB, 20 GB, `/tmp`. */
export function blankDraft(account: Account): Draft {
  const comp: FluxComponentSpec = defaultComponent({
    name: '',
    description: '',
    repotag: '',
    repoauth: '',
    ports: [],
    containerPorts: [],
    domains: [],
    environmentParameters: [],
    commands: [],
    containerData: '/tmp',
    cpu: 1,
    ram: 2000,
    hdd: 20,
  });
  return {
    mode: 'simple',
    spec: {
      version: 8,
      name: '',
      description: '',
      owner: EXAMPLE_OWNER,
      instances: 1,
      staticip: false,
      enterprise: '',
      contacts: account === 'sso' ? [SIM_EMAIL] : [],
      geolocation: [],
      expire: DEFAULT_EXPIRE_BLOCKS,
      nodes: [],
      compose: [comp],
    },
    enterprise: false,
    privateImage: false,
    storeData: false,
    folder: '/data',
    keepSafe: false,
    regionsOn: false,
    tos: false,
    portRows: [''],
    envRows: [],
  };
}

/** The first component, never undefined (a draft always has one). */
export function first(spec: FluxAppSpec): FluxComponentSpec {
  return (spec.compose[0] ?? defaultComponent()) as FluxComponentSpec;
}

function withFirst(spec: FluxAppSpec, patch: Partial<FluxComponentSpec>): FluxAppSpec {
  const [head, ...rest] = spec.compose;
  return { ...spec, compose: [{ ...(head ?? defaultComponent()), ...patch }, ...rest] };
}

/** Which continents the spec allows, when its geolocation is only `ac<CODE>` entries. Otherwise null. */
export function simpleContinents(spec: FluxAppSpec): string[] | null {
  const out: string[] = [];
  for (const g of spec.geolocation) {
    const m = /^ac([A-Z]{2})$/.exec(g);
    if (!m || !CONTINENTS.some((c) => c.code === m[1])) return null;
    out.push(m[1] as string);
  }
  return out;
}

/** Why Simple mode cannot show this spec completely. Empty when it can. */
export function simpleLimits(draft: Draft): string[] {
  const out: string[] = [];
  const s = draft.spec;
  if (s.compose.length > 1) out.push(`${s.compose.length} containers (Simple mode shows the first)`);
  const c = first(s);
  if (c.commands.length > 0) out.push('commands');
  const data = parseContainerData(c.containerData);
  if (data.mounts.length > 1 || data.syncMode === 'g' || data.syncMode === 's') {
    out.push('primary and standby storage or several mounts');
  }
  if (c.domains.some((d) => d.trim() !== '')) out.push('custom domains');
  if (s.staticip) out.push('a static IP');
  if (simpleContinents(s) === null) out.push('country level location rules');
  return out;
}

/** Recompute the parts of the spec that Simple mode derives from its own switches. */
function derive(d: Draft): Draft {
  const c = first(d.spec);
  const rows = d.portRows.map(parsePortRow);
  const containerPorts = rows.filter((n): n is number => n !== null);
  // Unique container ports only: two rows with the same port would be one mapping.
  const unique = containerPorts.filter((p, i) => containerPorts.indexOf(p) === i);
  const ports = assignPublicPorts(unique, d.spec.name);
  let data = '/tmp';
  if (d.storeData) {
    const folder = d.folder.trim();
    data = `${d.keepSafe ? 'r:' : ''}${folder.length > 0 ? folder : ''}`;
  }
  let instances = d.spec.instances;
  if (d.storeData && d.keepSafe && instances < 2) instances = 2;
  const env = d.envRows.filter((r) => r.key.trim() !== '').map((r) => joinEnv(r.key.trim(), r.value));
  return {
    ...d,
    spec: {
      ...withFirst(d.spec, {
        containerPorts: unique,
        ports,
        domains: ports.map((_, i) => c.domains[i] ?? ''),
        containerData: data,
        environmentParameters: env,
      }),
      instances,
      description: d.spec.description || d.spec.name,
    },
  };
}

/** Simple mode edits. Each patch field maps to one control of the "Deploy an app" page. */
export interface SimplePatch {
  image?: string;
  privateImage?: boolean;
  repoauth?: string;
  name?: string;
  email?: string;
  portRows?: string[];
  env?: { key: string; value: string }[];
  cpu?: number;
  ram?: number;
  hdd?: number;
  storeData?: boolean;
  folder?: string;
  keepSafe?: boolean;
  copies?: number;
  regionsOn?: boolean;
  continents?: string[];
  periodBlocks?: number;
  tos?: boolean;
}

export function patchSimple(d: Draft, p: SimplePatch): Draft {
  let next: Draft = { ...d };
  let spec = next.spec;

  if (p.name !== undefined) {
    const slug = slugifyAppName(p.name);
    // sim: FACTS does not say what Simple mode calls the one component. The app name is a valid choice.
    spec = withFirst({ ...spec, name: slug, description: slug }, { name: slug });
  }
  if (p.email !== undefined) spec = { ...spec, contacts: p.email === '' ? [] : [p.email] };
  if (p.image !== undefined) spec = withFirst(spec, { repotag: p.image.trim() });
  if (p.repoauth !== undefined) spec = withFirst(spec, { repoauth: p.repoauth });
  if (p.cpu !== undefined) spec = withFirst(spec, { cpu: p.cpu });
  if (p.ram !== undefined) spec = withFirst(spec, { ram: p.ram });
  if (p.hdd !== undefined) spec = withFirst(spec, { hdd: p.hdd });
  if (p.copies !== undefined) spec = { ...spec, instances: p.copies };
  if (p.periodBlocks !== undefined) spec = { ...spec, expire: p.periodBlocks };
  if (p.continents !== undefined) {
    spec = { ...spec, geolocation: next.regionsOn || p.regionsOn ? p.continents.map((c) => `ac${c}`) : [] };
  }

  next = { ...next, spec };
  if (p.privateImage !== undefined) next.privateImage = p.privateImage;
  if (p.portRows !== undefined) next.portRows = p.portRows;
  if (p.env !== undefined) next.envRows = p.env;
  if (p.storeData !== undefined) next.storeData = p.storeData;
  if (p.folder !== undefined) next.folder = p.folder;
  if (p.keepSafe !== undefined) next.keepSafe = p.keepSafe;
  if (p.tos !== undefined) next.tos = p.tos;
  if (p.regionsOn !== undefined) {
    next.regionsOn = p.regionsOn;
    if (!p.regionsOn) next.spec = { ...next.spec, geolocation: [] };
  }

  // Enterprise follows the private switch and secret looking names in Simple mode (FACTS 9.4.2).
  if (next.mode === 'simple') {
    const secrets = next.envRows.some((r) => looksSecret(r.key));
    if (next.privateImage || secrets) next.enterprise = true;
    else if (p.privateImage === false || p.env !== undefined) next.enterprise = false;
  }
  return derive(next);
}

/** Names in `environmentParameters` that look like secrets (FACTS 9.4.2 notice). */
export function secretKeys(spec: FluxAppSpec): string[] {
  const keys: string[] = [];
  for (const c of spec.compose) {
    for (const e of c.environmentParameters) {
      const { key } = splitEnv(e);
      if (looksSecret(key) && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

/** Move the draft to Advanced mode keeping everything, or back to Simple deriving the switches. */
export function switchMode(d: Draft, mode: Mode): Draft {
  if (d.mode === mode) return d;
  if (mode === 'advanced') return { ...d, mode };
  const c = first(d.spec);
  const parsed = parseContainerData(c.containerData);
  const primary = parsed.mounts[0];
  const storeData = c.containerData !== '/tmp' && c.containerData.length >= 2;
  const continents = simpleContinents(d.spec);
  return {
    ...d,
    mode,
    storeData,
    keepSafe: storeData && parsed.syncMode !== null,
    folder: storeData && primary?.path ? primary.path : '/data',
    regionsOn: continents !== null && continents.length > 0,
    portRows: c.containerPorts.length > 0 ? c.containerPorts.map(String) : [''],
    envRows: c.environmentParameters.map(splitEnv),
    privateImage: c.repoauth !== '',
  };
}

/** What is still needed before "Review & deploy" lights up (FACTS 9.4.2), in the page's order. */
export function simpleBlockers(d: Draft, account: Account): string[] {
  const out: string[] = [];
  const c = first(d.spec);
  if (c.repotag.trim() === '') out.push('Enter a Docker image.');
  if (d.spec.name === '') out.push('Choose an app name.');
  const rows = d.portRows.filter((r) => r.trim() !== '');
  if (rows.length === 0 || rows.some((r) => parsePortRow(r) === null)) out.push(PORT_ERROR);
  if (account === 'wallet' && !isValidEmail(d.spec.contacts[0] ?? '')) {
    out.push('Enter a valid contact email.');
  }
  if (d.storeData && d.folder.trim().length < 2) out.push('Enter the folder to keep.');
  if (!d.tos) out.push('Accept the Terms & Conditions.');
  return out;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** A draft filled in from a spec: what "Show me" and "Fill in the example" do. */
export function draftFromSpec(spec: FluxAppSpec, account: Account, mode: Mode = 'simple'): Draft {
  const base = blankDraft(account);
  const cleaned: FluxAppSpec = {
    ...spec,
    enterprise: '',
    contacts: account === 'sso' ? [SIM_EMAIL] : spec.contacts.length > 0 ? spec.contacts : [SIM_EMAIL],
    compose: spec.compose.map((c) => ({ ...c })),
  };
  const d: Draft = {
    ...base,
    mode: 'advanced',
    spec: cleaned,
    tos: true,
    enterprise: Boolean(spec.enterprise),
  };
  const asSimple = switchMode(d, 'simple');
  const out = mode === 'simple' ? asSimple : { ...asSimple, mode: 'advanced' as const };
  // Simple mode would have stripped hyphens; keep the preset's own name in Advanced.
  if (out.mode === 'simple') {
    const slug = slugifyAppName(cleaned.name);
    return derive({
      ...out,
      spec: withFirst({ ...out.spec, name: slug, description: slug }, { name: slug }),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// What the spec asks for, for the form's readouts
// ---------------------------------------------------------------------------

/** Total resources over all components. */
export function totals(spec: FluxAppSpec): { cpu: number; ram: number; hdd: number } {
  let cpu = 0;
  let ram = 0;
  let hdd = 0;
  for (const c of spec.compose) {
    cpu += c.cpu;
    ram += c.ram;
    hdd += c.hdd;
  }
  return { cpu: Number(cpu.toFixed(2)), ram, hdd };
}
