/**
 * JSON as text, with positions.
 *
 * The forge's JSON panel needs three things the browser's `JSON.parse` does not give:
 *   1. an error a learner can act on, with a position ("a comma is missing after line 12"),
 *   2. the character range of every value, so a lint issue at `compose[0].ports[1]` can point at a line,
 *   3. a tolerant tokenizer that colours text that is not valid JSON yet (the learner is mid-edit).
 *
 * Pure and framework-free. `parseJsonText` is a strict RFC 8259 parser (no comments, no trailing commas,
 * no single quotes); its accept/reject decisions are tested against `JSON.parse` on a corpus.
 */

import { type PathSeg, parsePath } from './paths';

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------

export interface ScalarNode {
  type: 'string' | 'number' | 'boolean' | 'null';
  start: number;
  end: number;
}

export interface PropNode {
  key: string;
  keyStart: number;
  keyEnd: number;
  value: JsonNode;
}

export interface ObjectNode {
  type: 'object';
  start: number;
  end: number;
  props: PropNode[];
}

export interface ArrayNode {
  type: 'array';
  start: number;
  end: number;
  items: JsonNode[];
}

export type JsonNode = ScalarNode | ObjectNode | ArrayNode;

export interface JsonProblem {
  /** What is wrong, one plain sentence. */
  message: string;
  /** What to do about it, when there is an obvious thing. */
  hint?: string;
  /** Offset of the first character the problem refers to. */
  offset: number;
  /** How many characters it covers (at least 1; 0 only at the very end of the text). */
  length: number;
  /** 0-based line and column. Display them +1. */
  line: number;
  column: number;
}

export type JsonParse =
  | { ok: true; root: JsonNode; value: unknown }
  | { ok: false; error: JsonProblem; root: null };

/** Larger than any real spec by orders of magnitude. Parsing stops here so a bad paste cannot freeze the page. */
export const MAX_JSON_CHARS = 600_000;
const MAX_DEPTH = 64;

// ---------------------------------------------------------------------------
// Line index
// ---------------------------------------------------------------------------

/** Offsets at which each line starts. `starts[0]` is always 0. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

/** Binary search for the line containing `offset` (0-based). */
export function lineOfOffset(starts: readonly number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] as number) <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function offsetToPos(starts: readonly number[], offset: number): { line: number; column: number } {
  const line = lineOfOffset(starts, offset);
  return { line, column: offset - (starts[line] as number) };
}

// ---------------------------------------------------------------------------
// Strict parser
// ---------------------------------------------------------------------------

class Failure extends Error {
  constructor(
    readonly offset: number,
    readonly length: number,
    readonly detail: string,
    readonly hint?: string,
  ) {
    super(detail);
  }
}

const WS = new Set([0x20, 0x09, 0x0a, 0x0d]);

function show(ch: string): string {
  if (ch === '\n') return 'a line break';
  if (ch === '\t') return 'a tab';
  if (ch === ' ') return 'a space';
  return `"${ch}"`;
}

class Parser {
  i = 0;
  depth = 0;
  constructor(readonly s: string) {}

  fail(offset: number, length: number, detail: string, hint?: string): never {
    throw new Failure(offset, Math.max(length, 0), detail, hint);
  }

  ws(): void {
    while (this.i < this.s.length && WS.has(this.s.charCodeAt(this.i))) this.i++;
  }

  atEnd(): boolean {
    return this.i >= this.s.length;
  }

  document(): JsonNode {
    this.ws();
    if (this.atEnd()) {
      this.fail(0, 0, 'The editor is empty.', 'Start with { and describe your app, or pick a preset.');
    }
    const root = this.value();
    this.ws();
    if (!this.atEnd()) {
      const rest = this.s.slice(this.i, this.i + 12).split('\n')[0] ?? '';
      this.fail(
        this.i,
        1,
        `Unexpected text after the end of the JSON: ${show(this.s[this.i] as string)}.`,
        rest.startsWith(',')
          ? 'A JSON document is one object. Remove the comma, or wrap the values in an array.'
          : 'A spec is a single object. Remove everything after the closing brace.',
      );
    }
    return root;
  }

  value(): JsonNode {
    this.ws();
    if (this.atEnd()) {
      this.fail(
        this.s.length,
        0,
        'The JSON ends too early.',
        'A value is missing here, or a { or [ was never closed.',
      );
    }
    const c = this.s[this.i] as string;
    if (c === '{') return this.object();
    if (c === '[') return this.array();
    if (c === '"') return this.string();
    if (c === '-' || (c >= '0' && c <= '9')) return this.number();
    if (c === '+' || c === '.') {
      this.fail(
        this.i,
        1,
        `A number cannot start with "${c}".`,
        'Write numbers as 5 or 0.5, without a sign or a leading dot.',
      );
    }
    if (c === "'") {
      this.fail(
        this.i,
        1,
        'Strings use double quotes, not single quotes.',
        'Replace the single quotes with ".',
      );
    }
    if (c === '/') {
      this.fail(this.i, 2, 'JSON does not allow comments.', 'Delete the comment: a spec holds only data.');
    }
    if (/[A-Za-z_$]/.test(c)) return this.word();
    if (c === ',' || c === ':' || c === '}' || c === ']') {
      this.fail(
        this.i,
        1,
        `A value is missing before ${show(c)}.`,
        'Put a value here, or remove the extra comma.',
      );
    }
    return this.fail(this.i, 1, `Unexpected character ${show(c)}.`);
  }

  word(): JsonNode {
    const start = this.i;
    let j = start;
    while (j < this.s.length && /[A-Za-z0-9_$]/.test(this.s[j] as string)) j++;
    const w = this.s.slice(start, j);
    if (w === 'true' || w === 'false') {
      this.i = j;
      return { type: 'boolean', start, end: j };
    }
    if (w === 'null') {
      this.i = j;
      return { type: 'null', start, end: j };
    }
    const lower = w.toLowerCase();
    if (lower === 'true' || lower === 'false' || lower === 'null') {
      this.fail(start, w.length, `"${w}" must be lower case.`, `Write ${lower}.`);
    }
    if (w === 'undefined' || w === 'NaN' || w === 'Infinity') {
      this.fail(start, w.length, `JSON has no ${w}.`, 'Use null, or leave the key out.');
    }
    return this.fail(
      start,
      w.length,
      `"${w}" is not a JSON value.`,
      'Text must be inside double quotes. Numbers, true, false and null are written bare.',
    );
  }

  string(): ScalarNode {
    const start = this.i;
    this.i++; // opening quote
    for (;;) {
      if (this.atEnd()) {
        this.fail(
          start,
          this.s.length - start,
          'A string is never closed.',
          'Add the closing " at the end of the string.',
        );
      }
      const c = this.s.charCodeAt(this.i);
      if (c === 0x22) {
        this.i++;
        return { type: 'string', start, end: this.i };
      }
      if (c === 0x0a || c === 0x0d) {
        this.fail(
          start,
          this.i - start,
          'A string cannot continue onto the next line.',
          'Close it with a " before the line ends, or write \\n for a line break.',
        );
      }
      if (c < 0x20) {
        this.fail(
          this.i,
          1,
          'A raw control character is not allowed inside a string.',
          'Write it as an escape such as \\t.',
        );
      }
      if (c === 0x5c) {
        const n = this.s[this.i + 1];
        if (n === undefined) {
          this.fail(this.i, 1, 'A string is never closed.', 'Add the closing " at the end of the string.');
        }
        if (n === 'u') {
          const hex = this.s.slice(this.i + 2, this.i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            this.fail(this.i, 2, 'A \\u escape needs four hex digits.', 'Write for example \\u00e9.');
          }
          this.i += 6;
          continue;
        }
        if (!'"\\/bfnrt'.includes(n)) {
          this.fail(this.i, 2, `"\\${n}" is not a valid escape.`, 'Write a real backslash as \\\\.');
        }
        this.i += 2;
        continue;
      }
      this.i++;
    }
  }

  number(): ScalarNode {
    const start = this.i;
    let j = start;
    const s = this.s;
    // `charCodeAt` is NaN past the end, so every comparison below is false there.
    const isDigit = (k: number): boolean => {
      const c = s.charCodeAt(k);
      return c >= 48 && c <= 57;
    };
    const isNonZeroDigit = (k: number): boolean => {
      const c = s.charCodeAt(k);
      return c >= 49 && c <= 57;
    };
    if (s[j] === '-') j++;
    const digitsStart = j;
    if (s[j] === '0') {
      j++;
      if (isDigit(j)) {
        this.fail(start, j - start + 1, 'Numbers cannot have leading zeros.', 'Remove the extra 0.');
      }
    } else if (isNonZeroDigit(j)) {
      while (isDigit(j)) j++;
    } else {
      this.fail(start, j - start + 1, 'A "-" must be followed by a digit.');
    }
    if (j === digitsStart) this.fail(start, 1, 'A number is missing its digits.');
    if (s[j] === '.') {
      j++;
      if (!isDigit(j)) {
        this.fail(start, j - start, 'A decimal point must be followed by digits.', 'Write 0.5, not 0.');
      }
      while (isDigit(j)) j++;
    }
    if (s[j] === 'e' || s[j] === 'E') {
      j++;
      if (s[j] === '+' || s[j] === '-') j++;
      if (!isDigit(j)) {
        this.fail(start, j - start, 'An exponent must be followed by digits.');
      }
      while (isDigit(j)) j++;
    }
    this.i = j;
    return { type: 'number', start, end: j };
  }

  enter(open: number): void {
    this.depth++;
    if (this.depth > MAX_DEPTH) {
      this.fail(open, 1, `Nested more than ${MAX_DEPTH} levels deep.`, 'A spec is never this deep.');
    }
  }

  object(): ObjectNode {
    const start = this.i;
    this.enter(start);
    this.i++;
    const props: PropNode[] = [];
    this.ws();
    if (this.s[this.i] === '}') {
      this.i++;
      this.depth--;
      return { type: 'object', start, end: this.i, props };
    }
    for (;;) {
      this.ws();
      if (this.atEnd()) {
        this.fail(start, 1, 'This { is never closed.', 'Add the matching } at the end.');
      }
      const c = this.s[this.i] as string;
      if (c === '}') {
        this.fail(
          this.i,
          1,
          'There is a comma before this closing brace.',
          'Remove the trailing comma: JSON does not allow one.',
        );
      }
      if (c !== '"') {
        if (c === "'") {
          this.fail(
            this.i,
            1,
            'Property names use double quotes, not single quotes.',
            'Replace the single quotes with ".',
          );
        }
        if (/[A-Za-z_$0-9]/.test(c)) {
          let j = this.i;
          while (j < this.s.length && /[A-Za-z0-9_$]/.test(this.s[j] as string)) j++;
          this.fail(
            this.i,
            j - this.i,
            `The property name "${this.s.slice(this.i, j)}" needs double quotes.`,
            `Write "${this.s.slice(this.i, j)}".`,
          );
        }
        this.fail(this.i, 1, `Expected a property name in double quotes, found ${show(c)}.`);
      }
      const keyNode = this.string();
      const key = JSON.parse(this.s.slice(keyNode.start, keyNode.end)) as string;
      this.ws();
      if (this.s[this.i] !== ':') {
        const found = this.atEnd() ? 'the end of the text' : show(this.s[this.i] as string);
        this.fail(
          keyNode.end,
          1,
          `Expected a colon after the property name, found ${found}.`,
          'Write "name": value.',
        );
      }
      this.i++;
      const value = this.value();
      props.push({ key, keyStart: keyNode.start, keyEnd: keyNode.end, value });
      this.ws();
      const n = this.s[this.i];
      if (n === ',') {
        this.i++;
        continue;
      }
      if (n === '}') {
        this.i++;
        this.depth--;
        return { type: 'object', start, end: this.i, props };
      }
      if (n === undefined) {
        this.fail(start, 1, 'This { is never closed.', 'Add the matching } at the end.');
      }
      this.fail(
        value.end,
        1,
        `A comma is missing: expected "," or "}" after this value, found ${show(n)}.`,
        'Add a comma after the value on the line above.',
      );
    }
  }

  array(): ArrayNode {
    const start = this.i;
    this.enter(start);
    this.i++;
    const items: JsonNode[] = [];
    this.ws();
    if (this.s[this.i] === ']') {
      this.i++;
      this.depth--;
      return { type: 'array', start, end: this.i, items };
    }
    for (;;) {
      this.ws();
      if (this.atEnd()) {
        this.fail(start, 1, 'This [ is never closed.', 'Add the matching ] at the end.');
      }
      if (this.s[this.i] === ']') {
        this.fail(
          this.i,
          1,
          'There is a comma before this closing bracket.',
          'Remove the trailing comma: JSON does not allow one.',
        );
      }
      const item = this.value();
      items.push(item);
      this.ws();
      const n = this.s[this.i];
      if (n === ',') {
        this.i++;
        continue;
      }
      if (n === ']') {
        this.i++;
        this.depth--;
        return { type: 'array', start, end: this.i, items };
      }
      if (n === undefined) {
        this.fail(start, 1, 'This [ is never closed.', 'Add the matching ] at the end.');
      }
      this.fail(
        item.end,
        1,
        `A comma is missing: expected "," or "]" after this value, found ${show(n)}.`,
        'Add a comma after the value on the line above.',
      );
    }
  }
}

/** Parse text into a tree with positions, or a friendly error. Never throws. */
export function parseJsonText(text: string): JsonParse {
  const starts = lineStarts(text);
  const problem = (f: Failure): JsonProblem => {
    const offset = Math.min(f.offset, text.length);
    const pos = offsetToPos(starts, offset);
    return {
      message: f.detail,
      hint: f.hint,
      offset,
      length: Math.max(f.length, 0),
      line: pos.line,
      column: pos.column,
    };
  };
  if (text.length > MAX_JSON_CHARS) {
    return {
      ok: false,
      root: null,
      error: {
        message: `This text is ${text.length.toLocaleString('en-US')} characters, far larger than any Flux spec.`,
        hint: 'A spec is a few kilobytes at most. Paste only the spec.',
        offset: 0,
        length: 0,
        line: 0,
        column: 0,
      },
    };
  }
  try {
    const root = new Parser(text).document();
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'not valid JSON';
      return { ok: false, root: null, error: { message: detail, offset: 0, length: 0, line: 0, column: 0 } };
    }
    return { ok: true, root, value };
  } catch (e) {
    if (e instanceof Failure) return { ok: false, root: null, error: problem(e) };
    const detail = e instanceof Error ? e.message : 'The text could not be read.';
    return { ok: false, root: null, error: { message: detail, offset: 0, length: 0, line: 0, column: 0 } };
  }
}

// ---------------------------------------------------------------------------
// Locating a JSON path in text
// ---------------------------------------------------------------------------

export interface Located {
  node: JsonNode;
  /** The property that holds `node`, when it is an object member. */
  key?: { start: number; end: number; name: string };
  /** True when the whole path was found; false when this is the closest ancestor that exists. */
  exact: boolean;
  /** The path of `node` (the requested path, or its closest existing ancestor). */
  path: string;
}

/**
 * Find the node for a JSON path. When the path is not in the text (a missing key, an index beyond the
 * array), the closest ancestor that is there is returned with `exact: false`.
 */
export function locate(root: JsonNode, path: string): Located {
  const segs = parsePath(path);
  let node: JsonNode = root;
  let key: Located['key'];
  const walked: PathSeg[] = [];
  for (const seg of segs) {
    let next: JsonNode | undefined;
    let nextKey: Located['key'];
    if (node.type === 'object') {
      for (const p of node.props) {
        if (p.key === String(seg)) {
          next = p.value;
          nextKey = { start: p.keyStart, end: p.keyEnd, name: p.key };
        }
      }
    } else if (node.type === 'array' && typeof seg === 'number') {
      next = node.items[seg];
      nextKey = undefined;
    }
    if (!next) {
      return { node, key, exact: false, path: pathOf(walked) };
    }
    node = next;
    key = nextKey;
    walked.push(seg);
  }
  return { node, key, exact: true, path: pathOf(walked) };
}

function pathOf(segs: readonly PathSeg[]): string {
  let s = '';
  for (const seg of segs) s += typeof seg === 'number' ? `[${seg}]` : s ? `.${seg}` : seg;
  return s;
}

/** The character range a marker for this location should cover. */
export function markerRange(located: Located, text: string): { from: number; to: number } {
  const { node, key } = located;
  if (node.type === 'object' || node.type === 'array') {
    if (key) return { from: key.start, to: key.end };
    if (node.type === 'object') {
      const nameProp = node.props.find((p) => p.key === 'name');
      if (nameProp) return { from: nameProp.value.start, to: nameProp.value.end };
    }
    const eol = text.indexOf('\n', node.start);
    return { from: node.start, to: Math.min(node.start + 1, eol < 0 ? text.length : eol) };
  }
  return { from: node.start, to: node.end };
}

// ---------------------------------------------------------------------------
// Tolerant tokenizer (highlighting)
// ---------------------------------------------------------------------------

export type TokenKind = 'key' | 'string' | 'number' | 'literal' | 'punct' | 'space' | 'error';

export interface Token {
  kind: TokenKind;
  /** Offsets within the line that was tokenized. */
  start: number;
  end: number;
}

const NUMBER_AT = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const WORD_AT = /[A-Za-z_$][A-Za-z0-9_$]*/y;

/** Tokenize ONE line. JSON tokens never span lines, so a document is tokenized line by line. */
export function tokenizeLine(line: string): Token[] {
  const out: Token[] = [];
  const n = line.length;
  let i = 0;
  while (i < n) {
    const c = line.charCodeAt(i);
    if (c === 0x20 || c === 0x09 || c === 0x0d) {
      let j = i + 1;
      while (j < n) {
        const d = line.charCodeAt(j);
        if (d !== 0x20 && d !== 0x09 && d !== 0x0d) break;
        j++;
      }
      out.push({ kind: 'space', start: i, end: j });
      i = j;
      continue;
    }
    if (c === 0x22) {
      let j = i + 1;
      let closed = false;
      while (j < n) {
        const d = line.charCodeAt(j);
        if (d === 0x5c) {
          j += 2;
          continue;
        }
        if (d === 0x22) {
          j++;
          closed = true;
          break;
        }
        j++;
      }
      if (j > n) j = n;
      if (!closed) {
        out.push({ kind: 'error', start: i, end: j });
      } else {
        let k = j;
        while (k < n && (line.charCodeAt(k) === 0x20 || line.charCodeAt(k) === 0x09)) k++;
        out.push({ kind: line[k] === ':' ? 'key' : 'string', start: i, end: j });
      }
      i = j;
      continue;
    }
    const ch = line[i] as string;
    if ('{}[],:'.includes(ch)) {
      out.push({ kind: 'punct', start: i, end: i + 1 });
      i++;
      continue;
    }
    if (c === 0x2d || (c >= 0x30 && c <= 0x39)) {
      NUMBER_AT.lastIndex = i;
      const m = NUMBER_AT.exec(line);
      if (m && m[0].length > 0) {
        out.push({ kind: 'number', start: i, end: i + m[0].length });
        i += m[0].length;
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(ch)) {
      WORD_AT.lastIndex = i;
      const m = WORD_AT.exec(line);
      const w = m ? m[0] : ch;
      const kind: TokenKind = w === 'true' || w === 'false' || w === 'null' ? 'literal' : 'error';
      out.push({ kind, start: i, end: i + w.length });
      i += w.length;
      continue;
    }
    out.push({ kind: 'error', start: i, end: i + 1 });
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Canonical text of a spec
// ---------------------------------------------------------------------------

const APP_ORDER = [
  'version',
  'name',
  'description',
  'owner',
  'instances',
  'expire',
  'staticip',
  'enterprise',
  'contacts',
  'geolocation',
  'nodes',
  'datacenter',
  'compose',
];
const COMPONENT_ORDER = [
  'name',
  'description',
  'repotag',
  'repoauth',
  'ports',
  'containerPorts',
  'domains',
  'environmentParameters',
  'commands',
  'containerData',
  'cpu',
  'ram',
  'hdd',
];

function ordered(obj: Record<string, unknown>, order: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of order) if (k in obj) out[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in out)) out[k] = obj[k];
  return out;
}

/**
 * The text the editor shows for a spec: two-space indent, app settings first and `compose` last, keys of
 * a component in the order the FluxCloud form lists them. Arrays of short scalars stay on one line so a
 * `ports` list does not take five lines.
 */
export function specToText(spec: unknown): string {
  const prepared = prepare(spec);
  return stringify(prepared, 0);
}

function prepare(spec: unknown): unknown {
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) return spec;
  const app = spec as Record<string, unknown>;
  const out = ordered(app, APP_ORDER);
  if (Array.isArray(out.compose)) {
    out.compose = out.compose.map((c) =>
      c !== null && typeof c === 'object' && !Array.isArray(c)
        ? ordered(c as Record<string, unknown>, COMPONENT_ORDER)
        : c,
    );
  }
  return out;
}

const INLINE_MAX = 72;

function stringify(value: unknown, depth: number): string {
  const pad = '  '.repeat(depth);
  const pad1 = '  '.repeat(depth + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const scalar = value.every((v) => v === null || typeof v !== 'object');
    if (scalar) {
      const inline = `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
      if (inline.length <= INLINE_MAX) return inline;
    }
    return `[\n${value.map((v) => pad1 + stringify(v, depth + 1)).join(',\n')}\n${pad}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([k, v]) => `${pad1}${JSON.stringify(k)}: ${stringify(v, depth + 1)}`).join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Compact JSON, for share links and exports that must be small. */
export function specToCompactText(spec: unknown): string {
  return JSON.stringify(prepare(spec));
}
