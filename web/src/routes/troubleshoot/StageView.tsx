import { Link } from 'react-router';
import { type StageId, stageById, symptomsOfStage } from '@/content/troubleshoot';
import { Glyph, Panel } from '@/ui';
import { hrefOf, plural } from './model';
import styles from './parts.module.css';

/** The problems of one stage, as a list of cards. */
export function StageView({ stage }: { stage: StageId }) {
  const info = stageById(stage);
  const list = symptomsOfStage(stage);
  return (
    <section className={styles.stageView} aria-labelledby="ts-heading">
      <header className={styles.viewHead}>
        <h2 id="ts-heading" className={styles.viewTitle} tabIndex={-1}>
          {info.title}
        </h2>
        <p className={styles.viewLead}>{info.blurb} Choose the one that sounds like yours.</p>
      </header>

      <ul className={styles.stageList}>
        {list.map((s) => (
          <li key={s.id}>
            <Panel
              as={Link}
              to={hrefOf.symptom(s.id)}
              variant="slab"
              interactive
              size="sm"
              padding="md"
              marks={false}
              className={styles.stageItemCard}
              contentClassName={styles.symptomBody}
            >
              <span className={styles.symptomTitle}>{s.title}</span>
              <span className={styles.symptomSummary}>{s.summary}</span>
              <span className={styles.symptomMeta}>
                {plural(s.causes.length, 'cause', 'causes')}
                <Glyph name="arrow-right" size={14} />
              </span>
            </Panel>
          </li>
        ))}
      </ul>
    </section>
  );
}
