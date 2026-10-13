/**
 * A synthetic lesson that touches every stage kind, every task kind and every doing challenge, so the
 * lesson engine can be developed, tested and demonstrated without real content. It lives outside
 * `content/lessons`, so the content glob never sees it. In development it is served at
 * `/learn/fixture-tour` (see `learn/loader.ts`).
 *
 * The facts in it are real (FACTS sections 3.4 and 4) but it is test data: do not copy it into content.
 */

import type { LessonMeta } from '@shared/curriculum';
import type { Lesson, TerminalScript } from '../types';

export const tourMeta: LessonMeta = {
  id: 'fixture-tour',
  track: 'nimbus',
  module: 'Fixtures',
  title: 'Fixture tour: one of everything',
  summary: 'A synthetic lesson that uses every stage and task kind, for developing the player.',
  minutes: 6,
  kind: 'project',
  prerequisites: [],
  labs: ['spec-forge', 'terminal'],
  order: 99,
};

const buildScript: TerminalScript = {
  id: 'tour-build',
  cwd: '~/hello',
  files: {
    Dockerfile:
      'FROM node:22-alpine\nWORKDIR /app\nCOPY server.js .\nEXPOSE 3000\nCMD ["node", "server.js"]\n',
    'server.js':
      "require('http').createServer((req, res) => res.end('hello from flux\\n')).listen(3000, '0.0.0.0');\n",
  },
  intro: ['Simulation. Nothing here touches your machine or the network.'],
  commands: [
    {
      match: '^docker build -t (\\S+) \\.$',
      output: ['[+] Building 3.1s (7/7) FINISHED', '[ok] naming to docker.io/{1}'],
      goal: 'build',
      explain: 'Docker read the Dockerfile and made an image. The tag after -t is its name on a registry.',
      example: 'docker build -t me/hello:1.0 .',
    },
    {
      match: '^docker push (\\S+)$',
      output: ['The push refers to repository [docker.io/{1}]', '[ok] 1.0: digest: sha256:4f1a size: 1570'],
      goal: 'push',
      explain: 'The image is now public, so every node can pull it by that name.',
      example: 'docker push me/hello:1.0',
    },
  ],
  goals: [
    { id: 'build', label: 'Build the image and tag it' },
    { id: 'push', label: 'Push the image to a registry' },
  ],
};

const checkpointScript: TerminalScript = {
  id: 'tour-check',
  cwd: '~/hello',
  intro: ['Simulation. Nothing here touches your machine or the network.'],
  commands: [
    {
      match: '^docker images$',
      output: ['REPOSITORY   TAG   IMAGE ID', 'me/hello     1.0   4f1a9c20b1d3'],
      goal: 'list',
      explain: 'The image you built is on this machine.',
      example: 'docker images',
    },
  ],
  goals: [{ id: 'list', label: 'List the images on this machine' }],
};

export const tourLesson: Lesson = {
  id: 'fixture-tour',
  hook: 'This synthetic lesson deploys a tiny web app in nine steps and touches every stage the player can show. You finish with a spec that is valid and cheap.',
  objectives: [
    'Find the port that does not match the container.',
    'Place three instances and break one.',
    'Keep a spec under a monthly budget.',
  ],
  steps: [
    {
      id: 'layers',
      title: 'The stack under your app',
      body: [
        'Your app runs in a container on a {{term:fluxnode}} owned by a stranger. FluxOS turns that machine into a small cloud server.',
        'Nothing in this lesson is real: the stages are simulations, and the numbers come from the same pricing code the server uses.',
      ],
      callouts: [
        { kind: 'why', body: 'Knowing who runs the machine explains why one instance is never enough.' },
      ],
      stage: { kind: 'diagram', id: 'flux-layers', beat: 0 },
    },
    {
      id: 'server',
      title: 'A server that listens on 3000',
      body: [
        'The app is six lines of Node. It listens on port 3000, on `0.0.0.0`, so traffic from outside the container can reach it.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          body: 'A server bound to `127.0.0.1` answers only itself. Inside a container that means nobody.',
        },
      ],
      stage: {
        kind: 'code',
        files: [
          {
            name: 'server.js',
            lang: 'js',
            code: "require('http')\n  .createServer((req, res) => res.end('hello from flux'))\n  .listen(3000, '0.0.0.0');\n",
            highlight: [3],
          },
          {
            name: 'Dockerfile',
            lang: 'dockerfile',
            code: 'FROM node:22-alpine\nWORKDIR /app\nCOPY server.js .\nEXPOSE 3000\nCMD ["node", "server.js"]\n',
            highlight: [4],
          },
        ],
      },
    },
    {
      id: 'build',
      title: 'Build and push the image',
      body: [
        'Flux nodes pull a public image by name, so the image has to be on a registry before you register anything.',
        'Build it with a tag, then push that tag.',
      ],
      stage: { kind: 'terminal', script: buildScript },
      task: {
        kind: 'terminal',
        goals: ['build', 'push'],
        prompt: 'Build the image, then push it.',
        hint: 'Start with `docker build -t me/hello:1.0 .` and push the same tag.',
      },
    },
    {
      id: 'spec',
      title: 'Describe it in a spec',
      body: [
        'The spec says which image to run and which ports to open. The public port is the one the world calls; the container port is the one your app listens on.',
        'Here they do not match: the container port is 80 and the app listens on 3000.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          title: 'Two numbers, one job',
          body: 'A mismatch is not an error. The app starts, the port answers nothing, and the page never loads.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'hello-tour',
          instances: 3,
          compose: [{ name: 'web', repotag: 'me/hello:1.0', ports: [31001], containerPorts: [80] }],
        },
        editable: ['compose[0].containerPorts', 'compose[0].ports'],
        focus: [{ path: 'compose[0].containerPorts', note: 'This must be the port the app listens on.' }],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Set the container port to 3000.',
        hint: 'The app calls `listen(3000)`, so the container port is 3000. The public port can stay.',
        check: {
          path: 'compose[0].containerPorts',
          op: 'includes',
          value: 3000,
          message: 'The container port must be the one the app listens on.',
        },
        solution: { compose: [{ containerPorts: [3000] }] },
      },
    },
    {
      id: 'price',
      title: 'Keep it cheap',
      body: [
        'Price follows CPU, RAM, disk and instances. This copy asks for eight instances and a full core.',
        'Bring the monthly price under two and a half dollars.',
      ],
      callouts: [
        { kind: 'cost', body: 'Past three instances every extra copy is billed at close to full price.' },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'hello-tour',
          instances: 8,
          compose: [
            {
              name: 'web',
              repotag: 'me/hello:1.0',
              ports: [31001],
              containerPorts: [3000],
              cpu: 1,
              ram: 2000,
              hdd: 5,
            },
          ],
        },
        editable: ['instances', 'compose[0].cpu', 'compose[0].ram', 'compose[0].hdd'],
        show: ['form', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Get the price under $2.50 a month.',
        check: { price: 'max', usd: 2.49, message: 'Still over $2.49 a month. Fewer instances cost less.' },
        solution: { instances: 3 },
      },
    },
    {
      id: 'place',
      title: 'Place three copies',
      body: [
        'Each instance lands on a different node. One instance is a single point of failure.',
        'Drag the control until three copies are placed.',
      ],
      stage: {
        kind: 'diorama',
        scene: 'placement',
        instances: 1,
        controls: ['instances'],
      },
      task: { kind: 'set-instances', min: 3, prompt: 'Place at least 3 instances.' },
    },
    {
      id: 'break',
      title: 'Break a node',
      body: [
        'Nodes fail. The point of three copies is that one failure does not take the app down.',
        'Kill a node and watch the requests find another.',
      ],
      stage: {
        kind: 'diorama',
        scene: 'failover',
        instances: 3,
        controls: ['kill', 'revive', 'request'],
      },
      task: { kind: 'kill-nodes', count: 1, prompt: 'Kill one node.' },
    },
    {
      id: 'bind',
      title: 'Two ways to bind',
      body: [
        'The two lines differ by one address. Only one of them is reachable from outside the container.',
      ],
      stage: {
        kind: 'compare',
        left: {
          label: 'Binds to localhost',
          tone: 'bad',
          code: "server.listen(3000, '127.0.0.1');",
          lang: 'js',
        },
        right: {
          label: 'Binds to all interfaces',
          tone: 'good',
          code: "server.listen(3000, '0.0.0.0');",
          lang: 'js',
        },
      },
      task: {
        kind: 'confirm',
        label: 'My image is public on a registry',
        prompt: 'Confirm that the image you push is public.',
      },
    },
    {
      id: 'register',
      title: 'Register it',
      body: [
        'FluxCloud walks you through registration in a fixed order. The simulator mirrors it so you can rehearse.',
      ],
      callouts: [
        { kind: 'tip', body: 'Open cloud.runonflux.com in another tab to compare with the real thing.' },
      ],
      stage: { kind: 'widget', id: 'fluxcloud-sim', props: { flow: 'register' } },
      task: { kind: 'widget', prompt: 'Finish the registration flow.' },
    },
  ],
  checkpoint: [
    {
      id: 'order-lifecycle',
      kind: 'order',
      prompt: 'Put the life of a deployment in order.',
      items: [
        { id: 'write', label: 'You write and sign the spec' },
        { id: 'pay', label: 'You pay within the window' },
        { id: 'pick', label: 'Nodes decide to run it' },
        { id: 'start', label: 'The containers start' },
      ],
      explain:
        'Nothing runs until a node picks the app up, and nodes only see it after it is paid for and on the chain.',
      hint: 'The spec comes first and the running containers last. Payment sits between.',
    },
    {
      id: 'fix-ports',
      kind: 'spec-fix',
      prompt: 'This spec is rejected. Make it valid.',
      spec: {
        name: 'flux-hello',
        compose: [{ name: 'my-app', repotag: 'me/hello:1.0', ports: [22], containerPorts: [3000] }],
      },
      check: { lint: 'valid', message: 'The spec still has errors. Read each one: they say what to change.' },
      solution: { name: 'hello-app', compose: [{ name: 'app', ports: [31001] }] },
      explain:
        'The name cannot start with flux, the component name cannot hold a hyphen and port 22 is banned.',
      hint: 'Three separate rules are broken. The issues list names each one.',
    },
    {
      id: 'build-budget',
      kind: 'spec-build',
      prompt: 'Build a spec for a small API that survives one node failing.',
      spec: { name: 'budget-api', instances: 1, compose: [{ name: 'app', cpu: 0.1, ram: 100, hdd: 1 }] },
      requirements: [
        { id: 'copies', label: 'At least 3 instances', check: { path: 'instances', op: 'gte', value: 3 } },
        {
          id: 'cpu',
          label: 'At least half a core',
          check: { path: 'compose[0].cpu', op: 'gte', value: 0.5 },
        },
        { id: 'price', label: 'Under $2.50 a month', check: { price: 'max', usd: 2.49 } },
        { id: 'valid', label: 'No lint errors', check: { lint: 'valid' } },
      ],
      solution: { instances: 3, compose: [{ cpu: 0.5, ram: 500 }] },
      explain: 'Three instances survive one failure, and the small-app discount keeps three cheap.',
      hint: 'Instances and CPU are the two things to raise. Watch the price chip as you go.',
    },
    {
      id: 'estimate-price',
      kind: 'estimate',
      prompt: 'What does this spec cost per month in USD?',
      spec: { name: 'estimate-me', instances: 3, compose: [{ name: 'app', cpu: 1, ram: 2000, hdd: 5 }] },
      quantity: 'usd-per-month',
      tolerance: 0.1,
      unit: 'USD',
      explain:
        'The price is built from resources, then instances, then the small-app discount, then rounded up.',
      hint: 'CPU and RAM dominate. A third of the bundle price is one instance.',
    },
    {
      id: 'terminal-images',
      kind: 'terminal',
      prompt: 'List the images on this machine.',
      script: checkpointScript,
      goals: ['list'],
      explain: 'Images live on the machine that built them until you push them.',
      hint: 'The command is `docker images`.',
    },
  ],
  recap: [
    'The container port is the one your app listens on, not the public one.',
    'Price follows resources first and instances second.',
    'Three instances survive one node failing.',
  ],
  further: [
    { label: 'FluxCloud documentation', url: 'https://docs.runonflux.com/fluxcloud' },
    { label: 'FluxCloud', url: 'https://cloud.runonflux.com' },
  ],
  terms: ['fluxnode'],
};

/** The loader (`learn/loader.ts`) finds a fixture by these two exports. */
export { tourLesson as lesson, tourMeta as meta };
