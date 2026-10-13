/**
 * The colours the canvas uses, read from the design tokens in force on the figure (so the accent switch
 * re-tints the scene), plus pre-formatted colour ramps so a frame never builds a colour string.
 */
import type { Tier } from '../model/types';

export type RGB = readonly [number, number, number];

/** `n + 1` pre-formatted `rgba()` strings for one colour: alpha 0, 1/n, ... 1. */
export class Ramp {
  private readonly steps: string[] = [];
  constructor(
    readonly rgb: RGB,
    private readonly n = 32,
  ) {
    for (let i = 0; i <= n; i++) {
      this.steps.push(`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(i / n).toFixed(3)})`);
    }
  }
  /** The colour at alpha `a` (clamped, quantised to 1/32). */
  a(alpha: number): string {
    const i = alpha <= 0 ? 0 : alpha >= 1 ? this.n : Math.round(alpha * this.n);
    return this.steps[i] as string;
  }
}

export interface Palette {
  accent: RGB;
  accentHot: RGB;
  accentDeep: RGB;
  hot: RGB;
  ink: RGB;
  text: RGB;
  tiers: readonly [RGB, RGB, RGB];
  ok: RGB;
  warn: RGB;
  crit: RGB;
  // Ramps
  rAccent: Ramp;
  rAccentHot: Ramp;
  rAccentDeep: Ramp;
  rHot: Ramp;
  rInk: Ramp;
  rText: Ramp;
  rTiers: readonly [Ramp, Ramp, Ramp];
  /** Each tier colour pushed towards white: top faces and rims. */
  rTiersLight: readonly [Ramp, Ramp, Ramp];
  rOk: Ramp;
  rWarn: Ramp;
  rCrit: Ramp;
  /** A grey for dead things. */
  rDead: Ramp;
  mono: string;
}

const FALLBACK = {
  accent: [79, 122, 212] as RGB,
  accentHot: [174, 198, 255] as RGB,
  accentDeep: [43, 97, 209] as RGB,
  cumulus: [54, 211, 255] as RGB,
  nimbus: [199, 125, 255] as RGB,
  stratus: [255, 200, 87] as RGB,
  ok: [63, 220, 149] as RGB,
  warn: [255, 154, 61] as RGB,
  crit: [255, 84, 112] as RGB,
  ink: [6, 9, 15] as RGB,
  text: [165, 173, 189] as RGB,
};

function triple(value: string, fallback: RGB): RGB {
  const parts = value
    .trim()
    .split(/[\s,/]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (parts.length < 3) return fallback;
  return [parts[0] as number, parts[1] as number, parts[2] as number];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const WHITE: RGB = [255, 255, 255];
const GREY: RGB = [120, 126, 138];

/** Reads the palette from the tokens in force on `el`. Never throws; falls back to the brand values. */
export function readPalette(el: Element | null): Palette {
  let css: CSSStyleDeclaration | null = null;
  try {
    css = el ? getComputedStyle(el) : null;
  } catch {
    css = null;
  }
  const get = (name: string, fb: RGB): RGB => (css ? triple(css.getPropertyValue(name), fb) : fb);
  const accent = get('--accent-rgb', FALLBACK.accent);
  const accentHot = get('--accent-hot-rgb', FALLBACK.accentHot);
  const accentDeep = get('--accent-deep-rgb', FALLBACK.accentDeep);
  const tiers: [RGB, RGB, RGB] = [
    get('--cumulus-rgb', FALLBACK.cumulus),
    get('--nimbus-rgb', FALLBACK.nimbus),
    get('--stratus-rgb', FALLBACK.stratus),
  ];
  const ok = get('--status-ok-rgb', FALLBACK.ok);
  const warn = get('--status-warn-rgb', FALLBACK.warn);
  const crit = get('--status-crit-rgb', FALLBACK.crit);
  const ink = get('--ink-0-rgb', FALLBACK.ink);
  const text = FALLBACK.text;
  const mono =
    css?.getPropertyValue('--font-mono').trim() || '"IBM Plex Mono", ui-monospace, Menlo, monospace';
  return {
    accent,
    accentHot,
    accentDeep,
    hot: WHITE,
    ink,
    text,
    tiers,
    ok,
    warn,
    crit,
    rAccent: new Ramp(accent),
    rAccentHot: new Ramp(accentHot),
    rAccentDeep: new Ramp(accentDeep),
    rHot: new Ramp(WHITE),
    rInk: new Ramp(ink),
    rText: new Ramp(text),
    rTiers: [new Ramp(tiers[0]), new Ramp(tiers[1]), new Ramp(tiers[2])],
    rTiersLight: [
      new Ramp(mix(tiers[0], WHITE, 0.3)),
      new Ramp(mix(tiers[1], WHITE, 0.3)),
      new Ramp(mix(tiers[2], WHITE, 0.3)),
    ],
    rOk: new Ramp(ok),
    rWarn: new Ramp(warn),
    rCrit: new Ramp(crit),
    rDead: new Ramp(GREY),
    mono,
  };
}

export const TIER_NAMES: readonly Tier[] = ['cumulus', 'nimbus', 'stratus'];
