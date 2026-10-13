// Shared GLSL: noise, tone mapping, the straight-to-canvas finish used on the lowest tier, and the post
// passes (bright pass, dual Kawase pyramid, composite). three prefixes ShaderMaterial sources (version,
// precision, the matrix and cameraPosition uniforms, attribute/varying/texture2D aliases), so none of that
// is declared here.
//
// Colour is linear HDR everywhere. Either the post chain tone maps (uDirect = 0) or each material does it
// itself through `finish()` when the scene renders straight to the canvas (uDirect = 1).
// The bloom pyramid and the composite pass are adapted from fluxcommunity/web/src/stage/engine/shaders.ts
// (same owner, MIT).

export const GLSL_COMMON = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s;
}
vec3 acesFilm(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

/** Appended to every scene material: the straight-to-canvas path (tier 1) tone maps and dithers here. */
export const GLSL_FINISH = /* glsl */ `
uniform float uDirect;
uniform float uExposure;
uniform float uTime;
vec3 finish(vec3 c) {
  c = max(c, vec3(0.0));
  if (uDirect < 0.5) return c;
  c = toSrgb(acesFilm(c * uExposure));
  float n = hash21(gl_FragCoord.xy + fract(uTime * 0.37) * 71.0) + hash21(gl_FragCoord.xy * 1.37 + 19.0) - 1.0;
  return c + n * (1.0 / 255.0);
}
`;

export const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BRIGHT_DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;     // texel of the source
uniform float uSpread;   // tap spacing in source texels
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;

vec3 tap(vec2 o) {
  vec3 c = texture2D(tSrc, vUv + o * uTexel * uSpread).rgb;
  return (any(isnan(c)) || any(isinf(c))) ? vec3(0.0) : min(c, vec3(48.0));
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 prefilter(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  return c * contrib;
}
void main() {
  // Four groups of four taps around the centre, Karis weighted so one hot pixel cannot flicker the bloom.
  vec3 g0 = prefilter((tap(vec2(-1.0, 1.0)) + tap(vec2(0.0, 1.0)) + tap(vec2(-1.0, 0.0)) + tap(vec2(0.0, 0.0))) * 0.25);
  vec3 g1 = prefilter((tap(vec2(0.0, 1.0)) + tap(vec2(1.0, 1.0)) + tap(vec2(0.0, 0.0)) + tap(vec2(1.0, 0.0))) * 0.25);
  vec3 g2 = prefilter((tap(vec2(-1.0, 0.0)) + tap(vec2(0.0, 0.0)) + tap(vec2(-1.0, -1.0)) + tap(vec2(0.0, -1.0))) * 0.25);
  vec3 g3 = prefilter((tap(vec2(0.0, 0.0)) + tap(vec2(1.0, 0.0)) + tap(vec2(0.0, -1.0)) + tap(vec2(1.0, -1.0))) * 0.25);
  float w0 = 1.0 / (1.0 + luma(g0));
  float w1 = 1.0 / (1.0 + luma(g1));
  float w2 = 1.0 / (1.0 + luma(g2));
  float w3 = 1.0 / (1.0 + luma(g3));
  vec3 c = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3) / (w0 + w1 + w2 + w3);
  gl_FragColor = vec4(c, 1.0);
}
`;

// Dual Kawase: five taps down, eight up. Cheap and smooth.
export const KAWASE_DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 hp = uTexel * 0.5;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv - hp).rgb;
  s += texture2D(tSrc, vUv + hp).rgb;
  s += texture2D(tSrc, vUv + vec2(hp.x, -hp.y)).rgb;
  s += texture2D(tSrc, vUv - vec2(hp.x, -hp.y)).rgb;
  gl_FragColor = vec4(s * 0.125, 1.0);
}
`;

export const KAWASE_UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;     // texel of the (smaller) source
uniform float uWeight;
varying vec2 vUv;
void main() {
  vec2 hp = uTexel * 0.5;
  vec3 s = texture2D(tSrc, vUv + vec2(-hp.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-hp.x, hp.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, hp.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(hp.x, hp.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(hp.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(hp.x, -hp.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -hp.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-hp.x, -hp.y)).rgb * 2.0;
  gl_FragColor = vec4(s * (uWeight / 12.0), 1.0);
}
`;

// One pass: aberration toward the edges, bloom (with an optional lens dirt multiply), exposure,
// vignette, tone mapping, a triangular dither that kills banding in the dark gradients, fine grain.
export const COMPOSITE_FRAG = /* glsl */ `
${GLSL_COMMON}
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tDirt;
uniform vec2 uRes;
uniform float uTime;
uniform float uExposure;
uniform float uBloom;
uniform float uChroma;
uniform float uGrain;
uniform float uVignette;
uniform float uFade;
uniform float uDirt;
uniform vec3 uVeil;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  c.x *= uRes.x / uRes.y;
  float r2 = dot(c, c);
  // Chromatic aberration: nothing at the centre, growing with the square of the distance.
  vec2 off = (uv - 0.5) * r2 * uChroma;
  vec3 col;
  col.r = texture2D(tScene, uv + off).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - off).b;
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  vec3 bloom = texture2D(tBloom, uv).rgb;
  if (any(isnan(bloom)) || any(isinf(bloom))) bloom = vec3(0.0);
  float dirt = 1.0 + uDirt * texture2D(tDirt, uv).r;
  col += bloom * uBloom * dirt;
  col += uVeil;
  col *= uExposure;
  // Vignette, so the corners stay inky instead of grey.
  float vig = smoothstep(0.2, 1.1, sqrt(r2));
  col *= 1.0 - uVignette * vig * vig;
  col = toSrgb(acesFilm(col));
  float n1 = hash21(gl_FragCoord.xy + fract(uTime * 7.13) * 91.7);
  float n2 = hash21(gl_FragCoord.xy * 1.37 + fract(uTime * 3.71) * 53.1);
  float tri = n1 + n2 - 1.0;
  col += tri * (uGrain * 0.02 + 1.0 / 255.0);
  col *= uFade;
  gl_FragColor = vec4(col, 1.0);
}
`;
