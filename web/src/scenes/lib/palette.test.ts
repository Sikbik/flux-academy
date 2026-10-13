import { describe, expect, it } from 'vitest';
import {
  ACCENT_PALETTES,
  AccentBlender,
  hexToLinear,
  parseColour,
  readAccentPalette,
  srgbToLinear,
  TIER_COLOURS,
} from './palette';

describe('colour', () => {
  it('converts sRGB to linear light', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 6);
    expect(srgbToLinear(0.5)).toBeCloseTo(0.214, 3);
  });

  it('keeps the tier colours exact: cumulus 36D3FF, nimbus C77DFF, stratus FFC857', () => {
    const same = (a: readonly number[], hex: number) => {
      const b = hexToLinear(hex);
      for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i] ?? 0, 6);
    };
    same(TIER_COLOURS[0] ?? [], 0x36d3ff);
    same(TIER_COLOURS[1] ?? [], 0xc77dff);
    same(TIER_COLOURS[2] ?? [], 0xffc857);
  });

  it('parses the token forms and rejects junk', () => {
    expect(parseColour('43 97 209')).not.toBeNull();
    expect(parseColour('#2b61d1')).toEqual(hexToLinear(0x2b61d1));
    expect(parseColour('#fff')).toEqual(hexToLinear(0xffffff));
    expect(parseColour('')).toBeNull();
    expect(parseColour('red')).toBeNull();
    expect(parseColour('12 x 4')).toBeNull();
  });
});

describe('accent palette', () => {
  const style = (vars: Record<string, string>) => ({ getPropertyValue: (n: string) => vars[n] ?? '' });

  it('uses the page tokens when they are all present', () => {
    const p = readAccentPalette(
      'flux',
      style({
        '--accent-deep-rgb': '43 97 209',
        '--accent-rgb': '79 122 212',
        '--accent-hot-rgb': '174 198 255',
      }),
    );
    expect(p.base[2]).toBeGreaterThan(p.base[0]);
    expect(p.core[0]).toBeGreaterThan(p.hot[0] * 0.5);
    expect(p.haze[0]).toBeLessThan(0.02);
  });

  it('falls back to the built in palette when a token is missing', () => {
    expect(readAccentPalette('nimbus', style({ '--accent-rgb': '1 2 3' }))).toEqual(ACCENT_PALETTES.nimbus);
    expect(readAccentPalette('stratus', null)).toEqual(ACCENT_PALETTES.stratus);
  });

  it('crossfades to a new accent in about the requested time', () => {
    const b = new AccentBlender(ACCENT_PALETTES.flux, 0.6);
    b.setTarget(ACCENT_PALETTES.stratus);
    for (let i = 0; i < 36; i++) b.step(1 / 60);
    const half = Math.abs(b.current.base[0] - ACCENT_PALETTES.stratus.base[0]);
    expect(half).toBeLessThan(
      0.1 * Math.abs(ACCENT_PALETTES.flux.base[0] - ACCENT_PALETTES.stratus.base[0]) + 0.02,
    );
    b.step(0, true);
    expect(b.current.base[0]).toBeCloseTo(ACCENT_PALETTES.stratus.base[0], 6);
  });
});
