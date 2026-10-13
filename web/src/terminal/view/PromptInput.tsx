/**
 * The prompt line. A real textarea does the work (typing, IME, selection, paste, mobile keyboards)
 * and sits invisibly on top of a mirror that draws the same text in colour with a block caret. The
 * mirror decides the height, so a long command wraps and the field grows with it.
 */

import type { ClipboardEvent, CSSProperties, KeyboardEvent, RefObject } from 'react';
import { useMemo } from 'react';
import { cx } from './classes';
import { Spans } from './Entry';
import styles from './terminal.module.css';
import { splitSpans, tintInput } from './tint';

export interface Selection {
  start: number;
  end: number;
}

export interface PromptInputProps {
  value: string;
  selection: Selection;
  onValueChange: (value: string, selection: Selection) => void;
  onSelectionChange: (selection: Selection) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  /** Dimmed completion after the caret. */
  ghost: string;
  focused: boolean;
  onFocusChange: (focused: boolean) => void;
  /** Blink the caret (not under reduced motion). */
  blink: boolean;
  placeholder: string;
  /** The prompt shown before the text: working directory and symbol. */
  cwd: string;
  symbol: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  describedBy: string;
  label: string;
}

export function PromptInput({
  value,
  selection,
  onValueChange,
  onSelectionChange,
  onKeyDown,
  onPaste,
  ghost,
  focused,
  onFocusChange,
  blink,
  placeholder,
  cwd,
  symbol,
  inputRef,
  describedBy,
  label,
}: PromptInputProps) {
  const spans = useMemo(() => tintInput(value), [value]);
  const collapsed = selection.start === selection.end;
  const index = collapsed ? Math.min(selection.start, value.length) : value.length;
  const [before, after] = useMemo(() => splitSpans(spans, index), [spans, index]);
  const atEnd = index >= value.length;

  const read = (el: HTMLTextAreaElement): Selection => ({
    start: el.selectionStart ?? 0,
    end: el.selectionEnd ?? 0,
  });

  return (
    <div className={styles.field} style={{ '--ps-len': cwd.length + symbol.length + 2 } as CSSProperties}>
      <div className={styles.mirror} aria-hidden="true">
        <span className={styles.ps}>
          <span className={styles.psCwd}>{cwd}</span> <span className={styles.psSym}>{symbol}</span>{' '}
        </span>
        {value === '' ? <span className={styles.placeholder}>{focused ? '' : placeholder}</span> : null}
        <Spans spans={before} />
        {collapsed ? (
          <span
            className={styles.caret}
            data-focused={focused ? 'true' : 'false'}
            data-blink={blink && focused}
          />
        ) : null}
        <Spans spans={after} />
        {atEnd && focused && ghost ? <span className={cx(styles.ghost)}>{ghost}</span> : null}
        {/* A trailing newline keeps the last empty line from collapsing. */}
        {'​'}
      </div>
      <textarea
        ref={inputRef}
        className={styles.real}
        value={value}
        rows={1}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        enterKeyHint="send"
        inputMode="text"
        aria-label={label}
        aria-describedby={describedBy}
        aria-multiline="false"
        onChange={(e) => onValueChange(e.target.value, read(e.target))}
        onSelect={(e) => onSelectionChange(read(e.currentTarget))}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => onSelectionChange(read(e.currentTarget))}
        onClick={(e) => onSelectionChange(read(e.currentTarget))}
        onPaste={onPaste}
        onFocus={() => onFocusChange(true)}
        onBlur={() => onFocusChange(false)}
      />
    </div>
  );
}
