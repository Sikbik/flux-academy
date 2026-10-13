/**
 * The ambient backdrop used when the real ambient scene (`scenes/ambient.tsx`) is not available (not
 * built yet, no WebGL, or it failed to load): a calm field of hex cells on a 2D canvas, a few of which
 * glow slowly, with a soft ring crossing the field on every REAL block. It decorates; it does not claim
 * to be the network (no map, no counts).
 *
 * Cheap by design: one canvas, about 30 frames a second, a handful of strokes per frame, paused while the
 * tab is hidden, drawn once and left alone under reduced motion.
 */

import { useEffect, useRef } from 'react';
import { onBlock } from '@/data';
import { mulberry32 } from '@/lib/rng';
import { useReducedMotionPref } from '@/system/motion';
import styles from './Ambient.module.css';

interface Ring {
  t0: number;
}

const SQRT3 = Math.sqrt(3);
const FRAME_MS = 1000 / 30;
const RING_MS = 5200;

function accentRgb(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
  return v ? v.replace(/\s+/g, ',') : '79,122,212';
}

export function AmbientField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotionPref();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let rgb = accentRgb();
    const rings: Ring[] = [];
    const rand = mulberry32(0xf1ec5);
    // A few cells glow; their indices are chosen once so the pattern is stable.
    const glow = new Map<number, number>();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      const r = Math.max(34, Math.min(64, w / 24));
      const colW = SQRT3 * r;
      const rowH = 1.5 * r;
      const t = reduced ? 0 : now / 1000;
      // Slow camera drift.
      const ox = reduced ? 0 : Math.sin(t * 0.045) * 36;
      const oy = reduced ? 0 : Math.cos(t * 0.035) * 24;
      const cx = w / 2;
      const cy = h / 2;
      const maxD = Math.hypot(cx, cy);

      const rows = Math.ceil(h / rowH) + 2;
      const cols = Math.ceil(w / colW) + 2;
      ctx.lineWidth = 1;

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const x = col * colW + (row % 2 === 0 ? 0 : colW / 2) + ox;
          const y = row * rowH + oy;
          const idx = (row + 1) * 1000 + (col + 1);
          // Fade toward the edges so the field sits in the dark.
          const d = Math.hypot(x - cx, y - cy) / maxD;
          const edge = Math.max(0, 1 - d * 1.05);
          let a = 0.05 + 0.1 * edge;

          // A slow shimmer on every cell, offset by position.
          if (!reduced) a += 0.025 * Math.sin(t * 0.6 + x * 0.013 + y * 0.011);

          // Cells that glow now and then.
          let g = glow.get(idx);
          if (g === undefined) {
            g = rand() < 0.045 ? rand() * 100 : -1;
            glow.set(idx, g);
          }
          if (g >= 0) {
            const k = reduced ? 0.55 : 0.5 + 0.5 * Math.sin(t * 0.35 + g);
            a += 0.22 * k * edge;
          }

          // The block ring: cells near the expanding radius brighten.
          for (const ring of rings) {
            const age = now - ring.t0;
            if (age < 0 || age > RING_MS) continue;
            const radius = (age / RING_MS) * maxD * 1.1;
            const dist = Math.abs(Math.hypot(x - cx, y - cy) - radius);
            if (dist < 70) a += 0.35 * (1 - dist / 70) * (1 - age / RING_MS);
          }

          ctx.strokeStyle = `rgba(${rgb},${Math.min(0.7, a).toFixed(3)})`;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const ang = (Math.PI / 180) * (60 * i - 30);
            const px = x + (r - 3) * Math.cos(ang);
            const py = y + (r - 3) * Math.sin(ang);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      // Forget finished rings.
      while (rings.length > 0 && now - (rings[0]?.t0 ?? now) > RING_MS) rings.shift();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;
      draw(now);
    };

    const start = () => {
      if (reduced) {
        draw(0);
        return;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    resize();
    start();
    const onResize = () => {
      resize();
      if (reduced) draw(0);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    const offBlock = onBlock(() => {
      rings.push({ t0: performance.now() });
      if (reduced) draw(0);
    });
    // The accent can change while ambient runs (a deck action does not, but overclock does).
    const accentTimer = window.setInterval(() => {
      rgb = accentRgb();
      if (reduced) draw(0);
    }, 2000);

    return () => {
      stop();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      offBlock();
      window.clearInterval(accentTimer);
    };
  }, [reduced]);

  // Purely decorative: the container that renders this is `aria-hidden`.
  return <canvas ref={ref} className={styles.field} />;
}
