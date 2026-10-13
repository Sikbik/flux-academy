// The specimen: a glass hexagonal prism, "the cell", one app. Inside it floats a stack of thin layer
// slabs; on its side three gauge arcs show CPU, RAM and disk; motes rise through it. The copies that
// leave it on launch (and hover above the pillars that host them) are the same glass prism, smaller.
//
// Everything glass is additive: edges are bright, faces are a breath of colour, and the bloom does the
// rest. One instanced draw covers the shell, the slabs and every copy.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Points,
  ShaderMaterial,
  Vector3,
  Vector4,
} from 'three';
import { mulberry32 } from '../lib/math';
import { buildGlassPrism } from '../world/prism';
import { GLSL_COMMON, GLSL_FINISH } from './glsl';
import type { SharedUniforms } from './uniforms';

export const SLAB_COUNT = 5;
export const MAX_COPIES = 12;
const FIRST_SLAB = 1;
const FIRST_COPY = FIRST_SLAB + SLAB_COUNT;
const TOTAL = FIRST_COPY + MAX_COPIES;

/** Cell proportions: radius is the instance scale, the height is `aspect` radii. */
export const CELL_ASPECT = 1.7;

const GLASS_VERT = /* glsl */ `
${GLSL_COMMON}
attribute vec4 aMeta;   // kind (0 cap, 2 wall), v up the face, u along the edge
attribute vec4 aXf;     // x, y, z, scale (circumradius)
attribute vec4 aSt;     // yaw, aspect (height / radius), style (0 shell, 1 slab, 2 copy), intensity
attribute vec4 aSt2;    // tier colour index (-1 accent), flash, alive, phase

varying vec3 vWorld;
varying vec3 vNrm;
varying vec4 vMeta;
varying vec4 vSt;
varying vec4 vSt2;
varying vec2 vLocal;

void main() {
  float s = aXf.w;
  vec3 p = position;
  float yaw = aSt.x;
  float cy = cos(yaw);
  float sy = sin(yaw);
  vec3 q = vec3(p.x * s, p.y * s * aSt.y, p.z * s);
  vec3 r = vec3(q.x * cy + q.z * sy, q.y, -q.x * sy + q.z * cy);
  vec3 n = normal;
  vec3 nr = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);
  vec3 wp = aXf.xyz + r;
  vWorld = wp;
  vNrm = nr;
  vMeta = aMeta;
  vSt = aSt;
  vSt2 = aSt2;
  vLocal = position.xz;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const GLASS_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
uniform vec3 uAccent;
uniform vec3 uAccentHot;
uniform vec3 uAccentCore;
uniform vec3 uTier[4];
uniform float uGlow;
uniform float uBeat;
uniform float uBuild;       // 0..1: the cell forms (describe chapter)
uniform float uCharge;      // 0..1: the launch charge-up
uniform float uMotion;

varying vec3 vWorld;
varying vec3 vNrm;
varying vec4 vMeta;
varying vec4 vSt;
varying vec4 vSt2;
varying vec2 vLocal;

float hexD(vec2 p, float apothem) {
  p = abs(p);
  float d = max(p.x, max(0.5 * p.x + 0.8660254 * p.y, -0.5 * p.x + 0.8660254 * p.y));
  return d / apothem;
}

void main() {
  float style = vSt.z;
  float intensity = vSt.w;
  if (intensity < 0.004) discard;
  float aspect = vSt.y;
  float flash = vSt2.y;
  float alive = vSt2.z;
  float phase = vSt2.w;
  vec3 tint = vSt2.x < -0.5 ? uAccentHot : uTier[int(vSt2.x + 0.5)];
  vec3 edgeCol = vSt2.x < -0.5 ? uAccentHot : mix(uTier[int(vSt2.x + 0.5)], vec3(1.0), 0.25);

  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNrm);
  bool front = gl_FrontFacing;
  if (!front) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.2);
  float kind = vMeta.x;
  float backK = front ? 1.0 : 0.3;

  // Distance to the nearest edge of the face, in units of the circumradius.
  float edge;
  float v01;
  if (kind < 1.0) {
    float hd = hexD(vLocal, 0.8660254);
    edge = (1.0 - hd) * 0.8660254;
    v01 = N.y > 0.0 ? 1.0 : 0.0;
  } else {
    float du = min(vMeta.z, 1.0 - vMeta.z);
    float dv = min(vMeta.y, 1.0 - vMeta.y) * aspect;
    edge = min(du, dv);
    v01 = vMeta.y;
  }
  float hot = 1.0 - smoothstep(0.0, 0.05, edge);
  float soft = 1.0 - smoothstep(0.0, 0.26, edge);
  vec3 col = vec3(0.0);

  if (style < 0.5) {
    // The shell: frosted glass. The build progress draws it up from the base.
    float reveal = smoothstep(0.0, 0.12, uBuild * 1.15 - (1.0 - v01) * 0.9 + 0.0);
    float frost = 0.75 + 0.5 * vnoise(vWorld.xz * 6.0 + vWorld.y * 5.0);
    float glint = pow(max(dot(reflect(-V, N), normalize(vec3(-0.5, 0.8, 0.45))), 0.0), 24.0);
    col += tint * (0.008 + 0.16 * fres) * frost;
    col += tint * soft * 0.1;
    col += (edgeCol * 1.35 + vec3(0.4)) * hot * (0.55 + 0.9 * v01);
    col += vec3(1.0) * hot * smoothstep(0.82, 1.0, v01) * 0.9;      // the bright top rim
    col += tint * exp(-v01 * 4.0) * 0.38 * (kind > 1.0 ? 1.0 : 0.0);  // light pooling at the base
    col += vec3(0.8, 0.9, 1.0) * glint * 0.35;
    col *= reveal;
    // The charge-up: the whole shell takes a breath of white before a launch.
    col += (tint * 0.6 + vec3(0.4)) * (hot * 1.3 + soft * 0.3) * uCharge;
    col *= backK;
  } else if (style < 1.5) {
    // A layer slab: a thin plate with a lit edge, a faint fill and a few sparkles.
    float hd = hexD(vLocal, 0.8660254);
    float fill = (kind < 1.0) ? 0.03 + 0.22 * pow(1.0 - clamp(hd, 0.0, 1.0), 1.8) : 0.0;
    // Data motes: a sparse grid of points that twinkle, not noise.
    vec2 gp = vLocal * 15.0 + phase * 7.0;
    vec2 gid = floor(gp);
    float gh = hash21(gid);
    vec2 jitter = (hash22(gid + 7.3) - 0.5) * 0.5;
    float gd = length(fract(gp) - 0.5 - jitter);
    float sp = step(0.74, gh) * (1.0 - smoothstep(0.0, 0.16, gd)) * (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + gh * 2.4) + gh * 40.0)));
    col += tint * fill;
    col += (edgeCol * 1.5 + vec3(0.2)) * hot * (0.7 + 0.5 * sin(uTime * 1.3 * uMotion + phase * 6.0));
    col += tint * soft * 0.25;
    col += vec3(0.75, 0.9, 1.0) * sp * 1.5 * (kind < 1.0 ? 1.0 : 0.0);
    col *= smoothstep(0.0, 0.2, uBuild * 1.0 - phase * 0.55);
    col += tint * uCharge * 0.6 * (hot + 0.3);
  } else {
    // A copy of the app: smaller, brighter, tinted by the pillar it is bound for.
    float frost = 0.8 + 0.4 * vnoise(vWorld.xz * 11.0);
    col += tint * (0.07 + 0.4 * fres) * frost;
    col += tint * soft * 0.4;
    col += (edgeCol * 1.7 + vec3(0.4)) * hot * (0.7 + 0.8 * v01);
    col += vec3(1.0) * hot * smoothstep(0.8, 1.0, v01) * 0.8;
    col *= backK;
  }

  // A copy whose node has failed goes dim and grey.
  float g = luma(col);
  col = mix(vec3(g) * 0.45, col, alive);
  col += (vec3(0.6, 0.8, 1.0) + tint * 0.5) * flash * (hot * 1.5 + soft * 0.35 + 0.1);
  col *= intensity * uGlow * (1.0 + 0.45 * uBeat);
  gl_FragColor = vec4(finish(col), 1.0);
}
`;

// Gauge arcs on one face: a dim track and a lit value, three of them stacked.
const GAUGE_VERT = /* glsl */ `
${GLSL_COMMON}
attribute vec2 aArc;     // x: which arc 0..2, y: angle position 0..1 along the arc
attribute float aSide;   // 0 inner edge, 1 outer edge
uniform vec4 uCellXf;    // x, y, z, radius
uniform float uCellYaw;
uniform float uCellAspect;
uniform float uBuild;
varying vec2 vArc;
varying float vSide;

void main() {
  float radius = uCellXf.w;
  float height = radius * uCellAspect;
  float arcR = radius * (0.25 + 0.05 * aSide);
  float ang = (aArc.y * 0.82 + 0.09) * TAU;
  // The arcs live on the face at 205 degrees from the cell's local x axis: flat on that wall.
  float face = 3.5779249;
  float cf = cos(face);
  float sf = sin(face);
  // wall plane: origin at the face centre pushed out by the apothem, spanned by the tangent and up
  float apo = radius * 0.8660254 + radius * 0.012;
  vec3 centre = vec3(cf * apo, (0.28 - aArc.x * 0.28) * height * 0.92, sf * apo);
  vec3 tang = vec3(-sf, 0.0, cf);
  float lx = cos(ang) * arcR;
  float ly = sin(ang) * arcR;
  vec3 local = centre + tang * lx + vec3(0.0, 1.0, 0.0) * ly;
  float cy = cos(uCellYaw);
  float sy = sin(uCellYaw);
  vec3 r = vec3(local.x * cy + local.z * sy, local.y, -local.x * sy + local.z * cy);
  vec3 wp = uCellXf.xyz + r;
  vArc = aArc;
  vSide = aSide;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const GAUGE_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
uniform vec3 uAccentHot;
uniform vec3 uGauge;      // fill of cpu, ram, disk
uniform float uGlow;
uniform float uBuild;
uniform float uCellAlpha;
varying vec2 vArc;
varying float vSide;

void main() {
  int k = int(vArc.x + 0.5);
  float value = k == 0 ? uGauge.x : (k == 1 ? uGauge.y : uGauge.z);
  float lit = step(vArc.y, value);
  float head = exp(-pow((vArc.y - value) / 0.035, 2.0));
  float across = 1.0 - abs(vSide * 2.0 - 1.0) * 0.4;
  vec3 col = uAccentHot * (0.16 + 1.7 * lit) * across + vec3(0.95) * head * 0.9;
  col *= smoothstep(0.1, 0.6, uBuild * 1.1 - float(k) * 0.12) * uCellAlpha * uGlow;
  gl_FragColor = vec4(finish(col), 1.0);
}
`;

const MOTE_VERT = /* glsl */ `
${GLSL_COMMON}
uniform vec4 uCellXf;
uniform float uCellYaw;
uniform float uCellAspect;
uniform float uTime;
uniform float uDpr;
uniform float uMotion;
uniform float uBuild;
attribute vec4 aMote;   // random xyz in 0..1, seed
varying float vA;

void main() {
  float radius = uCellXf.w;
  float height = radius * uCellAspect;
  float t = uTime * uMotion;
  float rise = fract(aMote.y + t * (0.025 + aMote.w * 0.03));
  vec2 xz = (aMote.xz * 2.0 - 1.0) * radius * 0.62;
  xz += vec2(sin(t * 0.6 + aMote.w * 30.0), cos(t * 0.5 + aMote.w * 20.0)) * radius * 0.05;
  float y = (rise - 0.5) * height * 0.92;
  float cy = cos(uCellYaw);
  float sy = sin(uCellYaw);
  vec3 r = vec3(xz.x * cy + xz.y * sy, y, -xz.x * sy + xz.y * cy);
  vec4 mv = viewMatrix * vec4(uCellXf.xyz + r, 1.0);
  float depth = max(-mv.z, 0.5);
  gl_PointSize = clamp(radius * 0.09 * uDpr * 780.0 / depth * (0.6 + aMote.w), 1.0, 9.0 * uDpr);
  float fade = smoothstep(0.0, 0.15, rise) * (1.0 - smoothstep(0.82, 1.0, rise));
  vA = fade * (0.35 + 0.65 * aMote.w) * smoothstep(0.35, 0.9, uBuild);
  gl_Position = projectionMatrix * mv;
}
`;

const MOTE_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
uniform vec3 uAccentCore;
uniform float uGlow;
uniform float uCellAlpha;
varying float vA;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float a = exp(-dot(p, p) * 3.2) * vA * uCellAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(finish(uAccentCore * a * 1.6 * uGlow), 1.0);
}
`;

export interface CellState {
  x: number;
  y: number;
  z: number;
  radius: number;
  yaw: number;
  /** 0..1: how formed the cell is (the describe chapter). */
  build: number;
  /** 0..1 launch charge. */
  charge: number;
  flash: number;
  /** Overall brightness. */
  intensity: number;
  /** Scene clock, seconds, for the slabs' drift. */
  time: number;
}

export class CellMesh {
  readonly group = new Group();
  readonly uniforms = {
    uBuild: { value: 1 },
    uCharge: { value: 0 },
    uCellXf: { value: new Vector4(0, 16, -7, 5) },
    uCellYaw: { value: 0 },
    uCellAspect: { value: CELL_ASPECT },
    uCellAlpha: { value: 1 },
    uGauge: { value: new Vector3(0.42, 0.66, 0.3) },
  };
  private readonly xf: InstancedBufferAttribute;
  private readonly st: InstancedBufferAttribute;
  private readonly st2: InstancedBufferAttribute;
  private readonly geometry: InstancedBufferGeometry;
  private readonly gaugeGeo: BufferGeometry;
  private readonly moteGeo: BufferGeometry;
  private readonly materials: ShaderMaterial[] = [];
  private readonly shell: Mesh;
  private readonly gauges: Mesh;
  private readonly motes: Points;

  constructor(shared: SharedUniforms, moteCount = 56) {
    const prism = buildGlassPrism();
    this.geometry = new InstancedBufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(prism.position, 3));
    this.geometry.setAttribute('normal', new BufferAttribute(prism.normal, 3));
    this.geometry.setAttribute('aMeta', new BufferAttribute(prism.meta, 4));
    this.geometry.setIndex(new BufferAttribute(prism.index, 1));
    this.xf = new InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4);
    this.st = new InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4);
    this.st2 = new InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4);
    this.xf.setUsage(35048);
    this.st.setUsage(35048);
    this.st2.setUsage(35048);
    this.geometry.setAttribute('aXf', this.xf);
    this.geometry.setAttribute('aSt', this.st);
    this.geometry.setAttribute('aSt2', this.st2);
    this.geometry.instanceCount = TOTAL;
    for (let i = 0; i < TOTAL; i++) {
      this.st2.array[i * 4] = -1;
      this.st2.array[i * 4 + 2] = 1;
    }
    // Slabs keep their style and phase for good.
    for (let i = 0; i < SLAB_COUNT; i++) {
      const o = (FIRST_SLAB + i) * 4;
      this.st.array[o + 2] = 1;
      this.st2.array[o + 3] = i / (SLAB_COUNT - 1);
    }
    for (let i = 0; i < MAX_COPIES; i++) this.st.array[(FIRST_COPY + i) * 4 + 2] = 2;

    const additive = { transparent: true, blending: AdditiveBlending, depthWrite: false, depthTest: true };
    const shellMat = new ShaderMaterial({
      vertexShader: GLASS_VERT,
      fragmentShader: GLASS_FRAG,
      uniforms: { ...shared, ...this.uniforms },
      side: DoubleSide,
      ...additive,
    });
    this.materials.push(shellMat);
    this.shell = new Mesh(this.geometry, shellMat);
    this.shell.frustumCulled = false;
    this.shell.renderOrder = 8;

    // Gauge arcs: three, each a strip of segments between an inner and an outer edge.
    const segs = 36;
    const pos: number[] = [];
    const arc: number[] = [];
    const side: number[] = [];
    const idx: number[] = [];
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i <= segs; i++) {
        for (let s = 0; s < 2; s++) {
          pos.push(0, 0, 0);
          arc.push(k, i / segs);
          side.push(s);
        }
        if (i < segs) {
          const a = (k * (segs + 1) + i) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
    this.gaugeGeo = new BufferGeometry();
    this.gaugeGeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    this.gaugeGeo.setAttribute('aArc', new BufferAttribute(new Float32Array(arc), 2));
    this.gaugeGeo.setAttribute('aSide', new BufferAttribute(new Float32Array(side), 1));
    this.gaugeGeo.setIndex(idx);
    const gaugeMat = new ShaderMaterial({
      vertexShader: GAUGE_VERT,
      fragmentShader: GAUGE_FRAG,
      uniforms: { ...shared, ...this.uniforms },
      side: DoubleSide,
      ...additive,
    });
    this.materials.push(gaugeMat);
    this.gauges = new Mesh(this.gaugeGeo, gaugeMat);
    this.gauges.frustumCulled = false;
    this.gauges.renderOrder = 9;

    const rand = mulberry32(0xce11);
    const m = new Float32Array(moteCount * 4);
    for (let i = 0; i < m.length; i++) m[i] = rand();
    this.moteGeo = new BufferGeometry();
    this.moteGeo.setAttribute('position', new BufferAttribute(new Float32Array(moteCount * 3), 3));
    this.moteGeo.setAttribute('aMote', new BufferAttribute(m, 4));
    const moteMat = new ShaderMaterial({
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      uniforms: { ...shared, ...this.uniforms },
      ...additive,
    });
    this.materials.push(moteMat);
    this.motes = new Points(this.moteGeo, moteMat);
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 10;

    this.group.add(this.shell, this.gauges, this.motes);
  }

  setMoteCount(n: number): void {
    this.moteGeo.setDrawRange(0, Math.max(0, n));
  }

  /** Places the shell and lays the slabs inside it. */
  setCell(c: CellState, gauge: [number, number, number]): void {
    const xf = this.xf.array as Float32Array;
    const st = this.st.array as Float32Array;
    const st2 = this.st2.array as Float32Array;
    xf[0] = c.x;
    xf[1] = c.y;
    xf[2] = c.z;
    xf[3] = c.radius;
    st[0] = c.yaw;
    st[1] = CELL_ASPECT;
    st[2] = 0;
    st[3] = c.intensity;
    st2[0] = -1;
    st2[1] = c.flash;
    st2[2] = 1;
    st2[3] = 0;
    // Slabs: five thin plates stacked through the shell, each drifting a little on its own phase.
    const h = c.radius * CELL_ASPECT;
    for (let i = 0; i < SLAB_COUNT; i++) {
      const o = (FIRST_SLAB + i) * 4;
      const k = i / (SLAB_COUNT - 1);
      const bob = Math.sin(c.time * 0.7 + i * 1.3) * 0.02 * h;
      xf[o] = c.x;
      xf[o + 1] = c.y + (k - 0.5) * h * 0.74 + bob;
      xf[o + 2] = c.z;
      xf[o + 3] = c.radius * 0.8;
      st[o] = c.yaw + (i % 2 === 0 ? 0.1 : -0.1) * (1 - c.build) + Math.sin(i * 0.9) * 0.02;
      st[o + 1] = 0.045;
      st[o + 2] = 1;
      st[o + 3] = c.intensity * 0.95;
      st2[o] = -1;
      st2[o + 1] = c.flash * 0.5;
      st2[o + 2] = 1;
      st2[o + 3] = k;
    }
    this.uniforms.uBuild.value = c.build;
    this.uniforms.uCharge.value = c.charge;
    this.uniforms.uCellXf.value.set(c.x, c.y, c.z, c.radius);
    this.uniforms.uCellYaw.value = c.yaw;
    this.uniforms.uCellAlpha.value = c.intensity;
    this.uniforms.uGauge.value.set(gauge[0], gauge[1], gauge[2]);
    this.xf.needsUpdate = true;
    this.st.needsUpdate = true;
    this.st2.needsUpdate = true;
  }

  /** A copy of the app. `intensity` 0 hides it. */
  setCopy(
    i: number,
    x: number,
    y: number,
    z: number,
    radius: number,
    yaw: number,
    tier: number,
    intensity: number,
    flash: number,
    alive: number,
  ): void {
    const o = (FIRST_COPY + i) * 4;
    const xf = this.xf.array as Float32Array;
    const st = this.st.array as Float32Array;
    const st2 = this.st2.array as Float32Array;
    xf[o] = x;
    xf[o + 1] = y;
    xf[o + 2] = z;
    xf[o + 3] = radius;
    st[o] = yaw;
    st[o + 1] = 1.25;
    st[o + 3] = intensity;
    st2[o] = tier;
    st2[o + 1] = flash;
    st2[o + 2] = alive;
    st2[o + 3] = i * 0.17;
    this.xf.needsUpdate = true;
    this.st.needsUpdate = true;
    this.st2.needsUpdate = true;
  }

  hideCopy(i: number): void {
    const o = (FIRST_COPY + i) * 4;
    (this.st.array as Float32Array)[o + 3] = 0;
    this.st.needsUpdate = true;
  }

  get triangles(): number {
    return TOTAL * 20;
  }

  dispose(): void {
    this.geometry.dispose();
    this.gaugeGeo.dispose();
    this.moteGeo.dispose();
    for (const m of this.materials) m.dispose();
  }
}
