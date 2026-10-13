/**
 * What the forge teaches next to every field: what it is, the verified limit, the common mistake and where
 * to read more. One entry per field, keyed by the JSON path with indexes removed (`compose[].ports`).
 *
 * The facts come from docs/research/FACTS.md and from `LIMITS` in `shared/flux/spec.ts`; the mistakes are
 * lint codes, so their wording is the engine's own (`LINT_CODES`) and never drifts from what the Issues
 * panel says. Numbers that depend on the price table are filled in from the rates in force.
 */

import { LINT_CODES } from '@shared/flux/lint';
import { BAKED_PRICING } from '@shared/flux/pricing';
import { LIMITS } from '@shared/flux/spec';
import type { PricingParams } from '@shared/flux/types';

const DOCS = 'https://docs.runonflux.com/fluxcloud';
export const DOC_LINKS = {
  general: { label: 'General settings', href: `${DOCS}/register-new-app/deploy-with-docker/general` },
  components: { label: 'Components', href: `${DOCS}/register-new-app/deploy-with-docker/components` },
  review: { label: 'Review and validate', href: `${DOCS}/register-new-app/deploy-with-docker/review` },
  cost: { label: 'Cost calculator', href: `${DOCS}/cost-calculator` },
  subscription: {
    label: 'Subscription',
    href: `${DOCS}/applications/management/manage-app/subscription`,
  },
  sharedDb: { label: 'Shared database', href: `${DOCS}/shared-database/component` },
  priority: { label: 'Priority nodes', href: `${DOCS}/register-new-app/deploy-with-docker/priority-nodes` },
  domain: { label: 'Custom domain setup', href: `${DOCS}/register-new-app/custom-domain-setup` },
} as const;

export interface HelpEntry {
  /** The label FluxCloud shows for this field (FACTS 9.14), so a learner can find it there. */
  fluxcloud?: string;
  title: string;
  /** What it is, in a sentence or two. */
  what: string;
  /** The verified limit or rule, one sentence. */
  limit?: string;
  /** Lint codes whose catalogue wording is shown as the common mistakes. */
  mistakes?: readonly string[];
  /** Short extra points. */
  notes?: readonly string[];
  docs?: { label: string; href: string };
}

export interface HelpContext {
  params?: PricingParams;
}

const n = (x: number) => x.toLocaleString('en-US');
const usd = (x: number) => `USD ${Number(x.toFixed(2))}`;

/** The key for a JSON path: indexes removed (`compose[0].ports[1]` becomes `compose[].ports`). */
export function helpKeyForPath(path: string): string {
  return path.replace(/\[\d+\]/g, '[]').replace(/\[\]$/, '');
}

type Builder = (ctx: Required<HelpContext>) => HelpEntry;

const ENTRIES: Record<string, Builder> = {
  version: () => ({
    fluxcloud: 'Specification Version',
    title: 'Spec version',
    what: 'The schema of the spec. Version 8 is the only one the network accepts for new apps.',
    limit: `Always ${LIMITS.version}.`,
    notes: [
      'Tutorials that use tiered, cpubasic or secrets are for version 7 or older. In version 8 those keys are ignored, so they have no effect: use one cpu, ram and hdd, and enterprise for private values.',
    ],
    docs: DOC_LINKS.general,
  }),

  name: () => ({
    fluxcloud: 'Application Name',
    title: 'App name',
    what: 'The identity of the app on the network and the first part of its free web address, <name>.app.runonflux.io.',
    limit: `1 to ${LIMITS.name.maxLength} characters: letters, digits and inner hyphens. It cannot start with zel or flux, and it must be unique across the whole network, ignoring case.`,
    mistakes: ['NAME_RESERVED_PREFIX', 'NAME_FORMAT', 'NAME_MARKETPLACE_PREFIX'],
    docs: DOC_LINKS.general,
  }),

  description: () => ({
    fluxcloud: 'Description',
    title: 'Description',
    what: 'One sentence about the app, stored on chain with it. The optional networkWith link to another app also goes here.',
    limit: `1 to ${LIMITS.descriptionMaxLength} characters. An empty description is refused exactly like a missing one.`,
    mistakes: ['DESCRIPTION_MISSING', 'DESCRIPTION_TOO_LONG', 'NETWORK_WITH_FORMAT'],
    docs: DOC_LINKS.general,
  }),

  owner: () => ({
    fluxcloud: 'Owner',
    title: 'Owner',
    what: 'The Flux ID (or Ethereum address) that signs the registration and every later update. Whoever holds its key controls the app.',
    limit:
      'A Flux ID is a base58 address that starts with 1 (25 to 34 characters), like the example here. An Ethereum address is 0x and 40 hex characters. The network refuses anything else, including a payment address that starts with t1.',
    mistakes: ['OWNER_INVALID', 'OWNER_MISSING'],
    notes: [
      'The example here is the Flux team public ID. In FluxCloud the owner shows your own Flux ID and cannot be edited.',
    ],
    docs: DOC_LINKS.general,
  }),

  instances: ({ params }) => ({
    fluxcloud: 'Instances',
    title: 'Instances',
    what: 'How many nodes run a copy of your app. In practice each copy runs on a different node, so more copies means more machines can fail before the app is down.',
    limit: `${LIMITS.instances.min} to ${LIMITS.instances.max} for version 8. FluxCloud's Simple form asks for at least 2 when storage is replicated, because a synced volume with one instance has nothing to copy to.`,
    mistakes: [
      'INSTANCES_ONE',
      'INSTANCES_PRICE_CLIFF',
      'INSTANCES_EXCEED_NODES',
      'STATEFUL_SINGLE_INSTANCE',
    ],
    notes: [
      `The rates are stated for a bundle of 3 instances (${usd(params.cpu)} per 0.1 core, ${usd(params.ram)} per 100 MB, ${usd(params.hdd)} per GB), so the price is close to linear in instances.`,
      'An app under the size caps with fewer than 4 instances also gets 20 percent off (10 percent for a medium app). The fourth instance loses that, which is why the price steps up there.',
    ],
    docs: DOC_LINKS.cost,
  }),

  expire: () => ({
    fluxcloud: 'Period',
    title: 'Subscription length',
    what: 'How long the app lives, counted in blocks of about 30 seconds from the block that carries the registration or update. You pay for the whole period up front.',
    limit: `${LIMITS.expire.min} to ${n(LIMITS.expire.max)} blocks (a year at most). One month is 88,000 blocks. From 3 months the whole price takes 3 percent off, from 6 months 6 percent and from 9 months 12 percent, but the total is then rounded up to a price ending .49 or .99, which for a small app can swallow the saving.`,
    mistakes: ['EXPIRE_ONE_BLOCK', 'EXPIRE_SHORT', 'EXPIRE_HIGH'],
    notes: [
      'There is no grace period: when the subscription ends, the app and its data are removed within minutes to hours.',
    ],
    docs: DOC_LINKS.subscription,
  }),

  staticip: ({ params }) => ({
    fluxcloud: 'Static IP',
    title: 'Static IP',
    what: 'Only run on nodes that have a fixed, directly reachable public address. Not every node does, so fewer nodes qualify.',
    limit: `Adds ${usd(params.staticip)} to the price before it is divided by 3.`,
    mistakes: ['STATICIP_COST'],
    docs: DOC_LINKS.cost,
  }),

  enterprise: ({ params }) => ({
    fluxcloud: 'Enterprise',
    title: 'Enterprise',
    what: 'Encrypts contacts and components on chain so only ArcaneOS nodes can read them. It is how secrets and private images are kept out of a public spec.',
    limit: `Adds the scope fee, ${usd(params.scope)} before dividing by 3. Every image needs an amd64 build.`,
    mistakes: ['ENV_SECRET_PUBLIC', 'REPOAUTH_NEEDS_ENTERPRISE', 'ENTERPRISE_AMD64'],
    notes: [
      'In the forge this is a labelled placeholder: the real encrypted value is made with a key fetched from the network when you register.',
      'It is not the same thing as the allowlisted enterprise network that pins apps to chosen nodes.',
    ],
    docs: DOC_LINKS.priority,
  }),

  contacts: () => ({
    fluxcloud: 'Contact',
    title: 'Contacts',
    what: 'Email addresses or links kept with the app for deployment and expiry notices. Which part of the system actually sends one is not documented.',
    limit: `Up to ${LIMITS.contacts.maxCount} entries, each up to ${LIMITS.contacts.maxLength} characters. The network accepts an empty list, but FluxCloud's form asks for an email.`,
    mistakes: ['CONTACTS_PUBLIC', 'CONTACTS_TOO_MANY', 'CONTACT_TOO_LONG'],
    docs: DOC_LINKS.general,
  }),

  geolocation: () => ({
    fluxcloud: 'Allowed Geolocation and Forbidden Geolocation',
    title: 'Geolocation',
    what: 'Where instances may run. An empty list means anywhere. A node must match at least one allow entry (when there are any) and no deny entry, and a deny always beats an allow.',
    limit: `Up to ${LIMITS.geolocation.maxCount} entries, each up to ${LIMITS.geolocation.maxLength} characters. ac allows and a!c denies: acEU, acEU_DE, a!cNA. Continents are AF, AN, AS, EU, NA, OC and SA.`,
    mistakes: ['GEO_CONFLICT', 'GEO_SYNTAX', 'GEO_ONE_REGION', 'GEO_LEGACY'],
    notes: [
      'It is a placement filter over the network\'s IP-location data, not a compliance control. Registration is refused when the filter leaves some nodes but fewer than your instance count ("only M eligible nodes"). A list that leaves none is accepted, and nothing is promised to run.',
      'A node whose country the network could not resolve still counts as a candidate, and an entry it does not understand is skipped, so the list can do less than you wrote.',
    ],
    docs: DOC_LINKS.general,
  }),

  nodes: ({ params }) => ({
    fluxcloud: 'Priority Nodes',
    title: 'Pinned nodes',
    what: 'Pins the app to specific nodes, by collateral outpoint (txhash:index) or IP address.',
    limit: `Up to ${LIMITS.nodes.maxCount} entries. Version 8 accepts it on enterprise specs only, and only from owners on the network's enterprise list. Adds the scope fee, ${usd(params.scope)}.`,
    mistakes: ['NODES_NEED_ENTERPRISE', 'NODES_OWNER_PRIVILEGE', 'NODES_FEWER_THAN_INSTANCES'],
    docs: DOC_LINKS.priority,
  }),

  datacenter: () => ({
    title: 'Data center nodes',
    what: 'Only run on nodes the network classifies as data center nodes.',
    limit: 'Restricted to owners on the network enterprise list, like pinned nodes.',
    mistakes: ['DATACENTER_PRIVILEGE'],
    docs: DOC_LINKS.priority,
  }),

  compose: () => ({
    fluxcloud: 'Components',
    title: 'Components',
    what: 'The containers of the app. Each one has its own image, ports, resources and storage, and they share one network, one price and one lifetime.',
    limit: `${LIMITS.component.min} to ${LIMITS.component.max} components. Resources add up across components: at most ${LIMITS.totals.cpu} cores, ${n(LIMITS.totals.ram)} MB and ${LIMITS.totals.hdd} GB.`,
    mistakes: ['COMPOSE_TOO_MANY', 'TOTAL_CPU_EXCEEDED', 'TOTAL_RAM_EXCEEDED', 'TOTAL_HDD_EXCEEDED'],
    notes: [
      'Components reach each other by container name, flux<component>_<app>, over a private network. Only ports you list are public.',
    ],
    docs: DOC_LINKS.components,
  }),

  'compose[].name': () => ({
    fluxcloud: 'Name',
    title: 'Component name',
    what: 'Names this container inside the app. It becomes part of its internal host name, flux<component>_<app>, which other components use to reach it.',
    limit: `Letters and digits only, no hyphens even in version 8. Up to ${LIMITS.component.nameMaxLength} characters, unique in the app, never starting with zel or flux.`,
    mistakes: ['COMPONENT_NAME_FORMAT', 'COMPONENT_NAME_RESERVED', 'COMPONENT_NAME_DUPLICATE'],
    docs: DOC_LINKS.components,
  }),

  'compose[].description': () => ({
    fluxcloud: 'Description',
    title: 'Component description',
    what: 'A note about what this container does.',
    limit: `Up to ${LIMITS.descriptionMaxLength} characters.`,
    mistakes: ['COMPONENT_DESCRIPTION_TOO_LONG'],
    docs: DOC_LINKS.components,
  }),

  'compose[].repotag': () => ({
    fluxcloud: 'Repository Tag',
    title: 'Image (repotag)',
    what: 'The Docker image to run, written [registry/][namespace/]image[:tag]. Every node that hosts the app pulls it from its registry.',
    limit: `Up to ${LIMITS.repotag.maxLength} characters, in lower case. The image must exist and be pullable, be public (or the app enterprise), have an amd64 or arm64 build, and be at most 5 GB in total layer size.`,
    mistakes: ['IMAGE_LATEST', 'IMAGE_UNTAGGED', 'IMAGE_UPPERCASE', 'REPOTAG_FORMAT'],
    notes: [
      'Docker Hub images need no registry prefix: a docker.io/ prefix fails the image lookup, and a capital letter is refused by FluxOS itself ("not in valid format").',
      'Almost every node is amd64 (all ArcaneOS nodes are). An image built only for arm64, such as a default build on Apple silicon, has very few nodes to run on: build with --platform linux/amd64 or publish a multi-arch image.',
      'Each node is set to compare its image digest with the registry about every 6 hours and, when they differ, redeploy (read from the source, not observed live), so a moving tag such as latest can change under a running app.',
    ],
    docs: DOC_LINKS.components,
  }),

  'compose[].repoauth': () => ({
    fluxcloud: 'Repository Authentication',
    title: 'Registry credentials',
    what: 'Credentials for a private image: username:token, or a provider address (aws-ecr://, azure-acr:// or google-gar://). Stored encrypted inside an enterprise spec.',
    limit: `Enterprise apps only. Up to ${n(LIMITS.repoauth.maxLength)} characters.`,
    mistakes: ['REPOAUTH_NEEDS_ENTERPRISE', 'REPOAUTH_FORMAT'],
    notes: ['Never put real credentials in a spec you share or a link you send.'],
    docs: DOC_LINKS.components,
  }),

  'compose[].ports': ({ params }) => ({
    fluxcloud: 'Exposed Port',
    title: 'Public ports',
    what: 'The port on the node that reaches this container. Every public port is published for both TCP and UDP.',
    limit: `${LIMITS.ports.min} to ${LIMITS.ports.max}, at most ${LIMITS.ports.perComponentMax} per component, unique across the whole app. Ports such as 22, 25, 53 and 27017, and the ranges 16100-16299, 26100-26299 and 30000-30099 are banned.`,
    mistakes: ['PORT_BANNED', 'PORT_DUPLICATE', 'PORT_FEE'],
    notes: [
      `Ports 1 to 1023, 8080, 8081, 8443 and 6667 are accepted but cost ${usd(params.port)} each, added before the price is divided by 3. Map a high port to the container port you need.`,
    ],
    docs: DOC_LINKS.components,
  }),

  'compose[].containerPorts': () => ({
    fluxcloud: 'Container Port',
    title: 'Container ports',
    what: 'The port your process listens on inside the container. Traffic that arrives on the public port is forwarded here, one to one, in the same order.',
    limit: `${LIMITS.ports.containerMin} to ${LIMITS.ports.containerMax}, one entry per public port.`,
    mistakes: ['PORT_ENV_MISMATCH', 'BIND_LOCALHOST', 'PORT_LENGTH_MISMATCH'],
    notes: [
      'The process must listen on 0.0.0.0. A server bound to 127.0.0.1 or localhost never sees traffic from outside the container.',
    ],
    docs: DOC_LINKS.components,
  }),

  'compose[].domains': () => ({
    fluxcloud: 'Custom Domains',
    title: 'Custom domains',
    what: 'Your own domain for a port, served by the Flux domain manager. Also create a CNAME at your DNS provider that points to <name>.app.runonflux.io.',
    limit: `One entry per public port, up to ${LIMITS.domains.maxLength} characters. Several domains for one port are separated by commas. Leave it empty for none.`,
    mistakes: ['DOMAIN_APEX', 'DOMAIN_FORMAT', 'DOMAINS_LENGTH_MISMATCH'],
    notes: ['Both steps are needed: the spec entry and the DNS record.'],
    docs: DOC_LINKS.domain,
  }),

  'compose[].environmentParameters': () => ({
    fluxcloud: 'Environment Variables',
    title: 'Environment variables',
    what: 'Settings passed to the container, written KEY=value. Flux also adds FLUX_APP_NAME and FLUX_NODE_HOST_IP.',
    limit: `Up to ${LIMITS.environment.maxCount} per component, each up to ${LIMITS.environment.maxLength} characters.`,
    mistakes: ['ENV_SECRET_PUBLIC', 'ENV_FORMAT', 'ENV_RESERVED_NAME'],
    notes: [
      'In a normal app anyone can read these from the public API. Use enterprise to keep a value private.',
    ],
    docs: DOC_LINKS.components,
  }),

  'compose[].commands': () => ({
    fluxcloud: 'Commands',
    title: 'Commands',
    what: "The arguments given to the image's entrypoint (the Docker CMD), one per row. It is a list of arguments, not a shell line.",
    limit: `Up to ${LIMITS.commands.maxCount} per component, each up to ${LIMITS.commands.maxLength} characters.`,
    mistakes: ['COMMAND_UNSPLIT', 'COMMAND_PRIVILEGED', 'BIND_LOCALHOST'],
    notes: ['To run a shell command, use three rows: sh, -c and the command.'],
    docs: DOC_LINKS.components,
  }),

  'compose[].containerData': () => ({
    fluxcloud: 'Container Data Path',
    title: 'Storage (containerData)',
    what: 'Which folder inside the container lives on a volume, and what that volume does when a node goes away.',
    limit: `${LIMITS.containerData.minLength} to ${LIMITS.containerData.maxLength} characters. When the app needs no data folder, /tmp is the usual value; it is still an ordinary volume on one node.`,
    mistakes: [
      'STATEFUL_NO_VOLUME',
      'STATEFUL_NOT_SYNCED',
      'DB_ON_REPLICATED_MOUNT',
      'CONTAINER_DATA_SYNTAX',
    ],
    notes: [
      'A plain path is a real volume on one node: it survives restarts and soft redeploys, and is lost when the node fails, on a hard redeploy, and at expiry.',
      'r: copies the volume to every instance (all write, eventually consistent). g: runs one primary and keeps synced standbys; a failover takes minutes, and the newest writes may be missing. Neither is a database cluster.',
      'With g: on any component, every port of the whole app goes to the one primary node, but only the g: component is started and stopped by the election.',
    ],
    docs: DOC_LINKS.sharedDb,
  }),

  'compose[].cpu': ({ params }) => ({
    fluxcloud: 'CPU',
    title: 'CPU',
    what: `CPU cores for this container, in steps of 0.1. The rate is ${usd(params.cpu)} per 0.1 core for a bundle of 3 instances.`,
    limit: `FluxCloud's form moves in steps of 0.1 core. The network checks only the total: ${LIMITS.totals.cpu} cores across all components. It enforces no per-component minimum or step for version 8.`,
    mistakes: ['TOTAL_CPU_EXCEEDED', 'CPU_STEP', 'SIZE_EXCLUDES_CUMULUS'],
    notes: [
      'Cumulus, the most common tier at the time of writing, offers apps about 3 cores on a nominal node. Above that most Cumulus nodes have no room, and Nimbus (about 7) and Stratus (about 15) nodes do.',
    ],
    docs: DOC_LINKS.components,
  }),

  'compose[].ram': ({ params }) => ({
    fluxcloud: 'RAM',
    title: 'RAM',
    what: `Memory for this container in MB, in steps of 100. The rate is ${usd(params.ram)} per 100 MB for a bundle of 3 instances.`,
    limit: `FluxCloud's form moves in steps of 100 MB. The network checks only the total: ${n(LIMITS.totals.ram)} MB across all components. It enforces no per-component minimum or step for version 8.`,
    mistakes: ['TOTAL_RAM_EXCEEDED', 'RAM_TOO_SMALL_FOR_IMAGE', 'RAM_STEP'],
    notes: [
      'A nominal Cumulus node offers apps about 5,000 MB, Nimbus about 28,000 and Stratus about 59,000.',
      'The container memory limit is this value, with 2,000 MB of swap on top. What happens beyond the limit is not documented, so leave headroom.',
    ],
    docs: DOC_LINKS.components,
  }),

  'compose[].hdd': ({ params }) => ({
    fluxcloud: 'SSD/NVMe',
    title: 'Disk',
    what: `The size of this container's volume in GB, allocated in full when the app is installed. The rate is ${usd(params.hdd)} per GB for a bundle of 3 instances.`,
    limit: `FluxCloud's form moves in steps of 1 GB. The network checks only the total: ${LIMITS.totals.hdd} GB across all components. It enforces no per-component minimum or step for version 8.`,
    mistakes: ['TOTAL_HDD_EXCEEDED', 'DISK_SMALL_STATEFUL', 'HDD_STEP'],
    notes: [
      'A full volume stops writes with "No space left on device". Changing the disk size later makes FluxCloud warn of a hard redeploy, which recreates the volume, so back up first.',
      'A local backup is a file inside this same volume: it counts against the disk size, is not replicated, and is lost with the node.',
      'Two numbers exist for node disk. The validator accepts up to 160, 380 and 820 GB for Cumulus, Nimbus and Stratus sized apps, but the room a real node has left for apps is lower (about 129, 338 and 756 GB), so a spec can pass validation and still wait for a bigger node.',
    ],
    docs: DOC_LINKS.components,
  }),

  // ---- the price instrument -------------------------------------------------------------------------------------
  price: ({ params }) => ({
    fluxcloud: 'Total Cost',
    title: 'How the price is built',
    what: `Cores, RAM and disk are priced at the official rates (${usd(params.cpu)} per 0.1 core, ${usd(params.ram)} per 100 MB, ${usd(params.hdd)} per GB), plus add-ons such as a static IP. The rates buy a bundle of 3 instances, so one instance costs a third of that, rounded up to the cent, and each extra instance costs the same again.`,
    limit: `No app costs less than ${usd(params.minUSDPrice)} a month. After every discount the price is rounded up to the next amount ending in .49 or .99.`,
    notes: [
      'Apps under 3 cores, 6,000 MB and 150 GB (or under 7 cores, 29,000 MB and 370 GB) with fewer than 4 instances get 20 or 10 percent off.',
      'A very small app, under USD 0.50 per instance, pays a flat USD 0.50 for every instance after the first once it has 4 or more.',
    ],
    docs: DOC_LINKS.cost,
  }),

  flux: ({ params }) => ({
    title: 'Paying in FLUX',
    what: `Prices are set in USD and converted at the current FLUX price. Paying in FLUX multiplies the price by ${params.fluxmultiplier}, which is ${Math.round((1 - params.fluxmultiplier) * 100)} percent off.`,
    limit: 'The conversion rate moves with the market; the USD price does not.',
    docs: DOC_LINKS.cost,
  }),

  months: () => ({
    fluxcloud: 'Period',
    title: 'Subscription discount',
    what: 'You pay for the whole period at once. Three months or more takes 3 percent off, six months 6 percent, and nine months or more 12 percent, and the total is then rounded up to a price ending .49 or .99. FluxCloud offers 1 week, 2 weeks, 1, 3 and 6 months and 1 year.',
    notes: [
      'The 0.99 minimum applies to the whole subscription, so for a very small app a week costs the same as a month.',
    ],
    docs: DOC_LINKS.subscription,
  }),

  curve: () => ({
    title: 'Price against instances',
    what: 'The same app priced at 1 to 10 instances. It is close to a straight line with steps where a rule changes: a small app loses its 10 or 20 percent discount at the fourth instance.',
    notes: [
      'The 0.99 minimum flattens the left end of the line for the smallest apps.',
      'A very small app, once it has 4 instances, pays a flat USD 0.50 for every instance after the first, so its step is larger than the lost discount alone.',
    ],
    docs: DOC_LINKS.cost,
  }),
};

/** The teaching entry for a field path or key, or null. */
export function helpFor(pathOrKey: string, ctx: HelpContext = {}): HelpEntry | null {
  const key = pathOrKey in ENTRIES ? pathOrKey : helpKeyForPath(pathOrKey);
  const build = ENTRIES[key];
  if (!build) return null;
  return build({ params: ctx.params ?? BAKED_PRICING.params });
}

/** Resolve the mistakes of an entry to the lint catalogue's title and fix. Unknown codes are skipped. */
export function mistakesOf(entry: HelpEntry): { code: string; title: string; why: string; fix: string }[] {
  const out: { code: string; title: string; why: string; fix: string }[] = [];
  for (const code of entry.mistakes ?? []) {
    const meta = LINT_CODES[code];
    if (meta) out.push({ code, title: meta.title, why: meta.why, fix: meta.fix });
  }
  return out;
}

export const HELP_KEYS: readonly string[] = Object.keys(ENTRIES);
