/**
 * Tab completion and the inline "ghost" suggestion. Candidates, best first:
 *
 * 1. whole lines the learner ran before that start with what is typed, newest first
 * 2. command `example`s of the script, open goals first (so Tab nudges toward what is left to do)
 * 3. builtin names, when the cursor is in the first word
 * 4. file and folder names for the word being typed
 */

import { BUILTINS } from './builtins';
import { dirname } from './fs';
import type { EngineContext, ShellState } from './state';
import type { CompletionResult, ScriptedCommand } from './types';

/** Examples ordered with the ones that complete a still-open goal first. */
export function orderedExamples(ctx: EngineContext, completed: readonly string[]): string[] {
  const open: string[] = [];
  const rest: string[] = [];
  for (const c of ctx.script.commands as ScriptedCommand[]) {
    if (!c.example) continue;
    const isOpen = c.goal !== undefined && !completed.includes(c.goal);
    const bucket = isOpen ? open : rest;
    if (!open.includes(c.example) && !rest.includes(c.example)) bucket.push(c.example);
  }
  return [...open, ...rest];
}

function commonPrefix(items: readonly string[]): string {
  if (items.length === 0) return '';
  let prefix = items[0] as string;
  for (const s of items) {
    let i = 0;
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i += 1;
    prefix = prefix.slice(0, i);
    if (prefix === '') break;
  }
  return prefix;
}

export function completeLine(
  line: string,
  state: ShellState,
  ctx: EngineContext,
  history: readonly string[],
): CompletionResult {
  if (line.trim() === '') return { candidates: [], common: line, ghost: '' };
  const out: string[] = [];
  const add = (c: string) => {
    if (c !== line && !out.includes(c)) out.push(c);
  };

  // Examples that complete a goal still open come first: Tab nudges toward what is left to do.
  const open = new Set(
    (ctx.script.commands as ScriptedCommand[])
      .filter((c) => c.example && c.goal !== undefined && !state.completed.includes(c.goal))
      .map((c) => c.example as string),
  );
  const examples = orderedExamples(ctx, state.completed);
  for (const e of examples) if (open.has(e) && e.startsWith(line)) add(e);
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const h = history[i] as string;
    if (h.startsWith(line)) add(h);
  }
  for (const e of examples) if (e.startsWith(line)) add(e);
  if (!/\s/.test(line)) {
    for (const name of Object.keys(BUILTINS)) if (name.startsWith(line)) add(name);
  }

  // File names for the last word.
  const lastSpace = line.lastIndexOf(' ');
  if (lastSpace >= 0) {
    const head = line.slice(0, lastSpace + 1);
    const word = line.slice(lastSpace + 1);
    const slash = word.lastIndexOf('/');
    const dirPart = slash >= 0 ? word.slice(0, slash + 1) : '';
    const base = word.slice(slash + 1);
    const dirAbs = state.fs.resolve(state.cwd, dirPart === '' ? '.' : dirPart);
    if (state.fs.isDir(dirAbs) || dirname(dirAbs) !== dirAbs) {
      const dirsOnly = /^\s*cd\s/.test(line);
      for (const entry of state.fs.list(dirAbs)) {
        if (dirsOnly && entry.kind !== 'dir') continue;
        if (entry.name.startsWith(base) && (base.startsWith('.') || !entry.name.startsWith('.'))) {
          add(`${head}${dirPart}${entry.name}${entry.kind === 'dir' ? '/' : ''}`);
        }
      }
    }
  }

  const candidates = out.slice(0, 24);
  const first = candidates[0];
  return {
    candidates,
    common: candidates.length > 0 ? commonPrefix(candidates) : line,
    ghost: first?.startsWith(line) ? first.slice(line.length) : '',
  };
}
