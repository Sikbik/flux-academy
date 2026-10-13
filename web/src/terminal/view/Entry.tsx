/**
 * One command and what it printed: the echoed prompt line, the output lines revealed so far, a copy
 * button, and under the latest command the "What just happened" panel and any goal it completed.
 */

import { memo, type ReactNode } from 'react';
import { Glyph } from '@/ui';
import type { OutLine, Span, TranscriptEntry } from '../engine/types';
import { renderInline } from './inline';
import styles from './terminal.module.css';
import { tintInput } from './tint';

export function Spans({ spans }: { spans: readonly Span[] }) {
  return (
    <>
      {spans.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: spans are a static ordered list of one line
        <span key={i} className={styles.s} data-k={s.kind}>
          {s.text}
        </span>
      ))}
    </>
  );
}

/** The sandbox's own remarks may use `code`; program output never does. */
function NoteSpans({ spans }: { spans: readonly Span[] }) {
  return (
    <>
      {spans.map((s, i) =>
        s.kind === undefined || s.kind === 'note' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: spans are a static ordered list of one line
          <span key={i}>{renderInline(s.text)}</span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: spans are a static ordered list of one line
          <span key={i} className={styles.s} data-k={s.kind}>
            {s.text}
          </span>
        ),
      )}
    </>
  );
}

function Line({ line }: { line: OutLine }) {
  return (
    <div
      className={styles.line}
      data-tone={line.tone}
      data-channel={line.channel}
      data-table={line.table ? 'true' : undefined}
    >
      {line.channel === 'note' ? <span className="sr-only">Sandbox: </span> : null}
      {line.channel === 'note' ? <NoteSpans spans={line.spans} /> : <Spans spans={line.spans} />}
    </div>
  );
}

export interface EntryProps {
  entry: TranscriptEntry;
  /** The prompt symbol (`$`). */
  symbol: string;
  /** The latest command shows its explanation. */
  latest: boolean;
  goalLabels: ReadonlyMap<string, string>;
  renderMarkup: (text: string) => ReactNode;
  copied: boolean;
  onCopy: (entry: TranscriptEntry) => void;
}

export const Entry = memo(function Entry({
  entry,
  symbol,
  latest,
  goalLabels,
  renderMarkup,
  copied,
  onCopy,
}: EntryProps) {
  const visible = entry.lines.slice(0, entry.shown);
  const finished = entry.state !== 'streaming';
  const copyable = entry.kind === 'command' && entry.lines.some((l) => l.channel === 'out' && l.text !== '');
  return (
    <article
      className={styles.entry}
      data-kind={entry.kind}
      data-state={entry.state}
      data-exit={entry.exit}
      aria-label={entry.kind === 'intro' ? 'Introduction' : undefined}
    >
      {entry.kind === 'command' ? (
        <p className={styles.cmdline}>
          <span className={styles.ps} aria-hidden="true">
            <span className={styles.psCwd}>{entry.cwd}</span> <span className={styles.psSym}>
              {symbol}
            </span>{' '}
          </span>
          <span className="sr-only">Command: </span>
          <span className={styles.typed}>
            <Spans spans={tintInput(entry.input)} />
          </span>
        </p>
      ) : null}
      {visible.length > 0 ? (
        <div className={styles.out}>
          {visible.map((l, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: output lines never reorder
            <Line key={i} line={l} />
          ))}
        </div>
      ) : null}
      {finished && copyable ? (
        <button
          type="button"
          className={styles.copy}
          data-done={copied ? 'true' : undefined}
          aria-label={copied ? 'Output copied' : 'Copy this output'}
          onClick={() => onCopy(entry)}
        >
          <Glyph name={copied ? 'check' : 'copy'} size={14} />
        </button>
      ) : null}
      {finished && entry.goals.length > 0
        ? entry.goals.map((id) => (
            <p key={id} className={styles.goalDone}>
              <Glyph name="check" size={16} strokeWidth={2.4} />
              <span>Goal complete: {renderMarkup(goalLabels.get(id) ?? id)}</span>
            </p>
          ))
        : null}
      {latest && finished && entry.explain ? (
        <aside className={styles.explain} aria-label="What just happened">
          <span className={styles.explainLabel}>What just happened</span>
          {renderMarkup(entry.explain)}
        </aside>
      ) : null}
    </article>
  );
});
