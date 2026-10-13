/**
 * Stage 2: validation and payment. What Review and Validate, Sign and Pay say when they refuse.
 *
 * Message strings are quoted exactly as FACTS 9.4.5 and 11 give them (the decoder in `errors.ts` holds
 * the same strings with where they appear). Rules and limits are FluxOS 8.20.0, read on 2026-10-12.
 */

import { api, both, cmd, fix, fixJson, fixSh, forge, guess, live, look, src } from './build';
import { FIGURES as F } from './figures';
import type { Symptom } from './types';

export const VALIDATION_SYMPTOMS: Symptom[] = [
  {
    id: 'app-name-rejected',
    stage: 'validation',
    title: 'The app name is rejected',
    summary:
      'Validation refuses the name: a reserved start, already taken, or characters that are not allowed.',
    seen: [
      'Flux App name can not start with flux',
      'Flux App name can not start with zel',
      'already registered. Flux App has to be registered under different name',
      'Flux App name is too long. Maximum 63 characters allowed',
      'Flux App name contains special characters',
    ],
    keywords: [
      'app name',
      'name taken',
      'already registered',
      'reserved',
      'watchtower',
      'name too long',
      'special characters',
      'starts with flux',
      'starts with zel',
      'unique name',
    ],
    quick:
      'App names are unique across the whole network and cannot start with flux or zel. Letters, digits and hyphens between them are allowed. Add a suffix and check it again.',
    causes: [
      {
        id: 'reserved-prefix',
        title: 'The name starts with flux or zel, or is watchtower',
        why: 'The validator refuses a name that starts with `zel` or `flux` (the check is case sensitive) and the name `watchtower` in any case. No reason for these rules is given.',
        likelihood: 'usual',
        checks: [
          forge(
            'Put the name in the forge and read the error',
            { fixture: 'hello-world', patch: { name: 'fluxdemo' }, shows: ['NAME_RESERVED_PREFIX'] },
            'The linter reports NAME_RESERVED_PREFIX.',
          ),
        ],
        fixes: [fix('Choose a name that does not start with `flux` or `zel`, and is not `watchtower`.')],
        proof: src('11 row 9; 3.6'),
        lint: ['NAME_RESERVED_PREFIX', 'NAME_RESERVED'],
        lessons: ['first-deploy'],
        terms: ['app-spec'],
      },
      {
        id: 'name-taken',
        title: 'Another app already has this name',
        why: 'The name is the app identity on the whole network and is compared without regard to case. It is also the first part of your free web address, so two apps cannot share it. A name is released when its app expires.',
        likelihood: 'usual',
        checks: [
          api(
            'appspec',
            'If you get a spec back, the name is taken. `Application: {app} not found` means it is free.',
            'Look the name up',
          ),
        ],
        fixes: [fix('Add a suffix or a number, then check the new name the same way.')],
        proof: both('11 row 9; 10.2; 10.6.3 E15'),
        lint: ['NAME_TAKEN'],
        lessons: ['first-deploy'],
      },
      {
        id: 'name-characters',
        title: 'The name has characters that are not allowed',
        why: 'A name becomes a DNS label and part of every container name, so version 8 accepts letters, digits and hyphens between them. It cannot start or end with a hyphen. FluxCloud Simple mode keeps lower case letters and digits only.',
        likelihood: 'common',
        checks: [look('Look for spaces, underscores, dots and a hyphen at the start or the end.')],
        fixes: [
          fix(
            'Use letters and digits, with hyphens only between them. Lower case matches the generated address.',
          ),
        ],
        proof: src('3.2; 9.4.2; 9.4.3'),
        lint: ['NAME_FORMAT', 'NAME_UPPERCASE'],
        lessons: ['first-deploy'],
      },
      {
        id: 'name-too-long',
        title: 'The name is longer than the limit',
        why: `Version 8 allows ${F.maxNameLength} characters, which is also the longest a DNS label can be. Versions 7 and older stop at 32.`,
        likelihood: 'rare',
        checks: [look('Count the characters in the name.')],
        fixes: [fix('Shorten it to 63 characters or fewer.')],
        proof: src('3.2; 9.4.5'),
        lint: ['NAME_TOO_LONG'],
      },
    ],
    lessons: ['first-deploy'],
    labs: ['spec-forge'],
    related: ['component-name-rejected'],
    lint: ['NAME_RESERVED_PREFIX', 'NAME_TAKEN', 'NAME_FORMAT', 'NAME_TOO_LONG'],
  },

  {
    id: 'component-name-rejected',
    stage: 'validation',
    title: 'A component name is rejected',
    summary: 'The app name is fine, but one of its components fails validation.',
    seen: [
      'Flux App component name contains special characters. Only a-z, A-Z and 0-9 are allowed',
      'web-server',
    ],
    keywords: [
      'component name',
      'hyphen',
      'dash',
      'special characters',
      'only a-z',
      'duplicate component',
      'compose name',
    ],
    quick:
      'Component names take letters and digits only. The app name may contain hyphens, the component name may not, so `web-server` becomes `webserver`.',
    causes: [
      {
        id: 'hyphen',
        title: 'The component name has a hyphen or another symbol',
        why: 'The component name is part of the container name and its internal DNS name. Version 8 allows hyphens in the app name but not in component names.',
        likelihood: 'usual',
        checks: [
          forge('See the lint error for a component named web-server', {
            fixture: 'hello-world',
            patch: { compose: [{ name: 'web-server' }] },
            shows: ['COMPONENT_NAME_FORMAT'],
          }),
        ],
        fixes: [
          fixJson('Rename it to letters and digits only.', '"name": "webserver"'),
          fix(
            'If another component or an environment variable uses the old name in a host name, change it there too.',
          ),
        ],
        proof: src('11 row 10; 3.3'),
        lint: ['COMPONENT_NAME_FORMAT'],
        lessons: ['multi-component'],
        terms: ['component'],
      },
      {
        id: 'component-reserved-prefix',
        title: 'The component name starts with flux or zel',
        why: 'The same reserved prefixes apply to components: a component name must not start with `zel` or `flux`.',
        likelihood: 'rare',
        checks: [look('Read each component `name` in the spec.')],
        fixes: [fix('Pick a different component name.')],
        proof: src('3.3; 3.6'),
        lint: ['COMPONENT_NAME_RESERVED'],
        lessons: ['multi-component'],
      },
      {
        id: 'component-duplicate',
        title: 'Two components share a name',
        why: 'Component names must be unique inside an app. Each one names its own container.',
        likelihood: 'possible',
        checks: [
          look('Scan the `compose` array for the same `name` twice. Copying a component is how it happens.'),
        ],
        fixes: [fix('Give each component its own name.')],
        proof: src('3.3'),
        lint: ['COMPONENT_NAME_DUPLICATE'],
        lessons: ['multi-component'],
      },
    ],
    lessons: ['multi-component', 'first-deploy'],
    labs: ['spec-forge'],
    related: ['app-name-rejected'],
    lint: ['COMPONENT_NAME_FORMAT', 'COMPONENT_NAME_RESERVED', 'COMPONENT_NAME_DUPLICATE'],
  },

  {
    id: 'port-rejected',
    stage: 'validation',
    title: 'A port is rejected, or two ports clash',
    summary: 'Validation refuses a port: it is on the banned list, used twice, out of range or too many.',
    seen: [
      'Assigned port 22 is not allowed for Flux Apps',
      'must have unique ports specified accross all composition',
      'Too many ports defined. Maximum of 5 allowed.',
      'Port {port} is already used in another component.',
      'Invalid or duplicate port values.',
      'Assigned port 0 is not within Flux Apps range 1-65535',
    ],
    keywords: [
      'port',
      'banned port',
      'port not allowed',
      'port 22',
      'port 27017',
      'duplicate port',
      'unique ports',
      'too many ports',
      'port range',
      'ports array',
      'containerPorts length',
    ],
    quick: `Public ports are ${F.portMin} to ${F.portMax} except a banned list, at most ${F.maxPortsPerComponent} per component, and unique across the whole app. \`ports\`, \`containerPorts\` and \`domains\` must have the same length.`,
    causes: [
      {
        id: 'banned-port',
        title: 'The public port is on the banned list',
        why: "A fixed list of ports is refused as a public port, including 22, 23, 25, 53, 3389, 8384 and 27017 and the ranges 16100-16299, 26100-26299 and 30000-30099. The range 16100-16299 holds the node's own API ports. The banned ports apply to the public port only.",
        likelihood: 'usual',
        checks: [
          api(
            'deploy-info',
            'Read `bannedPorts` (and `enterprisePorts`, the ones that cost extra). The live list wins over any guide.',
          ),
          forge('See the error for public port 22', {
            fixture: 'hello-world',
            patch: { compose: [{ ports: [22], containerPorts: [80] }] },
            shows: ['PORT_BANNED'],
          }),
        ],
        fixes: [
          fix(
            'Choose another public port. A database can keep 27017 as its container port while its public port is something else, though most databases need no public port at all.',
          ),
        ],
        proof: both(
          '11 row 8; 3.4',
          'The list in the docs differs from the code; this page uses the code and the live answer.',
        ),
        lint: ['PORT_BANNED'],
        lessons: ['ports-and-domains'],
        terms: ['ports', 'port-fee'],
      },
      {
        id: 'duplicate-port',
        title: 'The same public port is used twice',
        why: 'Public ports must be unique across every component of the app, not just inside one component, because they are all published on the same node.',
        likelihood: 'common',
        checks: [look('List the `ports` of every component side by side and look for a repeat.')],
        fixes: [
          fix(
            'Give every component distinct public ports. Components talk to each other on container ports over the internal network, so the public port does not matter between them.',
          ),
        ],
        proof: src('11 row 8; 3.3'),
        lint: ['PORT_DUPLICATE'],
        lessons: ['multi-component', 'ports-and-domains'],
        terms: ['ports', 'container-ports'],
      },
      {
        id: 'arrays-misaligned',
        title: 'The lists have different lengths',
        why: '`containerPorts[i]` is published on `ports[i]`, and `domains[i]` belongs to `ports[i]`, so the three lists must line up one to one.',
        likelihood: 'common',
        checks: [look('Count the entries in `ports`, `containerPorts` and `domains` for each component.')],
        fixes: [
          fix(
            'Add or remove entries until the three counts match. Use an empty string in `domains` for a port with no custom domain.',
          ),
        ],
        proof: src('3.3; 11 row 8'),
        lint: ['PORT_LENGTH_MISMATCH', 'DOMAINS_LENGTH_MISMATCH'],
        lessons: ['ports-and-domains'],
      },
      {
        id: 'too-many-ports',
        title: 'More than five ports in one component',
        why: `A component may publish at most ${F.maxPortsPerComponent} ports. A whole app has ${F.maxComponents} components at most.`,
        likelihood: 'rare',
        checks: [look('Count the `ports` entries of the component named in the message.')],
        fixes: [fix('Publish only what clients need, or split the service into a second component.')],
        proof: src('3.3; 9.4.5'),
        lint: ['PORTS_TOO_MANY'],
      },
      {
        id: 'port-range',
        title: `The number is outside ${F.portMin} to ${F.portMax}, or not a whole number`,
        why: `Public ports run from ${F.portMin} to ${F.portMax}, and a port of 0 is refused. A stray digit turns 6942 into 69420, which is out of range.`,
        likelihood: 'rare',
        checks: [
          look(`Read the port in the spec. It must be a whole number from ${F.portMin} to ${F.portMax}.`),
        ],
        fixes: [fix(`Use a whole number from ${F.portMin} to ${F.portMax}.`)],
        proof: both(
          '3.4; 13 row TS-03',
          'The message "Assigned port 0 is not within Flux Apps range 1-65535" was seen live.',
        ),
        lint: ['PORT_RANGE', 'PORT_NOT_INTEGER'],
      },
    ],
    lessons: ['ports-and-domains', 'multi-component'],
    labs: ['spec-forge'],
    related: ['port-costs-extra', 'limits-exceeded'],
    lint: ['PORT_BANNED', 'PORT_DUPLICATE', 'PORT_LENGTH_MISMATCH', 'PORTS_TOO_MANY', 'PORT_RANGE'],
  },

  {
    id: 'image-architecture',
    stage: 'validation',
    title: 'Docker image does not have a valid architecture',
    summary:
      'Validation looks up the image and finds neither amd64 nor arm64, or finds that the components share no architecture.',
    seen: [
      'Docker image: X does not have a valid architecture',
      'A message that the components share no architecture',
    ],
    keywords: [
      'architecture',
      'arm64',
      'amd64',
      'apple silicon',
      'm1',
      'm2',
      'platform',
      'buildx',
      'exec format error',
      'multi arch',
      'arm64 only',
      'registers but never installs',
      'registers but starves',
    ],
    quick:
      'The first message means the image offers neither linux/amd64 nor linux/arm64. An image that is only arm64 does not get it for a public app: that app registers, then stays short of running instances because almost no node can run it. Build for linux/amd64.',
    causes: [
      {
        id: 'no-valid-architecture',
        title: 'The image offers neither amd64 nor arm64',
        why: 'Validation reads the image manifest and needs `linux/amd64` or `linux/arm64` in it. An image built for another platform, for example Windows, has neither and gets "does not have a valid architecture".',
        likelihood: 'common',
        checks: [
          cmd(
            'List the platforms the pushed image provides',
            'docker buildx imagetools inspect user/app:1.0.0',
            'Look at the `Platform:` lines. The validator needs `linux/amd64` or `linux/arm64`; build `linux/amd64` so that nodes can run it.',
          ),
        ],
        fixes: [
          fixSh(
            'Rebuild for amd64, or for both, and push again.',
            'docker buildx build --platform linux/amd64,linux/arm64 -t user/app:1.0.0 --push .',
          ),
        ],
        proof: src(
          '11 row 4; 3.3',
          'Which images offer neither architecture, such as a Windows image, is general container knowledge.',
        ),
        lessons: ['containers-101'],
        terms: ['amd64', 'image', 'registry'],
      },
      {
        id: 'enterprise-amd64',
        title: 'It is an Enterprise app and a component has no amd64 image',
        why: 'Enterprise apps run on ArcaneOS nodes, which are amd64 only, so every component needs an amd64 image and the app is refused without one. We have no quoted message for this case. A public app needs only one architecture that all its components share.',
        likelihood: 'common',
        checks: [
          look(
            'Check whether Enterprise is on, then run the platform check above for every component image.',
          ),
        ],
        fixes: [
          fix(
            'Provide linux/amd64 for each component, or turn Enterprise off if you do not need private values or images.',
          ),
        ],
        proof: src('3.7; 2.6; 11 row 4'),
        lint: ['ENTERPRISE_AMD64'],
        lessons: ['env-and-secrets'],
        terms: ['enterprise-app', 'arcaneos'],
      },
      {
        id: 'no-common-architecture',
        title: 'The components share no architecture',
        why: 'When an app has several components, at least one architecture must be common to all of them.',
        likelihood: 'possible',
        checks: [look('Run the platform check on each component image and compare the lists.')],
        fixes: [
          fix(
            'Rebuild the component that lacks the shared architecture, or pick an image for it that offers amd64.',
          ),
        ],
        proof: src('3.7; 11 row 4'),
        lessons: ['multi-component'],
      },
    ],
    lessons: ['containers-101'],
    labs: ['terminal'],
    related: ['image-too-big', 'image-not-found', 'app-stuck-installing', 'fewer-instances-than-requested'],
    notice: {
      title: 'An arm64-only image is not refused',
      text: 'For a public app it passes validation and registers, then starves: only a handful of nodes can run it (7 at the 2026-10-12 snapshot, none on ArcaneOS), so it stays short of running instances. The installing pages cover that case. An Enterprise app is refused.',
    },
  },

  {
    id: 'image-too-big',
    stage: 'validation',
    title: 'Docker image is over the Flux size limit',
    summary: `Validation sums the compressed layers of the image and refuses a total above ${F.maxImageBytes} bytes.`,
    seen: ['Docker image: X size is over Flux limit'],
    keywords: [
      'image size',
      'too big',
      '5 gb',
      'size limit',
      'large image',
      'slim image',
      'multi stage',
      'layers',
      'huge image',
    ],
    quick: `The limit is ${F.maxImageBytes} bytes summed over the compressed layers. Docker usually lists the unpacked size, which is larger, so an image under 5 GB there is inside the limit. Above that, check the compressed size on the registry, find the large layers and remove what is not needed at run time.`,
    causes: [
      {
        id: 'data-baked-in',
        title: 'Models or datasets are baked into the image',
        why: 'Data copied into a layer counts toward the limit. Big files belong on a volume or in a download at start, not in the image.',
        likelihood: 'usual',
        checks: [
          cmd(
            'See which layers are large',
            'docker history --human --no-trunc user/app:1.0.0',
            'One or two layers hold most of the size.',
          ),
        ],
        fixes: [
          fix(
            'Move the data to a volume, or fetch it when the container starts, and keep the image to code and dependencies.',
          ),
        ],
        proof: src('11 row 5; 3.3'),
        lint: ['IMAGE_MAYBE_HUGE'],
        lessons: ['containers-101', 'persistent-storage'],
        terms: ['image', 'container-data'],
      },
      {
        id: 'build-tools-left',
        title: 'Build tools and caches stay in the final image',
        why: 'A single-stage build keeps compilers, package caches and test files in the layers you ship.',
        likelihood: 'common',
        checks: [
          look(
            'Open the Dockerfile and look for a single `FROM`, `apt-get install` without cleanup and `npm install` of dev dependencies.',
          ),
        ],
        fixes: [
          fix(
            'Use a multi-stage build: compile in one stage and copy only the output into a small final stage.',
            {
              snippet: {
                lang: 'dockerfile',
                label: 'Shape of a multi-stage build',
                code: 'FROM node:22 AS build\nWORKDIR /src\nCOPY . .\nRUN npm ci && npm run build\n\nFROM node:22-alpine\nWORKDIR /app\nCOPY --from=build /src/dist ./dist\nCMD ["node", "dist/server.js"]',
              },
            },
          ),
        ],
        proof: src('11 row 5'),
        lessons: ['containers-101', 'production-checklist'],
        terms: ['dockerfile', 'image'],
      },
      {
        id: 'heavy-base',
        title: 'The base image is large for the job',
        why: 'Machine learning and GPU base images (TensorFlow, PyTorch, CUDA) are often several gigabytes before your code is added.',
        likelihood: 'possible',
        checks: [
          look(
            'Check the base image in the first line of your Dockerfile. CPU only or slim variants exist for many of them.',
          ),
        ],
        fixes: [
          fix(
            'Use a slim or CPU-only variant, or a smaller distribution, and install only what the app imports.',
          ),
        ],
        proof: guess(
          '11 row 5',
          'Which base images are large is general container knowledge, not a Flux fact. The 5 GB limit itself is read in source.',
        ),
        lint: ['IMAGE_MAYBE_HUGE'],
        lessons: ['containers-101'],
      },
    ],
    lessons: ['containers-101', 'production-checklist'],
    labs: ['terminal'],
    related: ['image-architecture', 'app-stuck-installing'],
    lint: ['IMAGE_MAYBE_HUGE'],
  },

  {
    id: 'private-image-rejected',
    stage: 'validation',
    title: 'Private repositories are only allowed for Enterprise applications',
    summary: 'The image needs credentials, and the spec is not an Enterprise spec.',
    seen: ['Private repositories are only allowed for Enterprise Applications'],
    keywords: [
      'private image',
      'private registry',
      'repoauth',
      'credentials',
      'docker login',
      'enterprise',
      'ecr',
      'acr',
      'gar',
      'registry token',
    ],
    quick:
      'Credentials for a private image are accepted only when the app is Enterprise, which encrypts the spec. Either turn Enterprise on or publish the image.',
    causes: [
      {
        id: 'repoauth-without-enterprise',
        title: 'repoauth is set on a public spec',
        why: 'The network allows registry credentials only on an Enterprise app, whose spec is encrypted. In a public spec they would be readable through the API. Enterprise encrypts `contacts` and `compose` so that only the owner and ArcaneOS nodes can read them.',
        likelihood: 'usual',
        checks: [
          forge('See the error for a spec with credentials and no Enterprise', {
            fixture: 'hello-world',
            patch: { compose: [{ repoauth: 'user:token' }] },
            shows: ['REPOAUTH_NEEDS_ENTERPRISE'],
          }),
        ],
        fixes: [
          fix(
            `Turn on Enterprise. FluxCloud Simple mode does it for you when you flip "This image is private". It adds the scope fee (${F.scopeFee} at the rates read on ${F.ratesDate}, added to the bundle before the divide by ${F.bundle}, so about ${F.scopeFeePerInstance} per instance), needs amd64 for every component and runs only on ArcaneOS nodes. The enterprise price path is read in source; it was not tried with a real encrypted spec.`,
          ),
          fix('Or make the image public and remove `repoauth`.'),
        ],
        proof: src('11 row 6; 3.7; 9.4.2'),
        lint: ['REPOAUTH_NEEDS_ENTERPRISE'],
        lessons: ['env-and-secrets'],
        terms: ['repoauth', 'enterprise-app', 'arcaneos'],
      },
      {
        id: 'repoauth-format',
        title: 'The credentials are not in a form Flux understands',
        why: 'The field takes `user:token`, or an address form for a cloud registry, up to 15000 characters. The registry-auth document lists `aws-ecr://`, `azure-acr://` and `google-gar://`, and the node source read (v8.20.0) registers only those. The Simple mode form hint names `aws://`, `azure://` and `google://`, which the source read answers with an unknown provider type. The screen and the source disagree, and a newer node release was not checked.',
        likelihood: 'possible',
        checks: [
          look(
            'Compare the value with the forms above. For a cloud registry, use the documented `aws-ecr://`, `azure-acr://` or `google-gar://` form rather than the shorter hint on the Simple form.',
          ),
        ],
        fixes: [
          fix(
            'Rewrite it as `user:token`, or in the documented address form for your registry (`aws-ecr://`, `azure-acr://` or `google-gar://`), then validate again.',
          ),
        ],
        proof: src(
          '3.3; 9.4.2',
          'The screen hint and the source disagree: the source read registers only the three documented forms. A newer node release was not checked.',
        ),
        lint: ['REPOAUTH_FORMAT', 'REPOAUTH_TOO_LONG'],
        lessons: ['env-and-secrets'],
        terms: ['repoauth'],
      },
      {
        id: 'private-by-accident',
        title: 'The image is private by accident',
        why: 'Some registries create new repositories as private by default, so an image you thought you had published needs a login to pull.',
        likelihood: 'possible',
        checks: [
          cmd(
            'Pull it without being logged in',
            'docker logout && docker pull user/app:1.0.0',
            'A "denied" or "unauthorized" answer means it is private.',
          ),
        ],
        fixes: [fix('Change the repository visibility to public in your registry, then validate again.')],
        proof: guess(
          '11 row 6',
          'Default visibility differs by registry and is general knowledge, not a Flux fact.',
        ),
        lessons: ['containers-101', 'env-and-secrets'],
        terms: ['registry'],
      },
    ],
    lessons: ['env-and-secrets', 'containers-101'],
    labs: ['spec-forge'],
    related: ['image-not-found', 'secrets-visible'],
    lint: ['REPOAUTH_NEEDS_ENTERPRISE', 'REPOAUTH_FORMAT'],
  },

  {
    id: 'image-not-found',
    stage: 'validation',
    title: 'The image cannot be found or pulled',
    summary: 'Validation or the install step cannot pull the image, or refuses it for a policy reason.',
    seen: [
      '"{repotag}" must be purchased from marketplace.',
      'The image is refused for a policy reason',
      'The app registers and never installs',
    ],
    keywords: [
      'failed to pull image',
      'image not found',
      'pull access denied',
      'repository does not exist',
      'manifest unknown',
      'cannot pull',
      'repotag',
      'tag',
      'blocklist',
      'blocked',
      'policy',
      'marketplace image',
    ],
    quick:
      'Validation looks the image up in its registry, so it must exist and carry the tag you named, and it must be public unless the app is an Enterprise app with credentials. If it is fine from a logged-out machine, check the policy blocklist next.',
    causes: [
      {
        id: 'typo-or-tag',
        title: 'The repotag has a typo, or the tag does not exist',
        why: 'The reference is `[registry/]namespace/name:tag`. A wrong name or a tag that was never pushed fails the registry lookup. With no host in the reference Docker uses Docker Hub, so you do not write its host.',
        likelihood: 'usual',
        checks: [
          cmd(
            'Pull exactly what the spec says, from a machine that is not logged in',
            'docker logout && docker pull user/app:1.0.0',
            'If this fails, the spec will fail too.',
          ),
        ],
        fixes: [fix('Correct the reference in `repotag`, and push the tag if it was never pushed.')],
        proof: src(
          '3.3',
          'The lookup runs on live submission. The exact wording of the error is not recorded.',
        ),
        lint: ['REPOTAG_FORMAT', 'REPOTAG_EMPTY', 'IMAGE_UNTAGGED', 'IMAGE_DOCKER_IO_HOST'],
        lessons: ['containers-101'],
        terms: ['repotag', 'registry'],
      },
      {
        id: 'image-is-private',
        title: 'The image is private',
        why: 'A private image cannot be pulled without credentials, and the network accepts credentials only on Enterprise apps.',
        likelihood: 'common',
        checks: [cmd('Pull it logged out', 'docker logout && docker pull user/app:1.0.0')],
        fixes: [
          fix(
            'Make the image public, or use Enterprise with `repoauth`. See the private image page for the trade-offs.',
          ),
        ],
        proof: src('11 row 6; 3.7'),
        lessons: ['env-and-secrets'],
        terms: ['repoauth'],
      },
      {
        id: 'on-blocklist',
        title: 'The image, its namespace or the owner is on the network blocklist',
        why: 'Every node enforces a signed policy that can block an app name, an owner, an image, a registry namespace or a hash. There is no image whitelist, so an image is not refused for being unlisted.',
        likelihood: 'possible',
        checks: [
          api(
            'policy',
            'The value `payload_b64` decodes to JSON. Look in `documents.blockedrepositories` and `documents.blocklist` for your image or namespace.',
            'The signed policy bundle',
          ),
        ],
        fixes: [fix('Use a different image or namespace. The blocklist and its reasons are public.')],
        proof: both('11 row 7; 3.6; 10.8'),
        lessons: ['how-apps-run'],
      },
      {
        id: 'marketplace-image',
        title: 'The image is reserved for a Marketplace app',
        why: 'Some images may only be deployed through their Marketplace entry. FluxCloud says the repotag "must be purchased from marketplace".',
        likelihood: 'rare',
        checks: [look('Check whether the image comes from a Marketplace template in FluxCloud.')],
        fixes: [fix('Install it from the Marketplace instead of registering a custom spec.')],
        proof: src('9.4.3'),
        terms: ['marketplace'],
      },
    ],
    lessons: ['containers-101', 'env-and-secrets'],
    labs: ['terminal'],
    related: ['private-image-rejected', 'image-architecture', 'app-stuck-installing'],
    lint: ['REPOTAG_FORMAT', 'IMAGE_UNTAGGED'],
    caveat:
      'The registry lookup error is not recorded, so this page matches on the situation rather than on an exact message.',
  },

  {
    id: 'limits-exceeded',
    stage: 'validation',
    title: 'A limit is exceeded: instances, components, variables or resources',
    summary: 'Validation refuses a count or a total that is above (or below) what the network allows.',
    seen: [
      'Minimum number of instances is {n}',
      'Maximum number of instances is 100',
      'Flux App has too many components',
      'Maximum of 20 environment variables allowed.',
      'Maximum of 400 characters is allowed',
    ],
    keywords: [
      'limit',
      'too many',
      'too many components',
      'environment variables',
      '20 variables',
      'total cpu',
      '15 cores',
      '59000',
      '820',
      'instances',
      'maximum',
      'minimum',
    ],
    quick: `The limits are: ${F.minInstances} to ${F.maxInstances} instances, ${F.maxComponents} components, ${F.maxEnv} variables of ${F.maxEnvLength} characters, and ${F.totalCpu} cores, ${F.totalRam} MB RAM and ${F.totalHdd} GB disk added up across all components.`,
    causes: [
      {
        id: 'resource-totals',
        title: 'The components add up to more than one app may use',
        why: `The totals are checked across every component of the app: ${F.totalCpu} cores, ${F.totalRam} MB of RAM and ${F.totalHdd} GB of disk. They are what a Stratus node offers, less what a node keeps for itself.`,
        likelihood: 'common',
        checks: [
          look(
            'Add up `cpu`, `ram` and `hdd` over every component in `compose` and compare with the totals above.',
          ),
          forge('Add a component and watch the totals line', {
            fixture: 'three-tier',
            patch: { compose: [{ cpu: 8 }, { cpu: 8 }] },
            shows: ['TOTAL_CPU_EXCEEDED'],
          }),
        ],
        fixes: [fix('Reduce what each component asks for, or split the work across two apps.')],
        proof: src('3.3'),
        lint: ['TOTAL_CPU_EXCEEDED', 'TOTAL_RAM_EXCEEDED', 'TOTAL_HDD_EXCEEDED'],
        lessons: ['resources-pricing', 'multi-component'],
      },
      {
        id: 'instances-range',
        title: 'The number of instances is outside the range',
        why: `Version 8 takes ${F.minInstances} to ${F.maxInstances} instances. The older minimum of ${F.legacyMinInstances} still applies to version 7 and older specs and to updates of apps that have not moved to version 8.`,
        likelihood: 'common',
        checks: [look('Read `instances` and `version` in the spec.')],
        fixes: [fix(`Use a whole number from ${F.minInstances} to ${F.maxInstances} on a version 8 spec.`)],
        proof: src('3.10; 9.4.5; 9.0 row 2'),
        lint: ['INSTANCES_LOW', 'INSTANCES_HIGH', 'INSTANCES_FRACTIONAL'],
        lessons: ['redundancy-failover', 'first-deploy'],
        terms: ['instances-field'],
      },
      {
        id: 'too-many-components',
        title: 'More than ten components',
        why: `One spec holds at most ${F.maxComponents} components. The limit was five before block 1,300,000.`,
        likelihood: 'rare',
        checks: [look('Count the entries of `compose`.')],
        fixes: [fix('Merge services that belong together, or register two apps.')],
        proof: src('3.3; 9.4.5'),
        lint: ['COMPOSE_TOO_MANY'],
        lessons: ['multi-component'],
      },
      {
        id: 'env-limits',
        title: 'More than 20 variables, or a variable over 400 characters',
        why: `Each component takes at most ${F.maxEnv} \`environmentParameters\` of up to ${F.maxEnvLength} characters each, and at most ${F.maxCommands} \`commands\` of ${F.maxCommandLength} characters.`,
        likelihood: 'possible',
        checks: [
          look(
            'Count the variables of the component and look for a very long value such as a certificate or a key.',
          ),
        ],
        fixes: [
          fix(
            'Keep bulk configuration in a file on a volume, or load variables from Flux Storage with an `F_S_ENV=<https url>` entry that points at storage.runonflux.io.',
          ),
        ],
        proof: src('3.3; 3.6; 9.4.5'),
        lint: ['ENV_TOO_MANY', 'ENV_TOO_LONG', 'COMMANDS_TOO_MANY', 'COMMAND_TOO_LONG'],
        lessons: ['env-and-secrets'],
        terms: ['environment-parameters'],
      },
    ],
    lessons: ['resources-pricing', 'multi-component'],
    labs: ['spec-forge'],
    related: ['old-spec-rejected', 'port-rejected'],
    lint: [
      'TOTAL_CPU_EXCEEDED',
      'TOTAL_RAM_EXCEEDED',
      'TOTAL_HDD_EXCEEDED',
      'COMPOSE_TOO_MANY',
      'ENV_TOO_MANY',
    ],
  },

  {
    id: 'signing-fails',
    stage: 'validation',
    title: 'Signing or registration fails with a timestamp or owner error',
    summary:
      'The Sign Message step is refused, or the network says the message is too old or the owner is invalid.',
    seen: [
      'Message timestamp is over 1 hour old',
      'Invalid Flux App owner. Must be a Flux ID or an Ethereum address',
      'Your session has expired. Please sign in again.',
      'Retry Signing',
      'Sign In Again',
    ],
    keywords: [
      'sign',
      'signature',
      'timestamp',
      'clock',
      'owner',
      'zelid',
      'session expired',
      'login expired',
      'retry signing',
      'invalid owner',
    ],
    quick: `A signed message must be timestamped no more than ${F.signMaxAge} before and ${F.signMaxAhead} after the node clock, and signed by the address in \`owner\`. Fix your clock, sign in again, then restart the registration.`,
    causes: [
      {
        id: 'clock-skew',
        title: 'Your computer clock is off',
        why: `The timestamp in the message must be between ${F.signMaxAge} before and ${F.signMaxAhead} after the node clock. A computer clock that is fast, slow or set to the wrong day falls outside that window.`,
        likelihood: 'usual',
        checks: [
          cmd(
            'Compare your clock with UTC',
            'date -u',
            'It should match the real UTC time to within a minute.',
          ),
        ],
        fixes: [fix('Turn on automatic time in your system settings, then start the registration again.')],
        proof: src('11 row 23; 6.1'),
        lessons: ['your-toolkit', 'how-apps-run'],
      },
      {
        id: 'session-expired',
        title: 'Your login session ended',
        why: 'FluxCloud signs with the identity you logged in with. When the session expires it shows "Your session has expired. Please sign in again." and offers Retry Signing, Cancel Signing and Sign In Again.',
        likelihood: 'common',
        checks: [look('Look for the Sign In Again button in the Signature row of Review and Validate.')],
        fixes: [fix('Sign in again and repeat the Sign Message step.')],
        proof: src('9.4.4'),
        lessons: ['your-toolkit'],
        terms: ['sso', 'zelid'],
      },
      {
        id: 'wrong-identity',
        title: 'The owner is not the address that signs',
        why: 'The `owner` must be a Flux ID or an Ethereum address, and the signature must come from that same identity. SSO accounts sign for you, so the owner is filled in from your login.',
        likelihood: 'possible',
        checks: [
          forge('See the lint for an owner that is not an address', {
            fixture: 'hello-world',
            patch: { owner: 'my-wallet' },
            shows: ['OWNER_INVALID'],
          }),
        ],
        fixes: [
          fix(
            'Use the address of the wallet you sign with, or let FluxCloud fill `owner` by registering from its form.',
          ),
        ],
        proof: src('11 row 24'),
        lint: ['OWNER_INVALID', 'OWNER_MISSING'],
        lessons: ['your-toolkit'],
        terms: ['zelid', 'zelcore', 'ssp'],
      },
      {
        id: 'message-too-old',
        title: 'The registration sat too long before it was sent',
        why: `Registration messages older than ${F.signMaxAge} are refused, and the temporary copy of a message lives for ${F.messageTtlSec} seconds.`,
        likelihood: 'possible',
        checks: [
          look(
            'Note how long ago you started this registration. A tab left open for a long time is one way this happens.',
          ),
        ],
        fixes: [fix('Start again from Register New App and finish paying within the hour.')],
        proof: src('6.1; 4.7'),
        lessons: ['how-apps-run'],
        terms: ['registration-message'],
      },
    ],
    lessons: ['your-toolkit', 'how-apps-run'],
    related: ['payment-not-recognised'],
    lint: ['OWNER_INVALID', 'OWNER_MISSING'],
  },

  {
    id: 'test-install-failed',
    stage: 'validation',
    title: 'Test failed: the test installation did not pass',
    summary: 'The Test Application Installation step fails, with logs under the message.',
    seen: [
      'Test failed! Check logs below and fix your specifications before paying.',
      'Enable Payment Anyway',
      'Test & Pay',
    ],
    keywords: [
      'test installation',
      'test failed',
      'test application installation',
      'enable payment anyway',
      'test and pay',
      'install test',
    ],
    quick:
      'The test makes nodes install your app with the disk forced to 2 GB, and they report back. The logs under the failure message come from that test: read them before you pay.',
    causes: [
      {
        id: 'container-exits',
        title: 'The container exits as soon as it starts',
        why: 'The test runs your image with your commands and environment. A missing variable, a bad command or a crash at startup ends the container and fails the test.',
        likelihood: 'usual',
        checks: [
          look(
            'Read the last lines of the log shown under the failure. The reason for the exit should be in the lines just before it.',
          ),
        ],
        fixes: [
          fix(
            'Fix the cause named in the log, then run Test Installation again. Do not pay until it passes.',
          ),
        ],
        proof: guess(
          '6.1 step 6; 9.4.4',
          'Nodes test-install the app and report, and the screen shows logs. That a crash at startup is the usual failure is our inference.',
        ),
        lessons: ['first-deploy', 'operate-your-app'],
      },
      {
        id: 'disk-forced',
        title: 'The app needs more disk than the test allows',
        why: 'The test forces the disk to 2 GB whatever the spec asks for, so an app that writes more than that while starting can fail the test and pass in production.',
        likelihood: 'possible',
        checks: [look('Look in the log for "No space left on device" or a download that never finishes.')],
        fixes: [
          fix('Reduce what the app writes at start, or download large data after the container is running.'),
        ],
        proof: guess(
          '6.1 step 6',
          'The forced 2 GB disk is verified in source. That it causes a failure for a given app was inferred, not reproduced.',
        ),
        lessons: ['persistent-storage'],
        terms: ['enospc'],
      },
      {
        id: 'node-side',
        title: 'The test node had a problem, not your app',
        why: 'An install on a node can fail for a reason on that node, for example "Insufficient space on Flux Node" for a real install. A new run may reach a different node.',
        likelihood: 'possible',
        checks: [
          look('Run the test a second time and compare the logs. A different message points at the node.'),
        ],
        fixes: [fix('Run the test again. If the same message comes back every time, it is your spec.')],
        proof: guess(
          '6.1 step 6; 10.6.4 E26',
          'The example reason is from real installs. Whether a failed test install is broadcast the same way was not tested.',
        ),
        lessons: ['how-apps-run'],
      },
    ],
    lessons: ['first-deploy', 'how-apps-run'],
    related: ['container-crash-loop', 'app-stuck-installing'],
  },

  {
    id: 'payment-not-recognised',
    stage: 'validation',
    title: 'I paid, but the app never installs',
    summary: 'The page said registered, you sent payment, and nothing happens.',
    seen: [
      'Registered but never installs',
      'is underpaid',
      'Payment window: 30 minutes remaining',
      'Checking for payment confirmation on the blockchain.',
    ],
    keywords: [
      'paid',
      'payment',
      'not installing',
      'underpaid',
      'payment not detected',
      'op_return',
      'message',
      'hash',
      'exchange',
      'late',
      'expired window',
      'wrong amount',
    ],
    quick:
      'A payment is matched when it arrives while the registration message is alive and carries the registration hash as its message, for at least the on-chain price. Always pay the full quote: FluxCloud asks for it and it is far above that price. First check whether the network recorded your registration.',
    causes: [
      {
        id: 'paid-late',
        title: 'The payment arrived after the window',
        why: `The temporary registration message lives for ${F.messageTtlSec} seconds on each node, counted from when that node received the registration, not from signing. The review step's "Payment window: ${F.paymentWindowMin} minutes remaining" is fixed text, not a counter, so the node-side deadline is ${F.registrationDeadlineMin} minutes after registration. A payment that is confirmed after the message is gone points at nothing, and one that is a few minutes past the screen's ${F.paymentWindowMin} minutes may still be matched.`,
        likelihood: 'usual',
        checks: [
          api(
            'appspec',
            '`Application: {app} not found` means the network has not recorded a paid registration.',
          ),
          api(
            'messages',
            'A `fluxappregister` message with your hash means the payment was recognised and confirmed.',
          ),
        ],
        fixes: [
          fix(
            'Check first, with the two addresses above. If a `fluxappregister` message with your hash is listed, do not pay again. If nothing was matched, FluxCloud says refunds are not automatic and that you must open a support ticket to request one: keep the transaction id and the registration hash to hand, and ask before you register and pay a second time.',
          ),
        ],
        proof: src('11 row 22; 4.7; 9.0 row 7'),
        lessons: ['how-apps-run', 'your-toolkit'],
        terms: ['registration-message', 'message-hash'],
      },
      {
        id: 'missing-message',
        title: 'The payment has no message, or the wrong one',
        why: 'The payment is tied to your app by the registration hash, sent as the transaction message (OP_RETURN). A transfer without it cannot be matched to the spec. The Minecraft guide in the docs warns against paying from an exchange: it says there is no memo and the payment may miss the window.',
        likelihood: 'common',
        checks: [
          look(
            'Open the transaction in your wallet and look for the message field. It must equal the hash FluxCloud showed.',
          ),
        ],
        fixes: [
          fix(
            'Pay from a wallet that can attach a message (ZelCore or SSP), or pay by card or PayPal. Copy the message with Copy Message. If the first transfer had no message, it cannot be matched. FluxCloud says refunds are not automatic and that you must open a support ticket to request one, so keep the transaction id to hand and ask before you pay again.',
          ),
        ],
        proof: src(
          '4.7; 1.5; 9.0 row 7',
          'The warning about exchanges is from the game guide in the docs only.',
        ),
        lessons: ['your-toolkit', 'how-apps-run'],
        terms: ['op-return', 'message-hash', 'payment-address'],
      },
      {
        id: 'underpaid',
        title: 'The amount sent is too low',
        why: 'A payment below the on-chain price table is dropped with an "is underpaid" log line. That price is far below the quote. The node code accepts a payment at or above it (read in source, not tested by paying), but FluxCloud asks for the quote and the card relay needs at least 98 percent of it, so pay the full quote.',
        likelihood: 'common',
        checks: [
          look(
            'Compare what left your wallet, including any network fee, with the amount on the payment step.',
          ),
        ],
        fixes: [
          fix(
            'On a new registration, pay the full quoted FLUX with the registration hash as the message. We do not know whether a top-up on the old hash would count, so do not send more to it. The whitepaper found no code path that returns FLUX once it is sent, and FluxCloud says refunds are not automatic and that you must open a support ticket to request one: keep the transaction id and the registration hash to hand.',
          ),
        ],
        proof: src(
          '4.7; 11 row 22; 14 row 20',
          'The floor and the dropped message are read in source. A payment between that floor and the quote was not tested by paying, and FluxCloud asks for the full quote, so pay it.',
        ),
        lessons: ['resources-pricing', 'your-toolkit'],
        terms: ['price-quote'],
      },
      {
        id: 'wrong-token-or-address',
        title: 'Wrapped FLUX, another chain, or another address',
        why: 'Payment is recognised from outputs on the Flux main chain to the payment address FluxCloud shows. FLUX on Ethereum, BNB Chain or elsewhere is a different asset.',
        likelihood: 'possible',
        checks: [
          api(
            'deploy-info',
            'Compare `address` with the address you paid. It should be the one FluxCloud showed.',
          ),
        ],
        fixes: [
          fix('Send native FLUX on the Flux chain to the address shown on the payment step, or use a card.'),
        ],
        proof: guess(
          '1.5; 9.5.1',
          'That wrapped FLUX cannot pay is an inference from the payment detection code, which reads only main chain outputs.',
        ),
        lessons: ['your-toolkit'],
        terms: ['flux-token', 'payment-address'],
      },
      {
        id: 'still-confirming',
        title: 'It was recognised and is still confirming',
        why: `After you pay the network needs a block (about ${F.blockSec} seconds) to link the payment to the spec. A card payment is checked on the chain too, and the page says "This can take a few minutes."`,
        likelihood: 'possible',
        checks: [api('height', 'Take two readings a minute apart. The height should grow by about two.')],
        fixes: [
          fix(
            `Wait a few minutes before assuming it failed. FluxCloud estimates deployment at up to ${F.deployEstimateMin} minutes after payment, and it can take longer: see the page on an app that is stuck installing.`,
          ),
        ],
        proof: src('6.1; 9.5.2; 5.1'),
        lessons: ['how-apps-run'],
        terms: ['block'],
      },
    ],
    lessons: ['how-apps-run', 'your-toolkit'],
    related: ['card-checkout-problem', 'app-stuck-installing'],
    notice: {
      title: 'Before you pay again',
      text: 'Do not pay a second time until you know the first payment was not matched. The whitepaper found no code path that returns FLUX once it is sent, and FluxCloud says refunds are not automatic: a refund is requested with a support ticket.',
    },
  },

  {
    id: 'card-checkout-problem',
    stage: 'validation',
    title: 'Card or PayPal checkout will not open or is refused',
    summary: 'The payment popup is blocked, the gateways are unavailable, or the price is refused.',
    seen: [
      'Fiat payment gateways are temporarily unavailable',
      'Popup Blocked',
      'invalid price supplied',
      'Auto-renewal is only available with Stripe payments',
    ],
    keywords: [
      'card',
      'stripe',
      'paypal',
      'checkout',
      'popup',
      'gateway',
      'invalid price',
      'fiat',
      'payment failed',
      'auto renewal',
    ],
    quick:
      'Card and PayPal open in a popup and need the payment bridge to be up. If checkout does not open, allow popups and check the gateway status.',
    causes: [
      {
        id: 'popup-blocked',
        title: 'The browser blocked the checkout popup',
        why: 'Checkout opens in a popup window. When the browser stops it, FluxCloud shows "Popup Blocked" with a button to open it.',
        likelihood: 'usual',
        checks: [
          look(
            'Look for a blocked popup icon in the address bar, or the Popup Blocked message with an open button.',
          ),
        ],
        fixes: [fix('Allow popups for cloud.runonflux.com, then click the open button.')],
        proof: src('9.5.1'),
        lessons: ['your-toolkit'],
      },
      {
        id: 'gateways-down',
        title: 'The payment gateways are unavailable',
        why: 'The page shows a payment option only when the payment bridge reports its gateway up. When both are down it says "Fiat payment gateways are temporarily unavailable".',
        likelihood: 'common',
        checks: [api('fiat-status', '`{"stripe":true,"paypal":true}` when both are up.', 'Gateway status')],
        fixes: [fix('Try again later, or pay with FLUX instead.')],
        proof: live('9.5.1'),
        lessons: ['your-toolkit'],
        terms: ['fluxcloud'],
      },
      {
        id: 'invalid-price',
        title: 'The bridge refuses the price as too low',
        why: 'The payment bridge refuses a price below 98 percent of the network quote and answers "invalid price supplied". Why a price would fall below it is not known; a quote that went stale is our guess.',
        likelihood: 'possible',
        checks: [
          look('If the checkout says "invalid price supplied", note how long the review page was open.'),
        ],
        fixes: [
          fix(
            'Try the payment step again. Card and PayPal both go through the same bridge, so if the same message comes back, paying in FLUX is the way around it.',
          ),
        ],
        proof: src(
          '9.5.1; 4.7',
          'The 98 percent rule is read in source. Why a price falls below it, and how to clear it, was not established.',
        ),
        lessons: ['resources-pricing'],
        terms: ['price-quote'],
      },
      {
        id: 'auto-renew-card-only',
        title: 'You expected auto-renewal on a PayPal or FLUX payment',
        why: 'Automatic renewal is a Stripe feature. It is offered only for card payments and only for periods of 1 week, 2 weeks, 1, 3, 6 or 12 months. Cancelling the app also cancels the subscription.',
        likelihood: 'possible',
        checks: [
          look(
            'At the payment step, look for the Enable auto-renewal switch and the note under it. The app list marks an app that has it as "Auto-renewing", and one with a problem as "Payment issue".',
          ),
        ],
        fixes: [
          fix(
            'Pay with a card through Stripe to use it, or put the expiry date in your calendar and renew by hand before it.',
          ),
        ],
        proof: src('9.5.2'),
        lessons: ['operate-your-app'],
        terms: ['renewal'],
      },
    ],
    lessons: ['your-toolkit'],
    related: ['payment-not-recognised', 'no-wallet-no-flux'],
  },
];
