/**
 * Terminal scripts for the minecraft-server lesson: list the nodes that run a primary and standby app,
 * then find the one that answers on the game port.
 *
 * Simulation. The addresses are documentation addresses (198.51.100.0/24, never routable). The location
 * rows have the real shape of GET /apps/location/<name> (FACTS 10 E24). An app with a `g:` volume runs its
 * container on the primary only (FACTS 7.2), so only that node answers on the public port.
 *
 * Two scripts come from one builder: `minecraftServerLocate` for the lesson step (public port equals the
 * container port) and `minecraftServerFind` for the checkpoint (public port differs, so the container port
 * is a trap).
 */

import type { TerminalScript } from '@/learn/types';

interface Node {
  ip: string;
  api: number;
  at: string;
  up: number;
  since: string;
}

interface Fixture {
  id: string;
  app: string;
  hash: string;
  publicPort: number;
  containerPort: number;
  nodes: Node[];
  /** Index of the primary in `nodes`. */
  primary: number;
  intro: string[];
}

function addMinutes(time: string, minutes: number): string {
  const [h, m, rest] = time.split(':');
  const total = Number(h) * 60 + Number(m) + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${rest}`;
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function build(f: Fixture): TerminalScript {
  const response = {
    status: 'success',
    data: f.nodes.map((n) => ({
      ip: `${n.ip}:${n.api}`,
      name: f.app,
      hash: f.hash,
      broadcastedAt: `2026-10-12T${n.at}Z`,
      expireAt: `2026-10-12T${addMinutes(n.at, 125)}Z`,
      osUptime: n.up,
      staticIp: false,
      runningSince: n.since,
    })),
  };
  const ips = f.nodes.map((n) => n.ip);
  const primaryIp = f.nodes[f.primary]?.ip ?? '';
  const standbyIps = ips.filter((ip) => ip !== primaryIp);
  const anyIp = `(${ips.map(esc).join('|')})`;
  const standbyIp = `(${standbyIps.map(esc).join('|')})`;
  const probe = '(?:-vz|-zv)';
  const curl = `^curl (?:-s |-sS |--silent )?https://api\\.runonflux\\.io/apps/location/${esc(f.app)}`;
  const traps = f.containerPort !== f.publicPort;

  const spec = [
    '{',
    `  "name": "${f.app}",`,
    '  "instances": 3,',
    '  "compose": [',
    '    {',
    '      "name": "server",',
    '      "repotag": "itzg/minecraft-server:java21",',
    `      "ports": [${f.publicPort}],`,
    `      "containerPorts": [${f.containerPort}],`,
    '      "containerData": "g:/data"',
    '    }',
    '  ]',
    '}',
    '',
  ].join('\n');

  const commands: TerminalScript['commands'] = [
    {
      // fact: FACTS 10 E24 (location rows)
      match: `${curl}$`,
      output: [JSON.stringify(response)],
      goal: 'locate',
      stream: 30,
      explain:
        'One row per running instance. The `ip` field is the node address plus its FluxOS API port, which is not the game port.',
      example: `curl -s https://api.runonflux.io/apps/location/${f.app}`,
    },
    {
      match: `${curl} \\| jq$`,
      output: JSON.stringify(response, null, 2).split('\n'),
      goal: 'locate',
      stream: 12,
      explain: 'The same list, pretty printed. Three rows, three nodes, and one of them is the primary.',
      example: `curl -s https://api.runonflux.io/apps/location/${f.app} | jq`,
    },
    {
      match: `${curl} \\| jq -r '\\.data\\[\\]\\.ip'$`,
      output: f.nodes.map((n) => `${n.ip}:${n.api}`),
      goal: 'locate',
      explain:
        'Only the address column. Keep the part before the colon: the part after it is the node API port.',
      example: `curl -s https://api.runonflux.io/apps/location/${f.app} | jq -r '.data[].ip'`,
    },
    {
      // fact: FACTS 7.2 and 11 (standby copies hold data but only the primary runs the container)
      match: `^nc ${probe} ${esc(primaryIp)} ${f.publicPort}$`,
      output: [`Connection to ${primaryIp} ${f.publicPort} port [tcp/*] succeeded!`],
      goal: 'primary',
      explain:
        'This node runs the container, so it is the primary. The other two hold a synced copy of the world and answer nothing until one of them is promoted.',
      example: `nc -vz ${primaryIp} ${f.publicPort}`,
    },
    {
      match: `^nc ${probe} ${standbyIp} ${f.publicPort}$`,
      output: [
        `[err] No answer from {1} on port ${f.publicPort}.`,
        '[dim] Not this one. Try another node from the list.',
      ],
      explain:
        'A standby keeps a synced copy of the world but does not run the container, so nothing listens on the game port there.',
    },
  ];

  commands.push(
    {
      // fact: FACTS 6.4 (g: apps are TCP mode with a tcp_app_<port> frontend on that port; Lua handshake parser only on 25565; otherwise SNI or byte-offset ACLs, then the first registered app), 13 MC-05 (docs recommend the domain), 14.2 (production reachability not probed)
      match: `^nc ${probe} ${esc(f.app)}\\.app\\.runonflux\\.io ${f.publicPort}$`,
      output: [
        `Connection to ${f.app}.app.runonflux.io ${f.publicPort} port [tcp/*] succeeded!`,
        '[dim] The address is meant to reach the primary for you. It does not tell you which node that is.',
        ...(f.publicPort === 25565
          ? []
          : [
              `[dim] Simulation. FDM's template opens a front door on port ${f.publicPort}, but a real port was not probed: test yours.`,
            ]),
      ],
      explain:
        f.publicPort === 25565
          ? 'FDM puts an app with a `g:` volume in TCP mode: it opens a TCP front door on your public port and sends traffic to the current primary. On 25565 a script reads the Minecraft handshake to pick the app by host name. The Flux guide for its template tells players to use the domain for that reason.'
          : 'FDM puts an app with a `g:` volume in TCP mode: it opens a TCP front door on your public port and sends traffic to the current primary. The handshake script exists only for 25565. On any other port FDM matches a TLS name or the app name near the start of the first bytes, and traffic that matches nothing goes to the first app registered on that port. Whether the production load balancers accept this port was not tested, so test it on your own app.',
      example: `nc -vz ${f.app}.app.runonflux.io ${f.publicPort}`,
    },
    {
      match: `^nc ${probe} ${anyIp} (\\d+)$`,
      output: traps
        ? [
            '[err] No answer from {1} on port {2}.',
            '[dim] Only the public port in spec.json is published on the node. The container port exists only inside the container.',
          ]
        : [
            '[err] No answer from {1} on port {2}.',
            `[dim] The game port of this app is ${f.publicPort}. cat spec.json shows it.`,
          ],
      explain:
        'Docker publishes only the public ports of the spec. Anything else on the node is closed to you.',
    },
    {
      match: '^nc\\b.*$',
      output: [
        '[warn] Usage: nc [-vz] <node-ip> <port>',
        `[dim] Get node addresses with: curl -s https://api.runonflux.io/apps/location/${f.app} | jq -r '.data[].ip'`,
      ],
      explain: 'nc opens a TCP connection. -v prints the result and -z only tests that the port accepts.',
    },
    {
      match: '^curl (?:-s |-sS |--silent )?https://api\\.runonflux\\.io/apps/location/(\\S+)$',
      output: [
        '{"status":"success","data":[]}',
        `[dim] No instances are listed under "{1}". This simulation knows one app: ${f.app}.`,
      ],
      explain: 'The endpoint lists the running instances of one app by name.',
    },
  );

  return {
    id: f.id,
    prompt: '$',
    cwd: `~/${f.app}`,
    files: { 'spec.json': spec },
    intro: f.intro,
    commands,
    goals: [
      { id: 'locate', label: 'List the nodes that run the app' },
      { id: 'primary', label: 'Find the node that answers on the game port' },
    ],
    notFound:
      '[warn] {input}: not part of this exercise. You need curl to list the nodes and nc to test a port. Type help to see the shell.',
  };
}

/** The lesson step: the app `blockfort`, public port 25565 equal to the container port. */
export const minecraftServerLocate: TerminalScript = build({
  id: 'minecraft-server-locate',
  app: 'blockfort',
  hash: '4a9e17c0b2d58f3a61e07d94c3b82a15f6e0d7c943a1b58e2f60c97d41a3b85e',
  publicPort: 25565,
  containerPort: 25565,
  nodes: [
    { ip: '198.51.100.24', api: 16127, at: '08:41:19.302', up: 3011207.2, since: '2026-07-04T10:12:33.818Z' },
    { ip: '198.51.100.77', api: 16137, at: '09:02:48.617', up: 7720934.6, since: '2026-05-19T21:40:02.449Z' },
    { ip: '198.51.100.190', api: 16147, at: '08:55:06.045', up: 412009.9, since: '2026-10-07T06:18:51.230Z' },
  ],
  primary: 1,
  intro: [
    '[dim] Simulation. The addresses are documentation addresses and nothing leaves this page.',
    '[dim] Your server is registered as blockfort with three instances and a g: volume. cat spec.json shows the game port.',
    '[dim] Only the primary runs the game. Find out which node that is.',
  ],
});

/** The checkpoint: the app `mossgrove`, public port 25570 delivering to container port 25565. */
export const minecraftServerFind: TerminalScript = build({
  id: 'minecraft-server-find',
  app: 'mossgrove',
  hash: 'c71f3a08d9e24b5671a0f8d3c92e46b05a7d1f38e90c4b26d7a15f03e8b49c62',
  publicPort: 25570,
  containerPort: 25565,
  nodes: [
    { ip: '198.51.100.8', api: 16167, at: '09:12:33.771', up: 2203311.9, since: '2026-09-16T13:05:47.902Z' },
    { ip: '198.51.100.61', api: 16127, at: '08:47:58.120', up: 9304417.4, since: '2026-04-21T02:33:10.514Z' },
    { ip: '198.51.100.233', api: 16177, at: '09:20:14.396', up: 640128.0, since: '2026-10-04T18:27:39.075Z' },
  ],
  primary: 2,
  intro: [
    '[dim] Simulation. The addresses are documentation addresses and nothing leaves this page.',
    '[dim] A friend registered the server mossgrove and wants to know which node is serving it right now.',
    '[dim] Its spec is in spec.json. Find the node that answers on the game port.',
  ],
});

export default minecraftServerLocate;
