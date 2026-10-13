/**
 * The forge's dense text, text area and number inputs. Every input here is "controlled with a draft": while
 * it has focus it shows what the learner is typing (so a half typed number is never rewritten under them),
 * and it commits every valid change at once so the price and the JSON follow each keystroke.
 *
 * A locked input is `readOnly`, not `disabled`: it stays focusable and readable, and the field around it
 * carries the lock badge and its tooltip.
 */

import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Glyph } from '@/ui';
import styles from './controls.module.css';

export type FieldState = 'error' | 'warning' | null;

/** The input state for the worst lint severity at a path (info never colours a control). */
export function stateOf(worst: 'error' | 'warning' | 'info' | null | undefined): FieldState {
  return worst === 'error' ? 'error' : worst === 'warning' ? 'warning' : null;
}

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  /** The accessible name (the field draws its own visible label). */
  label: string;
  id?: string;
  mono?: boolean;
  locked?: boolean;
  state?: FieldState;
  placeholder?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** The exact JSON path this input edits (`compose[0].ports[1]`), used by "go to the field". */
  path?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'url' | 'email';
  describedBy?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

export function TextInput({
  value,
  onChange,
  label,
  id,
  mono,
  locked,
  state = null,
  placeholder,
  prefix,
  suffix,
  path,
  inputMode,
  describedBy,
  onKeyDown,
  onBlur,
  className,
  ref,
}: TextInputProps) {
  return (
    <span
      className={cx('chamfer', styles.box, className)}
      data-state={state ?? undefined}
      data-locked={locked ? 'true' : undefined}
    >
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.face} aria-hidden="true" />
      {prefix != null ? <span className={styles.affix}>{prefix}</span> : null}
      <input
        ref={ref}
        id={id}
        className={styles.input}
        data-mono={mono ? 'true' : undefined}
        data-path={path}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={state === 'error' ? true : undefined}
        aria-describedby={describedBy}
        aria-readonly={locked ? true : undefined}
        readOnly={locked}
        inputMode={inputMode}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      {suffix != null ? <span className={styles.affix}>{suffix}</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Text area
// ---------------------------------------------------------------------------

export interface TextAreaInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  id?: string;
  locked?: boolean;
  state?: FieldState;
  placeholder?: string;
  path?: string;
  /** Shows a counter that turns red past the limit. It does not stop typing: the lint explains the limit. */
  limit?: number;
  maxRows?: number;
  describedBy?: string;
}

export function TextAreaInput({
  value,
  onChange,
  label,
  id,
  locked,
  state = null,
  placeholder,
  path,
  limit,
  maxRows = 6,
  describedBy,
}: TextAreaInputProps) {
  const el = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the text changes
  useLayoutEffect(() => {
    const t = el.current;
    if (!t) return;
    t.style.blockSize = 'auto';
    const cs = getComputedStyle(t);
    const line = Number.parseFloat(cs.lineHeight) || 20;
    const max = line * maxRows + 4;
    t.style.blockSize = `${Math.min(t.scrollHeight, max)}px`;
    t.style.overflowY = t.scrollHeight > max ? 'auto' : 'hidden';
  }, [value, maxRows]);

  return (
    <span
      className={cx('chamfer', styles.box)}
      data-multiline="true"
      data-state={state ?? undefined}
      data-locked={locked ? 'true' : undefined}
    >
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.face} aria-hidden="true" />
      <textarea
        ref={el}
        id={id}
        rows={2}
        className={cx(styles.input, styles.area)}
        data-path={path}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={state === 'error' ? true : undefined}
        aria-describedby={describedBy}
        aria-readonly={locked ? true : undefined}
        readOnly={locked}
        spellCheck
        onChange={(e) => onChange(e.target.value)}
      />
      {limit != null ? (
        <span className={styles.counter} data-over={value.length > limit ? 'true' : undefined}>
          {value.length}/{limit}
        </span>
      ) : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

export interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  id?: string;
  /** Steppers and arrow keys stay inside [min, max]; a typed value is taken as is (the lint explains). */
  min?: number;
  max?: number;
  step?: number;
  /** Decimals kept when formatting the value, and when stepping (avoids 0.30000000000000004). */
  decimals?: number;
  unit?: string;
  locked?: boolean;
  state?: FieldState;
  placeholder?: string;
  path?: string;
  describedBy?: string;
  /** Hide the stepper buttons (a port number has no sensible step). */
  plain?: boolean;
  className?: string;
}

function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function formatNumber(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '';
  return String(roundTo(n, decimals));
}

export function NumberInput({
  value,
  onChange,
  label,
  id,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  decimals = 0,
  unit,
  locked,
  state = null,
  placeholder,
  path,
  describedBy,
  plain,
  className,
}: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const lastCommitted = useRef<number>(value);

  // An external change (undo, a preset, the slider) replaces the draft; our own commits do not.
  useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setDraft((d) => (d === null ? d : formatNumber(value, decimals)));
    }
  }, [value, decimals]);

  const shown = draft ?? formatNumber(value, decimals);

  const commit = (n: number) => {
    lastCommitted.current = n;
    onChange(n);
  };

  const parse = (text: string): number | null => {
    const t = text.trim().replace(',', '.');
    if (t === '' || t === '-' || t === '.') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const bump = (dir: 1 | -1, big: boolean) => {
    if (locked) return;
    const base = parse(shown) ?? value;
    const next = roundTo(base + dir * step * (big ? 10 : 1), decimals);
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped === value && draft === null) return;
    setDraft(formatNumber(clamped, decimals));
    commit(clamped);
  };

  return (
    <span
      className={cx('chamfer', styles.box, styles.number, className)}
      data-state={state ?? undefined}
      data-locked={locked ? 'true' : undefined}
    >
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.face} aria-hidden="true" />
      <input
        id={id}
        className={styles.input}
        data-mono="true"
        data-path={path}
        type="text"
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        value={shown}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={state === 'error' ? true : undefined}
        aria-describedby={describedBy}
        aria-readonly={locked ? true : undefined}
        readOnly={locked}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setDraft(formatNumber(value, decimals))}
        onChange={(e) => {
          if (locked) return;
          const text = e.target.value;
          setDraft(text);
          const n = parse(text);
          if (n !== null && n !== value) commit(n);
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            bump(1, e.shiftKey);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            bump(-1, e.shiftKey);
          } else if (e.key === 'Escape') {
            setDraft(null);
          }
        }}
      />
      {unit ? <span className={styles.affix}>{unit}</span> : null}
      {plain || locked ? null : (
        <span className={styles.stepper}>
          <button
            type="button"
            className={styles.step}
            aria-label={`Decrease ${label}`}
            tabIndex={-1}
            disabled={value <= min}
            onClick={() => bump(-1, false)}
          >
            <Glyph name="minus" size={14} />
          </button>
          <button
            type="button"
            className={styles.step}
            aria-label={`Increase ${label}`}
            tabIndex={-1}
            disabled={value >= max}
            onClick={() => bump(1, false)}
          >
            <Glyph name="plus" size={14} />
          </button>
        </span>
      )}
    </span>
  );
}
