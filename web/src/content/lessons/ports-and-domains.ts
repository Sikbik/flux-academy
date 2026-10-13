/**
 * Lesson 7, ports-and-domains: public port versus container port, the bind address, the generated
 * addresses, how the load balancer treats instances, and what the free address cannot carry.
 *
 * Planted failures: a server bound to loopback (step 2) and, in the checkpoint, a spec with mismatched
 * lists, a banned port and a port reused across components.
 *
 * Facts: docs/research/FACTS.md. Each fact is tagged `// fact: FACTS <section>` on the data it supports.
 */

import {
  FDM_EJECT_SEC,
  FDM_FAILOVER,
  FDM_TIMING,
  G_ELECTION_EVERY_SEC,
  G_STANDBY_WAIT_MIN_PER_POSITION,
  LOCATION_TTL_MIN,
  SYNCED_RESPAWN_EXTRA_MIN,
} from '@shared/flux';
import type { Lesson } from '@/learn/types';
import { portsAndDomainsReach } from '../terminals/ports-and-domains-reach.ts';

/** The quotes API as a partial component. Specs below merge their own fields over it. */
const api = {
  name: 'api',
  description: 'Quotes API',
  repotag: 'yourname/quotes:1.2.0',
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
};

/** The component shape for the checkpoint apps. */
const part = {
  description: 'Ticker part',
  environmentParameters: [],
  commands: [],
  containerData: '/tmp',
  repoauth: '',
  cpu: 0.5,
  ram: 500,
  hdd: 5,
};

const lesson: Lesson = {
  id: 'ports-and-domains',
  hook: 'A visitor reaches your container through a public port, a container port and an address Flux hands out for free. You will wire the ports, bind the right interface, read the generated addresses and watch traffic route around a dead instance.',
  objectives: [
    'Pair public ports with container ports and keep `ports`, `containerPorts` and `domains` the same length.',
    'Make a server reachable from outside its container by binding `0.0.0.0`.',
    'Read the generated address of any public port, and say when an address cannot carry your traffic.',
    'Describe what the load balancer does when an instance stops answering.',
  ],
  steps: [
    {
      id: 'two-ports',
      title: 'Two numbers per port',
      body: [
        'A component lists `ports` and `containerPorts`, and the lists pair by position. The first number is the public port on the node. The second is the port your process listens on inside the container. Docker forwards one to the other, and the two numbers do not have to match.',
        // fact: FACTS 3.3 and 3.4 (max 5, unique across the app, TCP and UDP, domains same length as ports)
        'Public ports in the 31000 range are a safe default: some well-known numbers are banned and a few cost extra. Each public port is published for both TCP and UDP, a component may list up to five, and no number may repeat anywhere in the app. The lists need equal lengths, and so does {{term:domains}}, which holds a custom domain per port or an empty string.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 6.2 (a node refuses an app whose external ports are taken)
          body: 'A public port also has to be free on the node that takes your instance. If another app already holds that number there, the node refuses the instance and another node picks it up.',
        },
      ],
      stage: { kind: 'diagram', id: 'port-mapping', beat: 1, props: { port: 31001, containerPort: 8000 } },
    },
    {
      id: 'bind-all',
      title: 'Listen on every interface',
      body: [
        // fact: FACTS 8.1 and 11 row 2 (published ports reach the container's bridge interface, not loopback)
        'The {{term:bind-address}} is the interface a server listens on. One bound to `127.0.0.1` accepts connections only from inside its own container, because Docker delivers published traffic to the network interface of the container, not to loopback. Outside a container it works, which is how the mistake survives testing.',
        'This image reads `HOST` to choose its interface and falls back to loopback. The spec sets it to loopback, so the app starts, the node reports it running, and every request ends in a refused connection or an empty reply. The fix is one value.',
      ],
      callouts: [
        {
          kind: 'tip',
          body: 'Frameworks have a setting for this: `--host 0.0.0.0` for many development servers, a `HOST` variable for others. `environmentParameters` and `commands` set it without rebuilding the image.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'quotes',
          description: 'A small quotes API',
          instances: 3,
          compose: [{ ...api, environmentParameters: ['HOST=127.0.0.1', 'PORT=8000'] }],
        },
        editable: ['compose[0].environmentParameters'],
        focus: [
          {
            path: 'compose[0].environmentParameters',
            note: 'HOST picks the interface the server binds. 127.0.0.1 is loopback, so only the container itself can connect.',
          },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Change `HOST` so the server listens on every interface.',
        hint: '`127.0.0.1` is loopback: only the container itself can reach it. Which address means every interface?',
        check: {
          all: [
            {
              lint: 'absent',
              codes: ['BIND_LOCALHOST'],
              message:
                'The server still binds loopback. Set `HOST` to the address that means every interface.',
            },
            {
              path: 'compose[0].environmentParameters',
              op: 'includes',
              value: 'HOST=0.0.0.0',
              message:
                'Set `HOST` to `0.0.0.0` explicitly. Deleting it would leave this image on its default, which is loopback.',
            },
          ],
        },
        solution: { compose: [{ environmentParameters: ['HOST=0.0.0.0', 'PORT=8000'] }] },
      },
    },
    {
      id: 'free-urls',
      title: 'One free address per port',
      body: [
        // fact: FACTS 6.4 (domains; TLS ends at the proxy, the node receives plain HTTP), 3.8 (lower-cased name), 11 row 3 (external port in the name)
        'Every app gets a free {{term:app-domain}} with a certificate: `<name>.app.runonflux.io`. The front door ends TLS, so your container receives plain HTTP. Each public port also gets its own address, `<name>_<port>.app.runonflux.io`, built from the public port. The plain name is an alias for the first port.',
        'The container port never appears in an address. Add a second public port: 31002, delivering to container port 9000, where the app serves a quote feed. The three lists pair by position, so each needs a second entry, and `domains` takes an empty string.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 11 row 3
          body: 'An address built from the container port does not reach your app. `quotes_8000.app.runonflux.io` is not generated, because the name uses the public port, 31001.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'quotes',
          description: 'A small quotes API',
          instances: 3,
          compose: [{ ...api, environmentParameters: ['HOST=0.0.0.0', 'PORT=8000'] }],
        },
        editable: ['compose[0].ports', 'compose[0].containerPorts', 'compose[0].domains'],
        focus: [
          { path: 'compose[0].ports', note: 'Public ports, one per row. Each one gets its own address.' },
          { path: 'compose[0].containerPorts', note: 'Where each public port is delivered, by position.' },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Add public port 31002 that delivers to container port 9000.',
        hint: 'The lists pair by position, so the second entry of `ports` goes with the second entry of `containerPorts` and `domains`. A custom domain is not needed, so `domains` takes an empty string.',
        check: {
          all: [
            {
              path: 'compose[0].ports',
              op: 'len>=',
              value: 2,
              message: 'The app needs a second public port. Use Add port.',
            },
            {
              path: 'compose[0].containerPorts[1]',
              op: 'eq',
              value: 9000,
              message: 'The second public port has to deliver to container port 9000.',
            },
            {
              lint: 'absent',
              codes: ['PORT_LENGTH_MISMATCH', 'DOMAINS_LENGTH_MISMATCH', 'PORT_BANNED', 'PORT_DUPLICATE'],
              message:
                'A list is out of step or a port is not allowed. `ports`, `containerPorts` and `domains` need equal lengths, and a public port may not be banned or repeated.',
            },
          ],
        },
        solution: { compose: [{ ports: [31001, 31002], containerPorts: [8000, 9000], domains: ['', ''] }] },
      },
    },
    {
      id: 'many-instances',
      title: 'One address, three instances',
      body: [
        // fact: FACTS 6.4 (FDM, HAProxy, round robin, FDMSERVERID cookie up to 8 h)
        `All instances of an app share one address. In front of them sits {{term:fdm}}, the Flux Domain Manager, which configures {{term:haproxy}}. It spreads different visitors across the running instances, which is {{term:round-robin}}, and sets a cookie called \`FDMSERVERID\` so a returning browser stays on the same instance for up to ${FDM_TIMING.stickyHours} hours at the time of writing. An app with a \`g:\` volume on any component is the exception: FDM sends every port of the app to its primary node.`,
        'In the simulator a visitor keeps its instance while that instance stays in rotation, as the cookie would. Send ten requests and watch which instance answers each one. Because another visitor may land elsewhere, an app should not keep per-visitor state only in the memory of one instance.',
      ],
      callouts: [
        {
          kind: 'why',
          body: 'Pinning keeps a session simple and spreads load by visitor, not by request. One very busy visitor stays on one instance until that instance leaves rotation.',
        },
      ],
      stage: { kind: 'diorama', scene: 'traffic', instances: 3, controls: ['request', 'kill', 'revive'] },
      task: {
        kind: 'send-requests',
        count: 10,
        prompt: 'Send 10 requests and watch which instance answers.',
      },
    },
    {
      id: 'dead-instance',
      title: 'When an instance dies',
      body: [
        // fact: FACTS 6.4 (TCP check every 3 s, down after 2 failures, up after 2 successes, retries 3 and redispatch)
        `At the time of writing, FDM tests every instance with a TCP connection every ${FDM_TIMING.healthIntervalSec} seconds. Failing ${FDM_TIMING.ejectAfterFailures} checks in a row takes it out of rotation, about ${FDM_EJECT_SEC} seconds in all. A request that cannot connect is retried on another instance, and ${FDM_TIMING.restoreAfterSuccesses} passes in a row bring the dead one back.`,
        // fact: FACTS 6.3 and 11 row 20 (FluxOS ignores HEALTHCHECK, a running container counts as healthy)
        'The check only asks whether the port accepts a connection, so a process that runs and answers every request with an error still passes. FluxOS does not read a Docker `HEALTHCHECK` either: if your app can wedge, make the process exit so that it restarts.',
        // fact: FACTS 6.4 (g: backend lists one server; 3 failed checks and 90 s; election every 30 s, about 3 minutes per place), 7.2
        `An app with a \`g:\` volume is different. Its backend lists one server, the elected primary, and FDM moves away from it only after at least ${FDM_FAILOVER.minFailedChecks} failed checks and ${FDM_FAILOVER.minUnhealthySec} seconds of trouble. On the node side the election runs every ${G_ELECTION_EVERY_SEC} seconds, and a standby waits about ${G_STANDBY_WAIT_MIN_PER_POSITION} minutes for each place it holds in the order before it may start the game or database. That is minutes, not seconds (read from the source, not timed live).`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 6.3 and 6.5 (location record 7500 s = 125 minutes, then the install; synced apps can wait about 27 minutes more)
          body: `Rerouting takes seconds, but a replacement copy can take about two hours after a node dies: ${LOCATION_TTL_MIN} minutes for the old location record to lapse, plus the image pull, and up to about ${SYNCED_RESPAWN_EXTRA_MIN} minutes more for a synced-storage app. {{lesson:redundancy-failover}} takes this apart.`,
        },
      ],
      task: {
        kind: 'kill-nodes',
        count: 1,
        prompt: 'Kill the node that answered you, then send another request.',
      },
    },
    {
      id: 'not-http',
      title: 'Not everything is HTTP',
      body: [
        // fact: FACTS 6.4 and 8.1 (front doors 80 and 443; TCP mode for g: apps and listed game and chain apps), 11 row 30
        'The generated address is a web front door. It serves HTTP and HTTPS on ports 80 and 443 and proxies them to your public port. That suits a website. An ordinary app cannot carry a game, a database or any other raw TCP or UDP protocol through it.',
        // fact: FACTS 6.4 (TCP mode if any component has g:; one frontend per public port on that port number; routed to the primary; no UDP), 14.2 (production reachability not probed)
        'FDM has one exception. It puts an app in TCP mode when any one of its components has a `g:` volume, and then every port of every component is TCP. A few chain and tool apps are in TCP mode by name. For each public port of such an app FDM opens a TCP front door on that same port number, reachable as `<name>.app.runonflux.io:<port>`, and sends the traffic to the elected primary. {{lesson:minecraft-server}} uses that.',
        'There is no UDP front door. Whether the production load balancers accept every port was not tested, so try your own port before you rely on it.',
        // fact: FACTS 6.4 (shared port number: FDM merges apps per port; first registered app is the default backend)
        'Two apps can hold the same public port number, because FluxOS only keeps ports unique on one node. FDM then merges them on one front door. It matches a TLS server name, or the app name near the start of the first bytes, and traffic that matches nothing goes to the first app registered on that port.',
        // fact: FACTS 10 E24 (location rows carry host:API port), 8.1 (reach instances at node-ip:external-port)
        'Those clients connect straight to a node: its IP address and your public port. `/apps/location/<name>` lists the nodes that run the app, and its `ip` field carries the node API port too, which is not your app: keep the address and take your port from the spec.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          body: 'Node addresses are not permanent: a replaced node has another one, so a hard-coded IP breaks. Use the generated address for anything that speaks HTTP, and for the TCP port of an app in TCP mode.',
        },
      ],
      stage: { kind: 'terminal', script: portsAndDomainsReach },
      task: {
        kind: 'terminal',
        goals: ['locate', 'reach'],
        prompt: 'Find a node that runs the app, then connect to the quote feed on it.',
        hint: 'The location endpoint gives node addresses. The feed is on the second public port of the spec, 31002, and you can read it with `cat spec.json`.',
      },
    },
  ],
  checkpoint: [
    {
      id: 'fix-the-wiring',
      kind: 'spec-fix',
      prompt:
        'The `ticker` app has an `api` component that must publish two ports: its HTTP API on 8000 and a metrics page on 9100. The dashboard serves on 3000. Registration would refuse this spec. Fix it and keep both api ports.',
      spec: {
        name: 'ticker',
        description: 'A price ticker with a dashboard',
        instances: 3,
        compose: [
          {
            ...part,
            name: 'api',
            description: 'Ticker API with metrics',
            repotag: 'yourname/ticker-api:1.0.0',
            ports: [31001, 30001],
            containerPorts: [8000],
            domains: [''],
          },
          {
            ...part,
            name: 'dashboard',
            description: 'Ticker dashboard',
            repotag: 'yourname/ticker-ui:1.0.0',
            ports: [31001],
            containerPorts: [3000],
            domains: [''],
          },
        ],
      },
      // fact: FACTS 3.3 (lists same length), 3.4 (banned 30000-30099, unique across components)
      check: {
        all: [
          {
            lint: 'valid',
            message: 'The validator still refuses this spec. Each error in the issues panel names its rule.',
          },
          {
            path: 'compose[0].containerPorts',
            op: 'includes',
            value: 9100,
            message: 'The api still has to deliver its metrics page: container port 9100.',
          },
          {
            path: 'compose[0].ports',
            op: 'len>=',
            value: 2,
            message: 'The api needs two public ports, one for the API and one for the metrics page.',
          },
        ],
      },
      solution: {
        compose: [
          { ports: [31001, 31002], containerPorts: [8000, 9100], domains: ['', ''] },
          { ports: [31003] },
        ],
      },
      explain:
        'The lists pair by position, so `ports`, `containerPorts` and `domains` need equal lengths. 30001 sits in the banned range 30000 to 30099, and a public port may appear only once in an app, across every component.',
      hint: 'Three rules are broken and each has its own message. Count the entries in the three lists of the api. Some public numbers are never allowed. And every public port in the whole app has to be unique.',
    },
    {
      id: 'url-for-port',
      kind: 'choice',
      prompt:
        'The `ticker` app lists `ports: [31001, 31002]` and `containerPorts: [8000, 9100]`. Which address reaches the process that listens on 9100?',
      options: [
        {
          id: 'plain',
          label: '`ticker.app.runonflux.io`',
          why: 'The plain name is an alias for the first public port, 31001, which delivers to 8000.',
        },
        {
          id: 'container',
          label: '`ticker_9100.app.runonflux.io`',
          why: 'Addresses are built from the public port. 9100 exists only inside the container.',
        },
        {
          id: 'first',
          label: '`ticker_31001.app.runonflux.io`',
          why: 'That is the first port. It delivers to 8000, not 9100.',
        },
        { id: 'public', label: '`ticker_31002.app.runonflux.io`' },
      ],
      answer: 'public',
      // fact: FACTS 6.4 and 11 row 3
      explain:
        'Position 2 pairs public port 31002 with container port 9100, and the address uses the public port: `ticker_31002.app.runonflux.io`.',
      hint: 'Pair the lists by position first. Then remember which of the two numbers an address is built from.',
    },
    {
      id: 'symptom-cause',
      kind: 'match',
      prompt: 'Match each symptom to its cause.',
      pairs: [
        {
          id: 'loopback',
          left: 'Connections are refused although the container is running',
          right: 'The server binds `127.0.0.1`',
        },
        {
          id: 'banned',
          left: 'Registration refuses a public port',
          right: 'The port is on the banned list',
        },
        {
          id: 'container',
          left: '`ticker_9100.app.runonflux.io` does not reach the app',
          right: 'The address was built from the container port',
        },
        {
          id: 'tcp',
          left: 'A game client cannot connect to the generated address',
          right: "An ordinary app's generated address carries web traffic only",
        },
      ],
      explain:
        'Each symptom points at one layer: the bind address, the port rules, the address pattern and the kind of traffic the front door carries.',
      hint: 'Ask of each symptom which layer it belongs to: the process, the registration rules, the address pattern or the protocol.',
    },
    {
      id: 'failure-order',
      kind: 'order',
      prompt: 'One of three instances stops answering. Put what happens in order.',
      items: [
        { id: 'miss', label: 'A health check to the instance gets no answer' },
        {
          id: 'eject',
          label: `A second check fails and FDM takes the instance out of rotation, about ${FDM_EJECT_SEC} seconds in`,
        },
        { id: 'reroute', label: 'New requests, including those pinned to it by cookie, go to the other two' },
        { id: 'recover', label: 'The instance recovers and passes two checks in a row' },
        { id: 'rejoin', label: 'FDM puts it back in rotation' },
      ],
      // fact: FACTS 6.4
      explain: `Detection takes ${FDM_TIMING.ejectAfterFailures} missed checks of ${FDM_TIMING.healthIntervalSec} seconds each. Recovery mirrors it: ${FDM_TIMING.restoreAfterSuccesses} passes put the instance back in rotation.`,
      hint: 'The load balancer needs two failed checks to act, and two passed checks to trust the instance again.',
    },
  ],
  recap: [
    '`ports` pair with `containerPorts` by position, and `ports`, `containerPorts` and `domains` keep the same length.',
    'Bind `0.0.0.0`: a server on `127.0.0.1` cannot be reached from outside its own container.',
    'Addresses use the public port: `<name>_<port>.app.runonflux.io`, and the plain name is the first port.',
    `FDM spreads different visitors across running instances, pins a browser with a cookie for up to ${FDM_TIMING.stickyHours} hours and drops a silent instance after about ${FDM_EJECT_SEC} seconds (its settings at the time of writing). An app with a \`g:\` volume fails over in minutes.`,
    'The generated address carries web traffic. Raw TCP goes to a node address and the public port, except for an app with a `g:` volume on any component: FDM serves it in TCP mode on its own public port and routes it to the primary (see the Minecraft lesson). UDP never goes through FDM.',
  ],
  further: [
    {
      label: 'FluxCloud docs: components, ports and domains',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
    {
      label: 'FluxCloud docs: your own domain on a port',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/custom-domain-setup',
    },
    {
      label: 'FluxCloud docs: the Instances tab of a running app',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/instances',
    },
  ],
  terms: ['app-domain', 'fdm', 'haproxy', 'domains', 'bind-address', 'round-robin'],
};

export default lesson;
