/**
 * A small JSON editor with no dependency: a textarea laid over a syntax highlighted copy of its own text.
 *
 * - The text is the learner's. It is only ever replaced by the session (a form edit, undo, a preset); it is
 *   never reformatted while they type, and a half written document stays exactly as typed.
 * - Both layers are monospace and share one font, so a column is a number of `ch` and an underline is a
 *   positioned span: lint issues, the parse error and lesson callouts all land on their line this way.
 * - Per line rendering is memoised on the line's text and marks, so typing in one place re-renders one line.
 * - Undo and redo are the session's (history of whole specs), not the browser's text history, which would
 *   disagree with the form.
 */

import {
  type KeyboardEvent,
  memo,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Glyph, Popover } from '@/ui';
import { IssueDetail } from '../../controls/IssueDetail';
import type { IndexedIssue } from '../../issues';
import {
  type JsonNode,
  type JsonProblem,
  lineStarts,
  locate,
  markerRange,
  offsetToPos,
  type Token,
  tokenizeLine,
} from '../../model';
import styles from './json.module.css';

export interface JsonEditorHandle {
  /** Select the value at a JSON path and scroll it into view. */
  reveal(path: string, opts?: { focus?: boolean }): void;
  focus(): void;
  /** Select a line (0-based). */
  revealLine(line: number): void;
}

interface LineMark {
  col: number;
  len: number;
  severity: 'error' | 'warning' | 'info' | 'syntax';
  order: number;
}

interface LineInfo {
  marks: LineMark[];
  issues: IndexedIssue[];
  syntax: JsonProblem | null;
  /** 1-based lesson callout numbers on this line. */
  notes: number[];
}

export interface JsonNoteMarker {
  path: string;
  n: number;
}

export interface JsonEditorProps {
  text: string;
  /** The tree of `text` when it parses. */
  tree: JsonNode | null;
  error: JsonProblem | null;
  issues: readonly IndexedIssue[];
  /** Lesson callouts to number in the gutter. */
  notes?: readonly JsonNoteMarker[];
  readOnly?: boolean;
  /** "JSON of hello-flux". */
  label: string;
  onChange: (text: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onApplySuggestion?: (issue: IndexedIssue) => void;
  canApply?: (issue: IndexedIssue) => boolean;
  describedBy?: string;
  ref?: Ref<JsonEditorHandle>;
}

const TOKEN_CLASS: Record<Token['kind'], string> = {
  key: styles.tKey as string,
  string: styles.tString as string,
  number: styles.tNumber as string,
  literal: styles.tLiteral as string,
  punct: styles.tPunct as string,
  space: '',
  error: styles.tError as string,
};

// ---------------------------------------------------------------------------
// One highlighted line
// ---------------------------------------------------------------------------

const HighlightLine = memo(function HighlightLine({
  text,
  marks,
  flash,
}: {
  text: string;
  marks: LineMark[] | undefined;
  flash: boolean;
}) {
  const tokens = useMemo(() => tokenizeLine(text), [text]);
  return (
    <div className={styles.line} data-flash={flash ? 'true' : undefined}>
      {tokens.map((t) => {
        const cls = TOKEN_CLASS[t.kind];
        const piece = text.slice(t.start, t.end);
        return cls ? (
          <span key={t.start} className={cls}>
            {piece}
          </span>
        ) : (
          piece
        );
      })}
      {marks?.map((m, i) => (
        <span
          // Two issues can mark the same characters; the order of a line's marks is stable.
          // biome-ignore lint/suspicious/noArrayIndexKey: marks are a derived, ordered list with no identity
          key={`${m.col}-${m.len}-${m.severity}-${i}`}
          className={styles.mark}
          data-severity={m.severity}
          style={
            {
              '--col': m.col,
              '--len': Math.max(1, m.len),
              '--i': m.order,
            } as React.CSSProperties
          }
          aria-hidden="true"
        />
      ))}
    </div>
  );
});

// ---------------------------------------------------------------------------
// The gutter cell of one line
// ---------------------------------------------------------------------------

const GutterLine = memo(function GutterLine({
  n,
  info,
  active,
  onApply,
  canApply,
  label,
}: {
  n: number;
  info: LineInfo | undefined;
  active: boolean;
  onApply?: (issue: IndexedIssue) => void;
  canApply?: (issue: IndexedIssue) => boolean;
  label: string;
}) {
  const worst = info?.syntax
    ? 'error'
    : info?.issues.reduce<'error' | 'warning' | 'info' | null>((acc, i) => {
        if (acc === 'error' || i.severity === 'error') return 'error';
        if (acc === 'warning' || i.severity === 'warning') return 'warning';
        return 'info';
      }, null);
  const note = info?.notes[0];
  return (
    <div className={styles.gl} data-active={active ? 'true' : undefined}>
      {note ? (
        <span className={styles.noteMark} title={`Lesson note ${note}`}>
          {note}
        </span>
      ) : null}
      {worst && info ? (
        <Popover
          title={info.syntax ? 'This line is not valid JSON' : `Line ${n}`}
          width={400}
          placement="right"
          content={
            <div className={styles.markerCard}>
              {info.syntax ? (
                <p>
                  <strong>{info.syntax.message}</strong>
                  {info.syntax.hint ? ` ${info.syntax.hint}` : ''}
                </p>
              ) : null}
              {info.issues.map((issue) => (
                <IssueDetail
                  key={issue.key}
                  issue={issue}
                  chips={false}
                  onApply={
                    onApply && canApply?.(issue) && issue.suggestion !== undefined
                      ? () => onApply(issue)
                      : undefined
                  }
                />
              ))}
            </div>
          }
        >
          <button
            type="button"
            className={styles.marker}
            data-severity={worst}
            aria-label={`${worst === 'error' ? 'Error' : worst === 'warning' ? 'Warning' : 'Note'} on line ${n} of ${label}`}
          >
            <Glyph
              name={worst === 'error' ? 'status-crit' : worst === 'warning' ? 'status-warn' : 'info'}
              size={13}
            />
          </button>
        </Popover>
      ) : null}
      <span className={styles.num}>{n}</span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

export function JsonEditor({
  text,
  tree,
  error,
  issues,
  notes,
  readOnly,
  label,
  onChange,
  onUndo,
  onRedo,
  onApplySuggestion,
  canApply,
  describedBy,
  ref,
}: JsonEditorProps) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const [caretLine, setCaretLine] = useState(0);
  const [flashLine, setFlashLine] = useState<number | null>(null);

  const lines = useMemo(() => text.split('\n'), [text]);
  const starts = useMemo(() => lineStarts(text), [text]);
  const cols = useMemo(() => lines.reduce((m, l) => Math.max(m, l.length), 24), [lines]);

  // Where every issue, the syntax error and the lesson callouts land.
  const byLine = useMemo(() => {
    const map = new Map<number, LineInfo>();
    const at = (line: number): LineInfo => {
      let info = map.get(line);
      if (!info) {
        info = { marks: [], issues: [], syntax: null, notes: [] };
        map.set(line, info);
      }
      return info;
    };
    if (error) {
      const from = offsetToPos(starts, error.offset);
      const info = at(from.line);
      info.syntax = error;
      const lineLen = (lines[from.line] ?? '').length;
      const len = Math.max(1, Math.min(error.length, Math.max(1, lineLen - from.column)));
      info.marks.push({ col: from.column, len, severity: 'syntax', order: 0 });
      return map;
    }
    if (!tree) return map;
    issues.forEach((issue, order) => {
      const where = locate(tree, issue.at);
      const range = markerRange(where, text);
      const from = offsetToPos(starts, range.from);
      const toOffset = Math.max(range.from + 1, range.to);
      const to = offsetToPos(starts, toOffset);
      const lineLen = (lines[from.line] ?? '').length;
      const endCol = to.line === from.line ? to.column : lineLen;
      const info = at(from.line);
      info.issues.push(issue);
      info.marks.push({
        col: from.column,
        len: Math.max(1, Math.min(endCol, lineLen) - from.column),
        severity: issue.severity,
        order,
      });
    });
    for (const note of notes ?? []) {
      const where = locate(tree, note.path);
      const from = offsetToPos(starts, markerRange(where, text).from);
      at(from.line).notes.push(note.n);
    }
    return map;
  }, [error, tree, issues, notes, starts, lines, text]);

  // Selection survives a programmatic text change (auto indent) by being re-applied after the render.
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    const el = ta.current;
    if (sel && el) {
      el.setSelectionRange(sel.start, sel.end);
      pendingSelection.current = null;
    }
  });

  const updateCaretLine = useCallback(() => {
    const el = ta.current;
    if (!el) return;
    const before = el.value.slice(0, el.selectionStart);
    let line = 0;
    for (let i = 0; i < before.length; i++) if (before.charCodeAt(i) === 10) line++;
    setCaretLine((l) => (l === line ? l : line));
  }, []);

  const scrollToLine = useCallback((line: number) => {
    const sc = scroller.current;
    if (!sc) return;
    const lh = Number.parseFloat(getComputedStyle(sc).getPropertyValue('--lh')) || 22;
    const top = line * lh;
    const margin = lh * 3;
    if (top < sc.scrollTop + margin) sc.scrollTo({ top: Math.max(0, top - margin), behavior: 'auto' });
    else if (top + lh > sc.scrollTop + sc.clientHeight - margin) {
      sc.scrollTo({ top: top + lh - sc.clientHeight + margin, behavior: 'auto' });
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus() {
        ta.current?.focus({ preventScroll: true });
      },
      revealLine(line: number) {
        const el = ta.current;
        if (!el) return;
        const l = Math.max(0, Math.min(line, starts.length - 1));
        const from = starts[l] ?? 0;
        const to = from + (lines[l] ?? '').length;
        el.focus({ preventScroll: true });
        el.setSelectionRange(from, to);
        scrollToLine(l);
        setCaretLine(l);
        setFlashLine(l);
      },
      reveal(path: string, opts?: { focus?: boolean }) {
        const el = ta.current;
        if (!el || !tree) return;
        const where = locate(tree, path);
        const range = markerRange(where, text);
        const pos = offsetToPos(starts, range.from);
        if (opts?.focus !== false) el.focus({ preventScroll: true });
        el.setSelectionRange(range.from, Math.max(range.from, range.to));
        scrollToLine(pos.line);
        setCaretLine(pos.line);
        setFlashLine(pos.line);
      },
    }),
    [tree, text, starts, lines, scrollToLine],
  );

  useEffect(() => {
    if (flashLine === null) return;
    const t = window.setTimeout(() => setFlashLine(null), 1400);
    return () => window.clearTimeout(t);
  }, [flashLine]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z' && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) onRedo();
      else onUndo();
      return;
    }
    if (mod && key === 'y' && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      onRedo();
      return;
    }
    if (readOnly) return;
    if (e.key === 'Enter' && !mod && !e.altKey && !e.shiftKey) {
      // Keep the indentation of the line, and add a level after an opening bracket.
      const el = e.currentTarget;
      const { selectionStart, selectionEnd, value } = el;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const before = value.slice(lineStart, selectionStart);
      const indent = /^[ \t]*/.exec(before)?.[0] ?? '';
      const opens = /[{[]\s*$/.test(before);
      const next = value.slice(selectionEnd).trimStart()[0];
      const closes = opens && (next === '}' || next === ']');
      e.preventDefault();
      const extra = opens ? '  ' : '';
      const insert = `\n${indent}${extra}${closes ? `\n${indent}` : ''}`;
      const value2 = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
      const caret = selectionStart + 1 + indent.length + extra.length;
      pendingSelection.current = { start: caret, end: caret };
      onChange(value2);
    }
  };

  return (
    <div className={styles.editor}>
      <div
        ref={scroller}
        className={styles.scroller}
        data-readonly={readOnly ? 'true' : undefined}
        style={
          {
            '--cols': cols,
            '--rows': lines.length,
            '--digits': String(lines.length).length,
          } as React.CSSProperties
        }
      >
        <div className={styles.inner}>
          <div className={styles.gutter}>
            {lines.map((_, i) => (
              <GutterLine
                // biome-ignore lint/suspicious/noArrayIndexKey: a line's number is its identity
                key={i}
                n={i + 1}
                info={byLine.get(i)}
                active={i === caretLine}
                onApply={onApplySuggestion}
                canApply={canApply}
                label={label}
              />
            ))}
          </div>
          <div className={styles.stack}>
            <div className={styles.hl} aria-hidden="true">
              {lines.map((line, i) => (
                <HighlightLine
                  // biome-ignore lint/suspicious/noArrayIndexKey: a line's number is its identity
                  key={i}
                  text={line}
                  marks={byLine.get(i)?.marks}
                  flash={flashLine === i}
                />
              ))}
              <span className={styles.caretLine} style={{ '--line': caretLine } as React.CSSProperties} />
            </div>
            <textarea
              ref={ta}
              className={styles.ta}
              value={text}
              readOnly={readOnly}
              aria-label={label}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              aria-multiline="true"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              wrap="off"
              data-gramm="false"
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              onKeyUp={updateCaretLine}
              onClick={updateCaretLine}
              onSelect={updateCaretLine}
              onFocus={updateCaretLine}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
