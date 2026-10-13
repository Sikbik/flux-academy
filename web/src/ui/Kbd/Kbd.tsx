import { type ReactNode, useSyncExternalStore } from 'react';
import { Glyph } from '../Glyph/Glyph';
import { cn } from '../internal/cn';
import { detectMac, parseCombo, spokenCombo } from './combo';
import styles from './Kbd.module.css';

export interface KbdProps {
  /** A combo: "mod+k" (Command on a Mac, Ctrl elsewhere), "shift+/", or a sequence "g o". */
  combo?: string;
  /** A single key cap, when you are not using `combo`. */
  children?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

const noopSubscribe = () => () => {};

/**
 * A keyboard key cap, or a combo of them. `mod` follows the platform. The visual is
 * decorative; the accessible name speaks the whole combo ("Control K").
 *
 *   <Kbd combo="mod+k" />
 *   <Kbd>Esc</Kbd>
 */
export function Kbd({ combo, children, size = 'md', className }: KbdProps) {
  const mac = useSyncExternalStore(noopSubscribe, detectMac, () => false);
  if (!combo) {
    return (
      <kbd className={cn(styles.kbd, className)} data-size={size}>
        {children}
      </kbd>
    );
  }
  const tokens = parseCombo(combo, mac);
  const label = spokenCombo(tokens);
  return (
    <span className={cn(styles.combo, className)} data-size={size} role="img" aria-label={label}>
      {tokens.map((t, i) =>
        t.kind === 'then' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: tokens are a static ordered list
          <span key={i} className={styles.then}>
            then
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: tokens are a static ordered list
          <kbd key={i} className={styles.kbd} data-size={size}>
            {t.label.glyph ? <Glyph name={t.label.glyph} size={size === 'sm' ? 11 : 13} /> : t.label.text}
          </kbd>
        ),
      )}
    </span>
  );
}
