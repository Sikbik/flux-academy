/**
 * The reference topics: their names, leads, art and the sections of each page.
 *
 * The section ids are the element ids and URL fragments (`/reference/spec#component-ports`). The page
 * components render exactly these sections in this order, and a test checks that the rendered ids match.
 * Headings equal the page titles in `shared/site.ts`.
 */

import { SPEC_VERSION } from '@shared/flux';
import type { SectionMeta, TopicId, TopicMeta } from './types';

const s2 = (id: string, title: string, summary: string, keywords: readonly string[] = []): SectionMeta => ({
  id,
  title,
  summary,
  keywords,
  level: 2,
});

const s3 = (id: string, title: string, summary: string, keywords: readonly string[] = []): SectionMeta => ({
  id,
  title,
  summary,
  keywords,
  level: 3,
});

export const SPEC_SECTIONS: readonly SectionMeta[] = [
  s2(
    'at-a-glance',
    'At a glance',
    `The shape of a version ${SPEC_VERSION} spec, its size caps and the mistakes that cause most refusals.`,
    ['overview', 'summary', 'limits', 'caps'],
  ),
  s2(
    'annotated-example',
    'An annotated example',
    'A real spec from the Academy fixtures: hover or focus a field to read what it does.',
    ['example', 'json', 'sample', 'fixture'],
  ),
  s2(
    'app-fields',
    'Top level fields',
    'The top level keys of an app spec: type, whether required, default, limits and the lint codes that guard each.',
    ['version', 'name', 'owner', 'instances', 'contacts', 'staticip', 'datacenter'],
  ),
  s2(
    'component-fields',
    'Component fields',
    'The keys of one component: image, ports, domains, environment, commands, data and resources.',
    ['compose', 'repotag', 'ports', 'containerPorts', 'domains', 'cpu', 'ram', 'hdd', 'repoauth'],
  ),
  s2(
    'geolocation',
    'Geolocation grammar',
    'The entries that allow or deny continents, countries and regions, with a parser you can try.',
    ['placement', 'continent', 'country', 'region', 'deny', 'allow', 'acEU'],
  ),
  s3('geolocation-forms', 'The forms', 'Every accepted form of a geolocation entry and what it means.', [
    'acALL',
    'a!c',
    'legacy',
  ]),
  s3('geolocation-try', 'Try an entry', 'Parse entries and check whether a node in a place would qualify.', [
    'parser',
    'qualify',
    'node',
  ]),
  s2(
    'container-data',
    'containerData grammar',
    'The mount definitions that keep data, each prefix and what it guarantees.',
    ['volume', 'persistent', 'storage', 'mount', 'sync', 'syncthing', 'r:', 'g:', 's:'],
  ),
  s3(
    'container-data-forms',
    'The forms',
    'Every mount form: primary, extra directory, file and another component.',
    ['m:', 'ml:', 'f:', 'c:', 'cf:'],
  ),
  s3(
    'container-data-guarantees',
    'What each prefix guarantees',
    'Where the data lives, and whether it survives a restart or the loss of a node.',
    ['survive', 'restart', 'node loss', 'consistency', 'primary', 'standby'],
  ),
  s3(
    'container-data-mechanics',
    'Limits and mechanics',
    'How big the volume is, what a redeploy keeps, and what permissions to expect.',
    ['hdd', 'size', 'ENOSPC', 'soft redeploy', 'hard redeploy', 'permissions', 'backup'],
  ),
  s3('container-data-try', 'Try a value', 'Parse a containerData string the way the node does.', [
    'parser',
    'mount',
  ]),
  s2(
    'nodes-and-enterprise',
    'nodes, enterprise and datacenter',
    'Pinning nodes, encrypted apps and data center nodes: who may use them and what they cost.',
    ['pin', 'pinned', 'enterprise', 'encrypted', 'arcaneos', 'datacenter', 'secrets', 'private image'],
  ),
  s2(
    'expire',
    'expire and blocks',
    'How a subscription is counted in blocks, the arithmetic, and what happens at the end.',
    ['subscription', 'blocks', 'renew', 'cancel', 'month', 'duration', 'time'],
  ),
  s2(
    'pricing',
    'How the price is made',
    'The pricing formula in plain language, the rates, and a worked example computed live.',
    ['price', 'cost', 'quote', 'usd', 'flux', 'formula', 'discount', 'minimum', 'rounding'],
  ),
  s3('pricing-steps', 'The steps', "The calculator's steps in the order it applies them.", ['formula']),
  s3(
    'pricing-example',
    'A worked example',
    'Pick a size, instances and months and read the itemised price.',
    ['calculator', 'example'],
  ),
  s3(
    'pricing-curve',
    'The price curve',
    'What one to a hundred instances cost for three sizes, checked against the live calculator.',
    ['instances', 'cliff', 'four instances'],
  ),
  s2(
    'validate',
    'Validate your spec',
    'Paste a spec and read what the linter says. Nothing is sent anywhere.',
    ['lint', 'check', 'linter', 'errors', 'warnings', 'paste'],
  ),
  s2(
    'versions',
    'Version history',
    `Spec versions 1 to ${SPEC_VERSION}: the block each was enforced from and what it added.`,
    ['v8', 'v7', 'tiered', 'secrets', 'history', 'block'],
  ),
  s2(
    'lint-codes',
    'Lint codes',
    'Every code the linter can raise: severity, why it matters, how to fix it and the field it guards.',
    ['error', 'warning', 'info', 'code', 'message', 'fix'],
  ),
];

export const NETWORKING_SECTIONS: readonly SectionMeta[] = [
  s2(
    'request-path',
    'How a request reaches your container',
    "The path of one request, from the visitor's DNS lookup to your process.",
    ['flow', 'diagram', 'haproxy', 'fdm', 'docker'],
  ),
  s2(
    'ports',
    'Ports',
    'Public ports, container ports, fee ports, banned ports and how domains pair with them.',
    ['ports', 'containerPorts', 'publish', 'expose'],
  ),
  s3(
    'public-and-container-ports',
    'Public and container ports',
    'What ports and containerPorts mean and the rules for each.',
    ['mapping', 'tcp', 'udp', 'range'],
  ),
  s3('fee-ports', 'Fee ports', 'The public ports that cost extra and how to avoid the fee.', [
    'surcharge',
    'enterprise ports',
    '80',
    '8080',
    '443',
    'usd 2',
  ]),
  s3('banned-ports', 'Banned ports', 'The public ports the network refuses, and what each is usually for.', [
    '22',
    'ssh',
    '16100',
    'reserved',
    'blocked',
  ]),
  s3(
    'domains-and-ports',
    'How domains pairs with ports',
    'domains has one entry per public port, in the same order.',
    ['domains', 'custom domain', 'index', 'alignment'],
  ),
  s3(
    'check-a-port',
    'Check a port',
    'Type a public port and a container port and see what the network does with them.',
    ['checker', 'validate', 'tool'],
  ),
  s2(
    'internal-dns',
    'Internal DNS',
    'How components reach each other: container names and the private network.',
    ['fluxdb', 'container name', 'flux<component>_<app>', 'fluxDockerNetwork', 'hostname', 'database'],
  ),
  s2('generated-domains', 'Generated domains', 'The addresses Flux creates for every app and every port.', [
    'app.runonflux.io',
    'subdomain',
    'url',
    'address',
    'underscore',
  ]),
  s2(
    'custom-domains',
    'Custom domains',
    'Put your own domain in front of an app: the spec entry, the DNS record, the certificate.',
    ['dns', 'cname', 'cloudflare', 'certificate', 'tls', 'https', 'lets encrypt', 'apex'],
  ),
  s2(
    'load-balancing',
    'Load balancing and health',
    'How the domain manager spreads traffic, checks your port and treats failures.',
    ['haproxy', 'round robin', 'sticky', 'cookie', 'timeout', 'health', 'failover', 'cors', 'websocket'],
  ),
  s2(
    'non-http',
    'Traffic that is not HTTP',
    'Games, databases and other protocols: how clients reach them.',
    ['tcp', 'udp', 'minecraft', 'game server', 'node ip'],
  ),
  s2(
    'environment',
    'Environment and the host service',
    'The variables Flux sets, the ones it does not, and the service every container can ask.',
    ['FLUX_APP_NAME', 'FLUX_NODE_HOST_IP', 'fluxnode.service', 'hostinfo', 'env', 'variables'],
  ),
  s2('linking-apps', 'Linking apps', 'Reach another app of yours on the same node with networkWith.', [
    'networkWith',
    'cross app',
    'link',
  ]),
  s2(
    'networking-trouble',
    'What goes wrong',
    'The networking mistakes that cause most failures, with the lint code that catches each.',
    ['502', '503', 'refused', 'troubleshooting'],
  ),
];

export const DOCKER_SECTIONS: readonly SectionMeta[] = [
  s2(
    'image-names',
    'Image names and tags',
    'How an image is named, why to pin the tag, and what latest costs.',
    ['repotag', 'tag', 'latest', 'pin', 'digest', 'docker hub'],
  ),
  s3('pin-tags', 'Pin the tag', 'What a moving tag costs and what to pin instead.', [
    'latest',
    'recheck',
    'redeploy',
    'sha256',
  ]),
  s3('try-an-image', 'Try an image name', 'Parse an image reference and see what the linter says.', [
    'parser',
    'tool',
  ]),
  s2(
    'architecture',
    'Architecture',
    'amd64 and arm64: what the network accepts and the Apple silicon trap.',
    ['amd64', 'arm64', 'apple silicon', 'buildx', 'platform', 'arcaneos'],
  ),
  s2(
    'registries',
    'Registries and private images',
    'Where images come from, repoauth, and what is blocked.',
    ['registry', 'ghcr', 'repoauth', 'private', 'ecr', 'acr', 'gar', 'blocklist', 'docker.io'],
  ),
  s2(
    'size-and-startup',
    'Image size and startup time',
    'The size limit, what dominates install time, and what happens when the container crashes.',
    ['size', 'slim', '5 GB', 'pull', 'startup', 'crash', 'restart', 'backoff', 'multi stage'],
  ),
  s2(
    'binding',
    'Bind 0.0.0.0, not localhost',
    'Why a server must listen on every interface, with the setting for common runtimes.',
    ['0.0.0.0', 'localhost', '127.0.0.1', 'bind', 'host', 'listen'],
  ),
  s2(
    'environment-variables',
    'Environment variables and commands',
    'How environmentParameters and commands reach the process, what Flux adds and who can read them.',
    ['env', 'environmentParameters', 'commands', 'cmd', 'entrypoint', 'secret', 'FLUX_APP_NAME', 'KEY=value'],
  ),
  s2(
    'users-and-permissions',
    'Users and volume permissions',
    'Running as a non-root user, the privileged port range and who owns the volume.',
    ['non-root', 'USER', 'chown', 'permission denied', 'privileged'],
  ),
  s2('logs', 'Logs', 'Where to write them, how much is kept and how to ship them.', [
    'stdout',
    'stderr',
    'log',
    'json-file',
    'LOG=COLLECT',
    'LOG=SEND',
  ]),
  s2('health', 'Health and restarts', 'What Flux checks, what it ignores and how restarts back off.', [
    'healthcheck',
    'restart',
    'crash loop',
    'unhealthy',
    'exit',
  ]),
  s2('stateless', 'Design for a stateless app', 'Why any instance can go away and where state belongs.', [
    'stateless',
    'state',
    'session',
    'replica',
    'twelve factor',
    'rootfs',
  ]),
  s2(
    'common-images',
    'Common images',
    'What the linter knows about familiar images: port, data folder and memory.',
    ['postgres', 'mysql', 'redis', 'mongodb', 'nginx', 'minecraft', 'default port'],
  ),
  s2(
    'dockerfiles',
    'Dockerfile patterns',
    'Two Dockerfiles to copy, each with the matching component of the spec.',
    ['dockerfile', 'multi stage', 'node', 'nginx', 'static site'],
  ),
  s3(
    'dockerfile-web-app',
    'A web app',
    'A multi stage build for a Node server that binds 0.0.0.0 and runs as a user.',
    ['node', 'express', 'USER node', 'npm ci'],
  ),
  s3(
    'dockerfile-static-site',
    'A static site',
    'A build stage and an nginx image that serves the built files.',
    ['nginx', 'static', 'html', 'spa'],
  ),
  s2(
    'docker-trouble',
    'What goes wrong',
    'The image problems that cause most failures, with the lint code that catches each.',
    ['troubleshooting', 'error', 'architecture', 'size', 'permission'],
  ),
];

export const API_SECTIONS: readonly SectionMeta[] = [
  s2(
    'base-urls',
    'Base URLs',
    'Where to send a request: the gateway, stats, one node, and the rates service.',
    ['api.runonflux.io', 'stats.runonflux.io', 'node', 'host', '16127'],
  ),
  s2(
    'envelope',
    'The envelope and errors',
    'Every answer is HTTP 200 with a status in the body. How to read it and how to fail safely.',
    ['status', 'success', 'error', 'http 200', 'json', 'fetch'],
  ),
  s2(
    'limits',
    'CORS, caching and rate limits',
    'What a browser can call, how long answers are cached and what is known about limits.',
    ['cors', 'cache', 'rate limit', 'throttle', 'compression', 'brotli', 'timeout'],
  ),
  s2(
    'endpoints',
    'Endpoints',
    'Every endpoint with its method, URL, parameters, a real trimmed response and a curl line.',
    ['catalog', 'get', 'post', 'curl', 'sample'],
  ),
  s3('endpoints-network', 'Network', 'Node counts, geography and history.'),
  s3('endpoints-blocks', 'Blocks', 'The chain height and state.'),
  s3('endpoints-nodes', 'Nodes', 'The node list, versions and node local reads.'),
  s3('endpoints-apps', 'Apps', 'Specs, owners, messages and where apps run.'),
  s3('endpoints-prices', 'Prices and limits', 'Rates, the calculator and the deployment rules.'),
  s2(
    'calculator',
    'The price calculator',
    'A read only POST that needs Content-Type text/plain, and what it answers.',
    ['text/plain', 'content-type', 'application/json', '504', 'calculatefiatandfluxprice', 'quote'],
  ),
  s2('misleading', 'Misleading and removed', 'Endpoints and fields that older material gets wrong.', [
    'deprecated',
    'removed',
    'whitelist',
    'multiplier',
  ]),
  s2('left-out', 'What is left out', 'Calls that need a login or change state, and why they are not here.', [
    'zelidauth',
    'authentication',
    'register',
    'admin',
  ]),
  s2(
    'academy-api',
    "The Academy's own API",
    "The endpoints this site's server offers under /api/v1, as its contract describes them.",
    ['/api/v1', 'quote', 'lint', 'explore', 'stream', 'sse'],
  ),
  s2('try-it', 'Try it', 'Look up a real app on the network without writing a request.', [
    'explorer',
    'lab',
    'app lookup',
  ]),
];

/**
 * Section ids are addresses: lessons link to `/reference/orbit#plans` and `#build-variables`
 * (`site-links.test.ts` checks them), so an id is renamed only together with the links that name it.
 */
export const ORBIT_SECTIONS: readonly SectionMeta[] = [
  s2('at-a-glance', 'At a glance', 'What Orbit is in four lines, and the few things that stay fixed.', [
    'overview',
    'summary',
    'git',
    'deploy with git',
    'managed',
    'image',
    'runonflux/orbit',
  ]),
  s2(
    'plans',
    'Plans and prices',
    'The published plans, the resources behind each one and what the pricing engine says it costs.',
    [
      'price',
      'cost',
      'starter',
      'standard',
      'pro',
      'quote',
      'usd',
      'month',
      'instances',
      'failover',
      'free plan',
      'encryption fee',
    ],
  ),
  s3(
    'custom-sizes',
    'Custom sizes',
    'The ranges the page allows for a custom size, and why it states no price for one.',
    ['custom', 'range', 'vcores', 'ram', 'storage', 'instances'],
  ),
  s2(
    'how-a-deploy-runs',
    'How a Git deploy runs',
    'The stages from a push to a healthy app, in order, and what makes a deploy roll back.',
    [
      'clone',
      'detect',
      'nixpacks',
      'install',
      'build',
      'start',
      'health check',
      'hooks',
      'pre-deploy.sh',
      'post-deploy.sh',
      'rollback',
      'release',
      'pipeline',
      'stages',
    ],
  ),
  s2(
    'generated-spec',
    'The generated spec',
    'The version 8 spec a plan registers, annotated field by field, with the linter result for each plan.',
    [
      'spec',
      'json',
      'cloudgit',
      'runonflux/orbit:latest',
      'lint',
      'INSTANCES_ONE',
      'IMAGE_LATEST',
      'containerData',
      'environmentParameters',
      'containerPorts',
    ],
  ),
  s2(
    'build-variables',
    'Build variables',
    'Every variable the Orbit image reads: what it does, an example and whether it is a secret.',
    [
      'environment',
      'env',
      'variables',
      'GIT_REPO_URL',
      'APP_PORT',
      'GIT_BRANCH',
      'GIT_TOKEN',
      'PROJECT_PATH',
      'BUILD_COMMAND',
      'RUN_COMMAND',
      'secret',
      'token',
      'monorepo',
      'node version',
    ],
  ),
  s2(
    'deploy-button',
    'The Deploy to Flux button',
    'The link that opens the Orbit wizard with a repository filled in, parameter by parameter.',
    ['button', 'badge', 'readme', 'link', 'url', 'markdown', 'repo', 'branch', 'projectPath', 'plan'],
  ),
  s3(
    'deploy-button-anatomy',
    'URL anatomy',
    'The four parameters of the link, which one is required and what each accepts.',
    ['parameters', 'query', 'repo', 'branch', 'projectPath', 'plan', 'https'],
  ),
  s3(
    'deploy-button-builder',
    'Build a link',
    'Type a repository and read the link and the Markdown that the engine builds from it.',
    ['builder', 'generator', 'tool', 'tryDeployToFluxUrl', 'validate', 'copy'],
  ),
  s2(
    'webhooks',
    'Webhooks and polling',
    'How a push reaches the app, how it is checked, how the queue behaves and what the status endpoints answer.',
    [
      'webhook',
      'push',
      'github',
      'gitlab',
      'bitbucket',
      'secret',
      'signature',
      'polling',
      'POLLING_INTERVAL',
      'debounce',
      'queue',
      'status',
      'logs',
      'preview',
    ],
  ),
  s2(
    'on-the-network',
    'On the network',
    'How an Orbit app looks in the global specs, with dated counts of what was seen.',
    ['explorer', 'global specs', 'cloudgit', 'count', 'sample', 'blocklist', 'listed is not running'],
  ),
  s3(
    'orbit-markers',
    'Markers in a spec',
    'The fields that identify an Orbit app, how often each was seen and how sure the reading is.',
    ['marker', 'image', 'description', 'containerData', 'webhook port', 'inference'],
  ),
  s3(
    'orbit-samples',
    'Dated counts',
    'Counts taken from the live network on the read date. Samples, not current values.',
    ['count', 'sample', 'baked', 'encrypted', 'single instance', 'blocklist'],
  ),
  s2(
    'limits',
    'Limits and inclusions',
    'What Orbit does not do, what every plan includes and where the network ceilings apply.',
    [
      'limits',
      'serverless',
      'stateless',
      'persistent folders',
      'second port',
      'static site',
      'includes',
      'custom domain',
      'payment',
    ],
  ),
  s2(
    'not-published',
    'What is not published',
    'What the page and the docs leave unsaid, so that nothing here fills a gap by guessing.',
    ['unknown', 'unverified', 'gaps', 'not documented', 'key custody', 'encryption fee', 'custom price'],
  ),
  s2(
    'orbit-mcp',
    'The Orbit MCP server',
    'Orbit has its own server for AI agents, with its own sign in. Its tool list is on the Agents page.',
    ['mcp', 'agent', 'tools', 'stripe', 'checkout', 'account', 'sign in'],
  ),
  s2(
    'related',
    'Related lessons and tools',
    'Lessons, labs, the troubleshooter and the vendor pages that go with this page.',
    ['lesson', 'lab', 'troubleshoot', 'learn'],
  ),
];

/** Lessons link to `/reference/agents#tools` and `#console-assistant`; see `ORBIT_SECTIONS`. */
export const AGENTS_SECTIONS: readonly SectionMeta[] = [
  s2(
    'at-a-glance',
    'At a glance',
    'What an agent changes and what it does not, with the tool counts of both servers.',
    ['overview', 'summary', 'agent', 'assistant', 'mcp', 'model context protocol', 'servers', 'tools'],
  ),
  s2(
    'servers',
    'The two servers',
    'Endpoint, package, versions, identity and where the credentials live, side by side.',
    [
      'flux-cloud',
      'orbit',
      'endpoint',
      'npm',
      'version',
      'hosted',
      'package',
      'identity',
      'keys',
      'account',
      'mcp.runonflux.com',
      'transport',
    ],
  ),
  s3(
    'connecting',
    'How a client connects',
    'The ways to connect to each server and where the credentials are while a call runs.',
    [
      'connect',
      'config',
      'stdio',
      'streamable http',
      'npx',
      'claude code',
      'cursor',
      'windsurf',
      'opencode',
      'authorization',
      'container',
    ],
  ),
  s2(
    'tools',
    'Tool catalogue',
    'Every tool of both servers with its risk, what it can spend and the sentence to show before the call.',
    ['tools', 'tool list', 'risk', 'filter', 'spends', 'reads', 'approval', 'arguments', 'confirm', 'group'],
  ),
  s3(
    'tools-flux-cloud',
    'FluxCloud MCP server tools',
    'The tools of the server that works with keys, with their arguments.',
    ['flux_', 'arguments', 'schema', 'keys'],
  ),
  s3(
    'tools-orbit',
    'Orbit MCP server tools',
    'The tools of the server that works with an account, listed by name and purpose only.',
    ['orbit', 'account', 'stripe', 'arguments', 'credentials'],
  ),
  s2(
    'plan-confirm',
    'Plan, then confirm',
    'The four steps of a deploy that spends: what each call returns and who has to agree.',
    ['confirm', 'plan', 'dry run', 'executed', 'flux_deploy_app', 'approval', 'human in the loop'],
  ),
  s2(
    'key-model',
    'The key model',
    'The two keys of the FluxCloud server, what each is for and which tool needs which.',
    ['keys', 'flux id', 'payment key', 'wif', 'owner', 'private key', 'flux_generate_keys', 'dedicated'],
  ),
  s2(
    'hosted-or-local',
    'Hosted or on your machine',
    'What changes between the local server, the hosted one and a container you run yourself.',
    ['hosted', 'local', 'stdio', 'npx', 'version', 'vendor', 'chat history', 'keys', 'container', 'ghcr'],
  ),
  s2(
    'what-spends',
    'What spends or deletes',
    'What the tools that spend, cancel or control do to money and data, and what to check first.',
    [
      'spend',
      'pay',
      'delete',
      'cancel',
      'refund',
      'remove',
      'hard redeploy',
      'confirm',
      'expire',
      'update',
      'data loss',
    ],
  ),
  s2('policies', 'Approval policies', 'What ask all, ask spends and allow all let through, tool by tool.', [
    'policy',
    'approval',
    'ask all',
    'ask spends',
    'allow all',
    'permission',
    'auto approve',
    'client',
  ]),
  s2(
    'console-assistant',
    'The console assistant',
    'The assistant inside FluxCloud: what it can look up and what it can never do. It is not an MCP server.',
    ['assistant', 'console', 'fluxcloud', 'ui_prefill_deploy', 'draft', 'chat', 'ai', 'flux ai'],
  ),
  s2(
    'known-gaps',
    'Known gaps in vendor guides',
    'Where a server guide, its price estimator or some console copy disagrees with the network.',
    ['guide', 'estimator', 'flux_get_pricing', 'g: discount', 'wrong', 'stale', 'readme', 'docs', 'quote'],
  ),
  s2('related', 'Related lessons and tools', 'The lesson, the lab and the pages that go with this one.', [
    'lesson',
    'lab',
    'agent desk',
    'troubleshoot',
  ]),
];

export const TOPICS: readonly TopicMeta[] = [
  {
    id: 'spec',
    path: '/reference/spec',
    name: 'Application spec',
    heading: 'Application spec reference',
    promise: `Every field, limit and lint code of a version ${SPEC_VERSION} spec.`,
    lead: `Every field of a version ${SPEC_VERSION} application spec: its type, whether it is required, its limits, what it does and the lint codes that guard it. The numbers are read from the same engine that checks your spec in {{lab:spec-forge}}.`,
    art: 'mod-deploy',
    glyph: 'code',
    sections: SPEC_SECTIONS,
    highlights: [
      { label: 'Component fields', anchor: 'component-fields' },
      { label: 'Geolocation grammar', anchor: 'geolocation' },
      { label: 'How the price is made', anchor: 'pricing' },
    ],
  },
  {
    id: 'networking',
    path: '/reference/networking',
    name: 'Networking',
    heading: 'Networking reference',
    promise: 'Ports, domains and internal names, from the browser to your process.',
    lead: 'How a request travels from a browser to your process: public ports, container ports, the names Flux generates, custom domains, the load balancer and the private network between components.',
    art: 'mod-traffic',
    glyph: 'route',
    sections: NETWORKING_SECTIONS,
    highlights: [
      { label: 'Banned and fee ports', anchor: 'ports' },
      { label: 'Internal DNS names', anchor: 'internal-dns' },
      { label: 'Custom domains', anchor: 'custom-domains' },
    ],
  },
  {
    id: 'docker',
    path: '/reference/docker',
    name: 'Docker practices',
    heading: 'Docker practices for Flux',
    promise: 'Images that are small, safe and quick to start on any node.',
    lead: 'What Flux asks of an image and what keeps it small, safe and quick to start: names and tags, architecture, registries, binding, environment variables, users, logs, and two Dockerfile patterns you can copy.',
    art: 'mod-containers',
    glyph: 'container',
    sections: DOCKER_SECTIONS,
    highlights: [
      { label: 'Bind 0.0.0.0', anchor: 'binding' },
      { label: 'Dockerfile patterns', anchor: 'dockerfiles' },
      { label: 'What goes wrong', anchor: 'docker-trouble' },
    ],
  },
  {
    id: 'api',
    path: '/reference/api',
    name: 'API cheat sheet',
    heading: 'Flux API cheat sheet',
    promise: 'The read-only endpoints, with real responses and copyable curl.',
    lead: 'The public, read only HTTP API of the network: where to send requests, the envelope and its errors, limits, and each endpoint with its parameters, a real trimmed response and a curl line.',
    art: 'mod-network',
    glyph: 'terminal',
    sections: API_SECTIONS,
    highlights: [
      { label: 'The envelope', anchor: 'envelope' },
      { label: 'The price calculator', anchor: 'calculator' },
      { label: 'Endpoints', anchor: 'endpoints' },
    ],
  },
  {
    id: 'orbit',
    path: '/reference/orbit',
    name: 'Orbit and Git deploys',
    heading: 'Orbit and Git deploys reference',
    promise: 'Plans, the build pipeline, the variables and the Deploy to Flux link.',
    lead: `How {{term:flux-orbit}} turns a Git repository into a running app: the plans and what they cost, how a {{term:git-deploy}} runs, the spec it registers, the build variables and the Deploy to Flux link. An Orbit app is an ordinary version ${SPEC_VERSION} spec, so the rest of this reference applies to it.`,
    art: 'mod-projects',
    glyph: 'layers',
    sections: ORBIT_SECTIONS,
    highlights: [
      { label: 'Plans and prices', anchor: 'plans' },
      { label: 'Build variables', anchor: 'build-variables' },
      { label: 'Deploy to Flux link', anchor: 'deploy-button' },
    ],
    basis: {
      text: 'Read from the Orbit product page, its guides and the live network on',
      date: '2026-10-13', // literal: ORBIT_READ_ON, pinned by orbit.test.ts
    },
  },
  {
    id: 'agents',
    path: '/reference/agents',
    name: 'Agents and MCP',
    heading: 'Agents and MCP reference',
    promise: 'The two MCP servers, every tool, what each can spend and what to approve.',
    lead: 'What an {{term:ai-agent}} can do to a Flux app through the two {{term:mcp}} servers: the FluxCloud one, which works with keys, and the Orbit one, which works with an account. Every tool, what it can spend or delete, and what to approve. The assistant inside FluxCloud is a separate thing.',
    art: 'mod-operate',
    glyph: 'shield',
    sections: AGENTS_SECTIONS,
    highlights: [
      { label: 'Tool catalogue', anchor: 'tools' },
      { label: 'Plan, then confirm', anchor: 'plan-confirm' },
      { label: 'Approval policies', anchor: 'policies' },
    ],
    basis: {
      text: 'Read from the npm package, the hosted server, the Orbit guide and the FluxCloud console on',
      date: '2026-10-13', // literal: MCP_SERVERS readOn, pinned by agents.test.ts
    },
  },
];

const BY_ID: ReadonlyMap<TopicId, TopicMeta> = new Map(TOPICS.map((t) => [t.id, t]));

export function topicById(id: string): TopicMeta | undefined {
  return BY_ID.get(id as TopicId);
}

/** The topic before and after `id` in page order, for the previous and next links. */
export function neighbours(id: TopicId): { prev: TopicMeta | null; next: TopicMeta | null } {
  const i = TOPICS.findIndex((t) => t.id === id);
  if (i < 0) return { prev: null, next: null };
  return { prev: TOPICS[i - 1] ?? null, next: TOPICS[i + 1] ?? null };
}
