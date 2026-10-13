/** Shell state and the context a run needs. Framework free. */

import { DEFAULT_CWD, DEFAULT_HOME, VirtualFs } from './fs';
import { PatternCache } from './regex';
import type { ScriptedCommand, ScriptWithRequires } from './types';

export const SHELL_USER = 'learner';
export const SHELL_HOST = 'sandbox';

export interface ShellState {
  fs: VirtualFs;
  cwd: string;
  oldCwd: string;
  env: Map<string, string>;
  /** Every goal id completed so far, declared or not (the `requires` namespace). */
  flags: Set<string>;
  /** Declared goal ids in the order they were completed. */
  completed: string[];
  lastExit: number;
  history: string[];
}

export interface EngineContext {
  script: ScriptWithRequires;
  patterns: PatternCache;
  goalIds: ReadonlySet<string>;
  /** Goal id to its label, for `help`. */
  goalLabels: ReadonlyMap<string, string>;
  now: () => number;
  user: string;
  host: string;
  home: string;
  /** Distinct `example` strings in script order. */
  examples: readonly string[];
  /** First words of the examples: the programs this scenario is about. */
  heads: readonly string[];
}

export function createContext(
  script: ScriptWithRequires,
  options: { now?: () => number; patterns?: PatternCache } = {},
): EngineContext {
  const examples: string[] = [];
  for (const c of script.commands as ScriptedCommand[]) {
    if (c.example && !examples.includes(c.example)) examples.push(c.example);
  }
  const heads: string[] = [];
  for (const e of examples) {
    const head = e.trim().split(/\s+/)[0];
    if (head && !heads.includes(head)) heads.push(head);
  }
  return {
    script,
    patterns: options.patterns ?? new PatternCache(),
    goalIds: new Set(script.goals.map((g) => g.id)),
    goalLabels: new Map(script.goals.map((g) => [g.id, g.label])),
    now: options.now ?? (() => Date.now()),
    user: SHELL_USER,
    host: SHELL_HOST,
    home: DEFAULT_HOME,
    examples,
    heads,
  };
}

export function createState(ctx: EngineContext): ShellState {
  const cwdSource = ctx.script.cwd ?? DEFAULT_CWD;
  const probe = new VirtualFs(ctx.home);
  const cwd = probe.resolve(ctx.home, cwdSource);
  const fs = VirtualFs.fromScript(ctx.script.files, cwd, ctx.home);
  const env = new Map<string, string>([
    ['USER', ctx.user],
    ['HOME', ctx.home],
    ['HOSTNAME', ctx.host],
    ['SHELL', '/bin/sandbox'],
    ['PWD', cwd],
    ['LANG', 'C.UTF-8'],
    ['TERM', 'xterm-256color'],
    ['PATH', '/usr/local/bin:/usr/bin:/bin'],
  ]);
  return {
    fs,
    cwd,
    oldCwd: cwd,
    env,
    flags: new Set(),
    completed: [],
    lastExit: 0,
    history: [],
  };
}

export function cloneState(s: ShellState): ShellState {
  return {
    fs: s.fs.clone(),
    cwd: s.cwd,
    oldCwd: s.oldCwd,
    env: new Map(s.env),
    flags: new Set(s.flags),
    completed: [...s.completed],
    lastExit: s.lastExit,
    history: [...s.history],
  };
}
