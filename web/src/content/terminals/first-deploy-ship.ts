/**
 * Terminal script for the first-deploy lesson: build for linux/amd64, then push.
 *
 * Simulation. The premise (an Apple silicon laptop) is stated in the intro so the platform flag is
 * necessary, not decorative. Docker's own behaviour is standard; the Flux facts are in the explanations.
 */

import type { TerminalScript } from '@/learn/types';

/** The whole app. Shown in the lesson's code stage and as `server.js` in this terminal. */
export const serverJs = [
  "const http = require('http');",
  '',
  'const PORT = 3000;',
  "const where = process.env.FLUX_NODE_HOST_IP || 'your laptop';",
  '',
  'http',
  '  .createServer((req, res) => {',
  "    res.writeHead(200, { 'Content-Type': 'text/plain' });",
  `    res.end(\`Hello from Flux. Served by \${where}\\n\`);`,
  '  })',
  `  .listen(PORT, '0.0.0.0', () => console.log(\`listening on \${PORT}\`));`,
  '',
].join('\n');

export const dockerfile = [
  'FROM node:22-alpine',
  'WORKDIR /app',
  'COPY server.js .',
  'EXPOSE 3000',
  'CMD ["node", "server.js"]',
  '',
].join('\n');

const BUILD_LINES = [
  '[+] Building 21.4s (8/8) FINISHED                              docker:default',
  ' => [internal] load build definition from Dockerfile                    0.0s',
  ' => [internal] load metadata for docker.io/library/node:22-alpine       1.1s',
  ' => [1/3] FROM docker.io/library/node:22-alpine                         7.6s',
  ' => [2/3] WORKDIR /app                                                  0.2s',
  ' => [3/3] COPY server.js .                                              0.1s',
  ' => exporting to image                                                  0.4s',
];

export const firstDeployShip: TerminalScript = {
  id: 'first-deploy-ship',
  prompt: '$',
  cwd: '~/hello-flux',
  files: {
    'server.js': serverJs,
    Dockerfile: dockerfile,
  },
  intro: [
    '[dim] Simulation. Nothing here touches your machine or the network.',
    '[dim] This laptop is Apple silicon: Docker builds for linux/arm64 unless you say otherwise.',
    '[dim] You are in ~/hello-flux with server.js and a Dockerfile. Ship the image.',
  ],
  commands: [
    {
      match: '^docker login(?: .*)?$',
      output: ['[dim] Authenticating with stored credentials...', '[ok] Login Succeeded'],
      explain: 'Pushing needs a logged-in session. The simulation skips the prompts.',
      example: 'docker login',
    },
    {
      // fact: FACTS 11 row 4 (almost every node is amd64; only enterprise apps require amd64) and 2.6 (ArcaneOS nodes are amd64 only)
      match: '^docker (?:buildx )?build(?=.*--platform[ =]linux/amd64)(?=.*\\s-t\\s+(\\S+)).*\\s\\.$',
      output: [
        ...BUILD_LINES,
        ' => => naming to docker.io/{1}                                          0.0s',
        '[ok] Built {1} for linux/amd64',
      ],
      stream: 60,
      goal: 'build',
      explain:
        'Docker read the Dockerfile, ran each instruction as a layer and named the result. `--platform linux/amd64` is what almost every Flux node runs, and every ArcaneOS node is amd64 only.',
      example: 'docker build --platform linux/amd64 -t yourname/hello-flux:1.0.0 .',
    },
    {
      match: '^docker (?:buildx )?build(?=.*--platform[ =]linux/amd64).*$',
      output: [
        ...BUILD_LINES,
        '[warn] The image was built but nothing named it.',
        '[dim] Add -t <namespace>/<name>:<tag>. A registry needs a name to push to and a spec needs one to pull.',
      ],
      stream: 60,
      explain:
        'An untagged image has an ID and no name, so there is nothing to push and nothing for a spec to refer to.',
    },
    {
      // fact: FACTS 11 row 4 (an arm64-only image registers but starves), 2.5 (arm64 nodes are rare)
      match: '^docker (?:buildx )?build\\b.*$',
      output: [
        ...BUILD_LINES,
        '[warn] No --platform given, so Docker built for this laptop: linux/arm64.',
        '[warn] Almost every Flux node is amd64. An arm64-only image registers for a public app, but almost no node can run it.',
        '[dim] Rebuild with: docker build --platform linux/amd64 -t yourname/hello-flux:1.0.0 .',
      ],
      stream: 60,
      explain:
        'Without `--platform`, Docker builds for the machine it runs on. On Apple silicon that is arm64. Such an image still registers for a public app, but only a handful of Flux nodes can run it, so the app would stay short of instances. An enterprise app would be refused outright, because it needs amd64.',
    },
    {
      match: '^docker run(?=.*\\s-p\\s+\\d+:\\d+).*$',
      output: [
        'listening on 3000',
        '[dim] (simulation) A real container keeps running until you press Ctrl+C.',
      ],
      explain:
        '`-p 3000:3000` publishes container port 3000 on this machine: host port first, container port second. A Flux spec holds the same pair as `ports` and `containerPorts`.',
      example: 'docker run -p 3000:3000 yourname/hello-flux:1.0.0',
    },
    {
      match: '^docker run\\b.*$',
      output: [
        'listening on 3000',
        '[warn] No -p flag: the server runs, but nothing is published, so only the container can reach it.',
        '[dim] Try docker run -p 3000:3000 <image>. Flux does this for you from the spec.',
      ],
      explain:
        'Without a published port a container is a closed room. On Flux, the spec is what publishes a port.',
    },
    {
      match: '^curl (?:-s )?(?:http://)?(?:localhost|127\\.0\\.0\\.1):3000/?$',
      output: ['Hello from Flux. Served by your laptop'],
      explain:
        'FluxOS sets `FLUX_NODE_HOST_IP` only on Flux nodes, so here the server falls back to its default. On the network each instance prints its own node address.',
      example: 'curl localhost:3000',
    },
    {
      // fact: FACTS 11 row 19 (latest)
      match: '^docker push ([a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*):([\\w][\\w.-]*)$',
      output: [
        'The push refers to repository [docker.io/{1}]',
        '5f70bf18a086: Pushed',
        'c4d2e8a31f07: Pushed',
        '9a2b7c1d4e65: Layer already exists',
        'e1f3a5b7c9d1: Layer already exists',
        '{2}: digest: sha256:89c8bf904ace30f5af08aa4b19e36e2fb3189205685ea0d4117afdbfcb168339 size: 1574',
        '[ok] Pushed {1}:{2}. A node can pull it by that name if the repository is public.',
      ],
      stream: 80,
      goal: 'push',
      explain:
        'The image is now on the registry under a name and a version tag. The spec will name exactly this string in `repotag`: lowercase, and for Docker Hub with no `docker.io/` in front, which FluxOS fails to look up. Nodes can pull it only if the repository is public; a private one needs `repoauth` in an enterprise app.',
      example: 'docker push yourname/hello-flux:1.0.0',
    },
    {
      match: '^docker push ([a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._-]*)$',
      output: [
        'Using default tag: latest',
        '[err] tag does not exist: {1}:latest',
        '[dim] You built a versioned tag, so push that one. Version tags beat latest, which can change under a running app.',
      ],
      explain:
        'With no tag Docker assumes `latest`. Nothing was built under that name, so there is nothing to push.',
    },
    {
      match: '^docker push ([a-z0-9][a-z0-9._-]*)(?::\\S+)?$',
      output: [
        'The push refers to repository [docker.io/library/{1}]',
        '[err] denied: requested access to the resource is denied',
        '[dim] A registry only accepts names that start with your namespace: yourname/hello-flux:1.0.0',
      ],
      explain:
        'Docker Hub reads a bare name as an official library image, which you cannot push to. Your namespace goes in front.',
    },
  ],
  goals: [
    { id: 'build', label: 'Build the image for linux/amd64 with a name and a version tag' },
    { id: 'push', label: 'Push that name and tag to the registry' },
  ],
  notFound:
    '[warn] {input}: not part of this exercise. Two commands matter here, docker build and docker push. Type help to see the shell.',
};

export default firstDeployShip;
