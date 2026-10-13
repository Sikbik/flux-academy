/**
 * The Issues panel: every lint finding, errors first, each with what is wrong, why it matters and what to
 * do about it, and the verbs that follow from it (go to the field, show it in the JSON, apply the suggested
 * value). A polite live region says when the picture changes; it is debounced so typing does not chatter.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Glyph } from '@/ui';
import { useForgeUi } from '../context';
import controls from '../controls/controls.module.css';
import { IssueDetail } from '../controls/IssueDetail';
import { type IndexedIssue, SEVERITY_WORD, type Severity, severityGlyph, summarize } from '../issues';
import { applySuggestion } from '../model';
import styles from './issues.module.css';

const GROUPS: { severity: Severity; title: string }[] = [
  { severity: 'error', title: 'Errors' },
  { severity: 'warning', title: 'Warnings' },
  { severity: 'info', title: 'Notes' },
];

function IssueRow({
  issue,
  expanded,
  onToggle,
  order,
}: {
  issue: IndexedIssue;
  expanded: boolean;
  onToggle: () => void;
  order: number;
}) {
  const ui = useForgeUi();
  const canApply = issue.suggestion !== undefined && ui.canEdit(issue.at);
  return (
    <li
      className={styles.item}
      data-severity={issue.severity}
      data-expanded={expanded ? 'true' : undefined}
      style={{ '--i': order } as React.CSSProperties}
    >
      <button type="button" className={styles.trigger} aria-expanded={expanded} onClick={onToggle}>
        <span className={styles.sev}>
          <Glyph name={severityGlyph(issue.severity)} size={16} />
          <span className="sr-only">{SEVERITY_WORD[issue.severity]}: </span>
        </span>
        <span className={styles.message}>{issue.message}</span>
        <code className={styles.code}>{issue.at || 'spec'}</code>
        <Glyph name={expanded ? 'chevron-up' : 'chevron-down'} size={16} />
      </button>
      {expanded ? (
        <div className={styles.detail}>
          <IssueDetail
            issue={issue}
            heading={false}
            onGoto={issue.at ? () => ui.jumpTo(issue.at) : undefined}
            onShowInJson={() => ui.showInJson(issue.at)}
            onApply={
              canApply
                ? () =>
                    ui.edit(issue.at, (s) => applySuggestion(s, issue), {
                      key: null,
                      label: 'Apply suggestion',
                      origin: 'suggestion',
                    })
                : undefined
            }
          />
        </div>
      ) : null}
    </li>
  );
}

export function IssuesPanel() {
  const ui = useForgeUi();
  const { issues } = ui;
  const total = issues.issues.length;
  // Rows the learner flipped away from the default (open when there are only a few issues).
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const [showNotes, setShowNotes] = useState(false);
  const autoOpen = total > 0 && total <= 3;
  const toggle = (key: string) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const expandedFor = (key: string): boolean => autoOpen !== flipped.has(key);

  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        items: issues.issues.filter((i) => i.severity === g.severity),
      })),
    [issues],
  );

  // ---- the polite announcement -----------------------------------------------------------------
  const [announcement, setAnnouncement] = useState('');
  const seen = useRef<Set<string> | null>(null);
  const summary = summarize(issues);
  useEffect(() => {
    const current = new Set(issues.issues.filter((i) => i.severity !== 'info').map((i) => i.key));
    const previous = seen.current;
    seen.current = current;
    if (previous === null) return;
    const added = issues.issues.filter((i) => i.severity !== 'info' && !previous.has(i.key));
    const t = window.setTimeout(() => {
      const first = added[0];
      const lead = first ? `${SEVERITY_WORD[first.severity]}: ${first.message} ` : '';
      setAnnouncement(`${lead}${summary}.`);
    }, 700);
    return () => window.clearTimeout(t);
  }, [issues, summary]);

  const valid = issues.valid;
  return (
    <div className={styles.root}>
      <div className={styles.summary} data-valid={valid ? 'true' : 'false'}>
        <span className={styles.verdict}>
          <Glyph name={valid ? 'status-ok' : 'status-crit'} size={18} />
          <span>
            <strong>{valid ? 'No errors' : 'Not valid yet'}</strong>
            <small>{summary}</small>
          </span>
        </span>
        <span className={styles.counts}>
          <span data-severity="error" data-zero={issues.errors === 0 ? 'true' : undefined}>
            <Glyph name="status-crit" size={13} /> {issues.errors}
          </span>
          <span data-severity="warning" data-zero={issues.warnings === 0 ? 'true' : undefined}>
            <Glyph name="status-warn" size={13} /> {issues.warnings}
          </span>
          <span data-severity="info" data-zero={issues.infos === 0 ? 'true' : undefined}>
            <Glyph name="info" size={13} /> {issues.infos}
          </span>
        </span>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {total === 0 ? (
        <p className={styles.empty}>
          Nothing to report. These are the checks the Academy can run on its own; the network also looks the
          image up in its registry when you register.
        </p>
      ) : (
        <div className={styles.groups}>
          {grouped.map((g) => {
            if (g.items.length === 0) return null;
            const collapsed = g.severity === 'info' && !showNotes;
            return (
              <section key={g.severity} className={styles.group} data-severity={g.severity}>
                <h3 className={styles.groupTitle}>
                  <Glyph name={severityGlyph(g.severity)} size={14} />
                  {g.title}
                  <span className={styles.groupCount}>{g.items.length}</span>
                  {g.severity === 'info' ? (
                    <button
                      type="button"
                      className={controls.linkBtn}
                      aria-expanded={showNotes}
                      onClick={() => setShowNotes((v) => !v)}
                    >
                      {showNotes ? 'Hide' : 'Show'}
                    </button>
                  ) : null}
                </h3>
                {collapsed ? null : (
                  <ul className={styles.list}>
                    {g.items.map((issue, i) => (
                      <IssueRow
                        key={issue.key}
                        issue={issue}
                        order={i}
                        expanded={expandedFor(issue.key)}
                        onToggle={() => toggle(issue.key)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
