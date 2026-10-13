import {
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { usePresence } from '../hooks/usePresence';
import { IconButton } from '../IconButton/IconButton';
import { Panel, type PanelTone } from '../Panel/Panel';
import { cn } from './cn';
import { getLayer } from './layers';
import styles from './ModalShell.module.css';

export interface ModalShellProps {
  open: boolean;
  /** Called for Escape, the scrim and the close button. */
  onClose: () => void;
  kind: 'dialog' | 'drawer';
  /** Drawers: which edge it comes from. Dialogs ignore it. */
  side?: 'right' | 'left' | 'bottom';
  /** Surface width in px (the max for dialogs and right/left drawers). */
  width: number;
  /** The accessible name and the visible heading. */
  title: ReactNode;
  description?: ReactNode;
  /** Beside the close button. */
  actions?: ReactNode;
  /** Sticky footer. */
  footer?: ReactNode;
  hideClose?: boolean;
  dismissOnScrim?: boolean;
  /** Called after the exit animation, when the surface unmounts. */
  onExited?: () => void;
  role?: 'dialog' | 'alertdialog';
  tone?: PanelTone;
  initialFocus?: 'first' | 'container';
  className?: string;
  children: ReactNode;
}

const EXIT_MS = 340;

/**
 * The shared modal machinery for Dialog and Drawer: portal into the modal layer, presence
 * (enter and exit animation), scrim, focus trap with the page made `inert`, Escape, focus
 * return, bottom-sheet drag to dismiss. Not exported from the package index.
 */
export function ModalShell({
  open,
  onClose,
  kind,
  side = 'right',
  width,
  title,
  description,
  actions,
  footer,
  hideClose = false,
  dismissOnScrim = true,
  onExited,
  role = 'dialog',
  tone,
  initialFocus = 'first',
  className,
  children,
}: ModalShellProps) {
  const { mounted, state } = usePresence(open, EXIT_MS);
  const surface = useRef<HTMLElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const exited = useRef(onExited);
  exited.current = onExited;

  useFocusTrap(surface, {
    active: state === 'enter' || state === 'open',
    onEscape: onClose,
    initialFocus,
  });

  useEffect(() => {
    if (!mounted && state === 'closed') exited.current?.();
  }, [mounted, state]);

  // Bottom sheets can be dragged down to dismiss.
  const drag = useRef({ y: 0, active: false, t: 0 });
  const onGrabDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, active: true, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    root.current?.setAttribute('data-dragging', 'true');
  };
  const onGrabMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    surface.current?.style.setProperty('--drag', `${dy}px`);
  };
  const onGrabUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const dy = Math.max(0, e.clientY - drag.current.y);
    const v = dy / Math.max(1, performance.now() - drag.current.t);
    root.current?.removeAttribute('data-dragging');
    surface.current?.style.removeProperty('--drag');
    if (dy > 110 || (dy > 30 && v > 0.6)) onClose();
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={root}
      className={styles.root}
      data-kind={kind}
      data-side={kind === 'drawer' ? side : undefined}
      data-state={state}
      style={{ '--modal-w': `${width}px` } as CSSProperties}
    >
      <div className={styles.scrim} onPointerDown={dismissOnScrim ? onClose : undefined} aria-hidden="true" />
      <Panel
        as="section"
        ref={surface}
        variant="slab"
        size="lg"
        padding="none"
        hot={kind === 'drawer' && side === 'left' ? 'tr' : 'tl'}
        cut={kind === 'drawer' && side === 'left' ? 'tl-br' : 'tr-bl'}
        pattern="br"
        marks={false}
        tone={tone}
        className={cn(styles.surface, className)}
        contentClassName={styles.inner}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        {kind === 'drawer' && side === 'bottom' ? (
          <div
            className={styles.grabber}
            onPointerDown={onGrabDown}
            onPointerMove={onGrabMove}
            onPointerUp={onGrabUp}
            onPointerCancel={onGrabUp}
            aria-hidden="true"
          />
        ) : null}
        <header className={styles.head}>
          <div className={styles.titles}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description ? (
              <p id={descId} className={styles.desc}>
                {description}
              </p>
            ) : null}
          </div>
          {actions || !hideClose ? (
            <div className={styles.actions}>
              {actions}
              {hideClose ? null : (
                <IconButton icon="close" label="Close" size="sm" tooltip={false} onClick={onClose} />
              )}
            </div>
          ) : null}
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.foot}>{footer}</footer> : null}
      </Panel>
    </div>,
    getLayer('modal'),
  );
}
