/**
 * The "Explain the numbers" layer: numbered rings joined by leader lines to the figures they describe,
 * drawn over the lab like annotations on a blueprint. Every ring is a real button; pressing one opens its
 * plain-language note in a card beside it. The Teach me drawer carries the same notes as a plain list, so
 * nothing here is the only way to read them.
 *
 * Targets are found by `data-explain="<id>"` inside the container, so the layer knows nothing about the
 * lab's layout and survives it changing (it re-measures when the container resizes). Rings avoid sitting
 * on text and controls: every piece of content in the container is measured and a ring is only put where
 * it covers none.
 */
import { type RefObject, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { InlineMarkup } from '@/app/InlineMarkup';
import { CalloutMarker } from '@/ui';
import styles from './ExplainLayer.module.css';
import type { Explainer, ExplainerId } from './explainers';
import { type Placement, placeCard, placeRing, type Rect, RING_RADIUS } from './ring';

export interface ExplainLayerProps {
  containerRef: RefObject<HTMLElement | null>;
  notes: readonly Explainer[];
  /** Changes whenever the lab's layout may have changed (data arrived, a filter moved). */
  layoutKey: string;
  onClose: () => void;
}

interface Placed {
  note: Explainer;
  n: number;
  placement: Placement;
}

const CARD_WIDTH = 320;

/** What counts as content a ring must not cover: text, controls and figures (the bench canvas excepted). */
const CONTENT = 'button, a, input, select, textarea, img, svg, [role="slider"]';

function hasOwnText(el: Element): boolean {
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '') return true;
  }
  return false;
}

function collectBlockers(container: HTMLElement, layer: Element | null): Rect[] {
  const base = container.getBoundingClientRect();
  const out: Rect[] = [];
  for (const el of container.querySelectorAll('*')) {
    if (layer?.contains(el) || el.closest('canvas')) continue;
    if (!(el.matches(CONTENT) || hasOwnText(el))) continue;
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // A layout wrapper that fills the panel is not content.
    if (r.width > base.width * 0.9 && r.height > 160) continue;
    out.push({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
  }
  return out;
}

function covers(rect: Rect, p: { x: number; y: number }, radius: number): boolean {
  const nx = Math.max(rect.x, Math.min(p.x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(p.y, rect.y + rect.h));
  return Math.hypot(p.x - nx, p.y - ny) < radius;
}

function samePlaced(a: Placed[], b: Placed[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i] as Placed;
    return (
      p.note.id === q.note.id &&
      Math.abs(p.placement.ring.x - q.placement.ring.x) < 0.5 &&
      Math.abs(p.placement.ring.y - q.placement.ring.y) < 0.5 &&
      Math.abs(p.placement.anchor.x - q.placement.anchor.x) < 0.5 &&
      Math.abs(p.placement.anchor.y - q.placement.anchor.y) < 0.5
    );
  });
}

export function ExplainLayer({ containerRef, notes, layoutKey, onClose }: ExplainLayerProps) {
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [open, setOpen] = useState<ExplainerId | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [cardHeight, setCardHeight] = useState(168);
  const layerRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const ringRefs = useRef(new Map<ExplainerId, HTMLButtonElement>());
  const cardId = useId();

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const c = container.getBoundingClientRect();
    const nextBox = { width: c.width, height: c.height };
    setBox((prev) =>
      Math.abs(prev.width - nextBox.width) < 0.5 && Math.abs(prev.height - nextBox.height) < 0.5
        ? prev
        : nextBox,
    );
    if (nextBox.width === 0) return;

    const blockers = collectBlockers(container, layerRef.current);
    const blocked = (p: { x: number; y: number }): boolean =>
      blockers.some((r) => covers(r, p, RING_RADIUS + 3));

    const taken: { x: number; y: number }[] = [];
    const next: Placed[] = [];
    for (const note of notes) {
      const el = container.querySelector<HTMLElement>(`[data-explain="${note.target}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const rect: Rect = { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
      const placement = placeRing(rect, nextBox, taken, 42, blocked);
      taken.push(placement.ring);
      next.push({ note, n: next.length + 1, placement });
    }
    setPlaced((prev) => (samePlaced(prev, next) ? prev : next));
  }, [containerRef, notes]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `layoutKey` is the signal to measure again.
  useLayoutEffect(() => {
    measure();
  }, [measure, layoutKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    window.addEventListener('resize', measure);
    // Fonts, counters and charts settle after the first paint.
    const timers = [window.setTimeout(measure, 250), window.setTimeout(measure, 1200)];
    void document.fonts?.ready.then(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      for (const t of timers) window.clearTimeout(t);
    };
  }, [containerRef, measure]);

  // The rings draw in the frame after they mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Escape closes the open note first, then the whole layer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (open) {
        e.stopPropagation();
        setOpen(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const current = placed.find((p) => p.note.id === open) ?? null;

  // Move focus into the card when a note opens (the browser brings it into view), and back to its ring
  // when it closes.
  const lastOpen = useRef<ExplainerId | null>(null);
  useEffect(() => {
    if (open) {
      cardRef.current?.focus();
      setCardHeight(cardRef.current?.offsetHeight ?? 168);
    } else if (lastOpen.current) {
      ringRefs.current.get(lastOpen.current)?.focus({ preventScroll: true });
    }
    lastOpen.current = open;
  }, [open]);

  const step = (delta: number) => {
    if (!current) return;
    const i = placed.indexOf(current);
    const next = placed[(i + delta + placed.length) % placed.length];
    if (next) setOpen(next.note.id);
  };

  const card = current
    ? placeCard(current.placement.ring, { width: CARD_WIDTH, height: cardHeight }, box)
    : null;

  return (
    <section ref={layerRef} className={styles.layer} aria-label="Explanations of the numbers on this page">
      <svg className={styles.svg} width={box.width} height={box.height} aria-hidden="true">
        {placed.map((p, i) => (
          <CalloutMarker
            key={p.note.id}
            x={p.placement.ring.x}
            y={p.placement.ring.y}
            n={p.n}
            anchor={p.placement.anchor}
            draw={drawn}
            delay={i * 60}
          />
        ))}
      </svg>

      {placed.map((p) => (
        <button
          key={p.note.id}
          type="button"
          ref={(el) => {
            if (el) ringRefs.current.set(p.note.id, el);
            else ringRefs.current.delete(p.note.id);
          }}
          className={styles.ring}
          style={{ insetInlineStart: p.placement.ring.x, insetBlockStart: p.placement.ring.y }}
          aria-label={`Note ${p.n}: ${p.note.title}`}
          aria-expanded={open === p.note.id}
          aria-controls={open === p.note.id ? cardId : undefined}
          data-open={open === p.note.id ? '' : undefined}
          data-side={p.placement.labelSide}
          onClick={() => setOpen(open === p.note.id ? null : p.note.id)}
        >
          <span className={styles.tag} aria-hidden="true">
            {p.note.title}
          </span>
        </button>
      ))}

      {current && card ? (
        <section
          id={cardId}
          ref={cardRef}
          className={styles.card}
          aria-label={`Note ${current.n} of ${placed.length}: ${current.note.title}`}
          tabIndex={-1}
          style={{ insetInlineStart: card.x, insetBlockStart: card.y, inlineSize: CARD_WIDTH }}
          data-above={card.above ? '' : undefined}
        >
          <p className={styles.cardKicker}>
            Note {current.n} of {placed.length}
          </p>
          <h3 className={styles.cardTitle}>{current.note.title}</h3>
          <p className={styles.cardBody}>
            <InlineMarkup text={current.note.body} />
          </p>
          <div className={styles.cardActions}>
            <button type="button" onClick={() => step(-1)}>
              Previous
            </button>
            <button type="button" onClick={() => step(1)}>
              Next
            </button>
            <button type="button" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
