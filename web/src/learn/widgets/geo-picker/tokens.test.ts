import { describe, expect, it } from 'vitest';
import {
  analyzeTokens,
  canonicalToken,
  continentToken,
  countryToken,
  eligibility,
  expandTarget,
  geolocationJson,
  normalizeTokens,
  poolHealth,
  regionOfCountry,
  registrationVerdict,
  satisfiesTarget,
  toggleContinent,
  toggleCountry,
  typedEntryProblem,
} from './tokens';

const names = {
  continent: (r: string) => ({ EU: 'Europe', NA: 'North America', AS: 'Asia' })[r] ?? r,
  country: (cc: string) => ({ DE: 'Germany', RU: 'Russia', US: 'United States', FR: 'France' })[cc] ?? cc,
};

describe('building tokens', () => {
  it('spells allow and deny entries in the real grammar', () => {
    expect(continentToken('EU')).toBe('acEU');
    expect(continentToken('NA', 'deny')).toBe('a!cNA');
    expect(countryToken('EU', 'de')).toBe('acEU_DE');
    expect(countryToken('NA', 'US', 'deny')).toBe('a!cNA_US');
  });

  it('knows the continent of a country the way geolocation services do', () => {
    expect(regionOfCountry('DE')).toBe('EU');
    expect(regionOfCountry('ru')).toBe('EU');
    expect(regionOfCountry('US')).toBe('NA');
    expect(regionOfCountry('ZZ')).toBeNull();
  });

  it('canonicalises acEU_ALL to acEU and sorts allows before denies', () => {
    expect(canonicalToken(' acEU_ALL ')).toBe('acEU');
    expect(normalizeTokens(['a!cEU_RU', 'acNA', 'acEU', 'acEU_ALL'])).toEqual(['acEU', 'acNA', 'a!cEU_RU']);
  });
});

describe('targets', () => {
  it('expands the short forms an author writes', () => {
    expect(expandTarget('EU', 'allow')).toBe('acEU');
    expect(expandTarget('acEU', 'allow')).toBe('acEU');
    expect(expandTarget('RU', 'deny')).toBe('a!cEU_RU');
    expect(expandTarget('EU_RU', 'deny')).toBe('a!cEU_RU');
    expect(expandTarget('a!cEU_RU', 'deny')).toBe('a!cEU_RU');
    expect(expandTarget('ZZ', 'deny')).toBeNull();
  });

  it('compares normalised sets, order and spelling aside', () => {
    const target = { allowContinents: ['EU'], deny: ['RU'] };
    expect(satisfiesTarget(['a!cEU_RU', 'acEU'], target)).toBe(true);
    expect(satisfiesTarget(['acEU_ALL', 'a!cEU_RU'], target)).toBe(true);
    expect(satisfiesTarget(['acEU'], target)).toBe(false);
    expect(satisfiesTarget(['acEU', 'acNA', 'a!cEU_RU'], target)).toBe(false);
  });

  it('only checks the sides the target names', () => {
    expect(satisfiesTarget(['acEU', 'a!cEU_RU'], { allowContinents: ['EU'] })).toBe(true);
    expect(satisfiesTarget(['acEU'], { deny: ['RU'] })).toBe(false);
    expect(satisfiesTarget(['acEU'], {})).toBe(false);
  });
});

describe('analyzeTokens', () => {
  it('flags an allow cancelled by a deny', () => {
    const a = analyzeTokens(['acEU_DE', 'a!cEU']);
    expect(a.contradictions).toEqual([{ allow: 'acEU_DE', by: 'a!cEU' }]);
    expect(a.everythingCancelled).toBe(true);
    const same = analyzeTokens(['acEU_DE', 'a!cEU_DE']);
    expect(same.contradictions).toHaveLength(1);
  });

  it('does not call a partial deny a contradiction', () => {
    const a = analyzeTokens(['acEU', 'a!cEU_RU']);
    expect(a.contradictions).toHaveLength(0);
    expect(a.everythingCancelled).toBe(false);
    expect(a.idleDenies).toHaveLength(0);
  });

  it('flags a deny that excludes nothing', () => {
    const a = analyzeTokens(['acNA', 'a!cEU_RU']);
    expect(a.idleDenies).toEqual(['a!cEU_RU']);
  });

  it('flags an allow a wider allow already covers', () => {
    const a = analyzeTokens(['acEU', 'acEU_DE']);
    expect(a.redundant).toEqual([{ token: 'acEU_DE', coveredBy: 'acEU' }]);
  });

  it('reports entries the network would reject', () => {
    const a = analyzeTokens(['acXX', 'a!cEU_ALL', 'nonsense']);
    expect(a.invalid.map((i) => i.token).sort()).toEqual(['a!cEU_ALL', 'acXX', 'nonsense'].sort());
  });
});

describe('editing', () => {
  it('toggles a continent and removes the country entries it now covers', () => {
    let r = toggleCountry([], 'DE', 'allow', names);
    expect(r.tokens).toEqual(['acEU_DE']);
    r = toggleContinent(r.tokens, 'EU', 'allow', names);
    expect(r.tokens).toEqual(['acEU']);
    expect(r.message).toContain('Germany');
    r = toggleContinent(r.tokens, 'EU', 'allow', names);
    expect(r.tokens).toEqual([]);
  });

  it('refuses a country allow inside an allowed continent, with a reason', () => {
    const r = toggleCountry(['acEU'], 'DE', 'allow', names);
    expect(r.tokens).toEqual(['acEU']);
    expect(r.message).toMatch(/already allowed/);
  });

  it('adds a deny and lets the learner see the contradiction', () => {
    const r = toggleCountry(['acEU'], 'RU', 'deny', names);
    expect(r.tokens).toEqual(['acEU', 'a!cEU_RU']);
  });
});

describe('eligibility', () => {
  const countries = [
    { code: 'DE', nodes: 1500 },
    { code: 'FR', nodes: 800 },
    { code: 'RU', nodes: 200 },
    { code: 'US', nodes: 1200 },
    { code: 'JP', nodes: 50 },
  ];
  const total = 4000;

  it('counts every node when nothing is restricted', () => {
    const e = eligibility([], countries, total);
    expect(e.eligible).toBe(total);
    expect(e.share).toBe(1);
  });

  it('counts a continent and honours a deny', () => {
    expect(eligibility(['acEU'], countries, total).eligible).toBe(2500);
    expect(eligibility(['acEU', 'a!cEU_RU'], countries, total).eligible).toBe(2300);
    expect(eligibility(['acEU_DE'], countries, total).eligible).toBe(1500);
    expect(eligibility(['acEU_DE', 'a!cEU'], countries, total).eligible).toBe(0);
  });

  it('counts only denies against the whole network when there is no allow', () => {
    expect(eligibility(['a!cNA_US'], countries, total).eligible).toBe(2550);
  });

  it('states its denominator and share', () => {
    const e = eligibility(['acNA'], countries, total);
    expect(e.of).toBe(total);
    expect(e.share).toBeCloseTo(0.3, 6);
  });

  it('counts nodes with no known location as candidates for every rule, but not as matches', () => {
    // 3,750 nodes are located; 250 have no location at all.
    const e = eligibility(['acEU_DE'], countries, total);
    expect(e.eligible).toBe(1500);
    expect(e.unresolved).toBe(250);
    expect(e.candidates).toBe(1750);
    const none = eligibility(['acEU_DE', 'a!cEU'], countries, total);
    expect(none.eligible).toBe(0);
    expect(none.candidates).toBe(250);
    expect(eligibility([], countries, total).candidates).toBe(total);
  });

  it('counts a located node in a country the table lacks as a candidate too', () => {
    const e = eligibility(['acEU_DE'], [...countries, { code: 'ZZ', nodes: 40 }], 4040);
    expect(e.unplaced).toBe(40);
    expect(e.unresolved).toBe(40 + 250);
  });
});

describe('registrationVerdict', () => {
  it('refuses only when 0 < candidates < instances', () => {
    expect(registrationVerdict(82, 100)).toBe('refused');
    expect(registrationVerdict(2, 3)).toBe('refused');
    expect(registrationVerdict(3, 3)).toBe('accepted');
    expect(registrationVerdict(5000, 3)).toBe('accepted');
  });

  it('accepts a list that leaves no candidate, and promises nothing', () => {
    expect(registrationVerdict(0, 3)).toBe('accepted-none');
  });
});

describe('poolHealth', () => {
  it('names how comfortable the pool is', () => {
    expect(poolHealth([], 7000)).toBe('unrestricted');
    expect(poolHealth(['acEU_DE'], 0)).toBe('empty');
    expect(poolHealth(['acEU_DE'], 4)).toBe('tiny');
    expect(poolHealth(['acEU_DE'], 20)).toBe('thin');
    expect(poolHealth(['acEU_DE'], 500)).toBe('ok');
  });

  it('prints the field as a JSON line', () => {
    expect(geolocationJson(['a!cEU_RU', 'acEU'])).toBe('"geolocation": ["acEU","a!cEU_RU"]');
  });
});

describe('typedEntryProblem', () => {
  it('accepts entries the network accepts', () => {
    expect(typedEntryProblem('acEU')).toBeNull();
    expect(typedEntryProblem('acEU_DE')).toBeNull();
    expect(typedEntryProblem('a!cNA_US')).toBeNull();
    expect(typedEntryProblem('  ')).toBeNull();
  });

  it('explains a stray word as the legacy form it would be read as', () => {
    const p = typedEntryProblem('bogus');
    expect(p).toContain('bogus');
    expect(p).toContain('old form b');
    expect(p).toContain('ogus');
  });

  it('names what is wrong with a bad continent or a word that is no entry at all', () => {
    expect(typedEntryProblem('acXX')).toMatch(/continent/);
    const p = typedEntryProblem('hello');
    expect(p).toContain('hello');
    expect(p).toMatch(/ac, a!c/);
  });
});
