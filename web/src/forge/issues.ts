/**
 * Lint issues indexed by JSON path, for the form (an issue under a field), the JSON gutter (an issue on a
 * line) and the Issues panel (all of them, grouped). Pure: built once per lint report.
 */

import type { LintIssue, LintReport } from '@shared/flux/types';
import { isWithin, normalizePath } from './model/paths';

export type Severity = LintIssue['severity'];

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = { error: 0, warning: 1, info: 2 };

export const SEVERITY_WORD: Readonly<Record<Severity, string>> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Note',
};

export interface IndexedIssue extends LintIssue {
  /** Stable for the life of a report: `CODE|path|n`. */
  key: string;
  /** `path` normalised (`compose[0].ports[1]`). */
  at: string;
}

export interface IssueIndex {
  readonly issues: readonly IndexedIssue[];
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly valid: boolean;
  /** Issues at `path` or anywhere inside it, worst first. */
  within(path: string): readonly IndexedIssue[];
  /** Issues exactly at `path`. */
  exact(path: string): readonly IndexedIssue[];
  /** The worst severity at or inside `path`, or null. */
  worst(path: string): Severity | null;
}

const EMPTY: readonly IndexedIssue[] = Object.freeze([]);

export interface IndexOptions {
  /** `enterprise` holds the forge's labelled placeholder rather than a real encrypted value. */
  enterprisePlaceholder?: boolean;
}

/**
 * The placeholder the forge writes for "enterprise" is not a mistake, so the engine's "does not look
 * encrypted" warning is shown as what it is: a note that FluxCloud produces the real value.
 */
function present(issue: LintIssue, opts: IndexOptions): LintIssue {
  if (issue.code === 'ENTERPRISE_BLOB_FORMAT' && opts.enterprisePlaceholder) {
    return {
      ...issue,
      severity: 'info',
      message: 'The enterprise value is a labelled placeholder.',
      why: 'The real value is your components encrypted with a key fetched from the network when you register, so that only ArcaneOS nodes can read them. The Academy cannot produce it, so it shows the placeholder to let you see what enterprise costs.',
      fix: 'Nothing to fix here. "Deploy on FluxCloud" leaves the placeholder out; turn Enterprise on in FluxCloud and it creates the real value.',
    };
  }
  return issue;
}

export function indexIssues(report: LintReport, opts: IndexOptions = {}): IssueIndex {
  const seen = new Map<string, number>();
  const issues: IndexedIssue[] = report.issues
    .map((raw) => present(raw, opts))
    .map((i) => {
      const at = normalizePath(i.path);
      const base = `${i.code}|${at}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return { ...i, at, key: `${base}|${n}` };
    });
  issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.length - errors - warnings;

  const cache = new Map<string, readonly IndexedIssue[]>();
  const withinOf = (path: string): readonly IndexedIssue[] => {
    const p = normalizePath(path);
    const hit = cache.get(p);
    if (hit) return hit;
    const found = issues.filter((i) => isWithin(i.at, p));
    const out = found.length === 0 ? EMPTY : found;
    cache.set(p, out);
    return out;
  };

  return {
    issues,
    errors,
    warnings,
    infos,
    valid: errors === 0,
    within: withinOf,
    exact(path) {
      const p = normalizePath(path);
      const found = issues.filter((i) => i.at === p);
      return found.length === 0 ? EMPTY : found;
    },
    worst(path) {
      let best: Severity | null = null;
      for (const i of withinOf(path)) {
        if (best === null || SEVERITY_RANK[i.severity] < SEVERITY_RANK[best]) best = i.severity;
      }
      return best;
    },
  };
}

/** "2 errors, 1 warning" or "No problems found". */
export function summarize(index: Pick<IssueIndex, 'errors' | 'warnings' | 'infos'>): string {
  const parts: string[] = [];
  if (index.errors) parts.push(`${index.errors} ${index.errors === 1 ? 'error' : 'errors'}`);
  if (index.warnings) parts.push(`${index.warnings} ${index.warnings === 1 ? 'warning' : 'warnings'}`);
  if (parts.length === 0) {
    return index.infos
      ? `No errors or warnings, ${index.infos} ${index.infos === 1 ? 'note' : 'notes'}`
      : 'No problems found';
  }
  if (index.infos) parts.push(`${index.infos} ${index.infos === 1 ? 'note' : 'notes'}`);
  return parts.join(', ');
}

/** The glyph name for a severity (all exist in the design system's set). */
export function severityGlyph(s: Severity): 'status-crit' | 'status-warn' | 'info' {
  return s === 'error' ? 'status-crit' : s === 'warning' ? 'status-warn' : 'info';
}
