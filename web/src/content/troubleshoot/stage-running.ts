/**
 * Stage 4: running. The app is installed and something is wrong with it: gateway errors, refused
 * connections, crash loops, one instance carrying everything, secrets in the open.
 *
 * Health and restart behaviour is FACTS 6.3; the load balancer is FACTS 6.4; single instance data is 6.5.
 */

import { ORBIT_FACTS } from '@shared/flux';
import { api, both, cmd, fix, fixForge, fixJson, fixSh, guess, look, PREFIX_ADVICE, src } from './build';
import { FIGURES as F } from './figures';
import type { Symptom } from './types';

export const RUNNING_SYMPTOMS: Symptom[] = [
  {
    id: 'url-502-503',
    stage: 'running',
    title: 'My address answers 502 or 503, or resets the connection',
    summary: 'The app address responds with a gateway error, or the connection drops without a page.',
    seen: ['502 Bad Gateway', '503 Service Unavailable', 'Connection reset', 'This site cannot be reached'],
    keywords: [
      '502',
      '503',
      'bad gateway',
      'service unavailable',
      'app domain',
      'app.runonflux.io',
      'not loading',
      'down',
      'timeout',
      'no response',
      'reset',
    ],
    quick:
      'A 502 or 503 on your .app.runonflux.io address means the load balancer did not get a good answer from any instance. First confirm an instance is running, then check the container port and the listen address.',
    causes: [
      {
        id: 'nothing-running',
        title: 'No instance is running at all',
        why: 'The load balancer sends traffic only to instances that are announced and pass its TCP check. With none, every request fails. A node that is installing, or an app past its expiry, both look like this.',
        likelihood: 'common',
        checks: [
          api('location', 'No rows in `data` means no running instance. Each row is one node.'),
          api(
            'appspec',
            'If this answers `Application: {app} not found`, the app has expired or was never registered.',
          ),
        ],
        fixes: [
          fix(
            'Follow the install checks if it is new. If it expired, My Expired Apps offers Redeploy. The docs describe it as a fresh registration, paid as a new one: the earlier data is not restored.',
          ),
        ],
        proof: src('6.1; 6.4; 5.4', 'What Redeploy does is from the docs only.'),
        see: ['app-stuck-installing', 'app-expired'],
        lessons: ['how-apps-run'],
      },
      {
        id: 'port-mismatch',
        title: 'containerPorts does not match what the app listens on',
        why: 'Traffic is forwarded to `containerPorts[i]`. If the process listens on another port, nothing answers on the port Flux forwards to. A container counts as healthy when it is running, so the app can show as running while every request fails.',
        likelihood: 'usual',
        checks: [
          look('Open My Applications, Manage, then Logs. Find the port the server prints at startup.'),
          api('appspec', 'Compare `compose[].containerPorts` with that port.'),
        ],
        fixes: [
          fix(
            'Set `containerPorts` to the real listening port and update the app. An update that keeps the instances, components and resources the same is a free update.',
          ),
          fixForge(
            'See a spec whose PORT variable and container port disagree',
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
        lessons: ['ports-and-domains'],
        terms: ['container-ports'],
      },
      {
        id: 'binds-localhost',
        title: 'The server listens on 127.0.0.1',
        why: 'Published ports reach the container on its network interface, not on loopback. A server bound to localhost is reachable only from inside the container.',
        likelihood: 'usual',
        checks: [
          cmd(
            'Reproduce it locally with a mapped port',
            'docker run --rm -p 8080:3000 user/app:1.0.0\ncurl -i http://127.0.0.1:8080',
            '"Empty reply" or "Connection reset" confirms it.',
          ),
        ],
        fixes: [fix('Make the server listen on `0.0.0.0`.')],
        proof: src(
          '11 row 2; 8.1',
          'The port publishing is read in source. That a process bound to loopback is unreachable is standard Docker behaviour, which we did not test on Flux.',
        ),
        lint: ['BIND_LOCALHOST'],
        lessons: ['ports-and-domains'],
        see: ['connection-refused'],
      },
      {
        id: 'crash-loop',
        title: 'The container keeps crashing and restarting',
        why: 'FluxOS restarts an exited container itself, with growing gaps. While it is down or restarting the load balancer has nothing healthy to use.',
        likelihood: 'common',
        checks: [look('In the Logs tab, look for repeated start-up lines and a status of Restarting.')],
        fixes: [fix('Read the last log lines before each exit and fix what they name, then redeploy.')],
        proof: src('11 row 21; 6.3'),
        see: ['container-crash-loop'],
        lessons: ['operate-your-app'],
      },
      {
        id: 'wrong-url-port',
        title: 'You used the wrong address for the port',
        why: 'The plain address goes to the first published port. Other ports have their own address, built from the public port, not the container port.',
        likelihood: 'common',
        checks: [
          look(
            'Compare the address you used with `<name>.app.runonflux.io` and `<name>_<public port>.app.runonflux.io`.',
          ),
        ],
        fixes: [
          fix(
            'Use `<name>.app.runonflux.io` for the first port and `<name>_<public port>.app.runonflux.io` for the others.',
          ),
        ],
        proof: src('11 row 3; 6.4'),
        see: ['wrong-app-url'],
        lessons: ['ports-and-domains'],
        terms: ['app-domain', 'fdm'],
      },
      {
        id: 'single-instance-gone',
        title: 'The only instance went down with its node',
        why: `With one instance there is nothing to fail over to. The load balancer drops a dead instance in about ${F.ejectSec} seconds, but a replacement can take about two hours (${F.locationTtlMin} minutes plus the image pull), and up to about ${F.syncedExtraMin} minutes more for a synced app.`,
        likelihood: 'possible',
        checks: [api('location', 'An empty list for an app that asked for one instance is the sign.')],
        fixes: [fix('Run at least two instances in different geolocations.')],
        proof: both('6.4; 6.5'),
        see: ['single-instance-down'],
        lessons: ['redundancy-failover'],
      },
      {
        id: 'proxy-timeouts',
        title: 'The app answers more slowly than the proxy waits',
        why: `The load balancer configuration shows a connect timeout of ${F.fdmConnectSec} seconds, a request timeout of ${F.fdmRequestSec} seconds and a server timeout of ${F.fdmServerSec} seconds (${F.fdmSyncedServerSec} for synced apps). Which wait each one covers is not stated. A slow start-up or a long job behind an HTTP request can trip them.`,
        likelihood: 'possible',
        checks: [
          cmd(
            'Time a request',
            'curl -s -o /dev/null -w "%{time_total}\\n" https://{app}.app.runonflux.io',
            `A response that takes more than about ${F.fdmServerSec} seconds (${F.fdmSyncedServerSec} for a synced app) is likely to be cut off.`,
          ),
        ],
        fixes: [
          fix('Answer quickly and do long work in the background. Return a job id and let the client poll.'),
        ],
        proof: src(
          '6.4 (timeouts)',
          'The numbers are read in source. Which wait each one covers is not stated; the reading above is ours.',
        ),
        lessons: ['ports-and-domains'],
        terms: ['haproxy'],
      },
    ],
    lessons: ['ports-and-domains', 'how-apps-run'],
    labs: ['explorer'],
    related: ['connection-refused', 'container-crash-loop', 'wrong-app-url'],
    lint: ['PORT_ENV_MISMATCH', 'BIND_LOCALHOST'],
  },

  {
    id: 'connection-refused',
    stage: 'running',
    title: 'Connection refused, or an empty reply, on the node address',
    summary: 'The instance is listed, but connecting to its IP and port is refused or returns nothing.',
    seen: ['Connection refused', 'Empty reply from server', 'curl: (52)', 'curl: (7)'],
    keywords: [
      'connection refused',
      'empty reply',
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      'node ip',
      'direct connection',
      'external port',
      'cannot connect to node',
    ],
    quick:
      'Connect to the node IP on the public port from your spec. The port in the location list is the node API port, not your app. If that is right, check whether the server is bound to localhost.',
    causes: [
      {
        id: 'bound-to-loopback',
        title: 'The server listens on localhost only',
        why: 'A process bound to 127.0.0.1 inside the container refuses connections that arrive through the published port, and some clients see an empty reply.',
        likelihood: 'usual',
        checks: [
          cmd(
            'Test with a mapped port on your own machine',
            'docker run --rm -p 8080:3000 user/app:1.0.0\ncurl -i http://127.0.0.1:8080',
          ),
        ],
        fixes: [fix('Make the server listen on `0.0.0.0` on the container port.')],
        proof: src(
          '11 row 2; 8.1',
          'The port publishing is read in source. That a process bound to loopback is unreachable is standard Docker behaviour, which we did not test on Flux.',
        ),
        lint: ['BIND_LOCALHOST'],
        lessons: ['ports-and-domains'],
        terms: ['container-ports'],
      },
      {
        id: 'api-port-used',
        title: 'You used the port from the location list',
        why: 'Each row in the location list has `ip` as `host:port`, and that port belongs to the node API (16127 to 16197). Your app is on the node at the public port from your spec.',
        likelihood: 'common',
        checks: [
          api('location', 'Take the host part of `ip` only.'),
          api('appspec', 'Read `compose[].ports` for your public port.'),
        ],
        fixes: [
          fixSh(
            'Connect to the host from the location row and the public port from the spec.',
            'curl -i http://<node-ip>:<public-port>',
          ),
        ],
        proof: both('10.6.4 E24; 8.1'),
        lessons: ['ports-and-domains'],
        terms: ['location', 'ports'],
      },
      {
        id: 'container-port-used',
        title: 'You connected to the container port, not the public port',
        why: 'Docker publishes the container port on the public port you chose. The container port is not open on the node itself.',
        likelihood: 'common',
        checks: [
          look(
            'Compare the port in your client with `ports` (public) and `containerPorts` (inside) in the spec.',
          ),
        ],
        fixes: [fix('Use the public port, the entry of `ports` at the same index as the container port.')],
        proof: src('8.1; 3.3'),
        lessons: ['ports-and-domains'],
        terms: ['ports', 'container-ports'],
      },
    ],
    lessons: ['ports-and-domains'],
    labs: ['terminal', 'explorer'],
    related: ['url-502-503', 'non-http-service'],
    lint: ['BIND_LOCALHOST'],
  },

  {
    id: 'container-crash-loop',
    stage: 'running',
    title: 'The container keeps restarting or exits immediately',
    summary: 'The instance shows Restarting, or the log ends a second after it starts.',
    seen: ['Restarting', 'The log shows quick exits', `Restarts ${F.crashLadder} apart`],
    keywords: [
      'crash',
      'restarting',
      'crash loop',
      'exits immediately',
      'exit code',
      'keeps stopping',
      'logs',
      'backoff',
      'container stopped',
    ],
    quick: `FluxOS restarts an exited container itself, with growing gaps: none at first, then ${F.crashLadder}. Read the Logs tab first: the lines right before the exit should say why.`,
    causes: [
      {
        id: 'startup-error',
        title: 'The app fails at start-up',
        why: 'A missing variable, an unreachable dependency or a bad configuration file ends the process. The container exits, FluxOS restarts it, and the cycle repeats.',
        likelihood: 'usual',
        checks: [
          look(
            'My Applications, Manage, then Logs. Pick the component and read the last lines before the exit.',
          ),
        ],
        fixes: [
          fix(
            'Fix what the log names and update the app. If it needs a service in another component, make sure it is listed and reachable.',
          ),
        ],
        proof: src('11 row 21; 6.3'),
        lessons: ['operate-your-app', 'env-and-secrets'],
      },
      {
        id: 'bad-commands',
        title: 'The commands field replaced the start command',
        why: '`commands` becomes the container start arguments. A string that only works in a shell, or arguments that do not match the image entrypoint, exits at once.',
        likelihood: 'common',
        checks: [look('Compare `commands` with the CMD and ENTRYPOINT in your Dockerfile.')],
        fixes: [
          fixJson(
            'Split into arguments, or run through a shell. `sh -c` works only when the image has no `ENTRYPOINT` and contains `sh`: the arguments are appended after the entrypoint.',
            '"commands": ["sh", "-c", "node migrate.js && node server.js"]',
          ),
        ],
        proof: src('8.3; 11 row 21'),
        lint: ['COMMAND_UNSPLIT'],
        lessons: ['env-and-secrets'],
        terms: ['commands'],
      },
      {
        id: 'not-a-server',
        title: 'The process finishes its job and exits',
        why: 'A script that runs and ends is a successful container that stops, so it looks like a crash. FluxOS restarts any container that exits, so a job that ends is started again and again.',
        likelihood: 'common',
        checks: [
          look(
            'Check whether your start command is a script that terminates, such as a batch job or a migration.',
          ),
        ],
        fixes: [
          fix('Keep a long-running process in the foreground, or run the job from a scheduler elsewhere.'),
        ],
        proof: src('6.3'),
        lessons: ['containers-101'],
      },
      {
        id: 'out-of-memory',
        title: 'The app runs out of memory and is killed',
        why: 'The container has a memory limit of `ram` MB, with 2000 MB of swap on top. A process that needs more than that is normally killed by the container runtime (standard Docker behaviour) and then restarted by FluxOS.',
        likelihood: 'possible',
        checks: [look('Open the Monitoring tab and check the Memory Utilization chart near each restart.')],
        fixes: [
          fix(
            'Raise `ram`. This is a priced update, and FluxCloud warns "Resource requirements increased": if the current nodes cannot hold the larger spec, the app is reinstalled elsewhere and its data is lost. Create a backup and download it first.',
          ),
        ],
        proof: guess(
          '7.3',
          'The memory limit is verified in source. That the app was killed for it is the standard container behaviour, not seen on a Flux node here.',
        ),
        lessons: ['resources-pricing'],
      },
      {
        id: 'permission-or-port-clash',
        title: 'A permission or port problem inside the container',
        why: 'An app that cannot write its data folder, or tries to bind a port another process in the container already uses, fails at start.',
        likelihood: 'possible',
        checks: [look('Look for "permission denied" or "address already in use" in the log.')],
        fixes: [
          fix(
            'For a data folder, see the permission page. For a port clash, give each process its own container port.',
          ),
        ],
        proof: guess(
          '11 row 31',
          'Permission behaviour for non-root images was not reproduced on a Flux node.',
        ),
        see: ['permission-denied-volume'],
        lessons: ['persistent-storage'],
      },
    ],
    lessons: ['operate-your-app', 'containers-101'],
    related: ['url-502-503', 'unhealthy-not-replaced', 'permission-denied-volume'],
    lint: ['COMMAND_UNSPLIT'],
  },

  {
    id: 'unhealthy-not-replaced',
    stage: 'running',
    title: 'My container is stuck or unhealthy, but Flux does not replace it',
    summary: 'The app hangs or fails requests, yet the instance still shows as running.',
    seen: ['Running but not answering', 'HEALTHCHECK is ignored', 'No automatic restart'],
    keywords: [
      'healthcheck',
      'unhealthy',
      'hung',
      'frozen',
      'not restarting',
      'restart policy',
      'restart always',
      'watchdog',
      'docker health',
    ],
    quick:
      'FluxOS does not read a Docker HEALTHCHECK. A container counts as healthy when it is running. Make the process exit when it is unhealthy, and run more than one instance.',
    causes: [
      {
        id: 'healthcheck-ignored',
        title: 'Flux ignores the HEALTHCHECK instruction',
        why: 'FluxOS sets the Docker restart policy to `no` and manages restarts itself, only for exited containers. The load balancer adds a TCP connect check on each published port, nothing deeper.',
        likelihood: 'usual',
        checks: [
          look('Check whether your Dockerfile relies on `HEALTHCHECK` or a compose `restart: always`.'),
        ],
        fixes: [
          fix(
            'Have the process exit when it detects a fatal state, so FluxOS restarts it. Keep at least two instances so the load balancer can route around a bad one.',
          ),
        ],
        proof: src(
          '11 row 20; 6.3',
          'HEALTHCHECK is absent from the FluxOS source read; FluxOS may still look at it somewhere nobody searched.',
        ),
        lint: ['HEALTH_NOT_CHECKED'],
        lessons: ['production-checklist'],
        terms: ['healthcheck'],
      },
      {
        id: 'tcp-only',
        title: 'The port still accepts connections while the app is wedged',
        why: 'A TCP connect check passes as long as something accepts the connection, even if the app behind it never answers. The load balancer keeps the instance in rotation.',
        likelihood: 'common',
        checks: [
          cmd(
            'Make a real request and time it',
            'curl -s -o /dev/null -w "%{http_code} %{time_total}\\n" https://{app}.app.runonflux.io',
          ),
        ],
        fixes: [
          fix(
            'Add a watchdog in the app that exits on a failed internal check, and use more than one instance.',
          ),
        ],
        proof: src(
          '6.3; 6.4',
          'That a wedged app still passes the TCP check follows from the check being a connect, not a request.',
        ),
        lessons: ['redundancy-failover'],
        terms: ['haproxy', 'fdm'],
      },
    ],
    lessons: ['production-checklist', 'redundancy-failover'],
    related: ['container-crash-loop', 'single-instance-down'],
    lint: ['HEALTH_NOT_CHECKED'],
  },

  {
    id: 'single-instance-down',
    stage: 'running',
    title: 'My app went down when its node did',
    summary: 'One machine stopped and the whole app was unavailable for minutes or hours.',
    seen: ['App down for minutes or hours', 'The location list is empty', 'One instance'],
    keywords: [
      'single instance',
      'one instance',
      'node died',
      'node offline',
      'downtime',
      'outage',
      'down for hours',
      'failover',
      'redundancy',
      'spread',
    ],
    quick: `With one instance nothing can take over. Dead instances are dropped in about ${F.ejectSec} seconds, but a replacement can take about two hours after a node dies (${F.locationTtlMin} minutes plus the image pull), and up to about ${F.syncedExtraMin} minutes more for a synced app. Only a second copy that is already running keeps the app answering while the first is replaced.`,
    causes: [
      {
        id: 'one-instance',
        title: 'The app has only one instance',
        why: 'A node can fail at any time, because each node belongs to an independent operator, and one instance is one node. The network learns that a copy is gone only when its location record lapses, so the replacement waits for that, then pulls the image and starts.',
        likelihood: 'usual',
        checks: [
          api('location', 'One row means one machine. Zero rows means the app is down now.'),
          api('appspec', 'Check `instances` in the spec.'),
        ],
        fixes: [
          fix(
            'Use two or three instances. Price grows nearly linearly, with a step at four instances for small apps.',
          ),
        ],
        proof: both(
          '6.5; 6.3; 11 row 13; 15.3.3',
          `The two hours come from the node source. A sample of the network cannot show them: on ${ORBIT_FACTS.oneInstanceNonOrbit.readOn} every single-instance app that was not a blocklisted Orbit deployment had a running copy, which says nothing about the day a node fails.`,
        ),
        see: ['four-instances-cost-more'],
        lessons: ['redundancy-failover'],
        terms: ['instance', 'failover', 'n-minus-1'],
      },
      {
        id: 'same-place',
        title: 'The instances share a region or an organisation',
        why: 'In practice each copy runs on a different node, but placement does not promise anything beyond that: not different countries, and different nodes can still sit with the same hosting provider. A narrow `geolocation` puts every copy in the same place, and one regional outage takes all of them.',
        likelihood: 'common',
        checks: [
          api(
            'location',
            'Look up the countries of the node IPs. Many rows from one country is the pattern.',
          ),
        ],
        fixes: [fix('Allow several regions in `geolocation` and keep it as wide as your own rules allow.')],
        proof: src('6.2; 6.5'),
        lessons: ['geo-placement', 'redundancy-failover'],
        terms: ['geolocation', 'eligible-node'],
      },
      {
        id: 'replacement-delay',
        title: 'The replacement takes time to appear',
        why: `A dead instance is ejected in about ${F.ejectSec} seconds, but its location record lasts up to ${F.locationTtlMin} minutes before the network respawns it, plus install time (up to about ${F.syncedExtraMin} minutes more for a synced app). Plan for the instances you have left, not for the replacement.`,
        likelihood: 'common',
        checks: [
          api(
            'location',
            `\`expireAt\` is about ${F.locationTtlMin} minutes after \`broadcastedAt\` for each row.`,
          ),
        ],
        fixes: [fix('Size the app for N minus 1: if one node dies, the rest must carry the load.')],
        proof: src('6.3; 6.5'),
        lessons: ['redundancy-failover'],
        terms: ['n-minus-1'],
      },
      {
        id: 'state-on-dead-node',
        title: 'Your data lived on the node that died',
        why: 'A plain volume is local to one node. When the node is lost the replacement starts empty on another node.',
        likelihood: 'possible',
        checks: [look('Check whether `containerData` has an `r:` or `g:` prefix.')],
        fixes: [
          fix(
            'Put the data on a synced volume and run at least two instances. `g:` gives one writer and a standby copy, which suits a database; `r:` lets every instance write. A synced volume survives the loss of a node as long as a current copy remains, and the newest writes may be missing after a failover.',
            { proof: PREFIX_ADVICE },
          ),
        ],
        proof: src('7.2; 11 row 14'),
        see: ['data-differs-or-missing'],
        lessons: ['persistent-storage'],
        terms: ['primary-standby', 'container-data'],
      },
    ],
    lessons: ['redundancy-failover', 'geo-placement'],
    labs: ['failover'],
    related: ['fewer-instances-than-requested', 'data-differs-or-missing'],
    lint: ['INSTANCES_ONE', 'STATEFUL_SINGLE_INSTANCE'],
  },

  {
    id: 'websocket-drops',
    stage: 'running',
    title: 'WebSocket or streaming connections drop when they sit idle',
    summary: 'A long-lived connection works, then closes after an idle spell, or when the instance changes.',
    seen: ['WebSocket closed', 'Connection drops when idle', 'Stream cut off'],
    keywords: [
      'websocket',
      'socket',
      'streaming',
      'idle',
      'keepalive',
      'ping',
      'long polling',
      'sse',
      'drops',
      'disconnect',
    ],
    quick: `Send a ping or keepalive every 10 to 15 seconds, and let the client reconnect. The configuration shows two limits for a quiet connection, ${F.fdmServerSec} seconds on the server side (${F.fdmSyncedServerSec} for synced apps) and ${F.fdmClientSec} seconds on the client side. We have not observed which one closes it.`,
    causes: [
      {
        id: 'idle-timeout',
        title: 'The proxy closes idle connections',
        why: `The load balancer sets request, server and client timeouts but no tunnel timeout on app backends, so a quiet WebSocket falls back to the client timeout of ${F.fdmClientSec} seconds and the server timeout of ${F.fdmServerSec} seconds (${F.fdmSyncedServerSec} for synced apps). Which of them closes it in practice was not observed.`,
        likelihood: 'common',
        checks: [
          look(
            `Time how long a quiet connection lives before it closes. About ${F.fdmServerSec} seconds (${F.fdmSyncedServerSec} for a synced app) or about ${F.fdmClientSec} seconds both match this cause.`,
          ),
        ],
        fixes: [
          fix(
            'Send ping frames or keepalive messages every 10 to 15 seconds in both directions, which is inside the shorter limit.',
          ),
        ],
        proof: guess(
          '6.4; 14 row 7',
          `The configuration was read and no tunnel timeout is set. The idle limit is given as ${F.fdmClientSec} seconds in one place and the server timeout as ${F.fdmServerSec} seconds (${F.fdmSyncedServerSec} synced) in another. The behaviour in practice was not observed.`,
        ),
        lessons: ['ports-and-domains'],
        terms: ['haproxy', 'fdm'],
      },
      {
        id: 'instance-change',
        title: 'The instance your client was pinned to went away',
        why: `A cookie keeps a client on one instance for up to ${F.stickyHours} hours, and a dead instance is ejected within about ${F.ejectSec} seconds. The next connection goes to another instance, which does not know the old session.`,
        likelihood: 'common',
        checks: [look('Check whether the failures line up with an instance leaving the location list.')],
        fixes: [fix('Reconnect automatically, and keep session state somewhere every instance can read.')],
        proof: src('6.4'),
        lessons: ['redundancy-failover', 'ports-and-domains'],
        terms: ['haproxy'],
      },
    ],
    lessons: ['ports-and-domains', 'redundancy-failover'],
    related: ['single-instance-down'],
    caveat: `WebSocket behaviour behind the load balancer was not tested. Treat the ${F.fdmServerSec} second and ${F.fdmClientSec} second figures as starting points to measure, not guarantees.`,
  },

  {
    id: 'permission-denied-volume',
    stage: 'running',
    title: 'Permission denied when the app writes to its data folder',
    summary: 'The log says permission denied for a path under the mounted volume.',
    seen: ['permission denied', 'EACCES', 'cannot create directory'],
    keywords: [
      'permission denied',
      'eacces',
      'chown',
      'non root',
      'user',
      'volume permissions',
      'cannot write',
      'read only',
    ],
    quick:
      'This is a guess from standard Docker behaviour: an image that runs as a non-root user cannot write a folder owned by root. Run as root or fix ownership in the entrypoint.',
    causes: [
      {
        id: 'non-root-user',
        title: 'The image runs as a non-root user and the volume is owned by root',
        why: 'Flux fixes the volume permissions for the owner the container is expected to run as, before a node becomes the sync leader, but an image whose user does not match may still be unable to write.',
        likelihood: 'usual',
        checks: [look('Open the Logs tab and find the first permission denied line and the path.')],
        fixes: [
          fix(
            'Run the process as root, or change ownership of the data folder from your entrypoint before starting the app.',
            {
              snippet: {
                lang: 'sh',
                label: 'Entrypoint sketch',
                code: '#!/bin/sh\nchown -R app:app /data\nexec su-exec app "$@"',
              },
            },
          ),
        ],
        proof: guess('11 row 31; 7.3; 14 row 18', 'User-level behaviour was not reproduced on a Flux node.'),
        lessons: ['persistent-storage', 'production-checklist'],
        terms: ['container-data'],
      },
      {
        id: 'writes-outside-mount',
        title: 'The app writes to a folder that is not the mount',
        why: 'Only the mount path in `containerData` is the persistent volume. Writes elsewhere go to the container layer, which is not part of `hdd` and is not synced. On nodes whose Docker uses XFS with project quota it is capped at 10 GB.',
        likelihood: 'possible',
        checks: [look('Compare the path in the error with the path after the colon in `containerData`.')],
        fixes: [
          fix(
            'Point the app at the mounted folder, or change `containerData` to the folder the app really uses.',
          ),
        ],
        proof: src('7.1; 7.3'),
        lint: ['STATEFUL_NO_VOLUME'],
        lessons: ['persistent-storage'],
        terms: ['container-data'],
      },
    ],
    lessons: ['persistent-storage'],
    related: ['container-crash-loop', 'volume-full'],
    lint: ['STATEFUL_NO_VOLUME'],
    caveat: 'Permission problems on Flux volumes could not be reproduced. The first cause is a likely guess.',
  },

  {
    id: 'image-latest-changed',
    stage: 'running',
    title: 'My app changed behaviour and I did not update it',
    summary: 'Something works differently, or instances disagree, with no change to the spec.',
    seen: [
      'Different instances behave differently',
      'A new version appeared on its own',
      'Behaviour changed overnight',
    ],
    keywords: [
      'latest',
      'tag',
      'image changed',
      'different builds',
      'automatic update',
      'digest',
      'pin version',
      'unexpected update',
    ],
    quick: `Pin an exact tag. Nodes check the registry for the same tag every ${F.imageRecheckHours} hours and, as far as the source shows, redeploy when it points at a new image, so \`latest\` can change under you. The redeploy was not seen live.`,
    causes: [
      {
        id: 'moving-tag',
        title: 'The tag moves',
        why: `FluxOS re-checks the registry for the same tag every ${F.imageRecheckHours} hours, staggered per node. The source indicates that it redeploys when the digest changed, so instances can run different builds for a while and behaviour can change without any update message.`,
        likelihood: 'usual',
        checks: [
          look(
            'Look at `repotag` in the spec. `latest`, a missing tag or a major-version tag are all moving.',
          ),
        ],
        fixes: [fixJson('Use an exact version tag, or a digest.', '"repotag": "user/app:1.4.2"')],
        proof: src(
          '11 row 19; 6.3',
          'The 6 hour check is verified. That it redeploys on a new digest is inferred and was not seen live.',
        ),
        lint: ['IMAGE_LATEST', 'IMAGE_UNTAGGED'],
        lessons: ['containers-101', 'production-checklist'],
        terms: ['repotag', 'image'],
      },
      {
        id: 'base-image-moved',
        title: 'Your build pulled a newer base image',
        why: 'If you rebuilt and pushed the same tag, the new layers are what nodes get. A `FROM` line without a version moves under you too.',
        likelihood: 'possible',
        checks: [
          look('Check whether you pushed over an existing tag, and whether `FROM` names an exact version.'),
        ],
        fixes: [fix('Push each build with a new tag, and pin the base image version in the Dockerfile.')],
        proof: src('6.3'),
        lessons: ['containers-101'],
      },
    ],
    lessons: ['containers-101', 'production-checklist'],
    related: ['container-crash-loop'],
    lint: ['IMAGE_LATEST'],
  },

  {
    id: 'secrets-visible',
    stage: 'running',
    title: 'My environment variables are visible to anyone',
    summary: 'A password or key sits in the spec and the spec is public.',
    seen: ['Anyone can read DB_PASSWORD', 'A secret in a public spec'],
    keywords: [
      'secret',
      'password',
      'api key',
      'token',
      'public spec',
      'enterprise',
      'leaked',
      'environment variables public',
      'credentials exposed',
    ],
    quick:
      'On a public app, environment variables and commands are readable by anyone through the API. Use an Enterprise app, and treat anything already exposed as leaked.',
    causes: [
      {
        id: 'public-spec',
        title: 'The spec is public',
        why: 'Anyone can fetch `GET /apps/appspecifications/<name>` and read `environmentParameters` and `commands`. Enterprise encrypts `contacts` and `compose` so that only the owner and ArcaneOS nodes can read them.',
        likelihood: 'usual',
        checks: [
          api(
            'appspec',
            'Look at `environmentParameters` and `commands` in the answer. That is what everyone sees.',
          ),
        ],
        fixes: [
          fix(
            'Turn on Enterprise and update the app, then rotate every secret that was ever in a public spec. FluxCloud switches Enterprise on for you when a variable name looks like a secret. Enterprise adds a fee and needs an amd64 image for every component.',
          ),
          fixForge('See the lint for a secret in a public spec', 'Open this spec in the forge', {
            fixture: 'hello-world',
            patch: { compose: [{ environmentParameters: ['DB_PASSWORD=hunter2'] }] },
            shows: ['ENV_SECRET_PUBLIC'],
          }),
        ],
        proof: both(
          '11 row 18; 8.3; 3.7',
          'That the spec is public was seen live and the docs say the same. What Enterprise encrypts is read in source.',
        ),
        lint: ['ENV_SECRET_PUBLIC'],
        lessons: ['env-and-secrets'],
        terms: ['enterprise-app', 'environment-parameters', 'arcaneos'],
      },
      {
        id: 'contacts-public',
        title: 'Contact addresses are public too',
        why: '`contacts` are part of the public spec unless Enterprise is on, so an email address there is visible to anyone who looks up the app.',
        likelihood: 'common',
        checks: [api('appspec', 'Read `contacts` in the answer.')],
        fixes: [fix('Use an address you are happy to publish, or turn Enterprise on.')],
        proof: src('3.2'),
        lint: ['CONTACTS_PUBLIC'],
        lessons: ['env-and-secrets'],
      },
    ],
    lessons: ['env-and-secrets'],
    labs: ['spec-forge'],
    related: ['private-image-rejected'],
    lint: ['ENV_SECRET_PUBLIC', 'CONTACTS_PUBLIC'],
  },
];
