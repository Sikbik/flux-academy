/**
 * Content of /reference/orbit: Orbit (Deploy with Git), its plans, the build pipeline, the spec it registers,
 * the build variables, the Deploy to Flux link, webhooks and what is not published.
 *
 * Every figure that has a home in the engine is read from `@shared/flux` (`ORBIT_*`, `orbitPlanQuoteUsd`,
 * `orbitPlanSpec`, `lintSpec`). The published plan prices and the variable table are a vendor's figures
 * (DOCS-ONLY, read `ORBIT_READ_ON`); the academy's own price for any size is `quote()`. The live counts are
 * dated samples, never current values (FACTS 15.3.1 to 15.3.3).
 *
 * This module is the lazy half of the page: `orbit.search.ts` holds the small records the index needs.
 * `numbers.test.ts` scans this file for typed numbers; a line that ends in `// literal:` is exempt, with
 * its reason. Statements say how well they are known with `prov`.
 *
 * Sources are FACTS.md 15.3.1 to 15.3.13 and 15.4. Nothing here comes from memory.
 */

import {
  BAKED_PRICING,
  type FluxAppSpec,
  humanBlocks,
  lintSpec,
  MCP_SERVERS,
  ORBIT_APP_MARKERS,
  ORBIT_BUILD_VARIABLES,
  ORBIT_COMPONENT_NAME,
  ORBIT_CUSTOM,
  ORBIT_FACTS,
  ORBIT_IMAGE,
  ORBIT_PLAN_IDS,
  ORBIT_PLANS,
  ORBIT_READ_ON,
  ORBIT_RUNTIME_HINT_NAMES,
  ORBIT_WEBHOOK_PORT,
  type OrbitPlan,
  type OrbitPlanId,
  orbitPlanQuoteUsd,
  orbitPlanSpec,
  TARGET_BLOCK_SEC,
  toolsOf,
} from '@shared/flux';
import { andList, count, num, usd } from './derive';
import { FORM_STEPS } from './facts';
import type { FactRow, Provenance } from './types';

/** Public pages this topic links to. FACTS 15.3.12 and 15.4. */
export const ORBIT_LINKS = {
  page: 'https://runonflux.com/apps/orbit',
  button: 'https://runonflux.com/apps/orbit/deploy-to-flux',
  mcpGuide: 'https://runonflux.com/apps/orbit/mcp-server',
  docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-git/introduction',
} as const;

export { ORBIT_READ_ON };

function planById(id: OrbitPlanId): OrbitPlan {
  const plan = ORBIT_PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`orbit: no plan ${id}`);
  return plan;
}

// ---------------------------------------------------------------------------
// At a glance
// ---------------------------------------------------------------------------

export interface GlanceTile {
  id: string;
  label: string;
  value: string;
  note: string;
  /** Element id on this page. */
  to: string;
}

/** FACTS 15.3.1, 15.3.5, 15.3.7 and 15.3.11. */
export function buildGlanceLines(): FactRow[] {
  return [
    {
      id: 'what',
      label: 'What it is',
      // fact: FACTS 15.3.1
      text: 'Orbit takes a Git repository, builds it and registers the result as an ordinary Flux app. The docs and the FluxCloud card call the same product Deploy with Git.',
      prov: ['docs'],
    },
    {
      id: 'shape',
      label: 'What the app is',
      // fact: FACTS 15.3.1
      text: `A plain version 8 spec with one component running \`${ORBIT_IMAGE}\`. The protocol has no Orbit object type, so everything else in this reference applies to it.`,
      prov: ['live'],
    },
    {
      id: 'price',
      label: 'What it costs',
      // fact: FACTS 15.3.11
      text: 'The network price for the size. Each plan price equals what `quote()` returns for its resources, and no builder fee shows in any of them.',
      prov: ['docs', 'source', 'live'],
    },
    {
      id: 'ship',
      label: 'How a change ships',
      // fact: FACTS 15.3.5, 15.3.7
      text: 'A {{term:webhook}} from your Git host, or a poll of the repository, queues a build. The product page says a failed build never replaces a working deployment.',
      prov: ['docs'],
    },
  ];
}

export function buildGlanceTiles(): GlanceTile[] {
  const required = ORBIT_BUILD_VARIABLES.filter((v) => v.required).length;
  return [
    {
      id: 'plans',
      label: 'Plans',
      value: [...ORBIT_PLANS.map((p) => p.name), ORBIT_CUSTOM.name].join(', '),
      note: `From ${usd(ORBIT_CUSTOM.fromUsd)} a month on ${ORBIT_READ_ON}.`,
      to: 'plans',
    },
    {
      id: 'image',
      label: 'Image',
      value: ORBIT_IMAGE,
      note: 'The one image every managed app runs.',
      to: 'generated-spec',
    },
    {
      id: 'webhook',
      label: 'Webhook port',
      value: String(ORBIT_WEBHOOK_PORT),
      note: 'The last container port of an Orbit app.',
      to: 'webhooks',
    },
    {
      id: 'variables',
      label: 'Build variables',
      value: num(ORBIT_BUILD_VARIABLES.length),
      note: `${num(required)} required: the repository and the port.`,
      to: 'build-variables',
    },
  ];
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export interface PlanRow {
  id: OrbitPlanId;
  name: string;
  /** "0.5 vCores, 1,000 MB, 5 GB". */
  resources: string;
  /** "1 instance" or "2 instances, with failover". */
  instances: string;
  persistentFolders: boolean;
  secondPort: boolean;
  /** What the page publishes, USD per month. */
  publishedUsd: number;
  /** What `quote()` returns for the same resources, one month, not encrypted. */
  engineUsd: number;
  /** The published price and the engine's agree to the cent. */
  agree: boolean;
}

/** FACTS 15.3.10 (the table) and 15.3.11 (the engine check). No price column is typed here. */
export function buildPlanRows(): PlanRow[] {
  return ORBIT_PLANS.map((p) => {
    const engineUsd = orbitPlanQuoteUsd(p);
    return {
      id: p.id,
      name: p.name,
      resources: `${num(p.vcores)} vCores, ${num(p.ramMb)} MB, ${num(p.storageGb)} GB`,
      instances: `${count(p.instances, 'instance')}${p.failover ? ', with failover' : ''}`,
      persistentFolders: p.persistentFolders,
      secondPort: p.secondPort,
      publishedUsd: p.usd,
      engineUsd,
      agree: Math.abs(engineUsd - p.usd) < 0.005,
    };
  });
}

/** "Starter USD 1.49, Standard USD 4.99 and Pro USD 6.49", from the engine, for the encrypted variant. */
function encryptedPrices(): string {
  return andList(
    ORBIT_PLANS.map(
      (p) => `${p.name} ${usd(orbitPlanQuoteUsd(p, BAKED_PRICING.params, { encrypted: true }))}`,
    ),
  );
}

export function buildPlanFacts(): FactRow[] {
  return [
    {
      id: 'price-basis',
      label: 'Why the price equals quote()',
      // fact: FACTS 15.3.11
      text: `A plan is a size, and a size has one network price. For each plan, \`quote()\` at the rates read on ${BAKED_PRICING.capturedAt} returns the published price: one month, one component, two public ports in the free range, not encrypted, no static IP. The published prices are the page's, read on ${ORBIT_READ_ON}.`,
      prov: ['docs', 'source', 'live'],
    },
    {
      id: 'instances',
      label: 'Instances and failover',
      // fact: FACTS 15.3.4, 15.3.10, 15.3.15 (3)
      text: 'Starter registers one instance, so the app is down while its node is down. The page says so: brief downtime may occur if its node restarts. Standard and Pro register two, which the page calls failover. None of the three runs on three nodes. The docs and console copy that say "3+ nodes" are older.',
      prov: ['docs', 'live'],
    },
    {
      id: 'included',
      label: 'On every plan',
      // fact: FACTS 15.3.8, 15.3.10
      text: 'The page lists unlimited builds, a free HTTPS address, custom domains, database and Redis add-ons, unlimited bandwidth and no egress billing, with no contract. A custom domain still needs its entry in the spec, which the dashboard writes.',
      prov: ['docs'],
    },
    {
      id: 'payment',
      label: 'How you pay',
      // fact: FACTS 15.3.10
      text: 'By card through Stripe, or in FLUX through ZelCore or SSP. The page says a card works for every plan.',
      prov: ['docs'],
    },
    {
      id: 'free-plan',
      label: 'There is no free plan',
      // fact: FACTS 15.3.10, 15.3.15 (2)
      text: 'The page says the old Free plan is closed to new apps, and that apps already on it keep renewing for free. The plans are Starter, Standard, Pro and Custom. Older pages and the FluxCloud console copy still list a Free plan: follow the product page.',
      prov: ['docs'],
    },
    {
      id: 'console-copy',
      label: 'The FluxCloud console copy differs',
      // fact: FACTS 15.3.8, 15.3.10, 15.3.15 (4)
      text: 'The Git page of the FluxCloud console lists Free, Standard and Pro and no Starter, and puts private repositories and custom domains under Standard. The product page lists all four plans and puts both on every plan. This page follows the product page.',
      prov: ['source', 'docs'],
    },
    {
      id: 'encrypted',
      label: 'A private repository prices higher in the engine',
      // fact: FACTS 15.3.9, 15.3.11
      text: `The page says private repositories, database add-ons and secret variables are deployed encrypted, and that the network's encryption fee is included in the price shown at checkout. An encrypted spec adds the scope fee (${usd(BAKED_PRICING.params.scope)} on the bundle), so for the same sizes the engine prices ${encryptedPrices()} a month. These are engine results: the calculator cannot confirm an encrypted spec. How the plan prices absorb the fee is under [what is not published](/reference/orbit#not-published-encryption-fee).`,
      prov: ['docs', 'source'],
    },
  ];
}

export interface CustomRow {
  id: string;
  label: string;
  value: string;
  note: string;
}

/** The ranges of a Custom size, as the page states them. FACTS 15.3.10 (Custom row). */
export function buildCustomRows(): CustomRow[] {
  const c = ORBIT_CUSTOM;
  return [
    {
      id: 'vcores',
      label: 'vCores',
      value: `${num(c.vcoresMin)} to ${num(c.vcoresMax)}`,
      note: 'CPU, in cores.',
    },
    {
      id: 'ram',
      label: 'RAM',
      value: `up to ${num(c.ramMbMax)} MB`,
      note: 'The page gives no lower bound. Live specs hold decimal MB, so one GB is a thousand MB.',
    },
    {
      id: 'storage',
      label: 'Storage',
      value: `${num(c.storageGbMin)} to ${num(c.storageGbMax)} GB`,
      note: 'Disk, in GB.',
    },
    {
      id: 'instances',
      label: 'Instances',
      value: `${num(c.instancesMin)} to ${num(c.instancesMax)}`,
      note: "Copies on distinct nodes. The range is the page's.",
    },
    {
      id: 'folders',
      label: 'Persistent folders',
      value: `only with ${num(c.persistentFoldersMinInstances)} or more instances`,
      note: 'The default app folder is not persistent.',
    },
    {
      id: 'port',
      label: 'Second app port',
      value: c.secondPort ? 'yes' : 'no',
      note: 'A second public port beside the webhook port.',
    },
    {
      id: 'from',
      label: 'Price',
      value: `from ${usd(c.fromUsd)} a month`,
      note: "The network's minimum price, not a rate of this plan. The page states no price for any custom size.",
    },
  ];
}

export interface CustomPriceRow {
  id: string;
  label: string;
  size: string;
  instances: number;
  /** The engine's price, one month, plain. Not a published Orbit price. */
  usd: number;
}

/**
 * What `quote()` says at the ends of the Custom ranges. Engine numbers, dated by the baked rates, not
 * Orbit's: the page names no price above its starting price (FACTS 15.3.11, 15.3.16).
 */
export function buildCustomPriceRows(): CustomPriceRow[] {
  const c = ORBIT_CUSTOM;
  const base = planById('starter');
  const smallest: OrbitPlan = {
    ...base,
    vcores: c.vcoresMin,
    ramMb: FORM_STEPS.ramMb,
    storageGb: c.storageGbMin,
    instances: c.instancesMin,
  };
  const largest: OrbitPlan = {
    ...base,
    vcores: c.vcoresMax,
    ramMb: c.ramMbMax,
    storageGb: c.storageGbMax,
    instances: c.instancesMin,
  };
  const row = (id: string, label: string, p: OrbitPlan): CustomPriceRow => ({
    id,
    label,
    size: `${num(p.vcores)} vCores, ${num(p.ramMb)} MB, ${num(p.storageGb)} GB`,
    instances: p.instances,
    usd: orbitPlanQuoteUsd(p),
  });
  return [
    row('smallest', 'Smallest size', smallest),
    row('largest-one', 'Largest size', largest),
    row('largest-most', 'Largest size', { ...largest, instances: c.instancesMax }),
  ];
}

export function buildCustomFacts(): FactRow[] {
  return [
    {
      id: 'no-price',
      label: 'No published price',
      // fact: FACTS 15.3.10, 15.3.11, 15.3.16
      text: `The page says a custom size is priced by what you choose when you deploy, and gives a starting price only. The table below is the engine's price for the ends of the ranges at the rates read on ${BAKED_PRICING.capturedAt}: the network price of that size, not a number Orbit published.`,
      prov: ['docs', 'source'],
    },
  ];
}

// ---------------------------------------------------------------------------
// How a deploy runs
// ---------------------------------------------------------------------------

export interface DeployStep {
  id: string;
  title: string;
  /** Markup. */
  text: string;
  prov: readonly Provenance[];
}

/**
 * The stages of a Git deploy as the docs and the page describe them. FACTS 15.3.4, 15.3.5 and 15.3.7.
 * Figures are the vendor's, written as words: they are not the engine's numbers.
 */
export function buildDeploySteps(): DeployStep[] {
  return [
    {
      id: 'trigger',
      title: 'A push or a poll starts it',
      // fact: FACTS 15.3.5
      text: 'A webhook from your Git host, or the next poll of the repository, queues a deployment. There is one pending slot and the newest commit wins.',
      prov: ['docs'],
    },
    {
      id: 'clone',
      title: 'Clone',
      // fact: FACTS 15.3.4
      text: 'The app clones `GIT_REPO_URL` at `GIT_BRANCH` (the default is `main`) under `/app`. A private repository needs `GIT_TOKEN`.',
      prov: ['docs'],
    },
    {
      id: 'detect',
      title: 'Detect the runtime',
      // fact: FACTS 15.3.4
      text: 'By the files in the repository: a `package.json` with a lock file, `requirements.txt` or `pyproject.toml`, `Gemfile`, `go.mod`, `Cargo.toml`, `pom.xml` or `build.gradle`, a `.csproj`, `composer.json` and Bun files. The product page says {{term:nixpacks}} does the detection. The docs describe their own file based detection and never name it, and the two have not been reconciled.',
      prov: ['docs'],
    },
    {
      id: 'version',
      title: 'Pick the runtime version',
      // fact: FACTS 15.3.4
      text: 'A version variable first, then a version file such as `.nvmrc`, `.python-version` or `go.mod`, then a documented fallback for the language.',
      prov: ['docs'],
    },
    {
      id: 'install',
      title: 'Install dependencies',
      // fact: FACTS 15.3.4
      text: 'The package manager follows the lock file: `pnpm-lock.yaml`, `yarn.lock` or `package-lock.json`. The step is skipped when the lock files did not change.',
      prov: ['docs'],
    },
    {
      id: 'pre-deploy',
      title: 'Pre-deploy hook',
      // fact: FACTS 15.3.4, 15.3.7
      text: '`pre-deploy.sh` runs before the app starts. The hooks page puts it after install and before the build, and the environment reference says after the build: the two pages disagree. A failed pre-deploy hook rolls the deployment back.',
      prov: ['docs'],
    },
    {
      id: 'build',
      title: 'Build',
      // fact: FACTS 15.3.4
      text: 'The detected build command (for Node.js, the `build` script) or `BUILD_COMMAND`.',
      prov: ['docs'],
    },
    {
      id: 'start',
      title: 'Start',
      // fact: FACTS 15.3.4
      text: 'The `start` script, the main file or `RUN_COMMAND`. The app has to listen on `APP_PORT`.',
      prov: ['docs'],
    },
    {
      id: 'health',
      title: 'Health check',
      // fact: FACTS 15.3.4 (the two figures are not reconciled)
      text: 'An HTTP GET on `/` at `APP_PORT` that answers 2xx or 3xx, or the `.flux-pod/health-check` file when the repository has one. The environment reference says three tries ten seconds apart and the hooks page says sixty seconds. The two are not reconciled.',
      prov: ['docs'],
    },
    {
      id: 'post-deploy',
      title: 'Post-deploy hook',
      // fact: FACTS 15.3.4
      text: '`post-deploy.sh` runs after a healthy start. A failure is logged and nothing rolls back.',
      prov: ['docs'],
    },
    {
      id: 'release',
      title: 'Keep the release, or roll back',
      // fact: FACTS 15.3.4, 15.3.7
      text: 'The last three releases stay under `/app/production/releases/` with a `current` symlink. A failed build, a failed pre-deploy hook, a failed health check or a timeout keeps the last good version live and rolls back ({{term:rollback}}). Rollback is not protection against a node going away.',
      prov: ['docs'],
    },
  ];
}

/** The stage names the status endpoint reports, in order. FACTS 15.3.5 ("Stages"). */
export function buildStatusStages(): readonly string[] {
  return [
    'starting',
    'git_pull',
    'installing_dependencies',
    'stopping_app',
    'building',
    'starting_app',
    'health_check',
    'completed',
  ];
}

export function buildDeployFacts(): FactRow[] {
  return [
    {
      id: 'where',
      label: 'Where the build runs',
      // fact: FACTS 15.3.1
      text: 'Apparently inside the app container on the node, not on a build service that pushes a finished image: no spec names a per app image. The registration shape was read from live specs. What runs inside the image is not visible from a spec.',
      prov: ['live', 'inference'],
    },
    {
      id: 'timeout',
      label: 'How long a deploy may take',
      // fact: FACTS 15.3.4
      text: 'The whole deployment is limited by `DEPLOYMENT_TIMEOUT`, which the docs give as 1800 seconds by default, and a deployment that runs over is rolled back.', // literal: FACTS 15.3.4, the docs default
      prov: ['docs'],
    },
    {
      id: 'how-long',
      label: 'There is no fixed time',
      // fact: FACTS 15.3.16
      text: 'A push is live when the webhook has arrived, the build has finished and the health check has passed. The docs say about two minutes for a webhook flow. That is their figure, and a build depends on the project.',
      prov: ['docs'],
    },
  ];
}

// ---------------------------------------------------------------------------
// The generated spec
// ---------------------------------------------------------------------------

export interface SpecNote {
  id: string;
  /** The JSON key the note is about. */
  key: string;
  /** 1 based line of the key in `json`. */
  line: number;
  /** Markup. */
  text: string;
  prov: readonly Provenance[];
}

export interface PlanLintIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  path: string;
  message: string;
  /** Markup: why this plan's spec carries it. */
  explain: string;
}

export interface PlanLint {
  valid: boolean;
  errors: number;
  warnings: number;
  infos: number;
  issues: PlanLintIssue[];
}

export interface SpecView {
  plan: OrbitPlan;
  spec: FluxAppSpec;
  json: string;
  notes: SpecNote[];
  lint: PlanLint;
}

/** 1 based line number of the first `"key":` at the given indent, or 0 when it is not there. */
function lineOf(lines: readonly string[], indent: number, key: string): number {
  const prefix = `${' '.repeat(indent)}"${key}":`;
  return lines.findIndex((l) => l.startsWith(prefix)) + 1;
}

/** Why a plan's spec carries a given lint code. The linter's own text is on the spec page. */
function explainIssue(code: string, plan: OrbitPlan): string {
  switch (code) {
    case 'INSTANCES_ONE':
      // fact: FACTS 15.3.10, 15.3.13
      return `${plan.name} registers one instance, which is what the page sells: it says brief downtime may occur if the node restarts. The warning is true of the plan, not a fault in the spec. Standard and Pro register two.`;
    case 'IMAGE_LATEST':
      // fact: FACTS 15.3.1
      return `Every plain Orbit spec read on ${ORBIT_READ_ON} runs \`${ORBIT_IMAGE}\`, so every plan carries this warning. It is the linter's general warning for the \`latest\` tag, and the product ships its image that way.`;
    case 'SIZE_EXCLUDES_CUMULUS':
      // fact: the lint catalogue, FACTS 2.3
      return `${plan.name} asks for more than a nominal Cumulus node offers, so fewer nodes can take it. It is context, not a fault.`;
    default:
      return "The linter's own explanation is in the lint index.";
  }
}

/** The linter's own result for a plan's spec, with the reason each issue is there. FACTS 15.3.2. */
export function buildPlanLint(plan: OrbitPlan, spec: FluxAppSpec = orbitPlanSpec(plan)): PlanLint {
  const report = lintSpec(spec);
  return {
    valid: report.valid,
    errors: report.errors,
    warnings: report.warnings,
    infos: report.infos,
    issues: report.issues.map((i) => ({
      code: i.code,
      severity: i.severity,
      path: i.path,
      message: i.message,
      explain: explainIssue(i.code, plan),
    })),
  };
}

/**
 * The spec a plan registers, annotated. The owner is the academy's placeholder and the repository is an
 * example, so nothing here is deployable as it stands (see `orbitPlanSpec`). FACTS 15.3.1 and 15.3.2.
 */
export function buildSpecView(planId: OrbitPlanId): SpecView {
  const plan = planById(planId);
  const spec = orbitPlanSpec(plan);
  const json = JSON.stringify(spec, null, 2);
  const lines = json.split('\n');
  const top = (key: string): number => lineOf(lines, 2, key);
  const inner = (key: string): number => lineOf(lines, 6, key);
  const seen = (id: (typeof ORBIT_APP_MARKERS)[number]['id']): string => {
    const m = ORBIT_APP_MARKERS.find((x) => x.id === id);
    return m ? `${num(m.observed.matching)} of ${num(m.observed.of)}` : '';
  };

  const notes: SpecNote[] = [
    {
      id: 'version',
      key: 'version',
      line: top('version'),
      // fact: FACTS 15.3.1
      text: 'An ordinary version 8 spec. The network has no Orbit object type: an Orbit app is recognised by what it runs, not by a field.',
      prov: ['live'],
    },
    {
      id: 'name',
      key: 'name',
      line: top('name'),
      // fact: FACTS 15.3.4
      text: "The app name, which is also the start of the generated address `<name>.app.runonflux.io`. This one is the academy's placeholder.",
      prov: ['docs'],
    },
    {
      id: 'description',
      key: 'description',
      line: top('description'),
      // fact: FACTS 15.3.1
      text: `Managed apps start the description with \`Orbit deployment\`, which ${seen('description-prefix')} plain specs did on ${ORBIT_READ_ON}.`,
      prov: ['live'],
    },
    {
      id: 'owner',
      key: 'owner',
      line: top('owner'),
      // fact: FACTS 15.3.1
      text: "A Flux ID ({{term:zelid}}). Almost every Orbit app has its own, so there is no shared Orbit owner. Orbit signs the registration for you after you sign in. Who holds the key is not published. This one is the academy's placeholder.",
      prov: ['live', 'docs'],
    },
    {
      id: 'instances',
      key: 'instances',
      line: top('instances'),
      // fact: FACTS 15.3.10
      text: `The plan's instance count: ${num(plan.instances)} for ${plan.name}.`,
      prov: ['docs'],
    },
    {
      id: 'enterprise',
      key: 'enterprise',
      line: top('enterprise'),
      // fact: FACTS 15.3.1, 15.3.9
      text: 'Empty: this is a plain spec and every value in it is public. A private repository or a secret variable is deployed encrypted instead, and then nothing here can be read.',
      prov: ['live', 'docs'],
    },
    {
      id: 'expire',
      key: 'expire',
      line: top('expire'),
      // fact: FACTS 15.3.11
      text: `${humanBlocks(spec.expire)}: one month at ${TARGET_BLOCK_SEC} seconds a block. That is the term the plan price covers.`,
      prov: ['source'],
    },
    {
      id: 'component-name',
      key: 'name',
      line: inner('name'),
      // fact: FACTS 15.3.1
      text: `\`${ORBIT_COMPONENT_NAME}\` is the component name on ${seen('component-name')} plain specs. Reading it as the product's signature is an inference, not a rule.`,
      prov: ['live', 'inference'],
    },
    {
      id: 'repotag',
      key: 'repotag',
      line: inner('repotag'),
      // fact: FACTS 15.3.1
      text: 'The managed image. No spec names a per app image, so the build appears to run inside this container on the node.',
      prov: ['live', 'inference'],
    },
    {
      id: 'ports',
      key: 'ports',
      line: inner('ports'),
      // fact: FACTS 15.3.2, 15.3.11
      text: 'Two public ports: one for the app and one for the webhook listener. Ports in the normal range add nothing to the price.',
      prov: ['live', 'source'],
    },
    {
      id: 'container-ports',
      key: 'containerPorts',
      line: inner('containerPorts'),
      // fact: FACTS 15.3.2
      text: `The app's own port first (\`APP_PORT\`), then \`${ORBIT_WEBHOOK_PORT}\`, the webhook and status listener. It was the last container port on ${seen('webhook-port')} plain specs.`,
      prov: ['live'],
    },
    {
      id: 'domains',
      key: 'domains',
      line: inner('domains'),
      // fact: FACTS 15.3.8, 15.3.1
      text: 'No custom domain yet. The generated address serves the first port, and a custom domain needs its entry here.',
      prov: ['docs', 'live'],
    },
    {
      id: 'env',
      key: 'environmentParameters',
      line: inner('environmentParameters'),
      // fact: FACTS 15.3.6
      text: 'The repository, the port and the branch. The other variables are in the [build variables](/reference/orbit#build-variables) table. In a plain spec every value is public.',
      prov: ['live', 'docs'],
    },
    {
      id: 'container-data',
      key: 'containerData',
      line: inner('containerData'),
      // fact: FACTS 15.3.2, 15.3.13
      text: `A plain \`/app\` folder, as on ${seen('container-data')} plain specs: not persistent. Persistent folders appear as a \`g:\` or \`r:\` mount in the rare apps that use them.`,
      prov: ['live'],
    },
    {
      id: 'resources',
      key: 'cpu',
      line: inner('cpu'),
      // fact: FACTS 15.3.2, 15.3.10
      text: `The plan's resources: ${num(plan.vcores)} vCores, ${num(plan.ramMb)} MB and ${num(plan.storageGb)} GB. The page says GB for RAM, and live specs hold thousands of MB.`,
      prov: ['docs', 'live'],
    },
  ];

  return { plan, spec, json, notes, lint: buildPlanLint(plan, spec) };
}

// ---------------------------------------------------------------------------
// Build variables
// ---------------------------------------------------------------------------

export type VariableGroup = 'repository' | 'run' | 'runtime' | 'webhooks' | 'deploy';

export const VARIABLE_GROUPS: readonly { id: VariableGroup; label: string }[] = [
  { id: 'repository', label: 'Repository' },
  { id: 'run', label: 'Build and run' },
  { id: 'runtime', label: 'Runtime versions and flags' },
  { id: 'webhooks', label: 'Webhooks and polling' },
  { id: 'deploy', label: 'Health, hooks and timeouts' },
];

const GROUP_OF: Readonly<Record<string, VariableGroup>> = {
  GIT_REPO_URL: 'repository',
  GIT_BRANCH: 'repository',
  GIT_TOKEN: 'repository',
  PROJECT_PATH: 'repository',
  APP_PORT: 'run',
  PROJECT_TYPE: 'run',
  BUILD_COMMAND: 'run',
  RUN_COMMAND: 'run',
  INSTALL_COMMAND: 'run',
  FORCE_INSTALL: 'run',
  NODE_VERSION: 'runtime',
  PYTHON_VERSION: 'runtime',
  RUBY_VERSION: 'runtime',
  GO_VERSION: 'runtime',
  JAVA_VERSION: 'runtime',
  DOTNET_VERSION: 'runtime',
  BUN_VERSION: 'runtime',
  RUST_VERSION: 'runtime',
  PHP_VERSION: 'runtime',
  PHP_EXTENSIONS: 'runtime',
  CGO_ENABLED: 'runtime',
  NODE_OPTIONS: 'runtime',
  JAVA_OPTS: 'runtime',
  ASPNETCORE_ENVIRONMENT: 'runtime',
  WEBHOOK_SECRET: 'webhooks',
  WEBHOOK_SIGNATURE_VERIFY: 'webhooks',
  WEBHOOK_PORT: 'webhooks',
  DEBOUNCE_DELAY: 'webhooks',
  POLLING_INTERVAL: 'webhooks',
  API_KEY: 'webhooks',
  HEALTH_CHECK_RETRIES: 'deploy',
  HEALTH_CHECK_DELAY: 'deploy',
  SKIP_HEALTH_CHECK: 'deploy',
  DEPLOYMENT_TIMEOUT: 'deploy',
  SKIP_HOOKS: 'deploy',
  HOOK_TIMEOUT: 'deploy',
};

/** The group of a variable name, or null when the table has no place for it (a test keeps this empty). */
export function variableGroupOf(name: string): VariableGroup | null {
  return GROUP_OF[name] ?? null;
}

export interface VariableRow {
  name: string;
  /** Plain text from the catalogue. */
  what: string;
  example: string;
  secret: boolean;
  required: boolean;
  /** Seen in the plain specs read on `ORBIT_READ_ON`. */
  seen: boolean;
  group: VariableGroup;
}

/** FACTS 15.3.6.1. The docs are the source; "seen" is a dated live reading. */
export function buildVariableRows(): VariableRow[] {
  return ORBIT_BUILD_VARIABLES.map((v) => ({
    name: v.name,
    what: v.what,
    example: v.example,
    secret: v.secret === true,
    required: v.required === true,
    seen: v.seenInLiveSpecs,
    group: variableGroupOf(v.name) ?? 'run',
  }));
}

export function buildVariableFacts(): FactRow[] {
  return [
    {
      id: 'where',
      label: 'Where you set them',
      // fact: FACTS 15.3.6
      text: "The product page says they are set per app and injected at runtime, not baked into the image. In the Docker image flow they are the component's `environmentParameters`, as `NAME=value` strings.",
      prov: ['docs', 'live'],
    },
    {
      id: 'public',
      label: 'In a plain spec every value is public',
      // fact: FACTS 15.3.2, 15.3.6, 15.3.6.1
      text: `Anyone can read a plain spec from the API, and plain specs read on ${ORBIT_READ_ON} carry values in the clear, some of them tokens. A secret belongs in an encrypted app. This page shows names and never a value.`,
      prov: ['docs', 'live', 'source'],
    },
    {
      id: 'hints',
      label: 'Names seen in specs and in no docs page',
      // fact: FACTS 15.3.6, 15.3.6.1
      text: `${andList(ORBIT_RUNTIME_HINT_NAMES.map((n) => `\`${n}\``))} appear in live Orbit specs and in no docs page read. They look like runtime hints that the product passes to the image. Do not set them yourself.`,
      prov: ['live'],
    },
    {
      id: 'doc-examples',
      label: 'Names in docs examples and not in the reference',
      // fact: FACTS 15.3.6, 15.3.6.1
      text: '`PRE_BUILD_COMMAND`, `POST_BUILD_COMMAND`, `HEALTH_CHECK_INTERVAL`, `HEALTH_CHECK_PATH`, `MAX_OLD_SPACE_SIZE`, `WEB_CONCURRENCY` and `NPM_TOKEN` appear in docs examples and the troubleshooting page, not on the environment reference page. They are not in the table. Do not rely on them: the documented way to run steps around a deploy is the hook scripts.',
      prov: ['docs'],
    },
  ];
}

// ---------------------------------------------------------------------------
// The Deploy to Flux link
// ---------------------------------------------------------------------------

export interface ButtonParam {
  id: 'repo' | 'branch' | 'projectPath' | 'plan';
  required: boolean;
  /** Markup. */
  accepts: string;
  /** Markup: what the builder on this page checks. */
  rules: string;
  example: string;
}

/**
 * FACTS 15.3.12 names the parameters, which is required and the plan values. The rules are what
 * `deployToFluxUrl` checks, so the builder and this table agree.
 */
export function buildButtonParams(): ButtonParam[] {
  return [
    {
      id: 'repo',
      required: true,
      accepts: 'The full HTTPS URL of the repository.',
      rules:
        'No username, password or token in it: private repository credentials are entered in Orbit. No query string or fragment, and no spaces.',
      example: 'https://github.com/RunOnFlux/deploy-with-git-samples',
    },
    {
      id: 'branch',
      required: false,
      accepts: 'The branch to deploy.',
      rules: 'A name git accepts. When it is left out, the button page says the repository default is used.',
      example: 'master',
    },
    {
      id: 'projectPath',
      required: false,
      accepts: 'A folder inside the repository, for a {{term:monorepo}}.',
      rules: 'Relative to the repository root: not absolute, and no `..` segment.',
      example: 'express',
    },
    {
      id: 'plan',
      required: false,
      accepts: andList(ORBIT_PLAN_IDS.map((p) => `\`${p}\``)),
      rules:
        'Older links with `plan=free` open Starter. A custom size is not a parameter: set it in the dashboard after the deploy.',
      example: 'standard',
    },
  ];
}

export function buildButtonFacts(): FactRow[] {
  return [
    {
      id: 'effect',
      label: 'What it does',
      // fact: FACTS 15.3.12
      text: 'The {{term:deploy-button}} opens the Orbit deployment wizard with the fields filled in. It does not deploy on its own.',
      prov: ['docs'],
    },
    {
      id: 'names',
      label: 'Two vocabularies',
      // fact: FACTS 15.3.12
      text: 'The link uses `repo`, `branch`, `projectPath` and `plan`. The docs use `GIT_REPO_URL`, `GIT_BRANCH` and `PROJECT_PATH` for the same things in the image. They are different names for one idea.',
      prov: ['docs'],
    },
    {
      id: 'checks',
      label: 'What the builder checks',
      // fact: the engine, deployToFluxUrl
      text: "The page documents the parameter names, that `repo` is required and the plan values. The builder below also refuses a credential in the URL and a path that leaves the repository. Those checks are the academy's and are not rules the page publishes.",
      prov: ['inference'],
    },
    {
      id: 'image',
      label: 'The badge image redirects',
      // fact: FACTS 15.3.12
      text: 'The Markdown form uses the badge address the page documents. That address answers with a redirect to a path that has the `/apps` prefix twice.',
      prov: ['docs', 'live'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Webhooks and polling
// ---------------------------------------------------------------------------

/** FACTS 15.3.5, 15.3.6 and 15.3.6.1. Figures are written as words: they are the vendor's, not the engine's. */
export function buildWebhookFacts(): FactRow[] {
  return [
    {
      id: 'endpoint',
      label: 'The endpoint',
      // fact: FACTS 15.3.5
      text: `Your Git host calls \`POST /webhook\` on the app's webhook port, \`${ORBIT_WEBHOOK_PORT}\` by default. It accepts GitHub push and release events, GitLab push events and Bitbucket push events.`,
      prov: ['docs'],
    },
    {
      id: 'secret',
      label: 'The secret',
      // fact: FACTS 15.3.5
      text: 'GitHub signs the body with HMAC-SHA256 in `X-Hub-Signature-256`, and GitLab sends the secret in `X-Gitlab-Token`. Set the same value as `WEBHOOK_SECRET`. Checking is off by default: `WEBHOOK_SIGNATURE_VERIFY` is `false`, so set it to `true` as well, or a webhook is accepted without a valid signature. A request that fails the check gets a 401.', // literal: FACTS 15.3.5 and 15.3.6.1, the status a failed check returns
      prov: ['docs'],
    },
    {
      id: 'answer',
      label: 'What it answers',
      // fact: FACTS 15.3.5
      text: 'A JSON body with `status` set to `success`, a `message` of `Deployment queued` and a `delivery_id`. Queued means accepted, not deployed: read the status endpoint for the result.',
      prov: ['docs'],
    },
    {
      id: 'queue',
      label: 'The queue',
      // fact: FACTS 15.3.5
      text: 'One pending slot. Pushes within five seconds are collapsed, the newest commit wins and deployments never run side by side. At most ten requests a minute per IP are accepted, then 429.',
      prov: ['docs'],
    },
    {
      id: 'polling',
      label: 'Polling instead, or as well',
      // fact: FACTS 15.3.2, 15.3.5
      text: 'Set `POLLING_INTERVAL` and the app asks the repository on that timer. The page offers it for when you cannot install a webhook, and the docs list webhooks with a polling backup. Most plain Orbit specs that set it use a daily interval. That is a reading of live specs, not a documented default.',
      prov: ['docs', 'live', 'inference'],
    },
    {
      id: 'status',
      label: 'The status endpoints',
      // fact: FACTS 15.3.5
      text: 'The same port serves `GET /health`, `GET /status` (state, stage, progress and releases) and `GET /logs/:id` (text or JSON, with `tail`). Set `API_KEY` to put status and logs behind a bearer key. The Webhook API page says `/health` is always public and the environment reference says the key covers it too, so do not count on either.',
      prov: ['docs'],
    },
    {
      id: 'branch',
      label: 'One branch per app',
      // fact: FACTS 15.3.5
      text: 'Staging and production are two apps with different `GIT_BRANCH`. An app deploys one branch.',
      prov: ['docs'],
    },
    {
      id: 'address',
      label: 'The webhook address spelling',
      // fact: FACTS 6.4, 15.3.14
      text: "The webhook listener is the app's second public port. The network's own form for a public port is `<name>_<public port>.app.runonflux.io`, with the published port in it. The docs spell the webhook address `<app>-9001.app.runonflux.io/webhook`, with a hyphen and the container port, which the domain manager source does not generate. Treat that spelling as unverified.", // literal: FACTS 15.3.14, the docs spelling
      prov: ['docs', 'source', 'unverified'],
    },
    {
      id: 'previews',
      label: 'Preview deployments',
      // fact: FACTS 15.3.5
      text: 'The product page lists automatic {{term:preview-deploy}} for branches and pull requests. The docs describe them for static sites only, under a `/flux-pr-{number}/` base path. How they are billed is under [what is not published](/reference/orbit#not-published-preview-billing).',
      prov: ['docs'],
    },
  ];
}

// ---------------------------------------------------------------------------
// On the network
// ---------------------------------------------------------------------------

export interface MarkerRow {
  id: string;
  field: string;
  value: string;
  strength: 'defining' | 'supporting';
  /** "232 of 235". */
  seen: string;
  basis: 'live' | 'inference';
  readOn: string;
  note: string;
}

/** FACTS 15.3.1 and 15.3.2. An inference from live specs, never a protocol field. */
export function buildMarkerRows(): MarkerRow[] {
  return ORBIT_APP_MARKERS.map((m) => ({
    id: m.id,
    field: m.field,
    value: m.value,
    strength: m.strength,
    seen: `${num(m.observed.matching)} of ${num(m.observed.of)}`,
    basis: m.basis,
    readOn: m.readOn,
    note: m.note,
  }));
}

export interface SampleRow {
  id: string;
  value: number;
  what: string;
  readOn: string;
  basis: 'live';
}

/** The dated live counts, as the engine holds them. Samples: they drift daily. FACTS 15.3.1 to 15.3.3. */
export function buildSampleRows(): SampleRow[] {
  const rows: SampleRow[] = [];
  for (const [id, v] of Object.entries(ORBIT_FACTS)) {
    if (typeof v === 'object' && v !== null && 'value' in v) {
      rows.push({ id, value: v.value, what: v.what, readOn: v.readOn, basis: v.basis });
    }
  }
  return rows;
}

export function buildNetworkFacts(): FactRow[] {
  return [
    {
      id: 'shape',
      label: 'An ordinary app',
      // fact: FACTS 15.3.1
      text: 'Nothing in the protocol knows about Orbit. A reader can tell an Orbit app only by what its spec looks like, and cannot tell it from someone who deploys the same image by hand.',
      prov: ['live', 'inference'],
    },
    {
      id: 'listed',
      label: 'Listed is not running',
      // fact: FACTS 15.3.3
      text: 'A spec on the chain with no location row is not run by any node. Every single instance app with no location, on the day it was read, was an Orbit deployment whose owner is on the signed blocklist. That is nodes declining to run an app, not a node failure. Look up locations before you read a listing as running.',
      prov: ['live'],
    },
    {
      id: 'private',
      label: 'Private apps do not show',
      // fact: FACTS 15.3.1
      text: 'A private repository is deployed encrypted, so its public spec is an encrypted blob with an empty compose. None of the markers below can be seen on it.',
      prov: ['docs', 'live'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export function buildLimitFacts(): FactRow[] {
  const c = ORBIT_CUSTOM;
  return [
    {
      id: 'serverless',
      label: 'A long running container',
      // fact: FACTS 15.3.13
      text: 'Your app is a full container that keeps running, not a serverless function. Background workers and persistent processes work.',
      prov: ['docs'],
    },
    {
      id: 'static',
      label: 'Static sites and single page apps',
      // fact: FACTS 15.3.13
      text: 'The build produces the output and the network serves it. There is no separate static hosting tier and no CDN claim.',
      prov: ['docs'],
    },
    {
      id: 'stateless',
      label: 'The app folder is not persistent',
      // fact: FACTS 15.3.2, 15.3.13
      text: 'Files written under `/app` are gone after a deploy or a restart. Persistent folders exist on Standard, Pro and Custom with two or more instances, and appear in the spec as a `g:` or `r:` mount. Keep state in a database add-on or outside the container.',
      prov: ['docs', 'live'],
    },
    {
      id: 'ceiling',
      label: 'The size ceiling is the network',
      // fact: FACTS 15.3.13
      text: `Custom goes up to ${num(c.vcoresMax)} vCores, ${num(c.ramMbMax)} MB and ${num(c.storageGbMax)} GB, on up to ${num(c.instancesMax)} instances. The app level limits are in the [spec reference](/reference/spec#at-a-glance).`,
      prov: ['docs'],
    },
    {
      id: 'slot',
      label: 'One deploy slot per app',
      // fact: FACTS 15.3.13
      text: 'Pushes are queued and collapsed. There are no parallel builds of one app.',
      prov: ['docs'],
    },
    {
      id: 'single',
      label: 'One instance is one node',
      // fact: FACTS 15.3.7
      text: 'Rollback restores a good release. It does not help when a node goes away: a single instance is down until another node takes the app.',
      prov: ['docs'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Not published
// ---------------------------------------------------------------------------

/**
 * What the page, the docs and the guide leave unsaid. Every row is "not published" by definition, so every
 * row carries Unverified. FACTS 15.3.1, 15.3.4, 15.3.5, 15.3.6, 15.3.6.1, 15.3.11, 15.3.13, 15.4.2 and 15.4.9. The
 * search records in `orbit.search.ts` carry the same labels, and a test keeps the two in step.
 */
export function buildNotPublished(): FactRow[] {
  const orbitTools = toolsOf('orbit').length;
  return [
    {
      id: 'argument-names',
      label: 'Argument names of the Orbit MCP tools',
      // fact: FACTS 15.4.3, 15.4.9
      text: `The guide names ${count(orbitTools, 'tool')} and what each does. Their arguments and result shapes need an account to read, so this reference lists none. See [Agents and MCP](/reference/agents#tools-orbit).`,
      prov: ['docs', 'unverified'],
    },
    {
      id: 'key-custody',
      label: 'Who holds the key behind an Orbit app',
      // fact: FACTS 15.3.1
      text: 'The registration is signed by the owner Flux ID, and Orbit does that after you sign in. Whether the private key is held by you, by a Flux service or by a custodian is not stated anywhere.',
      prov: ['docs', 'unverified'],
    },
    {
      id: 'encryption-fee',
      label: 'How plan prices absorb the encryption fee',
      // fact: FACTS 15.3.11
      text: 'The page says the fee is included in the price shown at checkout. The engine adds it on top for the same sizes. Either Orbit pays the difference, or the plan price applies to plain apps and checkout adds the fee. The page does not say which.',
      prov: ['docs', 'unverified'],
    },
    {
      id: 'custom-price',
      label: 'A price for any custom size',
      // fact: FACTS 15.3.10, 15.3.11
      text: "The page gives a starting price and the ranges. The prices in the custom table are the engine's, not Orbit's.",
      prov: ['docs', 'unverified'],
    },
    {
      id: 'preview-billing',
      label: 'How preview deployments are billed',
      // fact: FACTS 15.3.5
      text: 'Whether a preview is a second app, and what it costs, is not stated.',
      prov: ['docs', 'unverified'],
    },
    {
      id: 'detection',
      label: 'Whether Nixpacks does the detection',
      // fact: FACTS 15.3.1, 15.3.4
      text: 'The product page names it. The docs describe their own file based detection and never mention it, and no spec shows which one runs inside the image.',
      prov: ['docs', 'unverified'],
    },
    {
      id: 'health-figures',
      label: 'The health check timing',
      // fact: FACTS 15.3.4
      text: 'The environment reference and the hooks page give two different figures for how long the check waits.',
      prov: ['docs', 'unverified'],
    },
    {
      id: 'sign-in-route',
      label: 'The sign in route of the Orbit MCP server',
      // fact: FACTS 15.4.2
      text: "The guide describes a pasted, short lived token with no refresh. The server's live sign in challenge describes a browser sign in with refresh tokens. Which is current, and how long a connection lasts, is not published.",
      prov: ['docs', 'unverified'],
    },
    {
      id: 'runtime-hints',
      label: 'What ORBIT_RUNTIME and ORBIT_RUNTIME_VERSION do',
      // fact: FACTS 15.3.6, 15.3.6.1
      text: 'They appear in live specs and in no docs page. What they do is not confirmed.',
      prov: ['unverified'],
    },
    {
      id: 'private-apps',
      label: 'Which encrypted apps are Orbit apps',
      // fact: FACTS 15.3.1
      text: 'An encrypted spec shows nothing about its image, so any count of Orbit apps made from public specs leaves the private ones out.',
      prov: ['docs', 'unverified'],
    },
    {
      id: 'config-file',
      label: 'A repository configuration file',
      // fact: FACTS 15.3.13
      text: 'No repository level configuration file was found beyond `pre-deploy.sh`, `post-deploy.sh` and `.flux-pod/health-check`.',
      prov: ['unverified'],
    },
  ];
}

// ---------------------------------------------------------------------------
// The Orbit MCP server, in one paragraph
// ---------------------------------------------------------------------------

/** FACTS 15.4.1 to 15.4.3. The counts come from the tool catalogue. */
export function buildOrbitMcpText(): string {
  const server = MCP_SERVERS.orbit;
  const tools = toolsOf('orbit');
  const groups = new Set(tools.map((t) => t.group)).size;
  const readOnly = tools.filter((t) => t.risk === 'reads').length;
  return `Orbit has its own server for AI agents that speak the Model Context Protocol ({{term:mcp}}), at \`${server.endpoint}\`. You sign in to Orbit with Google or email and the agent acts as that account with a short lived credential, so there is no Flux key to paste. At the time of writing a wallet only session cannot connect an agent. It has ${count(tools.length, 'tool')} in ${count(groups, 'group')}, and ${num(readOnly)} of them only read. The rest change an app, delete data or start a payment, which you complete in a Stripe checkout. It is a different product from the FluxCloud server, which works with keys. Both tool lists, their risks and the approval policies are on [Agents and MCP](/reference/agents).`;
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
  { section: 'at-a-glance', rows: buildGlanceLines },
  { section: 'plans', rows: buildPlanFacts },
  { section: 'custom-sizes', rows: buildCustomFacts },
  { section: 'how-a-deploy-runs', rows: buildDeployFacts },
  { section: 'build-variables', rows: buildVariableFacts },
  { section: 'deploy-button', rows: buildButtonFacts },
  { section: 'webhooks', rows: buildWebhookFacts },
  { section: 'on-the-network', rows: buildNetworkFacts },
  { section: 'limits', rows: buildLimitFacts },
  { section: 'not-published', rows: buildNotPublished },
];
