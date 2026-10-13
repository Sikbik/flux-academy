import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lintSpec } from './lint.ts';
import {
  deployToFluxMarkdown,
  deployToFluxUrl,
  isOrbitSpec,
  ORBIT_APP_MARKERS,
  ORBIT_BUILD_VARIABLES,
  ORBIT_CUSTOM,
  ORBIT_FACTS,
  ORBIT_IMAGE,
  ORBIT_PLANS,
  ORBIT_READ_ON,
  ORBIT_RUNTIME_HINT_NAMES,
  ORBIT_SOURCE,
  OrbitUrlError,
  orbitPlanById,
  orbitPlanQuoteUsd,
  orbitPlanSpec,
  orbitSpecMatch,
  tryDeployToFluxUrl,
} from './orbit.ts';
import { BAKED_PRICING, quote } from './pricing.ts';
import { checkOwner, normalizeSpec } from './spec.ts';

const plan = (id: string) => {
  const p = orbitPlanById(id);
  assert.ok(p, `plan ${id}`);
  return p;
};

// ---- plans ------------------------------------------------------------------------------------------------

test('the plan table is the page as read on 2026-10-13', () => {
  assert.equal(ORBIT_READ_ON, '2026-10-13');
  assert.match(ORBIT_SOURCE, /runonflux\.com\/apps\/orbit/);
  assert.deepEqual(
    ORBIT_PLANS.map((p) => [p.id, p.usd, p.vcores, p.ramMb, p.storageGb, p.instances]),
    [
      ['starter', 0.99, 0.5, 1000, 5, 1],
      ['standard', 2.49, 1.5, 4000, 15, 2],
      ['pro', 3.99, 2, 6000, 20, 2],
    ],
  );
  assert.deepEqual(
    ORBIT_PLANS.map((p) => [p.persistentFolders, p.secondPort, p.failover]),
    [
      [false, false, false],
      [true, true, true],
      [true, true, true],
    ],
  );
  assert.equal(ORBIT_CUSTOM.fromUsd, 0.99);
  assert.equal(ORBIT_CUSTOM.instancesMax, 3);
  assert.equal(orbitPlanById('free'), undefined);
});

test('the engine reproduces each published plan price exactly with the baked parameters', () => {
  for (const p of ORBIT_PLANS) {
    assert.equal(orbitPlanQuoteUsd(p, BAKED_PRICING.params), p.usd, p.id);
    assert.equal(orbitPlanQuoteUsd(p), p.usd, `${p.id} default params`);
  }
});

test('Standard and Pro are only reproduced with 2 instances (FACTS 15.3.11)', () => {
  const standard = plan('standard');
  const pro = plan('pro');
  assert.notEqual(orbitPlanQuoteUsd(standard, BAKED_PRICING.params, { instances: 3 }), standard.usd);
  assert.notEqual(orbitPlanQuoteUsd(pro, BAKED_PRICING.params, { instances: 3 }), pro.usd);
  assert.equal(orbitPlanQuoteUsd(standard, BAKED_PRICING.params, { instances: 3 }), 3.99);
  assert.equal(orbitPlanQuoteUsd(pro, BAKED_PRICING.params, { instances: 3 }), 5.99);
  assert.equal(orbitPlanQuoteUsd(standard, BAKED_PRICING.params, { instances: 1 }), 1.49);
  assert.equal(orbitPlanQuoteUsd(pro, BAKED_PRICING.params, { instances: 1 }), 1.99);
  // Starter sits on the USD 0.99 floor at one and two instances; three give 1.49.
  const starter = plan('starter');
  assert.equal(orbitPlanQuoteUsd(starter, BAKED_PRICING.params, { instances: 2 }), 0.99);
  assert.equal(orbitPlanQuoteUsd(starter, BAKED_PRICING.params, { instances: 3 }), 1.49);
});

test('encrypted variant is higher than the published price (engine result only)', () => {
  const encrypted = ORBIT_PLANS.map((p) => orbitPlanQuoteUsd(p, BAKED_PRICING.params, { encrypted: true }));
  assert.deepEqual(encrypted, [1.49, 4.99, 6.49]);
  for (const [i, p] of ORBIT_PLANS.entries()) assert.ok((encrypted[i] ?? 0) > p.usd);
});

test('a plan spec is valid v8, lints without errors and quotes through the engine', () => {
  for (const p of ORBIT_PLANS) {
    const spec = orbitPlanSpec(p);
    assert.equal(spec.version, 8);
    assert.equal(spec.compose.length, 1);
    assert.equal(checkOwner(spec.owner), 'ok');
    assert.equal(spec.instances, p.instances);
    const c = spec.compose[0];
    assert.ok(c);
    assert.equal(c.repotag, ORBIT_IMAGE);
    assert.deepEqual([c.cpu, c.ram, c.hdd], [p.vcores, p.ramMb, p.storageGb]);
    assert.equal(c.ports.length, c.containerPorts.length);
    assert.equal(c.ports.length, c.domains.length);
    const report = lintSpec(spec);
    assert.equal(
      report.errors,
      0,
      `${p.id}: ${JSON.stringify(report.issues.filter((i) => i.severity === 'error'))}`,
    );
    assert.equal(quote(spec).usdTotal, p.usd);
    // Round trip: the spec does not need normalising.
    assert.deepEqual(normalizeSpec(spec).spec, spec);
  }
});

test('a plan spec takes options and keeps the shape of a live Orbit app', () => {
  const spec = orbitPlanSpec(plan('standard'), {
    name: 'my-site',
    repo: 'https://github.com/owner/repo',
    branch: 'production',
    appPort: 8080,
  });
  assert.equal(spec.name, 'my-site');
  assert.match(spec.description, /^Orbit deployment/);
  const c = spec.compose[0];
  assert.ok(c);
  assert.deepEqual(c.environmentParameters, [
    'GIT_REPO_URL=https://github.com/owner/repo',
    'APP_PORT=8080',
    'GIT_BRANCH=production',
  ]);
  assert.deepEqual(c.containerPorts, [8080, 9001]);
  assert.equal(c.containerData, '/app');
  assert.equal(isOrbitSpec(spec), true);
  assert.equal(lintSpec(spec).errors, 0);
});

test('Starter keeps the single instance warning, which is the teaching point', () => {
  const codes = lintSpec(orbitPlanSpec(plan('starter'))).issues.map((i) => i.code);
  assert.ok(codes.includes('INSTANCES_ONE'));
  const standardCodes = lintSpec(orbitPlanSpec(plan('standard'))).issues.map((i) => i.code);
  assert.ok(!standardCodes.includes('INSTANCES_ONE'));
});

// ---- the button URL ---------------------------------------------------------------------------------------

test('the documented example is reproduced byte for byte', () => {
  assert.equal(
    deployToFluxUrl({
      repo: 'https://github.com/RunOnFlux/deploy-with-git-samples',
      branch: 'master',
      projectPath: 'express',
      plan: 'standard',
    }),
    'https://runonflux.com/apps/orbit?repo=https://github.com/RunOnFlux/deploy-with-git-samples&branch=master&projectPath=express&plan=standard',
  );
});

test('unset parameters are omitted and the order is repo, branch, projectPath, plan', () => {
  assert.equal(
    deployToFluxUrl({ repo: 'https://github.com/o/r' }),
    'https://runonflux.com/apps/orbit?repo=https://github.com/o/r',
  );
  assert.equal(
    deployToFluxUrl({ plan: 'pro', projectPath: 'apps/web', repo: 'https://github.com/o/r' }),
    'https://runonflux.com/apps/orbit?repo=https://github.com/o/r&projectPath=apps/web&plan=pro',
  );
  assert.equal(
    deployToFluxUrl({ repo: 'https://github.com/o/r', plan: 'starter' }),
    'https://runonflux.com/apps/orbit?repo=https://github.com/o/r&plan=starter',
  );
  const url = new URL(
    deployToFluxUrl({ repo: 'https://github.com/o/r', branch: 'main', projectPath: 'a', plan: 'pro' }),
  );
  assert.deepEqual([...url.searchParams.keys()], ['repo', 'branch', 'projectPath', 'plan']);
});

test('every plan id is accepted and anything else is rejected', () => {
  for (const id of ['starter', 'standard', 'pro']) {
    assert.ok(deployToFluxUrl({ repo: 'https://github.com/o/r', plan: id }).endsWith(`plan=${id}`));
  }
  for (const bad of ['free', 'custom', 'Pro', 'STANDARD', '', 'pro&repo=https://evil.example', 'standard ']) {
    assert.throws(
      () => deployToFluxUrl({ repo: 'https://github.com/o/r', plan: bad }),
      (e: unknown) => e instanceof OrbitUrlError && e.field === 'plan',
      bad,
    );
  }
});

test('the repository must be an https URL without credentials, query or whitespace', () => {
  const bad = [
    '',
    'http://github.com/o/r',
    'git@github.com:o/r.git',
    'ssh://git@github.com/o/r',
    'ftp://example.org/r',
    'javascript:alert(1)',
    'github.com/o/r',
    'https://',
    'https://user:token@github.com/o/r',
    'https://github.com/o/r?x=1',
    'https://github.com/o/r#readme',
    'https://github.com/o/r with space',
    ' https://github.com/o/r',
    'https://github.com/o/r\n',
  ];
  for (const repo of bad) {
    assert.throws(
      () => deployToFluxUrl({ repo }),
      (e: unknown) => e instanceof OrbitUrlError && e.field === 'repo',
      JSON.stringify(repo),
    );
  }
  assert.throws(() => deployToFluxUrl({ repo: undefined as unknown as string }), OrbitUrlError);
  // a .git suffix is fine, and so is another https host
  assert.ok(
    deployToFluxUrl({ repo: 'https://gitlab.com/o/r.git' }).includes('repo=https://gitlab.com/o/r.git'),
  );
});

test('an injection attempt in branch cannot add or change a parameter', () => {
  for (const branch of [
    'main&plan=pro',
    'main&repo=evil',
    'main#frag',
    'a=b',
    'main%26plan%3Dpro',
    'x&&plan=pro',
  ]) {
    const url = new URL(deployToFluxUrl({ repo: 'https://github.com/o/r', branch, plan: 'starter' }));
    assert.deepEqual([...url.searchParams.keys()], ['repo', 'branch', 'plan'], branch);
    assert.equal(url.searchParams.get('branch'), branch, `${branch} round trips`);
    assert.equal(url.searchParams.get('plan'), 'starter');
    assert.equal(url.searchParams.get('repo'), 'https://github.com/o/r');
    assert.equal(url.hash, '');
  }
  // An attempt that also carries a character git forbids is refused outright.
  assert.throws(
    () => deployToFluxUrl({ repo: 'https://github.com/o/r', branch: 'main&repo=https://evil.example/x' }),
    OrbitUrlError,
  );
  assert.throws(
    () => deployToFluxUrl({ repo: 'https://github.com/o/r', branch: 'main\r\nHost: evil' }),
    OrbitUrlError,
  );
});

test('a branch with characters git forbids is rejected', () => {
  for (const branch of [
    '',
    'has space',
    'a\nb',
    'a\u0000b',
    '-flag',
    'a..b',
    'a~1',
    'a^',
    'a:b',
    'a?',
    'a*',
    'a[b',
    'a\\b',
    'x.lock',
    'x.',
    '/x',
    'x/',
    'a//b',
    'a@{b',
  ]) {
    assert.throws(
      () => deployToFluxUrl({ repo: 'https://github.com/o/r', branch }),
      (e: unknown) => e instanceof OrbitUrlError && e.field === 'branch',
      JSON.stringify(branch),
    );
  }
  assert.ok(
    deployToFluxUrl({ repo: 'https://github.com/o/r', branch: 'feature/new-ui' }).includes(
      'branch=feature/new-ui',
    ),
  );
});

test('project paths stay inside the repository', () => {
  for (const projectPath of ['', '/etc', '../up', 'a/../../b', 'a\\b', 'a\nb']) {
    assert.throws(
      () => deployToFluxUrl({ repo: 'https://github.com/o/r', projectPath }),
      (e: unknown) => e instanceof OrbitUrlError && e.field === 'projectPath',
      JSON.stringify(projectPath),
    );
  }
  const url = new URL(deployToFluxUrl({ repo: 'https://github.com/o/r', projectPath: 'apps/my web&x' }));
  assert.equal(url.searchParams.get('projectPath'), 'apps/my web&x');
});

test('tryDeployToFluxUrl reports instead of throwing, and the markdown badge wraps the URL', () => {
  const ok = tryDeployToFluxUrl({ repo: 'https://github.com/o/r', plan: 'pro' });
  assert.equal(ok.ok, true);
  const bad = tryDeployToFluxUrl({ repo: 'http://github.com/o/r' });
  assert.deepEqual(bad.ok, false);
  if (!bad.ok) assert.equal(bad.field, 'repo');
  assert.equal(
    deployToFluxMarkdown({ repo: 'https://github.com/o/r' }),
    '[![Deploy to Flux](https://runonflux.com/apps/orbit/deploytoflux.png)](https://runonflux.com/apps/orbit?repo=https://github.com/o/r)',
  );
});

// ---- build variables --------------------------------------------------------------------------------------

test('build variables are unique, plain and carry no secret values', () => {
  const names = ORBIT_BUILD_VARIABLES.map((v) => v.name);
  assert.equal(new Set(names).size, names.length);
  for (const required of ['GIT_REPO_URL', 'APP_PORT']) {
    assert.ok(ORBIT_BUILD_VARIABLES.find((v) => v.name === required)?.required);
  }
  for (const v of ORBIT_BUILD_VARIABLES) {
    assert.match(v.name, /^[A-Z][A-Z0-9_]+$/);
    assert.ok(v.what.length > 10 && v.example.length > 0);
    assert.ok(!/—/.test(v.what), `${v.name} has no em dash`);
    assert.equal(typeof v.seenInLiveSpecs, 'boolean');
    if (v.secret) assert.match(v.example, /^<.*>$/, `${v.name} shows a placeholder, not a value`);
    assert.ok(
      !/ghp_|github_pat_|sk-|AKIA|-----BEGIN/.test(v.example),
      `${v.name} example is not a credential`,
    );
  }
  // Names that live specs carry but no docs page lists are not offered as settings.
  for (const hint of ORBIT_RUNTIME_HINT_NAMES) assert.ok(!names.includes(hint));
  // The docs-example-only names are not taught as supported.
  for (const n of [
    'HEALTH_CHECK_INTERVAL',
    'HEALTH_CHECK_PATH',
    'PRE_BUILD_COMMAND',
    'POST_BUILD_COMMAND',
    'NPM_TOKEN',
  ]) {
    assert.ok(!names.includes(n), n);
  }
  assert.equal(ORBIT_BUILD_VARIABLES.find((v) => v.name === 'PROJECT_TYPE')?.seenInLiveSpecs, false);
  assert.equal(ORBIT_BUILD_VARIABLES.find((v) => v.name === 'POLLING_INTERVAL')?.seenInLiveSpecs, true);
});

// ---- recognising an Orbit app -----------------------------------------------------------------------------

/** A fabricated spec shaped like the live ones (FACTS 15.3.1). Names and values are invented. */
const LIVE_SHAPED = {
  version: 8,
  name: 'sample-site',
  description: 'Orbit deployment sample-site',
  owner: '1hjy4bCYBJr4mny4zCE85J94RXa8W6q37',
  instances: 1,
  staticip: false,
  enterprise: '',
  contacts: [],
  geolocation: [],
  expire: 108_160,
  nodes: [],
  compose: [
    {
      name: 'cloudgit',
      description: 'cloudgit',
      repotag: 'runonflux/orbit:latest',
      repoauth: '',
      ports: [31001, 31002],
      containerPorts: [3000, 9001],
      domains: ['', ''],
      environmentParameters: [
        'GIT_REPO_URL=https://github.com/example/sample',
        'APP_PORT=3000',
        'GIT_BRANCH=main',
      ],
      commands: [],
      containerData: '/app',
      cpu: 0.5,
      ram: 1000,
      hdd: 5,
    },
  ],
};

test('isOrbitSpec recognises a spec shaped like the live Orbit apps', () => {
  const m = orbitSpecMatch(LIVE_SHAPED);
  assert.equal(m.isOrbit, true);
  assert.deepEqual(m.markers, [
    'image',
    'component-name',
    'component-description',
    'description-prefix',
    'container-data',
    'webhook-port',
  ]);
  assert.equal(isOrbitSpec(LIVE_SHAPED), true);
});

test('the image decides: another image with Orbit-like names is not an Orbit spec', () => {
  const other = structuredClone(LIVE_SHAPED);
  (other.compose[0] as { repotag: string }).repotag = 'nginx:1.27';
  const m = orbitSpecMatch(other);
  assert.equal(m.isOrbit, false);
  assert.ok(m.markers.includes('component-name'), 'supporting markers are still reported');
  assert.ok(!m.markers.includes('image'));
});

test('the Orbit image under another tag or registry host still counts; lookalikes do not', () => {
  const tagged = structuredClone(LIVE_SHAPED);
  (tagged.compose[0] as { repotag: string }).repotag = 'docker.io/runonflux/orbit:1.2.3';
  assert.equal(isOrbitSpec(tagged), true);
  const site = structuredClone(LIVE_SHAPED);
  (site.compose[0] as { repotag: string }).repotag = 'runonflux/website-orbit:latest';
  assert.equal(isOrbitSpec(site), false);
});

test('isOrbitSpec never throws on garbage', () => {
  for (const v of [
    undefined,
    null,
    0,
    'x',
    [],
    {},
    { compose: 'x' },
    { compose: [null, 1, {}] },
    { compose: [{ repotag: 5 }] },
  ]) {
    assert.equal(isOrbitSpec(v), false);
  }
});

test('the marker table is dated and honest about its basis', () => {
  assert.ok(ORBIT_APP_MARKERS.length >= 5);
  for (const m of ORBIT_APP_MARKERS) {
    assert.match(m.readOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(m.observed.matching <= m.observed.of);
    assert.ok(m.basis === 'live' || m.basis === 'inference');
  }
  const name = ORBIT_APP_MARKERS.find((m) => m.id === 'component-name');
  assert.equal(name?.basis, 'inference', 'the component name as a signature is an inference (FACTS 15.3.1)');
  assert.equal(ORBIT_APP_MARKERS.filter((m) => m.strength === 'defining').length, 1);
});

// ---- dated samples ----------------------------------------------------------------------------------------

test('dated samples carry their read date and make no network-wide percentage', () => {
  const entries = Object.entries(ORBIT_FACTS).filter(([, v]) => typeof v === 'object');
  assert.ok(entries.length >= 6);
  for (const [k, v] of entries) {
    const f = v as { value: number; readOn: string; basis: string; what: string };
    assert.equal(f.readOn, '2026-10-13', k);
    assert.equal(f.basis, 'live', k);
    assert.ok(Number.isInteger(f.value) && f.value > 0, k);
    assert.ok(!/percent|%/.test(f.what), k);
  }
  // The arithmetic of FACTS 15.3.3: 351 single-instance apps are 151 running Orbit, 78 not running Orbit
  // and 122 others. 78 + 122 + 151 = 351.
  const f = ORBIT_FACTS;
  assert.equal(
    f.orbitOneInstanceNotRunning.value + f.oneInstanceNonOrbit.value + 151,
    f.oneInstanceApps.value,
  );
  assert.match(f.note, /LIVE/);
});
