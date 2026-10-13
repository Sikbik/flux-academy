/**
 * Glossary, part 3 of 3: Docker and registries, as far as a deployer needs them (10 terms).
 *
 * The other two files are `core.ts` (network, money and the spec) and `ops.ts` (accounts, wallets and running
 * an app). Term ids are the canonical ones other lessons link with `{{term:id}}`; they are permanent.
 *
 * Docker behaviour (images, layers, tags, platforms) is standard Docker and is stated as such. What Flux does
 * with an image comes from FACTS 3.3 and 11, each tagged. Behaviour FACTS marks UNVERIFIED (what an untagged
 * image does on Flux) is deliberately not described here.
 */

import { LIMITS } from '@shared/flux/spec';
import { IMAGE_RECHECK_HOURS } from '@shared/flux/timing';
import type { GlossaryTerm } from '@/learn/types';

/** The registration limit on an image, in GB of compressed layers. FACTS 3.3; the engine holds the bytes. */
const IMAGE_LIMIT_GB = LIMITS.repotag.maxImageBytes / 1_000_000_000;

const terms: GlossaryTerm[] = [
  {
    id: 'docker',
    term: 'Docker',
    proper: true,
    short:
      'The container runtime and tooling that packages an app and its dependencies into an image and runs it as an isolated container.',
    why: 'Flux runs Docker images, so Docker is the one skill to learn first. FluxOS uses it on every node to start your containers.',
    // fact: FACTS 1.2 (FluxOS runs on Docker), 3.3 (the repotag is a Docker image reference)
    category: 'docker',
    related: ['image', 'container', 'dockerfile'],
    lessons: ['containers-101'],
    docs: 'https://docs.docker.com/get-started/docker-overview/',
  },
  {
    id: 'container',
    term: 'container',
    short:
      'A running instance of an image: one isolated process with its own file system, network and resource limits.',
    why: 'Each component of a Flux app runs as one container per instance. Its own file system is scratch space, so data that must last belongs in a volume.',
    // fact: FACTS 3.6 (container naming), 7.3 (volumes), 7.2
    category: 'docker',
    related: ['image', 'volume', 'component'],
    lessons: ['containers-101'],
  },
  {
    id: 'image',
    term: 'image',
    short:
      'A read-only package of layers that holds your app and what it needs to run. Containers are started from it.',
    why: `A node pulls an image by name from a registry. Flux needs it public unless the app is enterprise, built for amd64 in practice, and under ${IMAGE_LIMIT_GB} GB of compressed layers.`,
    // fact: FACTS 3.3 (repotag row: pullable, architecture, 5,000,000,000 bytes), 3.7 (private images)
    category: 'docker',
    related: ['container', 'registry', 'repotag', 'dockerfile'],
    lessons: ['containers-101'],
  },
  {
    id: 'registry',
    term: 'registry',
    short:
      "A server that stores images and serves them by name, such as Docker Hub or GitHub's registry. Nodes pull your image from one.",
    why: "Nodes cannot read your laptop, so the image must be pushed to a registry first. By Docker's default, a name with no host in front is looked up on Docker Hub.",
    // fact: FACTS 3.3 (repotag [registry/][namespace/]name:tag); the Docker Hub default is standard Docker, not a FACTS statement
    category: 'docker',
    related: ['image', 'repotag', 'repoauth'],
    lessons: ['containers-101'],
  },
  {
    id: 'dockerfile',
    term: 'Dockerfile',
    proper: true,
    short:
      'The text recipe Docker follows to build an image: a base image, the files to copy and the command that starts the app.',
    why: "It does not publish ports to Flux. The spec's `ports` and `containerPorts` do, so an `EXPOSE` line is documentation only.",
    // fact: FACTS 3.4 and 8.1 (ports come from the spec)
    category: 'docker',
    related: ['image', 'docker', 'container'],
    lessons: ['containers-101', 'first-deploy'],
  },
  {
    id: 'amd64',
    term: 'amd64',
    aka: ['x86_64', 'linux/amd64'],
    short:
      'The common PC processor architecture. Nearly every Flux node runs it, so an image needs a linux/amd64 build.',
    why: 'An Apple silicon laptop builds arm64 by default. Use `--platform linux/amd64`: only a handful of arm64 nodes exist, and none run ArcaneOS.',
    // fact: FACTS 11 row 4, 2.5 (7 arm64 nodes, none on ArcaneOS; a handful at the time of writing), 2.6
    category: 'docker',
    related: ['image', 'arcaneos', 'dockerfile'],
    lessons: ['containers-101', 'first-deploy'],
  },
  {
    id: 'repotag',
    term: 'repotag',
    aka: ['image reference', 'repository tag'],
    short: `The component field that names its image: \`[registry/][namespace/]name:tag\`. The image must be public (or the app enterprise), amd64 in practice and under ${IMAGE_LIMIT_GB} GB.`,
    why: `A node pulls exactly this string. Pin a version tag: FluxOS is set to check the registry about every ${IMAGE_RECHECK_HOURS} hours and redeploy a changed image under the same tag (read from source, not observed live).`,
    // fact: FACTS 3.3 (repotag row), 6.3 and 11 row 19 (6 hour re-check VERIFIED-SOURCE; the redeploy is inferred, UNVERIFIED live)
    category: 'docker',
    related: ['image', 'registry', 'repoauth'],
    lessons: ['containers-101', 'first-deploy'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
  },
  {
    id: 'repoauth',
    term: 'repoauth',
    short:
      'Credentials for a private registry, written `user:token` or as a cloud provider address. Only allowed on enterprise apps.',
    why: 'The network allows credentials only on an enterprise app, whose spec is encrypted. In a public spec they would be readable through the API. Use a public image, or make the app enterprise.',
    // fact: FACTS 3.3 (repoauth row), 3.7, 11 row 6
    category: 'docker',
    related: ['enterprise-app', 'repotag', 'registry'],
    lessons: ['env-and-secrets', 'your-toolkit'],
  },
  {
    id: 'healthcheck',
    term: 'health check',
    aka: ['HEALTHCHECK'],
    short:
      'A Docker feature that probes whether a container works. FluxOS does not read it, so a running container counts as healthy.',
    why: 'A broken but running container is not replaced. Make the process exit when it fails, or add instances. FDM only checks that each public port accepts a connection.',
    // fact: FACTS 6.3 (FluxOS does not read HEALTHCHECK; FDM TCP check), 11 row 20
    category: 'docker',
    related: ['container', 'failover', 'haproxy'],
    lessons: ['redundancy-failover', 'operate-your-app'],
  },
  {
    id: 'volume',
    term: 'volume',
    short:
      'Storage for a container that outlives it. On Flux, `containerData` defines it and `hdd` sets its size in GB.',
    why: 'A plain volume survives restarts but not a node failure, a hard redeploy or expiry. `r:` and `g:` volumes replicate between instances, so they survive a node loss while a current copy remains.',
    // fact: FACTS 7.1 to 7.3 (grammar, guarantees, size)
    category: 'docker',
    related: ['container-data', 'container', 'syncthing'],
    lessons: ['persistent-storage'],
  },
];

export default terms;
