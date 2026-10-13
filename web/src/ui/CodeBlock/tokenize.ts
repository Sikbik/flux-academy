/**
 * A small, total syntax tokenizer for the code blocks in lessons. No highlighter library.
 *
 *   tokenize(code, 'dockerfile') -> Token[][]    one array of tokens per line
 *
 * Guarantees (tested):
 * - Total: never throws, whatever the input.
 * - Lossless: for every line, the token texts joined equal the line.
 * - Bounded: very large inputs and very long lines skip highlighting (plain tokens).
 *
 * The tokenizers are deliberately forgiving (a snippet in a lesson may be half a file) and
 * line based with a small carried state (block comments, template literals, Dockerfile line
 * continuations, YAML block scalars). They are not parsers.
 */

export type TokenType =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'key'
  | 'fn'
  | 'flag'
  | 'variable'
  | 'type'
  | 'operator'
  | 'punct'
  | 'plain';

export interface Token {
  type: TokenType;
  text: string;
}

export type CodeLang = 'dockerfile' | 'json' | 'js' | 'ts' | 'sh' | 'yaml' | 'text';

export const CODE_LANGS: readonly CodeLang[] = ['dockerfile', 'json', 'js', 'ts', 'sh', 'yaml', 'text'];

/** Display names for the language chip. */
export const LANG_LABEL: Record<CodeLang, string> = {
  dockerfile: 'Dockerfile',
  json: 'JSON',
  js: 'JavaScript',
  ts: 'TypeScript',
  sh: 'Shell',
  yaml: 'YAML',
  text: 'Text',
};

/** Above this many characters nothing is highlighted. */
export const MAX_HIGHLIGHT_CHARS = 200_000;
/** A line longer than this is left plain (minified bundles, base64 blobs). */
export const MAX_HIGHLIGHT_LINE = 2_000;

// ---------------------------------------------------------------------------------------
// Lines and builders
// ---------------------------------------------------------------------------------------

/** Splits on any newline convention; one trailing newline does not make an extra line. */
export function splitLines(code: string): string[] {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

class LineBuilder {
  readonly tokens: Token[] = [];

  push(type: TokenType, text: string): void {
    if (text === '') return;
    const last = this.tokens[this.tokens.length - 1];
    if (last && last.type === type) last.text += text;
    else this.tokens.push({ type, text });
  }
}

function plainLine(line: string): Token[] {
  return line === '' ? [] : [{ type: 'plain', text: line }];
}

function matchAt(re: RegExp, s: string, i: number): string | null {
  re.lastIndex = i;
  const m = re.exec(s);
  return m ? m[0] : null;
}

const isSpace = (c: string | undefined): boolean => c === ' ' || c === '\t';

function isIdStart(code: number): boolean {
  return (
    (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 36 || code > 127
  );
}

function isIdPart(code: number): boolean {
  return isIdStart(code) || (code >= 48 && code <= 57);
}

function readSpaces(line: string, i: number): number {
  let j = i;
  while (j < line.length && isSpace(line[j])) j++;
  return j;
}

/** Index after the closing quote, honouring backslash escapes. Unterminated runs to the end. */
function scanQuoted(line: string, i: number, quote: string): number {
  const n = line.length;
  let j = i + 1;
  while (j < n) {
    const c = line[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === quote) return j + 1;
    j++;
  }
  return n;
}

// ---------------------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------------------

const JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

function jsonLine(line: string, out: LineBuilder): void {
  const n = line.length;
  let i = 0;
  while (i < n) {
    const c = line[i] as string;
    if (isSpace(c)) {
      const j = readSpaces(line, i);
      out.push('plain', line.slice(i, j));
      i = j;
    } else if (c === '"') {
      const end = scanQuoted(line, i, '"');
      const k = readSpaces(line, end);
      const terminated = end <= n && line[end - 1] === '"' && end - i > 1;
      out.push(terminated && line[k] === ':' ? 'key' : 'string', line.slice(i, end));
      i = end;
    } else if (c === '/' && line[i + 1] === '/') {
      out.push('comment', line.slice(i));
      i = n;
    } else if (c === '{' || c === '}' || c === '[' || c === ']' || c === ',' || c === ':') {
      out.push('punct', c);
      i++;
    } else if (c === '-' || (c >= '0' && c <= '9')) {
      const m = matchAt(JSON_NUMBER, line, i);
      if (m) {
        out.push('number', m);
        i += m.length;
      } else {
        out.push('plain', c);
        i++;
      }
    } else if (isIdStart(c.charCodeAt(0))) {
      let j = i + 1;
      while (j < n && isIdPart(line.charCodeAt(j))) j++;
      const word = line.slice(i, j);
      out.push(word === 'true' || word === 'false' || word === 'null' ? 'keyword' : 'plain', word);
      i = j;
    } else {
      out.push('plain', c);
      i++;
    }
  }
}

// ---------------------------------------------------------------------------------------
// JavaScript and TypeScript
// ---------------------------------------------------------------------------------------

const JS_KEYWORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'async',
  'await',
  'static',
  'of',
  'from',
  'as',
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',
]);

const TS_KEYWORDS = new Set([
  'interface',
  'enum',
  'namespace',
  'declare',
  'abstract',
  'implements',
  'readonly',
  'public',
  'private',
  'protected',
  'keyof',
  'satisfies',
  'infer',
  'is',
  'asserts',
  'override',
  'module',
]);

const TS_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'any',
  'unknown',
  'never',
  'object',
  'symbol',
  'bigint',
  'void',
  'Array',
  'Record',
  'Partial',
  'Promise',
]);

/** After these a `/` begins a regular expression rather than a division. */
const REGEX_AFTER_WORD = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'delete',
  'void',
  'throw',
  'yield',
  'await',
]);

const JS_NUMBER =
  /0[xX][0-9a-fA-F_]+n?|0[bB][01_]+n?|0[oO][0-7_]+n?|(?:\d[\d_]*\.?[\d_]*|\.\d[\d_]*)(?:[eE][+-]?\d+)?n?/y;

const JS_OPERATOR =
  />>>=|\.\.\.|===|!==|\*\*=|<<=|>>=|>>>|&&=|\|\|=|\?\?=|=>|==|!=|<=|>=|&&|\|\||\?\?|\?\.|\+\+|--|\*\*|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<|>>|[-+*/%=<>!&|^~?:]/y;

const TYPE_DECL = /^type\s+[A-Za-z_$][\w$]*\s*(?:<|=)/;
const PASCAL = /^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/;

type JsCtx = { t: 'tpl' } | { t: 'expr'; depth: number };

interface JsState {
  inBlock: boolean;
  stack: JsCtx[];
}

interface Prev {
  /** `value` ends an expression (a following `/` divides), `op` does not, `none` is line start. */
  kind: 'value' | 'op' | 'none';
  text: string;
}

function jsLine(line: string, st: JsState, out: LineBuilder, ts: boolean): void {
  const n = line.length;
  let i = 0;
  const prev: Prev = { kind: 'none', text: '' };
  const set = (kind: Prev['kind'], text: string) => {
    prev.kind = kind;
    prev.text = text;
  };

  while (i < n) {
    if (st.inBlock) {
      const e = line.indexOf('*/', i);
      if (e === -1) {
        out.push('comment', line.slice(i));
        i = n;
      } else {
        out.push('comment', line.slice(i, e + 2));
        i = e + 2;
        st.inBlock = false;
      }
      continue;
    }

    const top = st.stack[st.stack.length - 1];
    if (top && top.t === 'tpl') {
      let j = i;
      let closed = false;
      while (j < n) {
        const code = line.charCodeAt(j);
        if (code === 92) {
          j += 2;
          continue;
        }
        if (code === 96) {
          j++;
          closed = true;
          break;
        }
        if (code === 36 && line.charCodeAt(j + 1) === 123) break;
        j++;
      }
      if (j > n) j = n;
      out.push('string', line.slice(i, j));
      i = j;
      if (closed) {
        st.stack.pop();
        set('value', '`');
      } else if (i < n) {
        out.push('punct', '${');
        i += 2;
        st.stack.push({ t: 'expr', depth: 0 });
        set('op', '${');
      }
      continue;
    }

    const c = line[i] as string;
    const code = line.charCodeAt(i);

    if (isSpace(c)) {
      const j = readSpaces(line, i);
      out.push('plain', line.slice(i, j));
      i = j;
      continue;
    }

    if (c === '/' && line[i + 1] === '/') {
      out.push('comment', line.slice(i));
      i = n;
      continue;
    }
    if (c === '/' && line[i + 1] === '*') {
      st.inBlock = true;
      out.push('comment', '/*');
      i += 2;
      continue;
    }

    if (c === '"' || c === "'") {
      const end = scanQuoted(line, i, c);
      const k = readSpaces(line, end);
      const isKey =
        line[k] === ':' && k === end && (prev.text === '{' || prev.text === ',' || prev.kind === 'none');
      out.push(isKey ? 'key' : 'string', line.slice(i, end));
      i = end;
      set('value', c);
      continue;
    }

    if (c === '`') {
      st.stack.push({ t: 'tpl' });
      out.push('string', '`');
      i++;
      continue;
    }

    if (c === '/') {
      const regexAllowed = prev.kind === 'op' || prev.kind === 'none' || REGEX_AFTER_WORD.has(prev.text);
      if (regexAllowed) {
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < n) {
          const d = line[j];
          if (d === '\\') {
            j += 2;
            continue;
          }
          if (d === '[') inClass = true;
          else if (d === ']') inClass = false;
          else if (d === '/' && !inClass) {
            closed = true;
            j++;
            break;
          }
          j++;
        }
        if (closed && j > i + 2) {
          while (j < n && /[a-z]/.test(line[j] as string)) j++;
          out.push('string', line.slice(i, j));
          i = j;
          set('value', '/');
          continue;
        }
      }
    }

    if (
      (code >= 48 && code <= 57) ||
      (c === '.' && line.charCodeAt(i + 1) >= 48 && line.charCodeAt(i + 1) <= 57)
    ) {
      const m = matchAt(JS_NUMBER, line, i);
      if (m) {
        out.push('number', m);
        i += m.length;
        set('value', m);
        continue;
      }
    }

    if (isIdStart(code) || c === '#' || c === '@') {
      let j = i + 1;
      while (j < n && isIdPart(line.charCodeAt(j))) j++;
      const word = line.slice(i, j);
      if (c === '@') {
        out.push('fn', word);
        i = j;
        set('value', word);
        continue;
      }
      const type = classifyWord(word, line, j, prev, ts);
      out.push(type, word);
      i = j;
      set(type === 'keyword' && !isValueKeyword(word) ? 'op' : 'value', word);
      continue;
    }

    // Brace depth inside a template expression.
    if (c === '{' && top && top.t === 'expr') top.depth++;
    if (c === '}' && top && top.t === 'expr') {
      if (top.depth === 0) {
        st.stack.pop();
        out.push('punct', '}');
        i++;
        set('value', '}');
        continue;
      }
      top.depth--;
    }

    if (c === '(' || c === '[' || c === '{' || c === ',' || c === ';') {
      out.push('punct', c);
      i++;
      set('op', c);
      continue;
    }
    if (c === ')' || c === ']' || c === '}') {
      out.push('punct', c);
      i++;
      set('value', c);
      continue;
    }
    if (c === '.' && line.slice(i, i + 3) !== '...') {
      out.push('punct', c);
      i++;
      set('op', c);
      continue;
    }

    const op = matchAt(JS_OPERATOR, line, i);
    if (op) {
      out.push('operator', op);
      i += op.length;
      set(op === '++' || op === '--' ? 'value' : 'op', op);
      continue;
    }

    out.push('plain', c);
    i++;
    set('op', c);
  }
}

function isValueKeyword(word: string): boolean {
  return (
    word === 'this' ||
    word === 'true' ||
    word === 'false' ||
    word === 'null' ||
    word === 'undefined' ||
    word === 'super'
  );
}

function classifyWord(word: string, line: string, after: number, prev: Prev, ts: boolean): TokenType {
  const k = readSpaces(line, after);
  const next = line[k];
  if (prev.text === '.' || prev.text === '?.') return next === '(' ? 'fn' : 'plain';
  if (ts && word === 'type') {
    if (TYPE_DECL.test(line.slice(after - 4))) return 'keyword';
  } else if (JS_KEYWORDS.has(word) || (ts && TS_KEYWORDS.has(word))) {
    return 'keyword';
  }
  if (
    PASCAL.test(word) &&
    (prev.text === 'new' ||
      prev.text === 'class' ||
      prev.text === 'extends' ||
      prev.text === 'implements' ||
      prev.text === 'interface' ||
      prev.text === 'enum' ||
      prev.text === 'type')
  ) {
    return 'type';
  }
  if (next === '(') return 'fn';
  if (ts && TS_TYPES.has(word)) return 'type';
  if (PASCAL.test(word)) return 'type';
  if (
    line[after] === ':' &&
    (prev.text === '{' || prev.text === ',' || prev.text === '(' || prev.kind === 'none')
  ) {
    return 'key';
  }
  return 'plain';
}

// ---------------------------------------------------------------------------------------
// Shell (also the body of Dockerfile RUN and friends)
// ---------------------------------------------------------------------------------------

const SH_KEYWORDS = new Set([
  'if',
  'then',
  'else',
  'elif',
  'fi',
  'for',
  'while',
  'until',
  'do',
  'done',
  'case',
  'esac',
  'in',
  'function',
  'select',
  'time',
  'export',
  'local',
  'return',
  'exit',
  'set',
  'unset',
]);

/** Words after which another command follows. */
const PREFIX_COMMANDS = new Set([
  'sudo',
  'exec',
  'env',
  'time',
  'nohup',
  'nice',
  'xargs',
  'command',
  'watch',
  'doas',
]);

/** Tools whose next plain word is a subcommand worth colouring. */
const MULTIPLEXERS = new Set([
  'docker',
  'docker-compose',
  'podman',
  'git',
  'npm',
  'pnpm',
  'yarn',
  'kubectl',
  'helm',
  'systemctl',
  'apt',
  'apt-get',
  'brew',
  'cargo',
  'apk',
  'pip',
  'pip3',
  'yum',
  'dnf',
  'go',
  'make',
  'flux',
]);

const SUB_GROUPS = new Set([
  'compose',
  'container',
  'image',
  'volume',
  'network',
  'system',
  'builder',
  'buildx',
  'context',
  'manifest',
  'node',
  'service',
  'stack',
  'swarm',
  'secret',
  'config',
  'plugin',
]);

const SH_VAR = /\$(?:\{[^}]*\}|[A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/y;
const SH_FLAG = /--?[A-Za-z0-9][A-Za-z0-9_-]*/y;
const SH_ASSIGN = /[A-Za-z_][A-Za-z0-9_]*=/y;
const SH_NUMBER = /^\d+(?:[.:]\d+)*(?:\/[a-z]+)?$/;
const SH_SUBCOMMAND = /^[a-z][a-z0-9-]*$/;
const SH_REDIRECT = /\d*(?:&>>?|>>?&?|<<<?|<&?|>\|)\d*-?/y;

interface ShellState {
  /** The next word is a command. Persists across continuation lines. */
  expect: boolean;
  /** The tool whose subcommand may come next ('docker', 'git', ...), or null. */
  tool: string | null;
}

function shDoubleQuoted(line: string, i: number, out: LineBuilder): number {
  const n = line.length;
  let j = i + 1;
  let seg = i;
  while (j < n) {
    const code = line.charCodeAt(j);
    if (code === 92) {
      j += 2;
      continue;
    }
    if (code === 34) {
      j++;
      out.push('string', line.slice(seg, j));
      return j;
    }
    if (code === 36) {
      const v = matchAt(SH_VAR, line, j);
      if (v) {
        if (j > seg) out.push('string', line.slice(seg, j));
        out.push('variable', v);
        j += v.length;
        seg = j;
        continue;
      }
    }
    j++;
  }
  out.push('string', line.slice(seg));
  return n;
}

/**
 * A value after `=` (an assignment or a flag): a quoted string, a variable or a bare word that
 * may itself contain `=` and `,`. Never a command. Returns the index after it.
 */
function scanShellValue(line: string, from: number, out: LineBuilder): number {
  const n = line.length;
  const c = line[from];
  if (c === undefined || isSpace(c)) return from;
  if (c === '"') return shDoubleQuoted(line, from, out);
  if (c === "'") {
    const e = line.indexOf("'", from + 1);
    const j = e === -1 ? n : e + 1;
    out.push('string', line.slice(from, j));
    return j;
  }
  if (c === '$') {
    const v = matchAt(SH_VAR, line, from);
    if (v) {
      out.push('variable', v);
      return from + v.length;
    }
    return from;
  }
  let j = from;
  while (j < n) {
    const d = line[j] as string;
    if (d === '\\') {
      j += 2;
      continue;
    }
    if (isSpace(d) || '"\'$|&;<>()`'.includes(d)) break;
    j++;
  }
  if (j > n) j = n;
  if (j === from) return from;
  const word = line.slice(from, j);
  out.push(SH_NUMBER.test(word) ? 'number' : 'plain', word);
  return j;
}

function shellRange(line: string, from: number, out: LineBuilder, st: ShellState): void {
  const n = line.length;
  let i = from;
  while (i < n) {
    const c = line[i] as string;

    if (isSpace(c)) {
      const j = readSpaces(line, i);
      out.push('plain', line.slice(i, j));
      i = j;
      continue;
    }

    if (c === '#' && (i === from || isSpace(line[i - 1]))) {
      out.push('comment', line.slice(i));
      i = n;
      continue;
    }

    if (c === '"') {
      i = shDoubleQuoted(line, i, out);
      st.expect = false;
      continue;
    }

    if (c === "'") {
      const e = line.indexOf("'", i + 1);
      const j = e === -1 ? n : e + 1;
      out.push('string', line.slice(i, j));
      i = j;
      st.expect = false;
      continue;
    }

    if (c === '$') {
      if (line[i + 1] === '(') {
        const dbl = line[i + 2] === '(';
        out.push('punct', dbl ? '$((' : '$(');
        i += dbl ? 3 : 2;
        st.expect = !dbl;
        st.tool = null;
        continue;
      }
      const v = matchAt(SH_VAR, line, i);
      if (v) {
        out.push('variable', v);
        i += v.length;
        st.expect = false;
        continue;
      }
      out.push('plain', '$');
      i++;
      continue;
    }

    if (c === '`') {
      out.push('punct', '`');
      i++;
      st.expect = true;
      st.tool = null;
      continue;
    }

    if (c === '|' || c === ';' || (c === '&' && line[i + 1] !== '>')) {
      let j = i + 1;
      while (j < n && (line[j] === '|' || line[j] === '&' || line[j] === ';')) j++;
      out.push('operator', line.slice(i, j));
      i = j;
      st.expect = true;
      st.tool = null;
      continue;
    }

    if (c === '>' || c === '<' || (c === '&' && line[i + 1] === '>')) {
      const m = matchAt(SH_REDIRECT, line, i);
      const text = m && m.length > 0 ? m : c;
      out.push('operator', text);
      i += text.length;
      continue;
    }

    if (c === '(' || c === ')' || c === '[' || c === ']' || c === '}' || c === '{') {
      let j = i + 1;
      if ((c === '[' || c === ']') && line[j] === c) j++;
      out.push('punct', line.slice(i, j));
      if (c === '(' || (c === '{' && st.expect)) {
        st.expect = true;
        st.tool = null;
      }
      i = j;
      continue;
    }

    if (c === '\\' && i === n - 1) {
      out.push('operator', '\\');
      i++;
      continue;
    }

    // A redirect with a leading file descriptor: 2>&1, 2> file.
    if (c >= '0' && c <= '9') {
      const m = matchAt(SH_REDIRECT, line, i);
      if (m && /[<>]/.test(m)) {
        out.push('operator', m);
        i += m.length;
        continue;
      }
    }

    // Flags: -x, --long, --long=value. They never end a command position (RUN --mount=x cmd).
    if (c === '-') {
      const f = matchAt(SH_FLAG, line, i);
      if (f) {
        out.push('flag', f);
        i += f.length;
        if (line[i] === '=') {
          out.push('operator', '=');
          i = scanShellValue(line, i + 1, out);
        }
        continue;
      }
    }

    // Assignment at command position: FOO=bar cmd (the command is still to come).
    if (st.expect) {
      const a = matchAt(SH_ASSIGN, line, i);
      if (a) {
        out.push('variable', a.slice(0, -1));
        out.push('operator', '=');
        i = scanShellValue(line, i + a.length, out);
        continue;
      }
    }

    if (c === '=') {
      out.push('operator', '=');
      i++;
      continue;
    }

    // A bare word.
    let j = i;
    while (j < n) {
      const d = line[j] as string;
      if (d === '\\') {
        j += 2;
        continue;
      }
      if (isSpace(d) || '"\'$|&;<>()`='.includes(d)) break;
      j++;
    }
    if (j > n) j = n;
    if (j === i) {
      out.push('plain', c);
      i++;
      continue;
    }
    const word = line.slice(i, j);

    if (st.expect) {
      if (SH_KEYWORDS.has(word)) {
        out.push('keyword', word);
        // `then`, `do` and `else` start a command; `export FOO=1` does not.
        st.expect = word !== 'export' && word !== 'local' && word !== 'return' && word !== 'exit';
        st.tool = null;
      } else if (word === '!' || word === '{' || word === '[[' || word === '[') {
        out.push('punct', word);
      } else {
        out.push('fn', word);
        st.expect = PREFIX_COMMANDS.has(word);
        st.tool = MULTIPLEXERS.has(word) ? word : null;
      }
      i = j;
      continue;
    }

    if (line[j] === '=' && /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(word)) {
      out.push('key', word);
      st.tool = null;
      i = j;
      continue;
    }

    if (SH_NUMBER.test(word)) {
      out.push('number', word);
    } else if (st.tool && SH_SUBCOMMAND.test(word)) {
      out.push('keyword', word);
      st.tool = st.tool.startsWith('docker') && SUB_GROUPS.has(word) ? st.tool : null;
    } else {
      out.push('plain', word);
      st.tool = null;
    }
    i = j;
  }
}

const SH_PROMPT = /^(\s*)([$%]) (?=\S)/;
const ENDS_WITH_CONTINUATION = /\\\s*$/;

interface PromptShell {
  /** Whether any line of the block has a `$ ` prompt. */
  prompts: boolean;
  /** The previous command line ended with a backslash. */
  continued: boolean;
  shell: ShellState;
}

function shLine(line: string, ps: PromptShell, out: LineBuilder): void {
  const prompt = ps.prompts ? SH_PROMPT.exec(line) : null;
  if (prompt) {
    out.push('plain', prompt[1] as string);
    out.push('punct', `${prompt[2]} `);
    ps.shell.expect = true;
    ps.shell.tool = null;
    shellRange(line, prompt[0].length, out, ps.shell);
    ps.continued = ENDS_WITH_CONTINUATION.test(line);
    return;
  }
  if (ps.prompts && !ps.continued) {
    // Output of an earlier command.
    const trimmed = line.trimStart();
    if (trimmed.startsWith('#')) {
      out.push('plain', line.slice(0, line.length - trimmed.length));
      out.push('comment', trimmed);
    } else {
      out.push('punct', line);
    }
    return;
  }
  // A continuation keeps the state it ended with (after `&& \` a command is expected).
  if (!ps.continued) {
    ps.shell.expect = true;
    ps.shell.tool = null;
  }
  shellRange(line, 0, out, ps.shell);
  ps.continued = ENDS_WITH_CONTINUATION.test(line);
}

/**
 * The text to copy for a shell block: when any line has a `$ ` prompt, only the commands
 * (prompt removed, continuation lines kept) and none of the printed output; otherwise the
 * code as is.
 */
export function shellCopyText(code: string): string {
  const lines = splitLines(code);
  if (!lines.some((l) => SH_PROMPT.test(l))) return lines.join('\n');
  const out: string[] = [];
  let continued = false;
  for (const line of lines) {
    const m = SH_PROMPT.exec(line);
    if (m) {
      out.push(line.slice(m[0].length));
      continued = ENDS_WITH_CONTINUATION.test(line);
    } else if (continued) {
      out.push(line);
      continued = ENDS_WITH_CONTINUATION.test(line);
    }
  }
  return out.join('\n');
}

/** The text a copy button should put on the clipboard for a block of `lang`. */
export function copyText(code: string, lang: CodeLang): string {
  if (lang === 'sh') return shellCopyText(code);
  return splitLines(code).join('\n');
}

// ---------------------------------------------------------------------------------------
// Dockerfile
// ---------------------------------------------------------------------------------------

const DOCKER_INSTRUCTIONS = new Set([
  'FROM',
  'RUN',
  'CMD',
  'LABEL',
  'MAINTAINER',
  'EXPOSE',
  'ENV',
  'ADD',
  'COPY',
  'ENTRYPOINT',
  'VOLUME',
  'USER',
  'WORKDIR',
  'ARG',
  'ONBUILD',
  'STOPSIGNAL',
  'HEALTHCHECK',
  'SHELL',
]);

const DOCKER_INSTRUCTION_WORD = /^[A-Za-z]+(?=\s|$)/;
const DOCKER_PORT = /^\d+(?:-\d+)?(?:\/(?:tcp|udp))?$/;
const DOCKER_DURATION = /^\d+(?:\.\d+)?(?:ns|us|ms|s|m|h)$/;
const KEY_VALUE_INSTRUCTIONS = new Set(['ENV', 'ARG', 'LABEL']);

interface DockerState {
  /** The previous instruction line ended with a backslash. */
  continued: boolean;
  /** The instruction the current logical line belongs to, upper case. */
  instruction: string | null;
  shell: ShellState;
}

/**
 * The arguments of an instruction that is not a shell command: quoted strings, `$VAR`, flags,
 * numbers, `AS name`, `KEY=value` and exec-form brackets.
 */
function dockerArgs(line: string, from: number, out: LineBuilder, instruction: string): void {
  const n = line.length;
  const keyValue = KEY_VALUE_INSTRUCTIONS.has(instruction);
  let i = from;
  let words = 0; // bare words seen so far on this line
  let afterAs = false;
  while (i < n) {
    const c = line[i] as string;
    if (isSpace(c)) {
      const j = readSpaces(line, i);
      out.push('plain', line.slice(i, j));
      i = j;
      continue;
    }
    if (c === '#' && isSpace(line[i - 1])) {
      out.push('comment', line.slice(i));
      return;
    }
    if (c === '"') {
      i = shDoubleQuoted(line, i, out);
      continue;
    }
    if (c === "'") {
      const e = line.indexOf("'", i + 1);
      const j = e === -1 ? n : e + 1;
      out.push('string', line.slice(i, j));
      i = j;
      continue;
    }
    if (c === '$') {
      const v = matchAt(SH_VAR, line, i);
      out.push(v ? 'variable' : 'plain', v ?? '$');
      i += v ? v.length : 1;
      continue;
    }
    if (c === '[' || c === ']' || c === ',') {
      out.push('punct', c);
      i++;
      continue;
    }
    if (c === '=') {
      out.push('operator', '=');
      i++;
      continue;
    }
    if (c === '\\' && i === n - 1) {
      out.push('operator', '\\');
      i++;
      continue;
    }
    if (c === '-' && line[i + 1] === '-') {
      const f = matchAt(SH_FLAG, line, i);
      if (f) {
        out.push('flag', f);
        i += f.length;
        continue;
      }
    }
    // A bare word up to whitespace, a quote, a bracket, a comma, a dollar or an equals sign.
    let j = i;
    while (j < n) {
      const d = line[j] as string;
      if (d === '\\') {
        j += 2;
        continue;
      }
      if (isSpace(d) || '"\'$[],='.includes(d)) break;
      j++;
    }
    if (j > n) j = n;
    if (j === i) {
      out.push('plain', c);
      i++;
      continue;
    }
    const word = line.slice(i, j);
    const afterEquals = line[i - 1] === '=';
    if (instruction === 'FROM') {
      if (words > 0 && word.toUpperCase() === 'AS' && !afterAs) {
        out.push('keyword', word);
        afterAs = true;
      } else {
        out.push(afterAs ? 'type' : 'string', word);
      }
    } else if (instruction === 'EXPOSE' && DOCKER_PORT.test(word)) {
      out.push('number', word);
    } else if (keyValue && !afterEquals && (line[j] === '=' || words === 0)) {
      out.push('key', word);
    } else if (SH_NUMBER.test(word) || DOCKER_DURATION.test(word)) {
      out.push('number', word);
    } else {
      out.push('plain', word);
    }
    words++;
    i = j;
  }
}

/** HEALTHCHECK [--interval=30s ...] CMD <shell> | NONE */
function dockerHealthcheck(line: string, from: number, out: LineBuilder, st: DockerState): void {
  const n = line.length;
  let i = from;
  while (i < n) {
    const j = readSpaces(line, i);
    out.push('plain', line.slice(i, j));
    i = j;
    if (i >= n) return;
    const f = line.startsWith('--', i) ? matchAt(SH_FLAG, line, i) : null;
    if (f) {
      out.push('flag', f);
      i += f.length;
      if (line[i] === '=') {
        out.push('operator', '=');
        i++;
        let e = i;
        while (e < n && !isSpace(line[e])) e++;
        const v = line.slice(i, e);
        out.push(DOCKER_DURATION.test(v) || SH_NUMBER.test(v) ? 'number' : 'plain', v);
        i = e;
      }
      continue;
    }
    const w = /^(?:CMD|NONE)(?=\s|$)/i.exec(line.slice(i));
    if (w) {
      out.push('keyword', w[0]);
      i += w[0].length;
      st.shell.expect = true;
      st.shell.tool = null;
      shellRange(line, i, out, st.shell);
      return;
    }
    shellRange(line, i, out, st.shell);
    return;
  }
}

function dockerBody(line: string, from: number, st: DockerState, out: LineBuilder): void {
  const instr = st.instruction;
  if (instr === 'HEALTHCHECK') {
    dockerHealthcheck(line, from, out, st);
    return;
  }
  const bodyStart = readSpaces(line, from);
  const execForm = line[bodyStart] === '[';
  const shellInstruction = instr === 'RUN' || instr === 'CMD' || instr === 'ENTRYPOINT' || instr === 'SHELL';
  if (instr === null || (shellInstruction && !execForm)) {
    shellRange(line, from, out, st.shell);
    return;
  }
  dockerArgs(line, from, out, instr);
}

function dockerLine(line: string, st: DockerState, out: LineBuilder): void {
  const lead = readSpaces(line, 0);
  const rest = line.slice(lead);
  if (rest === '') {
    out.push('plain', line);
    return;
  }
  if (rest.startsWith('#')) {
    // A comment line, also allowed inside a continued instruction (which stays continued).
    out.push('plain', line.slice(0, lead));
    out.push('comment', rest);
    return;
  }

  let pos = 0;
  if (!st.continued) {
    const m = DOCKER_INSTRUCTION_WORD.exec(rest);
    const word = m ? m[0] : '';
    if (word && DOCKER_INSTRUCTIONS.has(word.toUpperCase())) {
      out.push('plain', line.slice(0, lead));
      out.push('keyword', word);
      pos = lead + word.length;
      st.instruction = word.toUpperCase();
      st.shell.expect = st.instruction === 'RUN';
      st.shell.tool = null;
      if (st.instruction === 'ONBUILD') {
        const gap = readSpaces(line, pos);
        const inner = DOCKER_INSTRUCTION_WORD.exec(line.slice(gap));
        if (inner && DOCKER_INSTRUCTIONS.has(inner[0].toUpperCase())) {
          out.push('plain', line.slice(pos, gap));
          out.push('keyword', inner[0]);
          pos = gap + inner[0].length;
          st.instruction = inner[0].toUpperCase();
          st.shell.expect = st.instruction === 'RUN';
        }
      }
    } else {
      st.instruction = null;
      st.shell.expect = true;
      st.shell.tool = null;
    }
  }
  dockerBody(line, pos, st, out);
  st.continued = ENDS_WITH_CONTINUATION.test(line);
}

// ---------------------------------------------------------------------------------------
// YAML
// ---------------------------------------------------------------------------------------

interface YamlState {
  /** Column of the key that opened a block scalar (`|` or `>`), or -1. */
  block: number;
}

const YAML_NUMBER = /^[-+]?(?:0x[0-9a-fA-F_]+|0o[0-7_]+|(?:\d[\d_]*)(?:\.\d[\d_]*)?(?:[eE][-+]?\d+)?|\.\d+)$/;
const YAML_KEYWORDS = new Set([
  'true',
  'false',
  'null',
  '~',
  'yes',
  'no',
  'on',
  'off',
  'True',
  'False',
  'Null',
  'TRUE',
  'FALSE',
  'NULL',
  'Yes',
  'No',
  'On',
  'Off',
]);
const YAML_BLOCK = /[|>][-+0-9]*(?=\s|$)/y;

/** Index of the colon that ends a plain or quoted key starting at `from`, or -1. */
function yamlKeyEnd(line: string, from: number): number {
  const c = line[from];
  if (c === '"' || c === "'") {
    const end = scanQuoted(line, from, c);
    const k = readSpaces(line, end);
    return line[k] === ':' && (k + 1 >= line.length || isSpace(line[k + 1])) && end - from > 1 ? k : -1;
  }
  if (c === undefined || '#-?:,[]{}&*!|>%@`'.includes(c)) {
    // `-x: 1` and `?` are rare; plain keys may start with `-` only when followed by a non-space.
    if (!(c === '-' && line[from + 1] !== ' ' && line[from + 1] !== undefined)) return -1;
  }
  for (let j = from; j < line.length; j++) {
    const d = line[j];
    if (d === '#' && j > from && isSpace(line[j - 1])) return -1;
    if (d === ':' && (j + 1 >= line.length || isSpace(line[j + 1]))) return j;
  }
  return -1;
}

function yamlFlow(line: string, from: number, out: LineBuilder): number {
  const n = line.length;
  let i = from;
  while (i < n) {
    const c = line[i] as string;
    if (isSpace(c)) {
      const j = readSpaces(line, i);
      out.push('plain', line.slice(i, j));
      i = j;
    } else if (c === '#' && isSpace(line[i - 1])) {
      out.push('comment', line.slice(i));
      return n;
    } else if (c === '"' || c === "'") {
      const end = scanQuoted(line, i, c);
      const k = readSpaces(line, end);
      out.push(line[k] === ':' ? 'key' : 'string', line.slice(i, end));
      i = end;
    } else if ('[]{},:'.includes(c)) {
      out.push('punct', c);
      i++;
    } else {
      let j = i;
      while (
        j < n &&
        !isSpace(line[j]) &&
        !'[]{},'.includes(line[j] as string) &&
        !(line[j] === ':' && (j + 1 >= n || isSpace(line[j + 1]) || '[]{},'.includes(line[j + 1] as string)))
      )
        j++;
      if (j === i) j = i + 1;
      const word = line.slice(i, j);
      const k = readSpaces(line, j);
      if (line[k] === ':') out.push('key', word);
      else if (YAML_NUMBER.test(word)) out.push('number', word);
      else if (YAML_KEYWORDS.has(word)) out.push('keyword', word);
      else out.push('plain', word);
      i = j;
    }
  }
  return n;
}

function yamlValue(line: string, from: number, out: LineBuilder, keyCol: number, st: YamlState): void {
  const n = line.length;
  let i = readSpaces(line, from);
  out.push('plain', line.slice(from, i));
  while (i < n) {
    const c = line[i] as string;
    if (c === '#' && (i === 0 || isSpace(line[i - 1]))) {
      out.push('comment', line.slice(i));
      return;
    }
    if (c === '|' || c === '>') {
      const b = matchAt(YAML_BLOCK, line, i);
      if (b) {
        out.push('punct', b);
        i += b.length;
        st.block = keyCol;
        continue;
      }
    }
    if (c === '"' || c === "'") {
      const end = scanQuoted(line, i, c);
      out.push('string', line.slice(i, end));
      i = end;
      continue;
    }
    if (c === '&' || c === '*') {
      const m = /[&*][^\s,[\]{}]+/y;
      const v = matchAt(m, line, i);
      if (v) {
        out.push('variable', v);
        i += v.length;
        continue;
      }
    }
    if (c === '!') {
      const m = /![^\s,[\]{}]*/y;
      const v = matchAt(m, line, i) ?? '!';
      out.push('type', v);
      i += v.length;
      continue;
    }
    if (c === '[' || c === '{') {
      i = yamlFlow(line, i, out);
      continue;
    }
    if (isSpace(c)) {
      const j = readSpaces(line, i);
      out.push('plain', line.slice(i, j));
      i = j;
      continue;
    }
    // A plain scalar up to a trailing comment.
    let j = i;
    while (j < n && !(line[j] === '#' && isSpace(line[j - 1]))) j++;
    let e = j;
    while (e > i && isSpace(line[e - 1])) e--;
    const text = line.slice(i, e);
    if (YAML_NUMBER.test(text)) out.push('number', text);
    else if (YAML_KEYWORDS.has(text)) out.push('keyword', text);
    else out.push('plain', text);
    out.push('plain', line.slice(e, j));
    i = j;
  }
}

function yamlLine(line: string, st: YamlState, out: LineBuilder): void {
  const lead = readSpaces(line, 0);
  const rest = line.slice(lead);

  if (st.block >= 0) {
    if (rest === '') {
      out.push('plain', line);
      return;
    }
    if (lead > st.block) {
      out.push('plain', line.slice(0, lead));
      out.push('string', rest);
      return;
    }
    st.block = -1;
  }

  out.push('plain', line.slice(0, lead));
  if (rest === '') return;
  if (rest.startsWith('#')) {
    out.push('comment', rest);
    return;
  }
  if ((rest.startsWith('---') || rest.startsWith('...')) && (rest.length === 3 || isSpace(rest[3]))) {
    out.push('punct', rest.slice(0, 3));
    yamlValue(line, lead + 3, out, lead, st);
    return;
  }

  let i = lead;
  let col = lead;
  // Sequence bullets: "- ", "- - ".
  while (line[i] === '-' && (i + 1 >= line.length || isSpace(line[i + 1]))) {
    out.push('punct', '-');
    const j = readSpaces(line, i + 1);
    out.push('plain', line.slice(i + 1, j));
    i = j;
    col = i;
  }
  if (i >= line.length) return;

  const colon = yamlKeyEnd(line, i);
  if (colon >= 0) {
    const key = line.slice(i, colon);
    const trimmed = key.replace(/\s+$/, '');
    out.push('key', trimmed);
    out.push('plain', key.slice(trimmed.length));
    out.push('punct', ':');
    yamlValue(line, colon + 1, out, col, st);
    return;
  }
  yamlValue(line, i, out, col, st);
}

// ---------------------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------------------

/** Tokenizes `code` into one token array per line. Total and lossless; see the file header. */
export function tokenize(code: string, lang: CodeLang): Token[][] {
  const lines = splitLines(code);
  if (lang === 'text' || code.length > MAX_HIGHLIGHT_CHARS) return lines.map(plainLine);

  const js: JsState = { inBlock: false, stack: [] };
  const sh: PromptShell = {
    prompts: lang === 'sh' && /^\s*[$%] \S/m.test(code),
    continued: false,
    shell: { expect: true, tool: null },
  };
  const docker: DockerState = { continued: false, instruction: null, shell: { expect: false, tool: null } };
  const yaml: YamlState = { block: -1 };

  return lines.map((line) => {
    if (line === '') return [];
    if (line.length > MAX_HIGHLIGHT_LINE) return plainLine(line);
    const out = new LineBuilder();
    try {
      switch (lang) {
        case 'json':
          jsonLine(line, out);
          break;
        case 'js':
          jsLine(line, js, out, false);
          break;
        case 'ts':
          jsLine(line, js, out, true);
          break;
        case 'sh':
          shLine(line, sh, out);
          break;
        case 'dockerfile':
          dockerLine(line, docker, out);
          break;
        case 'yaml':
          yamlLine(line, yaml, out);
          break;
        default:
          return plainLine(line);
      }
    } catch {
      return plainLine(line);
    }
    // Belt and braces: the contract is lossless.
    let joined = '';
    for (const t of out.tokens) joined += t.text;
    return joined === line ? out.tokens : plainLine(line);
  });
}
