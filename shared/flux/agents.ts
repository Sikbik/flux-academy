/**
 * The two MCP servers an agent can use to operate Flux apps: the FluxCloud MCP server (two keys, no account)
 * and the Orbit MCP server (a signed-in Orbit account). A dated catalogue: what each tool is called, what it
 * can do to money and data, and what a client should show the person before the call.
 *
 * An agent changes who types the spec, not what the network does. These tools call the same endpoints, build
 * the same version 8 spec, and the same signed message and payment follow (FACTS 15.1.1). So the catalogue
 * records risk, not behaviour of the network.
 *
 * Sources and dates:
 * - FluxCloud server: package `@runonflux/flux-cloud-mcp` 0.2.7 (source read) and the hosted `tools/list`
 *   (version 0.2.2 reported), both read 2026-10-13. FACTS 15.1.4 (the 15 tools), 15.1.3 (identity), 15.1.5
 *   (plan then confirm). `basis: 'live'` = name and schema seen on the hosted tools/list; `basis: 'source'`
 *   = read in the package source only (the argument is newer than the hosted build).
 * - Orbit server: the Orbit guide `https://runonflux.com/apps/orbit/mcp-server`, read 2026-10-13. FACTS 15.4.3.
 *   `tools/list` needs credentials and was never called, so argument names are UNVERIFIED: `args` is empty and
 *   `basis` is `docs`. Do not invent arguments.
 *
 * No price is stored here. Amounts come from `quote()` or from the server's own quote at call time.
 *
 * Refreshing: re-run `tools/list` against the hosted server (no credentials needed for FluxCloud), diff the
 * names and schemas against `FLUX_CLOUD_TOOLS`, re-read the Orbit guide's tool table, update `readOn`, and let
 * `agents.test.ts` tell you what drifted.
 *
 * Pure and framework-free. Erasable TypeScript only. No Node built-ins, no DOM.
 */

export type ToolRisk = 'reads' | 'keys' | 'spends' | 'changes' | 'destroys';
export type McpServerId = 'flux-cloud' | 'orbit';

export interface McpToolArg {
  name: string;
  /** `string`, `integer`, `number`, `boolean`, `object`, `array`, or `enum` (values in `note`). */
  type: string;
  required: boolean;
  note?: string;
}

export interface McpTool {
  server: McpServerId;
  /** Exactly as the server names it. */
  name: string;
  /** `Identity`, `Pricing`, `Build`, `Deploy`, `Inspect`, `Operate` for FluxCloud; the guide's groups for Orbit. */
  group: string;
  /** One plain sentence. */
  summary: string;
  risk: ToolRisk;
  /**
   * `never`: the call cannot move money. `with-confirm`: it can, and only when the `confirm` argument is true
   * (the agent sets that flag; it is not a human prompt, FACTS 15.1.5). `via-checkout`: it can create a
   * payable operation or a checkout, and the person completes the payment on the payment page.
   */
  spends: 'never' | 'with-confirm' | 'via-checkout';
  /** FluxCloud: the Flux ID (owner) key is needed. Always false for Orbit, which uses an account (`needsAccount`). */
  needsOwnerKey: boolean;
  /** FluxCloud: the payment key is needed too (even for the plan of a deploy or cancel, FACTS 15.1.3). */
  needsPaymentKey: boolean;
  /** Orbit: a signed-in Orbit account is needed. False for FluxCloud. */
  needsAccount: boolean;
  /** The call can return data that is private to the app owner (logs, decrypted components). */
  readsPrivateAppData: boolean;
  /** Argument names as the server states them. Empty with `basis: 'docs'` means unknown, not "none". */
  args: McpToolArg[];
  /** One plain sentence on what to watch for, when there is something specific. */
  watch?: string;
  /** `live`: seen on the wire; `source`: read in the package source; `docs`: from a vendor page only. */
  basis: 'source' | 'live' | 'docs';
}

export interface McpConnection {
  id: 'local' | 'hosted' | 'self-hosted' | 'account';
  label: string;
  /** How a client connects, in one sentence. */
  how: string;
  /** Where the credentials are while the call runs. */
  credentials: string;
  basis: 'source' | 'live' | 'docs';
}

export interface McpServerInfo {
  id: McpServerId;
  name: string;
  /** `keys`: the agent holds keys. `account`: the agent holds a short lived account credential. */
  kind: 'keys' | 'account';
  /** The hosted endpoint. */
  endpoint: string;
  transport: string;
  /** npm package, or null when there is none (Orbit). */
  package: string | null;
  /** Latest npm version on the read date, or null. */
  packageVersion: string | null;
  /** Version the hosted server reported on the read date, or null when it reports none. */
  hostedVersion: string | null;
  /** Short plain sentences on who the agent is and where the keys live. */
  identity: string[];
  connections: McpConnection[];
  /** Public pages about the server. */
  links: string[];
  readOn: string;
  basis: 'source' | 'live' | 'docs';
}

/** Hosted FluxCloud only: the two optional arguments every tool accepts. Never put a real key in a spec. */
export const FLUX_CLOUD_HOSTED_KEY_ARGS: readonly McpToolArg[] = [
  {
    name: 'fluxIdPrivateKey',
    type: 'string',
    required: false,
    note: 'WIF private key of the Flux ID that owns the app. Use a dedicated key from flux_generate_keys.',
  },
  {
    name: 'paymentPrivateKey',
    type: 'string',
    required: false,
    note: 'WIF private key of the Flux address that pays. Fund it with only what you intend to spend.',
  },
];

// ---------------------------------------------------------------------------
// FluxCloud MCP server: 15 tools
// ---------------------------------------------------------------------------

interface ToolInit {
  group: string;
  summary: string;
  risk: ToolRisk;
  spends?: McpTool['spends'];
  ownerKey?: boolean;
  paymentKey?: boolean;
  privateData?: boolean;
  args?: McpToolArg[];
  watch?: string;
  basis: McpTool['basis'];
}

function fluxCloud(name: string, init: ToolInit): McpTool {
  const tool: McpTool = {
    server: 'flux-cloud',
    name,
    group: init.group,
    summary: init.summary,
    risk: init.risk,
    spends: init.spends ?? 'never',
    needsOwnerKey: init.ownerKey ?? false,
    needsPaymentKey: init.paymentKey ?? false,
    needsAccount: false,
    readsPrivateAppData: init.privateData ?? false,
    args: init.args ?? [],
    basis: init.basis,
  };
  if (init.watch) tool.watch = init.watch;
  return tool;
}

const arg = (name: string, type: string, required: boolean, note?: string): McpToolArg =>
  note === undefined ? { name, type, required } : { name, type, required, note };

// source: tool-catalogue-flux-cloud-mcp.json (hosted tools/list 2026-10-13, package 0.2.7); FACTS 15.1.4
const FLUX_CLOUD_TOOLS: readonly McpTool[] = [
  fluxCloud('flux_get_identity', {
    group: 'Identity',
    summary:
      'Shows the Flux ID, the payment address and its spendable FLUX balance, or says which key is missing.',
    risk: 'reads',
    basis: 'live',
  }),
  fluxCloud('flux_generate_keys', {
    group: 'Identity',
    summary: 'Creates a fresh Flux ID key and a fresh payment key and returns both private keys.',
    risk: 'keys',
    watch:
      'The private keys appear in the chat transcript, so they sit in your AI vendor and host history; save them and fund only what a deployment needs.',
    basis: 'live',
  }),
  fluxCloud('flux_get_pricing', {
    group: 'Pricing',
    summary: 'Returns the USD rate card, the FLUX price and a few example sizes priced by a local estimator.',
    risk: 'reads',
    watch:
      'Its example sizes are a local estimate, not a quote; use flux_quote_app for the price you will pay.',
    basis: 'live',
  }),
  fluxCloud('flux_build_spec', {
    group: 'Build',
    summary:
      'Turns a plain description (images, ports, sizes, term) into a full version 8 specification, locally.',
    risk: 'reads',
    args: [
      arg(
        'name',
        'string',
        true,
        'Unique app name: letters, digits, inner hyphens; not starting with flux or zel.',
      ),
      arg(
        'components',
        'array',
        true,
        'One entry per container: image, cpu, ram, hdd and optional ports, env, commands.',
      ),
      arg('description', 'string', false),
      arg('instances', 'integer', false, 'Copies on distinct nodes. The tool defaults to three.'),
      arg('months', 'number', false, 'Term in network months. The tool defaults to one.'),
      arg('expireBlocks', 'integer', false, 'Exact term in blocks; overrides months.'),
      arg('contacts', 'array', false),
      arg('geolocation', 'array', false),
      arg('nodes', 'array', false),
      arg('staticip', 'boolean', false),
      arg(
        'owner',
        'string',
        false,
        'Flux ID that will own the app. Defaults to the configured or passed key.',
      ),
    ],
    watch:
      'Its default data path is replicated for every instance, which is wrong for a database with a single writer; check the storage flag.',
    basis: 'live',
  }),
  fluxCloud('flux_validate_spec', {
    group: 'Build',
    summary:
      'Checks a specification locally and asks a FluxOS node to verify it as at registration, without registering.',
    risk: 'reads',
    args: [arg('spec', 'object', true), arg('network', 'boolean', false, 'Also verify on a FluxOS node.')],
    basis: 'live',
  }),
  fluxCloud('flux_quote_app', {
    group: 'Pricing',
    summary: 'Returns the network USD price and the FLUX to pay for a registration or an update.',
    risk: 'reads',
    args: [arg('spec', 'object', true)],
    basis: 'live',
  }),
  fluxCloud('flux_deploy_app', {
    group: 'Deploy',
    summary:
      'Plans a registration or update and, only with confirm set to true, signs it, broadcasts it and pays the FLUX.',
    risk: 'spends',
    spends: 'with-confirm',
    ownerKey: true,
    paymentKey: true,
    args: [
      arg('spec', 'object', true),
      arg('enterprise', 'object', false, 'Makes the app private: its components and contacts are encrypted.'),
      arg(
        'confirm',
        'boolean',
        false,
        'Set true to actually sign, broadcast and pay. Without it the call only returns the plan.',
      ),
    ],
    watch:
      'The agent sets confirm, not a person; an update replaces the whole spec including its term, so set the term to what is left plus any extension.',
    basis: 'live',
  }),
  fluxCloud('flux_wait_for_app', {
    group: 'Deploy',
    summary:
      'Polls the network until the app is published and its instances are located, or the timeout ends.',
    risk: 'reads',
    args: [
      arg('name', 'string', true),
      arg('txid', 'string', false, 'Payment transaction id from flux_deploy_app.'),
      arg(
        'previousHash',
        'string',
        false,
        'For updates: the hash of the previous spec, so acceptance means a new hash.',
      ),
      arg('timeoutSeconds', 'integer', false),
    ],
    watch: 'For an update, pass the previous hash, or the old spec counts as accepted at once.',
    basis: 'live',
  }),
  fluxCloud('flux_get_app', {
    group: 'Inspect',
    summary: 'Looks up any app by name: its published spec, expiry, running nodes and addresses.',
    risk: 'reads',
    args: [
      arg('name', 'string', true),
      arg(
        'ports',
        'array',
        false,
        'Ports to probe on instances. Added in package 0.2.7; not in the hosted schema read on 2026-10-13.',
      ),
    ],
    basis: 'source',
  }),
  fluxCloud('flux_list_my_apps', {
    group: 'Inspect',
    summary: 'Lists the apps owned by a Flux ID with instances running and time left.',
    risk: 'reads',
    args: [
      arg('owner', 'string', false, 'Flux ID to list; defaults to the configured one.'),
      arg('nameContains', 'string', false),
    ],
    basis: 'live',
  }),
  fluxCloud('flux_get_app_logs', {
    group: 'Inspect',
    summary: 'Returns the last lines of a container log from one running node, for the app owner.',
    risk: 'reads',
    ownerKey: true,
    privateData: true,
    args: [
      arg('name', 'string', true),
      arg('component', 'string', false, 'Component name for multi-component apps.'),
      arg('lines', 'integer', false),
      arg('nodeIp', 'string', false, 'ip[:port] of the instance; defaults to the first running one.'),
    ],
    watch: 'The lines are not filtered, so anything the app prints, including secrets, goes into the chat.',
    basis: 'live',
  }),
  fluxCloud('flux_get_app_stats', {
    group: 'Inspect',
    summary: 'Returns live CPU, memory and network use of an app container on one node, for the app owner.',
    risk: 'reads',
    ownerKey: true,
    privateData: true,
    args: [
      arg('name', 'string', true),
      arg('component', 'string', false, 'Component name for multi-component apps.'),
      arg('nodeIp', 'string', false),
    ],
    basis: 'live',
  }),
  fluxCloud('flux_control_app', {
    group: 'Operate',
    summary: 'Restarts, redeploys or removes the app containers on one node or on every node.',
    risk: 'destroys',
    ownerKey: true,
    args: [
      arg('name', 'string', true),
      arg('action', 'enum', true, 'restart, redeploy or remove'),
      arg('scope', 'enum', false, 'node or global; the tool defaults to global'),
      arg('nodeIp', 'string', false, 'Required when scope is node.'),
      arg('hard', 'boolean', false, 'For redeploy: also delete the app data.'),
    ],
    watch:
      'It has no confirm flag and no plan step, and a hard redeploy or a remove deletes data on the nodes it reaches.',
    basis: 'live',
  }),
  fluxCloud('flux_cancel_app', {
    group: 'Operate',
    summary: 'Ends an app early by shortening its term, after which the nodes remove it everywhere.',
    risk: 'destroys',
    spends: 'with-confirm',
    ownerKey: true,
    paymentKey: true,
    args: [
      arg('name', 'string', true),
      arg(
        'confirm',
        'boolean',
        false,
        'Set true to sign and pay the update. Without it the call only returns the plan.',
      ),
    ],
    watch: 'Nothing is refunded and the app data is removed, so back up first.',
    basis: 'live',
  }),
  fluxCloud('flux_get_network_info', {
    group: 'Inspect',
    summary:
      'Returns node counts by tier, the block height, the FLUX price and the deployment payment address.',
    risk: 'reads',
    basis: 'live',
  }),
];

// ---------------------------------------------------------------------------
// Orbit MCP server: 15 tools (DOCS-ONLY, arguments unknown)
// ---------------------------------------------------------------------------

function orbit(name: string, init: Omit<ToolInit, 'basis' | 'args' | 'ownerKey' | 'paymentKey'>): McpTool {
  const tool: McpTool = {
    server: 'orbit',
    name,
    group: init.group,
    summary: init.summary,
    risk: init.risk,
    spends: init.spends ?? 'never',
    needsOwnerKey: false,
    needsPaymentKey: false,
    needsAccount: true,
    readsPrivateAppData: init.privateData ?? false,
    // tools/list needs credentials and was not called: argument names are not known (FACTS 15.4.3).
    args: [],
    basis: 'docs',
  };
  if (init.watch) tool.watch = init.watch;
  return tool;
}

// source: FACTS 15.4.3 (the guide's table 'Available agent tools', read 2026-10-13)
const ORBIT_TOOLS: readonly McpTool[] = [
  orbit('list_plans', {
    group: 'Discovery',
    summary: 'Lists the Orbit plans so an agent can compare them.',
    risk: 'reads',
  }),
  orbit('analyze_repository', {
    group: 'Discovery',
    summary:
      "Inspects a Git repository against Orbit's compatibility rules and reports the detected runtime, port, branch and project directory.",
    risk: 'reads',
  }),
  orbit('list_apps', {
    group: 'App inspection',
    summary: "Lists the Orbit apps owned by the signed-in account's Flux identity.",
    risk: 'reads',
  }),
  orbit('get_app', {
    group: 'App inspection',
    summary: "Returns one owned app's specification with secrets removed.",
    risk: 'reads',
  }),
  orbit('get_instances', {
    group: 'App inspection',
    summary: 'Lists the nodes assigned to an owned app.',
    risk: 'reads',
  }),
  orbit('get_deployment_status', {
    group: 'Status and capacity',
    summary: 'Reports where a deployment is: its registration state and live locations.',
    risk: 'reads',
  }),
  orbit('get_network_capacity', {
    group: 'Status and capacity',
    summary: 'Checks whether there is suitable Flux capacity.',
    risk: 'reads',
  }),
  orbit('validate_deployment', {
    group: 'Deployment',
    summary: 'Builds the app specification and its authoritative network price without registering anything.',
    risk: 'reads',
    watch: 'This is the review step before deploy_app; read the spec and the price it returns.',
  }),
  orbit('deploy_app', {
    group: 'Deployment',
    summary:
      'Registers the approved app on the network and tests the installation; returns a Flux transaction id.',
    risk: 'spends',
    spends: 'via-checkout',
    watch:
      'Keep the transaction id it returns, and after a timeout check that id or the deployment status before calling it again.',
  }),
  orbit('create_stripe_checkout', {
    group: 'Payments',
    summary: 'Creates a Stripe checkout for an owned Flux transaction at the server-calculated price.',
    risk: 'spends',
    spends: 'via-checkout',
    watch: 'It creates the payment page; you still pay on Stripe, so open it yourself and read the amount.',
  }),
  orbit('get_logs', {
    group: 'Logs and builds',
    summary: "Reads a bounded tail of an owned app's log.",
    risk: 'reads',
    privateData: true,
    watch:
      'Known secrets are redacted, but text the app prints itself may not be, so treat logs as sensitive.',
  }),
  orbit('trigger_build', {
    group: 'Logs and builds',
    summary: 'Requests a new Orbit build of an owned app.',
    risk: 'changes',
  }),
  orbit('control_instance', {
    group: 'Instance control',
    summary:
      'Performs one allowed action (start, stop, restart, pause, unpause, redeploy or remove) on one node assigned to an owned app.',
    risk: 'destroys',
    watch: 'Redeploy and remove are the destructive actions; check which one the agent chose.',
  }),
  orbit('update_app', {
    group: 'Maintenance',
    summary:
      "Applies constrained changes to an owned app's settings, keeping the remaining subscription period.",
    risk: 'spends',
    spends: 'via-checkout',
    watch: 'A change to resources can change the price, so check the price before you approve.',
  }),
  orbit('renew_app', {
    group: 'Maintenance',
    summary: "Extends an owned app's subscription by an approved duration.",
    risk: 'spends',
    spends: 'via-checkout',
  }),
];

/** Every tool of both servers. Order: FluxCloud then Orbit, each in the order its server lists them. */
export const MCP_TOOLS: readonly McpTool[] = [...FLUX_CLOUD_TOOLS, ...ORBIT_TOOLS];

// ---------------------------------------------------------------------------
// Servers
// ---------------------------------------------------------------------------

// source: FACTS 15.1.1 to 15.1.3 (FluxCloud), 15.4.1 and 15.4.2 (Orbit); read 2026-10-13
export const MCP_SERVERS: Record<McpServerId, McpServerInfo> = {
  'flux-cloud': {
    id: 'flux-cloud',
    name: 'FluxCloud MCP server',
    kind: 'keys',
    endpoint: 'https://mcp.runonflux.com/mcp',
    transport: 'stdio when run locally; Streamable HTTP, stateless, when hosted',
    package: '@runonflux/flux-cloud-mcp',
    packageVersion: '0.2.7',
    hostedVersion: '0.2.2',
    identity: [
      'There is no account: the agent works with two keys, a Flux ID key that owns apps and a payment key that pays.',
      'On your machine the keys stay in the server process; on the hosted server they are arguments of each call and pass through your AI vendor.',
      'Use a dedicated pair made by flux_generate_keys and fund the payment address with only what you intend to spend.',
      'It signs only with a Flux ID key, so an Ethereum address or a single sign-on account cannot own apps through it.',
    ],
    connections: [
      {
        id: 'local',
        label: 'On your machine',
        how: 'Your MCP client starts it with npx -y @runonflux/flux-cloud-mcp and speaks stdio.',
        credentials:
          'In the environment of that local process, FLUX_ID_PRIVATE_KEY and FLUX_PAYMENT_PRIVATE_KEY.',
        basis: 'source',
      },
      {
        id: 'hosted',
        label: 'Hosted by Flux',
        how: 'Your MCP client posts to https://mcp.runonflux.com/mcp; no sign-in is asked for.',
        credentials:
          'Nowhere on the server in its design: the two keys are arguments of each call that needs them, and read-only tools need none.',
        basis: 'live',
      },
      {
        id: 'self-hosted',
        label: 'Your own container',
        how: 'The same server as a container you run yourself, which the docs name ghcr.io/runonflux/flux-cloud-mcp.',
        credentials: 'As hosted: call arguments, plus any keys you put in that container environment.',
        basis: 'docs',
      },
    ],
    links: [
      'https://docs.runonflux.com/fluxcloud/ai-agents-mcp',
      'https://www.npmjs.com/package/@runonflux/flux-cloud-mcp',
      'https://github.com/RunOnFlux/flux-cloud-mcp',
    ],
    readOn: '2026-10-13',
    basis: 'live',
  },
  orbit: {
    id: 'orbit',
    name: 'Orbit MCP server',
    kind: 'account',
    endpoint: 'https://runonflux.com/apps/mcp',
    transport: 'Streamable HTTP, stateless',
    package: null,
    packageVersion: null,
    hostedVersion: null,
    identity: [
      'The agent acts as your signed-in Orbit account; there is no Flux key for you to paste.',
      'Orbit derives the Flux identity for the account and signs the registration for you after you sign in.',
      'The connection is short lived, so reconnect when it expires.',
      'At the time of writing a wallet-only ZelCore or SSP session cannot connect an agent; sign in with Google or email.',
      'The guide describes payment as a Stripe checkout that you complete, so the agent does not need a wallet key.',
    ],
    connections: [
      {
        id: 'account',
        label: 'Your Orbit account',
        how: 'Sign in to Orbit, open Connect an agent, and paste the generated connection config into your MCP client.',
        credentials: 'A short lived account credential in the Authorization header of each request.',
        basis: 'docs',
      },
    ],
    links: ['https://runonflux.com/apps/orbit', 'https://runonflux.com/apps/orbit/mcp-server'],
    readOn: '2026-10-13',
    basis: 'docs',
  },
};

export const MCP_SERVER_IDS: readonly McpServerId[] = ['flux-cloud', 'orbit'];

// ---------------------------------------------------------------------------
// Lookups and labels
// ---------------------------------------------------------------------------

export function toolsOf(server: McpServerId): readonly McpTool[] {
  return MCP_TOOLS.filter((t) => t.server === server);
}

export function toolByName(server: McpServerId, name: string): McpTool | undefined {
  return MCP_TOOLS.find((t) => t.server === server && t.name === name);
}

/** Risks from the least to the most serious, the order a list should read in. */
export const TOOL_RISK_ORDER: readonly ToolRisk[] = ['reads', 'keys', 'changes', 'spends', 'destroys'];

export function riskLabel(risk: ToolRisk): string {
  switch (risk) {
    case 'reads':
      return 'Reads only';
    case 'keys':
      return 'Handles keys';
    case 'changes':
      return 'Changes an app';
    case 'spends':
      return 'Spends FLUX';
    case 'destroys':
      return 'Can delete data';
  }
}

/**
 * The label for a specific tool. Same as `riskLabel` except for a tool that only starts a payment which the
 * person completes in a checkout, which does not spend FLUX from a key the agent holds.
 */
export function toolRiskLabel(tool: McpTool): string {
  if (tool.risk === 'spends' && tool.spends === 'via-checkout') return 'Starts a payment';
  return riskLabel(tool.risk);
}

/** The tools of one server grouped by risk, every risk present (possibly empty), in `TOOL_RISK_ORDER`. */
export function toolsByRisk(server: McpServerId): Record<ToolRisk, McpTool[]> {
  const out: Record<ToolRisk, McpTool[]> = { reads: [], keys: [], changes: [], spends: [], destroys: [] };
  for (const t of toolsOf(server)) out[t.risk].push(t);
  return out;
}

/** Whether the tool has a `confirm` argument (known only where the arguments are known). */
export function hasConfirmArg(tool: McpTool): boolean {
  return tool.args.some((a) => a.name === 'confirm' && a.type === 'boolean');
}

/**
 * The academy's recommendation: ask the person before any call that is not a pure read. This includes a tool
 * such as `flux_control_app` that spends nothing but can delete data, which a client that only guards
 * "spends" tools would let through (FACTS 15.1.4).
 */
export function approvalRecommended(tool: McpTool): boolean {
  return tool.risk !== 'reads';
}

/**
 * The one plain sentence a client should show before the call. Built only from `risk`, `spends`, whether the
 * arguments are known to include `confirm`, and whether the call reads private data. It contains no amounts:
 * an amount comes from the tool's own plan or quote.
 */
export function describeApproval(tool: McpTool): string {
  switch (tool.risk) {
    case 'reads':
      return tool.readsPrivateAppData
        ? 'This call only reads and spends nothing, but what it returns is private to the app owner and goes to the model.'
        : 'This call only reads and spends nothing.';
    case 'keys':
      return 'This call creates new private keys and shows them in the chat, so save them and do not reuse a wallet key from elsewhere.';
    case 'changes':
      return 'This call changes a running app but does not delete data or spend money.';
    case 'spends':
      if (tool.spends === 'with-confirm') {
        return 'This call can spend FLUX from the payment address, but only when confirm is true; without it you only get the plan.';
      }
      if (tool.spends === 'via-checkout') {
        return 'This call can register or change an app and create a payment page; the guide says you complete the payment in a checkout.';
      }
      return 'This call can spend money.';
    case 'destroys': {
      const noGate = tool.basis !== 'docs' && !hasConfirmArg(tool);
      const spend =
        tool.spends === 'with-confirm' ? ', and it spends a small amount of FLUX when confirm is true' : '';
      const gate = noGate
        ? ', and it has no confirm step of its own, so only your client stands between the agent and the call'
        : '';
      return `This call can end an app or delete its data${spend}${gate}.`;
    }
  }
}
