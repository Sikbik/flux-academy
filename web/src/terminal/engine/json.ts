/**
 * JSON for the sandbox: parse concatenated values the way `jq` does, and print them as coloured
 * lines (2-space indent, keys in one colour, strings in another) like `jq` does on a terminal.
 */

import { escapeMarkup } from './markup';
import type { OutLine, Span } from './types';

export type JsonParse = { ok: true; values: unknown[] } | { ok: false; error: string; column: number };

/**
 * Parse text holding one or more JSON values separated by whitespace (what `jq` accepts).
 * Returns jq-style error wording on failure.
 */
export function parseJsonStream(text: string): JsonParse {
  const src = text.trim();
  if (src === '') return { ok: true, values: [] };
  try {
    return { ok: true, values: [JSON.parse(src) as unknown] };
  } catch {
    // Fall through to the incremental parser.
  }
  const values: unknown[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    while (i < n && /\s/.test(src[i] as string)) i += 1;
    if (i >= n) break;
    const end = scanValue(src, i);
    if (end < 0) return failure(src, i);
    try {
      values.push(JSON.parse(src.slice(i, end)) as unknown);
    } catch {
      return failure(src, i);
    }
    i = end;
  }
  return { ok: true, values };
}

function failure(src: string, at: number): JsonParse {
  // jq reports the end of the first bad token as a 1-based column on its line.
  const rest = src.slice(at);
  const token = /^[^\s,:{}[\]"]+/.exec(rest);
  const lineStart = src.lastIndexOf('\n', at) + 1;
  // jq reports the column of the delimiter that ended the bad token, so token length plus one.
  const column = at - lineStart + (token ? token[0].length : 1) + 1;
  const line = src.slice(0, at).split('\n').length;
  const kind =
    token && /^[A-Za-z]/.test(token[0]) && !/^(true|false|null)$/.test(token[0])
      ? 'Invalid literal'
      : 'Invalid numeric literal';
  return {
    ok: false,
    error: `parse error: ${kind} at line ${line}, column ${column}`,
    column,
  };
}

/** Index just past one complete JSON value starting at `i`, or -1. */
function scanValue(s: string, i: number): number {
  const c = s[i];
  if (c === '{' || c === '[') {
    let depth = 0;
    let inStr = false;
    for (let j = i; j < s.length; j += 1) {
      const ch = s[j] as string;
      if (inStr) {
        if (ch === '\\') j += 1;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{' || ch === '[') depth += 1;
      else if (ch === '}' || ch === ']') {
        depth -= 1;
        if (depth === 0) return j + 1;
      }
    }
    return -1;
  }
  if (c === '"') {
    for (let j = i + 1; j < s.length; j += 1) {
      if (s[j] === '\\') j += 1;
      else if (s[j] === '"') return j + 1;
    }
    return -1;
  }
  const m = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(s.slice(i));
  return m ? i + m[0].length : -1;
}

function merge(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && last.kind === s.kind) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

function toLine(spans: Span[]): OutLine {
  const merged = merge(spans.filter((s) => s.text !== ''));
  return { spans: merged, text: merged.map((s) => s.text).join(''), channel: 'out' };
}

function primitiveSpan(value: unknown): Span {
  if (value === null) return { text: 'null', kind: 'kw' };
  if (typeof value === 'string') return { text: JSON.stringify(value), kind: 'str' };
  if (typeof value === 'number') return { text: numberText(value), kind: 'num' };
  if (typeof value === 'boolean') return { text: String(value), kind: 'kw' };
  return { text: JSON.stringify(value) ?? 'null', kind: 'kw' };
}

function numberText(n: number): string {
  if (!Number.isFinite(n)) return 'null';
  return JSON.stringify(n);
}

/** Pretty-print one value as coloured lines, 2 spaces per level, like `jq`. */
export function prettyJson(value: unknown, indent = 2): OutLine[] {
  const lines: Span[][] = [];
  const pad = (depth: number) => ' '.repeat(depth * indent);

  const emit = (v: unknown, depth: number, prefix: Span[], suffix: string): void => {
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push([...prefix, { text: `[]${suffix}` }]);
        return;
      }
      lines.push([...prefix, { text: '[' }]);
      v.forEach((item, i) => {
        emit(item, depth + 1, [{ text: pad(depth + 1) }], i < v.length - 1 ? ',' : '');
      });
      lines.push([{ text: `${pad(depth)}]${suffix}` }]);
      return;
    }
    if (v !== null && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 0) {
        lines.push([...prefix, { text: `{}${suffix}` }]);
        return;
      }
      lines.push([...prefix, { text: '{' }]);
      keys.forEach((k, i) => {
        emit(
          (v as Record<string, unknown>)[k],
          depth + 1,
          [{ text: pad(depth + 1) }, { text: JSON.stringify(k), kind: 'key' }, { text: ': ' }],
          i < keys.length - 1 ? ',' : '',
        );
      });
      lines.push([{ text: `${pad(depth)}}${suffix}` }]);
      return;
    }
    lines.push([...prefix, primitiveSpan(v), ...(suffix ? [{ text: suffix }] : [])]);
  };

  emit(value, 0, [], '');
  return lines.map(toLine);
}

/** Compact, single line (`jq -c`), coloured. */
export function compactJson(value: unknown): OutLine {
  const spans: Span[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      spans.push({ text: '[' });
      v.forEach((item, i) => {
        if (i > 0) spans.push({ text: ',' });
        walk(item);
      });
      spans.push({ text: ']' });
    } else if (v !== null && typeof v === 'object') {
      spans.push({ text: '{' });
      Object.keys(v).forEach((k, i) => {
        if (i > 0) spans.push({ text: ',' });
        spans.push({ text: JSON.stringify(k), kind: 'key' }, { text: ':' });
        walk((v as Record<string, unknown>)[k]);
      });
      spans.push({ text: '}' });
    } else {
      spans.push(primitiveSpan(v));
    }
  };
  walk(value);
  return toLine(spans);
}

/**
 * Markup lines for a JSON value, for authors who need `TerminalCommand.output` strings. Colour tags
 * are emitted and every value is escaped, so the markup parser reproduces `prettyJson` exactly.
 */
export function jsonToMarkup(value: unknown, indent = 2): string[] {
  return prettyJson(value, indent).map((line) =>
    line.spans
      .map((s) => {
        const text = escapeMarkup(s.text);
        return s.kind ? `[${s.kind}]${text}[/]` : text;
      })
      .join(''),
  );
}

/** The raw one-line form `curl` prints: minified JSON, uncoloured. */
export function minifiedJson(value: unknown): string {
  return JSON.stringify(value);
}
