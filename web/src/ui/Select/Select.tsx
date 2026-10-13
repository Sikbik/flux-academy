import { type ReactNode, type Ref, type SelectHTMLAttributes, useId } from 'react';
import { Glyph } from '../Glyph/Glyph';
import { useControllableState } from '../hooks/useControllableState';
import { cn } from '../internal/cn';
import { FieldBox, FieldShell, fieldIds } from '../internal/Field';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Options with the same `group` are wrapped in an `optgroup`. */
  group?: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'value' | 'defaultValue' | 'onChange'> {
  label: string;
  hideLabel?: boolean;
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** A disabled first option shown while nothing is chosen. */
  placeholder?: string;
  hint?: ReactNode;
  error?: ReactNode;
  size?: 'md' | 'lg';
  className?: string;
  ref?: Ref<HTMLSelectElement>;
}

/**
 * A select. The control is the platform's native `<select>` (the best menu on every device,
 * including phones) inside the chamfered frame with our own chevron; the label, hint and
 * error follow the same layout as TextField.
 *
 *   <Select label="Region" options={[{ value: 'eu', label: 'Europe' }]} value={r} onValueChange={setR} />
 */
export function Select({
  label,
  hideLabel,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  hint,
  error,
  size = 'md',
  className,
  id: idProp,
  disabled,
  required,
  ref,
  ...rest
}: SelectProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const ids = fieldIds(id);
  const [v, setV] = useControllableState<string>(
    value,
    defaultValue ?? (placeholder ? '' : (options[0]?.value ?? '')),
    onValueChange,
  );
  const describedBy = [error ? ids.error : null, hint ? ids.hint : null, rest['aria-describedby']]
    .filter(Boolean)
    .join(' ');

  const groups: { name: string | null; items: SelectOption[] }[] = [];
  for (const o of options) {
    const name = o.group ?? null;
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.items.push(o);
    else groups.push({ name, items: [o] });
  }

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
      <FieldBox size={size} invalid={!!error} suffix={<Glyph name="chevron-down" size={16} />}>
        <select
          {...rest}
          ref={ref}
          id={id}
          className={cn(styles.select)}
          value={v}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(e) => setV(e.target.value)}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {groups.map((g) =>
            g.name ? (
              <optgroup key={g.name} label={g.name}>
                {g.items.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              g.items.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))
            ),
          )}
        </select>
      </FieldBox>
    </FieldShell>
  );
}
