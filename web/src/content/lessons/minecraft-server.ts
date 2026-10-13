/**
 * Lesson 9, minecraft-server: a project. Size a Java game server by memory, expose its TCP port, keep its
 * world on a primary and standby volume, find the node that serves it and price the standby.
 *
 * Planted failures: a Java heap larger than the container limit (step 2), a web port for a game (step 3), a
 * world on a plain folder (step 4). The checkpoint builds a different server from a new brief.
 *
 * Facts: docs/research/FACTS.md. Each fact is tagged `// fact: FACTS <section>` on the data it supports.
 * Prices come from the engine at module load (baked rate card), never from memory. The image's own
 * settings (`EULA`, `MEMORY`, `/data`) are the image's documentation, not Flux behaviour.
 */

import type { FluxAppSpec, FluxComponentSpec } from '@shared/flux';
import {
  BAKED_PRICING,
  defaultComponent,
  defaultSpec,
  FDM_FAILOVER,
  G_ELECTION_EVERY_SEC,
  G_STANDBY_WAIT_MIN_PER_POSITION,
  quote,
} from '@shared/flux';
import type { Lesson } from '@/learn/types';
import { minecraftServerFind, minecraftServerLocate } from '../terminals/minecraft-server-locate.ts';

const usd = (n: number): string => `USD ${n.toFixed(2)}`;

/** Monthly price of a game server variant, from the engine. */
function serverPrice(over: Partial<FluxAppSpec>, comp: Partial<FluxComponentSpec>): number {
  const spec: FluxAppSpec = {
    ...defaultSpec(),
    instances: 2,
    ...over,
    compose: [
      defaultComponent({
        cpu: 2,
        ram: 4000,
        hdd: 20,
        ports: [25565],
        containerPorts: [25565],
        containerData: 'g:/data',
        ...comp,
      }),
    ],
  };
  return quote(spec, BAKED_PRICING.params).usdPerMonth;
}

const PRICE_PORT_80 = serverPrice({}, { ports: [80] });
const PRICE_PORT_FREE = serverPrice({}, {});
const PRICE_ONE = serverPrice({ instances: 1 }, {});
const PRICE_TWO = serverPrice({ instances: 2 }, {});
const PRICE_THREE = serverPrice({ instances: 3 }, {});
const RAM_PER_GB = BAKED_PRICING.params.ram * 10;

const brief = [
  'App name  blockfort',
  'Image     itzg/minecraft-server:java21',
  'Players   8 friends, Java edition',
  'Memory    4 GB box, 3 GB Java heap',
  'Port      25565, so players type just',
  '          the address',
  'World     survives losing any one node',
  'Budget    under USD 5 a month',
  '',
].join('\n');

/** The game server as a partial component. */
const server = {
  name: 'server',
  description: 'Minecraft Java server',
  repotag: 'itzg/minecraft-server:java21',
  ports: [25565],
  containerPorts: [25565],
  domains: [''],
  environmentParameters: ['EULA=TRUE', 'MEMORY=3G'],
  commands: [],
  containerData: 'g:/data',
  repoauth: '',
  cpu: 2,
  ram: 4000,
  hdd: 20,
};

const lesson: Lesson = {
  id: 'minecraft-server',
  hook: 'A game server asks Flux for three things: memory, a port players can reach and a world that outlives a node. You will size one, expose it, keep its world on a primary and standby volume, and find the node that is serving it.',
  objectives: [
    'Size a game server by memory, keeping the Java heap inside the container limit.',
    'Expose a TCP game port without a port fee.',
    'Pick the volume prefix that keeps a single-writer world through a node failure, and say what a plain volume loses.',
    'Find the node that serves a primary and standby app, and price its standby.',
  ],
  steps: [
    {
      id: 'brief',
      title: 'The brief',
      body: [
        'You will put a Minecraft Java server on Flux for a few friends. The brief has three jobs: stay up when a node fails, keep the world, and let players connect with a plain address. Each job becomes one decision in the spec: how much memory, which port, which volume.',
        // fact: FACTS 13 MC-02 (the Flux Minecraft template runs itzg/minecraft-server, DOCS-ONLY)
        'The image is `itzg/minecraft-server`, which the Flux docs say is also what its own Minecraft template runs. It reads its settings from environment variables, so nothing needs building. This is a project: the steps give you less hand holding, and the checkpoint builds a different server from a new brief.',
      ],
      callouts: [
        {
          kind: 'wild',
          // fact: FACTS 9.9.2 (28 NewGames templates, marketplace API 2026-10-12)
          body: 'At the time of writing the FluxCloud {{term:marketplace}} offers 28 game server templates, from Terraria to ARK. Each one is a spec like the one you are about to write.',
        },
      ],
      stage: { kind: 'code', files: [{ name: 'brief.txt', lang: 'text', code: brief }] },
    },
    {
      id: 'size',
      title: 'Size it by memory',
      body: [
        // fact: FACTS 9.9.2 (legacy Minecraft Java size variants: 1 to 48 GB RAM, 1.4 to 2 CPU, VERIFIED-LIVE)
        "A Java game server is bound by memory first. At the time of writing the marketplace sizes of Flux's own Minecraft server run from 1 GB to 48 GB of RAM while the CPU stays between 1.4 and 2 cores. So RAM is the number to choose, and the Java heap under it has to fit inside the container.",
        // fact: FACTS 7.3 (ram is a limit plus 2000 MB swap); EULA and MEMORY are the image's own settings
        "Per the image's own documentation, it takes its settings from variables: `EULA=TRUE` accepts the game licence and `MEMORY` sets the heap. `ram` in the spec is the memory limit of the container, with up to 2000 MB of swap on top, so a 3 GB heap in a container limited to 1000 MB will be starved or killed.",
      ],
      callouts: [
        {
          kind: 'cost',
          body: `Memory is priced at USD ${BAKED_PRICING.params.ram.toFixed(2)} per 100 MB for a bundle of three instances, which is ${usd(RAM_PER_GB)} per gigabyte. The price panel shows what each change does.`,
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'blockfort',
          description: 'Minecraft Java server for friends',
          instances: 2,
          compose: [{ ...server, ram: 1000, containerData: 'g:/data' }],
        },
        editable: ['compose[0].ram', 'compose[0].cpu', 'compose[0].hdd', 'compose[0].environmentParameters'],
        focus: [
          {
            path: 'compose[0].ram',
            note: 'The memory limit of the container. The Java heap set by MEMORY has to fit inside it.',
          },
        ],
        show: ['form', 'issues', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Give the container 4000 MB of RAM and keep the Java heap at 3 GB.',
        hint: 'The heap is `MEMORY=3G`, so the container limit has to be above 3000 MB. Raise `ram` rather than lowering the heap: the brief asks for both numbers.',
        check: {
          all: [
            {
              path: 'compose[0].ram',
              op: 'gte',
              value: 4000,
              message: 'The brief asks for 4 GB for the container, so the 3 GB heap fits with room to spare.',
            },
            {
              lint: 'absent',
              codes: ['RAM_TOO_SMALL_FOR_IMAGE'],
              message:
                'The container limit is still too small for this image. Raise `ram` above the Java heap.',
            },
            {
              path: 'compose[0].environmentParameters',
              op: 'includes',
              value: 'MEMORY=3G',
              message: 'Keep the Java heap at `MEMORY=3G` and raise the container limit instead.',
            },
          ],
        },
        solution: { compose: [{ ram: 4000 }] },
      },
    },
    {
      id: 'expose',
      title: 'Expose the game port',
      body: [
        // fact: FACTS 3.4 and 8.1 (25565 is outside the fee and banned lists, both protocols published)
        "The game speaks TCP on port 25565, the port the Flux Minecraft template publishes and the default of the Minecraft client, so a player can type just the address (the game's behaviour, not a Flux rule). A public port of 25565 is above 1023 and not on the banned list, so it carries no fee. Every public port is published for both TCP and UDP.",
        // fact: FACTS 4.4 (restricted ports add USD 2 before the divide by three), 6.2 (taken ports refused)
        `This spec publishes the game on port 80, a web port. That is charged ${usd(BAKED_PRICING.params.port)} before the division by three, which moves the monthly price from ${usd(PRICE_PORT_FREE)} to ${usd(PRICE_PORT_80)}, and players would have to type \`:80\` after the address. Set both numbers to 25565.`,
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 6.2 (a node refuses an app whose external ports are taken), 6.4 (the front door per port; Lua parser only on 25565; first registered app wins unmatched traffic)
          body: 'Every Minecraft app wants 25565. A node that already has an app on it skips your instance, and on the shared front door FDM sends traffic that matches no app to the first app registered on that port. A different public port works too: players then type it after the address, and a number nobody else uses leaves no other app to confuse with yours.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'blockfort',
          description: 'Minecraft Java server for friends',
          instances: 2,
          compose: [{ ...server, ports: [80] }],
        },
        editable: ['compose[0].ports', 'compose[0].containerPorts'],
        focus: [
          { path: 'compose[0].ports', note: 'The public port players connect to.' },
          { path: 'compose[0].containerPorts', note: 'The port the game listens on inside the container.' },
        ],
        show: ['form', 'issues', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Publish the game on public port 25565, delivering to container port 25565.',
        hint: 'The game listens on 25565. The public port is what players type, and 25565 is the number their client assumes. Check the price when the fee disappears.',
        check: {
          all: [
            {
              path: 'compose[0].ports',
              op: 'includes',
              value: 25565,
              message: 'Publish the game on public port 25565, the number the client assumes.',
            },
            {
              path: 'compose[0].containerPorts',
              op: 'includes',
              value: 25565,
              message: 'The game listens on 25565 inside the container, so deliver to 25565.',
            },
            {
              lint: 'absent',
              codes: ['PORT_FEE', 'PORT_LENGTH_MISMATCH'],
              message:
                'A charged port or an unpaired list is left. The price and the issues panel show which.',
            },
          ],
        },
        solution: { compose: [{ ports: [25565], containerPorts: [25565] }] },
      },
    },
    {
      id: 'persist',
      title: 'Keep the world',
      body: [
        // fact: FACTS 7.1 and 7.2 (plain volume: restart yes, node loss no, replacement starts empty)
        'The image keeps the world in `/data`. Without a mount there, the world dies with the container. A plain mount survives a restart but not the loss of the node: the replacement starts empty on another node. {{term:container-data}} is where you choose.',
        // fact: FACTS 7.2 (r: all instances write, g: one primary runs, others hold a synced copy)
        'Two of the sync prefixes, `r:` and `g:`, replicate the folder with {{term:syncthing}}. With `r:` every instance runs and writes, so two game servers would hold diverging worlds. With `g:` one instance, the primary, runs and the others keep a synced copy: {{term:primary-standby}}. A standby needs at least two instances. The election starts and stops only the `g:` component. If the app had other components, they would keep running on every node, and FDM would still send all its ports to the primary.',
      ],
      callouts: [
        {
          kind: 'gotcha',
          // fact: FACTS 6.4 and 7.2 (FDM: 3 failed checks and 90 s; election every 30 s; standby waits about 3 minutes per place; only the g: component is stopped and started)
          body: `A takeover is not instant. FDM moves away from a primary only after at least ${FDM_FAILOVER.minFailedChecks} failed checks and ${FDM_FAILOVER.minUnhealthySec} seconds of trouble. The nodes elect on a ${G_ELECTION_EVERY_SEC} second cycle, and a standby waits about ${G_STANDBY_WAIT_MIN_PER_POSITION} minutes for each place it holds in the order before it may start an empty server. Plan for minutes, not seconds, with players disconnected (read from the source, not timed live).`,
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'blockfort',
          description: 'Minecraft Java server for friends',
          instances: 1,
          compose: [{ ...server, containerData: '/tmp' }],
        },
        editable: ['instances', 'compose[0].containerData'],
        focus: [
          {
            path: 'compose[0].containerData',
            note: 'Where the container keeps durable data. A prefix decides what survives a node loss.',
          },
        ],
        show: ['form', 'issues', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Mount `/data` on a primary and standby volume, and give it a standby to copy to.',
        hint: 'The image writes the world to `/data`. A prefix in front of the path chooses the sync mode: `g:` runs one writer and keeps the others as copies, and a copy needs another instance.',
        check: {
          all: [
            {
              path: 'compose[0].containerData',
              op: 'eq',
              value: 'g:/data',
              message:
                'The world lives in /data and needs the g: prefix: one writer, a synced copy on the others.',
            },
            {
              path: 'instances',
              op: 'gte',
              value: 2,
              message: 'A standby needs a second instance to live on.',
            },
            {
              lint: 'absent',
              codes: ['STATEFUL_NO_VOLUME', 'STATEFUL_NOT_SYNCED', 'SYNC_SINGLE_INSTANCE'],
              message:
                'The world is still on a folder that does not survive a node loss, or it has no standby. Use `g:` and two instances.',
            },
          ],
        },
        solution: { instances: 2, compose: [{ containerData: 'g:/data' }] },
      },
    },
    {
      id: 'connect',
      title: 'Find the primary',
      body: [
        // fact: FACTS 9.6 (Instances tab shows the Primary IP), 7.2 (only the primary runs the container)
        'Players need the address of the instance that is running. In FluxCloud the Instances tab shows the Primary IP. A terminal can find it the way a client would: list the nodes that run the app, then try the game port on each. Only the primary runs the container, so only one node answers.',
        // fact: FACTS 6.4 (g: apps are TCP mode, only the elected primary is active), 13 MC-05 (docs recommend the domain)
        'Take the IP from the `ip` field without its API port, and the game port from your spec, 25565. A saved IP breaks when the primary moves. The docs recommend the generated address instead: FDM runs an app with a `g:` volume in TCP mode and sends traffic only to the elected primary, so the address should keep working after the minutes a failover takes.',
        // fact: FACTS 6.4 (tcp_app_<port> frontend on that port; Lua handshake parser only for 25565; SNI or byte-offset ACLs elsewhere; unmatched goes to the first registered app; mcf and *minecraft* names get TCP only), 14.2 (production reachability not probed)
        'How the port is routed depends on the number. FDM opens a TCP front door on your public port number, whatever it is, and sends it to the primary. Only 25565 has a script that reads the Minecraft handshake to find the app by host name.',
        'Any other port matches by a TLS name or by the app name near the start of the first bytes, and traffic that matches nothing goes to the first app registered on that port. A name that contains `minecraft`, or matches `mcf`, gets only the TCP side. Whether the production load balancers accept a given port was not tested, so try it on your own app.',
      ],
      callouts: [
        {
          kind: 'why',
          // fact: FACTS 8.1 and 11 row 30 (an ordinary app cannot carry raw TCP through the generated address)
          body: 'This is the exception to {{lesson:ports-and-domains}}. An ordinary app cannot carry raw TCP through the generated address. An app is served in TCP mode when any component has a `g:` volume, and then every public port gets a TCP front door.',
        },
      ],
      stage: { kind: 'terminal', script: minecraftServerLocate },
      task: {
        kind: 'terminal',
        goals: ['locate', 'primary'],
        prompt: 'List the nodes that run `blockfort`, then find the one that answers on the game port.',
        hint: 'The location endpoint lists three nodes. Test the game port from spec.json on each of them: the standby copies are not running the game.',
      },
    },
    {
      id: 'price',
      title: 'What the standby costs',
      body: [
        // fact: FACTS 0 row and 13 (the g: 20 percent discount does not exist), 4.4
        `The volume prefix is free: changing \`/data\` to \`g:/data\` changes nothing on the bill, and the 20 percent off that some guides promise for \`g:\` does not exist. What you pay for is copies. One instance costs ${usd(PRICE_ONE)} a month, two cost ${usd(PRICE_TWO)} and three cost ${usd(PRICE_THREE)}.`,
        "Each standby is a full instance with its own CPU, memory and disk, holding a copy of the data without running the process. That is the price of surviving a node loss. A fourth instance costs much more than the third, for the reason you met in {{lesson:resources-pricing}}. Add a second standby inside the brief's budget.",
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'blockfort',
          description: 'Minecraft Java server for friends',
          instances: 2,
          compose: [server],
        },
        editable: ['instances', 'compose[0].cpu', 'compose[0].ram', 'compose[0].hdd'],
        show: ['form', 'price'],
      },
      task: {
        kind: 'spec',
        prompt: 'Run three instances on the `g:` volume and stay under USD 5 a month.',
        hint: 'Watch the price while you change the instance count. The brief set the budget at USD 5, so check what the next instance adds before you commit to it.',
        check: {
          all: [
            {
              path: 'instances',
              op: 'gte',
              value: 3,
              message: 'The brief asks for a second standby: three instances.',
            },
            { price: 'max', usd: 4.99, message: 'The brief caps the bill at USD 5 a month.' },
            {
              path: 'compose[0].containerData',
              op: 'eq',
              value: 'g:/data',
              message: 'Keep the world on the `g:` volume: that is what the standby copies.',
            },
          ],
        },
        solution: { instances: 3 },
      },
    },
  ],
  checkpoint: [
    {
      id: 'modded-server',
      kind: 'spec-build',
      prompt:
        'A friend wants a modded server. Build the spec for this new brief. The editor starts from a plain web spec, so every part of the brief needs a change.',
      spec: {
        name: 'modpack',
        description: 'Modded Minecraft server',
        instances: 1,
        compose: [
          {
            name: 'server',
            description: 'Minecraft Java server',
            repotag: 'nginx:1.27',
            ports: [31001],
            containerPorts: [80],
            domains: [''],
            environmentParameters: [],
            commands: [],
            containerData: '/tmp',
            repoauth: '',
            cpu: 1,
            ram: 1000,
            hdd: 10,
          },
        ],
      },
      requirements: [
        {
          id: 'image',
          label: 'The image is `itzg/minecraft-server`',
          check: {
            path: 'compose[0].repotag',
            op: 'matches',
            value: '^itzg/minecraft-server:',
            message: 'The brief names the `itzg/minecraft-server` image.',
          },
        },
        {
          id: 'eula',
          label: 'The licence is accepted with `EULA=TRUE`',
          check: {
            path: 'compose[0].environmentParameters',
            op: 'includes',
            value: 'EULA=TRUE',
            message: "Per the image's documentation, the licence has to be accepted with `EULA=TRUE`.",
          },
        },
        {
          id: 'memory',
          label: '6000 MB for the container and a 5 GB heap (`MEMORY=5G`)',
          check: {
            all: [
              {
                path: 'compose[0].ram',
                op: 'gte',
                value: 6000,
                message: 'The container needs 6000 MB so that a 5 GB heap fits inside it.',
              },
              {
                path: 'compose[0].environmentParameters',
                op: 'includes',
                value: 'MEMORY=5G',
                message: 'Set the heap with `MEMORY=5G`.',
              },
            ],
          },
        },
        {
          id: 'port',
          label: 'Players connect on public port 25570, which delivers to the game port 25565',
          check: {
            all: [
              {
                path: 'compose[0].ports[0]',
                op: 'eq',
                value: 25570,
                message: 'The public port is the one players type: 25570.',
              },
              {
                path: 'compose[0].containerPorts[0]',
                op: 'eq',
                value: 25565,
                message: 'The game listens on 25565 inside the container.',
              },
            ],
          },
        },
        {
          id: 'world',
          label: 'The world is on a `g:` volume with at least two instances',
          check: {
            all: [
              {
                path: 'compose[0].containerData',
                op: 'eq',
                value: 'g:/data',
                message: 'The world needs the `g:` prefix: one writer and a synced copy.',
              },
              {
                path: 'instances',
                op: 'gte',
                value: 2,
                message: 'A standby needs a second instance to live on.',
              },
            ],
          },
        },
        {
          id: 'budget',
          label: 'Under USD 5 a month',
          check: {
            price: 'max',
            usd: 4.99,
            message: 'Over budget. Check what each extra instance and each extra gigabyte adds.',
          },
        },
        {
          id: 'valid',
          label: 'No errors',
          check: { lint: 'valid', message: 'The issues panel still lists an error to fix.' },
        },
      ],
      solution: {
        instances: 2,
        compose: [
          {
            repotag: 'itzg/minecraft-server:java21',
            ports: [25570],
            containerPorts: [25565],
            environmentParameters: ['EULA=TRUE', 'MEMORY=5G'],
            containerData: 'g:/data',
            cpu: 2,
            ram: 6000,
            hdd: 20,
          },
        ],
      },
      explain:
        'Memory sets the size, the heap fits inside it, the public port is the one players type and the volume carries the world. Two instances are the minimum that gives a `g:` volume a standby. At 6000 MB the server is also above the 5,000 MB a nominal Cumulus node has free, and above what most real Cumulus nodes have, so most Cumulus nodes cannot take it.',
      hint: 'Work down the checklist. The public and container port are different numbers here, so remember which is which, and the world needs both a prefix and a second instance.',
    },
    {
      id: 'find-the-primary',
      kind: 'terminal',
      prompt:
        'A friend registered `mossgrove` and wants to know which node is serving it right now. Find the node that answers on the game port.',
      script: minecraftServerFind,
      goals: ['locate', 'primary'],
      explain:
        'The game port is the public port of the spec, 25570, and not the container port. Only the node that runs the container answers on it.',
      hint: 'Read the spec first with `cat spec.json`. The game port you test is the public port, not the port the game listens on inside the container.',
    },
    {
      id: 'plain-volume-loss',
      kind: 'choice',
      prompt:
        'A server keeps its world on a plain volume at `/data` with three instances. The node that runs the game dies. What happens to the world?',
      options: [
        {
          id: 'copies',
          label: 'The other two instances hold a copy, so the world is intact',
          why: 'A plain volume is not replicated. Each instance has its own folder, and none of them has the world.',
        },
        {
          id: 'chain',
          label: 'FluxOS restores it from the chain',
          why: 'The chain holds the spec of your app, never its data.',
        },
        {
          id: 'lost',
          label: 'It is gone with the node, and the replacement instance starts with an empty world',
        },
        {
          id: 'backup',
          label: 'It is restored from the last backup',
          why: 'A local backup is a file inside the same volume, on the same node, so it is lost with the node and is never replicated. Only a copy you downloaded or sent to FluxDrive survives. The tab says weekly backups are automatic, but the source read has no weekly scheduler.',
        },
      ],
      answer: 'lost',
      // fact: FACTS 7.2 (plain volume: not replicated, replacement starts empty), 7.4 (backups are local)
      explain:
        'Only the sync prefixes, `r:` and `g:`, copy a folder to other instances. A plain volume lives on one node and dies with it, and so does a local backup held inside it.',
      hint: 'Which volume prefixes copy data to other nodes, and which of them is this one?',
    },
  ],
  recap: [
    'Size a game server by memory, and keep the Java heap below `ram`, the memory limit of the container.',
    'Public port 25565 carries no fee and lets players type just the address. Every public port is published for TCP and UDP.',
    'A plain volume dies with its node. `g:` keeps one writer running and a synced copy on every standby, and needs two instances.',
    'Only the primary answers on the game port: use the Instances tab, probe the nodes from the location list, or use the generated address, whose TCP front door sits on your public port and routes to the primary. Test the port you choose.',
    'The prefix costs nothing and every instance costs one share of the bundle, so the standby is the real price of safety.',
  ],
  further: [
    {
      label: 'FluxCloud docs: the Minecraft server template',
      url: 'https://docs.runonflux.com/fluxcloud/marketplace/games/minecraft',
    },
    {
      label: 'FluxCloud docs: the Instances tab of a running app',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/instances',
    },
    {
      label: 'FluxCloud docs: components and container data',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
  ],
  terms: ['container-data', 'primary-standby', 'syncthing', 'marketplace'],
};

export default lesson;
