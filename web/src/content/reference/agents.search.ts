/**
 * The search records of /reference/agents.
 *
 * The page body and the tool catalogue it reads (`agents.ts`, `@shared/flux`) load as a separate chunk, so
 * the landing page and the command deck do not pay for them. This file is the small part that stays in the
 * index: each record is where a thing sits, its title and one plain line. It holds no number that the engine
 * owns. `agents.test.ts` checks that every tool has a record (and no record names a tool that is gone), that
 * a record of an unverified statement carries the same labels as its row, and `page.test.tsx` that every
 * anchor is an element of the rendered page.
 *
 * Sources: FACTS 15.1.4 (the FluxCloud tools), 15.4.3 (the Orbit tools), 15.1.16 (the gaps).
 */

import { anchor } from './anchors';
import type { SearchSeed } from './types';

type Seed = Omit<SearchSeed, 'topic'>;

const fact = (section: string, row: string): string => anchor.fact(section, row);

/**
 * The FluxCloud MCP server, in the order the server lists its tools. Each line is the catalogue's own
 * summary (`MCP_TOOLS` in `@shared/flux`), copied. This module is in the static index, so it must not
 * import the catalogue: that would load it on every reference page and count against the route's script
 * budget. `agents.test.ts` fails when a line and its summary differ.
 */
export const FLUX_CLOUD_TOOL_LINES: readonly (readonly [name: string, line: string])[] = [
  [
    'flux_get_identity',
    'Shows the Flux ID, the payment address and its spendable FLUX balance, or says which key is missing.',
  ],
  [
    'flux_generate_keys',
    'Creates a fresh Flux ID key and a fresh payment key and returns both private keys.',
  ],
  [
    'flux_get_pricing',
    'Returns the USD rate card, the FLUX price and a few example sizes priced by a local estimator.',
  ],
  [
    'flux_build_spec',
    'Turns a plain description (images, ports, sizes, term) into a full version 8 specification, locally.',
  ],
  [
    'flux_validate_spec',
    'Checks a specification locally and asks a FluxOS node to verify it as at registration, without registering.',
  ],
  ['flux_quote_app', 'Returns the network USD price and the FLUX to pay for a registration or an update.'],
  [
    'flux_deploy_app',
    'Plans a registration or update and, only with confirm set to true, signs it, broadcasts it and pays the FLUX.',
  ],
  [
    'flux_wait_for_app',
    'Polls the network until the app is published and its instances are located, or the timeout ends.',
  ],
  ['flux_get_app', 'Looks up any app by name: its published spec, expiry, running nodes and addresses.'],
  ['flux_list_my_apps', 'Lists the apps owned by a Flux ID with instances running and time left.'],
  [
    'flux_get_app_logs',
    'Returns the last lines of a container log from one running node, for the app owner.',
  ],
  [
    'flux_get_app_stats',
    'Returns live CPU, memory and network use of an app container on one node, for the app owner.',
  ],
  ['flux_control_app', 'Restarts, redeploys or removes the app containers on one node or on every node.'],
  [
    'flux_cancel_app',
    'Ends an app early by shortening its term, after which the nodes remove it everywhere.',
  ],
  [
    'flux_get_network_info',
    'Returns node counts by tier, the block height, the FLUX price and the deployment payment address.',
  ],
];

/** The Orbit MCP server, in the order of the guide's table. Copied from the catalogue like the lines above. */
export const ORBIT_TOOL_LINES: readonly (readonly [name: string, line: string])[] = [
  ['list_plans', 'Lists the Orbit plans so an agent can compare them.'],
  [
    'analyze_repository',
    "Inspects a Git repository against Orbit's compatibility rules and reports the detected runtime, port, branch and project directory.",
  ],
  ['list_apps', "Lists the Orbit apps owned by the signed-in account's Flux identity."],
  ['get_app', "Returns one owned app's specification with secrets removed."],
  ['get_instances', 'Lists the nodes assigned to an owned app.'],
  ['get_deployment_status', 'Reports where a deployment is: its registration state and live locations.'],
  ['get_network_capacity', 'Checks whether there is suitable Flux capacity.'],
  [
    'validate_deployment',
    'Builds the app specification and its authoritative network price without registering anything.',
  ],
  [
    'deploy_app',
    'Registers the approved app on the network and tests the installation; returns a Flux transaction id.',
  ],
  [
    'create_stripe_checkout',
    'Creates a Stripe checkout for an owned Flux transaction at the server-calculated price.',
  ],
  ['get_logs', "Reads a bounded tail of an owned app's log."],
  ['trigger_build', 'Requests a new Orbit build of an owned app.'],
  [
    'control_instance',
    'Performs one allowed action (start, stop, restart, pause, unpause, redeploy or remove) on one node assigned to an owned app.',
  ],
  [
    'update_app',
    "Applies constrained changes to an owned app's settings, keeping the remaining subscription period.",
  ],
  ['renew_app', "Extends an owned app's subscription by an approved duration."],
];

const POLICIES: readonly Seed[] = [
  {
    anchor: anchor.policy('ask-all'),
    section: 'policies',
    kind: 'fact',
    title: 'Ask all policy',
    summary: 'Every call that is not a read waits for you. Reads run. Nothing else is let through.',
    keywords: ['approval', 'client', 'permission'],
  },
  {
    anchor: anchor.policy('ask-spends'),
    section: 'policies',
    kind: 'fact',
    title: 'Ask spends policy',
    summary: 'Asks only before a tool that can spend. Key, change and delete tools run unasked.',
    keywords: ['approval', 'client', 'permission'],
  },
  {
    anchor: anchor.policy('allow-all'),
    section: 'policies',
    kind: 'fact',
    title: 'Allow all policy',
    summary: 'Nothing waits for you and every call runs, including the ones that delete data.',
    keywords: ['approval', 'client', 'permission', 'auto approve'],
  },
];

const GAPS: readonly Seed[] = [
  {
    anchor: anchor.gap('g-discount'),
    section: 'known-gaps',
    kind: 'fact',
    title: 'The g: storage discount does not exist',
    summary:
      'The guide and the estimator take a discount off primary and standby storage. The network gives none.',
    keywords: ['guide', 'discount', 'pricing'],
  },
  {
    anchor: anchor.gap('estimator'),
    section: 'known-gaps',
    kind: 'fact',
    title: 'flux_get_pricing examples are an estimate',
    summary: 'The example sizes come from a local estimator that differs from the network quote.',
    keywords: ['guide', 'estimate', 'quote', 'pricing'],
  },
  {
    anchor: anchor.gap('persist-prefix'),
    section: 'known-gaps',
    kind: 'fact',
    title: 'Persisted paths do not have to be r:',
    summary: 'The builder makes every data path r:, which is wrong for a database with one writer.',
    keywords: ['guide', 'replicate', 'storage'],
  },
  {
    anchor: anchor.gap('component-names'),
    section: 'known-gaps',
    kind: 'fact',
    title: 'Component names allow no hyphen',
    summary: 'A hyphenated app name gives a component name the node rejects. Set the name yourself.',
    keywords: ['guide', 'validate', 'naming'],
  },
  {
    anchor: anchor.gap('api-token'),
    section: 'known-gaps',
    kind: 'fact',
    title: 'An API token with a daily limit',
    summary: 'Console copy mentions one. The server accepts two keys and no token.',
    keywords: ['console', 'token', 'limit'],
  },
  {
    anchor: anchor.gap('balance'),
    section: 'known-gaps',
    kind: 'fact',
    title: 'A balance, a daily rate and a grace period',
    summary:
      'Console copy describes them. The network has no balance for apps: a term is prepaid in blocks. The page also describes a Flux Edge balance for GPU rentals.',
    keywords: ['console', 'billing', 'balance', 'grace'],
  },
];

const sourceUnverified = ['source', 'unverified'] as const;
const docsUnverified = ['docs', 'unverified'] as const;
const sourceDocsUnverified = ['source', 'docs', 'unverified'] as const;

/**
 * The statements the page marks Unverified. Each has the same anchor and the same labels as its row in
 * `agents.ts`, which is what puts it in the page's own list of unverified statements.
 */
const UNVERIFIED: readonly Seed[] = [
  {
    anchor: fact('connecting', 'sign-in-route'),
    section: 'connecting',
    kind: 'fact',
    title: 'How long an Orbit connection lasts',
    summary: 'The guide says short lived with no refresh. The sign in challenge advertises refresh tokens.',
    prov: docsUnverified,
  },
  {
    anchor: fact('tools-orbit', 'arguments'),
    section: 'tools-orbit',
    kind: 'fact',
    title: 'Arguments of the Orbit tools',
    summary:
      'Argument names need an account to read, so none are listed here, nor what the status and checkout tools take.',
    prov: docsUnverified,
  },
  {
    anchor: fact('tools-orbit', 'annotations'),
    section: 'tools-orbit',
    kind: 'fact',
    title: 'Whether Orbit marks mutating tools',
    summary: 'The guide says it marks them as destructive or not read only. It was not read from the wire.',
    prov: docsUnverified,
  },
  {
    anchor: fact('hosted-or-local', 'vendor-claims'),
    section: 'hosted-or-local',
    kind: 'fact',
    title: 'The hosted server stores nothing',
    summary:
      'That is the vendor statement. Whether the deployed instance logs call arguments cannot be checked.',
    prov: docsUnverified,
  },
  {
    anchor: fact('hosted-or-local', 'own-container'),
    section: 'hosted-or-local',
    kind: 'fact',
    title: 'The image for your own container',
    summary: 'The docs name a GitHub registry image. Its existence and age were not confirmed.',
    prov: docsUnverified,
  },
  {
    anchor: fact('what-spends', 'cancel-cost'),
    section: 'what-spends',
    kind: 'fact',
    title: 'What a cancel costs',
    summary: 'Worked out from node source and the calculator. A cancel was not run on a real app.',
    prov: sourceUnverified,
  },
  {
    anchor: fact('what-spends', 'logs'),
    section: 'what-spends',
    kind: 'fact',
    title: 'Whether Orbit redaction covers what the app prints',
    summary: 'Known secrets are redacted. Text the app prints itself may not be. That limit is an inference.',
    prov: sourceDocsUnverified,
  },
  {
    anchor: fact('what-spends', 'injection'),
    section: 'what-spends',
    kind: 'fact',
    title: 'Prompt injection through what an agent reads',
    summary:
      'Text an agent reads can ask for a deploy or a cancel. No incident was observed. Treat it as guidance.',
    prov: sourceUnverified,
  },
  {
    anchor: fact('console-assistant', 'retention'),
    section: 'console-assistant',
    kind: 'fact',
    title: 'What the assistant keeps',
    summary:
      'The console says conversations help improve the model. Retention and hosting were not confirmed.',
    prov: docsUnverified,
  },
];

/** Every search record of the page, in page order. */
export const AGENTS_SEEDS: readonly SearchSeed[] = [
  ...FLUX_CLOUD_TOOL_LINES.map(
    ([name, line]): Seed => ({
      anchor: anchor.tool('flux-cloud', name),
      section: 'tools-flux-cloud',
      kind: 'tool',
      title: name,
      summary: line,
      keywords: ['flux cloud mcp', 'mcp tool', 'agent'],
    }),
  ),
  ...ORBIT_TOOL_LINES.map(
    ([name, line]): Seed => ({
      anchor: anchor.tool('orbit', name),
      section: 'tools-orbit',
      kind: 'tool',
      title: name,
      summary: line,
      keywords: ['orbit mcp', 'mcp tool', 'agent'],
    }),
  ),
  ...POLICIES,
  ...GAPS,
  ...UNVERIFIED,
].map((s) => ({ ...s, topic: 'agents' as const }));
