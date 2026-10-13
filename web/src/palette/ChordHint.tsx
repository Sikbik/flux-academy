import { type CSSProperties, useLayoutEffect, useMemo, useState } from 'react';
import { useHotkeyView } from '@/system/hotkeys';
import { Kbd } from '@/ui';
import { chordBottom, watchToastStack } from './chordLift';
import styles from './Shortcuts.module.css';
import { chordOptions } from './shortcuts';

/**
 * A moment after `g` (or any chord prefix) is pressed, shows what the second key does. It disappears when
 * the chord times out or completes. Mounted once by the shell; renders nothing when no chord is armed.
 *
 * It shares the bottom centre with toasts, so while one is showing the hint rises above the stack
 * (`chordLift.ts`) instead of covering it.
 */
export default function ChordHint() {
  const pending = useHotkeyView((s) => s.pending);
  const defs = useHotkeyView((s) => s.defs);
  const options = useMemo(() => (pending ? chordOptions(defs, pending) : []), [defs, pending]);
  const visible = Boolean(pending) && options.length > 0;

  // A layout effect, so a toast that is already showing is cleared before the hint is first painted.
  const [clearance, setClearance] = useState(0);
  useLayoutEffect(() => {
    if (!visible) return undefined;
    return watchToastStack(setClearance);
  }, [visible]);

  if (!pending || options.length === 0) return null;
  const bottom = chordBottom(clearance);
  const style = bottom === null ? undefined : ({ '--chord-bottom': `${bottom}px` } as CSSProperties);
  return (
    <div className={styles.chord} style={style} role="status" aria-live="polite">
      <div className={styles.chordInner}>
        <span className={styles.chordLead}>
          <Kbd size="sm">{pending.toUpperCase()}</Kbd> then
        </span>
        {options.map((o) => (
          <span key={`${o.key}:${o.label}`} className={styles.chordItem}>
            <Kbd size="sm">{o.key.toUpperCase()}</Kbd> {o.label.replace(/^Go to (the )?/i, '')}
          </span>
        ))}
      </div>
    </div>
  );
}
