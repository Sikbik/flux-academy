/**
 * Colour tags. A script line may start with `[ok]`, `[warn]`, `[err]` or `[dim]` to colour the
 * whole line (the contract). The engine also reads inline tags, closed by `[/]`, and a few more
 * names it uses for its own output (JSON colouring, the sandbox's notes):
 *
 *   [ok]Successfully tagged you/app:1.0.0
 *   Status: [warn]Downloaded newer image[/] for nginx
 *   [note]The sandbox only replays recorded responses.
 *
 * Unknown bracket text stays literal, so JSON arrays and docker format strings are safe. A real
 * `[ok]` in text is written `\[ok]` (see `escapeMarkup`).
 */

import type { LineTone, OutLine, Span, SpanKind } from './types';

const TAG_NAMES = [
  'ok',
  'warn',
  'err',
  'dim',
  'note',
  'key',
  'str',
  'num',
  'kw',
  'flag',
  'cmd',
  'path',
  'hi',
] as const satisfies readonly SpanKind[];

const TAGS = new Set<string>(TAG_NAMES);
const TONES = new Set<string>(['ok', 'warn', 'err', 'dim']);

interface TagMatch {
  /** `/` closes. */
  name: string;
  len: number;
}

function matchTagAt(s: string, i: number): TagMatch | null {
  if (s.charCodeAt(i) !== 91) return null; // [
  const close = s.indexOf(']', i + 1);
  if (close < 0 || close - i > 6) return null;
  const name = s.slice(i + 1, close);
  if (name === '/' || TAGS.has(name)) return { name, len: close - i + 1 };
  return null;
}

/** Turn a markup string into spans. Never throws. */
export function parseMarkup(source: string): OutLine {
  const spans: Span[] = [];
  let base: SpanKind | undefined;
  let kind: SpanKind | undefined;
  let buf = '';
  let i = 0;

  const flush = () => {
    if (buf) {
      spans.push(kind ? { text: buf, kind } : { text: buf });
      buf = '';
    }
  };

  // Prefix tags colour the whole line. `[note]` marks the sandbox channel and may be combined with a
  // tone: `[note][warn]text` is a sandbox note drawn as a warning.
  let isNote = false;
  for (;;) {
    const m = matchTagAt(source, i);
    if (!m || m.name === '/') break;
    if (m.name === 'note') {
      isNote = true;
      if (!base) base = 'note';
    } else {
      base = m.name as SpanKind;
    }
    kind = base;
    i += m.len;
  }
  // Authors write `[ok] text`: the space after a prefix tag is a separator, not indentation.
  if (base && source[i] === ' ') i += 1;

  while (i < source.length) {
    const ch = source[i] as string;
    if (ch === '\\' && source[i + 1] === '[' && matchTagAt(source, i + 1)) {
      buf += '[';
      i += 2;
      continue;
    }
    if (ch === '[') {
      const m = matchTagAt(source, i);
      if (m) {
        flush();
        kind = m.name === '/' ? base : (m.name as SpanKind);
        i += m.len;
        continue;
      }
    }
    buf += ch;
    i += 1;
  }
  flush();

  const channel = isNote ? 'note' : 'out';
  const tone = base && TONES.has(base) ? (base as LineTone) : undefined;
  const line: OutLine = { spans, text: spans.map((s) => s.text).join(''), channel };
  if (tone) line.tone = tone;
  return line;
}

/** Escape text so it prints literally when parsed by `parseMarkup`. */
export function escapeMarkup(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '[' && matchTagAt(text, i)) out += '\\[';
    else out += text[i];
  }
  return out;
}

/** The plain text of a markup string. */
export function stripMarkup(source: string): string {
  return parseMarkup(source).text;
}

/** Build a plain output line without parsing markup. */
export function plainLine(text: string, kind?: SpanKind): OutLine {
  const spans: Span[] = text ? [kind ? { text, kind } : { text }] : [];
  const line: OutLine = { spans, text, channel: kind === 'note' ? 'note' : 'out' };
  if (kind === 'ok' || kind === 'warn' || kind === 'err' || kind === 'dim') line.tone = kind;
  return line;
}

/** A line from the sandbox itself (never piped). */
export function noteLine(text: string): OutLine {
  return { spans: [{ text, kind: 'note' }], text, channel: 'note' };
}

/** Does the string contain at least one recognised tag? Used by tests and the authoring lint. */
export function hasMarkup(source: string): boolean {
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '[' && matchTagAt(source, i) && source[i - 1] !== '\\') return true;
  }
  return false;
}
