/**
 * Canvas painting for the Backdrop. Everything here runs once per resize or accent change;
 * nothing runs per frame (the drift and the breathing are compositor animations in CSS).
 */
import { cellCenter, hexVertices, type LitCell, SIDE, type Tile, tileEdges } from './lattice';

export interface Palette {
  /** The hairline colour: the `--lattice-line` token, as a CSS colour. */
  line: string;
  /** `r g b` triples. */
  accent: string;
  hot: string;
}

const FALLBACK: Palette = { line: 'rgb(79 122 212 / 0.14)', accent: '79 122 212', hot: '174 198 255' };

const triple = (v: string) => v.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

/** Reads the accent roles once from an element, so tier and accent overrides are honoured. */
export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const get = (name: string) => cs.getPropertyValue(name).trim();
  return {
    line: get('--lattice-line') || FALLBACK.line,
    accent: triple(get('--accent-rgb')) || FALLBACK.accent,
    hot: triple(get('--accent-hot-rgb')) || FALLBACK.hot,
  };
}

export const paletteKey = (p: Palette) => `${p.line}|${p.accent}|${p.hot}`;

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d');
}

/** Hairline width in device pixels: one, until the display is dense enough for two. */
const hairlinePx = (dpr: number) => Math.max(1, Math.floor(dpr + 0.25));

/**
 * One seamless tile of hairlines, exactly (width * dpr) x (height * dpr) device pixels. Edges
 * that cross the tile border are drawn again one period over, so the tile wraps.
 */
export function renderTile(tile: Tile, dpr: number, palette: Palette): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(tile.width * dpr);
  canvas.height = Math.round(tile.height * dpr);
  const ctx = context(canvas);
  if (!ctx) return canvas;
  const px = hairlinePx(dpr);
  // An odd line width is centred on a half pixel so verticals are crisp, an even one on a pixel.
  const nudge = px % 2 === 1 ? 0.5 : 0;
  ctx.setTransform(dpr, 0, 0, dpr, nudge, nudge);
  ctx.lineWidth = px / dpr;
  ctx.lineCap = 'square';
  ctx.strokeStyle = palette.line;
  ctx.beginPath();
  for (const e of tileEdges(tile)) {
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const dx = i * tile.width;
        const dy = j * tile.height;
        ctx.moveTo(e.x1 + dx, e.y1 + dy);
        ctx.lineTo(e.x2 + dx, e.y2 + dy);
      }
    }
  }
  ctx.stroke();
  return canvas;
}

/** Fills a canvas of `w` x `h` CSS px (a multiple of 4) with the tile, at `dpr`. */
export function paintLines(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  tile: Tile,
  dpr: number,
  palette: Palette,
): void {
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = context(canvas);
  if (!ctx) return;
  const pattern = ctx.createPattern(renderTile(tile, dpr, palette), 'repeat');
  if (!pattern) return;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
  const v = hexVertices(cx, cy, scale);
  ctx.beginPath();
  v.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
}

/**
 * One breathing layer: soft lit cells at `scale` device pixels per CSS px, repeated at the
 * layer's period across a canvas of `w` x `h` CSS px. The glow is a gradient, so half
 * resolution costs nothing visible and a quarter of the memory.
 */
export function paintLit(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  cells: readonly LitCell[],
  period: { width: number; height: number },
  scale: number,
  palette: Palette,
): void {
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = context(canvas);
  if (!ctx) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const nx = Math.ceil(w / period.width) + 1;
  const ny = Math.ceil(h / period.height) + 1;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      for (const cell of cells) {
        const o = cellCenter(cell.c, cell.r);
        const cx = o.x + i * period.width;
        const cy = o.y + j * period.height;
        if (cx < -SIDE * 2 || cx > w + SIDE * 2 || cy < -SIDE * 2 || cy > h + SIDE * 2) continue;
        hexPath(ctx, cx, cy, 0.97);
        // A pane of light: an even wash, a bloom at the centre, a firmer rim.
        ctx.fillStyle = `rgb(${palette.accent} / ${(0.085 * cell.k).toFixed(3)})`;
        ctx.fill();
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIDE * 0.85);
        g.addColorStop(0, `rgb(${palette.hot} / ${(0.2 * cell.k).toFixed(3)})`);
        g.addColorStop(1, `rgb(${palette.accent} / 0)`);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = `rgb(${palette.accent} / ${(0.34 * cell.k).toFixed(3)})`;
        ctx.stroke();
      }
    }
  }
}
