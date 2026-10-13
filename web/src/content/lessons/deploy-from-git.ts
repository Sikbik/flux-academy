/**
 * Lesson 9, deploy-from-git: Orbit (Deploy with Git). What it registers, how its plans are priced, what one
 * instance means, the Deploy to Flux button, build settings and secrets, and how a push becomes a version.
 *
 * Planted failures: a port that disagrees with `APP_PORT` (step 1), a plan that is down while its node is
 * (step 3), a link pasted with an SSH address, an absolute folder and `plan=free` (step 4), a monorepo
 * built at its root (step 5), and a token in a plain spec in the checkpoint.
 *
 * Facts: docs/research/FACTS.md. Each fact is tagged `// fact: FACTS <section>` on the data it supports.
 * Plan sizes and published prices are vendor data in `shared/flux` (`ORBIT_PLANS`, read `ORBIT_READ_ON`,
 * DOCS-ONLY); every computed price comes from `orbitPlanQuoteUsd` at the baked rate card and says its date.
 * Counts of the live network come from `ORBIT_FACTS` and carry their date: nothing here is a failure rate.
 */

import type { FluxAppSpec, FluxComponentSpec, OrbitPlan, OrbitPlanId } from '@shared/flux';
import {
  BAKED_PRICING,
  LIMITS,
  LOCATION_TTL_MIN,
  ORBIT_APP_MARKERS,
  ORBIT_BUILD_VARIABLES,
  ORBIT_COMPONENT_NAME,
  ORBIT_CUSTOM,
  ORBIT_FACTS,
  ORBIT_IMAGE,
  ORBIT_PLANS,
  ORBIT_READ_ON,
  ORBIT_WEBHOOK_PORT,
  orbitPlanById,
  orbitPlanQuoteUsd,
  orbitPlanSpec,
} from '@shared/flux';
import type { Lesson } from '@/learn/types';

// ---------------------------------------------------------------------------
// Words and numbers, from the engine
// ---------------------------------------------------------------------------

const usd = (n: number): string => `USD ${n.toFixed(2)}`;

const andList = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

function planById(id: OrbitPlanId): OrbitPlan {
  const p = orbitPlanById(id);
  if (!p) throw new Error(`deploy-from-git: no Orbit plan "${id}" in ORBIT_PLANS`);
  return p;
}

const STARTER = planById('starter');
const STANDARD = planById('standard');
const PRO = planById('pro');

const instancesOf = (n: number): string => (n === 1 ? 'one instance' : `${n} instances`);

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "1.5 vCores, 4000 MB of RAM and 15 GB of disk on 2 instances": the page says GB, live specs hold MB. */
const sizeOf = (p: OrbitPlan): string =>
  `${p.vcores} vCores, ${p.ramMb} MB of RAM and ${p.storageGb} GB of disk on ${instancesOf(p.instances)}`;

/** The engine's monthly USD for a plan's size, at the baked rate card. Equal to the page for all three. */
const priced = (p: OrbitPlan, instances?: number): number =>
  orbitPlanQuoteUsd(p, BAKED_PRICING.params, instances === undefined ? {} : { instances });

const RATES_DATE = BAKED_PRICING.capturedAt;

/** A build variable name as a code span. Throws at module load when the catalogue has no such name. */
const KNOWN_VARIABLES = new Set(ORBIT_BUILD_VARIABLES.map((x) => x.name));
function v(name: string): string {
  if (!KNOWN_VARIABLES.has(name)) throw new Error(`deploy-from-git: ${name} is not in ORBIT_BUILD_VARIABLES`);
  return `\`${name}\``;
}

const SECRET_VARIABLES = ORBIT_BUILD_VARIABLES.filter((x) => x.secret).map((x) => `\`${x.name}\``);

// ---------------------------------------------------------------------------
// The apps of this lesson, as specs (every one is `orbitPlanSpec`, so the shape is the live one)
// ---------------------------------------------------------------------------

/** The sealed value the Spec Forge writes into `enterprise`: FluxCloud makes the real ciphertext. */
const SEALED = 'ENCRYPTED_BY_FLUXCLOUD_PLACEHOLDER';

function withComponent(spec: FluxAppSpec, patch: Partial<FluxComponentSpec>): FluxAppSpec {
  const [first, ...rest] = spec.compose;
  if (!first) throw new Error('deploy-from-git: an Orbit spec has a component');
  return { ...spec, compose: [{ ...first, ...patch }, ...rest] };
}

function environmentOf(spec: FluxAppSpec): string[] {
  return [...(spec.compose[0]?.environmentParameters ?? [])];
}

/** Step 1: a Standard-sized app whose server listens on 8080 while `containerPorts` still says 3000. */
const NOTES_PORT = 8080;
const NOTES_SPEC = withComponent(
  orbitPlanSpec(STANDARD, {
    name: 'notes-api',
    repo: 'https://github.com/acme/notes-api',
    appPort: NOTES_PORT,
  }),
  { containerPorts: [3000, ORBIT_WEBHOOK_PORT] },
);

/** Step 5: a monorepo whose API lives in a folder and has its own build script. */
const SHOP_FOLDER = 'services/api';
const SHOP_BUILD = 'npm run build:api';
const SHOP_SPEC = orbitPlanSpec(STANDARD, {
  name: 'shop-api',
  repo: 'https://github.com/acme/shop',
  branch: 'release',
  appPort: 4000,
});
const SHOP_ENV = environmentOf(SHOP_SPEC);

/** Checkpoint: the same image deployed by hand for a private repository, with the token in a plain spec. */
const PRIVATE_SPEC = withComponent(
  orbitPlanSpec(STANDARD, { name: 'private-api', repo: 'https://github.com/acme/private-api' }),
  {
    environmentParameters: [
      ...environmentOf(orbitPlanSpec(STANDARD, { repo: 'https://github.com/acme/private-api' })),
      'GIT_TOKEN=EXAMPLE_TOKEN_NOT_REAL',
    ],
  },
);

/** Checkpoint: the Standard size on three instances, which the page does not price. */
const STANDARD_THREE = orbitPlanSpec(STANDARD, { name: 'standard-three', instances: 3 });

// ---------------------------------------------------------------------------
// Numbers the prose quotes
// ---------------------------------------------------------------------------

const STARTER_TWO = priced(STARTER, 2);
const STANDARD_ONE = priced(STANDARD, 1);
const STANDARD_TWO = priced(STANDARD);
const STANDARD_THREE_USD = priced(STANDARD, 3);
const STANDARD_FOUR = priced(STANDARD, 4);
const STANDARD_ENCRYPTED = orbitPlanQuoteUsd(STANDARD, BAKED_PRICING.params, { encrypted: true });
const SCOPE_USD = BAKED_PRICING.params.scope;

/** One plan as a sentence. The first spells out what the numbers are; the others reuse the order. */
const PLAN_FULL = (p: OrbitPlan): string => `${p.name} is ${sizeOf(p)}, ${usd(p.usd)} a month`;
const PLAN_SHORT = (p: OrbitPlan): string =>
  `${p.name} is ${p.vcores} vCores, ${p.ramMb} MB and ${p.storageGb} GB on ${instancesOf(p.instances)}, ${usd(p.usd)}`;

/** Which plans the page lists a feature for, from the catalogue. */
const namesWhere = (pick: (p: OrbitPlan) => boolean): string =>
  andList(ORBIT_PLANS.filter(pick).map((p) => p.name));
const WITH_FOLDERS = namesWhere((p) => p.persistentFolders);
const WITHOUT_FOLDERS = namesWhere((p) => !p.persistentFolders);

const PLAIN_ORBIT = ORBIT_FACTS.plainOrbitSpecs;
const NAMED_CLOUDGIT = ORBIT_APP_MARKERS.find((m) => m.id === 'component-name')?.observed.matching ?? 0;

/** The link the step 4 builder is asked for. The checkpoint never repeats it: the builder grades it. */
const SHOP_LINK = {
  repo: 'https://github.com/acme/shop',
  branch: 'release',
  projectPath: SHOP_FOLDER,
  plan: 'standard',
};

const lesson: Lesson = {
  id: 'deploy-from-git',
  hook: 'Not every app starts as a spec you write: point Orbit at a Git repository and it builds the code and registers an ordinary Flux app for you. You will read that spec, choose a plan and check its price against the formula, build the link that opens the deploy form, and trace a failed build to its cause.',
  objectives: [
    'Say what Orbit registers for you, and when writing the spec yourself is the better choice.',
    'Pick a plan by its size, check its price against the formula and say what one instance means when its node restarts.',
    "Build a Deploy to Flux link for a repository, a branch and a folder, and name the values the Academy's builder refuses.",
    'Keep a token out of a public spec and read a failed build to its cause.',
  ],
  steps: [
    {
      id: 'orbit-spec',
      title: 'What Orbit registers',
      body: [
        // fact: FACTS 15.3.1 (a service that builds a repository and registers an ordinary Flux app; a plain v8 spec, no special object type)
        '{{term:flux-orbit}} is the {{term:git-deploy}} route to a Flux app. You give it a repository, it builds the code and registers the app. What arrives on the network is a version 8 spec like the ones you have written, priced by the same formula and run by the same nodes.',
        // fact: FACTS 15.3.1 (image runonflux/orbit:latest, VERIFIED-LIVE), 15.3.4 (clone row, DOCS-ONLY), 15.3.2 (two public ports, container ports end in 9001)
        `The image is Orbit's own, \`${ORBIT_IMAGE}\`; your code is not in it. The repository is the variable ${v('GIT_REPO_URL')}, and the docs say the container clones and builds it. The second public port (${ORBIT_WEBHOOK_PORT} inside the container) is where your Git host sends a {{term:webhook}} when you push.`,
      ],
      callouts: [
        {
          // fact: FACTS 15.3.1 and 15.3.2 (235 plain specs on 2026-10-13, component cloudgit on 232, private-repository apps are encrypted and invisible); via ORBIT_FACTS and ORBIT_APP_MARKERS
          kind: 'wild',
          title: 'You can find them',
          body: `On ${PLAIN_ORBIT.readOn} the global app list held ${PLAIN_ORBIT.value} plain specs that run this image, and ${NAMED_CLOUDGIT} name the component \`${ORBIT_COMPONENT_NAME}\`. The page says private repositories are deployed encrypted, so those apps are not in that count.`,
        },
      ],
      stage: {
        kind: 'spec',
        spec: NOTES_SPEC,
        editable: ['compose[0].containerPorts'],
        focus: [
          {
            path: 'compose[0].repotag',
            note: "Orbit's own image. Your code is not in it.",
          },
          {
            path: 'compose[0].environmentParameters',
            note: 'The repository, the port your server listens on and the branch are variables, not image contents.',
          },
          {
            path: 'compose[0].containerPorts',
            note: `The first port receives the app's traffic. The last, ${ORBIT_WEBHOOK_PORT}, is the webhook listener.`,
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: `The server in this repository listens on ${NOTES_PORT}. Make the spec deliver traffic there and keep the webhook port.`,
        // fact: FACTS 15.3.6.1 (APP_PORT "must match the container port in the spec"), 11 row 1 (a port mismatch is not an error and nothing answers)
        hint: `${v('APP_PORT')} tells the container which port the server listens on, and \`containerPorts\` tells the node where to deliver traffic. The issues panel compares them. Keep ${ORBIT_WEBHOOK_PORT} last: pushes arrive there.`,
        check: {
          all: [
            {
              lint: 'absent',
              codes: ['PORT_ENV_MISMATCH'],
              message: `\`APP_PORT\` says the server listens on ${NOTES_PORT}, but \`containerPorts\` does not deliver there.`,
            },
            {
              path: 'compose[0].containerPorts',
              op: 'includes',
              value: NOTES_PORT,
              message: `The server listens on ${NOTES_PORT}, so that is the port traffic has to be delivered to.`,
            },
            {
              path: 'compose[0].containerPorts',
              op: 'includes',
              value: ORBIT_WEBHOOK_PORT,
              message: `Keep ${ORBIT_WEBHOOK_PORT} in the list: it is the webhook listener, and a push reaches the app through it.`,
            },
          ],
        },
        solution: { compose: [{ containerPorts: [NOTES_PORT, ORBIT_WEBHOOK_PORT] }] },
      },
    },
    {
      id: 'plans',
      title: 'Four plans, one formula',
      body: [
        // fact: FACTS 15.3.10 (the plan table, DOCS-ONLY, read 2026-10-13); sizes and prices come from ORBIT_PLANS
        `Orbit sells four plans, and each is a size. ${PLAN_FULL(STARTER)}. ${PLAN_SHORT(STANDARD)}. ${PLAN_SHORT(PRO)}. Custom is a size you choose, from ${usd(ORBIT_CUSTOM.fromUsd)}. That is the Orbit page as read on ${ORBIT_READ_ON}, so it can change.`,
        // fact: FACTS 15.3.11 (the three plan prices are quote() for the plan's size; no builder fee is visible; Custom has no stated price)
        `Those prices are not a separate list: the Academy priced the same three sizes with the formula from {{lesson:resources-pricing}} at the rates read on ${RATES_DATE}, and all three matched the page. The page names no price for a Custom size, so the number below is the formula's, not Orbit's. The whole table is on the [Orbit reference](/reference/orbit#plans).`,
      ],
      callouts: [
        {
          // fact: FACTS 15.3.10 (the plan table: persistent folders and the second app port by plan; Custom folders only with 2 or more instances), 15.3.13 (stateless by design; persistent folders only on Standard, Pro and Custom with 2 or more instances); flags from ORBIT_PLANS and ORBIT_CUSTOM
          kind: 'tip',
          title: 'Features that differ',
          body: `The page lists persistent folders for ${WITH_FOLDERS}, not ${WITHOUT_FOLDERS}, and for Custom only with ${ORBIT_CUSTOM.persistentFoldersMinInstances} or more instances. The docs call Orbit apps stateless.`,
        },
        {
          // fact: FACTS 15.3.11 (the encryption fee: the page says "included in the price shown at checkout", the engine adds the scope fee; UNVERIFIED how they reconcile), 15.3.9, 4.4
          kind: 'cost',
          title: 'Encrypted apps price higher',
          body: `The formula's prices above are for a plain app. The page says private repositories are deployed encrypted, with the fee included in the checkout price. The formula adds a ${usd(SCOPE_USD)} fee to the three-instance bundle price of an encrypted app (Standard's size: ${usd(STANDARD_ENCRYPTED)} instead of ${usd(STANDARD_TWO)}). The page does not say how the two reconcile, so read the checkout price.`,
        },
      ],
      stage: {
        kind: 'widget',
        id: 'orbit-planner',
        props: {
          view: 'plans',
          plan: 'standard',
          goal: { kind: 'custom', minInstances: 2, cheaperThan: 'standard' },
        },
      },
      task: {
        kind: 'widget',
        prompt:
          'Choose Custom, give it two instances and shrink the size until the formula prices it below Standard.',
        hint: 'Start from the Standard size and lower one slider at a time. Keep two instances, and read the price under the cards after each change: it follows the formula, step by step.',
      },
    },
    {
      id: 'node-restart',
      title: 'What one instance means',
      body: [
        // fact: FACTS 15.3.13 (Starter: "brief downtime may occur if its node restarts"), 15.3.10 (Standard and Pro: 2 instances "with failover"), 6.5
        'Starter registers one {{term:instance}}, and the page is plain about it: brief downtime may occur if its node restarts. Standard and Pro register two, which the page calls failover. Nodes belong to independent operators, so a restart is not hypothetical.',
        // fact: FACTS 6.3 and 6.5 (a replacement waits for the location record, 125 minutes, plus the image pull); LOCATION_TTL_MIN
        `Kill the node that runs the app. The simulator shows the outage at once and compresses the wait: on the real network a replacement can take about two hours (${LOCATION_TTL_MIN} minutes after the node dies, plus the image pull). Then try two instances. {{lesson:redundancy-failover}} has the full story.`,
        // fact: FACTS 15.3.11 (Starter prices at the 0.99 floor, and 2 instances also 0.99), computed by orbitPlanQuoteUsd
        `You do not need Standard's size to get two: by the formula, at the rates read on ${RATES_DATE}, the Starter size on two instances costs ${usd(STARTER_TWO)}, the same as one. The page lists one to three instances for Custom.`,
      ],
      callouts: [
        {
          // fact: FACTS 15.3.7 (rollback is not protection against a node going away)
          kind: 'gotcha',
          title: 'Rollback is not failover',
          body: "Orbit's automatic {{term:rollback}} keeps the last good release serving when a build fails. It guards against a bad commit, not a lost node: a single instance is still down while its node is.",
        },
      ],
      stage: {
        kind: 'diorama',
        scene: 'failover',
        instances: 1,
        controls: ['instances', 'kill', 'revive', 'request'],
      },
      task: {
        kind: 'kill-nodes',
        count: 1,
        prompt: 'Send a request, kill the node that runs the only instance, then send another.',
      },
    },
    {
      id: 'button',
      title: 'The Deploy to Flux button',
      body: [
        // fact: FACTS 15.3.12 (what it does: opens the wizard with the fields filled in, does not deploy on its own)
        'The {{term:deploy-button}} is a link that opens the Orbit deploy form with your values filled in. It deploys nothing by itself: you finish the deployment in Orbit. Projects put it in a README as a badge.',
        // fact: FACTS 15.3.12 (parameters, plan values, plan=free opens Starter, Custom sizes are set in the dashboard)
        'It carries one required value and three optional ones: `repo`, a full https URL; `branch`; `projectPath`, a folder of a {{term:monorepo}}; and `plan`, one of `starter`, `standard` or `pro`. An older `plan=free` opens Starter, and Custom sizes are set in the dashboard afterwards.',
        "The builder below is the Academy's, not Orbit's. It starts with a draft copied from a terminal, checks each value against the documented format and Git's naming rules, and names the ones the Academy would refuse. Orbit publishes the format, not a list of refused values.",
      ],
      callouts: [
        {
          // fact: FACTS 15.3.9 (private repositories take a token; docs: GIT_TOKEN), engine message of OrbitUrlError
          kind: 'gotcha',
          title: 'A token never goes in a link',
          body: `A URL with a username or token in it is refused here, and should be anywhere: links are public. For a private repository the token is the variable ${v('GIT_TOKEN')}, set in Orbit.`,
        },
      ],
      stage: {
        kind: 'widget',
        id: 'orbit-planner',
        props: {
          view: 'button',
          goal: { kind: 'url', expected: SHOP_LINK },
          draft: {
            repo: 'git@github.com:acme/shop.git',
            branch: 'release',
            projectPath: `/${SHOP_FOLDER}`,
            plan: 'free',
          },
        },
      },
      task: {
        kind: 'widget',
        prompt: `Fix the link so it opens the \`acme/shop\` repository on branch \`release\`, folder \`${SHOP_FOLDER}\`, plan Standard.`,
        hint: 'Read the message under each field. The builder says why it refuses an address, a folder or a plan, and the link appears underneath once every field passes.',
      },
    },
    {
      id: 'variables',
      title: 'Build settings are variables',
      body: [
        // fact: FACTS 15.3.6 and 15.3.6.1 (required: GIT_REPO_URL and APP_PORT; the catalogue is ORBIT_BUILD_VARIABLES)
        `Everything Orbit needs to know about your project is a variable in the spec: the same \`NAME=value\` strings from {{lesson:env-and-secrets}}. Two are required, ${v('GIT_REPO_URL')} and ${v('APP_PORT')}; the Academy's catalogue from the docs holds ${ORBIT_BUILD_VARIABLES.length}, listed with examples on the [Orbit reference](/reference/orbit#build-variables).`,
        // fact: FACTS 15.3.6 (variables set per app and injected at runtime, product page, DOCS-ONLY); the grouping is the Academy's, each name is in the catalogue
        `They fall into groups. The source: ${v('GIT_REPO_URL')}, ${v('GIT_BRANCH')}, ${v('PROJECT_PATH')}. The build: ${v('INSTALL_COMMAND')}, ${v('BUILD_COMMAND')} and version variables such as ${v('NODE_VERSION')}. The run: ${v('APP_PORT')} and ${v('RUN_COMMAND')}. How pushes arrive: ${v('POLLING_INTERVAL')} and ${v('WEBHOOK_SECRET')}. Your own settings, such as an API address, are variables too, injected at runtime, the page says.`,
        // fact: FACTS 15.3.6 and 15.3.9 (plain specs show every value; private repositories and secret variables are deployed encrypted on ArcaneOS nodes, DOCS-ONLY), 3.7
        `${SECRET_VARIABLES.length === 3 ? 'Three' : SECRET_VARIABLES.length} of them hold secrets: ${andList(SECRET_VARIABLES)}, and so does any key or password of your own. A plain spec is public, and the page says private repositories and secret variables are deployed encrypted, on {{term:arcaneos}} nodes only. Keep secrets out of the repository too: Git keeps its history.`,
      ],
      callouts: [
        {
          // fact: FACTS 15.3.18 row 8 (wrong folder built in a monorepo: PROJECT_PATH unset, the log lists the repository root)
          kind: 'gotcha',
          title: 'A monorepo builds at its root',
          body: `Without ${v('PROJECT_PATH')} the build starts at the repository root. If the log lists your repository's top-level files and not your app's, check this setting first.`,
        },
      ],
      stage: {
        kind: 'spec',
        spec: SHOP_SPEC,
        editable: ['compose[0].environmentParameters'],
        focus: [
          {
            path: 'compose[0].environmentParameters',
            note: 'One string per setting, NAME=value, with nothing around the equals sign.',
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: `Make Orbit build the \`${SHOP_FOLDER}\` folder with \`${SHOP_BUILD}\`.`,
        hint: `Each setting is one string, \`NAME=value\`, with no spaces around the equals sign. The folder of a monorepo is ${v('PROJECT_PATH')}, and the replacement for the detected build command is ${v('BUILD_COMMAND')}.`,
        check: {
          all: [
            {
              lint: 'absent',
              codes: ['ENV_FORMAT', 'ENV_WHITESPACE'],
              message: 'A setting has a space around the `=` or no `=` at all. The issues panel marks it.',
            },
            {
              path: 'compose[0].environmentParameters',
              op: 'includes',
              value: `PROJECT_PATH=${SHOP_FOLDER}`,
              message: `Set \`PROJECT_PATH=${SHOP_FOLDER}\` so Orbit builds that folder and not the repository root.`,
            },
            {
              path: 'compose[0].environmentParameters',
              op: 'includes',
              value: `BUILD_COMMAND=${SHOP_BUILD}`,
              message: `Set \`BUILD_COMMAND=${SHOP_BUILD}\`: the default build command is not the one this project uses.`,
            },
          ],
        },
        solution: {
          compose: [
            {
              environmentParameters: [
                ...SHOP_ENV,
                `PROJECT_PATH=${SHOP_FOLDER}`,
                `BUILD_COMMAND=${SHOP_BUILD}`,
              ],
            },
          ],
        },
      },
    },
    {
      id: 'push',
      title: 'A push becomes a version',
      body: [
        // fact: FACTS 15.3.5 (webhook, queue with one pending slot, debounce, newest commit wins, polling 60 to 86400 s; DOCS-ONLY)
        `The docs describe the push path: your Git host sends a {{term:webhook}} to the app's second port and Orbit queues one deploy. Pushes close together collapse, deploys never overlap and the newest commit wins. Without a webhook, ${v('POLLING_INTERVAL')} makes the app check on a timer, from a minute to a day.`,
        // fact: FACTS 15.3.4 (stages and hooks, DOCS-ONLY), 15.3.5 (stage names), 9.8.1 and 15.3.16 (Nixpacks is the page's word, not reconciled with the docs)
        "The build then runs in order. The docs name stages such as `git_pull`, `installing_dependencies`, `building` and `health_check`, with your `pre-deploy.sh` after the install. The page says {{term:nixpacks}} does the detecting; the docs describe it by the files it looks for, so treat the name as the page's claim.",
        // fact: FACTS 15.3.7 (a failed build, pre-deploy script, health check or timeout keeps the last good release live), 15.3.4 (last 3 releases kept)
        "The page and the docs say a failed build, script, health check or timeout leaves the last good release serving, and the last three releases are kept. The panels are an illustration: the stage names are the docs', the layout is not Orbit's output.",
      ],
      callouts: [
        {
          kind: 'tip',
          title: 'Where to look',
          body: "Your Git host lists recent deliveries and what came back, and the Orbit page says build logs stream in real time. This site's [troubleshooter](/troubleshoot) has a stage for Git deploys.",
        },
        {
          // fact: FACTS 15.3.5 (previews row: page lists them, docs say static sites only, billing not stated, UNVERIFIED)
          kind: 'gotcha',
          title: 'Previews',
          body: 'The page lists a {{term:preview-deploy}} for branches and pull requests. The docs describe it for static sites only and do not say how it is billed.',
        },
      ],
      stage: {
        kind: 'compare',
        left: {
          label: 'A push that deploys (illustration)',
          tone: 'good',
          lang: 'text',
          code: [
            'push to the branch',
            'webhook                 queued',
            'git_pull                done',
            'installing_dependencies done',
            'building                done',
            'starting_app            done',
            'health_check            passed',
            'completed               live',
          ].join('\n'),
        },
        right: {
          label: 'A build that fails (illustration)',
          tone: 'bad',
          lang: 'text',
          code: [
            'push to the branch',
            'webhook                 queued',
            'git_pull                done',
            'installing_dependencies done',
            'building                failed',
            "  Cannot find module 'express'",
            '(last release keeps serving)',
          ].join('\n'),
        },
      },
    },
    {
      id: 'orbit-or-spec',
      title: 'Orbit or your own spec',
      body: [
        'Both routes end in the same place: a spec on the network, priced by the same formula and run by the same nodes. With Orbit you bring source code. With your own spec you bring an image you built and tagged.',
        // fact: FACTS 15.3.1 (all 235 plain specs one component, VERIFIED-LIVE 2026-10-13), 15.3.10 (Custom 1 to 3 instances), 3 (instances up to 100, LIMITS)
        `Start with Orbit when you have a repository and want a push to deploy it. Write the spec yourself when you already publish an image, when the app is several containers, or when you need more than the ${ORBIT_CUSTOM.instancesMax} instances Orbit's Custom plan lists, where the network allows ${LIMITS.instances.max}. The ${PLAIN_ORBIT.value} plain Orbit specs read on ${PLAIN_ORBIT.readOn} all had one component.`,
        // fact: FACTS 15.3.14 (SETTLED: "deploy with Git on Orbit" and "deploy the runonflux/orbit image yourself" are two doors into the same image), 9.8.2
        `They are two doors into one thing: the docs describe the \`${ORBIT_IMAGE}\` image as one you can deploy yourself with the same variables.`,
      ],
      callouts: [
        {
          // fact: FACTS 15.4.1 and 15.4.3 (Orbit has its own MCP server with tools such as analyze_repository and validate_deployment; separate from the FluxCloud one, 15.4.8)
          kind: 'tip',
          title: 'Agents',
          body: "Orbit has its own Model Context Protocol ({{term:mcp}}) server, separate from FluxCloud's, with tools that analyse a repository, show the generated spec and its price without registering anything, and read logs. {{lesson:agents-and-mcp}} covers both.",
        },
      ],
      stage: {
        kind: 'compare',
        left: {
          label: 'With Orbit',
          tone: 'neutral',
          lang: 'text',
          code: [
            'you bring   source code',
            'Orbit does  builds, registers',
            'a push      rebuilds the app',
            'a failure   keeps the last one',
            'you choose  a plan or a size',
          ].join('\n'),
        },
        right: {
          label: 'With your own spec',
          tone: 'neutral',
          lang: 'text',
          code: [
            'you bring   an image you tagged',
            'you write   every field',
            'a release   is a signed update',
            'a rebuild   is your pipeline',
            'you choose  ports and volumes',
            'components  as many as you need',
          ].join('\n'),
        },
      },
    },
  ],
  checkpoint: [
    {
      id: 'which-plan',
      kind: 'choice',
      prompt:
        'A Next.js site keeps uploads in a persistent folder, must keep answering when its node restarts, and its build needs about 3 to 4 GB of RAM. Which of the fixed-size plans is the smallest that fits?',
      options: [
        {
          id: 'starter',
          label: 'Starter',
          why: `${cap(instancesOf(STARTER.instances))}, no persistent folders and ${STARTER.ramMb} MB of RAM: it misses all three.`,
        },
        { id: 'standard', label: 'Standard' },
        {
          id: 'pro',
          label: 'Pro',
          why: `It fits, but it is the bigger step: ${PRO.ramMb} MB at ${usd(priced(PRO))}.`,
        },
        {
          id: 'custom-one',
          label: 'Custom, with one instance',
          why: `Persistent folders need ${ORBIT_CUSTOM.persistentFoldersMinInstances} or more instances on Custom, and one instance is down while its node is.`,
        },
      ],
      answer: 'standard',
      // fact: FACTS 15.3.10 (plan table: instances, persistent folders), 15.3.18 row 5 (Next.js builds 3 to 4 GB)
      explain: `Standard is the smallest fixed-size plan with two instances, a persistent folder and enough RAM: ${sizeOf(STANDARD)}.`,
      hint: 'Compare the plans on instances, persistent folders and RAM.',
    },
    {
      id: 'standard-plus-one',
      kind: 'estimate',
      prompt: `Standard is ${sizeOf(STANDARD)} at ${usd(STANDARD.usd)} a month on the Orbit page. What does the same size cost a month on three instances, by the formula at the rates read on ${RATES_DATE}?`,
      spec: STANDARD_THREE,
      quantity: 'usd-per-month',
      tolerance: 0.1,
      unit: 'USD',
      // fact: FACTS 15.3.11 (Standard reproduced only with 2 instances: 1 gives 1.49, 3 give 3.99), 4.3 (the rates are for a bundle of three), lint INSTANCES_PRICE_CLIFF; computed by orbitPlanQuoteUsd
      explain: `The rates are stated for a bundle of three instances and each instance pays a share: ${usd(STANDARD_ONE)} for one, ${usd(STANDARD_TWO)} for two (the page's price) and ${usd(STANDARD_THREE_USD)} for three. A fourth would cost ${usd(STANDARD_FOUR)}, because a small app loses its discount at four.`,
      hint: "The page's price is for two instances. A third instance adds a share of its own.",
    },
    {
      id: 'seal-the-token',
      kind: 'spec-fix',
      prompt:
        'A teammate deployed the Orbit image by hand for a private repository, as a plain spec with the token in `GIT_TOKEN`. Fix it so nothing secret is published, and keep the token.',
      spec: PRIVATE_SPEC,
      // fact: FACTS 15.3.6 and 15.3.9 (plain specs show every value; private repositories and secret variables are deployed encrypted), 3.7, 15.3.2 (3 live plain specs name GIT_TOKEN)
      check: {
        all: [
          {
            lint: 'absent',
            codes: ['ENV_SECRET_PUBLIC'],
            message: 'The token is still published: a plain spec is public. Encrypt the spec.',
          },
          {
            path: 'enterprise',
            op: 'exists',
            message:
              'Turn Enterprise on rather than deleting the token: Orbit needs it to clone the repository.',
          },
          {
            path: 'compose[0].environmentParameters',
            op: 'matches',
            value: '^GIT_TOKEN=',
            message: 'Keep `GIT_TOKEN`: the private repository cannot be cloned without it.',
          },
        ],
      },
      solution: { enterprise: SEALED },
      explain:
        'A plain spec is public: anyone who asks the API can read the token, and earlier versions stay readable. The Orbit page says it deploys private repositories encrypted; by hand that is the `enterprise` setting, which changes the price and limits the app to ArcaneOS nodes. Then replace the token: a public one is no longer secret.',
      hint: 'The issues panel names a secret in a public spec. Which setting makes the components private?',
    },
    {
      id: 'read-the-failure',
      kind: 'match',
      prompt: 'Match each message from a failed deploy to its likely cause.',
      pairs: [
        {
          id: 'clone',
          left: 'The first log lines say `Failed to clone repository` and `Authentication failed`',
          right: 'A private repository without a `GIT_TOKEN`, or an address missing `https://`',
        },
        {
          id: 'module',
          left: '`Cannot find module` for a package that `package.json` lists',
          right: 'Dependencies were not installed cleanly: try `FORCE_INSTALL` or `INSTALL_COMMAND`',
        },
        {
          id: 'heap',
          left: '`Ineffective mark-compacts near heap limit` during the build',
          right: 'The build ran out of memory: pick a plan or size with more RAM',
        },
        {
          id: 'port',
          left: 'The app logs that it listens on 8080, yet its address answers nothing',
          right: '`APP_PORT` is not the port the server listens on',
        },
      ],
      // fact: FACTS 15.3.18 (Common build and run failures) rows 1, 4, 5 and 6 (DOCS-ONLY: the Deploy with Git troubleshooting page)
      explain:
        'Each failure breaks a different stage: the clone, the install, the build and the start. The message names the stage, and the stage names the setting to check.',
      hint: 'Sort by stage: clone, install, build, start.',
    },
    {
      id: 'start-with-orbit',
      kind: 'choice',
      prompt: 'Which of these should start with Orbit?',
      options: [
        {
          id: 'ci-image',
          label: 'A team whose CI publishes a tested image for each release',
          why: 'They already have an image, which is what a spec needs.',
        },
        {
          id: 'three-containers',
          label: 'A service of three containers that reach each other by name',
          why: "Every Orbit app read had one component. Several containers are what a spec's compose list is for.",
        },
        {
          id: 'solo',
          label: 'A solo developer with a Node.js repository, no Dockerfile and no registry account',
        },
        {
          id: 'ten',
          label: 'An app that needs ten instances',
          why: `Orbit's Custom plan lists up to ${ORBIT_CUSTOM.instancesMax} instances, and a spec can ask for up to ${LIMITS.instances.max}.`,
        },
      ],
      answer: 'solo',
      // fact: FACTS 15.3.1, 15.3.10, 15.3.14
      explain:
        "Orbit starts from a repository and redeploys on every push. The other three already have an image, need several components or need more instances than Orbit's plans list: each is a spec you write. {{lesson:multi-component}} covers several components.",
      hint: 'Ask what each team already has: an image, a repository or neither.',
    },
  ],
  recap: [
    `Orbit registers an ordinary version 8 spec: the image \`${ORBIT_IMAGE}\`, your repository in ${v('GIT_REPO_URL')} and a second port for the webhook.`,
    `A plan is a size. The three published prices equal the formula at the rates read on ${RATES_DATE}; the page names no price for a Custom size, so use the formula for an estimate and read the price at checkout.`,
    "One instance is down while its node is. Two make a restart survivable; Orbit's rollback guards against a bad commit, not a lost node.",
    'The Deploy to Flux button is a link with `repo`, `branch`, `projectPath` and `plan`. It opens the form and deploys nothing.',
    'Build settings are variables in a spec anyone can read: keep tokens out of plain specs and the repository. A failed build names the stage that broke.',
  ],
  further: [
    { label: 'Orbit: plans, how it works and FAQ', url: 'https://runonflux.com/apps/orbit' },
    { label: 'The Deploy to Flux button', url: 'https://runonflux.com/apps/orbit/deploy-to-flux' },
    {
      label: 'Deploy with Git docs: environment reference',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-git/configuration/environment-reference',
    },
    {
      label: 'Deploy with Git docs: troubleshooting',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-git/troubleshooting/common-issues',
    },
  ],
  terms: ['git-deploy', 'nixpacks', 'webhook', 'deploy-button', 'monorepo', 'rollback', 'preview-deploy'],
};

export default lesson;
