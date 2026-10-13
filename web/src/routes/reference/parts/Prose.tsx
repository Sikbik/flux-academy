import type { ReactNode } from 'react';
import { InlineMarkup } from '@/app/InlineMarkup';
import { cn } from '@/lib/cn';
import styles from './parts.module.css';

/** Inline Academy markup: `code`, **bold**, {{term:id}}, [label](url). */
export function Md({ text }: { text: string }) {
  return <InlineMarkup text={text} />;
}

/** A paragraph of markup in the reference voice. */
export function P({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn(styles.p, className)}>
      <InlineMarkup text={text} />
    </p>
  );
}

/** Small text under a control or a table. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn(styles.noteText, className)}>{children}</p>;
}

/**
 * A fact worth stopping for, drawn the way a blueprint marks a dimension that matters: tick marks down
 * the left edge and crosshairs on two corners. Use it a few times a page, not on every paragraph.
 */
export function KeyFact({ label = 'Key fact', children }: { label?: string; children: ReactNode }) {
  return (
    <div className={styles.keyFact} role="note" aria-label={label}>
      <span className={styles.keyTicks} aria-hidden="true" />
      <span className={styles.keyCross} data-corner="tl" aria-hidden="true" />
      <span className={styles.keyCross} data-corner="br" aria-hidden="true" />
      <div className={styles.keyBody}>
        <span className={styles.keyLabel}>
          <span className={styles.keyBullet} aria-hidden="true" />
          {label}
        </span>
        <div className={styles.keyText}>{children}</div>
      </div>
    </div>
  );
}
