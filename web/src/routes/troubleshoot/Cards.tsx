/**
 * The inside of an error message entry and of a lint code entry. Used by the decoder and the code list
 * (as the open panel of a row) and by search (as the card for an exact match).
 */

import type { LintCodeMeta } from '@shared/flux/lint-catalogue';
import { AppLinkButton } from '@/app/AppLinkButton';
import {
  checkedOnOf,
  ERROR_SOURCE_LABEL,
  type ErrorString,
  exampleHref,
  FACTS_DATE,
  FLUXOS_VERSION,
  LINT_EXAMPLES,
  NEEDS_LIVE_DATA,
  symptomById,
} from '@/content/troubleshoot';
import { MarkupText } from '@/learn/MarkupText';
import { Chip, LinkButton } from '@/ui';
import { LinkChip } from '../glossary/LinkChip';
import { hrefOf, messagesForCode, SEVERITY_WORD, symptomsForCode } from './model';
import { CheckedOnContext, ProofLine } from './ProofChip';
import styles from './parts.module.css';

const SEVERITY_STATUS = { error: 'crit', warning: 'warn', info: 'off' } as const;

export function SeverityChip({ severity }: { severity: LintCodeMeta['severity'] }) {
  return (
    <Chip kind="status" status={SEVERITY_STATUS[severity]} size="sm">
      {SEVERITY_WORD[severity]}
    </Chip>
  );
}

/** What a message means, where it shows, and what to read next. */
export function MessageBody({ message }: { message: ErrorString }) {
  const symptom = message.symptom ? symptomById(message.symptom) : undefined;
  return (
    <div className={styles.entryBody}>
      <p className={styles.entryRow}>
        <span className={styles.entryLabel}>Where you see it</span>
        <span>
          {message.where}
          <span className={styles.entrySource}> ({ERROR_SOURCE_LABEL[message.source]})</span>
        </span>
      </p>
      <p className={styles.entryRow}>
        <span className={styles.entryLabel}>What it means</span>
        <span>
          <MarkupText text={message.means} />
        </span>
      </p>
      {symptom || (message.lint && message.lint.length > 0) ? (
        <div className={styles.entryLinks}>
          {symptom ? (
            <LinkChip to={hrefOf.symptom(symptom.id)} size="md" icon="help">
              {symptom.title}
            </LinkChip>
          ) : null}
          {(message.lint ?? []).map((c) => (
            <LinkChip key={c} to={hrefOf.code(c)} size="md" mono>
              {c}
            </LinkChip>
          ))}
        </div>
      ) : null}
      <CheckedOnContext.Provider value={symptom ? checkedOnOf(symptom) : FACTS_DATE}>
        <ProofLine proof={message.proof} />
      </CheckedOnContext.Provider>
    </div>
  );
}

/** The provenance of a lint rule, from the catalogue's own `source` text. */
export function LintProof({ meta }: { meta: LintCodeMeta }) {
  const unverified = /UNVERIFIED/.test(meta.source);
  const fromSource = /^(FluxOS|FDM)\b/.test(meta.source);
  const status = unverified ? 'warn' : fromSource ? 'ok' : 'off';
  const label = unverified ? 'Unverified' : fromSource ? 'Source' : 'Reference';
  return (
    <div className={styles.proof} data-status={unverified ? 'unverified' : fromSource ? 'verified' : 'docs'}>
      <div className={styles.proofRow}>
        <Chip kind="status" status={status} size="sm">
          {label}
        </Chip>
        <span className={styles.proofText}>
          {unverified
            ? 'Part of this rule is a judgement call.'
            : fromSource
              ? `The rule is read from the FluxOS ${FLUXOS_VERSION} source.`
              : 'The rule comes from general container knowledge or the research file.'}{' '}
          Checked {FACTS_DATE}.
        </span>
      </div>
      <p className={styles.proofNote}>
        <span className={styles.proofNoteLabel}>Where it comes from</span>
        <span className={styles.mono}>{meta.source}</span>
      </p>
    </div>
  );
}

/** Why a lint code matters, how to fix it, and the way to see it raised in the Spec Forge. */
export function CodeBody({ meta }: { meta: LintCodeMeta }) {
  const example = LINT_EXAMPLES[meta.code];
  const href = example ? exampleHref(example) : null;
  const needsLive = NEEDS_LIVE_DATA.includes(meta.code);
  const symptoms = symptomsForCode(meta.code);
  const messages = messagesForCode(meta.code);
  return (
    <div className={styles.entryBody}>
      <p className={styles.entryRow}>
        <span className={styles.entryLabel}>Why</span>
        <span>{meta.why}</span>
      </p>
      <p className={styles.entryRow}>
        <span className={styles.entryLabel}>What to do</span>
        <span>{meta.fix}</span>
      </p>

      <div className={styles.entryActions}>
        {href ? (
          <AppLinkButton href={href} variant="secondary" size="sm" iconEnd="arrow-right">
            See it raised in the Spec Forge
          </AppLinkButton>
        ) : (
          <p className={styles.entryNote}>
            {needsLive
              ? 'No example spec: the linter needs live network data (the list of taken names or of eligible nodes) to raise this one.'
              : 'No example spec is loaded for this code.'}
          </p>
        )}
        {meta.docs ? (
          <LinkButton href={meta.docs} newTab variant="ghost" size="sm" iconEnd="external">
            Official docs
          </LinkButton>
        ) : null}
      </div>

      {symptoms.length > 0 || messages.length > 0 ? (
        <div className={styles.entryLinks}>
          {symptoms.slice(0, 4).map((s) => (
            <LinkChip key={s.id} to={hrefOf.symptom(s.id)} size="md" icon="help">
              {s.title}
            </LinkChip>
          ))}
          {messages.slice(0, 3).map((m) => (
            <LinkChip key={m.id} to={hrefOf.message(m.id)} size="md" title={m.text}>
              {m.text}
            </LinkChip>
          ))}
        </div>
      ) : null}
      <LintProof meta={meta} />
    </div>
  );
}
