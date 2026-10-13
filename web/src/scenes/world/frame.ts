// From the diorama's bench model to the scene's world: one uniform scale (bench units are hex
// circumradii; the scene wants a bench about 120 units across), the pillar geometry, and the light the
// pillars cast on the terrain around them. Pure: a `Bench` in, typed arrays out.
//
// The model is the diorama's (`@/diorama/model`), so the hero and the lessons stand on the same bench.
// Nothing here invents a node or a position.

import type { Bench } from '@/diorama/model';
import { hash2, saturate } from '../lib/math';

/** The scene's bench is this many world units from its west edge to its east edge. */
export const WORLD_WIDTH = 120;
/** Pillars are drawn taller than the 2D diorama draws them: a bench seen at a slant needs the height. */
export const HEIGHT_K = 1.85;

export interface WorldFrame {
  /** World units per bench unit. */
  scale: number;
  /** Centre of the bench extent, bench units. */
  cx: number;
  cy: number;
  /** Half the extent of the land in world units. */
  halfW: number;
  halfD: number;
  /** Circumradius of a terrain cell, world units. */
  cell: number;
}

export function frameFor(bench: Bench): WorldFrame {
  const e = bench.extent;
  const w = Math.max(1, e.maxX - e.minX);
  const h = Math.max(1, e.maxY - e.minY);
  const scale = WORLD_WIDTH / w;
  return {
    scale,
    cx: (e.minX + e.maxX) / 2,
    cy: (e.minY + e.maxY) / 2,
    halfW: (w * scale) / 2,
    halfD: (h * scale) / 2,
    cell: scale,
  };
}

export function worldX(f: WorldFrame, x: number): number {
  return (x - f.cx) * f.scale;
}

/** The bench's y grows south, like the scene's z. */
export function worldZ(f: WorldFrame, y: number): number {
  return (y - f.cy) * f.scale;
}

export interface PillarSpecs {
  count: number;
  x: Float32Array;
  z: Float32Array;
  height: Float32Array;
  /** Footprint circumradius, world units. */
  radius: Float32Array;
  /** 0 cumulus, 1 nimbus, 2 stratus. */
  tier: Uint8Array;
  /** Cluster size 0..1 (log of the count against the biggest cluster). */
  mass: Float32Array;
  rnd: Float32Array;
}

export function pillarSpecs(bench: Bench, f: WorldFrame): PillarSpecs {
  const n = bench.nodes.length;
  const out: PillarSpecs = {
    count: n,
    x: new Float32Array(n),
    z: new Float32Array(n),
    height: new Float32Array(n),
    radius: new Float32Array(n),
    tier: new Uint8Array(n),
    mass: new Float32Array(n),
    rnd: new Float32Array(n),
  };
  let maxCount = 1;
  for (const node of bench.nodes) maxCount = Math.max(maxCount, node.count);
  // A pillar may spread over its neighbours when it has the room: half the distance to the nearest other
  // pillar (in bench units), clamped between one cell and a cell and a half.
  const nearest = new Float32Array(n).fill(1e9);
  const bucket = 6;
  const grid = new Map<number, number[]>();
  const key = (bx: number, by: number) => bx * 4096 + by;
  bench.nodes.forEach((node, i) => {
    const k = key(Math.floor(node.x / bucket), Math.floor(node.y / bucket));
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  });
  bench.nodes.forEach((node, i) => {
    const bx = Math.floor(node.x / bucket);
    const by = Math.floor(node.y / bucket);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const list = grid.get(key(bx + dx, by + dy));
        if (!list) continue;
        for (const j of list) {
          if (j === i) continue;
          const o = bench.nodes[j]!;
          const d = Math.hypot(o.x - node.x, o.y - node.y);
          if (d < nearest[i]!) nearest[i] = d;
        }
      }
    }
  });
  bench.nodes.forEach((node, i) => {
    out.x[i] = worldX(f, node.x);
    out.z[i] = worldZ(f, node.y);
    out.height[i] = node.height * f.scale * HEIGHT_K;
    const free = Math.min(1.5, Math.max(0.92, nearest[i]! * 0.5 - 0.1));
    out.radius[i] = free * f.scale;
    out.tier[i] = node.tierIndex;
    out.mass[i] = saturate(Math.log1p(node.count) / Math.log1p(maxCount));
    out.rnd[i] = hash2(node.cell * 7 + 3, i * 13 + 5);
  });
  return out;
}

export interface CellCast {
  /** 1 where a terrain cell is hidden under a pillar's footprint. */
  hidden: Uint8Array;
  /** Per cell: tier coloured light cast by nearby pillars, rgb 0..1. */
  tint: Float32Array;
}

const TIER_RGB: readonly (readonly [number, number, number])[] = [
  [0.21, 0.83, 1.0],
  [0.78, 0.49, 1.0],
  [1.0, 0.78, 0.34],
];

/** Hides the cells under each pillar and bakes the colour the pillars throw on the cells near them. */
export function castOnCells(bench: Bench, f: WorldFrame, pillars: PillarSpecs): CellCast {
  const cells = bench.cells;
  const hidden = new Uint8Array(cells.count);
  const tint = new Float32Array(cells.count * 3);
  const R = 6;
  bench.nodes.forEach((node, i) => {
    const rad = pillars.radius[i]! / f.scale;
    const foot = rad + 0.55;
    const reach = 4.6;
    const rgb = TIER_RGB[node.tierIndex]!;
    const weight = 0.7 + 0.5 * pillars.mass[i]!;
    const col = cells.col[node.cell]!;
    const row = cells.row[node.cell]!;
    for (let dr = -R; dr <= R; dr++) {
      const r = row + dr;
      if (r < 0 || r >= cells.rows) continue;
      for (let dc = -R; dc <= R; dc++) {
        const c = col + dc;
        if (c < 0 || c >= cells.cols) continue;
        const idx = cells.grid[r * cells.cols + c]!;
        if (idx < 0) continue;
        const d = Math.hypot(cells.x[idx]! - node.x, cells.y[idx]! - node.y);
        if (d < foot) hidden[idx] = 1;
        if (d < reach * 1.6) {
          const w = Math.exp(-((d / reach) ** 2) * 1.9) * 0.85 * weight;
          tint[idx * 3] = Math.min(1, tint[idx * 3]! + rgb[0] * w);
          tint[idx * 3 + 1] = Math.min(1, tint[idx * 3 + 1]! + rgb[1] * w);
          tint[idx * 3 + 2] = Math.min(1, tint[idx * 3 + 2]! + rgb[2] * w);
        }
      }
    }
  });
  return { hidden, tint };
}
