/**
 * Example specs for the lint code lookup and for lab links.
 *
 * `LINT_EXAMPLES` maps a lint code to a small spec that raises it. The troubleshooting page offers
 * "Open this spec in the forge" for any code that has one, so a visitor can see the issue, the line it sits
 * on and the fix in the editor. A test lints every example and requires it to raise its code (see
 * `content/troubleshoot.test.ts`), so the list cannot drift from the linter.
 *
 * A code with no entry (NAME_TAKEN needs the network, INSTANCES_EXCEED_NODES needs the geo snapshot) has no
 * "open in the forge" link: the page says so rather than showing a spec that does not raise it.
 */

import { cloneFixture } from '@shared/flux/fixtures';
import type { FluxAppSpec } from '@shared/flux/types';
import type { DeepPartial } from '@/learn/types';
import type { SpecExample } from './types';

type Loose = Record<string, unknown>;

function ex(fixture: string, patch: Loose, extra: Pick<SpecExample, 'omit'> = {}): SpecExample {
  return { fixture, patch: patch as unknown as DeepPartial<FluxAppSpec>, ...extra };
}

const web = (patch: Loose): Loose => ({ compose: [patch] });
const longText = (n: number, ch = 'x') => ch.repeat(n);

/**
 * Codes no example spec can raise on its own, because the linter needs data from the live network to
 * decide: the list of taken names (`NAME_TAKEN`) or the count of eligible nodes (`INSTANCES_EXCEED_NODES`).
 */
export const NEEDS_LIVE_DATA: readonly string[] = ['NAME_TAKEN', 'INSTANCES_EXCEED_NODES'];

export const LINT_EXAMPLES: Readonly<Record<string, SpecExample>> = {
  // identity
  NAME_MISSING: ex('hello-world', { name: '' }),
  NAME_FORMAT: ex('hello-world', { name: 'my app!' }),
  NAME_TOO_LONG: ex('hello-world', { name: longText(64, 'a') }),
  NAME_RESERVED_PREFIX: ex('hello-world', { name: 'fluxdemo' }),
  NAME_RESERVED: ex('hello-world', { name: 'watchtower' }),
  NAME_UPPERCASE: ex('hello-world', { name: 'HelloFlux' }),
  NAME_MARKETPLACE_PREFIX: ex('hello-world', { name: 'minecraft8gb-friends' }),
  DESCRIPTION_MISSING: ex('hello-world', { description: '' }),
  DESCRIPTION_TOO_LONG: ex('hello-world', { description: longText(257) }),
  OWNER_MISSING: ex('hello-world', { owner: '' }),
  OWNER_INVALID: ex('hello-world', { owner: 'my-wallet' }),

  // shape
  UNKNOWN_FIELD: ex('hello-world', { tiered: true }),
  FIELD_MISSING: ex('hello-world', {}, { omit: ['contacts', 'geolocation', 'nodes'] }),
  VERSION_CHANGED: ex('hello-world', { version: 7 }),
  COMPOSE_EMPTY: ex('hello-world', { compose: [] }),
  COMPONENT_NAME_MISSING: ex('hello-world', web({ name: '' })),
  COMPONENT_NAME_FORMAT: ex('hello-world', web({ name: 'web-server' })),
  COMPONENT_NAME_TOO_LONG: ex('hello-world', web({ name: longText(64, 'a') })),
  COMPONENT_NAME_RESERVED: ex('hello-world', web({ name: 'fluxweb' })),
  COMPONENT_NAME_DUPLICATE: ex('three-tier', { compose: [{ name: 'web' }, { name: 'web' }] }),
  COMPONENT_DESCRIPTION_TOO_LONG: ex('hello-world', web({ description: longText(257) })),
  CONTACTS_TOO_MANY: ex('hello-world', {
    contacts: ['a@x.io', 'b@x.io', 'c@x.io', 'd@x.io', 'e@x.io', 'f@x.io'],
  }),
  CONTACT_TOO_LONG: ex('hello-world', { contacts: [`${longText(70, 'a')}@example.com`] }),
  CONTACTS_PUBLIC: ex('hello-world', { contacts: ['me@example.com'] }),

  // instances
  INSTANCES_LOW: ex('hello-world', { instances: 0 }),
  INSTANCES_HIGH: ex('hello-world', { instances: 101 }),
  INSTANCES_FRACTIONAL: ex('hello-world', { instances: 2.5 }),
  INSTANCES_ONE: ex('hello-world', { instances: 1 }),
  INSTANCES_PRICE_CLIFF: ex('hello-world', { instances: 3 }),
  STATEFUL_SINGLE_INSTANCE: ex('wordpress-mysql', { instances: 1 }),

  // resources
  RESOURCE_NOT_POSITIVE: ex('hello-world', web({ cpu: 0 })),
  RESOURCE_DECIMALS: ex('hello-world', web({ cpu: 0.123456789 })),
  CPU_STEP: ex('hello-world', web({ cpu: 0.55 })),
  RAM_STEP: ex('hello-world', web({ ram: 550 })),
  HDD_STEP: ex('hello-world', web({ hdd: 2.5 })),
  TOTAL_CPU_EXCEEDED: ex('hello-world', web({ cpu: 16 })),
  TOTAL_RAM_EXCEEDED: ex('hello-world', web({ ram: 60000 })),
  TOTAL_HDD_EXCEEDED: ex('hello-world', web({ hdd: 821 })),
  RAM_TOO_SMALL_FOR_IMAGE: ex('three-tier', { compose: [{}, {}, { ram: 100 }] }),
  DISK_SMALL_STATEFUL: ex('three-tier', { compose: [{}, {}, { hdd: 1 }] }),

  // image
  REPOTAG_EMPTY: ex('hello-world', web({ repotag: '' })),
  REPOTAG_FORMAT: ex('hello-world', web({ repotag: 'Bad Image!' })),
  REPOTAG_TOO_LONG: ex('hello-world', web({ repotag: `user/${longText(200, 'a')}:1.0` })),
  IMAGE_UNTAGGED: ex('hello-world', web({ repotag: 'nginx' })),
  IMAGE_LATEST: ex('hello-world', web({ repotag: 'nginx:latest' })),
  IMAGE_DOCKER_IO_HOST: ex('hello-world', web({ repotag: 'docker.io/library/nginx:1.27' })),
  IMAGE_UPPERCASE: ex('hello-world', web({ repotag: 'User/App:1.0' })),
  IMAGE_MAYBE_HUGE: ex('hello-world', web({ repotag: 'tensorflow/tensorflow:2.16.1' })),

  // enterprise
  REPOAUTH_NEEDS_ENTERPRISE: ex('hello-world', web({ repoauth: 'user:token' })),
  NODES_NEED_ENTERPRISE: ex('hello-world', { nodes: ['203.0.113.10'] }),
  DATACENTER_PRIVILEGE: ex('hello-world', { datacenter: true }),

  // network
  PORT_NOT_INTEGER: ex('hello-world', web({ ports: [80.5] })),
  PORT_RANGE: ex('hello-world', web({ ports: [70000] })),
  PORT_BANNED: ex('hello-world', web({ ports: [22], containerPorts: [80] })),
  PORT_DUPLICATE: ex('three-tier', {
    compose: [{ ports: [31050] }, { ports: [31050], containerPorts: [80], domains: [''] }],
  }),
  PORTS_TOO_MANY: ex(
    'hello-world',
    web({
      ports: [31001, 31002, 31003, 31004, 31005, 31006],
      containerPorts: [80, 81, 82, 83, 84, 85],
      domains: ['', '', '', '', '', ''],
    }),
  ),
  CONTAINER_PORT_RANGE: ex('hello-world', web({ containerPorts: [70000] })),
  PORT_LENGTH_MISMATCH: ex(
    'hello-world',
    web({ ports: [31001, 31002], containerPorts: [80], domains: ['', ''] }),
  ),
  DOMAINS_LENGTH_MISMATCH: ex('hello-world', web({ domains: [] })),
  PORT_FEE: ex('hello-world', web({ ports: [8080], containerPorts: [8080] })),
  NO_PUBLIC_PORT: ex('hello-world', web({ ports: [], containerPorts: [], domains: [] })),
  DATABASE_PORT_PUBLIC: ex('three-tier', {
    compose: [{}, {}, { ports: [5432], containerPorts: [5432], domains: [''] }],
  }),
  PORT_ENV_MISMATCH: ex('hello-world', web({ environmentParameters: ['PORT=3000'], containerPorts: [80] })),
  CONTAINER_PORT_UNUSUAL: ex('hello-world', web({ containerPorts: [8081] })),
  BIND_LOCALHOST: ex('hello-world', web({ environmentParameters: ['HOST=127.0.0.1'] })),
  DOMAIN_TOO_LONG: ex('hello-world', web({ domains: [`${longText(250, 'a')}.com`] })),
  DOMAIN_FORMAT: ex('hello-world', web({ domains: ['not a domain'] })),
  DOMAIN_IS_GENERATED: ex('hello-world', web({ domains: ['hello-flux.app.runonflux.io'] })),
  DOMAIN_APEX: ex('static-site', web({ domains: ['example.com'] })),

  // config
  ENV_TOO_MANY: ex(
    'hello-world',
    web({ environmentParameters: Array.from({ length: 21 }, (_, i) => `KEY${i}=v`) }),
  ),
  ENV_TOO_LONG: ex('hello-world', web({ environmentParameters: [`KEY=${longText(400)}`] })),
  ENV_FORMAT: ex('hello-world', web({ environmentParameters: ['NOEQUALSIGN'] })),
  ENV_WHITESPACE: ex('hello-world', web({ environmentParameters: [' KEY = value '] })),
  ENV_SECRET_PUBLIC: ex('hello-world', web({ environmentParameters: ['DB_PASSWORD=hunter2'] })),
  ENV_RESERVED_NAME: ex('hello-world', web({ environmentParameters: ['FLUX_APP_NAME=custom'] })),
  STORAGE_LINK_INVALID: ex(
    'hello-world',
    web({ environmentParameters: ['F_S_ENV=http://example.com/env.json'] }),
  ),
  COMMANDS_TOO_MANY: ex('hello-world', web({ commands: Array.from({ length: 21 }, (_, i) => `arg${i}`) })),
  COMMAND_TOO_LONG: ex('hello-world', web({ commands: [longText(401)] })),
  COMMAND_UNSPLIT: ex('hello-world', web({ commands: ['node server.js --port 3000'] })),
  COMMAND_PRIVILEGED: ex('hello-world', web({ commands: ['--privileged'] })),
  NETWORK_WITH_FORMAT: ex('hello-world', { description: 'networkWith:other-app' }),

  // storage
  CONTAINER_DATA_TOO_SHORT: ex('hello-world', web({ containerData: '/' })),
  CONTAINER_DATA_TOO_LONG: ex('hello-world', web({ containerData: `/${longText(200, 'a')}` })),
  CONTAINER_DATA_SYNTAX: ex('hello-world', web({ containerData: 'data' })),
  CONTAINER_DATA_COMPONENT_REF: ex('hello-world', web({ containerData: '/data|9:/shared' })),
  CONTAINER_DATA_SYNC_FLAGS: ex('hello-world', web({ containerData: 'rg:/data' })),
  STATEFUL_NO_VOLUME: ex('wordpress-mysql', { compose: [{}, { containerData: '/tmp' }] }),
  STATEFUL_NOT_SYNCED: ex('wordpress-mysql', { compose: [{}, { containerData: '/var/lib/mysql' }] }),
  DB_ON_REPLICATED_MOUNT: ex('wordpress-mysql', { compose: [{}, { containerData: 'r:/var/lib/mysql' }] }),
  SYNC_SINGLE_INSTANCE: ex('hello-world', { instances: 1, ...web({ containerData: 'r:/data' }) }),

  // placement
  SIZE_NEEDS_STRATUS: ex('hello-world', web({ cpu: 10, ram: 20000, hdd: 100 })),
  GEO_TOO_MANY: ex('hello-world', {
    geolocation: [
      'acEU_DE',
      'acEU_FR',
      'acEU_NL',
      'acEU_IT',
      'acEU_ES',
      'acEU_PL',
      'acEU_SE',
      'acEU_NO',
      'acEU_FI',
      'acEU_DK',
      'acEU_AT',
    ],
  }),
  GEO_TOO_LONG: ex('hello-world', { geolocation: [`acEU_${longText(60, 'A')}`] }),
  GEO_SYNTAX: ex('hello-world', { geolocation: ['Europe'] }),
  GEO_CONFLICT: ex('hello-world', { geolocation: ['acEU', 'a!cEU'] }),
  GEO_LEGACY: ex('hello-world', { geolocation: ['aEU'] }),
  GEO_ONE_REGION: ex('hello-world', { geolocation: ['acEU_DE'] }),
  STATICIP_COST: ex('hello-world', { staticip: true }),
  NODES_TOO_MANY: ex('hello-world', {
    nodes: Array.from({ length: 121 }, (_, i) => `203.0.113.${i % 250}:${16127 + i}`),
  }),
  NODE_ENTRY_TOO_LONG: ex('hello-world', { nodes: [longText(71, '1')] }),
  NODES_FORMAT: ex('hello-world', { nodes: ['nonsense'] }),
  NODES_DUPLICATE: ex('hello-world', { nodes: ['203.0.113.10', '203.0.113.10'] }),

  // subscription
  EXPIRE_LOW: ex('hello-world', { expire: 0 }),
  EXPIRE_HIGH: ex('hello-world', { expire: 1056001 }),
  EXPIRE_FRACTIONAL: ex('hello-world', { expire: 1.5 }),
  EXPIRE_ONE_BLOCK: ex('hello-world', { expire: 1 }),
  EXPIRE_SHORT: ex('hello-world', { expire: 10000 }),

  // teaching notes and cases found by reading the spec rather than breaking it
  FIELD_COERCED: ex('hello-world', { instances: '3' }),
  COMPOSE_TOO_MANY: ex('hello-world', {
    compose: Array.from({ length: 11 }, (_, i) => ({ name: `part${i}` })),
  }),
  NODES_FEWER_THAN_INSTANCES: ex('hello-world', { nodes: ['203.0.113.10:16127'] }),
  NODES_OWNER_PRIVILEGE: ex('hello-world', {
    nodes: ['203.0.113.10:16127', '203.0.113.11:16127', '203.0.113.12:16127'],
  }),
  SIZE_EXCLUDES_CUMULUS: ex('hello-world', web({ cpu: 4, ram: 8000, hdd: 100 })),
  IMAGE_IMPLICIT_REGISTRY: ex('hello-world', web({ repotag: 'nginxinc/nginx-unprivileged:1.27' })),
  REPOAUTH_TOO_LONG: ex('hello-world', web({ repoauth: `user:${longText(15001)}` })),
  REPOAUTH_FORMAT: ex('hello-world', web({ repoauth: 'token' })),
  PORT_PRIVILEGED_CONTAINER: ex('hello-world', {}),
  HEALTH_NOT_CHECKED: ex('hello-world', {}),
  ENTERPRISE_OPAQUE: ex('hello-world', { enterprise: 'c2hvcnQ=', compose: [] }),
  ENTERPRISE_BLOB_FORMAT: ex('hello-world', { enterprise: 'not a blob', compose: [] }),
  ENTERPRISE_PLAIN_COMPOSE: ex('hello-world', { enterprise: 'c2hvcnQ=' }),
  ENTERPRISE_AMD64: ex('hello-world', { enterprise: 'c2hvcnQ=', compose: [] }),
};

// ---------------------------------------------------------------------------
// Building and linking
// ---------------------------------------------------------------------------

function isPlain(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Objects merge key by key, arrays of objects merge by index, any other array or value replaces. */
export function mergeSpecValue(base: unknown, patch: unknown): unknown {
  if (Array.isArray(patch)) {
    if (Array.isArray(base) && patch.length > 0 && patch.every(isPlain)) {
      const out = base.map((b, i) => (i < patch.length ? mergeSpecValue(b, patch[i]) : b));
      for (let i = base.length; i < patch.length; i++) out.push(clone(patch[i]));
      return out;
    }
    return clone(patch);
  }
  if (isPlain(patch) && isPlain(base)) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(patch)) out[k] = mergeSpecValue(base[k], v);
    return out;
  }
  return clone(patch);
}

/** The spec an example stands for: the fixture, the patch merged over it, the omitted keys removed. */
export function buildExampleSpec(example: SpecExample): Record<string, unknown> | null {
  const base = cloneFixture(example.fixture);
  if (!base) return null;
  let spec = base as unknown as Record<string, unknown>;
  if (example.patch) spec = mergeSpecValue(spec, example.patch) as Record<string, unknown>;
  for (const key of example.omit ?? []) delete spec[key];
  return spec;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * A link that opens the Spec Forge with this spec loaded. The forge reads a spec from `#s=` in the URL;
 * the `r.` form (the JSON itself, base64url) is the one every browser can read without a compression API.
 */
export function specForgePath(spec: unknown): string {
  return `/labs/spec-forge#s=r.${toBase64Url(JSON.stringify(spec))}`;
}

/** The forge link for an example, or null when its fixture does not exist. */
export function exampleHref(example: SpecExample): string | null {
  const spec = buildExampleSpec(example);
  return spec ? specForgePath(spec) : null;
}
