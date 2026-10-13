import { LINT_CODES } from '@shared/flux/lint-catalogue';
import { describe, expect, it } from 'vitest';
import { ERROR_STRINGS, STAGE_IDS, SYMPTOMS } from '@/content/troubleshoot';
import {
  cleanNames,
  codesForSymptom,
  evidenceOf,
  evidenceSentence,
  fill,
  fragmentsOf,
  hrefOf,
  messagesForSymptom,
  neededNames,
  normalise,
  parseHash,
  search,
  stem,
  symptomsForCode,
  tokens,
  totalHits,
} from './model';

describe('parseHash', () => {
  it('is home with no hash', () => {
    expect(parseHash('')).toEqual({ kind: 'home' });
    expect(parseHash('#')).toEqual({ kind: 'home' });
  });

  it('opens a symptom by its id, whatever the case', () => {
    const first = SYMPTOMS[0];
    expect(first).toBeDefined();
    const v = parseHash(`#${first?.id}`);
    expect(v.kind).toBe('symptom');
    expect(parseHash(`#${first?.id.toUpperCase()}`).kind).toBe('symptom');
  });

  it('opens a stage', () => {
    for (const id of STAGE_IDS) {
      expect(parseHash(`#stage-${id}`)).toEqual({ kind: 'stage', stage: id });
    }
    expect(parseHash('#stage-nonsense').kind).toBe('unknown');
  });

  it('opens a message and a code', () => {
    const m = ERROR_STRINGS[1];
    expect(parseHash(`#message-${m?.id}`)).toEqual({ kind: 'messages', id: m?.id });
    expect(parseHash('#message-no-such-thing').kind).toBe('unknown');
    expect(parseHash('#code-PORT_FEE')).toEqual({ kind: 'codes', code: 'PORT_FEE' });
    expect(parseHash('#code-port_fee')).toEqual({ kind: 'codes', code: 'PORT_FEE' });
    expect(parseHash('#code-NOPE')).toMatchObject({ kind: 'unknown' });
  });

  it('opens the two tools by name', () => {
    expect(parseHash('#messages')).toEqual({ kind: 'messages', id: null });
    expect(parseHash('#decoder')).toEqual({ kind: 'messages', id: null });
    expect(parseHash('#codes')).toEqual({ kind: 'codes', code: null });
    expect(parseHash('#lint')).toEqual({ kind: 'codes', code: null });
  });

  it('survives a broken escape', () => {
    expect(parseHash('#%E0%A4%A').kind).toBe('unknown');
  });

  it('round trips the links it builds', () => {
    const s = SYMPTOMS[3];
    expect(parseHash(hrefOf.symptom(s?.id ?? '').split('#')[1] ?? '')).toMatchObject({ kind: 'symptom' });
    expect(parseHash(hrefOf.code('PORT_FEE').split('#')[1] ?? '')).toEqual({
      kind: 'codes',
      code: 'PORT_FEE',
    });
  });
});

describe('names', () => {
  it('cleans what the visitor typed', () => {
    expect(cleanNames({ app: ' My App! ', domain: 'https://Example.com/path' })).toEqual({
      app: 'MyApp',
      domain: 'example.com',
    });
    expect(cleanNames({ app: null, domain: undefined })).toEqual({ app: '', domain: '' });
  });

  it('fills the placeholders it has a value for', () => {
    expect(fill('curl /{app} on {domain}', { app: 'hello', domain: 'a.io' })).toBe('curl /hello on a.io');
    expect(fill('curl /{app} on {domain}', { app: '', domain: '' })).toBe('curl /{app} on {domain}');
  });

  it('finds the names a symptom wants', () => {
    const any = SYMPTOMS.some((s) => neededNames(s).app);
    expect(any).toBe(true);
    const wants = SYMPTOMS.find((s) => neededNames(s).domain);
    expect(wants).toBeDefined();
  });
});

describe('evidence', () => {
  it('counts the three states', () => {
    const e = evidenceOf([
      { proof: { status: 'verified', via: ['source'], facts: '1' } },
      { proof: { status: 'docs', facts: '2' } },
      { proof: { status: 'unverified', facts: '3', note: 'n' } },
      { proof: { status: 'verified', via: ['live'], facts: '4' } },
    ]);
    expect(e).toEqual({ total: 4, verified: 2, docs: 1, unverified: 1 });
    expect(evidenceSentence(e)).toBe(
      'Of 4 causes below: 2 read in the FluxOS source or seen on the live network, 1 from the official docs only, 1 not verified.',
    );
  });
});

describe('evidence read in other code', () => {
  it('keeps a proof read in the agent server or the console apart from the FluxOS source', () => {
    const e = evidenceOf([
      { proof: { status: 'verified', via: ['source'], facts: '1' } },
      { proof: { status: 'verified', via: ['source'], codebase: 'mcp', facts: '15.1.5' } },
      { proof: { status: 'verified', via: ['source', 'live'], codebase: 'console', facts: '15.2.2' } },
      { proof: { status: 'docs', facts: '2' } },
    ]);
    expect(e).toEqual({ total: 4, verified: 1, elsewhere: 2, docs: 1, unverified: 0 });
    expect(evidenceSentence(e)).toBe(
      'Of 4 causes below: 1 read in the FluxOS source or seen on the live network, 2 read in the code of the FluxCloud server package or console, or seen on the live network, 1 from the official docs only.',
    );
  });

  it('leaves the count out when no proof names other code', () => {
    const e = evidenceOf([{ proof: { status: 'verified', via: ['live'], facts: '1' } }]);
    expect('elsewhere' in e).toBe(false);
    expect(evidenceSentence(e)).toBe(
      'Of 1 cause below: 1 read in the FluxOS source or seen on the live network.',
    );
  });

  it('counts every cause of the Git and agent stages exactly once', () => {
    for (const s of SYMPTOMS.filter((x) => x.stage === 'git' || x.stage === 'agents')) {
      const e = evidenceOf(s.causes);
      expect(e.verified + (e.elsewhere ?? 0) + e.docs + e.unverified, s.id).toBe(s.causes.length);
      // Orbit is read from its pages, so a Git problem never claims code of the agent server.
      if (s.stage === 'git') expect(e.elsewhere, s.id).toBeUndefined();
    }
  });
});

describe('fragmentsOf', () => {
  it('keeps the literal runs and drops placeholders and elisions', () => {
    expect(fragmentsOf('Minimum number of instances is {n}')).toEqual(['minimum number of instances is']);
    expect(fragmentsOf('Image {name} cannot be found ... in registry')).toEqual([
      'image',
      'cannot be found',
      'in registry',
    ]);
  });
});

describe('tokens and normalise', () => {
  it('drops stop words and keeps codes whole and in parts', () => {
    expect(tokens('my app is stuck installing')).toEqual(['app', 'stuck', 'install']);
    expect(tokens('PORT_FEE')).toEqual(['port_fee', 'port', 'fee']);
  });
  it('stems so that forms of a word meet', () => {
    expect(stem('installing')).toBe(stem('installs'));
    expect(stem('installed')).toBe(stem('install'));
    expect(stem('instances')).toBe(stem('instance'));
    expect(stem('ports')).toBe(stem('port'));
    expect(stem('PORT_FEE')).toBe('PORT_FEE');
    expect(stem('ssl')).toBe('ssl');
    expect(stem('443')).toBe('443');
  });
  it('normalises markup', () => {
    expect(normalise('Use `docker` and {{term:image}}.')).toBe('use docker and image');
  });
});

describe('search', () => {
  it('finds a symptom by what you would say', () => {
    const r = search('my app is stuck installing');
    expect(r.symptoms[0]?.symptom.id).toBe('app-stuck-installing');
  });

  it('finds the same thing in another form of the words', () => {
    const r = search('app stuck install');
    expect(r.symptoms[0]?.symptom.id).toBe('app-stuck-installing');
  });

  it('lets a partial description through, ranked below a full one', () => {
    const r = search('stuck installing');
    const ids = r.symptoms.map((h) => h.symptom.id);
    expect(ids[0]).toBe('app-stuck-installing');
    expect(ids.length).toBeGreaterThan(1);
  });

  it('finds a code by name, with or without underscores', () => {
    const a = search('PORT_FEE');
    expect(a.best[0]).toMatchObject({ type: 'code', exact: true });
    expect(a.best[0]?.type === 'code' && a.best[0].meta.code).toBe('PORT_FEE');
    const b = search('port fee');
    expect(b.best[0]?.type === 'code' && b.best[0].meta.code).toBe('PORT_FEE');
  });

  it('finds a code inside pasted lint output', () => {
    const r = search('error  PORT_BANNED  compose[0].ports[0]  Port 22 is not allowed');
    expect(r.best.some((h) => h.type === 'code' && h.meta.code === 'PORT_BANNED')).toBe(true);
  });

  it('recognises a pasted error message and puts it first', () => {
    const r = search('Validation Error: Maximum number of instances is 100 and then some');
    const first = r.best.find((h) => h.type === 'message');
    expect(first?.type === 'message' && first.message.id).toBe('instances-maximum');
  });

  it('recognises a message with a placeholder', () => {
    const r = search('Minimum number of instances is 3');
    expect(r.best.some((h) => h.type === 'message' && h.message.id === 'instances-minimum')).toBe(true);
  });

  it('finds the Git problems by what you would say', () => {
    const cases: Array<[string, string]> = [
      ['webhook red cross', 'git-webhook-failing'],
      ['orbit failed to clone repository', 'git-cannot-clone'],
      ['build failed', 'git-build-failed'],
      ['cannot find module', 'git-build-failed'],
      ['javascript heap out of memory', 'git-build-failed'],
      ['app will not start', 'git-wont-start'],
      ['rolled back after health check', 'git-rolled-back'],
      ['pushed and nothing deployed', 'git-push-no-deploy'],
      ['variable ignored', 'git-variables-ignored'],
      ['files disappeared after deploy', 'git-data-disappears'],
      ['plan too small', 'git-plan-limits'],
      ['orbit app down', 'git-app-went-down'],
      ['deploy button', 'git-button-url'],
      ['orbit free plan', 'git-stale-guidance'],
    ];
    for (const [query, id] of cases) {
      expect(search(query).symptoms[0]?.symptom.id, query).toBe(id);
    }
  });

  it('finds the agent problems by what you would say', () => {
    const cases: Array<[string, string]> = [
      ['mcp not connecting', 'agent-cannot-connect'],
      ['unauthorized invalid_token', 'agent-keys-or-account'],
      ['confirm true', 'agent-plan-not-deployed'],
      ['executed false', 'agent-plan-not-deployed'],
      ['agent did not deploy', 'agent-plan-not-deployed'],
      ['timedOut', 'agent-wait-timed-out'],
      ['paid twice', 'agent-paid-twice'],
      ['previousHash', 'agent-update-shortened-term'],
      ['agent removed my app', 'agent-app-removed'],
      ['keys exposed in chat', 'agent-keys-exposed'],
      ['assistant did not deploy', 'assistant-did-not-deploy'],
      ['api token daily limit', 'console-claims-not-backed'],
      ['hosted version 0.2.2', 'agent-server-version-differs'],
      ['approval always allow', 'agent-approval-policy'],
      ['prompt injection', 'agent-prompt-injection'],
    ];
    for (const [query, id] of cases) {
      expect(search(query).symptoms[0]?.symptom.id, query).toBe(id);
    }
  });

  it('recognises a message of the Orbit app or an agent server and puts it first', () => {
    const cases: Array<[string, string]> = [
      ['this server is stateless, use POST', 'mcp-stateless-get'],
      ['keys missing', 'mcp-keys-missing'],
      ['Hash abc already exists. Not adding', 'node-hash-exists'],
      ['Connect your agent using browser sign-in', 'orbit-browser-sign-in'],
      ['The assistant is busy just now. Try again in a minute.', 'console-assistant-busy'],
      ['Deployment queued', 'orbit-deployment-queued'],
      ['fatal: Failed to clone repository https://github.com/a/b', 'orbit-failed-to-clone'],
      ["Error: Cannot find module 'express'", 'orbit-cannot-find-module'],
      ['Hook failed with exit code 1', 'orbit-hook-failed'],
      ['{"error":"Unauthorized","message":"Valid API key required"}', 'orbit-api-key-required'],
      [
        'Payer abc holds 0 FLUX spendable but needs about 5 FLUX. Fund the address and try again.',
        'mcp-payer-unfunded',
      ],
    ];
    for (const [query, id] of cases) {
      const first = search(query).best.find((h) => h.type === 'message');
      expect(first?.type === 'message' && first.message.id, query).toBe(id);
    }
  });

  it('recognises both heap messages in one pasted build log', () => {
    const r = search(
      '<--- Last few GCs ---> FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory',
    );
    const ids = r.best.flatMap((h) => (h.type === 'message' ? [h.message.id] : []));
    expect(ids).toContain('orbit-heap-limit');
    expect(ids).toContain('orbit-heap-out-of-memory');
  });

  it('returns nothing for blank and for gibberish', () => {
    expect(totalHits(search(''))).toBe(0);
    expect(totalHits(search('   '))).toBe(0);
    expect(totalHits(search('qzxwvv'))).toBe(0);
  });

  it('puts exact matches before ranked ones and does not repeat them', () => {
    const r = search('PORT_FEE');
    expect(r.codes.some((h) => h.meta.code === 'PORT_FEE')).toBe(false);
  });

  it('bounds a very long paste', () => {
    const r = search('x'.repeat(50_000));
    expect(r.query.length).toBeLessThanOrEqual(2000);
  });
});

describe('cross links', () => {
  it('maps symptoms to the codes they cite and back', () => {
    const withCodes = SYMPTOMS.find((s) => codesForSymptom(s).length > 0);
    expect(withCodes).toBeDefined();
    const code = withCodes ? (codesForSymptom(withCodes)[0] as string) : '';
    expect(symptomsForCode(code).map((s) => s.id)).toContain(withCodes?.id);
  });

  it('only names codes that exist', () => {
    for (const s of SYMPTOMS) {
      for (const c of codesForSymptom(s)) expect(c in LINT_CODES).toBe(true);
    }
  });

  it('lists the messages that point at a symptom', () => {
    const m = ERROR_STRINGS.find((e) => e.symptom);
    expect(m).toBeDefined();
    expect(messagesForSymptom(m?.symptom ?? '').map((x) => x.id)).toContain(m?.id);
  });
});
