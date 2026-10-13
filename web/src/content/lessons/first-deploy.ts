/**
 * Lesson 5, first-deploy: containerise a tiny server, describe it, price it, walk the registration and see
 * where it lands. Planted failure: containerPorts says 80, the server listens on 3000.
 *
 * Facts: docs/research/FACTS.md. Each fact is tagged `// fact: FACTS <section>` on the data it supports.
 */

import {
  BAKED_PRICING,
  DEPLOY_ESTIMATE_MIN,
  FDM_TIMING,
  IMAGE_RECHECK_HOURS,
  PAYMENT_WINDOW_MIN,
  UI_WATCHER_MIN,
  UI_WATCHER_POLL_SEC,
} from '@shared/flux';
import type { Lesson } from '@/learn/types';
import { dockerfile, firstDeployShip, serverJs } from '../terminals/first-deploy-ship.ts';

/** The network's price floor, from the engine's rate card, so prose and checks follow it. */
const FLOOR = BAKED_PRICING.params.minUSDPrice;
/** The budget of the build challenge: the floor plus fifty cents of headroom, written as USD 1.49. */
const BUDGET = Math.round((FLOOR + 0.5) * 100) / 100;

/** One container, as a partial component the spec stages merge over the engine default. */
const web = {
  name: 'web',
  description: 'Node web server',
  repotag: 'yourname/hello-flux:1.0.0',
  ports: [31001],
  containerPorts: [3000],
  domains: [''],
  environmentParameters: [],
  commands: [],
  containerData: '/tmp',
  repoauth: '',
};

const lesson: Lesson = {
  id: 'first-deploy',
  hook: 'Every deployment is the same short chain: a server, an image, a spec, a price, a signature and a payment. You will walk it once, catch a misconfiguration the validator cannot see, and finish with a priced spec and a public address.',
  objectives: [
    'Make a server reachable: bind `0.0.0.0` and point `containerPorts` at the port it listens on.',
    'Fix a spec the validator would refuse: a reserved name, a hyphenated component and a banned port.',
    'Estimate a monthly price and size three instances down to the minimum.',
    `Put the FluxCloud registration steps in order, and tell the clocks around payment apart: ${PAYMENT_WINDOW_MIN} minutes on the screen, an hour on the node and a label of up to ${DEPLOY_ESTIMATE_MIN} minutes.`,
  ],
  steps: [
    {
      id: 'plan',
      title: 'One chain, one direction',
      body: [
        'A first deployment is a chain, and each link makes what the next one needs. You write a server, put it in an image, publish the image, describe it in a spec, then register and pay. After that, nodes you do not own pick the app up and start it.',
        'The diagram is the second half of that trip, from the spec onward, and it ends where your address starts working. The first two stations are yours: the spec and its signed registration. After the payment lands in a block, every station belongs to the network, which you followed in {{lesson:how-apps-run}}.',
      ],
      callouts: [
        {
          kind: 'why',
          body: 'One easy misconfiguration sits at a seam between two links. The image is fine, the spec is fine, and they disagree about a port. This lesson plants one so you can catch it.',
        },
      ],
      // fact: FACTS 6.1 (the sequence); the last beat draws every station, ending at the domain
      stage: { kind: 'diagram', id: 'lifecycle', beat: 6 },
    },
    {
      id: 'containerise',
      title: 'The whole app is two files',
      body: [
        'This is the entire app. It answers every request with one line that includes the address of the node that served it. FluxOS sets `FLUX_NODE_HOST_IP` inside every container it starts, so three instances will print three different addresses.',
        'Look at the `listen` call. It carries the two things Flux needs to know: the port, 3000, and the address, `0.0.0.0`, which means every network interface of the container. A server bound to `127.0.0.1` would answer only from inside its own container.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 3.4 (the spec's ports are what gets published)
          body: '`EXPOSE` in a Dockerfile is a note to humans. Flux forwards the ports your spec lists and nothing else, so the number has to go into the spec as well.',
        },
      ],
      stage: {
        kind: 'code',
        files: [
          { name: 'server.js', lang: 'js', code: serverJs, highlight: [3, 11] },
          { name: 'Dockerfile', lang: 'dockerfile', code: dockerfile, highlight: [4] },
        ],
      },
    },
    {
      id: 'ship-image',
      title: 'Build for amd64, then push',
      body: [
        'Flux nodes pull your image from a registry, so it has to leave your machine. Build it, give it your registry namespace and a version tag, then push it. This simulated laptop is Apple silicon, which builds arm64 images unless told otherwise.',
        // fact: FACTS 11 row 4 (arm64 is accepted by the validator, so an arm64-only image registers but starves), 2.5 (arm64 nodes are rare)
        'Almost every node is amd64. At the time of writing the network has only a handful of arm64 nodes among thousands. An arm64-only image still registers for a public app, because the validator accepts either architecture, but almost no node can run it, so the app stays short of instances. An enterprise app is refused, because it needs amd64. Say `--platform linux/amd64` when you build.',
        // fact: FACTS 3.3 (repotag pattern is lowercase only; a docker.io/ prefix fails the registry lookup)
        'Write the image name the way the registry knows it. FluxOS itself refuses an uppercase `repotag`, and a `docker.io/` prefix fails the lookup. For Docker Hub the name is just `yourname/hello-flux:1.0.0`, with no host in front.',
      ],
      callouts: [
        {
          kind: 'tip',
          // fact: FACTS 6.3 and 11 row 19 (image re-check every 6 hours: digest comparison, then a soft redeploy)
          body: `Tag with a version such as \`1.0.0\`, not \`latest\`. FluxOS is set to compare the digest of the image a container runs with the registry digest for the same tag about every ${IMAGE_RECHECK_HOURS} hours, and to redeploy softly when they differ (read from the source, not observed live). So \`latest\` can change under a running app.`,
        },
      ],
      stage: { kind: 'terminal', script: firstDeployShip },
      task: {
        kind: 'terminal',
        goals: ['build', 'push'],
        prompt: 'Build the image for linux/amd64, then push it.',
        hint: 'Two details decide whether the result is usable: the platform and the name. Almost every Flux node runs linux/amd64, and a registry only accepts a name that starts with your namespace.',
      },
    },
    {
      id: 'spec',
      title: 'The spec: one number must match',
      body: [
        'A {{term:component}} is one container of the app, described in the spec. This app has one: an image and two port lists. {{term:ports}} is where the world reaches the node. {{term:container-ports}} is where Docker delivers that traffic inside the container, paired by position.',
        'This spec registers, validates and runs, and it serves nothing: the container listens on 3000 and the spec delivers to 80. The validator cannot look inside your image, so this mismatch is yours to catch.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 11 row 1, 14.1 (the node port test is FluxOS's own temporary listener, checked from another node)
          body: 'A mismatch is not an error. The app starts, the public address answers nothing useful, and nothing in the registration flow complains. The nodes test a port with a small listener of FluxOS itself, from another node, so that test measures whether the node is reachable, not whether your process listens where you said.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'hello-flux',
          description: 'Hello world, served by Flux',
          instances: 3,
          compose: [{ ...web, containerPorts: [80], cpu: 0.5, ram: 500, hdd: 5 }],
        },
        editable: ['name', 'compose[0].repotag', 'compose[0].ports', 'compose[0].containerPorts'],
        focus: [
          { path: 'compose[0].repotag', note: 'The image you just pushed, with its version tag.' },
          { path: 'compose[0].ports', note: 'The public port on the node. 31001 is a safe choice.' },
          {
            path: 'compose[0].containerPorts',
            note: 'Where traffic is delivered inside the container. It has to be the port the process listens on.',
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Point `containerPorts` at the port `server.js` listens on.',
        hint: 'Docker delivers traffic to the container port in the spec. If the process listens somewhere else, nothing answers. Which port does `server.js` pass to `listen`?',
        check: {
          path: 'compose[0].containerPorts',
          op: 'includes',
          value: 3000,
          message: 'The container port has to be the port the process listens on.',
        },
        solution: { compose: [{ containerPorts: [3000] }] },
      },
    },
    {
      id: 'price',
      title: 'What it costs, and the floor',
      body: [
        "The price panel shows what the network would charge for one month, using the same rules it applies. The starting values are FluxCloud's own: 1 core, 2000 MB of RAM and 20 GB of disk for each running copy, which Flux calls an {{term:instance}}. A month is 88,000 blocks, the default {{term:expire}}.",
        'First raise the instances to 3, which the FluxCloud form recommends for a decentralized network, and watch the price jump. Then size down. A hello server needs a fraction of a core and a few hundred MB, and the price stops falling at a floor.',
      ],
      callouts: [
        {
          kind: 'cost',
          // fact: FACTS 4.4 (minimum price), 4.1 (rate card)
          body: `The network never charges less than its minimum, whatever you shrink. At the time of writing that is USD ${FLOOR.toFixed(2)} a month, so a tiny app and a tinier one cost the same.`,
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'hello-flux',
          description: 'Hello world, served by Flux',
          instances: 1,
          compose: [{ ...web, cpu: 1, ram: 2000, hdd: 20 }],
        },
        editable: ['instances', 'compose[0].cpu', 'compose[0].ram', 'compose[0].hdd'],
        show: ['form', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Run three instances and size the app down until the price stops falling.',
        hint: 'CPU, RAM and disk each add to the price, and CPU is the heaviest per unit. Lower all three and watch the price: when it stops moving you are at the floor.',
        check: {
          all: [
            { path: 'instances', op: 'eq', value: 3, message: 'Keep three instances.' },
            {
              price: 'max',
              usd: FLOOR,
              message: 'The price is still above the network minimum. Lower CPU, RAM or disk.',
            },
          ],
        },
        solution: { instances: 3, compose: [{ cpu: 0.5, ram: 500, hdd: 5 }] },
      },
    },
    {
      id: 'register',
      title: 'Register: the real flow, simulated',
      body: [
        'Registration happens in FluxCloud, the dashboard at [cloud.runonflux.com](https://cloud.runonflux.com). The order is fixed: validate the spec, sign it, run a test installation, pay, then wait for nodes to deploy. The simulator follows the real screens and labels in that order.',
        'In the simulator nothing leaves this page and nothing is charged. On the real network you sign with the account you logged in with and then pay promptly.',
        // fact: FACTS 6.6 (the clocks: 30 minute UI text, 3,600 s message lifetime per node, 30 s watcher, 45 minute label)
        'Three clocks sit around the payment, and they are not the same kind. After the test installation the payment card reads "Payment window: 30 minutes remaining", a fixed line of text. The network keeps your registration for an hour, counted on each node from the moment it receives it.',
        `After you pay, FluxCloud checks every ${UI_WATCHER_POLL_SEC} seconds for ${UI_WATCHER_MIN} minutes and reports success as soon as one copy is running. "Up to 45 min after payment" is a label too: nodes that are too big for a small app wait before taking it, so a copy can take longer.`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 11 row 22, 4.7, 6.6
          body: `Pay the quoted amount soon after you register. The screen says ${PAYMENT_WINDOW_MIN} minutes and the node keeps the registration for an hour, and after that a payment finds nothing to link: the app shows as registered and never installs. A payment below the network's floor is dropped as well. Pay the quote anyway: FluxCloud asks for it and the card relay needs at least 98 percent of it.`,
        },
      ],
      stage: { kind: 'widget', id: 'fluxcloud-sim', props: { flow: 'register' } },
      task: { kind: 'widget', prompt: 'Walk the simulated registration through to the last screen.' },
    },
    {
      id: 'find-it',
      title: 'Where it lands',
      body: [
        'Nobody assigns your copies to nodes. Each node reads the public app list on its own timer, finds apps that are short of instances and installs them if it can. In practice each copy runs on a different node: no live app has two copies on one host. Placement promises nothing beyond that, and different nodes can still sit with the same hosting provider.',
        `Your address is built from the app name: \`hello-flux.app.runonflux.io\`. It points at Flux's proxy, which spreads different visitors across the instances that are up and keeps one browser on the same instance for up to ${FDM_TIMING.stickyHours} hours. {{lesson:ports-and-domains}} takes that apart.`,
      ],
      // fact: FACTS 6.2 (no central scheduler, no two instances on one node IP), 6.4 (domain)
      stage: { kind: 'diorama', scene: 'placement', instances: 1, controls: ['instances'] },
      task: {
        kind: 'set-instances',
        exactly: 3,
        prompt: 'Set the instances to 3 and watch where the copies land.',
      },
    },
  ],
  checkpoint: [
    {
      id: 'fix-the-refusals',
      kind: 'spec-fix',
      prompt:
        'This spec was written in a hurry and registration would refuse it. Fix it until the validator reports no errors. Leave the container port alone.',
      spec: {
        name: 'fluxquotes',
        description: 'A small quotes API',
        instances: 3,
        compose: [
          {
            name: 'quote-api',
            description: 'Quotes API',
            repotag: 'yourname/quotes:1.2.0',
            ports: [22],
            containerPorts: [8000],
            domains: [''],
            environmentParameters: [],
            commands: [],
            containerData: '/tmp',
            cpu: 0.5,
            ram: 500,
            hdd: 5,
            repoauth: '',
          },
        ],
      },
      // fact: FACTS 3.2 (name), 3.3 (component name), 3.4 (banned ports)
      check: {
        all: [
          {
            lint: 'valid',
            message:
              'The validator still refuses this spec. The issues panel names each rule and the field it concerns.',
          },
          {
            path: 'compose[0].containerPorts',
            op: 'includes',
            value: 8000,
            message: 'The container port stays 8000: that is where the process listens.',
          },
        ],
      },
      solution: { name: 'quotes', compose: [{ name: 'quoteapi', ports: [31001] }] },
      explain:
        'App names cannot start with `flux` or `zel`: those prefixes are reserved. Component names allow letters and digits only, and port 22 is on the banned list. All three are checked before anything is signed.',
      hint: 'Read the issues panel: each message names its rule. Three different rules are broken, one in the app name, one in the component name and one in the public port.',
    },
    {
      id: 'ship-quotes',
      kind: 'spec-build',
      prompt:
        'Build the spec for a quotes API. The image is `yourname/quotes:1.2.0`, it listens on 8000 and the budget is tight.',
      spec: {
        name: 'quotes',
        description: 'A small quotes API',
        instances: 1,
        compose: [
          {
            name: 'api',
            description: 'Quotes API',
            repotag: 'nginx:1.27',
            ports: [8080],
            containerPorts: [8080],
            domains: [''],
            environmentParameters: [],
            commands: [],
            containerData: '/tmp',
            cpu: 2,
            ram: 4000,
            hdd: 40,
            repoauth: '',
          },
        ],
      },
      requirements: [
        {
          id: 'image',
          label: 'The image is `yourname/quotes:1.2.0`',
          check: {
            path: 'compose[0].repotag',
            op: 'eq',
            value: 'yourname/quotes:1.2.0',
            message: 'Use the tag exactly as the brief gives it, version included.',
          },
        },
        {
          id: 'container-port',
          label: 'Traffic is delivered to port 8000',
          check: {
            path: 'compose[0].containerPorts[0]',
            op: 'eq',
            value: 8000,
            message: 'The process listens on 8000, so that is where the traffic has to go.',
          },
        },
        {
          id: 'free-port',
          label: 'The public port is neither banned nor charged extra',
          // fact: FACTS 3.4, 4.4 (enterprise ports cost USD 2 each)
          check: {
            lint: 'absent',
            codes: ['PORT_FEE', 'PORT_BANNED'],
            message:
              'Choose a public port outside the banned and charged ranges. Numbers in the 31000 range are free.',
          },
        },
        {
          id: 'copies',
          label: 'Three instances',
          check: {
            path: 'instances',
            op: 'eq',
            value: 3,
            message: 'The brief asks for three copies.',
          },
        },
        {
          id: 'budget',
          label: `At most USD ${BUDGET.toFixed(2)} a month`,
          check: {
            price: 'max',
            usd: BUDGET,
            message: 'Lower CPU, RAM or disk, and keep the three instances.',
          },
        },
        {
          id: 'valid',
          label: 'No errors',
          check: { lint: 'valid', message: 'The issues panel still lists an error to fix.' },
        },
      ],
      solution: {
        instances: 3,
        compose: [
          {
            repotag: 'yourname/quotes:1.2.0',
            ports: [31001],
            containerPorts: [8000],
            cpu: 0.5,
            ram: 500,
            hdd: 5,
          },
        ],
      },
      explain:
        'The container port is the process, the public port is the doorway and each instance costs a third of the bundle. Half a core, 500 MB and 5 GB for three instances sits at the network minimum.',
      hint: 'Five things differ from a working spec: the image, the container port, the public port, the instance count and the size. Change them one at a time and watch the checklist and the price.',
    },
    {
      id: 'estimate-price',
      kind: 'estimate',
      prompt:
        'What does this cost per month in USD: 1 core, 2000 MB of RAM and 20 GB of disk, five instances, public port 31001?',
      spec: {
        name: 'estimate-me',
        instances: 5,
        compose: [{ ...web, cpu: 1, ram: 2000, hdd: 20 }],
      },
      quantity: 'usd-per-month',
      tolerance: 0.1,
      unit: 'USD',
      // fact: FACTS 4.3 and 4.4 (small app discount stops at 4 instances), 9.5.3 spot check
      explain:
        'Five instances are past the small-app discount, so each one is billed at the full per-instance rate and the total is rounded up to the next price ending in .49 or .99.',
      hint: 'Work out one instance first: CPU, RAM and disk add up, then a third of that. Then remember what changes once you pass three instances.',
    },
    {
      id: 'registration-order',
      kind: 'order',
      prompt: 'Put the registration in the order FluxCloud runs it.',
      items: [
        { id: 'validate', label: 'Validate the spec' },
        { id: 'sign', label: 'Sign the registration message' },
        { id: 'test', label: 'Run the test installation' },
        { id: 'pay', label: `Pay (the screen says within ${PAYMENT_WINDOW_MIN} minutes)` },
        {
          id: 'deploy',
          label: `Wait for nodes to deploy (the screen says up to ${DEPLOY_ESTIMATE_MIN} minutes)`,
        },
      ],
      // fact: FACTS 9.4.4 (rows 1 to 8), 6.6 (the clocks)
      explain:
        'Validation comes first because there is no point signing a spec the network will refuse, and the test installation proves the image starts before you pay. After payment the network does the rest.',
      hint: 'Nothing is paid until the spec has been checked, signed and test-installed. Deployment is the one step you do not perform.',
    },
  ],
  recap: [
    'Bind `0.0.0.0` and put the port the process listens on into `containerPorts`: the validator cannot check it for you.',
    '`ports` is public and sometimes charged, `containerPorts` is internal, and the two lists pair by position.',
    'Build for linux/amd64: an arm64-only image registers for a public app but almost no node can run it. Push under your namespace and tag a version, not `latest`.',
    'The price has a floor and a small-app discount that ends at the fourth instance.',
    `Registration is validate, sign, test, pay, then deployment. The screen says ${PAYMENT_WINDOW_MIN} minutes to pay and up to ${DEPLOY_ESTIMATE_MIN} minutes to deploy: both are labels, and the node itself keeps the registration for an hour.`,
  ],
  further: [
    {
      label: 'FluxCloud docs: components (its 1024 port minimum is advice, the network allows 1 to 65535)',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
    {
      label: 'FluxCloud docs: review, signing and payment',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/review',
    },
    { label: 'FluxCloud, the real dashboard', url: 'https://cloud.runonflux.com' },
  ],
  terms: ['component', 'instance', 'ports', 'container-ports', 'expire'],
};

export default lesson;
