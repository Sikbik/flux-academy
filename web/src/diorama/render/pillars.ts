/**
 * Node pillars: extruded hex prisms with side faces, a lit cap and edge light, drawn by hand in
 * screen space from a projected polygon (6 top corners then 6 base corners). Ambient pillars use a
 * cached projection; instances and anything highlighted are projected on the fly with their own radius
 * and height.
 */
import type { Bench } from '../model/types';
import type { Camera } from './camera';
import type { Palette } from './palette';
import type { Sprites } from './sprites';

const COS = Array.from({ length: 6 }, (_, k) => Math.cos(Math.PI / 6 + (k * Math.PI) / 3));
const SIN = Array.from({ length: 6 }, (_, k) => Math.sin(Math.PI / 6 + (k * Math.PI) / 3));

/** Radius of an ambient pillar relative to a terrain cell, and of a featured (instance) pillar. */
export const AMBIENT_R = 0.86;
export const FEATURED_R = 1.7;
/** Featured pillars are a little taller than their tier height, so they read above their neighbours. */
export const FEATURED_H = 1.55;

export interface PillarGeo {
  n: number;
  /** Per node: 6 top corners (x, y) then 6 base corners (x, y). */
  poly: Float32Array;
  topX: Float32Array;
  topY: Float32Array;
  baseX: Float32Array;
  baseY: Float32Array;
  /** Pixels per bench unit at the node. */
  ps: Float32Array;
  /** Back to front. */
  order: Uint32Array;
}

export function makePillarGeo(n: number): PillarGeo {
  return {
    n,
    poly: new Float32Array(n * 24),
    topX: new Float32Array(n),
    topY: new Float32Array(n),
    baseX: new Float32Array(n),
    baseY: new Float32Array(n),
    ps: new Float32Array(n),
    order: new Uint32Array(n),
  };
}

/** Projects a prism centred at (x, y) into `out` at offset `o` (24 floats). */
export function projectPrism(
  cam: Camera,
  x: number,
  y: number,
  r: number,
  h: number,
  out: Float32Array,
  o: number,
): void {
  for (let k = 0; k < 6; k++) {
    const px = x + (COS[k] as number) * r;
    const py = y + (SIN[k] as number) * r;
    cam.project(px, py, h);
    out[o + k * 2] = cam.sx;
    out[o + k * 2 + 1] = cam.sy;
    cam.project(px, py, 0);
    out[o + 12 + k * 2] = cam.sx;
    out[o + 12 + k * 2 + 1] = cam.sy;
  }
}

/**
 * Projects every node (ambient size). The back to front order depends only on bench coordinates, so it is
 * computed once (`reorder`) and the per frame calls during a camera move allocate nothing.
 */
export function projectPillars(cam: Camera, bench: Bench, geo: PillarGeo, reorder = true, hBoost = 1): void {
  const nodes = bench.nodes;
  geo.n = nodes.length;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i] as (typeof nodes)[number];
    projectPrism(cam, n.x, n.y, AMBIENT_R, n.height * hBoost, geo.poly, i * 24);
    cam.project(n.x, n.y, n.height * hBoost);
    geo.topX[i] = cam.sx;
    geo.topY[i] = cam.sy;
    cam.project(n.x, n.y, 0);
    geo.baseX[i] = cam.sx;
    geo.baseY[i] = cam.sy;
    geo.ps[i] = cam.ps;
  }
  if (!reorder) return;
  const idx: number[] = [];
  for (let i = 0; i < nodes.length; i++) idx.push(i);
  idx.sort((a, b) => {
    const na = nodes[a] as (typeof nodes)[number];
    const nb = nodes[b] as (typeof nodes)[number];
    return na.y - nb.y || na.x - nb.x;
  });
  for (let i = 0; i < idx.length; i++) geo.order[i] = idx[i] as number;
}

/** What a pillar looks like this frame. One mutable object is reused for every draw. */
export interface PillarStyle {
  tier: 0 | 1 | 2;
  /** Overall opacity of the prism. */
  alpha: number;
  /** 0..1 emphasis: brighter rims and cap. */
  lit: number;
  /** 0..1 how dead it is: desaturates and dims. */
  dead: number;
  /** 0..1 crack line progress across the cap. */
  crack: number;
  /** Additive glow strength around the cap, 0..1. */
  glow: number;
  /** Cluster tier mix as shares of [cumulus, nimbus, stratus] summing to 1, or null for a solid tier. */
  stack: readonly [number, number, number] | null;
  /** The cap gets a white-hot outline (instances). */
  featured: boolean;
}

export function makeStyle(): PillarStyle {
  return { tier: 0, alpha: 1, lit: 0, dead: 0, crack: 0, glow: 0.4, stack: null, featured: false };
}

const FACE_ORDER: ReadonlyArray<readonly [number, number]> = [
  [2, 0.5],
  [5, 1.1],
  [1, 0.72],
  [0, 1.0],
];
const BANDS = [0, 0.34, 0.68, 1] as const;
const BAND_ALPHA = [0.82, 0.55, 0.28] as const;

const ramp = (pal: Palette, tier: number, light: boolean, dead: boolean) =>
  dead ? pal.rDead : light ? pal.rTiersLight[tier as 0 | 1 | 2] : pal.rTiers[tier as 0 | 1 | 2];

/**
 * Draws one prism from its projected polygon. Faces are shaded by orientation and split into three
 * bands (a cheap gradient with no allocation). `P[o ...]` holds 6 top corners then 6 base corners.
 */
export function drawPrism(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  P: Float32Array,
  o: number,
  s: PillarStyle,
): void {
  const deadMix = s.dead;
  const base = ramp(pal, s.tier, false, deadMix > 0.6);
  const light = ramp(pal, s.tier, true, deadMix > 0.6);
  const a = s.alpha * (1 - 0.55 * deadMix);

  // Which sides face the viewer.
  for (const [k, shade] of FACE_ORDER) {
    const k2 = (k + 1) % 6;
    const tx0 = P[o + k * 2] as number;
    const ty0 = P[o + k * 2 + 1] as number;
    const tx1 = P[o + k2 * 2] as number;
    const ty1 = P[o + k2 * 2 + 1] as number;
    const bx0 = P[o + 12 + k * 2] as number;
    const by0 = P[o + 12 + k * 2 + 1] as number;
    const bx1 = P[o + 12 + k2 * 2] as number;
    const by1 = P[o + 12 + k2 * 2 + 1] as number;
    if ((tx1 - tx0) * (by0 - ty0) - (ty1 - ty0) * (bx0 - tx0) >= 0) continue;
    for (let b = 0; b < 3; b++) {
      const u0 = BANDS[b] as number;
      const u1 = BANDS[b + 1] as number;
      ctx.beginPath();
      ctx.moveTo(tx0 + (bx0 - tx0) * u0, ty0 + (by0 - ty0) * u0);
      ctx.lineTo(tx1 + (bx1 - tx1) * u0, ty1 + (by1 - ty1) * u0);
      ctx.lineTo(tx1 + (bx1 - tx1) * u1, ty1 + (by1 - ty1) * u1);
      ctx.lineTo(tx0 + (bx0 - tx0) * u1, ty0 + (by0 - ty0) * u1);
      ctx.closePath();
      let rampFor = base;
      if (s.stack && deadMix < 0.6) {
        // Stacked clusters: the tier mix as horizontal strata, cumulus at the foot, stratus at the head.
        const t = 1 - (u0 + u1) / 2; // 0 at the foot, 1 at the head
        const c = s.stack[0];
        const n = s.stack[1];
        const tier = t < c ? 0 : t < c + n ? 1 : 2;
        rampFor = pal.rTiers[tier as 0 | 1 | 2];
      }
      ctx.fillStyle = rampFor.a((BAND_ALPHA[b] as number) * shade * a * (0.85 + 0.3 * s.lit));
      ctx.fill();
    }
    // Edge light on the near vertical edge.
    ctx.beginPath();
    ctx.moveTo(tx0, ty0);
    ctx.lineTo(bx0, by0);
    ctx.lineWidth = 1;
    ctx.strokeStyle = light.a((0.55 + 0.4 * s.lit) * a * shade);
    ctx.stroke();
  }

  // Cap.
  ctx.beginPath();
  ctx.moveTo(P[o] as number, P[o + 1] as number);
  for (let k = 1; k < 6; k++) ctx.lineTo(P[o + k * 2] as number, P[o + k * 2 + 1] as number);
  ctx.closePath();
  let capRamp = light;
  if (s.stack && deadMix < 0.6) {
    const top = s.stack[2] > 0 ? 2 : s.stack[1] > 0 ? 1 : 0;
    capRamp = pal.rTiersLight[top as 0 | 1 | 2];
  }
  ctx.fillStyle = capRamp.a((0.5 + 0.4 * s.lit) * a);
  ctx.fill();
  // Cap light: a smaller, brighter hexagon inside the cap.
  let cx = 0;
  let cy = 0;
  for (let k = 0; k < 6; k++) {
    cx += P[o + k * 2] as number;
    cy += P[o + k * 2 + 1] as number;
  }
  cx /= 6;
  cy /= 6;
  ctx.beginPath();
  ctx.moveTo(cx + ((P[o] as number) - cx) * 0.5, cy + ((P[o + 1] as number) - cy) * 0.5);
  for (let k = 1; k < 6; k++) {
    ctx.lineTo(cx + ((P[o + k * 2] as number) - cx) * 0.5, cy + ((P[o + k * 2 + 1] as number) - cy) * 0.5);
  }
  ctx.closePath();
  ctx.fillStyle = pal.rHot.a((0.14 + 0.38 * s.lit) * a * (1 - deadMix));
  ctx.fill();
  // Cap rim.
  ctx.beginPath();
  ctx.moveTo(P[o] as number, P[o + 1] as number);
  for (let k = 1; k < 6; k++) ctx.lineTo(P[o + k * 2] as number, P[o + k * 2 + 1] as number);
  ctx.closePath();
  ctx.lineWidth = s.featured ? 1.4 : 1;
  ctx.strokeStyle = s.featured ? pal.rHot.a(0.92 * a) : light.a((0.75 + 0.2 * s.lit) * a);
  ctx.stroke();

  // Crack: a jagged line that draws itself across the cap.
  if (s.crack > 0.001) {
    const x0 = P[o + 8] as number; // corner 4
    const y0 = P[o + 9] as number;
    const x1 = P[o + 2] as number; // corner 1
    const y1 = P[o + 3] as number;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const nx = -dy;
    const ny = dx;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    let px = x0;
    let py = y0;
    for (let i = 1; i <= 6; i++) {
      const f = Math.min(1, Math.max(0, s.crack * 6 - (i - 1)));
      if (f <= 0) break;
      const t = i / 6;
      const qx = x0 + dx * t + nx * (JAG[i] as number);
      const qy = y0 + dy * t + ny * (JAG[i] as number);
      ctx.lineTo(px + (qx - px) * f, py + (qy - py) * f);
      px = qx;
      py = qy;
    }
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = pal.rCrit.a(0.95);
    ctx.stroke();
  }
}

const JAG = [0, 0.1, -0.12, 0.09, -0.08, 0.06, 0] as const;

/** Stamps additive glow sprites for a pillar: a halo at the cap and a pool of light on the ground. */
export function drawPillarGlow(
  ctx: CanvasRenderingContext2D,
  sprites: Sprites,
  tier: 0 | 1 | 2,
  capX: number,
  capY: number,
  baseX: number,
  baseY: number,
  radiusPx: number,
  strength: number,
  hot = false,
): void {
  if (strength <= 0.01) return;
  const halo = radiusPx * (hot ? 7 : 5.2);
  ctx.globalAlpha = Math.min(1, strength * (hot ? 0.9 : 0.6));
  ctx.drawImage(hot ? sprites.hot : sprites.tiers[tier], capX - halo / 2, capY - halo / 2, halo, halo);
  const gw = radiusPx * 6.5;
  ctx.globalAlpha = Math.min(1, strength * 0.55);
  ctx.drawImage(sprites.groundTiers[tier], baseX - gw / 2, baseY - gw / 4, gw, gw / 2);
  ctx.globalAlpha = 1;
}
