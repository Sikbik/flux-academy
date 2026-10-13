/**
 * One problem, answered: the short answer first, then the causes in the order to check them, each with how
 * to tell and how to fix. Everything below the short answer is progressive: one cause is open, the rest are
 * a line each.
 */

import { labById, lessonById } from '@shared/curriculum';
import { type ReactNode, useState } from 'react';
import { type Cause, checkedOnOf, FLUXOS_VERSION, type Symptom, symptomById } from '@/content/troubleshoot';
import { getTerm } from '@/learn/glossary';
import { MarkupText } from '@/learn/MarkupText';
import { Accordion, AccordionItem, Button, Callout, type GlyphName, Panel } from '@/ui';
import { LinkChip } from '../glossary/LinkChip';
import { termHref } from '../glossary/model';
import {
  codesForSymptom,
  evidenceOf,
  evidenceSentence,
  fill,
  hrefOf,
  LIKELIHOOD_WORD,
  messagesForSymptom,
} from './model';
import { useNames } from './names';
import { CheckedOnContext, ProofChip, ProofLine } from './ProofChip';
import styles from './parts.module.css';
import { CheckList, FixList, labHref } from './Steps';

const LAB_GLYPH: Record<string, GlyphName> = {
  'spec-forge': 'lab-forge',
  network: 'lab-network',
  failover: 'lab-failover',
  terminal: 'lab-terminal',
  explorer: 'lab-explorer',
  'agent-desk': 'lab-agent-desk',
};

/**
 * How likely a cause is, and its evidence chip. It sits at the right of the row, and under the title when the
 * row is narrow, where beside the title it would squeeze the title to a word a line (see `.causeMetaBelow`).
 * Only one of the two is shown at a time, so a reader of the page hears it once.
 */
function CauseMeta({ cause, className }: { cause: Cause; className?: string }) {
  return (
    <span className={className}>
      {LIKELIHOOD_WORD[cause.likelihood]}
      <span aria-hidden="true"> · </span>
      <span className="sr-only">, evidence: </span>
      <ProofChip proof={cause.proof} />
    </span>
  );
}

function CauseBody({ cause, last, onNext }: { cause: Cause; last: boolean; onNext: () => void }) {
  const names = useNames();
  const lessons = (cause.lessons ?? []).map((id) => lessonById(id)).filter((l) => l !== undefined);
  const terms = (cause.terms ?? []).map((id) => getTerm(id)).filter((t) => t !== undefined);
  const see = (cause.see ?? []).map((id) => symptomById(id)).filter((s) => s !== undefined);

  return (
    <div className={styles.cause}>
      <p className={styles.why}>
        <MarkupText text={fill(cause.why, names)} />
      </p>

      <section className={styles.block} aria-labelledby={`cause-${cause.id}-check`}>
        <h5 id={`cause-${cause.id}-check`} className={styles.blockTitle}>
          How to tell
        </h5>
        <CheckList checks={cause.checks} />
      </section>

      <section className={styles.block} aria-labelledby={`cause-${cause.id}-fix`}>
        <h5 id={`cause-${cause.id}-fix`} className={styles.blockTitle}>
          How to fix it
        </h5>
        <FixList fixes={cause.fixes} />
      </section>

      {see.length > 0 ? (
        <p className={styles.seeLine}>
          <span className={styles.seeLabel}>Read next</span>
          {see.map((s) => (
            <LinkChip key={s.id} to={hrefOf.symptom(s.id)} size="sm">
              {s.title}
            </LinkChip>
          ))}
        </p>
      ) : null}

      {lessons.length > 0 || terms.length > 0 ? (
        <p className={styles.seeLine}>
          <span className={styles.seeLabel}>Learn it</span>
          {lessons.map((l) => (
            <LinkChip key={l.id} to={`/learn/${l.id}`} size="sm" tier={l.track}>
              {l.title}
            </LinkChip>
          ))}
          {terms.map((t) => (
            <LinkChip key={t.id} to={termHref(t.id)} size="sm" icon="book">
              {t.term}
            </LinkChip>
          ))}
        </p>
      ) : null}

      <footer className={styles.causeFoot}>
        <ProofLine proof={cause.proof} />
        {last ? (
          <p className={styles.endNote}>
            That is the last cause we know of for this problem. If none of these fit, the section at the end
            of the page says what to bring when you ask.
          </p>
        ) : (
          <Button variant="ghost" size="sm" iconEnd="arrow-down" onClick={onNext}>
            That is not it, next cause
          </Button>
        )}
      </footer>
    </div>
  );
}

export function SymptomView({ symptom, namesSlot }: { symptom: Symptom; namesSlot?: ReactNode }) {
  const names = useNames();
  const [open, setOpen] = useState<string | null>(symptom.causes[0]?.id ?? null);
  const checkedOn = checkedOnOf(symptom);

  // Reset to the first cause when the problem changes (the parent keys this component by id).
  const evidence = evidenceOf(symptom.causes);
  const lessons = symptom.lessons.map((id) => lessonById(id)).filter((l) => l !== undefined);
  const labs = (symptom.labs ?? []).map((id) => labById(id)).filter((l) => l !== undefined);
  const related = (symptom.related ?? []).map((id) => symptomById(id)).filter((s) => s !== undefined);
  const messages = messagesForSymptom(symptom.id);
  const codes = codesForSymptom(symptom);

  const goNext = (index: number) => {
    const next = symptom.causes[index + 1];
    if (!next) return;
    setOpen(next.id);
    window.setTimeout(() => {
      document.getElementById(`cause-${next.id}-head`)?.scrollIntoView({ block: 'nearest' });
    }, 60);
  };

  return (
    <CheckedOnContext.Provider value={checkedOn}>
      <article className={styles.detail} aria-labelledby="ts-heading">
        <header className={styles.detailHead}>
          <h2 id="ts-heading" className={styles.detailTitle} tabIndex={-1}>
            {symptom.title}
          </h2>
          <p className={styles.detailSummary}>{symptom.summary}</p>
          {symptom.seen.length > 0 ? (
            <div className={styles.seen}>
              <span className={styles.seenLabel}>What you may see</span>
              <ul className={styles.seenList}>
                {symptom.seen.map((s) => (
                  <li key={s}>
                    <q>{s}</q>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </header>

        <Panel
          variant="glass"
          tone="neutral"
          padding="md"
          size="md"
          halo={false}
          marks={false}
          className={styles.answer}
        >
          <p className={styles.answerLabel}>The short answer</p>
          <p className={styles.answerText}>
            <MarkupText text={fill(symptom.quick, names)} />
          </p>
          <p className={styles.evidence}>
            {evidenceSentence(evidence)} Checked {checkedOn} against{' '}
            {symptom.checkedAgainst ?? `FluxOS ${FLUXOS_VERSION}`}.
          </p>
        </Panel>

        {symptom.notice ? (
          <Callout kind="gotcha" title={symptom.notice.title}>
            <MarkupText text={fill(symptom.notice.text, names)} />
          </Callout>
        ) : null}

        {namesSlot}

        <section className={styles.causes} aria-labelledby="ts-causes">
          <div className={styles.causesHead}>
            <h3 id="ts-causes" className={styles.causesTitle}>
              Causes, in the order to check them
            </h3>
            <p className={styles.causesNote}>
              The order, and the words usual, common, possible and rare beside each cause, are our judgement
              of what to check first, not a measurement. The evidence chips are the part that speaks about the
              facts.
            </p>
          </div>
          <Accordion type="single" value={open} onValueChange={setOpen}>
            {symptom.causes.map((c, i) => (
              <AccordionItem
                key={c.id}
                value={c.id}
                level={4}
                title={
                  <span id={`cause-${c.id}-head`} className={styles.causeTitle}>
                    <span className={styles.causeNum} aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className={styles.causeText}>
                      <span>{c.title}</span>
                      <CauseMeta cause={c} className={styles.causeMetaBelow} />
                    </span>
                  </span>
                }
                meta={<CauseMeta cause={c} className={styles.causeMeta} />}
              >
                <CauseBody cause={c} last={i === symptom.causes.length - 1} onNext={() => goNext(i)} />
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {symptom.caveat ? (
          <Callout kind="gotcha" title="What we do not know">
            <MarkupText text={fill(symptom.caveat, names)} />
          </Callout>
        ) : null}

        {messages.length > 0 ? (
          <section className={styles.related} aria-labelledby="ts-messages">
            <h3 id="ts-messages" className={styles.relatedTitle}>
              Messages that point here
            </h3>
            <ul className={styles.relatedList}>
              {messages.slice(0, 6).map((m) => (
                <li key={m.id}>
                  <LinkChip to={hrefOf.message(m.id)} size="sm" mono={false} title={m.text}>
                    {m.text}
                  </LinkChip>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {codes.length > 0 ? (
          <section className={styles.related} aria-labelledby="ts-codes">
            <h3 id="ts-codes" className={styles.relatedTitle}>
              Lint codes the Spec Forge shows for this
            </h3>
            <ul className={styles.relatedList}>
              {codes.slice(0, 10).map((c) => (
                <li key={c}>
                  <LinkChip to={hrefOf.code(c)} size="sm" mono>
                    {c}
                  </LinkChip>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={styles.related} aria-labelledby="ts-learn">
          <h3 id="ts-learn" className={styles.relatedTitle}>
            Learn the thing behind it
          </h3>
          <ul className={styles.relatedList}>
            {lessons.map((l) => (
              <li key={l.id}>
                <LinkChip
                  to={`/learn/${l.id}`}
                  size="md"
                  tier={l.track}
                  lead={String(l.order).padStart(2, '0')}
                >
                  {l.title}
                </LinkChip>
              </li>
            ))}
            {labs.map((l) => (
              <li key={l.id}>
                <LinkChip to={labHref(l.id)} size="md" icon={LAB_GLYPH[l.id] ?? 'layers'}>
                  {l.title}
                </LinkChip>
              </li>
            ))}
            {related.map((s) => (
              <li key={s.id}>
                <LinkChip to={hrefOf.symptom(s.id)} size="md" icon="help">
                  {s.title}
                </LinkChip>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </CheckedOnContext.Provider>
  );
}
