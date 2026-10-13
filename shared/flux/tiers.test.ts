import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LIMITS } from './spec.ts';
import { BLOCK_SUBSIDY, TIER_FACTS, TIER_ORDER, tiersThatFit } from './tiers.ts';

test('collateral and payouts match the verified tier table', () => {
  assert.deepEqual(
    TIER_ORDER.map((t) => TIER_FACTS[t].collateralFlux),
    [1000, 12_500, 40_000],
  );
  assert.deepEqual(
    TIER_ORDER.map((t) => TIER_FACTS[t].payoutPerBlockFlux),
    [1, 3.5, 9],
  );
  const share =
    TIER_ORDER.reduce((n, t) => n + TIER_FACTS[t].payoutPerBlockFlux, 0) + BLOCK_SUBSIDY.devFundFlux;
  assert.equal(share, BLOCK_SUBSIDY.totalFlux);
});

test('api names', () => {
  assert.deepEqual(
    TIER_ORDER.map((t) => TIER_FACTS[t].apiName),
    ['basic', 'super', 'bamf'],
  );
});

test('app capacity is nominal size minus the locked system share and equals the spec limits', () => {
  for (const t of TIER_ORDER) {
    const f = TIER_FACTS[t];
    assert.equal(f.appCapacity.cpu, f.nominal.threads - 1);
    assert.equal(f.appCapacity.ramMb, f.nominal.ramMb - 2000);
    assert.equal(f.appCapacity.hddGb, f.nominal.ssdGb - 60);
  }
  assert.equal(TIER_FACTS.stratus.appCapacity.cpu, LIMITS.totals.cpu);
  assert.equal(TIER_FACTS.stratus.appCapacity.ramMb, LIMITS.totals.ram);
  assert.equal(TIER_FACTS.stratus.appCapacity.hddGb, LIMITS.totals.hdd);
});

test('usable disk is 0.95 x SSD minus 80 GB and agrees with LIMITS.tierCapacity (FACTS 2.3)', () => {
  assert.deepEqual(
    TIER_ORDER.map((t) => TIER_FACTS[t].usableHddGb),
    [129, 338, 756],
  );
  for (const t of TIER_ORDER) {
    const f = TIER_FACTS[t];
    assert.equal(f.usableHddGb, Math.round(0.95 * f.nominal.ssdGb) - 80);
    assert.ok(f.usableHddGb < f.appCapacity.hddGb, 'the validator ceiling is above the real disk');
    const cap = LIMITS.tierCapacity[t];
    assert.equal(cap.cpu, f.appCapacity.cpu);
    assert.equal(cap.ram, f.appCapacity.ramMb);
    assert.equal(cap.hdd, f.usableHddGb);
    assert.equal(cap.hddCeiling, f.appCapacity.hddGb);
  }
});

test('tiersThatFit', () => {
  assert.deepEqual(tiersThatFit({ cpu: 0.5, ram: 500, hdd: 5 }), ['cumulus', 'nimbus', 'stratus']);
  assert.deepEqual(tiersThatFit({ cpu: 4, ram: 4000, hdd: 40 }), ['nimbus', 'stratus']);
  assert.deepEqual(tiersThatFit({ cpu: 8, ram: 4000, hdd: 40 }), ['stratus']);
  assert.deepEqual(tiersThatFit({ cpu: 16, ram: 4000, hdd: 40 }), []);
});

test('tiersThatFit uses the disk a node really has, but never rejects what the validator accepts', () => {
  // 140 GB passes the validator (160) but a nominal Cumulus node has about 129 GB.
  assert.deepEqual(tiersThatFit({ cpu: 1, ram: 1000, hdd: 140 }), ['nimbus', 'stratus']);
  assert.deepEqual(tiersThatFit({ cpu: 1, ram: 1000, hdd: 129 }), ['cumulus', 'nimbus', 'stratus']);
  assert.deepEqual(tiersThatFit({ cpu: 1, ram: 1000, hdd: 350 }), ['stratus']);
  assert.deepEqual(tiersThatFit({ cpu: 1, ram: 1000, hdd: LIMITS.totals.hdd }), ['stratus']);
});
