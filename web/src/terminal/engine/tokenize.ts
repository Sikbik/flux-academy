/**
 * A small POSIX-ish tokenizer and list parser: words with single and double quotes, backslash
 * escapes, `$VAR` and `${VAR}` and `~` expansion, and the operators the sandbox understands:
 * `&&`, `||`, `;`, `|`, `>`, `>>` and the stderr forms `2>`, `2>>`, `2>&1`.
 *
 * Deliberately not supported (each gives a clear sandbox error): command substitution,
 * background jobs, input redirection, subshells, here-documents.
 */

export type Operator = '&&' | '||' | ';' | '|' | '>' | '>>' | '2>' | '2>>' | '2>&1';

export interface WordToken {
  type: 'word';
  /** After quote removal and expansion. */
  value: string;
  /** The source text of the word. */
  raw: string;
  start: number;
  end: number;
  /** Any quoting or escaping was present (so it is not a glob or an assignment). */
  quoted: boolean;
  /** Contains an unquoted `*`, `?` or `[`. */
  glob: boolean;
}

export interface OpToken {
  type: 'op';
  op: Operator;
  start: number;
  end: number;
}

export type Token = WordToken | OpToken;

export interface TokenizeOptions {
  env: ReadonlyMap<string, string>;
  home: string;
  lastExit?: number;
  /**
   * Expand `$VAR`, `${VAR}`, `$?` and `~` while tokenizing (default true). With `false` they stay
   * in the text, so a list like `export X=1; echo $X` can expand each command when it runs, as a
   * real shell does. `expandWord` then expands one word's source text later.
   */
  expand?: boolean;
}

export interface TokenizeResult {
  tokens: Token[];
  error: string | null;
}

const NAME_START = /[A-Za-z_]/;
const NAME_CHAR = /[A-Za-z0-9_]/;

export function tokenize(line: string, opts: TokenizeOptions): TokenizeResult {
  const tokens: Token[] = [];
  const n = line.length;
  let i = 0;
  let cur = '';
  let hasWord = false;
  let curStart = 0;
  let quoted = false;
  let glob = false;

  const open = (at: number) => {
    if (!hasWord) {
      hasWord = true;
      curStart = at;
    }
  };
  const close = (at: number) => {
    // An unquoted expansion that came out empty leaves no word behind, as in a real shell.
    if (hasWord && (cur !== '' || quoted)) {
      tokens.push({
        type: 'word',
        value: cur,
        raw: line.slice(curStart, at),
        start: curStart,
        end: at,
        quoted,
        glob,
      });
    }
    cur = '';
    hasWord = false;
    quoted = false;
    glob = false;
  };
  const fail = (message: string): TokenizeResult => ({ tokens, error: message });

  const defer = opts.expand === false;

  /** Reads a `$` expansion starting at `at`. Returns its value and the next index. */
  const expand = (at: number): { value: string; next: number } | { error: string } => {
    const nx = line[at + 1];
    if (nx === '(') return { error: 'command substitution is not available in the sandbox' };
    if (defer) {
      // Keep the text for later: `${NAME}` and `$NAME` are copied verbatim.
      if (nx === '{') {
        const end = line.indexOf('}', at + 2);
        if (end < 0) return { error: 'bad substitution' };
        return { value: line.slice(at, end + 1), next: end + 1 };
      }
      if (nx === '?') return { value: '$?', next: at + 2 };
      if (nx !== undefined && NAME_START.test(nx)) {
        let j = at + 1;
        while (j < n && NAME_CHAR.test(line[j] as string)) j += 1;
        return { value: line.slice(at, j), next: j };
      }
      return { value: '$', next: at + 1 };
    }
    if (nx === '{') {
      const end = line.indexOf('}', at + 2);
      if (end < 0) return { error: 'bad substitution' };
      const inner = line.slice(at + 2, end);
      const fallback = inner.indexOf(':-');
      const name = fallback >= 0 ? inner.slice(0, fallback) : inner;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
        return { error: `${line.slice(at, end + 1)}: bad substitution` };
      const found = opts.env.get(name);
      const value =
        found !== undefined && found !== '' ? found : fallback >= 0 ? inner.slice(fallback + 2) : '';
      return { value, next: end + 1 };
    }
    if (nx === '?') return { value: String(opts.lastExit ?? 0), next: at + 2 };
    if (nx !== undefined && NAME_START.test(nx)) {
      let j = at + 1;
      while (j < n && NAME_CHAR.test(line[j] as string)) j += 1;
      return { value: opts.env.get(line.slice(at + 1, j)) ?? '', next: j };
    }
    return { value: '$', next: at + 1 };
  };

  while (i < n) {
    const ch = line[i] as string;

    if (ch === ' ' || ch === '\t') {
      close(i);
      i += 1;
      continue;
    }

    if (ch === '#' && !hasWord) break;

    // Operators.
    if (!hasWord && ch === '2' && line[i + 1] === '>') {
      if (line.startsWith('2>&1', i)) {
        tokens.push({ type: 'op', op: '2>&1', start: i, end: i + 4 });
        i += 4;
        continue;
      }
      if (line.startsWith('2>>', i)) {
        tokens.push({ type: 'op', op: '2>>', start: i, end: i + 3 });
        i += 3;
        continue;
      }
      tokens.push({ type: 'op', op: '2>', start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (ch === '&') {
      if (line[i + 1] === '&') {
        close(i);
        tokens.push({ type: 'op', op: '&&', start: i, end: i + 2 });
        i += 2;
        continue;
      }
      close(i);
      return fail('background jobs (&) are not available in the sandbox');
    }
    if (ch === '|') {
      close(i);
      if (line[i + 1] === '|') {
        tokens.push({ type: 'op', op: '||', start: i, end: i + 2 });
        i += 2;
      } else {
        tokens.push({ type: 'op', op: '|', start: i, end: i + 1 });
        i += 1;
      }
      continue;
    }
    if (ch === ';') {
      close(i);
      tokens.push({ type: 'op', op: ';', start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === '>') {
      close(i);
      if (line[i + 1] === '>') {
        tokens.push({ type: 'op', op: '>>', start: i, end: i + 2 });
        i += 2;
      } else {
        tokens.push({ type: 'op', op: '>', start: i, end: i + 1 });
        i += 1;
      }
      continue;
    }
    if (ch === '<') {
      close(i);
      return fail('input redirection (<) is not available in the sandbox');
    }

    // Words.
    if (ch === "'") {
      open(i);
      quoted = true;
      const end = line.indexOf("'", i + 1);
      if (end < 0) return fail("unexpected EOF while looking for matching `''");
      cur += line.slice(i + 1, end);
      i = end + 1;
      continue;
    }

    if (ch === '"') {
      open(i);
      quoted = true;
      i += 1;
      for (;;) {
        if (i >= n) return fail('unexpected EOF while looking for matching `"\'');
        const c = line[i] as string;
        if (c === '"') {
          i += 1;
          break;
        }
        if (c === '\\' && i + 1 < n && '"\\$`'.includes(line[i + 1] as string)) {
          cur += line[i + 1];
          i += 2;
          continue;
        }
        if (c === '$') {
          const e = expand(i);
          if ('error' in e) return fail(e.error);
          cur += e.value;
          i = e.next;
          continue;
        }
        cur += c;
        i += 1;
      }
      continue;
    }

    if (ch === '\\') {
      open(i);
      quoted = true;
      if (i + 1 < n) {
        cur += line[i + 1];
        i += 2;
      } else {
        cur += '\\';
        i += 1;
      }
      continue;
    }

    if (ch === '$') {
      open(i);
      const e = expand(i);
      if ('error' in e) return fail(e.error);
      i = e.next;
      const { value } = e;
      if (/\s/.test(value)) {
        // Unquoted expansion is split into words.
        const lead = /^\s/.test(value);
        const trail = /\s$/.test(value);
        const parts = value.split(/\s+/).filter(Boolean);
        if (lead) {
          close(i);
          open(i);
        }
        parts.forEach((part, k) => {
          if (k > 0) {
            close(i);
            open(i);
          }
          cur += part;
        });
        if (trail) close(i);
      } else {
        cur += value;
      }
      continue;
    }

    if (ch === '~' && !hasWord && !defer) {
      const nx = line[i + 1];
      if (
        nx === undefined ||
        nx === '/' ||
        nx === ' ' ||
        nx === '\t' ||
        nx === ';' ||
        nx === '|' ||
        nx === '&'
      ) {
        open(i);
        cur += opts.home;
        i += 1;
        continue;
      }
    }

    open(i);
    if (ch === '*' || ch === '?' || ch === '[') glob = true;
    cur += ch;
    i += 1;
  }

  close(n);
  return { tokens, error: null };
}

/**
 * Expand one word's source text (`$HOME/app`, `"a $B"`, `~`) with the environment as it is now.
 * Returns zero words when an unquoted variable is empty, several when its value has spaces.
 */
export function expandWord(raw: string, opts: TokenizeOptions): { words: WordToken[]; error: string | null } {
  const r = tokenize(raw, { ...opts, expand: true });
  if (r.error) return { words: [], error: r.error };
  return { words: r.tokens.filter((t): t is WordToken => t.type === 'word'), error: null };
}

// ---------------------------------------------------------------------------
// Parsing the token stream into a list of pipelines
// ---------------------------------------------------------------------------

export interface CommandNode {
  words: WordToken[];
  /** Source text of the command without redirections. */
  raw: string;
  redirect: { op: '>' | '>>'; target: WordToken } | null;
  /** What `2>` or `2>&1` asked for. */
  stderr: 'inherit' | 'null' | 'merge' | 'file';
}

export interface ListItem {
  /** Commands connected by `|`. */
  pipeline: CommandNode[];
  /** The operator linking this item to the previous one. `null` for the first. */
  join: '&&' | '||' | ';' | null;
}

export interface ParseResult {
  items: ListItem[];
  error: string | null;
}

export function parseList(tokens: readonly Token[], line: string): ParseResult {
  const items: ListItem[] = [];
  let pipeline: CommandNode[] = [];
  let words: WordToken[] = [];
  let redirect: CommandNode['redirect'] = null;
  let stderr: CommandNode['stderr'] = 'inherit';
  let join: ListItem['join'] = null;
  let pendingRedirect: '>' | '>>' | null = null;
  let pendingStderr: '2>' | '2>>' | null = null;

  const syntax = (tok: string): ParseResult => ({
    items: [],
    error: `syntax error near unexpected token \`${tok}'`,
  });

  const endCommand = (): boolean => {
    if (words.length === 0) return false;
    const first = words[0] as WordToken;
    const last = words[words.length - 1] as WordToken;
    pipeline.push({ words, raw: line.slice(first.start, last.end), redirect, stderr });
    words = [];
    redirect = null;
    stderr = 'inherit';
    return true;
  };

  for (const tok of tokens) {
    if (tok.type === 'word') {
      if (pendingRedirect) {
        redirect = { op: pendingRedirect, target: tok };
        pendingRedirect = null;
      } else if (pendingStderr) {
        stderr = tok.value === '/dev/null' ? 'null' : 'file';
        pendingStderr = null;
      } else {
        words.push(tok);
      }
      continue;
    }
    const { op } = tok;
    if (pendingRedirect || pendingStderr) return syntax(op);
    switch (op) {
      case '>':
      case '>>':
        pendingRedirect = op;
        break;
      case '2>':
      case '2>>':
        pendingStderr = op;
        break;
      case '2>&1':
        stderr = 'merge';
        break;
      case '|':
        if (!endCommand()) return syntax('|');
        break;
      case '&&':
      case '||':
      case ';':
        if (!endCommand()) return syntax(op);
        items.push({ pipeline, join });
        pipeline = [];
        join = op;
        break;
    }
  }

  if (pendingRedirect || pendingStderr) return syntax('newline');
  if (endCommand()) {
    items.push({ pipeline, join });
  } else if (pipeline.length > 0) {
    return syntax('|');
  } else if (join !== null && join !== ';') {
    return syntax(join);
  }
  return { items, error: null };
}
