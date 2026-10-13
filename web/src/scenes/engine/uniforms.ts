// Uniform values shared by every material. Each material receives the same `{ value }` objects, so one
// write per frame updates the whole scene. Values that only one material needs live on that material.

import { Vector2, Vector3, Vector4 } from 'three';
import { FLUX_PALETTE, TIER_COLOURS, TINT_COLOURS } from '../lib/palette';
import { MAX_WAVES } from '../lib/waves';

export interface Uniform<T> {
  value: T;
}

export interface SharedUniforms {
  uTime: Uniform<number>;
  uDpr: Uniform<number>;
  uViewport: Uniform<Vector2>;
  /** 1 on the lowest tier: materials tone map themselves. */
  uDirect: Uniform<number>;
  uExposure: Uniform<number>;
  uAccent: Uniform<Vector3>;
  uAccentHot: Uniform<Vector3>;
  uAccentCore: Uniform<Vector3>;
  uHaze: Uniform<Vector3>;
  /** Tier colours (cumulus, nimbus, stratus) and the white-hot "you" colour, as a vec3[4]. */
  uTier: Uniform<Float32Array>;
  /** Wave tint slots as a vec3[7]. */
  uTints: Uniform<Float32Array>;
  uGlow: Uniform<number>;
  uFogScale: Uniform<number>;
  /** The global luminance beat, 0..1. */
  uBeat: Uniform<number>;
  /** Idle motion multiplier (0 when reduced). */
  uMotion: Uniform<number>;
  /** The cell: world position and the radius of its light pool. */
  uCell: Uniform<Vector4>;
  uCellGlow: Uniform<number>;
  uWaveCount: Uniform<number>;
  uWaveA: Uniform<Float32Array>;
  uWaveB: Uniform<Float32Array>;
  /** Intro reveal 0..1 and its centre (x, z) and reach (z). */
  uReveal: Uniform<number>;
  uRevealC: Uniform<Vector3>;
  /** Pointer on the bench plane: x, z, strength, radius. */
  uCursor: Uniform<Vector4>;
  /** Per tier emphasis, used for the tier highlight: (cumulus, nimbus, stratus). */
  uTierFocus: Uniform<Vector3>;
  /** Hovered pillar index (or -1) and how far it is lifted. */
  uHover: Uniform<Vector2>;
}

export function createSharedUniforms(): SharedUniforms {
  const f = FLUX_PALETTE;
  const tier = new Float32Array(12);
  TIER_COLOURS.forEach((c, i) => {
    tier[i * 3] = c[0];
    tier[i * 3 + 1] = c[1];
    tier[i * 3 + 2] = c[2];
  });
  const tints = new Float32Array(TINT_COLOURS.length * 3);
  TINT_COLOURS.forEach((c, i) => {
    tints[i * 3] = c[0];
    tints[i * 3 + 1] = c[1];
    tints[i * 3 + 2] = c[2];
  });
  return {
    uTime: { value: 0 },
    uDpr: { value: 1 },
    uViewport: { value: new Vector2(1, 1) },
    uDirect: { value: 0 },
    uExposure: { value: 1 },
    uAccent: { value: new Vector3(...f.base) },
    uAccentHot: { value: new Vector3(...f.hot) },
    uAccentCore: { value: new Vector3(...f.core) },
    uHaze: { value: new Vector3(...f.haze) },
    uTier: { value: tier },
    uTints: { value: tints },
    uGlow: { value: 1 },
    uFogScale: { value: 90 },
    uBeat: { value: 0 },
    uMotion: { value: 1 },
    uCell: { value: new Vector4(0, 16, -7, 6) },
    uCellGlow: { value: 1 },
    uWaveCount: { value: 0 },
    uWaveA: { value: new Float32Array(MAX_WAVES * 4) },
    uWaveB: { value: new Float32Array(MAX_WAVES * 4) },
    uReveal: { value: 1 },
    uRevealC: { value: new Vector3(0, 0, 90) },
    uCursor: { value: new Vector4(0, 0, 0, 5) },
    uTierFocus: { value: new Vector3(1, 1, 1) },
    uHover: { value: new Vector2(-1, 0) },
  };
}
