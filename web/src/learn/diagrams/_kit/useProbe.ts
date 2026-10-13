import { type RefObject, useEffect } from 'react';

/**
 * The probe (DESIGN section 4): over a figure the pointer gets a thin crosshair reticle and a mono
 * readout of what is under it. It is local to the figure, never replaces the OS cursor, and only runs for
 * fine pointers. Parts opt in with a `probe` text (`data-probe`). No React state: it writes straight to
 * three elements inside the stage, once per frame at most.
 */
export function useProbe(rootRef: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!active || !root || typeof window === 'undefined') return;
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    const h = root.querySelector<HTMLElement>('[data-probe-h]');
    const v = root.querySelector<HTMLElement>('[data-probe-v]');
    const out = root.querySelector<HTMLElement>('[data-probe-readout]');
    if (!h || !v || !out) return;

    let raf = 0;
    let x = 0;
    let y = 0;
    let text = '';
    let w = 0;

    const paint = () => {
      raf = 0;
      h.style.transform = `translateY(${y}px)`;
      v.style.transform = `translateX(${x}px)`;
      out.textContent = text;
      const flip = x > w - 190;
      out.style.transform = `translate(${flip ? x - 12 : x + 12}px, ${y + 14}px) ${flip ? 'translateX(-100%)' : ''}`;
      root.dataset.probe = text ? 'on' : 'idle';
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      // The stage may be painted smaller than it is laid out (a figure scaled to fit its frame): work in
      // layout pixels, which is where the reticle lives.
      const r = root.getBoundingClientRect();
      const s = r.width > 0 && root.offsetWidth > 0 ? root.offsetWidth / r.width : 1;
      x = (e.clientX - r.left) * s;
      y = (e.clientY - r.top) * s;
      w = root.offsetWidth || r.width;
      const hit = (e.target as Element | null)?.closest?.('[data-probe]');
      text = hit?.getAttribute('data-probe') ?? '';
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      text = '';
      root.dataset.probe = 'off';
    };

    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);
    return () => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rootRef, active]);
}
