import { ORBIT_PLANS, type OrbitPlanId } from '@shared/flux';
import { useMemo, useState } from 'react';
import { anchor } from '@/content/reference';
import { count } from '@/content/reference/derive';
import {
  buildDeployFacts,
  buildDeploySteps,
  buildSpecView,
  buildStatusStages,
  ORBIT_READ_ON,
} from '@/content/reference/orbit';
import { CodeBlock, SegmentedControl } from '@/ui';
import { Dated } from '../../parts/Dated';
import { FactList, Slab } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { LintChip, SEVERITY_WORD } from '../../parts/LintChip';
import { KeyFact, Md } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Ol, Ul } from '../../parts/Semantics';
import { Steps } from '../../parts/Steps';
import styles from './orbit.module.css';

const STEPS = buildDeploySteps();
const STAGES = buildStatusStages();

/** The stages of a Git deploy, in order, and what makes one roll back. */
export function HowItRuns() {
  return (
    <Section id="how-a-deploy-runs">
      <Steps steps={STEPS} idOf={anchor.deployStep} label="The stages of a Git deploy" />
      <div className={styles.block}>
        <p className={styles.blockTitle}>The stages the status endpoint reports</p>
        <Ol className={styles.stages} aria-label="Stage names, in order">
          {STAGES.map((s) => (
            <li key={s} className={styles.stage}>
              <code>{s}</code>
            </li>
          ))}
        </Ol>
      </div>
      <FactList section="how-a-deploy-runs" rows={buildDeployFacts()} />
    </Section>
  );
}

/** The spec a plan registers, annotated, with the linter's own result for it. */
export function GeneratedSpec() {
  const [plan, setPlan] = useState<OrbitPlanId>('starter');
  const view = useMemo(() => buildSpecView(plan), [plan]);
  const { lint } = view;
  const summary = [
    lint.errors === 0 ? 'No errors' : count(lint.errors, 'error'),
    count(lint.warnings, 'warning'),
    count(lint.infos, 'note'),
  ].join(', ');

  return (
    <Section id="generated-spec">
      <Dated date={ORBIT_READ_ON}>Plan sizes read on</Dated>
      <KeyFact label="Placeholders">
        <p>
          The owner is the Academy's placeholder Flux ID and the repository is an example, so this spec is a
          teaching artefact and not deployable as it stands. Its shape is the one live Orbit specs have.
        </p>
      </KeyFact>
      <div className={styles.controls}>
        <div className={styles.control}>
          <span className={styles.controlLabel} aria-hidden="true">
            Plan
          </span>
          <SegmentedControl
            size="sm"
            aria-label="Orbit plan to show"
            value={plan}
            onValueChange={(v) =>
              setPlan((ORBIT_PLANS.find((p) => p.id === v)?.id ?? 'starter') as OrbitPlanId)
            }
            options={ORBIT_PLANS.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      </div>

      <div className={styles.specGrid}>
        <CodeBlock lang="json" filename={`${view.spec.name}.json`} code={view.json} />
        <Slab>
          <Ol className={styles.notes} aria-label="What each field of the spec is">
            {view.notes.map((n) => (
              <li key={n.id} id={anchor.specNote(n.id)} className={styles.note}>
                <p className={styles.noteHead}>
                  <code className={styles.noteKey}>{n.key}</code>
                  <span className={styles.noteLine}>Line {n.line}</span>
                </p>
                <p className={styles.noteText}>
                  <Md text={n.text} />
                </p>
                <ProvChips prov={n.prov} />
              </li>
            ))}
          </Ol>
        </Slab>
      </div>

      <div className={styles.lintBox}>
        <p className={styles.blockTitle}>The linter's result for {view.plan.name}</p>
        <p className={styles.lintSummary} role="status">
          {view.plan.name}: {summary}.
        </p>
        <Slab>
          <Ul className={styles.lintIssues} aria-label={`Linter findings for ${view.plan.name}`}>
            {lint.issues.map((i) => (
              <li key={`${i.code}-${i.path}`} className={styles.lintIssue}>
                <div className={styles.lintHead}>
                  <LintChip code={i.code} />
                  <span className={styles.sev}>{SEVERITY_WORD[i.severity]}</span>
                  <span className={styles.lintPath}>{i.path === '' ? 'whole spec' : i.path}</span>
                </div>
                <p className={styles.lintText}>{i.message}</p>
                <p className={styles.lintText}>
                  <Md text={i.explain} />
                </p>
              </li>
            ))}
          </Ul>
        </Slab>
      </div>
    </Section>
  );
}
