/**
 * Scenario 1: Docker basics.
 *
 * Teaches the lifecycle of a container with five commands against a toy image (nginx): what is on
 * the machine, run, list, read logs, stop. The port mapping `-p 8080:80` is the same pair a Flux
 * spec calls `ports` and `containerPorts`.
 *
 * State lives in the virtual file system under /var/lib/docker (images and containers) and in the
 * goals, so `docker images` is empty before the run and lists nginx after it.
 */

import type { ScriptWithRequires } from '../engine/types';
import { fakeDigest, fakeHex, SIM_INTRO } from './helpers';

const IMAGE = 'nginx:1.27-alpine';
const CONTAINER_ID = fakeHex('basics:container', 64);
const SHORT_ID = CONTAINER_ID.slice(0, 12);
const IMAGE_ID = fakeHex('basics:image', 12);
const LAYERS = Array.from({ length: 6 }, (_, i) => fakeHex(`basics:layer:${i}`, 12));
const PORTS = (port: string) => `0.0.0.0:${port}->80/tcp, [::]:${port}->80/tcp`;

// Tables: one tab between cells, aligned by the engine after the port and name are filled in.
const row = (...cells: string[]): string => cells.join('\t');

const IMAGE_HEADER = row('REPOSITORY', 'TAG', 'IMAGE ID', 'CREATED', 'SIZE');
const PS_HEADER = row('CONTAINER ID', 'IMAGE', 'COMMAND', 'CREATED', 'STATUS', 'PORTS', 'NAMES');

const NAME = '{file:/var/lib/docker/last/name}';
const PORT = '{file:/var/lib/docker/last/port}';

const psRow = (status: string, created: string): string[] => [
  PS_HEADER,
  row(SHORT_ID, IMAGE, '"/docker-entrypoint.…"', created, status, PORTS(PORT), NAME),
];

const NGINX_LOGS = [
  '/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration',
  '/docker-entrypoint.sh: Looking for shell scripts in /docker-entrypoint.d/',
  '/docker-entrypoint.sh: Launching /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh',
  '10-listen-on-ipv6-by-default.sh: info: Getting the checksum of /etc/nginx/conf.d/default.conf',
  '10-listen-on-ipv6-by-default.sh: info: Enabled listen on IPv6 in /etc/nginx/conf.d/default.conf',
  '/docker-entrypoint.sh: Sourcing /docker-entrypoint.d/15-local-resolvers.envsh',
  '/docker-entrypoint.sh: Launching /docker-entrypoint.d/20-envsubst-on-templates.sh',
  '/docker-entrypoint.sh: Launching /docker-entrypoint.d/30-tune-worker-processes.sh',
  '/docker-entrypoint.sh: Configuration complete; ready for start up',
  '2026/10/12 09:41:12 [notice] 1#1: using the "epoll" event method',
  '2026/10/12 09:41:12 [notice] 1#1: nginx/1.27.5',
  '2026/10/12 09:41:12 [notice] 1#1: OS: Linux 6.8.0',
  '2026/10/12 09:41:12 [notice] 1#1: getrlimit(RLIMIT_NOFILE): 1048576:1048576',
  '2026/10/12 09:41:12 [notice] 1#1: start worker processes',
  '2026/10/12 09:41:12 [notice] 1#1: start worker process 30',
  '2026/10/12 09:41:12 [notice] 1#1: start worker process 31',
];

const RUN_PATTERN =
  '^docker run(?=.* -d )(?=.* --name ([\\w.-]+) )(?=.* -p (\\d{2,5}):80 ).* nginx:1\\.27-alpine$';

export const dockerBasics: ScriptWithRequires = {
  id: 'docker-basics',
  cwd: '~/app',
  intro: [
    SIM_INTRO,
    'Docker is installed on this simulated machine and nothing is running yet.',
    'Start with: docker images',
  ],
  commands: [
    // ---- docker images ----------------------------------------------------------------------
    {
      match: '^docker (?:images|image ls)$',
      requires: ['!run'],
      output: [IMAGE_HEADER, '[note]No images yet: this machine has never pulled one.'],
      table: true,
      stream: 30,
      goal: 'images',
      example: 'docker images',
      explain:
        'An image is the read-only template a container starts from. This machine has none yet, so the list is empty. Flux nodes pull your image the same way, from a registry.',
    },
    {
      match: '^docker (?:images|image ls)$',
      output: [IMAGE_HEADER, row('nginx', '1.27-alpine', IMAGE_ID, '2 weeks ago', '48.2MB')],
      table: true,
      stream: 30,
      goal: 'images',
      explain:
        'The nginx image is here now: `docker run` pulled it. The tag after the colon picks one version, and the image ID is what tags point at.',
    },

    // ---- docker run -------------------------------------------------------------------------
    {
      match: RUN_PATTERN,
      requires: ['!file:/var/lib/docker/containers/{1}'],
      output: [
        `Unable to find image '${IMAGE}' locally`,
        '1.27-alpine: Pulling from library/nginx',
        ...LAYERS.map((id) => `${id}: Pulling fs layer`),
        ...LAYERS.map((id) => `${id}: Pull complete`),
        `Digest: ${fakeDigest('basics:digest')}`,
        `Status: Downloaded newer image for ${IMAGE}`,
        CONTAINER_ID,
      ],
      stream: 70,
      goal: 'run',
      example: `docker run -d --name web -p 8080:80 ${IMAGE}`,
      writes: {
        [`/var/lib/docker/images/${IMAGE}`]: 'present',
        '/var/lib/docker/containers/{1}': 'running',
        [`/var/lib/docker/containers/${SHORT_ID}`]: 'running',
        '/var/lib/docker/last/name': '{1}',
        '/var/lib/docker/last/port': '{2}',
      },
      explain:
        '`-d` runs it in the background, `--name` gives it a handle and `-p {2}:80` publishes container port 80 on port {2} of this machine. A Flux spec has the same pair: `ports` is the outside number and `containerPorts` the inside one.',
    },
    {
      match: RUN_PATTERN,
      output: [
        '[err]docker: Error response from daemon: Conflict. The container name "/{1}" is already in use. You have to remove (or rename) that container to be able to reuse that name.',
        "[dim]Run 'docker run --help' for more information",
        '[note]Pick another --name, or press Reset to start again.',
      ],
      explain:
        'Container names are unique on a machine, so a second container cannot take a name that is in use.',
    },
    {
      match: '^docker run(?!.* -d ).* nginx:1\\.27-alpine$',
      output: [
        '[note]Without -d, docker run keeps the container in the foreground and holds this terminal until you stop it.',
        '[note]Add -d to detach it, then use docker ps to see it.',
      ],
      explain:
        'Detached mode (`-d`) is how services run: nothing is attached to a terminal, which is how Flux runs your container too.',
    },

    // ---- docker ps ----------------------------------------------------------------------------
    {
      match: '^docker ps$',
      requires: ['run', '!stop'],
      output: psRow('Up 12 seconds', '12 seconds ago'),
      table: true,
      stream: 30,
      goal: 'ps',
      example: 'docker ps',
      explain:
        'Lists running containers. PORTS shows the mapping you asked for: connections to port {file:/var/lib/docker/last/port} on this machine go to port 80 inside the container.',
    },
    {
      match: '^docker ps$',
      output: [PS_HEADER, '[note]Nothing is running.'],
      table: true,
      stream: 30,
      goal: 'ps',
      explain: 'Only running containers are listed. Add `-a` to include stopped ones.',
    },
    {
      match: '^docker ps -a$',
      requires: ['run', '!stop'],
      output: psRow('Up 12 seconds', '12 seconds ago'),
      table: true,
      stream: 30,
      explain: '`-a` lists stopped containers too. This one is still running.',
    },
    {
      match: '^docker ps -a$',
      requires: ['run', 'stop'],
      output: [
        PS_HEADER,
        row(SHORT_ID, IMAGE, '"/docker-entrypoint.…"', '2 minutes ago', 'Exited (0) 3 seconds ago', '', NAME),
      ],
      table: true,
      stream: 30,
      explain: 'A stopped container is not gone: its name, logs and files stay until you remove it.',
    },
    {
      match: '^docker ps -a$',
      output: [PS_HEADER],
      table: true,
      stream: 30,
    },

    // ---- docker logs ---------------------------------------------------------------------------
    {
      match: '^docker logs (\\S+)$',
      requires: ['file:/var/lib/docker/containers/{1}'],
      output: NGINX_LOGS,
      stream: 35,
      goal: 'logs',
      example: 'docker logs web',
      explain:
        'A container writes what it prints to its logs. nginx announces its worker processes here. FluxCloud shows the same stream in the Logs tab of your app.',
    },
    {
      match: '^docker logs (\\S+)$',
      output: ['[err]Error response from daemon: No such container: {1}'],
      explain: 'There is no container with that name or ID on this machine. `docker ps -a` lists every name.',
    },

    // ---- docker stop ---------------------------------------------------------------------------
    {
      match: '^docker stop (\\S+)$',
      requires: ['file:/var/lib/docker/containers/{1}', '!stop'],
      output: ['{1}'],
      stream: 30,
      goal: 'stop',
      example: 'docker stop web',
      explain:
        'Docker asked the process to exit, then waited. The container stops but is not removed: `docker ps` no longer lists it, `docker ps -a` still does.',
    },
    {
      match: '^docker stop (\\S+)$',
      requires: ['file:/var/lib/docker/containers/{1}'],
      output: ['{1}'],
      explain: 'It was already stopped. Stopping a stopped container is harmless and prints the name again.',
    },
    {
      match: '^docker stop (\\S+)$',
      output: ['[err]Error response from daemon: No such container: {1}'],
      explain: 'There is no container with that name or ID on this machine.',
    },
  ],
  goals: [
    { id: 'images', label: 'List the images on this machine' },
    { id: 'run', label: 'Run nginx in the background on port 8080' },
    { id: 'ps', label: 'See the running container' },
    { id: 'logs', label: 'Read its logs' },
    { id: 'stop', label: 'Stop it' },
  ],
};
