/**
 * Engine types. The engine is framework free: it knows nothing about React, the DOM or timers
 * (the session takes a scheduler). Input is the lesson contract's `TerminalScript`
 * (web/src/learn/types.ts); everything here is what the engine produces from it.
 */

import type { TerminalCommand, TerminalScript } from '@/learn/types';

export type { TerminalCommand, TerminalScript };

/**
 * A scripted command as the engine reads it: the contract's `TerminalCommand` plus the optional
 * sequencing field. `requires` lists conditions that must hold for the entry to match, so a
 * script can be stateful without code:
 *
 * - `build`        the goal (or hidden flag) `build` was completed earlier
 * - `!stop`        the goal `stop` was NOT completed
 * - `a|b`          either `a` or `b`
 * - `file:Dockerfile`  the file exists relative to the working directory (`!file:x` for absent)
 * - `file:/img/{1}=linux/amd64`  the file exists and holds exactly that text
 *
 * `{1}` and friends are this entry's captures, so a command can depend on what it was given.
 * All items must hold (AND). An entry whose requirements fail is skipped and the next matching
 * entry is tried, so a failure variant simply follows the happy path in the list. Put the entry
 * that carries a goal and an `example` first: the lesson validator, which does not know
 * `requires`, checks that the example reaches its own entry first.
 *
 * Output lines, `explain` and `writes` (keys and values) may use `{0}`..`{9}`, `{input}`, `{cwd}`,
 * `{user}`, `{host}` and `{file:/path}` (the text of a virtual file, which lets a command show
 * what an earlier command stored).
 */
export interface ScriptedCommand extends TerminalCommand {
  requires?: string[];
  /**
   * Further goal ids this command completes besides `goal`. Use it when one command can honestly
   * satisfy two goals (building straight for linux/amd64 also counts as "build the image").
   * The lesson validator does not know this field, so every goal must still be carried by some
   * command's `goal`.
   */
  also?: string[];
  /**
   * The entry prints nothing itself. When it matches, the line still runs as ordinary shell
   * (builtins, pipes, the script's other commands) and the goal is credited only if the whole line
   * exits with status 0. Use it to credit "any `jq` filter on a real response" or "cat a file"
   * without scripting the output.
   */
  passthrough?: boolean;
  /**
   * Treat the output as a table: cells are separated by a tab and the engine aligns the columns
   * after templating (widest cell of a column plus three spaces). Use it when a cell comes from a
   * capture or a `{file:}` value, so its width is not known when the script is written.
   */
  table?: boolean;
}

export interface ScriptWithRequires extends Omit<TerminalScript, 'commands'> {
  commands: ScriptedCommand[];
}

/** Span kinds. The four contract tags are ok, warn, err and dim; the rest serve the engine's own output. */
export type SpanKind =
  | 'ok'
  | 'warn'
  | 'err'
  | 'dim'
  | 'note'
  | 'key'
  | 'str'
  | 'num'
  | 'kw'
  | 'flag'
  | 'cmd'
  | 'path'
  | 'hi';

export interface Span {
  text: string;
  kind?: SpanKind;
}

export type LineTone = 'ok' | 'warn' | 'err' | 'dim';

export interface OutLine {
  spans: Span[];
  /** Plain text without markup: what Copy and screen readers get. */
  text: string;
  /**
   * `out` is program output (it flows through pipes and redirects). `note` is the sandbox itself
   * talking: never piped, always styled as the simulator's voice.
   */
  channel: 'out' | 'note';
  /** Whole-line tone from a prefix tag. */
  tone?: LineTone;
  /** A row of an aligned table (see `ScriptedCommand.table`): the view keeps it on one line and scrolls sideways. */
  table?: boolean;
}

export interface GoalState {
  id: string;
  label: string;
  done: boolean;
  /** 1-based position in the order the learner completed them, 0 while open. */
  order: number;
  /** True for the first open goal in script order. */
  next: boolean;
}

export type EntryKind = 'intro' | 'command';
export type EntryState = 'streaming' | 'done' | 'cancelled';

/** How a line ended up being handled. */
export type RunKind = 'empty' | 'scripted' | 'builtin' | 'not-found' | 'error' | 'refused';

export interface TranscriptEntry {
  id: number;
  kind: EntryKind;
  /** The sanitised line the learner submitted. Empty for the intro. */
  input: string;
  /** Working directory at the time (for the echoed prompt). */
  cwd: string;
  lines: OutLine[];
  /** Lines revealed so far, while streaming. */
  shown: number;
  state: EntryState;
  /** "What just happened", already templated. */
  explain: string | null;
  /** Goal ids this command completed, in the order they completed. */
  goals: string[];
  runKind: RunKind;
  exit: number;
  /**
   * True when the host typed and ran the line (a next-step chip, "Show me"), not the learner. A lesson host
   * reads it to tell a failed attempt of the learner from a command the player ran for them.
   */
  assisted?: boolean;
}

export interface SessionState {
  entries: TranscriptEntry[];
  goals: GoalState[];
  /** Goal ids in the order they were completed. */
  completed: string[];
  allDone: boolean;
  cwd: string;
  /** True while a command is streaming. */
  busy: boolean;
  /** Increments on every change. Handy as a React key or effect dependency. */
  version: number;
}

export interface PromptInfo {
  user: string;
  host: string;
  /** Shown working directory, with `~` for home. */
  cwd: string;
  symbol: string;
}

export interface Scheduler {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface CompletionResult {
  /** Full replacement lines, best first. */
  candidates: string[];
  /** The longest common prefix of the candidates (may equal the input). */
  common: string;
  /** The single best inline suggestion's remaining text, or ''. */
  ghost: string;
}
