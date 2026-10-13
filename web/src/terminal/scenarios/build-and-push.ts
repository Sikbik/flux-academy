/**
 * Scenario 2: Build and push.
 *
 * The path an image takes to a Flux node: a Dockerfile, a build, a tag, a push to a registry. The
 * planted trap is the one every Mac or ARM laptop user meets: Docker builds for the CPU of the
 * machine it runs on, this simulated laptop is arm64, and Flux nodes are almost all amd64. The
 * fix is `--platform linux/amd64`. A push of the arm64 image works (as it would for real) but does
 * not complete the goal, and the sandbox says why.
 *
 * State lives in the virtual file system under /var/lib/docker: for each image name a file `arch`
 * (arm64 or amd64), one `id` and one `size`, so a rebuild moves a tag and `docker tag` copies it,
 * which is how tags behave.
 */

import { IMAGE_RECHECK_HOURS } from '@shared/flux/timing';
import type { ScriptWithRequires } from '../engine/types';
import { buildHeader, buildLine, fakeDigest, fakeHex, SIM_INTRO } from './helpers';

const REPO = 'you/app';
const NAME = `${REPO}:1.0.0`;
const IMG = '/var/lib/docker/images';

const ARM_ID = fakeHex('bp:arm64:image', 12);
const AMD_ID = fakeHex('bp:amd64:image', 12);

const DOCKERFILE = [
  'FROM node:22-alpine',
  'WORKDIR /app',
  'COPY package.json server.js ./',
  'EXPOSE 3000',
  'CMD ["node", "server.js"]',
  '',
].join('\n');

const SERVER_JS = [
  "const http = require('node:http');",
  '',
  'const port = Number(process.env.PORT || 3000);',
  '',
  'http',
  '  .createServer((req, res) => {',
  "    res.writeHead(200, { 'content-type': 'text/plain' });",
  "    res.end('Hello from a Flux node\\n');",
  '  })',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: file content shown to the learner, not a template
  "  .listen(port, '0.0.0.0', () => console.log(`listening on 0.0.0.0:${port}`));",
  '',
].join('\n');

const PACKAGE_JSON = [
  '{',
  '  "name": "app",',
  '  "version": "1.0.0",',
  '  "private": true,',
  '  "scripts": { "start": "node server.js" }',
  '}',
  '',
].join('\n');

// ---- patterns ---------------------------------------------------------------------------------
// Flags may come in any order; the line must end in the build context `.`. Anything else falls
// through to the nudge ("This scenario expects: ...").
const FLAG = '(?: (?:-t you/app:1\\.0\\.0|--platform[ =]linux/(?:amd64|arm64(?:/v8)?)|--no-cache|--load))';
const FLAG_PUSH = '(?: (?:-t you/app:1\\.0\\.0|--platform[ =]linux/amd64|--push|--no-cache))';
const NAMED = '(?=.* -t you/app:1\\.0\\.0 )';
const AMD64 = '(?=.* --platform[ =]linux/amd64 )';
const ARM64 = '(?=.* --platform[ =]linux/arm64(?:/v8)? )';

const BUILD_AMD64 = `^docker (?:buildx )?build${NAMED}${AMD64}${FLAG}+ \\.$`;
const BUILD_PUSH = `^docker buildx build(?=.* --push )${NAMED}${AMD64}${FLAG_PUSH}+ \\.$`;
const BUILD_ARM64 = `^docker (?:buildx )?build${NAMED}${ARM64}${FLAG}+ \\.$`;
const BUILD_PLAIN = `^docker (?:buildx )?build(?!.* --platform)${NAMED}${FLAG}+ \\.$`;

const INSPECT =
  '^docker (?:image )?inspect (?:-f|--format) [\'"]\\{\\{\\.Os\\}\\}/\\{\\{\\.Architecture\\}\\}[\'"] ';

// ---- output -------------------------------------------------------------------------------------

const WIDTH = 76;

function buildLog(arch: 'arm64' | 'amd64'): string[] {
  const id = arch === 'arm64' ? ARM_ID : AMD_ID;
  const base = fakeDigest(`bp:${arch}:node`).slice(0, 19);
  const seconds = arch === 'arm64' ? '6.1' : '9.4';
  const fromTime = arch === 'arm64' ? '3.9s' : '7.1s';
  return [
    buildHeader(seconds, '8/8', 'docker:desktop-linux', WIDTH),
    buildLine('[internal] load build definition from Dockerfile', '0.0s', WIDTH),
    buildLine('=> transferring dockerfile: 142B', '0.0s', WIDTH),
    buildLine('[internal] load metadata for docker.io/library/node:22-alpine', '1.2s', WIDTH),
    buildLine('[internal] load .dockerignore', '0.0s', WIDTH),
    buildLine('[internal] load build context', '0.0s', WIDTH),
    buildLine(`[1/3] FROM docker.io/library/node:22-alpine@${base}…`, fromTime, WIDTH),
    buildLine('[2/3] WORKDIR /app', '0.1s', WIDTH),
    buildLine('[3/3] COPY package.json server.js ./', '0.0s', WIDTH),
    buildLine('exporting to image', '0.1s', WIDTH),
    buildLine(`=> writing image sha256:${id}…`, '0.0s', WIDTH),
    buildLine(`=> naming to docker.io/${NAME}`, '0.0s', WIDTH),
  ];
}

function pushLog(arch: 'arm64' | 'amd64', tag: string): string[] {
  const layers = Array.from({ length: 5 }, (_, i) => fakeHex(`bp:${arch}:layer:${i}`, 12));
  return [
    `The push refers to repository [docker.io/${REPO}]`,
    ...layers.map((l) => `${l}: Preparing`),
    ...layers.slice(0, 3).map((l) => `${l}: Mounted from library/node`),
    ...layers.slice(3).map((l) => `${l}: Pushed`),
    `${tag}: digest: ${fakeDigest(`bp:${arch}:manifest`)} size: 1782`,
  ];
}

/** `docker images` rows (tab separated, aligned by the engine). ID and size come from the files the build wrote. */
const IMAGES_HEADER = ['REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'SIZE'].join('\t');
const imagesRow = (tag: string) =>
  [
    REPO,
    tag,
    `{file:${IMG}/${REPO}:${tag}/id}`,
    'About a minute ago',
    `{file:${IMG}/${REPO}:${tag}/size}`,
  ].join('\t');

export const buildAndPush: ScriptWithRequires = {
  id: 'build-and-push',
  cwd: '~/app',
  files: {
    Dockerfile: DOCKERFILE,
    'server.js': SERVER_JS,
    'package.json': PACKAGE_JSON,
    '.dockerignore': 'node_modules\n.git\n.env\n',
  },
  intro: [
    SIM_INTRO,
    'This folder holds a small Node app and its Dockerfile. You are logged in to Docker Hub as you.',
    'Your laptop is an arm64 machine. Get an image onto Docker Hub that Flux nodes can run.',
    'Start with: cat Dockerfile',
  ],
  commands: [
    // ---- read ------------------------------------------------------------------------------
    {
      match: '^cat Dockerfile$',
      output: [],
      passthrough: true,
      goal: 'read',
      example: 'cat Dockerfile',
      explain:
        'A Dockerfile is the recipe for an image: `FROM` picks the base, `COPY` adds your files, `EXPOSE` documents the port (it publishes nothing by itself) and `CMD` is what runs when the container starts. This app listens on port 3000, so a Flux spec would set `containerPorts` to 3000.',
    },

    // ---- builds ------------------------------------------------------------------------------
    // buildx with --push builds and uploads in one step
    {
      match: BUILD_PUSH,
      output: [
        ...buildLog('amd64'),
        ...pushLog('amd64', '1.0.0'),
        '[note][ok]Built for linux/amd64 and pushed.',
      ],
      stream: 55,
      goal: 'push',
      also: ['amd64', 'build'],
      writes: {
        [`${IMG}/${NAME}/arch`]: 'amd64',
        [`${IMG}/${NAME}/id`]: AMD_ID,
        [`${IMG}/${NAME}/size`]: '58.4MB',
        [`/var/lib/docker/registry/${NAME}`]: 'amd64',
      },
      explain:
        '`buildx build --push` builds and uploads in one step. The registry now holds `you/app:1.0.0` for linux/amd64, which is what Flux nodes run.',
    },
    {
      match: BUILD_AMD64,
      output: [
        ...buildLog('amd64'),
        '[note][ok]Built for linux/amd64. The tag you/app:1.0.0 now points at this image.',
      ],
      stream: 55,
      goal: 'amd64',
      also: ['build'],
      example: `docker build --platform linux/amd64 -t ${NAME} .`,
      writes: {
        [`${IMG}/${NAME}/arch`]: 'amd64',
        [`${IMG}/${NAME}/id`]: AMD_ID,
        [`${IMG}/${NAME}/size`]: '58.4MB',
      },
      explain:
        '`--platform linux/amd64` builds the image for amd64 CPUs even though this laptop is arm64. The tag stays the same and now points at the new image. This is what Flux nodes run.',
    },
    // an explicit arm64 build is the same as the native one here
    {
      match: BUILD_ARM64,
      output: [
        ...buildLog('arm64'),
        '[note][warn]Built for linux/arm64. Most Flux nodes run linux/amd64 and could not start this image.',
      ],
      stream: 55,
      goal: 'build',
      writes: {
        [`${IMG}/${NAME}/arch`]: 'arm64',
        [`${IMG}/${NAME}/id`]: ARM_ID,
        [`${IMG}/${NAME}/size`]: '56.9MB',
      },
      explain: 'You asked for arm64 on purpose, so that is what you got. Flux nodes are almost all amd64.',
    },
    // the plain build: the planted trap
    {
      match: BUILD_PLAIN,
      output: [
        ...buildLog('arm64'),
        '[note][warn]Heads up: this image is linux/arm64, the CPU of this laptop. Most Flux nodes run linux/amd64.',
      ],
      stream: 55,
      goal: 'build',
      example: `docker build -t ${NAME} .`,
      writes: {
        [`${IMG}/${NAME}/arch`]: 'arm64',
        [`${IMG}/${NAME}/id`]: ARM_ID,
        [`${IMG}/${NAME}/size`]: '56.9MB',
      },
      explain:
        '`docker build` targets the CPU of the machine it runs on, so an image built on an arm64 laptop only runs on arm64. FluxOS accepts amd64 or arm64 images, but almost every node is amd64. Check the architecture before you push.',
    },

    // ---- check the architecture ---------------------------------------------------------------
    {
      match: `${INSPECT}you/app:(1\\.0\\.0|latest)$`,
      requires: [`file:${IMG}/you/app:{1}/arch=arm64`],
      output: [
        'linux/arm64',
        '[note][warn]This image only runs on arm64 hosts. Flux nodes are almost all amd64.',
      ],
      goal: 'check',
      example: `docker image inspect --format '{{.Os}}/{{.Architecture}}' ${NAME}`,
      explain:
        'The image reports `linux/arm64`: the CPU it was built for. A node with a different CPU cannot start it. Rebuild with `--platform linux/amd64` and check again.',
    },
    {
      match: `${INSPECT}you/app:(1\\.0\\.0|latest)$`,
      requires: [`file:${IMG}/you/app:{1}/arch=amd64`],
      output: ['linux/amd64', '[note][ok]This is the CPU nearly every Flux node has.'],
      goal: 'check',
      explain: 'The image reports `linux/amd64`, which is what Flux nodes run. It is safe to push.',
    },
    {
      match: `${INSPECT}(you/app:\\S+)$`,
      output: [
        '[err]Error response from daemon: No such image: {1}',
        '[note]Build it first: docker build -t you/app:1.0.0 .',
      ],
      explain: 'Docker can only inspect an image that exists on this machine. `docker build` creates it.',
    },

    // ---- list ----------------------------------------------------------------------------------
    {
      match: '^docker (?:images|image ls)$',
      requires: [`file:${IMG}/${REPO}:latest/arch`],
      output: [IMAGES_HEADER, imagesRow('1.0.0'), imagesRow('latest')],
      table: true,
      stream: 30,
      explain:
        'One image can carry several names. `docker tag` adds a name without copying anything, and rebuilding `1.0.0` moves only that name, so `latest` can keep pointing at an older image.',
    },
    {
      match: '^docker (?:images|image ls)$',
      requires: [`file:${IMG}/${NAME}/arch`],
      output: [IMAGES_HEADER, imagesRow('1.0.0')],
      table: true,
      stream: 30,
      explain: 'One image, named `you/app:1.0.0`: repository, tag, then the image ID the tag points at.',
    },
    {
      match: '^docker (?:images|image ls)$',
      output: [IMAGES_HEADER, '[note]No images yet. docker build creates one.'],
      table: true,
      stream: 30,
    },

    // ---- tag -------------------------------------------------------------------------------------
    {
      match: '^docker tag you/app:1\\.0\\.0 you/app:latest$',
      requires: [`file:${IMG}/${NAME}/arch`],
      output: ['[note]docker tag prints nothing when it works. The image now has two names.'],
      goal: 'tag',
      example: `docker tag ${NAME} ${REPO}:latest`,
      writes: {
        [`${IMG}/${REPO}:latest/arch`]: `{file:${IMG}/${NAME}/arch}`,
        [`${IMG}/${REPO}:latest/id`]: `{file:${IMG}/${NAME}/id}`,
        [`${IMG}/${REPO}:latest/size`]: `{file:${IMG}/${NAME}/size}`,
      },
      explain:
        "A tag is a name for an image, nothing more: no copy was made. `latest` is what Docker uses when you give no tag, and nothing makes it the newest. Each Flux node is set to compare the image it runs with the registry's digest for the same tag about every " +
        IMAGE_RECHECK_HOURS +
        ' hours and redeploy when they differ (read from the source, not observed live), so a tag that moves can change what your app runs. Pin `1.0.0` in your spec.',
    },
    {
      match: '^docker tag you/app:1\\.0\\.0 you/app:latest$',
      output: [
        '[err]Error response from daemon: No such image: you/app:1.0.0',
        '[note]Build it first: docker build -t you/app:1.0.0 .',
      ],
      explain: 'Tagging needs an existing image to put the new name on.',
    },

    // ---- push ------------------------------------------------------------------------------------
    {
      match: '^docker push you/app:(1\\.0\\.0|latest)$',
      requires: [`file:${IMG}/you/app:{1}/arch=amd64`],
      output: pushLog('amd64', '{1}'),
      stream: 60,
      goal: 'push',
      example: `docker push ${NAME}`,
      writes: { '/var/lib/docker/registry/you/app:{1}': 'amd64' },
      explain:
        'The registry now holds `you/app:{1}` for linux/amd64. A Flux spec names it in `repotag`, and every node that runs your app pulls it from there. Write it as `you/app:{1}`, in lower case and without a `docker.io/` prefix: FluxOS refuses capital letters and asks docker.io itself when the host is written out, so the lookup fails. A public Docker Hub image needs no login; a private one needs an Enterprise app with `repoauth`.',
    },
    {
      match: '^docker push you/app:(1\\.0\\.0|latest)$',
      requires: [`file:${IMG}/you/app:{1}/arch=arm64`],
      output: [
        ...pushLog('arm64', '{1}'),
        '[note][warn]Pushed, but the image is linux/arm64. Flux nodes are almost all amd64, so most of them could not start it.',
        '[note]Rebuild with --platform linux/amd64 and push again.',
      ],
      stream: 60,
      writes: { '/var/lib/docker/registry/you/app:{1}': 'arm64' },
      explain:
        'Docker pushes whatever the tag points at, so this worked. FluxOS would accept an arm64 image, but only a handful of nodes are arm64: your app would find almost nowhere to run.',
    },
    {
      match: '^docker push (you/app:\\S+)$',
      output: [
        'The push refers to repository [docker.io/you/app]',
        '[err]An image does not exist locally with the tag: {1}',
        '[note]Build it first: docker build --platform linux/amd64 -t you/app:1.0.0 .',
      ],
      explain: 'You can only push an image that exists on this machine under that exact name.',
    },
  ],
  goals: [
    { id: 'read', label: 'Read the Dockerfile' },
    { id: 'build', label: 'Build the image' },
    { id: 'check', label: 'Check which CPU it was built for' },
    { id: 'amd64', label: 'Rebuild it for linux/amd64' },
    { id: 'tag', label: 'Give it a second name' },
    { id: 'push', label: 'Push it to Docker Hub' },
  ],
};
