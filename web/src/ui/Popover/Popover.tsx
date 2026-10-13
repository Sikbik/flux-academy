import {
  type CSSProperties,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useControllableState } from '../hooks/useControllableState';
import { usePresence } from '../hooks/usePresence';
import { registerDismissable } from '../internal/dismiss';
import { focusInitial, trapTab } from '../internal/focus';
import { getLayer } from '../internal/layers';
import { computePosition, type Placement, type Side } from '../internal/position';
import { mergeRefs } from '../internal/refs';
import type { PanelTone } from '../Panel/Panel';
import { Surface } from '../Surface/Surface';
import styles from './Popover.module.css';

export interface PopoverProps {
  /** The trigger: one element that forwards `ref` and props to a DOM node (every primitive does). */
  children: ReactElement;
  /** The body. May contain links and controls. */
  content: ReactNode;
  /** A heading. Names the popover for assistive tech. */
  title?: ReactNode;
  /** The accessible name when there is no `title`. */
  label?: string;
  placement?: Placement;
  /**
   * `click` (default) toggles on press. `hover` also opens on pointer hover and keyboard
   * focus, and stays open while the pointer is over the card: for definitions and previews.
   */
  trigger?: 'click' | 'hover';
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Max width in px. Default 320. */
  width?: number;
  tone?: PanelTone;
  className?: string;
}

const EXIT_MS = 180;
const HOVER_IN_MS = 110;
const HOVER_OUT_MS = 180;

/**
 * A non-modal floating card anchored to its trigger. Focus moves in when it opens from a
 * press or the keyboard, Tab stays inside, Escape closes and returns focus, and a press
 * outside closes. A short hairline stem and a dot connect it to the trigger (the annotation
 * language). Use for field help, definitions and previews; use `Dialog` for decisions.
 *
 *   <Popover title="CPU" content="Cores, in tenths of a vCPU." ><IconButton icon="help" label="About CPU" /></Popover>
 */
export function Popover({
  children,
  content,
  title,
  label,
  placement = 'bottom',
  trigger = 'click',
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  width = 320,
  tone = 'neutral',
  className,
}: PopoverProps) {
  const [open, setOpen] = useControllableState(openProp, defaultOpen, onOpenChange);
  const { mounted, state } = usePresence(open, EXIT_MS);
  const id = useId();
  const titleId = `${id}-t`;
  const anchor = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef(0);
  const viaPointerOnly = useRef(false);
  /** True while focus is being handed back to the trigger, so its focus handler does not reopen. */
  const restoring = useRef(false);
  const [pos, setPos] = useState<{
    x: number;
    y: number;
    side: Side;
    arrow: number;
    hidden: boolean;
  } | null>(null);

  const place = useCallback(() => {
    const a = anchor.current;
    const c = card.current;
    if (!a || !c) return;
    const r = a.getBoundingClientRect();
    const p = computePosition({
      anchor: { left: r.left, top: r.top, width: r.width, height: r.height },
      floating: { width: c.offsetWidth, height: c.offsetHeight },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      placement,
      offset: 14,
    });
    setPos((prev) =>
      prev &&
      prev.x === p.x &&
      prev.y === p.y &&
      prev.side === p.side &&
      prev.arrow === p.arrow &&
      prev.hidden === p.hidden
        ? prev
        : { x: p.x, y: p.y, side: p.side, arrow: p.arrow, hidden: p.hidden },
    );
  }, [placement]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `content` and `title` change the size
  useLayoutEffect(() => {
    if (mounted) place();
  }, [mounted, place, content, title]);

  // Keep the card on its anchor while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const onMove = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          place();
        });
      }
    };
    window.addEventListener('scroll', onMove, { passive: true, capture: true });
    window.addEventListener('resize', onMove);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onMove, { capture: true });
      window.removeEventListener('resize', onMove);
    };
  }, [open, place]);

  const close = useCallback(
    (restore: boolean) => {
      window.clearTimeout(hoverTimer.current);
      setOpen(false);
      if (restore) {
        restoring.current = true;
        anchor.current?.focus({ preventScroll: true });
        restoring.current = false;
      }
    },
    [setOpen],
  );

  // Escape (through the shared stack, so the top-most layer answers) and outside press.
  useEffect(() => {
    if (!open) return;
    const unregisterEscape = registerDismissable(() => {
      const active = document.activeElement;
      // Hand focus back to the trigger unless it has already gone somewhere else on purpose.
      const here =
        !active ||
        active === document.body ||
        !!card.current?.contains(active) ||
        !!anchor.current?.contains(active);
      close(here);
    });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (card.current?.contains(t) || anchor.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      unregisterEscape();
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, close]);

  // Move focus in when opened by a press or key (not by hover).
  useEffect(() => {
    if (state !== 'open' || viaPointerOnly.current) return;
    const c = card.current;
    if (c && !c.contains(document.activeElement)) focusInitial(c);
  }, [state]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const schedule = (next: boolean, ms: number) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      viaPointerOnly.current = true;
      setOpen(next);
    }, ms);
  };

  if (!isValidElement(children)) return children;
  const child = children as ReactElement<Record<string, unknown> & { ref?: Ref<HTMLElement> }>;
  const childProps = child.props;
  const childRef = childProps.ref;

  const triggerProps: Record<string, unknown> = {
    ref: mergeRefs(anchor, childRef),
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': mounted ? id : undefined,
    onClick: (e: unknown) => {
      (childProps.onClick as ((ev: unknown) => void) | undefined)?.(e);
      window.clearTimeout(hoverTimer.current);
      if (trigger === 'hover' && open && viaPointerOnly.current) {
        // Already showing from hover or focus: a press commits it and moves focus in.
        viaPointerOnly.current = false;
        if (card.current) focusInitial(card.current);
        return;
      }
      viaPointerOnly.current = false;
      setOpen(!open);
    },
  };
  if (trigger === 'hover') {
    triggerProps.onPointerEnter = (e: PointerEvent) => {
      (childProps.onPointerEnter as ((ev: unknown) => void) | undefined)?.(e);
      if (e.pointerType !== 'touch') schedule(true, HOVER_IN_MS);
    };
    triggerProps.onPointerLeave = (e: PointerEvent) => {
      (childProps.onPointerLeave as ((ev: unknown) => void) | undefined)?.(e);
      if (e.pointerType !== 'touch') schedule(false, HOVER_OUT_MS);
    };
    triggerProps.onFocus = (e: FocusEvent) => {
      (childProps.onFocus as ((ev: unknown) => void) | undefined)?.(e);
      if (restoring.current) return;
      if ((e.target as HTMLElement).matches(':focus-visible')) {
        window.clearTimeout(hoverTimer.current);
        viaPointerOnly.current = true;
        setOpen(true);
      }
    };
    // Leaving the trigger by keyboard closes the card, unless focus moves into the card.
    triggerProps.onBlur = (e: FocusEvent) => {
      (childProps.onBlur as ((ev: unknown) => void) | undefined)?.(e);
      const next = e.relatedTarget as Node | null;
      if (next && card.current?.contains(next)) return;
      schedule(false, HOVER_OUT_MS);
    };
  }

  // The top layer, so a popover opened inside a dialog or drawer sits above it.
  const layer = typeof document === 'undefined' ? null : getLayer('tooltip');

  return (
    <>
      {cloneElement(child, triggerProps)}
      {mounted && layer
        ? createPortal(
            <div
              ref={card}
              id={id}
              role="dialog"
              aria-modal="false"
              aria-labelledby={title ? titleId : undefined}
              aria-label={title ? undefined : label}
              tabIndex={-1}
              className={styles.card}
              data-floating=""
              data-floating-open={open ? 'true' : undefined}
              data-state={state}
              data-side={pos?.side ?? 'bottom'}
              style={
                {
                  '--tx': `${pos?.x ?? 0}px`,
                  '--ty': `${pos?.y ?? 0}px`,
                  '--arrow': `${pos?.arrow ?? 0}px`,
                  '--w': `${width}px`,
                  // Hidden until measured, and while the trigger is scrolled out of the viewport.
                  visibility: pos && !pos.hidden ? undefined : 'hidden',
                } as CSSProperties
              }
              onKeyDown={(e) => {
                if (card.current) trapTab(card.current, e.nativeEvent);
              }}
              onBlur={(e) => {
                // Focus leaving the card (and not going back to the trigger) closes a hover card.
                if (trigger !== 'hover') return;
                const next = e.relatedTarget as Node | null;
                if (next && (card.current?.contains(next) || anchor.current?.contains(next))) return;
                schedule(false, HOVER_OUT_MS);
              }}
              onPointerEnter={() => {
                if (trigger === 'hover') window.clearTimeout(hoverTimer.current);
              }}
              onPointerLeave={(e) => {
                if (trigger === 'hover' && e.pointerType !== 'touch') schedule(false, HOVER_OUT_MS);
              }}
            >
              <span className={styles.stem} aria-hidden="true" />
              <Surface size="md" tone={tone} className={className}>
                <div className={styles.body}>
                  {title ? (
                    <h2 id={titleId} className={styles.title}>
                      {title}
                    </h2>
                  ) : null}
                  <div className={styles.text}>{content}</div>
                </div>
              </Surface>
            </div>,
            layer,
          )
        : null}
    </>
  );
}
