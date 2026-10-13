/**
 * Glossary, part 4: AI agents, MCP and Git deploys (14 terms).
 *
 * The other files are `core.ts`, `ops.ts`, `docker.ts` and the two extras. Term ids are the canonical ones
 * that the lessons `deploy-from-git`, `ai-assisted-deploy` and `agents-and-mcp`, the lab `agent-desk` and
 * the reference topics link with `{{term:id}}`; they are permanent. `flux-orbit` itself stays in `ops.ts`.
 *
 * Every definition restates FACTS.md (section 12 seeds 61 to 74, rewritten to the length limits, and the
 * section 15 rows each seed points at) and carries a `// fact:` tag. What FACTS marks DOCS-ONLY (a vendor
 * page, a docs page, a UI string) is attributed ("the page says", "the docs say"). What it marks UNVERIFIED
 * is phrased as guidance or left out: what Nixpacks does inside the image, whether a preview deployment is
 * billed as a second app, which health-check timing is right, and whether prompt injection has been seen
 * against these tools (no incident observed, 15.1.15).
 *
 * Names: FluxCloud is one word. "The FluxCloud MCP server" is the npm package `@runonflux/flux-cloud-mcp`,
 * hosted or local; "the Orbit MCP server" is Orbit's own. They are two servers with two identity models and
 * are never blurred. The assistant in FluxCloud and an outside agent are two different things (15.2).
 *
 * Nothing here states a plan price (they live in `shared/flux/orbit.ts` and the reference page) or names or
 * links the host of the new FluxCloud console front end (FACTS 15.2.13 item 12).
 *
 * This module imports nothing at run time from `@shared/flux`, on purpose. The glossary is statically
 * imported by almost every route, and the agents and orbit catalogues (about 26 KB of data) would travel
 * with it. So what an entry says about the engine is typed here as a plain literal: the tool names and which
 * of them carry `confirm`, the kinds of tool call, the button's URL parameters, the plan ids and the webhook
 * port. The guarantee that no definition can disagree with the engine lives in the unit test
 * `src/content/glossary-agents.test.ts`. It reads the text these entries produce and checks each of those
 * against `MCP_TOOLS`, `riskLabel`, `deployToFluxUrl`, `ORBIT_PLAN_IDS` and `ORBIT_WEBHOOK_PORT`, and it
 * fails if a glossary file imports the `@shared/flux` barrel, `agents` or `orbit` again.
 *
 * That test sits one level up, not beside this file: the registry (`learn/glossary.ts`) globs
 * `content/glossary/*.ts`, and a `.test.ts` in this folder would be bundled into the app.
 */

import type { GlossaryTerm } from '@/learn/types';

const code = (s: string): string => `\`${s}\``;

/**
 * What a tool call can be, in the engine's words and order: `riskLabel` of each class in `TOOL_RISK_ORDER`,
 * lower-cased and joined with "or". FACTS 15.1.4 (which tool is which kind). Checked by the test.
 */
const CALL_KINDS = 'reads only, handles keys, changes an app, spends FLUX or can delete data';

/**
 * The query parameters of a Deploy to Flux URL, in the order `deployToFluxUrl` writes them. FACTS 15.3.12.
 * Checked by the test.
 */
const REPO_PARAM = 'repo';
const BRANCH_PARAM = 'branch';
const PROJECT_PATH_PARAM = 'projectPath';
const PLAN_PARAM = 'plan';
/** The values of `plan`, as `ORBIT_PLAN_IDS` lists them. FACTS 15.3.12. Checked by the test. */
const PLAN_VALUES = '`starter`, `standard` or `pro`';
/** The container port of the webhook and status listener: `ORBIT_WEBHOOK_PORT`. FACTS 9.8.2. Checked by the test. */
const WEBHOOK_PORT = 9001;

const DOCS_MCP = 'https://docs.runonflux.com/fluxcloud/ai-agents-mcp/';
const DOCS_GIT = 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-git';

const terms: GlossaryTerm[] = [
  // ---- AI agents and MCP --------------------------------------------------------------------------------
  {
    id: 'mcp',
    term: 'MCP',
    proper: true,
    aka: ['Model Context Protocol'],
    short:
      "The Model Context Protocol, a standard way for an {{term:ai-agent}} to list a service's tools and make a {{term:tool-call}} to one by name.",
    why: 'The docs name Claude, ChatGPT, Cursor, Windsurf and OpenCode as clients. MCP only carries the calls: the network sees the same version 8 spec, signed message and payment as for a deploy from {{term:fluxcloud}}.',
    // fact: FACTS 12 seed 61, 15.1.1 (what the server is: a client of the public API, nothing in the network changes because an agent deploys), 15.1.2 (the hosts), 9.12 (the docs list the clients)
    category: 'ops',
    related: ['mcp-server', 'ai-agent', 'tool-call'],
    lessons: ['agents-and-mcp'],
    docs: DOCS_MCP,
  },
  {
    id: 'mcp-server',
    term: 'MCP server',
    proper: true,
    aka: ['MCP servers', 'FluxCloud MCP server', 'Orbit MCP server', '@runonflux/flux-cloud-mcp'],
    short:
      'A service that offers tools to an AI program over {{term:mcp}}. Flux has two, the FluxCloud MCP server and the Orbit MCP server, and they differ.',
    why: `The FluxCloud server, npm package ${code('@runonflux/flux-cloud-mcp')}, works with two keys and can pay in FLUX. The Orbit server, per its guide, uses your Orbit account and sends you to a Stripe checkout. Do not apply one's rules to the other.`,
    // fact: FACTS 12 seed 62, 15.1.1 and 15.1.3 (FluxCloud server: package, two keys, no account), 15.1.5 (it pays only on confirm), 15.4.2 and 15.4.7 (Orbit server: signed-in account, Stripe checkout), 15.4.8 (the contrast table)
    category: 'ops',
    related: ['mcp', 'ai-agent', 'tool-call', 'confirm-gate', 'flux-orbit'],
    lessons: ['agents-and-mcp'],
    docs: DOCS_MCP,
  },
  {
    id: 'ai-agent',
    term: 'AI agent',
    proper: true,
    aka: ['agent', 'AI agents', 'MCP client'],
    short:
      'An AI program outside {{term:fluxcloud}}, such as Claude, Cursor, Windsurf, ChatGPT or OpenCode, that acts by calling tools over {{term:mcp}} instead of only answering questions.',
    why: 'Unlike the {{term:ai-assistant}} in FluxCloud, it can sign and pay when its tools and keys allow it. It changes who types the spec, not what the network does: give it a {{term:confirm-gate}} and a small balance.',
    // fact: FACTS 12 seed 63, 15.1.5 (what an agent can do and what stops it), 15.2.2 and 15.2.3 (the assistant cannot deploy or pay), 15.2.13 item 1, 15.1.15 (dedicated payment address, fund only what a deployment needs)
    category: 'ops',
    related: ['ai-assistant', 'mcp-server', 'tool-call', 'confirm-gate', 'prompt-injection'],
    lessons: ['ai-assisted-deploy', 'agents-and-mcp'],
    docs: DOCS_MCP,
  },
  {
    id: 'ai-assistant',
    term: 'AI assistant',
    proper: true,
    aka: ['assistant', 'FluxCloud assistant'],
    short:
      'The assistant in {{term:fluxcloud}}. It drafts a deployment, looks things up and fills in the deploy form. Unlike an {{term:ai-agent}}, it cannot sign, pay or deploy.',
    why: 'It proposes and you decide: read its draft like any spec, check the price and every environment variable against the image, then sign and pay yourself. Nothing is registered until you sign.',
    // fact: FACTS 12 seed 64, 15.2.2 (its tool list: no deploy, sign, pay, cancel, control or key tool), 15.2.3 (ui_prefill_deploy fills the form, you sign and pay; the card tells you to check the environment variables)
    category: 'ops',
    related: ['ai-agent', 'fluxcloud', 'app-spec', 'price-quote'],
    lessons: ['ai-assisted-deploy'],
  },
  {
    id: 'tool-call',
    term: 'Tool call',
    aka: ['tool use', 'MCP call'],
    short: `One request from an {{term:ai-agent}} to a named tool with arguments, such as ${code('flux_quote_app')} with a spec. The tool returns a result.`,
    why: `It is the unit you approve or refuse. Depending on the tool, a call ${CALL_KINDS}. Read the tool name and its arguments before you allow it.`,
    // fact: FACTS 12 seed 65, 15.1.4 (the 15 tools, which spend and which destroy), 15.1.15 (keep approvals on); the kinds are riskLabel in shared/flux/agents.ts (the test compares)
    category: 'ops',
    related: ['mcp', 'ai-agent', 'confirm-gate', 'prompt-injection'],
    lessons: ['agents-and-mcp'],
    docs: DOCS_MCP,
  },
  {
    id: 'confirm-gate',
    term: 'Confirm gate',
    aka: ['plan then confirm', 'confirm flag'],
    short: `A plan-then-confirm step. On the FluxCloud {{term:mcp-server}}, ${code('flux_deploy_app')} and ${code('flux_cancel_app')} return only a plan until a call sets ${code('confirm')} to true, which signs and pays.`,
    why: `The agent sets ${code('confirm')}, not you, and the server cannot tell whether a person agreed. The real gate is your client's approval policy, so keep approval on for both tools and for ${code('flux_control_app')}, which has no plan step.`,
    // fact: FACTS 12 seed 66, 15.1.5 (confirm defaults to false; it is a flag the agent sets, not a user prompt), 15.1.4 and 15.1.9 (flux_control_app has no plan step), 15.1.15 (no spending cap, keep approvals on); the test checks that the first two carry a confirm argument and the third does not
    category: 'ops',
    related: ['tool-call', 'ai-agent', 'prompt-injection', 'mcp-server'],
    lessons: ['agents-and-mcp'],
    docs: DOCS_MCP,
  },
  {
    id: 'prompt-injection',
    term: 'Prompt injection',
    aka: ['injection', 'poisoned log'],
    short:
      'Text in a page, README or log that tells an {{term:ai-agent}} to do something its user did not ask for, such as deploying or cancelling.',
    why: 'Treat tool results as data, not instructions. A page, a README or a container log can carry such text, and the FluxCloud server returns logs as the app printed them. Keep approval on for deploy, cancel and control.',
    // fact: FACTS 12 seed 67, 15.1.15 (the route is real; the attack as such is UNVERIFIED, no incident observed, so it is phrased as can), 15.1.10 and 15.2.5 (logs are returned raw, unfiltered)
    category: 'ops',
    related: ['ai-agent', 'tool-call', 'confirm-gate'],
    lessons: ['agents-and-mcp'],
  },

  // ---- Git deploys --------------------------------------------------------------------------------------
  {
    id: 'git-deploy',
    term: 'Git deploy',
    proper: true,
    aka: ['Deploy with Git', 'deploy from Git', 'push to deploy'],
    short:
      'Deploying by pointing a service at a Git repository. It clones the code, builds it and registers an ordinary Flux app. The product for this is {{term:flux-orbit}}.',
    why: 'The result is an ordinary spec, priced by the same formula as any other app. Treat the app as stateless: the docs say persistent data belongs outside the container.',
    // fact: FACTS 12 seed 69, 15.3.1 (an ordinary Flux app; the build runs inside the Orbit image on the node), 15.3.13 and 9.8.2 (stateless by design, persistent data outside the container)
    category: 'ops',
    related: ['flux-orbit', 'webhook', 'rollback', 'monorepo', 'deploy-button'],
    lessons: ['deploy-from-git'],
    docs: `${DOCS_GIT}/introduction/`,
  },
  {
    id: 'nixpacks',
    term: 'Nixpacks',
    proper: true,
    short:
      'The tool the {{term:flux-orbit}} product page names for detecting your framework, build command and start command. Its docs describe their own file-based detection and never name it.',
    why: "Treat it as the page's claim: nothing in a registered spec shows which detection runs. If detection picks the wrong command, set `BUILD_COMMAND` or `RUN_COMMAND` yourself.",
    // fact: FACTS 12 seed 68, 9.8.1 ("Nixpacks" is the page's word), 15.3.4 (detect, build and start rows; the two descriptions are not reconciled, UNVERIFIED), 15.3.16 (phrase as "the page says")
    category: 'docker',
    related: ['flux-orbit', 'git-deploy', 'image'],
    lessons: ['deploy-from-git'],
  },
  {
    id: 'webhook',
    term: 'Webhook',
    aka: ['webhooks'],
    short:
      "A call from GitHub, GitLab or Bitbucket to the app's webhook port when you push, telling {{term:flux-orbit}} to rebuild. Polling is the fallback.",
    why: `A push reaches Orbit only if the provider can reach the webhook port (${WEBHOOK_PORT} by default) and any secret you set matches; the docs say a failed check returns 401. Without a webhook, set a polling interval.`,
    // fact: FACTS 12 seed 70, 15.3.5 (webhook, secret, 401, polling; docs, DOCS-ONLY), 9.8.2 (port and WEBHOOK_PORT), 15.3.4 (the webhook port is a second public port); the test compares the port with ORBIT_WEBHOOK_PORT
    category: 'ops',
    related: ['git-deploy', 'flux-orbit', 'rollback', 'preview-deploy'],
    lessons: ['deploy-from-git'],
    docs: `${DOCS_GIT}/ci-cd/github-webhooks/`,
  },
  {
    id: 'preview-deploy',
    term: 'Preview deployment',
    aka: ['PR preview', 'deploy preview', 'pull request preview'],
    short:
      'A temporary deployment of a branch or pull request, which the {{term:flux-orbit}} page lists as a feature. The docs describe it for static sites only.',
    why: 'Do not count on one for a server app. How a preview is billed is not documented, so check the cost before you rely on it.',
    // fact: FACTS 12 seed 71, 15.3.5 (previews row: page lists it, docs say static sites only, billing not stated, UNVERIFIED), 9.8.2 (PR previews row)
    category: 'ops',
    related: ['git-deploy', 'webhook', 'flux-orbit'],
    lessons: ['deploy-from-git'],
    docs: `${DOCS_GIT}/guides/pr-preview-deployments/`,
  },
  {
    id: 'rollback',
    term: 'Rollback',
    aka: ['roll back', 'auto rollback', 'automatic rollback'],
    short:
      '{{term:flux-orbit}} says a failed build never replaces a working deployment: the last known-good release stays live. Its docs say it keeps the last 3 releases.',
    why: 'It guards against a bad commit, not a lost node: a single-instance app is down while its node is down. Failed builds, failed pre-deploy scripts, failed health checks and timeouts trigger it, the docs say.',
    // fact: FACTS 12 seed 72, 15.3.7 (automatic triggers; what rollback is not), 15.3.4 (release layout: last 3 releases), 6.5 (a single instance is down while its node is)
    category: 'ops',
    related: ['git-deploy', 'webhook', 'failover', 'instance'],
    lessons: ['deploy-from-git'],
    docs: `${DOCS_GIT}/hooks/deployment-hooks/`,
  },
  {
    id: 'monorepo',
    term: 'Monorepo',
    aka: ['mono repo', 'PROJECT_PATH', PROJECT_PATH_PARAM],
    short: `One repository that holds several projects. In {{term:flux-orbit}}, ${code('PROJECT_PATH')} names the folder to build; the {{term:deploy-button}} calls it ${code(PROJECT_PATH_PARAM)}.`,
    why: 'One path selects one folder, so each service in the repository is deployed as its own Orbit app, with its own path, plan and price.',
    // fact: FACTS 12 seed 73, 9.8.1 (PROJECT_PATH selects the subfolder), 15.3.6 (variable table), 15.3.12 (the button's projectPath)
    category: 'ops',
    related: ['git-deploy', 'deploy-button', 'flux-orbit'],
    lessons: ['deploy-from-git'],
    docs: `${DOCS_GIT}/configuration/environment-reference/`,
  },
  {
    id: 'deploy-button',
    term: 'Deploy to Flux button',
    proper: true,
    aka: ['Deploy button', 'Deploy to Flux', 'README button'],
    short: `A README button that opens the {{term:flux-orbit}} wizard with ${code(REPO_PARAM)}, ${code(BRANCH_PARAM)}, ${code(PROJECT_PATH_PARAM)} and ${code(PLAN_PARAM)} filled in. It does not deploy on its own.`,
    why: `Only ${code(REPO_PARAM)} is required, and ${code(PLAN_PARAM)} is ${PLAN_VALUES}; custom sizes are set in the dashboard afterwards. A private repository's token is entered in Orbit, never in this URL.`,
    // fact: FACTS 12 seed 74, 15.3.12 (URL, parameters, plan values, what it does), 15.3.9 (private repositories take a token entered in Orbit); the test compares the parameter names with deployToFluxUrl and the plan values with ORBIT_PLAN_IDS
    category: 'ops',
    related: ['flux-orbit', 'git-deploy', 'monorepo'],
    lessons: ['deploy-from-git'],
    docs: 'https://runonflux.com/apps/orbit/deploy-to-flux',
  },
];

export default terms;
