import { parseContainerData } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { decodeShare } from '@/forge/model/share';
import { feePortsText } from './derive';
import { PRICE_EXAMPLES } from './examples';
import {
  cliffExplanation,
  describeMount,
  feePortEffect,
  forgeShareLink,
  geoVerdict,
  guaranteeId,
  priceFor,
} from './tools';

describe('geoVerdict', () => {
  const de = { continent: 'EU', country: 'DE' } as const;
  const ru = { continent: 'EU', country: 'RU' } as const;
  const us = { continent: 'NA', country: 'US' } as const;

  it('qualifies anything with an empty list', () => {
    expect(geoVerdict([], us).qualifies).toBe(true);
  });

  it('applies an allow and a deny together', () => {
    const rules = ['acEU', 'a!cEU_RU'];
    expect(geoVerdict(rules, de).qualifies).toBe(true);
    expect(geoVerdict(rules, ru).qualifies).toBe(false);
    expect(geoVerdict(rules, us).qualifies).toBe(false);
  });

  it('lets a deny alone allow everywhere else', () => {
    expect(geoVerdict(['a!cNA'], us).qualifies).toBe(false);
    expect(geoVerdict(['a!cNA'], de).qualifies).toBe(true);
  });

  it('matches a country allow on continent and country', () => {
    expect(geoVerdict(['acEU_DE', 'acEU_FR'], de).qualifies).toBe(true);
    expect(geoVerdict(['acEU_DE', 'acEU_FR'], ru).qualifies).toBe(false);
  });

  it('says every allowed place is denied', () => {
    const v = geoVerdict(['acEU_DE', 'a!cEU_DE'], de);
    expect(v.qualifies).toBe(false);
    expect(v.reasons.join(' ')).toContain('Denied by a!cEU_DE');
  });

  it('matches a region only when the region is known', () => {
    const rules = ['acEU_DE_BY'];
    expect(geoVerdict(rules, { ...de, region: 'DE-BY' }).qualifies).toBe(true);
    expect(geoVerdict(rules, { ...de, region: 'BY' }).qualifies).toBe(true);
    const unknown = geoVerdict(rules, de);
    expect(unknown.qualifies).toBe(false);
    expect(unknown.reasons.join(' ')).toContain('region is not known');
  });

  it('skips old style and unknown entries and says why', () => {
    const v = geoVerdict(['aEU', 'bDE', 'nonsense'], de);
    expect(v.skipped.map((s) => s.entry)).toEqual(['aEU', 'bDE', 'nonsense']);
    expect(v.qualifies).toBe(true);
  });

  it('a deny of ALL bans nothing', () => {
    expect(geoVerdict(['a!cALL'], de).qualifies).toBe(true);
  });
});

describe('describeMount and guaranteeId', () => {
  it('describes every kind of mount in a sentence', () => {
    const parsed = parseContainerData(
      'g:/data|m:logs:/var/log|ml:cache:/cache|f:c.yaml:/etc/c.yaml|0:/shared',
    );
    expect(parsed.errors).toEqual([]);
    const lines = parsed.mounts.map(describeMount);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain('primary and standby');
    expect(lines[1]).toContain('replicated');
    expect(lines[2]).toContain('never replicated');
    expect(lines[3]).toContain('file c.yaml');
    expect(lines[4]).toContain('component 0');
  });

  it('maps a sync mode to a guarantee row', () => {
    expect(guaranteeId(parseContainerData('/tmp'))).toBe('none');
    expect(guaranteeId(parseContainerData('r:/data'))).toBe('r');
    expect(guaranteeId(parseContainerData('g:/data'))).toBe('g');
    expect(guaranteeId(parseContainerData('s:/data'))).toBe('s');
  });
});

describe('priceFor', () => {
  it('prices the medium example for three instances', () => {
    const medium = PRICE_EXAMPLES.find((e) => e.id === 'medium');
    expect(medium).toBeDefined();
    if (!medium) return;
    const q = priceFor(medium, 3, 1);
    expect(q.usdTotal).toBe(4.99);
    expect(q.instances).toBe(3);
    expect(q.paramsSource).toBe('baked');
    expect(q.lines.some((l) => l.id === 'hw-discount')).toBe(true);
  });

  it('applies the long subscription discount', () => {
    const medium = PRICE_EXAMPLES.find((e) => e.id === 'medium');
    if (!medium) return;
    const year = priceFor(medium, 3, 12);
    expect(year.lines.some((l) => l.id === 'duration-discount')).toBe(true);
  });
});

describe('forgeShareLink', () => {
  it('is a link the forge can read back', async () => {
    const spec = { version: 8, name: 'x-é', compose: [] };
    const link = forgeShareLink(spec);
    expect(link.startsWith('/labs/spec-forge#s=r.')).toBe(true);
    const payload = link.slice('/labs/spec-forge#s='.length);
    const back = await decodeShare(payload);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.value).toEqual(spec);
  });
});

describe('the small app cliff', () => {
  it('is the discount ending plus the flat rate per extra instance', () => {
    const small = PRICE_EXAMPLES.find((e) => e.id === 'small');
    expect(small).toBeDefined();
    if (!small) return;
    const w = cliffExplanation(small);
    expect(w.flatRuleApplies).toBe(true);
    expect(w.perInstance).toBe(0.37);
    expect(w.at3).toBe(0.99);
    expect(w.at4).toBe(1.99);
    // The discount ending alone would not account for the whole jump.
    expect(w.withoutFlatRule).toBe(1.49);
  });
});

describe('fee ports', () => {
  it('scale with the instance count, because the fee goes into the bundle', () => {
    const rows = feePortEffect();
    const added = rows.map((r) => r.added);
    expect(added[0]).toBe(0);
    expect(added[1]).toBe(2);
    expect(added[2]).toBeGreaterThan(added[1] ?? 0);
  });

  it('prints the range a deployer can use, not the node table that starts at port 0', () => {
    expect(feePortsText().startsWith('1 to 1023')).toBe(true);
  });
});
