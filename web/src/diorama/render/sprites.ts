/**
 * Soft light sprites, drawn once to small canvases and stamped with `drawImage` (additively) wherever a
 * glow is needed. Stamping a sprite is far cheaper than a per-frame radial gradient.
 */
import type { Palette, RGB } from './palette';
import { mix } from './palette';

export interface Sprites {
  /** A round glow per colour. */
  accent: HTMLCanvasElement;
  hot: HTMLCanvasElement;
  tiers: readonly [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  ok: HTMLCanvasElement;
  warn: HTMLCanvasElement;
  crit: HTMLCanvasElement;
  /** A wide, flat glow for the ground under a pillar (2:1). */
  groundTiers: readonly [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement];
  groundAccent: HTMLCanvasElement;
  groundHot: HTMLCanvasElement;
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const rgba = (c: RGB, a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** A round glow: a hot core fading to nothing with a long soft tail. */
function round(color: RGB, px = 96): HTMLCanvasElement {
  const c = canvas(px, px);
  const g = c.getContext('2d');
  if (!g) return c;
  const r = px / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, rgba(mix(color, [255, 255, 255], 0.35), 0.95));
  grad.addColorStop(0.14, rgba(color, 0.62));
  grad.addColorStop(0.38, rgba(color, 0.2));
  grad.addColorStop(0.7, rgba(color, 0.05));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, px, px);
  return c;
}

/** A flat elliptical glow (twice as wide as tall) for the floor under a pillar. */
function flat(color: RGB, px = 128): HTMLCanvasElement {
  const c = canvas(px, px / 2);
  const g = c.getContext('2d');
  if (!g) return c;
  g.save();
  g.translate(px / 2, px / 4);
  g.scale(1, 0.5);
  const r = px / 2;
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, rgba(color, 0.7));
  grad.addColorStop(0.3, rgba(color, 0.26));
  grad.addColorStop(0.65, rgba(color, 0.06));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(-r, -r, px, px);
  g.restore();
  return c;
}

export function makeSprites(p: Palette): Sprites {
  return {
    accent: round(p.accentHot),
    hot: round([255, 255, 255]),
    tiers: [round(p.tiers[0]), round(p.tiers[1]), round(p.tiers[2])],
    ok: round(p.ok),
    warn: round(p.warn),
    crit: round(p.crit),
    groundTiers: [flat(p.tiers[0]), flat(p.tiers[1]), flat(p.tiers[2])],
    groundAccent: flat(p.accent),
    groundHot: flat([255, 255, 255]),
  };
}
