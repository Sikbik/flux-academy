/**
 * Operations on a spec. Pure and immutable: every function takes a spec and returns a new one (the very
 * same object when nothing changed), and every one of them keeps the arrays of a component aligned.
 *
 * The rules that make this module worth having:
 *   - `ports`, `containerPorts` and `domains` of a component are three views of one list. Adding, removing
 *     or moving a port touches all three.
 *   - Components refer to each other by position (`0:/data`, `c:1:logs:/logs`) and by name in internal
 *     host names (`fluxdb_myapp`). Reordering, removing and renaming keep those references true.
 *   - Public ports are unique across the whole app, so a new port is always one nothing else uses.
 */

import { defaultComponent, isBannedPort, isSurchargePort, LIMITS } from '@shared/flux/spec';
import type { FluxAppSpec, FluxComponentSpec } from '@shared/flux/types';
import { getAt, parsePath, removeAt, setAt } from './paths';

type Spec = FluxAppSpec;

/** The value the forge writes into `enterprise` for "this app is enterprise". FluxCloud makes the real blob. */
export const ENTERPRISE_PLACEHOLDER = 'ENCRYPTED_BY_FLUXCLOUD_PLACEHOLDER';

/** Blocks in one pricing month, and the subscription lengths FluxCloud offers (FACTS 5.3). */
export const BLOCKS_PER_MONTH = 88_000;
export const PERIODS: readonly { id: string; label: string; blocks: number; months: number }[] = [
  { id: '1w', label: '1 week', blocks: 20_160, months: 20_160 / BLOCKS_PER_MONTH },
  { id: '2w', label: '2 weeks', blocks: 40_320, months: 40_320 / BLOCKS_PER_MONTH },
  { id: '1m', label: '1 month', blocks: 88_000, months: 1 },
  { id: '3m', label: '3 months', blocks: 264_000, months: 3 },
  { id: '6m', label: '6 months', blocks: 528_000, months: 6 },
  { id: '12m', label: '1 year', blocks: 1_056_000, months: 12 },
];

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Every public port used by any component. */
export function usedPorts(spec: Spec): Set<number> {
  const out = new Set<number>();
  for (const c of spec.compose ?? []) for (const p of c.ports ?? []) out.add(p);
  return out;
}

/** The first free public port at or after `from` that is neither banned nor priced as an enterprise port. */
export function nextFreePort(spec: Spec, from = 31001): number {
  const used = usedPorts(spec);
  let p = Math.max(1024, from);
  while (p < 65535 && (used.has(p) || isBannedPort(p) || isSurchargePort(p))) p++;
  return p;
}

/** A component name nothing else uses: letters and digits only, never starting with zel or flux. */
export function uniqueComponentName(spec: Spec, base = 'component'): string {
  let clean = base.replace(/[^a-zA-Z0-9]/g, '');
  // Flux puts "flux" in front of every container name, so the network keeps both prefixes for itself.
  while (/^(zel|flux)/.test(clean)) clean = clean.replace(/^(zel|flux)/, '');
  if (!clean) clean = 'component';
  const taken = new Set((spec.compose ?? []).map((c) => c.name));
  if (!taken.has(clean)) return clean;
  for (let n = 2; n < 200; n++) {
    const candidate = `${clean}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${clean}${Date.now() % 100000}`;
}

/** The rows of a component's port table: the longest of the three arrays decides how many. */
export function portRowCount(c: Pick<FluxComponentSpec, 'ports' | 'containerPorts' | 'domains'>): number {
  return Math.max(c.ports?.length ?? 0, c.containerPorts?.length ?? 0, c.domains?.length ?? 0);
}

/** True when `ports`, `containerPorts` and `domains` do not have the same length. */
export function portsMisaligned(c: Pick<FluxComponentSpec, 'ports' | 'containerPorts' | 'domains'>): boolean {
  const a = c.ports?.length ?? 0;
  return a !== (c.containerPorts?.length ?? 0) || a !== (c.domains?.length ?? 0);
}

/** Totals over every component. */
export function totals(spec: Spec): { cpu: number; ram: number; hdd: number; ports: number } {
  let cpu = 0;
  let ram = 0;
  let hdd = 0;
  let ports = 0;
  for (const c of spec.compose ?? []) {
    cpu += Number.isFinite(c.cpu) ? c.cpu : 0;
    ram += Number.isFinite(c.ram) ? c.ram : 0;
    hdd += Number.isFinite(c.hdd) ? c.hdd : 0;
    ports += c.ports?.length ?? 0;
  }
  return { cpu: Math.round(cpu * 100) / 100, ram, hdd, ports };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/** A fresh component with a free public port and a unique name. */
export function newComponent(spec: Spec, overrides: Partial<FluxComponentSpec> = {}): FluxComponentSpec {
  const name = overrides.name ?? uniqueComponentName(spec, 'component');
  const port = nextFreePort(spec);
  return defaultComponent({
    name,
    description: 'A new component',
    repotag: 'nginx:1.27',
    ports: [port],
    containerPorts: [80],
    domains: [''],
    ...overrides,
  });
}

/** Append a component. At 10 components the spec is returned unchanged. */
export function addComponent(spec: Spec, overrides: Partial<FluxComponentSpec> = {}): Spec {
  if ((spec.compose?.length ?? 0) >= LIMITS.component.max) return spec;
  return { ...spec, compose: [...(spec.compose ?? []), newComponent(spec, overrides)] };
}

/**
 * A fresh private component: no public port and no domain, so only the app's other components reach it
 * (the right shape for a database or a cache). It has no port rows at all, the container port included: a
 * database and a cache listen on different ones, and a port that is not public needs no entry for its
 * siblings to connect. Starting with a port row would only be one more thing to delete.
 */
export function newPrivateComponent(
  spec: Spec,
  overrides: Partial<FluxComponentSpec> = {},
): FluxComponentSpec {
  return newComponent(spec, {
    name: overrides.name ?? uniqueComponentName(spec, 'private'),
    description: 'A private component',
    ports: [],
    containerPorts: [],
    domains: [],
    ...overrides,
  });
}

/** Append a private component. At 10 components the spec is returned unchanged. */
export function addPrivateComponent(spec: Spec, overrides: Partial<FluxComponentSpec> = {}): Spec {
  if ((spec.compose?.length ?? 0) >= LIMITS.component.max) return spec;
  return { ...spec, compose: [...(spec.compose ?? []), newPrivateComponent(spec, overrides)] };
}

/** Copy a component under a new name with its own free ports, right after the original. */
export function duplicateComponent(spec: Spec, index: number): Spec {
  const src = spec.compose?.[index];
  if (!src || spec.compose.length >= LIMITS.component.max) return spec;
  let probe: Spec = spec;
  const ports = src.ports.map(() => {
    const p = nextFreePort(probe);
    probe = { ...probe, compose: [...probe.compose, defaultComponent({ ports: [p] })] };
    return p;
  });
  const copy: FluxComponentSpec = {
    ...src,
    name: uniqueComponentName(spec, src.name),
    ports,
    containerPorts: src.containerPorts.slice(),
    domains: src.domains.map(() => ''),
    environmentParameters: src.environmentParameters.slice(),
    commands: src.commands.slice(),
  };
  const compose = spec.compose.slice();
  compose.splice(index + 1, 0, copy);
  // Components after the insertion moved down one place: references to them move with them.
  return remapComponentRefs({ ...spec, compose }, (n) => (n > index ? n + 1 : n));
}

/**
 * Remove a component. Mounts in other components that borrowed its volume are dropped, and references to
 * components after it shift down one place.
 */
export function removeComponent(spec: Spec, index: number): Spec {
  if (!spec.compose || index < 0 || index >= spec.compose.length) return spec;
  const compose = spec.compose.filter((_, i) => i !== index);
  return remapComponentRefs({ ...spec, compose }, (n) => (n === index ? null : n > index ? n - 1 : n));
}

/** Move a component and keep every positional mount reference pointing at the same component. */
export function moveComponent(spec: Spec, from: number, to: number): Spec {
  const n = spec.compose?.length ?? 0;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return spec;
  const compose = spec.compose.slice();
  const [moved] = compose.splice(from, 1);
  compose.splice(to, 0, moved as FluxComponentSpec);
  const map = (old: number): number => {
    if (old === from) return to;
    if (from < to && old > from && old <= to) return old - 1;
    if (from > to && old >= to && old < from) return old + 1;
    return old;
  };
  return remapComponentRefs({ ...spec, compose }, map);
}

/** Rewrite `n:`, `c:n:` and `cf:n:` mounts of every component. `null` drops the mount. */
function remapComponentRefs(spec: Spec, map: (oldIndex: number) => number | null): Spec {
  let changed = false;
  const compose = spec.compose.map((c) => {
    const next = remapMountRefs(c.containerData, map);
    if (next === c.containerData) return c;
    changed = true;
    return { ...c, containerData: next };
  });
  return changed ? { ...spec, compose } : spec;
}

/** Remap the component numbers inside a `containerData` string. Exported for tests. */
export function remapMountRefs(value: string, map: (oldIndex: number) => number | null): string {
  if (typeof value !== 'string' || !value.includes('|')) return value;
  const defs = value.split('|');
  const out: string[] = [defs[0] as string];
  for (const def of defs.slice(1)) {
    const m = /^(\d+):(.*)$/.exec(def) ?? /^(c|cf):(\d+):(.*)$/.exec(def);
    if (!m) {
      out.push(def);
      continue;
    }
    const numeric = m.length === 3;
    const n = Number.parseInt(numeric ? (m[1] as string) : (m[2] as string), 10);
    const to = map(n);
    if (to === null) continue;
    if (numeric) out.push(`${to}:${m[2]}`);
    else out.push(`${m[1]}:${to}:${m[3]}`);
  }
  return out.join('|');
}

/** Escape a string for use inside a RegExp. */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replace internal host names `flux<component>_<app>`, whole tokens only. Returns the new text and the count. */
function replaceHost(text: string, from: string, to: string): { text: string; count: number } {
  if (from === to || !from) return { text, count: 0 };
  let count = 0;
  const re = new RegExp(`(^|[^A-Za-z0-9_-])${esc(from)}(?![A-Za-z0-9-])`, 'g');
  const next = text.replace(re, (_m, lead: string) => {
    count++;
    return `${lead}${to}`;
  });
  return { text: next, count };
}

function hostOf(component: string, app: string): string {
  return `flux${component}_${app}`;
}

function mapStrings(
  spec: Spec,
  fn: (s: string) => { text: string; count: number },
): { spec: Spec; count: number } {
  let count = 0;
  let changed = false;
  const compose = spec.compose.map((c) => {
    const run = (list: string[]): string[] => {
      let any = false;
      const out = list.map((s) => {
        const r = fn(s);
        if (r.count > 0) {
          any = true;
          count += r.count;
          return r.text;
        }
        return s;
      });
      return any ? out : list;
    };
    const env = run(c.environmentParameters);
    const cmd = run(c.commands);
    if (env === c.environmentParameters && cmd === c.commands) return c;
    changed = true;
    return { ...c, environmentParameters: env, commands: cmd };
  });
  return { spec: changed ? { ...spec, compose } : spec, count };
}

export interface RenameResult {
  spec: Spec;
  /** Internal host names in environment variables and commands that were updated to the new name. */
  rewritten: number;
}

/** Rename a component and update `flux<old>_<app>` host names that other components use to reach it. */
export function renameComponent(spec: Spec, index: number, name: string): RenameResult {
  const c = spec.compose?.[index];
  if (!c || c.name === name) return { spec, rewritten: 0 };
  const compose = spec.compose.slice();
  compose[index] = { ...c, name };
  const renamed = { ...spec, compose };
  const { spec: next, count } = mapStrings(renamed, (s) =>
    replaceHost(s, hostOf(c.name, spec.name), hostOf(name, spec.name)),
  );
  return { spec: next, rewritten: count };
}

/** Rename the app and update the `flux<component>_<app>` host names inside environment and commands. */
export function renameApp(spec: Spec, name: string): RenameResult {
  if (spec.name === name) return { spec, rewritten: 0 };
  let total = 0;
  let next: Spec = { ...spec, name };
  for (const c of spec.compose ?? []) {
    const r = mapStrings(next, (s) => replaceHost(s, hostOf(c.name, spec.name), hostOf(c.name, name)));
    next = r.spec;
    total += r.count;
  }
  return { spec: next, rewritten: total };
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

function withComponent(spec: Spec, index: number, fn: (c: FluxComponentSpec) => FluxComponentSpec): Spec {
  const c = spec.compose?.[index];
  if (!c) return spec;
  const next = fn(c);
  if (next === c) return spec;
  const compose = spec.compose.slice();
  compose[index] = next;
  return { ...spec, compose };
}

/** Pad the three port arrays to the same length so a row edit lands on the right row. */
export function alignPorts(c: FluxComponentSpec): FluxComponentSpec {
  if (!portsMisaligned(c)) return c;
  const n = portRowCount(c);
  const ports = c.ports.slice();
  const containerPorts = c.containerPorts.slice();
  const domains = c.domains.slice();
  while (ports.length < n) ports.push(nextFreePortAmong(ports));
  while (containerPorts.length < n) containerPorts.push(ports[containerPorts.length] ?? 80);
  while (domains.length < n) domains.push('');
  return { ...c, ports, containerPorts, domains };
}

function nextFreePortAmong(taken: readonly number[]): number {
  let p = 31001;
  while (taken.includes(p) || isBannedPort(p)) p++;
  return p;
}

/** Make `ports`, `containerPorts` and `domains` the same length without losing anything. */
export function alignComponentPorts(spec: Spec, index: number): Spec {
  return withComponent(spec, index, alignPorts);
}

export interface PortInit {
  port?: number;
  containerPort?: number;
  domain?: string;
}

/** Add a port row (public port, container port, domain) to a component. At 5 ports nothing changes. */
export function addPort(spec: Spec, index: number, init: PortInit = {}): Spec {
  return withComponent(spec, index, (c) => {
    const base = alignPorts(c);
    if (base.ports.length >= LIMITS.ports.perComponentMax) return c;
    const port = init.port ?? nextFreePort(spec);
    const containerPort = init.containerPort ?? port;
    return {
      ...base,
      ports: [...base.ports, port],
      containerPorts: [...base.containerPorts, containerPort],
      domains: [...base.domains, init.domain ?? ''],
    };
  });
}

/** Remove a port row from all three arrays. */
export function removePort(spec: Spec, index: number, row: number): Spec {
  return withComponent(spec, index, (c) => {
    if (row < 0 || row >= portRowCount(c)) return c;
    const drop = <T>(list: T[]): T[] => (row < list.length ? list.filter((_, i) => i !== row) : list);
    return {
      ...c,
      ports: drop(c.ports),
      containerPorts: drop(c.containerPorts),
      domains: drop(c.domains),
    };
  });
}

/** Swap two port rows. */
export function movePort(spec: Spec, index: number, from: number, to: number): Spec {
  return withComponent(spec, index, (c) => {
    const base = alignPorts(c);
    const n = base.ports.length;
    if (from === to || from < 0 || to < 0 || from >= n || to >= n) return c;
    const mv = <T>(list: T[]): T[] => {
      const next = list.slice();
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x as T);
      return next;
    };
    return {
      ...base,
      ports: mv(base.ports),
      containerPorts: mv(base.containerPorts),
      domains: mv(base.domains),
    };
  });
}

/** Set one cell of the port table, padding the arrays when the row is beyond them (a misaligned spec). */
export function setPortCell(
  spec: Spec,
  index: number,
  row: number,
  field: 'ports' | 'containerPorts' | 'domains',
  value: number | string,
): Spec {
  return withComponent(spec, index, (c) => {
    const base = alignPorts(c);
    const list = base[field].slice() as (number | string)[];
    if (list[row] === value) return c;
    list[row] = value;
    return { ...base, [field]: list } as FluxComponentSpec;
  });
}

// ---------------------------------------------------------------------------
// String lists (environment, commands, contacts, nodes, geolocation)
// ---------------------------------------------------------------------------

/** Append to the array at `path`. At `max` the spec is returned unchanged. */
export function listAppend(spec: Spec, path: string, value: string, max = Number.POSITIVE_INFINITY): Spec {
  const cur = getAt(spec, path);
  const list = Array.isArray(cur) ? (cur as string[]) : [];
  if (list.length >= max) return spec;
  return setAt(spec, path, [...list, value]);
}

/** Replace one element of the array at `path`. */
export function listSet(spec: Spec, path: string, row: number, value: string): Spec {
  const cur = getAt(spec, path);
  if (!Array.isArray(cur) || cur[row] === value) return spec;
  const list = cur.slice();
  list[row] = value;
  return setAt(spec, path, list);
}

/** Remove one element of the array at `path`. */
export function listRemove(spec: Spec, path: string, row: number): Spec {
  const cur = getAt(spec, path);
  if (!Array.isArray(cur) || row < 0 || row >= cur.length) return spec;
  return removeAt(spec, [...parsePath(path), row]);
}

/** Move one element of the array at `path`. */
export function listMove(spec: Spec, path: string, from: number, to: number): Spec {
  const cur = getAt(spec, path);
  if (!Array.isArray(cur) || from === to || from < 0 || to < 0 || from >= cur.length || to >= cur.length) {
    return spec;
  }
  const list = cur.slice();
  const [x] = list.splice(from, 1);
  list.splice(to, 0, x);
  return setAt(spec, path, list);
}

/** Split `KEY=value` at the first `=`. A string without one is all key. */
export function splitEnv(entry: string): { key: string; value: string } {
  const i = entry.indexOf('=');
  if (i < 0) return { key: entry, value: '' };
  return { key: entry.slice(0, i), value: entry.slice(i + 1) };
}

export function joinEnv(key: string, value: string): string {
  return `${key}=${value}`;
}

// ---------------------------------------------------------------------------
// Toggles and subscription
// ---------------------------------------------------------------------------

export function setStaticIp(spec: Spec, on: boolean): Spec {
  return spec.staticip === on ? spec : { ...spec, staticip: on };
}

/** Turn the enterprise flag on (with the labelled placeholder) or off (the empty string). */
export function setEnterprise(spec: Spec, on: boolean): Spec {
  if (on) return spec.enterprise ? spec : { ...spec, enterprise: ENTERPRISE_PLACEHOLDER };
  return spec.enterprise ? { ...spec, enterprise: '' } : spec;
}

export function isEnterprisePlaceholder(value: string): boolean {
  return value === ENTERPRISE_PLACEHOLDER;
}

/** `expire` for a number of pricing months (88,000 blocks each). */
export function setExpireMonths(spec: Spec, months: number): Spec {
  const blocks = Math.max(1, Math.round(months * BLOCKS_PER_MONTH));
  return spec.expire === blocks ? spec : { ...spec, expire: blocks };
}

/** Pricing months for a spec (`expire` / 88,000). */
export function monthsOf(spec: Spec): number {
  return (Number.isFinite(spec.expire) ? spec.expire : BLOCKS_PER_MONTH) / BLOCKS_PER_MONTH;
}

/** The preset period that matches `expire` exactly, or null for a custom length. */
export function periodOf(spec: Spec): (typeof PERIODS)[number] | null {
  return PERIODS.find((p) => p.blocks === spec.expire) ?? null;
}

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------

export type ContinentMode = 'off' | 'allow' | 'deny';

/** Continent codes in FACTS 3.5 with the names FluxCloud shows. */
export const CONTINENTS: readonly { code: string; name: string }[] = [
  { code: 'EU', name: 'Europe' },
  { code: 'NA', name: 'North America' },
  { code: 'SA', name: 'South America' },
  { code: 'AS', name: 'Asia' },
  { code: 'AF', name: 'Africa' },
  { code: 'OC', name: 'Oceania' },
  { code: 'AN', name: 'Antarctica' },
];

/** The continent-wide entries for a code: `acEU`, `acEU_ALL`, `a!cEU`, and the legacy `aEU`. */
function continentEntries(code: string): { allow: string[]; deny: string[] } {
  return { allow: [`ac${code}`, `ac${code}_ALL`, `a${code}`], deny: [`a!c${code}`] };
}

/** Whether a continent is allowed, denied or not mentioned at the continent level. */
export function continentMode(spec: Spec, code: string): ContinentMode {
  const { allow, deny } = continentEntries(code);
  const geo = spec.geolocation ?? [];
  if (geo.some((g) => deny.includes(g))) return 'deny';
  if (geo.some((g) => allow.includes(g))) return 'allow';
  return 'off';
}

/** Set a continent to allow, deny or off, leaving country and region entries alone. */
export function setContinentMode(spec: Spec, code: string, mode: ContinentMode): Spec {
  const { allow, deny } = continentEntries(code);
  const current = spec.geolocation ?? [];
  const kept = current.filter((g) => !allow.includes(g) && !deny.includes(g));
  const next = mode === 'allow' ? [...kept, `ac${code}`] : mode === 'deny' ? [...kept, `a!c${code}`] : kept;
  if (next.length > LIMITS.geolocation.maxCount) return spec;
  const same = next.length === current.length && next.every((g, i) => g === current[i]);
  return same ? spec : { ...spec, geolocation: next };
}

/** Add one raw geolocation entry (at most 10 entries, no duplicates). */
export function addGeoEntry(spec: Spec, entry: string): Spec {
  const e = entry.trim();
  if (!e || (spec.geolocation ?? []).includes(e)) return spec;
  return listAppend(spec, 'geolocation', e, LIMITS.geolocation.maxCount);
}

// ---------------------------------------------------------------------------
// containerData
// ---------------------------------------------------------------------------

export type DataPrefix = '' | 'r' | 'g' | 's';

export interface DataMount {
  /** `''` plain, `r` replicated, `g` primary and standby, `s` synced without election. */
  prefix: DataPrefix;
  /** The primary mount path inside the container. */
  path: string;
  /** Everything after the first `|`: extra mounts, written exactly as in the spec. Empty for none. */
  extra: string;
  /** False when the primary definition is not `[flags]:/path` or `/path` (the builder cannot edit it). */
  understood: boolean;
}

/** Read the primary mount of a `containerData` string. Never throws. */
export function readContainerData(value: string): DataMount {
  const v = typeof value === 'string' ? value : '';
  const bar = v.indexOf('|');
  const primary = bar < 0 ? v : v.slice(0, bar);
  const extra = bar < 0 ? '' : v.slice(bar + 1);
  const m = /^([rgs]+):(.*)$/.exec(primary);
  if (m) {
    const flags = m[1] as string;
    const prefix: DataPrefix = flags.includes('g') ? 'g' : flags.includes('r') ? 'r' : 's';
    return { prefix, path: m[2] as string, extra, understood: flags.length === 1 };
  }
  const understood = !primary.includes(':');
  return { prefix: '', path: primary, extra, understood };
}

/** Write a primary mount (and any extra mounts) back into the spec's string form. */
export function writeContainerData(m: Pick<DataMount, 'prefix' | 'path' | 'extra'>): string {
  const head = m.prefix ? `${m.prefix}:${m.path}` : m.path;
  return m.extra ? `${head}|${m.extra}` : head;
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

/** Apply a lint issue's `suggestion` at its `path`. Returns the same spec when there is nothing to apply. */
export function applySuggestion(spec: Spec, issue: { path: string; suggestion?: unknown }): Spec {
  if (issue.suggestion === undefined) return spec;
  if (issue.path === '') {
    const s = issue.suggestion;
    return s !== null && typeof s === 'object' && !Array.isArray(s) ? (s as Spec) : spec;
  }
  return setAt(spec, issue.path, issue.suggestion);
}
