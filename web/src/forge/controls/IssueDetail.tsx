/**
 * One lint issue, explained: what is wrong, why it matters, what to do, and where to read more. Used by the
 * Issues panel, by the "Why?" popover under a field and by the JSON gutter markers, so a learner reads the
 * same words wherever they meet the issue.
 */

import { Glyph } from '@/ui';
import { type IndexedIssue, SEVERITY_WORD, severityGlyph } from '../issues';
import { LINT_CODES } from '../model';
import styles from './issue.module.css';

/** True when the engine marks the rule as a judgement call rather than documented Flux behaviour. */
export function isJudgement(code: string): boolean {
  return LINT_CODES[code]?.source.includes('UNVERIFIED') === true;
}

export interface IssueDetailProps {
  issue: IndexedIssue;
  /** Show the code and path chips. Default true. */
  chips?: boolean;
  /** Render the message as a heading (the Issues panel does; popovers already have a title). */
  heading?: boolean;
  /** When set, an "Apply" action shows the suggested value. */
  onApply?: () => void;
  applyLabel?: string;
  onGoto?: () => void;
  onShowInJson?: () => void;
}

function describeSuggestion(value: unknown): string {
  if (typeof value === 'string') return value === '' ? 'empty' : `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value))
    return value.length === 0 ? 'an empty list' : `[${value.map((v) => describeSuggestion(v)).join(', ')}]`;
  return 'the suggested value';
}

export function suggestionLabel(issue: Pick<IndexedIssue, 'suggestion'>): string {
  return `Set to ${describeSuggestion(issue.suggestion)}`;
}

export function IssueDetail({
  issue,
  chips = true,
  heading = true,
  onApply,
  applyLabel,
  onGoto,
  onShowInJson,
}: IssueDetailProps) {
  const docs = issue.docs ?? LINT_CODES[issue.code]?.docs;
  const judgement = isJudgement(issue.code);
  return (
    <article className={styles.detail} data-severity={issue.severity}>
      {heading ? (
        <header className={styles.head}>
          <span className={styles.sev}>
            <Glyph name={severityGlyph(issue.severity)} size={16} />
            <span className="sr-only">{SEVERITY_WORD[issue.severity]}: </span>
          </span>
          <h3 className={styles.title}>{issue.message}</h3>
        </header>
      ) : (
        <p className={styles.message}>{issue.message}</p>
      )}
      {chips ? (
        <p className={styles.chips}>
          <code className={styles.code}>{issue.code}</code>
          {issue.at ? (
            <code className={styles.path}>{issue.at}</code>
          ) : (
            <span className={styles.path}>whole spec</span>
          )}
        </p>
      ) : null}
      <dl className={styles.body}>
        <div>
          <dt>Why it matters</dt>
          <dd>{issue.why}</dd>
        </div>
        <div>
          <dt>What to do</dt>
          <dd>{issue.fix}</dd>
        </div>
      </dl>
      {judgement ? (
        <p className={styles.judgement}>
          <Glyph name="info" size={14} />
          <span>A judgement call. Flux does not document this exact behaviour, so treat it as advice.</span>
        </p>
      ) : null}
      {docs || onApply || onGoto || onShowInJson ? (
        <footer className={styles.actions}>
          {onApply ? (
            <button type="button" className={styles.primary} onClick={onApply}>
              <Glyph name="check" size={14} />
              {applyLabel ?? suggestionLabel(issue)}
            </button>
          ) : null}
          {onGoto ? (
            <button type="button" className={styles.action} onClick={onGoto}>
              <Glyph name="arrow-right" size={14} />
              Go to the field
            </button>
          ) : null}
          {onShowInJson ? (
            <button type="button" className={styles.action} onClick={onShowInJson}>
              <Glyph name="code" size={14} />
              Show in JSON
            </button>
          ) : null}
          {docs ? (
            <a className={styles.action} href={docs} target="_blank" rel="noopener noreferrer">
              <Glyph name="book" size={14} />
              Docs
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </footer>
      ) : null}
    </article>
  );
}
