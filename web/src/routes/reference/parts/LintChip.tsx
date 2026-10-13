import { LINT_CODES } from '@shared/flux';
import { useState } from 'react';
import { Link } from 'react-router';
import { Chip, Popover } from '@/ui';
import { lintPath } from '../model';
import styles from './parts.module.css';

export const SEVERITY_WORD = { error: 'Error', warning: 'Warning', info: 'Info' } as const;

export const SEVERITY_MEANING = {
  error: 'The network would refuse the spec when it is registered or updated.',
  warning: 'Accepted, but something is probably wrong, costs money you did not plan for, or fails later.',
  info: 'Context that helps you decide. Nothing is wrong.',
} as const;

const STATUS = { error: 'crit', warning: 'warn', info: undefined } as const;

/**
 * A lint code as a chip. Press it for what the code means and how to fix it, without leaving the page.
 * Severity is the glyph and a word in the card; the chip's name says it too.
 */
export function LintChip({ code }: { code: string }) {
  const meta = LINT_CODES[code];
  const [open, setOpen] = useState(false);
  if (!meta) return <code className={styles.codeChip}>{code}</code>;
  const status = STATUS[meta.severity];
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={380}
      placement="bottom"
      title={<span className={styles.lintCardCode}>{meta.code}</span>}
      content={
        <div className={styles.lintCard}>
          <p className={styles.lintCardKind}>
            {SEVERITY_WORD[meta.severity]}, {meta.category}
          </p>
          <p className={styles.lintCardTitle}>{meta.title}</p>
          <p>
            <strong>Why. </strong>
            {meta.why}
          </p>
          <p>
            <strong>Fix. </strong>
            {meta.fix}
          </p>
          <Link to={lintPath(meta.code)} className="link" onClick={() => setOpen(false)}>
            Open in the lint index
          </Link>
        </div>
      }
    >
      <Chip
        size="sm"
        kind={status ? 'status' : 'label'}
        status={status}
        icon={status ? undefined : 'info'}
        aria-label={`${meta.code}, ${SEVERITY_WORD[meta.severity].toLowerCase()}`}
        className={styles.lintChip}
      >
        {meta.code}
      </Chip>
    </Popover>
  );
}

/** A wrapping row of lint chips, with a quiet label. */
export function LintChips({ codes, label = 'Caught by' }: { codes: readonly string[]; label?: string }) {
  if (codes.length === 0) return null;
  return (
    <div className={styles.chipRow}>
      <span className={styles.chipRowLabel}>{label}</span>
      {codes.map((c) => (
        <LintChip key={c} code={c} />
      ))}
    </div>
  );
}
