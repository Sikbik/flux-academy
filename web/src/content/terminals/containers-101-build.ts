/**
 * Terminal scripts for the containers-101 lesson: build an image for linux/amd64, name it, push it.
 *
 * The guided script (this file's default export) and the checkpoint script (`containers-101-ship.ts`) are
 * both produced by `dockerShip`, so they behave the same way. The two things that decide whether a Flux
 * node can use the result are the platform and the name, and both are decided by the typed command alone:
 * the engine is stateless, so nothing here depends on what was built earlier.
 *
 * Simulation. Docker's own behaviour is standard and is labelled that way in the explanations. The Flux
 * facts are in the lesson, each with its `fact:` tag.
 */

import type { TerminalCommand, TerminalScript } from '@/learn/types';

/** The whole app: a server that answers on 3000 and listens on every interface. */
export const serverJs = [
  "const http = require('http');",
  '',
  'const server = http.createServer((req, res) => {',
  "  res.end('Hello from a container\\n');",
  '});',
  '',
  "server.listen(3000, '0.0.0.0');",
  '',
].join('\n');

/** Four instructions: a base, a folder, the code, the command that starts it. No EXPOSE is needed. */
export const dockerfile = [
  'FROM node:22-alpine',
  'WORKDIR /app',
  'COPY server.js .',
  'CMD ["node", "server.js"]',
  '',
].join('\n');

const BUILD_LINES = [
  '[+] Building 14.2s (8/8) FINISHED                              docker:default',
  ' => [internal] load build definition from Dockerfile                    0.0s',
  ' => [internal] load .dockerignore                                       0.0s',
  ' => [internal] load metadata for docker.io/library/node:22-alpine       1.0s',
  ' => [1/3] FROM docker.io/library/node:22-alpine                         6.1s',
  ' => [2/3] WORKDIR /app                                                  0.1s',
  ' => [3/3] COPY server.js .                                              0.1s',
  ' => exporting to image                                                  0.3s',
];

const PUSH_LINES = [
  '5f70bf18a086: Pushed',
  'c4d2e8a31f07: Pushed',
  '9a2b7c1d4e65: Layer already exists',
  'e1f3a5b7c9d1: Layer already exists',
];

// Pieces of the `docker build` pattern. Each is a lookahead, so the order of the flags does not matter.
const BUILD = '^docker (?:image |buildx )?build';
const WITH_TAG = '(?=.*\\s(?:-t|--tag)[ =]?(\\S+))';
const NO_TAG = '(?!.*\\s(?:-t|--tag)[ =]?\\S)';
const WITH_CONTEXT = '(?=.*\\s\\.\\/?(?:\\s|$))';
const NO_CONTEXT = '(?!.*\\s\\.\\/?(?:\\s|$))';
const AMD64 = '(?=.*\\s--platform[= ](?:\\S*,)?linux/amd64(?:[,\\s]|$))';
const SOME_PLATFORM = '(?=.*\\s--platform[= ])';
const NO_PLATFORM = '(?!.*\\s--platform[= ])';
/** A repository name with a capital letter, with or without a tag: `Maya/todo-api:2.3.1`. */
const UPPER_REF = '((?:[^\\s:]*[A-Z][^\\s:]*)(?::\\S*)?)';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ShipOptions {
  id: string;
  cwd: string;
  files: Record<string, string>;
  intro: string[];
  /** The one `namespace/name:tag` this scenario accepts. Null accepts any well-formed name. */
  want: string | null;
  /** The port the sample app answers on, for `docker run` and `curl`. */
  port: number;
  /** What `curl` prints. */
  reply: string;
  /** A name used only for example spellings when `want` is null. */
  sample: string;
  goals: { build: string; push: string };
  /** Printed for input the script does not know. A sensible default is provided. */
  notFound?: string;
}

export function dockerShip(o: ShipOptions): TerminalScript {
  const ref = o.want ?? o.sample;
  const strict = o.want !== null;
  const named = strict ? `(${escapeRe(ref)})` : '(\\S+)';
  const [wantName, wantTag] = ref.split(':');
  const [namespace] = (wantName ?? '').split('/');

  const commands: TerminalCommand[] = [
    {
      match: '^docker login(?: .*)?$',
      output: ['[dim] Authenticating with stored credentials...', '[ok] Login Succeeded'],
      explain:
        'Pushing needs a signed-in session. The simulation starts you signed in and skips the prompts.',
      example: 'docker login',
    },
    {
      // Docker's own rule: repository names are lower case. Tags may use capitals.
      match: `${BUILD}(?=.*\\s(?:-t|--tag)[ =]?${UPPER_REF}(?:\\s|$)).*$`,
      output: [
        '[err] ERROR: invalid tag "{1}": repository name must be lowercase',
        '[dim] Registries only accept lower case names. Capitals are allowed in the tag.',
      ],
      explain:
        'Docker rejects a repository name with capital letters before it builds anything. FluxOS applies the same rule at registration: a spec with that name is refused as "not in valid format".',
    },
    {
      match: '^docker push (?:[^\\s:]*[A-Z][^\\s:]*)(?::\\S*)?$',
      output: [
        '[err] invalid reference format: repository name must be lowercase',
        '[dim] Write the namespace and the name in lower case.',
      ],
      explain: 'The name is checked before any upload starts, so nothing was sent.',
    },
    {
      // The goal: the right platform, a name and the current folder as the build context.
      match: `${BUILD}${AMD64}(?=.*\\s(?:-t|--tag)[ =]?${named}(?:\\s|$))${WITH_CONTEXT}.*$`,
      output: [...BUILD_LINES, ' => => naming to {1}', '[ok] Built {1} for linux/amd64.'],
      stream: 60,
      goal: 'build',
      explain:
        'Docker ran each instruction of the Dockerfile as a layer and named the result. `--platform linux/amd64` is the platform Flux nodes run, and the name is what you will push and what the spec will refer to.',
      example: `docker build --platform linux/amd64 -t ${ref} .`,
    },
    ...(strict
      ? [
          {
            match: `${BUILD}${AMD64}${WITH_TAG}${WITH_CONTEXT}.*$`,
            output: [
              ...BUILD_LINES,
              ' => => naming to {1}',
              `[warn] Built {1}, but this brief asks for ${ref}.`,
              '[dim] A spec names the image exactly, so the name you build is the name you push and the name you write.',
            ],
            stream: 60,
            explain: `The platform is right and the name is not. The brief gives the image as \`${ref}\`, so build that.`,
          } satisfies TerminalCommand,
        ]
      : []),
    {
      // A platform was given, and it is not amd64.
      match: `${BUILD}${SOME_PLATFORM}${WITH_TAG}${WITH_CONTEXT}.*$`,
      output: [
        ...BUILD_LINES,
        ' => => naming to {1}',
        '[warn] Built {1}, but not for linux/amd64.',
        '[warn] Flux nodes run linux/amd64. This image has almost nowhere to run.',
        `[dim] Rebuild with: docker build --platform linux/amd64 -t ${ref} .`,
      ],
      stream: 60,
      explain:
        'Docker built for the platform you asked for. Nearly every Flux node is amd64, so an image for another platform has almost nowhere to run.',
    },
    {
      // No platform: Docker built for the machine it is running on.
      match: `${BUILD}${NO_PLATFORM}${WITH_TAG}${WITH_CONTEXT}.*$`,
      output: [
        ...BUILD_LINES,
        ' => => naming to {1}',
        '[warn] No --platform given, so Docker built for this machine: linux/arm64.',
        '[warn] Nearly every Flux node is amd64. This image has almost nowhere to run.',
        `[dim] Rebuild with: docker build --platform linux/amd64 -t ${ref} .`,
      ],
      stream: 60,
      explain:
        'Without `--platform`, Docker builds for the machine it runs on. On an Apple silicon laptop that is arm64, which only a handful of Flux nodes can run.',
    },
    {
      match: `${BUILD}${NO_TAG}${WITH_CONTEXT}.*$`,
      output: [
        ...BUILD_LINES,
        '[warn] The image was built but nothing named it.',
        '[dim] Add -t <namespace>/<name>:<tag>. A registry needs a name to push to and a spec needs one to pull.',
      ],
      stream: 60,
      explain:
        'An image with no name has only an ID. There is nothing to push and nothing for a spec to refer to.',
    },
    {
      match: `${BUILD}${NO_CONTEXT}.*$`,
      output: [
        '[err] ERROR: "docker buildx build" requires exactly 1 argument.',
        '[dim] The last argument is the build context. A dot means the current folder.',
      ],
      explain: 'Docker needs to know which folder holds the Dockerfile and the files it copies.',
    },
    {
      match: '^docker tag (\\S+) (\\S+)$',
      output: ['[dim] {2} now points at the same image as {1}.'],
      explain:
        'A tag is only another name for the same image. Tagging an image with your namespace is how a local name becomes pushable.',
    },
    {
      match: '^docker images$',
      output: [
        'REPOSITORY   TAG         IMAGE ID       CREATED        SIZE',
        'node         22-alpine   3f8a9c1d7e52   3 weeks ago    173MB',
        '[dim] The simulation does not keep the images you build, so this list does not change.',
      ],
      explain: 'This lists the images on your machine. The base image is there because the build pulled it.',
    },
    {
      match: '^docker run(?=.*\\s-p[ =]?(\\d+):(\\d+)).*$',
      output: [
        '[ok] Container started. {1} on this machine is forwarded to {2} inside the container.',
        '[dim] A real run keeps the terminal busy until you press Ctrl+C.',
      ],
      explain:
        '`-p 3000:3000` publishes a container port on your machine: host port first, container port second. A Flux spec holds the same pair as `ports` and `containerPorts`.',
      example: `docker run -p ${o.port}:${o.port} ${ref}`,
    },
    {
      match: '^docker run\\b.*$',
      output: [
        '[warn] No -p flag: the container runs, but nothing is published, so only the container can reach it.',
        `[dim] Try docker run -p ${o.port}:${o.port} <image>. On Flux the spec does this for you.`,
      ],
      explain:
        'Without a published port a container is a closed room. On Flux, the spec is what publishes a port.',
    },
    {
      match: `^curl (?:-s )?(?:http://)?(?:localhost|127\\.0\\.0\\.1):${o.port}/?$`,
      output: [o.reply, '[dim] The simulation answers on this port whether or not a container is running.'],
      explain: 'A request to the published port reached the process inside the container.',
      example: `curl localhost:${o.port}`,
    },
    {
      // The goal: namespace/name:tag on Docker Hub. In strict mode only the asked-for name counts.
      match: strict
        ? `^docker push (${escapeRe(wantName ?? '')}):(${escapeRe(wantTag ?? '')})$`
        : '^docker push ([a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*):([\\w][\\w.-]*)$',
      output: [
        'The push refers to repository [docker.io/{1}]',
        ...PUSH_LINES,
        '{2}: digest: sha256:89c8bf904ace30f5af08aa4b19e36e2fb3189205685ea0d4117afdbfcb168339 size: 1574',
        '[ok] Pushed {1}:{2}. Write it in the spec exactly as you typed it here.',
      ],
      stream: 80,
      goal: 'push',
      explain:
        'The image is on a public registry under a name and a version tag, so any node can pull it. The spec names exactly this string in `repotag`.',
      example: `docker push ${ref}`,
    },
    ...(strict
      ? [
          {
            match: '^docker push ([a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*):([\\w][\\w.-]*)$',
            output: [
              'The push refers to repository [docker.io/{1}]',
              ...PUSH_LINES,
              '{2}: digest: sha256:89c8bf904ace30f5af08aa4b19e36e2fb3189205685ea0d4117afdbfcb168339 size: 1574',
              `[warn] Pushed {1}:{2}, but this brief asks for ${ref}.`,
            ],
            stream: 80,
            explain: `The push worked, and it is not the image the brief names. A spec has to point at \`${ref}\`.`,
          } satisfies TerminalCommand,
        ]
      : []),
    {
      // Docker Hub spelled out: Docker accepts it, a Flux spec does not (FACTS 3.3).
      match: '^docker push docker\\.io/([a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*):([\\w][\\w.-]*)$',
      output: [
        'The push refers to repository [docker.io/{1}]',
        ...PUSH_LINES,
        '{2}: digest: sha256:89c8bf904ace30f5af08aa4b19e36e2fb3189205685ea0d4117afdbfcb168339 size: 1574',
        '[warn] Pushed. Docker Hub accepts the docker.io prefix, but a Flux spec must not carry it.',
        '[dim] FluxOS looks Docker Hub up itself, and a repotag that starts with docker.io/ fails the lookup. Push {1}:{2} to finish.',
      ],
      stream: 80,
      explain:
        'The image is on Docker Hub, but the name you typed is not the one a spec can use. Leave the docker.io host off the name you write in a spec and push.',
    },
    {
      // A registry host in front: the simulation is signed in to Docker Hub only.
      match: '^docker push ([^\\s:/]+(?::\\d+)?/[^\\s:/]+/[^\\s:/]+)(?::[^\\s:/]+)?$',
      output: [
        'The push refers to repository [{1}]',
        '[err] unauthorized: authentication required',
        '[dim] You are signed in to Docker Hub only. Another registry needs its own docker login.',
      ],
      explain:
        'A name that starts with a registry host goes to that registry, and this session has no login for it.',
    },
    {
      match: '^docker push ([a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*)$',
      output: [
        'Using default tag: latest',
        '[err] An image does not exist locally with the tag: {1}',
        '[dim] Push the name and the version tag you built, for example docker push {1}:<tag>.',
      ],
      explain:
        'With no tag, Docker pushes the tag `latest`. Nothing was built under that name, so there is nothing to send.',
    },
    {
      match: '^docker push ([a-z0-9][a-z0-9._-]*)(?::\\S+)?$',
      output: [
        'The push refers to repository [docker.io/library/{1}]',
        '[err] denied: requested access to the resource is denied',
        `[dim] A registry accepts a push only under your namespace: ${namespace ?? 'sam'}/<name>:<tag>. Use docker tag or rebuild with -t.`,
      ],
      explain:
        'A name with no namespace is read as an official library image, which you cannot push to. Your namespace goes in front.',
    },
  ];

  return {
    id: o.id,
    prompt: '$',
    cwd: o.cwd,
    files: o.files,
    intro: o.intro,
    commands,
    goals: [
      { id: 'build', label: o.goals.build },
      { id: 'push', label: o.goals.push },
    ],
    notFound:
      o.notFound ??
      '[warn] {input}: not part of this exercise. The commands that matter are docker build and docker push. Type help to see the shell.',
  };
}

/** The guided script of the lesson: any well-formed `namespace/name:tag` counts. */
const containers101Build: TerminalScript = dockerShip({
  id: 'containers-101-build',
  cwd: '~/hello-flux',
  files: { 'server.js': serverJs, Dockerfile: dockerfile },
  intro: [
    '[dim] Simulation. Nothing here touches your machine or the network.',
    '[dim] You are in ~/hello-flux on an Apple silicon MacBook, signed in to Docker Hub as sam.',
    '[dim] Build the image, then push it so that a Flux node can pull it.',
  ],
  want: null,
  port: 3000,
  reply: 'Hello from a container',
  sample: 'sam/hello-flux:1.0.0',
  goals: {
    build: 'Build the image for linux/amd64 with a name and a version tag',
    push: 'Push that name and tag to the registry',
  },
});

export default containers101Build;
