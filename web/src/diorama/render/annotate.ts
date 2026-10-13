/**
 * The blueprint annotation language: hairline leaders to numbered markers, dimension lines with end
 * ticks, corner brackets and a probe reticle. Every primitive takes a draw-in progress `p` (0..1) and
 * *draws itself* (a line grows, a circle sweeps, text is wiped in); nothing fades in.
 */
import type { Palette } from './palette';

const ease = (t: number): number => 1 - (1 - t) ** 3;
const seg = (p: number, a: number, b: number): number => (p <= a ? 0 : p >= b ? 1 : (p - a) / (b - a));

export function setLabelFont(ctx: CanvasRenderingContext2D, pal: Palette, px = 10.5): void {
  ctx.font = `500 ${px}px ${pal.mono}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = '0.9px';
}

function clearLetterSpacing(ctx: CanvasRenderingContext2D): void {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = '0px';
}

/** Text wiped in from the left by clipping, so it is "drawn" rather than faded. */
function wipeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  p: number,
  w: number,
): void {
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 1, y - 12, (w + 2) * p, 24);
  ctx.clip();
  ctx.fillText(text, x, y);
  ctx.restore();
}

export interface LeaderSpec {
  /** On the object. */
  ax: number;
  ay: number;
  /** Centre of the numbered marker. */
  mx: number;
  my: number;
  /** A number, or a short glyph such as an em-less dash. */
  marker: string;
  /** Text next to the marker. */
  label: string;
  /** Which side the label sits on. */
  side: 'left' | 'right';
  /** Marker radius. */
  radius?: number;
  /** Highlight colour: the default is the accent. */
  hot?: boolean;
  /** A small drawn glyph inside the marker ring in place of the marker text. */
  glyph?: 'disk';
  /** `warn` draws the leader, ring, glyph and words in the warning colour (something was lost). */
  tone?: 'warn';
  /** Label font size in px (default 10.5). */
  px?: number;
}

/**
 * A hollow disk: an open cylinder (rim ellipse, two sides, a base curve), outline only, so it reads as
 * "a disk with nothing on it". Drawn inside a marker of radius `r` centred on (x, y).
 */
function drawDiskGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string): void {
  const rx = r * 0.5;
  const ry = r * 0.2;
  const half = r * 0.3;
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = colour;
  ctx.beginPath();
  // The rim.
  ctx.ellipse(x, y - half, rx, ry, 0, 0, Math.PI * 2);
  // The sides and the curve of the base.
  ctx.moveTo(x - rx, y - half);
  ctx.lineTo(x - rx, y + half);
  ctx.ellipse(x, y + half, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(x + rx, y - half);
  ctx.stroke();
}

/** Measures a label at the current font plus its tracking. */
export function measureLabel(ctx: CanvasRenderingContext2D, label: string): number {
  return ctx.measureText(label).width + label.length * 0.9;
}

export function drawLeader(ctx: CanvasRenderingContext2D, pal: Palette, s: LeaderSpec, p: number): void {
  if (p <= 0) return;
  const r = s.radius ?? 9;
  const line = ease(seg(p, 0, 0.45));
  const ring = ease(seg(p, 0.35, 0.7));
  const text = ease(seg(p, 0.55, 1));
  const lineRamp = s.tone === 'warn' ? pal.rWarn : s.hot ? pal.rHot : pal.rAccentHot;

  // Leader line from the object to the marker's rim.
  const dx = s.mx - s.ax;
  const dy = s.my - s.ay;
  const len = Math.hypot(dx, dy) || 1;
  const ex = s.ax + (dx / len) * (len - r) * line;
  const ey = s.ay + (dy / len) * (len - r) * line;
  ctx.lineWidth = 1;
  ctx.strokeStyle = lineRamp.a(0.75);
  ctx.beginPath();
  ctx.moveTo(s.ax, s.ay);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  // Anchor dot.
  ctx.fillStyle = pal.rHot.a(0.95);
  ctx.beginPath();
  ctx.arc(s.ax, s.ay, 2, 0, Math.PI * 2);
  ctx.fill();

  if (ring > 0) {
    // Marker circle sweeps round from the leader's side.
    const start = Math.atan2(-dy, -dx);
    ctx.strokeStyle = lineRamp.a(0.95);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(s.mx, s.my, r, start, start + Math.PI * 2 * ring);
    ctx.stroke();
    if (ring > 0.7) {
      if (s.glyph === 'disk') {
        drawDiskGlyph(ctx, s.mx, s.my, r, pal.rHot.a(0.95));
      } else {
        setLabelFont(ctx, pal, 10);
        ctx.textAlign = 'center';
        ctx.fillStyle = pal.rHot.a(0.95);
        ctx.fillText(s.marker, s.mx, s.my + 0.5);
        clearLetterSpacing(ctx);
      }
    }
  }

  if (text > 0 && s.label) {
    setLabelFont(ctx, pal, s.px ?? 10.5);
    const w = measureLabel(ctx, s.label);
    const tx = s.side === 'right' ? s.mx + r + 8 : s.mx - r - 8 - w;
    // A dark plate keeps the text readable over bright pillars; it is wiped in with the text.
    ctx.fillStyle = pal.rInk.a(0.74);
    ctx.fillRect(tx - 4, s.my - 9, (w + 8) * text, 18);
    ctx.fillStyle = (s.tone === 'warn' ? pal.rWarn : pal.rText).a(0.95);
    wipeText(ctx, s.label, tx, s.my + 0.5, text, w);
    // Underline hairline that runs with the wipe.
    ctx.strokeStyle = lineRamp.a(0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx, s.my + 9);
    ctx.lineTo(tx + w * text, s.my + 9);
    ctx.stroke();
    clearLetterSpacing(ctx);
  }
}

export interface DimensionSpec {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  label: string;
  /** Push the label off the line by this many px (perpendicular, positive is up on screen). */
  lift?: number;
}

export function drawDimension(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  s: DimensionSpec,
  p: number,
): void {
  if (p <= 0) return;
  const grow = ease(seg(p, 0, 0.7));
  const text = ease(seg(p, 0.5, 1));
  const mx = (s.ax + s.bx) / 2;
  const my = (s.ay + s.by) / 2;
  const ang = Math.atan2(s.by - s.ay, s.bx - s.ax);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  // Line grows from both ends toward the middle.
  const hx = (s.bx - s.ax) / 2;
  const hy = (s.by - s.ay) / 2;
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.rAccentHot.a(0.6);
  ctx.beginPath();
  ctx.moveTo(s.ax, s.ay);
  ctx.lineTo(s.ax + hx * grow, s.ay + hy * grow);
  ctx.moveTo(s.bx, s.by);
  ctx.lineTo(s.bx - hx * grow, s.by - hy * grow);
  ctx.stroke();
  // End ticks.
  const t = 5 * Math.min(1, grow * 3);
  ctx.beginPath();
  ctx.moveTo(s.ax + nx * t, s.ay + ny * t);
  ctx.lineTo(s.ax - nx * t, s.ay - ny * t);
  ctx.moveTo(s.bx + nx * t, s.by + ny * t);
  ctx.lineTo(s.bx - nx * t, s.by - ny * t);
  ctx.stroke();
  if (text > 0 && s.label) {
    setLabelFont(ctx, pal, 10);
    const w = measureLabel(ctx, s.label);
    ctx.save();
    ctx.translate(mx + nx * (s.lift ?? -10), my + ny * (s.lift ?? -10));
    ctx.fillStyle = pal.rInk.a(0.74);
    ctx.fillRect(-w / 2 - 4, -9, (w + 8) * text, 18);
    ctx.fillStyle = pal.rText.a(0.9);
    ctx.textAlign = 'left';
    wipeText(ctx, s.label, -w / 2, 0, text, w);
    ctx.restore();
    clearLetterSpacing(ctx);
  }
}

/** Four corner brackets around a rectangle, drawn from the corners inward. */
export function drawBrackets(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  p: number,
  arm = 12,
  alpha = 0.55,
): void {
  if (p <= 0) return;
  const a = arm * ease(p);
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.rAccentHot.a(alpha);
  ctx.beginPath();
  ctx.moveTo(x0, y0 + a);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x0 + a, y0);
  ctx.moveTo(x1 - a, y0);
  ctx.lineTo(x1, y0);
  ctx.lineTo(x1, y0 + a);
  ctx.moveTo(x1, y1 - a);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - a, y1);
  ctx.moveTo(x0 + a, y1);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x0, y1 - a);
  ctx.stroke();
}

/** A ruler of ticks along a line, drawn outward from its middle. */
export function drawRuler(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  x0: number,
  x1: number,
  y: number,
  p: number,
  alpha = 0.34,
): void {
  if (p <= 0) return;
  const mid = (x0 + x1) / 2;
  const half = ((x1 - x0) / 2) * ease(p);
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.rAccentHot.a(alpha);
  ctx.beginPath();
  ctx.moveTo(mid - half, y);
  ctx.lineTo(mid + half, y);
  const step = 10;
  for (let x = mid - Math.floor(half / step) * step; x <= mid + half; x += step) {
    const long = Math.round((x - mid) / step) % 5 === 0;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + (long ? 6 : 3));
  }
  ctx.stroke();
}

/** The probe: a thin crosshair with a gap at the centre and a mono readout. Never replaces the cursor. */
export function drawProbe(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  x: number,
  y: number,
  lines: readonly string[],
  w: number,
  h: number,
): void {
  const arm = 9;
  const gap = 3;
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.rHot.a(0.85);
  ctx.beginPath();
  ctx.moveTo(x - gap - arm, y);
  ctx.lineTo(x - gap, y);
  ctx.moveTo(x + gap, y);
  ctx.lineTo(x + gap + arm, y);
  ctx.moveTo(x, y - gap - arm);
  ctx.lineTo(x, y - gap);
  ctx.moveTo(x, y + gap);
  ctx.lineTo(x, y + gap + arm);
  ctx.stroke();
  if (lines.length === 0) return;
  setLabelFont(ctx, pal, 10.5);
  let tw = 0;
  for (const l of lines) tw = Math.max(tw, measureLabel(ctx, l));
  const bw = tw + 14;
  const bh = lines.length * 15 + 8;
  let bx = x + 16;
  let by = y + 14;
  if (bx + bw > w - 6) bx = x - 16 - bw;
  if (by + bh > h - 6) by = y - 14 - bh;
  if (bx < 6) bx = 6;
  if (by < 6) by = 6;
  ctx.fillStyle = pal.rInk.a(0.82);
  ctx.strokeStyle = pal.rAccentHot.a(0.45);
  ctx.beginPath();
  // A chamfered box: the top right and bottom left corners are cut.
  const c = 6;
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + bw - c, by);
  ctx.lineTo(bx + bw, by + c);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + c, by + bh);
  ctx.lineTo(bx, by + bh - c);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = pal.rText.a(0.98);
  lines.forEach((l, i) => {
    ctx.fillStyle = i === 0 ? pal.rHot.a(0.98) : pal.rText.a(0.95);
    ctx.fillText(l, bx + 7, by + 12 + i * 15);
  });
  clearLetterSpacing(ctx);
}
