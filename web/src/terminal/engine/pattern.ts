/**
 * A small backtracking regular expression engine with a step budget.
 *
 * Why: a script's `match` is an author's regular expression and the input is whatever the learner
 * types. JavaScript cannot interrupt `RegExp.exec`, so a pattern like `(a+)+$` on `aaaa...!` can
 * freeze the tab. This engine runs the common subset with the same semantics as the native one
 * (leftmost, greedy or lazy, ordered alternation, captures) and counts every step: when the budget
 * is spent the match fails closed. It is deterministic, so tests can assert that a catastrophic
 * pattern is stopped without any timing.
 *
 * Supported: literals, `.`, classes (ranges, negation, `\d \w \s` and friends), `^ $ \b \B`,
 * groups (capturing, `(?:)`, named `(?<n>)` as plain captures), lookahead `(?= )` and `(?! )`,
 * alternation, `* + ? {n} {n,} {n,m}` with lazy variants, and the usual escapes.
 *
 * Not supported (the parser says so and the caller falls back to the native engine behind a
 * static check): backreferences, lookbehind, `\p{..}`, `\u{..}`, `\c`.
 */

type Test = (c: string) => boolean;

type Node =
  | { t: 'char'; c: string }
  | { t: 'any' }
  | { t: 'set'; test: Test }
  | { t: 'bol' }
  | { t: 'eol' }
  | { t: 'wb'; neg: boolean }
  | { t: 'group'; idx: number; alts: Node[][] }
  | { t: 'look'; neg: boolean; alts: Node[][] }
  | { t: 'rep'; min: number; max: number; greedy: boolean; node: Node };

export class UnsupportedPattern extends Error {}

const isWordChar: Test = (c) => /\w/.test(c);
const isDigit: Test = (c) => c >= '0' && c <= '9';
const isSpace: Test = (c) => /\s/.test(c);
const isLineTerminator = (c: string): boolean => c === '\n' || c === '\r' || c === ' ' || c === ' ';
const not =
  (t: Test): Test =>
  (c) =>
    !t(c);

const CLASS_ESCAPES: Record<string, Test> = {
  d: isDigit,
  D: not(isDigit),
  w: isWordChar,
  W: not(isWordChar),
  s: isSpace,
  S: not(isSpace),
};

const CHAR_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', f: '\f', v: '\v', '0': '\0' };

class Parser {
  p = 0;
  groups = 0;
  constructor(private readonly src: string) {}

  parse(): { alts: Node[][]; groups: number } {
    const alts = this.alternation();
    if (this.p < this.src.length) throw new UnsupportedPattern('unmatched )');
    return { alts, groups: this.groups };
  }

  private alternation(): Node[][] {
    const alts: Node[][] = [this.sequence()];
    while (this.src[this.p] === '|') {
      this.p += 1;
      alts.push(this.sequence());
    }
    return alts;
  }

  private sequence(): Node[] {
    const seq: Node[] = [];
    while (this.p < this.src.length) {
      const c = this.src[this.p] as string;
      if (c === '|' || c === ')') break;
      let atom = this.atom();
      const q = this.quantifier();
      if (q) {
        if (atom.t === 'bol' || atom.t === 'eol' || atom.t === 'wb')
          throw new UnsupportedPattern('nothing to repeat');
        atom = { t: 'rep', min: q.min, max: q.max, greedy: q.greedy, node: atom };
      }
      seq.push(atom);
    }
    return seq;
  }

  private quantifier(): { min: number; max: number; greedy: boolean } | null {
    const c = this.src[this.p];
    let min: number;
    let max: number;
    if (c === '*') {
      min = 0;
      max = Number.POSITIVE_INFINITY;
      this.p += 1;
    } else if (c === '+') {
      min = 1;
      max = Number.POSITIVE_INFINITY;
      this.p += 1;
    } else if (c === '?') {
      min = 0;
      max = 1;
      this.p += 1;
    } else if (c === '{') {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(this.src.slice(this.p));
      if (!m) return null;
      min = Number(m[1]);
      max =
        m[2] === undefined
          ? min
          : m[3] === '' || m[3] === undefined
            ? Number.POSITIVE_INFINITY
            : Number(m[3]);
      if (max < min) throw new UnsupportedPattern('numbers out of order in {} quantifier');
      this.p += m[0].length;
    } else {
      return null;
    }
    let greedy = true;
    if (this.src[this.p] === '?') {
      greedy = false;
      this.p += 1;
    }
    return { min, max, greedy };
  }

  private atom(): Node {
    const c = this.src[this.p] as string;
    switch (c) {
      case '(':
        return this.group();
      case '[':
        return this.charClass();
      case '.':
        this.p += 1;
        return { t: 'any' };
      case '^':
        this.p += 1;
        return { t: 'bol' };
      case '$':
        this.p += 1;
        return { t: 'eol' };
      case '\\':
        return this.escape();
      case '*':
      case '+':
      case '?':
        throw new UnsupportedPattern('nothing to repeat');
      case '{': {
        // A `{` that is not a quantifier is a literal in non-unicode mode.
        this.p += 1;
        return { t: 'char', c };
      }
      default:
        this.p += 1;
        return { t: 'char', c };
    }
  }

  private group(): Node {
    this.p += 1; // (
    let idx = -1;
    let look: 'pos' | 'neg' | null = null;
    if (this.src[this.p] === '?') {
      const rest = this.src.slice(this.p + 1, this.p + 3);
      if (rest.startsWith(':')) {
        this.p += 2;
      } else if (rest.startsWith('=')) {
        look = 'pos';
        this.p += 2;
      } else if (rest.startsWith('!')) {
        look = 'neg';
        this.p += 2;
      } else if (rest.startsWith('<') && rest[1] !== '=' && rest[1] !== '!') {
        const end = this.src.indexOf('>', this.p);
        if (end < 0) throw new UnsupportedPattern('invalid group name');
        this.p = end + 1;
        this.groups += 1;
        idx = this.groups;
      } else {
        throw new UnsupportedPattern('lookbehind');
      }
    } else {
      this.groups += 1;
      idx = this.groups;
    }
    const alts = this.alternation();
    if (this.src[this.p] !== ')') throw new UnsupportedPattern('unterminated group');
    this.p += 1;
    if (look) return { t: 'look', neg: look === 'neg', alts };
    return { t: 'group', idx, alts };
  }

  private escape(): Node {
    this.p += 1; // backslash
    const c = this.src[this.p];
    if (c === undefined) throw new UnsupportedPattern('\\ at end of pattern');
    this.p += 1;
    if (c === 'b') return { t: 'wb', neg: false };
    if (c === 'B') return { t: 'wb', neg: true };
    const cls = CLASS_ESCAPES[c];
    if (cls) return { t: 'set', test: cls };
    if (c >= '1' && c <= '9') throw new UnsupportedPattern('backreference');
    if (c === 'k' || c === 'p' || c === 'P' || c === 'c') throw new UnsupportedPattern(`\\${c}`);
    return { t: 'char', c: this.escapedChar(c) };
  }

  /** The character an escape stands for. `c` is the char after the backslash, already consumed. */
  private escapedChar(c: string): string {
    const simple = CHAR_ESCAPES[c];
    if (simple !== undefined && c !== '0') return simple;
    if (c === '0') return '\0';
    if (c === 'x') {
      const hex = this.src.slice(this.p, this.p + 2);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        this.p += 2;
        return String.fromCharCode(Number.parseInt(hex, 16));
      }
      return 'x';
    }
    if (c === 'u') {
      if (this.src[this.p] === '{') throw new UnsupportedPattern('\\u{}');
      const hex = this.src.slice(this.p, this.p + 4);
      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
        this.p += 4;
        return String.fromCharCode(Number.parseInt(hex, 16));
      }
      return 'u';
    }
    return c;
  }

  private charClass(): Node {
    this.p += 1; // [
    let neg = false;
    if (this.src[this.p] === '^') {
      neg = true;
      this.p += 1;
    }
    const singles = new Set<string>();
    const ranges: [string, string][] = [];
    const tests: Test[] = [];
    for (;;) {
      const c = this.src[this.p];
      if (c === undefined) throw new UnsupportedPattern('unterminated character class');
      if (c === ']') {
        // In JavaScript `[]` is an empty class (matches nothing) and `[^]` matches anything.
        this.p += 1;
        break;
      }
      const lo = this.classAtom(tests);
      if (lo === null) continue;
      if (this.src[this.p] === '-' && this.src[this.p + 1] !== ']' && this.src[this.p + 1] !== undefined) {
        const save = this.p;
        this.p += 1;
        const hi = this.classAtom(tests);
        if (hi === null) {
          // `[a-\d]`: the dash is literal.
          this.p = save;
          singles.add(lo);
        } else if (hi < lo) {
          throw new UnsupportedPattern('range out of order');
        } else {
          ranges.push([lo, hi]);
        }
      } else {
        singles.add(lo);
      }
    }
    const test: Test = (ch) => {
      let hit = singles.has(ch);
      if (!hit) for (const [lo, hi] of ranges) if (ch >= lo && ch <= hi) hit = true;
      if (!hit) for (const t of tests) if (t(ch)) hit = true;
      return hit !== neg;
    };
    return { t: 'set', test };
  }

  /** One class member. Returns a single char, or null when it was a class escape (pushed to `tests`). */
  private classAtom(tests: Test[]): string | null {
    const c = this.src[this.p] as string;
    this.p += 1;
    if (c !== '\\') return c;
    const e = this.src[this.p];
    if (e === undefined) throw new UnsupportedPattern('\\ at end of pattern');
    this.p += 1;
    const cls = CLASS_ESCAPES[e];
    if (cls) {
      tests.push(cls);
      return null;
    }
    if (e === 'b') return '\b';
    if (e === 'p' || e === 'P' || e === 'k' || e === 'c') throw new UnsupportedPattern(`\\${e}`);
    return this.escapedChar(e);
  }
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const BUDGET = Symbol('budget');

export interface PatternMatch {
  /** `0` is the whole match; undefined groups did not participate. */
  groups: (string | undefined)[];
  index: number;
}

export class Pattern {
  private readonly alts: Node[][];
  private readonly groupCount: number;
  /** Every alternative starts with `^`, so only position 0 can match. */
  private readonly startOnly: boolean;

  /** Throws `UnsupportedPattern` when the source uses something this engine does not do. */
  constructor(readonly source: string) {
    const { alts, groups } = new Parser(source).parse();
    this.alts = alts;
    this.groupCount = groups;
    this.startOnly = alts.every((seq) => seq[0]?.t === 'bol');
  }

  /**
   * Search `input` like `RegExp.prototype.exec`. `exhausted` is true when the step budget ran out
   * (the result is then null: fail closed).
   */
  exec(input: string, budget = 200_000): { match: PatternMatch | null; exhausted: boolean; steps: number } {
    const n = input.length;
    let steps = 0;
    const caps: ([number, number] | undefined)[] = new Array(this.groupCount + 1);

    const tick = () => {
      steps += 1;
      if (steps > budget) throw BUDGET;
    };

    const matchAlts = (alts: Node[][], i: number, k: (j: number) => boolean): boolean => {
      for (const seq of alts) if (matchSeq(seq, 0, i, k)) return true;
      return false;
    };

    const matchSeq = (seq: Node[], idx: number, i: number, k: (j: number) => boolean): boolean => {
      if (idx === seq.length) return k(i);
      return matchNode(seq[idx] as Node, i, (j) => matchSeq(seq, idx + 1, j, k));
    };

    const matchNode = (node: Node, i: number, k: (j: number) => boolean): boolean => {
      tick();
      switch (node.t) {
        case 'char':
          return i < n && input[i] === node.c ? k(i + 1) : false;
        case 'any':
          return i < n && !isLineTerminator(input[i] as string) ? k(i + 1) : false;
        case 'set':
          return i < n && node.test(input[i] as string) ? k(i + 1) : false;
        case 'bol':
          return i === 0 ? k(i) : false;
        case 'eol':
          return i === n ? k(i) : false;
        case 'wb': {
          const before = i > 0 && isWordChar(input[i - 1] as string);
          const after = i < n && isWordChar(input[i] as string);
          return (before !== after) !== node.neg ? k(i) : false;
        }
        case 'group': {
          if (node.idx < 0) return matchAlts(node.alts, i, k);
          const idx = node.idx;
          return matchAlts(node.alts, i, (j) => {
            const prev = caps[idx];
            caps[idx] = [i, j];
            if (k(j)) return true;
            caps[idx] = prev;
            return false;
          });
        }
        case 'look': {
          const saved = caps.slice();
          const ok = matchAlts(node.alts, i, () => true);
          if (node.neg) {
            for (let g = 0; g < caps.length; g += 1) caps[g] = saved[g];
            return !ok && k(i);
          }
          if (!ok) return false;
          if (k(i)) return true;
          for (let g = 0; g < caps.length; g += 1) caps[g] = saved[g];
          return false;
        }
        case 'rep': {
          const { min, max, greedy } = node;
          const loop = (count: number, at: number): boolean => {
            tick();
            const more = (): boolean => {
              if (count >= max) return false;
              return matchNode(node.node, at, (j) => {
                if (j === at && count >= min) return false;
                return loop(count + 1, j);
              });
            };
            if (count < min) return more();
            return greedy ? more() || k(at) : k(at) || more();
          };
          return loop(0, i);
        }
      }
    };

    try {
      const last = this.startOnly ? 0 : n;
      for (let start = 0; start <= last; start += 1) {
        caps.fill(undefined);
        let end = -1;
        if (
          matchAlts(this.alts, start, (j) => {
            end = j;
            return true;
          })
        ) {
          const groups: (string | undefined)[] = [input.slice(start, end)];
          for (let g = 1; g <= this.groupCount; g += 1) {
            const c = caps[g];
            groups.push(c ? input.slice(c[0], c[1]) : undefined);
          }
          return { match: { groups, index: start }, exhausted: false, steps };
        }
      }
      return { match: null, exhausted: false, steps };
    } catch (e) {
      if (e === BUDGET) return { match: null, exhausted: true, steps };
      throw e;
    }
  }
}
