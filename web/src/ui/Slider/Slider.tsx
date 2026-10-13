import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useControllableState } from '../hooks/useControllableState';
import { cn } from '../internal/cn';
import { decimalsOf } from '../internal/math';
import { mergeRefs } from '../internal/refs';
import styles from './Slider.module.css';
import { isMajorTick, pctOf, snapValue, tickValues } from './slider';

export interface SliderMark {
  value: number;
  label?: ReactNode;
}

export interface SliderProps {
  /** The accessible name and the caption above the rail. */
  label: string;
  /** Hide the caption (the name stays for assistive tech). */
  hideLabel?: boolean;
  value?: number;
  defaultValue?: number;
  /** Fires continuously while dragging or stepping. */
  onValueChange?: (value: number) => void;
  /** Fires when the gesture ends (release, or a key press). Use it for expensive work. */
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Labelled marks under the rail. `true` labels the two ends. */
  marks?: boolean | SliderMark[];
  /** Tick marks: every step when few, thinned when many. Default true. */
  ticks?: boolean;
  /** Formats the readout and the spoken value: `(n) => `${n} instances``. */
  format?: (value: number) => string;
  /** Appended to the readout in the dim mono voice. */
  unit?: string;
  /** Where the value shows: the header (default), a bubble over the thumb, both, or none. */
  readout?: 'header' | 'bubble' | 'both' | 'none';
  /** Recolours the rail for a tier. Tier colour means tier. */
  tier?: 'cumulus' | 'nimbus' | 'stratus';
  size?: 'md' | 'lg';
  disabled?: boolean;
  hint?: ReactNode;
  name?: string;
  id?: string;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

/**
 * The control of this site: a hex thumb on a ticked rail, with a mono readout. Built on a
 * real `<input type="range">` laid over the drawing, so pointer, touch, keyboard (arrows,
 * PageUp, PageDown, Home, End) and assistive tech are native; the drawing is the hex thumb,
 * the glowing fill and the tick marks.
 *
 *   <Slider label="Instances" min={1} max={12} value={n} onValueChange={setN} unit="instances" marks />
 */
export function Slider({
  label,
  hideLabel = false,
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  marks,
  ticks = true,
  format,
  unit,
  readout = 'header',
  tier,
  size = 'md',
  disabled = false,
  hint,
  name,
  id: idProp,
  className,
  ref,
}: SliderProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const hintId = `${id}-hint`;
  const [value, setValue] = useControllableState<number>(valueProp, defaultValue ?? min, onValueChange);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const v = snapValue(value, min, max, step);
  const pct = pctOf(v, min, max);
  const decimals = decimalsOf(step);
  const text = format ? format(v) : v.toFixed(decimals);

  const tickList = useMemo(() => (ticks ? tickValues(min, max, step) : []), [ticks, min, max, step]);
  const markList = useMemo<SliderMark[]>(() => {
    if (marks === true) return [{ value: min }, { value: max }];
    return marks ? marks : [];
  }, [marks, min, max]);

  const commit = useCallback(() => {
    setDragging(false);
    const el = input.current;
    if (el) onValueCommit?.(snapValue(Number(el.value), min, max, step));
  }, [onValueCommit, min, max, step]);

  const showHeader = readout === 'header' || readout === 'both';
  const showBubble = readout === 'bubble' || readout === 'both';

  return (
    <div
      className={cn(styles.slider, className)}
      data-size={size}
      data-disabled={disabled ? 'true' : undefined}
      data-dragging={dragging ? 'true' : undefined}
      data-tier={tier}
      style={{ '--pct': pct } as CSSProperties}
    >
      {(!hideLabel || showHeader) && (
        <div className={styles.head}>
          {hideLabel ? (
            <span />
          ) : (
            <label htmlFor={id} className={styles.label}>
              {label}
            </label>
          )}
          {showHeader ? (
            <output className={styles.readout} htmlFor={id}>
              <span className={styles.value}>{text}</span>
              {unit ? <span className={styles.unit}>{unit}</span> : null}
            </output>
          ) : null}
        </div>
      )}
      <div className={styles.control}>
        <div className={styles.rail} aria-hidden="true">
          <span className={styles.track} />
          <span className={styles.fill} />
          {tickList.map((t, i) => (
            <span
              key={t}
              className={styles.tick}
              data-major={isMajorTick(i, tickList.length, 5) ? 'true' : undefined}
              data-lit={t <= v ? 'true' : undefined}
              style={{ '--tp': pctOf(t, min, max) } as CSSProperties}
            />
          ))}
          <span className={styles.thumb}>
            <span className={styles.thumbHex} />
            {showBubble ? (
              <span className={styles.bubble}>
                {text}
                {unit ? ` ${unit}` : ''}
              </span>
            ) : null}
          </span>
        </div>
        <input
          ref={mergeRefs(input, ref)}
          id={id}
          name={name}
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={v}
          disabled={disabled}
          aria-label={hideLabel ? label : undefined}
          aria-valuetext={`${text}${unit ? ` ${unit}` : ''}`}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => setValue(snapValue(Number(e.target.value), min, max, step))}
          onPointerDown={() => setDragging(true)}
          onPointerUp={commit}
          onPointerCancel={commit}
          onKeyUp={(e) => {
            if (
              [
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'ArrowDown',
                'PageUp',
                'PageDown',
                'Home',
                'End',
              ].includes(e.key)
            ) {
              commit();
            }
          }}
          onBlur={() => setDragging(false)}
        />
        {markList.length > 0 ? (
          <div className={styles.marks} aria-hidden="true">
            {markList.map((m) => (
              <span
                key={m.value}
                className={styles.mark}
                data-edge={m.value === min ? 'start' : m.value === max ? 'end' : undefined}
                style={{ '--mp': pctOf(m.value, min, max) } as CSSProperties}
              >
                {m.label ?? m.value}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
