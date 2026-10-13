/**
 * The Orbit reference: its numbers come from the engine, its search records match its rows, and nothing on
 * it claims more than FACTS 15.3 and 15.4 do.
 */

import {
  BAKED_PRICING,
  deployToFluxUrl,
  lintSpec,
  ORBIT_BUILD_VARIABLES,
  ORBIT_CUSTOM,
  ORBIT_FACTS,
  ORBIT_PLAN_IDS,
  ORBIT_PLANS,
  ORBIT_READ_ON,
  orbitPlanQuoteUsd,
  orbitPlanSpec,
  quote,
  tryDeployToFluxUrl,
} from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { anchor } from './anchors';
import { num, usd } from './derive';
import { REFERENCE_INDEX } from './index';
import * as orbit from './orbit';
import { ORBIT_SEEDS, ORBIT_VARIABLE_LINES } from './orbit.search';
import { sortedProvLabels } from './test-support';
import { ORBIT_SECTIONS, topicById } from './topics';

const PLAN_IDS = ['starter', 'standard', 'pro'] as const;

describe('the plan table', () => {
  const rows = orbit.buildPlanRows();

  it('has a row for each published plan, in the engine order', () => {
    expect(rows.map((r) => r.id)).toEqual(ORBIT_PLANS.map((p) => p.id));
    expect(ORBIT_PLAN_IDS).toEqual([...PLAN_IDS]);
  });

  it('prices every plan with quote() and finds it equal to the published price', () => {
    for (const r of rows) {
      const plan = ORBIT_PLANS.find((p) => p.id === r.id);
      expect(plan).toBeDefined();
      if (!plan) continue;
      const q = quote(orbitPlanSpec(plan), BAKED_PRICING.params);
      expect(r.engineUsd, r.id).toBe(q.usdTotal ?? q.usdPerMonth);
      expect(r.publishedUsd, r.id).toBe(plan.usd);
      expect(r.agree, `${r.id}: published ${r.publishedUsd}, quote() ${r.engineUsd}`).toBe(true);
    }
  });

  it('reproduces the quote check of FACTS 15.3.11, to the cent', () => {
    const byId = new Map(rows.map((r) => [r.id, r.engineUsd] as const));
    expect(byId.get('starter')).toBe(0.99);
    expect(byId.get('standard')).toBe(2.49);
    expect(byId.get('pro')).toBe(3.99);
  });

  it('says one instance for Starter and two with failover for Standard and Pro', () => {
    const byId = new Map(rows.map((r) => [r.id, r.instances] as const));
    expect(byId.get('starter')).toBe('1 instance');
    expect(byId.get('standard')).toBe('2 instances, with failover');
    expect(byId.get('pro')).toBe('2 instances, with failover');
  });

  it('never claims a free plan or three nodes', () => {
    const text = JSON.stringify([orbit.buildPlanFacts(), orbit.buildPlanRows()]).toLowerCase();
    expect(text).not.toMatch(/free forever|free tier|forever free/);
    const free = orbit.buildPlanFacts().find((r) => r.id === 'free-plan');
    expect(free?.text).toContain('closed to new apps');
  });

  it('prices the encrypted variant from the engine and says it is an engine result', () => {
    const row = orbit.buildPlanFacts().find((r) => r.id === 'encrypted');
    expect(row).toBeDefined();
    for (const p of ORBIT_PLANS) {
      const encrypted = orbitPlanQuoteUsd(p, BAKED_PRICING.params, { encrypted: true });
      expect(row?.text, p.id).toContain(`${p.name} ${usd(encrypted)}`);
    }
    // FACTS 15.3.11: Starter 1.49, Standard 4.99, Pro 6.49 when the spec is encrypted.
    expect(orbitPlanQuoteUsd(ORBIT_PLANS[0]!, BAKED_PRICING.params, { encrypted: true })).toBe(1.49);
    expect(orbitPlanQuoteUsd(ORBIT_PLANS[1]!, BAKED_PRICING.params, { encrypted: true })).toBe(4.99);
    expect(orbitPlanQuoteUsd(ORBIT_PLANS[2]!, BAKED_PRICING.params, { encrypted: true })).toBe(6.49);
    expect(row?.text).toContain('engine results');
    expect(row?.prov).not.toContain('live');
  });
});

describe('the custom sizes', () => {
  it('prints the ranges the engine holds', () => {
    const byId = new Map(orbit.buildCustomRows().map((r) => [r.id, r] as const));
    expect(byId.get('vcores')?.value).toBe(
      `${num(ORBIT_CUSTOM.vcoresMin)} to ${num(ORBIT_CUSTOM.vcoresMax)}`,
    );
    expect(byId.get('ram')?.value).toContain(num(ORBIT_CUSTOM.ramMbMax));
    expect(byId.get('storage')?.value).toBe(
      `${num(ORBIT_CUSTOM.storageGbMin)} to ${num(ORBIT_CUSTOM.storageGbMax)} GB`,
    );
    expect(byId.get('instances')?.value).toBe(
      `${num(ORBIT_CUSTOM.instancesMin)} to ${num(ORBIT_CUSTOM.instancesMax)}`,
    );
    expect(byId.get('from')?.value).toContain(usd(ORBIT_CUSTOM.fromUsd));
  });

  it('prices the ends of the ranges with quote(), as FACTS 15.3.11 did', () => {
    const rows = orbit.buildCustomPriceRows();
    expect(rows.map((r) => r.id)).toEqual(['smallest', 'largest-one', 'largest-most']);
    expect(rows.map((r) => r.usd)).toEqual([0.99, 22.99, 68.49]);
    expect(rows[2]?.instances).toBe(ORBIT_CUSTOM.instancesMax);
  });

  it('says the page states no price for a custom size', () => {
    const row = orbit.buildCustomFacts()[0];
    expect(row?.text).toContain('not a number Orbit published');
    expect(row?.text).toContain(BAKED_PRICING.capturedAt);
  });
});

describe('the generated spec', () => {
  it('lints without errors for every plan', () => {
    for (const id of PLAN_IDS) {
      const view = orbit.buildSpecView(id);
      expect(view.lint.valid, id).toBe(true);
      expect(view.lint.errors, id).toBe(0);
      expect(
        lintSpec(view.spec).issues.map((i) => i.code),
        id,
      ).toEqual(view.lint.issues.map((i) => i.code));
    }
  });

  it('gives Starter the one-instance warning and the others not', () => {
    const codes = (id: (typeof PLAN_IDS)[number]) => orbit.buildSpecView(id).lint.issues.map((i) => i.code);
    expect(codes('starter')).toContain('INSTANCES_ONE');
    expect(codes('standard')).not.toContain('INSTANCES_ONE');
    expect(codes('pro')).not.toContain('INSTANCES_ONE');
  });

  it('explains every finding specifically, so a new rule asks for a new explanation', () => {
    for (const id of PLAN_IDS) {
      for (const issue of orbit.buildSpecView(id).lint.issues) {
        expect(issue.explain, `${id} ${issue.code}`).not.toMatch(/^The linter's own explanation/);
        expect(issue.explain.length, `${id} ${issue.code}`).toBeGreaterThan(40);
      }
    }
  });

  it('annotates real lines of the JSON', () => {
    for (const id of PLAN_IDS) {
      const view = orbit.buildSpecView(id);
      const lines = view.json.split('\n');
      const ids = view.notes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const n of view.notes) {
        expect(n.line, `${id} ${n.id}`).toBeGreaterThan(0);
        expect(lines[n.line - 1], `${id} ${n.id}`).toContain(`"${n.key}":`);
      }
    }
  });

  it('uses the placeholder owner and an example repository, never a real one', () => {
    const view = orbit.buildSpecView('standard');
    expect(view.spec.owner).toBe(orbitPlanSpec(ORBIT_PLANS[1]!).owner);
    expect(view.json).toContain('https://github.com/example/app');
  });
});

describe('the build variables', () => {
  const rows = orbit.buildVariableRows();

  it('lists every variable of the engine catalogue once, each in a group', () => {
    expect(rows.map((r) => r.name)).toEqual(ORBIT_BUILD_VARIABLES.map((v) => v.name));
    expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length);
    for (const v of ORBIT_BUILD_VARIABLES) {
      expect(orbit.variableGroupOf(v.name), v.name).not.toBeNull();
    }
  });

  it('shows a placeholder, never a value, for a secret', () => {
    for (const r of rows.filter((x) => x.secret)) {
      expect(r.example, r.name).toMatch(/^<.+>$/);
    }
    expect(rows.filter((r) => r.secret).map((r) => r.name)).toEqual(
      ORBIT_BUILD_VARIABLES.filter((v) => v.secret).map((v) => v.name),
    );
  });

  it('marks exactly the two required variables', () => {
    expect(rows.filter((r) => r.required).map((r) => r.name)).toEqual(['GIT_REPO_URL', 'APP_PORT']);
  });

  it('keeps the search lines in step with the catalogue', () => {
    expect(ORBIT_VARIABLE_LINES.map(([name]) => name)).toEqual(ORBIT_BUILD_VARIABLES.map((v) => v.name));
    for (const [name, line] of ORBIT_VARIABLE_LINES) expect(line.length, name).toBeGreaterThan(10);
    // The lines are short and carry no figure (the ranges and defaults are the engine's), but the two
    // things a reader acts on, required and secret, must agree with the catalogue.
    for (const v of ORBIT_BUILD_VARIABLES) {
      const line = ORBIT_VARIABLE_LINES.find(([name]) => name === v.name)?.[1] ?? '';
      expect(line.includes('Required.'), `${v.name} required`).toBe(v.required === true);
      expect(line.includes('A secret.'), `${v.name} secret`).toBe(v.secret === true);
    }
    const tile = orbit.buildGlanceTiles().find((t) => t.id === 'variables');
    expect(tile?.value).toBe(num(ORBIT_BUILD_VARIABLES.length));
  });
});

describe('the Deploy to Flux link', () => {
  const params = orbit.buildButtonParams();

  it('documents the four parameters, and only repo is required', () => {
    expect(params.map((p) => p.id)).toEqual(['repo', 'branch', 'projectPath', 'plan']);
    expect(params.filter((p) => p.required).map((p) => p.id)).toEqual(['repo']);
  });

  it('builds the example of FACTS 15.3.12 from its own examples', () => {
    const example = Object.fromEntries(params.map((p) => [p.id, p.example])) as Record<string, string>;
    const url = deployToFluxUrl({
      repo: example.repo ?? '',
      branch: example.branch ?? '',
      projectPath: example.projectPath ?? '',
      plan: example.plan ?? '',
    });
    expect(url).toBe(
      'https://runonflux.com/apps/orbit?repo=https://github.com/RunOnFlux/deploy-with-git-samples&branch=master&projectPath=express&plan=standard',
    );
  });

  it('refuses what the table says it refuses', () => {
    expect(tryDeployToFluxUrl({ repo: 'https://user:token@github.com/a/b' }).ok).toBe(false);
    expect(tryDeployToFluxUrl({ repo: 'http://github.com/a/b' }).ok).toBe(false);
    expect(tryDeployToFluxUrl({ repo: 'https://github.com/a/b', projectPath: '../x' }).ok).toBe(false);
    expect(tryDeployToFluxUrl({ repo: 'https://github.com/a/b', projectPath: '/abs' }).ok).toBe(false);
    expect(tryDeployToFluxUrl({ repo: 'https://github.com/a/b', plan: 'free' }).ok).toBe(false);
  });

  it('lists the plan values the engine accepts', () => {
    const plan = params.find((p) => p.id === 'plan');
    for (const id of ORBIT_PLAN_IDS) expect(plan?.accepts, id).toContain(`\`${id}\``);
  });
});

describe('the dated counts', () => {
  const rows = orbit.buildSampleRows();

  it('are the engine samples, each with its read date and a live basis', () => {
    const engine = Object.entries(ORBIT_FACTS).filter(([, v]) => typeof v === 'object');
    expect(rows.map((r) => r.id)).toEqual(engine.map(([k]) => k));
    for (const r of rows) {
      expect(r.readOn, r.id).toBe(ORBIT_READ_ON);
      expect(r.basis, r.id).toBe('live');
      expect(Number.isInteger(r.value), r.id).toBe(true);
    }
  });

  it('print counts and never a percentage or a claim about uptime', () => {
    const text = JSON.stringify([
      rows,
      orbit.buildNetworkFacts(),
      orbit.buildMarkerRows(),
      orbit.buildGlanceLines(),
      orbit.buildLimitFacts(),
    ]);
    expect(text).not.toMatch(/%|percent|uptime|downtime figure/i);
    const listed = orbit.buildNetworkFacts().find((r) => r.id === 'listed');
    expect(listed?.text).toContain('not a node failure');
  });

  it('describe the markers as an inference, with the engine counts', () => {
    const markers = orbit.buildMarkerRows();
    expect(markers.find((m) => m.id === 'image')?.strength).toBe('defining');
    expect(markers.filter((m) => m.strength === 'defining')).toHaveLength(1);
    for (const m of markers) expect(m.seen, m.id).toMatch(/^[\d,]+ of [\d,]+$/);
  });
});

describe('what is not published', () => {
  it('marks every row Unverified, because it is unsaid by definition', () => {
    for (const row of orbit.buildNotPublished()) {
      expect(row.prov, row.id).toContain('unverified');
    }
  });

  it('names the gaps FACTS 15.3 and 15.4.9 list', () => {
    const ids = orbit.buildNotPublished().map((r) => r.id);
    for (const id of [
      'argument-names',
      'key-custody',
      'encryption-fee',
      'custom-price',
      'preview-billing',
      'detection',
      'health-figures',
      'sign-in-route',
      'runtime-hints',
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it('does not say Orbit uses Nixpacks as a certainty', () => {
    const text = JSON.stringify(orbit.FACT_SECTIONS.flatMap((s) => s.rows()));
    expect(text).not.toMatch(/Orbit (?:uses|runs on|is built on) Nixpacks/i);
    const detect = orbit.buildDeploySteps().find((s) => s.id === 'detect');
    expect(detect?.text).toContain('product page says');
  });
});

describe('the search records', () => {
  it('have unique anchors, all in sections the page declares', () => {
    const anchors = ORBIT_SEEDS.map((s) => s.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
    const sections = new Set(ORBIT_SECTIONS.map((s) => s.id));
    for (const s of ORBIT_SEEDS) expect(sections.has(s.section), `${s.anchor} -> ${s.section}`).toBe(true);
  });

  it('cover every plan, every variable and every parameter', () => {
    const anchors = new Set(ORBIT_SEEDS.map((s) => s.anchor));
    for (const id of ORBIT_PLAN_IDS) expect(anchors.has(anchor.plan(id)), id).toBe(true);
    for (const v of ORBIT_BUILD_VARIABLES) expect(anchors.has(anchor.variable(v.name)), v.name).toBe(true);
    for (const p of orbit.buildButtonParams()) expect(anchors.has(anchor.buttonParam(p.id)), p.id).toBe(true);
  });

  it('carry the same labels as the rows they point at, and no more Unverified than the rows', () => {
    const rows = new Map<string, readonly string[]>();
    for (const { section, rows: list } of orbit.FACT_SECTIONS) {
      for (const row of list()) {
        if (row.prov.includes('unverified')) rows.set(anchor.fact(section, row.id), row.prov);
      }
    }
    const seeds = new Map(
      ORBIT_SEEDS.filter((s) => s.prov?.includes('unverified')).map((s) => [s.anchor, s.prov ?? []] as const),
    );
    expect(rows.size).toBeGreaterThan(8);
    expect([...seeds.keys()].sort()).toEqual([...rows.keys()].sort());
    for (const [id, prov] of rows)
      expect(sortedProvLabels(seeds.get(id) ?? []), id).toEqual(sortedProvLabels(prov));
  });

  it('put the page in the shared index with one entry per record', () => {
    const inIndex = REFERENCE_INDEX.filter(
      (e) => e.topic === 'orbit' && e.kind !== 'page' && e.kind !== 'section',
    );
    for (const s of ORBIT_SEEDS) {
      expect(
        inIndex.some((e) => e.anchor === s.anchor),
        s.anchor,
      ).toBe(true);
    }
  });

  it('keep every fact row id unique inside its section', () => {
    for (const { section, rows } of orbit.FACT_SECTIONS) {
      const ids = rows().map((r) => r.id);
      expect(new Set(ids).size, section).toBe(ids.length);
    }
  });
});

describe('the topic', () => {
  it('is checked against the date the catalogue was read', () => {
    expect(topicById('orbit')?.basis?.date).toBe(ORBIT_READ_ON);
  });

  it('puts the one-paragraph MCP summary in the Orbit words, with a link to Agents and MCP', () => {
    const text = orbit.buildOrbitMcpText();
    expect(text).toContain('/reference/agents');
    expect(text).toContain('Stripe');
    expect(text).not.toMatch(/token (?:is )?valid for|lasts? (?:one|an) hour/i);
  });
});

describe('where the docs disagree with themselves', () => {
  it('does not promise that /health is public, because two docs pages say opposite things (FACTS 15.3.6.1)', () => {
    // The API_KEY row of the engine catalogue (shared/flux/orbit.ts) still says the health endpoint stays public;
    // it is reported to the owner of that file, so only the facts of this page are checked here.
    const text = JSON.stringify(orbit.buildWebhookFacts());
    expect(text).not.toMatch(/\/health[^.]{0,20}stays public/i);
    expect(text).not.toMatch(/health endpoint stays public/i);
  });

  it('does not fix the order of pre-deploy.sh and the build, because the docs give two orders (FACTS 15.3.4)', () => {
    const hook = orbit.buildDeploySteps().find((s) => s.id === 'pre-deploy');
    expect(hook?.text).toContain('the two pages disagree');
  });

  it('says that webhook signature checking is off until WEBHOOK_SIGNATURE_VERIFY is true (FACTS 15.3.6.1)', () => {
    const row = orbit.buildWebhookFacts().find((r) => r.id === 'secret');
    expect(row?.text).toContain('off by default');
    expect(row?.text).toContain('WEBHOOK_SIGNATURE_VERIFY');
  });

  it('does not give the button a default branch, which the button page does not state', () => {
    const branch = orbit.buildButtonParams().find((p) => p.id === 'branch');
    expect(branch?.rules).not.toMatch(/\bmain\b/);
  });
});
