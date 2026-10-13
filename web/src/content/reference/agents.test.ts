/**
 * The Agents and MCP reference: its counts come from the tool catalogue, the approval policies are computed
 * from it, its search records match its rows, and nothing on it claims more than FACTS 15.1, 15.2 and 15.4 do.
 */

import {
  approvalRecommended,
  BAKED_PRICING,
  describeApproval,
  FLUX_CLOUD_HOSTED_KEY_ARGS,
  MCP_SERVERS,
  MCP_TOOLS,
  toolByName,
  toolRiskLabel,
  toolsOf,
} from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { asks } from '@/learn/widgets/agent-session/engine/policy';
import * as agents from './agents';
import { AGENTS_SEEDS, FLUX_CLOUD_TOOL_LINES, ORBIT_TOOL_LINES } from './agents.search';
import { anchor } from './anchors';
import { REFERENCE_INDEX } from './index';
import { sortedProvLabels } from './test-support';
import { AGENTS_SECTIONS, topicById } from './topics';

const CLOUD = toolsOf('flux-cloud');
const ORBIT = toolsOf('orbit');

describe('the tool catalogue', () => {
  it('lists every tool of both servers once, with an element id that matches the search record', () => {
    const entries = [...agents.buildToolEntries('flux-cloud'), ...agents.buildToolEntries('orbit')];
    expect(entries.map((e) => e.tool.name)).toEqual(MCP_TOOLS.map((t) => t.name));
    const anchors = entries.map((e) => e.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
    for (const e of entries) expect(e.anchor).toBe(anchor.tool(e.tool.server, e.tool.name));
  });

  it('shows the engine words for the risk, the money and the approval sentence', () => {
    for (const e of agents.buildToolEntries('flux-cloud')) {
      expect(e.riskWord).toBe(toolRiskLabel(e.tool));
      expect(e.approval).toBe(describeApproval(e.tool));
      expect(e.ask).toBe(approvalRecommended(e.tool));
    }
    for (const e of agents.buildToolEntries('orbit')) {
      expect(e.riskWord).toBe(toolRiskLabel(e.tool));
      expect(e.approval).toBe(describeApproval(e.tool));
    }
  });

  it('lists arguments for the FluxCloud tools and none for the Orbit tools, which need an account', () => {
    for (const t of ORBIT) expect(agents.buildArgRows(t), t.name).toEqual([]);
    const withArgs = CLOUD.filter((t) => agents.buildArgRows(t).length > 0).map((t) => t.name);
    expect(withArgs).toContain('flux_deploy_app');
    expect(withArgs).toContain('flux_control_app');
    const note = agents.buildOrbitToolFacts().find((r) => r.id === 'arguments');
    expect(note?.prov).toContain('unverified');
    expect(note?.text).toContain('needs an account');
  });

  it('flags confirm on exactly the tools that sign and pay, as FACTS 15.1.4 says', () => {
    const confirm = agents.buildToolEntries('flux-cloud').filter((e) => e.confirmArg);
    expect(confirm.map((e) => e.tool.name)).toEqual(['flux_deploy_app', 'flux_cancel_app']);
    expect(CLOUD.filter((t) => t.spends === 'with-confirm').map((t) => t.name)).toEqual(
      confirm.map((e) => e.tool.name),
    );
  });

  it('shows hosted key arguments from the engine and never a key', () => {
    const names = agents.buildHostedKeyArgs().map((a) => a.name);
    expect(names).toEqual(FLUX_CLOUD_HOSTED_KEY_ARGS.map((a) => a.name));
    const everything = JSON.stringify([
      agents.buildConfigSamples(),
      agents.buildKeyFacts(),
      agents.buildFluxCloudToolFacts(),
      agents.buildHostedFacts(),
    ]);
    // A key in WIF is 51 or 52 characters of base58 that start with 5, K or L.
    expect(everything).not.toMatch(/\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/);
    expect(everything).not.toMatch(/0x[a-fA-F0-9]{40}/);
    for (const s of agents.buildConfigSamples().filter((x) => x.id === 'local')) {
      expect(s.code).toContain('<wif>');
    }
  });
});

describe('the risk filter', () => {
  const filters = agents.buildRiskFilters();

  it('counts every tool once', () => {
    expect(filters.reduce((n, f) => n + f.count, 0)).toBe(MCP_TOOLS.length);
  });

  it('uses the engine wording and status tokens, never a tier colour', () => {
    for (const f of filters) {
      const tools = MCP_TOOLS.filter((t) => agents.riskKeyOf(t) === f.key);
      expect(tools.length, f.key).toBe(f.count);
      for (const t of tools) expect(toolRiskLabel(t), `${f.key} ${t.name}`).toBe(f.label);
      expect(['ok', 'warn', 'crit']).toContain(agents.RISK_STATUS[f.key]);
    }
  });

  it('gives a payment its own word, because it is not FLUX spent from a key', () => {
    const payment = filters.find((f) => f.key === 'payment');
    expect(payment?.label).toBe('Starts a payment');
    expect(
      MCP_TOOLS.filter((t) => agents.riskKeyOf(t) === 'payment').every((t) => t.server === 'orbit'),
    ).toBe(true);
  });

  it('marks the tools that delete as critical', () => {
    expect(agents.RISK_STATUS.destroys).toBe('crit');
    expect(agents.RISK_STATUS.reads).toBe('ok');
  });
});

describe('the approval policies', () => {
  const policies = agents.buildPolicyRows();
  const by = (id: string) => policies.find((p) => p.id === id);
  const notRead = (server: 'flux-cloud' | 'orbit') =>
    toolsOf(server)
      .filter((t) => t.risk !== 'reads')
      .map((t) => t.name);

  it('lists the three client policies and the recommendation', () => {
    expect(policies.map((p) => p.id)).toEqual(['ask-all', 'ask-spends', 'allow-all', 'recommended']);
    expect(policies.filter((p) => p.advice).map((p) => p.id)).toEqual(['recommended']);
  });

  it('asks about every tool that is not a read under ask all, as the lab and the lesson do, and lets nothing through', () => {
    expect(by('ask-all')?.asks['flux-cloud']).toEqual(notRead('flux-cloud'));
    expect(by('ask-all')?.asks.orbit).toEqual(notRead('orbit'));
    expect(by('ask-all')?.runs).toEqual({ 'flux-cloud': [], orbit: [] });
  });

  it('agrees with asks() of the agent session engine, tool by tool, under every policy', () => {
    for (const t of MCP_TOOLS) {
      const name = t.name;
      const in_ = (id: string) => by(id)?.asks[t.server].includes(name) === true;
      expect(in_('ask-all'), `${name} ask-all`).toBe(asks('ask-all', t));
      expect(in_('ask-spends'), `${name} ask-spends`).toBe(asks('ask-spends', t));
      expect(in_('allow-all'), `${name} allow-all`).toBe(asks('allow-all', t));
    }
  });

  it('lets the tools that delete but do not spend through under ask spends, as FACTS 15.1.4 warns', () => {
    const p = by('ask-spends');
    expect(p?.asks['flux-cloud']).toEqual(['flux_deploy_app', 'flux_cancel_app']);
    expect(p?.runs['flux-cloud']).toContain('flux_control_app');
    expect(p?.runs['flux-cloud']).toContain('flux_generate_keys');
    expect(p?.runs.orbit).toContain('control_instance');
    expect(p?.runs.orbit).toContain('trigger_build');
    expect(p?.asks.orbit).toEqual(ORBIT.filter((t) => t.spends !== 'never').map((t) => t.name));
  });

  it('lets every tool that is not a read through under allow all', () => {
    const p = by('allow-all');
    expect(p?.asks).toEqual({ 'flux-cloud': [], orbit: [] });
    expect(p?.runs['flux-cloud']).toEqual(notRead('flux-cloud'));
    expect(p?.runs.orbit).toEqual(notRead('orbit'));
  });

  it('recommends asking before every tool that is not a pure read', () => {
    const p = by('recommended');
    expect(p?.asks['flux-cloud']).toEqual(notRead('flux-cloud'));
    expect(p?.asks.orbit).toEqual(notRead('orbit'));
    expect(p?.asks['flux-cloud']).toContain('flux_control_app');
  });
});

describe('the servers side by side', () => {
  const rows = agents.buildServerRows();
  const C = MCP_SERVERS['flux-cloud'];
  const O = MCP_SERVERS.orbit;

  it('has no empty cell and unique row ids', () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.cloud.trim().length, `${r.id} cloud`).toBeGreaterThan(0);
      expect(r.orbit.trim().length, `${r.id} orbit`).toBeGreaterThan(0);
    }
  });

  it('prints the endpoints, the package and both versions from the engine, with their read date', () => {
    const byId = new Map(rows.map((r) => [r.id, r] as const));
    expect(byId.get('endpoint')?.cloud).toContain(C.endpoint);
    expect(byId.get('endpoint')?.orbit).toContain(O.endpoint);
    expect(byId.get('package')?.cloud).toContain(C.package ?? '?');
    expect(byId.get('package-version')?.cloud).toContain(`${C.packageVersion}`);
    expect(byId.get('package-version')?.cloud).toContain(C.readOn);
    expect(byId.get('hosted-version')?.cloud).toContain(`${C.hostedVersion}`);
    expect(byId.get('hosted-version')?.cloud).toContain(C.readOn);
  });

  it('only says the hosted server is older while it is', () => {
    expect(C.hostedVersion).not.toBeNull();
    expect(C.packageVersion).not.toBeNull();
    expect(C.hostedVersion).not.toBe(C.packageVersion);
    const row = agents.buildHostedFacts().find((r) => r.id === 'versions');
    expect(row?.text).toContain(`${C.hostedVersion}`);
    expect(row?.text).toContain(`${C.packageVersion}`);
  });

  it('names the tools that sign and the tools that delete from the catalogue', () => {
    const byId = new Map(rows.map((r) => [r.id, r] as const));
    expect(byId.get('spends')?.cloud).toContain('flux_deploy_app');
    expect(byId.get('spends')?.cloud).toContain('flux_cancel_app');
    expect(byId.get('destructive')?.cloud).toContain('flux_control_app');
    expect(byId.get('destructive')?.orbit).toContain('control_instance');
  });

  it('describes each way to connect with where the credentials are', () => {
    const connections = agents.buildConnectionRows();
    expect(connections.map((c) => c.id)).toEqual(['local', 'hosted', 'self-hosted', 'account']);
    for (const c of connections) {
      expect(c.how.length, c.id).toBeGreaterThan(20);
      expect(c.credentials.length, c.id).toBeGreaterThan(20);
    }
  });
});

describe('plan then confirm', () => {
  it('has four steps, and the first one spends nothing', () => {
    const steps = agents.buildConfirmSteps();
    expect(steps.map((s) => s.id)).toEqual(['plan', 'show', 'confirm', 'wait']);
    expect(steps[0]?.text).toContain('spends nothing');
  });

  it('says confirm is a flag the agent sets and not a person', () => {
    const text = JSON.stringify([agents.buildGlanceFacts(), agents.buildConfirmSteps()]);
    expect(text).toContain('flag the agent sets');
    expect(text).not.toMatch(/confirm[^.]{0,40}asks? (?:the )?(?:user|person|human)/i);
  });
});

describe('the key model', () => {
  it('lists the tools that need a key from the catalogue', () => {
    const needs = agents.buildKeyNeeds();
    expect(needs.map((n) => n.name)).toEqual(
      CLOUD.filter((t) => t.needsOwnerKey || t.needsPaymentKey).map((t) => t.name),
    );
    const deploy = needs.find((n) => n.name === 'flux_deploy_app');
    expect(deploy).toMatchObject({ owner: true, payment: true });
    const logs = needs.find((n) => n.name === 'flux_get_app_logs');
    expect(logs).toMatchObject({ owner: true, payment: false });
  });

  it('says only a Flux ID can own the app', () => {
    const row = agents.buildKeyFacts().find((r) => r.id === 'owners');
    expect(row?.text).toContain('Ethereum');
  });
});

describe('what spends or deletes', () => {
  it('prices a cancel as unverified, worked out from source, not observed', () => {
    const row = agents.buildSpendFacts().find((r) => r.id === 'cancel-cost');
    expect(row?.prov).toEqual(['source', 'unverified']);
    expect(row?.text).toContain('was not run on a real app');
    expect(row?.text).toContain(`${BAKED_PRICING.params.minPrice} FLUX`);
  });

  it('states prompt injection as guidance, not as an incident', () => {
    const row = agents.buildSpendFacts().find((r) => r.id === 'injection');
    expect(row?.prov).toContain('unverified');
    expect(row?.text).toContain('No incident was observed');
    expect(row?.text).toContain('{{term:prompt-injection}}');
  });

  it('words the Orbit notes as guidance and takes them from the catalogue', () => {
    const rows = new Map(agents.buildSpendFacts().map((r) => [r.id, r]));
    const watch = (name: string) => (toolByName('orbit', name)?.watch ?? '?').toLowerCase();

    // The output of update_app is not published (FACTS 15.4.9), so the row tells you to check, not to read.
    const payments = rows.get('orbit-payments');
    expect(payments?.text).toContain('check the price before you approve');
    expect(payments?.text).not.toContain('reports');
    expect(payments?.text.toLowerCase()).toContain(watch('update_app'));

    // That redaction stops at what the app prints itself is an inference (FACTS 15.4.5), so it is labelled.
    const logs = rows.get('logs');
    expect(logs?.text).toContain('text the app prints itself may not be');
    expect(logs?.text).not.toContain('cannot be recognised');
    expect(logs?.prov).toContain('unverified');
    expect(logs?.text.toLowerCase()).toContain(watch('get_logs'));

    expect(rows.get('orbit-control')?.text).toContain(
      toolByName('orbit', 'control_instance')?.summary ?? '?',
    );
  });

  it('says a cancel refunds nothing and that remove is not cancel', () => {
    const text = JSON.stringify(agents.buildSpendFacts());
    expect(text).toContain('Nothing is refunded');
    expect(text).toContain('Remove is not cancel');
  });
});

describe('the console assistant', () => {
  it('has the sixteen tools FACTS 15.2.2 lists, in groups', () => {
    const names = agents.consoleToolNames();
    expect(names).toHaveLength(16);
    expect(new Set(names).size).toBe(names.length);
  });

  it('shares eight names with the FluxCloud MCP server and has none of its writers', () => {
    expect(agents.consoleSharedNames().sort()).toEqual(
      [
        'flux_get_app',
        'flux_get_app_logs',
        'flux_get_app_stats',
        'flux_get_network_info',
        'flux_get_pricing',
        'flux_list_my_apps',
        'flux_quote_app',
        'flux_validate_spec',
      ].sort(),
    );
    const names = new Set(agents.consoleToolNames());
    for (const writer of [
      'flux_deploy_app',
      'flux_cancel_app',
      'flux_control_app',
      'flux_generate_keys',
      'flux_build_spec',
      'flux_wait_for_app',
      'flux_get_identity',
    ]) {
      expect(names.has(writer), writer).toBe(false);
    }
  });

  it('says plainly that it is not an MCP server and cannot deploy, sign or pay', () => {
    const facts = agents.buildConsoleFacts();
    expect(facts.find((r) => r.id === 'not-mcp')?.label).toBe('It is not an MCP server');
    expect(JSON.stringify(agents.CONSOLE_NEVER)).toMatch(/deploy an app.*sign anything.*pay/);
  });

  it('marks its retention unverified', () => {
    const row = agents.buildConsoleFacts().find((r) => r.id === 'retention');
    expect(row?.prov).toContain('unverified');
  });
});

describe('the known gaps', () => {
  it('compares the estimator with the network quote for the four sizes of FACTS 15.1.16', () => {
    const rows = agents.buildEstimateRows();
    expect(rows.map((r) => r.id)).toEqual(['tiny', 'small', 'medium', 'large']);
    expect(rows.map((r) => r.estimator)).toEqual([0.99, 1.78, 4.66, 10.8]);
    expect(rows.map((r) => r.network)).toEqual([0.99, 1.99, 4.99, 10.99]);
    for (const r of rows) expect(r.instances, r.id).toBe(3);
  });

  it('has unique ids, each with a search record', () => {
    const rows = agents.buildGapRows();
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const anchors = new Set(AGENTS_SEEDS.map((s) => s.anchor));
    for (const id of ids) expect(anchors.has(anchor.gap(id)), id).toBe(true);
  });

  it('scopes "no balance" to app deployments and says once that a GPU balance exists (FACTS 15.2.8)', () => {
    const gap = agents.buildGapRows().find((g) => g.id === 'balance');
    expect(gap?.shows).toContain('each app deployment is paid for on its own');
    expect(gap?.shows).toContain('The network has no balance for apps');
    expect(gap?.shows.match(/Flux Edge/g)).toHaveLength(1);
    expect(gap?.prov).toContain('docs');
    const seed = AGENTS_SEEDS.find((s) => s.anchor === anchor.gap('balance'));
    expect(seed?.summary).toContain('The network has no balance for apps');
    expect(seed?.summary).toContain('Flux Edge');
    // No sentence on the page, row or record says "no balance" or "has none" without saying for what.
    const everything = JSON.stringify([
      agents.buildGapRows(),
      agents.buildGapNotes(),
      agents.FACT_SECTIONS.flatMap(({ rows }) => rows()),
      AGENTS_SEEDS,
    ]);
    expect(everything).not.toMatch(/no balance(?! for apps)/i);
    expect(everything).not.toMatch(/network has none/i);
  });

  it('dates itself and never copies a vendor figure', () => {
    const text = JSON.stringify([agents.buildGapRows(), agents.buildGapNotes(), agents.buildConfirmFacts()]);
    expect(text).not.toContain('19.24');
    expect(text).not.toMatch(/\$0\.48/);
    expect(text).toContain(BAKED_PRICING.capturedAt);
  });
});

describe('the glance tiles', () => {
  it('count from the catalogue, not from typed numbers', () => {
    const tiles = new Map(agents.buildGlanceTiles().map((t) => [t.id, t] as const));
    expect(tiles.get('flux-cloud')?.value).toBe(`${CLOUD.length} tools`);
    expect(tiles.get('orbit')?.value).toBe(`${ORBIT.length} tools`);
    expect(tiles.get('reads')?.value).toBe(
      `${MCP_TOOLS.filter((t) => t.risk === 'reads').length} of ${MCP_TOOLS.length}`,
    );
    // Every tool that can spend or start a payment, so flux_cancel_app counts although its class is destroys.
    expect(tiles.get('spends')?.value).toBe(String(MCP_TOOLS.filter((t) => t.spends !== 'never').length));
    expect(tiles.get('destroys')?.value).toBe(String(MCP_TOOLS.filter((t) => t.risk === 'destroys').length));
  });
});

describe('the search records', () => {
  it('cover every tool in the catalogue order, and name none that is gone', () => {
    expect(FLUX_CLOUD_TOOL_LINES.map(([n]) => n)).toEqual(CLOUD.map((t) => t.name));
    expect(ORBIT_TOOL_LINES.map(([n]) => n)).toEqual(ORBIT.map((t) => t.name));
    const anchors = new Set(AGENTS_SEEDS.map((s) => s.anchor));
    for (const t of MCP_TOOLS) expect(anchors.has(anchor.tool(t.server, t.name)), t.name).toBe(true);
  });

  it('say what the catalogue says, tool by tool, so the index and the catalogue cannot drift', () => {
    // The lines are copies, because the index must not import the catalogue (it would load on every
    // reference page). When a summary changes in `shared/flux/agents.ts`, copy it here.
    for (const [name, line] of [...FLUX_CLOUD_TOOL_LINES, ...ORBIT_TOOL_LINES]) {
      expect(line, name).toBe(MCP_TOOLS.find((t) => t.name === name)?.summary);
    }
  });

  it('have unique anchors, all in sections the page declares', () => {
    const anchors = AGENTS_SEEDS.map((s) => s.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
    const sections = new Set(AGENTS_SECTIONS.map((s) => s.id));
    for (const s of AGENTS_SEEDS) expect(sections.has(s.section), `${s.anchor} -> ${s.section}`).toBe(true);
  });

  it('cover every policy', () => {
    const anchors = new Set(AGENTS_SEEDS.map((s) => s.anchor));
    for (const p of agents.buildPolicyRows().filter((x) => !x.advice)) {
      expect(anchors.has(anchor.policy(p.id)), p.id).toBe(true);
    }
  });

  it('carry the same labels as the rows they point at, and no more Unverified than the rows', () => {
    const rows = new Map<string, readonly string[]>();
    for (const { section, rows: list } of agents.FACT_SECTIONS) {
      for (const row of list()) {
        if (row.prov.includes('unverified')) rows.set(anchor.fact(section, row.id), row.prov);
      }
    }
    const seeds = new Map(
      AGENTS_SEEDS.filter((s) => s.prov?.includes('unverified')).map(
        (s) => [s.anchor, s.prov ?? []] as const,
      ),
    );
    expect(rows.size).toBeGreaterThan(5);
    expect([...seeds.keys()].sort()).toEqual([...rows.keys()].sort());
    for (const [id, prov] of rows)
      expect(sortedProvLabels(seeds.get(id) ?? []), id).toEqual(sortedProvLabels(prov));
  });

  it('put the page in the shared index', () => {
    const inIndex = REFERENCE_INDEX.filter((e) => e.topic === 'agents');
    for (const s of AGENTS_SEEDS) {
      expect(
        inIndex.some((e) => e.anchor === s.anchor),
        s.anchor,
      ).toBe(true);
    }
    expect(inIndex.filter((e) => e.kind === 'tool')).toHaveLength(MCP_TOOLS.length);
  });

  it('keep every fact row id unique inside its section', () => {
    for (const { section, rows } of agents.FACT_SECTIONS) {
      const ids = rows().map((r) => r.id);
      expect(new Set(ids).size, section).toBe(ids.length);
    }
  });
});

describe('the topic', () => {
  it('is checked against the date the catalogues were read', () => {
    expect(topicById('agents')?.basis?.date).toBe(agents.AGENTS_READ_ON);
    expect(agents.AGENTS_READ_ON).toBe(MCP_SERVERS.orbit.readOn);
  });

  it('never calls the new console a preview or a beta', () => {
    const text = JSON.stringify([
      agents.buildGlanceFacts(),
      agents.buildConsoleFacts(),
      agents.buildGapRows(),
      agents.CONSOLE_TOOL_GROUPS,
      topicById('agents'),
    ]);
    expect(text).not.toMatch(/\b(?:beta|preview)\b/i);
  });
});
