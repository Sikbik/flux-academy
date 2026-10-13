// Hexagonal prism meshes as plain typed arrays (no three): one for the terrain cells, one for the
// pillars. Both are flat shaded (every face owns its vertices) and pointy-top, matching the diorama's lattice.
// The terrain prism is adapted from fluxcommunity/web/src/stage/hexgrid.ts `buildPrism` (same owner, MIT).

const SQRT3 = Math.sqrt(3);

export interface PrismMesh {
  position: Float32Array;
  normal: Float32Array;
  /** Per vertex: kind (0 top, 1 bevel, 2 wall), param, u along the face edge, spare. */
  meta: Float32Array;
  index: Uint16Array;
  vertexCount: number;
}

interface Builder {
  pos: number[];
  nrm: number[];
  meta: number[];
  idx: number[];
}

function builder(): Builder {
  return { pos: [], nrm: [], meta: [], idx: [] };
}

function push(
  b: Builder,
  x: number,
  y: number,
  z: number,
  n: readonly number[],
  kind: number,
  param: number,
  u = 0,
): number {
  b.pos.push(x, y, z);
  b.nrm.push(n[0]!, n[1]!, n[2]!);
  b.meta.push(kind, param, u, 0);
  return b.pos.length / 3 - 1;
}

// Adds a triangle wound so that its geometric normal agrees with `n`.
function tri(b: Builder, a: number, bb: number, c: number, n: readonly number[]): void {
  const { pos, idx } = b;
  const ax = pos[a * 3]!;
  const ay = pos[a * 3 + 1]!;
  const az = pos[a * 3 + 2]!;
  const ux = pos[bb * 3]! - ax;
  const uy = pos[bb * 3 + 1]! - ay;
  const uz = pos[bb * 3 + 2]! - az;
  const vx = pos[c * 3]! - ax;
  const vy = pos[c * 3 + 1]! - ay;
  const vz = pos[c * 3 + 2]! - az;
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  if (cx * n[0]! + cy * n[1]! + cz * n[2]! >= 0) idx.push(a, bb, c);
  else idx.push(a, c, bb);
}

function corner(k: number, radius: number): [number, number] {
  const a = Math.PI / 6 + (k * Math.PI) / 3;
  return [Math.cos(a) * radius, Math.sin(a) * radius];
}

function edgeNormal(k: number): [number, number] {
  const a = Math.PI / 3 + (k * Math.PI) / 3;
  return [Math.cos(a), Math.sin(a)];
}

function finish(b: Builder): PrismMesh {
  return {
    position: new Float32Array(b.pos),
    normal: new Float32Array(b.nrm),
    meta: new Float32Array(b.meta),
    index: new Uint16Array(b.idx),
    vertexCount: b.pos.length / 3,
  };
}

function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

export interface TerrainPrismOptions {
  /** Circumradius of the outer hexagon (a little under 1 leaves the gap between cells). */
  radius: number;
  /** Horizontal width of the bevel. */
  bevel: number;
  /** Vertical drop of the bevel. */
  bevelDrop: number;
}

/**
 * A terrain cell: bevelled top at y = 0, walls hanging from the bevel foot (kind 2, param 0 at the
 * foot to 1 at the base). The vertex shader maps the wall's param onto the cell's real height so the
 * base always sits on the bench plane.
 */
export function buildTerrainPrism(o: TerrainPrismOptions): PrismMesh {
  const b = builder();
  const apothem = o.radius * (SQRT3 / 2);
  const topApothem = Math.max(0.05, apothem - o.bevel);
  const topRadius = topApothem / (SQRT3 / 2);
  const up = [0, 1, 0];
  const top: number[] = [];
  for (let k = 0; k < 6; k++) {
    const [x, z] = corner(k, topRadius);
    top.push(push(b, x, 0, z, up, 0, 1));
  }
  for (let k = 1; k < 5; k++) tri(b, top[0]!, top[k]!, top[k + 1]!, up);

  for (let k = 0; k < 6; k++) {
    const k2 = (k + 1) % 6;
    const [ex, ez] = edgeNormal(k);
    const bn = norm3(ex * o.bevelDrop, o.bevel, ez * o.bevelDrop);
    const [ax, az] = corner(k, topRadius);
    const [bx, bz] = corner(k2, topRadius);
    const [cx, cz] = corner(k, o.radius);
    const [dx, dz] = corner(k2, o.radius);
    const a = push(b, ax, 0, az, bn, 1, 0, 0);
    const bb = push(b, bx, 0, bz, bn, 1, 0, 1);
    const c = push(b, cx, -o.bevelDrop, cz, bn, 1, 1, 0);
    const d = push(b, dx, -o.bevelDrop, dz, bn, 1, 1, 1);
    tri(b, a, bb, c, bn);
    tri(b, bb, d, c, bn);
    const wn = [ex, 0, ez];
    const w0 = push(b, cx, -o.bevelDrop, cz, wn, 2, 0, 0);
    const w1 = push(b, dx, -o.bevelDrop, dz, wn, 2, 0, 1);
    const w2 = push(b, cx, -1, cz, wn, 2, 1, 0);
    const w3 = push(b, dx, -1, dz, wn, 2, 1, 1);
    tri(b, w0, w1, w2, wn);
    tri(b, w1, w3, w2, wn);
  }
  return finish(b);
}

/**
 * A pillar: a unit hexagonal column. `position.y` carries a level, not a height: 0 is the base, 1 the foot
 * of the cap bevel, 2 the top. The vertex shader maps levels onto the pillar's real height (and keeps the
 * bevel a fixed absolute size), and the footprint radius is applied per instance.
 */
export function buildColumn(bevelFraction = 0.16): PrismMesh {
  const b = builder();
  const inner = 1 - bevelFraction;
  const up = [0, 1, 0];
  const top: number[] = [];
  for (let k = 0; k < 6; k++) {
    const [x, z] = corner(k, inner);
    top.push(push(b, x, 2, z, up, 0, 1, 0));
  }
  for (let k = 1; k < 5; k++) tri(b, top[0]!, top[k]!, top[k + 1]!, up);

  for (let k = 0; k < 6; k++) {
    const k2 = (k + 1) % 6;
    const [ex, ez] = edgeNormal(k);
    const bn = norm3(ex * 0.5, 0.9, ez * 0.5);
    const [ax, az] = corner(k, inner);
    const [bx, bz] = corner(k2, inner);
    const [cx, cz] = corner(k, 1);
    const [dx, dz] = corner(k2, 1);
    const a = push(b, ax, 2, az, bn, 1, 1, 0);
    const bb = push(b, bx, 2, bz, bn, 1, 1, 1);
    const c = push(b, cx, 1, cz, bn, 1, 0, 0);
    const d = push(b, dx, 1, dz, bn, 1, 0, 1);
    tri(b, a, bb, c, bn);
    tri(b, bb, d, c, bn);
    const wn = [ex, 0, ez];
    const w0 = push(b, cx, 1, cz, wn, 2, 1, 0);
    const w1 = push(b, dx, 1, dz, wn, 2, 1, 1);
    const w2 = push(b, cx, 0, cz, wn, 2, 0, 0);
    const w3 = push(b, dx, 0, dz, wn, 2, 0, 1);
    tri(b, w0, w1, w2, wn);
    tri(b, w1, w3, w2, wn);
  }
  return finish(b);
}

/**
 * A unit hexagonal prism centred on the origin, for the specimen cell, its slabs and the copies.
 * Radius 1, height 1 (y from -0.5 to 0.5; the instance stretches it). Walls carry `u` along the edge and
 * `v` up the face; the caps carry kind 0 with the cap's own xz as local coordinates.
 */
export function buildGlassPrism(): PrismMesh {
  const b = builder();
  const up = [0, 1, 0];
  const down = [0, -1, 0];
  const topV: number[] = [];
  const botV: number[] = [];
  for (let k = 0; k < 6; k++) {
    const [x, z] = corner(k, 1);
    topV.push(push(b, x, 0.5, z, up, 0, 1));
    botV.push(push(b, x, -0.5, z, down, 0, 0));
  }
  for (let k = 1; k < 5; k++) {
    tri(b, topV[0]!, topV[k]!, topV[k + 1]!, up);
    tri(b, botV[0]!, botV[k]!, botV[k + 1]!, down);
  }
  for (let k = 0; k < 6; k++) {
    const k2 = (k + 1) % 6;
    const [ex, ez] = edgeNormal(k);
    const [ax, az] = corner(k, 1);
    const [bx, bz] = corner(k2, 1);
    const n = [ex, 0, ez];
    const a = push(b, ax, 0.5, az, n, 2, 1, 0);
    const bb = push(b, bx, 0.5, bz, n, 2, 1, 1);
    const c = push(b, ax, -0.5, az, n, 2, 0, 0);
    const d = push(b, bx, -0.5, bz, n, 2, 0, 1);
    tri(b, a, bb, c, n);
    tri(b, bb, d, c, n);
  }
  return finish(b);
}
