// How sharp the scene draws: the device pixel ratio the canvas gets for a tier, a canvas size and a device.
// Pure, so the policy is unit tested without a GL context.
//
// A tier has a DPR cap (1 for low, 1.5 for medium, 2 for high). A small canvas, a phone in portrait, is cheap
// to draw sharply, so it may exceed the cap while the frame stays under a pixel budget. That extra
// resolution is the first thing the engine withdraws when the device cannot hold the frame rate.

/** Never render below this ratio, whatever the tier says. */
export const DPR_FLOOR = 0.75;
/** A small canvas may draw this many pixels per frame at most, when it is boosted. */
export const BOOST_PIXELS = 1.4e6;
/** A boosted canvas never exceeds this ratio. */
export const BOOST_DPR_MAX = 2;
/** A boost must be a real step up (this factor over the tier's own ratio) or it is not worth resampling. */
export const BOOST_MIN_GAIN = 1.2;

export interface DprInput {
  /** `window.devicePixelRatio`. */
  deviceRatio: number;
  /** The tier's cap (`TIER_PARAMS[tier].dprMax`). */
  tierCap: number;
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  /** False once the engine has withdrawn the boost. */
  boost: boolean;
}

export function chooseDpr(i: DprInput): number {
  const ratio = Number.isFinite(i.deviceRatio) && i.deviceRatio > 0 ? i.deviceRatio : 1;
  let d = Math.min(ratio, i.tierCap);
  if (i.boost && i.width > 0 && i.height > 0) {
    const affordable = Math.sqrt(BOOST_PIXELS / (i.width * i.height));
    const boosted = Math.min(ratio, BOOST_DPR_MAX, affordable);
    if (boosted >= d * BOOST_MIN_GAIN) d = boosted;
  }
  return Math.max(DPR_FLOOR, d);
}
