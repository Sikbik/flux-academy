// Ribbons: the light arcs (launches, tethers, request packets) as camera-facing strips. The path maths and
// the strip builder are pure (lib/arcs.ts); this module owns the dynamic buffer they are written into and
// the additive material that draws them. Ribbons are rebuilt every frame from their paths, so a path may
// change freely (a packet re-routed in flight) without any bookkeeping on the GPU side.

import {
  AdditiveBlending,
  BufferGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  ShaderMaterial,
} from 'three';
import {
  type ArcPath,
  buildRibbonIndex,
  RIBBON_SEGMENTS,
  RIBBON_STRIDE,
  RIBBON_VERTS,
  type RibbonStyle,
  writeRibbon,
} from '../lib/arcs';
import { GLSL_COMMON, GLSL_FINISH } from './glsl';
import type { SharedUniforms } from './uniforms';

export const MAX_RIBBONS = 56;

const VERT = /* glsl */ `
attribute vec2 aUv;     // across -1..1, along (the path parameter)
attribute vec4 aCol;    // rgb, alpha
varying vec2 vUv;
varying vec4 vCol;
void main() {
  vUv = aUv;
  vCol = aCol;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
uniform float uGlow;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  float x = vUv.x;
  float core = exp(-x * x * 26.0);
  float halo = exp(-x * x * 3.4);
  vec3 c = vCol.rgb * (0.5 * halo + 1.1 * core) + vec3(1.0) * core * core * 0.6;
  c *= vCol.a * uGlow;
  if (max(c.r, max(c.g, c.b)) < 0.002) discard;
  gl_FragColor = vec4(finish(c), 1.0);
}
`;

export class RibbonMesh {
  readonly mesh: Mesh;
  count = 0;
  private readonly buffer: InterleavedBuffer;
  private readonly data: Float32Array;
  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;

  constructor(shared: SharedUniforms) {
    this.data = new Float32Array(MAX_RIBBONS * RIBBON_VERTS * RIBBON_STRIDE);
    this.buffer = new InterleavedBuffer(this.data, RIBBON_STRIDE);
    this.buffer.setUsage(35048);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new InterleavedBufferAttribute(this.buffer, 3, 0));
    this.geometry.setAttribute('aUv', new InterleavedBufferAttribute(this.buffer, 2, 3));
    this.geometry.setAttribute('aCol', new InterleavedBufferAttribute(this.buffer, 4, 5));
    this.geometry.setIndex(Array.from(buildRibbonIndex(MAX_RIBBONS)));
    this.geometry.setDrawRange(0, 0);
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...shared },
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
  }

  begin(): void {
    this.count = 0;
  }

  /** Adds one ribbon. Returns false when the buffer is full. */
  add(path: ArcPath, style: RibbonStyle, camX: number, camY: number, camZ: number): boolean {
    if (this.count >= MAX_RIBBONS) return false;
    writeRibbon(this.data, this.count * RIBBON_VERTS, path, style, camX, camY, camZ);
    this.count++;
    return true;
  }

  end(): void {
    this.geometry.setDrawRange(0, this.count * RIBBON_SEGMENTS * 6);
    this.buffer.needsUpdate = true;
    this.mesh.visible = this.count > 0;
  }

  get triangles(): number {
    return this.count * RIBBON_SEGMENTS * 2;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
