// The chain strip as data: a short row of blocks along the east edge of the bench. New blocks arrive at
// the near end and push the row away; the register chapter of the story stamps the spec's hash on the
// newest one and runs a ring down the row. Pure: the engine reads `blocks` and `slide` each frame.

import { clamp, easeOutCubic, smoothstep } from './math';
import { STAMP_BEATS } from './story';

export interface ChainBlockState {
  /** Brightness of the block, 0..1. */
  lit: number;
  /** How much of the identicon shows, 0..1. */
  stamped: number;
  flash: number;
  /** A ring passing through the block, 0..1. */
  ring: number;
  seed: number;
}

export interface StampPhase {
  /** 0..1 progress of the hash on its way from the cell to the head block. */
  travel: number;
  /** 0..1 the head block's stamp. */
  stamped: number;
  /** 0..1 flash of the head block at the moment it is stamped. */
  flash: number;
  /** Position of the ring that runs down the strip, in blocks (0 is the head), or -1 when idle. */
  ring: number;
}

/** The register chapter as a pure function of its progress. */
export function stampPhase(stamp: number, blocks: number): StampPhase {
  const s = clamp(stamp, 0, 1);
  const travel = smoothstep(0.04, STAMP_BEATS.travelEnd, s);
  const stamped = smoothstep(STAMP_BEATS.travelEnd, STAMP_BEATS.stampAt, s);
  const flash = s >= STAMP_BEATS.travelEnd ? Math.exp(-(s - STAMP_BEATS.travelEnd) * 9) : 0;
  let ring = -1;
  if (s >= STAMP_BEATS.ringStart && s < 0.999) {
    const k = (s - STAMP_BEATS.ringStart) / (1 - STAMP_BEATS.ringStart);
    ring = -1 + k * (blocks + 2);
  }
  return { travel, stamped, flash, ring };
}

/** Width of the ring in blocks. */
const RING_WIDTH = 1.3;
/** Seconds the strip takes to glide one slot after a new block. */
const GLIDE = 0.9;
/** How long the new head flashes. */
const FLASH = 1.3;
/** Resting identicon strength of an ordinary block. */
const BASE_STAMP = 0.55;

export class ChainModel {
  readonly blocks: ChainBlockState[] = [];
  /** Slots of glide still to run, 1 right after a push, then eased to 0. */
  slide = 0;
  private glide = 0;
  private serial = 1;
  private headFlashAt = Number.NEGATIVE_INFINITY;
  private clock = 0;
  private stampOverride: StampPhase | null = null;

  constructor(readonly count: number) {
    for (let i = 0; i < count; i++) this.blocks.push(this.fresh(i));
    this.relight();
  }

  private fresh(i: number): ChainBlockState {
    return { lit: 0, stamped: BASE_STAMP, flash: 0, ring: 0, seed: ((i + this.serial++) * 0.6180339887) % 1 };
  }

  /** The resting brightness for a block of a given age: the head is hot, the tail is a glow. */
  static restLit(age: number): number {
    return 0.22 + 0.78 * Math.exp(-age * 0.26);
  }

  private relight(): void {
    this.blocks.forEach((b, i) => {
      b.lit = ChainModel.restLit(i);
    });
  }

  /** A real block landed: the row slides one slot and the new head flashes. */
  push(): void {
    this.blocks.pop();
    this.blocks.unshift(this.fresh(0));
    this.relight();
    this.glide = GLIDE;
    this.slide = 1;
    this.headFlashAt = this.clock;
  }

  /** The register chapter's stamp progress, or null outside the story. */
  setStamp(stamp: number | null): void {
    this.stampOverride = stamp === null ? null : stampPhase(stamp, this.count);
  }

  /** The current stamp phase (the engine draws the travelling hash from it). */
  get stampState(): StampPhase | null {
    return this.stampOverride;
  }

  step(dt: number): void {
    this.clock += dt;
    if (this.glide > 0) {
      this.glide = Math.max(0, this.glide - dt);
      this.slide = 1 - easeOutCubic(1 - this.glide / GLIDE);
    } else this.slide = 0;
    const sinceFlash = this.clock - this.headFlashAt;
    const st = this.stampOverride;
    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      if (!b) continue;
      b.flash = i === 0 && sinceFlash >= 0 ? Math.exp(-sinceFlash / (FLASH / 3)) * 0.9 : 0;
      b.ring = 0;
      b.stamped = BASE_STAMP;
      b.lit = ChainModel.restLit(i);
      if (st) {
        if (i === 0) {
          b.stamped = BASE_STAMP * 0.35 + (1 - BASE_STAMP * 0.35) * st.stamped;
          b.flash = Math.max(b.flash, st.flash);
          b.lit = Math.max(b.lit, 0.5 + 0.5 * st.stamped);
        }
        if (st.ring >= 0) {
          const d = (i - st.ring) / RING_WIDTH;
          b.ring = Math.exp(-d * d);
        }
      }
    }
  }

  /** Brings every transient to rest (reduced motion: the still frame). */
  settle(): void {
    this.glide = 0;
    this.slide = 0;
    this.headFlashAt = Number.NEGATIVE_INFINITY;
    this.step(0);
  }
}
