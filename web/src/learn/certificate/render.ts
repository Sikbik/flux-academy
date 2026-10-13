/**
 * Draws the certificate on a canvas. Browser only (it needs fonts and images); the words and the numbers
 * come from `text.ts` and `layout.ts`, which are pure and tested.
 *
 * Order: the backdrop plate, a faint tier wash, the real Flux lockup, a hairline, then the text rows, all
 * inside the safe zone. `drawCertificate` is deterministic: the same model and assets give the same
 * pixels, so the preview and the downloaded file are the same picture at two sizes.
 */

import { ART } from '@/content/art';
import {
  CERT_HEIGHT,
  CERT_WIDTH,
  ellipsize,
  fitSize,
  LOCKUP_ASPECT,
  MAX_TEXT_WIDTH,
  ROWS,
  safeRect,
} from './layout';
import type { CertificateModel } from './text';

export interface CertificateAssets {
  backdrop: CanvasImageSource;
  lockup: CanvasImageSource;
}

/** The official lockup with the blue symbol and white wordmark, from the brand kit, unmodified. */
export const LOCKUP_URL = '/brand/lockup/flux-logo-blue-white.svg';

/** Colours of the picture. They mirror the design tokens (a canvas cannot read `var()`). */
export const COLORS = {
  text1: '#ffffff',
  text2: '#d8dde8',
  text3: '#9aa4b8',
  flux: '#86a1da',
  line: 'rgba(134, 161, 218, 0.45)',
  tier: { cumulus: '#36d3ff', nimbus: '#c77dff', stratus: '#ffc857' },
} as const;

const SANS = '"Open Sans Variable", "Open Sans", "Segoe UI", system-ui, sans-serif';
const DISPLAY = '"Montserrat Variable", Montserrat, "Segoe UI", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

/** The faces the certificate uses, as `font` shorthand strings for `document.fonts.load`. */
export const FONT_FACES = [`700 84px ${DISPLAY}`, `400 29px ${SANS}`, `500 21px ${MONO}`] as const;

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

let assets: Promise<CertificateAssets> | null = null;

/** Loads the backdrop and the lockup once. A failure is not cached, so a retry can succeed. */
export function loadCertificateAssets(): Promise<CertificateAssets> {
  if (!assets) {
    assets = Promise.all([loadImage(ART['certificate-backdrop'].src), loadImage(LOCKUP_URL)])
      .then(([backdrop, lockup]) => ({ backdrop, lockup }))
      .catch((error: unknown) => {
        assets = null;
        throw error;
      });
  }
  return assets;
}

/** Resolves when the three faces are ready (or when the browser cannot say, which is fine: fallbacks draw). */
export async function ensureCertificateFonts(
  sample = 'Aa Certificate of completion 0123456789',
): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all(FONT_FACES.map((face) => document.fonts.load(face, sample)));
  } catch {
    // Fall back to the system faces in the stacks above.
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

type Ctx = CanvasRenderingContext2D;

function hexPath(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Text with letter spacing, drawn glyph by glyph so it works in every browser. Centred on `cx`. */
function drawTracked(ctx: Ctx, text: string, cx: number, y: number, tracking: number): void {
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((s, w) => s + w, 0) + tracking * Math.max(0, chars.length - 1);
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  let x = cx - total / 2;
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += (widths[i] ?? 0) + tracking;
  });
  ctx.textAlign = align;
}

function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Draws the certificate at `scale` times its logical size (1500 x 1000). The context's canvas must be
 * `CERT_WIDTH * scale` by `CERT_HEIGHT * scale`.
 */
export function drawCertificate(ctx: Ctx, model: CertificateModel, a: CertificateAssets, scale = 1): void {
  const cx = CERT_WIDTH / 2;
  const tier = COLORS.tier[model.tier];
  const safe = safeRect();

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, CERT_WIDTH, CERT_HEIGHT);
  ctx.fillStyle = '#060b15';
  ctx.fillRect(0, 0, CERT_WIDTH, CERT_HEIGHT);
  ctx.drawImage(a.backdrop, 0, 0, CERT_WIDTH, CERT_HEIGHT);

  // A faint wash of the tier colour behind the name and the rank, so the colour is not only in the type.
  const wash = ctx.createRadialGradient(cx, 560, 0, cx, 560, 470);
  wash.addColorStop(0, rgba(tier, 0.11));
  wash.addColorStop(1, rgba(tier, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(safe.x, safe.y, safe.width, safe.height);

  // The real lockup, unmodified, centred.
  const lockupWidth = ROWS.lockupHeight * LOCKUP_ASPECT;
  ctx.drawImage(a.lockup, cx - lockupWidth / 2, ROWS.lockupTop, lockupWidth, ROWS.lockupHeight);

  // Hairline with a small hex at the middle.
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 250, ROWS.ruleY);
  ctx.lineTo(cx - 18, ROWS.ruleY);
  ctx.moveTo(cx + 18, ROWS.ruleY);
  ctx.lineTo(cx + 250, ROWS.ruleY);
  ctx.stroke();
  hexPath(ctx, cx, ROWS.ruleY, 9);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Eyebrow.
  ctx.fillStyle = COLORS.flux;
  ctx.font = `500 ${ROWS.eyebrowSize}px ${MONO}`;
  drawTracked(ctx, model.eyebrow, cx, ROWS.eyebrowY, 5);

  // Name: as large as fits, then cut with an ellipsis if even the smallest size does not.
  const nameFace = (size: number) => `700 ${size}px ${DISPLAY}`;
  ctx.font = nameFace(ROWS.nameSize);
  const fit = fitSize(
    (size) => {
      ctx.font = nameFace(size);
      return ctx.measureText(model.nameShown).width;
    },
    MAX_TEXT_WIDTH,
    ROWS.nameSize,
    ROWS.nameMinSize,
  );
  ctx.font = nameFace(fit.size);
  const shownName = fit.fits
    ? model.nameShown
    : ellipsize(model.nameShown, (t) => ctx.measureText(t).width, MAX_TEXT_WIDTH);
  ctx.fillStyle = model.name ? COLORS.text1 : COLORS.text3;
  ctx.fillText(shownName, cx, ROWS.nameY);

  // What was done.
  ctx.fillStyle = COLORS.text2;
  ctx.font = `400 ${ROWS.sentenceSize}px ${SANS}`;
  ctx.fillText(
    ellipsize(model.sentence, (t) => ctx.measureText(t).width, MAX_TEXT_WIDTH),
    cx,
    ROWS.sentenceY,
  );

  // The rank, in the tier colour, between two hexes.
  ctx.font = `700 ${ROWS.rankSize}px ${DISPLAY}`;
  const rankWidth = ctx.measureText(model.rank).width;
  ctx.fillStyle = tier;
  ctx.fillText(model.rank, cx, ROWS.rankY);
  const hexY = ROWS.rankY - ROWS.rankSize * 0.34;
  for (const side of [-1, 1]) {
    const hx = cx + side * (rankWidth / 2 + 44);
    ctx.strokeStyle = tier;
    ctx.lineWidth = 2.5;
    hexPath(ctx, hx, hexY, 13);
    ctx.stroke();
    ctx.fillStyle = rgba(tier, 0.35);
    hexPath(ctx, hx, hexY, 6);
    ctx.fill();
  }

  // Facts and date.
  ctx.fillStyle = COLORS.text2;
  ctx.font = `500 ${ROWS.factsSize}px ${MONO}`;
  drawTracked(ctx, `${model.facts.toUpperCase()}  /  ${model.date.toUpperCase()}`, cx, ROWS.factsY, 2.5);

  // The two disclaimer lines. Always drawn.
  ctx.fillStyle = COLORS.text1;
  ctx.font = `600 ${ROWS.disclaimerSize}px ${SANS}`;
  ctx.fillText(
    ellipsize(model.disclaimer, (t) => ctx.measureText(t).width, MAX_TEXT_WIDTH),
    cx,
    ROWS.disclaimerY,
  );
  ctx.fillStyle = COLORS.text3;
  ctx.font = `400 ${ROWS.detailSize}px ${SANS}`;
  ctx.fillText(
    ellipsize(model.disclaimerDetail, (t) => ctx.measureText(t).width, MAX_TEXT_WIDTH),
    cx,
    ROWS.detailY,
  );

  ctx.restore();
}

/** Renders the certificate to a PNG at `scale` times its logical size (2 is 3000 x 2000). */
export async function renderCertificatePng(
  model: CertificateModel,
  a: CertificateAssets,
  scale = 2,
): Promise<Blob> {
  await ensureCertificateFonts(model.nameShown);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(CERT_WIDTH * scale);
  canvas.height = Math.round(CERT_HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the certificate.');
  drawCertificate(ctx, model, a, scale);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be saved.'))),
      'image/png',
    );
  });
}
