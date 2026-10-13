import { type CSSProperties, useEffect, useRef } from 'react';
import { cn } from '../internal/cn';
import { observe } from '../internal/observer';
import styles from './Backdrop.module.css';
import {
  createTile,
  driftSeconds,
  extent,
  LIT_LAYERS,
  LIT_SCALE,
  litCells,
  snapDpr,
  stepsFor,
} from './lattice';
import { paintLines, paintLit, paletteKey, readPalette } from './paint';

export interface BackdropProps {
  /** Overall strength, 0..1. At 1 the hairlines are drawn at the `--lattice-line` token. Default 1. */
  intensity?: number;
  /** How far the field recedes behind content, 0..1; adds a vignette. Default 0.35. */
  dim?: number;
  /** Freezes the drift and the breathing. */
  paused?: boolean;
  /** Drift speed, as a multiple of the base 1.5 px/s. 0 holds the lattice still. Default 1. */
  drift?: number;
  /**
   * Ticks per second of the drift and the breathing. The default 4 moves in sub-pixel steps
   * that read as continuous at this speed and lets the compositor idle between them; 0 is a
   * continuous 60 fps animation (smoother, costs a frame every vsync).
   */
  fps?: number;
  /** Fill the nearest positioned ancestor instead of the viewport. */
  contained?: boolean;
  className?: string;
}

const HAIR = createTile(8, 6);
const LAYERS = LIT_LAYERS.map((spec) => ({
  spec,
  period: createTile(spec.cols, spec.rows),
  cells: litCells(spec),
}));

// A pointy-top hexagon of radius 40 in a -50..50 box.
const RING = [0, 60, 120, 180, 240, 300]
  .map((deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(Math.cos(a) * 40).toFixed(3)},${(Math.sin(a) * 40).toFixed(3)}`;
  })
  .join(' ');

// Breathing cycles in seconds: multiples of 8 / fps at 4 fps, so every step lands on the same tick.
const BREATHE = [8, 12, 16];

const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));

/**
 * The calm lattice behind non-home pages. A single seamless tile of hairlines and three
 * layers of sparse lit cells are painted once to canvases (and again when the size, density
 * or accent changes); the drift and the breathing are compositor animations, so a running
 * backdrop costs the main thread nothing. It pauses when the tab is hidden, is static under
 * reduced motion, and hides under forced colors.
 *
 * Content above it must be positioned (`position: relative`) to paint over it; the backdrop
 * sits at `--z-backdrop`.
 *
 *   <Backdrop dim={0.5} />
 *   <section style={{ position: 'relative' }}><Backdrop contained /> ... </section>
 */
export function Backdrop({
  intensity = 1,
  dim = 0.35,
  paused = false,
  drift = 1,
  fps = 4,
  contained = false,
  className,
}: BackdropProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLCanvasElement>(null);
  const litRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    const lines = linesRef.current;
    if (!root || !lines) return;

    const done = { w: 0, h: 0, dpr: 0, key: '', lite: false, lit: LAYERS.map(() => ({ w: 0, h: 0 })) };
    let timer = 0;
    let first = true;

    const paint = () => {
      const vw = root.clientWidth;
      const vh = root.clientHeight;
      if (vw < 1 || vh < 1) return;
      const lite = document.documentElement.dataset.glass === 'lite';
      // Grow-only: a mobile URL bar showing and hiding must not repaint the field.
      const w = Math.max(done.w, extent(vw, HAIR.width));
      const h = Math.max(done.h, extent(vh, HAIR.height));
      const dpr = snapDpr(window.devicePixelRatio || 1, w, h);
      const palette = readPalette(root);
      const key = paletteKey(palette);
      const restyle = key !== done.key || dpr !== done.dpr || lite !== done.lite;

      if (restyle || w !== done.w || h !== done.h) {
        paintLines(lines, w, h, HAIR, dpr, palette);
        done.w = w;
        done.h = h;
      }
      LAYERS.forEach((layer, i) => {
        const canvas = litRefs.current[i];
        const have = done.lit[i];
        if (!canvas || !have) return;
        if (lite) {
          if (have.w !== 0) {
            canvas.width = 0;
            canvas.height = 0;
            have.w = 0;
            have.h = 0;
          }
          return;
        }
        const lw = Math.max(have.w, extent(vw, layer.period.width));
        const lh = Math.max(have.h, extent(vh, layer.period.height));
        if (restyle || lw !== have.w || lh !== have.h) {
          paintLit(canvas, lw, lh, layer.cells, layer.period, LIT_SCALE, palette);
          have.w = lw;
          have.h = lh;
        }
      });
      done.dpr = dpr;
      done.key = key;
      done.lite = lite;
    };

    // The first paint is immediate; later ones wait for the resize to settle.
    const schedule = () => {
      if (first) {
        first = false;
        paint();
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(paint, 120);
    };

    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    ro?.observe(root);
    if (!ro) schedule();
    window.addEventListener('resize', schedule);

    const mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-accent', 'data-glass'],
    });

    const onVisibility = () => {
      root.dataset.hidden = document.hidden ? 'true' : 'false';
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);

    const stopView = contained
      ? observe(root, (entry) => {
          root.dataset.offscreen = entry.isIntersecting ? 'false' : 'true';
        })
      : () => {};

    return () => {
      window.clearTimeout(timer);
      ro?.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', onVisibility);
      stopView();
    };
  }, [contained]);

  const speed = Math.max(0, Number.isFinite(drift) ? drift : 1);
  const strength = clamp01(intensity);
  const d = clamp01(dim);
  const veil = 1 - strength * (1 - 0.72 * d);
  const veilEdge = veil + (1 - veil) * (0.22 + 0.4 * d);

  const rate = Math.max(0, Number.isFinite(fps) ? fps : 4);
  const vars: Record<string, string> = {
    '--veil': veil.toFixed(3),
    '--veil-edge': veilEdge.toFixed(3),
  };
  if (speed > 0) {
    // One loop is one period; the steps tick `rate` times a second (or run continuously).
    const loops = [HAIR, ...LAYERS.map((l) => l.period)].map((t) => driftSeconds(t.width, speed));
    loops.forEach((seconds, i) => {
      vars[`--dur-${i}`] = `${seconds.toFixed(2)}s`;
      vars[`--tf-${i}`] = rate > 0 ? `steps(${stepsFor(seconds, rate)}, end)` : 'linear';
    });
  }
  // The breathing keyframes have eight segments, so each gets an eighth of the cycle's steps.
  BREATHE.forEach((seconds, i) => {
    vars[`--tf-b${i}`] = rate > 0 ? `steps(${stepsFor(seconds, rate, 8)}, end)` : 'linear';
  });

  return (
    <div
      ref={rootRef}
      className={cn(styles.root, className)}
      data-contained={contained ? 'true' : undefined}
      data-paused={paused ? 'true' : undefined}
      data-still={speed === 0 ? 'true' : undefined}
      data-dim={d === 0 ? 'none' : d < 0.34 ? 'low' : d < 0.67 ? 'mid' : 'high'}
      style={vars as CSSProperties}
      aria-hidden="true"
    >
      <canvas ref={linesRef} className={cn(styles.field, styles.lines)} />
      {LAYERS.map((layer, i) => (
        <canvas
          key={`${layer.spec.cols}x${layer.spec.rows}`}
          ref={(el) => {
            litRefs.current[i] = el;
          }}
          className={cn(styles.field, styles.lit, styles[`lit${i}`])}
        />
      ))}
      <span className={styles.veil} />
      <svg className={styles.ring} viewBox="-50 -50 100 100" focusable="false" aria-hidden="true">
        <polygon points={RING} />
      </svg>
    </div>
  );
}
