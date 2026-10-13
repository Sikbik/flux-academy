import type { LintIssue, LintReport } from '@shared/flux/types';
import { describe, expect, it } from 'vitest';
import { indexIssues, summarize } from './issues';

function issue(over: Partial<LintIssue> & Pick<LintIssue, 'code' | 'severity' | 'path'>): LintIssue {
  return { message: over.code, why: 'why', fix: 'fix', ...over } as LintIssue;
}

function report(issues: LintIssue[]): LintReport {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  return { valid: errors === 0, errors, warnings, infos: issues.length - errors - warnings, issues };
}

describe('indexIssues', () => {
  const r = report([
    issue({ code: 'NOTE', severity: 'info', path: 'compose[0].cpu' }),
    issue({ code: 'WARN', severity: 'warning', path: 'compose[0].ports[0]' }),
    issue({ code: 'BAD', severity: 'error', path: 'name' }),
    issue({ code: 'BAD', severity: 'error', path: 'name' }),
  ]);
  const index = indexIssues(r);

  it('counts by severity and decides validity', () => {
    expect(index.errors).toBe(2);
    expect(index.warnings).toBe(1);
    expect(index.infos).toBe(1);
    expect(index.valid).toBe(false);
  });

  it('sorts worst first and gives repeated codes distinct keys', () => {
    expect(index.issues.map((i) => i.severity)).toEqual(['error', 'error', 'warning', 'info']);
    const keys = index.issues.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('finds issues at a path and inside it', () => {
    expect(index.exact('name')).toHaveLength(2);
    expect(index.within('compose[0]')).toHaveLength(2);
    expect(index.within('compose')).toHaveLength(2);
    expect(index.within('instances')).toHaveLength(0);
    expect(index.worst('compose[0]')).toBe('warning');
    expect(index.worst('name')).toBe('error');
    expect(index.worst('instances')).toBeNull();
  });

  it('normalises paths written with dots', () => {
    const dotted = indexIssues(report([issue({ code: 'X', severity: 'error', path: 'compose.0.cpu' })]));
    expect(dotted.exact('compose[0].cpu')).toHaveLength(1);
  });

  it('shows the enterprise placeholder as a note, not a warning', () => {
    const blob = report([issue({ code: 'ENTERPRISE_BLOB_FORMAT', severity: 'warning', path: 'enterprise' })]);
    expect(indexIssues(blob).warnings).toBe(1);
    const placeholder = indexIssues(blob, { enterprisePlaceholder: true });
    expect(placeholder.warnings).toBe(0);
    expect(placeholder.infos).toBe(1);
    expect(placeholder.valid).toBe(true);
  });
});

describe('summarize', () => {
  it('speaks plainly', () => {
    expect(summarize({ errors: 0, warnings: 0, infos: 0 })).toBe('No problems found');
    expect(summarize({ errors: 0, warnings: 0, infos: 2 })).toBe('No errors or warnings, 2 notes');
    expect(summarize({ errors: 1, warnings: 2, infos: 1 })).toBe('1 error, 2 warnings, 1 note');
  });
});
