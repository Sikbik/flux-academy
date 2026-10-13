import { useRef } from 'react';
import { SegmentedControl, Select, useElementSize } from '@/ui';

export interface ChoiceOption {
  value: string;
  label: string;
}

/** Roughly how wide one segment is at the small size: text at 13px plus its padding. */
const CHAR_PX = 7.6;
const SEGMENT_PAD = 26;

/**
 * One choice among a few. A segmented control while the options fit on one line, and the platform's own
 * select when they do not (a phone, a narrow column): a stack of six full width buttons is no way to pick a
 * subscription length.
 */
export function Choice({
  label,
  options,
  value,
  onValueChange,
  disabled,
}: {
  /** The accessible name of the group. */
  label: string;
  options: readonly ChoiceOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(box);
  const need = options.reduce((n, o) => n + o.label.length * CHAR_PX + SEGMENT_PAD, 8);
  const narrow = width > 0 && width < need;
  return (
    <div ref={box}>
      {narrow ? (
        <Select
          label={label}
          hideLabel
          options={options}
          value={value}
          disabled={disabled}
          onValueChange={onValueChange}
        />
      ) : (
        <SegmentedControl
          aria-label={label}
          size="sm"
          fullWidth
          value={value}
          options={disabled ? options.map((o) => ({ ...o, disabled: true })) : options}
          onValueChange={disabled ? () => undefined : onValueChange}
        />
      )}
    </div>
  );
}
