// A bench becomes a world: the frame (scale and extents), the pillar and beacon layout, the light the
// pillars cast on the terrain, where the cell floats, where the proxy sits and the camera's framing
// data. Pure: a `Bench` in, typed arrays and numbers out. The same function serves the sample world and
// a live one, so nothing downstream knows the difference.

import type { Bench } from '@/diorama/model';
import type { BenchFrame } from '../lib/camera';
import { BEACON_HEIGHT } from '../lib/director';
import {
  type CellCast,
  castOnCells,
  frameFor,
  type PillarSpecs,
  pillarSpecs,
  type WorldFrame,
  worldX,
  worldZ,
} from './frame';

export interface BeaconLayout {
  x: Float32Array;
  z: Float32Array;
  count: number;
  height: number;
  radius: number;
}

export interface ChainLayout {
  /** World x of the strip (east of the bench) and z of the head (the newest block, nearest). */
  x: number;
  headZ: number;
  step: number;
  blocks: number;
}

export interface World {
  bench: Bench;
  frame: WorldFrame;
  pillars: PillarSpecs;
  cast: CellCast;
  beacons: BeaconLayout;
  /** Where the cell floats, world units. */
  cell: { x: number; y: number; z: number };
  /** The proxy, one schematic point above the bench. */
  proxy: { x: number; y: number; z: number };
  chain: ChainLayout;
  /** Camera framing data derived from the above. */
  benchFrame: BenchFrame;
  /** World centres of every land cell, for the floor glow. */
  cellX: Float32Array;
  cellZ: Float32Array;
}

export const CHAIN_BLOCKS = 15;
export const CHAIN_STEP = 4.1;
const CHAIN_GAP = 8;

/** Where the cell floats above a bench of the given half extents. */
export function cellPosition(halfW: number, halfD: number): { x: number; y: number; z: number } {
  void halfW;
  return { x: 0, y: 18.5, z: -halfD * 0.26 };
}

export function buildWorld(bench: Bench): World {
  const frame = frameFor(bench);
  const pillars = pillarSpecs(bench, frame);
  const cast = castOnCells(bench, frame, pillars);
  const users = bench.users;
  const bx = new Float32Array(users.length);
  const bz = new Float32Array(users.length);
  users.forEach((u, i) => {
    bx[i] = worldX(frame, u.x);
    bz[i] = worldZ(frame, u.y);
  });
  const beacons: BeaconLayout = {
    x: bx,
    z: bz,
    count: users.length,
    height: BEACON_HEIGHT,
    radius: Math.max(0.34, frame.cell * 0.5),
  };

  const cell = cellPosition(frame.halfW, frame.halfD);
  const proxy = { x: 0, y: 9, z: 0 };
  // The sim keeps the proxy in bench coordinates (above the middle of the bench).
  const chain: ChainLayout = {
    x: frame.halfW + CHAIN_GAP,
    headZ: frame.halfD - 3,
    step: CHAIN_STEP,
    blocks: CHAIN_BLOCKS,
  };
  const tailZ = chain.headZ - (CHAIN_BLOCKS - 1) * CHAIN_STEP;

  const n = bench.cells.count;
  const cellX = new Float32Array(n);
  const cellZ = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    cellX[i] = worldX(frame, bench.cells.x[i] ?? 0);
    cellZ[i] = worldZ(frame, bench.cells.y[i] ?? 0);
  }

  return {
    bench,
    frame,
    pillars,
    cast,
    beacons,
    cell,
    proxy,
    chain,
    benchFrame: {
      halfW: frame.halfW,
      halfD: frame.halfD,
      cell,
      stripHead: { x: chain.x, y: 0, z: chain.headZ },
      stripTail: { x: chain.x, y: 0, z: tailZ },
    },
    cellX,
    cellZ,
  };
}

/** The proxy in world space from the simulation's own (bench coordinate) proxy. */
export function proxyFromSim(
  frame: WorldFrame,
  sim: { x: number; y: number },
  height = 9,
): { x: number; y: number; z: number } {
  return { x: worldX(frame, sim.x), y: height, z: worldZ(frame, sim.y) };
}
