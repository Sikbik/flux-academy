/**
 * Guarded matching of a script command's `match`.
 *
 * Semantics are the lesson validator's (`web/src/learn/validate-terminal.ts`): the source is
 * wrapped as `^(?:source)$` and tested against the whole trimmed input line, so a script that
 * validates always behaves the same in the terminal.
 *
 * Execution is guarded in three layers, because JavaScript cannot interrupt `RegExp.exec`:
 *
 * 1. The built-in `Pattern` engine (pattern.ts) runs the common subset with a step budget, so a
 *    catastrophic pattern fails closed instead of freezing the tab. It is deterministic.
 * 2. Sources that use syntax it does not support (backreferences, lookbehind, `\p{}`) fall back to
 *    the native engine, but only after a static check refuses nested unbounded quantifiers.
 * 3. Native executions are timed; one that blows its budget is switched off for the session.
 *
 * Input beyond `MAX_MATCH_LENGTH` characters never matches.
 */

import { Pattern, UnsupportedPattern } from './pattern';
import { MAX_MATCH_LENGTH } from './sanitize';

export type RegexProblem = 'invalid' | 'too-long' | 'nested-quantifier' | 'too-many-quantifiers';
export type TripReason = RegexProblem | 'budget' | 'slow';

/** The anchoring every command pattern gets. Identical to the validator's `anchored()`. */
export function anchorSource(source: string): string {
  return `^(?:${source})$`;
}

/** A `{n,m}` quantifier with an upper bound at or above this counts as unbounded. */
const BIG_BOUND = 32;
const MAX_UNBOUNDED = 8;
const MAX_SOURCE_LENGTH = 600;

/**
 * Static check used for the native fallback. Returns the first problem found, or null. A source
 * that the built-in engine accepts does not need this: it is budgeted instead.
 */
export function analyzeRegex(source: string): RegexProblem | null {
  if (source.length > MAX_SOURCE_LENGTH) return 'too-long';
  try {
    new RegExp(source);
  } catch {
    return 'invalid';
  }
  const n = source.length;
  // For each open group: does it contain an unbounded quantifier?
  const stack: boolean[] = [false];
  let lastWasUnboundedGroup = false;
  let unboundedCount = 0;
  let i = 0;

  const markUnbounded = (): RegexProblem | null => {
    if (lastWasUnboundedGroup) return 'nested-quantifier';
    stack[stack.length - 1] = true;
    unboundedCount += 1;
    return unboundedCount > MAX_UNBOUNDED ? 'too-many-quantifiers' : null;
  };

  while (i < n) {
    const c = source[i] as string;
    if (c === '\\') {
      i += 2;
      lastWasUnboundedGroup = false;
      continue;
    }
    if (c === '[') {
      let j = i + 1;
      if (source[j] === '^') j += 1;
      while (j < n && source[j] !== ']') j += source[j] === '\\' ? 2 : 1;
      i = j + 1;
      lastWasUnboundedGroup = false;
      continue;
    }
    if (c === '(') {
      stack.push(false);
      i += 1;
      if (source[i] === '?') {
        i += 1;
        if (source[i] === '<' && source[i + 1] !== '=' && source[i + 1] !== '!') {
          const end = source.indexOf('>', i);
          i = end < 0 ? n : end + 1;
        } else {
          i += source[i] === '<' ? 2 : 1;
        }
      }
      lastWasUnboundedGroup = false;
      continue;
    }
    if (c === ')') {
      const had = stack.pop() ?? false;
      if (stack.length === 0) stack.push(false);
      if (had) stack[stack.length - 1] = true;
      lastWasUnboundedGroup = had;
      i += 1;
      continue;
    }
    if (c === '*' || c === '+') {
      const problem = markUnbounded();
      if (problem) return problem;
      i += 1;
      if (source[i] === '?') i += 1;
      lastWasUnboundedGroup = false;
      continue;
    }
    if (c === '{') {
      const m = /^\{(\d+)(?:,(\d*))?\}/.exec(source.slice(i));
      if (m) {
        const hasComma = m[0].includes(',');
        const upper = m[2];
        const unbounded = hasComma && (upper === '' || Number(upper) >= BIG_BOUND);
        if (unbounded || Number(m[1]) >= BIG_BOUND) {
          const problem = markUnbounded();
          if (problem) return problem;
        }
        i += m[0].length;
        if (source[i] === '?') i += 1;
        lastWasUnboundedGroup = false;
        continue;
      }
    }
    lastWasUnboundedGroup = false;
    i += 1;
  }
  return null;
}

export interface GuardOptions {
  /** Step budget for the built-in engine. Default 200,000 (a few milliseconds at most). */
  stepBudget?: number;
  /** Milliseconds one native `exec` may take before it is switched off. Default 40. */
  budgetMs?: number;
  /** Clock for the native path, injectable for tests. Default `performance.now`. */
  now?: () => number;
  maxInput?: number;
  /** Called once when a matcher is refused or switched off (a diagnostic for authors). */
  onTrip?: (source: string, reason: TripReason) => void;
}

const defaultNow = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** A command pattern, compiled and guarded. */
export class CommandPattern {
  readonly source: string;
  private pattern: Pattern | null = null;
  private native: RegExp | null = null;
  private off: TripReason | null = null;
  private readonly stepBudget: number;
  private readonly budgetMs: number;
  private readonly now: () => number;
  private readonly maxInput: number;
  private readonly onTrip: GuardOptions['onTrip'];

  constructor(source: string, options: GuardOptions = {}) {
    this.source = source;
    this.stepBudget = options.stepBudget ?? 200_000;
    this.budgetMs = options.budgetMs ?? 40;
    this.now = options.now ?? defaultNow;
    this.maxInput = options.maxInput ?? MAX_MATCH_LENGTH;
    this.onTrip = options.onTrip;

    const anchored = anchorSource(source);
    if (source.length > MAX_SOURCE_LENGTH) {
      this.disable('too-long');
      return;
    }
    try {
      new RegExp(anchored);
    } catch {
      this.disable('invalid');
      return;
    }
    try {
      this.pattern = new Pattern(anchored);
    } catch (e) {
      if (!(e instanceof UnsupportedPattern)) throw e;
      const problem = analyzeRegex(source);
      if (problem) {
        this.disable(problem);
        return;
      }
      this.native = new RegExp(anchored);
    }
  }

  private disable(reason: TripReason): void {
    this.pattern = null;
    this.native = null;
    this.off = reason;
    this.onTrip?.(this.source, reason);
  }

  /** False when the source was refused or the matcher was switched off. */
  get usable(): boolean {
    return this.pattern !== null || this.native !== null;
  }

  /** Why the matcher is unusable, or null. */
  get problem(): TripReason | null {
    return this.off;
  }

  /** Which engine runs this pattern. */
  get engine(): 'builtin' | 'native' | 'none' {
    return this.pattern ? 'builtin' : this.native ? 'native' : 'none';
  }

  /** The captures (index 0 is the whole match) when `line` matches as a whole, else null. */
  exec(line: string): (string | undefined)[] | null {
    if (line.length > this.maxInput) return null;
    if (this.pattern) {
      const r = this.pattern.exec(line, this.stepBudget);
      if (r.exhausted) {
        this.disable('budget');
        return null;
      }
      return r.match ? r.match.groups : null;
    }
    if (this.native) {
      const t0 = this.now();
      const m = this.native.exec(line);
      if (this.now() - t0 > this.budgetMs) {
        this.disable('slow');
        return m ? Array.from(m) : null;
      }
      return m ? Array.from(m) : null;
    }
    return null;
  }
}

/** Compile once per source. Bounded so a hostile script cannot grow it forever. */
export class PatternCache {
  private cache = new Map<string, CommandPattern>();
  constructor(private readonly options: GuardOptions = {}) {}

  get(source: string): CommandPattern {
    let p = this.cache.get(source);
    if (!p) {
      if (this.cache.size > 500) this.cache.clear();
      p = new CommandPattern(source, this.options);
      this.cache.set(source, p);
    }
    return p;
  }
}
