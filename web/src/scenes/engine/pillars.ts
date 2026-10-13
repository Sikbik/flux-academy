// The pillars: one tier-coloured glass column per node on the bench, a halo ring above each, and a faint
// light shaft above the ones that host the app. They share one set of instance attributes, so a state
// change (landed, running, broken, revived, retired) is a few floats in a small buffer and the animation
// itself runs in the shaders from timestamps the director writes. After the pillars come the visitor
// beacons (tier 3, white-hot): short columns at the places requests come from.

import {
  AdditiveBlending,
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import { HOST_K, HOST_LIFT, type LifeBuffers, NEVER, REST_K } from '../lib/director';
import type { PillarSpecs } from '../world/frame';
import { buildColumn } from '../world/prism';
import { GLSL_COMMON, GLSL_FINISH } from './glsl';
import type { SharedUniforms } from './uniforms';

/** Nodes plus beacons. A live bench keeps at most 400 clusters, the sample has about 180. */
export const MAX_PILLARS = 448;
const CAP_BEVEL = 0.16;

const ATTR_VERT = /* glsl */ `
attribute vec4 aPos;    // x, z, height, radius
attribute vec4 aInfo;   // tier (0..2, 3 = visitor beacon), rnd, mass, index
attribute vec4 aLife;   // runningAt, brokenAt, revivedAt, retiredAt (scene seconds, < -500 = never)
attribute vec4 aLife2;  // pingAt, hover 0..1, landedAt, startProgress (-1 when not starting)
`;

// The state machine, evaluated per instance in the vertex shader from the timestamps. Outputs:
//   ages   landed, broken, revived, retired: seconds since each event, or -1 when it does not apply to
//          the current life of the pillar (an old failure before a new copy landed, and so on)
//   host   0..1   a copy runs here
//   dead   0..1   the node has failed and has not come back
//   ping   0..1   a short lock or request answer
//   boot   0..1   the copy has landed and is starting, -1 otherwise
const STATE_VERT = /* glsl */ `
uniform float uTime;
void pillarState(vec4 L, vec4 L2, out vec4 ages, out float host, out float dead, out float ping, out float boot) {
  float landed = L2.z > -500.0 ? uTime - L2.z : -1.0;
  float broken = (L.y > -500.0 && L.y >= L2.z) ? uTime - L.y : -1.0;
  float revived = (L.z > -500.0 && L.z >= L.y && L.z >= L2.z) ? uTime - L.z : -1.0;
  float retired = (L.w > -500.0 && L.w >= L2.z) ? uTime - L.w : -1.0;
  ages = vec4(landed, broken, revived, retired);
  float run = (L.x > -500.0 && L.x >= L2.z) ? uTime - L.x : -1.0;
  bool isBroken = broken >= 0.0 && revived < 0.0;
  float up = run >= 0.0 ? clamp(run * 1.9, 0.0, 1.0) : 0.0;
  if (retired >= 0.0) up = min(up, 1.0 - clamp(retired * 2.5, 0.0, 1.0));
  host = up;
  dead = isBroken ? clamp(broken * 1.6, 0.0, 1.0) : 0.0;
  ping = L2.x > -500.0 ? exp(-(uTime - L2.x) * 6.5) : 0.0;
  boot = (landed >= 0.0 && run < 0.0 && !isBroken && retired < 0.0) ? clamp(L2.w, 0.0, 1.0) : -1.0;
}
`;

const COLUMN_VERT = /* glsl */ `
${GLSL_COMMON}
${ATTR_VERT}
${STATE_VERT}
uniform float uReveal;
uniform vec3 uRevealC;
uniform vec2 uHover;
uniform float uBevelDrop;

attribute vec4 aMeta;   // kind, param, u, 0

varying vec3 vWorld;
varying vec3 vNrm;
varying vec4 vMeta;     // kind, param, u, rnd
varying vec4 vInfo;     // tier, host, dead, ping
varying vec4 vAge;      // landed, broken, revived, retired ages
varying vec4 vShape;    // height, radius, hover, boot
varying vec2 vLocal;

void main() {
  vec4 ages;
  float host;
  float dead;
  float ping;
  float boot;
  pillarState(aLife, aLife2, ages, host, dead, ping, boot);

  float cd = length(aPos.xy - uRevealC.xy);
  float ig = clamp((uReveal * uRevealC.z - cd - 6.0) / 10.0, 0.0, 1.0);
  float grow = 1.0 - pow(1.0 - ig, 3.0);

  // The network is quiet; the pillars that host the app stand taller and a little wider.
  float isBeacon = step(2.5, aInfo.x);
  float rise = 1.0 - pow(1.0 - host, 3.0);
  float hk = mix(mix(${REST_K.toFixed(3)}, ${HOST_K.toFixed(3)}, rise), 1.0, isBeacon);
  float rk = mix(mix(0.8, 1.0, rise), 1.0, isBeacon) * smoothstep(0.0, 0.12, grow);
  float H = (aPos.z * hk + ${HOST_LIFT.toFixed(3)} * rise * (1.0 - isBeacon)) * grow;
  // A quick lock when a copy lands or a node revives: the column settles with one small overshoot.
  float since = ages.x >= 0.0 ? ages.x : 1e3;
  if (ages.z >= 0.0 && ages.z < since) since = ages.z;
  H *= 1.0 + exp(-since * 8.0) * sin(since * 34.0) * 0.06 * min(since * 40.0, 1.0);

  float lvl = position.y;
  float bev = min(uBevelDrop, H * 0.35);
  float y = lvl < 0.5 ? 0.0 : (lvl < 1.5 ? H - bev : H);
  float hover = (abs(aInfo.w - uHover.x) < 0.5) ? uHover.y : 0.0;
  y += hover * 0.55;

  vec3 wp = vec3(aPos.x + position.x * aPos.w * rk, y, aPos.y + position.z * aPos.w * rk);
  vWorld = wp;
  vNrm = normal;
  vMeta = vec4(aMeta.x, aMeta.y, aMeta.z, aInfo.y);
  vInfo = vec4(aInfo.x, host, dead, ping);
  vAge = ages;
  vShape = vec4(max(H, 0.001), aPos.w, hover, boot);
  vLocal = position.xz;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const COLUMN_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
uniform vec3 uTier[4];
uniform vec3 uTierFocus;
uniform vec3 uHaze;
uniform float uGlow;
uniform float uFogScale;
uniform float uBeat;
uniform float uMotion;

varying vec3 vWorld;
varying vec3 vNrm;
varying vec4 vMeta;
varying vec4 vInfo;
varying vec4 vAge;
varying vec4 vShape;
varying vec2 vLocal;

float hexD(vec2 p, float apothem) {
  p = abs(p);
  float d = max(p.x, max(0.5 * p.x + 0.8660254 * p.y, -0.5 * p.x + 0.8660254 * p.y));
  return d / apothem;
}

void main() {
  int tier = int(vInfo.x + 0.5);
  vec3 T = uTier[tier];
  float focus = tier < 3 ? (tier == 0 ? uTierFocus.x : (tier == 1 ? uTierFocus.y : uTierFocus.z)) : 1.0;
  float host = vInfo.y;
  float dead = vInfo.z;
  float ping = vInfo.w;
  float kind = vMeta.x;
  float rnd = vMeta.w;
  float landed = vAge.x;
  float broken = vAge.y;
  float revived = vAge.z;
  float boot = vShape.w;

  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec3 N = normalize(vNrm);
  float fres = pow(1.0 - abs(dot(N, V)), 2.4);
  float yy = clamp(vWorld.y / vShape.x, 0.0, 1.0);

  // A broken node: three quick on and off cycles, then it settles dim and grey.
  float flick = 1.0;
  float desat = 0.0;
  if (dead > 0.0 && broken >= 0.0) {
    float cyc = step(0.5, fract(broken * 5.5));
    flick = broken < 0.65 ? 0.12 + 0.88 * cyc : 0.2;
    desat = smoothstep(0.1, 0.9, broken);
  }
  // A revived node ignites from its centre outward, then the body fills from the top down.
  float ignite = 1.0;
  float igHot = 0.0;
  bool reviving = revived >= 0.0 && dead <= 0.0;
  if (reviving) {
    float r = hexD(vLocal, 0.866);
    float front = revived * 3.4;
    ignite = kind < 0.5 ? smoothstep(r - 0.2, r, front) : smoothstep((1.0 - yy) * 0.8 - 0.3, (1.0 - yy) * 0.8, revived * 2.4 - 0.2);
    igHot = exp(-pow((r - front) / 0.22, 2.0)) * (1.0 - smoothstep(0.25, 0.6, revived));
  }

  // Ambient pillars are the network at rest; hosts and beacons carry the picture.
  float tone = (tier == 3 ? 0.85 : mix(0.42, 1.0, host)) * focus;
  vec3 col;
  if (kind < 0.5) {
    // Cap: a bright flat top with a hot rim, the ring the arcs land on.
    float hd = hexD(vLocal, 0.866 * 0.84);
    float rim = smoothstep(0.62, 1.0, hd);
    float core = 1.0 - smoothstep(0.0, 0.8, hd);
    col = T * (0.5 + 0.55 * rim + 0.5 * core * host) + vec3(0.5) * rim * 0.35;
    col += T * ping * 1.4 + vec3(1.0) * ping * 0.35 * core;
    col += vec3(1.0, 0.95, 0.9) * host * smoothstep(0.0, 0.25, landed) * (1.0 - smoothstep(0.25, 0.7, landed)) * 0.9 * (rim * 0.7 + 0.3) * step(0.0, landed);
    if (boot >= 0.0) {
      // Starting: the cap fills around its rim as the copy comes up.
      float ang = atan(vLocal.y, vLocal.x) / TAU + 0.5;
      col += T * rim * step(ang, boot) * 0.9;
    }
  } else if (kind < 1.5) {
    col = T * 1.35 + vec3(0.32);
    col += T * ping;
  } else {
    float edgeU = min(vMeta.z, 1.0 - vMeta.z);
    float corner = 1.0 - smoothstep(0.0, 0.075, edgeU);
    float foot = exp(-yy * 6.0);
    float fill = 0.09 + 0.5 * fres + 0.2 * yy;
    col = T * (fill * 0.6 + foot * 0.75);
    col += (T * 1.05 + vec3(0.18)) * corner * (0.5 + 0.8 * yy);
    // A slow sheen climbs a hosting pillar, as if data were running up it.
    float sheen = pow(0.5 + 0.5 * sin(yy * 11.0 - uTime * 2.4 * uMotion + rnd * 6.0), 6.0);
    col += T * sheen * 0.4 * host * (0.4 + 0.6 * yy);
    col += T * ping * 0.6 * yy;
  }

  // Crack: a ridged line across the face, drawn in as the node fails, glowing hot then dim.
  if (dead > 0.0 && broken >= 0.0) {
    vec2 cp = kind < 0.5 ? vLocal * 2.6 : vec2(vMeta.z * 3.4 + rnd * 9.0, yy * 5.2 + rnd * 7.0);
    float n = vnoise(cp + rnd * 31.0) + 0.5 * vnoise(cp * 2.3 - 5.0);
    float line = 1.0 - smoothstep(0.0, 0.07, abs(n * 0.667 - 0.5));
    float draw = smoothstep(0.0, 1.0, (broken - 0.08) / 0.5);
    float along = kind < 0.5 ? (vLocal.x * 0.8 + vLocal.y * 0.6) : (1.0 - yy) * 1.6 - 0.8;
    float shown = 1.0 - smoothstep(along - 0.15, along + 0.15, mix(-1.0, 1.0, draw) * -1.0);
    float hot = 1.0 - smoothstep(0.0, 0.5, broken);
    vec3 crackCol = mix(vec3(1.0, 0.36, 0.44), vec3(1.0, 0.92, 0.94), hot);
    col += crackCol * line * (0.35 + 1.4 * hot) * clamp(shown, 0.0, 1.0);
  }

  col = mix(col, vec3(luma(col)) * 0.5, desat);
  col *= mix(1.0, 0.22, dead) * flick;
  col = mix(col * 0.18, col, ignite);
  col += T * igHot * 2.2 + vec3(1.0) * igHot * 0.6;
  col *= tone;
  col *= 1.0 + uBeat * 0.35;
  col *= uGlow;

  float fogK = dist / uFogScale;
  float fog = 1.0 - exp(-fogK * fogK);
  col *= 1.0 - fog * 0.8;
  gl_FragColor = vec4(finish(col), 1.0);
}
`;

// The ring above a pillar: a steady one while it hosts the app, a partial one while it starts, and an
// expanding one at the moment of landing, a revival or a break. A flat quad on the plane of the pillar's top.
const HALO_VERT = /* glsl */ `
${GLSL_COMMON}
${ATTR_VERT}
${STATE_VERT}
uniform float uReveal;
uniform vec3 uRevealC;
varying vec2 vP;
varying vec4 vInfo;
varying vec4 vAge;
varying vec2 vRB;

void main() {
  vec4 ages;
  float host;
  float dead;
  float ping;
  float boot;
  pillarState(aLife, aLife2, ages, host, dead, ping, boot);
  float cd = length(aPos.xy - uRevealC.xy);
  float ig = clamp((uReveal * uRevealC.z - cd - 6.0) / 10.0, 0.0, 1.0);
  float grow = 1.0 - pow(1.0 - ig, 3.0);
  float R = aPos.w * 4.4 * smoothstep(0.0, 0.12, grow);
  vec2 q = position.xy;
  vP = q * 4.4;
  vInfo = vec4(aInfo.x, host, dead, ping);
  vAge = ages;
  vRB = vec2(aInfo.y, boot);
  float rise = 1.0 - pow(1.0 - host, 3.0);
  float isBeacon = step(2.5, aInfo.x);
  float hk = mix(mix(${REST_K.toFixed(3)}, ${HOST_K.toFixed(3)}, rise), 1.0, isBeacon);
  float topY = (aPos.z * hk + ${HOST_LIFT.toFixed(3)} * rise * (1.0 - isBeacon)) * grow;
  vec3 wp = vec3(aPos.x + q.x * R, topY + 0.06, aPos.y + q.y * R);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const HALO_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
uniform vec3 uTier[4];
uniform vec3 uTierFocus;
uniform float uGlow;
uniform float uMotion;
varying vec2 vP;
varying vec4 vInfo;
varying vec4 vAge;
varying vec2 vRB;

float hexD(vec2 p, float apothem) {
  p = abs(p);
  float d = max(p.x, max(0.5 * p.x + 0.8660254 * p.y, -0.5 * p.x + 0.8660254 * p.y));
  return d / apothem;
}
float ring(float d, float r, float w) {
  float x = (d - r) / w;
  return exp(-x * x);
}

void main() {
  int tier = int(vInfo.x + 0.5);
  vec3 T = uTier[tier];
  float focus = tier < 3 ? (tier == 0 ? uTierFocus.x : (tier == 1 ? uTierFocus.y : uTierFocus.z)) : 1.0;
  float host = vInfo.y;
  float dead = vInfo.z;
  float boot = vRB.y;
  float d = hexD(vP, 0.866);          // 1.0 at the pillar's own rim
  float a = 0.0;
  // Steady: a thin ring at 1.5 radii that breathes while the copy is up.
  float breathe = 0.78 + 0.22 * sin(uTime * 1.6 * uMotion + vRB.x * 30.0);
  a += ring(d, 1.5, 0.07) * host * (1.0 - dead) * 0.55 * breathe;
  a += ring(d, 1.52, 0.2) * host * (1.0 - dead) * 0.12;
  // Starting: the same ring, drawn as an arc that closes while the copy comes up.
  if (boot >= 0.0) {
    float ang = atan(vP.y, vP.x) / TAU + 0.5;
    float arc = step(ang, boot);
    a += ring(d, 1.5, 0.06) * (0.18 + 0.62 * arc);
  }
  vec3 col = T * a;
  // Landing: a tight ring races out from the rim and fades.
  float la = vAge.x;
  if (la >= 0.0 && la < 1.2 && dead < 0.5) {
    float r = 1.0 + la * 4.2;
    float f = exp(-la * 3.4);
    float g = ring(d, r, 0.1 + la * 0.07) * f;
    col += (T * 1.1 + vec3(0.5)) * g * 1.25;
  }
  // Revival: the same ring, hotter, a little later in the story.
  float ra = vAge.z;
  if (ra >= 0.0 && ra < 1.3 && vAge.y < 0.0) {
    float r = 1.0 + ra * 5.8;
    float f = exp(-ra * 2.6);
    col += (T * 1.0 + vec3(0.9)) * ring(d, r, 0.12 + ra * 0.09) * f * 1.6;
  }
  // A break: a short red-white flash ring.
  float ba = vAge.y;
  if (ba >= 0.0 && ba < 0.9) {
    float r = 1.0 + ba * 4.2;
    float f = exp(-ba * 4.5);
    col += vec3(1.0, 0.34, 0.42) * ring(d, r, 0.1 + ba * 0.08) * f * 1.3;
  }
  col *= focus * uGlow;
  if (max(col.r, max(col.g, col.b)) < 0.002) discard;
  gl_FragColor = vec4(finish(col), 1.0);
}
`;

// The shaft: a faint vertical glow above a hosting pillar, turned to face the camera about the vertical.
const SHAFT_VERT = /* glsl */ `
${GLSL_COMMON}
${ATTR_VERT}
${STATE_VERT}
uniform float uReveal;
uniform vec3 uRevealC;
varying vec2 vUv;
varying vec4 vInfo;
varying vec4 vAge;

void main() {
  vec4 ages;
  float host;
  float dead;
  float ping;
  float boot;
  pillarState(aLife, aLife2, ages, host, dead, ping, boot);
  float cd = length(aPos.xy - uRevealC.xy);
  float ig = clamp((uReveal * uRevealC.z - cd - 6.0) / 10.0, 0.0, 1.0);
  float grow = 1.0 - pow(1.0 - ig, 3.0);
  float rise = 1.0 - pow(1.0 - host, 3.0);
  float isBeacon = step(2.5, aInfo.x);
  float hk = mix(mix(${REST_K.toFixed(3)}, ${HOST_K.toFixed(3)}, rise), 1.0, isBeacon);
  vec3 base = vec3(aPos.x, (aPos.z * hk + ${HOST_LIFT.toFixed(3)} * rise * (1.0 - isBeacon)) * grow, aPos.y);
  vec3 toCam = cameraPosition - base;
  vec2 f = normalize(toCam.xz + vec2(1e-4));
  vec2 side = vec2(-f.y, f.x);
  float width = aPos.w * 0.95;
  float height = 4.0 + aPos.w * 7.0;
  vUv = vec2(position.x * 2.0, position.y + 0.5);
  vInfo = vec4(aInfo.x, host, dead, ping);
  vAge = ages;
  vec3 wp = base + vec3(side.x * position.x * width * 2.0, (position.y + 0.5) * height, side.y * position.x * width * 2.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const SHAFT_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_FINISH}
uniform vec3 uTier[4];
uniform vec3 uTierFocus;
uniform float uGlow;
varying vec2 vUv;
varying vec4 vInfo;
varying vec4 vAge;

void main() {
  int tier = int(vInfo.x + 0.5);
  if (tier > 2) discard;
  vec3 T = uTier[tier];
  float focus = tier == 0 ? uTierFocus.x : (tier == 1 ? uTierFocus.y : uTierFocus.z);
  float host = vInfo.y * (1.0 - vInfo.z);
  float across = exp(-vUv.x * vUv.x * 5.5);
  float up = pow(1.0 - vUv.y, 2.2);
  float pulse = 1.0 + 0.8 * exp(-max(vAge.x, 0.0) * 2.5) * step(0.0, vAge.x);
  float a = across * up * host * 0.2 * pulse * focus;
  if (a < 0.002) discard;
  gl_FragColor = vec4(finish(T * a * 1.2 * uGlow), 1.0);
}
`;

export interface BeaconSpec {
  x: Float32Array;
  z: Float32Array;
  count: number;
  height: number;
  radius: number;
}

export class PillarMesh {
  readonly column: Mesh;
  readonly halo: Mesh;
  readonly shaft: Mesh;
  /** Number of instances: pillars, then beacons. */
  count = 0;
  /** Number of node pillars (the first `nodes` instances). */
  nodes = 0;
  private readonly aPos: InstancedBufferAttribute;
  private readonly aInfo: InstancedBufferAttribute;
  private readonly aLife: InstancedBufferAttribute;
  private readonly aLife2: InstancedBufferAttribute;
  private readonly geometries: InstancedBufferGeometry[] = [];
  private readonly materials: ShaderMaterial[] = [];
  private readonly columnUniforms: { uBevelDrop: { value: number } };
  /** The arrays the director writes; uploaded every frame (a few KB). */
  readonly life: LifeBuffers;

  constructor(shared: SharedUniforms) {
    this.aPos = new InstancedBufferAttribute(new Float32Array(MAX_PILLARS * 4), 4);
    this.aInfo = new InstancedBufferAttribute(new Float32Array(MAX_PILLARS * 4), 4);
    this.aLife = new InstancedBufferAttribute(new Float32Array(MAX_PILLARS * 4).fill(NEVER), 4);
    this.aLife2 = new InstancedBufferAttribute(new Float32Array(MAX_PILLARS * 4), 4);
    this.aLife.setUsage(35048); // DynamicDrawUsage
    this.aLife2.setUsage(35048);
    this.life = {
      l1: this.aLife.array as Float32Array,
      l2: this.aLife2.array as Float32Array,
      beaconBase: 0,
    };
    this.resetLife();

    const col = buildColumn(CAP_BEVEL);
    const colGeo = new InstancedBufferGeometry();
    colGeo.setAttribute('position', new BufferAttribute(col.position, 3));
    colGeo.setAttribute('normal', new BufferAttribute(col.normal, 3));
    colGeo.setAttribute('aMeta', new BufferAttribute(col.meta, 4));
    colGeo.setIndex(new BufferAttribute(col.index, 1));
    this.attach(colGeo);

    const quad = new PlaneGeometry(2, 2, 1, 1);
    const haloGeo = new InstancedBufferGeometry();
    haloGeo.setAttribute('position', quad.getAttribute('position'));
    haloGeo.setIndex(quad.getIndex());
    // The halo lies flat: x and y of the quad become x and z of the world offset (done in the shader).
    this.attach(haloGeo);

    const shaftQuad = new PlaneGeometry(1, 1, 1, 1);
    const shaftGeo = new InstancedBufferGeometry();
    shaftGeo.setAttribute('position', shaftQuad.getAttribute('position'));
    shaftGeo.setIndex(shaftQuad.getIndex());
    this.attach(shaftGeo);

    this.columnUniforms = { uBevelDrop: { value: 0.2 } };
    const additive = {
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    } as const;
    const columnMat = new ShaderMaterial({
      vertexShader: COLUMN_VERT,
      fragmentShader: COLUMN_FRAG,
      uniforms: { ...shared, ...this.columnUniforms },
      ...additive,
    });
    const haloMat = new ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { ...shared },
      ...additive,
    });
    const shaftMat = new ShaderMaterial({
      vertexShader: SHAFT_VERT,
      fragmentShader: SHAFT_FRAG,
      uniforms: { ...shared },
      ...additive,
    });
    this.materials.push(columnMat, haloMat, shaftMat);
    const [g0, g1, g2] = this.geometries;
    this.column = new Mesh(g0, columnMat);
    this.halo = new Mesh(g1, haloMat);
    this.shaft = new Mesh(g2, shaftMat);
    for (const m of [this.column, this.halo, this.shaft]) m.frustumCulled = false;
    this.column.renderOrder = 2;
    this.halo.renderOrder = 3;
    this.shaft.renderOrder = 4;
  }

  private attach(g: InstancedBufferGeometry): void {
    g.setAttribute('aPos', this.aPos);
    g.setAttribute('aInfo', this.aInfo);
    g.setAttribute('aLife', this.aLife);
    g.setAttribute('aLife2', this.aLife2);
    g.instanceCount = 0;
    this.geometries.push(g);
  }

  setShaftVisible(on: boolean): void {
    this.shaft.visible = on;
  }

  /** Lays out the node pillars and the visitor beacons. Resets every life timestamp. */
  setLayout(p: PillarSpecs, beacons: BeaconSpec, bevelDrop: number): LifeBuffers {
    const n = Math.min(p.count, MAX_PILLARS - beacons.count);
    const pos = this.aPos.array as Float32Array;
    const info = this.aInfo.array as Float32Array;
    for (let i = 0; i < n; i++) {
      pos[i * 4] = p.x[i] ?? 0;
      pos[i * 4 + 1] = p.z[i] ?? 0;
      pos[i * 4 + 2] = p.height[i] ?? 1;
      pos[i * 4 + 3] = p.radius[i] ?? 1;
      info[i * 4] = p.tier[i] ?? 0;
      info[i * 4 + 1] = p.rnd[i] ?? 0;
      info[i * 4 + 2] = p.mass[i] ?? 0;
      info[i * 4 + 3] = i;
    }
    for (let b = 0; b < beacons.count; b++) {
      const i = n + b;
      pos[i * 4] = beacons.x[b] ?? 0;
      pos[i * 4 + 1] = beacons.z[b] ?? 0;
      pos[i * 4 + 2] = beacons.height;
      pos[i * 4 + 3] = beacons.radius;
      info[i * 4] = 3;
      info[i * 4 + 1] = (b * 0.37 + 0.2) % 1;
      info[i * 4 + 2] = 0;
      info[i * 4 + 3] = i;
    }
    this.nodes = n;
    this.count = n + beacons.count;
    this.life.beaconBase = n;
    this.columnUniforms.uBevelDrop.value = bevelDrop;
    this.resetLife();
    for (const g of this.geometries) g.instanceCount = this.count;
    this.aPos.needsUpdate = true;
    this.aInfo.needsUpdate = true;
    return this.life;
  }

  resetLife(): void {
    this.life.l1.fill(NEVER);
    const l2 = this.life.l2;
    for (let i = 0; i < MAX_PILLARS; i++) {
      l2[i * 4] = NEVER;
      l2[i * 4 + 1] = 0;
      l2[i * 4 + 2] = NEVER;
      l2[i * 4 + 3] = -1;
    }
  }

  setHover(i: number, amount: number): void {
    if (i < 0 || i >= this.count) return;
    this.life.l2[i * 4 + 1] = amount;
  }

  /** Uploads the life attributes. They are tiny, so they go up every frame. */
  flush(): void {
    this.aLife.needsUpdate = true;
    this.aLife2.needsUpdate = true;
  }

  get triangles(): number {
    return this.count * 48;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
