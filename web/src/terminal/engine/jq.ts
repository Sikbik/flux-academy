/**
 * A small `jq`: enough to read the Flux API's JSON the way people do on a command line.
 *
 * Paths (`.data.compose[0].name`, `.data[]`, `."odd-key"`, `.[1:3]`, `.a?`), pipes, commas, array
 * and object construction, comparison, `and` `or` `not`, and the common functions: length, keys,
 * values, type, first, last, add, reverse, sort, unique, min, max, tostring, tonumber,
 * ascii_downcase, ascii_upcase, join, map, select, has, contains, startswith, endswith, empty,
 * to_entries.
 *
 * Anything else raises `JqError` with an honest message: this is a simulation, not the real tool.
 */

export class JqError extends Error {
  /** `compile` errors print jq's compile banner, `runtime` errors print the `(at <stdin>:N)` form. */
  constructor(
    message: string,
    readonly phase: 'compile' | 'runtime' = 'runtime',
  ) {
    super(message);
  }
}

type Node =
  | { t: 'identity' }
  | { t: 'field'; name: string; optional: boolean }
  | { t: 'index'; index: Node; optional: boolean }
  | { t: 'slice'; from: Node | null; to: Node | null; optional: boolean }
  | { t: 'iterate'; optional: boolean }
  | { t: 'pipe'; left: Node; right: Node }
  | { t: 'comma'; left: Node; right: Node }
  | { t: 'literal'; value: unknown }
  | { t: 'array'; body: Node | null }
  | { t: 'object'; entries: { key: Node; value: Node }[] }
  | { t: 'binary'; op: string; left: Node; right: Node }
  | { t: 'not'; arg: Node }
  | { t: 'try'; body: Node }
  | { t: 'call'; name: string; args: Node[] };

type Tok =
  | { k: 'op'; v: string }
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'id'; v: string }
  | { k: 'field'; v: string };

const FUNCTIONS: Record<string, number> = {
  length: 0,
  keys: 0,
  values: 0,
  type: 0,
  first: 0,
  last: 0,
  add: 0,
  reverse: 0,
  sort: 0,
  unique: 0,
  min: 0,
  max: 0,
  tostring: 0,
  tonumber: 0,
  ascii_downcase: 0,
  ascii_upcase: 0,
  not: 0,
  empty: 0,
  to_entries: 0,
  join: 1,
  map: 1,
  select: 1,
  has: 1,
  contains: 1,
  startswith: 1,
  endswith: 1,
};

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i] as string;
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let raw = '"';
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\') {
          raw += src.slice(j, j + 2);
          j += 2;
        } else {
          raw += src[j];
          j += 1;
        }
      }
      if (j >= n) throw new JqError('syntax error, unterminated string literal', 'compile');
      raw += '"';
      try {
        toks.push({ k: 'str', v: JSON.parse(raw) as string });
      } catch {
        throw new JqError('syntax error, invalid string literal', 'compile');
      }
      i = j + 1;
      continue;
    }
    if (c === '.') {
      if (src[i + 1] === '.') {
        toks.push({ k: 'op', v: '..' });
        i += 2;
        continue;
      }
      const m = /^\.([A-Za-z_][A-Za-z0-9_]*)/.exec(src.slice(i));
      if (m) {
        toks.push({ k: 'field', v: m[1] as string });
        i += m[0].length;
        continue;
      }
      toks.push({ k: 'op', v: '.' });
      i += 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      const m = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(i)) as RegExpExecArray;
      toks.push({ k: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i)) as RegExpExecArray;
      toks.push({ k: 'id', v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '//'].includes(two)) {
      toks.push({ k: 'op', v: two });
      i += 2;
      continue;
    }
    if ('|,()[]{}:?<>+-*/%;'.includes(c)) {
      toks.push({ k: 'op', v: c });
      i += 1;
      continue;
    }
    throw new JqError(`syntax error, unexpected INVALID_CHARACTER (Unix shell quoting issues?)`, 'compile');
  }
  return toks;
}

class Parser {
  private p = 0;
  constructor(private readonly toks: Tok[]) {}

  parse(): Node {
    if (this.toks.length === 0) return { t: 'identity' };
    const node = this.pipe();
    if (this.p < this.toks.length) throw this.unexpected();
    return node;
  }

  private peek(): Tok | undefined {
    return this.toks[this.p];
  }

  private isOp(v: string): boolean {
    const t = this.peek();
    return t?.k === 'op' && t.v === v;
  }

  private eat(v: string): void {
    if (!this.isOp(v)) throw this.unexpected();
    this.p += 1;
  }

  private unexpected(): JqError {
    const t = this.peek();
    const what = t ? (t.k === 'op' ? `'${t.v}'` : String(t.v)) : 'end of file';
    return new JqError(`syntax error, unexpected ${what}`, 'compile');
  }

  private pipe(): Node {
    let left = this.comma();
    while (this.isOp('|')) {
      this.p += 1;
      left = { t: 'pipe', left, right: this.comma() };
    }
    return left;
  }

  private comma(): Node {
    let left = this.logical();
    while (this.isOp(',')) {
      this.p += 1;
      left = { t: 'comma', left, right: this.logical() };
    }
    return left;
  }

  private logical(): Node {
    let left = this.compare();
    for (;;) {
      const t = this.peek();
      if (t?.k === 'id' && (t.v === 'and' || t.v === 'or')) {
        this.p += 1;
        left = { t: 'binary', op: t.v, left, right: this.compare() };
      } else if (this.isOp('//')) {
        this.p += 1;
        left = { t: 'binary', op: '//', left, right: this.compare() };
      } else break;
    }
    return left;
  }

  private compare(): Node {
    const left = this.additive();
    const t = this.peek();
    if (t?.k === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(t.v)) {
      this.p += 1;
      return { t: 'binary', op: t.v, left, right: this.additive() };
    }
    return left;
  }

  private additive(): Node {
    let left = this.postfix();
    for (;;) {
      const t = this.peek();
      if (t?.k === 'op' && (t.v === '+' || t.v === '-')) {
        this.p += 1;
        left = { t: 'binary', op: t.v, left, right: this.postfix() };
      } else break;
    }
    return left;
  }

  private postfix(): Node {
    let node = this.primary();
    for (;;) {
      const t = this.peek();
      if (t?.k === 'field') {
        this.p += 1;
        node = { t: 'pipe', left: node, right: { t: 'field', name: t.v, optional: this.optional() } };
      } else if (this.isOp('.') && this.toks[this.p + 1]?.k === 'str') {
        this.p += 1;
        const s = this.toks[this.p] as { k: 'str'; v: string };
        this.p += 1;
        node = { t: 'pipe', left: node, right: { t: 'field', name: s.v, optional: this.optional() } };
      } else if (this.isOp('[')) {
        node = { t: 'pipe', left: node, right: this.bracket() };
      } else if (
        this.isOp('.') &&
        this.toks[this.p + 1]?.k === 'op' &&
        (this.toks[this.p + 1] as { v: string }).v === '['
      ) {
        this.p += 1;
        node = { t: 'pipe', left: node, right: this.bracket() };
      } else if (this.isOp('?')) {
        this.p += 1;
        node = { t: 'try', body: node };
      } else break;
    }
    return node;
  }

  private optional(): boolean {
    if (this.isOp('?')) {
      this.p += 1;
      return true;
    }
    return false;
  }

  private bracket(): Node {
    this.eat('[');
    if (this.isOp(']')) {
      this.p += 1;
      return { t: 'iterate', optional: this.optional() };
    }
    let from: Node | null = null;
    if (!this.isOp(':')) from = this.pipe();
    if (this.isOp(':')) {
      this.p += 1;
      let to: Node | null = null;
      if (!this.isOp(']')) to = this.pipe();
      this.eat(']');
      return { t: 'slice', from, to, optional: this.optional() };
    }
    this.eat(']');
    return { t: 'index', index: from as Node, optional: this.optional() };
  }

  private primary(): Node {
    const t = this.peek();
    if (!t) throw this.unexpected();
    if (t.k === 'field') {
      this.p += 1;
      return { t: 'field', name: t.v, optional: this.optional() };
    }
    if (t.k === 'op' && t.v === '.') {
      this.p += 1;
      const nx = this.peek();
      if (nx?.k === 'str') {
        this.p += 1;
        return { t: 'field', name: nx.v, optional: this.optional() };
      }
      if (nx?.k === 'op' && nx.v === '[') return this.bracket();
      return { t: 'identity' };
    }
    if (t.k === 'op' && t.v === '..') {
      this.p += 1;
      return { t: 'call', name: 'recurse', args: [] };
    }
    if (t.k === 'op' && t.v === '[') {
      this.p += 1;
      if (this.isOp(']')) {
        this.p += 1;
        return { t: 'array', body: null };
      }
      const body = this.pipe();
      this.eat(']');
      return { t: 'array', body };
    }
    if (t.k === 'op' && t.v === '{') return this.object();
    if (t.k === 'op' && t.v === '(') {
      this.p += 1;
      const inner = this.pipe();
      this.eat(')');
      return inner;
    }
    if (t.k === 'op' && t.v === '-') {
      this.p += 1;
      const arg = this.postfix();
      return { t: 'binary', op: '-', left: { t: 'literal', value: 0 }, right: arg };
    }
    if (t.k === 'num') {
      this.p += 1;
      return { t: 'literal', value: t.v };
    }
    if (t.k === 'str') {
      this.p += 1;
      return { t: 'literal', value: t.v };
    }
    if (t.k === 'id') {
      this.p += 1;
      if (t.v === 'true') return { t: 'literal', value: true };
      if (t.v === 'false') return { t: 'literal', value: false };
      if (t.v === 'null') return { t: 'literal', value: null };
      if (t.v === 'not') return { t: 'not', arg: { t: 'identity' } };
      if (!(t.v in FUNCTIONS)) {
        throw new JqError(`${t.v}/0 is not defined`, 'compile');
      }
      const arity = FUNCTIONS[t.v] as number;
      const args: Node[] = [];
      if (arity > 0) {
        this.eat('(');
        args.push(this.pipe());
        while (this.isOp(';')) {
          this.p += 1;
          args.push(this.pipe());
        }
        this.eat(')');
        if (args.length !== arity) throw new JqError(`${t.v}/${args.length} is not defined`, 'compile');
      } else if (this.isOp('(')) {
        throw new JqError(`${t.v}/1 is not defined`, 'compile');
      }
      return { t: 'call', name: t.v, args };
    }
    throw this.unexpected();
  }

  private object(): Node {
    this.eat('{');
    const entries: { key: Node; value: Node }[] = [];
    if (this.isOp('}')) {
      this.p += 1;
      return { t: 'object', entries };
    }
    for (;;) {
      const t = this.peek();
      let key: Node;
      let shorthand: string | null = null;
      if (t?.k === 'id' || t?.k === 'str') {
        this.p += 1;
        key = { t: 'literal', value: t.v };
        shorthand = t.v;
      } else if (t?.k === 'op' && t.v === '(') {
        this.p += 1;
        key = this.pipe();
        this.eat(')');
      } else {
        throw this.unexpected();
      }
      let value: Node;
      if (this.isOp(':')) {
        this.p += 1;
        value = this.logical();
      } else if (shorthand !== null) {
        value = { t: 'field', name: shorthand, optional: false };
      } else {
        throw this.unexpected();
      }
      entries.push({ key, value });
      if (this.isOp(',')) {
        this.p += 1;
        continue;
      }
      break;
    }
    this.eat('}');
    return { t: 'object', entries };
  }
}

export function compileJq(filter: string): Node {
  return new Parser(lex(filter)).parse();
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'number') return 'number';
  return 'boolean';
}

function describe(v: unknown): string {
  const text = JSON.stringify(v) ?? 'null';
  return `${typeOf(v)} (${text.length > 11 ? `${text.slice(0, 10)}...` : text})`;
}

function truthy(v: unknown): boolean {
  return v !== null && v !== false;
}

function compareValues(a: unknown, b: unknown): number {
  const order = ['null', 'boolean', 'number', 'string', 'array', 'object'];
  const ta = typeOf(a);
  const tb = typeOf(b);
  if (ta !== tb) return order.indexOf(ta) - order.indexOf(tb);
  if (ta === 'number') return (a as number) - (b as number);
  if (ta === 'string') return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
  if (ta === 'boolean') return Number(a) - Number(b);
  return JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function* evalNode(node: Node, input: unknown, budget: { n: number }): Generator<unknown> {
  budget.n -= 1;
  if (budget.n < 0) throw new JqError('evaluation budget exceeded in the sandbox');
  switch (node.t) {
    case 'identity':
      yield input;
      return;
    case 'field': {
      if (input === null) {
        yield null;
        return;
      }
      if (typeOf(input) !== 'object') {
        if (node.optional) return;
        throw new JqError(`Cannot index ${typeOf(input)} with "${node.name}"`);
      }
      yield (input as Record<string, unknown>)[node.name] ?? null;
      return;
    }
    case 'index': {
      for (const idx of evalNode(node.index, input, budget)) {
        if (typeof idx === 'number' && Array.isArray(input)) {
          const at = idx < 0 ? input.length + idx : idx;
          yield input[Math.trunc(at)] ?? null;
        } else if (typeof idx === 'string' && typeOf(input) === 'object') {
          yield (input as Record<string, unknown>)[idx] ?? null;
        } else if (input === null) {
          yield null;
        } else if (node.optional) {
          // `.[x]?` swallows the error.
        } else {
          throw new JqError(`Cannot index ${typeOf(input)} with ${typeOf(idx)}`);
        }
      }
      return;
    }
    case 'slice': {
      if (typeof input !== 'string' && !Array.isArray(input)) {
        if (input === null) {
          yield null;
          return;
        }
        if (node.optional) return;
        throw new JqError(`Cannot index ${typeOf(input)} with object`);
      }
      const len = input.length;
      const fromV = node.from ? first(evalNode(node.from, input, budget)) : 0;
      const toV = node.to ? first(evalNode(node.to, input, budget)) : len;
      const norm = (x: unknown, dflt: number): number => {
        if (typeof x !== 'number') return dflt;
        const v = x < 0 ? len + x : x;
        return Math.max(0, Math.min(len, Math.trunc(v)));
      };
      yield input.slice(norm(fromV, 0), norm(toV, len));
      return;
    }
    case 'iterate': {
      if (Array.isArray(input)) {
        for (const v of input) yield v;
      } else if (input !== null && typeof input === 'object') {
        for (const v of Object.values(input)) yield v;
      } else if (!node.optional) {
        throw new JqError(`Cannot iterate over ${input === null ? 'null' : describe(input)}`);
      }
      return;
    }
    case 'pipe':
      for (const mid of evalNode(node.left, input, budget)) yield* evalNode(node.right, mid, budget);
      return;
    case 'comma':
      yield* evalNode(node.left, input, budget);
      yield* evalNode(node.right, input, budget);
      return;
    case 'literal':
      yield node.value;
      return;
    case 'array': {
      yield node.body ? Array.from(evalNode(node.body, input, budget)) : [];
      return;
    }
    case 'object': {
      let acc: Record<string, unknown>[] = [{}];
      for (const e of node.entries) {
        const next: Record<string, unknown>[] = [];
        for (const key of evalNode(e.key, input, budget)) {
          if (typeof key !== 'string') throw new JqError(`Object keys must be strings`);
          for (const val of evalNode(e.value, input, budget)) {
            for (const base of acc) next.push({ ...base, [key]: val });
          }
        }
        acc = next;
      }
      yield* acc;
      return;
    }
    case 'not': {
      yield !truthy(input);
      return;
    }
    case 'try': {
      try {
        yield* evalNode(node.body, input, budget);
      } catch (e) {
        if (!(e instanceof JqError)) throw e;
      }
      return;
    }
    case 'binary': {
      if (node.op === 'and' || node.op === 'or') {
        for (const l of evalNode(node.left, input, budget)) {
          if (node.op === 'and' && !truthy(l)) {
            yield false;
            continue;
          }
          if (node.op === 'or' && truthy(l)) {
            yield true;
            continue;
          }
          for (const r of evalNode(node.right, input, budget)) yield truthy(r);
        }
        return;
      }
      if (node.op === '//') {
        let any = false;
        try {
          for (const l of evalNode(node.left, input, budget)) {
            if (truthy(l)) {
              any = true;
              yield l;
            }
          }
        } catch (e) {
          if (!(e instanceof JqError)) throw e;
        }
        if (!any) yield* evalNode(node.right, input, budget);
        return;
      }
      for (const r of evalNode(node.right, input, budget)) {
        for (const l of evalNode(node.left, input, budget)) yield binary(node.op, l, r);
      }
      return;
    }
    case 'call':
      yield* call(node.name, node.args, input, budget);
      return;
  }
}

function first(g: Generator<unknown>): unknown {
  const r = g.next();
  return r.done ? null : r.value;
}

function binary(op: string, l: unknown, r: unknown): unknown {
  switch (op) {
    case '==':
      return deepEqual(l, r);
    case '!=':
      return !deepEqual(l, r);
    case '<':
      return compareValues(l, r) < 0;
    case '<=':
      return compareValues(l, r) <= 0;
    case '>':
      return compareValues(l, r) > 0;
    case '>=':
      return compareValues(l, r) >= 0;
    case '+':
      if (l === null) return r;
      if (r === null) return l;
      if (typeof l === 'number' && typeof r === 'number') return l + r;
      if (typeof l === 'string' && typeof r === 'string') return l + r;
      if (Array.isArray(l) && Array.isArray(r)) return [...l, ...r];
      if (typeOf(l) === 'object' && typeOf(r) === 'object') return { ...(l as object), ...(r as object) };
      throw new JqError(`${describe(l)} and ${describe(r)} cannot be added`);
    case '-':
      if (typeof l === 'number' && typeof r === 'number') return l - r;
      if (Array.isArray(l) && Array.isArray(r)) return l.filter((x) => !r.some((y) => deepEqual(x, y)));
      throw new JqError(`${describe(l)} and ${describe(r)} cannot be subtracted`);
    default:
      throw new JqError(`operator ${op} is not available in the sandbox`);
  }
}

function* call(name: string, args: Node[], input: unknown, budget: { n: number }): Generator<unknown> {
  const arg0 = args[0];
  switch (name) {
    case 'recurse': {
      const walk = function* (v: unknown): Generator<unknown> {
        yield v;
        if (Array.isArray(v)) for (const x of v) yield* walk(x);
        else if (v !== null && typeof v === 'object') for (const x of Object.values(v)) yield* walk(x);
      };
      yield* walk(input);
      return;
    }
    case 'empty':
      return;
    case 'length': {
      if (input === null) yield 0;
      else if (typeof input === 'string' || Array.isArray(input)) yield input.length;
      else if (typeof input === 'number') yield Math.abs(input);
      else if (typeOf(input) === 'object') yield Object.keys(input as object).length;
      else throw new JqError(`${describe(input)} has no length`);
      return;
    }
    case 'keys': {
      if (Array.isArray(input)) yield input.map((_, i) => i);
      else if (typeOf(input) === 'object') yield Object.keys(input as object).sort();
      else throw new JqError(`${describe(input)} has no keys`);
      return;
    }
    case 'values': {
      if (input !== null) yield input;
      return;
    }
    case 'type':
      yield typeOf(input);
      return;
    case 'first':
    case 'last': {
      if (!Array.isArray(input)) throw new JqError(`Cannot index ${typeOf(input)} with number`);
      yield (name === 'first' ? input[0] : input[input.length - 1]) ?? null;
      return;
    }
    case 'add': {
      if (!Array.isArray(input)) throw new JqError(`Cannot iterate over ${describe(input)}`);
      let acc: unknown = null;
      for (const v of input) acc = binary('+', acc, v);
      yield acc;
      return;
    }
    case 'reverse': {
      if (typeof input === 'string') yield Array.from(input).reverse().join('');
      else if (Array.isArray(input)) yield [...input].reverse();
      else if (input === null) yield [];
      else throw new JqError(`Cannot reverse ${describe(input)}`);
      return;
    }
    case 'sort':
    case 'unique': {
      if (!Array.isArray(input))
        throw new JqError(`${describe(input)} cannot be sorted, as it is not an array`);
      const sorted = [...input].sort(compareValues);
      yield name === 'sort' ? sorted : sorted.filter((v, i) => i === 0 || !deepEqual(v, sorted[i - 1]));
      return;
    }
    case 'min':
    case 'max': {
      if (!Array.isArray(input)) throw new JqError(`Cannot iterate over ${describe(input)}`);
      if (input.length === 0) {
        yield null;
        return;
      }
      const sorted = [...input].sort(compareValues);
      yield name === 'min' ? sorted[0] : sorted[sorted.length - 1];
      return;
    }
    case 'tostring':
      yield typeof input === 'string' ? input : JSON.stringify(input);
      return;
    case 'tonumber': {
      if (typeof input === 'number') yield input;
      else if (typeof input === 'string' && input.trim() !== '' && Number.isFinite(Number(input)))
        yield Number(input);
      else throw new JqError(`Cannot be parsed as a number`);
      return;
    }
    case 'ascii_downcase':
    case 'ascii_upcase': {
      if (typeof input !== 'string') throw new JqError(`${name} input must be a string`);
      yield name === 'ascii_downcase' ? input.toLowerCase() : input.toUpperCase();
      return;
    }
    case 'to_entries': {
      if (typeOf(input) !== 'object') throw new JqError(`${describe(input)} has no keys`);
      yield Object.entries(input as Record<string, unknown>).map(([key, value]) => ({ key, value }));
      return;
    }
    case 'join': {
      if (!Array.isArray(input)) throw new JqError(`Cannot iterate over ${describe(input)}`);
      for (const sep of evalNode(arg0 as Node, input, budget)) {
        if (typeof sep !== 'string') throw new JqError('join separator must be a string');
        yield input.map((v) => (v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v))).join(sep);
      }
      return;
    }
    case 'map': {
      if (!Array.isArray(input) && !(input !== null && typeof input === 'object')) {
        throw new JqError(`Cannot iterate over ${describe(input)}`);
      }
      const items = Array.isArray(input) ? input : Object.values(input as object);
      const out: unknown[] = [];
      for (const v of items) for (const r of evalNode(arg0 as Node, v, budget)) out.push(r);
      yield out;
      return;
    }
    case 'select': {
      for (const c of evalNode(arg0 as Node, input, budget)) if (truthy(c)) yield input;
      return;
    }
    case 'has': {
      for (const k of evalNode(arg0 as Node, input, budget)) {
        if (Array.isArray(input) && typeof k === 'number') yield k >= 0 && k < input.length;
        else if (typeOf(input) === 'object' && typeof k === 'string') yield Object.hasOwn(input as object, k);
        else throw new JqError(`Cannot check whether ${typeOf(input)} has a ${typeOf(k)} key`);
      }
      return;
    }
    case 'contains': {
      for (const x of evalNode(arg0 as Node, input, budget)) {
        if (typeof input === 'string' && typeof x === 'string') yield input.includes(x);
        else if (Array.isArray(input) && Array.isArray(x))
          yield x.every((y) => input.some((z) => deepEqual(z, y)));
        else yield deepEqual(input, x);
      }
      return;
    }
    case 'startswith':
    case 'endswith': {
      for (const x of evalNode(arg0 as Node, input, budget)) {
        if (typeof input !== 'string' || typeof x !== 'string') {
          throw new JqError(`${name}() requires string inputs`);
        }
        yield name === 'startswith' ? input.startsWith(x) : input.endsWith(x);
      }
      return;
    }
    default:
      throw new JqError(`${name}/${args.length} is not defined`, 'compile');
  }
}

/** Run a compiled filter against one value. Throws `JqError` at runtime. */
export function runJq(node: Node, input: unknown, budget = 20_000): unknown[] {
  const out: unknown[] = [];
  const b = { n: budget };
  for (const v of evalNode(node, input, b)) {
    out.push(v);
    if (out.length > 2000) throw new JqError('too many results for the sandbox');
  }
  return out;
}
