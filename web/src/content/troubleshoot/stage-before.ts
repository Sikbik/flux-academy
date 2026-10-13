/**
 * Stage 1: before you deploy. Things that go wrong on your machine, in an old tutorial or at the
 * price calculator, before a spec is even registered.
 *
 * Every cause names its FACTS source (`proof.facts`). Numbers that change are quoted "at the time of
 * writing" and carry the date FACTS recorded them.
 */

import { api, both, cmd, docs, fix, fixForge, fixJson, fixSh, forge, guess, live, look, src } from './build';
import { FIGURES as F } from './figures';
import type { Symptom } from './types';

export const BEFORE_SYMPTOMS: Symptom[] = [
  {
    id: 'works-locally-not-on-flux',
    stage: 'before',
    title: 'It works with docker run, but not on Flux',
    summary:
      'The container behaves on your machine, then answers nothing, or the wrong thing, on the network.',
    seen: [
      '502 or 503 on the app address',
      'Connection refused',
      'Empty reply from server',
      'Connection reset by peer',
    ],
    keywords: [
      'works locally',
      'works on my machine',
      'docker run works',
      'localhost',
      'connection refused',
      'empty reply',
      'host networking',
      'cannot connect',
    ],
    quick:
      'Four things differ between your laptop and a Flux node: the address the server listens on, the port you mapped, the CPU architecture, and what the container gets as arguments. Check them in that order.',
    causes: [
      {
        id: 'binds-localhost',
        title: 'The server listens on 127.0.0.1 or localhost',
        why: 'A published port reaches the container on its bridge address, not on its loopback. A process bound to 127.0.0.1 inside the container never sees that traffic, even though it works from inside the container or with host networking.',
        likelihood: 'usual',
        checks: [
          cmd(
            'Run it the way Flux does: with a mapped port, not host networking',
            'docker run --rm -p 8080:3000 your-image:tag\ncurl -i http://127.0.0.1:8080',
            'If curl says "Empty reply from server" or "Connection reset", the server is bound to loopback.',
          ),
          look(
            'Search your start command and config for `127.0.0.1`, `localhost` and `HOST` or `BIND` variables.',
          ),
        ],
        fixes: [
          fix(
            'Bind to `0.0.0.0`, which means every interface. Most frameworks take a flag or an environment variable for it.',
            {
              snippet: {
                lang: 'sh',
                label: 'Common ways to say it',
                code: 'node server.js            # app.listen(3000, "0.0.0.0")\nvite --host 0.0.0.0\nuvicorn main:app --host 0.0.0.0 --port 3000\nflask run --host 0.0.0.0\nHOST=0.0.0.0 npm start',
              },
            },
          ),
        ],
        proof: src(
          '11 row 2; 8.1',
          'The port publishing is read in source. That a process bound to loopback is unreachable is standard Docker behaviour, which we did not test on Flux.',
        ),
        lint: ['BIND_LOCALHOST'],
        lessons: ['ports-and-domains', 'containers-101'],
        terms: ['container-ports'],
      },
      {
        id: 'port-mismatch',
        title: 'containerPorts does not match the port the app listens on',
        why: '`containerPorts[i]` is where Docker sends the traffic that arrives on `ports[i]`. If the process listens on 3000 and the spec says 80, the app runs and nothing answers.',
        likelihood: 'usual',
        checks: [
          look(
            'Open the app in FluxCloud, then Manage, then Logs. Find the line where the server says which port it listens on.',
          ),
          api('appspec', 'Read `compose[].containerPorts` and compare it with the port in the logs.'),
        ],
        fixes: [
          fix(
            'Set `containerPorts` to the port the process really listens on. `ports` can be any free public port.',
          ),
          fixForge(
            'See the lint message for a spec whose PORT variable and containerPorts disagree.',
            'Open this spec in the forge',
            {
              fixture: 'hello-world',
              patch: { compose: [{ environmentParameters: ['PORT=3000'], containerPorts: [80] }] },
              shows: ['PORT_ENV_MISMATCH'],
            },
          ),
        ],
        proof: src('11 row 1; 8.1'),
        lint: ['PORT_ENV_MISMATCH', 'CONTAINER_PORT_UNUSUAL'],
        lessons: ['ports-and-domains', 'first-deploy'],
        terms: ['container-ports', 'ports'],
      },
      {
        id: 'wrong-architecture',
        title: 'The image was built for arm64 only',
        why: 'A build on Apple silicon makes an arm64 image by default. Almost every node is amd64, and every ArcaneOS node is. A public app with an arm64-only image passes validation and registers, then stays short of running instances, because only a handful of nodes can run it (7 at the 2026-10-12 snapshot). An Enterprise app is refused, because it needs amd64 for every component.',
        likelihood: 'common',
        checks: [
          cmd(
            'Ask the image which platform it is for',
            "docker image inspect --format '{{.Os}}/{{.Architecture}}' your-image:tag",
            'You want `linux/amd64`.',
          ),
        ],
        fixes: [
          fixSh(
            'Build for amd64 explicitly, or build a multi-architecture image, then push it again.',
            'docker buildx build --platform linux/amd64 -t user/app:1.0.0 --push .',
          ),
        ],
        proof: both('11 row 4; 3.7', 'The count of arm64 nodes is the 2026-10-12 snapshot.'),
        lessons: ['containers-101'],
        terms: ['amd64', 'image'],
      },
      {
        id: 'commands-not-shell',
        title: 'The commands field is not a shell line',
        why: '`commands` becomes the container start arguments (the Docker CMD array, after the image entrypoint). Pipes, `&&` and variable expansion do nothing unless you start a shell yourself.',
        likelihood: 'possible',
        checks: [
          look('Look at `commands` in your spec. A single entry holding a whole command line is the sign.'),
        ],
        fixes: [
          fixJson(
            'Split it into arguments. To use shell features, start a shell yourself with `sh -c`. That works only when the image has no `ENTRYPOINT` and contains `sh`: the arguments are appended after the entrypoint, so with an entrypoint they become its arguments.',
            '"commands": ["sh", "-c", "npm run migrate && node server.js"]',
          ),
        ],
        proof: src('8.3; 11 row 21'),
        lint: ['COMMAND_UNSPLIT'],
        lessons: ['env-and-secrets'],
        terms: ['commands'],
      },
      {
        id: 'env-not-passed',
        title: 'A setting from your laptop is not in the spec',
        why: 'Flux sets the variables listed in `environmentParameters` and adds `FLUX_APP_NAME` and `FLUX_NODE_HOST_IP`. A `.env` file or a compose file on your machine does not travel, so anything the image does not set for itself has to be in the spec.',
        likelihood: 'possible',
        checks: [
          look('List every variable your app reads and tick off each one against `environmentParameters`.'),
        ],
        fixes: [
          fix(
            `Add each as a \`KEY=value\` entry: up to ${F.maxEnv} per component, ${F.maxEnvLength} characters each. Remember a public spec shows them to everyone.`,
          ),
        ],
        proof: src('8.3'),
        lint: ['ENV_TOO_MANY', 'ENV_FORMAT'],
        lessons: ['env-and-secrets'],
        terms: ['environment-parameters'],
      },
    ],
    lessons: ['ports-and-domains', 'containers-101', 'first-deploy'],
    labs: ['spec-forge', 'terminal'],
    related: ['url-502-503', 'connection-refused', 'container-crash-loop'],
    lint: ['BIND_LOCALHOST', 'PORT_ENV_MISMATCH'],
  },

  {
    id: 'old-spec-rejected',
    stage: 'before',
    title: 'A spec from an old tutorial is rejected',
    summary: 'Registration or validation says a parameter is missing, unsupported or the version is wrong.',
    seen: [
      'Missing Flux App specification parameter contacts and/or geolocation',
      'Unsupported parameter for v8 app specifications: tiered',
      'Minimum number of instances is 3',
    ],
    keywords: [
      'old tutorial',
      'tiered',
      'cpubasic',
      'secrets',
      'version 7',
      'version 3',
      'missing parameter',
      'unsupported parameter',
      'spec version',
      'v8',
    ],
    quick:
      'Guides written for spec versions 3 to 7 will not pass today. The network accepts version 8 for new work, and version 8 requires a different set of fields.',
    causes: [
      {
        id: 'v8-fields-missing',
        title: 'A field that version 8 requires is missing',
        why: 'Version 8 requires `contacts`, `geolocation`, `expire`, `nodes`, `staticip` and `enterprise` at the top level, even when they are empty. Older tutorials leave several of them out.',
        likelihood: 'usual',
        checks: [
          api('spec-version', 'The answer is `8`. A spec that says anything else is not the current shape.'),
          forge(
            'Paste your spec into the forge and read the first lint errors',
            { fixture: 'hello-world', omit: ['contacts', 'geolocation', 'nodes'], shows: ['FIELD_MISSING'] },
            'A missing required field is reported as an error with the field name.',
          ),
        ],
        fixes: [
          fixForge(
            'Start from the default spec, then copy your component details across.',
            'Open the default spec in the forge',
            { fixture: 'hello-world' },
          ),
        ],
        proof: src('11 row 11; 3.2'),
        lint: ['FIELD_MISSING', 'VERSION_CHANGED'],
        lessons: ['first-deploy'],
        terms: ['spec-version', 'app-spec'],
      },
      {
        id: 'removed-keys',
        title: 'The spec still carries keys that version 8 removed',
        why: 'Version 8 dropped `tiered` and the per-tier resource keys (`cpubasic`, `rambasic`, `cpusuper` and the rest) and the `secrets` field. Depending on where a spec goes these keys are ignored, so they do nothing, or rejected with "Unsupported parameter for v8 app specifications".',
        likelihood: 'usual',
        checks: [
          look(
            'Search the spec for `tiered`, `cpubasic`, `rambasic`, `hddbasic`, `cpusuper`, `cpubamf` and `secrets`.',
          ),
        ],
        fixes: [
          fix(
            'Delete them. Use one `cpu`, `ram` and `hdd` per component, and `enterprise` when you need private values.',
          ),
        ],
        proof: src('11 row 11; 3.2 correction; 2.4'),
        lint: ['UNKNOWN_FIELD'],
        lessons: ['env-and-secrets'],
      },
      {
        id: 'min-instances-three',
        title: 'The spec is version 7 or older, or an update of an old app',
        why: `Instances may be ${F.minInstances} to ${F.maxInstances} in version 8. Older versions and updates of apps that are still on an older version keep the minimum of ${F.legacyMinInstances}, and say "Minimum number of instances is ${F.legacyMinInstances}".`,
        likelihood: 'common',
        checks: [look('Check `version` in the spec. Anything below 8 keeps the old minimum.')],
        fixes: [
          fix(
            'Move the spec to version 8. For an app that already runs, upgrading the version is a hard redeploy that recreates volumes, so create a backup and download it first.',
          ),
        ],
        proof: src('3.10; 9.0 row 2; 9.5.4'),
        lint: ['INSTANCES_LOW', 'VERSION_CHANGED'],
        lessons: ['first-deploy', 'redundancy-failover'],
        terms: ['instances-field', 'hard-redeploy'],
      },
    ],
    lessons: ['first-deploy', 'how-apps-run'],
    labs: ['spec-forge'],
    related: ['limits-exceeded', 'port-rejected'],
    lint: ['FIELD_MISSING', 'UNKNOWN_FIELD', 'VERSION_CHANGED'],
  },

  {
    id: 'calculator-hangs',
    stage: 'before',
    title: 'The price calculator request hangs, then fails',
    summary: `A call to the calculator endpoint never answers, or ends in a gateway timeout after about ${F.gatewayTimeoutSec} seconds.`,
    seen: ['No response', `Gateway timeout (504) after about ${F.gatewayTimeoutSec} seconds`],
    keywords: [
      'calculator',
      'calculatefiatandfluxprice',
      'calculateprice',
      '504',
      'timeout',
      'curl',
      'content-type',
      'application/json',
      'hangs',
      'price api',
    ],
    quick:
      'The calculator stalls when the request says its body is JSON. Send the same body as text/plain and it answers quickly.',
    causes: [
      {
        id: 'json-content-type',
        title: 'The request uses Content-Type: application/json',
        why: `The node reads the whole body with a JSON parser when the type says JSON, so the handler never sees the end of the stream and the gateway gives up after about ${F.gatewayTimeoutSec} seconds. The same body as \`text/plain\` works.`,
        likelihood: 'usual',
        checks: [
          look(
            'Look at the request headers your client sends. Most libraries add `application/json` by default for an object body.',
          ),
        ],
        fixes: [
          fixSh(
            'Send the spec as the raw body with `text/plain`.',
            "curl -s -X POST -H 'Content-Type: text/plain' --data @spec.json \\\n  https://api.runonflux.io/apps/calculatefiatandfluxprice",
            'Ask the calculator, read-only',
          ),
        ],
        proof: both(
          '11 row 12; 10.6.2 E14',
          'Tested live on 2026-10-12: a JSON content type produced no answer in 12 seconds.',
        ),
        lessons: ['resources-pricing'],
      },
      {
        id: 'browser-preflight',
        title: 'A browser sends a preflight request first',
        why: 'A custom header or an application/json body makes a browser ask permission with an OPTIONS request before the real one. A plain text/plain POST is a "simple" request and needs no preflight.',
        likelihood: 'possible',
        checks: [
          look('Open the browser network panel and look for an OPTIONS request just before the POST.'),
        ],
        fixes: [fix('Use a simple request: `text/plain`, no custom headers.')],
        proof: guess(
          '10.3; 14 row 9',
          'Preflight (OPTIONS) was not tested against the gateway. This is expected browser behaviour, not something we observed.',
        ),
      },
    ],
    lessons: ['resources-pricing', 'first-deploy'],
    labs: ['spec-forge'],
    related: ['price-higher-than-expected'],
  },

  {
    id: 'no-wallet-no-flux',
    stage: 'before',
    title: 'I do not have a wallet or any FLUX',
    summary: 'You want to deploy and you are not sure you can without a crypto wallet or coins.',
    seen: ['Login Required', 'Select payment method', 'Pay with Card'],
    keywords: [
      'wallet',
      'no flux',
      'no crypto',
      'buy flux',
      'zelcore',
      'ssp',
      'sso',
      'google login',
      'credit card',
      'paypal',
      'pay with card',
      'login',
    ],
    quick: `You can deploy with an email, Google or Apple account and pay by card or PayPal. A wallet and FLUX are optional, and paying in FLUX takes ${F.fluxDiscountPercent} percent off (the figure in the price table of ${F.ratesDate}).`,
    causes: [
      {
        id: 'sso-and-card',
        title: 'You need neither: sign in with an account and pay by card',
        why: 'FluxCloud offers Google, Apple ID and email logins that sign for you. Payment can be a card (Stripe) or PayPal, shown only when the payment bridge reports the gateway up.',
        likelihood: 'usual',
        checks: [
          look(
            'In FluxCloud, choose Login, then Google, Apple ID or Email. At the payment step choose Pay with Card.',
          ),
          api(
            'fiat-status',
            'Both `stripe` and `paypal` are `true` when the gateways are up.',
            'Card and PayPal gateway status',
          ),
        ],
        fixes: [
          fix(
            'Create an SSO account (Google, Apple ID or email and password), then register the app and pay by card.',
          ),
        ],
        proof: src('9.2; 9.5.1'),
        lessons: ['your-toolkit'],
        terms: ['sso', 'fluxcloud'],
      },
      {
        id: 'want-flux',
        title: 'You want to pay in FLUX',
        why: `Prices are set in USD and paying in FLUX applies a 0.95 multiplier (${F.fluxDiscountPercent} percent off in the price table of ${F.ratesDate}). FLUX is sent to the payment address with the registration hash as the message.`,
        likelihood: 'common',
        checks: [
          look(
            'At the payment step choose Pay with FLUX. The page shows the address, the amount and the message to send.',
          ),
        ],
        fixes: [
          fix(
            'Use the ZelCore or SSP button, or copy the address and the message into a wallet that can attach a message. Pay the full quoted amount before the payment window closes. The Minecraft guide in the docs adds a warning: send native FLUX on the Flux chain, not an EVM token and not from an exchange, where it says there is no memo and the payment may miss the window.',
            {
              proof: docs(
                '9.5.1',
                'The warning about exchanges and other chains is from the game guide in the docs only.',
              ),
            },
          ),
        ],
        proof: src(
          '9.5.1; 4.4; 4.7',
          'The advice about exchanges and other chains is from the game guide in the docs only.',
        ),
        lessons: ['your-toolkit'],
        terms: ['flux-multiplier', 'payment-address', 'op-return'],
      },
    ],
    lessons: ['your-toolkit'],
    related: ['payment-not-recognised', 'card-checkout-problem'],
  },

  {
    id: 'old-dashboard-link',
    stage: 'before',
    title: 'An old dashboard or portal address does not show what I expected',
    summary:
      'A tutorial points at home.runonflux.io, orbit, minecraft or wordpress subdomains, and the page looks different.',
    seen: ['home.runonflux.io', 'orbit.runonflux.com', 'minecraft.runonflux.com', 'wordpress.runonflux.com'],
    keywords: [
      'home.runonflux.io',
      'home.runonflux.com',
      'old dashboard',
      'fluxos dashboard',
      'redirect',
      'cloud.runonflux.com',
      'orbit',
      'portal',
    ],
    quick:
      'The old FluxOS dashboard addresses now redirect to FluxCloud at cloud.runonflux.com, and the game and app portals moved to pages on runonflux.com.',
    causes: [
      {
        id: 'dashboard-redirect',
        title: 'home.runonflux.io and home.runonflux.com redirect to FluxCloud',
        why: 'FluxCloud is the same codebase as the old dashboard. Both home addresses answer with a permanent redirect to cloud.runonflux.com and keep the path, so an old bookmark lands on the same screen in the new place.',
        likelihood: 'usual',
        checks: [
          cmd(
            'See the redirect yourself',
            'curl -sI https://home.runonflux.io | head -n 5',
            'A 301 with a `location` header pointing at cloud.runonflux.com.',
          ),
        ],
        fixes: [
          fix(
            'Use https://cloud.runonflux.com and update your bookmarks. The menu names differ from older screenshots.',
          ),
        ],
        proof: live('9.0 row 1; 9.1'),
        lessons: ['your-toolkit'],
        terms: ['fluxcloud'],
      },
      {
        id: 'portal-moved',
        title: 'The game and app portals moved to runonflux.com',
        why: 'The minecraft, orbit and wordpress subdomains now redirect to pages under runonflux.com/games and runonflux.com/apps, and Marketplace tiles carry the new address.',
        likelihood: 'common',
        checks: [
          cmd(
            'Follow one',
            'curl -sI https://orbit.runonflux.com | head -n 5',
            'A redirect to a runonflux.com/apps page.',
          ),
        ],
        fixes: [
          fix(
            'Open the app from runonflux.com/apps or runonflux.com/games, or from the Marketplace inside FluxCloud.',
          ),
        ],
        proof: live('9.0 row 8'),
        lessons: ['minecraft-server'],
        terms: ['marketplace', 'flux-orbit'],
      },
      {
        id: 'docs-differ',
        title: 'The guide quotes a screen name that no longer exists',
        why: 'FluxCloud has a Simple mode by default and an Advanced mode with the tab wizard. Some docs still describe five tabs including Priority Nodes, which only some users see.',
        likelihood: 'possible',
        checks: [
          look('In Register New App, look for the Simple and Advanced toggle at the top of the page.'),
        ],
        fixes: [
          fix(
            'Use Advanced mode for the tab wizard: General, Geolocation, Components, then Review and Validate.',
          ),
        ],
        proof: src('9.0 row 3; 9.4.3'),
      },
    ],
    lessons: ['your-toolkit', 'first-deploy'],
    related: ['no-wallet-no-flux'],
    caveat:
      'Screen labels were read from the FluxCloud build that was live on 2026-10-12 (frontend 3.20.9). Labels can change.',
  },
];
