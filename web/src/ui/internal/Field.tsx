import type { ReactNode } from 'react';
import { Glyph } from '../Glyph/Glyph';
import { cn } from './cn';
import styles from './Field.module.css';

export interface FieldShellProps {
  /** The id of the control inside; the label points at it. */
  controlId: string;
  label: string;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Shown at the right of the label row: a counter, a link. */
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** The ids a control uses to be described by its hint and error. */
export function fieldIds(controlId: string): { hint: string; error: string } {
  return { hint: `${controlId}-hint`, error: `${controlId}-error` };
}

/**
 * The label, hint and error layout shared by TextField, TextArea, SearchField and Select.
 * The control itself is `children`; wrap it in `FieldBox` for the chamfered frame.
 */
export function FieldShell({
  controlId,
  label,
  hideLabel,
  hint,
  error,
  required,
  disabled,
  meta,
  className,
  children,
}: FieldShellProps) {
  const ids = fieldIds(controlId);
  return (
    <div
      className={cn(styles.field, className)}
      data-invalid={error ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
    >
      {hideLabel ? (
        <label htmlFor={controlId} className="sr-only">
          {label}
        </label>
      ) : (
        <div className={styles.head}>
          <label htmlFor={controlId} className={styles.label}>
            {label}
            {required ? (
              <span className={styles.req} aria-hidden="true">
                {' '}
                *
              </span>
            ) : null}
          </label>
          {meta ? <span className={styles.meta}>{meta}</span> : null}
        </div>
      )}
      {children}
      {hint ? (
        <p id={ids.hint} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      <div aria-live="polite">
        {error ? (
          <p id={ids.error} className={styles.error}>
            <Glyph name="status-crit" size={14} />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export interface FieldBoxProps {
  /** Glyph or text before the control. */
  prefix?: ReactNode;
  /** Glyph, text, a button after the control. */
  suffix?: ReactNode;
  size?: 'md' | 'lg';
  multiline?: boolean;
  invalid?: boolean;
  className?: string;
  children: ReactNode;
}

/** The chamfered frame: edge ring, fill, focus rim. The control inside is transparent. */
export function FieldBox({
  prefix,
  suffix,
  size = 'md',
  multiline,
  invalid,
  className,
  children,
}: FieldBoxProps) {
  return (
    <span
      className={cn('chamfer', styles.box, className)}
      data-size={size}
      data-multiline={multiline ? 'true' : undefined}
      data-invalid={invalid ? 'true' : undefined}
      onPointerDown={(e) => {
        // The whole frame is the target: a press on the padding or an affix focuses the control.
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, select, button, a, [role="button"]')) return;
        const control = e.currentTarget.querySelector<HTMLInputElement>('input, textarea, select');
        if (control && !control.disabled) {
          e.preventDefault();
          control.focus();
        }
      }}
    >
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.face} aria-hidden="true" />
      {prefix != null ? <span className={styles.affix}>{prefix}</span> : null}
      {children}
      {suffix != null ? <span className={styles.affix}>{suffix}</span> : null}
    </span>
  );
}
