/**
 * The land mask: decode the run-length data once, then answer "is this longitude and latitude land".
 * Framework-free. The generated data lives in `land-mask.data.ts`.
 *
 * Adapted from fluxcommunity/web/src/sections/pulse/mask.ts (same owner, MIT).
 */
import { LAND_MASK_HEIGHT, LAND_MASK_RUNS, LAND_MASK_WIDTH } from './land-mask.data';

export interface LandMask {
  width: number;
  height: number;
  /** 1 where the 1 degree cell is land. Row-major, row 0 is the northernmost, column 0 is 180W. */
  cells: Uint8Array;
}

/**
 * Decodes base64 LEB128 run lengths (water first, then alternating) into a bitmap. Throws when the data
 * does not describe exactly `width * height` cells, so a corrupt module fails loudly in tests.
 */
export function decodeRuns(base64: string, width: number, height: number): Uint8Array {
  const text = atob(base64);
  const total = width * height;
  const out = new Uint8Array(total);
  let pos = 0;
  let value = 0;
  let shift = 0;
  let bit = 0;
  for (let i = 0; i < text.length; i++) {
    const byte = text.charCodeAt(i);
    value += (byte & 0x7f) * 2 ** shift;
    if (byte & 0x80) {
      shift += 7;
      continue;
    }
    if (pos + value > total) throw new Error('land mask has more cells than its size');
    if (bit === 1) out.fill(1, pos, pos + value);
    pos += value;
    value = 0;
    shift = 0;
    bit ^= 1;
  }
  if (pos !== total) throw new Error(`land mask has ${pos} cells, expected ${total}`);
  return out;
}

let shared: LandMask | null = null;

/** The decoded world mask. Decoded on first use and then shared. */
export function getLandMask(): LandMask {
  if (!shared) {
    shared = {
      width: LAND_MASK_WIDTH,
      height: LAND_MASK_HEIGHT,
      cells: decodeRuns(LAND_MASK_RUNS, LAND_MASK_WIDTH, LAND_MASK_HEIGHT),
    };
  }
  return shared;
}

/** Whether the cell containing this longitude and latitude is land. Longitude wraps, latitude clamps. */
export function isLand(mask: LandMask, lon: number, lat: number): boolean {
  const col = Math.floor(((lon + 180) / 360) * mask.width);
  const row = Math.floor(((90 - lat) / 180) * mask.height);
  const c = ((col % mask.width) + mask.width) % mask.width;
  const r = Math.min(mask.height - 1, Math.max(0, row));
  return (mask.cells[r * mask.width + c] ?? 0) === 1;
}
