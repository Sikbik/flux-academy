import { useEffect, useRef } from 'react';
import { usePointerFine } from '../hooks/useMedia';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { clamp } from '../internal/math';
import { crosshairGeometry } from './geometry';
import styles from './Probe.module.css';

export interface ProbeReticleProps {
  /**
   * The readout for a position inside the figure, as fractions of its width and height.
   * Default: `X 0.42  Y 0.18`.
   */
  format?: (fx: number, fy: number) => string;
}

function defaultFormat(fx: number, fy: number): string {
  return `X ${fx.toFixed(2)}  Y ${fy.toFixed(2)}`;
}

const RETICLE = crosshairGeometry({ x: 12, y: 12, size: 12, ring: true });

/**
 * The Probe pattern (DESIGN.md section 4): over a figure the pointer gains a thin reticle,
 * two hairline guides and a mono readout of where it is. It lives inside its parent (give
 * the parent `position: relative`), never hides the operating system cursor, appears only
 * for fine pointers, and is off under reduced motion. Decorative: `aria-hidden`.
 *
 *   <div style={{ position: 'relative' }}><Diagram /><ProbeReticle /></div>
 */
export function ProbeReticle({ format = defaultFormat }: ProbeReticleProps) {
  const fine = usePointerFine();
  const reduced = useReducedMotion();
  const enabled = fine && !reduced;
  const root = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    const host = el?.parentElement;
    if (!el || !host || !enabled) return;
    let raf = 0;
    let cx = 0;
    let cy = 0;
    const write = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const x = clamp(cx - r.left, 0, r.width);
      const y = clamp(cy - r.top, 0, r.height);
      el.style.setProperty('--px', `${x.toFixed(1)}px`);
      el.style.setProperty('--py', `${y.toFixed(1)}px`);
      el.dataset.flipX = x > r.width - 150 ? 'true' : 'false';
      el.dataset.flipY = y > r.height - 40 ? 'true' : 'false';
      if (readout.current) readout.current.textContent = format(x / r.width, y / r.height);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      cx = e.clientX;
      cy = e.clientY;
      el.dataset.active = 'true';
      if (!raf) raf = requestAnimationFrame(write);
    };
    const onLeave = () => {
      el.dataset.active = 'false';
    };
    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    return () => {
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, format]);

  if (!enabled) return null;
  return (
    <div ref={root} className={styles.probe} data-active="false" aria-hidden="true">
      <span className={styles.guideH} />
      <span className={styles.guideV} />
      <svg
        className={styles.reticle}
        viewBox="0 0 25 25"
        width="25"
        height="25"
        focusable="false"
        aria-hidden="true"
      >
        <path d={RETICLE.arms} />
        {RETICLE.ring ? <circle cx={RETICLE.ring.cx} cy={RETICLE.ring.cy} r={RETICLE.ring.r} /> : null}
        {RETICLE.dot ? (
          <circle className={styles.dot} cx={RETICLE.dot.cx} cy={RETICLE.dot.cy} r={RETICLE.dot.r} />
        ) : null}
      </svg>
      <span ref={readout} className={styles.readout} />
    </div>
  );
}
