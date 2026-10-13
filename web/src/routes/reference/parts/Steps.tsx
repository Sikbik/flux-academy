import type { Provenance } from '@/content/reference';
import styles from './catalogue.module.css';
import { Slab } from './Facts';
import { CopyLink } from './Heading';
import { Md } from './Prose';
import { ProvChips } from './Prov';

export interface StepItem {
  id: string;
  title: string;
  /** Inline markup. */
  text: string;
  prov: readonly Provenance[];
}

/**
 * An ordered list of steps, each a linkable element with its basis. `idOf` gives the element id, so the
 * search index and the deep links use the same function as the page.
 */
export function Steps({
  steps,
  idOf,
  label,
}: {
  steps: readonly StepItem[];
  idOf: (id: string) => string;
  label: string;
}) {
  return (
    <Slab>
      <ol className={styles.steps} aria-label={label}>
        {steps.map((s, i) => {
          const id = idOf(s.id);
          return (
            <li key={s.id} id={id} className={styles.step}>
              <span className={styles.stepNum} aria-hidden="true">
                {i + 1}
              </span>
              <div className={styles.stepBody}>
                <p className={styles.stepTitle}>
                  <span>{s.title}</span>
                  <CopyLink id={id} label={s.title} className={styles.stepLink} />
                </p>
                <p className={styles.stepText}>
                  <Md text={s.text} />
                </p>
                <ProvChips prov={s.prov} />
              </div>
            </li>
          );
        })}
      </ol>
    </Slab>
  );
}
