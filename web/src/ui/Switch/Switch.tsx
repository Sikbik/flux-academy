import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useControllableState } from '../hooks/useControllableState';
import { cn } from '../internal/cn';
import styles from './Switch.module.css';

export interface SwitchProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'checked' | 'defaultChecked' | 'onChange' | 'size'
  > {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** The label. Without it, pass `aria-label`. */
  children?: ReactNode;
  /** A line of explanation under the label. */
  description?: ReactNode;
  size?: 'sm' | 'md';
  /** Which side the label sits on. Default `end`. */
  labelPosition?: 'start' | 'end';
  ref?: Ref<HTMLInputElement>;
}

/**
 * A switch: a hex-native pill (an elongated hexagon) with a hex knob. A real checkbox with
 * `role="switch"` underneath, so it works in forms, with the keyboard (Space) and with
 * assistive tech. The label is the whole row's hit area.
 *
 *   <Switch checked={sound} onCheckedChange={setSound}>Sound</Switch>
 */
export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  children,
  description,
  size = 'md',
  labelPosition = 'end',
  disabled,
  className,
  ref,
  ...rest
}: SwitchProps) {
  const [on, setOn] = useControllableState<boolean>(checked, defaultChecked, onCheckedChange);
  return (
    <label
      className={cn(styles.switch, className)}
      data-size={size}
      data-disabled={disabled ? 'true' : undefined}
      data-label={labelPosition}
    >
      <input
        {...rest}
        ref={ref}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={on}
        disabled={disabled}
        aria-checked={on}
        onChange={(e) => setOn(e.target.checked)}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.edge} />
        <span className={styles.face} />
        <span className={styles.knob} />
      </span>
      {children != null || description != null ? (
        <span className={styles.text}>
          {children != null ? <span className={styles.label}>{children}</span> : null}
          {description != null ? <span className={styles.desc}>{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
