/**
 * Orbit (Deploy with Git): a dated catalogue of the published plans, the Deploy to Flux button URL, the
 * build variables a learner can set, and the markers that make an Orbit app recognisable in the global specs.
 *
 * Everything here is DATA with a read date, not a network fact. The plan table is a vendor's published page
 * (DOCS-ONLY, read `ORBIT_READ_ON`); the academy's own price for any size always comes from `quote()`. The
 * live counts in `ORBIT_FACTS` are dated samples: the product fetches live counts and labels them LIVE.
 *
 * An Orbit app is an ordinary version 8 Flux spec with one component running the image
 * `runonflux/orbit:latest` (FACTS 15.3.1). Nothing in the protocol knows about Orbit. That is why a plan's
 * price can be reproduced with the same formula as any other app (FACTS 15.3.11), and why the helpers here
 * build plain `FluxAppSpec` objects and call `quote()`.
 *
 * Refreshing: re-read https://runonflux.com/apps/orbit (plans, FAQ, footnotes), the Deploy to Flux page and the
 * environment reference in the docs, update the tables, bump the dates, and run `orbit.test.ts` (it re-prices
 * the three plans with the baked parameters and fails when a published price and the engine disagree).
 *
 * Pure and framework-free. Erasable TypeScript only. No Node built-ins, no DOM.
 */

import { DEFAULT_EXPIRE_BLOCKS } from './blocks.ts';
import { repositoryOf } from './lint-data.ts';
import { BAKED_PRICING, quote } from './pricing.ts';
import { defaultComponent, EXAMPLE_OWNER, SPEC_VERSION } from './spec.ts';
import type { FluxAppSpec, PricingParams } from './types.ts';

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

/** ISO date the plan table and the button page were read. */
export const ORBIT_READ_ON = '2026-10-13';

/**
 * Where the plan table, the custom ranges and the button format come from. Footer build label of the page
 * on the read date: `v1.1.101`. A label, not a fact; it changes with every deploy of the site.
 */
export const ORBIT_SOURCE =
  'https://runonflux.com/apps/orbit (Select Your Plan, FAQ, footnotes) and https://runonflux.com/apps/orbit/deploy-to-flux, read 2026-10-13 | FACTS 15.3.10, 15.3.12 | DOCS-ONLY';

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export type OrbitPlanId = 'starter' | 'standard' | 'pro';

export interface OrbitPlan {
  id: OrbitPlanId;
  name: string;
  /** Published USD price per month, as the page states it (a vendor price: DOCS-ONLY, dated). */
  usd: number;
  vcores: number;
  /**
   * RAM in decimal megabytes. The page says 1, 4 and 6 GB; live Orbit specs carry 1000, 4000 and 6000 MB, so
   * the page's GB are thousands of MB (FACTS 15.3.2). 1024, 4096 and 6144 would price the same.
   */
  ramMb: number;
  storageGb: number;
  /** Instances the plan registers (FACTS 15.3.10). Starter is a single instance. */
  instances: number;
  persistentFolders: boolean;
  /** A second app port, beside the webhook port. */
  secondPort: boolean;
  /**
   * The page says "2 instances with failover" for Standard and Pro, and that Starter "runs on a single
   * instance, so brief downtime may occur if its node restarts". Two instances are what make a node failure
   * survivable; this flag is the page's wording, not a measurement.
   */
  failover: boolean;
}

// source: FACTS 15.3.10 (the plan table), read 2026-10-13, footer v1.1.101
export const ORBIT_PLANS: readonly OrbitPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    usd: 0.99,
    vcores: 0.5,
    ramMb: 1000,
    storageGb: 5,
    instances: 1,
    persistentFolders: false,
    secondPort: false,
    failover: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    usd: 2.49,
    vcores: 1.5,
    ramMb: 4000,
    storageGb: 15,
    instances: 2,
    persistentFolders: true,
    secondPort: true,
    failover: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    usd: 3.99,
    vcores: 2,
    ramMb: 6000,
    storageGb: 20,
    instances: 2,
    persistentFolders: true,
    secondPort: true,
    failover: true,
  },
];

export const ORBIT_PLAN_IDS: readonly OrbitPlanId[] = ORBIT_PLANS.map((p) => p.id);

export function orbitPlanById(id: string): OrbitPlan | undefined {
  return ORBIT_PLANS.find((p) => p.id === id);
}

/**
 * The Custom plan: "Priced by the size you choose when you deploy". The page states a starting price and
 * ranges only; it states no price for any custom size, so use `quote()` and say it is the network price.
 * source: FACTS 15.3.10 (Custom row).
 */
export const ORBIT_CUSTOM = {
  name: 'Custom',
  /** "from $0.99": the network's minimum price, not a plan specific rate (FACTS 15.3.11). */
  fromUsd: 0.99,
  vcoresMin: 0.1,
  vcoresMax: 15,
  /** The page gives no lower bound for RAM: "Up to 59 GB". Decimal MB, as in live specs. */
  ramMbMax: 59000,
  storageGbMin: 1,
  storageGbMax: 820,
  instancesMin: 1,
  instancesMax: 3,
  /** The page: persistent folders "only with 2 or more instances". */
  persistentFoldersMinInstances: 2,
  secondPort: true,
  readOn: ORBIT_READ_ON,
} as const;

// ---------------------------------------------------------------------------
// A plan as a spec, and its price through the engine
// ---------------------------------------------------------------------------

/** The image every managed Orbit app registers (FACTS 15.3.1, VERIFIED-LIVE on 235 specs). */
export const ORBIT_IMAGE = 'runonflux/orbit:latest';

/** The component name 232 of 235 live Orbit specs use. An inference marker, not a rule (FACTS 15.3.1). */
export const ORBIT_COMPONENT_NAME = 'cloudgit';

/** Container port of the webhook and status listener, the last container port in 234 of 235 specs. */
export const ORBIT_WEBHOOK_PORT = 9001;

export interface OrbitPlanSpecOptions {
  /** App name (letters, digits, inner hyphens). Default `orbit-<plan>-demo`. */
  name?: string;
  /** Owner Flux ID. Default the academy's placeholder owner (`EXAMPLE_OWNER`, which passes the owner check). */
  owner?: string;
  /** Repository URL placed in `GIT_REPO_URL`. Default a placeholder that is plainly not a real repo. */
  repo?: string;
  /** Branch placed in `GIT_BRANCH`. Default `main`. */
  branch?: string;
  /** Container port the app listens on (`APP_PORT`). Default 3000, the most common value in live specs. */
  appPort?: number;
  /** Override the plan's instance count, for "what if" prices. Default the plan's own. */
  instances?: number;
  /** Subscription length in blocks. Default one month. */
  expire?: number;
}

/**
 * A valid v8 spec with the plan's resources, shaped the way live Orbit apps are (FACTS 15.3.2): one component
 * named `cloudgit`, image `runonflux/orbit:latest`, two public ports (the app and the webhook listener, whose
 * container ports are `APP_PORT` and 9001), `containerData` `/app`, environment `GIT_REPO_URL`, `APP_PORT`,
 * `GIT_BRANCH`. Public ports 31080 and 31090 are in the free range, so they add nothing to the price, which
 * is also how the plan prices were reproduced (FACTS 15.3.11).
 *
 * Choices worth knowing:
 * - The owner is the academy's placeholder Flux ID and the repository is `https://github.com/example/app`.
 *   Nothing here is deployable as it stands; it is a teaching and pricing artefact.
 * - It is a PLAIN spec. A real private-repository Orbit app is encrypted (FACTS 15.3.9) and would price
 *   higher in the engine; see `orbitPlanQuoteUsd` with `encrypted`.
 * - `lintSpec` reports no errors. Every plan carries the `IMAGE_LATEST` warning (the image is
 *   `runonflux/orbit:latest`), Starter also `INSTANCES_ONE`, which is the honest teaching point about Starter,
 *   and Pro also the `SIZE_EXCLUDES_CUMULUS` note.
 */
export function orbitPlanSpec(plan: OrbitPlan, opts: OrbitPlanSpecOptions = {}): FluxAppSpec {
  const appPort = opts.appPort ?? 3000;
  return {
    version: SPEC_VERSION,
    name: opts.name ?? `orbit-${plan.id}-demo`,
    // The managed product's descriptions start with "Orbit deployment" (FACTS 15.3.1).
    description: `Orbit deployment, ${plan.name} plan`,
    owner: opts.owner ?? EXAMPLE_OWNER,
    instances: opts.instances ?? plan.instances,
    staticip: false,
    enterprise: '',
    contacts: [],
    geolocation: [],
    expire: opts.expire ?? DEFAULT_EXPIRE_BLOCKS,
    nodes: [],
    compose: [
      defaultComponent({
        name: ORBIT_COMPONENT_NAME,
        description: ORBIT_COMPONENT_NAME,
        repotag: ORBIT_IMAGE,
        ports: [31080, 31090],
        containerPorts: [appPort, ORBIT_WEBHOOK_PORT],
        domains: ['', ''],
        environmentParameters: [
          `GIT_REPO_URL=${opts.repo ?? 'https://github.com/example/app'}`,
          `APP_PORT=${appPort}`,
          `GIT_BRANCH=${opts.branch ?? 'main'}`,
        ],
        containerData: '/app',
        cpu: plan.vcores,
        ram: plan.ramMb,
        hdd: plan.storageGb,
      }),
    ],
  };
}

export interface OrbitQuoteOptions {
  /** Override the plan's instance count (the engine result for "this size on N instances"). */
  instances?: number;
  /**
   * Price the spec as encrypted (the `enterprise` field set). Engine result only: the calculator cannot
   * confirm it without a real encrypted blob, and the plan page does not say how its prices absorb the
   * encryption fee (FACTS 15.3.11, UNVERIFIED).
   */
  encrypted?: boolean;
}

/**
 * The engine's monthly USD price for a plan's size (`quote(...).usdTotal`, one month). With the baked
 * parameters this equals the published plan price for all three plans; `orbit.test.ts` asserts it.
 */
export function orbitPlanQuoteUsd(
  plan: OrbitPlan,
  params: PricingParams = BAKED_PRICING.params,
  opts: OrbitQuoteOptions = {},
): number {
  const spec = orbitPlanSpec(plan, opts.instances === undefined ? {} : { instances: opts.instances });
  // A non-empty `enterprise` is what the price formula looks at. The blob itself is never needed to price.
  if (opts.encrypted) spec.enterprise = 'encrypted';
  const q = quote(spec, params);
  return q.usdTotal ?? q.usdPerMonth;
}

// ---------------------------------------------------------------------------
// The Deploy to Flux button URL
// ---------------------------------------------------------------------------

/** The page the button opens. It opens the wizard with fields filled in; it deploys nothing by itself. */
export const ORBIT_DEPLOY_BASE = 'https://runonflux.com/apps/orbit';

/** The button image the Markdown form uses (it redirects; the page documents this exact URL). */
export const ORBIT_BUTTON_IMAGE = 'https://runonflux.com/apps/orbit/deploytoflux.png';

export interface DeployToFluxOptions {
  /** Full HTTPS repository URL. Required. */
  repo: string;
  /** Branch to deploy. Optional; the button page says an omitted branch uses the repository default. */
  branch?: string;
  /** Folder of a monorepo to build. Optional. */
  projectPath?: string;
  /** `starter`, `standard` or `pro`. Optional. Custom sizes are set in the dashboard after the deploy. */
  plan?: string;
}

export class OrbitUrlError extends Error {
  readonly field: 'repo' | 'branch' | 'projectPath' | 'plan';
  constructor(field: 'repo' | 'branch' | 'projectPath' | 'plan', message: string) {
    super(message);
    this.name = 'OrbitUrlError';
    this.field = field;
  }
}

// Control characters and DEL. Written with an explicit range so no raw control character sits in the source.
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
const CONTROL = /[\u0000-\u001f\u007f]/;

function checkRepo(repo: unknown): string {
  if (typeof repo !== 'string' || repo.trim() === '') {
    throw new OrbitUrlError('repo', 'The repository URL is required.');
  }
  if (repo !== repo.trim() || /\s/.test(repo) || CONTROL.test(repo)) {
    throw new OrbitUrlError('repo', 'The repository URL must not contain spaces or control characters.');
  }
  if (repo.length > 2000) throw new OrbitUrlError('repo', 'The repository URL is too long.');
  let u: URL;
  try {
    u = new URL(repo);
  } catch {
    throw new OrbitUrlError(
      'repo',
      'The repository must be a full https URL, for example https://github.com/owner/repo.',
    );
  }
  if (u.protocol !== 'https:') {
    throw new OrbitUrlError('repo', 'The repository URL must start with https://.');
  }
  if (!u.hostname) throw new OrbitUrlError('repo', 'The repository URL has no host.');
  if (u.username !== '' || u.password !== '') {
    throw new OrbitUrlError(
      'repo',
      'Do not put a username, password or token in the URL; private repository credentials are entered in Orbit itself.',
    );
  }
  if (u.search !== '' || u.hash !== '') {
    throw new OrbitUrlError('repo', 'A repository URL has no query string or fragment.');
  }
  return repo;
}

/** The git ref-name rules that matter for a branch (git check-ref-format), with a length cap. */
function checkBranch(branch: string): string {
  if (branch === '' || branch.length > 255) {
    throw new OrbitUrlError('branch', 'The branch name must be 1 to 255 characters.');
  }
  if (CONTROL.test(branch) || /[\s~^:?*[\\]/.test(branch)) {
    throw new OrbitUrlError('branch', 'The branch name has a character git does not allow.');
  }
  if (
    branch.startsWith('-') ||
    branch.startsWith('/') ||
    branch.endsWith('/') ||
    branch.endsWith('.') ||
    branch.endsWith('.lock') ||
    branch.includes('..') ||
    branch.includes('//') ||
    branch.includes('@{') ||
    branch === '@'
  ) {
    throw new OrbitUrlError('branch', 'That is not a valid git branch name.');
  }
  return branch;
}

function checkProjectPath(path: string): string {
  if (path === '' || path.length > 255) {
    throw new OrbitUrlError('projectPath', 'The project path must be 1 to 255 characters.');
  }
  if (CONTROL.test(path) || path.includes('\\')) {
    throw new OrbitUrlError('projectPath', 'The project path has a character that is not allowed.');
  }
  if (path.startsWith('/')) {
    throw new OrbitUrlError(
      'projectPath',
      'The project path is a folder inside the repository, not an absolute path.',
    );
  }
  if (path.split('/').some((seg) => seg === '..')) {
    throw new OrbitUrlError('projectPath', 'The project path must stay inside the repository.');
  }
  return path;
}

/**
 * Percent-encode a query value but leave `:` and `/` readable, so the documented example reads the way the
 * page shows it (byte for byte). How the page encodes any other character is not published. Everything that could end the value or start another parameter (`&`, `=`, `#`, `?`, `+`,
 * space, `%`) is encoded.
 */
function encodeValue(value: string): string {
  return encodeURIComponent(value).replace(/%3A/gi, ':').replace(/%2F/gi, '/');
}

/**
 * Build the Deploy to Flux URL (FACTS 15.3.12):
 * `https://runonflux.com/apps/orbit?repo=<https url>&branch=<branch>&projectPath=<folder>&plan=<plan>`.
 * Parameter order is the documented one; unset parameters are omitted. Throws `OrbitUrlError` (with the
 * offending `field`) for what the Academy refuses: a non-https or credentialed repo, a plan that is not
 * starter, standard or pro, a branch or path git or the repository layout cannot have. Orbit publishes the
 * format (FACTS 15.3.12) and no list of refused values, so apart from the https repo and the three plan
 * values these are the Academy's checks, not Orbit's. Only the documented example's encoding is known
 * (`:` and `/` left readable); the percent-encoding of other characters is the Academy's choice.
 */
export function deployToFluxUrl(o: DeployToFluxOptions): string {
  const parts: string[] = [];
  parts.push(`repo=${encodeValue(checkRepo(o.repo))}`);
  if (o.branch !== undefined) parts.push(`branch=${encodeValue(checkBranch(o.branch))}`);
  if (o.projectPath !== undefined) parts.push(`projectPath=${encodeValue(checkProjectPath(o.projectPath))}`);
  if (o.plan !== undefined) {
    if (!(ORBIT_PLAN_IDS as readonly string[]).includes(o.plan)) {
      throw new OrbitUrlError('plan', `The plan must be one of ${ORBIT_PLAN_IDS.join(', ')}.`);
    }
    parts.push(`plan=${o.plan}`);
  }
  return `${ORBIT_DEPLOY_BASE}?${parts.join('&')}`;
}

export type DeployToFluxResult =
  | { ok: true; url: string }
  | { ok: false; field: OrbitUrlError['field']; message: string };

/** Same as `deployToFluxUrl` but returns the problem instead of throwing: for forms. */
export function tryDeployToFluxUrl(o: DeployToFluxOptions): DeployToFluxResult {
  try {
    return { ok: true, url: deployToFluxUrl(o) };
  } catch (e) {
    if (e instanceof OrbitUrlError) return { ok: false, field: e.field, message: e.message };
    throw e;
  }
}

/** The README badge: `[![Deploy to Flux](<image>)](<url>)`. */
export function deployToFluxMarkdown(o: DeployToFluxOptions): string {
  return `[![Deploy to Flux](${ORBIT_BUTTON_IMAGE})](${deployToFluxUrl(o)})`;
}

// ---------------------------------------------------------------------------
// Build variables
// ---------------------------------------------------------------------------

export interface OrbitBuildVariable {
  name: string;
  /** One plain sentence. */
  what: string;
  /** An example value, or a placeholder in angle brackets for a secret. Never a real value. */
  example: string;
  /**
   * Whether the name appeared in the 235 plain Orbit specs read on `ORBIT_READ_ON` (VERIFIED-LIVE). False
   * means "documented and settable, not seen on the network that day". It says nothing about a variable
   * working or not.
   */
  seenInLiveSpecs: boolean;
  /** True where a value would be a secret: set it in the encrypted settings, never in a plain spec. */
  secret?: boolean;
  /** `GIT_REPO_URL` and `APP_PORT` are the two the docs call required. */
  required?: boolean;
}

// source: FACTS 15.3.6.1 (docs environment-reference, Node.js guide, Webhook API).
// "Seen" counts: the 235 plain v8 specs with image runonflux/orbit:latest, 2026-10-13.
export const ORBIT_BUILD_VARIABLES: readonly OrbitBuildVariable[] = [
  {
    name: 'GIT_REPO_URL',
    what: 'The repository to build and run. A full https URL.',
    example: 'https://github.com/username/repository',
    seenInLiveSpecs: true,
    required: true,
  },
  {
    name: 'APP_PORT',
    what: 'The port your app listens on inside the container. It must match the container port in the spec.',
    example: '3000',
    seenInLiveSpecs: true,
    required: true,
  },
  {
    name: 'GIT_BRANCH',
    what: 'The branch to deploy. The default is main.',
    example: 'production',
    seenInLiveSpecs: true,
  },
  {
    name: 'GIT_TOKEN',
    what: 'Access token for a private repository.',
    example: '<your personal access token>',
    seenInLiveSpecs: true,
    secret: true,
  },
  {
    name: 'PROJECT_PATH',
    what: 'The folder of a monorepo that holds the app. Hook scripts are looked up there first.',
    example: 'apps/web',
    seenInLiveSpecs: true,
  },
  {
    name: 'PROJECT_TYPE',
    what: 'Force the runtime instead of detecting it from your files.',
    example: 'node',
    seenInLiveSpecs: false,
  },
  {
    name: 'BUILD_COMMAND',
    what: 'Replace the detected build command.',
    example: 'npm run build:production',
    seenInLiveSpecs: true,
  },
  {
    name: 'RUN_COMMAND',
    what: 'Replace the detected start command.',
    example: 'node server.js',
    seenInLiveSpecs: true,
  },
  {
    name: 'INSTALL_COMMAND',
    what: 'Replace the install step. Named in the Node.js guide, not in the reference page.',
    example: 'npm ci',
    seenInLiveSpecs: true,
  },
  {
    name: 'NODE_VERSION',
    what: 'The Node.js version. It wins over .nvmrc and package.json.',
    example: '20.11.0',
    seenInLiveSpecs: true,
  },
  {
    name: 'PYTHON_VERSION',
    what: 'The Python version. The fallback is 3.11.',
    example: '3.12',
    seenInLiveSpecs: true,
  },
  { name: 'RUBY_VERSION', what: 'The Ruby version.', example: '3.1.4', seenInLiveSpecs: false },
  {
    name: 'GO_VERSION',
    what: 'The Go version, otherwise read from go.mod.',
    example: '1.22.5',
    seenInLiveSpecs: false,
  },
  {
    name: 'JAVA_VERSION',
    what: 'The Java version (8, 11, 17 or 21).',
    example: '21',
    seenInLiveSpecs: false,
  },
  { name: 'DOTNET_VERSION', what: 'The .NET SDK version.', example: '8.0', seenInLiveSpecs: false },
  { name: 'BUN_VERSION', what: 'The Bun version.', example: '1.0.25', seenInLiveSpecs: false },
  { name: 'RUST_VERSION', what: 'The Rust channel or version.', example: 'stable', seenInLiveSpecs: false },
  { name: 'PHP_VERSION', what: 'The PHP version (7.4 to 8.3).', example: '8.3', seenInLiveSpecs: false },
  {
    name: 'PHP_EXTENSIONS',
    what: 'Extra PHP extensions on top of a default set.',
    example: 'imagick,memcached',
    seenInLiveSpecs: false,
  },
  {
    name: 'CGO_ENABLED',
    what: 'Go only: 1 allows C libraries, 0 builds a static binary.',
    example: '1',
    seenInLiveSpecs: false,
  },
  {
    name: 'NODE_OPTIONS',
    what: 'Node flags. The image sets the heap limit from the container RAM by itself.',
    example: '--max-old-space-size=5120',
    seenInLiveSpecs: true,
  },
  {
    name: 'JAVA_OPTS',
    what: 'JVM flags. The image sets the heap from the container RAM by itself.',
    example: '-Xmx4g',
    seenInLiveSpecs: false,
  },
  {
    name: 'ASPNETCORE_ENVIRONMENT',
    what: 'The ASP.NET Core environment name.',
    example: 'Staging',
    seenInLiveSpecs: false,
  },
  {
    name: 'WEBHOOK_SECRET',
    what: 'The secret that signs and checks incoming webhooks. It must match the one set on the Git host.',
    example: '<a long random string>',
    seenInLiveSpecs: false,
    secret: true,
  },
  {
    name: 'WEBHOOK_SIGNATURE_VERIFY',
    what: 'Turn on signature checking for webhooks. Documented on the Webhook API page only.',
    example: 'true',
    seenInLiveSpecs: false,
  },
  {
    name: 'API_KEY',
    what: 'A bearer key that protects the status and log endpoints. The docs disagree on whether it also covers the health endpoint.',
    example: '<a long random string>',
    seenInLiveSpecs: false,
    secret: true,
  },
  {
    name: 'POLLING_INTERVAL',
    what: 'Seconds between checks of the repository, 60 to 86400. 0 turns polling off.',
    example: '300',
    seenInLiveSpecs: true,
  },
  {
    name: 'HEALTH_CHECK_RETRIES',
    what: 'Health check attempts before a deploy counts as failed, 1 to 10.',
    example: '5',
    seenInLiveSpecs: false,
  },
  {
    name: 'HEALTH_CHECK_DELAY',
    what: 'Seconds between health check attempts, 5 to 60.',
    example: '15',
    seenInLiveSpecs: false,
  },
  {
    name: 'SKIP_HEALTH_CHECK',
    what: 'Skip the health check. For testing only.',
    example: 'true',
    seenInLiveSpecs: false,
  },
  {
    name: 'DEPLOYMENT_TIMEOUT',
    what: 'Seconds a deployment may take before it is rolled back, 300 to 7200.',
    example: '3600',
    seenInLiveSpecs: false,
  },
  {
    name: 'FORCE_INSTALL',
    what: 'Reinstall dependencies and ignore the lock file cache.',
    example: 'true',
    seenInLiveSpecs: false,
  },
  {
    name: 'SKIP_HOOKS',
    what: 'Do not run pre-deploy.sh and post-deploy.sh this time.',
    example: 'true',
    seenInLiveSpecs: false,
  },
  {
    name: 'HOOK_TIMEOUT',
    what: 'Seconds a hook script may run, 60 to 3600.',
    example: '900',
    seenInLiveSpecs: false,
  },
  {
    name: 'WEBHOOK_PORT',
    what: 'The port of the webhook and status listener. The default is 9001.',
    example: '9001',
    seenInLiveSpecs: false,
  },
  {
    name: 'DEBOUNCE_DELAY',
    what: 'Seconds to wait and collapse pushes into one deploy. 0 turns it off.',
    example: '10',
    seenInLiveSpecs: false,
  },
];

/**
 * Names that appear in live Orbit specs but in no docs page read: runtime hints the managed product seems to
 * pass to the image. What they do is UNVERIFIED (FACTS 15.3.6), so a lesson may only say that Orbit specs carry
 * runtime hints with these names. They are not offered as settings.
 */
export const ORBIT_RUNTIME_HINT_NAMES: readonly string[] = ['ORBIT_RUNTIME', 'ORBIT_RUNTIME_VERSION'];

// ---------------------------------------------------------------------------
// Recognising an Orbit app in the global specs
// ---------------------------------------------------------------------------

export interface OrbitAppMarker {
  id:
    | 'image'
    | 'component-name'
    | 'component-description'
    | 'description-prefix'
    | 'container-data'
    | 'webhook-port';
  /** The field the marker reads, as a path in the spec. */
  field: string;
  /** The value the marker looks for. */
  value: string;
  /** `defining` = what makes the app an Orbit image app; `supporting` = seen on most, proves nothing alone. */
  strength: 'defining' | 'supporting';
  /** How many of the plain Orbit specs read on `readOn` carried it. */
  observed: { matching: number; of: number };
  /** `live` = counted in the global specs; `inference` = the reading of the count is a judgement (UNVERIFIED). */
  basis: 'live' | 'inference';
  readOn: string;
  note: string;
}

// source: FACTS 15.3.1 and 15.3.2 (235 plain v8 specs with image runonflux/orbit:latest, 2026-10-13)
export const ORBIT_APP_MARKERS: readonly OrbitAppMarker[] = [
  {
    id: 'image',
    field: 'compose[].repotag',
    value: ORBIT_IMAGE,
    strength: 'defining',
    observed: { matching: 235, of: 235 },
    basis: 'live',
    readOn: '2026-10-13',
    note: 'The image is how the 235 were found, so this count is true by construction. The same image is what you would deploy yourself in the Docker image flow.',
  },
  {
    id: 'component-name',
    field: 'compose[].name',
    value: ORBIT_COMPONENT_NAME,
    strength: 'supporting',
    observed: { matching: 232, of: 235 },
    basis: 'inference',
    readOn: '2026-10-13',
    note: 'Seen on 232; the other three use the app name. Reading it as the managed product’s signature is an inference.',
  },
  {
    id: 'component-description',
    field: 'compose[].description',
    value: ORBIT_COMPONENT_NAME,
    strength: 'supporting',
    observed: { matching: 232, of: 235 },
    basis: 'live',
    readOn: '2026-10-13',
    note: 'The component description is the literal name on 232. On the other three it repeats the app name, which is also those components’ own name, so on all 235 it equals the component’s own name.',
  },
  {
    id: 'description-prefix',
    field: 'description',
    value: 'Orbit deployment',
    strength: 'supporting',
    observed: { matching: 176, of: 235 },
    basis: 'live',
    readOn: '2026-10-13',
    note: 'The app description starts with this text on 176; 58 more use the app name as the description.',
  },
  {
    id: 'container-data',
    field: 'compose[].containerData',
    value: '/app',
    strength: 'supporting',
    observed: { matching: 233, of: 235 },
    basis: 'live',
    readOn: '2026-10-13',
    note: 'A plain /app folder: the app folder is not persistent.',
  },
  {
    id: 'webhook-port',
    field: 'compose[].containerPorts[last]',
    value: String(ORBIT_WEBHOOK_PORT),
    strength: 'supporting',
    observed: { matching: 234, of: 235 },
    basis: 'live',
    readOn: '2026-10-13',
    note: 'The last container port is the webhook and status listener.',
  },
];

export interface OrbitSpecMatch {
  /** True when a component runs the Orbit image. */
  isOrbit: boolean;
  /** The ids of the markers the spec shows, in `ORBIT_APP_MARKERS` order. */
  markers: OrbitAppMarker['id'][];
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Which Orbit markers a global spec shows. Accepts anything and never throws.
 *
 * This is an INFERENCE from what live specs look like, not a protocol field: the network has no Orbit object
 * type (FACTS 15.3.1). It is true for apps registered by Orbit's dashboard and also for anyone who deploys
 * the same image themselves. It cannot see private-repository Orbit apps, which are encrypted and show
 * nothing (FACTS 15.3.1). The image decides `isOrbit`; the other markers are returned for display.
 */
export function orbitSpecMatch(spec: unknown): OrbitSpecMatch {
  const root = asRecord(spec);
  const found = new Set<OrbitAppMarker['id']>();
  if (!root) return { isOrbit: false, markers: [] };
  const compose = Array.isArray(root.compose) ? root.compose : [];
  const wantImage = repositoryOf(ORBIT_IMAGE);
  const description = typeof root.description === 'string' ? root.description : '';
  if (description.startsWith('Orbit deployment')) found.add('description-prefix');
  for (const raw of compose) {
    const c = asRecord(raw);
    if (!c) continue;
    const repotag = typeof c.repotag === 'string' ? c.repotag : '';
    if (repositoryOf(repotag) === wantImage) found.add('image');
    if (c.name === ORBIT_COMPONENT_NAME) found.add('component-name');
    if (c.description === ORBIT_COMPONENT_NAME) found.add('component-description');
    if (c.containerData === '/app') found.add('container-data');
    const cp = Array.isArray(c.containerPorts) ? c.containerPorts : [];
    if (cp.length > 0 && cp[cp.length - 1] === ORBIT_WEBHOOK_PORT) found.add('webhook-port');
  }
  return {
    isOrbit: found.has('image'),
    markers: ORBIT_APP_MARKERS.map((m) => m.id).filter((id) => found.has(id)),
  };
}

/** True when a component of the spec runs the Orbit image. An inference; see `orbitSpecMatch`. */
export function isOrbitSpec(spec: unknown): boolean {
  return orbitSpecMatch(spec).isOrbit;
}

// ---------------------------------------------------------------------------
// Dated samples of the live network
// ---------------------------------------------------------------------------

export interface OrbitFact {
  value: number;
  /** What the value counts, in one phrase. */
  what: string;
  readOn: string;
  /** Always `live`: VERIFIED-LIVE in FACTS on the read date. These are samples, not current values. */
  basis: 'live';
}

/**
 * Counts the lessons quote that are not prices. DATED SAMPLES: the live product fetches current counts and
 * labels them LIVE; never present these as live. Each is VERIFIED-LIVE in FACTS 15.3.1 to 15.3.3 on its read
 * date from `GET /apps/globalappsspecifications` and `GET /apps/locations`, analysed offline. They drift daily.
 */
export const ORBIT_FACTS = {
  readOn: '2026-10-13',
  note: 'Dated samples from 2026-10-13. Fetch live counts in the product and label them LIVE; these are the BAKED fallback.',
  globalSpecs: {
    value: 2083,
    what: 'apps in the global app specifications',
    readOn: '2026-10-13',
    basis: 'live',
  },
  plainOrbitSpecs: {
    value: 235,
    what: 'plain (unencrypted) specs whose component image is runonflux/orbit:latest',
    readOn: '2026-10-13',
    basis: 'live',
  },
  plainOrbitOneInstance: {
    value: 229,
    what: 'of those, specs with one instance',
    readOn: '2026-10-13',
    basis: 'live',
  },
  orbitOneInstanceNotRunning: {
    value: 78,
    what: 'single-instance Orbit specs with no running location, all owned by blocklisted owners',
    readOn: '2026-10-13',
    basis: 'live',
  },
  oneInstanceApps: {
    value: 351,
    what: 'apps that ask for one instance',
    readOn: '2026-10-13',
    basis: 'live',
  },
  oneInstanceNonOrbit: {
    value: 122,
    what: 'single-instance apps that are not Orbit deployments; every one had a running copy',
    readOn: '2026-10-13',
    basis: 'live',
  },
  encryptedV8Specs: {
    value: 1123,
    what: 'version 8 specs that are encrypted, so nothing in them says whether they are Orbit apps',
    readOn: '2026-10-13',
    basis: 'live',
  },
  blocklistEntriesOrbitWording: {
    value: 149,
    what: 'signed blocklist entries whose reason text names an Orbit deployment registered en masse',
    readOn: '2026-10-13',
    basis: 'live',
  },
} as const satisfies Record<string, OrbitFact | string>;
