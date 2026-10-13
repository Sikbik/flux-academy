/**
 * The troubleshooting page's logic, free of React so it can be tested: reading the URL hash, searching
 * symptoms, error messages and lint codes (including a pasted error), filling `{app}` and `{domain}` in
 * commands, and the cross links between symptoms, messages and codes.
 */

import { LINT_CODES, type LintCodeMeta } from '@shared/flux/lint-catalogue';
import {
  type Cause,
  type Check,
  cleanApp,
  cleanDomain,
  ERROR_STRINGS,
  type ErrorString,
  endpointById,
  type Fix,
  fillTemplate,
  type Proof,
  STAGE_IDS,
  type StageId,
  SYMPTOMS,
  type Symptom,
  stageById,
} from '@/content/troubleshoot';

// ---------------------------------------------------------------------------
// The URL
// ---------------------------------------------------------------------------

export type View =
  | { kind: 'home' }
  | { kind: 'stage'; stage: StageId }
  | { kind: 'symptom'; symptom: Symptom }
  | { kind: 'messages'; id: string | null }
  | { kind: 'codes'; code: string | null }
  | { kind: 'unknown'; hash: string };

const STAGE_PREFIX = 'stage-';
const MESSAGE_PREFIX = 'message-';
const CODE_PREFIX = 'code-';

const SYMPTOM_BY_ID = new Map(SYMPTOMS.map((s) => [s.id, s]));
const MESSAGE_BY_ID = new Map(ERROR_STRINGS.map((m) => [m.id, m]));

export function messageById(id: string): ErrorString | undefined {
  return MESSAGE_BY_ID.get(id);
}

export function codeMeta(code: string): LintCodeMeta | undefined {
  return Object.hasOwn(LINT_CODES, code) ? LINT_CODES[code] : undefined;
}

function decode(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

/** What a URL hash asks the page to show. */
export function parseHash(hash: string): View {
  const id = decode(hash);
  if (id === '') return { kind: 'home' };
  const lower = id.toLowerCase();

  const symptom = SYMPTOM_BY_ID.get(lower);
  if (symptom) return { kind: 'symptom', symptom };

  if (lower.startsWith(STAGE_PREFIX)) {
    const stage = lower.slice(STAGE_PREFIX.length) as StageId;
    if ((STAGE_IDS as readonly string[]).includes(stage)) return { kind: 'stage', stage };
  }
  if (lower === 'messages' || lower === 'decoder') return { kind: 'messages', id: null };
  if (lower.startsWith(MESSAGE_PREFIX)) {
    const mid = lower.slice(MESSAGE_PREFIX.length);
    if (MESSAGE_BY_ID.has(mid)) return { kind: 'messages', id: mid };
  }
  if (lower === 'codes' || lower === 'lint') return { kind: 'codes', code: null };
  if (lower.startsWith(CODE_PREFIX)) {
    const code = id.slice(CODE_PREFIX.length).toUpperCase();
    if (codeMeta(code)) return { kind: 'codes', code };
  }
  return { kind: 'unknown', hash: id };
}

export const hrefOf = {
  symptom: (id: string) => `/troubleshoot#${id}`,
  stage: (stage: StageId) => `/troubleshoot#${STAGE_PREFIX}${stage}`,
  message: (id: string) => `/troubleshoot#${MESSAGE_PREFIX}${id}`,
  messages: () => '/troubleshoot#messages',
  code: (code: string) => `/troubleshoot#${CODE_PREFIX}${code}`,
  codes: () => '/troubleshoot#codes',
};

// ---------------------------------------------------------------------------
// Filling in the visitor's own names
// ---------------------------------------------------------------------------

export interface Names {
  app: string;
  domain: string;
}

export const NO_NAMES: Names = { app: '', domain: '' };

export function cleanNames(raw: { app?: string | null; domain?: string | null }): Names {
  return { app: cleanApp(raw.app ?? ''), domain: cleanDomain(raw.domain ?? '') };
}

/** `{app}` and `{domain}` filled from the visitor's names; an empty name leaves the braces as they are. */
export function fill(text: string, names: Names): string {
  return fillTemplate(text, { app: names.app, domain: names.domain });
}

export interface NeededNames {
  app: boolean;
  domain: boolean;
}

function check(c: Check, needs: NeededNames): void {
  const scan = (s: string) => {
    if (s.includes('{app}')) needs.app = true;
    if (s.includes('{domain}')) needs.domain = true;
  };
  switch (c.kind) {
    case 'look':
      scan(c.text);
      break;
    case 'command':
      scan(c.command);
      scan(c.label);
      if (c.expect) scan(c.expect);
      break;
    case 'api': {
      const e = endpointById(c.endpoint);
      if (e) scan(e.url);
      scan(c.expect);
      break;
    }
    case 'lab':
      scan(c.label);
      if (c.expect) scan(c.expect);
      break;
  }
}

function fixNeeds(f: Fix, needs: NeededNames): void {
  const scan = (s: string) => {
    if (s.includes('{app}')) needs.app = true;
    if (s.includes('{domain}')) needs.domain = true;
  };
  scan(f.text);
  if (f.snippet) scan(f.snippet.code);
}

/** Which of the visitor's own names this symptom's checks and fixes would use. */
export function neededNames(symptom: Symptom): NeededNames {
  const needs: NeededNames = { app: false, domain: false };
  for (const c of symptom.causes) {
    for (const ch of c.checks) check(ch, needs);
    for (const f of c.fixes) fixNeeds(f, needs);
  }
  return needs;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface Evidence {
  total: number;
  /** Read in FluxOS source or seen on the live network. */
  verified: number;
  /**
   * Read in the code of the FluxCloud server package or the console (a proof with a `codebase`), kept apart
   * from `verified` so the sentence does not call that code FluxOS. Absent when there is none.
   */
  elsewhere?: number;
  docs: number;
  unverified: number;
}

export function evidenceOf(causes: readonly { proof: Proof }[]): Evidence {
  const e: Evidence = { total: causes.length, verified: 0, docs: 0, unverified: 0 };
  for (const c of causes) {
    if (c.proof.status === 'verified') {
      if (c.proof.codebase) e.elsewhere = (e.elsewhere ?? 0) + 1;
      else e.verified += 1;
    } else if (c.proof.status === 'docs') e.docs += 1;
    else e.unverified += 1;
  }
  return e;
}

export function evidenceSentence(e: Evidence): string {
  const parts: string[] = [];
  if (e.verified) parts.push(`${e.verified} read in the FluxOS source or seen on the live network`);
  if (e.elsewhere) {
    parts.push(
      `${e.elsewhere} read in the code of the FluxCloud server package or console, or seen on the live network`,
    );
  }
  if (e.docs) parts.push(`${e.docs} from the official docs only`);
  if (e.unverified) parts.push(`${e.unverified} not verified`);
  const noun = e.total === 1 ? 'cause' : 'causes';
  return `Of ${e.total} ${noun} below: ${parts.join(', ')}.`;
}

// ---------------------------------------------------------------------------
// Cross links
// ---------------------------------------------------------------------------

/** Symptoms that cite a lint code, on the symptom or on one of its causes. */
export function symptomsForCode(code: string): Symptom[] {
  return SYMPTOMS.filter(
    (s) => (s.lint ?? []).includes(code) || s.causes.some((c) => (c.lint ?? []).includes(code)),
  );
}

/** Error messages that point at a symptom. */
export function messagesForSymptom(id: string): ErrorString[] {
  return ERROR_STRINGS.filter((m) => m.symptom === id);
}

/** Error messages that name a lint code. */
export function messagesForCode(code: string): ErrorString[] {
  return ERROR_STRINGS.filter((m) => (m.lint ?? []).includes(code));
}

/** The lint codes a symptom touches, on the symptom and on its causes, in first-seen order. */
export function codesForSymptom(s: Symptom): string[] {
  const out: string[] = [];
  const add = (c: string) => {
    if (!out.includes(c) && codeMeta(c)) out.push(c);
  };
  for (const c of s.lint ?? []) add(c);
  for (const cause of s.causes) for (const c of cause.lint ?? []) add(c);
  return out;
}

export function causeTitleOf(c: Cause, index: number): string {
  return `${index + 1}. ${c.title}`;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

const STOP = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'can',
  'do',
  'does',
  'for',
  'from',
  'has',
  'have',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'its',
  'me',
  'my',
  'no',
  'not',
  'of',
  'on',
  'or',
  'so',
  'that',
  'the',
  'then',
  'there',
  'this',
  'to',
  'was',
  'what',
  'when',
  'why',
  'with',
  'you',
  'your',
]);

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/\{\{(?:term|lesson|lab|kbd):([^}|]*)(?:\|[^}]*)?\}\}/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/[^a-z0-9_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A very small stemmer: enough that "installing", "installs" and "installed" meet, and "instance" meets
 * "instances". It is applied the same way to what is searched and to what is typed, so the rules only need
 * to be consistent, not linguistically right. Words with digits or underscores (codes) are left alone.
 */
export function stem(word: string): string {
  if (word.length <= 3 || word.includes('_') || /\d/.test(word)) return word;
  let w = word;
  if (w.endsWith('ies') && w.length > 5) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('es') && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) w = w.slice(0, -1);
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1);
  return w;
}

/** `normalise`, with every word stemmed. This is what the search index holds. */
export function stemmed(text: string): string {
  return normalise(text).split(' ').map(stem).join(' ');
}

export function tokens(query: string): string[] {
  const out: string[] = [];
  for (const raw of normalise(query).split(' ')) {
    if (!raw || STOP.has(raw)) continue;
    if (raw.length < 2 && !/\d/.test(raw)) continue;
    out.push(stem(raw));
    if (raw.includes('_')) {
      for (const part of raw.split('_')) {
        if (part.length >= 2 && !STOP.has(part)) out.push(stem(part));
      }
    }
  }
  return [...new Set(out)];
}

interface SymptomIndex {
  symptom: Symptom;
  title: string;
  seen: string;
  keywords: string;
  summary: string;
  causes: string;
  quick: string;
}

interface MessageIndex {
  message: ErrorString;
  text: string;
  where: string;
  means: string;
  /** Lower-case fragments that must all appear in a pasted message. */
  fragments: string[];
}

interface CodeIndex {
  meta: LintCodeMeta;
  code: string;
  spaced: string;
  title: string;
  why: string;
}

/** The literal runs of a message, lower case, with `{placeholders}` and `...` removed. */
export function fragmentsOf(text: string): string[] {
  return text
    .replace(/\{[^}]*\}/g, '\u0000')
    .replace(/\.\.\./g, '\u0000')
    .split('\u0000')
    .map((p) => p.toLowerCase().replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 4);
}

let symptomIndex: SymptomIndex[] | null = null;
let messageIndex: MessageIndex[] | null = null;
let codeIndex: CodeIndex[] | null = null;

function symptoms(): SymptomIndex[] {
  if (!symptomIndex) {
    symptomIndex = SYMPTOMS.map((s) => ({
      symptom: s,
      title: stemmed(s.title),
      seen: stemmed(s.seen.join(' ')),
      keywords: stemmed(s.keywords.join(' ')),
      summary: stemmed(s.summary),
      causes: stemmed(s.causes.map((c) => c.title).join(' ')),
      quick: stemmed(s.quick),
    }));
  }
  return symptomIndex;
}

function messages(): MessageIndex[] {
  if (!messageIndex) {
    messageIndex = ERROR_STRINGS.map((m) => ({
      message: m,
      text: stemmed(m.text),
      where: stemmed(m.where),
      means: stemmed(m.means),
      fragments: (m.match ?? fragmentsOf(m.text)).map((f) => f.toLowerCase()),
    }));
  }
  return messageIndex;
}

function codes(): CodeIndex[] {
  if (!codeIndex) {
    codeIndex = Object.values(LINT_CODES).map((m) => ({
      meta: m,
      code: m.code.toLowerCase(),
      spaced: m.code.toLowerCase().replace(/_/g, ' '),
      title: stemmed(m.title),
      why: stemmed(m.why),
    }));
  }
  return codeIndex;
}

export interface SymptomHit {
  type: 'symptom';
  symptom: Symptom;
  score: number;
}
export interface MessageHit {
  type: 'message';
  message: ErrorString;
  score: number;
  /** A pasted message that contains this one's text. */
  exact: boolean;
}
export interface CodeHit {
  type: 'code';
  meta: LintCodeMeta;
  score: number;
  /** The query names this code outright. */
  exact: boolean;
}

export interface SearchResults {
  query: string;
  /** Matches that are certain: a pasted message or a code named in the text. */
  best: Array<MessageHit | CodeHit>;
  symptoms: SymptomHit[];
  messages: MessageHit[];
  codes: CodeHit[];
}

function count(haystack: string, token: string): 'start' | 'in' | null {
  if (haystack === '') return null;
  if (haystack.startsWith(`${token} `) || haystack === token || haystack.includes(` ${token}`))
    return 'start';
  return haystack.includes(token) ? 'in' : null;
}

/**
 * Enough of the words must land: at least half of them. A person describing a problem rarely uses the
 * same words as the page, so one of two is a candidate; the score puts the ones with more words first.
 */
function enough(matched: number, total: number): boolean {
  return total > 0 && matched >= Math.ceil(total / 2);
}

function scoreSymptom(s: SymptomIndex, toks: string[]): number {
  let score = 0;
  let matched = 0;
  for (const t of toks) {
    let best = 0;
    const tests: Array<[string, number]> = [
      [s.title, 40],
      [s.seen, 35],
      [s.keywords, 30],
      [s.summary, 15],
      [s.causes, 12],
      [s.quick, 6],
    ];
    for (const [field, weight] of tests) {
      const hit = count(field, t);
      if (hit === 'start') best = Math.max(best, weight);
      else if (hit === 'in') best = Math.max(best, Math.round(weight * 0.6));
    }
    if (best > 0) {
      matched += 1;
      score += best;
    }
  }
  return enough(matched, toks.length) ? score + matched * 5 : 0;
}

function scoreMessage(m: MessageIndex, toks: string[]): number {
  let score = 0;
  let matched = 0;
  for (const t of toks) {
    let best = 0;
    const tests: Array<[string, number]> = [
      [m.text, 40],
      [m.where, 12],
      [m.means, 8],
    ];
    for (const [field, weight] of tests) {
      const hit = count(field, t);
      if (hit === 'start') best = Math.max(best, weight);
      else if (hit === 'in') best = Math.max(best, Math.round(weight * 0.6));
    }
    if (best > 0) {
      matched += 1;
      score += best;
    }
  }
  return enough(matched, toks.length) ? score + matched * 5 : 0;
}

function scoreCode(c: CodeIndex, toks: string[], whole: string): number {
  if (whole === c.code || whole === c.spaced) return 1000;
  let score = 0;
  let matched = 0;
  for (const t of toks) {
    let best = 0;
    if (c.code === t) best = 90;
    else if (c.code.startsWith(t)) best = 50;
    else if (c.code.includes(t)) best = 35;
    const tests: Array<[string, number]> = [
      [c.spaced, 30],
      [c.title, 30],
      [c.why, 8],
    ];
    for (const [field, weight] of tests) {
      const hit = count(field, t);
      if (hit === 'start') best = Math.max(best, weight);
      else if (hit === 'in') best = Math.max(best, Math.round(weight * 0.6));
    }
    if (best > 0) {
      matched += 1;
      score += best;
    }
  }
  return enough(matched, toks.length) ? score + matched * 5 : 0;
}

const CODE_TOKEN = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

export const MAX_QUERY = 2000;

/**
 * Search everything the page knows. `query` may be a few words, a code (`PORT_FEE`), or a whole pasted
 * error message: a message whose literal text appears in the query is an exact hit and goes first.
 */
export function search(rawQuery: string): SearchResults {
  const query = rawQuery.slice(0, MAX_QUERY).trim();
  const empty: SearchResults = { query, best: [], symptoms: [], messages: [], codes: [] };
  if (query === '') return empty;

  const lowered = query.toLowerCase().replace(/\s+/g, ' ');
  const toks = tokens(query);
  const whole = normalise(query);

  // Exact: codes written out in the text.
  const named = new Set<string>();
  for (const m of query.matchAll(CODE_TOKEN)) {
    if (codeMeta(m[0])) named.add(m[0]);
  }
  const wholeAsCode = codes().find((c) => whole === c.code || whole === c.spaced);
  if (wholeAsCode) named.add(wholeAsCode.meta.code);

  // Exact: messages whose text is inside the query.
  const exactMessages: MessageHit[] = [];
  if (lowered.length >= 8) {
    for (const m of messages()) {
      if (m.fragments.length === 0) continue;
      if (m.fragments.every((f) => lowered.includes(f))) {
        exactMessages.push({
          type: 'message',
          message: m.message,
          score: 900 + m.fragments.join('').length,
          exact: true,
        });
      }
    }
  }
  exactMessages.sort((a, b) => b.score - a.score);

  const exactCodes: CodeHit[] = [...named]
    .map((code) => codeMeta(code))
    .filter((m): m is LintCodeMeta => m !== undefined)
    .map((meta) => ({ type: 'code' as const, meta, score: 1000, exact: true }));

  const best = [...exactCodes, ...exactMessages.slice(0, 3)];
  const bestMessageIds = new Set(exactMessages.slice(0, 3).map((m) => m.message.id));

  if (toks.length === 0 && best.length === 0) return empty;

  const symptomHits: SymptomHit[] = symptoms()
    .map((s) => ({ type: 'symptom' as const, symptom: s.symptom, score: scoreSymptom(s, toks) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.symptom.title.localeCompare(b.symptom.title));

  const messageHits: MessageHit[] = messages()
    .filter((m) => !bestMessageIds.has(m.message.id))
    .map((m) => ({
      type: 'message' as const,
      message: m.message,
      score: scoreMessage(m, toks),
      exact: false,
    }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.message.text.localeCompare(b.message.text));

  const codeHits: CodeHit[] = codes()
    .filter((c) => !named.has(c.meta.code))
    .map((c) => ({ type: 'code' as const, meta: c.meta, score: scoreCode(c, toks, whole), exact: false }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.meta.code.localeCompare(b.meta.code));

  return { query, best, symptoms: symptomHits, messages: messageHits, codes: codeHits };
}

export function totalHits(r: SearchResults): number {
  return r.best.length + r.symptoms.length + r.messages.length + r.codes.length;
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

export const LIKELIHOOD_WORD: Record<Cause['likelihood'], string> = {
  usual: 'Usual',
  common: 'Common',
  possible: 'Possible',
  rare: 'Rare',
};

export function stageTitle(id: StageId): string {
  return stageById(id).title;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? `${n} ${one}` : `${n} ${many}`;
}

/** Severity words for lint codes. */
export const SEVERITY_WORD: Record<LintCodeMeta['severity'], string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Note',
};

export const CATEGORY_WORD: Record<LintCodeMeta['category'], string> = {
  identity: 'Name and owner',
  shape: 'Spec shape',
  instances: 'Instances',
  resources: 'Resources',
  image: 'Image',
  network: 'Ports and domains',
  config: 'Configuration',
  storage: 'Storage',
  placement: 'Placement',
  subscription: 'Subscription',
  enterprise: 'Enterprise',
  practice: 'Practice',
};
