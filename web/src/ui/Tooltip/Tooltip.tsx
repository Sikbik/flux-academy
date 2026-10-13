import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { registerDismissable } from '../internal/dismiss';
import { getLayer } from '../internal/layers';
import { computePosition, type Placement, type Side } from '../internal/position';
import { Kbd } from '../Kbd/Kbd';
import { Surface } from '../Surface/Surface';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  /** The text shown. Keep it short; never put the only copy of important information here. */
  content: ReactNode;
  /** A single element that forwards its props to a DOM node (every primitive does). */
  children: ReactNode;
  placement?: Placement;
  /** Hover delay in ms. Keyboard focus shows it immediately. Default 260. */
  delay?: number;
  /** A hotkey combo shown as keycaps after the text, for example "mod+k". */
  shortcut?: string;
  disabled?: boolean;
}

/**
 * A hover and focus tooltip, portalled above everything. Touch does not open it (there is
 * no hover), so essential information never lives only here. Escape dismisses it. While open
 * the anchor is described by it (`aria-describedby`).
 *
 *   <Tooltip content="Copy link" shortcut="c"><IconButton icon="copy" label="Copy link" /></Tooltip>
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 260,
  shortcut,
  disabled = false,
}: TooltipProps) {
  const id = useId();
  const wrapper = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef(0);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; side: Side } | null>(null);

  const anchor = useCallback(() => wrapper.current?.firstElementChild as HTMLElement | null, []);

  const show = useCallback(
    (immediate: boolean) => {
      window.clearTimeout(timer.current);
      if (disabled) return;
      const go = () => {
        setMounted(true);
        setOpen(true);
      };
      if (immediate || delay === 0) go();
      else timer.current = window.setTimeout(go, delay);
    },
    [delay, disabled],
  );

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Unmount shortly after closing so the fade can play.
  useEffect(() => {
    if (open || !mounted) return;
    const t = window.setTimeout(() => {
      setMounted(false);
      setPos(null);
    }, 160);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  // Position once the tooltip has a size (and again when its content changes).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `content` changes the size, so it is measured again
  useLayoutEffect(() => {
    if (!mounted) return;
    const a = anchor();
    const t = tip.current;
    if (!a || !t) return;
    const r = a.getBoundingClientRect();
    const p = computePosition({
      anchor: { left: r.left, top: r.top, width: r.width, height: r.height },
      floating: { width: t.offsetWidth, height: t.offsetHeight },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      placement,
      offset: 10,
    });
    setPos({ x: p.x, y: p.y, side: p.side });
  }, [mounted, placement, anchor, content, shortcut]);

  // Describe the anchor while open; dismiss on Escape and scroll.
  useEffect(() => {
    const a = anchor();
    if (!open || !a) return;
    a.setAttribute('aria-describedby', id);
    const unregisterEscape = registerDismissable(hide);
    window.addEventListener('scroll', hide, { passive: true, capture: true });
    return () => {
      a.removeAttribute('aria-describedby');
      unregisterEscape();
      window.removeEventListener('scroll', hide, { capture: true });
    };
  }, [open, id, anchor, hide]);

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a `display: contents` observer of its interactive child */}
      <span
        ref={wrapper}
        style={{ display: 'contents' }}
        onPointerOver={(e) => {
          if (e.pointerType === 'touch') return;
          show(false);
        }}
        onPointerOut={(e) => {
          const next = e.relatedTarget as Node | null;
          if (!next || !wrapper.current?.contains(next)) hide();
        }}
        onFocus={(e) => {
          if ((e.target as HTMLElement).matches(':focus-visible')) show(true);
        }}
        onBlur={hide}
        onPointerDown={hide}
      >
        {children}
      </span>
      {mounted
        ? createPortal(
            <div
              ref={tip}
              id={id}
              role="tooltip"
              className={styles.tip}
              data-floating=""
              data-floating-open={open ? 'true' : undefined}
              data-open={open && pos ? 'true' : 'false'}
              data-side={pos?.side}
              style={{ '--tx': `${pos?.x ?? 0}px`, '--ty': `${pos?.y ?? 0}px` } as CSSProperties}
            >
              <Surface size="sm" className={styles.surface}>
                <span className={styles.row}>
                  {content}
                  {shortcut ? <Kbd combo={shortcut} size="sm" /> : null}
                </span>
              </Surface>
            </div>,
            getLayer('tooltip'),
          )
        : null}
    </>
  );
}
