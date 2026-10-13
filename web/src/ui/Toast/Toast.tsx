import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Glyph } from '../Glyph/Glyph';
import type { GlyphName } from '../Glyph/glyphs';
import { IconButton } from '../IconButton/IconButton';
import { cn } from '../internal/cn';
import { Surface } from '../Surface/Surface';
import styles from './Toast.module.css';

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

export interface ToastProps {
  kind?: ToastKind;
  /** The message. One line where possible. */
  children: ReactNode;
  /** Replaces the kind's glyph. */
  icon?: GlyphName;
  /** One optional action ("Undo"). */
  action?: { label: string; onClick: () => void };
  /** When set, a hairline timeline shows how long is left (ms). The owner does the dismissing. */
  duration?: number;
  onDismiss?: () => void;
  /**
   * Called with true while the pointer is over the toast or focus is inside it, and false
   * when both have left. The owner pauses its dismiss timer while held (a toast must not
   * vanish under the pointer or the keyboard); the timeline pauses on its own.
   */
  onHoldChange?: (held: boolean) => void;
  /**
   * The live-region role. Default `status` (polite), or `alert` (assertive) for errors. Pass
   * `none` when the host already provides the live region.
   */
  role?: 'status' | 'alert' | 'none';
  className?: string;
}

const KIND_GLYPH: Record<ToastKind, GlyphName> = {
  info: 'info',
  success: 'status-ok',
  warn: 'status-warn',
  error: 'status-crit',
};

const KIND_WORD: Record<ToastKind, string> = {
  info: 'Note',
  success: 'Done',
  warn: 'Warning',
  error: 'Error',
};

const KIND_TONE = { info: 'neutral', success: 'ok', warn: 'warn', error: 'crit' } as const;

/**
 * The toast view: one line of glass with a glyph, an optional action and a dismiss button.
 * The queue and timers belong to the app (`system/toasts`); render toasts inside a
 * `ToastViewport` so they sit in one polite live region. The kind word is spoken, so colour
 * is never the only carrier.
 *
 *   <Toast kind="success" action={{ label: 'Undo', onClick: undo }}>Spec copied</Toast>
 */
export function Toast({
  kind = 'info',
  children,
  icon,
  action,
  duration,
  onDismiss,
  onHoldChange,
  role,
  className,
}: ToastProps) {
  const [held, setHeld] = useState(false);
  const pointer = useRef(false);
  const focus = useRef(false);
  const holdRef = useRef(onHoldChange);
  holdRef.current = onHoldChange;

  const sync = useCallback(() => {
    const next = pointer.current || focus.current;
    setHeld((prev) => {
      if (prev !== next) holdRef.current?.(next);
      return next;
    });
  }, []);

  const resolvedRole = role ?? (kind === 'error' ? 'alert' : 'status');

  return (
    <Surface
      size="md"
      tone={KIND_TONE[kind]}
      className={cn(styles.toast, className)}
      data-kind={kind}
      data-held={held ? 'true' : undefined}
      role={resolvedRole === 'none' ? undefined : resolvedRole}
      onPointerEnter={() => {
        pointer.current = true;
        sync();
      }}
      onPointerLeave={() => {
        pointer.current = false;
        sync();
      }}
      onFocus={() => {
        focus.current = true;
        sync();
      }}
      onBlur={(e: { currentTarget: Element; relatedTarget: EventTarget | null }) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          focus.current = false;
          sync();
        }
      }}
    >
      <div className={styles.row}>
        <span className={styles.glyph} data-kind={kind}>
          <Glyph name={icon ?? KIND_GLYPH[kind]} size={18} />
        </span>
        <p className={styles.text}>
          <span className="sr-only">{KIND_WORD[kind]}: </span>
          {children}
        </p>
        {action ? (
          <button type="button" className={styles.action} onClick={action.onClick}>
            {action.label}
          </button>
        ) : null}
        {onDismiss ? (
          <IconButton
            icon="close"
            label="Dismiss"
            size="sm"
            variant="ghost"
            tooltip={false}
            onClick={onDismiss}
            className={styles.dismiss}
          />
        ) : null}
      </div>
      {duration ? (
        <span
          className={styles.timeline}
          aria-hidden="true"
          style={{ '--toast-ms': `${duration}ms` } as CSSProperties}
        />
      ) : null}
    </Surface>
  );
}

export interface ToastItem extends Omit<ToastProps, 'onDismiss'> {
  id: string;
}

export interface ToastViewportProps {
  toasts: readonly ToastItem[];
  onDismiss: (id: string) => void;
  /** Where the stack sits. Default `bottom`. */
  position?: 'bottom' | 'top';
  className?: string;
}

const EXIT_MS = 240;

type Shown = ToastItem & { leaving?: boolean };

/**
 * Lays out toasts in one `aria-live="polite"` region with an enter and exit transition. The
 * region is always mounted (so assistive tech has it before the first message). Position is
 * fixed at the bottom centre (above safe areas); the app picks the layer.
 */
export function ToastViewport({ toasts, onDismiss, position = 'bottom', className }: ToastViewportProps) {
  // Keep removed toasts around for their exit transition.
  const [shown, setShown] = useState<Shown[]>(() => [...toasts]);
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    const ids = new Set(toasts.map((t) => t.id));
    setShown((prev) => {
      const next: Shown[] = toasts.map((t) => ({ ...t }));
      for (const p of prev) {
        if (!ids.has(p.id)) next.push({ ...p, leaving: true });
      }
      return next;
    });
    for (const id of ids) {
      const pending = timers.current.get(id);
      if (pending !== undefined) {
        window.clearTimeout(pending);
        timers.current.delete(id);
      }
    }
  }, [toasts]);

  // Drop leaving toasts once their exit transition has played.
  useEffect(() => {
    for (const t of shown) {
      if (t.leaving && !timers.current.has(t.id)) {
        const handle = window.setTimeout(() => {
          timers.current.delete(t.id);
          setShown((prev) => prev.filter((p) => p.id !== t.id || !p.leaving));
        }, EXIT_MS);
        timers.current.set(t.id, handle);
      }
    }
  }, [shown]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) window.clearTimeout(handle);
      map.clear();
    };
  }, []);

  return (
    <section className={cn(styles.viewport, className)} data-position={position} aria-label="Notifications">
      <div className={styles.list} aria-live="polite" aria-relevant="additions text">
        {shown.map(({ id, leaving, ...rest }) => (
          <div key={id} className={styles.item} data-leaving={leaving ? 'true' : undefined}>
            <Toast {...rest} onDismiss={() => onDismiss(id)} />
          </div>
        ))}
      </div>
    </section>
  );
}
