/**
 * Content of /reference/networking: how a request reaches a container, the port rules, internal DNS,
 * generated and custom domains, the load balancer and the environment Flux sets up.
 *
 * Sources are FACTS.md sections 3.4 and 3.8 (ports and names), 6.3 and 6.4 (health and the domain manager)
 * and 8 (networking). Limits and port lists come from the engine; timings of the domain manager come
 * from `facts.ts`.
 */

import {
  BANNED_PORT_RANGES,
  BUNDLE_INSTANCES,
  derivedNames,
  type FluxAppSpec,
  knownImage,
  LIMITS,
  type PortRange,
} from '@shared/flux';
import {
  andList,
  bannedRangeOf,
  feePortsText,
  feePortUsd,
  feeRangeOf,
  perInstanceFee,
  rangeText,
  sortedRanges,
  usd,
} from './derive';
import { FEE_PORT_EXAMPLES, NETWORK_EXAMPLE } from './examples';
import { BANNED_PORT_NOTES, FDM, NODE, NODE_API } from './facts';
import type { FactRow, Provenance, TroubleRow } from './types';

// ---------------------------------------------------------------------------
// The request path
// ---------------------------------------------------------------------------

export interface PathStep {
  id: string;
  title: string;
  /** Markup. */
  text: string;
  prov: readonly Provenance[];
}

/** FACTS 6.4 and 8.1: from a visitor's browser to your process. */
export function buildRequestPath(): PathStep[] {
  return [
    {
      id: 'dns',
      title: 'The visitor looks up your name',
      text: '`<name>.app.runonflux.io` is a CNAME to a load balancer of the Flux Domain Manager, so every app name resolves with no DNS record from you.',
      prov: ['source', 'live'],
    },
    {
      id: 'tls',
      title: 'The load balancer ends HTTPS',
      text: `The domain manager runs HAProxy. It holds a wildcard certificate for the app domains, answers on ports ${FDM.httpPort} and ${FDM.httpsPort}, and speaks plain HTTP to the node.`,
      prov: ['source'],
    },
    {
      id: 'pick',
      title: 'It picks an instance',
      text: `Round robin across the instances that pass its port check. With more than one instance a cookie pins a client to one instance for up to ${FDM.stickyHours} hours.`,
      prov: ['source'],
    },
    {
      id: 'node',
      title: 'The request lands on the public port',
      text: 'The node publishes `ports[i]` on its own address, for TCP and for UDP.',
      prov: ['source'],
    },
    {
      id: 'docker',
      title: 'Docker forwards it into the app',
      text: 'Docker sends it to `containerPorts[i]` on the container, over the private network of the app.',
      prov: ['source'],
    },
    {
      id: 'process',
      title: 'Your process answers',
      text: 'Only when it listens on `0.0.0.0` on that port. A process bound to `127.0.0.1` or `localhost` accepts nothing from outside its own container.',
      prov: ['source', 'inference'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

/** FACTS 3.4 and 8.1. Every limit is read from the engine. */
export function buildPortFacts(): FactRow[] {
  const P = LIMITS.ports;
  return [
    {
      id: 'mapping',
      label: 'Mapping',
      text: '`ports[i]` is the public port on the node. `containerPorts[i]` is the port inside the container. Traffic to the first is delivered to the second, for both TCP and UDP.',
      prov: ['source'],
    },
    {
      id: 'range',
      label: 'Public range',
      text: `${P.min} to ${P.max}, minus the banned list. At most ${P.perComponentMax} public ports per component, each unique across every component of the app and free on the node.`,
      prov: ['source'],
    },
    {
      id: 'container-range',
      label: 'Container range',
      text: `${P.containerMin} to ${P.containerMax}, and the same number of entries as \`ports\`.`,
      prov: ['source'],
    },
    {
      id: 'fee',
      label: 'Fee ports',
      text: `${feePortsText()} are accepted and are fee ports. Each adds ${usd(feePortUsd())} to the monthly bundle, which is divided by ${BUNDLE_INSTANCES} and billed per instance, so it costs ${perInstanceFee(feePortUsd())} and grows with the instance count. They are not restricted to enterprise apps, and port ${FEE_PORT_EXAMPLES.web} on the app is not special.`,
      prov: ['source', 'live'],
    },
    {
      id: 'docs',
      label: 'What the docs say',
      text: `FluxCloud's docs say exposed ports must be between ${P.privilegedBelow} and ${P.max}. That is a recommendation of the form, not a rule of the network.`,
      prov: ['docs', 'source'],
    },
    {
      id: 'reach',
      label: 'Direct access',
      text: 'Any instance answers on its own node address and public port, for example `http://<node-ip>:<port>`. The nodes are listed by `GET /apps/location/<name>`.',
      prov: ['source', 'live'],
    },
    {
      id: 'port-test',
      label: 'Port tests',
      text: "Nodes test each other's published ports every hour. An app whose port is not reachable puts the node in a DOS state and the instance is removed.",
      prov: ['source', 'unverified'],
    },
  ];
}

export interface BannedRow {
  id: string;
  range: PortRange;
  /** "16100 to 16299" or "22". */
  text: string;
  /** How many public ports the entry covers. */
  count: number;
  /** The standard use of the port, or an empty string when the sources give no reason. */
  usedFor: string;
}

/** The banned list in ascending order with what each entry is usually used for. FACTS 3.4. */
export function buildBannedRows(): BannedRow[] {
  return sortedRanges(BANNED_PORT_RANGES).map((range) => ({
    id: `banned-${range.from}`,
    range,
    text: rangeText(range),
    count: range.to - range.from + 1,
    usedFor: BANNED_PORT_NOTES[range.from] ?? '',
  }));
}

export interface PortCheck {
  input: string;
  /** The number, or null when the input is empty or not an integer. */
  port: number | null;
  status: 'empty' | 'not-integer' | 'out-of-range' | 'banned' | 'fee' | 'free';
  banned: PortRange | null;
  fee: PortRange | null;
  /** The lint codes that fire for this port. */
  lint: readonly string[];
  /** One plain sentence. */
  summary: string;
}

/** What the validator and the price calculator do with one public port. */
export function checkPublicPort(input: string): PortCheck {
  const raw = input.trim();
  const blank: PortCheck = {
    input,
    port: null,
    status: 'empty',
    banned: null,
    fee: null,
    lint: [],
    summary: 'Type a public port to see what the network does with it.',
  };
  if (raw === '') return blank;
  const value = Number(raw);
  if (!/^-?\d+(\.\d+)?$/.test(raw) || !Number.isFinite(value) || !Number.isInteger(value)) {
    return {
      ...blank,
      status: 'not-integer',
      lint: ['PORT_NOT_INTEGER'],
      summary: 'A port is a whole number. The network refuses anything else.',
    };
  }
  const P = LIMITS.ports;
  if (value < P.min || value > P.max) {
    return {
      ...blank,
      port: value,
      status: 'out-of-range',
      lint: ['PORT_RANGE'],
      summary: `A public port is ${P.min} to ${P.max}. ${value} is outside it.`,
    };
  }
  const banned = bannedRangeOf(value);
  if (banned) {
    return {
      ...blank,
      port: value,
      status: 'banned',
      banned,
      lint: ['PORT_BANNED'],
      summary: `The network refuses ${value}: it is on the banned list (${rangeText(banned)}). Publish another port and keep ${value} as the container port.`,
    };
  }
  const fee = feeRangeOf(value);
  if (fee) {
    return {
      ...blank,
      port: value,
      status: 'fee',
      fee,
      lint: ['PORT_FEE'],
      summary: `Accepted, but it is a fee port (${rangeText(fee)}). It adds ${usd(feePortUsd())} to the monthly bundle, ${perInstanceFee(feePortUsd())}, and the extra grows with the instance count. Publish a port outside ${feePortsText()} to avoid it.`,
    };
  }
  return {
    ...blank,
    port: value,
    status: 'free',
    summary: `Accepted, with no fee. It must still be unique in the app and free on the node.`,
  };
}

export interface ContainerPortCheck {
  input: string;
  port: number | null;
  status: 'empty' | 'invalid' | 'privileged' | 'ok';
  lint: readonly string[];
  summary: string;
}

/** What the validator thinks of one container port. FACTS 3.3 and the linter's PORT_PRIVILEGED_CONTAINER. */
export function checkContainerPort(input: string): ContainerPortCheck {
  const raw = input.trim();
  const P = LIMITS.ports;
  if (raw === '') {
    return {
      input,
      port: null,
      status: 'empty',
      lint: [],
      summary: 'Type the port your process listens on.',
    };
  }
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || value < P.containerMin || value > P.containerMax) {
    return {
      input,
      port: Number.isFinite(value) ? value : null,
      status: 'invalid',
      lint: ['CONTAINER_PORT_RANGE'],
      summary: `A container port is a whole number from ${P.containerMin} to ${P.containerMax}.`,
    };
  }
  if (value < P.privilegedBelow) {
    return {
      input,
      port: value,
      status: 'privileged',
      lint: ['PORT_PRIVILEGED_CONTAINER'],
      summary: `Accepted. Some images need root to listen below ${P.privilegedBelow}. Flux does not enforce it and many images work, so check yours. A high port inside the container is the safe choice, and the public port can be anything.`,
    };
  }
  return {
    input,
    port: value,
    status: 'ok',
    lint: [],
    summary: 'Accepted. The process has to listen on exactly this port, on 0.0.0.0.',
  };
}

// ---------------------------------------------------------------------------
// Names derived from a spec
// ---------------------------------------------------------------------------

export interface PairingRow {
  component: string;
  /** Position inside the component's `ports`. */
  index: number;
  publicPort: number;
  containerPort: number;
  /** The raw `domains[i]`. */
  domainEntry: string;
  customDomains: readonly string[];
  generatedDomain: string;
  /** `<app>.app.runonflux.io` also reaches this port. */
  appDomain: string | null;
  fee: boolean;
}

/** One row per public port: how `ports`, `containerPorts` and `domains` line up. FACTS 6.4 and 8.1. */
export function buildPairingRows(spec: FluxAppSpec): PairingRow[] {
  const names = derivedNames(spec);
  const rows: PairingRow[] = [];
  const seen = new Map<string, number>();
  for (const p of names.ports) {
    const index = seen.get(p.component) ?? 0;
    seen.set(p.component, index + 1);
    const comp = spec.compose.find((c) => c.name === p.component);
    rows.push({
      component: p.component,
      index,
      publicPort: p.port,
      containerPort: p.containerPort,
      domainEntry: comp?.domains[index] ?? '',
      customDomains: p.customDomains,
      generatedDomain: p.generatedDomain,
      appDomain: p.isFirst ? names.appDomain : null,
      fee: feeRangeOf(p.port) !== null,
    });
  }
  return rows;
}

export interface InternalRow {
  component: string;
  /** `flux<component>_<app>` */
  containerName: string;
  hostname: string;
  /** True when the component has a public port. */
  published: boolean;
  /** The port another component dials, or null when nothing in the spec or the image tells. */
  port: number | null;
  /** Where `port` comes from. */
  portSource: 'containerPorts' | 'image' | 'unknown';
  /** `containerName:port` */
  address: string | null;
}

/** How each component is reached from the others. FACTS 8.2 and 3.8. */
export function buildInternalRows(spec: FluxAppSpec): InternalRow[] {
  const names = derivedNames(spec);
  return names.components.map((c) => {
    const comp = spec.compose.find((x) => x.name === c.name);
    const fromSpec = comp?.containerPorts[0];
    const fromImage = comp ? knownImage(comp.repotag)?.defaultPort : undefined;
    const port = fromSpec ?? fromImage ?? null;
    return {
      component: c.name,
      containerName: c.containerName,
      hostname: c.hostname,
      published: (comp?.ports.length ?? 0) > 0,
      port,
      portSource: fromSpec !== undefined ? 'containerPorts' : fromImage !== undefined ? 'image' : 'unknown',
      address: port === null ? null : `${c.containerName}:${port}`,
    };
  });
}

/** FACTS 8.2: facts about the private network of an app. */
export function buildInternalFacts(): FactRow[] {
  return [
    {
      id: 'network',
      label: 'One network per app',
      text: 'Each app gets its own Docker bridge network, `fluxDockerNetwork_<app>`. Every component is attached to it with an address assigned by Flux.',
      prov: ['source'],
    },
    {
      id: 'names',
      label: 'How to address a component',
      text: 'By container name, `flux<component>_<app>`, for example `fluxmysql_mysql01`. Docker resolves it inside the network.',
      prov: ['source', 'docs'],
    },
    {
      id: 'hostname',
      label: 'The bare component name',
      text: "The bare component name is the container's own hostname. It is not a documented way to reach another component.",
      prov: ['source'],
    },
    {
      id: 'port',
      label: 'Which port to use',
      text: 'The container port, over the private network. The public port is for the outside. A component that publishes nothing is unreachable from outside the app, which is what you want for a database.',
      prov: ['source', 'inference'],
    },
    {
      id: 'outbound',
      label: 'Outbound traffic',
      text: 'Containers reach the internet through the bridge. No outbound firewall code was found in the node source, but this was not tested on a live app.',
      prov: ['source', 'unverified'],
    },
  ];
}

/** FACTS 8.2: linking two apps of the same owner. */
export function buildLinkFacts(): FactRow[] {
  return [
    {
      id: 'token',
      label: 'The token',
      text: 'Put `networkWith:[appA,appB]` in the app `description`. The brackets are required and the names are separated by commas.',
      prov: ['source'],
    },
    {
      id: 'rule',
      label: 'The rule',
      text: 'Before install the node checks that every named app is installed on the same node with the same owner, then attaches the containers to those networks so they can reach `flux<component>_<linkedApp>`.',
      prov: ['source'],
    },
    {
      id: 'failure',
      label: 'When it fails',
      text: 'The install fails when a linked app is not on that node. There is no spec field for it: the link is a feature of one node.',
      prov: ['source'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

/** FACTS 6.4 and 3.8: generated domain patterns. */
export function buildGeneratedDomainFacts(): FactRow[] {
  const suffix = LIMITS.appDomainSuffix;
  return [
    {
      id: 'app-domain',
      label: 'The app domain',
      text: `\`<name>.${suffix}\`, with the name in lower case. It serves the first public port of the app.`,
      prov: ['source', 'live'],
    },
    {
      id: 'port-domain',
      label: 'One per port',
      text: `\`<name>_<port>.${suffix}\`, where \`<port>\` is the public port, \`ports[i]\`, and never the container port. There is one for every port of every component.`,
      prov: ['source'],
    },
    {
      id: 'hyphen',
      label: 'The hyphen form',
      text: `The docs show \`your-app-9001.${suffix}\` for webhook examples. The domain manager source only generates the underscore form. Treat the hyphen form as unverified.`,
      prov: ['docs', 'unverified'],
    },
    {
      id: 'front-doors',
      label: 'What answers',
      text: `HTTP on ${FDM.httpPort}, redirected to HTTPS on ${FDM.httpsPort}. A visitor never uses the public port in the address: the load balancer sends the request to it for you.`,
      prov: ['source'],
    },
    {
      id: 'tls',
      label: 'TLS',
      text: 'One wildcard certificate covers the app domains. The load balancer ends TLS and speaks plain HTTP to the node.',
      prov: ['source'],
    },
  ];
}

export interface DomainStep {
  id: string;
  title: string;
  /** Markup. */
  text: string;
  prov: readonly Provenance[];
}

/** FACTS 6.4 and 9.7: the steps of a custom domain. */
export function buildCustomDomainSteps(): DomainStep[] {
  const suffix = LIMITS.appDomainSuffix;
  return [
    {
      id: 'spec',
      title: 'Put the domain in the spec',
      text: 'Write it in `domains[i]`, the entry at the same position as the public port it should serve. Several domains for one port go in the same string, separated by commas.',
      prov: ['source'],
    },
    {
      id: 'clean',
      title: 'Know what the domain manager does with it',
      text: `It strips \`http://\` and \`https://\`, ignores any entry that ends in \`${suffix}\`, and also serves \`www.\` and \`test.\` in front of the domain.`,
      prov: ['source'],
    },
    {
      id: 'dns',
      title: 'Point DNS at the app',
      text: `Create a CNAME from your domain to \`<name>.${suffix}\`. An A record to the addresses of the load balancers also works, because the domain manager reads the A answer.`,
      prov: ['docs', 'source'],
    },
    {
      id: 'cert',
      title: 'Let it issue the certificate',
      text: `The domain manager requests a Let's Encrypt certificate with an HTTP-01 challenge once the domain resolves to its load balancers. Until then it skips the domain and tries again later. It renews when fewer than ${FDM.certRenewBelowDays} days are left.`,
      prov: ['source'],
    },
  ];
}

/** FACTS 6.4: Cloudflare and the bare domain. */
export function buildDnsNotes(): FactRow[] {
  return [
    {
      id: 'apex',
      label: 'A bare domain',
      text: 'A name like `example.com` cannot hold a CNAME at many DNS providers. Use a subdomain such as `www.example.com`, or an ALIAS or ANAME record, or an A record.',
      prov: ['inference'],
    },
    {
      id: 'proxy',
      label: 'Cloudflare proxy on',
      text: "The docs tell you to turn the orange cloud on. Then your domain resolves to Cloudflare, so the domain manager sees a domain that is not pointed at it and issues no certificate. Cloudflare's own certificate serves your visitors.",
      prov: ['docs', 'source'],
    },
    {
      id: 'ssl-mode',
      label: 'Cloudflare SSL mode',
      text: `Port ${FDM.httpPort} on the load balancer redirects to HTTPS, so the Flexible mode can loop. Use Full. This is inference from the redirect, not a tested setup.`,
      prov: ['inference', 'unverified'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Load balancing and health
// ---------------------------------------------------------------------------

/** FACTS 6.4 and 6.5: how the load balancer treats your instances. */
export function buildLoadBalancingFacts(): FactRow[] {
  const failSec = FDM.ejectSec;
  return [
    {
      id: 'balance',
      label: 'Balancing',
      text: `Round robin across the instances. With more than one instance the \`${FDM.stickyCookie}\` cookie pins a client to one instance for up to ${FDM.stickyHours} hours. A failed request is retried up to ${FDM.retries} times on another instance.`,
      prov: ['source'],
    },
    {
      id: 'check',
      label: 'Port check',
      text: `A TCP connect to the instance port every ${FDM.healthIntervalSec} seconds. Two failures take an instance out, two successes bring it back: about ${failSec} seconds each way.`,
      prov: ['source'],
    },
    {
      id: 'timeouts',
      label: 'Timeouts',
      text: `Request ${FDM.requestTimeoutSec} s, server ${FDM.serverTimeoutSec} s (${FDM.syncedServerTimeoutSec} s for apps with a synced volume), client ${FDM.clientTimeoutSec} s, connect ${FDM.connectTimeoutSec} s.`,
      prov: ['source'],
    },
    {
      id: 'primary',
      label: 'Primary and standby',
      text: `An app with a \`g:\` volume is in TCP mode for every port of every component, and its backend lists only the elected primary: the standby nodes are not in it at all. The domain manager moves away from the primary only after at least ${FDM.failoverFailedChecks} failed checks in a row and ${FDM.failoverUnhealthySec} seconds of unhealthiness, and the node-side election adds minutes (it runs every ${FDM.gElectionSec} seconds and a standby waits about ${FDM.gStandbyMinPerPlace} minutes for each place in the order). A failover takes minutes, not seconds.`,
      prov: ['source'],
    },
    {
      id: 'cors',
      label: 'CORS',
      text: 'The load balancer adds `Access-Control-Allow-Origin: *` when your app did not.',
      prov: ['source'],
    },
    {
      id: 'websocket',
      label: 'WebSockets',
      text: `No tunnel timeout is set on app backends, so an idle connection falls back to the ${FDM.clientTimeoutSec} second client timeout. This is read from the configuration and was not observed in practice.`,
      prov: ['source', 'unverified'],
    },
    {
      id: 'failover',
      label: 'When a node dies',
      text: `The load balancer drops the instance in about ${failSec} seconds. A replacement copy can take about two hours after a node dies (${NODE.locationTtlMin} minutes plus the image pull), and up to about ${NODE.syncedExtraWaitMin} minutes more for a synced-storage app. Size the app so the instances that are left carry the load.`,
      prov: ['source'],
    },
  ];
}

/** FACTS 6.4 and 8.1: traffic that is not HTTP. */
export function buildNonHttpFacts(): FactRow[] {
  return [
    {
      id: 'front',
      label: 'The front doors',
      text: `The load balancer answers HTTP and HTTPS, on ${FDM.httpPort} and ${FDM.httpsPort}. An app with a \`g:\` volume (every port of every component) and a short list of named game and chain apps also get a TCP frontend on their own public port, routed to the primary. The HTTP address stays, except for Minecraft-named apps. Ports ${FDM.httpPort} and ${FDM.httpsPort} are never forwarded as TCP. Whether the production load balancers accept connections on every such port was read from the template and not probed.`,
      prov: ['source'],
    },
    {
      id: 'direct',
      label: 'Everything else',
      text: 'A game server, a database or any raw TCP or UDP service is reached by node address and public port. List the nodes with `GET /apps/location/<name>`.',
      prov: ['source', 'live'],
    },
    {
      id: 'note',
      label: 'What that means',
      text: 'A client of a raw protocol connects to one node. It has no failover of its own: your client or a DNS name you manage has to pick another node when it fails.',
      prov: ['inference'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** FACTS 8.3 and 8.2: what Flux puts in the container's environment, and what it does not. */
export function buildEnvironmentFacts(): FactRow[] {
  const E = LIMITS.environment;
  return [
    {
      id: 'format',
      label: 'Format',
      text: `\`KEY=value\` strings. At most ${E.maxCount} per component and ${E.maxLength} characters each.`,
      prov: ['source'],
    },
    {
      id: 'injected',
      label: 'Set by Flux',
      text: '`FLUX_APP_NAME` is the app name and `FLUX_NODE_HOST_IP` is the public address of the node. They are appended last and win over a variable of the same name.',
      prov: ['source'],
    },
    {
      id: 'absent',
      label: 'Not set',
      text: 'There is no node id, no instance number and no port map. Ask the host service if you need node data.',
      prov: ['source'],
    },
    {
      id: 'host',
      label: 'The host service',
      text: `Containers can reach \`http://fluxnode.service:${NODE.hostServicePort}/hostinfo\`, which maps to \`${NODE.hostServiceIp}\`. It returns the node's public address, its location and benchmark data and the name of the calling app, and only answers inside Flux app containers.`,
      prov: ['source'],
    },
    {
      id: 'visibility',
      label: 'Who can read them',
      text: 'In a public app every variable and command is public: anyone can read them at `/apps/appspecifications/<name>`. Use an enterprise app for secrets.',
      prov: ['docs', 'live'],
    },
    {
      id: 'markers',
      label: 'Reserved entries',
      text: '`F_S_ENV=` and `F_S_CMD=` load variables or commands from an `https://storage.runonflux.io` link. `LOG=COLLECT` on one component and `LOG=SEND` on the others ship container logs to the collector inside the app.',
      prov: ['source'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Node ports
// ---------------------------------------------------------------------------

/** The ports FluxOS itself uses on a node, which is why the 16100 range is banned. FACTS 10.1. */
export function nodeApiPorts(): { default: number; all: readonly number[]; text: string } {
  return {
    default: NODE_API.defaultPort,
    all: NODE_API.ports,
    text: andList(NODE_API.ports.map(String)),
  };
}

// ---------------------------------------------------------------------------
// What goes wrong
// ---------------------------------------------------------------------------

function exampleAddress(component: string): string {
  const row = buildInternalRows(NETWORK_EXAMPLE).find((r) => r.component === component);
  return row?.address ?? `flux${component}_<app>:<port>`;
}

/** FACTS 11 rows 1, 2, 3, 8, 27, 28, 30. */
export function buildNetworkTrouble(): TroubleRow[] {
  return [
    {
      id: 'wrong-container-port',
      symptom: 'The app is running but the address answers 502 or 503, or resets.',
      cause:
        'Docker forwards to `containerPorts[i]`. Your process listens on another port, often because the image changed its default.',
      fix: 'Set `containerPorts` to the port the process really listens on. `ports` can be any free public port.',
      lint: ['PORT_ENV_MISMATCH', 'CONTAINER_PORT_UNUSUAL'],
      prov: ['source'],
    },
    {
      id: 'localhost-bind',
      symptom: 'It works with `docker run` on your machine and is refused or empty on Flux.',
      cause:
        "The process listens on `127.0.0.1` or `localhost`. Published ports reach the container's bridge address, not its loopback.",
      fix: 'Bind to `0.0.0.0`, for example `--host 0.0.0.0` or `HOST=0.0.0.0`.',
      lint: ['BIND_LOCALHOST'],
      prov: ['source', 'inference'],
    },
    {
      id: 'container-port-in-url',
      symptom: '`<name>_80.app.runonflux.io` does not resolve.',
      cause: 'The per port domains use the public port, `ports[i]`, and not the container port.',
      fix: 'Use `<name>_<public port>.app.runonflux.io`, or `<name>.app.runonflux.io` for the first port.',
      lint: [],
      prov: ['source'],
    },
    {
      id: 'banned-or-clash',
      symptom: `"Assigned port ${rangeText(sortedRanges(BANNED_PORT_RANGES)[0] ?? { from: 0, to: 0 })} is not allowed for Flux Apps", or "must have unique ports specified accross all composition".`,
      cause: 'The public port is on the banned list, or two components use the same public port.',
      fix: 'Pick another public port and give every component its own. The container can still listen on a banned number.',
      lint: ['PORT_BANNED', 'PORT_DUPLICATE'],
      prov: ['source'],
    },
    {
      id: 'fee-surprise',
      symptom: 'The quote is higher than you expected.',
      cause: `Public ports ${feePortsText()} are fee ports. Each adds ${usd(feePortUsd())} to the monthly bundle, which is divided by ${BUNDLE_INSTANCES} and billed per instance (${perInstanceFee(feePortUsd())}), so the extra grows with the instance count.`,
      fix: `Publish a port outside ${feePortsText()} and map it with \`containerPorts\`.`,
      lint: ['PORT_FEE'],
      prov: ['source', 'live'],
    },
    {
      id: 'database-public',
      symptom: 'A database answers from the internet.',
      cause: 'Its port is in `ports`. Everything in `ports` is open to the world.',
      fix: 'Remove the port. Other components of the app reach the database by container name without it.',
      lint: ['DATABASE_PORT_PUBLIC'],
      prov: ['source', 'inference'],
    },
    {
      id: 'wrong-hostname',
      symptom: 'The API cannot find the database by the name `db`.',
      cause: 'Another component is addressed by its container name, `flux<component>_<app>`.',
      fix: `Use \`flux<component>_<app>\` and the container port, for example \`${exampleAddress('db')}\`.`,
      lint: [],
      prov: ['source', 'docs'],
    },
    {
      id: 'custom-domain-cert',
      symptom: 'The browser shows a certificate warning on your own domain.',
      cause:
        'The domain is not in `domains[i]`, or it does not point at the app yet, or it is proxied and the mode is wrong.',
      fix: 'List the domain, create the CNAME to `<name>.app.runonflux.io`, and give DNS time. With a Cloudflare proxy, Full is the likely mode, but that is an inference and was not tested.',
      lint: ['DOMAIN_FORMAT', 'DOMAIN_APEX', 'DOMAIN_IS_GENERATED'],
      prov: ['source', 'inference', 'unverified'],
    },
    {
      id: 'non-http',
      symptom: 'A game or database protocol fails on `<name>.app.runonflux.io`.',
      cause: 'The generated domain is served by an HTTP load balancer.',
      fix: 'Connect to a node address and the public port. List the nodes with `GET /apps/location/<name>`.',
      lint: [],
      prov: ['source'],
    },
  ];
}
