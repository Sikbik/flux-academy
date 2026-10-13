// Dust and bokeh: GPU point sprites drifting through a box around the bench. The hexagonal soft disc is
// generated in the fragment shader, so the scene needs no image to look right; when the art pipeline has
// produced `sprite-bokeh` it is used as the sprite instead. Motion is entirely in the vertex shader.
// Adapted from fluxcommunity/web/src/stage/engine/dust.ts (same owner, MIT).

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  type Texture,
  Vector3,
} from 'three';
import { mulberry32 } from '../lib/math';
import { GLSL_COMMON, GLSL_FINISH } from './glsl';
import type { SharedUniforms } from './uniforms';

const VERT = /* glsl */ `
${GLSL_COMMON}
uniform float uTime;
uniform float uMotion;
uniform float uDpr;
uniform vec3 uBox;
uniform vec3 uBoxC;
uniform vec4 uCell;
uniform float uSize;
uniform float uFade;
attribute vec4 aDust;       // xyz in 0..1 box, w = seed
varying vec4 vDust;         // brightness, hue mix, seed, depth

void main() {
  float s = aDust.w;
  float t = uTime * uMotion;
  vec3 p = (aDust.xyz - 0.5) * uBox + uBoxC;
  // A slow upward drift with a per-particle sway, wrapped through the height of the box.
  float rise = t * (0.18 + 0.5 * hash11(s * 91.7));
  p.y = uBoxC.y - uBox.y * 0.5 + mod(aDust.y * uBox.y + rise, uBox.y);
  p.x += sin(t * 0.21 + s * 40.0) * 0.9;
  p.z += cos(t * 0.17 + s * 23.0) * 0.8;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  float nearFade = smoothstep(14.0, 40.0, depth);
  float farFade = 1.0 - smoothstep(110.0, 190.0, depth);
  float vert = smoothstep(0.0, 0.18, (p.y - (uBoxC.y - uBox.y * 0.5)) / uBox.y) *
    (1.0 - smoothstep(0.7, 1.0, (p.y - (uBoxC.y - uBox.y * 0.5)) / uBox.y));
  float flick = 0.6 + 0.4 * sin(t * (0.4 + hash11(s * 7.3) * 1.2) + s * 50.0);
  float bri = (0.3 + 0.7 * hash11(s * 13.1)) * flick;
  // Dust near the cell catches its light.
  float dc = length(p - uCell.xyz);
  float near = 1.0 + 1.6 * exp(-(dc * dc) / 120.0);
  vDust = vec4(bri * nearFade * farFade * vert * uFade * near, hash11(s * 5.5), s, depth);
  float size = uSize * (0.45 + 1.2 * hash11(s * 3.3));
  gl_PointSize = clamp(size * uDpr * 190.0 / max(depth, 1.0), 1.0, 44.0 * uDpr);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
uniform vec3 uAccent;
uniform vec3 uAccentHot;
uniform vec3 uAccentCore;
uniform sampler2D tSprite;
uniform float uSprite;
varying vec4 vDust;

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float a;
  if (uSprite > 0.5) {
    a = texture2D(tSprite, gl_PointCoord).r * 0.9;
  } else {
    // A rounded hexagon: soft disc with a brighter rim, like a bokeh blade shape.
    vec2 q = abs(p);
    float hx = max(q.x * 0.8660254 + q.y * 0.5, q.y);
    float body = 1.0 - smoothstep(0.5, 1.0, hx);
    float rim = smoothstep(0.62, 0.9, hx) * (1.0 - smoothstep(0.9, 1.02, hx));
    a = body * 0.4 + rim * 0.6;
  }
  if (a < 0.003) discard;
  vec3 c = mix(uAccentHot, uAccentCore, step(0.84, vDust.y) * 0.8 + 0.1);
  c = mix(uAccent * 1.5, c, 0.55 + 0.45 * vDust.y);
  gl_FragColor = vec4(finish(c * a * vDust.x * 0.8), 1.0);
}
`;

export class DustMesh {
  readonly points: Points;
  readonly uniforms: {
    uBox: { value: Vector3 };
    uBoxC: { value: Vector3 };
    uSize: { value: number };
    uFade: { value: number };
    tSprite: { value: Texture | null };
    uSprite: { value: number };
  };
  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;

  constructor(shared: SharedUniforms, max: number) {
    const rand = mulberry32(0x5eed);
    const a = new Float32Array(max * 4);
    for (let i = 0; i < a.length; i++) a[i] = rand();
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(new Float32Array(max * 3), 3));
    this.geometry.setAttribute('aDust', new BufferAttribute(a, 4));
    this.geometry.setDrawRange(0, 0);
    this.uniforms = {
      uBox: { value: new Vector3(150, 34, 90) },
      uBoxC: { value: new Vector3(0, 15, 0) },
      uSize: { value: 1 },
      uFade: { value: 1 },
      tSprite: { value: null },
      uSprite: { value: 0 },
    };
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...shared, ...this.uniforms },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 11;
  }

  setCount(n: number): void {
    this.geometry.setDrawRange(0, Math.max(0, Math.floor(n)));
  }

  get count(): number {
    return this.geometry.drawRange.count === Number.POSITIVE_INFINITY ? 0 : this.geometry.drawRange.count;
  }

  setSprite(tex: Texture | null): void {
    this.uniforms.tSprite.value = tex;
    this.uniforms.uSprite.value = tex ? 1 : 0;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
