import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FreshnessChip } from '@/ui';
import styles from './catalogue.module.css';

/**
 * One line that says a catalogue is baked into the Academy and when it was read: the BAKED chip, a
 * sentence, and the date. Vendor tables (plans, tools, variables) are never live, so they carry this
 * instead of an age.
 */
export function Dated({
  date,
  children,
  className,
}: {
  /** ISO date the catalogue was read. */
  date: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn(styles.dated, className)}>
      <FreshnessChip kind="baked" hideAge />
      <span>
        {children} <time dateTime={date}>{date}</time>.
      </span>
    </p>
  );
}
