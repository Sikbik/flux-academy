/**
 * Lesson 3, containers-101: the Docker a deployer needs, and nothing else. A recipe, an image, a name, a
 * registry. Planted failure: an Apple silicon laptop builds an arm64 image unless it is told otherwise.
 *
 * Facts: docs/research/FACTS.md. Each fact is tagged `// fact: FACTS <section>` on the data it supports.
 * Docker behaviour (layers, tags, the platform default) is standard Docker and is labelled that way; what
 * Flux does with an image is in the callouts and the compare stage, each with its tag.
 */

import { LIMITS } from '@shared/flux/spec';
import { IMAGE_RECHECK_HOURS } from '@shared/flux/timing';
import type { Lesson } from '@/learn/types';
import containers101Build, { dockerfile, serverJs } from '../terminals/containers-101-build.ts';
import containers101Ship from '../terminals/containers-101-ship.ts';

/** The registration limit on an image, in GB of compressed layers. FACTS 3.3; the engine holds the bytes. */
const IMAGE_LIMIT_GB = LIMITS.repotag.maxImageBytes / 1_000_000_000;

const lesson: Lesson = {
  id: 'containers-101',
  hook: 'Flux runs Docker images, so the one skill you need before anything else is turning your code into one that nodes can pull. In about ten minutes you will build an image, name it and push it, and learn the three rules Flux puts on it.',
  objectives: [
    'Describe an app as a Dockerfile and a server that listens on `0.0.0.0`.',
    'Tell an image from a container, and say what is lost when a container goes away.',
    'Build an image for linux/amd64, name it with your namespace and a version tag, and push it.',
    'Read a `repotag` and say which limits Flux puts on the image behind it.',
  ],
  steps: [
    {
      id: 'app',
      title: 'The whole app is two files',
      body: [
        'This is a whole app. `server.js` answers every request with one line. The {{term:dockerfile}} is the recipe for running it: start from a Node base image, copy the file in, and run `node server.js`. It has no `EXPOSE` line and does not need one, because Flux publishes the ports your spec lists.',
        'Look at the last line of `server.js`. The server listens on port 3000 and on `0.0.0.0`, which means every network interface of the container. A server bound to `localhost` answers only from inside its own container, and nothing outside can reach it.',
      ],
      callouts: [
        {
          kind: 'tip',
          body: 'Building is for your own code. A public image such as `nginx` is already something a spec can name, so a first deployment can skip this step entirely.',
        },
      ],
      // fact: FACTS 8.1 (the process must listen on 0.0.0.0), 11 row 2 (localhost bind), 3.4 (ports come from the spec)
      stage: {
        kind: 'code',
        files: [
          { name: 'server.js', lang: 'js', code: serverJs, highlight: [7] },
          { name: 'Dockerfile', lang: 'dockerfile', code: dockerfile, highlight: [1, 4] },
        ],
      },
    },
    {
      id: 'layers',
      title: 'From recipe to image to container',
      body: [
        '{{term:docker}} follows the recipe one instruction at a time, and each instruction that changes files becomes a layer. The result is an {{term:image}}: a frozen, read-only package of those layers. An image does nothing by itself. Starting it makes a {{term:container}}, one running process in its own small world.',
        'You can start as many containers from one image as you like, and every one begins identical. What a container writes while it runs lands in a thin writable layer on top, and that layer goes when the container goes.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          title: 'Not a disk',
          // fact: FACTS 7.3 and 11 row 14 (a redeploy starts from the clean image; data needs a volume)
          body: "A container's own file system is scratch space. A redeploy or a move to another node starts again from the clean image, so anything that has to last belongs in a volume, and a plain volume still dies with its node. {{lesson:persistent-storage}} covers how.",
        },
      ],
      stage: { kind: 'diagram', id: 'container-layers', beat: 1 },
    },
    {
      id: 'names',
      title: 'A name has four parts',
      body: [
        'A registry stores images, and every image has a name that says where it lives. Read `sam/hello-flux:1.0.0` from the left. With no host in front, Docker uses its default {{term:registry}}, Docker Hub. `sam` is the namespace, usually your account. `hello-flux` is the image and `1.0.0` is the tag, which is its version.',
        'In a spec this string is the {{term:repotag}}, and a node pulls exactly that name. A different name is a different image, and a name the registry has never seen is an image nodes cannot find. Spell it the way you will push it.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          title: 'Lower case only',
          // fact: FACTS 3.3 (repotag grammar; an uppercase repository is refused by FluxOS itself with "not in valid format",
          // read live 2026-10-13, and `library/NGINX` fails at the registry lookup); the lint code IMAGE_UPPERCASE; Docker
          // reference grammar
          body: 'Namespaces and image names must be lower case. FluxOS itself refuses `Sam/hello-flux` at registration as "not in valid format", before any registry is asked. Capital letters are allowed in the tag and nowhere else in the path.',
        },
        {
          kind: 'gotcha',
          title: 'No docker.io in front',
          // fact: FACTS 3.3 (a `docker.io/` prefix fails with "Unsupported schemaVersion: undefined"; FluxOS calls
          // Docker Hub itself, so leave the host off); that Docker accepts the prefix locally is standard Docker
          body: 'Docker accepts `docker.io/sam/hello-flux:1.0.0` on your laptop, but a spec must not carry the prefix. FluxOS looks Docker Hub up itself, and a `docker.io/` repotag fails the registry lookup. Write `sam/hello-flux:1.0.0`.',
        },
      ],
      // fact: FACTS 3.3 (repotag is [registry/][namespace/]image[:tag]); that no host means Docker Hub is Docker's
      // own default, not a FACTS statement
      stage: { kind: 'diagram', id: 'repotag-anatomy', beat: 3 },
    },
    {
      id: 'build',
      title: 'Build the image',
      body: [
        'Build with `docker build`, name the result with `-t` and end with `.` to say the recipe is in this folder. The laptop here is a MacBook with an Apple chip, and nothing in this terminal leaves the page.',
        'Build `sam/hello-flux:1.0.0` and read what the build tells you. Almost every Flux node runs on {{term:amd64}}, the common PC processor family, so that is the platform an image needs. The goal tracker lights up only for the right kind of build.',
      ],
      // fact: FACTS 11 row 4 (arm64 builds), 2.5 and Snapshot part 2 (a handful of arm64 nodes, none on ArcaneOS)
      stage: { kind: 'terminal', script: containers101Build },
      task: {
        kind: 'terminal',
        goals: ['build'],
        prompt: 'Build the image as `sam/hello-flux:1.0.0` and read what the build says.',
        hint: 'Docker builds for the machine it runs on, and this machine is not what Flux nodes run. The `--platform` flag says which platform you want.',
      },
    },
    {
      id: 'push',
      title: 'Push it where nodes can pull it',
      body: [
        'A node cannot read your laptop. It pulls the image from a registry by name, so the image has to be uploaded there. `docker push` sends the layers the registry does not have yet, and the name and tag then point at them.',
        'Push the image you just built. On Docker Hub you can push only under your own namespace, or one of an organisation you belong to, so here the name has to start with `sam/`. If the push is refused, read why: the message names the problem.',
      ],
      callouts: [
        {
          kind: 'tip',
          body: 'Want more practice afterwards? {{lab:terminal}} is a sandbox shell for Docker and the Flux API, with guided challenges of its own.',
        },
      ],
      // The same terminal session continues from the build step.
      stage: { kind: 'terminal', script: containers101Build },
      task: {
        kind: 'terminal',
        goals: ['push'],
        prompt: 'Push `sam/hello-flux:1.0.0` to the registry.',
        hint: 'Push the full name you built: namespace, image and tag, written exactly the same way.',
      },
    },
    {
      id: 'latest',
      title: 'Why a version tag beats latest',
      body: [
        `FluxOS is set to check the registry about every ${IMAGE_RECHECK_HOURS} hours (read from its source, not observed live). It compares the digest of the image a container runs with the digest the registry returns for the same tag and, when they differ, redeploys the app and keeps its volume data. With \`latest\` that could mean a push you made on Friday replaces a running app on Saturday, and nodes check at different moments, so they could run different builds for a while.`,
        'Give every release its own tag, never overwrite a tag you have used, and put that tag in the spec. A new version is then a new tag and an update to the spec, which you control. Moving a tag is a deploy you did not schedule.',
      ],
      // fact: FACTS 6.3 and 11 row 19 (every 21,600,000 ms each node compares the running image's digest with the
      // registry's for the same tag, then calls softRedeploy; the first check comes 10 to 30 minutes after the node
      // starts and apps are 5 s apart; read from source on 2026-10-13, not observed live), so it is phrased as what
      // FluxOS is set to do
      stage: { kind: 'diagram', id: 'repotag-anatomy', beat: 4 },
    },
    {
      id: 'flux-needs',
      title: 'What Flux accepts',
      body: [
        `Three rules decide whether Flux can use an image, and they fail differently. A private image and an image over ${IMAGE_LIMIT_GB} GB are refused when you register, so you find out at once. An image built only for arm64 is the quiet failure: a public app registers, and then almost no node can run it. An enterprise app with such an image is refused.`,
        'The limit counts what the registry stores, the compressed layers, not the larger number `docker images` prints on your disk. A slim base image, a copy of only what you need and data kept in a volume keep most apps far below it.',
      ],
      // fact: FACTS 3.3 (public, amd64 or arm64, 5,000,000,000 bytes), 3.7 (private images need enterprise),
      // 2.5 (arm64 nodes are few and none run ArcaneOS), 11 rows 4, 5 and 6
      stage: {
        kind: 'compare',
        left: {
          label: 'An image Flux can run',
          tone: 'good',
          body: `Public on a registry, so any node can pull it by name. Built for linux/amd64, the platform nearly every node runs. Under ${IMAGE_LIMIT_GB} GB of compressed layers. Tagged with a version, such as \`1.0.0\`.`,
        },
        right: {
          label: 'An image Flux cannot run',
          tone: 'bad',
          body: `Private: refused, unless the app is an enterprise app that carries its credentials. Built only for arm64: it may register, but almost no node can run it. Over ${IMAGE_LIMIT_GB} GB of compressed layers: refused. Tagged \`latest\`: it runs, and it can change under you.`,
        },
      },
    },
  ],
  checkpoint: [
    {
      id: 'ship-it',
      kind: 'terminal',
      prompt:
        'The todo API lives in `~/todo-api`. Make `maya/todo-api:2.3.1` exist on a registry, built so that Flux nodes can run it.',
      script: containers101Ship,
      goals: ['build', 'push'],
      // fact: FACTS 11 row 4 (platform), 3.3 (repotag), 6.3 (version tags)
      explain:
        'Two typed details decided the outcome: `--platform linux/amd64` made the image runnable on nodes, and the exact name is what the spec will have to repeat.',
      hint: 'Flux nodes run linux/amd64, and the brief gives the exact name. Build with the platform flag and that name, then push the same name.',
    },
    {
      id: 'name-it',
      kind: 'spec-fix',
      prompt:
        'The spec for the todo API names the wrong image. Point it at the image you just pushed, with nothing else changed.',
      spec: {
        name: 'todo-api',
        description: 'A small todo API',
        instances: 3,
        compose: [
          {
            name: 'api',
            description: 'Todo API',
            repotag: 'Maya/todo-api:latest',
            ports: [31001],
            containerPorts: [8000],
            domains: [''],
            environmentParameters: [],
            commands: [],
            containerData: '/tmp',
            repoauth: '',
            cpu: 0.5,
            ram: 500,
            hdd: 5,
          },
        ],
      },
      check: {
        all: [
          {
            lint: 'absent',
            codes: ['REPOTAG_FORMAT', 'IMAGE_UPPERCASE', 'IMAGE_UNTAGGED', 'IMAGE_LATEST'],
            message: 'The image name still breaks a rule. Read the issues panel for what is wrong with it.',
          },
          {
            path: 'compose[0].repotag',
            op: 'eq',
            value: 'maya/todo-api:2.3.1',
            message: 'The spec has to name the image you pushed: maya/todo-api:2.3.1.',
          },
        ],
      },
      solution: { compose: [{ repotag: 'maya/todo-api:2.3.1' }] },
      // fact: FACTS 3.3 (repotag), 6.3 and 11 row 19 (latest changes under a running app)
      explain:
        'A node pulls the exact string in `repotag`. Lower case, your namespace and the version tag you pushed: FluxOS refuses a capital letter in the name, and `latest` can change under a running app.',
      hint: 'Read the issues panel for the two things wrong with the name, then write the name exactly as you pushed it in the terminal.',
    },
    {
      id: 'size-limit',
      kind: 'choice',
      prompt: `Registration refuses an image over ${IMAGE_LIMIT_GB} GB. Which size is that?`,
      options: [
        {
          id: 'compressed',
          label: 'The sum of its compressed layers, as the registry stores them.',
        },
        {
          id: 'docker-images',
          label: 'The size that `docker images` prints for it.',
          why: 'That is the unpacked size on your own disk, which is larger. The limit counts the compressed layers in the registry.',
        },
        {
          id: 'hdd',
          label: 'The `hdd` value in the spec.',
          why: '`hdd` sizes the volume your data lives on. It has nothing to do with the image.',
        },
        {
          id: 'source',
          label: 'The size of the Dockerfile and the files it copies.',
          why: 'The source is only the input. The limit applies to the image that the build produces and the registry stores.',
        },
      ],
      answer: 'compressed',
      // fact: FACTS 3.3 and 11 row 5 (maxImageSize 5,000,000,000 bytes summed over layers)
      explain:
        'The registry reports the size of each compressed layer, and Flux adds them up. Check the registry, not your disk, when an image is close to the limit.',
      hint: 'Flux never sees your laptop. It sees what the registry reports for the image.',
    },
  ],
  recap: [
    'An image is the frozen package and a container is one running copy of it. Container storage is scratch space.',
    'Bind `0.0.0.0` so that traffic from outside the container can reach the server.',
    'Build with `--platform linux/amd64`, name the image `namespace/name:tag` and push it before a spec refers to it.',
    `A node pulls the exact name in the spec, lower case and with no docker.io in front. Use a version tag, never \`latest\`, because FluxOS is set to re-check a tag about every ${IMAGE_RECHECK_HOURS} hours.`,
    `Flux needs a public image, built for amd64, under ${IMAGE_LIMIT_GB} GB of compressed layers.`,
  ],
  further: [
    {
      label: 'Docs: the components page, where the image and ports are set',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
    {
      label: 'Docker docs: multi-platform builds',
      url: 'https://docs.docker.com/build/building/multi-platform/',
    },
    {
      label: 'Docker docs: Dockerfile reference',
      url: 'https://docs.docker.com/reference/dockerfile/',
    },
  ],
  terms: ['docker', 'dockerfile', 'image', 'container', 'registry', 'repotag', 'amd64'],
};

export default lesson;
