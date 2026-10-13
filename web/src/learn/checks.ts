/**
 * The check evaluator: declarative `Check`s (types.ts) over a spec, its lint result and its price.
 *
 * Pure and framework-free. Content never carries code, so every predicate a lesson can express is
 * evaluated here, by this one function, in the player, in "Show me" and in the content test.
 *
 * Paths (`readPath`)
 *   `name`                      a key
 *   `compose[0].ports[1]`       indexes in brackets (or `compose.0.ports.1`)
 *   `compose[*].ports`          every element; array results are flattened one level, so
 *                               `{ path: 'compose[*].ports', op: 'includes', value: 3000 }` asks
 *                               "does any component publish 3000"
 *   `compose.length`            `length` of an array or string
 *   `compose[0]["name"]`        quoted key in brackets, for keys with dots
 * A path that does not resolve is "not found": `exists` is false, `empty` is true, every other op fails.
 *
 * Failure messages: a failing leaf contributes its author-written `message` when it has one. The player
 * shows those first and falls back to `describeCheck(leaf)` (a plain statement of the requirement).
 */

import type { Check, CheckOp } from './types';

// ---------------------------------------------------------------------------
// Context and result
// ---------------------------------------------------------------------------

/** The lint facts a check can read: whether the spec is valid and which issue codes are present. */
export interface CheckLint {
  /** No `error` issues. */
  valid: boolean;
  /** Every issue code present (any severity). */
  codes: readonly string[];
}

export interface CheckContext {
  /** The (normalised) spec the check reads. */
  spec: unknown;
  /** Null when lint is unavailable: lint checks then fail with an explanatory detail. */
  lint: CheckLint | null;
  /** Monthly USD price, null when unavailable: price checks then fail. */
  usdPerMonth: number | null;
}

export interface CheckFailure {
  /** The author's `message` for this check, when it has one. */
  message?: string;
  /** The JSON path the failing check read (path checks only). */
  path?: string;
  /** The failing leaf, so a UI can describe it with `describeCheck` when there is no message. */
  check: Check;
}

export interface CheckResult {
  pass: boolean;
  failed: CheckFailure[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

type Token = { type: 'key'; key: string } | { type: 'index'; index: number } | { type: 'all' };

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Split a path into tokens. Returns null when the syntax is invalid (empty segments, unbalanced
 * brackets, an index that is not a number, an unterminated quote).
 */
export function parsePath(path: string): Token[] | null {
  const src = path.trim();
  if (src === '') return null;
  const out: Token[] = [];
  let i = 0;
  let expectKey = true; // at the start or after a dot a key must follow (a bracket is also fine at the start)
  while (i < src.length) {
    const c = src[i] as string;
    if (c === '.') {
      if (expectKey) return null;
      expectKey = true;
      i += 1;
      continue;
    }
    if (c === '[') {
      const close = src.indexOf(']', i);
      if (close < 0) return null;
      const inner = src.slice(i + 1, close).trim();
      if (inner === '*') out.push({ type: 'all' });
      else if (/^\d+$/.test(inner)) out.push({ type: 'index', index: Number(inner) });
      else {
        const q = /^(["'])(.*)\1$/.exec(inner);
        if (!q || q[2] === undefined || q[2] === '') return null;
        out.push({ type: 'key', key: q[2] });
      }
      expectKey = false;
      i = close + 1;
      continue;
    }
    if (!expectKey) return null; // `a[0]b` is not a path
    let j = i;
    while (j < src.length && src[j] !== '.' && src[j] !== '[') j += 1;
    const key = src.slice(i, j).trim();
    if (key === '') return null;
    if (key === '*') out.push({ type: 'all' });
    else if (/^\d+$/.test(key)) out.push({ type: 'index', index: Number(key) });
    else out.push({ type: 'key', key });
    expectKey = false;
    i = j;
  }
  if (expectKey) return null; // trailing dot
  return out;
}

/** True when the path parses. */
export function isValidPathSyntax(path: string): boolean {
  return parsePath(path) !== null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const hasOwn = (o: object, k: string): boolean => Object.hasOwn(o, k);

export interface PathRead {
  found: boolean;
  value: unknown;
}

/**
 * Read a value at `path` from `root`. Never throws; an unparsable or unresolved path is `{ found: false }`.
 */
export function readPath(root: unknown, path: string): PathRead {
  const tokens = parsePath(path);
  if (!tokens) return { found: false, value: undefined };
  return walk(root, tokens, 0);
}

function walk(cur: unknown, tokens: Token[], at: number): PathRead {
  if (at >= tokens.length) return { found: true, value: cur };
  const t = tokens[at] as Token;
  if (t.type === 'all') {
    if (!Array.isArray(cur)) return { found: false, value: undefined };
    const values: unknown[] = [];
    let any = false;
    for (const el of cur) {
      const r = walk(el, tokens, at + 1);
      if (!r.found) continue;
      any = true;
      if (Array.isArray(r.value) && at + 1 < tokens.length) values.push(...(r.value as unknown[]));
      else values.push(r.value);
    }
    return any ? { found: true, value: values } : { found: false, value: undefined };
  }
  if (t.type === 'index') {
    if (!Array.isArray(cur) || t.index >= cur.length) return { found: false, value: undefined };
    return walk(cur[t.index], tokens, at + 1);
  }
  // key
  if (BLOCKED_KEYS.has(t.key)) return { found: false, value: undefined };
  if (t.key === 'length' && (Array.isArray(cur) || typeof cur === 'string')) {
    return walk(cur.length, tokens, at + 1);
  }
  if (isRecord(cur) && hasOwn(cur, t.key)) return walk(cur[t.key], tokens, at + 1);
  return { found: false, value: undefined };
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/** Empty means: not there, null, a blank string, an empty array or an empty object. 0 and false are values. */
export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (isRecord(v)) return Object.keys(v).length === 0;
  return false;
}

function isPrimitive(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/** Equality for primitives that tolerates `3000` against `'3000'` (specs are loosely typed on import). */
function primitiveEq(a: unknown, b: unknown): boolean {
  if (!isPrimitive(a) || !isPrimitive(b)) return false;
  if (typeof a === typeof b) return a === b;
  return String(a) === String(b);
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const regexCache = new Map<string, RegExp | null>();

/** Compile a regular expression source once. Returns null when it does not compile. */
export function compileRegex(source: string): RegExp | null {
  if (regexCache.has(source)) return regexCache.get(source) ?? null;
  let re: RegExp | null = null;
  try {
    re = new RegExp(source);
  } catch {
    re = null;
  }
  if (regexCache.size > 500) regexCache.clear();
  regexCache.set(source, re);
  return re;
}

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

function applyOp(op: CheckOp, read: PathRead, value: string | number | boolean | undefined): boolean {
  const { found, value: actual } = read;
  switch (op) {
    case 'exists':
      return found && !isEmptyValue(actual);
    case 'empty':
      return !found || isEmptyValue(actual);
    case 'eq':
      return found && primitiveEq(actual, value);
    case 'neq':
      return !found || !primitiveEq(actual, value);
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = toNumber(actual);
      const b = toNumber(value);
      if (!found || a === null || b === null) return false;
      if (op === 'gt') return a > b;
      if (op === 'gte') return a >= b;
      if (op === 'lt') return a < b;
      return a <= b;
    }
    case 'includes': {
      if (!found || value === undefined) return false;
      if (Array.isArray(actual)) return actual.some((x) => primitiveEq(x, value));
      if (typeof actual === 'string') return actual.includes(String(value));
      return false;
    }
    case 'matches': {
      if (!found || value === undefined) return false;
      const re = compileRegex(String(value));
      if (!re) return false;
      if (isPrimitive(actual)) return re.test(String(actual));
      if (Array.isArray(actual)) return actual.some((x) => isPrimitive(x) && re.test(String(x)));
      return false;
    }
    case 'len>=': {
      const n = toNumber(value);
      if (!found || n === null) return false;
      if (Array.isArray(actual) || typeof actual === 'string') return actual.length >= n;
      return false;
    }
    default: {
      const never: never = op;
      void never;
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

const PASS: CheckResult = { pass: true, failed: [] };

function fail(check: Check, message: string | undefined, path?: string): CheckResult {
  const f: CheckFailure = { check };
  if (message) f.message = message;
  if (path !== undefined) f.path = path;
  return { pass: false, failed: [f] };
}

/**
 * Evaluate a check. `all` passes when every child passes and reports the failures of the children that
 * failed; `any` passes when one child passes and, when none does, reports every child's failures.
 */
export function evaluateCheck(check: Check, ctx: CheckContext): CheckResult {
  if ('all' in check) {
    const failed: CheckFailure[] = [];
    for (const child of check.all) {
      const r = evaluateCheck(child, ctx);
      if (!r.pass) failed.push(...r.failed);
    }
    return failed.length === 0 ? PASS : { pass: false, failed };
  }
  if ('any' in check) {
    if (check.any.length === 0) return fail(check, undefined);
    const failed: CheckFailure[] = [];
    for (const child of check.any) {
      const r = evaluateCheck(child, ctx);
      if (r.pass) return PASS;
      failed.push(...r.failed);
    }
    return { pass: false, failed };
  }
  if ('path' in check) {
    const read = readPath(ctx.spec, check.path);
    return applyOp(check.op, read, check.value) ? PASS : fail(check, check.message, check.path);
  }
  if ('lint' in check) {
    const lint = ctx.lint;
    if (!lint) return fail(check, check.message);
    if (check.lint === 'valid') return lint.valid ? PASS : fail(check, check.message);
    const present = new Set(lint.codes);
    return check.codes.some((c) => present.has(c)) ? fail(check, check.message) : PASS;
  }
  if ('price' in check) {
    const usd = ctx.usdPerMonth;
    if (usd === null || !Number.isFinite(usd)) return fail(check, check.message);
    const ok = check.price === 'max' ? usd <= check.usd + 1e-9 : usd >= check.usd - 1e-9;
    return ok ? PASS : fail(check, check.message);
  }
  return fail(check, undefined);
}

// ---------------------------------------------------------------------------
// Describing and walking checks
// ---------------------------------------------------------------------------

function show(v: unknown): string {
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** A plain statement of what a leaf check requires, for the live checklist and for failures with no message. */
export function describeCheck(check: Check): string {
  if ('all' in check) return check.all.map(describeCheck).join(', and ');
  if ('any' in check) return check.any.map(describeCheck).join(', or ');
  if ('lint' in check) {
    if (check.lint === 'valid') return 'The spec has no errors';
    return `These issues are gone: ${check.codes.join(', ')}`;
  }
  if ('price' in check) {
    return check.price === 'max'
      ? `The monthly price is at most ${usd(check.usd)}`
      : `The monthly price is at least ${usd(check.usd)}`;
  }
  const p = check.path;
  const v = check.value;
  switch (check.op) {
    case 'eq':
      return `${p} is ${show(v)}`;
    case 'neq':
      return `${p} is not ${show(v)}`;
    case 'gt':
      return `${p} is more than ${show(v)}`;
    case 'gte':
      return `${p} is at least ${show(v)}`;
    case 'lt':
      return `${p} is less than ${show(v)}`;
    case 'lte':
      return `${p} is at most ${show(v)}`;
    case 'includes':
      return `${p} includes ${show(v)}`;
    case 'matches':
      return `${p} matches /${String(v)}/`;
    case 'exists':
      return `${p} is set`;
    case 'empty':
      return `${p} is empty`;
    case 'len>=':
      return `${p} has at least ${show(v)} entries`;
    default:
      return p;
  }
}

/** Every leaf check (a check that is not `all` or `any`), depth first. */
export function leafChecks(check: Check): Check[] {
  if ('all' in check) return check.all.flatMap(leafChecks);
  if ('any' in check) return check.any.flatMap(leafChecks);
  return [check];
}

/** Every JSON path a check reads. */
export function checkPaths(check: Check): string[] {
  const out: string[] = [];
  for (const leaf of leafChecks(check)) if ('path' in leaf) out.push(leaf.path);
  return out;
}

/** Every lint code a check names. */
export function checkLintCodes(check: Check): string[] {
  const out: string[] = [];
  for (const leaf of leafChecks(check)) if ('lint' in leaf && leaf.lint === 'absent') out.push(...leaf.codes);
  return out;
}

/** True when the check needs the lint report. */
export function checkUsesLint(check: Check): boolean {
  return leafChecks(check).some((c) => 'lint' in c);
}

/** True when the check needs the monthly price. */
export function checkUsesPrice(check: Check): boolean {
  return leafChecks(check).some((c) => 'price' in c);
}

/** The author messages of a result's failures, de-duplicated, in order. */
export function failureMessages(result: CheckResult): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of result.failed) {
    if (f.message && !seen.has(f.message)) {
      seen.add(f.message);
      out.push(f.message);
    }
  }
  return out;
}
