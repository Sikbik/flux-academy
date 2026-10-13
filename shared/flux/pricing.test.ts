import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BLOCKS_PER_MONTH } from './blocks.ts';
import { FIXTURES } from './fixtures.ts';
import { OFFICIAL_CAPTURE, OFFICIAL_CASES } from './pricing.fixtures.ts';
import {
  BAKED_PRICING,
  isEnterprisePort,
  marketplaceMultiplier,
  priceStages,
  quote,
  quoteLoose,
  roundUpToCharmPrice,
  updateCredit,
} from './pricing.ts';
import { defaultComponent, defaultSpec } from './spec.ts';
import type { FluxAppSpec, PricingParams } from './types.ts';

const P: PricingParams = OFFICIAL_CAPTURE.params;
const RATE = OFFICIAL_CAPTURE.fluxUsdRate;

function withInstances(spec: FluxAppSpec, n: number): FluxAppSpec {
  return { ...spec, instances: n };
}

test('baked pricing equals the live table captured with the fixtures', () => {
  assert.deepEqual(BAKED_PRICING.params, P);
  assert.equal(BAKED_PRICING.capturedAt, '2026-10-12');
});

test('formula matches every official response within a cent (own capture)', () => {
  assert.ok(OFFICIAL_CASES.length >= 30);
  for (const c of OFFICIAL_CASES) {
    const q = quote(c.spec, P, { fluxUsd: c.fluxUsdRate ?? RATE });
    assert.ok(
      Math.abs((q.usdTotal ?? 0) - c.usd) < 0.005,
      `${c.id}: official ${c.usd}, computed ${q.usdTotal}`,
    );
    const slack = c.fluxUsdRate ? Math.max(0.02, c.flux * 0.002) : 0.01;
    assert.ok(
      Math.abs((q.fluxTotal ?? 0) - c.flux) <= slack,
      `${c.id}: official ${c.flux} FLUX, computed ${q.fluxTotal}`,
    );
  }
});

test('formula matches the research sample of 80 official responses', () => {
  const url = new URL('../../docs/research/samples/price-verification-80-cases.json', import.meta.url);
  let data: { cases: { case: string; spec: unknown; api: { usd: number } }[] };
  try {
    data = JSON.parse(readFileSync(url, 'utf8'));
  } catch {
    return; // sample not present in this checkout
  }
  assert.ok(data.cases.length >= 80);
  for (const c of data.cases) {
    const q = quoteLoose(c.spec, P);
    assert.equal(q.usdTotal, c.api.usd, `${c.case}`);
  }
});

test('the official sample coverage includes the rules the lessons teach', () => {
  const ids = OFFICIAL_CASES.map((c) => c.id).join(' ');
  for (const need of ['static', 'ports', 'multi', 'instances', 'expire', 'nodes', 'big'])
    assert.ok(ids.includes(need), need);
  assert.ok(OFFICIAL_CASES.some((c) => c.spec.compose.length >= 3));
  assert.ok(OFFICIAL_CASES.some((c) => c.spec.instances === 100));
});

test('lines add up to the total (waterfall property)', () => {
  for (const c of OFFICIAL_CASES) {
    const q = quote(c.spec, P, { fluxUsd: RATE });
    const sum = q.lines.reduce((n, l) => n + l.usd, 0);
    assert.ok(Math.abs(sum - (q.usdTotal ?? 0)) < 1e-4, `${c.id}: lines ${sum} vs total ${q.usdTotal}`);
    for (const l of q.lines) {
      assert.ok(l.note && l.note.length > 10, `${c.id}/${l.id} has a note`);
      assert.ok(!l.note.includes('—'), 'no em dash');
    }
  }
});

test('every price ends in .49 or .99', () => {
  for (const c of OFFICIAL_CASES) {
    const cents = Math.round((quote(c.spec, P).usdTotal ?? 0) * 100) % 100;
    assert.ok(cents === 49 || cents === 99, `${c.id}`);
  }
});

test('charm rounding', () => {
  assert.equal(roundUpToCharmPrice(1.12), 1.49);
  assert.equal(roundUpToCharmPrice(1.5), 1.99);
  assert.equal(roundUpToCharmPrice(4.49), 4.49);
  assert.equal(roundUpToCharmPrice(4.5), 4.99);
  assert.equal(roundUpToCharmPrice(0.99), 0.99);
  assert.equal(roundUpToCharmPrice(2), 2.49);
});

test('enterprise ports', () => {
  for (const p of [0, 22, 80, 443, 1023, 6667, 8080, 8081, 8443]) assert.ok(isEnterprisePort(p), String(p));
  for (const p of [1024, 8000, 8082, 31001, 65535, Number.NaN]) assert.ok(!isEnterprisePort(p), String(p));
});

test('the small app floor is 0.99 and the cliff at 4 instances is real', () => {
  const s = defaultSpec();
  assert.equal(quote(s, P).usdTotal, 0.99);
  const small: FluxAppSpec = {
    ...s,
    compose: [defaultComponent({ cpu: 0.5, ram: 500, hdd: 5 })],
  };
  assert.equal(quote(withInstances(small, 3), P).usdTotal, 0.99);
  assert.equal(quote(withInstances(small, 4), P).usdTotal, 1.99);
  assert.equal(
    quote(withInstances(small, 4), P).lines.some((l) => l.id === 'hw-discount'),
    false,
  );
  assert.equal(
    quote(withInstances(small, 3), P).lines.some((l) => l.id === 'hw-discount'),
    true,
  );
});

test('each extra instance of a cheap app costs a flat 0.50', () => {
  const small: FluxAppSpec = {
    ...defaultSpec(),
    compose: [defaultComponent({ cpu: 0.5, ram: 500, hdd: 5 })],
  };
  const a = priceStages(withInstances(small, 5), P);
  const b = priceStages(withInstances(small, 6), P);
  assert.equal(Number((b.instancePriceUsd - a.instancePriceUsd).toFixed(2)), 0.5);
});

test('port fee, static ip and pinned nodes add before the divide by three', () => {
  const base = defaultSpec();
  const fee = { ...base, compose: [defaultComponent({ ports: [80], containerPorts: [80] })] };
  assert.equal(priceStages(fee, P).enterprisePorts, 1);
  assert.ok(priceStages(fee, P).bundleUsd - priceStages(base, P).bundleUsd > 1.99);
  const st = priceStages({ ...base, staticip: true }, P);
  assert.ok(Math.abs(st.bundleUsd - priceStages(base, P).bundleUsd - 2) < 1e-9);
  const pinned = priceStages({ ...base, nodes: ['192.0.2.1:16127'] }, P);
  assert.ok(Math.abs(pinned.bundleUsd - priceStages(base, P).bundleUsd - 4) < 1e-9);
  assert.equal(
    quote({ ...base, nodes: ['192.0.2.1:16127'] }, P).lines.some((l) => l.id === 'scope'),
    true,
  );
});

test('duration discounts and scaling', () => {
  const s: FluxAppSpec = {
    ...defaultSpec(),
    compose: [defaultComponent({ cpu: 0.5, ram: 500, hdd: 5, ports: [80], containerPorts: [80] })],
  };
  const m1 = quote({ ...s, expire: BLOCKS_PER_MONTH }, P);
  const m12 = quote({ ...s, expire: 12 * BLOCKS_PER_MONTH }, P);
  assert.equal(m1.months, 1);
  assert.equal(m12.months, 12);
  assert.ok(m12.lines.some((l) => l.id === 'duration-discount'));
  assert.ok(m12.usdPerMonth < m1.usdPerMonth, 'a year is cheaper per month');
  const viaOption = quote(s, P, { months: 12 });
  assert.equal(viaOption.usdTotal, m12.usdTotal);
});

test('a one block subscription is still at least 0.99', () => {
  assert.equal(quote({ ...defaultSpec(), expire: 1 }, P).usdTotal, 0.99);
});

test('flux conversion applies the multiplier and rounds to cents', () => {
  const q = quote(defaultSpec(), P, { fluxUsd: 0.1 });
  assert.equal(q.fluxTotal, Number(((0.99 / 0.1) * 0.95).toFixed(2)));
  assert.equal(q.fluxPerMonth, q.fluxTotal);
  const none = quote(defaultSpec(), P);
  assert.equal(none.fluxTotal, null);
  assert.equal(none.fluxUsd, null);
  assert.equal(quote(defaultSpec(), P, { fluxUsd: 0 }).fluxUsd, null);
});

test('marketplace multiplier follows the first prefix match, case insensitive', () => {
  assert.equal(marketplaceMultiplier('Minecraft8GB-mine'), 1.99);
  assert.equal(marketplaceMultiplier('minecraft8gbtest'), 1.99);
  assert.equal(marketplaceMultiplier('my-minecraft'), 1);
  assert.equal(marketplaceMultiplier('PresearchNodeLegacy2'), 1.71);
  assert.equal(marketplaceMultiplier(''), 1);
  const base = defaultSpec();
  const plain = quote(
    { ...base, name: 'zzz', instances: 5, compose: [defaultComponent({ cpu: 4, ram: 8000, hdd: 40 })] },
    P,
  );
  const market = quote(
    {
      ...base,
      name: 'Minecraft8GB-x',
      instances: 5,
      compose: [defaultComponent({ cpu: 4, ram: 8000, hdd: 40 })],
    },
    P,
  );
  assert.ok((market.usdTotal ?? 0) > (plain.usdTotal ?? 0));
  assert.ok(market.lines.some((l) => l.id === 'marketplace'));
});

test('named fixtures price as the official calculator answered', () => {
  for (const f of FIXTURES) {
    const official = OFFICIAL_CASES.find((c) => c.id === `fixture-${f.id}`);
    assert.ok(official, `official capture for ${f.id}`);
    const q = quote(f.spec, P, { fluxUsd: RATE });
    assert.equal(q.usdTotal, official.usd, f.id);
  }
});

test('updateCredit credits the unused part of the old subscription', () => {
  const prev: FluxAppSpec = {
    ...defaultSpec(),
    instances: 5,
    compose: [defaultComponent({ cpu: 1, ram: 1000, hdd: 10 })],
  };
  const full = updateCredit(prev, P, BLOCKS_PER_MONTH, BLOCKS_PER_MONTH);
  const half = updateCredit(prev, P, BLOCKS_PER_MONTH / 2, BLOCKS_PER_MONTH);
  assert.equal(full.unusedFraction, 1);
  assert.ok(Math.abs(half.creditUsd * 2 - full.creditUsd) < 1e-4);
  assert.equal(updateCredit(prev, P, 0, BLOCKS_PER_MONTH).creditUsd, 0);
  const q = quote(prev, P, { creditUsd: half.creditUsd });
  assert.ok(q.lines.some((l) => l.id === 'credit'));
  assert.ok((q.usdTotal ?? 0) < (quote(prev, P).usdTotal ?? 0));
});

test('quote never throws on hostile numbers', () => {
  const evil = {
    ...defaultSpec(),
    instances: Number.NaN,
    expire: Number.POSITIVE_INFINITY,
    compose: [defaultComponent({ cpu: Number.NaN, ram: -5, hdd: Number.POSITIVE_INFINITY })],
  } as FluxAppSpec;
  const q = quote(evil, P);
  assert.ok(Number.isFinite(q.usdTotal ?? Number.NaN));
  assert.ok(q.usdTotal! >= 0.99);
  quoteLoose('garbage', P);
  quoteLoose(null, P);
});
