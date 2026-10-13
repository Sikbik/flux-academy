import { LINT_CODES } from '@shared/flux/lint';
import { describe, expect, it } from 'vitest';
import { HELP_KEYS, helpFor, helpKeyForPath, mistakesOf } from './knowledge';

describe('help keys', () => {
  it('drops indexes and trailing array positions', () => {
    expect(helpKeyForPath('compose[0].ports[2]')).toBe('compose[].ports');
    expect(helpKeyForPath('compose[12].environmentParameters[0]')).toBe('compose[].environmentParameters');
    expect(helpKeyForPath('geolocation[1]')).toBe('geolocation');
    expect(helpKeyForPath('instances')).toBe('instances');
  });

  it('resolves a concrete path to its entry', () => {
    expect(helpFor('compose[3].cpu')?.title).toBe('CPU');
    expect(helpFor('nonsense.path')).toBeNull();
  });
});

describe('teaching entries', () => {
  it('only point at lint codes that exist', () => {
    for (const key of HELP_KEYS) {
      const entry = helpFor(key);
      expect(entry, key).not.toBeNull();
      for (const code of entry?.mistakes ?? []) {
        expect(LINT_CODES[code], `${key} -> ${code}`).toBeTruthy();
      }
      expect(mistakesOf(entry as NonNullable<typeof entry>).length).toBe(entry?.mistakes?.length ?? 0);
    }
  });

  it('use plain copy: no em dashes, no emoji, one sentence of "what"', () => {
    const bad = /[—–]|[\u{1F300}-\u{1FAFF}☀-➿]/u;
    for (const key of HELP_KEYS) {
      const e = helpFor(key);
      const text = [e?.title, e?.what, e?.limit, ...(e?.notes ?? [])].join(' ');
      expect(bad.test(text), key).toBe(false);
      expect(e?.what.length, key).toBeGreaterThan(20);
    }
  });

  it('quote the rates in force', () => {
    const e = helpFor('compose[].cpu', {
      params: {
        height: -1,
        cpu: 0.3,
        ram: 0.05,
        hdd: 0.02,
        minPrice: 0.01,
        port: 2,
        scope: 4,
        staticip: 2,
        fluxmultiplier: 0.95,
        multiplier: 1,
        minUSDPrice: 0.99,
      },
    });
    expect(e?.what).toContain('USD 0.3 per 0.1 core');
  });
});
