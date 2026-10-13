/**
 * Content of /reference/agents: the two MCP servers an agent can use on Flux, every tool of both, what each
 * can spend or delete, how a deploy is planned and confirmed, what to approve, and the console assistant,
 * which is a separate thing.
 *
 * Tool names, risks, key needs, arguments, versions and counts are read from `@shared/flux` (`MCP_TOOLS`,
 * `MCP_SERVERS`, `describeApproval`, `quote`). What the engine does not hold is the vendor's own wording and
 * a few figures; each is a typed value with its FACTS row beside it, and a line that ends in `// literal:` is
 * exempt from the typed number scan in `numbers.test.ts`, with its reason.
 *
 * This module is the lazy half of the page: `agents.search.ts` holds the small records the index needs.
 *
 * Sources are FACTS.md 15.1 (the FluxCloud MCP server), 15.2 (the console assistant) and 15.4 (the Orbit MCP
 * server). Nothing here comes from memory.
 */

import {
  approvalRecommended,
  BAKED_PRICING,
  defaultComponent,
  defaultSpec,
  describeApproval,
  FLUX_CLOUD_HOSTED_KEY_ARGS,
  hasConfirmArg,
  humanBlocks,
  MCP_CANCEL_EXPIRE_BLOCKS,
  MCP_SERVERS,
  type McpConnection,
  type McpServerId,
  type McpTool,
  type McpToolArg,
  quote,
  riskLabel,
  type ToolRisk,
  toolByName,
  toolRiskLabel,
  toolsOf,
} from '@shared/flux';
import { andList, count, num } from './derive';
import type { FactRow, Provenance } from './types';

export const AGENTS_LINKS = {
  hostedGuide: 'https://docs.runonflux.com/fluxcloud/ai-agents-mcp',
  npm: 'https://www.npmjs.com/package/@runonflux/flux-cloud-mcp',
  repository: 'https://github.com/RunOnFlux/flux-cloud-mcp',
  orbitGuide: 'https://runonflux.com/apps/orbit/mcp-server',
} as const;

/** The read date of both catalogues, which the engine carries. */
export const AGENTS_READ_ON = MCP_SERVERS['flux-cloud'].readOn;

const SERVER_IDS = ['flux-cloud', 'orbit'] as const satisfies readonly McpServerId[];

/** "`a`, `b` and `c`". */
function codeList(names: readonly string[]): string {
  return andList(names.map((n) => `\`${n}\``));
}

/** The catalogue's note for one Orbit tool, as the tail of a sentence ("check the price"), or ''. */
function orbitWatch(name: string): string {
  const note = toolByName('orbit', name)?.watch;
  return note ? note.charAt(0).toLowerCase() + note.slice(1) : '';
}

function proof(basis: McpTool['basis']): Provenance[] {
  return [basis];
}

// ---------------------------------------------------------------------------
// Risk, as a filter
// ---------------------------------------------------------------------------

/** The engine's five risks, with "starts a payment" split out, which is how `toolRiskLabel` words it. */
export type RiskKey = ToolRisk | 'payment';

/** From the least to the most serious, the order a list reads in. */
export const RISK_KEYS: readonly RiskKey[] = ['reads', 'keys', 'changes', 'spends', 'payment', 'destroys'];

export function riskKeyOf(tool: McpTool): RiskKey {
  return tool.risk === 'spends' && tool.spends === 'via-checkout' ? 'payment' : tool.risk;
}

/** The same words as `toolRiskLabel`, by key. */
export function riskKeyLabel(key: RiskKey): string {
  return key === 'payment' ? 'Starts a payment' : riskLabel(key);
}

export type RiskStatus = 'ok' | 'warn' | 'crit';

/** Status tokens, never a tier colour. The words are always printed with the glyph. */
export const RISK_STATUS: Readonly<Record<RiskKey, RiskStatus>> = {
  reads: 'ok',
  keys: 'warn',
  changes: 'warn',
  spends: 'warn',
  payment: 'warn',
  destroys: 'crit',
};

export interface RiskFilter {
  key: RiskKey;
  label: string;
  /** How many tools of both servers carry it. */
  count: number;
  /** One plain line for what the label means. */
  meaning: string;
}

const RISK_MEANING: Readonly<Record<RiskKey, string>> = {
  reads: 'Nothing changes and no money moves.',
  keys: 'Creates private keys and puts them in the chat.',
  changes: 'Changes a running app, without deleting data or spending.',
  spends: 'Can move FLUX from the payment key, and only when confirm is true.',
  payment: 'Creates a payment that you complete in a checkout.',
  destroys: 'Can end an app or delete its data.',
};

export function buildRiskFilters(): RiskFilter[] {
  const all = [...toolsOf('flux-cloud'), ...toolsOf('orbit')];
  return RISK_KEYS.map((key) => ({
    key,
    label: riskKeyLabel(key),
    count: all.filter((t) => riskKeyOf(t) === key).length,
    meaning: RISK_MEANING[key],
  })).filter((f) => f.count > 0);
}

// ---------------------------------------------------------------------------
// At a glance
// ---------------------------------------------------------------------------

export interface AgentTile {
  id: string;
  label: string;
  value: string;
  note: string;
  /** Element id on this page. */
  to: string;
}

export function buildGlanceTiles(): AgentTile[] {
  const cloud = toolsOf('flux-cloud');
  const orbit = toolsOf('orbit');
  const all = [...cloud, ...orbit];
  const reads = all.filter((t) => t.risk === 'reads').length;
  // Every tool that can move FLUX or start a payment, whatever its risk class: flux_cancel_app pays too.
  const spends = all.filter((t) => t.spends !== 'never').length;
  const destroys = all.filter((t) => t.risk === 'destroys');
  return [
    {
      id: 'flux-cloud',
      label: 'FluxCloud server',
      value: count(cloud.length, 'tool'),
      note: 'Works with two keys and no account.',
      to: 'tools-flux-cloud',
    },
    {
      id: 'orbit',
      label: 'Orbit server',
      value: count(orbit.length, 'tool'),
      note: 'Works with a signed in Orbit account.',
      to: 'tools-orbit',
    },
    {
      id: 'reads',
      label: 'Only read',
      value: `${num(reads)} of ${num(all.length)}`,
      note: 'Nothing changes and no money moves.',
      to: 'tools',
    },
    {
      id: 'spends',
      label: 'Can spend or start a payment',
      value: num(spends),
      note: 'Through a key, or through a checkout you complete.',
      to: 'what-spends',
    },
    {
      id: 'destroys',
      label: 'Can delete data',
      value: num(destroys.length),
      note: `${codeList(destroys.map((t) => t.name))}.`,
      to: 'what-spends',
    },
  ];
}

/** FACTS 15.1.1, 15.1.5, 15.2.13 and 15.4.8. */
export function buildGlanceFacts(): FactRow[] {
  return [
    {
      id: 'what-changes',
      label: 'An agent changes who types the spec',
      // fact: FACTS 15.1.1
      text: 'These tools call the same public endpoints as FluxCloud, build the same version 8 spec, and the same signed message and payment follow. Nothing in the network changes because an agent deploys.',
      prov: ['source'],
    },
    {
      id: 'two-products',
      label: 'Two servers, not one',
      // fact: FACTS 15.4.8
      text: "The FluxCloud {{term:mcp-server}} works with two keys and no account. The Orbit server works with a signed in Orbit account and gives the agent no Flux key. They are separate products: do not describe one with the other's rules.",
      prov: ['source', 'docs'],
    },
    {
      id: 'confirm-flag',
      label: 'confirm is not a person',
      // fact: FACTS 15.1.5, 15.2.13 (2)
      text: "On the FluxCloud server `confirm` is a flag the agent sets, so the server cannot know whether anyone agreed. The human check is your client's tool approval. On Orbit it is your client's approval and the checkout you complete.",
      prov: ['source', 'docs'],
    },
    {
      id: 'assistant',
      label: 'The console assistant is a third thing',
      // fact: FACTS 15.2.13 (1)
      text: 'The {{term:ai-assistant}} inside the FluxCloud console is not an MCP server and cannot deploy, sign or pay. It is covered under [the console assistant](/reference/agents#console-assistant).',
      prov: ['source'],
    },
  ];
}

// ---------------------------------------------------------------------------
// The servers, side by side
// ---------------------------------------------------------------------------

export interface ServerRow {
  id: string;
  label: string;
  /** Markup. */
  cloud: string;
  /** Markup. */
  orbit: string;
}

/**
 * FACTS 15.1.1 to 15.1.3 (the FluxCloud column) and 15.4.1, 15.4.2 and 15.4.8 (the Orbit column). Versions,
 * endpoints and tool names come from the engine.
 */
export function buildServerRows(): ServerRow[] {
  const C = MCP_SERVERS['flux-cloud'];
  const O = MCP_SERVERS.orbit;
  const cloud = toolsOf('flux-cloud');
  const orbit = toolsOf('orbit');
  const signs = cloud.filter((t) => t.spends === 'with-confirm').map((t) => t.name);
  const orbitDeletes = orbit.filter((t) => t.risk === 'destroys').map((t) => t.name);
  const cloudDeletes = cloud.filter((t) => t.risk === 'destroys').map((t) => t.name);
  return [
    {
      id: 'endpoint',
      label: 'Hosted endpoint',
      cloud: `\`${C.endpoint}\``,
      orbit: `\`${O.endpoint}\``,
    },
    { id: 'transport', label: 'Transport', cloud: C.transport, orbit: O.transport },
    {
      id: 'package',
      label: 'npm package',
      cloud: `\`${C.package ?? ''}\``,
      orbit: 'None. It is a hosted service only.',
    },
    {
      id: 'package-version',
      label: 'Latest package version',
      cloud: `${C.packageVersion ?? ''} on npm, read ${C.readOn}`,
      orbit: 'Not applicable',
    },
    {
      id: 'hosted-version',
      label: 'Version the hosted server reports',
      cloud: `${C.hostedVersion ?? ''}, read ${C.readOn}`,
      orbit: 'Not published',
    },
    {
      id: 'identity',
      label: 'Who the agent is',
      cloud: C.identity[0] ?? '',
      orbit: O.identity[0] ?? '',
    },
    {
      id: 'credential',
      label: 'Credential and its life',
      cloud:
        'The two keys, until you rotate them. On your machine they sit in the process environment. Hosted, they are arguments of each call.',
      orbit:
        'A short lived account credential in the Authorization header. Reconnect when it expires. Which sign in route is current is [not published](/reference/agents#connecting-sign-in-route).',
    },
    {
      id: 'spends',
      label: 'What the agent can spend',
      cloud: `${codeList(signs)} sign and pay FLUX, and only with \`confirm\` set to true. There is no spending cap.`,
      orbit:
        'Per the guide, nothing by itself. A deploy returns a payable operation and the payment is a Stripe checkout that you complete.',
    },
    {
      id: 'human-check',
      label: 'The human check',
      cloud:
        "A boolean the agent sets, then your client's tool approval. Nothing in the server asks a person.",
      orbit:
        "Your client's tool approval, which the guide recommends for the tools that change things, and you at the checkout.",
    },
    {
      id: 'destructive',
      label: 'Tools that delete',
      cloud: `${codeList(cloudDeletes)}. Nothing is refunded for a cancel.`,
      orbit: `${codeList(orbitDeletes)}, which includes remove. The guide lists no cancel tool.`,
    },
    {
      id: 'scope',
      label: 'What it can reach',
      cloud:
        'Any Flux app: images, ports, resources and terms. The owner has to be a Flux ID that starts with 1.',
      orbit: 'Apps deployed through Orbit: Git built apps on Orbit plans.',
    },
    {
      id: 'between',
      label: 'Who sits between you and the chain',
      cloud:
        'Local: nobody, the keys stay on your machine. Hosted: your AI vendor, your host and the hosted process.',
      orbit: "Orbit and FluxCore, by the vendor's own account.",
    },
    {
      id: 'basis',
      label: 'What was read',
      cloud: `The package source and the hosted tool list, on ${C.readOn}.`,
      orbit: `The vendor guide, on ${O.readOn}. The tool list needs credentials and was not called.`,
    },
  ];
}

export interface ConnectionRow {
  id: McpConnection['id'];
  server: McpServerId;
  serverName: string;
  label: string;
  /** Plain text from the catalogue. */
  how: string;
  /** Plain text from the catalogue. */
  credentials: string;
  prov: Provenance[];
}

export function buildConnectionRows(): ConnectionRow[] {
  return SERVER_IDS.flatMap((id) => {
    const server = MCP_SERVERS[id];
    return server.connections.map((c) => ({
      id: c.id,
      server: id,
      serverName: server.name,
      label: c.label,
      how: c.how,
      credentials: c.credentials,
      prov: proof(c.basis),
    }));
  });
}

export interface ConfigSample {
  id: string;
  label: string;
  lang: 'json' | 'sh';
  filename: string;
  code: string;
  note: string;
  prov: Provenance[];
}

/**
 * The connection snippets the console and the guide show, with placeholders. FACTS 15.1.2 (the hosted
 * config), 15.2.6 (the local command) and 15.4.1 (the Orbit config). No real key or token is ever shown.
 */
export function buildConfigSamples(): ConfigSample[] {
  const C = MCP_SERVERS['flux-cloud'];
  const O = MCP_SERVERS.orbit;
  return [
    {
      id: 'hosted',
      label: 'FluxCloud, hosted',
      lang: 'json',
      filename: 'mcp.json',
      code: JSON.stringify({ mcpServers: { 'flux-cloud': { url: C.endpoint } } }, null, 2),
      note: 'A bare address, with no header and no token. The two keys go in as call arguments.',
      prov: ['source'],
    },
    {
      id: 'local',
      label: 'FluxCloud, on your machine',
      lang: 'sh',
      filename: 'shell',
      code: `claude mcp add flux-cloud -s user \\\n  -e FLUX_ID_PRIVATE_KEY=<wif> \\\n  -e FLUX_PAYMENT_PRIVATE_KEY=<wif> \\\n  -- npx -y ${C.package ?? ''}`,
      note: 'The console shows this line for Claude Code. Other hosts take the same two variables in their own config.',
      prov: ['source'],
    },
    {
      id: 'orbit',
      label: 'Orbit, as the guide shows it',
      lang: 'json',
      filename: 'mcp.json',
      code: JSON.stringify(
        {
          mcpServers: {
            orbit: {
              type: 'http',
              url: O.endpoint,
              headers: { Authorization: 'Bearer YOUR_FIREBASE_ID_TOKEN' },
            },
          },
        },
        null,
        2,
      ),
      note: "The placeholder is the guide's own. You generate the real configuration in the Orbit dashboard. Which sign in route is current is not published.",
      prov: ['docs'],
    },
  ];
}

export function buildConnectingFacts(): FactRow[] {
  return [
    {
      id: 'clients',
      label: 'Who starts a local server',
      // fact: FACTS 15.1.2
      text: "Your MCP host starts it (Claude Code, Claude Desktop, Cursor, Windsurf or OpenCode) and puts the keys into the server's environment. A startup line on stderr says whether keys are configured.",
      prov: ['source'],
    },
    {
      id: 'hosted-open',
      label: 'The hosted server asks for no sign in',
      // fact: FACTS 15.1.2
      text: 'It takes no authentication of any kind and keeps no session. Read-only tools need no key. A tool that signs or pays takes the two keys as arguments of that call.',
      prov: ['source', 'live'],
    },
    {
      id: 'orbit-needs',
      label: 'An Orbit connection needs',
      // fact: FACTS 15.4.1, 15.4.2
      text: 'An MCP client that supports Streamable HTTP and custom `Authorization` headers, and an Orbit account signed in with Google or email. The guide says a wallet only session cannot create an agent connection at this time.',
      prov: ['docs'],
    },
    {
      id: 'orbit-shared',
      label: 'The Orbit endpoint is shared',
      // fact: FACTS 15.4.1
      text: 'Its sign in challenge names the resource "Flux Apps (Orbit and Drop)" and two scopes, so the same endpoint serves Flux\'s other app, Drop. The Drop tools are not in the Orbit guide and are not listed here.',
      prov: ['live'],
    },
    {
      id: 'sign-in-route',
      label: 'Which Orbit sign in route is current',
      // fact: FACTS 15.4.2
      text: "The guide describes a pasted, short lived token with no refresh. The server's live challenge describes a browser sign in with refresh tokens. They can both be true, or the guide is behind the server. Which one a client uses was not tested, so how long a connection lasts is not published.",
      prov: ['docs', 'unverified'],
    },
  ];
}

// ---------------------------------------------------------------------------
// The tool catalogue
// ---------------------------------------------------------------------------

export interface ToolEntry {
  tool: McpTool;
  /** The element id of the tool. */
  anchor: string;
  risk: RiskKey;
  /** The words the engine uses for the risk. */
  riskWord: string;
  /** One plain line on money. */
  spends: string;
  /** What the call needs: keys or an account. */
  needs: string;
  /** The sentence a client should show before the call. */
  approval: string;
  /** The academy's recommendation: ask before this call. */
  ask: boolean;
  /** The arguments are known and one of them is `confirm`. */
  confirmArg: boolean;
  /** How the tool was read: seen on the wire, in the source, or in the vendor guide. */
  prov: Provenance[];
}

export function spendsWords(tool: McpTool): string {
  switch (tool.spends) {
    case 'with-confirm':
      return 'Spends FLUX only when confirm is true';
    case 'via-checkout':
      return 'Starts a payment that you complete in a checkout';
    default:
      return 'Spends nothing';
  }
}

export function needsWords(tool: McpTool): string {
  if (tool.needsAccount) return 'A signed in Orbit account';
  if (tool.needsOwnerKey && tool.needsPaymentKey) return 'Flux ID key and payment key';
  if (tool.needsOwnerKey) return 'Flux ID key';
  if (tool.needsPaymentKey) return 'Payment key';
  return 'No key';
}

function anchorOf(tool: McpTool): string {
  return tool.server === 'orbit' ? `tool-orbit-${tool.name}` : `tool-${tool.name}`;
}

export function buildToolEntries(server: McpServerId): ToolEntry[] {
  return toolsOf(server).map((tool) => ({
    tool,
    anchor: anchorOf(tool),
    risk: riskKeyOf(tool),
    riskWord: toolRiskLabel(tool),
    spends: spendsWords(tool),
    needs: needsWords(tool),
    approval: describeApproval(tool),
    ask: approvalRecommended(tool),
    confirmArg: hasConfirmArg(tool),
    prov: proof(tool.basis),
  }));
}

export interface ArgRow {
  name: string;
  type: string;
  required: boolean;
  note: string;
}

function argRow(a: McpToolArg): ArgRow {
  return { name: a.name, type: a.type, required: a.required, note: a.note ?? '' };
}

/** The arguments of a FluxCloud tool as its server states them. The hosted keys are listed apart. */
export function buildArgRows(tool: McpTool): ArgRow[] {
  return tool.args.map(argRow);
}

/** The two optional arguments every hosted FluxCloud tool accepts. FACTS 15.1.2. */
export function buildHostedKeyArgs(): ArgRow[] {
  return FLUX_CLOUD_HOSTED_KEY_ARGS.map(argRow);
}

export function buildFluxCloudToolFacts(): FactRow[] {
  return [
    {
      id: 'hosted-keys',
      label: 'Hosted mode adds two arguments to every tool',
      // fact: FACTS 15.1.2, 15.1.3
      text: `On the hosted server every tool also accepts ${codeList(FLUX_CLOUD_HOSTED_KEY_ARGS.map((a) => a.name))}, used for that call only. Read-only tools need neither. Never put a real key in a spec or a prompt you keep.`,
      prov: ['source', 'live'],
    },
    {
      id: 'annotations',
      label: 'The tools carry no safety annotations',
      // fact: FACTS 15.1.4
      text: "The hosted tool list has no `readOnlyHint` or `destructiveHint` on any entry, so a client cannot learn from the protocol which tools are safe. The risk column here is the academy's reading of the source.",
      prov: ['live', 'source'],
    },
    {
      id: 'errors',
      label: 'A failing call says so',
      // fact: FACTS 15.1.4
      text: 'A failing tool returns an error flag and a JSON `error` text. `flux_deploy_app` also returns the step log it had collected, which shows how far it got before it stopped.',
      prov: ['source'],
    },
  ];
}

export function buildOrbitToolFacts(): FactRow[] {
  return [
    {
      id: 'arguments',
      label: 'Arguments are not listed',
      // fact: FACTS 15.4.3, 15.4.9
      text: 'The tool list of the Orbit server needs an account to read, and it was not called. So this page gives each tool its name, group and purpose from the guide and lists no argument. None is guessed. Whether the status tool takes the transaction id, and how the checkout treats the encryption fee of a private repository, are not published either.',
      prov: ['docs', 'unverified'],
    },
    {
      id: 'annotations',
      label: 'Whether Orbit marks the tools that change things',
      // fact: FACTS 15.4.3
      text: 'The guide says Orbit marks mutating tools as destructive or not read only where appropriate. That was not read from the wire, so do not rely on a client showing a warning.',
      prov: ['docs', 'unverified'],
    },
    {
      id: 'confirm',
      label: 'The tools the guide names for confirmation',
      // fact: FACTS 15.4.3, 15.4.4
      text: `The guide's workflow asks you to require confirmation for ${codeList(ORBIT_GUIDE_CONFIRM)}. Its FAQ adds payments, which is the checkout tool.`,
      prov: ['docs'],
    },
  ];
}

/** The five tools the Orbit guide names to confirm in the client. FACTS 15.4.3 ("Tools to confirm"). */
export const ORBIT_GUIDE_CONFIRM: readonly string[] = [
  'deploy_app',
  'trigger_build',
  'control_instance',
  'update_app',
  'renew_app',
];

// ---------------------------------------------------------------------------
// Plan, then confirm
// ---------------------------------------------------------------------------

export interface ConfirmStep {
  id: string;
  title: string;
  /** Markup. */
  text: string;
  prov: Provenance[];
}

/** FACTS 15.1.5, 15.1.6, 15.1.11 and 15.1.13 (the `deploy_on_flux` prompt). */
export function buildConfirmSteps(): ConfirmStep[] {
  return [
    {
      id: 'plan',
      title: 'Plan: call without confirm',
      // fact: FACTS 15.1.5
      text: '`flux_deploy_app` with `confirm` left false validates the spec on a node, asks the network for the price and reads the payer balance. It returns the plan, the quote and a next step. It signs nothing, broadcasts nothing and spends nothing. It does real network work and needs both keys, even for the plan.',
      prov: ['source'],
    },
    {
      id: 'show',
      title: 'Show the person the quote',
      // fact: FACTS 15.1.5, 15.1.13
      text: 'The server tells the agent to show the USD quote from `flux_quote_app` and get agreement before it calls `flux_deploy_app` with `confirm` set to true. The server cannot check that it did.',
      prov: ['source'],
    },
    {
      id: 'confirm',
      title: 'Confirm: call again with confirm true',
      // fact: FACTS 15.1.5
      text: 'With `confirm` set to true the server signs the registration, sends it to a node and pays the FLUX from the payment key, all in that call. If the payer is unfunded it stops before it signs anything.',
      prov: ['source'],
    },
    {
      id: 'wait',
      title: 'Wait for the network',
      // fact: FACTS 15.1.11, 15.1.8
      text: '`flux_wait_for_app` polls until the spec is published and its instances are located. That is not the same as payment confirmed, and a located copy can still answer with a 503. For an update, pass `previousHash`, or the old spec counts as accepted at once.',
      prov: ['source'],
    },
  ];
}

export function buildConfirmFacts(): FactRow[] {
  return [
    {
      id: 'orbit-flow',
      label: 'Orbit works differently',
      // fact: FACTS 15.4.7
      text: '`deploy_app` registers the app and returns a transaction id for a payable operation. `create_stripe_checkout` makes the payment page from that id, and you pay on Stripe. The agent never needs a wallet key and no money moves until you pay there.',
      prov: ['docs'],
    },
    {
      id: 'after-accept',
      label: 'A failure after the message is accepted',
      // fact: FACTS 15.1.5
      text: 'If the deployment address changes between the quote and the payment, the call stops with "nothing was paid". The signed message is already stored on nodes. It expires with the temporary store after an hour and nothing is owed.',
      prov: ['source'],
    },
    {
      id: 'update-term',
      label: 'An update replaces the term',
      // fact: FACTS 15.1.8, 15.2.13 (9)
      text: 'Calling `flux_deploy_app` for a name that exists sends an update that replaces the whole spec, including `expire`. Read the blocks left from `flux_get_app` and set `expire` to what is left plus any extension. Otherwise the term falls back to the default of one month, with no refund.',
      prov: ['source'],
    },
  ];
}

// ---------------------------------------------------------------------------
// The key model
// ---------------------------------------------------------------------------

/** FACTS 15.1.3. The env names are the package's; the argument names come from the engine. */
export function buildKeyFacts(): FactRow[] {
  const [owner, payment] = FLUX_CLOUD_HOSTED_KEY_ARGS;
  return [
    {
      id: 'flux-id',
      label: 'The Flux ID key',
      // fact: FACTS 15.1.3
      text: `A secp256k1 key in WIF whose address, which starts with 1, is the app owner. It signs the specification and the API session phrase, and it never needs to hold funds. Set as \`FLUX_ID_PRIVATE_KEY\`, or the hosted argument \`${owner?.name ?? ''}\`.`,
      prov: ['source'],
    },
    {
      id: 'payment',
      label: 'The payment key',
      // fact: FACTS 15.1.3
      text: `A second WIF whose Flux address holds the FLUX that pays the registration or the update. It is independent of the owner: nodes pair the payment with the message by its hash alone. Set as \`FLUX_PAYMENT_PRIVATE_KEY\`, or the hosted argument \`${payment?.name ?? ''}\`.`,
      prov: ['source'],
    },
    {
      id: 'one-wif',
      label: 'One key string reads as either address',
      // fact: FACTS 15.1.3
      text: 'Both roles use the same WIF version byte, so one key string gives an owner address and a payment address. Using one key for both works, but then the owner key also holds the funds, which defeats the separation.',
      prov: ['source'],
    },
    {
      id: 'owners',
      label: 'Only a Flux ID can own the app',
      // fact: FACTS 15.1.3, 15.2.10
      text: 'The local check requires the owner to be a Flux ID that starts with 1. An app owned through an Ethereum address or a single sign-on account cannot be built, signed or managed by this server.',
      prov: ['source'],
    },
    {
      id: 'generated',
      label: 'A generated pair',
      // fact: FACTS 15.1.3
      text: '`flux_generate_keys` makes two fresh keys and returns both private keys in the tool result, which puts them in the chat. Nothing is stored or sent anywhere by the tool, and the keys cannot be recovered if you do not save them.',
      prov: ['source'],
    },
    {
      id: 'never-returned',
      label: 'No other tool returns a key',
      // fact: FACTS 15.1.3
      text: '`flux_get_identity` returns addresses, the balance and a flag that says whether keys are configured. Only `flux_generate_keys` returns private keys, and only the ones it has just made.',
      prov: ['source'],
    },
    {
      id: 'dedicated',
      label: 'Use a dedicated pair',
      // fact: FACTS 15.1.15
      text: 'Fund the payment address with only what you intend to spend. A deploy can pay the whole quote, or the network floor if that is higher, plus a fee, on every call, and the server has no per call or per day limit.',
      prov: ['source'],
    },
  ];
}

export interface KeyNeedRow {
  name: string;
  owner: boolean;
  payment: boolean;
  note: string;
}

/** Which key each FluxCloud tool needs. The matrix is the engine's; the notes are FACTS 15.1.3 and 15.1.9. */
export function buildKeyNeeds(): KeyNeedRow[] {
  const notes: Readonly<Record<string, string>> = {
    flux_deploy_app: 'Both keys, even for the plan.',
    flux_cancel_app: 'Both keys, even for the plan.',
    flux_get_app_logs: 'The owner key, for the owner session the node checks.',
    flux_get_app_stats: 'The owner key, for the owner session the node checks.',
    flux_control_app: 'The owner key, and the node only accepts the owner.',
  };
  return toolsOf('flux-cloud')
    .filter((t) => t.needsOwnerKey || t.needsPaymentKey)
    .map((t) => ({
      name: t.name,
      owner: t.needsOwnerKey,
      payment: t.needsPaymentKey,
      note: notes[t.name] ?? '',
    }));
}

// ---------------------------------------------------------------------------
// Hosted or on your machine
// ---------------------------------------------------------------------------

/** FACTS 15.1.1, 15.1.2, 15.1.3, 15.1.10 and 15.1.18 (brief cited 15.1.10 for the hosted comparison). */
export function buildHostedFacts(): FactRow[] {
  const C = MCP_SERVERS['flux-cloud'];
  return [
    {
      id: 'keys-local',
      label: 'On your machine, the keys stay in the process',
      // fact: FACTS 15.1.3
      text: 'Private keys do not leave the process. What leaves it is the signed specification, the signed login phrase (public values), the raw signed payment transaction, the payment address and probe traffic to the app. Calls go to the public API, the rate and stats services, two explorers and individual nodes.',
      prov: ['source'],
    },
    {
      id: 'keys-hosted',
      label: 'Hosted, the keys are arguments',
      // fact: FACTS 15.1.3
      text: "The private keys themselves leave your machine as tool arguments. They pass through your AI vendor's API, the chat history of your host, the MCP host process and the hosted process. Anything typed into a chat is in the vendor's and the host's history.",
      prov: ['source', 'live'],
    },
    {
      id: 'dedicated-pair',
      label: 'The server tells the agent to use a dedicated pair',
      // fact: FACTS 15.1.3, 15.1.13
      text: 'Both the hosted server instructions and the docs tell the agent to call `flux_generate_keys` for a dedicated pair, to fund only what a deployment needs and never to ask for a wallet used elsewhere. For larger budgets the docs recommend the local server.',
      prov: ['live', 'docs'],
    },
    {
      id: 'vendor-claims',
      label: 'The hosted server stores nothing',
      // fact: FACTS 15.1.3, 15.1.18
      text: 'That is the vendor\'s statement, with "holds no keys" and "runs on Flux Cloud itself". The package code does not log tool arguments. Whether the deployed instance, its gateway or any intermediary logs request bodies cannot be checked from outside.',
      prov: ['docs', 'unverified'],
    },
    {
      id: 'versions',
      label: 'The hosted server runs an older build',
      // fact: FACTS 15.1.1, 15.1.10
      text: `On ${C.readOn} the hosted server reported version ${C.hostedVersion ?? ''} while the latest on npm was ${C.packageVersion ?? ''}. The newer package adds reachability checks in \`flux_get_app\`, a \`ports\` argument and reading the components of a private app with the owner key. The hosted build does none of these, so what it does is the older behaviour.`,
      prov: ['source', 'live'],
    },
    {
      id: 'own-container',
      label: 'The image for your own container',
      // fact: FACTS 15.1.2, 15.1.18
      text: 'The docs name `ghcr.io/runonflux/flux-cloud-mcp`. The package README names a Docker Hub image that answered not found on the read date, and the registry list could not be read without a token. Its existence and age were not confirmed.',
      prov: ['docs', 'unverified'],
    },
    {
      id: 'env-keys',
      label: 'Keys in a container environment serve every caller',
      // fact: FACTS 15.1.3
      text: 'Hosted mode uses the key argument of a call and falls back to the process environment. A shared copy that has `FLUX_*` keys in its environment would sign and pay for every caller that leaves the keys out.',
      prov: ['source'],
    },
  ];
}

// ---------------------------------------------------------------------------
// What spends or deletes
// ---------------------------------------------------------------------------

/** The term of a cancel, in blocks. FACTS 15.1.8: the tool updates the app with this `expire`. */
const CANCEL_BLOCKS = MCP_CANCEL_EXPIRE_BLOCKS;

/** FACTS 15.1.4, 15.1.5, 15.1.7, 15.1.8, 15.1.9, 15.1.15 and 15.4.3. */
export function buildSpendFacts(): FactRow[] {
  const viaCheckout = toolsOf('orbit').filter((t) => t.spends === 'via-checkout');
  return [
    {
      id: 'deploy',
      label: '`flux_deploy_app` pays, with confirm',
      // fact: FACTS 15.1.4, 15.1.7
      text: 'With `confirm` set to true it pays the quote, or the network floor if that is higher, plus a network fee. It registers a new name or updates an app of the same owner. An update replaces the whole spec, term included.',
      prov: ['source'],
    },
    {
      id: 'cancel',
      label: '`flux_cancel_app` ends the app',
      // fact: FACTS 15.1.8
      text: `It updates the app with a term of ${humanBlocks(CANCEL_BLOCKS)}, after which the nodes remove it everywhere. Nothing is refunded and the data goes with it, so back up first. It needs both keys and \`confirm\` set to true, and it refuses a private app: cancel that one with \`flux_deploy_app\` and a short term.`,
      prov: ['source'],
    },
    {
      id: 'cancel-cost',
      label: 'What a cancel costs',
      // fact: FACTS 15.1.8 (UNVERIFIED: not run on a real app)
      text: `Worked out from node source and the calculator. An update that only shortens the term is usually free in USD while an app has had few recent updates, and the server then pays the network floor of ${BAKED_PRICING.params.minPrice} FLUX plus a fee of about a tenth of that. Past the free update limits the quote is the update price, which floors at the minimum price. So a cancel costs between about that floor and one minimum quote. A cancel was not run on a real app.`,
      prov: ['source', 'unverified'],
    },
    {
      id: 'control',
      label: '`flux_control_app` has no plan and no confirm',
      // fact: FACTS 15.1.4, 15.1.9
      text: 'A restart or a soft redeploy changes the app. A `hard` redeploy and `remove` delete the data on the nodes they reach. It pays nothing, so a client that only guards the tools that spend lets it through with one call.',
      prov: ['source'],
    },
    {
      id: 'remove',
      label: 'Remove is not cancel',
      // fact: FACTS 15.1.9
      text: '`remove` uninstalls the app from the nodes, but the registration stays on chain, so nodes bring the app back elsewhere. Use `flux_cancel_app` to stop paying. A global command is sent to the other nodes and the call returns at once, so its result is not the outcome.',
      prov: ['source'],
    },
    {
      id: 'orbit-payments',
      label: 'Orbit starts a payment, you complete it',
      // fact: FACTS 15.4.3, 15.4.7
      text: `${codeList(viaCheckout.map((t) => t.name))} create a payable operation or the Stripe page for one. No money moves until you pay there. \`update_app\`: ${orbitWatch('update_app')}`,
      prov: ['docs', 'inference'],
    },
    {
      id: 'orbit-control',
      label: '`control_instance` can remove',
      // fact: FACTS 15.4.3
      text: `${toolByName('orbit', 'control_instance')?.summary ?? ''} ${toolByName('orbit', 'control_instance')?.watch ?? ''} The guide lists no cancel tool.`,
      prov: ['docs'],
    },
    {
      id: 'logs',
      label: 'Logs reach the model as they are',
      // fact: FACTS 15.1.10, 15.4.5 (the redaction limit is an inference: UNVERIFIED)
      text: `\`flux_get_app_logs\` returns lines raw, so anything the app prints, including a secret, goes into the chat. \`get_logs\`: ${orbitWatch('get_logs')}`,
      prov: ['source', 'docs', 'unverified'],
    },
    {
      id: 'no-cap',
      label: 'There is no spending cap and no allow list',
      // fact: FACTS 15.1.15
      text: "The FluxCloud server has no setting for a maximum price, a set of allowed names or images, or an approval step. What protects you is your client's tool approval and what the payment address holds.",
      prov: ['source'],
    },
    {
      id: 'injection',
      label: 'Text an agent reads can ask for a deploy',
      // fact: FACTS 15.1.15 (UNVERIFIED: no incident observed)
      text: 'A page, a README or a log that an agent reads can tell it to call `flux_deploy_app` with `confirm` set to true, or `flux_cancel_app`. This is {{term:prompt-injection}}. No incident was observed, so treat it as guidance. Keep approvals on for those two and for `flux_control_app`.',
      prov: ['source', 'unverified'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Approval policies
// ---------------------------------------------------------------------------

export type PolicyId = 'ask-all' | 'ask-spends' | 'allow-all' | 'recommended';

export interface PolicyRow {
  id: PolicyId;
  label: string;
  /** Markup: what the client asks about. */
  rule: string;
  /** Tools it asks before, per server. */
  asks: Record<McpServerId, string[]>;
  /** Tools that are not read only and run without asking, per server. */
  runs: Record<McpServerId, string[]>;
  /** The row is the academy's advice, not a setting a client has. */
  advice: boolean;
}

function byServer(pick: (t: McpTool) => boolean): Record<McpServerId, string[]> {
  return {
    'flux-cloud': toolsOf('flux-cloud')
      .filter(pick)
      .map((t) => t.name),
    orbit: toolsOf('orbit')
      .filter(pick)
      .map((t) => t.name),
  };
}

/**
 * What each policy asks about and what it lets through, computed from the catalogue. "Ask spends" asks
 * before a tool that can spend or start a payment, so keys, changes and deletes that spend nothing run
 * unasked: the gap FACTS 15.1.4 and 15.2.13 (3) describe.
 */
export function buildPolicyRows(): PolicyRow[] {
  const notRead = (t: McpTool) => t.risk !== 'reads';
  const asksSpends = (t: McpTool) => t.spends !== 'never';
  return [
    {
      id: 'ask-all',
      label: 'Ask all',
      rule: 'Your client asks before every call that is not a pure read. Reads run without a prompt.',
      asks: byServer(approvalRecommended),
      runs: byServer(() => false),
      advice: false,
    },
    {
      id: 'ask-spends',
      label: 'Ask spends',
      rule: 'Your client asks only before a tool that can spend or start a payment. It runs everything else, including the tools that handle keys, change an app or delete data without paying.',
      asks: byServer(asksSpends),
      runs: byServer((t) => notRead(t) && !asksSpends(t)),
      advice: false,
    },
    {
      id: 'allow-all',
      label: 'Allow all',
      rule: 'Your client asks about nothing and every call runs, including the ones that delete data.',
      asks: byServer(() => false),
      runs: byServer(notRead),
      advice: false,
    },
    {
      id: 'recommended',
      label: 'The academy recommends',
      rule: 'Ask all: ask before every tool that is not a pure read, and let the reads run.',
      asks: byServer(approvalRecommended),
      runs: byServer(() => false),
      advice: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// The console assistant
// ---------------------------------------------------------------------------

export interface ConsoleToolGroup {
  id: string;
  label: string;
  tools: readonly string[];
  /** Plain text. */
  what: string;
  /** The tools only work when you are signed in. */
  signedIn: boolean;
}

/**
 * The tools of the assistant inside the FluxCloud console, as the page sends them to the model. FACTS 15.2.2.
 * The model has no other tool, and the page runs no other name.
 */
export const CONSOLE_TOOL_GROUPS: readonly ConsoleToolGroup[] = [
  {
    id: 'navigation',
    label: 'Move around',
    tools: ['ui_navigate', 'ui_open_app', 'ui_open_template'],
    what: 'Takes you to one of a fixed list of pages, opens one of your apps, or opens a marketplace template.',
    signedIn: false,
  },
  {
    id: 'proposal',
    label: 'Propose a deploy',
    tools: ['ui_prefill_deploy'],
    what: 'Opens the deploy page with the form filled in from a specification. You review the quote and sign there.',
    signedIn: false,
  },
  {
    id: 'checks',
    label: 'Check before a proposal',
    tools: ['flux_validate_spec', 'flux_check_image', 'flux_quote_app'],
    what: 'Has a node verify the spec, checks the image tag and architecture, and asks the network for a price.',
    signedIn: false,
  },
  {
    id: 'reference',
    label: 'Look things up',
    tools: ['flux_get_template', 'flux_get_pricing', 'flux_get_network_info', 'flux_search_docs'],
    what: 'Reads a marketplace template, the rate card, node counts and the documentation.',
    signedIn: false,
  },
  {
    id: 'your-apps',
    label: 'Read your own apps',
    tools: [
      'flux_list_my_apps',
      'flux_get_app',
      'flux_get_app_logs',
      'flux_get_app_stats',
      'flux_diagnose_app',
    ],
    what: 'Lists your apps, reads a spec, logs and live use, and diagnoses one app.',
    signedIn: true,
  },
];

/** What the assistant cannot do, because no tool for it exists. FACTS 15.2.2 ("Not available"). */
export const CONSOLE_NEVER: readonly string[] = [
  'deploy an app',
  'sign anything',
  'pay',
  'cancel or update an app',
  'restart, redeploy or remove an app',
  'generate or read a key',
];

export function consoleToolNames(): string[] {
  return CONSOLE_TOOL_GROUPS.flatMap((g) => [...g.tools]);
}

/** The names the assistant shares with the FluxCloud MCP server. FACTS 15.2.2. */
export function consoleSharedNames(): string[] {
  const mcp = new Set(toolsOf('flux-cloud').map((t) => t.name));
  return consoleToolNames().filter((n) => mcp.has(n));
}

export function buildConsoleFacts(): FactRow[] {
  const names = consoleToolNames();
  const shared = consoleSharedNames();
  const cloud = toolsOf('flux-cloud').length;
  return [
    {
      id: 'hand-off',
      label: 'It hands you a draft and you sign',
      // fact: FACTS 15.2.3
      text: "The assistant's own instructions say it cannot deploy, sign or spend. It passes the specification to the deploy page, and you review the quote, sign with your own key and pay there.",
      prov: ['source'],
    },
    {
      id: 'not-mcp',
      label: 'It is not an MCP server',
      // fact: FACTS 15.2.2, 15.2.3
      text: `It runs in the console page with your session and calls a language model through a gateway. It has ${count(names.length, 'tool')} of its own against the ${num(cloud)} of the FluxCloud MCP server, and shares ${num(shared.length)} names with it, some with different arguments. It has no deploy, cancel, control or key tool.`,
      prov: ['source'],
    },
    {
      id: 'logs',
      label: 'Logs reach the model raw',
      // fact: FACTS 15.2.5
      text: 'Its log tool returns lines as they are. Only the environment lines of its diagnosis are filtered, by secret-like names. Do not say it filters secrets from everything it reads.',
      prov: ['source'],
    },
    {
      id: 'retention',
      label: 'What the assistant keeps',
      // fact: FACTS 15.2.4, 15.2.11
      text: 'The console says conversations help improve the model, so never paste keys, seed phrases or passwords. Whether the gateway keeps conversations, for how long and on which nodes the model runs was not confirmed.',
      prov: ['docs', 'unverified'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Known gaps in vendor guides
// ---------------------------------------------------------------------------

export interface GapRow {
  id: string;
  /** Markup: what the guide, the estimator or the console says. */
  says: string;
  /** Markup: what source and the live network show. */
  shows: string;
  where: string;
  prov: Provenance[];
}

/** FACTS 15.1.16 and 15.2.6 to 15.2.8. Read on `AGENTS_READ_ON`. */
export function buildGapRows(): GapRow[] {
  return [
    {
      id: 'g-discount',
      says: 'The pricing guide and the estimator take 20 percent off primary and standby (`g:`) storage.', // literal: FACTS 15.1.16, the guide's wording
      shows:
        'The network has no such discount. The live calculator returns identical prices for `r:`, `g:` and plain data paths. The local estimator applies a factor when a component contains `g:`.',
      where: 'FluxCloud MCP server: pricing guide, `flux_get_pricing`',
      prov: ['live', 'source'],
    },
    {
      id: 'estimator',
      says: 'The example sizes of `flux_get_pricing` are priced for you.',
      shows:
        'They are a local estimate. It stops at the cent and does not apply the rounding the network added after the package was published, so most of the examples come out lower than the quote for the same size. The table below compares them.',
      where: 'FluxCloud MCP server: `flux_get_pricing`',
      prov: ['live', 'source'],
    },
    {
      id: 'persist-prefix',
      says: 'Persisted paths must be prefixed `r:`, and `flux_build_spec` makes every data path `r:`.',
      shows:
        '`g:` and `s:` also replicate. With `r:` every instance writes, which is wrong for a database with one writer. Choose `g:` for those and check the storage flag the tool sets.',
      where: 'FluxCloud MCP server: overview guide, `flux_build_spec`',
      prov: ['source'],
    },
    {
      id: 'component-names',
      says: 'Names are letters, digits and inner hyphens, and a single component is named after the app.',
      shows:
        'That is the app name rule. A component name allows only letters and digits, so an app called `my-site` gives a component name the node rejects, although the local check accepts it. `flux_validate_spec` and the plan of `flux_deploy_app` catch it before anything is signed. Set the component name yourself.',
      where: 'FluxCloud MCP server: overview guide, `flux_build_spec`',
      prov: ['source'],
    },
    {
      id: 'api-token',
      says: 'An agent can use an API token with a daily limit instead of a private key.',
      shows:
        'Nothing backs it. The server accepts the two keys as arguments and no token, and the console has no code that issues one. Say it as something the console says, not as how the server works today.',
      where: 'FluxCloud console: landing page, agents page and sign in dialog',
      prov: ['source', 'live'],
    },
    {
      id: 'balance',
      says: 'A prepaid balance pays the first day, a cost per day is shown, and there is a 7 day alert and a 3 day grace period.', // literal: FACTS 15.2.8, the landing copy
      shows:
        "The console's own balance page says each app deployment is paid for on its own today, when you register it and when you extend it. The network has no balance for apps: a term is prepaid in blocks, and at the end of it the app and its data are removed with no grace. The same page also describes a separate Flux Edge balance that GPU rentals draw from today.",
      where: 'FluxCloud console: landing page',
      prov: ['source', 'docs'],
    },
  ];
}

export interface EstimateRow {
  id: 'tiny' | 'small' | 'medium' | 'large';
  label: string;
  size: string;
  instances: number;
  /** What `flux_get_pricing` prints for the size, hand transcribed from the package estimator. */
  estimator: number;
  /** What the network quote is for the same size: the engine's `quote()`, one month. */
  network: number;
}

/**
 * The four example sizes of `flux_get_pricing`, each at three instances for one month. The sizes are the
 * package's own (FACTS 15.1.16); the estimator figures are hand transcribed from package 0.2.7 and the
 * network figures come from the engine, which the live calculator matched on the read date.
 */
const ESTIMATE_SIZES: readonly {
  id: EstimateRow['id'];
  label: string;
  cpu: number;
  ram: number;
  hdd: number;
  estimator: number;
}[] = [
  { id: 'tiny', label: 'Tiny', cpu: 0.3, ram: 300, hdd: 3, estimator: 0.99 }, // literal: FACTS 15.1.16, package estimator
  { id: 'small', label: 'Small', cpu: 1, ram: 1000, hdd: 10, estimator: 1.78 }, // literal: FACTS 15.1.16, package estimator
  { id: 'medium', label: 'Medium', cpu: 2, ram: 4000, hdd: 40, estimator: 4.66 }, // literal: FACTS 15.1.16, package estimator
  { id: 'large', label: 'Large', cpu: 4, ram: 8000, hdd: 100, estimator: 10.8 }, // literal: FACTS 15.1.16, package estimator
];

export function buildEstimateRows(): EstimateRow[] {
  return ESTIMATE_SIZES.map((s) => {
    const spec = defaultSpec();
    spec.instances = 3; // literal: the package's example sizes run on three instances
    spec.compose = [
      defaultComponent({
        name: 'app',
        repotag: 'nginx:1.27',
        cpu: s.cpu,
        ram: s.ram,
        hdd: s.hdd,
      }),
    ];
    const q = quote(spec, BAKED_PRICING.params);
    return {
      id: s.id,
      label: s.label,
      size: `${num(s.cpu)} vCores, ${num(s.ram)} MB, ${num(s.hdd)} GB`,
      instances: spec.instances,
      estimator: s.estimator,
      network: q.usdTotal ?? q.usdPerMonth,
    };
  });
}

export function buildGapNotes(): string {
  return `The estimator figures were transcribed by hand from package ${MCP_SERVERS['flux-cloud'].packageVersion ?? ''} and the network figures are \`quote()\` at the rates read on ${BAKED_PRICING.capturedAt}, which the live calculator matched on ${AGENTS_READ_ON}. Never copy a FLUX amount from a README or a guide: they are figures at an older FLUX price. Ask for a quote.`;
}

// ---------------------------------------------------------------------------
// Fact lists by section
// ---------------------------------------------------------------------------

/**
 * Every list of statements the page prints with `FactList`, by the section it sits in. The page renders
 * these rows with `anchor.fact(section, row.id)` as the element id, and the tests walk this list to check
 * that every row has an element, that every statement marked Unverified is in the search index with the same
 * labels, and that no id repeats.
 */
export const FACT_SECTIONS: readonly { section: string; rows: () => FactRow[] }[] = [
  { section: 'at-a-glance', rows: buildGlanceFacts },
  { section: 'connecting', rows: buildConnectingFacts },
  { section: 'tools-flux-cloud', rows: buildFluxCloudToolFacts },
  { section: 'tools-orbit', rows: buildOrbitToolFacts },
  { section: 'plan-confirm', rows: buildConfirmFacts },
  { section: 'key-model', rows: buildKeyFacts },
  { section: 'hosted-or-local', rows: buildHostedFacts },
  { section: 'what-spends', rows: buildSpendFacts },
  { section: 'console-assistant', rows: buildConsoleFacts },
];
