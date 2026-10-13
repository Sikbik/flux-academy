import type { ReactNode } from 'react';
import { Reveal } from '@/ui';
import styles from './section.module.css';

export interface SectionHeadProps {
  /** Two digits, for example `03`. Decorative: the order of the headings carries the structure. */
  number: string;
  /** The mono caps label after the number. */
  label: string;
  /** Id of the h2, for `aria-labelledby` on the section. */
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Small things that belong with the heading: a freshness chip, a legend. */
  aside?: ReactNode;
}

/**
 * The head of a home page section: `03 / PICK YOUR PATH`, a heading, one plain sentence. It reveals once
 * as it scrolls in; everything below it is already in the DOM.
 */
export function SectionHead({ number, label, id, title, lead, aside }: SectionHeadProps) {
  return (
    <Reveal as="header" className={styles.head}>
      <p className={styles.eyebrow}>
        <span className={styles.num} aria-hidden="true">
          {number}
        </span>
        <span className={styles.slash} aria-hidden="true">
          /
        </span>
        <span>{label}</span>
        <span className={styles.rule} aria-hidden="true" />
      </p>
      <h2 id={id} className={styles.title}>
        {title}
      </h2>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
      {aside ? <div className={styles.aside}>{aside}</div> : null}
    </Reveal>
  );
}
