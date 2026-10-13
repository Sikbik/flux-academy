// The quiet parts of the bench: the glow the continents throw on the plane they stand on, the blueprint
// hairlines that frame it, and the chain strip, a short row of blocks along the east edge where the
// spec's hash is stamped. All additive, all cheap, none of them interactive.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LineSegments,
  Mesh,
  PlaneGeometry,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
} from 'three';
import type { ChainModel } from '../lib/chain';
import { waveTablesGlsl } from '../lib/waves';
import { GLSL_COMMON, GLSL_FINISH } from './glsl';
import type { SharedUniforms } from './uniforms';

// ---------------------------------------------------------------------------
// Floor
// ---------------------------------------------------------------------------

/** The floor extends this far past the land on every side, world units. */
const FLOOR_MARGIN = 9;
const FIELD_W = 384;
const FIELD_H = 168;

const FLOOR_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
}
`;

const FLOOR_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
${waveTablesGlsl()}
uniform sampler2D tField;
uniform vec3 uAccent;
uniform vec3 uAccentHot;
uniform vec3 uHaze;
uniform float uGlow;
uniform float uBeat;
uniform float uMotion;
uniform float uFogScale;
uniform float uFloorGain;
uniform int uWaveCount;
uniform vec4 uWaveA[12];
uniform vec4 uWaveB[12];
uniform vec3 uTints[7];
uniform vec4 uCell;
uniform float uCellGlow;
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  float g = texture2D(tField, vUv).r;
  float n = vnoise(vWorld.xz * 0.11 + vec2(uTime * 0.012 * uMotion, 0.0));
  float n2 = vnoise(vWorld.xz * 0.37 - vec2(0.0, uTime * 0.02 * uMotion));
  float seam = 0.55 + 0.7 * smoothstep(0.3, 0.75, n * 0.65 + n2 * 0.35);
  float heat = 0.0;
  vec3 tint = vec3(0.0);
  vec2 c = vWorld.xz;
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
    float env = (1.0 - exp(-age * 16.0)) * (1.0 - smoothstep(k1.x * 0.45, k1.x, age));
    float v = front * env / (1.0 + 0.02 * r) * a.w * k1.y;
    heat += v;
    tint += uTints[int(b.y + 0.5)] * v;
  }
  float dc = length(c - uCell.xz);
  float pool = exp(-(dc * dc) / (uCell.w * uCell.w * 1.8)) * uCellGlow;
  vec3 col = uAccent * g * (0.028 * seam + 0.06 * pool) * uFloorGain;
  col += (uAccentHot * 0.5 + tint) * g * heat * 0.25;
  col += uAccentHot * g * uBeat * 0.05;
  col *= uGlow;
  float d = length(vWorld - cameraPosition) / uFogScale;
  col *= 1.0 - (1.0 - exp(-d * d)) * 0.85;
  gl_FragColor = vec4(finish(col), 1.0);
}
`;

export class FloorMesh {
  readonly mesh: Mesh;
  readonly uniforms: { uFloorGain: { value: number } };
  private readonly texture: DataTexture;
  private readonly geometry: PlaneGeometry;
  private readonly material: ShaderMaterial;
  private readonly field = new Uint8Array(FIELD_W * FIELD_H);
  private floorW = 140;
  private floorD = 70;

  constructor(shared: SharedUniforms) {
    this.texture = new DataTexture(this.field, FIELD_W, FIELD_H, RedFormat, UnsignedByteType);
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    this.geometry = new PlaneGeometry(1, 1, 1, 1);
    this.geometry.rotateX(-Math.PI / 2);
    this.uniforms = { uFloorGain: { value: 1 } };
    this.material = new ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      uniforms: { ...shared, ...this.uniforms, tField: { value: this.texture } },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.position.y = -0.02;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  /** Rasterises the cell centres (world x, z), blurs them, and uploads the soft land glow. */
  setCells(
    xs: Float32Array,
    zs: Float32Array,
    count: number,
    size: number,
    halfW: number,
    halfD: number,
  ): void {
    const w = FIELD_W;
    const h = FIELD_H;
    this.floorW = halfW * 2 + FLOOR_MARGIN * 2;
    this.floorD = halfD * 2 + FLOOR_MARGIN * 2;
    this.mesh.scale.set(this.floorW, 1, this.floorD);
    const a = new Float32Array(w * h);
    const sx = w / this.floorW;
    const sz = h / this.floorD;
    for (let i = 0; i < count; i++) {
      const fx = (xs[i]! + this.floorW / 2) * sx;
      const fz = (zs[i]! + this.floorD / 2) * sz;
      const x0 = Math.floor(fx);
      const z0 = Math.floor(fz);
      const dx = fx - x0;
      const dz = fz - z0;
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          const xx = x0 + k;
          const zz = z0 + j;
          if (xx < 0 || zz < 0 || xx >= w || zz >= h) continue;
          a[zz * w + xx]! += (k ? dx : 1 - dx) * (j ? dz : 1 - dz);
        }
      }
    }
    // A gaussian-ish blur: three box passes in each direction.
    const radius = Math.max(2, Math.round(size * 1.6 * sx));
    const tmp = new Float32Array(w * h);
    for (let pass = 0; pass < 3; pass++) {
      boxBlur(a, tmp, w, h, radius, true);
      boxBlur(tmp, a, w, h, radius, false);
    }
    let max = 0;
    for (let i = 0; i < a.length; i++) if (a[i]! > max) max = a[i]!;
    const k = max > 0 ? 1 / (max * 0.62) : 1;
    for (let i = 0; i < a.length; i++) this.field[i] = Math.round(Math.min(1, a[i]! * k) * 255);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

function boxBlur(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  r: number,
  horizontal: boolean,
): void {
  const inv = 1 / (2 * r + 1);
  if (horizontal) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))]!;
      for (let x = 0; x < w; x++) {
        dst[y * w + x] = sum * inv;
        sum += src[y * w + Math.min(w - 1, x + r + 1)]! - src[y * w + Math.max(0, x - r)]!;
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += src[Math.min(h - 1, Math.max(0, y)) * w + x]!;
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = sum * inv;
        sum += src[Math.min(h - 1, y + r + 1) * w + x]! - src[Math.max(0, y - r) * w + x]!;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Frame: blueprint hairlines around the bench
// ---------------------------------------------------------------------------

const FRAME_VERT = /* glsl */ `
varying vec3 vWorld;
varying float vK;
attribute float aK;     // 0 hairline, 1 tick, 2 corner
void main() {
  vWorld = position;
  vK = aK;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

const FRAME_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
${waveTablesGlsl()}
uniform vec3 uAccent;
uniform vec3 uAccentHot;
uniform float uGlow;
uniform float uBeat;
uniform float uFogScale;
uniform float uFrameGain;
uniform int uWaveCount;
uniform vec4 uWaveA[12];
uniform vec4 uWaveB[12];
varying vec3 vWorld;
varying float vK;

void main() {
  float heat = 0.0;
  vec2 c = vWorld.xz;
  for (int i = 0; i < 12; i++) {
    if (i >= uWaveCount) break;
    vec4 a = uWaveA[i];
    vec4 b = uWaveB[i];
    int k = int(b.x + 0.5);
    vec4 k0 = WAVE_K0[k];
    vec4 k1 = WAVE_K1[k];
    float age = a.z;
    float r = age * k0.x;
    float w = (k0.y + k0.z * age) * 1.6;
    float x = length(c - a.xy) - r;
    float env = (1.0 - exp(-age * 16.0)) * (1.0 - smoothstep(k1.x * 0.45, k1.x, age));
    heat += exp(-(x * x) / (w * w)) * env * a.w;
  }
  float base = vK > 1.5 ? 0.55 : (vK > 0.5 ? 0.4 : 0.26);
  vec3 col = mix(uAccent, uAccentHot, 0.35) * base * (1.0 + 2.6 * uBeat + 2.2 * heat) * uFrameGain;
  col *= uGlow;
  float d = length(vWorld - cameraPosition) / uFogScale;
  col *= 1.0 - (1.0 - exp(-d * d)) * 0.8;
  gl_FragColor = vec4(finish(col), 1.0);
}
`;

export class FrameLines {
  readonly lines: LineSegments;
  readonly uniforms: { uFrameGain: { value: number } };
  private geometry: BufferGeometry;
  private readonly material: ShaderMaterial;

  constructor(shared: SharedUniforms) {
    this.geometry = new BufferGeometry();
    this.uniforms = { uFrameGain: { value: 1 } };
    this.material = new ShaderMaterial({
      vertexShader: FRAME_VERT,
      fragmentShader: FRAME_FRAG,
      uniforms: { ...shared, ...this.uniforms },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.lines = new LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 5;
    this.setBounds(60, 25);
  }

  /** Lays the hairlines around a bench of the given half extents (world units). */
  setBounds(halfW: number, halfD: number): void {
    const pos: number[] = [];
    const kind: number[] = [];
    const seg = (x0: number, z0: number, x1: number, z1: number, k: number) => {
      pos.push(x0, 0.02, z0, x1, 0.02, z1);
      kind.push(k, k);
    };
    const hx = halfW + 5;
    const hz = halfD + 4.5;
    const gap = 14;
    // Long hairlines on the four sides with a gap at the middle of the near and far edges.
    seg(-hx, hz, -gap, hz, 0);
    seg(gap, hz, hx, hz, 0);
    seg(-hx, -hz, -gap, -hz, 0);
    seg(gap, -hz, hx, -hz, 0);
    seg(-hx, -hz, -hx, hz, 0);
    seg(hx, -hz, hx, hz, 0);
    // Tick rulers along the near edge and the west edge.
    for (let x = -hx; x <= hx + 0.01; x += 5) {
      const major = Math.abs(((x + hx) / 5) % 4) < 0.01;
      if (Math.abs(x) < gap) continue;
      seg(x, hz, x, hz + (major ? 1.7 : 0.9), 1);
    }
    for (let z = -hz; z <= hz + 0.01; z += 5) {
      const major = Math.abs(((z + hz) / 5) % 4) < 0.01;
      seg(-hx, z, -hx - (major ? 1.7 : 0.9), z, 1);
    }
    // Corner crosshairs.
    for (const [cx, cz] of [
      [-hx, -hz],
      [hx, -hz],
      [-hx, hz],
      [hx, hz],
    ] as const) {
      seg(cx - 2.4, cz, cx + 2.4, cz, 2);
      seg(cx, cz - 2.4, cx, cz + 2.4, 2);
    }
    // A dimension line under the bench with end ticks.
    const dz = hz + 5.5;
    const dx = halfW * 0.6;
    seg(-dx, dz, dx, dz, 0);
    seg(-dx, dz - 1.2, -dx, dz + 1.2, 2);
    seg(dx, dz - 1.2, dx, dz + 1.2, 2);

    const next = new BufferGeometry();
    next.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    next.setAttribute('aK', new BufferAttribute(new Float32Array(kind), 1));
    this.geometry.dispose();
    this.geometry = next;
    this.lines.geometry = next;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------
// Chain strip
// ---------------------------------------------------------------------------

const BLOCK_W = 3.2;
const BLOCK_H = 1.1;
const BLOCK_D = 3.0;

const BLOCK_VERT = /* glsl */ `
${GLSL_COMMON}
attribute vec4 aB;      // x, z, lit (0..1), stamped (0..1)
attribute vec4 aB2;     // seed, flash, ring, spare
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNrm;
varying vec2 vUv;
varying vec4 vB;
varying vec4 vB2;
varying vec3 vLocal;

void main() {
  vec3 p = position;
  float lift = aB.w * 0.35 + aB2.y * 0.25;
  vec3 wp = vec3(aB.x + p.x, p.y + ${(BLOCK_H / 2).toFixed(3)} + lift, aB.y + p.z);
  vWorld = wp;
  vNrm = normal;
  vUv = uv;
  vB = aB;
  vB2 = aB2;
  vLocal = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const BLOCK_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
uniform vec3 uAccent;
uniform vec3 uAccentHot;
uniform vec3 uAccentCore;
uniform float uGlow;
uniform float uBeat;
uniform float uFogScale;
varying vec3 vWorld;
varying vec3 vNrm;
varying vec2 vUv;
varying vec4 vB;
varying vec4 vB2;
varying vec3 vLocal;

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNrm);
  float lit = vB.z;
  float stamped = vB.w;
  float flash = vB2.y;
  float ring = vB2.z;
  float fres = pow(1.0 - abs(dot(N, V)), 2.0);
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = min(e.x, e.y);
  float hot = 1.0 - smoothstep(0.0, 0.07, edge);
  float soft = 1.0 - smoothstep(0.0, 0.3, edge);
  vec3 col = uAccent * (0.02 + 0.22 * fres) * (0.4 + lit);
  col += uAccent * soft * 0.1 * (0.3 + lit);
  col += (mix(uAccent, uAccentHot, 0.6) * 1.1 + vec3(0.12)) * hot * (0.22 + 0.9 * lit);
  // The top face carries the stamp: a four by four identicon in light, drawn once it is stamped.
  if (N.y > 0.5) {
    vec2 q = (vLocal.xz / vec2(${BLOCK_W.toFixed(3)}, ${BLOCK_D.toFixed(3)}) + 0.5) * 4.0;
    vec2 cell = floor(q);
    vec2 sym = vec2(abs(cell.x - 1.5) - 0.5, cell.y);
    float bit = step(0.5, hash21(sym + vB2.x * 17.0));
    vec2 f = fract(q) - 0.5;
    float tile = (1.0 - smoothstep(0.34, 0.42, max(abs(f.x), abs(f.y)))) * bit;
    col += (uAccent * 0.9 + uAccentHot * 0.6) * tile * stamped * (0.7 + 0.3 * sin(uTime * 1.6 + cell.x + cell.y));
  }
  col += (uAccentCore * 1.4) * (hot * 1.2 + soft * 0.25 + 0.05) * flash;
  col += (uAccentHot * 1.1 + vec3(0.4)) * (hot * 1.4 + soft * 0.3) * ring;
  col *= 1.0 + uBeat * 0.8 * lit;
  col *= uGlow;
  float d = length(vWorld - cameraPosition) / uFogScale;
  col *= 1.0 - (1.0 - exp(-d * d)) * 0.8;
  gl_FragColor = vec4(finish(col), 1.0);
}
`;

export class ChainStrip {
  readonly mesh: Mesh;
  private readonly b: InstancedBufferAttribute;
  private readonly b2: InstancedBufferAttribute;
  private readonly geometry: InstancedBufferGeometry;
  private readonly material: ShaderMaterial;
  private x = 70;
  private headZ = 22;
  private step = 4.1;

  constructor(
    shared: SharedUniforms,
    readonly count: number,
  ) {
    const box = new BoxGeometry(BLOCK_W, BLOCK_H, BLOCK_D);
    this.geometry = new InstancedBufferGeometry();
    this.geometry.setAttribute('position', box.getAttribute('position'));
    this.geometry.setAttribute('normal', box.getAttribute('normal'));
    this.geometry.setAttribute('uv', box.getAttribute('uv'));
    this.geometry.setIndex(box.getIndex());
    this.b = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.b2 = new InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.b.setUsage(35048);
    this.b2.setUsage(35048);
    this.geometry.setAttribute('aB', this.b);
    this.geometry.setAttribute('aB2', this.b2);
    this.geometry.instanceCount = count;
    this.material = new ShaderMaterial({
      vertexShader: BLOCK_VERT,
      fragmentShader: BLOCK_FRAG,
      uniforms: { ...shared },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  setLayout(x: number, headZ: number, step: number): void {
    this.x = x;
    this.headZ = headZ;
    this.step = step;
  }

  /** World position of a block of `age`, `slide` slots from where it will rest (the head arrives from the front). */
  slot(age: number, slide: number, out: { x: number; z: number }): { x: number; z: number } {
    out.x = this.x;
    out.z = this.headZ - (age - slide) * this.step;
    return out;
  }

  /** Writes every block's state to the GPU. `visible` scales the brightness (0 hides the strip). */
  upload(model: ChainModel, visible: number): void {
    const b = this.b.array as Float32Array;
    const b2 = this.b2.array as Float32Array;
    const tmp = { x: 0, z: 0 };
    for (let i = 0; i < this.count; i++) {
      const blk = model.blocks[i];
      if (!blk) continue;
      this.slot(i, model.slide, tmp);
      b[i * 4] = tmp.x;
      b[i * 4 + 1] = tmp.z;
      b[i * 4 + 2] = blk.lit * visible;
      b[i * 4 + 3] = blk.stamped * visible;
      b2[i * 4] = blk.seed;
      b2[i * 4 + 1] = blk.flash * visible;
      b2[i * 4 + 2] = blk.ring * visible;
      b2[i * 4 + 3] = 0;
    }
    this.b.needsUpdate = true;
    this.b2.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
