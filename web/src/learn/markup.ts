/**
 * The inline markup of lesson prose (types.ts `Markup`): one parser for the whole app.
 *
 * Everything that reads this markup goes through this module: the lesson renderer (`MarkupText`), the
 * design system's `Markup` (through `ui/Markup/parse.ts`, a thin adapter), the shell's `InlineMarkup`, the
 * validator and the text statistics. What the validator accepts is exactly what every renderer
 * understands, and a term reads the same wherever it shows up. Content is data: the parser produces a
 * small node tree of text, never HTML, and a renderer maps that tree to React elements. A malformed
 * string never throws; it degrades to text and reports `problems`.
 *
 * Grammar
 *   **bold**   *italic*   `code`
 *   [label](https://example.com)
 *   {{term:id}}   {{lesson:id}}   {{lab:id}}   {{kbd:Ctrl+K}}
 *   {{term:id|lower}}   {{term:id|Cap}}   force the first letter of a term's name (see "Term names")
 *   \* \` \[ \] \( \) \{ \} \_ \\   escapes
 *
 * Rules, in the order they matter
 *  - Code spans are literal. A run of N backticks closes at the next run of exactly N.
 *  - Emphasis follows the CommonMark delimiter algorithm for `*` (flanking runs, `**` versus `*`, the rule
 *    of three), so `***both***`, `**bold *and italic***` and `a * b` behave as people expect. Only `*`
 *    emphasises: underscores in `snake_case` are never touched.
 *  - A link label is plain text with bold and italic allowed. A link keeps its target only when it is
 *    http, https, mailto or site-relative; any other target (`javascript:`, `data:`) is `unsafe`: the design
 *    system's tree drops it and keeps the label, the lesson tree keeps it so the validator can say so.
 *  - Anything unterminated or unknown stays literal text and is reported in `problems`. Nothing throws.
 *  - Linear in the length of the input: every scan is bounded or consumed, the emphasis stack keeps a
 *    floor per delimiter class, and nesting is capped (`MAX_DEPTH`) after the fact so a renderer never
 *    recurses deeply.
 *
 * Term names. A glossary entry has one display name ("Instance", "FluxNode"), but prose wants it to sit in
 * a sentence: "your only instance", not "your only Instance". The parser records, for every `{{term}}`,
 * whether it opens a sentence (`start`) and any explicit `|lower` or `|Cap`; `termText` turns that into
 * the words to show. The rule lives here so every renderer applies the same one.
 *
 * Two trees are available. `parseTree` is the core and yields the design system's shape (`strong`, `em`,
 * link `children`, kbd `combo`); `parseMarkup` yields the lesson shape the validator and `MarkupText` were
 * built on (`bold`, `italic`, link `label`, kbd `keys`) from the same parse, plus the `problems`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An explicit choice for the first letter of a term's name: `{{term:id|lower}}`, `{{term:id|Cap}}`. */
export type TermCase = 'lower' | 'cap';

/** The core tree (the design system's shape). */
export type TreeNode =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: TreeNode[] }
  | { type: 'em'; children: TreeNode[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: TreeNode[]; unsafe?: boolean }
  | { type: 'term'; id: string; case?: TermCase; start?: boolean }
  | { type: 'lesson'; id: string }
  | { type: 'lab'; id: string }
  | { type: 'kbd'; combo: string };

/** The lesson tree: the same parse in the shape the validator and `MarkupText` use. */
export type MarkupNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: MarkupNode[] }
  | { type: 'italic'; children: MarkupNode[] }
  | { type: 'code'; text: string }
  | { type: 'link'; label: string; href: string; children?: MarkupNode[]; unsafe?: boolean }
  | { type: 'term'; id: string; case?: TermCase; start?: boolean }
  | { type: 'lesson'; id: string }
  | { type: 'lab'; id: string }
  | { type: 'kbd'; keys: string[]; combo?: string };

export type MarkupProblemKind =
  | 'unbalanced-bold'
  | 'unbalanced-italic'
  | 'unbalanced-code'
  | 'unclosed-directive'
  | 'unknown-directive'
  | 'empty-directive'
  | 'invalid-directive'
  | 'unknown-modifier'
  | 'stray-close';

export interface MarkupProblem {
  kind: MarkupProblemKind;
  /** Character offset in the source string. */
  at: number;
  message: string;
}

export interface ParsedMarkup {
  nodes: MarkupNode[];
  problems: MarkupProblem[];
}

export interface ParsedTree {
  nodes: TreeNode[];
  problems: MarkupProblem[];
}

export interface ParseTreeOptions {
  /**
   * Keep links whose target is not safe (marked `unsafe`) instead of unwrapping them to their label. The
   * validator needs to see them; a renderer never should.
   */
  keepUnsafe?: boolean;
  /** Collect `problems`. Default true; a renderer that only wants the tree can skip the bookkeeping. */
  report?: boolean;
}

/** Deepest nesting of bold, italic and link nodes the parser will hand back. */
export const MAX_DEPTH = 6;

const MAX_LABEL = 1000;
const MAX_URL = 2048;
const MAX_TOKEN = 120;

const BACKSLASH = 92;
const BACKTICK = 96;
const ASTERISK = 42;
const LBRACKET = 91;
const RBRACKET = 93;
const LPAREN = 40;
const RPAREN = 41;
const LBRACE = 123;
const RBRACE = 125;

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

/**
 * Schemes a markup link may use. Anything else (javascript:, data:, vbscript:) is not safe: content is
 * data, never script.
 */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed === '') return false;
  if (/^(?:\/(?!\/)|#|\.\.?\/|\?)/.test(trimmed)) return true; // relative to this site
  return /^(?:https?:\/\/|mailto:)/i.test(trimmed);
}

// ---------------------------------------------------------------------------
// Character classes (for flanking)
// ---------------------------------------------------------------------------

const UNICODE_SPACE = /^\s$/u;
const UNICODE_PUNCT = /^[\p{P}\p{S}]$/u;

function isSpaceCode(c: number): boolean {
  if (c < 128) return c === 32 || (c >= 9 && c <= 13);
  return UNICODE_SPACE.test(String.fromCodePoint(c));
}

function isPunctCode(c: number): boolean {
  if (c < 128) {
    return (c >= 33 && c <= 47) || (c >= 58 && c <= 64) || (c >= 91 && c <= 96) || (c >= 123 && c <= 126);
  }
  return UNICODE_PUNCT.test(String.fromCodePoint(c));
}

function codePointBefore(s: string, i: number): number {
  const lo = s.charCodeAt(i - 1);
  if (lo >= 0xdc00 && lo <= 0xdfff && i >= 2) {
    const hi = s.charCodeAt(i - 2);
    if (hi >= 0xd800 && hi <= 0xdbff) return (hi - 0xd800) * 0x400 + (lo - 0xdc00) + 0x10000;
  }
  return lo;
}

/** What a backslash may escape. Deliberately small: `C:\Users` keeps its backslash. */
function isEscapable(c: number): boolean {
  return (
    c === BACKSLASH ||
    c === ASTERISK ||
    c === BACKTICK ||
    c === LBRACKET ||
    c === RBRACKET ||
    c === LPAREN ||
    c === RPAREN ||
    c === LBRACE ||
    c === RBRACE ||
    c === 95 // _
  );
}

// ---------------------------------------------------------------------------
// The inline list: items between delimiters, linked so containers can be built in O(1) splices
// ---------------------------------------------------------------------------

const TEXT = 0;
const NODE = 1;
const DELIM = 2;

class Item {
  prev: Item | null = null;
  next: Item | null = null;
  /** The delimiter stack (only delimiters are linked here). */
  dprev: Item | null = null;
  dnext: Item | null = null;
  text = '';
  node: TreeNode | null = null;
  /** DELIM: characters left, the length it started with, and what it may do. */
  count = 0;
  orig = 0;
  canOpen = false;
  canClose = false;
  /** DELIM: where the run starts in the source. */
  at = 0;
  kind: 0 | 1 | 2;
  constructor(kind: 0 | 1 | 2) {
    this.kind = kind;
  }
}

function textItem(text: string): Item {
  const it = new Item(TEXT);
  it.text = text;
  return it;
}

function nodeItem(node: TreeNode): Item {
  const it = new Item(NODE);
  it.node = node;
  return it;
}

/** Appends `node` to `out`, merging adjacent text so the tree stays small. */
function pushNode(out: TreeNode[], node: TreeNode): void {
  const last = out[out.length - 1];
  if (node.type === 'text') {
    if (node.text === '') return;
    if (last && last.type === 'text') {
      last.text += node.text;
      return;
    }
    out.push({ type: 'text', text: node.text });
    return;
  }
  out.push(node);
}

function itemToNode(it: Item): TreeNode {
  if (it.kind === NODE) return it.node as TreeNode;
  if (it.kind === DELIM) return { type: 'text', text: '*'.repeat(it.count) };
  return { type: 'text', text: it.text };
}

// ---------------------------------------------------------------------------
// Backtick runs, indexed once per parse so code spans cost O(log n) each
// ---------------------------------------------------------------------------

interface BacktickIndex {
  /** Start offsets of every maximal backtick run, grouped by run length, ascending. */
  byLen: Map<number, number[]>;
}

function indexBackticks(src: string): BacktickIndex {
  const byLen = new Map<number, number[]>();
  const n = src.length;
  let i = src.indexOf('`');
  while (i !== -1 && i < n) {
    let j = i + 1;
    while (j < n && src.charCodeAt(j) === BACKTICK) j++;
    const len = j - i;
    const list = byLen.get(len);
    if (list) list.push(i);
    else byLen.set(len, [i]);
    i = j < n ? src.indexOf('`', j) : -1;
  }
  return { byLen };
}

/** The start of the first run of exactly `len` backticks at or after `from`, or -1. */
function findCloser(index: BacktickIndex, len: number, from: number): number {
  const list = index.byLen.get(len);
  if (!list) return -1;
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((list[mid] as number) < from) lo = mid + 1;
    else hi = mid;
  }
  return lo < list.length ? (list[lo] as number) : -1;
}

function codeContent(raw: string): string {
  const s = raw.replace(/\r\n|\r|\n/g, ' ');
  if (s.length >= 2 && s.startsWith(' ') && s.endsWith(' ') && s.trim() !== '') return s.slice(1, -1);
  return s;
}

// ---------------------------------------------------------------------------
// {{kind:arg}} tokens
// ---------------------------------------------------------------------------

const ID = /^[a-z0-9][a-z0-9._-]*$/i;
const DIRECTIVES: ReadonlySet<string> = new Set(['term', 'lesson', 'lab', 'kbd']);

type TokenResult = { node: TreeNode } | { problem: MarkupProblemKind; message: string };

function badId(inner: string, kind: string): TokenResult {
  return {
    problem: 'invalid-directive',
    message: `"{{${inner}}}" does not name a ${kind}. Use the id: letters, digits and hyphens.`,
  };
}

function parseToken(inner: string): TokenResult {
  const colon = inner.indexOf(':');
  const kind = colon < 1 ? '' : inner.slice(0, colon).trim().toLowerCase();
  if (!DIRECTIVES.has(kind)) {
    return {
      problem: 'unknown-directive',
      message: `"{{${inner}}}" is not a known directive. Use term, lesson, lab or kbd.`,
    };
  }
  const arg = inner.slice(colon + 1).trim();
  if (arg === '') {
    return { problem: 'empty-directive', message: `"{{${inner}}}" has no value after the colon.` };
  }
  switch (kind) {
    case 'term': {
      const bar = arg.indexOf('|');
      const id = (bar < 0 ? arg : arg.slice(0, bar)).trim();
      if (!ID.test(id)) return badId(inner, 'glossary term');
      if (bar < 0) return { node: { type: 'term', id } };
      const modifier = arg.slice(bar + 1).trim();
      const m = modifier.toLowerCase();
      if (m === 'lower') return { node: { type: 'term', id, case: 'lower' } };
      if (m === 'cap') return { node: { type: 'term', id, case: 'cap' } };
      return {
        problem: 'unknown-modifier',
        message: `"{{${inner}}}" has an unknown modifier "${modifier}". Use |lower or |Cap.`,
      };
    }
    case 'lesson':
      return ID.test(arg) ? { node: { type: 'lesson', id: arg } } : badId(inner, 'lesson');
    case 'lab':
      return ID.test(arg) ? { node: { type: 'lab', id: arg } } : badId(inner, 'lab');
    default:
      // kbd. Spaces around the plus are decoration, not a key sequence.
      return arg.length <= 40 && !/[{}]/.test(arg)
        ? { node: { type: 'kbd', combo: arg.replace(/\s*\+\s*/g, '+') } }
        : { problem: 'invalid-directive', message: `"{{${inner}}}" is not a key combination.` };
  }
}

// ---------------------------------------------------------------------------
// The parser
// ---------------------------------------------------------------------------

interface Ctx {
  /** Where problems go, or null when nobody asked for them. */
  problems: MarkupProblem[] | null;
  /** Offset of this string inside the whole source (a label is parsed on its own). */
  base: number;
  keepUnsafe: boolean;
}

/**
 * @param atoms  false inside a link label: no code spans, tokens or links, only escapes and emphasis.
 */
function parseInline(src: string, atoms: boolean, ctx: Ctx): TreeNode[] {
  const n = src.length;
  if (n === 0) return [];
  const { problems, base } = ctx;

  const head = new Item(TEXT); // list sentinel
  let tail: Item = head;
  const bottom = new Item(DELIM); // delimiter stack sentinel
  let dtop: Item = bottom;
  let backticks: BacktickIndex | null = null;
  /** The `}}` of a directive that was reported already, so it is not also reported as stray. */
  let reportedClose = -1;

  const append = (it: Item): void => {
    it.prev = tail;
    tail.next = it;
    tail = it;
  };
  const appendText = (text: string): void => {
    if (text !== '') append(textItem(text));
  };

  let i = 0;
  let textStart = 0;
  const flush = (end: number): void => {
    if (end > textStart) appendText(src.slice(textStart, end));
  };

  while (i < n) {
    const c = src.charCodeAt(i);

    if (c === BACKSLASH) {
      if (i + 1 < n && isEscapable(src.charCodeAt(i + 1))) {
        flush(i);
        appendText(src.charAt(i + 1));
        i += 2;
        textStart = i;
      } else {
        i++;
      }
      continue;
    }

    if (c === ASTERISK) {
      let j = i + 1;
      while (j < n && src.charCodeAt(j) === ASTERISK) j++;
      const len = j - i;
      const before = i === 0 ? -1 : codePointBefore(src, i);
      const after = j >= n ? -1 : (src.codePointAt(j) as number);
      const wsBefore = before === -1 || isSpaceCode(before);
      const wsAfter = after === -1 || isSpaceCode(after);
      const pBefore = before !== -1 && isPunctCode(before);
      const pAfter = after !== -1 && isPunctCode(after);
      const leftFlanking = !wsAfter && (!pAfter || wsBefore || pBefore);
      const rightFlanking = !wsBefore && (!pBefore || wsAfter || pAfter);
      if (leftFlanking || rightFlanking) {
        flush(i);
        const d = new Item(DELIM);
        d.count = len;
        d.orig = len;
        d.canOpen = leftFlanking;
        d.canClose = rightFlanking;
        d.at = i;
        append(d);
        d.dprev = dtop;
        dtop.dnext = d;
        dtop = d;
        textStart = j;
      }
      i = j;
      continue;
    }

    if (!atoms) {
      i++;
      continue;
    }

    if (c === BACKTICK) {
      let j = i + 1;
      while (j < n && src.charCodeAt(j) === BACKTICK) j++;
      const len = j - i;
      backticks ??= indexBackticks(src);
      const close = findCloser(backticks, len, j);
      if (close !== -1) {
        flush(i);
        append(nodeItem({ type: 'code', text: codeContent(src.slice(j, close)) }));
        i = close + len;
        textStart = i;
      } else {
        // Unterminated: the backticks stay literal text.
        problems?.push({ kind: 'unbalanced-code', at: base + i, message: 'A backtick is not closed.' });
        i = j;
      }
      continue;
    }

    if (c === LBRACE && src.charCodeAt(i + 1) === LBRACE) {
      const stop = Math.min(n - 1, i + 2 + MAX_TOKEN);
      let j = i + 2;
      let end = -1;
      while (j < stop) {
        const cj = src.charCodeAt(j);
        if (cj === RBRACE && src.charCodeAt(j + 1) === RBRACE) {
          end = j;
          break;
        }
        if (cj === LBRACE || cj === 10) break;
        j++;
      }
      const token = end === -1 ? null : parseToken(src.slice(i + 2, end));
      if (token && 'node' in token) {
        flush(i);
        append(nodeItem(token.node));
        i = end + 2;
        textStart = i;
      } else {
        if (problems) {
          if (token) {
            problems.push({ kind: token.problem, at: base + i, message: token.message });
            reportedClose = end;
          } else {
            problems.push({
              kind: 'unclosed-directive',
              at: base + i,
              message: 'A "{{" is not closed with "}}".',
            });
            // Its closing braces, when they are right there, are not a second problem.
            const near = Math.min(n - 1, i + 2 + 2 * MAX_TOKEN);
            for (let m = i + 2; m < near; m++) {
              if (src.charCodeAt(m) === RBRACE && src.charCodeAt(m + 1) === RBRACE) {
                reportedClose = m;
                break;
              }
            }
          }
        }
        i += 2;
      }
      continue;
    }

    if (c === RBRACE && src.charCodeAt(i + 1) === RBRACE) {
      if (problems && i !== reportedClose) {
        problems.push({ kind: 'stray-close', at: base + i, message: 'A "}}" has no matching "{{".' });
      }
      i += 2;
      continue;
    }

    if (c === LBRACKET) {
      // [label](target): the label may not contain another bracket; the target has no spaces.
      const labelStop = Math.min(n, i + 1 + MAX_LABEL);
      let j = i + 1;
      while (j < labelStop) {
        const cj = src.charCodeAt(j);
        if (cj === BACKSLASH) {
          j += 2;
          continue;
        }
        if (cj === LBRACKET || cj === RBRACKET) break;
        j++;
      }
      let end = -1;
      if (j < labelStop && src.charCodeAt(j) === RBRACKET && src.charCodeAt(j + 1) === LPAREN) {
        const urlStop = Math.min(n, j + 2 + MAX_URL);
        let k = j + 2;
        let depth = 0;
        while (k < urlStop) {
          const ck = src.charCodeAt(k);
          if (ck === 32 || (ck >= 9 && ck <= 13)) break;
          if (ck === LPAREN) depth++;
          else if (ck === RPAREN) {
            if (depth === 0) {
              end = k;
              break;
            }
            depth--;
          }
          k++;
        }
      }
      if (end !== -1 && j > i + 1) {
        flush(i);
        const href = src.slice(j + 2, end);
        const children = parseInline(src.slice(i + 1, j), false, { ...ctx, base: base + i + 1 });
        if (isSafeHref(href)) {
          append(nodeItem({ type: 'link', href: href.trim(), children }));
        } else if (ctx.keepUnsafe) {
          append(nodeItem({ type: 'link', href: href.trim(), children, unsafe: true }));
        } else {
          // An unsafe target is dropped; what the author wrote as the label stays.
          for (const child of children) append(nodeItem(child));
        }
        i = end + 1;
        textStart = i;
      } else {
        i++;
      }
      continue;
    }

    i++;
  }
  flush(n);

  // ---- emphasis (the CommonMark delimiter algorithm, `*` only) ----------------------------
  const unbalanced = (d: Item): void => {
    problems?.push({
      kind: d.count >= 2 ? 'unbalanced-bold' : 'unbalanced-italic',
      at: base + d.at,
      message: d.count >= 2 ? 'A "**" is not closed.' : 'A "*" is not closed.',
    });
  };
  const openersBottom: Item[] = [bottom, bottom, bottom, bottom, bottom, bottom];
  let closer: Item | null = bottom.dnext;
  while (closer) {
    if (!closer.canClose) {
      closer = closer.dnext;
      continue;
    }
    const slot = (closer.canOpen ? 3 : 0) + (closer.orig % 3);
    const floor = openersBottom[slot] as Item;
    let opener: Item | null = closer.dprev;
    let found = false;
    while (opener && opener !== bottom && opener !== floor) {
      const oddMatch =
        (closer.canOpen || opener.canClose) && closer.orig % 3 !== 0 && (opener.orig + closer.orig) % 3 === 0;
      if (opener.canOpen && !oddMatch) {
        found = true;
        break;
      }
      opener = opener.dprev;
    }

    if (found && opener) {
      const use = closer.count >= 2 && opener.count >= 2 ? 2 : 1;
      opener.count -= use;
      closer.count -= use;

      // Everything between opener and closer becomes the container's children.
      const children: TreeNode[] = [];
      let it = opener.next;
      while (it && it !== closer) {
        // A delimiter that is still here found no partner and is sealed inside the container as text.
        if (it.kind === DELIM && it.count > 0) unbalanced(it);
        pushNode(children, itemToNode(it));
        it = it.next;
      }
      const container = nodeItem({ type: use === 2 ? 'strong' : 'em', children });
      container.prev = opener;
      container.next = closer;
      opener.next = container;
      closer.prev = container;
      // Delimiters that sat between them are now plain text inside the container.
      opener.dnext = closer;
      closer.dprev = opener;

      if (opener.count === 0) {
        const p = opener.prev as Item;
        p.next = container;
        container.prev = p;
        const dp = opener.dprev as Item;
        dp.dnext = closer;
        closer.dprev = dp;
      }
      if (closer.count === 0) {
        const nx = closer.next;
        container.next = nx;
        if (nx) nx.prev = container;
        else tail = container;
        const dp = closer.dprev as Item;
        const dn = closer.dnext;
        dp.dnext = dn;
        if (dn) dn.dprev = dp;
        else dtop = dp;
        closer = dn;
      }
      // else: the closer still has characters; it is looked at again.
    } else {
      const old: Item = closer;
      closer = closer.dnext;
      openersBottom[slot] = old.dprev as Item;
      if (!old.canOpen) {
        const dp = old.dprev as Item;
        dp.dnext = old.dnext;
        if (old.dnext) old.dnext.dprev = dp;
      }
    }
  }

  // ---- the list to nodes (and what never found its partner) --------------------------------
  const out: TreeNode[] = [];
  for (let it = head.next; it; it = it.next) {
    if (it.kind === DELIM && it.count > 0) unbalanced(it);
    pushNode(out, itemToNode(it));
  }
  return out;
}

/** Unwraps bold and italic nested beyond `MAX_DEPTH`, iteratively (the tree may be very deep). */
function capDepth(nodes: TreeNode[]): TreeNode[] {
  // Fast path: most strings are shallow, and measuring needs no allocation.
  let deep = false;
  {
    const stack: Array<{ list: TreeNode[]; depth: number }> = [{ list: nodes, depth: 0 }];
    while (stack.length && !deep) {
      const frame = stack.pop() as { list: TreeNode[]; depth: number };
      for (const node of frame.list) {
        if (node.type === 'strong' || node.type === 'em' || node.type === 'link') {
          if (frame.depth + 1 > MAX_DEPTH) {
            deep = true;
            break;
          }
          stack.push({ list: node.children, depth: frame.depth + 1 });
        }
      }
    }
  }
  if (!deep) return nodes;

  const root: TreeNode[] = [];
  const stack: Array<{ src: TreeNode[]; i: number; out: TreeNode[]; depth: number }> = [
    { src: nodes, i: 0, out: root, depth: 0 },
  ];
  while (stack.length) {
    const top = stack[stack.length - 1] as (typeof stack)[number];
    if (top.i >= top.src.length) {
      stack.pop();
      continue;
    }
    const node = top.src[top.i++] as TreeNode;
    if (node.type === 'strong' || node.type === 'em') {
      if (top.depth >= MAX_DEPTH) {
        // Too deep: keep the words, lose the wrapper.
        stack.push({ src: node.children, i: 0, out: top.out, depth: top.depth });
      } else {
        const children: TreeNode[] = [];
        top.out.push({ type: node.type, children });
        stack.push({ src: node.children, i: 0, out: children, depth: top.depth + 1 });
      }
    } else if (node.type === 'link') {
      const children: TreeNode[] = [];
      top.out.push(
        node.unsafe
          ? { type: 'link', href: node.href, children, unsafe: true }
          : { type: 'link', href: node.href, children },
      );
      stack.push({ src: node.children, i: 0, out: children, depth: top.depth + 1 });
    } else {
      pushNode(top.out, node);
    }
  }
  return root;
}

// ---------------------------------------------------------------------------
// Where a sentence starts
// ---------------------------------------------------------------------------

/** Abbreviations whose full stop does not end a sentence ("e.g. the replica"). */
const ABBREVIATION = /(?:^|[^a-z])(?:e\.g|i\.e|vs|etc|approx|incl|no|fig|cf|ca)\.\s+$/i;
const NOT_YET_TEXT = /[^\s"'“‘([{<«]/;
const WINDOW = 24;

/**
 * Whether a marker that follows `tail` (the last characters of the visible text before it) opens a
 * sentence: it is the first thing in the text, or it follows a newline, or a stop, a question mark or an
 * exclamation mark and a space. `started` says whether anything but spaces and opening marks came first.
 */
export function opensSentence(tail: string, started: boolean): boolean {
  if (!started) return true;
  if (/\n\s*$/.test(tail)) return true;
  if (!/[.!?][)"'”’\]]*\s+$/.test(tail)) return false;
  return !ABBREVIATION.test(tail);
}

/** Sets `start` on every term node, in document order. Linear. */
function markSentenceStarts(nodes: TreeNode[]): void {
  let tail = '';
  let started = false;
  const see = (text: string): void => {
    if (text === '') return;
    if (!started && NOT_YET_TEXT.test(text)) started = true;
    tail = text.length >= WINDOW ? text.slice(-WINDOW) : (tail + text).slice(-WINDOW);
  };
  const walk = (list: TreeNode[]): void => {
    for (const node of list) {
      switch (node.type) {
        case 'text':
        case 'code':
          see(node.text);
          break;
        case 'strong':
        case 'em':
        case 'link':
          walk(node.children);
          break;
        case 'term':
          node.start = opensSentence(tail, started);
          see('x');
          break;
        default:
          // A lesson or lab link, or a key: something is on the line, whatever it says.
          see('x');
      }
    }
  };
  walk(nodes);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parses inline markup into the core tree (text, strong, em, code, link and token nodes) and the
 * problems found on the way. Total: any string returns a result, never throws, and never contains markup
 * of its own.
 */
export function parseTree(src: string, opts: ParseTreeOptions = {}): ParsedTree {
  const problems: MarkupProblem[] = [];
  if (typeof src !== 'string' || src === '') return { nodes: [], problems };
  const ctx: Ctx = {
    problems: opts.report === false ? null : problems,
    base: 0,
    keepUnsafe: opts.keepUnsafe === true,
  };
  const nodes = capDepth(parseInline(src, true, ctx));
  markSentenceStarts(nodes);
  problems.sort((a, b) => a.at - b.at);
  return { nodes, problems };
}

function plainOfTree(nodes: readonly TreeNode[]): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text' || n.type === 'code') out += n.text;
    else if (n.type === 'strong' || n.type === 'em' || n.type === 'link') out += plainOfTree(n.children);
  }
  return out;
}

function toLesson(nodes: readonly TreeNode[]): MarkupNode[] {
  return nodes.map((n): MarkupNode => {
    switch (n.type) {
      case 'strong':
        return { type: 'bold', children: toLesson(n.children) };
      case 'em':
        return { type: 'italic', children: toLesson(n.children) };
      case 'link': {
        const link: MarkupNode = {
          type: 'link',
          label: plainOfTree(n.children),
          href: n.href,
          children: toLesson(n.children),
        };
        if (n.unsafe) link.unsafe = true;
        return link;
      }
      case 'kbd':
        return { type: 'kbd', keys: n.combo.split('+').filter(Boolean), combo: n.combo };
      default:
        return n;
    }
  });
}

/** Parse a markup string in the lesson shape. Never throws. */
export function parseMarkup(src: string): ParsedMarkup {
  const { nodes, problems } = parseTree(src, { keepUnsafe: true });
  return { nodes: toLesson(nodes), problems };
}

// ---------------------------------------------------------------------------
// Walking and statistics
// ---------------------------------------------------------------------------

/** Visit every node depth first. */
export function walkMarkup(nodes: MarkupNode[], visit: (node: MarkupNode) => void): void {
  for (const n of nodes) {
    visit(n);
    if (n.type === 'bold' || n.type === 'italic') walkMarkup(n.children, visit);
    else if (n.type === 'link' && n.children) walkMarkup(n.children, visit);
  }
}

export interface MarkupRefs {
  terms: string[];
  lessons: string[];
  labs: string[];
  links: { label: string; href: string }[];
}

/** Every reference a string makes: glossary terms, lessons, labs and external links. */
export function markupRefs(src: string): MarkupRefs {
  const refs: MarkupRefs = { terms: [], lessons: [], labs: [], links: [] };
  walkMarkup(parseMarkup(src).nodes, (n) => {
    if (n.type === 'term') refs.terms.push(n.id);
    else if (n.type === 'lesson') refs.lessons.push(n.id);
    else if (n.type === 'lab') refs.labs.push(n.id);
    else if (n.type === 'link') refs.links.push({ label: n.label, href: n.href });
  });
  return refs;
}

// ---------------------------------------------------------------------------
// Term names
// ---------------------------------------------------------------------------

/** What `termText` needs to know about a glossary entry. */
export interface TermName {
  /** The display name: "Instance", "FluxNode", "port fee". */
  term: string;
  /** A proper noun or a name with a deliberate capital: shown as written wherever it stands. */
  proper?: boolean;
}

/** Looks a glossary id up. The app passes `getTerm`; a test passes a map. */
export type TermResolver = (id: string) => TermName | undefined;

export interface TermTextOptions {
  proper?: boolean;
  /** The marker opens a sentence (`TreeNode.start`). */
  start?: boolean;
  /** The text is a heading: names stay as written. */
  heading?: boolean;
  /** An explicit `|lower` or `|Cap` from the author. */
  case?: TermCase;
}

/** A capital, a lower-case letter, then no more capitals: "Instance", "Eligible node", not "FDM", "ZelID". */
const PLAIN_CAPITAL = /^\p{Lu}\p{Ll}[^\p{Lu}]*$/u;
/** The first word has a second capital: an acronym or a camel-cased name. */
const SPLIT_WORD = /^\p{Lu}[\p{L}\p{N}_]*\p{Lu}/u;

function upperFirst(s: string): string {
  const first = String.fromCodePoint(s.codePointAt(0) as number);
  return first.toUpperCase() + s.slice(first.length);
}

function lowerFirst(s: string): string {
  const first = String.fromCodePoint(s.codePointAt(0) as number);
  return first.toLowerCase() + s.slice(first.length);
}

/**
 * The words to show for a term's name at a place in a sentence.
 *
 *  - `|Cap` makes the first letter a capital; `|lower` makes it lower case (and leaves an acronym or a
 *    camel-cased name such as FDM or ZelID alone, where it would only break the word).
 *  - A proper noun or a name with a deliberate capital (`proper`), the start of a sentence and a heading
 *    show the name as written.
 *  - Anywhere else a name that is a capital followed only by lower case ("Instance", "Eligible node") is
 *    lowered, so prose reads "your only instance". A name with more capitals ("Internal DNS") is a name:
 *    it stays.
 */
export function termText(name: string, opts: TermTextOptions = {}): string {
  if (name === '') return name;
  if (opts.case === 'cap') return upperFirst(name);
  if (opts.case === 'lower') return SPLIT_WORD.test(name) ? name : lowerFirst(name);
  if (opts.proper || opts.start || opts.heading) return name;
  return PLAIN_CAPITAL.test(name) ? lowerFirst(name) : name;
}

/** The words of an id when no glossary is at hand: `eligible-node` is "eligible node". */
export function idWords(id: string): string {
  return id.replace(/[-_]+/g, ' ');
}

function plainOfLesson(nodes: readonly MarkupNode[], resolve: TermResolver | undefined): string {
  let out = '';
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
      case 'code':
        out += n.text;
        break;
      case 'bold':
      case 'italic':
        out += plainOfLesson(n.children, resolve);
        break;
      case 'link':
        out += n.label;
        break;
      case 'term': {
        const entry = resolve?.(n.id);
        if (entry) {
          out += termText(entry.term, { proper: entry.proper, start: n.start, case: n.case });
        } else {
          const words = idWords(n.id);
          out += n.case === 'cap' ? upperFirst(words) : words;
        }
        break;
      }
      case 'lesson':
      case 'lab':
        out += idWords(n.id);
        break;
      case 'kbd':
        out += n.keys.join('+');
        break;
    }
  }
  return out;
}

/**
 * The text a reader would read, with code spans kept and directives collapsed to one word each. Used for
 * word and sentence counts, aria-labels and the deck's search text. Pass `resolve` and a term reads as
 * its display name (with the same case rules as the renderers); without it, as the words of its id.
 * The design system's `stripMarkup` is this function.
 */
export function plainText(src: string, resolve?: TermResolver): string {
  return plainOfLesson(parseMarkup(src).nodes, resolve);
}

/** Words in the rendered text. A token needs a letter or digit to count. */
export function countWords(src: string): number {
  return plainText(src)
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const ABBREVIATIONS = /\b(e\.g|i\.e|vs|etc|approx|incl|no|fig)\./gi;

/** Sentences in the rendered text (a stop followed by space and a capital, digit or opening mark). */
export function countSentences(src: string): number {
  const text = plainText(src).replace(ABBREVIATIONS, (m) => m.replace(/\./g, ''));
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'({[])/).filter((p) => /[\p{L}\p{N}]/u.test(p));
  return parts.length;
}

/**
 * Text with code spans and link targets removed. Used to look for characters that are fine inside code
 * (an exclamation mark in `!=`) but not in prose.
 */
export function proseOnly(src: string): string {
  const out: string[] = [];
  const visit = (nodes: MarkupNode[]) => {
    for (const n of nodes) {
      if (n.type === 'text') out.push(n.text);
      else if (n.type === 'bold' || n.type === 'italic') visit(n.children);
      else if (n.type === 'link') out.push(n.label);
    }
  };
  visit(parseMarkup(src).nodes);
  return out.join('');
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/**
 * A `{{kbd:...}}` combination as the keycap component reads it: `cmd`, `command` and `meta` mean the
 * platform's own key (`mod`), and `plus` is the plus key.
 */
export function comboFor(raw: string): string {
  return raw
    .split(/(\s+)/)
    .map((step) =>
      step
        .split('+')
        .map((k) => (/^(?:cmd|command|meta)$/i.test(k) ? 'mod' : /^plus$/i.test(k) ? 'plus' : k))
        .join('+'),
    )
    .join('');
}
