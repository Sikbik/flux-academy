/**
 * Validates the troubleshooting content: every reference resolves, every cause can be checked and fixed,
 * every example raises the lint code it claims, and the copy is clean (no em dashes, no emoji).
 */

import { readFileSync } from 'node:fs';
import { LABS, LESSONS } from '@shared/curriculum';
import { lintSpec } from '@shared/flux/lint';
import { LINT_CODES } from '@shared/flux/lint-catalogue';
import { describe, expect, it } from 'vitest';
import { decodeShare, readShareHash } from '@/forge/model/share';
import { allTerms } from '@/learn/glossary';
import { markupRefs, parseMarkup, proseOnly } from '@/learn/markup';
import {
  buildExampleSpec,
  ENDPOINTS,
  ERROR_SOURCE_LABEL,
  ERROR_STRINGS,
  exampleHref,
  FACTS_DATE,
  LINT_EXAMPLES,
  NEEDS_LIVE_DATA,
  SECTION_15_DATE,
  type SpecExample,
  STAGE_IDS,
  STAGES,
  type StageId,
  SYMPTOMS,
  symptomById,
  TROUBLESHOOT_INDEX,
} from './troubleshoot';

const lessonIds = new Set(LESSONS.map((l) => l.id));
const labIds = new Set(LABS.map((l) => l.id));
const glossaryIds = new Set(allTerms().map((t) => t.id));
const endpointIds = new Set(ENDPOINTS.map((e) => e.id));

const EM_DASH = '—';
const EMOJI = /(?![©®™↔-↙])\p{Extended_Pictographic}|\p{Emoji_Presentation}|️|[\u{1F1E6}-\u{1F1FF}]/u;

/** Every string anywhere in a value, with a path. */
function strings(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

/** All the SpecExamples used by checks and fixes, with where they are. */
function usedExamples(): Array<{ where: string; example: SpecExample }> {
  const out: Array<{ where: string; example: SpecExample }> = [];
  for (const s of SYMPTOMS) {
    for (const c of s.causes) {
      c.checks.forEach((ch, i) => {
        if (ch.kind === 'lab' && ch.spec)
          out.push({ where: `${s.id}/${c.id}/checks[${i}]`, example: ch.spec });
      });
      c.fixes.forEach((f, i) => {
        if (f.lab?.spec) out.push({ where: `${s.id}/${c.id}/fixes[${i}]`, example: f.lab.spec });
      });
    }
  }
  return out;
}

describe('stages and symptoms', () => {
  it('has every stage in order: the seven of the journey, then the two ways of deploying', () => {
    expect(STAGES.map((s) => s.id)).toEqual([...STAGE_IDS]);
    expect(STAGES.filter((s) => !s.route).map((s) => s.id)).toEqual([
      'before',
      'validation',
      'installing',
      'running',
      'domains',
      'cost',
      'data',
    ]);
    expect(STAGES.filter((s) => s.route).map((s) => s.id)).toEqual(['git', 'agents']);
    // The journey comes first, so a route never sits in the middle of it.
    expect(STAGES.map((s) => s.route === true)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it('has at least 24 symptoms and some in every stage', () => {
    expect(SYMPTOMS.length).toBeGreaterThanOrEqual(24);
    for (const stage of STAGE_IDS) {
      expect(SYMPTOMS.filter((s) => s.stage === stage).length, `stage ${stage}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps ids unique and url safe', () => {
    const ids = SYMPTOMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('gives every symptom what the page needs', () => {
    for (const s of SYMPTOMS) {
      const at = `symptom ${s.id}`;
      expect(s.title.trim(), at).not.toBe('');
      expect(s.summary.trim(), at).not.toBe('');
      expect(s.quick.trim(), at).not.toBe('');
      expect(s.keywords.length, `${at} keywords`).toBeGreaterThanOrEqual(3);
      expect(s.causes.length, `${at} causes`).toBeGreaterThanOrEqual(2);
      expect(s.lessons.length, `${at} lessons`).toBeGreaterThanOrEqual(1);
    }
  });

  it('gives every cause at least one check, one fix and a proof', () => {
    for (const s of SYMPTOMS) {
      const ids = s.causes.map((c) => c.id);
      expect(new Set(ids).size, `${s.id} cause ids`).toBe(ids.length);
      for (const c of s.causes) {
        const at = `${s.id}/${c.id}`;
        expect(c.title.trim(), at).not.toBe('');
        expect(c.why.trim(), at).not.toBe('');
        expect(c.checks.length, `${at} checks`).toBeGreaterThanOrEqual(1);
        expect(c.fixes.length, `${at} fixes`).toBeGreaterThanOrEqual(1);
        expect(['usual', 'common', 'possible', 'rare'], at).toContain(c.likelihood);
        expect(c.proof.facts.trim(), `${at} proof.facts`).not.toBe('');
        if (c.proof.status === 'unverified') {
          expect(c.proof.note?.trim(), `${at} unverified needs a note`).toBeTruthy();
        }
        if (c.proof.status === 'verified') {
          expect(c.proof.via?.length, `${at} verified needs via`).toBeGreaterThanOrEqual(1);
        }
        // A fix may carry its own, weaker evidence. The same rules apply to it.
        c.fixes.forEach((f, i) => {
          if (!f.proof) return;
          expect(f.proof.facts.trim(), `${at} fix ${i} proof.facts`).not.toBe('');
          if (f.proof.status === 'unverified') {
            expect(f.proof.note?.trim(), `${at} fix ${i} unverified needs a note`).toBeTruthy();
          }
        });
      }
    }
  });

  it('ranks "usual" causes before "rare" ones', () => {
    const order = { usual: 0, common: 1, possible: 2, rare: 3 } as const;
    for (const s of SYMPTOMS) {
      let worst = 0;
      for (const c of s.causes) {
        const rank = order[c.likelihood];
        // Allow a small inversion between neighbours, never usual after rare.
        expect(rank >= worst - 1, `${s.id}/${c.id} is out of order`).toBe(true);
        worst = Math.max(worst, rank);
      }
    }
  });
});

describe('references', () => {
  it('names only lessons, labs, lint codes, glossary terms, symptoms and endpoints that exist', () => {
    for (const s of SYMPTOMS) {
      for (const id of s.lessons) expect(lessonIds.has(id), `${s.id} lesson ${id}`).toBe(true);
      for (const id of s.labs ?? []) expect(labIds.has(id), `${s.id} lab ${id}`).toBe(true);
      for (const code of s.lint ?? []) expect(code in LINT_CODES, `${s.id} lint ${code}`).toBe(true);
      for (const id of s.related ?? []) expect(symptomById(id), `${s.id} related ${id}`).toBeDefined();
      for (const c of s.causes) {
        const at = `${s.id}/${c.id}`;
        for (const id of c.lessons ?? []) expect(lessonIds.has(id), `${at} lesson ${id}`).toBe(true);
        for (const code of c.lint ?? []) expect(code in LINT_CODES, `${at} lint ${code}`).toBe(true);
        for (const id of c.see ?? []) expect(symptomById(id), `${at} see ${id}`).toBeDefined();
        for (const id of c.terms ?? []) expect(glossaryIds.has(id), `${at} term ${id}`).toBe(true);
        for (const ch of c.checks) {
          if (ch.kind === 'api')
            expect(endpointIds.has(ch.endpoint), `${at} endpoint ${ch.endpoint}`).toBe(true);
          if (ch.kind === 'lab') expect(labIds.has(ch.lab), `${at} lab ${ch.lab}`).toBe(true);
        }
        for (const f of c.fixes) {
          if (f.lab) expect(labIds.has(f.lab.lab), `${at} fix lab ${f.lab.lab}`).toBe(true);
        }
      }
    }
  });

  it('resolves every directive written inside the prose', () => {
    for (const s of SYMPTOMS) {
      for (const [path, text] of strings(s)) {
        const refs = markupRefs(text);
        for (const id of refs.lessons) expect(lessonIds.has(id), `${s.id} ${path} lesson ${id}`).toBe(true);
        for (const id of refs.labs) expect(labIds.has(id), `${s.id} ${path} lab ${id}`).toBe(true);
        for (const id of refs.terms) expect(glossaryIds.has(id), `${s.id} ${path} term ${id}`).toBe(true);
      }
    }
  });

  it('ties every error message to things that exist', () => {
    const ids = ERROR_STRINGS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ERROR_STRINGS) {
      expect(e.text.trim(), e.id).not.toBe('');
      expect(e.means.trim(), e.id).not.toBe('');
      if (e.symptom) expect(symptomById(e.symptom), `${e.id} symptom`).toBeDefined();
      for (const code of e.lint ?? []) expect(code in LINT_CODES, `${e.id} lint ${code}`).toBe(true);
      for (const frag of e.match ?? []) expect(frag, `${e.id} match is lower case`).toBe(frag.toLowerCase());
      if (e.proof.status === 'unverified') expect(e.proof.note, e.id).toBeTruthy();
    }
  });

  it('gives every message as FACTS.md has it, word for word', () => {
    // docs/research/FACTS.md is the only source of the strings. A value that changes is `{like this}` and an
    // elision is `...`; every literal piece in between has to be found there, with only spacing and
    // markdown escapes set aside.
    const flatten = (t: string) =>
      t
        .replace(/\\([|*_`[\]<>#])/g, '$1')
        .replace(/\s+/g, ' ')
        .toLowerCase();
    const facts = flatten(readFileSync(new URL('../../../docs/research/FACTS.md', import.meta.url), 'utf8'));
    const missing: string[] = [];
    for (const e of ERROR_STRINGS) {
      const pieces = e.text
        .split(/\{[^}]*\}|\.\.\.|\u2026/)
        .map((piece) => flatten(piece).trim())
        .filter((piece) => piece.length >= 4);
      expect(pieces.length, `${e.id} has literal text`).toBeGreaterThan(0);
      for (const piece of pieces) {
        if (!facts.includes(piece)) missing.push(`${e.id}: "${piece}"`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('only points at hosts it means to', () => {
    const hosts = new Set([
      'api.runonflux.io',
      'stats.runonflux.io',
      'fiatpaymentsbridge.runonflux.io',
      'raw.githubusercontent.com',
    ]);
    for (const e of ENDPOINTS) {
      const url = new URL(e.url.replace(/\{app\}/g, 'example'));
      expect(url.protocol, e.id).toBe('https:');
      expect(hosts.has(url.hostname), `${e.id} host ${url.hostname}`).toBe(true);
    }
  });
});

describe('copy hygiene', () => {
  const everything: Array<[string, string]> = [
    ...strings(SYMPTOMS, 'symptoms'),
    ...strings(STAGES, 'stages'),
    ...strings(ERROR_STRINGS, 'errors'),
  ];

  it('has no em dashes and no emoji anywhere', () => {
    for (const [path, text] of everything) {
      expect(text.includes(EM_DASH), `${path} has an em dash`).toBe(false);
      expect(EMOJI.test(text), `${path} has an emoji`).toBe(false);
    }
  });

  it('writes well formed markup with no exclamation marks in prose', () => {
    const proseKeys = [
      'title',
      'why',
      'text',
      'quick',
      'summary',
      'expect',
      'means',
      'caveat',
      'note',
      'blurb',
    ];
    for (const [path, text] of everything) {
      const key =
        path
          .split('.')
          .pop()
          ?.replace(/\[\d+\]$/, '') ?? '';
      if (!proseKeys.includes(key)) continue;
      // The exact UI string of an error message may keep its own punctuation.
      if (path.startsWith('errors') && key === 'text') continue;
      if (/^symptoms\[\d+\]\.seen/.test(path)) continue;
      const parsed = parseMarkup(text);
      expect(parsed.problems, `${path}: ${text}`).toEqual([]);
      expect(proseOnly(text).includes('!'), `${path} has an exclamation mark`).toBe(false);
    }
  });

  it('does not contain template text left over from drafting', () => {
    for (const [path, text] of everything) {
      expect(/\b(TODO|FIXME|lorem ipsum)\b/i.test(text), `${path}`).toBe(false);
    }
  });

  it('dates its facts', () => {
    expect(FACTS_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(SECTION_15_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Only the Git and agent stages were read from section 15, which came after the first pass.
    expect(SECTION_15_DATE > FACTS_DATE).toBe(true);
    expect(STAGES.filter((s) => s.checkedOn).map((s) => [s.id, s.checkedOn])).toEqual([
      ['git', SECTION_15_DATE],
      ['agents', SECTION_15_DATE],
    ]);
  });
});

const GIT_IDS = [
  'git-cannot-clone',
  'git-monorepo-wrong-folder',
  'git-build-failed',
  'git-wont-start',
  'git-rolled-back',
  'git-deployed-no-answer',
  'git-not-running',
  'git-push-no-deploy',
  'git-webhook-failing',
  'git-variables-ignored',
  'git-data-disappears',
  'git-plan-limits',
  'git-app-went-down',
  'git-button-url',
  'git-stale-guidance',
];

const AGENT_IDS = [
  'agent-cannot-connect',
  'agent-keys-or-account',
  'agent-plan-not-deployed',
  'agent-wait-timed-out',
  'agent-paid-not-registered',
  'agent-paid-twice',
  'agent-update-shortened-term',
  'agent-app-removed',
  'agent-keys-exposed',
  'assistant-did-not-deploy',
  'console-claims-not-backed',
  'agent-server-version-differs',
  'agent-approval-policy',
  'agent-prompt-injection',
];

/** The two source files, with the comment lines taken out: what is left is what can reach a learner. */
function codeOf(file: string): string {
  return readFileSync(new URL(`./troubleshoot/${file}`, import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n');
}

describe('the Git and agent stages', () => {
  const inStage = (stage: StageId) => SYMPTOMS.filter((s) => s.stage === stage);
  const routes = [...inStage('git'), ...inStage('agents')];
  const newMessages = ERROR_STRINGS.filter((e) => routes.some((s) => s.id === e.symptom));

  it('holds the problems the two routes are for', () => {
    expect(inStage('git').map((s) => s.id)).toEqual(GIT_IDS);
    expect(inStage('agents').map((s) => s.id)).toEqual(AGENT_IDS);
  });

  it('links the lessons and the lab each route is about', () => {
    const lessonsOf = new Set(
      routes.flatMap((s) => [...s.lessons, ...s.causes.flatMap((c) => c.lessons ?? [])]),
    );
    for (const id of [
      'deploy-from-git',
      'ai-assisted-deploy',
      'agents-and-mcp',
      'redundancy-failover',
      'env-and-secrets',
      'ports-and-domains',
      'operate-your-app',
    ]) {
      expect(lessonsOf.has(id), `lesson ${id}`).toBe(true);
    }
    expect(new Set(routes.flatMap((s) => s.labs ?? [])).has('agent-desk')).toBe(true);
  });

  it('uses the glossary terms written for these routes', () => {
    const termsOf = new Set(routes.flatMap((s) => s.causes.flatMap((c) => c.terms ?? [])));
    for (const id of [
      'mcp',
      'mcp-server',
      'ai-agent',
      'ai-assistant',
      'tool-call',
      'confirm-gate',
      'prompt-injection',
      'git-deploy',
      'webhook',
      'rollback',
      'monorepo',
      'deploy-button',
    ]) {
      expect(termsOf.has(id), `term ${id}`).toBe(true);
    }
  });

  it('says what each problem was checked against, and not FluxOS', () => {
    for (const s of routes) {
      expect(s.checkedAgainst?.trim(), `${s.id} checkedAgainst`).toBeTruthy();
      expect(s.checkedAgainst, `${s.id} checkedAgainst`).not.toMatch(/FluxOS/);
    }
    // The older stages keep the FluxOS wording: they set nothing.
    for (const s of SYMPTOMS.filter((x) => !routes.includes(x))) {
      expect(s.checkedAgainst, `${s.id} checkedAgainst`).toBeUndefined();
    }
  });

  it('names the code a proof was read in, and only for a source proof', () => {
    let named = 0;
    for (const s of SYMPTOMS) {
      const proofs = [
        ...s.causes.map((c) => ({ at: `${s.id}/${c.id}`, proof: c.proof })),
        ...s.causes.flatMap((c) =>
          c.fixes.flatMap((f, i) => (f.proof ? [{ at: `${s.id}/${c.id}/fix ${i}`, proof: f.proof }] : [])),
        ),
      ];
      for (const { at, proof } of proofs) {
        if (!proof.codebase) continue;
        named += 1;
        expect(proof.status, `${at} status`).toBe('verified');
        expect(proof.via, `${at} via`).toContain('source');
        expect(s.stage, `${at} stage`).toBe('agents');
      }
    }
    expect(named).toBeGreaterThan(0);
    // Orbit is read from the vendor pages and the live specs, never from its code.
    for (const s of inStage('git')) {
      for (const c of s.causes) expect(c.proof.codebase, `${s.id}/${c.id}`).toBeUndefined();
    }
  });

  it('holds the Orbit and agent server messages, each tied to a problem in these stages', () => {
    const sources = new Set(ERROR_STRINGS.map((e) => e.source));
    expect(sources.has('orbit')).toBe(true);
    expect(sources.has('mcp')).toBe(true);
    expect(ERROR_SOURCE_LABEL.orbit).toBeTruthy();
    expect(ERROR_SOURCE_LABEL.mcp).toBeTruthy();
    expect(newMessages.length).toBeGreaterThanOrEqual(22);
    for (const e of ERROR_STRINGS.filter((x) => x.source === 'orbit' || x.source === 'mcp')) {
      const stage = symptomById(e.symptom ?? '')?.stage;
      expect(['git', 'agents'], `${e.id} points at a problem of these stages`).toContain(stage);
    }
  });

  // The retired single-instance statistic is guarded for all of web/src by stale-claims.test.ts.
  it('keeps the words the vendor never used and the figures nobody verified out of the copy', () => {
    const copy = strings([...routes, ...newMessages]).filter(
      ([path]) => !/\.(terms|lessons|labs|see|related|lint)\b/.test(path),
    );
    for (const [path, text] of copy) {
      // No release-stage label, and no word that points at a preview of the console.
      expect(/\bbeta\b/i.test(text), `${path} says beta`).toBe(false);
      expect(/\bpreview\b/i.test(text), `${path} says preview`).toBe(false);
      // Figures that belong to a README or a console sample, not to the network.
      expect(/19\.24|\b0\.48\b/.test(text), `${path} quotes a sample figure`).toBe(false);
      // Nothing deploys for you, and no connection is valid for a number of hours.
      expect(
        /\bdeploys? (it |this |that |everything )?for you\b/i.test(text),
        `${path} deploys for you`,
      ).toBe(false);
      expect(/\bvalid for \d+ hours?\b/i.test(text), `${path} gives a credential lifetime`).toBe(false);
    }
  });

  it('scopes "no balance" to app deployments, and says once that GPU rentals have one', () => {
    // FACTS 15.2.8: the balance page of the console says each deployment is paid for on its own and that
    // there is no balance to top up yet, and it describes a separate Flux Edge balance that GPU rentals draw
    // from today. A sentence that says there is no balance has to say whose balance it means.
    const copy = [
      ...routes.flatMap((s) => strings(s, s.id)),
      ...newMessages.flatMap((m) => strings(m, m.id)),
    ].filter(([path]) => !/\.(terms|lessons|labs|see|related|lint)\b/.test(path));
    for (const [path, text] of copy) {
      // The words of the page stay as a string a learner may see, quoted.
      if (/\.seen\[/.test(path)) continue;
      expect(/\bno (prepaid )?balance\b/i.test(text), `${path} says there is no balance`).toBe(false);
    }
    const claims = symptomById('console-claims-not-backed');
    const cause = claims?.causes.find((c) => c.id === 'balance-and-grace');
    expect(claims?.seen).toContain('There is no balance to top up yet.');
    expect(claims?.quick).toMatch(/balance for app deployments/);
    expect(cause?.why).toMatch(/balance for app deployments/);
    // The other balance is named once, as what the page says and not as something tried.
    expect(copy.filter(([, text]) => /\bGPU\b/.test(text)).map(([path]) => path)).toEqual([
      'console-claims-not-backed.causes[0].why',
    ]);
    expect(cause?.why).toMatch(/"Flux Edge balance" and says GPU rentals draw from it today/);
  });

  it('gives no share of Starter apps that are down, only the mechanism', () => {
    const symptom = symptomById('git-app-went-down');
    for (const [path, text] of strings(symptom)) {
      expect(/\d\s?(%|percent|per cent)/i.test(text), `${path} gives a percentage`).toBe(false);
    }
  });

  it('says the docs disagree wherever it says the health address is public', () => {
    // FACTS 15.3.6.1: the Webhook API page says /health is always public; the environment reference says
    // API_KEY covers it. The research notes call it UNVERIFIED, so a sentence may not state either as fact.
    for (const [path, text] of strings([...routes, ...newMessages])) {
      const mentions = /(\/health|health address)[^.]*\bpublic\b|\bpublic\b[^.]*(\/health|health address)/i;
      if (/\.command$/.test(path) || !mentions.test(text)) continue;
      expect(text, `${path} states the health address as public`).toMatch(
        /disagree|not reconciled|not settled/i,
      );
    }
  });

  it('types no price into the stage files: the engine writes them', () => {
    for (const file of ['stage-git.ts', 'stage-agents.ts']) {
      const code = codeOf(file);
      expect(/\$\s?\d/.test(code), `${file} types a dollar amount`).toBe(false);
      expect(/\bUSD\s?\d/.test(code), `${file} types a USD amount`).toBe(false);
      expect(/\b\d+(\.\d+)?\s?FLUX\b/.test(code), `${file} types a FLUX amount`).toBe(false);
    }
  });

  it('shows no secret and names only public hosts', () => {
    const allowed = [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'example.com',
      'runonflux.com',
      'runonflux.io',
      'docs.runonflux.com',
    ];
    const secret = [
      /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
      /\bglpat-[A-Za-z0-9_-]{10,}\b/,
      /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/,
      /\bsk-[A-Za-z0-9]{20,}\b/,
      /\bAKIA[0-9A-Z]{16}\b/,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    ];
    for (const [path, text] of strings([...routes, ...newMessages])) {
      for (const re of secret) expect(re.test(text), `${path} holds a secret-looking token`).toBe(false);
      for (const host of text.match(/\b(?:[a-z0-9-]+\.)+(?:com|io|org|net|dev|app|ai|xyz)\b/gi) ?? []) {
        const h = host.toLowerCase();
        expect(
          allowed.some((a) => h === a || h.endsWith(`.${a}`)),
          `${path} names the host ${host}`,
        ).toBe(true);
      }
    }
  });
});

describe('lint examples', () => {
  it('only names lint codes that exist', () => {
    for (const code of Object.keys(LINT_EXAMPLES)) {
      expect(code in LINT_CODES, code).toBe(true);
    }
  });

  it('raises the code it stands for', () => {
    const missing: string[] = [];
    for (const [code, example] of Object.entries(LINT_EXAMPLES)) {
      const spec = buildExampleSpec(example);
      if (!spec) {
        missing.push(`${code} (does not build)`);
        continue;
      }
      const codes = lintSpec(spec, { teaching: true }).issues.map((i) => i.code);
      if (!codes.includes(code)) missing.push(`${code} (raises ${codes.join(', ') || 'nothing'})`);
    }
    expect(missing).toEqual([]);
  });

  it('has one for every code except those that need live network data', () => {
    const without = Object.keys(LINT_CODES).filter((code) => !(code in LINT_EXAMPLES));
    expect(without.sort()).toEqual([...NEEDS_LIVE_DATA].sort());
  });

  it('raises what each lab link in the content says it shows', () => {
    const missing: string[] = [];
    for (const { where, example } of usedExamples()) {
      const spec = buildExampleSpec(example);
      if (!spec) {
        missing.push(`${where} (does not build)`);
        continue;
      }
      const codes = lintSpec(spec, { teaching: true }).issues.map((i) => i.code);
      for (const code of example.shows ?? []) {
        if (!codes.includes(code))
          missing.push(`${where} shows ${code} (raises ${codes.join(', ') || 'nothing'})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('builds a link the Spec Forge can read back', async () => {
    const example = LINT_EXAMPLES.PORT_FEE as SpecExample;
    const href = exampleHref(example);
    expect(href).toMatch(/^\/labs\/spec-forge#s=r\./);
    const payload = readShareHash(href?.slice(href.indexOf('#')) ?? '');
    expect(payload).toBeTruthy();
    const decoded = await decodeShare(payload as string);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value).toEqual(buildExampleSpec(example));
    }
  });
});

describe('the command deck index', () => {
  it('lists every symptom, message and code with a path that opens it', () => {
    const ids = TROUBLESHOOT_INDEX.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SYMPTOMS) expect(ids).toContain(s.id);
    for (const e of ERROR_STRINGS) expect(ids).toContain(`message-${e.id}`);
    for (const code of Object.keys(LINT_CODES)) expect(ids).toContain(`code-${code}`);
    for (const entry of TROUBLESHOOT_INDEX) {
      expect(entry.title.trim(), entry.id).not.toBe('');
      expect(entry.summary.trim(), entry.id).not.toBe('');
      expect(entry.path.startsWith('/troubleshoot#'), entry.id).toBe(true);
    }
  });
});
