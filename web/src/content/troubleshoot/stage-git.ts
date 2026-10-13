/**
 * Stage 8: deploying from Git. Orbit (Deploy with Git) from the first press of the button to a running app:
 * the clone, the build, the start, the health check, the push and the plan.
 *
 * What Orbit does is the vendor description (DOCS-ONLY: the Orbit page and the Deploy with Git docs, read on
 * 2026-10-13, FACTS 9.8 and 15.3). What is verified is the registration shape, a plain version 8 spec with the
 * image `runonflux/orbit:latest` (VERIFIED-LIVE on 235 specs, FACTS 15.3.1), and the network rules every Flux
 * app follows (ports, limits, the signed blocklist, the location list). The build and run failures and their
 * fixes are the Deploy with Git docs, as FACTS 15.3.18 compiles them (17 rows); each cause below points at its
 * row and at the FACTS section that carries the mechanism. Details the research notes do not list (the JSON of
 * the status and health calls, the 400 and 401 bodies of the webhook, the clone failure for an unreachable
 * host) are written as statements of the docs, and the proof says so.
 *
 * Plan sizes and prices come from `shared/flux` (`ORBIT_PLANS`, `orbitPlanQuoteUsd`), the Deploy to Flux URL
 * from `deployToFluxUrl`; nothing about a plan is typed by hand. Live counts are dated samples, FACTS 15.3.2
 * and 15.3.3, and say so. Things a lesson must not say (FACTS 15.3.16): that Orbit is free, that a plan has
 * "3+ nodes", that Starter has failover, a price for a Custom size that is not `quote()` output, that Orbit
 * "uses Nixpacks" as a certainty, or any value copied from a plain Orbit spec.
 */

import {
  deployToFluxMarkdown,
  deployToFluxUrl,
  type FluxComponentSpec,
  ORBIT_APP_MARKERS,
  ORBIT_COMPONENT_NAME,
  ORBIT_CUSTOM,
  ORBIT_FACTS,
  ORBIT_IMAGE,
  ORBIT_PLANS,
  ORBIT_READ_ON,
  ORBIT_WEBHOOK_PORT,
  type OrbitPlan,
  orbitPlanById,
  orbitPlanQuoteUsd,
  orbitPlanSpec,
} from '@shared/flux';
import { api, both, cmd, docs, fix, forge, guess, lab, live, look, src } from './build';
import { FIGURES as F, usd } from './figures';
import type { Check, SpecExample, Symptom } from './types';

// ---------------------------------------------------------------------------
// Plans, from the engine
// ---------------------------------------------------------------------------

const grouped = (n: number): string => n.toLocaleString('en-US');

const andList = (items: readonly string[]): string => {
  const last = items[items.length - 1];
  if (last === undefined) return '';
  return items.length === 1 ? last : `${items.slice(0, -1).join(', ')} and ${last}`;
};

function planById(id: 'starter' | 'standard' | 'pro'): OrbitPlan {
  const p = orbitPlanById(id);
  if (!p) throw new Error(`unknown Orbit plan ${id}`);
  return p;
}

const STARTER = planById('starter');
const STANDARD = planById('standard');

const plural = (n: number, one: string, many: string): string => (n === 1 ? `${n} ${one}` : `${n} ${many}`);

/** "Starter 1,000 MB, Standard 4,000 MB and Pro 6,000 MB". The page says GB; live specs hold thousands of MB. */
const PLAN_RAM = andList(ORBIT_PLANS.map((p) => `${p.name} ${grouped(p.ramMb)} MB`));
const PLAN_STORAGE = andList(ORBIT_PLANS.map((p) => `${p.name} ${p.storageGb} GB`));
const PLAN_CORES = andList(ORBIT_PLANS.map((p) => `${p.name} ${p.vcores}`));
const PLAN_INSTANCES = andList(ORBIT_PLANS.map((p) => `${p.name} ${p.instances}`));
/** The engine price for each plan size, one month, unencrypted. It equals the published price (FACTS 15.3.11). */
const PLAN_PRICES = andList(ORBIT_PLANS.map((p) => `${p.name} ${usd(orbitPlanQuoteUsd(p))}`));
const PLANS_WITH_FOLDERS = andList(ORBIT_PLANS.filter((p) => p.persistentFolders).map((p) => p.name));
const PLANS_WITH_FAILOVER = andList(ORBIT_PLANS.filter((p) => p.failover).map((p) => p.name));

const CUSTOM_RANGE = `${ORBIT_CUSTOM.vcoresMin} to ${ORBIT_CUSTOM.vcoresMax} vCores, up to ${grouped(ORBIT_CUSTOM.ramMbMax)} MB of RAM, ${ORBIT_CUSTOM.storageGbMin} to ${ORBIT_CUSTOM.storageGbMax} GB of storage and ${ORBIT_CUSTOM.instancesMin} to ${ORBIT_CUSTOM.instancesMax} instances`;

const AGAINST = 'the Orbit page, the Deploy with Git docs and the live app specifications';

/**
 * Appended to every fix that moves the app to another size or plan. An update on the network can change the
 * price and can redeploy the app (FACTS 4.5, 15.1.8), and a hard redeploy removes a plain volume (7.2). How the
 * Orbit dashboard applies a plan change is not in the docs or on the page.
 */
const PLAN_CHANGE =
  'Changing the size or the plan can change the price and can redeploy the app, and a plain folder is lost in a hard redeploy, so copy out any data you need first. How the Orbit dashboard applies the change is not described.';

/** How many of the plain Orbit specs read on the read date publish the webhook port as their last port. */
const WEBHOOK_PORT_SPECS = ORBIT_APP_MARKERS.find((m) => m.id === 'webhook-port')?.observed.matching ?? 0;

/**
 * Counts of the plain Orbit specs read on `ORBIT_FACTS.readOn` (FACTS 15.3.2 and 15.3.6, environment names
 * counted over the same 235 specs). `ORBIT_FACTS` carries the headline counts and not these, so they are
 * written here, once, with their source. They drift, so every sentence that uses one names the read date.
 */
const READ_COUNTS = {
  /** Specs that name a variable called `GIT_TOKEN`. Names only: no value is ever shown. */
  gitTokenNamed: 3,
  /** Specs that set `PROJECT_PATH`. */
  projectPath: 17,
  /** Specs that set `INSTALL_COMMAND`. */
  installCommand: 15,
  /** Specs that pin a region. */
  regionPinned: 98,
  /** Specs that set `POLLING_INTERVAL`, and how many of those use 86,400 seconds. */
  pollingSet: 131,
  pollingDaily: 113,
  /** Specs with a synced mount (one `g:`, one `r:`). */
  syncedMounts: 2,
} as const;

// ---------------------------------------------------------------------------
// Example specs the Spec Forge can open (an Orbit shaped component, FACTS 15.3.2)
// ---------------------------------------------------------------------------

const ORBIT_COMPONENT: Partial<FluxComponentSpec> = {
  name: ORBIT_COMPONENT_NAME,
  description: ORBIT_COMPONENT_NAME,
  repotag: ORBIT_IMAGE,
  ports: [31080, 31090],
  containerPorts: [3000, ORBIT_WEBHOOK_PORT],
  domains: ['', ''],
  environmentParameters: ['GIT_REPO_URL=https://github.com/example/app', 'APP_PORT=3000', 'GIT_BRANCH=main'],
  containerData: '/app',
  cpu: 0.5,
  ram: 1000,
  hdd: 5,
};

function orbitExample(component: Partial<FluxComponentSpec>, shows: readonly string[]): SpecExample {
  return {
    fixture: 'hello-world',
    patch: { compose: [{ ...ORBIT_COMPONENT, ...component }] },
    shows,
  };
}

function planExample(plan: OrbitPlan, shows: readonly string[] = []): SpecExample {
  return { fixture: 'hello-world', patch: orbitPlanSpec(plan), shows };
}

// ---------------------------------------------------------------------------
// Checks that more than one symptom uses
// ---------------------------------------------------------------------------

/** The webhook port is a second public port; this is the address FDM builds for it (FACTS 6.4). */
const WEBHOOK_HOST = 'https://{app}_<second public port>.app.runonflux.io';

const BUILD_LOG: Check = look(
  'Open the app in the Orbit dashboard and read the build log from the top. The Orbit page says builds stream their logs there. The line that names the command that stopped is the one to start from.',
);

const STATUS_CHECK: Check = cmd(
  'Ask the app what it is doing, and what failed last, on its webhook port',
  `curl -s ${WEBHOOK_HOST}/status`,
  'The Webhook API page of the docs describes the answer. `status` is `idle` or `deploying`. While a deployment runs, `stage` names the step. After a failure, `last_failed_deployment` holds the commit and a `reason`. If the app set `API_KEY` the answer is 401 until you add `-H "Authorization: Bearer <key>"`. If this address does not answer, use the one the Orbit dashboard shows for the second port.',
);

const HEALTH_CHECK: Check = cmd(
  'Ask the app whether Orbit sees it answering, on its webhook port',
  `curl -s ${WEBHOOK_HOST}/health`,
  'The Webhook API page of the docs describes the answer. `healthy` is `true` and `app_status` is `running` when something answers on `app_port`. `not_responding` with `supervisor_status` `STOPPED` means nothing answers there. The Webhook API page says this address is public even when `API_KEY` is set, and the environment reference says `API_KEY` covers it too; the two pages disagree, so if you get a 401, send the key.',
);

const REPO_ADDRESS = 'https://github.com/OWNER/REPO';

const BUTTON_EXAMPLE = {
  repo: 'https://github.com/RunOnFlux/deploy-with-git-samples',
  branch: 'master',
  projectPath: 'express',
  plan: 'standard',
};

export const GIT_SYMPTOMS: Symptom[] = [
  // ---- before the build: the repository --------------------------------------------------------------
  {
    id: 'git-cannot-clone',
    stage: 'git',
    title: 'Orbit cannot clone my repository',
    summary:
      'The first step fails: the repository is not found, authentication fails or the address is refused.',
    seen: [
      'Failed to clone repository',
      'Repository not found',
      'Authentication failed',
      'The build log stops in its first lines',
    ],
    keywords: [
      'clone',
      'git clone',
      'repository not found',
      'authentication failed',
      'private repository',
      'private repo',
      'git token',
      'personal access token',
      'github',
      'gitlab',
      'bitbucket',
      'branch',
      'repository url',
      'orbit',
    ],
    quick:
      'Orbit clones the address in `GIT_REPO_URL` at the branch in `GIT_BRANCH`, which is `main` when you set none. It needs the full https address, and a private repository needs a token that can read it. Check the address, then the branch, then the token.',
    checkedAgainst: AGAINST,
    notice: {
      title: 'A token in a plain spec is public',
      text: `If you register the Orbit image yourself in FluxCloud and put \`GIT_TOKEN\` in the environment of an ordinary app, anyone can read it at the public address of the spec. The read of ${ORBIT_FACTS.readOn} found ${READ_COUNTS.gitTokenNamed} plain Orbit specs with a variable called \`GIT_TOKEN\` in the open. The Orbit page says private repositories and secret variables are deployed encrypted. If a token was ever readable, revoke it on your Git host and make a new one.`,
    },
    causes: [
      {
        id: 'address-form',
        title: 'The address is not a full https repository URL',
        why: 'The repository is given as a full https address such as `https://github.com/owner/repo`, scheme included. The docs show a missing `https://` as the typo to look for, and the ending `.git` is optional. The Deploy to Flux button asks for a full HTTPS URL too.',
        likelihood: 'usual',
        checks: [
          look(
            'Compare `GIT_REPO_URL` (the repository field in the Orbit dashboard) with the address bar of your repository page. It starts with `https://` and names the owner and the repository, with nothing after it.',
          ),
          cmd(
            'Ask Git whether the address answers',
            `git ls-remote ${REPO_ADDRESS} HEAD`,
            'A line with a commit id and `HEAD` means the address is right and the repository is public. A prompt for a user name, or an error, means it is private or the address is wrong.',
          ),
        ],
        fixes: [
          fix(
            'Use the full address with `https://`, and no query string or page path after the repository name.',
          ),
        ],
        proof: docs(
          '15.3.18 row 6; 9.8.2; 15.3.12',
          'The missing scheme is the first of the clone failures on the docs troubleshooting page, as the Orbit environment reference lists them.',
        ),
        lessons: ['deploy-from-git'],
        terms: ['git-deploy', 'flux-orbit'],
      },
      {
        id: 'private-no-token',
        title: 'The repository is private and Orbit has no token',
        why: 'A private repository needs a personal access token in `GIT_TOKEN`, and the docs ask for the `repo` scope on GitHub. Without one the clone is refused and the log says the repository was not found or that authentication failed. The Orbit page says private repositories are supported on every plan.',
        likelihood: 'usual',
        checks: [
          cmd(
            'Try the clone without a token, the way Orbit would without one',
            `git ls-remote ${REPO_ADDRESS} HEAD`,
            'A prompt for a user name, or "repository not found", means the repository is private or the address is wrong. A public repository answers at once.',
          ),
          forge(
            'See what the Spec Forge says about a token written into a plain spec',
            orbitExample(
              {
                environmentParameters: [
                  'GIT_REPO_URL=https://github.com/example/app',
                  'APP_PORT=3000',
                  'GIT_TOKEN=token-value-0123456789',
                ],
              },
              ['ENV_SECRET_PUBLIC'],
            ),
            'ENV_SECRET_PUBLIC: anyone can read a public spec, so a token there is published.',
          ),
        ],
        fixes: [
          fix(
            'Create a token on your Git host that can read this one repository, and add it as `GIT_TOKEN` in Orbit. Use the narrowest access your host offers, ideally read only.',
            {
              proof: guess(
                '15.3.18 row 6; 15.3.9; 15.3.6',
                'The docs ask for the `repo` scope. Which narrower tokens your Git host offers is general Git hosting knowledge, not a Flux fact.',
              ),
            },
          ),
        ],
        proof: docs(
          '15.3.9; 15.3.6',
          'Private repository support and the deployed-encrypted statement are the Orbit page statements.',
        ),
        lint: ['ENV_SECRET_PUBLIC'],
        see: ['secrets-visible'],
        lessons: ['deploy-from-git', 'env-and-secrets'],
        terms: ['git-deploy', 'enterprise-app'],
      },
      {
        id: 'token-refused',
        title: 'The token is expired, revoked or cannot read this repository',
        why: 'A token that has expired, was revoked, or was made without access to this repository is refused the way a missing token is. Your Git host decides what a token may read and for how long, not Orbit.',
        likelihood: 'common',
        checks: [
          look(
            'On your Git host open the token page. Check its expiry date and which repositories it can read.',
          ),
        ],
        fixes: [
          fix(
            'Make a new token with access to this repository, replace `GIT_TOKEN`, deploy again, and revoke the old token.',
          ),
        ],
        proof: guess(
          '15.3.9',
          'The docs name a missing token and a wrong address as the causes. That an expired or under-scoped token fails the same way is our reading of how Git hosts behave.',
        ),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'branch-name',
        title: 'The branch is not the one GIT_BRANCH names',
        why: 'Orbit deploys the branch in `GIT_BRANCH`, and `main` when none is set. A repository whose default branch is `master`, or a branch that was renamed, is not found under `main`. What the log says for a missing branch is not recorded in the docs.',
        likelihood: 'common',
        checks: [
          cmd(
            'List the branches the remote has',
            `git ls-remote --heads ${REPO_ADDRESS}`,
            'Find `refs/heads/<your branch>` in the list and compare it with the branch in Orbit, letter for letter.',
          ),
        ],
        fixes: [fix('Set `GIT_BRANCH` to the exact branch name and deploy again.')],
        proof: docs('15.3.4; 15.3.5; 9.8.2'),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'repo-moved',
        title: 'The repository was renamed, moved or made private after you deployed',
        why: 'The address is stored when you deploy and used again on every pull. A renamed or deleted repository, or one that has become private, fails the next clone or pull the way a wrong address does.',
        likelihood: 'possible',
        checks: [
          cmd(
            'Check that the stored address still answers',
            `git ls-remote ${REPO_ADDRESS} HEAD`,
            'The same line with a commit id as above. Use the address exactly as it is stored in Orbit.',
          ),
        ],
        fixes: [
          fix(
            'Update the repository address in Orbit, add a token if the repository is private now, and deploy again.',
          ),
        ],
        proof: guess(
          '15.3.4; 15.3.5',
          'The docs say the app clones and pulls the address it was given. What the log shows for a renamed repository is not recorded.',
        ),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'host-unreachable',
        title: 'The Git host could not be reached',
        why: 'The docs troubleshooting page lists a Git host that cannot be reached among the clone and pull failures, under network issues. A short outage of the host should fail a deploy the way a wrong address does and pass by itself; the docs do not say what the log prints.',
        likelihood: 'rare',
        checks: [
          look(
            'Open your Git host in a browser and run the `git ls-remote` check above from your own machine.',
          ),
        ],
        fixes: [
          fix(
            'Wait a few minutes and deploy again. If one host fails for everything you do, it is the host.',
          ),
        ],
        proof: docs(
          '9.8.2; 15.3.4',
          'The docs troubleshooting page names it as a clone failure. It is not one of the rows of the failures table in the research notes, and how often it happens is not recorded.',
        ),
        lessons: ['deploy-from-git'],
      },
    ],
    lessons: ['deploy-from-git', 'env-and-secrets'],
    labs: ['spec-forge'],
    related: ['git-build-failed', 'git-monorepo-wrong-folder', 'secrets-visible'],
    lint: ['ENV_SECRET_PUBLIC'],
  },

  {
    id: 'git-monorepo-wrong-folder',
    stage: 'git',
    title: 'Orbit built the wrong folder of my monorepo',
    summary:
      'The build runs from the repository root, finds no project or the wrong one, or a hook script is not found.',
    seen: [
      'The build uses the files of the repository root',
      'The wrong runtime is detected',
      'A hook script is not found',
    ],
    keywords: [
      'monorepo',
      'project path',
      'PROJECT_PATH',
      'projectPath',
      'subfolder',
      'subdirectory',
      'workspace',
      'apps/web',
      'folder',
      'wrong app',
      'orbit',
    ],
    quick:
      'Orbit builds the repository root unless `PROJECT_PATH` names a folder. In a monorepo set it to the folder that holds the manifest of the app (`package.json`, `requirements.txt`, `go.mod` and so on), written from the repository root. The Deploy to Flux button calls the same setting `projectPath`.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'path-unset',
        title: 'No project path is set, so Orbit builds the repository root',
        why: 'Orbit detects the project from the files it finds: a `package.json` with a lock file for Node.js, `requirements.txt` or `pyproject.toml` for Python, `go.mod`, `Cargo.toml` and so on. In a monorepo the root usually holds none of them, or the manifest of a different project.',
        likelihood: 'usual',
        checks: [
          look(
            'Read the first lines of the build log. If the build is using the repository root, or detects a runtime you did not expect, the project path is probably missing. The docs do not say what the log prints in this case.',
          ),
        ],
        fixes: [
          fix('Set `PROJECT_PATH` to the folder of the app, relative to the repository root.', {
            snippet: {
              lang: 'text',
              code: 'PROJECT_PATH=apps/web',
              label: 'In the Orbit settings, as an environment variable',
            },
          }),
        ],
        proof: docs(
          '15.3.18 row 8; 15.3.4; 15.3.6',
          `The docs give the repository root as the default. What the log shows for a missing path is not in the docs. The read of ${ORBIT_FACTS.readOn} found ${READ_COUNTS.projectPath} plain Orbit specs that set \`PROJECT_PATH\`.`,
        ),
        lessons: ['deploy-from-git'],
        terms: ['monorepo', 'git-deploy'],
      },
      {
        id: 'path-wrong',
        title: 'The path is not the folder that holds the manifest',
        why: 'The value is a folder inside the repository, written from its root, such as `apps/web`. A parent folder, a typo, or a folder that holds only source files and not the manifest does not give Orbit a project to detect.',
        likelihood: 'common',
        checks: [
          cmd(
            'List every folder that holds a manifest',
            "git ls-files | grep -E '(package\\.json|requirements\\.txt|pyproject\\.toml|go\\.mod|Cargo\\.toml|pom\\.xml|Gemfile|composer\\.json)$'",
            'Choose the folder of the app you want. That folder, relative to the root, is the project path.',
          ),
        ],
        fixes: [
          fix('Use the folder exactly as the command lists it, with no leading slash and nothing after it.'),
        ],
        proof: docs(
          '15.3.18 row 8; 9.8.2',
          'The docs examples are `frontend`, `apps/web` and `services/api`.',
        ),
        lessons: ['deploy-from-git'],
        terms: ['monorepo'],
      },
      {
        id: 'workspace-deps',
        title: 'The app needs files from outside its folder',
        why: 'Orbit builds from the folder you name. A project that imports a shared package from a sibling folder, or installs through a lock file kept at the repository root, can build on your machine and fail here. The docs do not describe how workspaces are installed.',
        likelihood: 'possible',
        checks: [
          look(
            'Make a clean clone of the repository, go into the project folder and run the same install and build commands Orbit would. If that fails there, it fails in Orbit.',
          ),
        ],
        fixes: [
          fix(
            'Make the project folder build on its own: keep its lock file beside its manifest, or publish the shared code as a package. Where that is not possible, build your own image and deploy it as a Docker image.',
          ),
        ],
        proof: guess(
          '15.3.4; 15.3.6',
          'The docs say how `PROJECT_PATH` picks the folder to deploy and do not describe workspace installs. This cause is our reading and was not tried on Orbit.',
        ),
        lessons: ['deploy-from-git', 'first-deploy'],
      },
      {
        id: 'hook-location',
        title: 'A hook script is not where Orbit looks',
        why: 'Orbit looks for `pre-deploy.sh` and `post-deploy.sh` in the project folder first and then in the repository root. A hook kept in a sibling folder is never run.',
        likelihood: 'rare',
        checks: [look('Find the hook files in your repository and note the folder each one is in.')],
        fixes: [
          fix(
            'Put each hook in the project folder or in the repository root, start it with `#!/bin/bash` and commit it.',
          ),
        ],
        proof: docs(
          '15.3.6; 9.8.2',
          'The lookup order is on the deployment hooks page of the docs, under monorepo support.',
        ),
        lessons: ['deploy-from-git'],
      },
    ],
    lessons: ['deploy-from-git'],
    related: ['git-build-failed', 'git-wont-start'],
  },

  // ---- the build, the start and the health check -------------------------------------------------------
  {
    id: 'git-build-failed',
    stage: 'git',
    title: 'The build failed',
    summary: 'Orbit cloned the repository, and the install or the build stopped with an error.',
    seen: [
      'Build failed',
      'Cannot find module',
      'JavaScript heap out of memory',
      'FATAL ERROR: Ineffective mark-compacts near heap limit',
      'The app shows old code',
    ],
    keywords: [
      'build failed',
      'build error',
      'build command',
      'npm run build',
      'cannot find module',
      'missing module',
      'out of memory',
      'heap',
      'node version',
      'python version',
      'install failed',
      'dependencies',
      'native module',
      'compile error',
      'orbit',
      'heap out of memory',
      'javascript heap',
      'mark-compacts',
    ],
    quick:
      'A build has two steps that can fail: the install of your dependencies and your build command. A failed build never replaces a working deployment, the Orbit page says, so an earlier release can keep serving while the log shows the error. Read the last lines of the build log: the command that stopped is named there.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'build-command',
        title: 'The build command is not the one your project uses',
        why: 'Orbit runs the detected build command, which for Node.js is the `build` script. A project that builds with another script, such as `build:production`, gets one of two results that the docs list under the same cause: a failed build, or an app that serves old code.',
        likelihood: 'usual',
        checks: [
          BUILD_LOG,
          cmd(
            'List the scripts your project defines',
            'npm run',
            'Compare with the command the build log names. The script you build with may have another name.',
          ),
        ],
        fixes: [
          fix('Set `BUILD_COMMAND` to the full command and deploy again.', {
            snippet: {
              lang: 'text',
              code: 'BUILD_COMMAND=npm run build:production',
              label: 'An example value',
            },
          }),
        ],
        proof: docs('15.3.18 row 2; 15.3.6; 9.8.2'),
        lessons: ['deploy-from-git'],
        terms: ['git-deploy'],
      },
      {
        id: 'deps-missing',
        title: 'A dependency did not install cleanly',
        why: 'The docs give `Cannot find module` as the sign of dependencies that did not install cleanly. Orbit picks the package manager from your lock file and skips the install when the lock files have not changed, so a lock file that is missing from the repository, or a bad earlier install, is where to look. `FORCE_INSTALL` ignores that cache.',
        likelihood: 'common',
        checks: [
          look(
            'Find the first `Cannot find module` line and compare the package with your manifest and your lock file.',
          ),
          cmd(
            'Install from a clean clone, as Orbit would',
            `git clone --depth 1 ${REPO_ADDRESS} /tmp/orbit-check && cd /tmp/orbit-check && npm ci`,
            'If this fails on your machine, fix that first: Orbit uses the same lock file.',
          ),
        ],
        fixes: [
          fix(
            'Commit the lock file. Set `FORCE_INSTALL=true` for one deploy to reinstall and ignore the cache, or set `INSTALL_COMMAND` (for example `npm ci`).',
          ),
        ],
        proof: docs(
          '15.3.18 row 4; 15.3.6; 9.8.2',
          `\`INSTALL_COMMAND\` is in the Node.js guide and in ${READ_COUNTS.installCommand} of the plain Orbit specs read on ${ORBIT_FACTS.readOn}.`,
        ),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'out-of-memory',
        title: 'The build ran out of memory',
        why: `The container has the RAM of your plan: ${PLAN_RAM} at the time of writing, and Custom goes up to ${grouped(ORBIT_CUSTOM.ramMbMax)} MB. The image sets the Node.js heap to 75 percent of that RAM, between 1,024 and 8,192 MB, and a build that needs more stops with a heap error. The docs guide suggests 2 to 3 GB for a small app such as a simple React or Vue front end, 3 to 4 GB for Next.js and dashboards, and 6 to 8 GB for large apps.`,
        likelihood: 'common',
        checks: [
          look(
            'Look for `JavaScript heap out of memory` or `Ineffective mark-compacts near heap limit` in the build log.',
          ),
        ],
        fixes: [
          fix(
            `Move to a plan or a Custom size with more RAM, then deploy again. The Spec Forge prices a size with the network formula: ${STANDARD.name} comes to ${usd(orbitPlanQuoteUsd(STANDARD))} a month at the rates read on ${F.ratesDate}. ${PLAN_CHANGE}`,
            {
              lab: {
                lab: 'spec-forge',
                label: `Open a ${STANDARD.name} sized Orbit spec`,
                spec: planExample(STANDARD),
              },
            },
          ),
        ],
        proof: docs(
          '15.3.18 row 5; 15.3.10; 15.3.6.1',
          'The plan sizes are the Orbit page read on 2026-10-13. The memory sizes are the docs guidance, not measured.',
        ),
        lessons: ['deploy-from-git', 'resources-pricing'],
        see: ['git-plan-limits'],
      },
      {
        id: 'runtime-version',
        title: 'Orbit installed another runtime version than the one you use',
        why: 'The version comes from the variable (`NODE_VERSION`, `PYTHON_VERSION` and so on), then from a version file such as `.nvmrc` or `.python-version`, then from a documented default: the latest Node.js LTS, Python 3.11 and so on. A project written for a newer version fails on a syntax error or a missing feature.',
        likelihood: 'possible',
        checks: [
          look(
            'Find the line in the build log that prints the installed version and compare it with the one you develop with.',
          ),
        ],
        fixes: [
          fix('Set the version variable, or commit the version file for your language, and deploy again.', {
            snippet: { lang: 'text', code: 'NODE_VERSION=20.11.0', label: 'An example value' },
          }),
        ],
        proof: docs('15.3.18 row 7; 15.3.4'),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'native-build',
        title: 'A native package needs a system tool the image does not have',
        why: 'The Orbit image ships `build-essential` and no more. A package that compiles C code and needs another system library fails with a compiler error in the build log.',
        likelihood: 'rare',
        checks: [look('Look for a compiler or linker error that names a missing header or library.')],
        fixes: [
          fix(
            'Choose a release of the package with prebuilt binaries, or a different package. If you need system libraries the image does not ship, build your own image with a Dockerfile and deploy that as a Docker image.',
            {
              proof: guess(
                '15.3.18 row 14; 9.8.2',
                'The docs say only that the image ships `build-essential` and suggest prebuilt binaries. Deploying your own image for this case is our suggestion, and nothing tested it.',
              ),
            },
          ),
        ],
        proof: docs(
          '15.3.4; 9.8.2',
          'That the image ships `build-essential` is the docs troubleshooting page.',
        ),
        lessons: ['deploy-from-git', 'containers-101'],
      },
    ],
    lessons: ['deploy-from-git'],
    labs: ['spec-forge'],
    related: ['git-wont-start', 'git-rolled-back', 'git-plan-limits'],
  },

  {
    id: 'git-wont-start',
    stage: 'git',
    title: 'The build passed, but the app does not start',
    summary: 'The process exits within seconds, or the supervisor shows it as FATAL or BACKOFF.',
    seen: [
      'FATAL',
      'BACKOFF',
      'The application log ends seconds after the start line',
      'The container restarts every few seconds',
    ],
    keywords: [
      'will not start',
      'not starting',
      'fatal',
      'backoff',
      'exits immediately',
      'start command',
      'run command',
      'start script',
      'no start script',
      'npm start',
      'crash',
      'supervisor',
      'orbit',
      'app does not start',
      'app will not start',
      'application will not start',
    ],
    quick:
      'Orbit starts your app with the `start` script, the main file or `RUN_COMMAND`. If that command does not exist, or the process exits by itself, the application log stops within seconds of the start line and the supervisor shows FATAL or BACKOFF. Read the last lines of the application log, then set `RUN_COMMAND` if the command is the problem.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'no-start-command',
        title: 'There is no start script, or Orbit chose the wrong start command',
        why: 'For Node.js Orbit runs the `start` script or the main file. A project with neither, or whose real entry is something like `dist/server.js` or a framework command, exits at once. The docs give this as the usual reason for FATAL and BACKOFF.',
        likelihood: 'usual',
        checks: [
          look(
            'Read the end of the application log. An error about a missing start script, or no output at all, points here.',
          ),
          cmd(
            'See which scripts exist',
            'npm run',
            'No `start` entry means Orbit has no start script to run unless you set one.',
          ),
        ],
        fixes: [
          fix('Set `RUN_COMMAND` to the command that starts your server and deploy again.', {
            snippet: { lang: 'text', code: 'RUN_COMMAND=node dist/server.js', label: 'An example value' },
          }),
        ],
        proof: docs('15.3.18 row 3; 15.3.6; 9.8.2'),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'crashes-at-start',
        title: 'The app starts, then crashes on a missing setting or a failed connection',
        why: `The process runs your code with the variables you set and nothing else. A database address, a key or a port that is missing makes many apps throw at start. If the container itself exits, FluxOS restarts it with growing gaps: ${F.crashLadder}.`,
        likelihood: 'common',
        checks: [
          look(
            'Read the application log from the start line to the first error. The error names the missing variable, file or host.',
          ),
        ],
        fixes: [
          fix(
            'Set the missing variable and deploy again. In a plain spec every value is public, so keep keys and tokens in the secret variables of the dashboard.',
          ),
        ],
        proof: src(
          '6.3; 11 row 21; 15.3.6',
          'The restart ladder, and a missing setting as a reason for a container to exit, are read in FluxOS source. That this is the usual reason for an Orbit app is our reading of the docs entry "application crashes immediately".',
        ),
        see: ['container-crash-loop'],
        lessons: ['deploy-from-git', 'env-and-secrets'],
        terms: ['crash-loop', 'environment-parameters'],
      },
      {
        id: 'needs-memory',
        title: 'The app needs more memory than the plan has',
        why: 'A plan has a fixed amount of RAM. A process that needs more is killed and started again, which looks like a crash at start. The docs list running out of memory among the reasons a container keeps restarting.',
        likelihood: 'possible',
        checks: [
          look(
            'Look for a heap error from your runtime, or a process that ends with no message, near the end of the log.',
          ),
        ],
        fixes: [fix('Use a plan or a Custom size with more RAM.')],
        proof: docs('15.3.18 row 3; 15.3.10; 9.8.2'),
        see: ['git-plan-limits'],
        lessons: ['deploy-from-git', 'resources-pricing'],
      },
    ],
    lessons: ['deploy-from-git', 'operate-your-app'],
    related: ['git-build-failed', 'git-rolled-back', 'container-crash-loop'],
  },

  {
    id: 'git-rolled-back',
    stage: 'git',
    title: 'The app started, and Orbit rolls the deployment back',
    summary: 'The health check does not pass, a hook fails or the deployment runs out of time.',
    seen: ['health_check', 'Hook failed with exit code', 'last_failed_deployment', 'timeout_seconds'],
    keywords: [
      'rollback',
      'rolled back',
      'health check',
      'health check failed',
      'pre-deploy',
      'hook failed',
      'deployment timeout',
      'unhealthy',
      'APP_PORT',
      'port mismatch',
      'orbit',
    ],
    quick:
      'Orbit checks the app before it keeps a release: it requests `/` on `APP_PORT` and expects a 2xx or 3xx answer, after a few attempts. If that fails, a hook exits with an error, or the whole deployment runs past its time limit, Orbit goes back to the last release that worked, and the docs keep three. A first deployment has no earlier release to return to.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'port-mismatch',
        title: 'APP_PORT is not the port the app listens on',
        why: 'The health check requests `/` on `APP_PORT`. If your server listens on another port, nothing answers there and the check fails after its attempts. When you register the Orbit image yourself, the container port in the spec must equal `APP_PORT` too.',
        likelihood: 'usual',
        checks: [
          look(
            'Read the application log for the port the server prints at start and compare it with `APP_PORT` in the Orbit settings.',
          ),
          HEALTH_CHECK,
          forge(
            'See the warning for an APP_PORT that is not in containerPorts',
            orbitExample({ containerPorts: [8080, ORBIT_WEBHOOK_PORT] }, ['PORT_ENV_MISMATCH']),
            'PORT_ENV_MISMATCH: the environment says 3000 and containerPorts says 8080.',
          ),
        ],
        fixes: [
          fix(
            'Set `APP_PORT` to the port the code really listens on, and make the container port in the spec the same.',
            {
              proof: guess(
                '15.3.18 rows 1 and 12; 11 row 1; 9.8.2',
                'The docs say `APP_PORT` is the port your application listens on. They do not say whether Orbit passes it on as `PORT`, so make the code listen on the port you set.',
              ),
            },
          ),
        ],
        proof: docs('15.3.4; 11 row 1; 9.8.2'),
        lint: ['PORT_ENV_MISMATCH'],
        lessons: ['deploy-from-git', 'ports-and-domains'],
        terms: ['container-ports', 'healthcheck'],
      },
      {
        id: 'root-not-ok',
        title: 'The app answers the root path with an error',
        why: 'The check is an HTTP GET of `/` that expects a 2xx or 3xx status. An app that answers `/` with 404, 401 or 500, or that serves only paths such as `/api`, fails the check while it runs perfectly.',
        likelihood: 'common',
        checks: [
          cmd(
            'Request the root path locally and print the status',
            'curl -s -o /dev/null -w "%{http_code}\\n" http://localhost:3000/',
            'A 2xx or 3xx status passes the check. A 4xx or 5xx status fails it.',
          ),
        ],
        fixes: [
          fix(
            'Serve a 200 or a redirect on `/`, or add a `.flux-pod/health-check` script, which the docs name as the alternative to the HTTP request.',
          ),
        ],
        proof: docs('15.3.18 row 12; 9.8.2'),
        lessons: ['deploy-from-git'],
        terms: ['healthcheck'],
      },
      {
        id: 'slow-start',
        title: 'The app needs longer to start than the check waits',
        why: 'The check makes a few attempts a few seconds apart: three attempts ten seconds apart by default. An app that warms a cache or runs migrations before it listens can miss that window.',
        likelihood: 'common',
        checks: [
          look(
            'Compare the time from the start line to the first "listening" line in the application log with the check window.',
          ),
        ],
        fixes: [
          fix(
            'Raise `HEALTH_CHECK_RETRIES` (1 to 10) or `HEALTH_CHECK_DELAY` (5 to 60 seconds). Do not set `SKIP_HEALTH_CHECK` to get past it: the docs say it is for testing only.',
          ),
        ],
        proof: docs(
          '15.3.18 row 12; 9.8.2',
          'The environment reference gives 3 attempts 10 seconds apart and the hooks page says 60 seconds. The two figures are not reconciled.',
        ),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'pre-deploy-hook',
        title: 'pre-deploy.sh exited with an error',
        why: "The hook runs before the app starts. The hooks page puts it after the dependencies install and before the build; the environment reference says after the build. A non-zero exit, or a run longer than `HOOK_TIMEOUT` (60 to 3600 seconds, 300 by default), stops the deployment and rolls it back, the docs say. A failing database migration is the docs' own example.",
        likelihood: 'common',
        checks: [
          look(
            'Look for the output of the hook in the logs. The docs write it to `hooks.log`, and a failure shows "Hook failed with exit code".',
          ),
        ],
        fixes: [
          fix(
            'Fix the script, make it safe to run twice and test it locally. Set `SKIP_HOOKS=true` for one deploy to see whether the hook is the cause.',
          ),
        ],
        proof: docs(
          '15.3.18 row 11; 15.3.7; 15.3.4; 9.8.2',
          'Where the hook sits against the build differs between two docs pages (15.3.4) and was not tested.',
        ),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'deployment-timeout',
        title: 'The build or a hook ran past the deployment time limit',
        why: 'A deployment may take `DEPLOYMENT_TIMEOUT` seconds: 1800 (thirty minutes) by default, from 300 to 7200. Past that Orbit stops it and rolls back.',
        likelihood: 'possible',
        checks: [
          STATUS_CHECK,
          look(
            'A rollback after about thirty minutes of building is the pattern. While a deployment runs, the status shows its `duration_seconds` against `timeout_seconds`.',
          ),
        ],
        fixes: [
          fix(
            'Make the build faster: an unchanged lock file lets the install be skipped. Or raise `DEPLOYMENT_TIMEOUT`, up to 7200.',
          ),
        ],
        proof: docs('15.3.18 row 13; 15.3.7; 9.8.2'),
        lessons: ['deploy-from-git'],
      },
    ],
    lessons: ['deploy-from-git', 'operate-your-app'],
    labs: ['spec-forge'],
    related: ['git-deployed-no-answer', 'git-wont-start', 'git-build-failed'],
    lint: ['PORT_ENV_MISMATCH'],
  },

  {
    id: 'git-deployed-no-answer',
    stage: 'git',
    title: 'Orbit shows the app as live, but its address does not answer',
    summary: 'The release is running in Orbit and the app address gives a 502, a 503 or nothing.',
    seen: [
      '502 Bad Gateway',
      '503 Service Unavailable',
      'Connection refused',
      'The app answers on the node and not on its address',
    ],
    keywords: [
      '502',
      '503',
      'not answering',
      'no response',
      'bad gateway',
      'address',
      'app domain',
      'app.runonflux.io',
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      'bind',
      'orbit',
    ],
    quick:
      'A release that Orbit calls healthy does not show that the public address answers. Check what the server binds to, then which address you are using, then whether the load balancer has seen the new copy yet.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'binds-localhost',
        title: 'The server listens on 127.0.0.1',
        why: 'Published ports reach the container on its own network interface, not on loopback, so a server bound to 127.0.0.1 or localhost accepts nothing from outside. The docs say the health check requests `http://localhost:` followed by `APP_PORT`, which a server bound to loopback answers, so Orbit can call the release healthy while the public address fails.',
        likelihood: 'usual',
        checks: [
          look(
            'Find the line in the application log that prints where the server listens. `127.0.0.1` or `localhost` is the sign, and `0.0.0.0` is right.',
          ),
          forge(
            'See the warning for a host variable set to 127.0.0.1',
            orbitExample(
              {
                environmentParameters: [
                  'GIT_REPO_URL=https://github.com/example/app',
                  'APP_PORT=3000',
                  'HOST=127.0.0.1',
                ],
              },
              ['BIND_LOCALHOST'],
            ),
            'BIND_LOCALHOST: a process bound to 127.0.0.1 accepts nothing from outside the container.',
          ),
        ],
        fixes: [
          fix(
            'Make the server listen on `0.0.0.0`, for example with `--host 0.0.0.0` or `HOST=0.0.0.0`, and deploy again.',
          ),
        ],
        proof: src(
          '11 row 2; 8.1',
          'The port publishing rule is read in source. That the health check of Orbit passes with a localhost bind is our reading of the docs line that it requests localhost on `APP_PORT`, and was not tested on Orbit.',
        ),
        lint: ['BIND_LOCALHOST'],
        see: ['connection-refused', 'url-502-503'],
        lessons: ['ports-and-domains', 'deploy-from-git'],
        terms: ['bind-address'],
      },
      {
        id: 'wrong-address',
        title: 'You are using the address of another port',
        why: 'The plain address `<name>.app.runonflux.io` goes to the first published port of the app. Orbit publishes a second port for the webhook, and that port has its own address built from its public port. The container port is never part of an address.',
        likelihood: 'common',
        checks: [
          look(
            'Open the app in Orbit and copy the address it shows for the app. Compare it with the one you typed.',
          ),
        ],
        fixes: [
          fix(
            'Use `<name>.app.runonflux.io` for the app and `<name>_<public port>.app.runonflux.io` for another port, with the public port and not the container port.',
          ),
        ],
        proof: both('6.4; 11 row 3; 15.3.2'),
        see: ['wrong-app-url'],
        lessons: ['ports-and-domains'],
        terms: ['app-domain'],
      },
      {
        id: 'balancer-lag',
        title: 'The load balancer has not seen the new copy yet',
        why: 'After a copy announces itself, the load balancer reads the list of running copies on its own cycle: tens of seconds at the earliest, and sometimes minutes. A new app can answer 502 or 503 for a little while after Orbit says it is up.',
        likelihood: 'possible',
        checks: [
          api(
            'location',
            'A row for your app means a copy has announced itself. Wait a few minutes and request the address again.',
          ),
        ],
        fixes: [fix('Wait a few minutes before you change anything.')],
        proof: src(
          '6.1 step 13',
          'The mechanism and intervals are read in source. The end to end delay was not timed live.',
        ),
        lessons: ['how-apps-run'],
        terms: ['fdm'],
      },
    ],
    lessons: ['deploy-from-git', 'ports-and-domains'],
    related: ['git-rolled-back', 'url-502-503', 'connection-refused'],
    lint: ['BIND_LOCALHOST'],
  },

  // ---- the network side of an Orbit app ---------------------------------------------------------------
  {
    id: 'git-not-running',
    stage: 'git',
    title: 'Orbit lists my app, but no copy of it is running',
    summary: 'The app is registered and listed, and the network lists no running instance for it.',
    seen: ['Registered but never installs', 'No instance listed', 'Application: {app} not found'],
    keywords: [
      'not running',
      'no instance',
      'no running copy',
      'listed but not running',
      'registered',
      'never starts',
      'blocklist',
      'blocked',
      'explorer',
      'orbit',
      'no location',
    ],
    quick:
      'Listed on the network is not the same as running. A running copy is a row in the location list of the app, and nodes decline some apps. Rule out the ordinary wait first, then check the list of running copies, then the signed blocklist.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'ordinary-wait',
        title: 'It is still inside the normal install and build time',
        why: `An Orbit app is a plain app on the network, so it goes through the same steps as any other: registration, a payment confirmed in a block, a node that decides on its own timer to take it, and the image pull. A node usually starts installing within ${F.installStartUsual} minutes, a node that is large for a small app waits ${F.spawnRange} minutes first, and a copy can take about two hours. The clone and the build run after that, inside the container on the node.`,
        likelihood: 'usual',
        checks: [
          api(
            'location',
            'No rows means no node has announced a copy yet. A row means a node has the container up, and the build can still be running inside it.',
          ),
          lab('explorer', 'Look the app up in the App Explorer and see which machines run it'),
        ],
        fixes: [
          fix(
            'Give it the time, and read the build log in Orbit for progress. Do not pay again while the app shows as registered.',
          ),
        ],
        proof: both(
          '6.1; 6.6; 15.3.1',
          'The steps up to the announcement are read in source. That the build runs inside the container on the node is read from the shape of live specs: no spec carries a per-app image.',
        ),
        see: ['app-stuck-installing'],
        lessons: ['how-apps-run', 'deploy-from-git'],
        terms: ['spawner', 'location'],
      },
      {
        id: 'payment-not-matched',
        title: 'The network has no paid registration under that name',
        why: 'The app enters the global list only once a payment that carries its registration hash is confirmed in a block. Orbit takes a card through Stripe, or FLUX through ZelCore or SSP. Without a matched payment no node will ever try to install it.',
        likelihood: 'possible',
        checks: [
          api(
            'appspec',
            '`Application: {app} not found` means there is no confirmed registration under that name.',
          ),
          api('messages', 'A `fluxappregister` entry with your hash and a `height` means it was confirmed.'),
        ],
        fixes: [
          fix(
            'Do not pay a second time until you know the first payment was not matched: see the page on a payment that is not recognised.',
          ),
        ],
        proof: docs(
          '15.3.10; 6.1; 11 row 22',
          'How Orbit hands the payment to the network is the Orbit page statement.',
        ),
        see: ['payment-not-recognised'],
        lessons: ['how-apps-run'],
        terms: ['registration-message'],
      },
      {
        id: 'narrow-placement',
        title: 'Few nodes qualify for the region you chose',
        why: `Some Orbit apps are pinned to a region: the read of ${ORBIT_FACTS.readOn} found ${READ_COUNTS.regionPinned} of ${ORBIT_FACTS.plainOrbitSpecs.value} plain Orbit specs that were. A narrow choice leaves few nodes that qualify.`,
        likelihood: 'possible',
        checks: [
          api(
            'placement',
            'Find your continent and countries and look at `nodes`. A small number means a small pool.',
          ),
        ],
        fixes: [
          fix(
            `Widen the region, or choose to run anywhere, and update the app. An update can redeploy the app and a plain folder is lost in a hard redeploy, so copy out any data you need first, and keep the term: an update on the network replaces \`expire\`.`,
            {
              proof: guess(
                '15.3.2; 3.5',
                'Where, and whether, the Orbit dashboard lets you change the region of an existing app is not described on the Orbit page or in the docs, and the dashboard itself was not opened. The app on the network can be updated with a wider region in any case.',
              ),
            },
          ),
        ],
        proof: both(
          '3.5; 6.2; 15.3.2',
          'The eligibility rules are read in source. The count is the 2026-10-13 reading of the live specs.',
        ),
        see: ['fewer-instances-than-requested'],
        lessons: ['geo-placement'],
        terms: ['geolocation', 'eligible-node'],
      },
      {
        id: 'blocklisted',
        title: 'The network refuses to run it: the owner is on the signed blocklist',
        why: `The chain accepts any registration, and the nodes decide what to run. They enforce a signed blocklist. On ${ORBIT_FACTS.orbitOneInstanceNotRunning.readOn}, ${ORBIT_FACTS.orbitOneInstanceNotRunning.value} single instance Orbit apps were registered and listed but had no running copy, and every one had an owner on that list, with a reason about mass registration of Orbit deployments.`,
        likelihood: 'rare',
        checks: [
          api(
            'policy',
            'The value `payload_b64` decodes to JSON. Look in `documents.blocklist` for an entry whose `value` is your owner address or the hash of your app.',
            'The signed policy bundle',
          ),
        ],
        fixes: [
          fix(
            'If you are on the list, redeploying does not change it. The list and its reasons are public: read the entry, then ask in the Flux community with the app name and the owner address.',
          ),
        ],
        proof: both(
          '15.3.3; 6.2; 11 row 7',
          'The count is the 2026-10-13 reading and drifts. A new app from an ordinary owner is not expected to be on the list; this cause is here because it is the one observed reason an Orbit app was listed and never ran.',
        ),
        lessons: ['how-apps-run'],
        terms: ['network-policy'],
      },
    ],
    lessons: ['how-apps-run', 'deploy-from-git'],
    labs: ['explorer'],
    related: ['app-stuck-installing', 'payment-not-recognised', 'fewer-instances-than-requested'],
  },

  // ---- pushes and webhooks ---------------------------------------------------------------------------
  {
    id: 'git-push-no-deploy',
    stage: 'git',
    title: 'I pushed, and nothing was deployed',
    summary: 'A commit reached the repository and the running app still serves the old version.',
    seen: [
      'The app shows the old version',
      'No delivery in the recent deliveries of the Git host',
      'Only the last of several quick pushes deployed',
    ],
    keywords: [
      'push',
      'pushed',
      'not deploying',
      'not updating',
      'old version',
      'old code',
      'webhook',
      'polling',
      'branch',
      'auto deploy',
      'commit',
      'orbit',
      'push did not deploy',
      'pushed and nothing happened',
      'not deploying after push',
    ],
    quick:
      'An Orbit app deploys one branch, and a push reaches it in one of two ways: a webhook from your Git host, or the app polling the repository on its own interval. Check that you pushed the deployed branch, then how the app learns about a push, then whether a build failed and left the old release serving.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'wrong-branch',
        title: 'You pushed a branch the app does not deploy',
        why: 'One app deploys one branch, the one in `GIT_BRANCH` and `main` when none is set. The docs run staging and production as two apps with different branches. A push to another branch does not change the app.',
        likelihood: 'usual',
        checks: [
          look(
            'Compare the branch you pushed with the branch in the Orbit settings (`GIT_BRANCH`). With none set, the branch is `main`.',
          ),
        ],
        fixes: [
          fix(
            'Push to the deployed branch, or change `GIT_BRANCH`. Use one app for each branch you want live.',
          ),
        ],
        proof: docs('15.3.18 row 10; 15.3.5'),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'only-polling',
        title: 'Only polling is on, and the next check is not due yet',
        why: `With no webhook set up, the app learns about a push only when it polls. \`POLLING_INTERVAL\` runs from 60 to 86,400 seconds, and 0 turns it off. Of the ${READ_COUNTS.pollingSet} plain Orbit specs read on ${ORBIT_FACTS.readOn} that set it, ${READ_COUNTS.pollingDaily} use 86,400, which is a daily check.`,
        likelihood: 'common',
        checks: [
          look(
            'Find `POLLING_INTERVAL` in the settings of the app and compare it with the time since your push.',
          ),
        ],
        fixes: [
          fix(
            'Add a webhook so a push deploys at once, or lower the polling interval. The lowest the docs allow is 60 seconds.',
          ),
        ],
        proof: docs(
          '15.3.5; 15.3.2',
          'The counts are VERIFIED-LIVE on 2026-10-13. Reading 86,400 as the managed default is a reading, not a statement of the product.',
        ),
        lessons: ['deploy-from-git'],
        terms: ['webhook'],
      },
      {
        id: 'failed-build-old-release',
        title: 'The push was built, the build failed and the old release is still serving',
        why: 'A failed build never replaces a working deployment, so the app keeps serving the last good release and looks as though the push was ignored. The status call records the last failed deployment with its reason.',
        likelihood: 'common',
        checks: [STATUS_CHECK, BUILD_LOG],
        fixes: [
          fix('Read the failure in the build log and fix it. Pushing the fix deploys over the old release.'),
        ],
        proof: docs('15.3.18 row 2; 15.3.5; 15.3.7'),
        see: ['git-build-failed'],
        lessons: ['deploy-from-git'],
        terms: ['rollback'],
      },
      {
        id: 'webhook-not-arriving',
        title: 'The webhook never arrives',
        why: 'Your Git host lists each delivery with the status the app answered with. No delivery, or a red cross, means the app never heard of the push.',
        likelihood: 'common',
        checks: [
          look(
            'On your Git host open the webhook and its recent deliveries. A green tick means the delivery arrived.',
          ),
        ],
        fixes: [fix('Follow the page on a webhook that fails, for the status you see there.')],
        proof: docs('15.3.18 row 9; 15.3.5'),
        see: ['git-webhook-failing'],
        lessons: ['deploy-from-git'],
        terms: ['webhook'],
      },
      {
        id: 'queued-or-collapsed',
        title: 'The push was folded into another deployment',
        why: 'Orbit keeps one pending slot. Pushes within 5 seconds are merged, the newest commit wins, and deployments never run at the same time. More than 10 webhook requests a minute from one address are answered with 429. A burst of commits can therefore produce one deployment of the last commit.',
        likelihood: 'possible',
        checks: [STATUS_CHECK],
        fixes: [
          fix(
            'Wait for the running deployment to finish: the newest commit is deployed after it. The status names the commit that is live.',
          ),
        ],
        proof: docs('15.3.18 row 10; 15.3.5'),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'stale-install',
        title: 'The pull worked, but the build used what it had installed before',
        why: 'The docs list "git pull seems to work but code does not update" as a case of its own, and answer it by clearing the installed dependencies and reinstalling. Orbit skips the install when the lock files are unchanged, which is the cache that clearing refers to.',
        likelihood: 'rare',
        checks: [
          look('Compare the commit the status reports as live with the commit you pushed.'),
          STATUS_CHECK,
        ],
        fixes: [
          fix(
            'Set `FORCE_INSTALL=true` for one deploy so the dependencies are reinstalled and the cache is ignored, then remove it.',
            {
              proof: guess(
                '15.3.4; 9.8.2',
                'The docs answer with commands that need a shell in the container, which the dashboard does not give. Using `FORCE_INSTALL` for the same job is our mapping.',
              ),
            },
          ),
        ],
        proof: docs('9.8.2; 15.3.4'),
        lessons: ['deploy-from-git'],
      },
    ],
    lessons: ['deploy-from-git'],
    related: ['git-webhook-failing', 'git-build-failed', 'git-rolled-back'],
  },

  {
    id: 'git-webhook-failing',
    stage: 'git',
    title: 'My Git host shows a red cross on the webhook',
    summary: 'The delivery fails: no answer at all, a 400, a 401 or a 429.',
    seen: [
      'A red cross next to the delivery',
      'Webhook signature verification failed',
      'Invalid payload',
      '401 Unauthorized',
      '429 Too Many Requests',
      'No webhook logs',
    ],
    keywords: [
      'webhook',
      'red cross',
      'red x',
      '401',
      '429',
      'secret',
      'signature',
      'payload url',
      'content type',
      'push event',
      'github',
      'gitlab',
      'bitbucket',
      'webhook secret',
      '9001',
      'orbit',
      'webhook not working',
      'webhook failing',
      'webhook failed',
      'invalid payload',
      '400',
    ],
    quick:
      'The webhook is an HTTP request your Git host sends to the webhook port of the app, which is 9001 inside the container. It needs a published port, the address of that port, a secret that matches `WEBHOOK_SECRET`, and the push event as JSON. The list of deliveries on your Git host shows the status the app answered with.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'address-or-port',
        title: 'The payload URL is not the address of the webhook port',
        why: 'The app has two published ports: the app itself and the webhook listener, which listens on 9001 inside the container (`WEBHOOK_PORT`). The payload URL must be the address of the second one, ending in `/webhook`. The docs write it with a hyphen before the port, `YOUR-APP-9001.app.runonflux.io`. The load balancer source builds an underscore and the public port, `<name>_<public port>.app.runonflux.io`, and which spelling answers was not tested.',
        likelihood: 'usual',
        checks: [
          HEALTH_CHECK,
          look(
            'Open the app in Orbit and copy the address it shows for the second port. Add `/webhook` to it for the payload URL.',
          ),
        ],
        fixes: [fix('Use the address Orbit shows for the second port of the app, followed by `/webhook`.')],
        proof: guess(
          '15.3.18 row 9; 6.4; 15.3.14',
          'The docs spell the address with a hyphen before the port. The load balancer source only builds the underscore form. Which one answers was not tested, so copy the address the dashboard shows for the second port.',
        ),
        see: ['wrong-app-url'],
        lessons: ['deploy-from-git', 'ports-and-domains'],
        terms: ['webhook'],
      },
      {
        id: 'port-not-published',
        title: 'The webhook port is not published',
        why: `Without a public port mapped to ${ORBIT_WEBHOOK_PORT}, nothing outside can reach the listener. The Orbit dashboard registers it for you: ${WEBHOOK_PORT_SPECS} of the ${ORBIT_FACTS.plainOrbitSpecs.value} plain Orbit specs read on ${ORBIT_FACTS.readOn} end their container ports with ${ORBIT_WEBHOOK_PORT}. When you register the image yourself, the second port is one you add.`,
        likelihood: 'common',
        checks: [
          look(
            `Check the spec: \`containerPorts\` should end with ${ORBIT_WEBHOOK_PORT}, with a matching public port in \`ports\`.`,
          ),
        ],
        fixes: [
          fix(
            `If you registered the image yourself, add a second public port whose container port is ${ORBIT_WEBHOOK_PORT}, then update the app. For an app made in the Orbit dashboard the port is registered for you, so start with the other causes.`,
          ),
        ],
        proof: docs('15.3.18 row 9; 15.3.5; 15.3.2', 'The count is VERIFIED-LIVE on 2026-10-13.'),
        lessons: ['deploy-from-git', 'ports-and-domains'],
        terms: ['container-ports'],
      },
      {
        id: 'secret-mismatch',
        title: 'The secret on the Git host is not the one in WEBHOOK_SECRET',
        why: 'GitHub signs each delivery with an HMAC-SHA256 of the body in `X-Hub-Signature-256`, and GitLab sends the secret in `X-Gitlab-Token`. The app answers 401 when verification fails. A trailing space or a different case is a different secret.',
        likelihood: 'common',
        checks: [
          look(
            'Open the failed delivery on your Git host. A 401 answer is a signature or a token that did not match.',
          ),
        ],
        fixes: [
          fix(
            'Put the same secret in both places, by copying it, and then redeliver the failed delivery from your Git host.',
          ),
        ],
        proof: docs(
          '15.3.18 row 9; 15.3.5; 15.3.6.1',
          'The docs also list `WEBHOOK_SIGNATURE_VERIFY` (default false) on the webhook API page only, so whether a mismatch is refused may depend on that setting too. The two pages are not reconciled.',
        ),
        lessons: ['deploy-from-git', 'env-and-secrets'],
        terms: ['webhook'],
      },
      {
        id: 'content-type-or-event',
        title: 'The webhook sends something other than the JSON push event',
        why: 'The docs ask for the content type `application/json` and the push event. A body the app cannot read is answered with 400 and "Invalid payload". The docs list push and release events for GitHub and push events for GitLab and Bitbucket, and no other event.',
        likelihood: 'possible',
        checks: [
          look(
            'On your Git host open the webhook settings and read its content type and the events it sends.',
          ),
        ],
        fixes: [
          fix(
            'Set the content type to `application/json` and send the push event. For GitHub the docs also show release events.',
          ),
        ],
        proof: docs(
          '15.3.5; 9.8.2',
          'The 400 answer and its "Invalid payload" body are on the Webhook API page of the docs. The research notes list the payloads of the three Git hosts and not that body.',
        ),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'api-key-401',
        title: 'The 401 comes from the status address, not from the webhook',
        why: '`API_KEY` protects `GET /status` and `GET /logs/:id` and is independent of `WEBHOOK_SECRET`. With it set, a request to either address without the key is answered with 401 "Valid API key required". The Webhook API page says `/health` stays public; the environment reference says `API_KEY` covers it too, and the two pages are not reconciled.',
        likelihood: 'possible',
        checks: [
          cmd(
            'Send the key the way the docs show',
            `curl -s -H "Authorization: Bearer <your API_KEY>" ${WEBHOOK_HOST}/status`,
            'A JSON status instead of 401. `Authorization: Token <key>` is accepted too.',
          ),
        ],
        fixes: [
          fix(
            'Send the key in the `Authorization` header, or clear `API_KEY` if you do not want the status protected.',
          ),
        ],
        proof: docs(
          '15.3.18 row 17; 15.3.6.1',
          'Whether `/health` needs the key is UNVERIFIED: the Webhook API page and the environment reference differ.',
        ),
        lessons: ['deploy-from-git', 'env-and-secrets'],
      },
      {
        id: 'rate-limited',
        title: 'Too many requests in a minute',
        why: 'The listener accepts at most 10 webhook requests a minute from one address and answers the rest with 429.',
        likelihood: 'rare',
        checks: [look('Look for a 429 in the delivery details, close to a burst of pushes.')],
        fixes: [fix('Wait a minute and redeliver the delivery that failed.')],
        proof: docs('15.3.5'),
        lessons: ['deploy-from-git'],
      },
    ],
    lessons: ['deploy-from-git'],
    related: ['git-push-no-deploy', 'wrong-app-url'],
  },

  // ---- settings, state and plan ----------------------------------------------------------------------
  {
    id: 'git-variables-ignored',
    stage: 'git',
    title: 'A variable I set is ignored, or the app shows its old value',
    summary: 'You changed an environment variable or a build setting, and the running app behaves as before.',
    seen: [
      'The app shows the old value',
      'undefined where a variable should be',
      'Maximum of 20 environment variables allowed.',
    ],
    keywords: [
      'environment variable',
      'env var',
      'variable ignored',
      'old value',
      'build time',
      'runtime',
      'next_public',
      'vite',
      'case sensitive',
      'secret',
      'orbit',
    ],
    quick:
      'Orbit injects variables when the app runs and does not bake them into an image, the Orbit page says. What your own build does with a value is another matter: a front end tool may copy it into the files it produces, and then only a new build changes it. Check the name first, then whether the value is read at build time or at run time.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'inlined-at-build',
        title: 'Your front end copied the value in at build time',
        why: 'Many front end tools read a variable while they build and write its value into the files they produce. A later change to the variable does not touch those files until the next build. That is how the tool behaves, not something Orbit does, and it differs between tools.',
        likelihood: 'usual',
        checks: [
          look(
            'Search the built output for the old value, or read the documentation of your tool on environment variables at build time.',
          ),
        ],
        fixes: [
          fix(
            'After you change the variable, push a commit to the deployed branch so the output is built again. An empty commit is enough.',
            {
              snippet: {
                lang: 'sh',
                code: 'git commit --allow-empty -m "rebuild"\ngit push',
                label: 'Build again without a change',
              },
            },
          ),
        ],
        proof: guess(
          '15.3.6; 15.3.4',
          'The Orbit page says variables are injected at run time and not baked into the image. Which tools copy a value in at build time is general front end knowledge, not a Flux fact.',
        ),
        lessons: ['deploy-from-git', 'env-and-secrets'],
        terms: ['environment-parameters'],
      },
      {
        id: 'name-or-spacing',
        title: 'The name is misspelt, differs in case or has stray spaces',
        why: 'Variable names are case sensitive. In a spec each entry is `NAME=value`, and spaces around the name or the equals sign become part of the name, so `KEY = value` sets a variable called `KEY ` that nothing reads. How the Orbit dashboard treats stray spaces was not checked.',
        likelihood: 'common',
        checks: [
          forge(
            'See the warning for spaces around the equals sign',
            orbitExample({ environmentParameters: ['APP_PORT=3000', 'NODE_ENV = production'] }, [
              'ENV_WHITESPACE',
            ]),
            'ENV_WHITESPACE: the variable is called "NODE_ENV " with a trailing space.',
          ),
        ],
        fixes: [
          fix(
            'Write `NAME=value` with no spaces around the equals sign, and match the case your code reads.',
          ),
        ],
        proof: docs(
          '9.8.2; 8.3',
          'The docs advise checking case and quotes. The spaces rule is Docker behaviour, which the linter reports.',
        ),
        lint: ['ENV_WHITESPACE'],
        lessons: ['env-and-secrets', 'deploy-from-git'],
        terms: ['environment-parameters'],
      },
      {
        id: 'too-many-variables',
        title: 'The component already holds the most variables it may',
        why: `A component holds at most ${F.maxEnv} variables of up to ${F.maxEnvLength} characters each. The settings of Orbit itself (the repository, the port, the branch, the polling interval and the commands) are variables of the same component, so they use part of that allowance.`,
        likelihood: 'possible',
        checks: [
          forge(
            'See the error for a twenty first variable',
            orbitExample(
              { environmentParameters: Array.from({ length: F.maxEnv + 1 }, (_, i) => `VAR_${i}=value`) },
              ['ENV_TOO_MANY'],
            ),
            'ENV_TOO_MANY: the limit is 20 entries.',
          ),
        ],
        fixes: [
          fix(
            'Remove variables the app does not read. In an app you registered yourself, an `F_S_ENV=<https url>` entry can load a set of them from Flux Storage at storage.runonflux.io.',
          ),
        ],
        proof: src(
          '3.3; 7.3; 15.3.1',
          'That the limit counts the variables of Orbit follows from an Orbit app being an ordinary component. It was not tried with a real Orbit app.',
        ),
        lint: ['ENV_TOO_MANY'],
        see: ['limits-exceeded'],
        lessons: ['env-and-secrets'],
      },
      {
        id: 'reserved-name',
        title: 'Flux sets a variable of that name itself',
        why: 'Flux adds `FLUX_APP_NAME` and `FLUX_NODE_HOST_IP` when it starts the container, and its value wins over yours.',
        likelihood: 'rare',
        checks: [
          forge(
            'See the warning for a reserved variable name',
            orbitExample(
              {
                environmentParameters: [
                  'GIT_REPO_URL=https://github.com/example/app',
                  'APP_PORT=3000',
                  'FLUX_APP_NAME=mine',
                ],
              },
              ['ENV_RESERVED_NAME'],
            ),
            'ENV_RESERVED_NAME: Flux sets this name itself.',
          ),
        ],
        fixes: [fix('Choose another name, or remove the entry.')],
        proof: src('8.3'),
        lint: ['ENV_RESERVED_NAME'],
        lessons: ['env-and-secrets'],
      },
    ],
    lessons: ['env-and-secrets', 'deploy-from-git'],
    labs: ['spec-forge'],
    related: ['secrets-visible', 'limits-exceeded', 'git-build-failed'],
    lint: ['ENV_WHITESPACE', 'ENV_TOO_MANY'],
  },

  {
    id: 'git-data-disappears',
    stage: 'git',
    title: 'Files my app wrote are gone after a deploy',
    summary: 'Uploads, a local database file or a cache vanished after a push, a restart or a node change.',
    seen: [
      'The file is gone after a redeploy',
      'The uploads folder is empty again',
      'Each instance has different files',
    ],
    keywords: [
      'data lost',
      'files disappeared',
      'uploads',
      'sqlite',
      'persistent',
      'persistent folder',
      'stateless',
      'database file',
      'after deploy',
      'orbit',
    ],
    quick:
      'Orbit apps are stateless by design, the docs say: the app folder is `/app` and each deploy builds a release. Persistent data belongs outside it, in a database add-on, an external database or a persistent folder. A plain folder is local to one node and is lost with it.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'stateless-by-design',
        title: 'The app wrote into a folder that a deploy replaces',
        why: 'The docs call Deploy with Git designed for stateless applications, and say persistent data must be stored externally. A file written into the working folder of the app belongs to that release, and a new release starts without it.',
        likelihood: 'usual',
        checks: [look('Find where the app writes: a path under the app folder itself is the sign.')],
        fixes: [
          fix(
            'Keep state outside the container: use a database or Redis add-on, an external database, or a persistent folder where your plan has one.',
          ),
        ],
        proof: docs('15.3.18 row 15; 15.3.13; 9.8.2'),
        lessons: ['deploy-from-git', 'persistent-storage'],
        terms: ['container-data'],
      },
      {
        id: 'no-persistent-folder',
        title: 'The plan has no persistent folder',
        why: `${PLANS_WITH_FOLDERS} have persistent folders at the time of writing, and ${STARTER.name} has none. Custom has them only with ${ORBIT_CUSTOM.persistentFoldersMinInstances} or more instances. In the live specs read on ${ORBIT_FACTS.readOn} they show up as a synced mount in ${READ_COUNTS.syncedMounts} of ${ORBIT_FACTS.plainOrbitSpecs.value} plain Orbit specs, one with \`g:\` and one with \`r:\`.`,
        likelihood: 'common',
        checks: [look('Open the plan table and find the row for persistent folders on your plan.')],
        fixes: [
          fix(
            `Move to a plan that has them, or use a database add-on. A bigger plan changes the price: the Spec Forge prices ${PLAN_PRICES} a month at the rates read on ${F.ratesDate}. ${PLAN_CHANGE}`,
          ),
        ],
        proof: docs(
          '15.3.10; 15.3.2',
          'The plan table is the Orbit page read on 2026-10-13. The two synced mounts are VERIFIED-LIVE.',
        ),
        lessons: ['deploy-from-git', 'persistent-storage'],
        terms: ['primary-standby'],
      },
      {
        id: 'node-lost',
        title: 'A plain folder lives on one node and the app moved',
        why: 'A plain volume is local to one node. It survives a restart and a soft redeploy, and it is lost with the node, in a hard redeploy, on cancel and at expiry. A replacement copy on another node starts empty.',
        likelihood: 'possible',
        checks: [
          api(
            'location',
            'A different node IP than before means the app moved and started with an empty folder.',
          ),
        ],
        fixes: [
          fix(
            'Put the data on a synced volume and run at least two instances. A synced volume survives the loss of a node as long as a current copy remains, and the newest writes may be missing after a failover.',
          ),
        ],
        proof: src('7.1; 7.2; 6.3'),
        see: ['data-gone-after-update', 'recover-lost-data'],
        lessons: ['persistent-storage'],
        terms: ['container-data'],
      },
    ],
    lessons: ['deploy-from-git', 'persistent-storage'],
    labs: ['explorer'],
    related: ['data-gone-after-update', 'recover-lost-data', 'data-differs-or-missing'],
  },

  {
    id: 'git-plan-limits',
    stage: 'git',
    title: 'My plan is too small: slow, out of memory, or a feature is missing',
    summary:
      'Builds run out of memory, the app is slow, or the plan has no persistent folder or second port.',
    seen: ['The build or the app runs out of memory', 'Requests time out', 'No space left on device'],
    keywords: [
      'plan',
      'starter',
      'standard',
      'pro',
      'custom',
      'too small',
      'slow',
      'timeout',
      'out of memory',
      'ram',
      'cpu',
      'storage',
      'upgrade',
      'second port',
      'orbit',
    ],
    quick: `At the time of writing (read ${ORBIT_READ_ON}) the plans are ${andList(
      ORBIT_PLANS.map(
        (p) =>
          `${p.name} with ${p.vcores} vCores, ${grouped(p.ramMb)} MB of RAM, ${p.storageGb} GB and ${plural(p.instances, 'instance', 'instances')}`,
      ),
    )}. Custom is ${CUSTOM_RANGE}. The network formula prices any size, so look at the price in the Spec Forge before you change plan.`,
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'ram',
        title: 'The build or the app needs more RAM than the plan has',
        why: `RAM is ${PLAN_RAM}. A build that bundles a large front end, or an app that holds a lot in memory, hits the limit first: a heap error in the build log, or a process that is killed and started again.`,
        likelihood: 'usual',
        checks: [
          look(
            'Look for a heap error in the build log, or for restarts with no error message in the application log.',
          ),
        ],
        fixes: [
          fix(
            `Choose a plan or a Custom size with more RAM. At the rates read on ${F.ratesDate} the plans price at ${PLAN_PRICES} a month. ${PLAN_CHANGE}`,
            {
              lab: {
                lab: 'spec-forge',
                label: 'Price an Orbit size in the Spec Forge',
                spec: planExample(STANDARD),
              },
            },
          ),
        ],
        proof: docs(
          '15.3.18 row 5; 15.3.10; 15.3.11',
          'The plan sizes are the Orbit page. The prices are the engine and equal the published ones.',
        ),
        see: ['git-build-failed'],
        lessons: ['deploy-from-git', 'resources-pricing'],
      },
      {
        id: 'cpu',
        title: 'The cores are busy: builds are slow and requests time out',
        why: `vCores are ${PLAN_CORES}. Builds that compile or bundle a lot, and request handlers that do heavy work, are slow when the cores are busy. The load balancer also gives up on a request that takes longer than its server timeout, ${F.fdmServerSec} seconds.`,
        likelihood: 'common',
        checks: [
          look(
            'Compare the time a build takes with its time limit, and time a slow request from your own machine.',
          ),
        ],
        fixes: [fix('Move to a size with more cores, or answer quickly and do long work in the background.')],
        proof: docs(
          '15.3.18 row 16; 15.3.10; 6.4',
          'Too little CPU or RAM as the cause of a slow app is the docs troubleshooting page. The timeout of the load balancer is read in FluxOS source. That a small plan is the cause for your app is our reading.',
        ),
        see: ['url-502-503'],
        lessons: ['deploy-from-git', 'resources-pricing'],
        terms: ['haproxy'],
      },
      {
        id: 'storage',
        title: 'The disk fills up',
        why: `Storage is ${PLAN_STORAGE}. Orbit keeps the last three releases and a cache of dependencies, and the logs and your own files sit next to them, so a large build can fill a small disk.`,
        likelihood: 'possible',
        checks: [look('Look for "No space left on device" in the logs.')],
        fixes: [
          fix('Slim the build output and the dependencies, or choose a size with more storage.', {
            proof: guess(
              '15.3.4; 11 row 16',
              'That the releases and the dependency cache share the storage of the plan is our reading of the release layout in the docs. It was not measured.',
            ),
          }),
        ],
        proof: docs('15.3.4; 15.3.10'),
        see: ['volume-full'],
        lessons: ['persistent-storage'],
      },
      {
        id: 'plan-feature',
        title: 'Your plan does not include the feature you need',
        why: `${PLANS_WITH_FOLDERS} have persistent folders and a second app port, and ${STARTER.name} has neither. Custom has persistent folders only with ${ORBIT_CUSTOM.persistentFoldersMinInstances} or more instances.`,
        likelihood: 'common',
        checks: [look('Open the plan table and compare the features of your plan with what the app needs.')],
        fixes: [fix(`Choose a plan that includes the feature, or a Custom size. ${PLAN_CHANGE}`)],
        proof: docs('15.3.10', 'The table is the Orbit page read on 2026-10-13.'),
        lessons: ['deploy-from-git'],
      },
    ],
    lessons: ['deploy-from-git', 'resources-pricing'],
    labs: ['spec-forge'],
    related: ['git-build-failed', 'git-app-went-down', 'price-higher-than-expected'],
  },

  {
    id: 'git-app-went-down',
    stage: 'git',
    title: 'My Orbit app was down for a while and came back',
    summary: 'The address stopped answering for minutes or hours, and nobody pushed anything.',
    seen: ['The address stopped answering', 'The app was down and came back by itself', 'Brief downtime'],
    keywords: [
      'down',
      'outage',
      'downtime',
      'unavailable',
      'one instance',
      'single instance',
      'starter',
      'failover',
      'node restart',
      'came back',
      'orbit',
    ],
    quick:
      'Starter registers one instance, so its app is down when its node is. The Orbit page says brief downtime may occur if its node restarts, and the network needs time to place a replacement. This page gives the mechanism and no percentage, because no reliable figure for how often it happens has been recorded.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'one-instance',
        title: 'The plan registers one instance, and its node went away',
        why: `${STARTER.name} runs ${plural(STARTER.instances, 'instance', 'instances')}. When a node disappears its location record lasts up to ${F.locationTtlMin} minutes before a replacement spawns, and the replacement then has to pull the Orbit image and clone and build your repository again, because the build runs inside the container on the node. ${PLANS_WITH_FAILOVER} run two instances, which the page calls "with failover".`,
        likelihood: 'usual',
        checks: [
          lab('explorer', 'Look the app up in the App Explorer: one row is one machine'),
          api('location', 'One row means one machine. No rows means the app is down now.'),
          forge(
            'See the warning the Spec Forge gives a single instance Orbit spec',
            planExample(STARTER, ['INSTANCES_ONE']),
            'INSTANCES_ONE: with one instance the app is down whenever its node is.',
          ),
        ],
        fixes: [
          fix(
            `Use a plan with two instances, or a Custom size with 2 or 3. At the rates read on ${F.ratesDate} the plans price at ${PLAN_PRICES} a month, and the Spec Forge prices a size you choose. ${PLAN_CHANGE}`,
            {
              lab: {
                lab: 'spec-forge',
                label: 'Open a two instance Orbit spec',
                spec: planExample(STANDARD),
              },
            },
          ),
        ],
        proof: both(
          '6.3; 6.5; 15.3.2; 15.3.7; 15.3.13',
          `The mechanism is read in FluxOS source. The instance count of the plan is the Orbit page read ${ORBIT_READ_ON}, and ${ORBIT_FACTS.plainOrbitOneInstance.value} of ${ORBIT_FACTS.plainOrbitSpecs.value} plain Orbit specs read that day had one instance.`,
        ),
        lint: ['INSTANCES_ONE'],
        see: ['single-instance-down'],
        lessons: ['redundancy-failover', 'deploy-from-git'],
        terms: ['failover', 'n-minus-1', 'instance'],
      },
      {
        id: 'image-recheck',
        title: 'The Orbit image under latest changed and your node redeployed',
        why: `Every Orbit app runs \`${ORBIT_IMAGE}\`. As far as the source shows, nodes check the registry every ${F.imageRecheckHours} hours for the same tag and redeploy when it points at a new image, keeping volume data. The app restarts, and nodes do it at different moments.`,
        likelihood: 'possible',
        checks: [
          forge(
            'See the warning for an Orbit spec that follows latest',
            planExample(STANDARD, ['IMAGE_LATEST']),
            'IMAGE_LATEST: FluxOS re-checks the registry about every six hours for a changed image under the same tag.',
          ),
        ],
        fixes: [
          fix(
            'Two instances keep the app answering while one copy restarts. No setting that pins the image was found on the Orbit page or in the docs.',
            {
              proof: guess(
                '6.3; 15.3.1',
                'The dashboard itself was not opened, so a setting for the image may exist there. Two instances keeping the app up during a restart follows from the redeploy mechanism and was not watched on an Orbit app.',
              ),
            },
          ),
        ],
        proof: src(
          '6.3; 11 row 19; 15.3.1',
          'The 6 hour check, the digest comparison and the soft redeploy are read in source. None of it was seen live. That it applies to Orbit apps follows from their tag, which is VERIFIED-LIVE on every plain Orbit spec.',
        ),
        lint: ['IMAGE_LATEST'],
        see: ['image-latest-changed'],
        lessons: ['deploy-from-git', 'operate-your-app'],
        terms: ['soft-redeploy'],
      },
      {
        id: 'term-ended',
        title: 'The subscription ended',
        why: 'An app is prepaid for a number of blocks, and at the end of it the app and its data are removed within minutes to hours, with no grace. Orbit takes a card or FLUX like any app.',
        likelihood: 'possible',
        checks: [
          api('appspec', '`Application: {app} not found` after a long time running means the term ended.'),
        ],
        fixes: [
          fix(
            'Renew before the date, and put the expiry in your calendar. A removed app is a new registration.',
          ),
        ],
        proof: src('5.4; 11 row 25', 'How an Orbit app is renewed is the Orbit page statement.'),
        see: ['app-expired'],
        lessons: ['operate-your-app'],
        terms: ['expire', 'renewal'],
      },
    ],
    lessons: ['redundancy-failover', 'deploy-from-git'],
    labs: ['explorer', 'spec-forge'],
    related: ['single-instance-down', 'git-plan-limits', 'app-expired'],
    lint: ['INSTANCES_ONE', 'IMAGE_LATEST'],
  },

  // ---- the button and old guidance -----------------------------------------------------------------
  {
    id: 'git-button-url',
    stage: 'git',
    title: 'The Deploy to Flux button is refused or opens with the wrong values',
    summary: 'The button link does not open, a field arrives empty, or the plan is not the one you meant.',
    seen: [
      'The wizard opens with empty fields',
      'The plan is Starter whatever the link says',
      'The badge image does not show',
    ],
    keywords: [
      'deploy to flux',
      'deploy button',
      'button',
      'badge',
      'readme',
      'repo parameter',
      'branch parameter',
      'projectPath',
      'plan parameter',
      'query string',
      'link',
      'orbit',
    ],
    quick:
      'The button is a link to the Orbit page with `repo`, `branch`, `projectPath` and `plan` as query parameters. It opens the wizard with the fields filled in and deploys nothing on its own. The Orbit page documents `repo` as a full HTTPS URL and `plan` as starter, standard or pro. The Academy link builder adds checks of its own, so that a link is safe to publish: no credentials, query string or spaces in the repository address, a branch name that Git would accept, and a project path that stays inside the repository.',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'repo-value',
        title: 'The repository value is not a clean https URL',
        why: 'The `repo` value must be the full address, with `https://`. The Academy link builder also refuses a username, password or token in the address, a query string or a fragment after the repository name, spaces, and an address of another form. A token in a link is published with the link.',
        likelihood: 'usual',
        checks: [
          look('Read the `repo` value of your link. It is `https://host/owner/repo` and nothing else.'),
        ],
        fixes: [
          fix(
            'Use the plain repository address. Private repository credentials are entered in Orbit itself, never in the link.',
            {
              snippet: {
                lang: 'text',
                code: deployToFluxUrl(BUTTON_EXAMPLE),
                label: 'A link with every parameter',
              },
            },
          ),
        ],
        proof: docs(
          '15.3.12',
          'The page states that `repo` is a full HTTPS URL. The strictness about credentials and query strings is a rule of the Academy link builder.',
        ),
        lessons: ['deploy-from-git'],
        terms: ['deploy-button'],
      },
      {
        id: 'branch-or-path',
        title: 'The branch or the project path is not valid',
        why: 'A branch name cannot hold a space or any of `~`, `^`, `:`, `?`, `*`, `[` and the backslash, cannot start with `-` or `/`, and cannot end with `/`, `.` or `.lock`. A project path is a folder inside the repository: no leading slash and no `..`.',
        likelihood: 'common',
        checks: [
          look(
            'Compare the `branch` and `projectPath` values with the branch list and the folder list of your repository.',
          ),
        ],
        fixes: [
          fix(
            'Use the exact branch name and the folder relative to the repository root, such as `express` or `apps/web`.',
          ),
        ],
        proof: docs(
          '15.3.12',
          'The character rules belong to the Academy link builder and are built from the branch name rules of Git. The page states only that `branch` and `projectPath` are optional.',
        ),
        lessons: ['deploy-from-git'],
        terms: ['deploy-button', 'monorepo'],
      },
      {
        id: 'plan-value',
        title: 'The plan value is not one the page knows',
        why: 'The `plan` parameter is `starter`, `standard` or `pro`. An older button with `plan=free` opens Starter, because the Free plan is closed. Custom sizes are set in the dashboard after the deploy, so there is no value for them.',
        likelihood: 'common',
        checks: [look('Read the `plan` value of your link.')],
        fixes: [
          fix(
            `Use \`starter\`, \`standard\` or \`pro\`, or leave it out and choose in the wizard. At the rates read on ${F.ratesDate} the three price at ${PLAN_PRICES} a month.`,
          ),
        ],
        proof: docs('15.3.12; 15.3.10'),
        lessons: ['deploy-from-git'],
        terms: ['deploy-button', 'flux-orbit'],
      },
      {
        id: 'not-encoded',
        title: 'A value holds a character that ends it early',
        why: 'In a query string `&` starts the next parameter, and `#`, `?`, `+` and spaces change what the link means. A branch such as `feature/a&b` is cut at the `&` unless it is encoded.',
        likelihood: 'possible',
        checks: [look('Paste the link into the address bar and look at which values arrive in the wizard.')],
        fixes: [
          fix(
            'Percent-encode the value, or rename the branch. The Academy link builder leaves `:` and `/` readable and encodes the rest.',
          ),
        ],
        proof: guess(
          '15.3.12',
          'The page documents the parameters and not their encoding. The encoding rule belongs to the Academy link builder and follows general URL behaviour.',
        ),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'badge-image',
        title: 'The badge image does not show in the README',
        why: 'The Markdown form is `[![Deploy to Flux](<image>)](<link>)`. The documented image address answers with a redirect (301) to a path whose prefix is doubled, so a renderer that does not follow redirects shows a broken picture.',
        likelihood: 'rare',
        checks: [
          cmd(
            'Look at what the image address answers',
            'curl -sI https://runonflux.com/apps/orbit/deploytoflux.png | head -n 5',
            'A 301 with a `location` header. Whether the final address serves a picture to your README renderer was not tested.',
          ),
        ],
        fixes: [
          fix(
            'Use the Markdown exactly as the button page prints it. If the picture still does not load, link a plain text button instead.',
            {
              snippet: {
                lang: 'text',
                code: deployToFluxMarkdown(BUTTON_EXAMPLE),
                label: 'The documented Markdown',
              },
              proof: guess(
                '15.3.12',
                'The redirect is VERIFIED-LIVE (2026-10-13). What a given README renderer does with it was not tested.',
              ),
            },
          ),
        ],
        proof: guess(
          '15.3.12',
          'The redirect is VERIFIED-LIVE. Whether the picture loads where you embed it was not tested.',
        ),
        lessons: ['deploy-from-git'],
        terms: ['deploy-button'],
      },
    ],
    lessons: ['deploy-from-git'],
    related: ['git-cannot-clone', 'git-monorepo-wrong-folder', 'git-stale-guidance'],
  },

  {
    id: 'git-stale-guidance',
    stage: 'git',
    title: 'A tutorial mentions a free plan, three nodes or an old Orbit page',
    summary:
      'An old guide, the docs introduction or a copy of the page describes Orbit differently from the Orbit page.',
    seen: [
      'Free forever tier',
      'Running on 3+ nodes',
      'orbit.app.runonflux.io',
      'A plan list without Starter',
    ],
    keywords: [
      'free plan',
      'free tier',
      'free forever',
      '3+ nodes',
      'three nodes',
      'orbit.runonflux.com',
      'orbit.app.runonflux.io',
      'old page',
      'outdated',
      'docs',
      'plans',
      'starter',
      'orbit',
    ],
    quick:
      'The Orbit page at runonflux.com/apps/orbit is the one to follow. The plans on it are Starter, Standard, Pro and Custom, and the page says the old Free plan is closed to new apps. The docs and the card in FluxCloud, written earlier, still say a free tier and "3+ nodes".',
    checkedAgainst: AGAINST,
    causes: [
      {
        id: 'free-plan',
        title: 'The guide describes a free tier that is closed',
        why: 'The Orbit page says the old Free plan is closed to new apps, and that apps already running on it keep renewing for free. A tutorial, the docs quick start or an old button with `plan=free` can still mention it.',
        likelihood: 'usual',
        checks: [
          look(
            'Open runonflux.com/apps/orbit and read the plan list and its footnotes. The published plans start at Starter.',
          ),
        ],
        fixes: [
          fix(
            `Plan for a paid plan. At the rates read on ${F.ratesDate} the plans price at ${PLAN_PRICES} a month, the network price for their size, and no extra builder fee shows in them.`,
          ),
        ],
        proof: docs(
          '15.3.10; 15.3.11; 15.3.15',
          'The plan list is a vendor page read 2026-10-13. The prices are the engine and equal the published ones.',
        ),
        lessons: ['deploy-from-git', 'resources-pricing'],
        terms: ['flux-orbit'],
      },
      {
        id: 'three-nodes',
        title: 'The docs and the card say three or more nodes',
        why: `The docs introduction and the Git card of FluxCloud say "3+ nodes". The plans are ${PLAN_INSTANCES} instances, Custom runs ${ORBIT_CUSTOM.instancesMin} to ${ORBIT_CUSTOM.instancesMax}, and ${ORBIT_FACTS.plainOrbitOneInstance.value} of the ${ORBIT_FACTS.plainOrbitSpecs.value} plain Orbit specs read on ${ORBIT_READ_ON} run one.`,
        likelihood: 'common',
        checks: [
          api('appspec', 'Read `instances` in the spec of an Orbit app. That is what was registered.'),
        ],
        fixes: [
          fix(
            'Count the instances of the plan you chose, not the number in the guide, and use the Spec Forge to price more.',
          ),
        ],
        proof: both(
          '15.3.4; 15.3.2; 15.3.15',
          'The plan table is the Orbit page. The instance counts of the live specs are VERIFIED-LIVE on 2026-10-13.',
        ),
        lessons: ['deploy-from-git', 'redundancy-failover'],
        terms: ['instance'],
      },
      {
        id: 'old-page-copy',
        title: 'An old copy of the Orbit page is still served',
        why: 'orbit.runonflux.com answers with a redirect (301) to the Orbit page. A copy of an older version of that page is still served on a Flux address, with older wording such as a free forever tier and custom domains on paid plans only. Its text is not the current plan list.',
        likelihood: 'common',
        checks: [
          cmd(
            'Follow the old address',
            'curl -sI https://orbit.runonflux.com | head -n 5',
            'A 301 with a `location` header that points at runonflux.com/apps/orbit.',
          ),
        ],
        fixes: [fix('Follow https://runonflux.com/apps/orbit and ignore other copies.')],
        proof: live('15.3.1; 9.8.1; 15.3.14', 'The redirect and the older copy were seen on 2026-10-13.'),
        see: ['old-dashboard-link'],
        lessons: ['deploy-from-git'],
        terms: ['flux-orbit'],
      },
      {
        id: 'card-differs',
        title: 'The Git card of FluxCloud lists other plans and inclusions',
        why: 'The Git card in the deploy chooser of FluxCloud lists a Free plan and no Starter, and puts private repositories and custom domains under Standard. The Orbit page lists private repositories and custom domains on every plan, and its plan list wins.',
        likelihood: 'possible',
        checks: [look('Compare the plan list on the card with the plan list on runonflux.com/apps/orbit.')],
        fixes: [
          fix(
            'Choose the plan on the Orbit page itself. Where the two differ, the Orbit page is the product.',
          ),
        ],
        proof: docs(
          '15.3.8; 15.3.10; 15.3.15',
          'Both are vendor copy read on 2026-10-13. The card is older.',
        ),
        lessons: ['deploy-from-git'],
      },
      {
        id: 'two-vocabularies',
        title: 'The docs and the button use different names for the same settings',
        why: 'The docs call the settings `GIT_REPO_URL`, `GIT_BRANCH` and `PROJECT_PATH`. The Deploy to Flux button calls them `repo`, `branch` and `projectPath`. They are two vocabularies for one thing.',
        likelihood: 'possible',
        checks: [look('Match each name in the guide you follow with its pair above.')],
        fixes: [
          fix(
            'Use the names of the docs in the settings and environment of the app, and the names of the button in the link.',
          ),
        ],
        proof: docs('15.3.12; 9.8.2'),
        lessons: ['deploy-from-git'],
        terms: ['deploy-button'],
      },
    ],
    lessons: ['deploy-from-git'],
    related: ['old-dashboard-link', 'git-button-url', 'git-app-went-down'],
  },
];
