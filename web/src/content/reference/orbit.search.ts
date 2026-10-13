/**
 * The search records of /reference/orbit.
 *
 * The page body and the Orbit catalogue it reads (`orbit.ts`, `@shared/flux`) load as a separate chunk, so the
 * landing page and the command deck do not pay for them. This file is the small part that stays in the
 * index: each record is where a thing sits, its title and one plain line. It holds no number that the engine
 * owns. `orbit.test.ts` checks that every build variable and plan has a record, that every record of an
 * unverified statement has the same labels as the row it points at, and `page.test.tsx` that every anchor is
 * an element of the rendered page.
 *
 * Sources: FACTS 15.3 (every row), 15.4.9 (the unknowns).
 */

import { anchor } from './anchors';
import type { SearchSeed } from './types';

type Seed = Omit<SearchSeed, 'topic'>;

const fact = (section: string, row: string): string => anchor.fact(section, row);

/** One line per build variable of the Orbit image, in the engine's order. FACTS 15.3.6.1. */
export const ORBIT_VARIABLE_LINES: readonly (readonly [name: string, line: string])[] = [
  ['GIT_REPO_URL', 'The repository to build and run, as an https URL. Required.'],
  ['APP_PORT', 'The port the app listens on inside the container. Required.'],
  ['GIT_BRANCH', 'The branch to deploy. The default is main.'],
  ['GIT_TOKEN', 'Access token for a private repository. A secret.'],
  ['PROJECT_PATH', 'The monorepo folder that holds the app.'],
  ['PROJECT_TYPE', 'Force the runtime instead of detecting it.'],
  ['BUILD_COMMAND', 'Replace the detected build command.'],
  ['RUN_COMMAND', 'Replace the detected start command.'],
  ['INSTALL_COMMAND', 'Replace the install step.'],
  ['NODE_VERSION', 'The Node.js version. It wins over .nvmrc and package.json.'],
  ['PYTHON_VERSION', 'The Python version.'],
  ['RUBY_VERSION', 'The Ruby version.'],
  ['GO_VERSION', 'The Go version.'],
  ['JAVA_VERSION', 'The Java version.'],
  ['DOTNET_VERSION', 'The .NET SDK version.'],
  ['BUN_VERSION', 'The Bun version.'],
  ['RUST_VERSION', 'The Rust channel or version.'],
  ['PHP_VERSION', 'The PHP version.'],
  ['PHP_EXTENSIONS', 'Extra PHP extensions on top of a default set.'],
  ['CGO_ENABLED', 'Go only: allow C libraries or build a static binary.'],
  ['NODE_OPTIONS', 'Node flags. The heap follows the container RAM.'],
  ['JAVA_OPTS', 'JVM flags. The heap follows the container RAM.'],
  ['ASPNETCORE_ENVIRONMENT', 'The ASP.NET Core environment name.'],
  ['WEBHOOK_SECRET', 'The secret that signs and checks webhooks. A secret.'],
  ['WEBHOOK_SIGNATURE_VERIFY', 'Turn on signature checking for webhooks.'],
  ['API_KEY', 'A bearer key for the status and log endpoints. A secret.'],
  ['POLLING_INTERVAL', 'Seconds between repository checks. Zero turns polling off.'],
  ['HEALTH_CHECK_RETRIES', 'Health check attempts before a deploy counts as failed.'],
  ['HEALTH_CHECK_DELAY', 'Seconds between health check attempts.'],
  ['SKIP_HEALTH_CHECK', 'Skip the health check. For testing only.'],
  ['DEPLOYMENT_TIMEOUT', 'Seconds a deployment may take before it rolls back.'],
  ['FORCE_INSTALL', 'Reinstall dependencies and ignore the lock file cache.'],
  ['SKIP_HOOKS', 'Do not run the hook scripts this time.'],
  ['HOOK_TIMEOUT', 'Seconds a hook script may run.'],
  ['WEBHOOK_PORT', 'The port of the webhook and status listener.'],
  ['DEBOUNCE_DELAY', 'Seconds to wait and collapse pushes into one deploy.'],
];

/** The plan rows. The sizes and prices are in the engine; these lines carry none. FACTS 15.3.10, 15.3.11. */
const PLANS: readonly Seed[] = [
  {
    anchor: anchor.plan('starter'),
    section: 'plans',
    kind: 'fact',
    title: 'Starter plan',
    summary: 'The smallest plan: one instance, no persistent folders and no second port.',
    keywords: ['orbit plan', 'single instance', 'cheapest'],
  },
  {
    anchor: anchor.plan('standard'),
    section: 'plans',
    kind: 'fact',
    title: 'Standard plan',
    summary: 'Two instances with failover, persistent folders and a second port.',
    keywords: ['orbit plan', 'failover', 'recommended'],
  },
  {
    anchor: anchor.plan('pro'),
    section: 'plans',
    kind: 'fact',
    title: 'Pro plan',
    summary: 'Two instances with failover and the most resources of the three plans.',
    keywords: ['orbit plan', 'failover'],
  },
];

/** The four parameters of the button link. FACTS 15.3.12. */
const BUTTON_PARAMS: readonly Seed[] = [
  {
    anchor: anchor.buttonParam('repo'),
    section: 'deploy-button-anatomy',
    kind: 'field',
    title: 'repo parameter',
    summary: 'The repository, a full https URL with no credentials. The only required parameter.',
    keywords: ['deploy to flux', 'button', 'url'],
  },
  {
    anchor: anchor.buttonParam('branch'),
    section: 'deploy-button-anatomy',
    kind: 'field',
    title: 'branch parameter',
    summary:
      'The branch to deploy. Optional; when it is left out the page says the repository default is used.',
    keywords: ['deploy to flux', 'button', 'url'],
  },
  {
    anchor: anchor.buttonParam('projectPath'),
    section: 'deploy-button-anatomy',
    kind: 'field',
    title: 'projectPath parameter',
    summary: 'A folder inside the repository, for a monorepo. Optional.',
    keywords: ['deploy to flux', 'button', 'url', 'monorepo'],
  },
  {
    anchor: anchor.buttonParam('plan'),
    section: 'deploy-button-anatomy',
    kind: 'field',
    title: 'plan parameter',
    summary: 'Starter, standard or pro. Optional. A custom size is set in the dashboard.',
    keywords: ['deploy to flux', 'button', 'url'],
  },
];

const unverified = ['unverified'] as const;
const docsUnverified = ['docs', 'unverified'] as const;
const docsSourceUnverified = ['docs', 'source', 'unverified'] as const;

/**
 * The statements the page marks Unverified. Each has the same anchor and the same labels as its row in
 * `orbit.ts`, which is what puts it in the page's own list of unverified statements.
 */
const UNVERIFIED: readonly Seed[] = [
  {
    anchor: fact('not-published', 'argument-names'),
    section: 'not-published',
    kind: 'fact',
    title: 'Argument names of the Orbit MCP tools',
    summary: 'The guide names the tools and what they do. The arguments and results need an account.',
    prov: docsUnverified,
  },
  {
    anchor: fact('not-published', 'key-custody'),
    section: 'not-published',
    kind: 'fact',
    title: 'Who holds the key behind an Orbit app',
    summary: 'Orbit signs the registration after you sign in. Who holds the private key is not stated.',
    prov: docsUnverified,
  },
  {
    anchor: fact('not-published', 'encryption-fee'),
    section: 'not-published',
    kind: 'fact',
    title: 'How plan prices absorb the encryption fee',
    summary: 'The page says the fee is in the checkout price. The engine prices a private app higher.',
    prov: docsUnverified,
  },
  {
    anchor: fact('not-published', 'custom-price'),
    section: 'not-published',
    kind: 'fact',
    title: 'A price for a custom size',
    summary:
      'The page gives a starting price and ranges only. Use the engine and say it is the network price.',
    prov: docsUnverified,
  },
  {
    anchor: fact('not-published', 'preview-billing'),
    section: 'not-published',
    kind: 'fact',
    title: 'How preview deployments are billed',
    summary: 'The page lists them. Whether a preview is a second app, and what it costs, is not stated.',
    prov: docsUnverified,
  },
  {
    anchor: fact('not-published', 'detection'),
    section: 'not-published',
    kind: 'fact',
    title: 'Whether Nixpacks does the detection',
    summary: 'The product page names it. The docs describe their own detection and never mention it.',
    prov: docsUnverified,
  },
  {
    anchor: fact('not-published', 'health-figures'),
    section: 'not-published',
    kind: 'fact',
    title: 'The health check timing',
    summary: 'The environment reference and the hooks page give two different figures.',
    prov: docsUnverified,
  },
  {
    anchor: fact('not-published', 'sign-in-route'),
    section: 'not-published',
    kind: 'fact',
    title: 'The sign in route of the Orbit MCP server',
    summary:
      'The guide and the live sign in challenge describe different routes. Which is current is unknown.',
    prov: docsUnverified,
  },
  {
    anchor: fact('not-published', 'runtime-hints'),
    section: 'not-published',
    kind: 'fact',
    title: 'What ORBIT_RUNTIME and ORBIT_RUNTIME_VERSION do',
    summary: 'They appear in live specs and in no docs page. Their meaning is not confirmed.',
    prov: unverified,
  },
  {
    anchor: fact('not-published', 'private-apps'),
    section: 'not-published',
    kind: 'fact',
    title: 'Which encrypted apps are Orbit apps',
    summary: 'A private repository is deployed encrypted, so nothing in its public spec says it is Orbit.',
    prov: docsUnverified,
  },
  {
    anchor: fact('not-published', 'config-file'),
    section: 'not-published',
    kind: 'fact',
    title: 'A repository configuration file',
    summary: 'None was found beyond the two hook scripts and the health check file.',
    prov: unverified,
  },
  {
    anchor: fact('webhooks', 'address'),
    section: 'webhooks',
    kind: 'fact',
    title: 'The webhook address spelling',
    summary: 'The docs spell it with a hyphen. The domain manager source generates an underscore form.',
    keywords: ['webhook url', 'payload url'],
    prov: docsSourceUnverified,
  },
];

/** Every search record of the page, in page order. */
export const ORBIT_SEEDS: readonly SearchSeed[] = [
  ...PLANS,
  ...ORBIT_VARIABLE_LINES.map(
    ([name, line]): Seed => ({
      anchor: anchor.variable(name),
      section: 'build-variables',
      kind: 'field',
      title: name,
      summary: line,
      keywords: ['orbit variable', 'environment variable', 'build'],
    }),
  ),
  ...BUTTON_PARAMS,
  ...UNVERIFIED,
].map((s) => ({ ...s, topic: 'orbit' as const }));
