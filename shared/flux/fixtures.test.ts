import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cloneFixture, FIXTURES, fixtureById } from './fixtures.ts';
import { lintSpec } from './lint.ts';
import { BAKED_PRICING, quote } from './pricing.ts';
import { normalizeSpec } from './spec.ts';

const NAMES = [
  'hello-world',
  'web-app',
  'static-site',
  'minecraft',
  'wordpress-mysql',
  'redis-cache',
  'three-tier',
];

test('the named fixtures exist', () => {
  assert.deepEqual(
    FIXTURES.map((f) => f.id),
    NAMES,
  );
});

for (const f of FIXTURES) {
  test(`fixture ${f.id} is lint clean, normalised and priced`, () => {
    const r = lintSpec(f.spec);
    assert.deepEqual(
      r.issues.filter((i) => i.severity !== 'info').map((i) => `${i.code} ${i.path}`),
      [],
    );
    assert.equal(r.valid, true);
    const n = normalizeSpec(f.spec);
    assert.deepEqual(n.spec, f.spec);
    assert.deepEqual(n.defaulted, []);
    const q = quote(f.spec, BAKED_PRICING.params, { fluxUsd: BAKED_PRICING.fluxUsd });
    assert.ok((q.usdTotal ?? 0) >= 0.99);
    assert.ok(f.description.length > 20 && f.lessons.length > 0);
    assert.ok(!/[—–]/.test(f.title + f.description), 'no dashes in copy');
  });
}

test('cloneFixture returns an independent copy', () => {
  const a = cloneFixture('hello-world');
  assert.ok(a);
  a.name = 'changed';
  assert.equal(fixtureById('hello-world')?.spec.name, 'hello-flux');
  assert.equal(cloneFixture('nope'), undefined);
});
