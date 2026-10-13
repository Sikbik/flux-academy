import {
  approvalRecommended,
  BAKED_PRICING,
  describeApproval,
  lintSpec,
  MCP_TOOLS,
  ORBIT_PLANS,
  orbitPlanById,
  orbitPlanQuoteUsd,
  quote,
  toolByName,
  toolRiskLabel,
} from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { getTerm } from '@/learn/glossary';
import { markupRefs, parseMarkup } from '@/learn/markup';
import { buildDebrief, outcomeOf, wantsLint } from './debrief.ts';
import { debriefLint } from './debrief-lint.ts';
import { allWalks, bestPath } from './paths.ts';
import { asks, POLICIES, silentUnderAskSpends, whyAsked } from './policy.ts';
import { SCENARIO_LIST, SCENARIOS } from './scenarios/index.ts';
import { decide, prepare, promptOf, runToBlock, startSession, valuesFor } from './session.ts';
import { resolveTokens, tokensIn, tokenValues } from './tokens.ts';
import { POLICY_IDS, type PolicyId, SCENARIO_IDS, type ScenarioId, type SessionState } from './types.ts';

const PLANS = ORBIT_PLANS.map((p) => p.id);

/** The two dashes the academy never uses in prose. Built from code points so no dash is typed in this file. */
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

/** Every string a scenario can put on the screen, with where it sits, for the content rules below. */
function strings(id: ScenarioId): { where: string; text: string; user: boolean }[] {
  const s = SCENARIOS[id];
  const out: { where: string; text: string; user: boolean }[] = [];
  const add = (where: string, text: string | undefined, user = false) => {
    if (text !== undefined) out.push({ where: `${id}.${where}`, text, user });
  };
  add('card.title', s.card.title);
  add('card.teaches', s.card.teaches);
  add('card.summary', s.card.summary);
  add('request', s.request, true);
  for (const b of Object.values(s.beats)) {
    switch (b.kind) {
      case 'say':
        add(`${b.id}.text`, b.text, b.who === 'user');
        break;
      case 'note':
        add(`${b.id}.title`, b.title);
        add(`${b.id}.text`, b.text);
        break;
      case 'call':
        add(`${b.id}.why`, b.why);
        for (const a of b.args) {
          add(`${b.id}.arg.${a.name}`, a.value);
          add(`${b.id}.arg.${a.name}.note`, a.note);
          for (const l of a.lines ?? []) add(`${b.id}.arg.${a.name}.line`, l);
        }
        for (const r of b.result) {
          add(`${b.id}.result`, r.v);
          add(`${b.id}.result.k`, r.k);
        }
        for (const r of b.refuseReasons ?? []) add(`${b.id}.reason.${r.id}`, r.label, true);
        for (const e of b.effects ?? []) {
          if ('text' in e) add(`${b.id}.effect`, e.text);
          if (e.kind === 'spend') add(`${b.id}.effect.label`, e.label);
        }
        break;
      case 'human':
        add(`${b.id}.title`, b.title);
        add(`${b.id}.text`, b.text);
        for (const c of b.choices) add(`${b.id}.choice.${c.id}`, c.label);
        break;
      default:
        break;
    }
  }
  for (const e of Object.values(s.endings)) {
    add(`ending.${e.id}.title`, e.title);
    add(`ending.${e.id}.summary`, e.summary);
    add(`ending.${e.id}.takeaway`, e.takeaway);
    add(`ending.${e.id}.silent`, e.silent?.takeaway);
  }
  for (const [i, f] of s.facts.entries()) add(`fact.${i}`, f.text);
  return out;
}

describe('policy', () => {
  it('asks per the rules: reads never prompt, ask-all asks for non-reads, ask-spends for spenders', () => {
    for (const tool of MCP_TOOLS) {
      expect(asks('allow-all', tool), `${tool.name} allow-all`).toBe(false);
      if (tool.risk === 'reads') {
        expect(asks('ask-all', tool), `${tool.name} read ask-all`).toBe(false);
        expect(asks('ask-spends', tool), `${tool.name} read ask-spends`).toBe(false);
      } else {
        expect(asks('ask-all', tool), `${tool.name} ask-all`).toBe(true);
        expect(asks('ask-spends', tool), `${tool.name} ask-spends`).toBe(tool.spends !== 'never');
      }
      // ask-all is the academy's own recommendation.
      expect(asks('ask-all', tool) === approvalRecommended(tool) || tool.risk === 'reads').toBe(true);
    }
  });

  it('lets flux_control_app through under ask-spends: it spends nothing but can delete data', () => {
    const control = toolByName('flux-cloud', 'flux_control_app');
    expect(control).toBeDefined();
    if (!control) return;
    expect(control.risk).toBe('destroys');
    expect(asks('ask-spends', control)).toBe(false);
    expect(asks('ask-all', control)).toBe(true);
    const silent = silentUnderAskSpends(MCP_TOOLS.filter((t) => t.server === 'flux-cloud')).map(
      (t) => t.name,
    );
    expect(silent).toContain('flux_control_app');
    expect(silent).toContain('flux_generate_keys');
    expect(silent).not.toContain('flux_deploy_app');
  });

  it('has a label, a detail and a gap sentence for every policy, and never an em dash', () => {
    for (const id of POLICY_IDS) {
      const p = POLICIES[id];
      expect(p.label.length).toBeGreaterThan(10);
      for (const t of [p.label, p.short, p.detail, p.gap]) expect(t).not.toContain(EM_DASH);
    }
    const deploy = toolByName('flux-cloud', 'flux_deploy_app');
    if (deploy) {
      expect(whyAsked('ask-all', deploy)).toMatch(/not a read/);
      expect(whyAsked('ask-spends', deploy)).toMatch(/spend/);
    }
  });
});

describe('scenario data', () => {
  it('uses only tools that exist on the scenario server', () => {
    for (const s of SCENARIO_LIST) {
      for (const b of Object.values(s.beats)) {
        if (b.kind !== 'call') continue;
        expect(b.server, `${s.id}.${b.id} server`).toBe(s.server);
        expect(toolByName(b.server, b.tool), `${s.id}.${b.id} ${b.tool}`).toBeDefined();
      }
    }
  });

  it('wires every beat: targets exist, endings exist, every beat is reachable from the start', () => {
    for (const s of SCENARIO_LIST) {
      const ids = new Set(Object.keys(s.beats));
      expect(ids.has(s.start), `${s.id} start`).toBe(true);
      const reach = new Set<string>();
      const stack = [s.start];
      while (stack.length > 0) {
        const id = stack.pop();
        if (id === undefined || reach.has(id)) continue;
        reach.add(id);
        const b = s.beats[id];
        expect(b, `${s.id}.${id}`).toBeDefined();
        if (!b) continue;
        const next: string[] = [];
        switch (b.kind) {
          case 'say':
          case 'note':
            next.push(b.next);
            break;
          case 'call':
            next.push(b.next);
            if (b.refused) next.push(b.refused);
            for (const r of b.refuseReasons ?? []) next.push(r.next);
            break;
          case 'human':
            for (const c of b.choices) next.push(c.next);
            break;
          case 'branch':
            next.push(b.match, b.otherwise);
            break;
          case 'end':
            expect(s.endings[b.ending], `${s.id}.${b.id} ending`).toBeDefined();
            break;
        }
        for (const n of next) {
          expect(ids.has(n), `${s.id}.${id} -> ${n}`).toBe(true);
          stack.push(n);
        }
      }
      for (const id of ids) expect(reach.has(id), `${s.id}.${id} is unreachable`).toBe(true);
    }
  });

  it('gives every call that any policy can stop a way to refuse it', () => {
    for (const s of SCENARIO_LIST) {
      for (const b of Object.values(s.beats)) {
        if (b.kind !== 'call' || b.earlier) continue;
        const tool = toolByName(b.server, b.tool);
        if (!tool || tool.risk === 'reads') continue;
        const can = b.refused !== undefined || (b.refuseReasons?.length ?? 0) > 0;
        expect(can, `${s.id}.${b.id} (${b.tool}) has no refusal path`).toBe(true);
      }
    }
  });

  it('marks key arguments as placeholders and never contains a key, an address or a token', () => {
    const WIF = /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/;
    const ADDRESS = /\b(?:t1|t3|1)[1-9A-HJ-NP-Za-km-z]{25,34}\b/;
    const HEX = /\b[0-9a-fA-F]{40,}\b/;
    // A long unbroken run of base64 characters. Hyphens are left out on purpose: the planted log line is
    // words joined by hyphens, which is prose, not a secret.
    const LONG = /[A-Za-z0-9+/_=]{32,}/;
    const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
    const BEARER = /Bearer\s+[A-Za-z0-9._-]{10,}/i;
    const PEM = /-----BEGIN/;
    for (const id of SCENARIO_IDS) {
      for (const { where, text } of strings(id)) {
        for (const re of [WIF, ADDRESS, HEX, LONG, JWT, BEARER, PEM]) {
          expect(re.test(text), `${where}: "${text}" looks like a key or token (${re})`).toBe(false);
        }
      }
      for (const b of Object.values(SCENARIOS[id].beats)) {
        if (b.kind !== 'call') continue;
        for (const a of b.args) {
          if (a.key) expect(a.value, `${id}.${b.id}.${a.name}`).toMatch(/^YOUR_[A-Z_]+$/);
          if (/privatekey/i.test(a.name))
            expect(a.key, `${id}.${b.id}.${a.name} must be flagged key`).toBe(true);
        }
      }
    }
  });

  it('has no em dash, no emoji and no exclamation mark in anything it shows', () => {
    // Pictographs and dingbats: the academy has no emoji anywhere.
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}]/u;
    for (const id of SCENARIO_IDS) {
      for (const { where, text } of strings(id)) {
        expect(text, where).not.toContain(EM_DASH);
        expect(text, where).not.toContain(EN_DASH);
        expect(EMOJI.test(text), `${where} has an emoji`).toBe(false);
        expect(text, `${where} has an exclamation mark`).not.toContain('!');
      }
    }
  });

  it('types no amount and no duration: those come from the engine as tokens', () => {
    const MONEY = [
      /\$\s?\d/,
      /\bUSD\s?\d/i,
      /\d\s?USD\b/i,
      /\d\s?FLUX\b/i,
      /\b\d+\.\d{2}\b/,
      // "a second payment" is an ordinal, so "second" counts as a unit only after a number.
      /\b(?:a|an|one)\s+(?:hour|minute|day|week|month|block)\b/i,
      /\b(?:two|three|four|five|six|\d+)\s+(?:hour|minute|second|day|week|month|block)s?\b/i,
    ];
    for (const id of SCENARIO_IDS) {
      for (const { where, text, user } of strings(id)) {
        // What the person asked for is an input, not a computed figure.
        if (user) continue;
        for (const re of MONEY)
          expect(re.test(text), `${where}: "${text}" types a figure (${re})`).toBe(false);
      }
    }
  });

  it('uses only tokens the engine knows, and leaves none unresolved on screen', () => {
    for (const id of SCENARIO_IDS) {
      const plan = id === 'orbit-repo' ? { plan: 'standard' as const } : {};
      const p = prepare(id, plan);
      const known = new Set(Object.keys(valuesFor(p, 'main')));
      for (const { where, text } of strings(id)) {
        for (const t of tokensIn(text)) expect(known.has(t), `${where}: unknown token {${t}}`).toBe(true);
      }
    }
  });

  it('parses as markup with no problem, and links only glossary terms that exist', () => {
    for (const id of SCENARIO_IDS) {
      for (const { where, text } of strings(id)) {
        expect(parseMarkup(text).problems, `${where}: ${text}`).toEqual([]);
        for (const term of markupRefs(text).terms) {
          expect(getTerm(term), `${where} links the glossary term ${term}`).toBeDefined();
        }
      }
    }
  });
});

describe('specifications', () => {
  it('build, normalise and lint as each scenario says they do', () => {
    for (const id of SCENARIO_IDS) {
      const options = id === 'orbit-repo' ? PLANS.map((plan) => ({ plan })) : [{}];
      for (const o of options) {
        const variants = SCENARIOS[id].specs(o);
        expect(variants.main, `${id} main spec`).toBeDefined();
        for (const [key, v] of Object.entries(variants)) {
          const report = lintSpec(v.spec);
          expect(
            report.valid,
            `${id}/${key} has lint errors: ${report.issues.map((i) => i.code).join(',')}`,
          ).toBe(true);
          const codes = report.issues.filter((i) => i.severity !== 'info').map((i) => i.code);
          for (const expected of v.expectLint)
            expect(codes, `${id}/${key} should raise ${expected}`).toContain(expected);
          // Anything else the engine warns about must be listed on purpose.
          const allowed = new Set([...v.expectLint, ...extraAllowed(id, o)]);
          for (const c of codes) expect(allowed.has(c), `${id}/${key} raises ${c}`).toBe(true);
        }
      }
    }
  });

  it('prices the first scenario from quote(), and the flaw does not change the price', () => {
    const p = prepare('deploy-nginx');
    const main = quote(p.specs.main?.spec ?? (undefined as never), BAKED_PRICING.params, {
      fluxUsd: BAKED_PRICING.fluxUsd,
    });
    const fixed = quote(p.specs.fixed?.spec ?? (undefined as never), BAKED_PRICING.params, {
      fluxUsd: BAKED_PRICING.fluxUsd,
    });
    expect(p.quotes.main?.usd).toBe(main.usdTotal);
    expect(p.quotes.main?.usd).toBe(p.quotes.fixed?.usd);
    expect(main.usdTotal).toBe(fixed.usdTotal);
  });

  it('shows the Orbit plan price from orbitPlanQuoteUsd, equal to the published price', () => {
    for (const plan of ORBIT_PLANS) {
      const p = prepare('orbit-repo', { plan: plan.id });
      expect(p.plan?.usd).toBe(orbitPlanQuoteUsd(plan));
      expect(p.plan?.usd).toBe(plan.usd);
      expect(p.quotes.main?.usd).toBe(plan.usd);
      expect(orbitPlanById(plan.id)).toBeDefined();
    }
  });

  it('resolves every FLUX figure from the baked FLUX price, and says which', () => {
    const p = prepare('deploy-nginx');
    const values = valuesFor(p, 'main');
    expect(values.flux).toMatch(/^\d+\.\d{2} FLUX$/);
    expect(values.pricingDate).toBe(BAKED_PRICING.capturedAt);
  });
});

describe('tokens', () => {
  it('replaces known tokens and leaves unknown ones visible', () => {
    expect(resolveTokens('a {x} b {y}', { x: '1' })).toBe('a 1 b {y}');
    expect(tokensIn('{usd} and {{term:mcp}} and {term:x}')).toEqual(['usd']);
  });

  it('takes durations from the timing constants', () => {
    const p = prepare('retry-after-timeout');
    const v = valuesFor(p, 'main');
    expect(v.messageLife).toBe('1 hour');
    expect(v.deployEstimate).toBe('45 minutes');
    expect(v.cancelTerm).toBe('1 hour');
    expect(
      tokenValues({
        spec: p.specs.main?.spec ?? (undefined as never),
        quote: p.quotes.main ?? (undefined as never),
        plan: null,
        repo: '',
      }).paymentWindow,
    ).toBe('30 minutes');
  });
});

describe('the session engine', () => {
  const start = (scenario: ScenarioId, policy: PolicyId, plan?: 'starter' | 'standard' | 'pro') =>
    startSession({ scenario, policy, ...(plan ? { options: { plan } } : {}) });

  it('stops at the first prompt and waits there', () => {
    const s = runToBlock(start('deploy-nginx', 'ask-all'));
    expect(s.status).toBe('awaiting');
    const prompt = promptOf(s);
    expect(prompt?.kind).toBe('approve');
    expect(prompt?.tool?.name).toBe('flux_deploy_app');
    // Everything before it was a read and ran without asking.
    const calls = s.entries.filter((e) => e.kind === 'call');
    expect(
      calls.slice(0, -1).every((c) => c.kind === 'call' && c.gate === 'read' && c.status === 'ran'),
    ).toBe(true);
    expect(calls.at(-1)?.kind === 'call' && calls.at(-1)?.status === 'pending').toBe(true);
  });

  it('does not move on an invalid decision and ignores a decision with nothing waiting', () => {
    const s = runToBlock(start('deploy-nginx', 'ask-all'));
    expect(decide(s, { choice: 'human', id: 'pay' })).toBe(s);
    expect(decide(s, { choice: 'reason', id: 'pin-tag' })).toBe(s);
    const done = runToBlock(start('deploy-nginx', 'allow-all'));
    expect(decide(done, { choice: 'approve' })).toBe(done);
  });

  it('runs the whole first scenario unasked under allow-all and pays once for the flawed plan', () => {
    const s = runToBlock(start('deploy-nginx', 'allow-all'));
    expect(s.status).toBe('finished');
    expect(s.ending).toBe('deployed-floating');
    const o = outcomeOf(s);
    expect(o.prompts).toBe(0);
    expect(o.ranUnasked).toEqual(['flux_deploy_app', 'flux_deploy_app']);
    expect(o.paidUsd).toBe(prepare('deploy-nginx').quotes.main?.usd);
    expect(o.goalMet).toBe(false);
    expect(o.verdict).toBe('flawed');
  });

  it('lets the learner catch the flaw: refuse the confirm, say why, and pay once for the pinned plan', () => {
    let s = runToBlock(start('deploy-nginx', 'ask-all'));
    s = runToBlock(decide(s, { choice: 'approve' })); // the plan
    expect(promptOf(s)?.tool?.name).toBe('flux_deploy_app');
    s = decide(s, { choice: 'refuse' }); // the confirm
    expect(promptOf(s)?.kind).toBe('reason');
    expect(promptOf(s)?.reasons.map((r) => r.id)).toEqual(['pin-tag', 'stop']);
    s = runToBlock(decide(s, { choice: 'reason', id: 'pin-tag' }));
    expect(s.specKey).toBe('fixed');
    // A new plan, then a new confirm: both asked.
    expect(promptOf(s)?.tool?.name).toBe('flux_deploy_app');
    s = runToBlock(decide(s, { choice: 'approve' }));
    s = runToBlock(decide(s, { choice: 'approve' }));
    expect(s.status).toBe('finished');
    expect(s.ending).toBe('deployed-pinned');
    const o = outcomeOf(s);
    expect(o.goalMet).toBe(true);
    expect(o.refused).toEqual(['flux_deploy_app']);
    expect(o.paidUsd).toBe(prepare('deploy-nginx').quotes.fixed?.usd);
    expect(o.wastedUsd).toBe(0);
    // The reason the learner chose is in the transcript as their own words.
    expect(s.entries.some((e) => e.kind === 'say' && e.who === 'user' && /pin a version/i.test(e.text))).toBe(
      true,
    );
    // The pinned image is what the later calls show.
    const wait = s.entries.filter((e) => e.kind === 'call' && e.tool === 'flux_get_app').at(-1);
    expect(wait?.kind === 'call' && wait.result?.some((l) => l.v.includes('nginx:1.27'))).toBe(true);
  });

  it('is deterministic: the same decisions give the same state', () => {
    for (const scenario of SCENARIO_IDS) {
      for (const policy of POLICY_IDS) {
        const a = allWalks(scenario, policy);
        const b = allWalks(scenario, policy);
        expect(JSON.stringify(a.map((w) => w.final))).toBe(JSON.stringify(b.map((w) => w.final)));
      }
    }
  });

  it('reaches a defined ending, with a debrief, on every path of every scenario and policy', () => {
    for (const scenario of SCENARIO_IDS) {
      for (const policy of POLICY_IDS) {
        const options = scenario === 'orbit-repo' ? PLANS.map((plan) => ({ plan })) : [{}];
        for (const o of options) {
          const walks = allWalks(scenario, policy, o);
          expect(walks.length, `${scenario}/${policy}`).toBeGreaterThan(0);
          for (const w of walks) {
            expect(w.final.status).toBe('finished');
            const lint = debriefLint(w.final);
            // A scenario that does not ask for the validator's lines has none to load.
            if (!wantsLint(w.final)) expect(lint, `${scenario}/${policy}`).toEqual([]);
            const d = buildDebrief(w.final, lint);
            expect(d.title.length).toBeGreaterThan(0);
            expect(d.takeaway.length).toBeGreaterThan(0);
            expect(d.facts.length).toBeGreaterThan(0);
            // Nothing on the debrief is an unresolved token.
            const all = JSON.stringify(d);
            expect(
              /\{[A-Za-z]+\}/.test(all),
              `${scenario}/${policy} left a token: ${all.match(/\{[A-Za-z]+\}/)?.[0]}`,
            ).toBe(false);
            // Money adds up and is never negative.
            expect(d.cost.totalUsd).toBeGreaterThanOrEqual(0);
            expect(d.cost.wastedUsd).toBeLessThanOrEqual(d.cost.totalUsd);
          }
        }
      }
    }
  });

  it('reaches every transcript line with its tokens resolved', () => {
    for (const scenario of SCENARIO_IDS) {
      for (const policy of POLICY_IDS) {
        for (const w of allWalks(scenario, policy)) {
          const text = JSON.stringify(w.final.entries);
          expect(/\{[A-Za-z]+\}/.test(text), `${scenario}/${policy} left a token`).toBe(false);
          expect(text).not.toContain('@spec');
          expect(text).not.toContain('@plans');
        }
      }
    }
  });
});

describe('outcomes by policy', () => {
  const endings = (scenario: ScenarioId, policy: PolicyId, plan?: 'starter' | 'standard' | 'pro') =>
    [
      ...new Set(allWalks(scenario, policy, plan ? { plan } : {}).map((w) => w.final.ending ?? '(none)')),
    ].sort();

  it('deploy-nginx: the same two prompts under ask-all and ask-spends, none under allow-all', () => {
    expect(endings('deploy-nginx', 'ask-all')).toEqual(['declined', 'deployed-floating', 'deployed-pinned']);
    expect(endings('deploy-nginx', 'ask-spends')).toEqual([
      'declined',
      'deployed-floating',
      'deployed-pinned',
    ]);
    expect(endings('deploy-nginx', 'allow-all')).toEqual(['deployed-floating']);
  });

  it('poisoned-log: only ask-all gives you the chance to refuse; ask-spends removes silently', () => {
    expect(endings('poisoned-log', 'ask-all')).toEqual(['app-removed', 'refused-injection']);
    expect(endings('poisoned-log', 'ask-spends')).toEqual(['app-removed']);
    expect(endings('poisoned-log', 'allow-all')).toEqual(['app-removed']);
    const silent = runToBlock(startSession({ scenario: 'poisoned-log', policy: 'ask-spends' }));
    const o = outcomeOf(silent);
    expect(o.prompts).toBe(0);
    expect(o.ranUnasked).toEqual(['flux_control_app']);
    expect(o.dataDeleted).toBe(true);
    expect(buildDebrief(silent).takeaway).toMatch(/No prompt appeared/);
  });

  it('poisoned-log under ask-all: approving removes the app, refusing keeps it', () => {
    const at = runToBlock(startSession({ scenario: 'poisoned-log', policy: 'ask-all' }));
    expect(promptOf(at)?.tool?.name).toBe('flux_control_app');
    const yes = runToBlock(decide(at, { choice: 'approve' }));
    expect(outcomeOf(yes).dataDeleted).toBe(true);
    expect(outcomeOf(yes).goalMet).toBe(false);
    const no = runToBlock(decide(at, { choice: 'refuse' }));
    expect(no.ending).toBe('refused-injection');
    expect(outcomeOf(no).dataDeleted).toBe(false);
    expect(outcomeOf(no).goalMet).toBe(true);
    expect(outcomeOf(no).refused).toEqual(['flux_control_app']);
  });

  it('retry-after-timeout: refusing the second payment is the only path that pays once', () => {
    expect(endings('retry-after-timeout', 'ask-all')).toEqual(['app-ended', 'checked-first', 'paid-twice']);
    expect(endings('retry-after-timeout', 'ask-spends')).toEqual([
      'app-ended',
      'checked-first',
      'paid-twice',
    ]);
    expect(endings('retry-after-timeout', 'allow-all')).toEqual(['app-ended']);
    const q = prepare('retry-after-timeout').quotes.main?.usd ?? 0;
    const at = runToBlock(startSession({ scenario: 'retry-after-timeout', policy: 'ask-all' }));
    expect(promptOf(at)?.tool?.name).toBe('flux_deploy_app');
    const careful = runToBlock(decide(at, { choice: 'refuse' }));
    expect(careful.ending).toBe('checked-first');
    expect(outcomeOf(careful).paidUsd).toBe(q);
    expect(outcomeOf(careful).wastedUsd).toBe(0);
    expect(careful.entries.some((e) => e.kind === 'call' && e.tool === 'flux_get_app')).toBe(true);
    const twice = runToBlock(decide(at, { choice: 'approve' }));
    expect(promptOf(twice)?.tool?.name).toBe('flux_cancel_app');
    const keep = runToBlock(decide(twice, { choice: 'refuse' }));
    expect(keep.ending).toBe('paid-twice');
    expect(outcomeOf(keep).paidUsd).toBe(Number((q * 2).toFixed(2)));
    expect(outcomeOf(keep).wastedUsd).toBe(q);
    const ended = runToBlock(decide(twice, { choice: 'approve' }));
    expect(ended.ending).toBe('app-ended');
    expect(outcomeOf(ended).appEnded).toBe(true);
    expect(buildDebrief(ended).cost.smallFees.length).toBe(1);
  });

  it('retry-after-timeout under allow-all: a timeout becomes two payments and a cancel with no prompt', () => {
    const s = runToBlock(startSession({ scenario: 'retry-after-timeout', policy: 'allow-all' }));
    const o = outcomeOf(s);
    expect(o.prompts).toBe(0);
    expect(o.ranUnasked).toEqual(['flux_deploy_app', 'flux_cancel_app']);
    expect(buildDebrief(s).takeaway).toMatch(/No prompt appeared/);
  });

  it('orbit-repo: the checkout is the person, whatever the policy says', () => {
    for (const plan of PLANS) {
      expect(endings('orbit-repo', 'ask-all', plan)).toEqual([
        'declined',
        'deployed',
        'registered-unpaid',
        'unpaid',
      ]);
      expect(endings('orbit-repo', 'ask-spends', plan)).toEqual([
        'declined',
        'deployed',
        'registered-unpaid',
        'unpaid',
      ]);
      expect(endings('orbit-repo', 'allow-all', plan)).toEqual(['deployed', 'unpaid']);
    }
    // Under allow-all the agent registers and creates the checkout without asking, and still cannot pay.
    const s = runToBlock(startSession({ scenario: 'orbit-repo', policy: 'allow-all' }));
    expect(s.status).toBe('awaiting');
    expect(promptOf(s)?.kind).toBe('human');
    expect(s.payments).toEqual([]);
    const paid = runToBlock(decide(s, { choice: 'human', id: 'pay' }));
    expect(paid.ending).toBe('deployed');
    expect(outcomeOf(paid).paidUsd).toBe(prepare('orbit-repo').plan?.usd);
  });

  it('orbit-repo shows no invented arguments and prices the chosen plan', () => {
    for (const plan of PLANS) {
      const s = runToBlock(startSession({ scenario: 'orbit-repo', policy: 'ask-all', options: { plan } }));
      for (const e of s.entries) {
        if (e.kind === 'call') {
          expect(e.argsUnknown, `${e.tool} args`).toBe(true);
          expect(e.args).toEqual([]);
        }
      }
      const text = JSON.stringify(s.entries);
      expect(text).toContain(`$${(orbitPlanById(plan)?.usd ?? 0).toFixed(2)}`);
    }
  });

  it('counts every proposed call that carried a key, refused or not', () => {
    const s = runToBlock(startSession({ scenario: 'deploy-nginx', policy: 'allow-all' }));
    const o = outcomeOf(s);
    // identity, plan, confirm
    expect(o.keysSent).toBe(3);
    expect(buildDebrief(s).exposed[0]).toMatch(/3 calls/);
  });
});

describe('the debrief', () => {
  it('lists each non-read call with what every policy would have done', () => {
    const s = runToBlock(startSession({ scenario: 'poisoned-log', policy: 'allow-all' }));
    const d = buildDebrief(s);
    expect(d.rows).toHaveLength(1);
    const row = d.rows[0];
    expect(row?.tool).toBe('flux_control_app');
    expect(row?.asks).toEqual({ 'ask-all': true, 'ask-spends': false, 'allow-all': false });
    expect(row?.happened).toBe('ran-unasked');
    expect(row?.riskLabel).toBe('Can delete data');
    expect(d.readCount).toBe(2);
    expect(d.letThrough.map((x) => x.tool)).toEqual(['flux_control_app']);
    expect(d.silentTools.map((x) => x.tool)).toContain('flux_control_app');
  });

  it('marks the calls the learner decided, and the calls that ran earlier', () => {
    const at = runToBlock(startSession({ scenario: 'retry-after-timeout', policy: 'ask-all' }));
    const d = buildDebrief(runToBlock(decide(at, { choice: 'refuse' })));
    const deploys = d.rows.filter((r) => r.tool === 'flux_deploy_app');
    expect(deploys.map((r) => r.happened)).toEqual(['earlier', 'earlier', 'refused']);
    expect(deploys.every((r) => r.asks['ask-all'] && r.asks['ask-spends'] && !r.asks['allow-all'])).toBe(
      true,
    );
  });

  it('explains the planted line and the flaw with the real lint text', () => {
    const flawedState = runToBlock(startSession({ scenario: 'deploy-nginx', policy: 'allow-all' }));
    const flawed = debriefLint(flawedState);
    expect(flawed.map((l) => l.code)).toEqual(['IMAGE_LATEST']);
    expect(flawed[0]?.fixed).toBe(false);
    expect(flawed[0]?.why.length).toBeGreaterThan(20);
    // The debrief itself takes the lines as an argument and carries them as given.
    expect(buildDebrief(flawedState).lint).toEqual([]);
    expect(buildDebrief(flawedState, flawed).lint).toEqual(flawed);
    const log = runToBlock(startSession({ scenario: 'poisoned-log', policy: 'ask-spends' }));
    const planted = log.entries
      .flatMap((e) => (e.kind === 'call' ? (e.result ?? []) : []))
      .filter((l) => l.planted);
    expect(planted).toHaveLength(1);
    expect(planted[0]?.v).toContain('TEST-LINE');
  });

  it('tags statements that FACTS leaves unverified as guidance', () => {
    for (const s of SCENARIO_LIST) {
      expect(s.facts.length, s.id).toBeGreaterThan(3);
    }
    const retry = SCENARIOS['retry-after-timeout'].facts;
    expect(retry.some((f) => f.basis === 'guidance' && /second signed message/.test(f.text))).toBe(true);
    expect(SCENARIOS['orbit-repo'].facts.some((f) => f.basis === 'guidance')).toBe(true);
  });

  it('describes every call on every path with the catalogue sentence and risk label', () => {
    for (const scenario of SCENARIO_IDS) {
      const s = runToBlock(startSession({ scenario, policy: 'allow-all' }));
      for (const item of s.trail) {
        const tool = toolByName(item.server, item.tool);
        expect(tool).toBeDefined();
        if (!tool) continue;
        expect(describeApproval(tool).length).toBeGreaterThan(20);
        expect(toolRiskLabel(tool).length).toBeGreaterThan(5);
      }
    }
  });
});

describe('Show me', () => {
  it('finds the shortest path to the goal where one exists', () => {
    const decisions = bestPath('poisoned-log', 'ask-all');
    expect(decisions).toEqual([{ choice: 'refuse' }]);
    const retry = bestPath('retry-after-timeout', 'ask-spends');
    expect(retry).toEqual([{ choice: 'refuse' }]);
    const nginx = bestPath('deploy-nginx', 'ask-all');
    // Catch it at the plan: refuse, say why, then approve the new plan and the new confirm.
    expect(nginx).toEqual([
      { choice: 'refuse' },
      { choice: 'reason', id: 'pin-tag' },
      { choice: 'approve' },
      { choice: 'approve' },
    ]);
    const orbit = bestPath('orbit-repo', 'ask-all');
    expect(orbit).toEqual([{ choice: 'approve' }, { choice: 'approve' }, { choice: 'human', id: 'pay' }]);
  });

  it('falls back to the least harmful ending when the policy makes the goal impossible', () => {
    expect(bestPath('poisoned-log', 'allow-all')).toEqual([]);
    expect(bestPath('deploy-nginx', 'allow-all')).toEqual([]);
    const s = runToBlock(startSession({ scenario: 'orbit-repo', policy: 'allow-all' }));
    expect(bestPath('orbit-repo', 'allow-all')).toEqual([{ choice: 'human', id: 'pay' }]);
    expect(s.status).toBe('awaiting');
  });

  it('reaches the goal when its path is replayed', () => {
    for (const scenario of SCENARIO_IDS) {
      for (const policy of POLICY_IDS) {
        let s: SessionState = startSession({ scenario, policy });
        for (const d of bestPath(scenario, policy)) s = decide(runToBlock(s), d);
        s = runToBlock(s);
        expect(s.status).toBe('finished');
        const anyGoal = allWalks(scenario, policy).some(
          (w) => SCENARIOS[scenario].endings[w.final.ending ?? '']?.goal === true,
        );
        expect(outcomeOf(s).goalMet, `${scenario}/${policy}`).toBe(anyGoal);
      }
    }
  });
});

/** Lint warnings a scenario's spec raises that are not the flaw it teaches: listed so none slips in. */
function extraAllowed(id: ScenarioId, options: { plan?: 'starter' | 'standard' | 'pro' }): string[] {
  if (id !== 'orbit-repo') return [];
  // The managed image is `runonflux/orbit:latest` by the product's design (FACTS 15.3.1). Starter is one instance.
  return options.plan === 'starter' ? ['IMAGE_LATEST', 'INSTANCES_ONE'] : ['IMAGE_LATEST'];
}
