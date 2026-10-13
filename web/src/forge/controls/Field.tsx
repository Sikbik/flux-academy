/**
 * The wrapper every form field sits in: a mono label, the `?` that teaches, the lock when the lesson has
 * frozen the field, a badge when lint has something to say, the control, and the issues and the lesson's
 * callout drawn in underneath. One place, so a field looks and behaves the same everywhere.
 *
 * `data-field` carries the JSON path; "go to the field" finds the control through it.
 */

import type { PricingParams } from '@shared/flux/types';
import { type ReactNode, useId, useMemo } from 'react';
import { InlineMarkup } from '@/app/InlineMarkup';
import { Glyph, Popover, Tooltip } from '@/ui';
import { type FocusNote, useForgeUi } from '../context';
import { type IndexedIssue, severityGlyph } from '../issues';
import { type HelpEntry, helpFor, mistakesOf } from '../knowledge';
import { applySuggestion, covers } from '../model';
import styles from './controls.module.css';
import { IssueDetail, suggestionLabel } from './IssueDetail';

// ---------------------------------------------------------------------------
// A lesson's numbered notes
// ---------------------------------------------------------------------------

/** The lesson's callouts for one field, in the order the lesson listed them. */
export function NoteCallouts({ notes }: { notes: readonly FocusNote[] }) {
  return notes.map((n) => (
    <div key={n.n} className={styles.callout} role="note">
      <span className={styles.calloutN} aria-hidden="true">
        {n.n}
      </span>
      <span className={styles.calloutText}>
        <span className="sr-only">Note {n.n}: </span>
        <InlineMarkup text={n.note} />
      </span>
    </div>
  ));
}

// ---------------------------------------------------------------------------
// The ? popover
// ---------------------------------------------------------------------------

export function HelpContent({ entry }: { entry: HelpEntry }) {
  const mistakes = mistakesOf(entry);
  return (
    <div className={styles.help}>
      {entry.fluxcloud ? (
        <p className={styles.helpFc}>
          FluxCloud calls this <b>{entry.fluxcloud}</b>.
        </p>
      ) : null}
      <p>{entry.what}</p>
      {entry.limit ? (
        <p>
          <span className={styles.helpTag}>The limit</span>
          {entry.limit}
        </p>
      ) : null}
      {mistakes.length > 0 ? (
        <div>
          <span className={styles.helpTag}>Common mistakes</span>
          <ul>
            {mistakes.slice(0, 3).map((m) => (
              <li key={m.code}>
                <strong>{m.title}.</strong> {m.fix}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {entry.notes && entry.notes.length > 0 ? (
        <ul>
          {entry.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      {entry.docs ? (
        <p>
          <a href={entry.docs.href} target="_blank" rel="noopener noreferrer">
            {entry.docs.label} in the FluxCloud docs
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      ) : null}
    </div>
  );
}

export interface HelpButtonProps {
  /** A key of the knowledge table, or a JSON path (indexes are ignored). */
  topic: string;
  /** Names the button: "About CPU". */
  label: string;
  params?: PricingParams;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function HelpButton({ topic, label, params, placement = 'bottom' }: HelpButtonProps) {
  const entry = useMemo(() => helpFor(topic, { params }), [topic, params]);
  if (!entry) return null;
  return (
    <Popover title={entry.title} width={360} placement={placement} content={<HelpContent entry={entry} />}>
      <button type="button" className={styles.helpBtn} aria-label={`About ${label}`}>
        <Glyph name="help" size={15} />
      </button>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Lock
// ---------------------------------------------------------------------------

export function LockBadge({ what = 'This field' }: { what?: string }) {
  return (
    <Tooltip content={`${what} is locked in this step. The lesson asks you to change something else.`}>
      <button type="button" className={styles.lockBtn} aria-label={`${what} is locked in this step`}>
        <Glyph name="lock" size={14} />
      </button>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Issues under a field
// ---------------------------------------------------------------------------

export function InlineIssues({ issues, max = 2 }: { issues: readonly IndexedIssue[]; max?: number }) {
  const ui = useForgeUi();
  const shown = issues.filter((i) => i.severity !== 'info').slice(0, max);
  if (shown.length === 0) return null;
  const hidden = issues.filter((i) => i.severity !== 'info').length - shown.length;
  return (
    <ul className={styles.issues}>
      {shown.map((issue) => {
        const canApply = issue.suggestion !== undefined && ui.canEdit(issue.at);
        return (
          <li key={issue.key} className={styles.issue} data-severity={issue.severity}>
            <Glyph name={severityGlyph(issue.severity)} size={14} />
            <span className={styles.issueText}>
              {issue.message}
              <span className={styles.issueActions}>
                {canApply ? (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() =>
                      ui.edit(issue.at, (s) => applySuggestion(s, issue), {
                        key: null,
                        label: 'Apply suggestion',
                        origin: 'suggestion',
                      })
                    }
                  >
                    {suggestionLabel(issue)}
                  </button>
                ) : null}
                <Popover
                  title="Why this matters"
                  width={380}
                  content={<IssueDetail issue={issue} heading={false} chips={false} />}
                >
                  <button type="button" className={styles.linkBtn}>
                    Why?
                  </button>
                </Popover>
              </span>
            </span>
          </li>
        );
      })}
      {hidden > 0 ? (
        <li className={styles.issue} data-severity="info">
          <Glyph name="info" size={14} />
          <span className={styles.issueText}>{hidden} more in the Issues panel.</span>
        </li>
      ) : null}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

export interface FieldProps {
  /** The JSON path this field edits. Also the `data-field` attribute. */
  path: string;
  label: string;
  /** Overrides the knowledge key (default: the path with indexes removed). */
  topic?: string;
  /** The id of the control, so the label focuses it. Omit when there is no single control. */
  htmlFor?: string;
  /** Right side of the label row: the live value of a slider. */
  value?: ReactNode;
  hint?: ReactNode;
  /** The learner may not change this field in this step. */
  locked?: boolean;
  /** Which issues to draw under the control. Default: everything at or below `path`. */
  issuePath?: string;
  /** Hide the issue lines (a field that draws its own per-row issues). */
  hideIssues?: boolean;
  /** An element to put in the label row, after the help button (a unit switch, a count). */
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({
  path,
  label,
  topic,
  htmlFor,
  value,
  hint,
  locked,
  issuePath,
  hideIssues,
  extra,
  className,
  children,
}: FieldProps) {
  const ui = useForgeUi();
  const labelId = useId();
  const issues = ui.issues.within(issuePath ?? path);
  const worst = ui.issues.worst(issuePath ?? path);
  const notes = ui.focusNotes.filter((n) => covers(path, n.formPath));
  const counted = issues.filter((i) => i.severity !== 'info');

  return (
    <div
      className={`${styles.field}${className ? ` ${className}` : ''}`}
      data-field={path}
      data-locked={locked ? 'true' : undefined}
      data-severity={worst ?? undefined}
    >
      <div className={styles.head}>
        {htmlFor ? (
          <label className={styles.label} htmlFor={htmlFor} id={labelId}>
            {label}
          </label>
        ) : (
          <span className={styles.label} id={labelId}>
            {label}
          </span>
        )}
        <HelpButton topic={topic ?? path} label={label} params={ui.params} />
        {locked ? <LockBadge what={label} /> : null}
        {extra}
        {counted.length > 0 && worst && worst !== 'info' ? (
          <span className={styles.badge} data-severity={worst}>
            <Glyph name={severityGlyph(worst)} size={13} />
            {counted.length}
            <span className="sr-only"> {worst === 'error' ? 'errors' : 'warnings'} on this field</span>
          </span>
        ) : null}
        {value != null ? <span className={styles.value}>{value}</span> : null}
      </div>
      <NoteCallouts notes={notes} />
      {children}
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      {hideIssues ? null : <InlineIssues issues={issues} />}
    </div>
  );
}
