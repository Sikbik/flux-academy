import { LABS } from '@shared/curriculum';
import { routeMeta } from '@shared/site';
import { Link } from 'react-router';
import { Chip, Glyph, type GlyphName, isGlyphName, Panel } from '@/ui';
import { labDefaults } from './defaults';
import styles from './labs.module.css';
import { labIsShipped, preloadLab } from './registry';

/** The first of these that the glyph set has wins, so a richer glyph set improves the cards for free. */
const LAB_GLYPHS: Record<string, readonly string[]> = {
  'spec-forge': ['lab-forge', 'sliders'],
  network: ['lab-network', 'globe', 'layers'],
  failover: ['lab-failover', 'node-down', 'reset'],
  terminal: ['lab-terminal', 'terminal'],
  explorer: ['lab-explorer', 'search'],
  'agent-desk': ['lab-agent-desk', 'shield', 'key'],
};

function glyphFor(id: string): GlyphName {
  const found = (LAB_GLYPHS[id] ?? []).find((g) => isGlyphName(g));
  return (found as GlyphName | undefined) ?? 'layers';
}

export function LabsIndex() {
  const meta = routeMeta('/labs');
  return (
    <div className={styles.index}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Hands-on</p>
        <h1 className={styles.h1} tabIndex={-1}>
          Labs
        </h1>
        <p className={styles.lead}>{meta?.description}</p>
      </header>
      <ul className={styles.cards} aria-label="The labs">
        {LABS.map((lab, i) => {
          const shipped = labIsShipped(lab.id);
          const defaults = labDefaults(lab.id);
          return (
            <li key={lab.id} className={styles.cardItem}>
              <Panel
                as={Link}
                to={`/labs/${lab.id}`}
                interactive
                padding="lg"
                className={styles.card}
                contentClassName={styles.cardInner}
                aria-label={`${lab.title}. ${lab.cta}.`}
                onPointerEnter={() => preloadLab(lab.id)}
                onFocus={() => preloadLab(lab.id)}
              >
                <span className={styles.cardTop}>
                  <span className={styles.index_no} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Glyph name={glyphFor(lab.id)} size={28} className={styles.cardGlyph} />
                </span>
                <span className={styles.cardTitle}>{lab.title}</span>
                <span className={styles.cardBody}>{lab.summary}</span>
                <span className={styles.cardFoot}>
                  <span className={styles.tags}>
                    {defaults.tags.map((t) => (
                      <Chip key={t} size="sm" tone={t === 'Simulation' ? 'neutral' : 'accent'}>
                        {t}
                      </Chip>
                    ))}
                    {shipped ? null : (
                      <Chip size="sm" icon="clock">
                        Being built
                      </Chip>
                    )}
                  </span>
                  <span className={styles.cta}>
                    {lab.cta}
                    <Glyph name="arrow-right" size={14} />
                  </span>
                </span>
              </Panel>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
