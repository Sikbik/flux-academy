/**
 * Running one submitted line against the shell state.
 *
 * Order of business (kept identical to the lesson validator's model, validate-terminal.ts):
 *
 * 1. The whole trimmed line is tested against each scripted command in array order, anchored as
 *    `^(?:match)$`; the first match whose `requires` hold wins. So a script that validates always
 *    completes its goals with its `example`s.
 * 2. Otherwise the line is parsed as shell: `&&`, `||`, `;`, `|`, `>` and `>>`. Each simple
 *    command is matched against the script the same way, then against the builtins, then it is a
 *    near miss with a nudge.
 *
 * The state passed in is a working copy: this function mutates it freely and the session decides
 * whether to keep it (the command finished) or drop it (the command was cancelled).
 */

import { BUILTIN_EXPLAIN, BUILTINS } from './builtins';
import { displayPath } from './fs';
import { noteLine, parseMarkup, plainLine } from './markup';
import { MAX_OUTPUT_LINES, sanitizeOutput } from './sanitize';
import type { EngineContext, ShellState } from './state';
import { alignTable } from './table';
import { applyTemplate, nearest, nearestWord, type TemplateVars } from './text';
import { type CommandNode, expandWord, parseList, tokenize, type WordToken } from './tokenize';
import type { OutLine, RunKind, ScriptedCommand } from './types';

/** Milliseconds between streamed lines when a command does not say. */
export const DEFAULT_STREAM_MS = 40;

export const DEFAULT_NOT_FOUND = '[err]sandbox: nothing is set up for `{input}` in this scenario.';

export interface RunResult {
  input: string;
  kind: RunKind;
  lines: OutLine[];
  exit: number;
  explain: string | null;
  /** Declared goal ids newly completed by this line, in the order they completed. */
  goals: string[];
  /** Base milliseconds between streamed lines. 0 prints everything at once. */
  streamMs: number;
  clear: boolean;
  /** Scripted commands that ran. */
  scripted: number;
  /** Indices into `script.commands` of the scripted commands that ran, in order. */
  matched: number[];
}

interface Accumulator {
  lines: OutLine[];
  explains: string[];
  goals: string[];
  streamMs: number;
  scripted: number;
  matched: number[];
  builtins: number;
  notFound: number;
  clear: boolean;
  piped: boolean;
  /** Passthrough entries that matched; credited when the whole line exits 0. */
  credits: ScriptedHit[];
  /** A script author explained the whole line, so nothing else is added to the explanation. */
  authored: boolean;
}

const NOT_RUN_EXPLAIN =
  'The sandbox only runs the commands this scenario is built around, so it did not run that one and nothing changed. `help` lists what works.';

const PIPE_EXPLAIN = 'The pipe `|` hands the output of the command on its left to the command on its right.';

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

function evalRequirement(item: string, state: ShellState): boolean {
  let neg = false;
  let body = item.trim();
  if (body.startsWith('!')) {
    neg = true;
    body = body.slice(1);
  }
  const alternatives = body.split('|');
  const hit = alternatives.some((a) => {
    const alt = a.trim();
    if (alt.startsWith('file:')) {
      // `file:path` exists; `file:path=text` exists and holds exactly that text.
      const spec = alt.slice(5);
      const eq = spec.indexOf('=');
      const path = state.fs.resolve(state.cwd, eq < 0 ? spec : spec.slice(0, eq));
      if (eq < 0) return state.fs.exists(path);
      return state.fs.read(path)?.trim() === spec.slice(eq + 1);
    }
    return state.flags.has(alt);
  });
  return hit !== neg;
}

/** Do all `requires` of a command hold? Items may use `{n}` captures, for example `file:img/{1}`. */
export function requirementsHold(
  cmd: ScriptedCommand,
  groups: readonly (string | undefined)[],
  state: ShellState,
): boolean {
  for (const item of cmd.requires ?? []) {
    if (!evalRequirement(applyTemplate(item, { groups }), state)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Scripted matching
// ---------------------------------------------------------------------------

interface ScriptedHit {
  cmd: ScriptedCommand;
  /** Position in `script.commands`. */
  index: number;
  groups: (string | undefined)[];
  /** The candidate text that matched (what `{input}` stands for). */
  text: string;
}

function findScripted(
  candidates: readonly string[],
  state: ShellState,
  ctx: EngineContext,
): ScriptedHit | null {
  const commands = ctx.script.commands;
  for (let index = 0; index < commands.length; index += 1) {
    const cmd = commands[index] as ScriptedCommand;
    const pat = ctx.patterns.get(cmd.match);
    if (!pat.usable) continue;
    for (const cand of candidates) {
      const groups = pat.exec(cand);
      if (groups && requirementsHold(cmd, groups, state)) return { cmd, index, groups, text: cand };
    }
  }
  return null;
}

/** The scripted command a line would run as a whole line, or null. Used by completion and tests. */
export function matchWholeLine(line: string, state: ShellState, ctx: EngineContext): ScriptedHit | null {
  return findScripted([line.trim()], state, ctx);
}

function markGoal(id: string, state: ShellState, ctx: EngineContext, acc: Accumulator): void {
  state.flags.add(id);
  if (ctx.goalIds.has(id) && !state.completed.includes(id)) {
    state.completed.push(id);
    acc.goals.push(id);
  }
}

function templateLine(src: string, vars: TemplateVars): OutLine {
  const parsed = parseMarkup(src);
  const spans = parsed.spans.map((s) => ({ ...s, text: sanitizeOutput(applyTemplate(s.text, vars)) }));
  const out: OutLine = { ...parsed, spans, text: spans.map((s) => s.text).join('') };
  return out;
}

function execScripted(
  hit: ScriptedHit,
  line: string,
  state: ShellState,
  ctx: EngineContext,
  acc: Accumulator,
): number {
  const { cmd, groups } = hit;
  const vars: TemplateVars = {
    groups,
    input: line,
    cwd: displayPath(state.cwd, ctx.home),
    user: ctx.user,
    host: ctx.host,
    readFile: (path) => state.fs.read(state.fs.resolve(state.cwd, path)),
  };
  const templated = (cmd.output ?? []).map((src) => templateLine(src, vars));
  const lines = cmd.table ? alignTable(templated) : templated;
  for (const [path, content] of Object.entries(cmd.writes ?? {})) {
    const abs = state.fs.resolve(state.cwd, applyTemplate(path, vars));
    state.fs.put(abs, applyTemplate(content, vars), ctx.now());
  }
  acc.lines.push(...lines);
  if (cmd.explain) acc.explains.push(applyTemplate(cmd.explain, vars));
  acc.streamMs = Math.max(acc.streamMs, cmd.stream ?? DEFAULT_STREAM_MS);
  acc.scripted += 1;
  acc.matched.push(hit.index);
  if (cmd.goal) markGoal(cmd.goal, state, ctx, acc);
  for (const extra of cmd.also ?? []) markGoal(extra, state, ctx, acc);
  return lines.some((l) => l.tone === 'err') ? 1 : 0;
}

/** Remember a passthrough hit so it can be credited once the line has run (once per entry). */
function deferCredit(hit: ScriptedHit, acc: Accumulator): void {
  if (!acc.credits.some((c) => c.index === hit.index)) acc.credits.push(hit);
}

/** Credit passthrough entries after a line that exited 0: writes, explain and goals, no output. */
function settleCredits(line: string, state: ShellState, ctx: EngineContext, acc: Accumulator): void {
  for (const hit of acc.credits) {
    const { cmd, groups } = hit;
    const vars: TemplateVars = {
      groups,
      input: line,
      cwd: displayPath(state.cwd, ctx.home),
      user: ctx.user,
      host: ctx.host,
      readFile: (path) => state.fs.read(state.fs.resolve(state.cwd, path)),
    };
    for (const [path, content] of Object.entries(cmd.writes ?? {})) {
      const abs = state.fs.resolve(state.cwd, applyTemplate(path, vars));
      state.fs.put(abs, applyTemplate(content, vars), ctx.now());
    }
    // The author explained the whole line, so this replaces what the segments said.
    if (cmd.explain) {
      acc.explains = [applyTemplate(cmd.explain, vars)];
      acc.authored = true;
    }
    acc.matched.push(hit.index);
    if (cmd.goal) markGoal(cmd.goal, state, ctx, acc);
    for (const extra of cmd.also ?? []) markGoal(extra, state, ctx, acc);
  }
  acc.credits = [];
}

// ---------------------------------------------------------------------------
// Shell execution
// ---------------------------------------------------------------------------

function notFound(cmd: CommandNode, argv: string[], ctx: EngineContext, acc: Accumulator): number {
  const head = argv[0] ?? '';
  const template = ctx.script.notFound ?? DEFAULT_NOT_FOUND;
  acc.lines.push(templateLine(template, { input: cmd.raw, cmd: head }));
  const near = nearest(cmd.raw, ctx.examples);
  if (near) {
    acc.lines.push(
      noteLine(
        near.kind === 'typo'
          ? `Did you mean \`${near.suggestion}\`?`
          : `Close. This scenario expects: \`${near.suggestion}\``,
      ),
    );
  } else {
    const word = nearestWord(head, [...Object.keys(BUILTINS), ...ctx.heads]);
    if (word && word !== head) acc.lines.push(noteLine(`Did you mean \`${word}\`?`));
  }
  acc.lines.push(plainLine('Type help to see what works in this scenario.', 'dim'));
  acc.notFound += 1;
  return 127;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

function runCommand(
  cmd: CommandNode,
  stdin: string[] | null,
  state: ShellState,
  ctx: EngineContext,
  acc: Accumulator,
): { lines: OutLine[]; exit: number } {
  const before = acc.lines.length;
  const sink = (): OutLine[] => acc.lines.splice(before);

  // Expand variables and globs now, with the environment as earlier commands left it.
  const expandOpts = { env: state.env, home: ctx.home, lastExit: state.lastExit };
  const words: WordToken[] = [];
  for (const w of cmd.words) {
    const e = expandWord(w.raw, expandOpts);
    if (e.error) {
      acc.lines.push(plainLine(`sandbox: ${e.error}`, 'err'));
      return { lines: sink(), exit: 1 };
    }
    words.push(...e.words);
  }
  const argv: string[] = [];
  for (const w of words) {
    if (w.glob && !w.quoted) {
      const matches = state.fs.glob(state.cwd, w.value);
      if (matches.length > 0) {
        argv.push(...matches);
        continue;
      }
    }
    argv.push(w.value);
  }
  if (argv.length === 0) return { lines: [], exit: 0 };

  // Plain assignments set shell variables.
  if (cmd.words.every((w) => ASSIGNMENT.test(w.raw))) {
    for (const w of words) {
      const eq = w.value.indexOf('=');
      state.env.set(w.value.slice(0, eq), w.value.slice(eq + 1));
    }
    return { lines: [], exit: 0 };
  }

  // Scripted commands first: raw text as typed, then quotes removed and variables expanded.
  const normalized = words.map((w) => w.value).join(' ');
  const candidates =
    normalized === cmd.raw
      ? [cmd.raw]
      : cmd.raw.includes('$')
        ? [normalized, cmd.raw]
        : [cmd.raw, normalized];
  const hit = findScripted(candidates, state, ctx);
  if (hit?.cmd.passthrough) {
    deferCredit(hit, acc);
  } else if (hit) {
    const exit = execScripted(hit, cmd.raw, state, ctx, acc);
    return { lines: sink(), exit };
  }

  const name = argv[0] as string;
  const builtin = BUILTINS[name];
  if (builtin) {
    const out = builtin({ args: argv, stdin, state, ctx });
    acc.builtins += 1;
    if (out.clear) acc.clear = true;
    const explain = out.explain ?? BUILTIN_EXPLAIN[name];
    if (explain) acc.explains.push(explain);
    return { lines: out.lines, exit: out.exit };
  }

  const exit = notFound(cmd, argv, ctx, acc);
  return { lines: sink(), exit };
}

function runPipeline(
  commands: CommandNode[],
  state: ShellState,
  ctx: EngineContext,
  acc: Accumulator,
): number {
  let stdin: string[] | null = null;
  let exit = 0;
  /** Sandbox remarks about the commands that feed a pipe: shown before the last command's output. */
  const notes: OutLine[] = [];
  let final: OutLine[] = [];
  commands.forEach((cmd, k) => {
    const last = k === commands.length - 1;
    const r = runCommand(cmd, stdin, state, ctx, acc);
    exit = r.exit;
    if (last) {
      final = r.lines;
      return;
    }
    for (const l of r.lines) if (l.channel === 'note') notes.push(l);
    stdin = r.lines.filter((l) => l.channel === 'out').map((l) => l.text);
  });
  if (commands.length > 1) acc.piped = true;
  acc.lines.push(...notes);

  const redirect = (commands[commands.length - 1] as CommandNode).redirect;
  if (redirect) {
    // What is redirected is program output; the sandbox's own remarks still show.
    acc.lines.push(...final.filter((l) => l.channel === 'note'));
    const written = final.filter((l) => l.channel === 'out');
    const target = expandWord(redirect.target.raw, {
      env: state.env,
      home: ctx.home,
      lastExit: state.lastExit,
    }).words[0]?.value;
    if (target === undefined || target === '') {
      acc.lines.push(plainLine('sandbox: ambiguous redirect', 'err'));
      return 1;
    }
    const abs = state.fs.resolve(state.cwd, target);
    if (target === '/dev/null') return exit;
    const body = written.map((l) => l.text).join('\n') + (written.length > 0 ? '\n' : '');
    const r = state.fs.write(abs, body, ctx.now(), redirect.op === '>>');
    if (!r.ok) {
      acc.lines.push(plainLine(`sandbox: ${target}: ${r.error}`, 'err'));
      return 1;
    }
    return exit;
  }
  acc.lines.push(...final);
  return exit;
}

function finish(input: string, acc: Accumulator, exit: number, errorKind?: RunKind): RunResult {
  let lines = acc.lines;
  if (lines.length > MAX_OUTPUT_LINES) {
    lines = [
      ...lines.slice(0, MAX_OUTPUT_LINES),
      noteLine(`Output cut after ${MAX_OUTPUT_LINES} lines in the sandbox.`),
    ];
  }
  // A pipe line says what the pipe does after the first thing worth saying; otherwise two sentences.
  const explains =
    acc.piped && !acc.authored ? [...acc.explains.slice(0, 1), PIPE_EXPLAIN] : [...acc.explains];
  if (acc.notFound > 0 && acc.scripted === 0 && explains.length === 0) explains.push(NOT_RUN_EXPLAIN);
  const kind: RunKind =
    errorKind ??
    (acc.notFound > 0 ? 'not-found' : acc.scripted > 0 ? 'scripted' : acc.builtins > 0 ? 'builtin' : 'empty');
  return {
    input,
    kind,
    lines,
    exit,
    explain: explains.length > 0 ? explains.slice(0, 2).join(' ') : null,
    goals: acc.goals,
    streamMs: acc.streamMs,
    clear: acc.clear,
    scripted: acc.scripted,
    matched: acc.matched,
  };
}

function newAccumulator(): Accumulator {
  return {
    lines: [],
    explains: [],
    goals: [],
    streamMs: 0,
    scripted: 0,
    matched: [],
    builtins: 0,
    notFound: 0,
    clear: false,
    piped: false,
    credits: [],
    authored: false,
  };
}

/** Run one sanitised, trimmed line. Mutates `state`. */
export function runLine(state: ShellState, line: string, ctx: EngineContext): RunResult {
  const acc = newAccumulator();
  if (line === '') return finish(line, acc, state.lastExit, 'empty');

  const tk = tokenize(line, { env: state.env, home: ctx.home, lastExit: state.lastExit, expand: false });

  // 1. The whole line, as the validator models it. Variables are expanded for a second candidate.
  let candidates = [line];
  if (!tk.error && tk.tokens.length > 0 && tk.tokens.every((t) => t.type === 'word')) {
    const expandOpts = { env: state.env, home: ctx.home, lastExit: state.lastExit };
    const parts: string[] = [];
    let broken = false;
    for (const t of tk.tokens) {
      const e = expandWord((t as WordToken).raw, expandOpts);
      if (e.error) broken = true;
      parts.push(...e.words.map((w) => w.value));
    }
    const normalized = parts.join(' ');
    if (!broken && normalized !== line)
      candidates = line.includes('$') ? [normalized, line] : [line, normalized];
  }
  const whole = findScripted(candidates, state, ctx);
  if (whole?.cmd.passthrough) {
    deferCredit(whole, acc);
  } else if (whole) {
    const exit = execScripted(whole, line, state, ctx, acc);
    state.lastExit = exit;
    return finish(line, acc, exit);
  }

  // 2. The line as shell.
  if (tk.error) {
    acc.lines.push(plainLine(`sandbox: ${tk.error}`, 'err'));
    state.lastExit = 2;
    return finish(line, acc, 2, 'error');
  }
  const parsed = parseList(tk.tokens, line);
  if (parsed.error) {
    acc.lines.push(plainLine(`sandbox: ${parsed.error}`, 'err'));
    state.lastExit = 2;
    return finish(line, acc, 2, 'error');
  }
  if (parsed.items.length === 0) return finish(line, acc, state.lastExit, 'empty');

  let exit = state.lastExit;
  for (const item of parsed.items) {
    if (item.join === '&&' && exit !== 0) continue;
    if (item.join === '||' && exit === 0) continue;
    exit = runPipeline(item.pipeline, state, ctx, acc);
    state.lastExit = exit;
  }
  if (exit === 0) settleCredits(line, state, ctx, acc);
  return finish(line, acc, exit);
}
