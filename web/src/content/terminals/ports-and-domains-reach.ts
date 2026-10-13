/**
 * Terminal script for the ports-and-domains lesson: find the nodes that run an app, then reach a raw
 * TCP port on one of them.
 *
 * Simulation. The addresses are documentation addresses (203.0.113.0/24, never routable). The response
 * has the real shape of GET /apps/location/<name> (FACTS 10, E24; docs/research/samples/
 * apps_location_explorer.json): `ip` is host:API port, then name, hash, broadcastedAt, expireAt (about 125
 * minutes later), osUptime, staticIp and runningSince.
 */

import type { TerminalScript } from '@/learn/types';

const HASH = '7d1c2e5b9a4f08d36b1e72c5a9f40d8e13b6c7a2f5e9d04b8c1a73e6f2d95b40';

const NODES = [
  { ip: '203.0.113.17:16127', at: '09:14:02.511', up: 1209600.4, since: '2026-09-28T16:20:44.127Z' },
  { ip: '203.0.113.58:16137', at: '09:31:47.903', up: 5143201.8, since: '2026-08-13T04:02:19.664Z' },
  { ip: '203.0.113.201:16177', at: '09:07:15.220', up: 884130.1, since: '2026-10-02T11:45:30.058Z' },
];

function addMinutes(time: string, minutes: number): string {
  const [h, m, rest] = time.split(':');
  const total = Number(h) * 60 + Number(m) + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${rest}`;
}

const RESPONSE = {
  status: 'success',
  data: NODES.map((n) => ({
    ip: n.ip,
    name: 'quotes',
    hash: HASH,
    broadcastedAt: `2026-10-12T${n.at}Z`,
    expireAt: `2026-10-12T${addMinutes(n.at, 125)}Z`,
    osUptime: n.up,
    staticIp: false,
    runningSince: n.since,
  })),
};

const COMPACT = JSON.stringify(RESPONSE);
const PRETTY = JSON.stringify(RESPONSE, null, 2).split('\n');
const IPS = NODES.map((n) => n.ip);

const SPEC_EXCERPT = [
  '{',
  '  "name": "quotes",',
  '  "instances": 3,',
  '  "compose": [',
  '    {',
  '      "name": "api",',
  '      "repotag": "yourname/quotes:1.2.0",',
  '      "ports": [31001, 31002],',
  '      "containerPorts": [8000, 9000],',
  '      "domains": ["", ""]',
  '    }',
  '  ]',
  '}',
  '',
].join('\n');

const FEED = [
  '"Simplicity is prerequisite for reliability." Edsger W. Dijkstra',
  '"Premature optimization is the root of all evil." Donald Knuth',
  '"Make it work, make it right, make it fast." Kent Beck',
];

/** Any of the three documentation addresses, as a capture group. */
const NODE = '(203\\.0\\.113\\.(?:17|58|201))';
const CURL = '^curl (?:-s |-sS |--silent )?https://api\\.runonflux\\.io/apps/location/quotes';

export const portsAndDomainsReach: TerminalScript = {
  id: 'ports-and-domains-reach',
  prompt: '$',
  cwd: '~/quotes',
  files: { 'spec.json': SPEC_EXCERPT },
  intro: [
    '[dim] Simulation. The addresses are documentation addresses and nothing leaves this page.',
    '[dim] The app is called quotes. cat spec.json shows its two public ports: 31001 for the HTTP API and 31002 for the plain TCP quote feed.',
    '[dim] Find a node that runs it, then connect to the feed.',
  ],
  commands: [
    {
      // fact: FACTS 10 E24 (location rows), 6.1 row 12 (records last 7500 s)
      match: `${CURL}$`,
      output: [COMPACT],
      goal: 'locate',
      stream: 30,
      explain:
        'Each row is one running instance. The `ip` field is the node address plus its FluxOS API port, which is not a port of your app.',
      example: 'curl -s https://api.runonflux.io/apps/location/quotes',
    },
    {
      match: `${CURL} \\| jq$`,
      output: PRETTY,
      goal: 'locate',
      stream: 12,
      explain:
        'Same data, pretty printed. Three rows means three instances on three different nodes, and every row carries the node address plus its API port.',
      example: 'curl -s https://api.runonflux.io/apps/location/quotes | jq',
    },
    {
      match: `${CURL} \\| jq -r '\\.data\\[\\]\\.ip'$`,
      output: IPS,
      goal: 'locate',
      explain:
        'Only the address column. Drop the `:1xxxx` part: that is the node API port. Your app is on the public ports from the spec.',
      example: "curl -s https://api.runonflux.io/apps/location/quotes | jq -r '.data[].ip'",
    },
    {
      match: '^curl (?:-s |-sS |--silent )?https://api\\.runonflux\\.io/apps/location/(\\S+)$',
      output: [
        '{"status":"success","data":[]}',
        '[dim] No instances are listed under "{1}". This simulation knows one app: quotes.',
      ],
      explain: 'The endpoint lists the running instances of one app by name. An unknown name lists none.',
    },
    {
      // fact: FACTS 3.4 and 8.1 (every public port is published for TCP and UDP)
      match: `^nc (?:-vz|-zv) ${NODE} 31002$`,
      output: ['Connection to {1} 31002 port [tcp/*] succeeded!'],
      goal: 'reach',
      explain:
        'The node publishes your public port, so a TCP client connects to the node address and port 31002. Flux publishes each public port for both TCP and UDP.',
      example: 'nc -vz 203.0.113.17 31002',
    },
    {
      match: `^nc ${NODE} 31002$`,
      output: [...FEED, '[dim] (simulation) A real nc keeps reading until you press Ctrl+C.'],
      goal: 'reach',
      stream: 400,
      explain:
        'This is the raw feed: one line per quote, no HTTP, no headers. Any client for the protocol would use the same address and port.',
      example: 'nc 203.0.113.17 31002',
    },
    {
      match: `^nc (?:-vz|-zv) ${NODE} 31001$`,
      output: [
        'Connection to {1} 31001 port [tcp/*] succeeded!',
        '[dim] That is the HTTP API port. The quote feed is on the other public port in spec.json.',
      ],
      explain:
        'A published port accepts a TCP connection whatever speaks behind it. This one is the HTTP API, so try the other public port.',
    },
    {
      match: `^nc (?:-vz|-zv) ${NODE} (\\d+)$`,
      output: [
        '[err] No answer from {1} on port {2}.',
        '[dim] Only the public ports in the spec are published on the node: 31001 and 31002. A container port such as 9000 exists only inside the container.',
      ],
      explain:
        'Containers have their own network. Docker publishes only the public ports your spec lists, and each one points at a container port.',
    },
    {
      // fact: FACTS 6.4 (the free address is the HTTP and HTTPS front door, 80 and 443)
      match: '^nc (?:-vz|-zv)? ?quotes\\.app\\.runonflux\\.io (80|443)$',
      output: [
        'Connection to quotes.app.runonflux.io {1} port [tcp/*] succeeded!',
        '[dim] The web ports answer, because the address is a web front door. The quote feed is not behind them.',
      ],
      explain:
        'The generated address is an HTTP and HTTPS load balancer, so it accepts connections on 80 and 443. It carries web requests to the app, and a raw TCP feed on another public port is not behind it.',
    },
    {
      // fact: FACTS 6.4 and 8.1 (the free address is the HTTP and HTTPS front door, 80 and 443)
      match: '^nc (?:-vz|-zv)? ?quotes\\.app\\.runonflux\\.io (\\d+)$',
      output: [
        '[warn] quotes.app.runonflux.io only carries web traffic, on ports 80 and 443.',
        '[dim] quotes is not in TCP mode: none of its components has a g: volume. Only apps in TCP mode get a front door on their own public port.',
        '[dim] For a raw TCP service, connect to a node address and your public port.',
        '[dim] List the nodes with: curl -s https://api.runonflux.io/apps/location/quotes',
      ],
      explain:
        'The generated address is a load balancer for HTTP and HTTPS. A raw protocol has no web request for it to route, so it needs a node address. An app with a `g:` volume would be different: FDM puts it in TCP mode and opens a front door on its public port.',
    },
    {
      match: `^curl (?:-s )?http://${NODE}:31001/?$`,
      output: ['{"quote":"Simplicity is prerequisite for reliability.","by":"Edsger W. Dijkstra"}'],
      explain:
        'A node address and a public port also work for HTTP. You skip the load balancer, so there is no failover on this URL.',
    },
    {
      match: '^nc\\b.*$',
      output: [
        '[warn] Usage: nc [-vz] <node-ip> <port>',
        "[dim] Get a node address with: curl -s https://api.runonflux.io/apps/location/quotes | jq -r '.data[].ip'",
      ],
      explain:
        'nc opens a TCP connection to an address and a port. -v prints the result, -z only tests the connection.',
    },
  ],
  goals: [
    { id: 'locate', label: 'List the nodes that run the app' },
    { id: 'reach', label: 'Connect to the quote feed on a node and its public port' },
  ],
  notFound:
    '[warn] {input}: not part of this exercise. You need curl to list the nodes and nc to connect. Type help to see the shell.',
};

export default portsAndDomainsReach;
