import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useId, useRef, useState } from 'react';
import { Glyph } from '../Glyph/Glyph';
import type { GlyphName } from '../Glyph/glyphs';
import { useControllableState } from '../hooks/useControllableState';
import { useIsoLayoutEffect } from '../hooks/useIsoLayoutEffect';
import { cn } from '../internal/cn';
import { firstEnabled, rovingTarget } from '../Tabs/roving';
import styles from './SegmentedControl.module.css';

export interface SegmentOption {
  value: string;
  label?: ReactNode;
  icon?: GlyphName;
  /** A count after the label, in tabular numerals. */
  count?: number | string;
  /** The accessible name. Required for icon-only options (no `label`). */
  ariaLabel?: string;
  disabled?: boolean;
  /** A pseudo-state hook for the kit gallery and visual tests. */
  force?: 'hover' | 'press' | 'focus';
}

export interface SegmentedControlProps {
  options: readonly SegmentOption[];
  /** The selected value (controlled). */
  value?: string;
  /** The initially selected value (uncontrolled). Defaults to the first enabled option. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Names the group for assistive tech. Required. */
  'aria-label': string;
  size?: 'sm' | 'md' | 'lg';
  /** Fill the container's width. */
  fullWidth?: boolean;
  /** The radio group name (generated when omitted). */
  name?: string;
  className?: string;
}

const MODES = ['row', 'compact', 'stack'] as const;

/**
 * A single-choice switch between a few views or units: a radio group with a sliding,
 * hex-edged thumb. One tab stop; arrows (and Home and End) move and select. Segments share
 * one width so the thumb only ever translates. When the control does not fit its container
 * it first drops icons and counts (compact), then stacks the options vertically.
 *
 *   <SegmentedControl aria-label="Currency" options={[{ value: 'usd', label: 'USD' }, { value: 'flux', label: 'FLUX' }]} />
 */
export function SegmentedControl({
  options,
  value: valueProp,
  defaultValue,
  onValueChange,
  'aria-label': ariaLabel,
  size = 'md',
  fullWidth = false,
  name,
  className,
}: SegmentedControlProps) {
  const uid = useId();
  const groupName = name ?? `seg-${uid}`;
  const fallback = options[firstEnabled(options)]?.value ?? '';
  const [value, setValue] = useControllableState<string>(valueProp, defaultValue ?? fallback, onValueChange);
  const checkedIndex = options.findIndex((o) => o.value === value);
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusVisible, setFocusVisible] = useState(false);
  const forcedFocus = options.some((o) => o.force === 'focus');

  // Fit: try the roomy layout, then compact, then stacked, and keep the first that fits.
  // The mode is a DOM attribute (not state): the CSS needs nothing else.
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const settle = () => {
      for (const m of MODES) {
        root.dataset.mode = m;
        if (m === 'stack' || root.scrollWidth <= root.clientWidth + 1) break;
      }
    };
    settle();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(settle);
    ro.observe(root);
    if (root.parentElement) ro.observe(root.parentElement);
    return () => ro.disconnect();
  }, [options, size, fullWidth]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Arrows are native to a radio group; Home and End are not.
    if (e.key !== 'Home' && e.key !== 'End') return;
    const target = rovingTarget(options, checkedIndex, e.key, { orientation: 'both' });
    if (target === null) return;
    e.preventDefault();
    const inputs = rootRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    inputs?.[target]?.focus();
    const opt = options[target];
    if (opt) setValue(opt.value);
  };

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('chamfer', styles.group, className)}
      data-size={size}
      data-full={fullWidth ? 'true' : undefined}
      data-focus={focusVisible || forcedFocus ? 'true' : undefined}
      data-empty={checkedIndex < 0 ? 'true' : undefined}
      style={{ '--n': options.length, '--i': Math.max(0, checkedIndex) } as React.CSSProperties}
      onKeyDown={onKeyDown}
      onFocus={(e) => setFocusVisible((e.target as HTMLElement).matches(':focus-visible'))}
      onBlur={() => setFocusVisible(false)}
    >
      <span className={styles.edge} aria-hidden="true" />
      <span className={styles.fill} aria-hidden="true" />
      <span className={styles.thumb} aria-hidden="true">
        <span className={styles.thumbEdge} />
        <span className={styles.thumbFace} />
      </span>
      {options.map((opt) => {
        const checked = opt.value === value;
        return (
          <label
            key={opt.value}
            className={styles.opt}
            data-checked={checked ? 'true' : undefined}
            data-disabled={opt.disabled ? 'true' : undefined}
            data-force={opt.force && opt.force !== 'focus' ? opt.force : undefined}
          >
            <input
              type="radio"
              className={styles.input}
              name={groupName}
              value={opt.value}
              checked={checked}
              disabled={opt.disabled}
              aria-label={opt.label == null ? opt.ariaLabel : undefined}
              onChange={() => setValue(opt.value)}
            />
            <span className={styles.content}>
              {opt.icon ? (
                <span className={styles.icon}>
                  <Glyph name={opt.icon} size={size === 'sm' ? 15 : 17} />
                </span>
              ) : null}
              {opt.label != null ? <span className={styles.label}>{opt.label}</span> : null}
              {opt.count != null ? <span className={styles.count}>{opt.count}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
