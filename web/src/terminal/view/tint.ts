/**
 * Display tinting of what the learner typed, for the echoed command line and the input mirror.
 * Purely cosmetic: the engine never sees these spans. A command word, flags, quoted strings,
 * variables and shell operators get a colour; everything else stays plain.
 */

import type { Span, SpanKind } from '../engine/types';

const OPERATORS = ['2>&1', '&&', '||', '>>', '2>', '|', ';', '>'];
/** Operators after which a new command starts. */
const SEPARATORS = new Set(['&&', '||', '|', ';']);

function classify(word: string, startsCommand: boolean): SpanKind | undefined {
  if (startsCommand && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) return 'cmd';
  if (/^--?[A-Za-z0-9]/.test(word)) return 'flag';
  if (/^["']/.test(word)) return 'str';
  if (word.startsWith('$')) return 'key';
  return undefined;
}

/** Split `line` into coloured spans. Joining the span texts always gives `line` back. */
export function tintInput(line: string): Span[] {
  const spans: Span[] = [];
  const push = (text: string, kind?: SpanKind): void => {
    if (text === '') return;
    const last = spans[spans.length - 1];
    if (last && last.kind === kind) last.text += text;
    else spans.push(kind ? { text, kind } : { text });
  };

  let i = 0;
  let startsCommand = true;
  while (i < line.length) {
    const ch = line[i] as string;
    if (/\s/.test(ch)) {
      let j = i;
      while (j < line.length && /\s/.test(line[j] as string)) j += 1;
      push(line.slice(i, j));
      i = j;
      continue;
    }
    const op = OPERATORS.find((o) => line.startsWith(o, i));
    if (op) {
      push(op, 'kw');
      if (SEPARATORS.has(op)) startsCommand = true;
      i += op.length;
      continue;
    }
    let j = i;
    let quote: string | null = null;
    while (j < line.length) {
      const c = line[j] as string;
      if (quote) {
        if (c === '\\' && quote === '"') {
          j += 2;
          continue;
        }
        if (c === quote) quote = null;
        j += 1;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        j += 1;
        continue;
      }
      if (/\s/.test(c) || OPERATORS.some((o) => o !== '2>' && o !== '2>&1' && line.startsWith(o, j))) break;
      j += 1;
    }
    if (j === i) j = i + 1;
    const word = line.slice(i, j);
    push(word, classify(word, startsCommand));
    if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(word)) startsCommand = false;
    i = j;
  }
  return spans;
}

/** Cut a span list at a character index. */
export function splitSpans(spans: readonly Span[], index: number): [Span[], Span[]] {
  const before: Span[] = [];
  const after: Span[] = [];
  let at = 0;
  for (const s of spans) {
    const end = at + s.text.length;
    if (end <= index) before.push(s);
    else if (at >= index) after.push(s);
    else {
      const cut = index - at;
      before.push({ ...s, text: s.text.slice(0, cut) });
      after.push({ ...s, text: s.text.slice(cut) });
    }
    at = end;
  }
  return [before, after];
}
