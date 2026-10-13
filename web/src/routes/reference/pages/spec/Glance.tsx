import { LIMITS } from '@shared/flux';
import { Link } from 'react-router';
import { anchor } from '@/content/reference';
import { buildCaps, buildGlanceMistakes, WHOLE_SPEC_CODES } from '@/content/reference/spec';
import { Slab } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { LintChip, LintChips } from '../../parts/LintChip';
import { KeyFact, Md } from '../../parts/Prose';
import { Ul } from '../../parts/Semantics';
import styles from './spec.module.css';

const CAPS = buildCaps();
const MISTAKES = buildGlanceMistakes();

/** The size of a version 8 spec and what goes wrong most often. */
export function Glance() {
  const appKeys = LIMITS.appKeys;
  const componentKeys = LIMITS.componentKeys;
  return (
    <Section id="at-a-glance">
      <KeyFact label="The shape">
        <p>
          A spec has {appKeys.length} top level keys and each component in <code>compose</code> has{' '}
          {componentKeys.length}. A key that is not on those lists is dropped before the network checks the
          spec, so it does nothing. Fields are listed below in the order the engine lists them.
        </p>
      </KeyFact>

      <div className={styles.keyLists}>
        <div>
          <p className={styles.detailLabel}>Top level</p>
          <Ul className={styles.jumpList}>
            {appKeys.map((k) => (
              <li key={k}>
                <Link to={{ hash: `#app-${k}` }} className={styles.jumpChip}>
                  {k}
                </Link>
              </li>
            ))}
          </Ul>
        </div>
        <div>
          <p className={styles.detailLabel}>Per component</p>
          <Ul className={styles.jumpList}>
            {componentKeys.map((k) => (
              <li key={k}>
                <Link to={{ hash: `#component-${k}` }} className={styles.jumpChip}>
                  {k}
                </Link>
              </li>
            ))}
          </Ul>
        </div>
      </div>

      <Ul className={styles.caps} aria-label="Size caps">
        {CAPS.map((c) => (
          <li key={c.id} id={anchor.cap(c.id)} className={styles.cap}>
            <Link to={{ hash: `#${c.field}` }} className={styles.capLink}>
              <span className={styles.capLabel}>{c.label}</span>
              <span className={styles.capValue}>{c.value}</span>
              <span className={styles.capNote}>
                <Md text={c.note} />
              </span>
            </Link>
          </li>
        ))}
      </Ul>

      <div className={styles.block}>
        <p className={styles.blockTitle}>The mistakes behind most refusals</p>
        <Slab>
          <Ul className={styles.mistakes}>
            {MISTAKES.map((m) => (
              <li key={m.id} id={anchor.mistake(m.id)} className={styles.mistake}>
                <p className={styles.mistakeText}>
                  <Md text={m.text} />
                </p>
                <div className={styles.mistakeAside}>
                  <LintChip code={m.code} />
                  <Link to={{ hash: `#${m.field}` }} className="link">
                    Read the field
                  </Link>
                </div>
              </li>
            ))}
          </Ul>
        </Slab>
      </div>

      <LintChips codes={WHOLE_SPEC_CODES} label="About the whole spec" />
    </Section>
  );
}
