/**
 * The specimen: one app as a glass hexagonal prism with layer slabs inside and three gauge arcs on its
 * left face (see docs/design/refs/ref-specimen.webp). Drawn procedurally in screen space with a fixed
 * oblique view, so it is crisp at any size and costs a few dozen path operations.
 */
import type { Palette } from './palette';
import type { Sprites } from './sprites';

export interface CellState {
  /** Pixels the cell is lifted off its resting place (the launch). */
  lift: number;
  /** 0..1 overall energy: layers brighten and the halo swells. */
  energy: number;
  /** How many of the five layers are built, 0..5 (fractional values draw the newest one partially). */
  layers: number;
  /** CPU, RAM and disk gauges, 0..1. */
  gauges: readonly [number, number, number];
  /** Seconds, for ambient shimmer. */
  time: number;
  /** Motion allowed: bobbing and shimmer. */
  animate: boolean;
  /** 0..1 pointer proximity: a hover brightens the rims. */
  hover: number;
  /** 0..1 flash on a state change. */
  flash: number;
}

export function makeCellState(): CellState {
  return {
    lift: 0,
    energy: 0.4,
    layers: 5,
    gauges: [0.62, 0.44, 0.3],
    time: 0,
    animate: true,
    hover: 0,
    flash: 0,
  };
}

const TILT = 0.42; // vertical squash of the plan hexagon (sin of the view elevation)
const SQ3 = Math.sqrt(3) / 2;

/**
 * Draws the cell centred on (x, y) with overall width `size` px. Returns nothing; all state is in
 * `s`. `ctx` must be in CSS pixel space with 'source-over' compositing.
 */
export function drawCell(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  sprites: Sprites,
  x: number,
  y: number,
  size: number,
  s: CellState,
): void {
  const R = size / 2;
  const H = size * 0.92;
  const bob = s.animate ? Math.sin(s.time * 1.1) * size * 0.022 : 0;
  const cy = y - s.lift + bob;
  const yTop = cy - H / 2;
  const yBot = cy + H / 2;
  const dyP = R * SQ3 * TILT; // vertical offset of the plan vertices at +-60 degrees
  const pulse = s.animate ? 0.5 + 0.5 * Math.sin(s.time * 1.7) : 0.5;
  const e = Math.min(1, s.energy + s.flash * 0.6);

  // Plan vertices (flat-top hexagon): index 0 east, then clockwise on screen (south-east first).
  const vx = [R, R / 2, -R / 2, -R, -R / 2, R / 2];
  const vy = [0, dyP, dyP, 0, -dyP, -dyP];

  // 1. Pool of light under the base and a soft halo behind.
  ctx.globalCompositeOperation = 'lighter';
  const halo = size * (2.6 + 0.5 * e);
  ctx.globalAlpha = 0.35 + 0.35 * e;
  ctx.drawImage(sprites.accent, x - halo / 2, cy - halo / 2, halo, halo);
  ctx.globalAlpha = 0.5 + 0.3 * e + 0.2 * s.flash;
  const pw = size * 2.1;
  ctx.drawImage(sprites.groundAccent, x - pw / 2, yBot - pw * 0.13, pw, pw / 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // 2. Back edges, seen through the glass.
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.rAccent.a(0.28);
  ctx.beginPath();
  for (const k of [3, 4, 5]) {
    const k2 = (k + 1) % 6;
    ctx.moveTo(x + (vx[k] as number), yTop + (vy[k] as number));
    ctx.lineTo(x + (vx[k2] as number), yTop + (vy[k2] as number));
  }
  ctx.moveTo(x + (vx[4] as number), yTop + (vy[4] as number));
  ctx.lineTo(x + (vx[4] as number), yBot + (vy[4] as number));
  ctx.stroke();

  // 3. Layer slabs inside, from the floor up.
  const layerCount = 5;
  for (let i = 0; i < layerCount; i++) {
    const built = Math.max(0, Math.min(1, s.layers - i));
    if (built <= 0) continue;
    const f = (i + 0.6) / (layerCount + 0.2);
    const ly = yBot - H * 0.08 - H * 0.78 * f;
    const rr = 0.8;
    const wob = s.animate ? Math.sin(s.time * 1.3 + i * 1.1) * 0.5 + 0.5 : 0.5;
    const a = built * (0.5 + 0.35 * e + 0.12 * wob);
    ctx.beginPath();
    ctx.moveTo(x + (vx[0] as number) * rr, ly + (vy[0] as number) * rr);
    for (let k = 1; k < 6; k++) ctx.lineTo(x + (vx[k] as number) * rr, ly + (vy[k] as number) * rr);
    ctx.closePath();
    ctx.fillStyle = pal.rAccentDeep.a(0.34 * a);
    ctx.fill();
    // Front lip: the three near edges, bright, with a hairline of thickness below.
    ctx.beginPath();
    ctx.moveTo(x + (vx[0] as number) * rr, ly + (vy[0] as number) * rr);
    ctx.lineTo(x + (vx[1] as number) * rr, ly + (vy[1] as number) * rr);
    ctx.lineTo(x + (vx[2] as number) * rr, ly + (vy[2] as number) * rr);
    ctx.lineTo(x + (vx[3] as number) * rr, ly + (vy[3] as number) * rr);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = pal.rAccentHot.a(Math.min(1, 0.85 * a));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + (vx[0] as number) * rr, ly + (vy[0] as number) * rr + 1.6);
    ctx.lineTo(x + (vx[1] as number) * rr, ly + (vy[1] as number) * rr + 1.6);
    ctx.lineTo(x + (vx[2] as number) * rr, ly + (vy[2] as number) * rr + 1.6);
    ctx.lineTo(x + (vx[3] as number) * rr, ly + (vy[3] as number) * rr + 1.6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.rAccent.a(0.4 * a);
    ctx.stroke();
  }

  // 4. Dust in the glass.
  if (size > 36) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const u = (Math.sin(i * 91.7) * 0.5 + 0.5) * 2 - 1;
      const drift = s.animate ? (s.time * (0.05 + 0.04 * ((i * 7) % 5))) % 1 : (i * 0.37) % 1;
      const py = yBot - H * 0.06 - H * 0.84 * ((drift + i * 0.173) % 1);
      const px = x + u * R * 0.62;
      const a = 0.35 + 0.4 * Math.sin(i * 12.9 + s.time * 2) * (s.animate ? 1 : 0);
      ctx.fillStyle = pal.rAccentHot.a(Math.max(0.1, a) * (0.5 + 0.5 * e));
      ctx.fillRect(px, py, 1.1, 1.1);
    }
  }

  // 5. Front glass faces (left narrow, centre wide, right narrow), bottom to top gradient by bands.
  const faces: ReadonlyArray<readonly [number, number, number]> = [
    [2, 3, 0.55], // left narrow
    [1, 2, 0.8], // centre
    [0, 1, 0.65], // right narrow
  ];
  const bands = [0, 0.3, 0.7, 1];
  const bandA = [0.24, 0.1, 0.05];
  for (const [ka, kb, shade] of faces) {
    const ax = x + (vx[ka] as number);
    const ay = yTop + (vy[ka] as number);
    const bx = x + (vx[kb] as number);
    const by = yTop + (vy[kb] as number);
    for (let b = 0; b < 3; b++) {
      const u0 = H * (bands[b] as number);
      const u1 = H * (bands[b + 1] as number);
      ctx.beginPath();
      ctx.moveTo(ax, ay + u0);
      ctx.lineTo(bx, by + u0);
      ctx.lineTo(bx, by + u1);
      ctx.lineTo(ax, ay + u1);
      ctx.closePath();
      ctx.fillStyle = pal.rAccent.a((bandA[b] as number) * shade * (1 + 0.5 * e));
      ctx.fill();
    }
  }
  // Vertical edges, lit.
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = pal.rAccentHot.a(0.65 + 0.3 * s.hover);
  ctx.beginPath();
  for (const k of [0, 1, 2, 3]) {
    ctx.moveTo(x + (vx[k] as number), yTop + (vy[k] as number));
    ctx.lineTo(x + (vx[k] as number), yBot + (vy[k] as number));
  }
  ctx.stroke();
  // Base edge glow.
  ctx.beginPath();
  ctx.moveTo(x + (vx[0] as number), yBot + (vy[0] as number));
  ctx.lineTo(x + (vx[1] as number), yBot + (vy[1] as number));
  ctx.lineTo(x + (vx[2] as number), yBot + (vy[2] as number));
  ctx.lineTo(x + (vx[3] as number), yBot + (vy[3] as number));
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = pal.rAccentHot.a(0.7 + 0.25 * pulse);
  ctx.stroke();

  // 6. Top face.
  ctx.beginPath();
  ctx.moveTo(x + (vx[0] as number), yTop + (vy[0] as number));
  for (let k = 1; k < 6; k++) ctx.lineTo(x + (vx[k] as number), yTop + (vy[k] as number));
  ctx.closePath();
  ctx.fillStyle = pal.rAccent.a(0.14 + 0.1 * e);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = pal.rHot.a(0.78 + 0.2 * s.hover);
  ctx.stroke();
  // The front-top rim is the brightest line, as in the reference.
  ctx.beginPath();
  ctx.moveTo(x + (vx[0] as number), yTop + (vy[0] as number));
  ctx.lineTo(x + (vx[1] as number), yTop + (vy[1] as number));
  ctx.lineTo(x + (vx[2] as number), yTop + (vy[2] as number));
  ctx.lineTo(x + (vx[3] as number), yTop + (vy[3] as number));
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = pal.rHot.a(0.95);
  ctx.stroke();

  // 7. Gauges: three arcs stacked on the left face (CPU, RAM, disk). The face is angled, so the rings
  // are squashed horizontally.
  const faceCx = x + (vx[2] as number) + ((vx[3] as number) - (vx[2] as number)) / 2;
  const gr = Math.max(3.2, size * 0.075);
  for (let g = 0; g < 3; g++) {
    const gy = yTop + H * (0.24 + 0.26 * g) + (vy[3] as number);
    const v = Math.max(0, Math.min(1, s.gauges[g] as number));
    ctx.save();
    ctx.translate(faceCx, gy);
    ctx.scale(0.55, 1);
    ctx.lineWidth = Math.max(1.2, size * 0.022);
    ctx.lineCap = 'round';
    ctx.strokeStyle = pal.rAccent.a(0.3);
    ctx.beginPath();
    ctx.arc(0, 0, gr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = pal.rAccentHot.a(0.95);
    ctx.beginPath();
    ctx.arc(0, 0, gr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v);
    ctx.stroke();
    ctx.restore();
  }
  ctx.lineCap = 'butt';

  // 8. Bloom over the whole object.
  ctx.globalCompositeOperation = 'lighter';
  const bloom = size * 1.5;
  ctx.globalAlpha = 0.28 + 0.3 * e + 0.3 * s.flash;
  ctx.drawImage(sprites.accent, x - bloom / 2, yTop - bloom * 0.12, bloom, bloom * 0.7);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
