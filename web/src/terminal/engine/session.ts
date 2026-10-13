/**
 * The terminal session: the stateful object the view renders. It owns the shell state, the
 * transcript, the goals and the history, and it plays command output at the pace the script asks
 * for. Framework free: timers come from a `Scheduler`, so tests drive it by hand and a replay is
 * deterministic.
 *
 * Lifecycle of a command:
 *
 *   submit(line)  -> the line is run against a working copy of the shell state at once; its
 *                    output is queued and revealed line by line (`streaming`)
 *   skip()        -> reveal the rest immediately
 *   finish        -> the working copy becomes the real state, goals are credited and reported
 *   cancel()      -> the command is aborted: `^C` is printed and nothing from it counts
 *
 * Submitting while a command streams finishes it first, like type-ahead in a real terminal.
 */

import { completeLine, orderedExamples } from './complete';
import { displayPath } from './fs';
import { parseMarkup, plainLine } from './markup';
import { PatternCache } from './regex';
import { type RunResult, requirementsHold, runLine } from './run';
import { sanitizeInput } from './sanitize';
import {
  cloneState,
  createContext,
  createState,
  type EngineContext,
  SHELL_HOST,
  SHELL_USER,
  type ShellState,
} from './state';
import { lineDelays, realScheduler } from './stream';
import type {
  CompletionResult,
  GoalState,
  PromptInfo,
  Scheduler,
  ScriptedCommand,
  SessionState,
  TerminalScript,
  TranscriptEntry,
} from './types';

export interface SessionOptions {
  script: TerminalScript;
  scheduler?: Scheduler;
  /** Clock for `date` and file times. Default: `Date.now`. */
  now?: () => number;
  /** Read at every submit: when true, output appears at once. */
  reducedMotion?: () => boolean;
  /** Never stream: every command finishes inside `submit`. For tests and article views. */
  instant?: boolean;
  /** Earlier commands, oldest first. */
  history?: string[];
  /** Seed for the output rhythm. */
  seed?: number;
  /** Diagnostic hook for authors: a pattern was refused or switched off. */
  onPatternTrip?: (source: string, reason: string) => void;
}

export interface SubmitOptions {
  /** The host, not the learner, typed this line (a chip or "Show me"). Recorded on the entry. */
  assisted?: boolean;
}

export interface SubmitHandle {
  /** Entry id, or -1 when nothing ran (an empty line). */
  id: number;
  /** Resolves when the command has finished streaming, was skipped or was cancelled. */
  finished: Promise<void>;
}

export interface CommandEvent {
  entry: TranscriptEntry;
  result: RunResult;
}

export interface PlanStep {
  goal: string;
  line: string;
}

const MAX_HISTORY = 200;
const MAX_ENTRIES = 80;

type Listener = () => void;

export class TerminalSession {
  readonly script: TerminalScript;
  private readonly ctx: EngineContext;
  private readonly scheduler: Scheduler;
  private readonly reduced: () => boolean;
  private readonly instant: boolean;
  private readonly seed: number;

  private committed: ShellState;
  private entries: TranscriptEntry[] = [];
  private history: string[];
  private nextId = 1;
  private version = 0;
  private snapshot: SessionState | null = null;

  private running: {
    entry: TranscriptEntry;
    working: ShellState;
    result: RunResult;
    delays: number[];
    timer: unknown;
    resolve: () => void;
  } | null = null;

  private readonly listeners = new Set<Listener>();
  private readonly goalListeners = new Set<(goalId: string) => void>();
  private readonly commandListeners = new Set<(e: CommandEvent) => void>();
  private disposed = false;

  constructor(options: SessionOptions) {
    this.script = options.script;
    this.scheduler = options.scheduler ?? realScheduler;
    this.reduced = options.reducedMotion ?? (() => false);
    this.instant = options.instant ?? false;
    this.seed = options.seed ?? 1;
    this.history = (options.history ?? []).slice(-MAX_HISTORY);
    this.ctx = createContext(options.script, {
      now: options.now,
      patterns: new PatternCache({ onTrip: options.onPatternTrip }),
    });
    this.committed = createState(this.ctx);
    this.pushIntro();
  }

  // -- subscriptions -------------------------------------------------------

  /** React's `useSyncExternalStore` contract: returns the unsubscribe function. */
  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  onGoal(fn: (goalId: string) => void): () => void {
    this.goalListeners.add(fn);
    return () => this.goalListeners.delete(fn);
  }

  onCommand(fn: (e: CommandEvent) => void): () => void {
    this.commandListeners.add(fn);
    return () => this.commandListeners.delete(fn);
  }

  private emit(): void {
    this.version += 1;
    this.snapshot = null;
    for (const l of Array.from(this.listeners)) l();
  }

  // -- state ---------------------------------------------------------------

  /** An immutable snapshot, stable between changes (safe for `useSyncExternalStore`). */
  getState = (): SessionState => {
    if (this.snapshot) return this.snapshot;
    this.snapshot = this.buildState();
    return this.snapshot;
  };

  private buildState(): SessionState {
    const done = new Set(this.committed.completed);
    let nextMarked = false;
    const goals: GoalState[] = this.script.goals.map((g) => {
      const isDone = done.has(g.id);
      const next = !isDone && !nextMarked;
      if (next) nextMarked = true;
      return {
        id: g.id,
        label: g.label,
        done: isDone,
        order: isDone ? this.committed.completed.indexOf(g.id) + 1 : 0,
        next,
      };
    });
    return {
      entries: this.entries.slice(),
      goals,
      completed: [...this.committed.completed],
      allDone: goals.length > 0 && goals.every((g) => g.done),
      cwd: this.committed.cwd,
      busy: this.running !== null,
      version: this.version,
    };
  }

  /** The prompt as the shell prints it now. */
  prompt(): PromptInfo {
    return {
      user: SHELL_USER,
      host: SHELL_HOST,
      cwd: displayPath(this.committed.cwd, this.ctx.home),
      symbol: this.script.prompt ?? '$',
    };
  }

  get historyList(): readonly string[] {
    return this.history;
  }

  get busy(): boolean {
    return this.running !== null;
  }

  // -- running commands ------------------------------------------------------

  private pushIntro(): void {
    const lines = (this.script.intro ?? []).map((l) => parseMarkup(l));
    this.entries = [
      {
        id: this.nextId++,
        kind: 'intro',
        input: '',
        cwd: displayPath(this.committed.cwd, this.ctx.home),
        lines,
        shown: lines.length,
        state: 'done',
        explain: null,
        goals: [],
        runKind: 'empty',
        exit: 0,
      },
    ];
  }

  private remember(line: string): void {
    if (this.history[this.history.length - 1] !== line) this.history.push(line);
    if (this.history.length > MAX_HISTORY) this.history.splice(0, this.history.length - MAX_HISTORY);
  }

  /** Run a line. Returns a handle whose `finished` promise resolves when streaming is over. */
  submit(raw: string, options?: SubmitOptions): SubmitHandle {
    if (this.disposed) return { id: -1, finished: Promise.resolve() };
    if (this.running) this.skip();

    const clean = sanitizeInput(raw);
    if (clean.tooLong) {
      const entry = this.addEntry({
        input: String(raw).slice(0, 60).replace(/\s+/g, ' ').concat('…'),
        lines: [plainLine('sandbox: that line is too long (the limit is 1000 characters).', 'err')],
        runKind: 'refused',
        exit: 1,
      });
      this.emit();
      return { id: entry.id, finished: Promise.resolve() };
    }
    if (clean.line === '') return { id: -1, finished: Promise.resolve() };

    const line = clean.line;
    this.remember(line);
    const working = cloneState(this.committed);
    working.history = [...this.history];
    const cwdBefore = displayPath(this.committed.cwd, this.ctx.home);
    const result = runLine(working, line, this.ctx);

    if (result.clear) {
      this.committed = working;
      this.entries = [];
      this.emit();
      return { id: -1, finished: Promise.resolve() };
    }

    const entry = this.addEntry({
      input: line,
      cwd: cwdBefore,
      lines: result.lines,
      runKind: result.kind,
      exit: result.exit,
      explain: result.explain,
      ...(options?.assisted ? { assisted: true } : {}),
    });

    const instant = this.instant || this.reduced() || result.streamMs <= 0 || result.lines.length === 0;
    let resolve: () => void = () => {};
    const finished = new Promise<void>((r) => {
      resolve = r;
    });
    this.running = {
      entry,
      working,
      result,
      delays: lineDelays(result.lines, result.streamMs, this.seed + entry.id),
      timer: null,
      resolve,
    };
    if (instant) {
      this.finishRunning();
    } else {
      entry.state = 'streaming';
      entry.shown = 0;
      this.emit();
      this.scheduleNext();
    }
    return { id: entry.id, finished };
  }

  private addEntry(
    partial: Pick<TranscriptEntry, 'input' | 'lines' | 'runKind' | 'exit'> & Partial<TranscriptEntry>,
  ): TranscriptEntry {
    const entry: TranscriptEntry = {
      id: this.nextId++,
      kind: 'command',
      cwd: displayPath(this.committed.cwd, this.ctx.home),
      shown: partial.lines.length,
      state: 'done',
      explain: null,
      goals: [],
      ...partial,
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    return entry;
  }

  private scheduleNext(): void {
    const run = this.running;
    if (!run) return;
    const delay = run.delays[run.entry.shown] ?? 0;
    run.timer = this.scheduler.setTimeout(() => {
      const r = this.running;
      if (!r || r !== run) return;
      r.entry = { ...r.entry, shown: r.entry.shown + 1 };
      this.replaceEntry(r.entry);
      if (r.entry.shown >= r.entry.lines.length) this.finishRunning();
      else {
        this.emit();
        this.scheduleNext();
      }
    }, delay);
  }

  private replaceEntry(entry: TranscriptEntry): void {
    const i = this.entries.findIndex((e) => e.id === entry.id);
    if (i >= 0) this.entries[i] = entry;
  }

  /** Reveal everything and finish the running command (any key does this in the view). */
  skip(): void {
    if (!this.running) return;
    this.finishRunning();
  }

  private finishRunning(): void {
    const run = this.running;
    if (!run) return;
    if (run.timer !== null) this.scheduler.clearTimeout(run.timer);
    this.running = null;
    this.committed = run.working;
    const entry: TranscriptEntry = {
      ...run.entry,
      shown: run.entry.lines.length,
      state: 'done',
      goals: run.result.goals,
    };
    this.replaceEntry(entry);
    this.emit();
    for (const g of run.result.goals) for (const l of Array.from(this.goalListeners)) l(g);
    for (const l of Array.from(this.commandListeners)) l({ entry, result: run.result });
    run.resolve();
  }

  /** Abort the running command: print `^C`, discard everything it would have changed. */
  cancel(): void {
    const run = this.running;
    if (!run) return;
    if (run.timer !== null) this.scheduler.clearTimeout(run.timer);
    this.running = null;
    const visible = run.entry.lines.slice(0, run.entry.shown);
    const entry: TranscriptEntry = {
      ...run.entry,
      lines: [...visible, plainLine('^C', 'dim')],
      shown: visible.length + 1,
      state: 'cancelled',
      explain: 'You interrupted the command, so nothing it would have done counts. Run it again to finish.',
      goals: [],
      exit: 130,
    };
    this.replaceEntry(entry);
    this.emit();
    run.resolve();
  }

  /** Back to the start of the scenario. History is kept, like a real shell's. */
  reset(): void {
    if (this.running) {
      if (this.running.timer !== null) this.scheduler.clearTimeout(this.running.timer);
      this.running.resolve();
      this.running = null;
    }
    this.committed = createState(this.ctx);
    this.nextId = 1;
    this.pushIntro();
    this.emit();
  }

  dispose(): void {
    this.disposed = true;
    if (this.running) {
      if (this.running.timer !== null) this.scheduler.clearTimeout(this.running.timer);
      this.running.resolve();
      this.running = null;
    }
    this.listeners.clear();
    this.goalListeners.clear();
    this.commandListeners.clear();
  }

  // -- completion and hints --------------------------------------------------

  complete(line: string): CompletionResult {
    return completeLine(line, this.committed, this.ctx, this.history);
  }

  /**
   * The canonical line for a goal: the `example` of the first command that carries it and whose
   * `requires` hold right now. Falls back to the first command with an example.
   */
  exampleFor(goalId: string): string | null {
    let fallback: string | null = null;
    for (const cmd of this.script.commands as ScriptedCommand[]) {
      if (cmd.goal !== goalId || !cmd.example) continue;
      fallback ??= cmd.example;
      const groups = this.ctx.patterns.get(cmd.match).exec(cmd.example);
      if (groups && requirementsHold(cmd, groups, this.committed)) return cmd.example;
    }
    return fallback;
  }

  /** The example for the first goal that is not done yet, or null when all are. */
  nextExample(): string | null {
    const next = this.getState().goals.find((g) => !g.done);
    return next ? this.exampleFor(next.id) : null;
  }

  /** Goal ids not done yet, in script order. */
  remainingGoals(): string[] {
    return this.getState()
      .goals.filter((g) => !g.done)
      .map((g) => g.id);
  }

  /**
   * What to type to complete `goals` (default: all that are open). Earlier goals in script order
   * are included when open, because the script's order is the order they make sense in.
   */
  plan(goals?: readonly string[]): PlanStep[] {
    const order = this.script.goals.map((g) => g.id);
    const wanted = goals && goals.length > 0 ? goals : order;
    const last = Math.max(...wanted.map((g) => order.indexOf(g)));
    const done = new Set(this.committed.completed);
    const steps: PlanStep[] = [];
    for (const id of order.slice(0, last + 1)) {
      if (done.has(id)) continue;
      const line = this.exampleFor(id);
      if (line) steps.push({ goal: id, line });
    }
    return steps;
  }

  /** Examples ordered for suggestions: open goals first. */
  suggestions(): string[] {
    return orderedExamples(this.ctx, this.committed.completed);
  }

  /** Test helper: the working directory as an absolute path. */
  get cwd(): string {
    return this.committed.cwd;
  }

  /** Test helper: read a file from the virtual file system. */
  readFile(path: string): string | null {
    return this.committed.fs.read(this.committed.fs.resolve(this.committed.cwd, path));
  }

  /** Test helper: does a path exist? */
  exists(path: string): boolean {
    return this.committed.fs.exists(this.committed.fs.resolve(this.committed.cwd, path));
  }

  /** Test helper: an environment variable. */
  envVar(name: string): string | undefined {
    return this.committed.env.get(name);
  }
}

export function createSession(options: SessionOptions): TerminalSession {
  return new TerminalSession(options);
}
