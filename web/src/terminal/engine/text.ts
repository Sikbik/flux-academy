/** Small text helpers: edit distance, templating, "did you mean". Pure. */

/**
 * Edit distance with adjacent transpositions counted as one edit (optimal string alignment), which
 * is how people actually mistype: `biuld`, `gerp`. Bails out early with `max + 1` when the strings
 * are further apart than `max`.
 */
export function levenshtein(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min((prev[j] as number) + 1, (cur[j - 1] as number) + 1, (prev[j - 1] as number) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, (prev2[j - 2] as number) + 1);
      }
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length] as number;
}

export interface TemplateVars {
  /** Capture groups, index 0 is the whole match. */
  groups?: readonly (string | undefined)[];
  input?: string;
  cwd?: string;
  user?: string;
  host?: string;
  cmd?: string;
  /** Reads a file of the virtual file system, for `{file:/path}`. Returns null when it is missing. */
  readFile?: (path: string) => string | null;
}

const SIMPLE_PLACEHOLDER = /^\{(\d|input|cwd|user|host|cmd)\}/;

function simpleValue(key: string, vars: TemplateVars): string {
  if (/^\d$/.test(key)) return vars.groups?.[Number(key)] ?? '';
  switch (key) {
    case 'input':
      return vars.input ?? '';
    case 'cwd':
      return vars.cwd ?? '';
    case 'user':
      return vars.user ?? '';
    case 'host':
      return vars.host ?? '';
    case 'cmd':
      return vars.cmd ?? '';
    default:
      return '';
  }
}

/**
 * Substitute `{0}`..`{9}`, `{input}`, `{cwd}`, `{user}`, `{host}`, `{cmd}` and `{file:/path}` (the
 * trimmed content of a virtual file, or nothing). The path of a `{file:...}` may itself hold
 * placeholders: `{file:/var/lib/docker/images/{1}/arch}`. Unknown braces stay. Substituted values
 * are never scanned again, so what a learner typed cannot become a template.
 */
export function applyTemplate(text: string, vars: TemplateVars): string {
  if (!text.includes('{')) return text;
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch !== '{') {
      out += ch;
      i += 1;
      continue;
    }
    if (text.startsWith('{file:', i)) {
      let depth = 1;
      let j = i + 6;
      while (j < text.length && depth > 0) {
        const c = text[j];
        if (c === '{') depth += 1;
        else if (c === '}') depth -= 1;
        j += 1;
      }
      if (depth === 0) {
        const path = applyTemplate(text.slice(i + 6, j - 1), { ...vars, readFile: undefined });
        out += (vars.readFile?.(path) ?? '').trim();
        i = j;
        continue;
      }
    }
    const m = SIMPLE_PLACEHOLDER.exec(text.slice(i, i + 8));
    if (m) {
      out += simpleValue(m[1] as string, vars);
      i += m[0].length;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Collapse runs of whitespace and lowercase, for comparing what was meant with what was typed. */
export function normalizeForNudge(line: string): string {
  return line.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface Nudge {
  /** The suggested whole line. */
  suggestion: string;
  /** `typo` is a near miss of the whole line, `args` has the right command but other arguments. */
  kind: 'typo' | 'args';
  distance: number;
}

/**
 * The nearest known line to what was typed, or null. A near miss of the whole line wins; failing
 * that, a line that starts with the same first two words (so the learner has the right command and
 * only the arguments differ).
 */
export function nearest(input: string, candidates: readonly string[]): Nudge | null {
  const typed = normalizeForNudge(input);
  if (typed === '') return null;
  let best: Nudge | null = null;
  for (const c of candidates) {
    const norm = normalizeForNudge(c);
    const limit = Math.max(2, Math.floor(norm.length * 0.3));
    const d = levenshtein(typed, norm, limit);
    if (d <= limit && (!best || d < best.distance)) best = { suggestion: c, kind: 'typo', distance: d };
  }
  if (best) return best;
  const words = typed.split(' ');
  const head = words.slice(0, Math.min(2, words.length)).join(' ');
  for (const c of candidates) {
    const norm = normalizeForNudge(c);
    if (words.length >= 2 && norm.startsWith(`${head} `))
      return { suggestion: c, kind: 'args', distance: 99 };
  }
  // First word only, for scenarios whose examples are one command with varied arguments.
  const first = words[0] as string;
  for (const c of candidates) {
    const norm = normalizeForNudge(c);
    if (norm.split(' ')[0] === first && words.length > 1)
      return { suggestion: c, kind: 'args', distance: 100 };
  }
  return null;
}

/** The best correction of a single word among known words. */
export function nearestWord(word: string, known: readonly string[]): string | null {
  const w = word.toLowerCase();
  if (w.length < 2) return null;
  const limit = w.length <= 4 ? 1 : 2;
  let best: { word: string; d: number } | null = null;
  for (const k of known) {
    if (k === w) return null;
    const d = levenshtein(w, k.toLowerCase(), limit);
    if (d <= limit && (!best || d < best.d)) best = { word: k, d };
  }
  return best ? best.word : null;
}
