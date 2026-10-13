import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  approvalRecommended,
  describeApproval,
  FLUX_CLOUD_HOSTED_KEY_ARGS,
  hasConfirmArg,
  MCP_SERVER_IDS,
  MCP_SERVERS,
  MCP_TOOLS,
  type McpServerId,
  riskLabel,
  TOOL_RISK_ORDER,
  toolByName,
  toolRiskLabel,
  toolsByRisk,
  toolsOf,
} from './agents.ts';

// The names the hosted tools/list returned on 2026-10-13 (version 0.2.2), in its order.
const HOSTED_FLUX_CLOUD_NAMES = [
  'flux_get_identity',
  'flux_generate_keys',
  'flux_get_pricing',
  'flux_build_spec',
  'flux_validate_spec',
  'flux_quote_app',
  'flux_deploy_app',
  'flux_wait_for_app',
  'flux_get_app',
  'flux_list_my_apps',
  'flux_get_app_logs',
  'flux_get_app_stats',
  'flux_control_app',
  'flux_cancel_app',
  'flux_get_network_info',
];

// The 15 names of the Orbit guide's tool table (DOCS-ONLY; tools/list needs credentials).
const ORBIT_GUIDE_NAMES = [
  'list_plans',
  'analyze_repository',
  'list_apps',
  'get_app',
  'get_instances',
  'get_deployment_status',
  'get_network_capacity',
  'validate_deployment',
  'deploy_app',
  'create_stripe_checkout',
  'get_logs',
  'trigger_build',
  'control_instance',
  'update_app',
  'renew_app',
];

const names = (server: McpServerId) => toolsOf(server).map((t) => t.name);

test('each server has 15 tools with unique names', () => {
  for (const id of MCP_SERVER_IDS) {
    const n = names(id);
    assert.equal(n.length, 15, id);
    assert.equal(new Set(n).size, n.length, `${id} names are unique`);
  }
  assert.equal(MCP_TOOLS.length, 30);
});

test('FluxCloud tool names match the hosted tools/list, in order', () => {
  assert.deepEqual(names('flux-cloud'), HOSTED_FLUX_CLOUD_NAMES);
});

test('Orbit tool names match the guide table, in order', () => {
  assert.deepEqual(names('orbit'), ORBIT_GUIDE_NAMES);
});

test('FluxCloud counts match FACTS 15.1.4', () => {
  const t = toolsOf('flux-cloud');
  assert.equal(t.filter((x) => x.spends === 'with-confirm').length, 2);
  assert.deepEqual(
    t.filter((x) => x.spends === 'with-confirm').map((x) => x.name),
    ['flux_deploy_app', 'flux_cancel_app'],
  );
  assert.equal(t.filter((x) => x.needsOwnerKey).length, 5);
  assert.deepEqual(
    t.filter((x) => x.needsOwnerKey).map((x) => x.name),
    ['flux_deploy_app', 'flux_get_app_logs', 'flux_get_app_stats', 'flux_control_app', 'flux_cancel_app'],
  );
  assert.deepEqual(
    t.filter((x) => x.needsPaymentKey).map((x) => x.name),
    ['flux_deploy_app', 'flux_cancel_app'],
  );
  const by = toolsByRisk('flux-cloud');
  assert.equal(by.reads.length, 11);
  assert.equal(by.keys.length, 1);
  assert.equal(by.spends.length, 1);
  assert.equal(by.destroys.length, 2);
  assert.equal(by.changes.length, 0);
  assert.equal(t.filter((x) => x.spends !== 'never').length, 2, 'only deploy and cancel can ever spend');
});

test('flux_control_app is not behind a confirm flag and is classed as destroying', () => {
  const t = toolByName('flux-cloud', 'flux_control_app');
  assert.ok(t);
  assert.equal(t.risk, 'destroys');
  assert.equal(t.spends, 'never');
  assert.equal(hasConfirmArg(t), false);
  assert.ok(approvalRecommended(t));
  assert.match(describeApproval(t), /no confirm step of its own/);
});

test('every tool with spends with-confirm has a boolean confirm argument', () => {
  for (const t of MCP_TOOLS.filter((x) => x.spends === 'with-confirm')) {
    const c = t.args.find((a) => a.name === 'confirm');
    assert.ok(c, `${t.name} has confirm`);
    assert.equal(c.type, 'boolean');
    assert.equal(c.required, false, 'confirm is optional and defaults to the plan');
  }
});

test('a tool that reads never spends, and nothing that can spend is called reads', () => {
  for (const t of MCP_TOOLS) {
    if (t.risk === 'reads') assert.equal(t.spends, 'never', t.name);
    if (t.spends !== 'never') assert.ok(t.risk === 'spends' || t.risk === 'destroys', t.name);
  }
});

test('every tool has a plain one-sentence summary and no em dash anywhere', () => {
  for (const t of MCP_TOOLS) {
    assert.ok(t.summary.length > 15, t.name);
    assert.ok(/[.]$/.test(t.summary), `${t.name} summary ends with a full stop`);
    for (const text of [t.summary, t.watch ?? '', ...t.args.map((a) => a.note ?? '')]) {
      assert.ok(!/—|–/.test(text), `${t.name} has no em or en dash`);
    }
    assert.ok(
      !/\$\s?\d|USD\s?\d|\d+(\.\d+)?\s?FLUX/.test(`${t.summary} ${t.watch ?? ''}`),
      `${t.name}: no typed amount`,
    );
  }
});

test('FluxCloud tools use the six groups of the brief; Orbit uses the guide groups', () => {
  const fg = new Set(toolsOf('flux-cloud').map((t) => t.group));
  assert.deepEqual([...fg].sort(), ['Build', 'Deploy', 'Identity', 'Inspect', 'Operate', 'Pricing']);
  const og = new Set(toolsOf('orbit').map((t) => t.group));
  assert.deepEqual(
    [...og],
    [
      'Discovery',
      'App inspection',
      'Status and capacity',
      'Deployment',
      'Payments',
      'Logs and builds',
      'Instance control',
      'Maintenance',
    ],
  );
});

test('Orbit arguments are unknown, so they are not invented', () => {
  for (const t of toolsOf('orbit')) {
    assert.deepEqual(t.args, [], t.name);
    assert.equal(t.basis, 'docs', t.name);
    assert.equal(t.needsOwnerKey, false);
    assert.equal(t.needsPaymentKey, false);
    assert.equal(t.needsAccount, true);
    assert.notEqual(t.spends, 'with-confirm', 'Orbit documents no confirm argument');
  }
});

test('Orbit: five tools change things per the guide, plus the payment tool', () => {
  const nonRead = toolsOf('orbit')
    .filter((t) => t.risk !== 'reads')
    .map((t) => t.name);
  assert.deepEqual(nonRead, [
    'deploy_app',
    'create_stripe_checkout',
    'trigger_build',
    'control_instance',
    'update_app',
    'renew_app',
  ]);
  assert.equal(toolByName('orbit', 'validate_deployment')?.risk, 'reads', 'validate registers nothing');
  assert.equal(toolByName('orbit', 'trigger_build')?.risk, 'changes');
  assert.equal(toolByName('orbit', 'control_instance')?.risk, 'destroys');
  assert.equal(toolByName('orbit', 'cancel_app'), undefined, 'the guide lists no cancel tool');
});

test('FluxCloud tools carry no key material or hosted-only arguments in their own args', () => {
  for (const t of toolsOf('flux-cloud')) {
    for (const a of t.args) {
      assert.ok(!/PrivateKey|wif/i.test(a.name), `${t.name}.${a.name}`);
    }
  }
  assert.deepEqual(
    FLUX_CLOUD_HOSTED_KEY_ARGS.map((a) => a.name),
    ['fluxIdPrivateKey', 'paymentPrivateKey'],
  );
  assert.ok(FLUX_CLOUD_HOSTED_KEY_ARGS.every((a) => !a.required));
});

test('lookups work and fail soft', () => {
  assert.equal(toolByName('flux-cloud', 'flux_quote_app')?.group, 'Pricing');
  assert.equal(toolByName('orbit', 'flux_quote_app'), undefined, 'names are per server');
  assert.equal(toolByName('flux-cloud', 'nope'), undefined);
});

test('risk labels and the approval sentence follow the risk and spends fields', () => {
  assert.equal(riskLabel('reads'), 'Reads only');
  assert.equal(riskLabel('keys'), 'Handles keys');
  assert.equal(riskLabel('spends'), 'Spends FLUX');
  assert.deepEqual([...TOOL_RISK_ORDER].sort(), ['changes', 'destroys', 'keys', 'reads', 'spends']);
  for (const r of TOOL_RISK_ORDER) assert.ok(riskLabel(r).length > 0);

  const deploy = toolByName('flux-cloud', 'flux_deploy_app');
  const cancel = toolByName('flux-cloud', 'flux_cancel_app');
  const keys = toolByName('flux-cloud', 'flux_generate_keys');
  const logs = toolByName('flux-cloud', 'flux_get_app_logs');
  const read = toolByName('flux-cloud', 'flux_get_app');
  const orbitDeploy = toolByName('orbit', 'deploy_app');
  assert.ok(deploy && cancel && keys && logs && read && orbitDeploy);
  assert.match(describeApproval(deploy), /^This call can spend FLUX from the payment address/);
  assert.match(describeApproval(deploy), /confirm is true/);
  assert.match(describeApproval(cancel), /end an app or delete its data/);
  assert.match(describeApproval(cancel), /confirm is true/);
  assert.match(describeApproval(keys), /new private keys/);
  assert.equal(describeApproval(read), 'This call only reads and spends nothing.');
  assert.match(describeApproval(logs), /private to the app owner/);
  assert.match(describeApproval(orbitDeploy), /checkout/);
  assert.equal(toolRiskLabel(orbitDeploy), 'Starts a payment');
  assert.equal(toolRiskLabel(deploy), 'Spends FLUX');
  for (const t of MCP_TOOLS) {
    const s = describeApproval(t);
    assert.ok(/^This call /.test(s) && /\.$/.test(s), t.name);
    assert.ok(!/—/.test(s));
    assert.ok(!/\d/.test(s), `${t.name}: approval sentence has no number`);
    assert.equal(s.split('. ').length, 1, `${t.name}: one sentence`);
  }
  assert.equal(approvalRecommended(read), false);
  assert.equal(approvalRecommended(deploy), true);
});

test('the two servers have different identity models and dated, public sources', () => {
  const fc = MCP_SERVERS['flux-cloud'];
  const ob = MCP_SERVERS.orbit;
  assert.equal(fc.kind, 'keys');
  assert.equal(ob.kind, 'account');
  assert.equal(fc.endpoint, 'https://mcp.runonflux.com/mcp');
  assert.equal(ob.endpoint, 'https://runonflux.com/apps/mcp');
  assert.equal(fc.package, '@runonflux/flux-cloud-mcp');
  assert.equal(ob.package, null);
  assert.equal(fc.packageVersion, '0.2.7');
  assert.equal(fc.hostedVersion, '0.2.2');
  assert.deepEqual(
    fc.connections.map((c) => c.id),
    ['local', 'hosted', 'self-hosted'],
  );
  assert.deepEqual(
    ob.connections.map((c) => c.id),
    ['account'],
  );
  for (const s of Object.values(MCP_SERVERS)) {
    assert.match(s.readOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(s.identity.length >= 3);
    assert.ok(s.identity.every((x) => !/—/.test(x) && /\.$/.test(x)));
    assert.ok(s.links.every((l) => l.startsWith('https://')));
  }
});

test('no preview console hostname or console only tool leaks into the catalogue', () => {
  const blob = JSON.stringify({ MCP_TOOLS, MCP_SERVERS });
  assert.ok(!/preview/i.test(blob));
  assert.ok(!/\bbeta\b/i.test(blob));
  assert.ok(!/ui_prefill_deploy/.test(blob), 'the console assistant tools are not MCP tools');
  const hosts = new Set(
    [...blob.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => (m[1] ?? '').toLowerCase()),
  );
  const allowed = new Set([
    'mcp.runonflux.com',
    'runonflux.com',
    'docs.runonflux.com',
    'www.npmjs.com',
    'github.com',
  ]);
  for (const h of hosts) assert.ok(allowed.has(h), `unexpected host ${h}`);
});
