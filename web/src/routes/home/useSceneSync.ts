import { type RefObject, useEffect, useLayoutEffect } from 'react';
import { type SceneSection, useSceneBus } from '@/scenes/bus';
import {
  type ChapterBox,
  chapterAtProbe,
  dominantSection,
  type Insets,
  insetsForFree,
  quantise,
  type SectionBox,
  sameInsets,
  ZERO_INSETS,
} from './logic';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Where the reader's eye is, as a fraction of the viewport height. The chapter under it is the current one. */
const READING_LINE = 0.5;

/**
 * The page's side of the scene bus. One scroll and resize listener reads a handful of rects and writes:
 *
 *   section          which section holds the middle of the viewport
 *   chapter, chapterProgress   the scroll story: the chapter text block that holds the reading line
 *   insets           how much of the stage the page covers: everything outside the section's frame
 *   visible          the page is on screen and the tab is visible
 *   pointer          viewport-normalised pointer (fine pointers, hero and story only), for parallax
 *
 * Every write is quantised or compared first, so a scroll never spams the store. Section elements carry
 * `data-scene="hero|story|path|labs|live|build|close"` and the free areas carry `data-frame="hero|story"`.
 * The page never touches `paused` (the shell owns it) or the scene's own slice.
 */
export function useSceneSync(root: RefObject<HTMLElement | null>): void {
  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const bus = useSceneBus.getState();
    let raf = 0;
    let section: SceneSection | null = null;
    let chapter = -1;
    let progress = -1;
    let insets: Insets = ZERO_INSETS;
    let visible: boolean | null = null;

    const frameRect = (name: string): { left: number; top: number; right: number; bottom: number } | null => {
      const f = el.querySelector<HTMLElement>(`[data-frame="${name}"]`);
      if (!f) return null;
      const r = f.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };

    const read = () => {
      raf = 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const els = el.querySelectorAll<HTMLElement>('section[data-scene]');
      const boxes: SectionBox[] = [];
      for (const s of els) {
        const r = s.getBoundingClientRect();
        boxes.push({ id: s.dataset.scene as SceneSection, top: r.top, bottom: r.bottom });
      }
      const now = dominantSection(boxes, vh * 0.5);

      // The story: the chapter whose text block holds the reading line, and how far through it that line is.
      // The blocks are the real prose, so the scene is always on the chapter being read.
      const chapterEls = el.querySelectorAll<HTMLElement>('[data-chapter]');
      let nextChapter = chapter;
      let nextProgress = progress;
      if (chapterEls.length > 0) {
        const cbs: ChapterBox[] = [];
        for (const c of chapterEls) {
          const r = c.getBoundingClientRect();
          cbs.push({ top: r.top, bottom: r.bottom });
        }
        const c = chapterAtProbe(cbs, vh * READING_LINE);
        nextChapter = c.chapter;
        nextProgress = quantise(c.progress);
      }

      // Insets: the free area of the section on screen, as fractions of the (viewport-sized) stage.
      let nextInsets: Insets = ZERO_INSETS;
      if (now === 'hero') {
        const r = frameRect('hero');
        // The hero scrolls away while the stage stays put: measure it as it sits at the top of the page.
        if (r) {
          const y = window.scrollY;
          nextInsets = insetsForFree({ ...r, top: r.top + y, bottom: r.bottom + y }, vw, vh);
        }
      } else if (now === 'story') {
        // The frame is sticky: while it is still on its way in (or leaving) its free area is where it
        // sits when pinned, so the bench is composed once and does not slide with the scroll.
        const f = el.querySelector<HTMLElement>('[data-frame="story"]');
        if (f) {
          const r = f.getBoundingClientRect();
          let top = r.top;
          const pinned = f.closest<HTMLElement>('[data-pin]');
          if (pinned) {
            const pin = Number.parseFloat(getComputedStyle(pinned).top);
            if (Number.isFinite(pin)) top = pin + (r.top - pinned.getBoundingClientRect().top);
          }
          if (r.width >= 2 && r.height >= 2) {
            nextInsets = insetsForFree({ left: r.left, right: r.right, top, bottom: top + r.height }, vw, vh);
          }
        }
      }

      const rect = el.getBoundingClientRect();
      const nextVisible = document.visibilityState === 'visible' && rect.bottom > 0 && rect.top < vh;

      if (now !== section) {
        section = now;
        bus.setSection(now);
      }
      if (nextChapter !== chapter || nextProgress !== progress) {
        chapter = nextChapter;
        progress = nextProgress;
        bus.setChapter(Math.max(0, chapter) as 0 | 1 | 2 | 3, Math.max(0, progress));
      }
      if (!sameInsets(nextInsets, insets)) {
        insets = nextInsets;
        bus.setInsets(nextInsets);
      }
      if (nextVisible !== visible) {
        visible = nextVisible;
        bus.setVisible(nextVisible);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    ro?.observe(el);
    for (const f of el.querySelectorAll('[data-frame], [data-chapter]')) ro?.observe(f);

    // Pointer parallax: fine pointers only, written at most once per frame and only when it moved.
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
    let pRaf = 0;
    let px = 0;
    let py = 0;
    let lastX = 2;
    let lastY = 2;
    const writePointer = () => {
      pRaf = 0;
      if (Math.abs(px - lastX) < 0.01 && Math.abs(py - lastY) < 0.01) return;
      lastX = px;
      lastY = py;
      useSceneBus.getState().setPointer({ x: px, y: py });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = 1 - (e.clientY / window.innerHeight) * 2;
      if (!pRaf) pRaf = requestAnimationFrame(writePointer);
    };
    const onLeave = () => {
      lastX = 2;
      useSceneBus.getState().setPointer(null);
    };
    if (fine) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }

    // The first reading is the page as it loads; fonts and images settle a moment later.
    const settle = window.setTimeout(schedule, 400);

    return () => {
      window.clearTimeout(settle);
      if (raf) cancelAnimationFrame(raf);
      if (pRaf) cancelAnimationFrame(pRaf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
      ro?.disconnect();
      if (fine) {
        window.removeEventListener('pointermove', onMove);
        document.documentElement.removeEventListener('pointerleave', onLeave);
      }
      // Leave the bus as another page expects to find it.
      const b = useSceneBus.getState();
      b.setSection('backdrop');
      b.setChapter(0, 0);
      b.setInsets(ZERO_INSETS);
      b.setTierFocus(null);
      b.setPointer(null);
      b.setVisible(true);
    };
  }, [root]);
}
