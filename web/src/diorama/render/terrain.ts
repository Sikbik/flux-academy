/**
 * Terrain drawing: every land cell as a short glass prism, batched into a handful of fills and strokes
 * per row of the grid. Rows are painted north to south, so a nearer cell's faces correctly cover a
 * farther one. The same routine serves the baked static layer and the fast path used while the camera
 * moves (`simple`: tops only, one pass).
 *
 * It also fills a `TerrainGeo` with each cell's projected top face so that highlights, hover and the
 * ambient shimmer never have to project a cell again.
 */
import type { Bench } from '../model/types';
import { hash01 } from '../util';
import type { Camera } from './camera';
import type { Palette } from './palette';
import { mix } from './palette';

export interface TerrainGeo {
  count: number;
  /** 6 projected top corners per cell, x then y interleaved: [x0, y0, x1, y1, ...]. */
  top: Float32Array;
  /** Projected centre of the top face. */
  cx: Float32Array;
  cy: Float32Array;
  /** Pixels per bench unit at the cell (a size hint). */
  ps: Float32Array;
}

export function makeTerrainGeo(count: number): TerrainGeo {
  return {
    count,
    top: new Float32Array(count * 12),
    cx: new Float32Array(count),
    cy: new Float32Array(count),
    ps: new Float32Array(count),
  };
}

/** Radius a terrain cell is drawn at: below 1 so a thin gap of void separates neighbours. */
export const CELL_DRAW_R = 0.86;

const COS = Array.from({ length: 6 }, (_, k) => Math.cos(Math.PI / 6 + (k * Math.PI) / 3));
const SIN = Array.from({ length: 6 }, (_, k) => Math.sin(Math.PI / 6 + (k * Math.PI) / 3));

/** Visible side faces, as the corner index each starts at, and their light (SE is lit, W is in shade). */
const FACES: ReadonlyArray<readonly [number, number]> = [
  [0, 1.0],
  [1, 0.7],
  [2, 0.46],
  [5, 1.12],
];
/** Fractions of the face height from the top edge where the three bands start. */
const BAND_U: readonly number[] = [0, 0.34, 0.7, 1];
/** Glass is lit from within: faint under the cap, brightest towards the foot. */
const BAND_ALPHA: readonly number[] = [0.2, 0.34, 0.52];

export interface TerrainOptions {
  width: number;
  height: number;
  /** Per land cell multiplier on opacity (0..1), or null for all 1. Used to dim what is out of scope. */
  weight: Float32Array | null;
  /** Skip the side faces and rims: a cheap look for the fast path. */
  simple?: boolean;
}

const shadeCount = 4;

/** Scratch buffers reused between calls so the fast path does not allocate per frame. */
const scratch = {
  n: 0,
  side: new Float32Array(0),
  faceMask: new Uint8Array(0),
  shade: new Uint8Array(0),
  drawn: new Uint8Array(0),
  lit: new Uint8Array(0),
  tx: new Float32Array(6),
  ty: new Float32Array(6),
};

function ensureScratch(n: number): void {
  if (scratch.n === n) {
    scratch.drawn.fill(0);
    return;
  }
  scratch.n = n;
  scratch.side = new Float32Array(n * 24);
  scratch.faceMask = new Uint8Array(n);
  scratch.shade = new Uint8Array(n);
  scratch.drawn = new Uint8Array(n);
  scratch.lit = new Uint8Array(n);
}

/**
 * Draws the terrain into `ctx` (already scaled to CSS pixels) and records top faces in `geo`.
 * Returns the number of cells drawn.
 */
export function renderTerrain(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  bench: Bench,
  pal: Palette,
  geo: TerrainGeo,
  opts: TerrainOptions,
): number {
  const cells = bench.cells;
  const n = cells.count;
  const R = CELL_DRAW_R;
  const w = opts.width;
  const h = opts.height;

  // Pass 1: project everything.
  ensureScratch(n);
  const { tx, ty, side, faceMask, shade, drawn, lit } = scratch;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const x = cells.x[i] as number;
    const y = cells.y[i] as number;
    const ch = cells.h[i] as number;
    cam.project(x, y, ch);
    geo.cx[i] = cam.sx;
    geo.cy[i] = cam.sy;
    geo.ps[i] = cam.ps;
    const margin = cam.ps * 2.4 + 6;
    if (cam.sx < -margin || cam.sx > w + margin || cam.sy < -margin - 30 || cam.sy > h + margin) {
      continue;
    }
    drawn[i] = 1;
    count++;
    let mask = 0;
    for (let k = 0; k < 6; k++) {
      cam.project(x + (COS[k] as number) * R, y + (SIN[k] as number) * R, ch);
      tx[k] = cam.sx;
      ty[k] = cam.sy;
      geo.top[i * 12 + k * 2] = cam.sx;
      geo.top[i * 12 + k * 2 + 1] = cam.sy;
      side[i * 24 + k * 2] = cam.sx;
      side[i * 24 + k * 2 + 1] = cam.sy;
      cam.project(x + (COS[k] as number) * R, y + (SIN[k] as number) * R, 0);
      side[i * 24 + 12 + k * 2] = cam.sx;
      side[i * 24 + 12 + k * 2 + 1] = cam.sy;
    }
    // A side face is visible when its projected quad is wound the right way.
    for (let k = 0; k < 6; k++) {
      const k2 = (k + 1) % 6;
      const ex = (tx[k2] as number) - (tx[k] as number);
      const ey = (ty[k2] as number) - (ty[k] as number);
      const dxs = (side[i * 24 + 12 + k * 2] as number) - (tx[k] as number);
      const dys = (side[i * 24 + 12 + k * 2 + 1] as number) - (ty[k] as number);
      if (ex * dys - ey * dxs < 0) mask |= 1 << k;
    }
    faceMask[i] = mask;
    const col = cells.col[i] as number;
    const row = cells.row[i] as number;
    const lum = ((cells.h[i] as number) - 0.5) / 1.7 + (hash01(col, row, 5) - 0.5) * 0.4;
    shade[i] = Math.max(0, Math.min(shadeCount - 1, Math.floor(lum * shadeCount)));
    // A few cells glow from within, like the lit cubes in the look target.
    lit[i] = hash01(col, row, 17) > 0.925 ? 1 : 0;
  }
  geo.count = n;
  const wt = opts.weight;
  const weightOf = (i: number): number => (wt ? (wt[i] as number) : 1);

  // Colours.
  const deep = mix(pal.ink, pal.accentDeep, 0.13);
  const topLit = mix(pal.ink, pal.accent, 0.3);
  const deepStr = [0, 1, 2, 3].map(
    (s) => `rgba(${deep[0]},${deep[1]},${deep[2]},${(0.86 + s * 0.035).toFixed(3)})`,
  );
  const deepDim = `rgba(${deep[0]},${deep[1]},${deep[2]},0.36)`;
  const sheenStr = `rgba(${topLit[0]},${topLit[1]},${topLit[2]},0.1)`;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';

  if (opts.simple) {
    paintRange(0, n, true);
    void h;
    return count;
  }

  // Row chunks, north to south (cells are stored row by row).
  let start = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || cells.row[i] !== cells.row[start]) {
      paintRange(start, i, false);
      start = i;
    }
  }
  void h;
  return count;

  /** Paints cells [i0, i1): side faces, then tops, sheen, rims and creases. */
  function paintRange(i0: number, i1: number, simple: boolean): void {
    if (!simple) {
      // Side faces: per orientation and band, one batched fill, grouped by dimming weight (full, dim).
      for (const [k, light] of FACES) {
        const k2 = (k + 1) % 6;
        for (let band = 0; band < 3; band++) {
          const u0 = BAND_U[band] as number;
          const u1 = BAND_U[band + 1] as number;
          for (let pass = 0; pass < 2; pass++) {
            const full = pass === 0;
            ctx.beginPath();
            let any = false;
            for (let i = i0; i < i1; i++) {
              if (!drawn[i] || !((faceMask[i] as number) & (1 << k))) continue;
              if (weightOf(i) >= 0.999 !== full) continue;
              const o = i * 24;
              const ax = side[o + k * 2] as number;
              const ay = side[o + k * 2 + 1] as number;
              const bx = side[o + k2 * 2] as number;
              const by = side[o + k2 * 2 + 1] as number;
              const cx = side[o + 12 + k2 * 2] as number;
              const cy = side[o + 12 + k2 * 2 + 1] as number;
              const dx = side[o + 12 + k * 2] as number;
              const dy = side[o + 12 + k * 2 + 1] as number;
              ctx.moveTo(ax + (dx - ax) * u0, ay + (dy - ay) * u0);
              ctx.lineTo(bx + (cx - bx) * u0, by + (cy - by) * u0);
              ctx.lineTo(bx + (cx - bx) * u1, by + (cy - by) * u1);
              ctx.lineTo(ax + (dx - ax) * u1, ay + (dy - ay) * u1);
              ctx.closePath();
              any = true;
            }
            if (any) {
              ctx.fillStyle = pal.rAccentDeep.a((BAND_ALPHA[band] as number) * light * (full ? 1 : 0.32));
              ctx.fill();
            }
          }
        }
      }
      // The glow where a cube meets the ground: bright foot edges of the visible faces.
      for (let pass = 0; pass < 4; pass++) {
        const bright = (pass & 1) !== 0;
        const full = (pass & 2) === 0;
        ctx.beginPath();
        let any = false;
        for (let i = i0; i < i1; i++) {
          if (!drawn[i]) continue;
          if (weightOf(i) >= 0.999 !== full) continue;
          if (((shade[i] as number) >= 2 || lit[i] === 1) !== bright) continue;
          const o = i * 24;
          const mask = faceMask[i] as number;
          for (let k = 0; k < 6; k++) {
            if (!(mask & (1 << k))) continue;
            const k2 = (k + 1) % 6;
            ctx.moveTo(side[o + 12 + k * 2] as number, side[o + 12 + k * 2 + 1] as number);
            ctx.lineTo(side[o + 12 + k2 * 2] as number, side[o + 12 + k2 * 2 + 1] as number);
            any = true;
          }
        }
        if (any) {
          ctx.lineWidth = bright ? 1.1 : 0.8;
          ctx.strokeStyle = pal.rAccent.a((bright ? 0.7 : 0.34) * (full ? 1 : 0.3));
          ctx.stroke();
        }
      }
    }

    // Top faces: four shades, each split into full and dimmed.
    for (let s = 0; s < shadeCount; s++) {
      for (let pass = 0; pass < 2; pass++) {
        const full = pass === 0;
        ctx.beginPath();
        let any = false;
        for (let i = i0; i < i1; i++) {
          if (!drawn[i] || shade[i] !== s) continue;
          if (weightOf(i) >= 0.999 !== full) continue;
          const o = i * 12;
          ctx.moveTo(geo.top[o] as number, geo.top[o + 1] as number);
          for (let k = 1; k < 6; k++)
            ctx.lineTo(geo.top[o + k * 2] as number, geo.top[o + k * 2 + 1] as number);
          ctx.closePath();
          any = true;
        }
        if (any) {
          ctx.fillStyle = full ? (deepStr[s] as string) : deepDim;
          ctx.fill();
        }
      }
    }

    // Brighter inner sheen on the lit shades, so the field has a little texture.
    ctx.beginPath();
    let sheen = false;
    for (let i = i0; i < i1; i++) {
      if (!drawn[i] || shade[i] !== shadeCount - 1 || weightOf(i) < 0.999) continue;
      const o = i * 12;
      const cx = geo.cx[i] as number;
      const cy = geo.cy[i] as number;
      ctx.moveTo(cx + ((geo.top[o] as number) - cx) * 0.52, cy + ((geo.top[o + 1] as number) - cy) * 0.52);
      for (let k = 1; k < 6; k++) {
        ctx.lineTo(
          cx + ((geo.top[o + k * 2] as number) - cx) * 0.52,
          cy + ((geo.top[o + k * 2 + 1] as number) - cy) * 0.52,
        );
      }
      ctx.closePath();
      sheen = true;
    }
    if (sheen) {
      ctx.fillStyle = sheenStr;
      ctx.fill();
    }

    if (!simple) {
      // Cells that glow from within.
      ctx.beginPath();
      let any = false;
      for (let i = i0; i < i1; i++) {
        if (!drawn[i] || lit[i] !== 1 || weightOf(i) < 0.999) continue;
        const o = i * 12;
        ctx.moveTo(geo.top[o] as number, geo.top[o + 1] as number);
        for (let k = 1; k < 6; k++)
          ctx.lineTo(geo.top[o + k * 2] as number, geo.top[o + k * 2 + 1] as number);
        ctx.closePath();
        any = true;
      }
      if (any) {
        ctx.fillStyle = pal.rAccent.a(0.22);
        ctx.fill();
      }

      // Rims: the edges of the top face. The front (south facing) edges are the bright ones, and brighter
      // cells carry stronger rims, so the field has coherent patches of light.
      for (let pass = 0; pass < 8; pass++) {
        const front = (pass & 1) === 0;
        const bright = (pass & 2) !== 0;
        const full = (pass & 4) === 0;
        ctx.beginPath();
        let some = false;
        for (let i = i0; i < i1; i++) {
          if (!drawn[i]) continue;
          if (weightOf(i) >= 0.999 !== full) continue;
          if (((shade[i] as number) >= 2 || lit[i] === 1) !== bright) continue;
          const o = i * 12;
          const mask = faceMask[i] as number;
          for (let k = 0; k < 6; k++) {
            const isFront = (mask & (1 << k)) !== 0;
            if (isFront !== front) continue;
            const k2 = (k + 1) % 6;
            ctx.moveTo(geo.top[o + k * 2] as number, geo.top[o + k * 2 + 1] as number);
            ctx.lineTo(geo.top[o + k2 * 2] as number, geo.top[o + k2 * 2 + 1] as number);
            some = true;
          }
        }
        if (some) {
          ctx.lineWidth = front ? 0.95 : 0.7;
          const a = (front ? (bright ? 0.95 : 0.5) : bright ? 0.34 : 0.14) * (full ? 1 : 0.3);
          ctx.strokeStyle = (bright && front ? pal.rAccentHot : pal.rAccent).a(a);
          ctx.stroke();
        }
      }
      // Vertical creases at the near corners: the edge light of a glass block.
      ctx.beginPath();
      let crease = false;
      for (let i = i0; i < i1; i++) {
        if (!drawn[i] || weightOf(i) < 0.999) continue;
        const o = i * 24;
        const mask = faceMask[i] as number;
        for (let k = 0; k < 3; k++) {
          if (!(mask & (1 << k)) && !(mask & (1 << ((k + 5) % 6)))) continue;
          ctx.moveTo(side[o + k * 2] as number, side[o + k * 2 + 1] as number);
          ctx.lineTo(side[o + 12 + k * 2] as number, side[o + 12 + k * 2 + 1] as number);
          crease = true;
        }
      }
      if (crease) {
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = pal.rAccent.a(0.42);
        ctx.stroke();
      }
    }
  }
}

const BLOOM_SCALES: readonly number[] = [4, 10];

/**
 * Soft bloom: the canvas is shrunk, then stamped back over itself additively. Each scale gives a wider
 * halo. `ctx` is the canvas's own context; it is left with the identity transform and normal compositing.
 * Used on the baked terrain layer once, and (at the higher quality tiers) over the whole figure per frame.
 */
export function bloomLayer(
  layer: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  scratchCanvases: HTMLCanvasElement[],
  strength = 0.9,
  scales: readonly number[] = BLOOM_SCALES,
): void {
  const w = layer.width;
  const h = layer.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (let i = 0; i < scales.length; i++) {
    const s = scales[i] as number;
    let sc = scratchCanvases[i];
    if (!sc) {
      sc = document.createElement('canvas');
      scratchCanvases[i] = sc;
    }
    const sw = Math.max(2, Math.ceil(w / s));
    const sh = Math.max(2, Math.ceil(h / s));
    if (sc.width !== sw || sc.height !== sh) {
      sc.width = sw;
      sc.height = sh;
    }
    const g = sc.getContext('2d');
    if (!g) continue;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, sw, sh);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(layer, 0, 0, sw, sh);
    ctx.globalAlpha = strength * (i === 0 ? 0.9 : 0.75);
    ctx.drawImage(sc, 0, 0, sw, sh, 0, 0, w, h);
  }
  ctx.restore();
}
