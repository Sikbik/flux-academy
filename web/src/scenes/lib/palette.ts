// Scene colours, in linear light. The page picks an accent (and `--accent-*` CSS variables follow it);
// the scene reads those variables so an accent switch re-tints the bench, and crossfades over about
// 600 ms. Tier colours are fixed: cumulus #36D3FF, nimbus #C77DFF, stratus #FFC857, and only mean tiers.

import { damp } from './math';

export type RGB = readonly [number, number, number];
export type AccentId = 'flux' | 'cumulus' | 'nimbus' | 'stratus';

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** 0xRRGGBB (sRGB) to linear RGB. */
export function hexToLinear(hex: number): [number, number, number] {
  return [
    srgbToLinear(((hex >> 16) & 255) / 255),
    srgbToLinear(((hex >> 8) & 255) / 255),
    srgbToLinear((hex & 255) / 255),
  ];
}

export interface AccentPalette {
  /** The accent itself, for structure and edge light. */
  base: [number, number, number];
  /** Brighter, for emission and active edges. */
  hot: [number, number, number];
  /** Near white with a hint of the hue, for white-hot peaks. */
  core: [number, number, number];
  /** The dark ambient the far field fades into. */
  haze: [number, number, number];
}

function palette(base: number, hot: number, core: number, haze: number): AccentPalette {
  return { base: hexToLinear(base), hot: hexToLinear(hot), core: hexToLinear(core), haze: hexToLinear(haze) };
}

/** Built in palettes: used before the CSS variables are readable and whenever they are missing. */
export const ACCENT_PALETTES: Record<AccentId, AccentPalette> = {
  flux: palette(0x2b61d1, 0x3f7bff, 0xc4d8ff, 0x061a52),
  cumulus: palette(0x36d3ff, 0x6fe2ff, 0xd2f6ff, 0x04303f),
  nimbus: palette(0xc77dff, 0xdba2ff, 0xf1defe, 0x241044),
  stratus: palette(0xffc857, 0xffd985, 0xffefc8, 0x3d2a05),
};

export const FLUX_PALETTE = ACCENT_PALETTES.flux;

/** Cumulus, nimbus, stratus, then white-hot for the "you" marker. */
export const TIER_COLOURS: RGB[] = [
  hexToLinear(0x36d3ff),
  hexToLinear(0xc77dff),
  hexToLinear(0xffc857),
  hexToLinear(0xeaf2ff),
];

/** Wave tint slots (see TINT in waves.ts): accent-hot placeholder, white-hot, warn, crit, then the tiers. */
export const TINT_COLOURS: RGB[] = [
  hexToLinear(0x4f86ff),
  hexToLinear(0xeaf2ff),
  hexToLinear(0xff9a3d),
  hexToLinear(0xff5470),
  hexToLinear(0x36d3ff),
  hexToLinear(0xc77dff),
  hexToLinear(0xffc857),
];

/** Parses an `R G B` triple (the `--accent-rgb` token form) or `#rrggbb`. Returns null when unusable. */
export function parseColour(s: string): [number, number, number] | null {
  const t = s.trim();
  if (!t) return null;
  if (t.startsWith('#')) {
    const h = t.slice(1);
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    if (full.length !== 6 || Number.isNaN(Number.parseInt(full, 16))) return null;
    return hexToLinear(Number.parseInt(full, 16));
  }
  const parts = t
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
  const [r, g, b] = parts as [number, number, number];
  return [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)];
}

/**
 * The scene palette for an accent, read from the page's `--accent-*` custom properties when present
 * (`--accent-deep-rgb` is the structural blue, `--accent-rgb` the lit edge, `--accent-hot-rgb` the peak),
 * otherwise the built in palette. The haze is always derived darkly from the accent, never read.
 */
export function readAccentPalette(
  accent: AccentId,
  style: { getPropertyValue(name: string): string } | null,
): AccentPalette {
  const builtIn = ACCENT_PALETTES[accent];
  if (!style) return builtIn;
  const deep = parseColour(style.getPropertyValue('--accent-deep-rgb'));
  const rgb = parseColour(style.getPropertyValue('--accent-rgb'));
  const hot = parseColour(style.getPropertyValue('--accent-hot-rgb'));
  if (!deep || !rgb || !hot) return builtIn;
  // The page's accent is a UI colour (AA on dark), the scene wants emissive light: push it up a little.
  const lift = (c: [number, number, number], k: number): [number, number, number] => [
    Math.min(1.4, c[0] * k),
    Math.min(1.4, c[1] * k),
    Math.min(1.4, c[2] * k),
  ];
  const core: [number, number, number] = [
    Math.min(1, hot[0] * 0.55 + 0.45),
    Math.min(1, hot[1] * 0.55 + 0.45),
    Math.min(1, hot[2] * 0.55 + 0.45),
  ];
  return {
    base: lift(deep, 1.05),
    hot: lift(rgb, 1.35),
    core,
    haze: [deep[0] * 0.12, deep[1] * 0.12, deep[2] * 0.12],
  };
}

const KEYS = ['base', 'hot', 'core', 'haze'] as const;

/** Crossfades between palettes. About 95 percent in `seconds`. */
export class AccentBlender {
  readonly current: AccentPalette;
  private target: AccentPalette;
  private readonly lambda: number;

  constructor(initial: AccentPalette, seconds = 0.6) {
    this.current = {
      base: [...initial.base],
      hot: [...initial.hot],
      core: [...initial.core],
      haze: [...initial.haze],
    };
    this.target = initial;
    this.lambda = Math.log(20) / seconds;
  }

  setTarget(p: AccentPalette): void {
    this.target = p;
  }

  /** Moves toward the target; returns true while still moving. */
  step(dt: number, instant = false): boolean {
    let moving = false;
    for (const k of KEYS) {
      const cur = this.current[k];
      const tgt = this.target[k];
      for (let i = 0; i < 3; i++) {
        const v = instant ? tgt[i]! : damp(cur[i]!, tgt[i]!, this.lambda, dt);
        if (Math.abs(v - tgt[i]!) > 1e-4) moving = true;
        cur[i] = v;
      }
    }
    return moving;
  }
}
