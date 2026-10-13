/**
 * Lesson 8, env-and-secrets: environment variables, the start command, what a public spec exposes,
 * enterprise (an encrypted spec) and private images.
 *
 * Planted failure: a database password in `environmentParameters` of a public spec (steps 3 and 5), and a
 * private image with credentials in a public spec in the checkpoint.
 *
 * Facts: docs/research/FACTS.md. Each fact is tagged `// fact: FACTS <section>` on the data it supports.
 * Prices come from the engine at module load (baked rate card), never from memory.
 */

import type { FluxAppSpec } from '@shared/flux';
import { BAKED_PRICING, BUNDLE_INSTANCES, defaultComponent, defaultSpec, LIMITS, quote } from '@shared/flux';
import type { Lesson } from '@/learn/types';
import { envAndSecretsSpec } from '../terminals/env-and-secrets-spec.ts';

/** What the Spec Forge writes into `enterprise`: FluxCloud makes the real ciphertext when you register. */
const SEALED = 'ENCRYPTED_BY_FLUXCLOUD_PLACEHOLDER';

const usd = (n: number): string => `USD ${n.toFixed(2)}`;

/** Monthly price of the small three-instance notes app, public or enterprise, from the engine. */
function notesPrice(enterprise: string): number {
  const spec: FluxAppSpec = {
    ...defaultSpec(),
    instances: 3,
    enterprise,
    compose: [defaultComponent({ cpu: 0.5, ram: 500, hdd: 5, ports: [31001], containerPorts: [3000] })],
  };
  return quote(spec, BAKED_PRICING.params).usdPerMonth;
}

const PUBLIC_PRICE = notesPrice('');
const SEALED_PRICE = notesPrice(SEALED);
/** The enterprise surcharge is added before the division by three, so each instance carries a third. */
const SCOPE = BAKED_PRICING.params.scope;
const PER_INSTANCE = SCOPE / BUNDLE_INSTANCES;

/** The notes API as a partial component. */
const api = {
  name: 'api',
  description: 'Notes API',
  repotag: 'yourname/notes-api:2.0.0',
  ports: [31001],
  containerPorts: [3000],
  domains: [''],
  environmentParameters: [],
  commands: [],
  containerData: '/tmp',
  repoauth: '',
  cpu: 0.5,
  ram: 500,
  hdd: 5,
};

const lesson: Lesson = {
  id: 'env-and-secrets',
  hook: 'Every container needs configuration, and some of it is secret. You will set variables and a start command the way the container receives them, read a spec as a stranger would, and move a password into an encrypted enterprise app.',
  objectives: [
    'Write environment variables and a start command in the form the container receives them.',
    'Show what a stranger can read from a public spec, and name the setting that encrypts it.',
    `Say what enterprise costs and requires: about ${usd(PER_INSTANCE)} more per instance, ArcaneOS nodes and linux/amd64 images.`,
    'Pull an image from a private registry by putting its credentials in `repoauth` of an enterprise app.',
  ],
  steps: [
    {
      id: 'env-vars',
      title: 'Variables are KEY=value strings',
      body: [
        // fact: FACTS 3.3 (max 20 per component, 400 chars); the space rule is general Docker behaviour (lint ENV_WHITESPACE, basis: inference)
        `A container reads its configuration from environment variables. In the spec they are {{term:environment-parameters}}: a list of \`KEY=value\` strings, up to ${LIMITS.environment.maxCount} per component and ${LIMITS.environment.maxLength} characters each. Docker reads each entry as \`NAME=value\`, so a space around the \`=\` is kept as part of the name or the value. That is general Docker behaviour, not a Flux rule.`,
        // fact: FACTS 8.3 and 3.6 (FLUX_APP_NAME and FLUX_NODE_HOST_IP are appended last and win)
        'Flux adds two variables of its own after yours: `FLUX_APP_NAME` and `FLUX_NODE_HOST_IP`, the public address of the node running that instance. Setting either yourself changes nothing, because the injected value wins. The server in {{lesson:first-deploy}} printed the second.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          body: 'Every value reaches the container as text, so `CACHE_TTL=60` is the string 60 and your code has to parse it.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'notes',
          description: 'A small notes API',
          instances: 3,
          compose: [{ ...api, environmentParameters: ['LOG_LEVEL = debug', 'CACHE_TTL'] }],
        },
        editable: ['compose[0].environmentParameters'],
        focus: [
          {
            path: 'compose[0].environmentParameters',
            note: 'One string per variable, NAME=value, with nothing around the equals sign.',
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Fix the two entries so the container receives `LOG_LEVEL=debug` and `CACHE_TTL=60`.',
        hint: 'Each entry is a single string `NAME=value`. Spaces around the `=` become part of the name, and an entry with no `=` is not a `NAME=value` pair, so it does not set what you meant.',
        check: {
          all: [
            {
              lint: 'absent',
              codes: ['ENV_FORMAT', 'ENV_WHITESPACE'],
              message:
                'An entry still has a space around the `=` or no `=` at all. The issues panel marks it.',
            },
            {
              path: 'compose[0].environmentParameters',
              op: 'includes',
              value: 'LOG_LEVEL=debug',
              message: 'The container has to receive `LOG_LEVEL=debug`.',
            },
            {
              path: 'compose[0].environmentParameters',
              op: 'includes',
              value: 'CACHE_TTL=60',
              message: 'The container has to receive `CACHE_TTL=60`: a name, an equals sign and a value.',
            },
          ],
        },
        solution: { compose: [{ environmentParameters: ['LOG_LEVEL=debug', 'CACHE_TTL=60'] }] },
      },
    },
    {
      id: 'commands',
      title: 'A start command is an argument list',
      body: [
        // fact: FACTS 8.3 (commands becomes the container Cmd array, not a shell script), 11 row 21
        "{{term:commands}} sets the start command of the container as an array. It becomes the `Cmd` Docker gives the image, after the image's own `ENTRYPOINT`. Each entry is one argument and no shell sits in between, so `&&`, pipes and variable expansion do nothing.",
        'This spec starts the app with `npm install && node server.js` as one entry. The container finds no program with that name and exits, and FluxOS restarts it with longer pauses. Dependencies belong in the image, installed at build time.',
      ],
      callouts: [
        {
          kind: 'tip',
          // fact: FACTS 9.4.3 (tooltip of the Commands field)
          body: 'The Commands field in FluxCloud carries the same warning in its tooltip: it is not for environment variables or setup instructions.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'notes',
          description: 'A small notes API',
          instances: 3,
          compose: [
            {
              ...api,
              environmentParameters: ['LOG_LEVEL=debug', 'CACHE_TTL=60'],
              commands: ['npm install && node server.js'],
            },
          ],
        },
        editable: ['compose[0].commands'],
        focus: [
          {
            path: 'compose[0].commands',
            note: 'One argument per entry. The first entry is the program.',
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Split the command so the program and its argument are separate entries.',
        hint: 'Each entry of the array is one argument: `node` is the program and `server.js` is its argument. Nothing interprets `&&` here, so the install has to happen at build time.',
        check: {
          all: [
            {
              lint: 'absent',
              codes: ['COMMAND_UNSPLIT'],
              message: 'The program and its argument are still one entry. Each argument needs its own entry.',
            },
            {
              path: 'compose[0].commands',
              op: 'includes',
              value: 'server.js',
              message: 'Keep `server.js` as its own entry: it is the argument the program runs.',
            },
          ],
        },
        solution: { compose: [{ commands: ['node', 'server.js'] }] },
      },
    },
    {
      id: 'public-spec',
      title: 'Who can read a spec',
      body: [
        // fact: FACTS 8.3 and 11 row 18 (env vars and commands are public in a non-enterprise app)
        'Every spec that is not enterprise is public. `GET /apps/appspecifications/<name>` returns it to anyone, with no login, including every environment variable and command. The `notes` app below keeps its database password in `environmentParameters`. Read it as a stranger would.',
        // fact: FACTS 10 E19 (permanentmessages returns every version of the spec)
        'The same data sits in the messages of the app on the chain. Deleting the variable in an update does not unpublish it: `/apps/permanentmessages` still returns every earlier version. A secret that was ever public has to be replaced, not removed.',
      ],
      callouts: [
        {
          kind: 'wild',
          // fact: FACTS 3.7 (1,122 of 2,078 live apps on 2026-10-12 are enterprise apps)
          body: 'At the time of writing more than half of the apps on the network are enterprise apps. The next two steps show why.',
        },
      ],
      stage: { kind: 'terminal', script: envAndSecretsSpec },
      task: {
        kind: 'terminal',
        goals: ['fetch'],
        prompt: 'Fetch the public spec of the `notes` app and find the database password.',
        hint: 'One `curl` against `/apps/appspecifications/notes` is enough. Piping the result into `jq` makes it readable.',
      },
    },
    {
      id: 'enterprise',
      title: 'Enterprise: an encrypted spec',
      body: [
        // fact: FACTS 3.7 (contacts and compose encrypted, readable by ArcaneOS nodes), 3.2 enterprise field
        'An {{term:enterprise-app}} is registered with its `contacts` and `compose` encrypted, so ports, variables, commands and credentials are readable only by the owner and by ArcaneOS nodes.',
        // fact: FACTS 4.4 (scope fee before the divide by three), 3.7 (ArcaneOS, amd64 only)
        `It has a price and conditions: a flat ${usd(SCOPE)} added before the division by three, about ${usd(PER_INSTANCE)} per instance, and {{term:arcaneos}} nodes only, which are amd64, so every image needs a linux/amd64 build.`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 3.7 (two different things called enterprise)
          body: 'Not the same as the enterprise network, a signed list of reserved nodes. Encrypting a spec does not join it.',
        },
        {
          kind: 'gotcha',
          // fact: FACTS 3.2 correction (unknown keys are dropped), 8.3 (secrets field removed in v8)
          body: 'Older guides show a `secrets` field. v8 has no such key and ignores it, so it protects nothing: use `enterprise`.',
        },
      ],
      task: {
        kind: 'terminal',
        goals: ['sealed'],
        prompt: 'Fetch `acme-vault` and see what is missing.',
        hint: 'Use the same call as before with the name `acme-vault`, and check `compose` in the answer.',
      },
    },
    {
      id: 'seal-it',
      title: 'Seal the password',
      body: [
        // fact: FACTS 9.4.3 (Enterprise switch, auto-on for secret-looking names)
        'In FluxCloud the Enterprise switch sits on the General tab of the Advanced form, and it turns itself on when a variable name looks like a secret or an image is private. Here the forge marks the spec with a labelled placeholder, because the real ciphertext is made with a key fetched from the network when you register.',
        `Switch Enterprise on and watch two things: the warning about the password goes away, and the price changes. For this app of three small instances the monthly price goes from ${usd(PUBLIC_PRICE)} to ${usd(SEALED_PRICE)}, the cost of keeping a secret.`,
      ],
      callouts: [
        {
          kind: 'cost',
          body: 'Encryption is priced per app, not per secret: the same surcharge hides one variable or twenty.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'notes',
          description: 'A small notes API',
          instances: 3,
          compose: [
            {
              ...api,
              environmentParameters: ['DB_HOST=db.internal.example', 'DB_PASSWORD=hunter2', 'LOG_LEVEL=info'],
            },
          ],
        },
        editable: ['enterprise', 'compose[0].environmentParameters'],
        focus: [
          {
            path: 'compose[0].environmentParameters',
            note: 'DB_PASSWORD is in a public spec. The linter spots secret-looking names such as password, token and key.',
          },
        ],
        show: ['form', 'issues', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Turn Enterprise on so the password is encrypted, and keep the variable.',
        hint: 'The warning says the spec is public. The switch that makes the components private is `enterprise`; any non-empty value marks the spec as enterprise in this forge.',
        check: {
          all: [
            {
              lint: 'absent',
              codes: ['ENV_SECRET_PUBLIC'],
              message: 'The password is still published. Turn Enterprise on so the components are encrypted.',
            },
            {
              path: 'enterprise',
              op: 'exists',
              message: 'Turn Enterprise on rather than deleting the password: the app still needs it.',
            },
            {
              path: 'compose[0].environmentParameters',
              op: 'matches',
              value: '^DB_PASSWORD=',
              message:
                'Keep `DB_PASSWORD`: the app still needs it. Encrypt the spec rather than deleting the variable.',
            },
          ],
        },
        solution: { enterprise: SEALED },
      },
    },
    {
      id: 'private-images',
      title: 'Private images need enterprise',
      body: [
        // fact: FACTS 3.3 and 11 row 6 (repoauth only with enterprise, exact validator message)
        'A private image needs credentials, and the spec carries them in {{term:repoauth}} as `username:token`. They are as sensitive as a password, so the validator allows `repoauth` only in an enterprise app and refuses a public spec with "Private repositories are only allowed for Enterprise Applications".',
        'The same conditions apply as for any enterprise app: ArcaneOS nodes and a linux/amd64 build. Use a token that can only pull this image, and never paste a real one here: `ci-bot:EXAMPLE_TOKEN` is enough.',
        // fact: FACTS 3.3 and 9.4.2 (v8.20.0 registers aws-ecr, azure-acr and google-gar; the Simple form hint aws:// disagrees with the source; a newer release was not checked)
        'A cloud registry takes a provider scheme instead of `username:token`. The FluxOS source read registers `aws-ecr://`, `azure-acr://` and `google-gar://` and no others. The Simple form hints at shorter names such as `aws://`, which that source would treat as an unknown provider, so write the three full names. A newer node release was not checked.',
      ],
      callouts: [
        {
          kind: 'tip',
          // fact: FACTS 9.4.2 (the "This image is private" switch registers the app as Enterprise)
          body: 'In FluxCloud\'s Simple mode the switch "This image is private" shows the authentication field and registers the app as Enterprise for you.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'notes',
          description: 'A small notes API',
          instances: 3,
          enterprise: SEALED,
          compose: [
            {
              ...api,
              repotag: 'acme/notes-api:2.0.0',
              environmentParameters: ['DB_HOST=db.internal.example', 'DB_PASSWORD=hunter2', 'LOG_LEVEL=info'],
            },
          ],
        },
        editable: ['compose[0].repoauth', 'enterprise'],
        focus: [
          {
            path: 'compose[0].repoauth',
            note: 'username:token for the registry. Allowed only because the app is enterprise.',
          },
        ],
        show: ['form', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Add registry credentials in `repoauth`, in the form `username:token`.',
        hint: 'The format is the username, a colon, then the token. This is a simulation, so use a placeholder such as `ci-bot:EXAMPLE_TOKEN`.',
        check: {
          all: [
            {
              lint: 'absent',
              codes: ['REPOAUTH_NEEDS_ENTERPRISE', 'REPOAUTH_FORMAT'],
              message: '`repoauth` has to read `username:token`, and only an enterprise app may carry it.',
            },
            {
              path: 'compose[0].repoauth',
              op: 'exists',
              message: 'Add the registry credentials as `username:token`.',
            },
          ],
        },
        solution: { compose: [{ repoauth: 'ci-bot:EXAMPLE_TOKEN' }] },
      },
    },
  ],
  checkpoint: [
    {
      id: 'seal-the-keys',
      kind: 'spec-fix',
      prompt:
        'The `ledger` app calls a payment provider with an API key and pulls a private image. It was written as a public app. Fix it so registration accepts it and nothing secret is published, and keep the key and the credentials in place.',
      spec: {
        name: 'ledger',
        description: 'Billing API',
        instances: 3,
        compose: [
          {
            name: 'billing',
            description: 'Billing API',
            repotag: 'acme/billing-api:3.1.0',
            ports: [31001],
            containerPorts: [4000],
            domains: [''],
            environmentParameters: ['STRIPE_API_KEY=sk_test_example', 'LOG_LEVEL=info'],
            commands: [],
            containerData: '/tmp',
            repoauth: 'ci-bot:EXAMPLE_TOKEN',
            cpu: 0.5,
            ram: 500,
            hdd: 5,
          },
        ],
      },
      // fact: FACTS 3.3 (repoauth needs enterprise), 8.3 (env vars public otherwise)
      check: {
        all: [
          {
            lint: 'absent',
            codes: ['REPOAUTH_NEEDS_ENTERPRISE', 'ENV_SECRET_PUBLIC'],
            message:
              'The spec still publishes a secret or carries credentials in a public app. Turn Enterprise on.',
          },
          {
            path: 'compose[0].repoauth',
            op: 'exists',
            message: 'The private image still needs its credentials in `repoauth`.',
          },
          {
            path: 'compose[0].environmentParameters',
            op: 'matches',
            value: '^STRIPE_API_KEY=',
            message: 'The app still needs the key: keep it in the environment and encrypt the spec.',
          },
        ],
      },
      solution: { enterprise: SEALED },
      explain:
        'The key and the registry credentials are both secrets, and a public spec publishes both. Enterprise encrypts the components so the variable and `repoauth` stay where they are, and it brings its conditions: ArcaneOS nodes and a linux/amd64 image.',
      hint: 'The issues panel says the same thing twice in different words: something secret sits in a public spec. Which setting of the spec makes the components private?',
    },
    {
      id: 'who-can-read',
      kind: 'multi',
      prompt:
        'A public app has `DB_PASSWORD=hunter2` in `environmentParameters`. Who can read it? Select all that apply.',
      options: [
        {
          id: 'owner',
          label: 'Only the owner of the app',
          why: 'A public spec has no list of readers. Anyone can fetch it.',
        },
        { id: 'api', label: 'Anyone who calls `GET /apps/appspecifications/<name>`' },
        {
          id: 'login',
          label: 'Only people who are logged in to FluxCloud',
          why: 'The API call needs no login and no key.',
        },
        {
          id: 'history',
          label: 'Anyone who reads the messages of the app, including versions before an update',
        },
        { id: 'ops', label: 'The operator of any node that runs the app' },
      ],
      answers: ['api', 'history', 'ops'],
      // fact: FACTS 8.3, 10 E19
      explain:
        'A public spec is a public document. The API serves it, the chain messages keep every version of it, and a node has to read it to start the container.',
      hint: 'Recall what the call in step 3 needed: no login, no key, and no access to a node.',
    },
    {
      id: 'private-image-where',
      kind: 'choice',
      prompt: 'Where can an app that pulls a private image run?',
      options: [
        {
          id: 'any',
          label: 'As any app: `repoauth` is hidden from the public API automatically',
          why: 'The validator refuses `repoauth` in a public spec, so the credentials are never published by accident.',
        },
        {
          id: 'enterprise',
          label: 'As an enterprise app, on ArcaneOS nodes, with a linux/amd64 image',
        },
        {
          id: 'stratus',
          label: 'Only on Stratus nodes',
          why: 'The conditions are ArcaneOS and amd64. The tier is not the rule.',
        },
        {
          id: 'any-amd64',
          label: 'On any node, as long as the image is amd64',
          why: 'Only ArcaneOS nodes can decrypt an enterprise spec, and a private image requires one.',
        },
      ],
      answer: 'enterprise',
      // fact: FACTS 3.3, 3.7 and 11 row 6
      explain:
        'Credentials may only travel inside an encrypted spec, and only ArcaneOS nodes, which are amd64 only, can open it. A private image therefore means enterprise.',
      hint: 'Which spec makes `repoauth` legal, and which nodes can decrypt that spec?',
    },
    {
      id: 'which-mechanism',
      kind: 'match',
      prompt: 'Match each need to the part of Flux that provides it.',
      pairs: [
        { id: 'cmd', left: 'Start the server with `node server.js`', right: '`commands`' },
        { id: 'env', left: 'Tell the app its log level', right: '`environmentParameters`' },
        {
          id: 'auth',
          left: 'Pull an image from a private registry',
          right: '`repoauth`, in an enterprise app',
        },
        { id: 'enc', left: 'Keep a database password out of the public record', right: '`enterprise`' },
        { id: 'ip', left: 'Let an instance learn which node it runs on', right: '`FLUX_NODE_HOST_IP`' },
      ],
      explain:
        'Four spec fields and one variable that Flux injects cover the whole lesson: how the container starts, how it is configured, how it logs in and how it stays private.',
      hint: 'Sort the needs into configuring the process, starting it, logging in to a registry, encrypting the spec and knowing the node.',
    },
  ],
  recap: [
    '`environmentParameters` are `KEY=value` strings with nothing around the `=`, and Flux appends `FLUX_APP_NAME` and `FLUX_NODE_HOST_IP`.',
    '`commands` is an argument array, not a shell line: install at build time and start the program directly.',
    'A public spec is public, variables and commands included, and earlier versions stay readable in the messages.',
    `Enterprise encrypts \`contacts\` and \`compose\`, needs ArcaneOS nodes and linux/amd64 images, and adds ${usd(SCOPE)} before the division by three.`,
    '`repoauth` works only in an enterprise app, so a private image means enterprise.',
  ],
  further: [
    {
      label: 'FluxCloud docs: components (environment, commands, repoauth)',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
    {
      label: 'FluxCloud docs: general settings and the Enterprise switch',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/general',
    },
    { label: 'FluxCloud, the real dashboard', url: 'https://cloud.runonflux.com' },
  ],
  terms: ['environment-parameters', 'commands', 'enterprise-app', 'arcaneos', 'repoauth'],
};

export default lesson;
