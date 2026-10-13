/**
 * JSON path utilities for the forge model. Paths are the same strings the lint engine reports
 * (`compose[0].ports[1]`, `name`, `geolocation[2]`) and that stages list in `editable` and `focus`.
 *
 * Pure and framework-free.
 *
 *   parsePath('compose[0].ports[1]')   -> ['compose', 0, 'ports', 1]
 *   formatPath(['compose', 0, 'cpu'])  -> 'compose[0].cpu'
 *   getAt(spec, 'compose[0].cpu')
 *   setAt(spec, 'compose[0].cpu', 1)   -> a new spec, untouched parts shared
 *
 * A `*` segment (`compose[*].cpu`) matches any index or key and is only meaningful in patterns.
 */

export type PathSeg = string | number;

const SEGMENT = /([^.[\]"']+)|\[(\d+|\*)\]/g;

/** Split a path into segments. An empty path is the root (no segments). Never throws. */
export function parsePath(path: string): PathSeg[] {
  const out: PathSeg[] = [];
  if (!path) return out;
  SEGMENT.lastIndex = 0;
  for (let m = SEGMENT.exec(path); m !== null; m = SEGMENT.exec(path)) {
    if (m[1] !== undefined) out.push(m[1]);
    else if (m[2] === '*') out.push('*');
    else if (m[2] !== undefined) out.push(Number(m[2]));
  }
  return out;
}

/** Join segments back into the canonical path string. */
export function formatPath(segs: readonly PathSeg[]): string {
  let s = '';
  for (const seg of segs) {
    if (typeof seg === 'number') s += `[${seg}]`;
    else if (seg === '*') s += '[*]';
    else s += s ? `.${seg}` : seg;
  }
  return s;
}

/** Canonical spelling of a path (`compose.0.cpu` and `compose[0].cpu` both become `compose[0].cpu`). */
export function normalizePath(path: string): string {
  const segs = parsePath(path).map((s) => (typeof s === 'string' && /^\d+$/.test(s) ? Number(s) : s));
  return formatPath(segs);
}

/** Append one segment to a path string. */
export function childPath(parent: string, seg: PathSeg): string {
  return formatPath([...parsePath(parent), seg]);
}

/** The path one level up, or the empty string at the root. */
export function parentPath(path: string): string {
  const segs = parsePath(path);
  segs.pop();
  return formatPath(segs);
}

/** The last segment of a path, or undefined at the root. */
export function lastSegment(path: string): PathSeg | undefined {
  const segs = parsePath(path);
  return segs[segs.length - 1];
}

type Bag = Record<string | number, unknown>;

/** Read the value at a path. Returns undefined for anything missing. */
export function getAt(root: unknown, path: string | readonly PathSeg[]): unknown {
  const segs = typeof path === 'string' ? parsePath(path) : path;
  let cur: unknown = root;
  for (const seg of segs) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Bag)[seg];
  }
  return cur;
}

/** True when the path resolves to something other than undefined. */
export function hasAt(root: unknown, path: string | readonly PathSeg[]): boolean {
  return getAt(root, path) !== undefined;
}

/** Immutable update. Missing containers on the way are created (an array when the next segment is an index). */
export function setAt<T>(root: T, path: string | readonly PathSeg[], value: unknown): T {
  const segs = typeof path === 'string' ? parsePath(path) : path;
  if (segs.length === 0) return value as T;
  const head = segs[0] as PathSeg;
  const rest = segs.slice(1);
  const wantArray = typeof head === 'number';
  let container: Bag | unknown[];
  if (Array.isArray(root)) container = root.slice();
  else if (root !== null && typeof root === 'object' && !wantArray) container = { ...(root as Bag) };
  else container = wantArray ? [] : {};
  (container as Bag)[head] = setAt((container as Bag)[head], rest, value);
  return container as T;
}

/** Immutable removal: an array element is spliced out, an object key is deleted. A missing path is a no-op. */
export function removeAt<T>(root: T, path: string | readonly PathSeg[]): T {
  const segs = typeof path === 'string' ? parsePath(path) : path;
  if (segs.length === 0) return root;
  const parent = getAt(root, segs.slice(0, -1));
  const last = segs[segs.length - 1] as PathSeg;
  if (Array.isArray(parent)) {
    if (typeof last !== 'number' || last < 0 || last >= parent.length) return root;
    const next = parent.slice();
    next.splice(last, 1);
    return setAt(root, segs.slice(0, -1), next);
  }
  if (parent !== null && typeof parent === 'object') {
    if (!(last in (parent as Bag))) return root;
    const next = { ...(parent as Bag) };
    delete next[last];
    return setAt(root, segs.slice(0, -1), next);
  }
  return root;
}

function segMatches(pattern: PathSeg, actual: PathSeg): boolean {
  if (pattern === '*' || actual === '*') return true;
  return String(pattern) === String(actual);
}

/** True when `pattern`'s segments are a prefix of `path`'s (so `compose[0].ports` covers `compose[0].ports[1]`). */
export function covers(pattern: string, path: string): boolean {
  const p = parsePath(pattern);
  const a = parsePath(path);
  if (p.length > a.length) return false;
  for (let i = 0; i < p.length; i++) {
    if (!segMatches(p[i] as PathSeg, a[i] as PathSeg)) return false;
  }
  return true;
}

/** True when `path` is `ancestor` or lies inside it. */
export function isWithin(path: string, ancestor: string): boolean {
  return covers(ancestor, path);
}

/**
 * Whether the learner may change the value at `path`. `editable` undefined means everything; an empty list
 * means nothing. Otherwise some entry must cover the path (an entry for `compose[0].ports` allows
 * `compose[0].ports[1]`, `compose[*].cpu` allows every component's CPU).
 */
export function isPathEditable(path: string, editable?: readonly string[] | null): boolean {
  if (editable === undefined || editable === null) return true;
  for (const e of editable) if (covers(e, path)) return true;
  return false;
}

/** Whether anything at or below `path` is editable: used to decide if a group should look locked. */
export function hasEditableWithin(path: string, editable?: readonly string[] | null): boolean {
  if (editable === undefined || editable === null) return true;
  for (const e of editable) if (covers(e, path) || covers(path, e)) return true;
  return false;
}

/** Closest ancestors first: `compose[0].ports[1]` -> `compose[0].ports[1]`, `compose[0].ports`, `compose[0]`, `compose`. */
export function ancestors(path: string): string[] {
  const segs = parsePath(path);
  const out: string[] = [];
  for (let n = segs.length; n > 0; n--) out.push(formatPath(segs.slice(0, n)));
  return out;
}

/** The component index a path points into, or null (`compose[2].ports` -> 2). */
export function componentIndexOf(path: string): number | null {
  const segs = parsePath(path);
  if (segs[0] === 'compose' && typeof segs[1] === 'number') return segs[1];
  return null;
}

/**
 * The path of the form field that edits `path`. Public ports, container ports and domains are three parallel
 * arrays drawn as one table, so a note or an issue on `compose[0].domains` belongs to `compose[0].ports`.
 * Every other path is its own field.
 */
export function fieldPathOf(path: string): string {
  const segs = parsePath(path);
  const index = segs[1];
  const key = segs[2];
  if (
    segs[0] === 'compose' &&
    (typeof index === 'number' || index === '*') &&
    (key === 'containerPorts' || key === 'domains')
  ) {
    return formatPath(['compose', index, 'ports']);
  }
  return path;
}

/**
 * The form sections the paths live in: `app` for the app's own fields and `c<i>` for component `i`. A
 * pattern that spans every component (`compose`, `compose[*].cpu`) names all of them. The order is stable:
 * `app` first, then components by index.
 */
export function sectionsOf(paths: readonly string[], componentCount: number): string[] {
  let app = false;
  const comps = new Set<number>();
  for (const path of paths) {
    const segs = parsePath(path);
    if (segs[0] !== 'compose') {
      app = true;
      if (segs.length === 0) for (let i = 0; i < componentCount; i++) comps.add(i);
      continue;
    }
    const index = segs[1];
    if (typeof index === 'number') comps.add(index);
    else for (let i = 0; i < componentCount; i++) comps.add(i);
  }
  const out: string[] = [];
  if (app) out.push('app');
  for (const i of [...comps].sort((a, b) => a - b)) out.push(`c${i}`);
  return out;
}

/**
 * Paths whose values differ between two JSON-like values, as short as possible: an array whose length
 * changed is reported as the array itself, otherwise elements are compared in place.
 */
export function diffPaths(a: unknown, b: unknown, base = ''): string[] {
  if (a === b) return [];
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [base];
    const out: string[] = [];
    for (let i = 0; i < a.length; i++) out.push(...diffPaths(a[i], b[i], childPath(base, i)));
    return out;
  }
  if (isBag(a) && isBag(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out: string[] = [];
    for (const k of keys) out.push(...diffPaths(a[k], b[k], childPath(base, k)));
    return out;
  }
  return [base];
}

function isBag(v: unknown): v is Bag {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep structural equality for JSON-like values. */
export function sameJson(a: unknown, b: unknown): boolean {
  return diffPaths(a, b).length === 0;
}
