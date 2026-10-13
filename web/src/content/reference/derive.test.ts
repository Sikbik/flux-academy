import { describe, expect, it } from 'vitest';
import {
  andList,
  bannedRangeOf,
  feePortsText,
  feePortUsd,
  feeRangeOf,
  formatGeoEntry,
  geoRoundTrips,
  money,
  num,
  orList,
  plain,
  rangeText,
  usd,
} from './derive';

describe('number words', () => {
  it('groups integers and keeps decimals', () => {
    expect(num(88000)).toBe('88,000');
    expect(num(0.15)).toBe('0.15');
    expect(num(5)).toBe('5');
  });

  it('writes money', () => {
    expect(money(1.99)).toBe('$1.99');
    expect(usd(2)).toBe('USD 2');
    expect(usd(0.99)).toBe('USD 0.99');
  });

  it('lists', () => {
    expect(andList(['a'])).toBe('a');
    expect(andList(['a', 'b'])).toBe('a and b');
    expect(andList(['a', 'b', 'c'])).toBe('a, b and c');
    expect(orList(['a', 'b', 'c'])).toBe('a, b or c');
  });
});

describe('ports', () => {
  it('prints ranges and the fee list from the engine', () => {
    expect(rangeText({ from: 22, to: 22 })).toBe('22');
    expect(rangeText({ from: 16100, to: 16299 })).toBe('16100 to 16299');
    // The node's table starts at port 0, but port 0 is refused (portMin 1), so the text says 1 to 1023.
    expect(feePortsText()).toBe('1 to 1023, 6667, 8080, 8081 and 8443');
    expect(feePortUsd()).toBe(2);
  });

  it('finds the range a port is in', () => {
    expect(bannedRangeOf(16127)).toEqual({ from: 16100, to: 16299 });
    expect(bannedRangeOf(31001)).toBeNull();
    expect(feeRangeOf(8080)).toEqual({ from: 8080, to: 8080 });
    expect(feeRangeOf(80)).toEqual({ from: 1, to: 1023 });
    expect(feeRangeOf(31001)).toBeNull();
  });
});

describe('geolocation round trip', () => {
  it('writes entries back the way the parser read them', () => {
    for (const e of [
      'acALL',
      'acEU',
      'acEU_DE',
      'acEU_DE_BY',
      'a!cNA',
      'a!cEU_RU',
      'a!cEU_DE_BY',
      'aEU',
      'bDE',
    ]) {
      expect(geoRoundTrips(e), e).toBe(true);
    }
  });

  it('normalises the long form of a continent', () => {
    expect(
      formatGeoEntry({
        raw: 'acEU_ALL',
        kind: 'allow-continent',
        continent: 'EU',
        country: null,
        region: null,
        problems: [],
      }),
    ).toBe('acEU');
  });

  it('rejects what it cannot read', () => {
    expect(geoRoundTrips('nonsense')).toBe(false);
    expect(geoRoundTrips('acXX')).toBe(false);
  });
});

describe('plain', () => {
  it('turns markup into the words a reader reads', () => {
    expect(plain('Use `0.0.0.0`, see {{term:fdm}} and {{lesson:first-deploy}}.')).toContain('0.0.0.0');
    expect(plain('**bold** [label](https://x.test)')).toBe('bold label');
  });
});
