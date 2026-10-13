import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BANNED_PORT_RANGES,
  checkOwner,
  defaultSpec,
  derivedNames,
  EXAMPLE_OWNER,
  isBannedPort,
  isSurchargePort,
  LIMITS,
  normalizeSpec,
  parseContainerData,
  parseEnv,
  parseGeolocationEntry,
  parseRepotag,
  SPEC_VERSION,
  specSignature,
} from './spec.ts';

// A tiny seeded generator so the property tests are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function randomJson(r: () => number, depth = 0): unknown {
  const k = Math.floor(r() * (depth > 3 ? 6 : 9));
  switch (k) {
    case 0:
      return null;
    case 1:
      return r() < 0.5;
    case 2:
      return Math.floor(r() * 2000) - 100;
    case 3:
      return r() * 10;
    case 4:
      return ['', 'web', '3', 'true', '/data', 'nginx:latest', 'acEU', 'KEY=v', 'x'.repeat(30)][
        Math.floor(r() * 9)
      ];
    case 5:
      return undefined;
    case 6: {
      const n = Math.floor(r() * 4);
      return Array.from({ length: n }, () => randomJson(r, depth + 1));
    }
    default: {
      const keys = [
        'name',
        'compose',
        'ports',
        'cpu',
        'instances',
        'domains',
        'repotag',
        'expire',
        'nodes',
        'x',
        'containerData',
        'enterprise',
        'geolocation',
        'version',
      ];
      const o: Record<string, unknown> = {};
      const n = Math.floor(r() * 6);
      for (let i = 0; i < n; i++) o[keys[Math.floor(r() * keys.length)] ?? 'x'] = randomJson(r, depth + 1);
      return o;
    }
  }
}

test('SPEC_VERSION is 8', () => {
  assert.equal(SPEC_VERSION, 8);
  assert.equal(defaultSpec().version, 8);
});

test('limits match the verified network values', () => {
  assert.equal(LIMITS.name.maxLength, 63);
  assert.equal(LIMITS.instances.min, 1);
  assert.equal(LIMITS.instances.max, 100);
  assert.equal(LIMITS.component.max, 10);
  assert.equal(LIMITS.ports.perComponentMax, 5);
  assert.equal(LIMITS.environment.maxCount, 20);
  assert.equal(LIMITS.environment.maxLength, 400);
  assert.equal(LIMITS.repotag.maxLength, 200);
  assert.equal(LIMITS.containerData.minLength, 2);
  assert.equal(LIMITS.expire.max, 1_056_000);
  assert.deepEqual(LIMITS.totals, { cpu: 15, ram: 59_000, hdd: 820 });
  assert.equal(LIMITS.geolocation.maxCount, 10);
  assert.equal(LIMITS.nodes.maxCount, 120);
  assert.equal(BANNED_PORT_RANGES.length, 19);
});

test('name patterns', () => {
  const app = LIMITS.name.pattern;
  for (const ok of ['a', 'hello-flux', 'My-App-2', '5730e893']) assert.ok(app.test(ok), ok);
  for (const bad of ['-a', 'a-', 'a_b', 'a b', '', 'héllo']) assert.ok(!app.test(bad), bad);
  const comp = LIMITS.component.namePattern;
  assert.ok(comp.test('web2'));
  assert.ok(!comp.test('web-server'));
});

test('banned and surcharge ports', () => {
  for (const p of [22, 25, 53, 123, 3389, 27017, 8384, 16100, 16299, 26150, 30000, 30099])
    assert.ok(isBannedPort(p), String(p));
  for (const p of [21, 80, 443, 3000, 8080, 16300, 30100, 31001]) assert.ok(!isBannedPort(p), String(p));
  for (const p of [0, 1, 80, 443, 1023, 8080, 8081, 8443, 6667]) assert.ok(isSurchargePort(p), String(p));
  for (const p of [1024, 3000, 8000, 8082, 31001, 65535]) assert.ok(!isSurchargePort(p), String(p));
});

test('geolocation entries', () => {
  const e = parseGeolocationEntry('acEU_DE_BY');
  assert.equal(e.kind, 'allow-region');
  assert.equal(e.continent, 'EU');
  assert.equal(e.country, 'DE');
  assert.equal(e.region, 'BY');
  assert.equal(parseGeolocationEntry('acEU').kind, 'allow-continent');
  assert.equal(parseGeolocationEntry('acEU_ALL').kind, 'allow-continent');
  assert.equal(parseGeolocationEntry('acALL').kind, 'allow-all');
  assert.equal(parseGeolocationEntry('acNA_US').kind, 'allow-country');
  assert.equal(parseGeolocationEntry('a!cAS_CN').kind, 'deny-country');
  assert.equal(parseGeolocationEntry('aEU').kind, 'legacy-continent');
  assert.equal(parseGeolocationEntry('bDE').kind, 'legacy-country');
  assert.ok(parseGeolocationEntry('acXX').problems.length > 0);
  assert.ok(parseGeolocationEntry('acEU_Germany').problems.length > 0);
  assert.ok(parseGeolocationEntry('a!cALL').problems.length > 0, 'denying ALL bans nothing');
  assert.ok(parseGeolocationEntry('EU').problems.length > 0);
  assert.deepEqual(parseGeolocationEntry('acEU_DE').problems, []);
  assert.ok(parseGeolocationEntry('acEU_DE_FR-IDF').problems.length > 0, 'region of another country');
});

test('containerData grammar', () => {
  const ok = (s: string) => {
    const p = parseContainerData(s);
    assert.deepEqual(p.errors, [], s);
    return p;
  };
  assert.equal(ok('/data').syncMode, null);
  assert.equal(ok('r:/data').syncMode, 'r');
  assert.equal(ok('g:/data').syncMode, 'g');
  assert.equal(ok('s:/data').syncMode, 's');
  assert.equal(ok('r:/data|m:logs:/var/log|f:config.yaml:/etc/app.yaml').mounts.length, 3);
  assert.equal(ok('/app|0:/database').mounts[1]?.component, 0);
  assert.equal(ok('/app|c:0:backups:/backups|cf:0:cert.pem:/etc/ssl/cert.pem').mounts.length, 3);
  assert.equal(ok('/data|ml:cache:/var/cache').mounts[1]?.kind, 'local-directory');
  const bad = (s: string) => assert.ok(parseContainerData(s).errors.length > 0, s);
  bad('');
  bad('data');
  bad('x:/data');
  bad('/data|r:/more');
  bad('/data|m:../etc:/x');
  bad('/data|m:appdata:/x');
  bad('/data|m:logs:/a|m:logs:/b');
  bad('/data|m:logs:/data');
  bad('/data|f:.stignore:/x');
  bad('/a/../b');
  bad('/data|c:x:logs:/l');
  bad('r:/a:b');
});

test('repotag grammar', () => {
  const r = parseRepotag('ghcr.io/owner/app:1.2.3');
  assert.equal(r.registry, 'ghcr.io');
  assert.equal(r.namespace, 'owner');
  assert.equal(r.repository, 'app');
  assert.equal(r.tag, '1.2.3');
  assert.deepEqual(r.problems, []);
  const hub = parseRepotag('nginx');
  assert.equal(hub.registry, null);
  assert.equal(hub.tag, null);
  assert.equal(parseRepotag('library/nginx:1.27').namespace, 'library');
  assert.equal(parseRepotag('localhost:5000/team/app:dev').registry, 'localhost:5000');
  assert.equal(parseRepotag('nginx@sha256:abc').digest, 'sha256:abc');
  assert.ok(parseRepotag('my app').problems.length > 0);
  assert.ok(parseRepotag('/nginx').problems.length > 0);
  assert.ok(parseRepotag('Nginx:1').problems.some((p) => p.includes('lowercase')));
  assert.ok(parseRepotag('nginx:').problems.length > 0);
  assert.ok(parseRepotag('').problems.length > 0);
});

test('env parsing', () => {
  assert.deepEqual(parseEnv('A=b=c'), { key: 'A', value: 'b=c' });
  assert.equal(parseEnv('=x'), null);
  assert.equal(parseEnv('plain'), null);
});

test('owner check validates the Flux ID checksum', () => {
  assert.equal(checkOwner(EXAMPLE_OWNER), 'ok');
  assert.equal(checkOwner('17CgKMG6SETpDv9GS17F1KxHCAD4uxsftW'), 'ok');
  assert.equal(checkOwner('1hjy4bCYBJr4mny4zCE85J94RXa8W6q37xyz'), 'shape');
  assert.equal(checkOwner('1hjy4bCYBJr4mny4zCE85J94RXa8W6q38'), 'checksum');
  assert.equal(checkOwner('0x0c894752ba986f3f6f081eeb05c1c4a482fe8717'), 'ok');
  assert.equal(checkOwner('0xZZ'), 'shape');
  assert.equal(checkOwner(''), 'empty');
  assert.equal(checkOwner('myzelid'), 'shape');
  assert.equal(checkOwner('t1LUs6quf7TB2zVZmexqPQdnqmrFMGZGjV6'), 'shape', 'must start with 1');
});

test('defaultSpec is a complete v8 spec', () => {
  const s = defaultSpec();
  assert.deepEqual(Object.keys(s).sort(), [...LIMITS.appKeys].filter((k) => k !== 'datacenter').sort());
  for (const c of s.compose) assert.deepEqual(Object.keys(c).sort(), [...LIMITS.componentKeys].sort());
  const n = normalizeSpec(s);
  assert.deepEqual(n.spec, s);
  assert.deepEqual(n.defaulted, []);
  assert.deepEqual(n.notes, []);
});

test('normalizeSpec coerces loose input without throwing', () => {
  const n = normalizeSpec({
    name: 'x',
    instances: '5',
    expire: '88000',
    staticip: 'true',
    compose: [{ name: 'web', ports: ['8080', 3000, 'x'], cpu: '0.5', environmentParameters: 'A=1' }],
  });
  assert.equal(n.spec.instances, 5);
  assert.equal(n.spec.expire, 88000);
  assert.equal(n.spec.staticip, true);
  assert.deepEqual(n.spec.compose[0]?.ports, [8080, 3000]);
  assert.equal(n.spec.compose[0]?.cpu, 0.5);
  assert.deepEqual(n.spec.compose[0]?.environmentParameters, ['A=1']);
  assert.ok(n.coerced.includes('instances'));
  assert.ok(n.defaulted.includes('owner'));
  assert.ok(n.notes.some((x) => x.includes('not a number')));
});

test('normalizeSpec keeps out of range values so lint can explain them', () => {
  const n = normalizeSpec({ ...defaultSpec(), instances: 0, expire: 5_000_000 });
  assert.equal(n.spec.instances, 0);
  assert.equal(n.spec.expire, 5_000_000);
});

test('normalizeSpec reads the old spelling and flat v1 to v3 specs', () => {
  const n = normalizeSpec({
    version: 3,
    name: 'old',
    description: 'd',
    owner: EXAMPLE_OWNER,
    repotag: 'nginx:1',
    ports: [31000],
    containerPorts: [80],
    domains: [''],
    enviromentParameters: ['A=1'],
    commands: [],
    containerData: '/data',
    cpu: 1,
    ram: 500,
    hdd: 5,
    tiered: false,
    instances: 3,
  });
  assert.equal(n.spec.compose.length, 1);
  assert.deepEqual(n.spec.compose[0]?.environmentParameters, ['A=1']);
  assert.equal(n.spec.version, 8);
  assert.ok(n.notes.length >= 1);
  assert.ok(n.dropped.includes('tiered'));
});

test('normalizeSpec parses a JSON string and survives junk', () => {
  assert.equal(normalizeSpec(JSON.stringify({ name: 'abc' })).spec.name, 'abc');
  for (const junk of [null, undefined, 5, 'not json', [], true, () => 1, Symbol('x')]) {
    const n = normalizeSpec(junk);
    assert.equal(n.spec.version, 8);
    assert.ok(Array.isArray(n.spec.compose));
  }
});

test('normalizeSpec bounds hostile sizes', () => {
  const n = normalizeSpec({
    name: 'x'.repeat(100_000),
    compose: Array.from({ length: 500 }, () => ({ ports: Array.from({ length: 5000 }, (_, i) => i) })),
  });
  assert.ok(n.spec.name.length <= 20_000);
  assert.ok(n.spec.compose.length <= 50);
  assert.ok((n.spec.compose[0]?.ports.length ?? 0) <= 200);
});

test('normalizeSpec is idempotent on arbitrary JSON (property)', () => {
  const r = rng(42);
  for (let i = 0; i < 400; i++) {
    const input = randomJson(r);
    const once = normalizeSpec(input);
    const twice = normalizeSpec(once.spec);
    assert.deepEqual(twice.spec, once.spec, `case ${i}: ${JSON.stringify(input)}`);
    assert.deepEqual(twice.defaulted, [], `case ${i} defaulted`);
  }
});

test('normalizeSpec output is always a full spec (property)', () => {
  const r = rng(7);
  for (let i = 0; i < 300; i++) {
    const { spec } = normalizeSpec(randomJson(r));
    assert.equal(typeof spec.name, 'string');
    assert.equal(typeof spec.instances, 'number');
    assert.ok(Number.isFinite(spec.instances));
    assert.ok(Number.isFinite(spec.expire));
    for (const c of spec.compose) {
      for (const k of ['name', 'description', 'repotag', 'repoauth', 'containerData'] as const)
        assert.equal(typeof c[k], 'string');
      for (const k of ['cpu', 'ram', 'hdd'] as const) assert.ok(Number.isFinite(c[k]));
      for (const p of c.ports) assert.ok(Number.isFinite(p));
    }
  }
});

test('derivedNames', () => {
  const spec = defaultSpec();
  spec.name = 'My-Blog';
  spec.compose = [
    {
      ...spec.compose[0]!,
      name: 'wordpress',
      ports: [31030, 31031],
      containerPorts: [80, 443],
      domains: ['www.example.com, blog.example.com', ''],
    },
    { ...spec.compose[0]!, name: 'mysql', ports: [], containerPorts: [3306], domains: [] },
  ];
  const d = derivedNames(spec);
  assert.equal(d.appDomain, 'my-blog.app.runonflux.io');
  assert.equal(d.network, 'fluxDockerNetwork_My-Blog');
  assert.equal(d.components[0]?.containerName, 'fluxwordpress_My-Blog');
  assert.deepEqual(d.components[1]?.internalAddresses, ['fluxmysql_My-Blog:3306']);
  assert.equal(d.components[0]?.hostname, 'wordpress');
  assert.equal(d.components[0]?.volumePath, '/apps/fluxwordpress_My-Blog/appdata');
  assert.equal(d.ports[0]?.generatedDomain, 'my-blog_31030.app.runonflux.io');
  assert.deepEqual(d.ports[0]?.customDomains, ['www.example.com', 'blog.example.com']);
  assert.equal(d.ports[0]?.isFirst, true);
  assert.equal(d.ports[1]?.isFirst, false);
});

test('specSignature is stable under key order and sensitive to changes', () => {
  const a = defaultSpec();
  const b = JSON.parse(JSON.stringify(a));
  const reordered = { compose: b.compose, name: b.name, ...b };
  assert.equal(specSignature(a), specSignature(reordered));
  const c = defaultSpec();
  c.instances = 4;
  assert.notEqual(specSignature(a), specSignature(c));
  assert.match(specSignature(a), /^[0-9a-f]{16}$/);
});
