import {
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Glyph } from '../Glyph/Glyph';
import { useControllableState } from '../hooks/useControllableState';
import { IconButton } from '../IconButton/IconButton';
import { cn } from '../internal/cn';
import { FieldBox, FieldShell, fieldIds } from '../internal/Field';
import { mergeRefs } from '../internal/refs';
import { Kbd } from '../Kbd/Kbd';
import styles from './TextField.module.css';

interface FieldCommon {
  /** The label. Required: placeholders are not labels. */
  label: string;
  /** Keep the label for assistive tech but do not draw it (search fields, inline edits). */
  hideLabel?: boolean;
  hint?: ReactNode;
  /** An error message. Sets `aria-invalid` and announces politely. */
  error?: ReactNode;
  size?: 'md' | 'lg';
  /** Mono type, for hashes, paths, images and JSON. */
  mono?: boolean;
  className?: string;
}

export interface TextFieldProps
  extends FieldCommon,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix' | 'value' | 'defaultValue' | 'onChange'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Glyph or text before the input. */
  prefix?: ReactNode;
  /** Glyph, unit or button after the input. */
  suffix?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/**
 * A single-line text field in the chamfered frame, with a mono label, hint and error.
 * Controlled (`value` and `onValueChange`) or uncontrolled. All native input props pass.
 *
 *   <TextField label="App name" hint="3 to 32 lowercase letters" value={name} onValueChange={setName} />
 */
export function TextField({
  label,
  hideLabel,
  hint,
  error,
  size = 'md',
  mono,
  className,
  value,
  defaultValue = '',
  onValueChange,
  onChange,
  prefix,
  suffix,
  id: idProp,
  disabled,
  required,
  ref,
  ...rest
}: TextFieldProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const ids = fieldIds(id);
  const [v, setV] = useControllableState<string>(value, defaultValue, onValueChange);
  const describedBy = [error ? ids.error : null, hint ? ids.hint : null, rest['aria-describedby']]
    .filter(Boolean)
    .join(' ');
  return (
    <FieldShell
      controlId={id}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      disabled={disabled}
      className={className}
    >
      <FieldBox prefix={prefix} suffix={suffix} size={size} invalid={!!error}>
        <input
          {...rest}
          ref={ref}
          id={id}
          className={cn(styles.input, mono && styles.mono)}
          value={v}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => {
            setV(e.target.value);
            onChange?.(e);
          }}
        />
      </FieldBox>
    </FieldShell>
  );
}

export interface TextAreaProps
  extends FieldCommon,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'onChange'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Grow with the content up to `maxRows`. Default false. */
  autoGrow?: boolean;
  maxRows?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * A multi-line field. With `maxLength` it shows a mono counter that turns critical at the
 * limit. `autoGrow` sizes it to its content without layout thrash (one measure per input).
 */
export function TextArea({
  label,
  hideLabel,
  hint,
  error,
  size = 'md',
  mono,
  className,
  value,
  defaultValue = '',
  onValueChange,
  onChange,
  autoGrow = false,
  maxRows = 12,
  rows = 4,
  maxLength,
  id: idProp,
  disabled,
  required,
  ref,
  ...rest
}: TextAreaProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const ids = fieldIds(id);
  const [v, setV] = useControllableState<string>(value, defaultValue, onValueChange);
  const el = useRef<HTMLTextAreaElement>(null);
  const describedBy = [error ? ids.error : null, hint ? ids.hint : null, rest['aria-describedby']]
    .filter(Boolean)
    .join(' ');

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the text changes
  useLayoutEffect(() => {
    const t = el.current;
    if (!t || !autoGrow) return;
    t.style.blockSize = 'auto';
    const line = Number.parseFloat(getComputedStyle(t).lineHeight) || 22;
    const max = line * maxRows;
    t.style.blockSize = `${Math.min(t.scrollHeight, max)}px`;
    t.style.overflowY = t.scrollHeight > max ? 'auto' : 'hidden';
  }, [v, autoGrow, maxRows]);

  const counter =
    maxLength != null ? (
      <span data-over={v.length >= maxLength ? 'true' : undefined} className={styles.counter}>
        {v.length} / {maxLength}
      </span>
    ) : undefined;

  return (
    <FieldShell
      controlId={id}
      label={label}
      hideLabel={hideLabel}
      hint={hint}
      error={error}
      required={required}
      disabled={disabled}
      meta={counter}
      className={className}
    >
      <FieldBox size={size} multiline invalid={!!error}>
        <textarea
          {...rest}
          ref={mergeRefs(el, ref)}
          id={id}
          rows={rows}
          maxLength={maxLength}
          className={cn(styles.input, styles.area, mono && styles.mono)}
          value={v}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => {
            setV(e.target.value);
            onChange?.(e);
          }}
        />
      </FieldBox>
    </FieldShell>
  );
}

export interface SearchFieldProps
  extends Omit<TextFieldProps, 'label' | 'prefix' | 'suffix' | 'type' | 'onSubmit' | 'hideLabel'> {
  /** The accessible name. Default "Search". Not drawn. */
  label?: string;
  /** The leading mark: a search glyph (default) or a mono prompt such as ">" for the deck. */
  prompt?: 'search' | string;
  /** A hotkey hint shown while the field is empty and unfocused, for example "/". */
  shortcut?: string;
  /** Enter pressed. */
  onSubmit?: (value: string) => void;
  /** Label of the clear button. Default "Clear search". */
  clearLabel?: string;
  /** The id of the results list this field filters (`aria-controls`). */
  controls?: string;
}

/**
 * A search field: leading glyph or mono prompt, a clear button, Escape to clear, Enter to
 * submit, a hotkey hint. Not a form: wrap results in a live region if they update as you type.
 */
export function SearchField({
  label = 'Search',
  prompt = 'search',
  shortcut,
  onSubmit,
  clearLabel = 'Clear search',
  controls,
  value,
  defaultValue = '',
  onValueChange,
  onKeyDown,
  ref,
  ...rest
}: SearchFieldProps) {
  const [v, setV] = useControllableState<string>(value, defaultValue, onValueChange);
  const input = useRef<HTMLInputElement>(null);
  // `aria-controls` must name an element that exists. A results list is often mounted only when there
  // is something to show, so name it only while it is in the document (checked after every commit).
  const [controlsPresent, setControlsPresent] = useState(false);
  useEffect(() => {
    const present = controls !== undefined && document.getElementById(controls) !== null;
    setControlsPresent((was) => (was === present ? was : present));
  });
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Escape' && v !== '') {
      e.preventDefault();
      e.stopPropagation();
      setV('');
    } else if (e.key === 'Enter') {
      onSubmit?.(v);
    }
  };
  return (
    <TextField
      {...rest}
      ref={mergeRefs(input, ref)}
      label={label}
      hideLabel
      type="search"
      role="searchbox"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="search"
      aria-controls={controlsPresent ? controls : undefined}
      value={v}
      onValueChange={setV}
      onKeyDown={handleKey}
      prefix={
        prompt === 'search' ? (
          <Glyph name="search" size={16} />
        ) : (
          <span className={styles.prompt} aria-hidden="true">
            {prompt}
          </span>
        )
      }
      suffix={
        v !== '' ? (
          <IconButton
            icon="close"
            label={clearLabel}
            size="sm"
            variant="ghost"
            tooltip={false}
            onClick={() => {
              setV('');
              input.current?.focus();
            }}
          />
        ) : shortcut ? (
          <Kbd combo={shortcut} size="sm" />
        ) : undefined
      }
    />
  );
}
