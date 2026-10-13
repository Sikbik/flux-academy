// The terrain: instanced bevelled hex prisms for every land cell of the bench. All motion lives in the
// vertex shader, driven by a handful of uniforms (waves, cursor, reveal, the cell's light pool), so a
// frame costs no per-cell CPU work. Only the per-cell attributes (position, height, baked tint) are
// written, and only when the terrain or the pillar layout changes.

import {
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from 'three';
import type { Bench } from '@/diorama/model';
import { hash2 } from '../lib/math';
import { waveTablesGlsl } from '../lib/waves';
import { type CellCast, type WorldFrame, worldX, worldZ } from '../world/frame';
import { buildTerrainPrism } from '../world/prism';
import { GLSL_COMMON, GLSL_FINISH } from './glsl';
import type { SharedUniforms } from './uniforms';

/** Gap between neighbouring prisms as a fraction of the lattice step, the bevel and its drop. */
const SQRT3 = 1.7320508075688772;
const GAP = 0.16;
const RADIUS = 1 - GAP / SQRT3;
const BEVEL = 0.1;
const BEVEL_DROP = 0.1;
/** The model's relief is a hint; the bench is drawn with it exaggerated so the field reads as a skyline. */
const RELIEF = 2.4;

const VERT = /* glsl */ `
${GLSL_COMMON}
${waveTablesGlsl()}

uniform float uTime;
uniform float uMotion;
uniform float uReveal;
uniform vec3 uRevealC;
uniform vec4 uCursor;
uniform vec4 uCell;
uniform float uCellGlow;
uniform int uWaveCount;
uniform vec4 uWaveA[12];
uniform vec4 uWaveB[12];
uniform vec3 uTints[7];
uniform float uSize;
uniform float uBevelDrop;

attribute vec4 aMeta;   // kind, param, u, 0
attribute vec4 aCell;   // x, z, height, rnd
attribute vec4 aTint;   // baked light rgb, hidden flag

varying vec3 vWorld;
varying vec3 vNrm;
varying vec4 vMeta;     // kind, param, rnd, heat
varying vec4 vC;        // pool, pop, ig, seam
varying vec3 vTint;     // dynamic tint from waves
varying vec3 vBake;     // baked tint from nearby pillars
varying vec2 vLocal;

void main() {
  vec2 c = aCell.xy;
  float h = aCell.z;
  float rnd = aCell.w;
  float hidden = aTint.w;

  float heat = 0.0;
  float lift = 0.0;
  vec3 tint = vec3(0.0);

  // The bench ignites from the middle: cells pop up white-hot as the front passes.
  float cd = length(c - uRevealC.xy);
  float ig = clamp((uReveal * uRevealC.z - cd) / 9.0, 0.0, 1.0);
  float pop = ig * (1.0 - ig) * 4.0;
  lift += pop * 0.5;
  heat += pop * 0.55;

  // Idle: a slow swell across the field and a few cells that rise and fall on their own clock.
  float sw = vnoise(c * 0.07 + vec2(uTime * 0.035, -uTime * 0.028));
  lift += (sw - 0.5) * 0.3 * uMotion;
  float rb = 0.5 + 0.5 * sin(uTime * (0.18 + rnd * 0.4) + rnd * 60.0);
  float riser = smoothstep(0.94, 0.99, rnd);
  lift += riser * rb * 0.45 * uMotion;
  heat += riser * rb * 0.22;

  // Waves: the Beat, clicks, landings, revivals.
  for (int i = 0; i < 12; i++) {
    if (i >= uWaveCount) break;
    vec4 a = uWaveA[i];
    vec4 b = uWaveB[i];
    int k = int(b.x + 0.5);
    vec4 k0 = WAVE_K0[k];
    vec4 k1 = WAVE_K1[k];
    float age = a.z;
    float r = age * k0.x;
    float w = k0.y + k0.z * age;
    float x = length(c - a.xy) - r;
    float front = exp(-(x * x) / (w * w));
    float trail = x < 0.0 ? 0.3 * cos(x * 1.9 / (0.6 + w * 0.4)) * exp(x / (w * 2.6)) : 0.0;
    float env = (1.0 - exp(-age * 16.0)) * (1.0 - smoothstep(k1.x * 0.45, k1.x, age));
    float v = (front + trail) * env / (1.0 + 0.02 * r) * a.w;
    lift += v * k0.w;
    float hv = max(v, 0.0) * k1.y;
    heat += hv;
    tint += uTints[int(b.y + 0.5)] * hv;
  }

  // The pointer lifts cells like a hand over keys.
  {
    float d = length(c - uCursor.xy);
    float f = 1.0 - smoothstep(0.0, uCursor.w, d);
    f = f * f * (3.0 - 2.0 * f);
    float v = f * uCursor.z * (0.8 + 0.4 * rnd);
    lift += v * 0.9;
    heat += v * 0.75;
  }

  // The cell's own light, pooled on the bench beneath it.
  float dc = length(c - uCell.xz);
  float pool = exp(-(dc * dc) / (uCell.w * uCell.w)) * uCellGlow;

  float scale = smoothstep(0.0, 0.3, ig) * (1.0 - hidden);
  float yTop = (h + lift) * smoothstep(0.0, 0.5, ig);
  float kind = aMeta.x;
  vec3 wp;
  wp.xz = c + position.xz * (uSize * scale);
  if (kind > 1.5) {
    // Walls hang from the bevel foot to the bench plane.
    wp.y = mix(yTop - uBevelDrop, 0.0, aMeta.y) * scale;
  } else {
    wp.y = (yTop + position.y * uSize) * scale;
  }

  // Patchy light: some seams burn bright, others are nearly dark, in loose drifting patches.
  float pn = vnoise(c * 0.055 + vec2(uTime * 0.007, 0.0)) * 0.6 + vnoise(c * 0.19 - vec2(0.0, uTime * 0.013)) * 0.4;
  float seam = 0.2 + 1.3 * smoothstep(0.3, 0.72, pn);

  vWorld = wp;
  vNrm = normal;
  vMeta = vec4(kind, aMeta.y, rnd, heat);
  vC = vec4(pool, pop, ig, seam);
  vTint = tint;
  vBake = aTint.rgb;
  vLocal = position.xz;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}

uniform vec3 uAccent;
uniform vec3 uAccentHot;
uniform vec3 uAccentCore;
uniform vec3 uHaze;
uniform float uGlow;
uniform float uFogScale;
uniform float uBeat;
uniform float uSize;
uniform float uTopApothem;

varying vec3 vWorld;
varying vec3 vNrm;
varying vec4 vMeta;
varying vec4 vC;
varying vec3 vTint;
varying vec3 vBake;
varying vec2 vLocal;

// Pointy-top hexagon distance: 0 at the centre, 1 on the edge of a hexagon with the given apothem.
float hexD(vec2 p, float apothem) {
  p = abs(p);
  float d = max(p.x, max(0.5 * p.x + 0.8660254 * p.y, -0.5 * p.x + 0.8660254 * p.y));
  return d / apothem;
}

void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec3 N = normalize(vNrm);
  float kind = vMeta.x;
  float rnd = vMeta.z;
  float heat = vMeta.w;
  float pool = vC.x;
  float pop = vC.y;
  float seam = vC.w;
  float rnd2 = fract(rnd * 37.17 + 0.31);

  float fogK = dist / uFogScale;
  float fog = 1.0 - exp(-fogK * fogK);
  // Level of detail from the pixel footprint: once a cell is only a couple of pixels wide its edges
  // cannot be drawn without shimmering, so they give way to their average glow.
  vec2 dw = fwidth(vWorld.xz);
  float lod = 1.0 - smoothstep(0.1 * uSize, 0.5 * uSize, dw.x + dw.y);

  vec3 fogCol = uHaze * 0.5;
  float tw = pow(0.5 + 0.5 * sin(uTime * (0.45 + rnd * 1.25) + rnd2 * 40.0), 22.0) * step(0.66, rnd2);
  vec3 tintAll = vBake * (0.55 + 0.9 * seam * 0.5) + vTint * 1.3;
  float edge = (0.14 + 0.7 * seam) * (0.55 + 0.9 * rnd);

  // What a small cell averages to: dark glass, a breath of the light from its gaps, nearby colour.
  float graze = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
  vec3 farCol = uAccent * (0.05 * (0.4 + seam) + 0.08 * heat + 0.12 * pool + 0.025 * uBeat)
    + vBake * 0.05 + vTint * 0.4 + uHaze * (0.5 * graze);

  vec3 col = vec3(0.0);
  if (kind < 0.5) {
    // Top face: dark glass with a faint sheen toward the horizon.
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float fres = 0.05 + 0.95 * pow(1.0 - ndv, 4.0);
    col = vec3(0.0016, 0.0042, 0.0105) + uHaze * 0.9 * fres * (0.4 + 0.8 * rnd);
    float hd = hexD(vLocal, uTopApothem);
    float rim = smoothstep(0.58, 1.0, hd);
    vec3 glass = mix(uAccent, uAccentHot, clamp(heat, 0.0, 1.0));
    col += (glass * (0.16 * edge + 0.9 * heat + 0.45 * pool + 0.5 * uBeat) + tintAll * (0.7 + heat)) * rim * lod;
    col += (uAccentHot * 0.16 + tintAll * 0.14) * heat * (1.0 - rim);
    col += uAccent * (0.012 * seam + 0.05 * pool) * (1.0 - rim) * lod;
    col += uAccentHot * pop * 0.3;
    col += uAccentHot * tw * 0.35 * (1.0 - rim);
    col = mix(farCol, col, lod);
  } else if (kind < 1.5) {
    // Bevel: the cut edge that catches the light.
    float facing = pow(clamp(dot(N, V), 0.0, 1.0), 0.6);
    vec3 base = mix(uAccent, uAccentHot, clamp(0.25 + 0.7 * heat, 0.0, 1.0));
    float e = 0.34 * edge + 1.15 * heat + 0.95 * pool + 0.45 * uBeat;
    col = base * e * (0.55 + 0.45 * facing);
    col += tintAll * (0.9 + heat) * (0.5 + facing);
    col += uAccentHot * tw * 0.9;
    col += uAccentHot * pop * 0.6;
    col = mix(farCol, col, lod);
  } else {
    // Wall: light leaking up through the gaps, brightest where the cell meets the bench plane and along
    // the cut edge at the top.
    float yn = max(vWorld.y, 0.0) / uSize;
    float foot = exp(-yn * 1.35);
    float topEdge = exp(-vMeta.y * 6.0);
    vec3 base = mix(uAccent, uAccentHot, clamp(0.3 + 0.7 * foot, 0.0, 1.0));
    float e = 0.02 + foot * (0.85 * edge + 1.0 * pool + 0.95 * heat + 0.3 * uBeat)
      + topEdge * (0.22 * edge + 0.55 * heat + 0.4 * pool);
    col = base * e * (0.6 + 0.4 * rnd);
    col += tintAll * (foot * 0.9 + topEdge * 0.4) * (0.8 + heat);
    col += uAccentHot * tw * 0.5 * topEdge;
    col += uAccentHot * pop * 0.6 * foot;
    col += vec3(0.002, 0.006, 0.016) * (1.0 - foot);
    col = mix(farCol, col, lod);
  }

  col *= uGlow;
  col = mix(col, fogCol * (0.2 + 0.8 * uGlow), fog);
  gl_FragColor = vec4(finish(col), 1.0);
}
`;

export class TerrainMesh {
  readonly mesh: Mesh;
  readonly uniforms: {
    uSize: { value: number };
    uBevelDrop: { value: number };
    uTopApothem: { value: number };
  };
  private geometry: InstancedBufferGeometry;
  private readonly material: ShaderMaterial;
  private triPerCell = 0;

  constructor(shared: SharedUniforms) {
    const prism = buildTerrainPrism({ radius: RADIUS, bevel: BEVEL, bevelDrop: BEVEL_DROP });
    this.triPerCell = prism.index.length / 3;
    this.geometry = new InstancedBufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(prism.position, 3));
    this.geometry.setAttribute('normal', new BufferAttribute(prism.normal, 3));
    this.geometry.setAttribute('aMeta', new BufferAttribute(prism.meta, 4));
    this.geometry.setIndex(new BufferAttribute(prism.index, 1));
    this.geometry.instanceCount = 0;
    this.uniforms = {
      uSize: { value: 1 },
      uBevelDrop: { value: BEVEL_DROP },
      uTopApothem: { value: RADIUS * (SQRT3 / 2) - BEVEL },
    };
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...shared, ...this.uniforms },
      depthTest: true,
      depthWrite: true,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
  }

  get count(): number {
    return this.geometry.instanceCount ?? 0;
  }

  get triangles(): number {
    return this.count * this.triPerCell;
  }

  /** Uploads the bench's cells and what the pillars cast on them (hidden cells and baked tint). */
  setTerrain(bench: Bench, f: WorldFrame, cast: CellCast | null): void {
    const c = bench.cells;
    const cells = new Float32Array(c.count * 4);
    const tint = new Float32Array(c.count * 4);
    for (let i = 0; i < c.count; i++) {
      cells[i * 4] = worldX(f, c.x[i]!);
      cells[i * 4 + 1] = worldZ(f, c.y[i]!);
      cells[i * 4 + 2] = c.h[i]! * f.scale * RELIEF;
      cells[i * 4 + 3] = hash2(c.col[i]! * 7 + 1, c.row[i]! * 13 + 5);
      if (cast) {
        tint[i * 4] = cast.tint[i * 3]!;
        tint[i * 4 + 1] = cast.tint[i * 3 + 1]!;
        tint[i * 4 + 2] = cast.tint[i * 3 + 2]!;
        tint[i * 4 + 3] = cast.hidden[i]!;
      }
    }
    this.geometry.setAttribute('aCell', new InstancedBufferAttribute(cells, 4));
    this.geometry.setAttribute('aTint', new InstancedBufferAttribute(tint, 4));
    this.geometry.instanceCount = c.count;
    this.uniforms.uSize.value = f.cell;
    this.uniforms.uBevelDrop.value = BEVEL_DROP * f.cell;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
