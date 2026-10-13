import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LintContext } from './lint.ts';
import { LINT_CODES, lintBasis, lintSpec } from './lint.ts';
import { defaultComponent, defaultSpec, EXAMPLE_OWNER } from './spec.ts';
import type { FluxAppSpec, FluxComponentSpec } from './types.ts';

type Mut = (s: FluxAppSpec) => unknown;

function base(): FluxAppSpec {
  return JSON.parse(JSON.stringify(defaultSpec()));
}

function make(mut: Mut): unknown {
  const s = base();
  const out = mut(s);
  return out === undefined ? s : out;
}

function comp(s: FluxAppSpec, over: Partial<FluxComponentSpec> = {}, i = 0): FluxComponentSpec {
  const c = s.compose[i];
  assert.ok(c);
  Object.assign(c, over);
  return c;
}

const BIG_ENTERPRISE = `${'A'.repeat(380)}==`;

/** One triggering input per code: [code, input builder, expected path (prefix match), context]. */
const CASES: [string, Mut, string?, LintContext?][] = [
  [
    'NAME_MISSING',
    (s) => {
      s.name = '';
    },
    'name',
  ],
  [
    'NAME_FORMAT',
    (s) => {
      s.name = 'my_app';
    },
    'name',
  ],
  [
    'NAME_TOO_LONG',
    (s) => {
      s.name = 'a'.repeat(64);
    },
    'name',
  ],
  [
    'NAME_RESERVED_PREFIX',
    (s) => {
      s.name = 'fluxy';
    },
    'name',
  ],
  [
    'NAME_RESERVED',
    (s) => {
      s.name = 'Watchtower';
    },
    'name',
  ],
  ['NAME_TAKEN', () => undefined, 'name', { takenNames: ['HELLO-FLUX'] }],
  [
    'NAME_UPPERCASE',
    (s) => {
      s.name = 'MyApp';
    },
    'name',
  ],
  [
    'NAME_MARKETPLACE_PREFIX',
    (s) => {
      s.name = 'minecraft8gb-test';
    },
    'name',
  ],
  [
    'DESCRIPTION_MISSING',
    (s) => {
      s.description = '';
    },
    'description',
  ],
  [
    'DESCRIPTION_TOO_LONG',
    (s) => {
      s.description = 'x'.repeat(257);
    },
    'description',
  ],
  [
    'OWNER_MISSING',
    (s) => {
      s.owner = '';
    },
    'owner',
  ],
  [
    'OWNER_INVALID',
    (s) => {
      s.owner = 'myzelid';
    },
    'owner',
  ],
  ['UNKNOWN_FIELD', (s) => ({ ...s, tiered: false }), 'tiered'],
  [
    'FIELD_MISSING',
    (s) => {
      const o: Record<string, unknown> = { ...s };
      delete o.contacts;
      return o;
    },
    'contacts',
  ],
  ['FIELD_COERCED', (s) => ({ ...s, instances: '3' }), 'instances'],
  ['VERSION_CHANGED', (s) => ({ ...s, version: 7 }), 'version'],
  [
    'COMPOSE_EMPTY',
    (s) => {
      s.compose = [];
    },
    'compose',
  ],
  [
    'COMPOSE_TOO_MANY',
    (s) => {
      s.compose = Array.from({ length: 11 }, (_, i) =>
        defaultComponent({ name: `c${i}`, ports: [31100 + i], containerPorts: [80], domains: [''] }),
      );
    },
    'compose',
  ],
  [
    'COMPONENT_NAME_MISSING',
    (s) => {
      comp(s, { name: '' });
    },
    'compose[0].name',
  ],
  [
    'COMPONENT_NAME_FORMAT',
    (s) => {
      comp(s, { name: 'web-server' });
    },
    'compose[0].name',
  ],
  [
    'COMPONENT_NAME_TOO_LONG',
    (s) => {
      comp(s, { name: 'a'.repeat(64) });
    },
    'compose[0].name',
  ],
  [
    'COMPONENT_NAME_RESERVED',
    (s) => {
      comp(s, { name: 'zelweb' });
    },
    'compose[0].name',
  ],
  [
    'COMPONENT_NAME_DUPLICATE',
    (s) => {
      s.compose.push(defaultComponent({ name: 'web', ports: [31002] }));
    },
    'compose[1].name',
  ],
  [
    'COMPONENT_DESCRIPTION_TOO_LONG',
    (s) => {
      comp(s, { description: 'x'.repeat(257) });
    },
    'compose[0].description',
  ],
  [
    'CONTACTS_TOO_MANY',
    (s) => {
      s.contacts = ['a', 'b', 'c', 'd', 'e', 'f'];
    },
    'contacts',
  ],
  [
    'CONTACT_TOO_LONG',
    (s) => {
      s.contacts = ['x'.repeat(76)];
    },
    'contacts[0]',
  ],
  [
    'CONTACTS_PUBLIC',
    (s) => {
      s.contacts = ['ops@example.com'];
    },
    'contacts',
  ],
  [
    'INSTANCES_LOW',
    (s) => {
      s.instances = 0;
    },
    'instances',
  ],
  [
    'INSTANCES_HIGH',
    (s) => {
      s.instances = 101;
    },
    'instances',
  ],
  [
    'INSTANCES_FRACTIONAL',
    (s) => {
      s.instances = 2.5;
    },
    'instances',
  ],
  [
    'INSTANCES_ONE',
    (s) => {
      s.instances = 1;
    },
    'instances',
  ],
  ['INSTANCES_PRICE_CLIFF', () => undefined, 'instances'],
  ['INSTANCES_EXCEED_NODES', () => undefined, 'instances', { eligibleNodes: 2 }],
  [
    'NODES_FEWER_THAN_INSTANCES',
    (s) => {
      s.nodes = ['192.0.2.1:16127'];
      s.enterprise = BIG_ENTERPRISE;
    },
    'nodes',
  ],
  [
    'STATEFUL_SINGLE_INSTANCE',
    (s) => {
      s.instances = 1;
      comp(s, {
        repotag: 'postgres:16',
        containerData: 'g:/var/lib/postgresql/data',
        ram: 500,
        hdd: 10,
        ports: [],
        containerPorts: [],
        domains: [],
      });
    },
    'compose[0].repotag',
  ],
  [
    'RESOURCE_NOT_POSITIVE',
    (s) => {
      comp(s, { cpu: 0 });
    },
    'compose[0].cpu',
  ],
  [
    'RESOURCE_DECIMALS',
    (s) => {
      comp(s, { cpu: 0.123456789 });
    },
    'compose[0].cpu',
  ],
  [
    'CPU_STEP',
    (s) => {
      comp(s, { cpu: 0.15 });
    },
    'compose[0].cpu',
  ],
  [
    'RAM_STEP',
    (s) => {
      comp(s, { ram: 150 });
    },
    'compose[0].ram',
  ],
  [
    'HDD_STEP',
    (s) => {
      comp(s, { hdd: 1.5 });
    },
    'compose[0].hdd',
  ],
  [
    'TOTAL_CPU_EXCEEDED',
    (s) => {
      comp(s, { cpu: 15.5 });
    },
    '',
  ],
  [
    'TOTAL_RAM_EXCEEDED',
    (s) => {
      comp(s, { ram: 60_000 });
    },
    '',
  ],
  [
    'TOTAL_HDD_EXCEEDED',
    (s) => {
      comp(s, { hdd: 821 });
    },
    '',
  ],
  [
    'SIZE_EXCLUDES_CUMULUS',
    (s) => {
      comp(s, { cpu: 4 });
    },
    '',
  ],
  [
    'SIZE_NEEDS_STRATUS',
    (s) => {
      comp(s, { cpu: 8 });
    },
    '',
  ],
  [
    'RAM_TOO_SMALL_FOR_IMAGE',
    (s) => {
      comp(s, {
        repotag: 'mysql:8.4',
        ram: 100,
        ports: [],
        containerPorts: [],
        domains: [],
        containerData: 'g:/var/lib/mysql',
      });
    },
    'compose[0].ram',
  ],
  [
    'DISK_SMALL_STATEFUL',
    (s) => {
      comp(s, {
        repotag: 'mysql:8.4',
        ram: 1000,
        hdd: 1,
        ports: [],
        containerPorts: [],
        domains: [],
        containerData: 'g:/var/lib/mysql',
      });
    },
    'compose[0].hdd',
  ],
  [
    'REPOTAG_EMPTY',
    (s) => {
      comp(s, { repotag: '' });
    },
    'compose[0].repotag',
  ],
  [
    'REPOTAG_FORMAT',
    (s) => {
      comp(s, { repotag: 'my image:1' });
    },
    'compose[0].repotag',
  ],
  [
    'REPOTAG_TOO_LONG',
    (s) => {
      comp(s, { repotag: `${'a'.repeat(200)}:1` });
    },
    'compose[0].repotag',
  ],
  [
    'IMAGE_UNTAGGED',
    (s) => {
      comp(s, { repotag: 'nginx' });
    },
    'compose[0].repotag',
  ],
  [
    'IMAGE_LATEST',
    (s) => {
      comp(s, { repotag: 'nginx:latest' });
    },
    'compose[0].repotag',
  ],
  [
    'IMAGE_DOCKER_IO_HOST',
    (s) => {
      comp(s, { repotag: 'docker.io/library/nginx:1.27' });
    },
    'compose[0].repotag',
  ],
  [
    'IMAGE_UPPERCASE',
    (s) => {
      comp(s, { repotag: 'Org/App:1' });
    },
    'compose[0].repotag',
  ],
  [
    'IMAGE_MAYBE_HUGE',
    (s) => {
      comp(s, { repotag: 'tensorflow/tensorflow:2.17.0' });
    },
    'compose[0].repotag',
  ],
  [
    'IMAGE_IMPLICIT_REGISTRY',
    (s) => {
      comp(s, { repotag: 'traefik/whoami:v1.10.3' });
    },
    'compose[0].repotag',
    { teaching: true },
  ],
  [
    'REPOAUTH_NEEDS_ENTERPRISE',
    (s) => {
      comp(s, { repoauth: 'me:token' });
    },
    'compose[0].repoauth',
  ],
  [
    'REPOAUTH_TOO_LONG',
    (s) => {
      s.enterprise = BIG_ENTERPRISE;
      comp(s, { repoauth: `u:${'x'.repeat(15_001)}` });
    },
    'compose[0].repoauth',
  ],
  [
    'REPOAUTH_FORMAT',
    (s) => {
      s.enterprise = BIG_ENTERPRISE;
      comp(s, { repoauth: 'nocolon' });
    },
    'compose[0].repoauth',
  ],
  [
    'PORT_NOT_INTEGER',
    (s) => {
      comp(s, { ports: [31000.5] });
    },
    'compose[0].ports[0]',
  ],
  [
    'PORT_RANGE',
    (s) => {
      comp(s, { ports: [70_000] });
    },
    'compose[0].ports[0]',
  ],
  [
    'PORT_BANNED',
    (s) => {
      comp(s, { ports: [27017] });
    },
    'compose[0].ports[0]',
  ],
  [
    'PORT_DUPLICATE',
    (s) => {
      s.compose.push(
        defaultComponent({ name: 'api', ports: [31001], containerPorts: [3000], domains: [''] }),
      );
    },
    'compose[1].ports[0]',
  ],
  [
    'PORTS_TOO_MANY',
    (s) => {
      comp(s, {
        ports: [31001, 31002, 31003, 31004, 31005, 31006],
        containerPorts: [1, 2, 3, 4, 5, 6],
        domains: ['', '', '', '', '', ''],
      });
    },
    'compose[0].ports',
  ],
  [
    'CONTAINER_PORT_RANGE',
    (s) => {
      comp(s, { containerPorts: [70_000] });
    },
    'compose[0].containerPorts[0]',
  ],
  [
    'PORT_LENGTH_MISMATCH',
    (s) => {
      comp(s, { ports: [31001, 31002], domains: ['', ''] });
    },
    'compose[0].containerPorts',
  ],
  [
    'DOMAINS_LENGTH_MISMATCH',
    (s) => {
      comp(s, { domains: [] });
    },
    'compose[0].domains',
  ],
  [
    'PORT_FEE',
    (s) => {
      comp(s, { ports: [8080] });
    },
    'compose[0].ports[0]',
  ],
  [
    'NO_PUBLIC_PORT',
    (s) => {
      comp(s, { ports: [], containerPorts: [], domains: [] });
    },
    'compose',
  ],
  [
    'DATABASE_PORT_PUBLIC',
    (s) => {
      comp(s, { containerPorts: [6379] });
    },
    'compose[0].ports[0]',
  ],
  ['PORT_PRIVILEGED_CONTAINER', () => undefined, 'compose[0].containerPorts[0]', { teaching: true }],
  [
    'PORT_ENV_MISMATCH',
    (s) => {
      comp(s, { environmentParameters: ['PORT=3000'] });
    },
    'compose[0].containerPorts',
  ],
  [
    'CONTAINER_PORT_UNUSUAL',
    (s) => {
      comp(s, { containerPorts: [3000] });
    },
    'compose[0].containerPorts',
  ],
  [
    'BIND_LOCALHOST',
    (s) => {
      comp(s, { environmentParameters: ['HOST=127.0.0.1'] });
    },
    'compose[0].environmentParameters[0]',
  ],
  [
    'DOMAIN_TOO_LONG',
    (s) => {
      comp(s, { domains: [`${'a'.repeat(250)}.com`] });
    },
    'compose[0].domains[0]',
  ],
  [
    'DOMAIN_FORMAT',
    (s) => {
      comp(s, { domains: ['my site/path'] });
    },
    'compose[0].domains[0]',
  ],
  [
    'DOMAIN_IS_GENERATED',
    (s) => {
      comp(s, { domains: ['foo.app.runonflux.io'] });
    },
    'compose[0].domains[0]',
  ],
  [
    'DOMAIN_APEX',
    (s) => {
      comp(s, { domains: ['example.com'] });
    },
    'compose[0].domains[0]',
  ],
  [
    'ENV_TOO_MANY',
    (s) => {
      comp(s, { environmentParameters: Array.from({ length: 21 }, (_, i) => `K${i}=v`) });
    },
    'compose[0].environmentParameters',
  ],
  [
    'ENV_TOO_LONG',
    (s) => {
      comp(s, { environmentParameters: [`K=${'v'.repeat(400)}`] });
    },
    'compose[0].environmentParameters[0]',
  ],
  [
    'ENV_FORMAT',
    (s) => {
      comp(s, { environmentParameters: ['JUSTAWORD'] });
    },
    'compose[0].environmentParameters[0]',
  ],
  [
    'ENV_WHITESPACE',
    (s) => {
      comp(s, { environmentParameters: ['KEY = value'] });
    },
    'compose[0].environmentParameters[0]',
  ],
  [
    'ENV_SECRET_PUBLIC',
    (s) => {
      comp(s, { environmentParameters: ['DB_PASSWORD=hunter2hunter2'] });
    },
    'compose[0].environmentParameters[0]',
  ],
  [
    'ENV_RESERVED_NAME',
    (s) => {
      comp(s, { environmentParameters: ['FLUX_APP_NAME=x'] });
    },
    'compose[0].environmentParameters[0]',
  ],
  [
    'STORAGE_LINK_INVALID',
    (s) => {
      comp(s, { environmentParameters: ['F_S_ENV=http://evil.example/x'] });
    },
    'compose[0].environmentParameters[0]',
  ],
  [
    'COMMANDS_TOO_MANY',
    (s) => {
      comp(s, { commands: Array.from({ length: 21 }, () => 'a') });
    },
    'compose[0].commands',
  ],
  [
    'COMMAND_TOO_LONG',
    (s) => {
      comp(s, { commands: ['a'.repeat(401)] });
    },
    'compose[0].commands[0]',
  ],
  [
    'COMMAND_UNSPLIT',
    (s) => {
      comp(s, { commands: ['node server.js --port 80'] });
    },
    'compose[0].commands[0]',
  ],
  [
    'COMMAND_PRIVILEGED',
    (s) => {
      comp(s, { commands: ['--privileged'] });
    },
    'compose[0].commands[0]',
  ],
  ['HEALTH_NOT_CHECKED', () => undefined, 'compose', { teaching: true }],
  [
    'CONTAINER_DATA_TOO_SHORT',
    (s) => {
      comp(s, { containerData: '' });
    },
    'compose[0].containerData',
  ],
  [
    'CONTAINER_DATA_TOO_LONG',
    (s) => {
      comp(s, { containerData: `/${'a'.repeat(200)}` });
    },
    'compose[0].containerData',
  ],
  [
    'CONTAINER_DATA_SYNTAX',
    (s) => {
      comp(s, { containerData: 'data' });
    },
    'compose[0].containerData',
  ],
  [
    'CONTAINER_DATA_COMPONENT_REF',
    (s) => {
      comp(s, { containerData: '/data|3:/x' });
    },
    'compose[0].containerData',
  ],
  [
    'CONTAINER_DATA_SYNC_FLAGS',
    (s) => {
      comp(s, { containerData: 'rg:/data' });
    },
    'compose[0].containerData',
  ],
  [
    'STATEFUL_NO_VOLUME',
    (s) => {
      comp(s, {
        repotag: 'mysql:8.4',
        ram: 1000,
        hdd: 10,
        ports: [],
        containerPorts: [],
        domains: [],
        containerData: 'g:/tmp',
      });
    },
    'compose[0].containerData',
  ],
  [
    'STATEFUL_NOT_SYNCED',
    (s) => {
      comp(s, {
        repotag: 'mysql:8.4',
        ram: 1000,
        hdd: 10,
        ports: [],
        containerPorts: [],
        domains: [],
        containerData: '/var/lib/mysql',
      });
    },
    'compose[0].containerData',
  ],
  [
    'DB_ON_REPLICATED_MOUNT',
    (s) => {
      comp(s, {
        repotag: 'mysql:8.4',
        ram: 1000,
        hdd: 10,
        ports: [],
        containerPorts: [],
        domains: [],
        containerData: 'r:/var/lib/mysql',
      });
    },
    'compose[0].containerData',
  ],
  [
    'SYNC_SINGLE_INSTANCE',
    (s) => {
      s.instances = 1;
      comp(s, { containerData: 'r:/data' });
    },
    'compose[0].containerData',
  ],
  [
    'GEO_TOO_MANY',
    (s) => {
      s.geolocation = Array.from({ length: 11 }, () => 'acEU');
    },
    'geolocation',
  ],
  [
    'GEO_TOO_LONG',
    (s) => {
      s.geolocation = [`acEU_${'X'.repeat(50)}`];
    },
    'geolocation[0]',
  ],
  [
    'GEO_SYNTAX',
    (s) => {
      s.geolocation = ['Europe'];
    },
    'geolocation[0]',
  ],
  [
    'GEO_CONFLICT',
    (s) => {
      s.geolocation = ['acEU', 'a!cEU'];
    },
    'geolocation',
  ],
  [
    'GEO_LEGACY',
    (s) => {
      s.geolocation = ['aEU'];
    },
    'geolocation[0]',
  ],
  [
    'GEO_ONE_REGION',
    (s) => {
      s.geolocation = ['acEU_DE'];
    },
    'geolocation',
  ],
  [
    'STATICIP_COST',
    (s) => {
      s.staticip = true;
    },
    'staticip',
  ],
  [
    'NODES_TOO_MANY',
    (s) => {
      s.nodes = Array.from({ length: 121 }, (_, i) => `192.0.2.${i % 250}:16127`);
    },
    'nodes',
  ],
  [
    'NODE_ENTRY_TOO_LONG',
    (s) => {
      s.nodes = ['x'.repeat(71)];
    },
    'nodes[0]',
  ],
  [
    'NODES_NEED_ENTERPRISE',
    (s) => {
      s.nodes = ['192.0.2.1:16127', '192.0.2.2:16127', '192.0.2.3:16127'];
    },
    'nodes',
  ],
  [
    'NODES_OWNER_PRIVILEGE',
    (s) => {
      s.nodes = ['192.0.2.1:16127', '192.0.2.2:16127', '192.0.2.3:16127'];
    },
    'nodes',
  ],
  [
    'NODES_FORMAT',
    (s) => {
      s.nodes = ['my-node'];
    },
    'nodes[0]',
  ],
  [
    'NODES_DUPLICATE',
    (s) => {
      s.nodes = ['192.0.2.1:16127', '192.0.2.1:16127'];
    },
    'nodes[1]',
  ],
  [
    'DATACENTER_PRIVILEGE',
    (s) => {
      s.datacenter = true;
    },
    'datacenter',
  ],
  [
    'EXPIRE_LOW',
    (s) => {
      s.expire = 0;
    },
    'expire',
  ],
  [
    'EXPIRE_HIGH',
    (s) => {
      s.expire = 2_000_000;
    },
    'expire',
  ],
  [
    'EXPIRE_FRACTIONAL',
    (s) => {
      s.expire = 88_000.5;
    },
    'expire',
  ],
  [
    'EXPIRE_ONE_BLOCK',
    (s) => {
      s.expire = 1;
    },
    'expire',
  ],
  [
    'EXPIRE_SHORT',
    (s) => {
      s.expire = 5000;
    },
    'expire',
  ],
  [
    'ENTERPRISE_OPAQUE',
    (s) => {
      s.enterprise = BIG_ENTERPRISE;
      s.compose = [];
    },
    'compose',
  ],
  [
    'ENTERPRISE_BLOB_FORMAT',
    (s) => {
      s.enterprise = 'short';
    },
    'enterprise',
  ],
  [
    'ENTERPRISE_PLAIN_COMPOSE',
    (s) => {
      s.enterprise = BIG_ENTERPRISE;
    },
    'compose',
  ],
  [
    'ENTERPRISE_AMD64',
    (s) => {
      s.enterprise = BIG_ENTERPRISE;
    },
    'enterprise',
  ],
  [
    'NETWORK_WITH_FORMAT',
    (s) => {
      s.description = 'links networkWith: other';
    },
    'description',
  ],
];

test('every catalogue code has a triggering case and vice versa', () => {
  const covered = new Set(CASES.map((c) => c[0]));
  for (const code of Object.keys(LINT_CODES)) assert.ok(covered.has(code), `no test case for ${code}`);
  for (const c of covered) assert.ok(LINT_CODES[c], `unknown code ${c}`);
  assert.ok(Object.keys(LINT_CODES).length >= 40);
});

for (const [code, mut, path, ctx] of CASES) {
  test(`lint ${code}`, () => {
    const report = lintSpec(make(mut), ctx);
    const hit = report.issues.find((i) => i.code === code && (path === undefined || i.path.startsWith(path)));
    assert.ok(
      hit,
      `${code} not found at ${path}; got ${report.issues.map((i) => `${i.code}@${i.path}`).join(', ')}`,
    );
    const meta = LINT_CODES[code];
    assert.equal(hit.severity, meta?.severity, 'severity follows the catalogue');
    assert.ok(hit.message.length > 8, 'has a message');
    assert.ok(hit.why.length > 20, 'has a why');
    assert.ok(hit.fix.length > 8, 'has a fix');
    assert.equal(report.valid, report.errors === 0);
    assert.equal(report.errors + report.warnings + report.infos, report.issues.length);
  });
}

test('the default spec has no errors or warnings', () => {
  const r = lintSpec(defaultSpec());
  assert.deepEqual(
    r.issues.filter((i) => i.severity !== 'info'),
    [],
  );
  assert.equal(r.valid, true);
});

test('the example owner is a real checksummed Flux ID', () => {
  assert.equal(
    lintSpec({ ...defaultSpec(), owner: EXAMPLE_OWNER }).issues.some((i) => i.code.startsWith('OWNER')),
    false,
  );
});

test('issues are sorted errors, warnings, infos', () => {
  const r = lintSpec(
    make((s) => {
      s.name = 'bad_name';
      s.instances = 1;
      s.contacts = ['a@b.c'];
    }),
  );
  const order = { error: 0, warning: 1, info: 2 } as const;
  for (let i = 1; i < r.issues.length; i++) {
    assert.ok(order[r.issues[i - 1]!.severity] <= order[r.issues[i]!.severity]);
  }
});

test('copy rules: no em dashes, no emoji, plain sentences', () => {
  for (const m of Object.values(LINT_CODES)) {
    for (const t of [m.title, m.why, m.fix]) {
      assert.ok(!/[\u2014\u2013]/.test(t), `${m.code}: dash in "${t}"`);
      assert.ok(!/\p{Extended_Pictographic}/u.test(t), `${m.code}: emoji`);
    }
    assert.ok(/[.!?]$/.test(m.why) && /[.!?]$/.test(m.fix), `${m.code}: sentences end with a full stop`);
    if (m.docs) assert.match(m.docs, /^https:\/\/docs\.runonflux\.com\//);
  }
});

test('provenance: rules that are not read in the FluxOS source are not tagged as source (basis)', () => {
  const inference = [
    'CONTAINER_PORT_UNUSUAL',
    'ENV_FORMAT',
    'ENV_WHITESPACE',
    'DOMAIN_APEX',
    'GEO_ONE_REGION',
    'DATABASE_PORT_PUBLIC',
    'STATEFUL_NO_VOLUME',
    'IMAGE_IMPLICIT_REGISTRY',
    'DISK_SMALL_STATEFUL',
    'INSTANCES_ONE',
  ];
  for (const code of inference) assert.equal(lintBasis(LINT_CODES[code]!), 'inference', code);
  // The low-port rule is a guess about Docker on a Flux node: it must not read "source".
  assert.equal(lintBasis(LINT_CODES.PORT_PRIVILEGED_CONTAINER!), 'unverified');
  // Read in the source or tested live on 2026-10-13 (FACTS 3.2, 3.3, 3.5, 6.3).
  for (const code of [
    'GEO_CONFLICT',
    'GEO_SYNTAX',
    'IMAGE_UPPERCASE',
    'IMAGE_DOCKER_IO_HOST',
    'IMAGE_LATEST',
  ]) {
    assert.equal(lintBasis(LINT_CODES[code]!), 'source', code);
  }
  assert.equal(lintBasis(LINT_CODES.REPOAUTH_FORMAT!), 'source');
  assert.equal(lintBasis(LINT_CODES.DESCRIPTION_MISSING!), 'source');
  // Rules read in the validator keep the default.
  assert.equal(lintBasis(LINT_CODES.PORT_BANNED!), 'source');
  assert.equal(lintBasis(LINT_CODES.NAME_FORMAT!), 'source');
  // A source string that says UNVERIFIED can never come out as "source".
  for (const m of Object.values(LINT_CODES)) {
    if (/UNVERIFIED/.test(m.source)) assert.notEqual(lintBasis(m), 'source', m.code);
  }
});

test('size rules use the disk a nominal node really has (FACTS 2.3, 2.4)', () => {
  const cum = LINT_CODES.SIZE_EXCLUDES_CUMULUS!;
  const nim = LINT_CODES.SIZE_NEEDS_STRATUS!;
  assert.match(cum.why, /129 GB/);
  assert.match(cum.why, /160 GB/);
  assert.match(cum.fix, /129 GB/);
  assert.match(nim.why, /338 GB/);
  assert.match(nim.why, /380 GB/);
  // Bigger nodes do not make a big app wait; that delay is for small apps (FACTS 2.4).
  assert.ok(!/two hours|fewest/i.test(nim.why));
  const s = base();
  comp(s, { hdd: 140 });
  const r = lintSpec(s);
  assert.ok(
    r.issues.some((i) => i.code === 'SIZE_EXCLUDES_CUMULUS'),
    '140 GB does not fit a 129 GB node',
  );
  const s2 = base();
  comp(s2, { hdd: 129 });
  assert.ok(!lintSpec(s2).issues.some((i) => i.code === 'SIZE_EXCLUDES_CUMULUS'));
});

test('fee wording: a fee goes into the three-instance bundle, never "USD 2 each" flat', () => {
  for (const code of ['PORT_FEE', 'STATICIP_COST']) {
    const m = LINT_CODES[code]!;
    assert.match(m.why, /divided by 3/, code);
    assert.ok(!/2 dollars/i.test(m.why), `${code}: no flat dollar wording`);
  }
});

test('the old tutorial spec gets the v8 explanations', () => {
  const r = lintSpec({
    version: 7,
    name: 'old-app',
    description: 'd',
    owner: EXAMPLE_OWNER,
    instances: 3,
    contacts: [],
    geolocation: [],
    expire: 88_000,
    nodes: [],
    staticip: false,
    compose: [{ ...defaultComponent(), tiered: true, cpubasic: 1, secrets: '' }],
  });
  const keys = r.issues.filter((i) => i.code === 'UNKNOWN_FIELD').map((i) => i.path);
  assert.ok(keys.includes('compose[0].tiered'));
  assert.ok(keys.includes('compose[0].cpubasic'));
  assert.ok(keys.includes('compose[0].secrets'));
  assert.ok(r.issues.some((i) => i.code === 'VERSION_CHANGED'));
  assert.ok(r.issues.find((i) => i.path.endsWith('tiered'))?.why.includes('no tiers'));
});

test('port collisions across components are found with the later path', () => {
  const s = base();
  s.compose.push(defaultComponent({ name: 'api', ports: [31001], containerPorts: [3000], domains: [''] }));
  const r = lintSpec(s);
  const d = r.issues.find((i) => i.code === 'PORT_DUPLICATE');
  assert.equal(d?.path, 'compose[1].ports[0]');
  assert.equal(r.valid, false);
});

test('suggestions are offered where there is an obvious fix', () => {
  const r = lintSpec(
    make((s) => {
      s.name = 'my app!';
      comp(s, { name: 'web-server', containerData: '' });
    }),
  );
  assert.equal(r.issues.find((i) => i.code === 'NAME_FORMAT')?.suggestion, 'my-app');
  assert.equal(r.issues.find((i) => i.code === 'COMPONENT_NAME_FORMAT')?.suggestion, 'webserver');
  assert.equal(r.issues.find((i) => i.code === 'CONTAINER_DATA_TOO_SHORT')?.suggestion, '/tmp');
});

test('the RAM suggestion for a known image is a size the network accepts', () => {
  // mysql needs 512 MB by the image data; ram moves in steps of 100 MB, so the fix on offer is 600.
  const small = (ram: number) =>
    make((s) => {
      comp(s, {
        repotag: 'mysql:8.4',
        ram,
        ports: [],
        containerPorts: [],
        domains: [],
        containerData: 'g:/var/lib/mysql',
      });
    });
  const r = lintSpec(small(100));
  const issue = r.issues.find((i) => i.code === 'RAM_TOO_SMALL_FOR_IMAGE');
  assert.ok(issue, 'a 100 MB mysql component is flagged');
  assert.equal(issue.suggestion, 600);
  const fixed = lintSpec(small(Number(issue.suggestion)));
  assert.ok(!fixed.issues.some((i) => i.code === 'RAM_TOO_SMALL_FOR_IMAGE' || i.code === 'RAM_STEP'));
});

test('enterprise apps may carry repoauth and pinned nodes without errors', () => {
  const r = lintSpec(
    make((s) => {
      s.enterprise = BIG_ENTERPRISE;
      s.nodes = ['192.0.2.1:16127', '192.0.2.2:16127', '192.0.2.3:16127'];
      comp(s, { repoauth: 'user:token', repotag: 'ghcr.io/me/private:1.0' });
    }),
  );
  assert.equal(r.valid, true);
  assert.ok(
    !r.issues.some((i) => i.code === 'REPOAUTH_NEEDS_ENTERPRISE' || i.code === 'NODES_NEED_ENTERPRISE'),
  );
});

test('secrets are not flagged in enterprise apps or when they are placeholders', () => {
  const ent = lintSpec(
    make((s) => {
      s.enterprise = BIG_ENTERPRISE;
      comp(s, { environmentParameters: ['DB_PASSWORD=real-secret-value'] });
    }),
  );
  assert.ok(!ent.issues.some((i) => i.code === 'ENV_SECRET_PUBLIC'));
  const ph = lintSpec(
    make((s) => {
      comp(s, {
        environmentParameters: ['DB_PASSWORD=change-me', 'API_KEY=', ['TOKEN=', '$', '{TOKEN}'].join('')],
      });
    }),
  );
  assert.ok(!ph.issues.some((i) => i.code === 'ENV_SECRET_PUBLIC'));
});

test('lintSpec never throws and always reports consistent counts (property)', () => {
  let seed = 12345;
  const r = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const pool: unknown[] = [
    null,
    undefined,
    0,
    -1,
    1,
    3,
    1e9,
    Number.NaN,
    '',
    'x',
    '3',
    'a'.repeat(300),
    true,
    false,
    [],
    {},
    [1, 2],
    ['a=b'],
    { name: 5 },
  ];
  const gen = (d: number): unknown => {
    if (d > 3 || r() < 0.4) return pool[Math.floor(r() * pool.length)];
    if (r() < 0.5) return Array.from({ length: Math.floor(r() * 4) }, () => gen(d + 1));
    const keys = [
      'name',
      'compose',
      'ports',
      'containerPorts',
      'domains',
      'cpu',
      'ram',
      'hdd',
      'instances',
      'expire',
      'repotag',
      'containerData',
      'environmentParameters',
      'commands',
      'geolocation',
      'nodes',
      'owner',
      'enterprise',
      'contacts',
      'staticip',
      'version',
      'repoauth',
    ];
    const o: Record<string, unknown> = {};
    for (let i = 0; i < Math.floor(r() * 8); i++) o[keys[Math.floor(r() * keys.length)]!] = gen(d + 1);
    return o;
  };
  for (let i = 0; i < 600; i++) {
    const rep = lintSpec(gen(0), i % 3 === 0 ? { teaching: true, eligibleNodes: 5 } : {});
    assert.equal(rep.valid, rep.errors === 0);
    assert.equal(rep.issues.length, rep.errors + rep.warnings + rep.infos);
    for (const it of rep.issues) assert.ok(LINT_CODES[it.code], it.code);
  }
  for (const junk of [null, undefined, 'x', 5, [], () => 1, Symbol('x'), 10n]) {
    assert.doesNotThrow(() => lintSpec(junk));
  }
});

test('lintSpec does not mutate its input', () => {
  const s = make((x) => {
    x.instances = 1;
    comp(x, { ports: [8080] });
  }) as FluxAppSpec;
  const before = JSON.stringify(s);
  lintSpec(s);
  assert.equal(JSON.stringify(s), before);
});

test('wording follows FACTS: no invented rationale, no overclaim (2026-10-13 pass)', () => {
  const m = LINT_CODES;
  // 3.2: two instances survive one failure; FluxCloud recommends 3 (9.4.2).
  assert.match(m.INSTANCES_LOW!.fix, /Two instances also keep serving/);
  assert.match(m.INSTANCES_LOW!.fix, /recommends 3/);
  // 4.3 step A, 4.4: the flat 0.50 rule for cheap apps with more than 2 extra instances.
  assert.match(m.INSTANCES_PRICE_CLIFF!.why, /flat USD 0\.50/);
  assert.match(m.INSTANCES_PRICE_CLIFF!.why, /more than 2 extra instances/);
  // 8.3: commands are arguments after the ENTRYPOINT; sh -c needs sh and no conflicting ENTRYPOINT.
  assert.doesNotMatch(m.COMMAND_UNSPLIT!.why, /single program name/);
  assert.match(m.COMMAND_UNSPLIT!.why, /ENTRYPOINT/);
  assert.match(m.COMMAND_UNSPLIT!.fix, /only works when/);
  // 3.6: --privileged is only stripped from commands.
  assert.doesNotMatch(m.COMMAND_PRIVILEGED!.why, /never run/);
  // 3.3: the rule only, no reason.
  assert.doesNotMatch(m.CONTAINER_DATA_TOO_SHORT!.why, /on purpose/);
  // a live count is dated or dropped.
  assert.doesNotMatch(m.SIZE_EXCLUDES_CUMULUS!.why, /most common tier\./);
  assert.match(m.SIZE_EXCLUDES_CUMULUS!.why, /At the time of writing/);
  // 3.4: port 0 is refused, so the fee range reads 1 to 1023.
  for (const meta of Object.values(m)) {
    for (const t of [meta.why, meta.fix, meta.title]) assert.doesNotMatch(t, /0 to 1023|0-1023/, meta.code);
  }
  // no unsupported quantification.
  assert.doesNotMatch(m.DATABASE_PORT_PUBLIC!.why, /within minutes/);
  assert.match(m.DATABASE_PORT_PUBLIC!.why, /general security advice/);
  // 3.3 and 9.4.2: name the documented forms and the shorter ones the form shows; do not claim what fails.
  assert.match(m.REPOAUTH_FORMAT!.why, /aws-ecr:\/\//);
  assert.match(m.REPOAUTH_FORMAT!.why, /aws:\/\//);
  assert.doesNotMatch(m.REPOAUTH_FORMAT!.why, /anything else fails/);
  // 3.2: "" and an absent key both fail, " " passes.
  assert.equal(m.DESCRIPTION_MISSING!.severity, 'error');
  assert.doesNotMatch(m.DESCRIPTION_MISSING!.source, /UNVERIFIED/);
  // 3.5: a contradictory list is accepted at registration; nothing is promised to run.
  assert.equal(m.GEO_CONFLICT!.severity, 'warning');
  assert.match(m.GEO_CONFLICT!.why, /nothing is promised to run/);
  assert.equal(m.INSTANCES_EXCEED_NODES!.severity, 'error');
  // 3.2 correction: the signature covers the formatted spec.
  assert.match(m.UNKNOWN_FIELD!.why, /signature/);
  // 2.3 corrected: per-component steps are form sliders, not enforced.
  for (const code of ['CPU_STEP', 'RAM_STEP', 'HDD_STEP'] as const) {
    assert.equal(m[code]!.severity, 'warning', code);
    assert.match(m[code]!.why, /enforces no/, code);
  }
});

test('repoauth short provider names are flagged, documented ones are not (FACTS 3.3, 14.1)', () => {
  const codesFor = (repoauth: string) => {
    const s = base();
    s.enterprise = BIG_ENTERPRISE;
    comp(s, { repoauth });
    return lintSpec(s).issues.filter((i) => i.code === 'REPOAUTH_FORMAT');
  };
  for (const short of [
    'aws://123456789012.dkr.ecr.eu-west-1.amazonaws.com',
    'azure://myregistry',
    'google://project',
  ]) {
    const hits = codesFor(short);
    assert.equal(hits.length, 1, short);
    assert.match(hits[0]!.message, /Unknown provider type/);
  }
  for (const ok of [
    'user:token',
    'aws-ecr://123456789012.dkr.ecr.eu-west-1.amazonaws.com',
    'azure-acr://r',
    'google-gar://p',
  ]) {
    assert.equal(codesFor(ok).length, 0, ok);
  }
});
