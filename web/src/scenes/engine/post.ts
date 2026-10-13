// The post chain: a multisampled HDR scene target, a bright pass that feeds a dual Kawase bloom pyramid
// (half or quarter resolution at the top), and one composite pass for aberration, vignette, tone mapping,
// dither and grain. Everything is preallocated; rendering allocates nothing. Tier 1 skips all of this and
// draws straight to the canvas.
// Adapted from fluxcommunity/web/src/stage/engine/post.ts (same owner, MIT).

import {
  AddEquation,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OneFactor,
  OrthographicCamera,
  RedFormat,
  Scene,
  ShaderMaterial,
  type Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  type WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { BRIGHT_DOWN_FRAG, COMPOSITE_FRAG, FS_VERT, KAWASE_DOWN_FRAG, KAWASE_UP_FRAG } from './glsl';

export function fullscreenTriangle(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
}

export interface PostParams {
  exposure: number;
  bloom: number;
  chroma: number;
  grain: number;
  vignette: number;
  fade: number;
  time: number;
  threshold: number;
  dirt: number;
  /** Added in HDR before tone mapping: a faint veil that keeps blacks from banding. */
  veil: [number, number, number];
}

export interface PostConfig {
  width: number;
  height: number;
  samples: number;
  levels: number;
  quarter: boolean;
}

export class Post {
  private sceneRT: WebGLRenderTarget | null = null;
  private mips: WebGLRenderTarget[] = [];
  private readonly tri: Mesh;
  private readonly brightMat: ShaderMaterial;
  private readonly downMat: ShaderMaterial;
  private readonly upMat: ShaderMaterial;
  private readonly compMat: ShaderMaterial;
  private readonly fsCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly fsScene = new Scene();
  private readonly blank: DataTexture;
  private cfg: PostConfig = { width: 0, height: 0, samples: -1, levels: 0, quarter: false };
  private readonly hdr: boolean;
  weight = 0.62;

  constructor(private readonly renderer: WebGLRenderer) {
    const ext = renderer.extensions;
    this.hdr = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float');
    this.blank = new DataTexture(new Uint8Array([0]), 1, 1, RedFormat, UnsignedByteType);
    this.blank.needsUpdate = true;
    const common = { depthTest: false, depthWrite: false } as const;
    this.brightMat = new ShaderMaterial({
      ...common,
      vertexShader: FS_VERT,
      fragmentShader: BRIGHT_DOWN_FRAG,
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new Vector2() },
        uSpread: { value: 1 },
        uThreshold: { value: 1.1 },
        uKnee: { value: 0.5 },
      },
    });
    this.downMat = new ShaderMaterial({
      ...common,
      vertexShader: FS_VERT,
      fragmentShader: KAWASE_DOWN_FRAG,
      uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() } },
    });
    this.upMat = new ShaderMaterial({
      ...common,
      vertexShader: FS_VERT,
      fragmentShader: KAWASE_UP_FRAG,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      uniforms: { tSrc: { value: null }, uTexel: { value: new Vector2() }, uWeight: { value: 1 } },
    });
    this.compMat = new ShaderMaterial({
      ...common,
      vertexShader: FS_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        tDirt: { value: this.blank },
        uRes: { value: new Vector2(1, 1) },
        uTime: { value: 0 },
        uExposure: { value: 1 },
        uBloom: { value: 1 },
        uChroma: { value: 0 },
        uGrain: { value: 1 },
        uVignette: { value: 0.8 },
        uFade: { value: 1 },
        uDirt: { value: 0 },
        uVeil: { value: new Vector3() },
      },
    });
    this.tri = new Mesh(fullscreenTriangle(), this.brightMat);
    this.tri.frustumCulled = false;
    this.fsScene.add(this.tri);
  }

  /** Compiles every post program without blocking the main thread (where the browser allows). */
  async warm(): Promise<void> {
    const mats = [this.brightMat, this.downMat, this.upMat, this.compMat];
    for (const m of mats) {
      this.tri.material = m;
      await this.renderer.compileAsync(this.fsScene, this.fsCam);
    }
  }

  get target(): WebGLRenderTarget | null {
    return this.sceneRT;
  }

  /** The lens dirt texture, or null for none. */
  setDirt(tex: Texture | null): void {
    this.compMat.uniforms.tDirt!.value = tex ?? this.blank;
  }

  /** (Re)allocates the targets when the configuration changed. Returns true when it did. */
  configure(c: PostConfig): boolean {
    const k = this.cfg;
    if (
      this.sceneRT &&
      k.width === c.width &&
      k.height === c.height &&
      k.samples === c.samples &&
      k.levels === c.levels &&
      k.quarter === c.quarter
    ) {
      return false;
    }
    this.disposeTargets();
    this.cfg = { ...c };
    const type = this.hdr ? HalfFloatType : UnsignedByteType;
    this.sceneRT = new WebGLRenderTarget(c.width, c.height, {
      type,
      depthBuffer: true,
      stencilBuffer: false,
      samples: c.samples,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: false,
    });
    let w = c.width;
    let h = c.height;
    for (let i = 0; i < c.levels; i++) {
      const shift = i === 0 && c.quarter ? 2 : 1;
      w = Math.max(2, w >> shift);
      h = Math.max(2, h >> shift);
      this.mips.push(
        new WebGLRenderTarget(w, h, {
          type,
          depthBuffer: false,
          stencilBuffer: false,
          minFilter: LinearFilter,
          magFilter: LinearFilter,
          generateMipmaps: false,
        }),
      );
    }
    return true;
  }

  /** Bloom, composite and present. The scene must already be rendered into `target`. */
  finish(p: PostParams, outW: number, outH: number): void {
    const r = this.renderer;
    const rt = this.sceneRT;
    if (!rt) return;
    const mips = this.mips;
    const comp = this.compMat.uniforms;
    if (mips.length > 0 && p.bloom > 0.001) {
      const first = mips[0]!;
      this.tri.material = this.brightMat;
      const bu = this.brightMat.uniforms;
      bu.tSrc!.value = rt.texture;
      (bu.uTexel!.value as Vector2).set(1 / rt.width, 1 / rt.height);
      bu.uSpread!.value = this.cfg.quarter ? 2 : 1;
      bu.uThreshold!.value = p.threshold;
      r.setRenderTarget(first);
      r.render(this.fsScene, this.fsCam);

      this.tri.material = this.downMat;
      const du = this.downMat.uniforms;
      for (let i = 1; i < mips.length; i++) {
        const src = mips[i - 1]!;
        du.tSrc!.value = src.texture;
        (du.uTexel!.value as Vector2).set(1 / src.width, 1 / src.height);
        r.setRenderTarget(mips[i]!);
        r.render(this.fsScene, this.fsCam);
      }
      this.tri.material = this.upMat;
      const uu = this.upMat.uniforms;
      for (let i = mips.length - 2; i >= 0; i--) {
        const from = mips[i + 1]!;
        uu.tSrc!.value = from.texture;
        (uu.uTexel!.value as Vector2).set(1 / from.width, 1 / from.height);
        uu.uWeight!.value = this.weight;
        r.setRenderTarget(mips[i]!);
        r.render(this.fsScene, this.fsCam);
      }
      comp.tBloom!.value = first.texture;
      comp.uBloom!.value = p.bloom;
    } else {
      comp.tBloom!.value = mips[0]?.texture ?? rt.texture;
      comp.uBloom!.value = 0;
    }

    this.tri.material = this.compMat;
    comp.tScene!.value = rt.texture;
    (comp.uRes!.value as Vector2).set(outW, outH);
    comp.uTime!.value = p.time;
    comp.uExposure!.value = p.exposure;
    comp.uChroma!.value = p.chroma;
    comp.uGrain!.value = p.grain;
    comp.uVignette!.value = p.vignette;
    comp.uFade!.value = p.fade;
    comp.uDirt!.value = p.dirt;
    (comp.uVeil!.value as Vector3).set(p.veil[0], p.veil[1], p.veil[2]);
    r.setRenderTarget(null);
    r.render(this.fsScene, this.fsCam);
  }

  private disposeTargets(): void {
    this.sceneRT?.dispose();
    this.sceneRT = null;
    for (const m of this.mips) m.dispose();
    this.mips.length = 0;
  }

  dispose(): void {
    this.disposeTargets();
    this.brightMat.dispose();
    this.downMat.dispose();
    this.upMat.dispose();
    this.compMat.dispose();
    this.blank.dispose();
    this.tri.geometry.dispose();
  }
}
