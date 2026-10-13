import type { GeoCountry } from '@shared/api';
import { describe, expect, it } from 'vitest';
import { allowedContinents, continentOf, eligibleNodes } from './geo';

const countries: GeoCountry[] = [
  { code: 'DE', name: 'Germany', nodes: 100, tiers: { cumulus: 60, nimbus: 25, stratus: 15 } },
  { code: 'FR', name: 'France', nodes: 50, tiers: { cumulus: 30, nimbus: 10, stratus: 10 } },
  { code: 'US', name: 'United States', nodes: 80, tiers: { cumulus: 40, nimbus: 30, stratus: 10 } },
  { code: 'JP', name: 'Japan', nodes: 10, tiers: { cumulus: 10, nimbus: 0, stratus: 0 } },
];

describe('eligibleNodes', () => {
  it('counts everything with no entries', () => {
    const e = eligibleNodes([], countries);
    expect(e.nodes).toBe(240);
    expect(e.total).toBe(240);
    expect(e.countries).toBe(4);
  });

  it('allows a continent and a country', () => {
    expect(eligibleNodes(['acEU'], countries).nodes).toBe(150);
    expect(eligibleNodes(['acEU_DE'], countries).nodes).toBe(100);
    expect(eligibleNodes(['acEU_DE', 'acNA'], countries).nodes).toBe(180);
  });

  it('denies win over allows', () => {
    expect(eligibleNodes(['a!cEU'], countries).nodes).toBe(90);
    expect(eligibleNodes(['acEU', 'a!cEU_FR'], countries).nodes).toBe(100);
    expect(eligibleNodes(['acEU', 'a!cEU'], countries).nodes).toBe(0);
  });

  it('flags region entries as approximate and sums tiers', () => {
    const e = eligibleNodes(['acEU_DE_BY'], countries);
    expect(e.approximate).toBe(true);
    expect(e.tiers).toEqual({ cumulus: 60, nimbus: 25, stratus: 15 });
  });

  it('understands the old style entries', () => {
    expect(eligibleNodes(['aEU'], countries).nodes).toBe(150);
    expect(eligibleNodes(['bUS'], countries).nodes).toBe(80);
  });

  it('ignores entries the network ignores', () => {
    expect(eligibleNodes(['nonsense'], countries).nodes).toBe(240);
  });
});

describe('continents', () => {
  it('maps countries to continents', () => {
    expect(continentOf('de')).toBe('EU');
    expect(continentOf('JP')).toBe('AS');
    expect(continentOf('ZZ')).toBeNull();
  });

  it('lists allowed continents for the preview, empty for everywhere', () => {
    expect(allowedContinents([])).toEqual([]);
    expect(allowedContinents(['acEU'])).toEqual(['EU']);
    expect(allowedContinents(['acEU_DE', 'acNA_US'])).toEqual(['NA', 'EU']);
    expect(allowedContinents(['a!cNA'])).toEqual(['SA', 'EU', 'AF', 'AS', 'OC']);
    expect(allowedContinents(['acALL'])).toEqual([]);
    expect(allowedContinents(['acEU', 'a!cEU'])).toEqual([]);
  });
});
