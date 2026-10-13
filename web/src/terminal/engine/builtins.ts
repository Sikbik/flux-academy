/**
 * Builtin commands. Each takes the argument vector (name first), the previous pipe stage's output
 * as plain lines (or null), and the working shell state, and returns lines plus an exit code. They
 * read and write only the virtual file system and the state they are given.
 */

import { dirname, displayPath, type FsEntry } from './fs';
import { compileJq, JqError, runJq } from './jq';
import { compactJson, parseJsonStream, prettyJson } from './json';
import { noteLine, plainLine, stripMarkup } from './markup';
import { Pattern, UnsupportedPattern } from './pattern';
import type { EngineContext, ShellState } from './state';
import type { OutLine, Span } from './types';

export interface BuiltinInput {
  /** `args[0]` is the command name. */
  args: string[];
  stdin: string[] | null;
  state: ShellState;
  ctx: EngineContext;
}

export interface BuiltinOutput {
  lines: OutLine[];
  exit: number;
  clear?: boolean;
  explain?: string;
}

type Builtin = (input: BuiltinInput) => BuiltinOutput;

const ok = (lines: OutLine[] = [], explain?: string): BuiltinOutput => ({
  lines,
  exit: 0,
  ...(explain ? { explain } : {}),
});
const fail = (message: string, exit = 1): BuiltinOutput => ({ lines: [plainLine(message, 'err')], exit });
const text = (s: string): OutLine => plainLine(s);

function splitLines(content: string): string[] {
  const lines = content.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

interface ParsedFlags {
  flags: Set<string>;
  values: Map<string, string>;
  operands: string[];
  error: string | null;
}

/**
 * Parse short flags (`-la`), `--long` flags, and flags that take a value (`-n 5`, `-n5`).
 * `withValue` lists the short flags that consume a value.
 */
function parseFlags(
  args: string[],
  known: string,
  name: string,
  withValue = '',
  longs: Record<string, string> = {},
): ParsedFlags {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const operands: string[] = [];
  let error: string | null = null;
  let endOfFlags = false;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i] as string;
    if (endOfFlags || a === '-' || !a.startsWith('-')) {
      operands.push(a);
      continue;
    }
    if (a === '--') {
      endOfFlags = true;
      continue;
    }
    if (a.startsWith('--')) {
      const [long, inline] = a.slice(2).split('=', 2) as [string, string | undefined];
      const short = longs[long];
      if (!short) {
        error = `${name}: unrecognized option '${a}'`;
        continue;
      }
      if (withValue.includes(short)) {
        let v = inline;
        if (v === undefined) {
          i += 1;
          v = args[i];
        }
        if (v === undefined) error = `${name}: option '--${long}' requires an argument`;
        else values.set(short, v);
      } else {
        flags.add(short);
      }
      continue;
    }
    for (let j = 1; j < a.length; j += 1) {
      const ch = a[j] as string;
      if (withValue.includes(ch)) {
        let v: string | undefined = a.slice(j + 1);
        if (v === '') {
          i += 1;
          v = args[i];
        }
        if (v === undefined) error = `${name}: option requires an argument -- '${ch}'`;
        else values.set(ch, v);
        break;
      }
      if (known.includes(ch)) flags.add(ch);
      else error = `${name}: invalid option -- '${ch}'`;
    }
  }
  return { flags, values, operands, error };
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function lsDate(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, ' ');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${dd} ${hh}:${mm}`;
}

function humanSize(n: number): string {
  if (n < 1024) return String(n);
  const units = ['K', 'M', 'G'];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}${units[u]}`;
}

const ls: Builtin = ({ args, state }) => {
  const p = parseFlags(args.slice(1), 'laA1hFR', 'ls', '', {
    all: 'a',
    'almost-all': 'A',
    long: 'l',
    'human-readable': 'h',
  });
  if (p.error) return fail(p.error, 2);
  const targets = p.operands.length > 0 ? p.operands : ['.'];
  const showAll = p.flags.has('a');
  const showAlmost = p.flags.has('A') || showAll;
  const long = p.flags.has('l');
  const lines: OutLine[] = [];
  let exit = 0;

  const entryName = (e: FsEntry): Span[] => {
    const suffix = p.flags.has('F') && e.kind === 'dir' ? '/' : '';
    return e.kind === 'dir' ? [{ text: `${e.name}${suffix}`, kind: 'path' }] : [{ text: e.name }];
  };

  const render = (entries: FsEntry[]) => {
    if (long) {
      const total = entries.reduce((sum, e) => sum + Math.max(4, Math.ceil(e.size / 4096) * 4), 0);
      lines.push(text(`total ${total}`));
      const sizes = entries.map((e) =>
        e.kind === 'dir' ? '4096' : p.flags.has('h') ? humanSize(e.size) : String(e.size),
      );
      const width = Math.max(...sizes.map((s) => s.length), 1);
      entries.forEach((e, i) => {
        const perms = e.kind === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--';
        const links = e.kind === 'dir' ? '2' : '1';
        const head = `${perms} ${links} learner learner ${(sizes[i] as string).padStart(width)} ${lsDate(e.mtime)} `;
        const spans: Span[] = [{ text: head }, ...entryName(e)];
        lines.push({ spans, text: spans.map((s) => s.text).join(''), channel: 'out' });
      });
      return;
    }
    if (entries.length === 0) return;
    if (p.flags.has('1')) {
      for (const e of entries) {
        const spans = entryName(e);
        lines.push({ spans, text: spans.map((s) => s.text).join(''), channel: 'out' });
      }
      return;
    }
    const spans: Span[] = [];
    entries.forEach((e, i) => {
      if (i > 0) spans.push({ text: '  ' });
      spans.push(...entryName(e));
    });
    lines.push({ spans, text: spans.map((s) => s.text).join(''), channel: 'out' });
  };

  const files: FsEntry[] = [];
  const dirs: { arg: string; abs: string }[] = [];
  for (const t of targets) {
    const expanded = t;
    const abs = state.fs.resolve(state.cwd, expanded);
    const st = state.fs.stat(abs);
    if (!st) {
      lines.push(plainLine(`ls: cannot access '${t}': No such file or directory`, 'err'));
      exit = 2;
    } else if (st.kind === 'dir') {
      dirs.push({ arg: t, abs });
    } else {
      files.push({ ...st, name: t });
    }
  }
  if (files.length > 0) render(files);
  dirs.forEach((d, idx) => {
    if (files.length > 0 || targets.length > 1 || idx > 0) {
      if (lines.length > 0) lines.push(text(''));
      lines.push(text(`${d.arg}:`));
    }
    let entries = state.fs.list(d.abs);
    if (!showAlmost) entries = entries.filter((e) => !e.name.startsWith('.'));
    if (showAll) {
      const self = state.fs.stat(d.abs);
      const parent = state.fs.stat(dirname(d.abs));
      const dots: FsEntry[] = [];
      if (self) dots.push({ ...self, name: '.' });
      if (parent) dots.push({ ...parent, name: '..' });
      entries = [...dots, ...entries];
    }
    render(entries);
  });
  return { lines, exit };
};

const cat: Builtin = ({ args, stdin, state }) => {
  const p = parseFlags(args.slice(1), 'nE', 'cat');
  if (p.error) return fail(p.error, 1);
  const numbered = p.flags.has('n');
  const lines: OutLine[] = [];
  const push = (raw: string[]) => {
    for (const l of raw) {
      const prefix = numbered ? `${String(lines.length + 1).padStart(6)}\t` : '';
      lines.push(text(`${prefix}${l}`));
    }
  };
  if (p.operands.length === 0) {
    if (stdin) {
      push(stdin);
      return { lines, exit: 0 };
    }
    return {
      lines: [noteLine('cat needs a file name here, otherwise it waits for input. Try: cat Dockerfile')],
      exit: 1,
    };
  }
  let exit = 0;
  for (const f of p.operands) {
    if (f === '-' && stdin) {
      push(stdin);
      continue;
    }
    const abs = state.fs.resolve(state.cwd, f);
    if (state.fs.isDir(abs)) {
      lines.push(plainLine(`cat: ${f}: Is a directory`, 'err'));
      exit = 1;
    } else if (!state.fs.exists(abs)) {
      lines.push(plainLine(`cat: ${f}: No such file or directory`, 'err'));
      exit = 1;
    } else {
      push(splitLines(state.fs.read(abs) ?? ''));
    }
  }
  return { lines, exit };
};

const cd: Builtin = ({ args, state, ctx }) => {
  if (args.length > 2) return fail('sandbox: cd: too many arguments');
  const target = args[1];
  let dest: string;
  if (target === undefined || target === '~') dest = ctx.home;
  else if (target === '-') dest = state.oldCwd;
  else dest = state.fs.resolve(state.cwd, target);
  if (!state.fs.exists(dest)) return fail(`sandbox: cd: ${target}: No such file or directory`);
  if (!state.fs.isDir(dest)) return fail(`sandbox: cd: ${target}: Not a directory`);
  state.oldCwd = state.cwd;
  state.cwd = dest;
  state.env.set('OLDPWD', state.oldCwd);
  state.env.set('PWD', dest);
  return ok(target === '-' ? [text(displayPath(dest, ctx.home))] : []);
};

const pwd: Builtin = ({ state }) => ok([text(state.cwd)]);

const echo: Builtin = ({ args }) => {
  let rest = args.slice(1);
  let escapes = false;
  // `-n` (no trailing newline) has no visible effect in a line-based log, so it is only consumed.
  while (rest[0] === '-n' || rest[0] === '-e' || rest[0] === '-ne' || rest[0] === '-en') {
    if (rest[0]?.includes('e')) escapes = true;
    rest = rest.slice(1);
  }
  let out = rest.join(' ');
  if (escapes) out = out.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  return ok(out.split('\n').map(text));
};

const clear: Builtin = () => ({ lines: [], exit: 0, clear: true });

const history: Builtin = ({ state }) =>
  ok(state.history.map((h, i) => text(`${String(i + 1).padStart(5)}  ${h}`)));

const env: Builtin = ({ state }) => ok(Array.from(state.env, ([k, v]) => text(`${k}=${v}`)));

const exportCmd: Builtin = ({ args, state }) => {
  if (args.length === 1) {
    return ok(Array.from(state.env, ([k, v]) => text(`declare -x ${k}="${v}"`)));
  }
  for (const a of args.slice(1)) {
    const eq = a.indexOf('=');
    const name = eq < 0 ? a : a.slice(0, eq);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
      return fail(`sandbox: export: \`${a}': not a valid identifier`);
    if (eq >= 0) state.env.set(name, a.slice(eq + 1));
    else if (!state.env.has(name)) state.env.set(name, '');
  }
  return ok();
};

const unset: Builtin = ({ args, state }) => {
  for (const a of args.slice(1)) state.env.delete(a);
  return ok();
};

const whoami: Builtin = ({ ctx }) => ok([text(ctx.user)]);
const hostname: Builtin = ({ ctx }) => ok([text(ctx.host)]);

const which: Builtin = ({ args, ctx }) => {
  const lines: OutLine[] = [];
  let exit = 0;
  for (const a of args.slice(1)) {
    if (a in BUILTINS) lines.push(text(`/usr/bin/${a}`));
    else if (ctx.heads.includes(a)) lines.push(text(`/usr/local/bin/${a}`));
    else exit = 1;
  }
  return { lines, exit };
};

const date: Builtin = ({ ctx }) => {
  const d = new Date(ctx.now());
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const two = (n: number) => String(n).padStart(2, '0');
  return ok([
    text(
      `${day} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} UTC ${d.getUTCFullYear()}`,
    ),
  ]);
};

const uname: Builtin = ({ args }) => {
  if (args.includes('-m')) return ok([text('x86_64')]);
  if (args.includes('-a')) return ok([text('Linux sandbox 6.8.0 #1 SMP x86_64 GNU/Linux')]);
  return ok([text('Linux')]);
};

const mkdir: Builtin = ({ args, state, ctx }) => {
  const p = parseFlags(args.slice(1), 'p', 'mkdir');
  if (p.error) return fail(p.error);
  if (p.operands.length === 0) return fail('mkdir: missing operand');
  const lines: OutLine[] = [];
  let exit = 0;
  for (const d of p.operands) {
    const r = state.fs.mkdir(state.fs.resolve(state.cwd, d), ctx.now(), p.flags.has('p'));
    if (!r.ok) {
      lines.push(plainLine(`mkdir: cannot create directory '${d}': ${r.error}`, 'err'));
      exit = 1;
    }
  }
  return { lines, exit };
};

const touch: Builtin = ({ args, state, ctx }) => {
  if (args.length < 2) return fail('touch: missing file operand');
  const lines: OutLine[] = [];
  let exit = 0;
  for (const f of args.slice(1)) {
    const abs = state.fs.resolve(state.cwd, f);
    if (state.fs.isDir(abs)) continue;
    const existing = state.fs.read(abs);
    const r = state.fs.write(abs, existing ?? '', ctx.now());
    if (!r.ok) {
      lines.push(plainLine(`touch: cannot touch '${f}': ${r.error}`, 'err'));
      exit = 1;
    }
  }
  return { lines, exit };
};

const rm: Builtin = ({ args, state }) => {
  const p = parseFlags(args.slice(1), 'rfRv', 'rm');
  if (p.error) return fail(p.error);
  if (p.operands.length === 0) return fail('rm: missing operand');
  const recursive = p.flags.has('r') || p.flags.has('R');
  const force = p.flags.has('f');
  const lines: OutLine[] = [];
  let exit = 0;
  for (const f of p.operands) {
    const abs = state.fs.resolve(state.cwd, f);
    if (abs === '/') {
      lines.push(plainLine("rm: it is dangerous to operate recursively on '/'", 'err'));
      lines.push(plainLine('rm: use --no-preserve-root to override this failsafe', 'err'));
      exit = 1;
      continue;
    }
    if (!state.fs.exists(abs)) {
      if (!force) {
        lines.push(plainLine(`rm: cannot remove '${f}': No such file or directory`, 'err'));
        exit = 1;
      }
      continue;
    }
    if (state.fs.isDir(abs) && !recursive) {
      lines.push(plainLine(`rm: cannot remove '${f}': Is a directory`, 'err'));
      exit = 1;
      continue;
    }
    const r = state.fs.remove(abs, recursive);
    if (!r.ok) {
      lines.push(plainLine(`rm: cannot remove '${f}': ${r.error}`, 'err'));
      exit = 1;
    }
  }
  return { lines, exit };
};

// ---------------------------------------------------------------------------
// Filters (read standard input or files)
// ---------------------------------------------------------------------------

function readSources(
  operands: string[],
  stdin: string[] | null,
  state: ShellState,
  name: string,
): { sources: { label: string; lines: string[] }[]; errors: OutLine[] } {
  const sources: { label: string; lines: string[] }[] = [];
  const errors: OutLine[] = [];
  if (operands.length === 0) {
    sources.push({ label: '-', lines: stdin ?? [] });
    return { sources, errors };
  }
  for (const f of operands) {
    const abs = state.fs.resolve(state.cwd, f);
    if (f === '-') sources.push({ label: '-', lines: stdin ?? [] });
    else if (state.fs.isDir(abs)) errors.push(plainLine(`${name}: ${f}: Is a directory`, 'err'));
    else if (!state.fs.exists(abs)) errors.push(plainLine(`${name}: ${f}: No such file or directory`, 'err'));
    else sources.push({ label: f, lines: splitLines(state.fs.read(abs) ?? '') });
  }
  return { sources, errors };
}

function headTail(kind: 'head' | 'tail'): Builtin {
  return ({ args, stdin, state }) => {
    // `-5` is shorthand for `-n 5`.
    const normalized = args.slice(1).map((a) => (/^-\d+$/.test(a) ? `-n${a.slice(1)}` : a));
    const p = parseFlags(normalized, '', kind, 'n', { lines: 'n' });
    if (p.error) return fail(p.error);
    const n = Number(p.values.get('n') ?? '10');
    if (!Number.isInteger(n) || n < 0)
      return fail(`${kind}: invalid number of lines: '${p.values.get('n')}'`);
    const { sources, errors } = readSources(p.operands, stdin, state, kind);
    const lines: OutLine[] = [...errors];
    sources.forEach((src, i) => {
      if (sources.length > 1) {
        if (i > 0) lines.push(text(''));
        lines.push(text(`==> ${src.label} <==`));
      }
      const picked = kind === 'head' ? src.lines.slice(0, n) : n === 0 ? [] : src.lines.slice(-n);
      for (const l of picked) lines.push(text(l));
    });
    return { lines, exit: errors.length > 0 ? 1 : 0 };
  };
}

const wc: Builtin = ({ args, stdin, state }) => {
  const p = parseFlags(args.slice(1), 'lwc', 'wc');
  if (p.error) return fail(p.error);
  const { sources, errors } = readSources(p.operands, stdin, state, 'wc');
  const lines: OutLine[] = [...errors];
  const all = p.flags.size === 0;
  for (const src of sources) {
    const content = src.lines.join('\n') + (src.lines.length > 0 ? '\n' : '');
    const parts: string[] = [];
    if (all || p.flags.has('l')) parts.push(String(src.lines.length));
    if (all || p.flags.has('w')) parts.push(String(content.split(/\s+/).filter(Boolean).length));
    if (all || p.flags.has('c')) parts.push(String(new TextEncoder().encode(content).length));
    const label = src.label === '-' ? '' : ` ${src.label}`;
    lines.push(text(`${parts.join(' ')}${label}`));
  }
  return { lines, exit: errors.length > 0 ? 1 : 0 };
};

const grep: Builtin = ({ args, stdin, state }) => {
  const p = parseFlags(args.slice(1), 'ivcnFEwo', 'grep', 'e');
  if (p.error) return fail(p.error, 2);
  const patternArg = p.values.get('e') ?? p.operands.shift();
  if (patternArg === undefined) return fail('Usage: grep [OPTION]... PATTERNS [FILE]...', 2);
  const ignoreCase = p.flags.has('i');
  const fixed = p.flags.has('F');
  const invert = p.flags.has('v');
  const word = p.flags.has('w');
  let matcher: (line: string) => boolean;
  const src = word ? `\\b(?:${patternArg})\\b` : patternArg;
  let compiled: Pattern | null = null;
  if (!fixed) {
    try {
      compiled = new Pattern(ignoreCase ? lowerSource(src) : src);
    } catch (e) {
      if (!(e instanceof UnsupportedPattern)) throw e;
    }
  }
  if (compiled) {
    const pat = compiled;
    matcher = (line) => pat.exec(ignoreCase ? line.toLowerCase() : line, 20_000).match !== null;
  } else {
    const needle = ignoreCase ? patternArg.toLowerCase() : patternArg;
    matcher = (line) => (ignoreCase ? line.toLowerCase() : line).includes(needle);
  }
  const { sources, errors } = readSources(p.operands, stdin, state, 'grep');
  const lines: OutLine[] = [...errors];
  let matched = 0;
  const showName = sources.length > 1;
  for (const s of sources) {
    let count = 0;
    s.lines.forEach((l, idx) => {
      if (matcher(l) !== invert) {
        count += 1;
        matched += 1;
        if (!p.flags.has('c')) {
          const prefix = `${showName ? `${s.label}:` : ''}${p.flags.has('n') ? `${idx + 1}:` : ''}`;
          lines.push(text(`${prefix}${l}`));
        }
      }
    });
    if (p.flags.has('c')) lines.push(text(`${showName ? `${s.label}:` : ''}${count}`));
  }
  return { lines, exit: errors.length > 0 ? 2 : matched > 0 ? 0 : 1 };
};

/** Lowercase a pattern source without touching escapes like `\S` or `\d`. */
function lowerSource(src: string): string {
  let out = '';
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i] as string;
    if (c === '\\') {
      out += src.slice(i, i + 2);
      i += 1;
    } else out += c.toLowerCase();
  }
  return out;
}

const jq: Builtin = ({ args, stdin, state }) => {
  const rest = args.slice(1);
  let raw = false;
  let compact = false;
  let join = false;
  let filter: string | null = null;
  const files: string[] = [];
  for (const a of rest) {
    if (/^-[rcjeMSn]+$/.test(a)) {
      if (a.includes('r')) raw = true;
      if (a.includes('c')) compact = true;
      if (a.includes('j')) {
        raw = true;
        join = true;
      }
      continue;
    }
    if (a === '--raw-output') raw = true;
    else if (a === '--compact-output') compact = true;
    else if (a.startsWith('-') && a.length > 1 && filter === null && !/^-\d/.test(a)) {
      return {
        lines: [plainLine(`jq: error: option ${a} is not available in the sandbox`, 'err')],
        exit: 2,
      };
    } else if (filter === null) filter = a;
    else files.push(a);
  }
  if (filter === null) {
    return {
      lines: [
        text('Usage:\tjq [OPTIONS] FILTER [FILES...]'),
        text('Try `jq .` to print the input, or `jq .data` to pick the field named data.'),
      ],
      exit: 2,
    };
  }
  let input: string;
  if (files.length > 0) {
    const parts: string[] = [];
    for (const f of files) {
      const abs = state.fs.resolve(state.cwd, f);
      const content = state.fs.read(abs);
      if (content === null) {
        return {
          lines: [plainLine(`jq: error: Could not open ${f}: No such file or directory`, 'err')],
          exit: 2,
        };
      }
      parts.push(content);
    }
    input = parts.join('\n');
  } else if (stdin) {
    input = stdin.join('\n');
  } else {
    return {
      lines: [noteLine('jq reads JSON from a pipe or a file. Try: curl -s <url> | jq .')],
      exit: 2,
    };
  }

  let program: ReturnType<typeof compileJq>;
  try {
    program = compileJq(filter);
  } catch (e) {
    if (e instanceof JqError) {
      return {
        lines: [
          plainLine(`jq: error: ${e.message} at <top-level>, line 1:`, 'err'),
          plainLine(filter, 'err'),
          plainLine('jq: 1 compile error', 'err'),
        ],
        exit: 3,
      };
    }
    throw e;
  }

  const parsed = parseJsonStream(input);
  if (!parsed.ok) {
    return { lines: [plainLine(`jq: error (at <stdin>:0): ${parsed.error}`, 'err')], exit: 2 };
  }
  const out: OutLine[] = [];
  for (const value of parsed.values) {
    let results: unknown[];
    try {
      results = runJq(program, value);
    } catch (e) {
      if (e instanceof JqError) {
        out.push(plainLine(`jq: error (at <stdin>:1): ${e.message}`, 'err'));
        return { lines: out, exit: 5 };
      }
      throw e;
    }
    for (const r of results) {
      if (raw && typeof r === 'string') {
        if (join) out.push(text(r));
        else for (const l of r.split('\n')) out.push(text(l));
      } else if (compact) out.push(compactJson(r));
      else out.push(...prettyJson(r));
    }
  }
  return { lines: out, exit: 0 };
};

const trueCmd: Builtin = () => ok();
const falseCmd: Builtin = () => ({ lines: [], exit: 1 });
const sleep: Builtin = ({ args }) => {
  if (args.length < 2) return fail('sleep: missing operand');
  return ok();
};
const sudo: Builtin = () => ({
  lines: [noteLine('sudo is not needed here: this sandbox has no root and nothing in it can be damaged.')],
  exit: 1,
});
const exit: Builtin = () =>
  ok([
    noteLine('There is no session to leave. Pick another scenario, or press Reset to start this one again.'),
  ]);

const help: Builtin = ({ ctx }) => {
  const lines: OutLine[] = [];
  lines.push(text('This is a simulated shell. Nothing here touches your machine or the network.'));
  lines.push(text(''));
  const entries: { example: string; goal?: string }[] = [];
  for (const c of ctx.script.commands) {
    if (!c.example || entries.some((e) => e.example === c.example)) continue;
    entries.push({ example: c.example, goal: c.goal });
  }
  if (entries.length > 0) {
    lines.push(plainLine('Commands this scenario understands:', 'hi'));
    const width = Math.min(52, Math.max(...entries.map((e) => e.example.length)) + 2);
    for (const e of entries) {
      const label = e.goal ? ctx.goalLabels.get(e.goal) : undefined;
      const spans: Span[] = [{ text: `  ${e.example}`, kind: 'cmd' }];
      if (label) {
        spans.push({ text: ' '.repeat(Math.max(2, width - e.example.length)) });
        spans.push({ text: `# ${stripMarkup(label)}`, kind: 'dim' });
      }
      lines.push({ spans, text: spans.map((s) => s.text).join(''), channel: 'out' });
    }
    lines.push(text(''));
  }
  lines.push(
    plainLine(
      'Built in: ls  cat  cd  pwd  echo  env  export  history  whoami  which  clear  grep  head  tail  wc  jq',
      'dim',
    ),
  );
  lines.push(
    plainLine('Tab completes, Up and Down recall earlier commands, Esc cancels a running command.', 'dim'),
  );
  return ok(
    lines,
    'Lists what this scenario supports. The goals on the right show what to do and in what order.',
  );
};

export const BUILTINS: Record<string, Builtin> = {
  ls,
  cat,
  cd,
  pwd,
  echo,
  clear,
  history,
  env,
  export: exportCmd,
  unset,
  whoami,
  hostname,
  which,
  date,
  uname,
  mkdir,
  touch,
  rm,
  head: headTail('head'),
  tail: headTail('tail'),
  wc,
  grep,
  jq,
  true: trueCmd,
  false: falseCmd,
  sleep,
  sudo,
  exit,
  logout: exit,
  help,
};

/** A one or two sentence "what just happened" for builtins that have no script `explain`. */
export const BUILTIN_EXPLAIN: Record<string, string> = {
  ls: 'Lists the files in the current folder. `ls -l` adds sizes and dates, `ls -a` shows hidden files.',
  cat: 'Prints a file to the screen. It only reads the file; nothing is changed.',
  cd: 'Moves into another folder. The prompt always shows where you are.',
  pwd: 'Prints the full path of the folder you are in.',
  echo: 'Prints its arguments. A word starting with `$` is replaced by that variable first.',
  env: 'Lists the environment variables this shell has. Programs read them to configure themselves.',
  export: 'Sets an environment variable for the commands you run next.',
  history: 'Lists the commands you have run in this scenario. Up and Down recall them.',
  whoami: 'Prints the name of the user running the shell.',
  which: 'Shows where a program lives, or prints nothing when there is none.',
  grep: 'Keeps only the lines that contain the pattern.',
  head: 'Prints the first lines of its input.',
  tail: 'Prints the last lines of its input.',
  wc: 'Counts lines, words and bytes.',
  jq: 'jq reads JSON and prints the part you ask for. `.data` is the field named data, `[]` walks an array.',
  date: 'Prints the current date and time in this shell.',
  mkdir: 'Creates a folder in the simulated file system.',
  touch: 'Creates an empty file, or refreshes the time of an existing one.',
  rm: 'Removes a file from the simulated file system.',
  uname: 'Prints details of the operating system and processor.',
  hostname: 'Prints the name of this machine.',
};
