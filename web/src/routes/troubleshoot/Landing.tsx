import { Link } from 'react-router';
import { ERROR_STRINGS, STAGES, type StageInfo, symptomsOfStage } from '@/content/troubleshoot';
import { Glyph, type GlyphName, Panel } from '@/ui';
import { LINT_COUNT } from './lintCount';
import { hrefOf, plural } from './model';
import styles from './parts.module.css';

/** The stages of the journey, numbered; and the ways of deploying (Git, an agent), which are not the next stage. */
const JOURNEY = STAGES.filter((s) => !s.route);
const ROUTES = STAGES.filter((s) => s.route);

/** A card for each stage. `mark` is the small decorative label at the top left: a number, or a letter for a route. */
function StageGrid({ stages, mark }: { stages: readonly StageInfo[]; mark: (index: number) => string }) {
  return (
    <ul className={styles.stageGrid}>
      {stages.map((stage, i) => {
        const n = symptomsOfStage(stage.id).length;
        return (
          <li key={stage.id}>
            <Panel
              as={Link}
              to={hrefOf.stage(stage.id)}
              variant="glass"
              interactive
              size="md"
              padding="md"
              halo={false}
              marks={false}
              className={styles.stageCard}
              contentClassName={styles.stageCardBody}
            >
              <span className={styles.stageTop}>
                <span className={styles.stageNo} aria-hidden="true">
                  {mark(i)}
                </span>
                <Glyph name={stage.glyph as GlyphName} size={24} className={styles.stageGlyph} />
              </span>
              <span className={styles.stageTitle}>{stage.title}</span>
              <span className={styles.stageBlurb}>{stage.blurb}</span>
              <span className={styles.stageFoot}>
                {plural(n, 'problem', 'problems')}
                <Glyph name="arrow-right" size={14} />
              </span>
            </Panel>
          </li>
        );
      })}
    </ul>
  );
}

/** The home view: where are you stuck, or look a thing up. */
export function Landing() {
  return (
    <div className={styles.landing}>
      <section aria-labelledby="ts-stages">
        <h2 id="ts-stages" className={styles.sectionTitle}>
          Where are you stuck?
        </h2>
        <StageGrid stages={JOURNEY} mark={(i) => String(i + 1).padStart(2, '0')} />
      </section>

      {ROUTES.length > 0 ? (
        <section aria-labelledby="ts-routes">
          <h2 id="ts-routes" className={styles.sectionTitle}>
            Deploying from Git or with an agent?
          </h2>
          <StageGrid stages={ROUTES} mark={(i) => String.fromCharCode(65 + i)} />
        </section>
      ) : null}

      <section aria-labelledby="ts-tools">
        <h2 id="ts-tools" className={styles.sectionTitle}>
          Or look something up
        </h2>
        <ul className={styles.toolGrid}>
          <li>
            <Panel
              as={Link}
              to={hrefOf.messages()}
              variant="slab"
              interactive
              size="md"
              padding="md"
              marks={false}
              className={styles.toolCard}
              contentClassName={styles.toolBody}
            >
              <span className={styles.toolHead}>
                <Glyph name="terminal" size={20} />
                <span className={styles.toolTitle}>Decode an error message</span>
              </span>
              <span className={styles.toolText}>
                {ERROR_STRINGS.length} real messages from the validator, FluxCloud, the public API, the
                payment bridge, Orbit and the agent servers, as they are written, with what each means.
              </span>
            </Panel>
          </li>
          <li>
            <Panel
              as={Link}
              to={hrefOf.codes()}
              variant="slab"
              interactive
              size="md"
              padding="md"
              marks={false}
              className={styles.toolCard}
              contentClassName={styles.toolBody}
            >
              <span className={styles.toolHead}>
                <Glyph name="code" size={20} />
                <span className={styles.toolTitle}>Look up a lint code</span>
              </span>
              <span className={styles.toolText}>
                {LINT_COUNT} codes the Spec Forge reports, each with why it matters and how to fix it, and for
                most of them an example spec to open.
              </span>
            </Panel>
          </li>
        </ul>
      </section>
    </div>
  );
}
