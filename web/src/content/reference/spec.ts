/**
 * Content of /reference/spec: the field reference, the geolocation and containerData grammars, the
 * subscription arithmetic and the plain language pricing steps.
 *
 * Sources are FACTS.md sections 3 (specification), 4 (pricing), 5 (blocks) and 7 (persistence). Every
 * limit is read from `LIMITS` and the other engine exports when a builder runs, so this page cannot
 * disagree with the linter or the calculator. A fact the engine does not own is registered in `facts.ts`.
 */

import {
  BAKED_PRICING,
  BLOCKS_PER_MONTH,
  BUNDLE_INSTANCES,
  blocksToSeconds,
  DURATION_DISCOUNTS,
  daysToBlocks,
  defaultComponent,
  defaultSpec,
  durationDiscount,
  EXTRA_INSTANCE_FLOOR_USD,
  HW_DISCOUNT_MAX_INSTANCES,
  HW_DISCOUNTS,
  humanDuration,
  LIMITS,
  MARKETPLACE_MULTIPLIERS,
  MAX_EXPIRE_BLOCKS,
  monthsToBlocks,
  SPEC_VERSION,
} from '@shared/flux';
import { andList, bannedCount, feePortsText, num, orList, perInstanceFee, usd } from './derive';
import { FEE_PORT_EXAMPLES, FREE_PORT_EXAMPLE } from './examples';
import {
  CHECKED,
  FORM_DEFAULTS,
  FORM_STEPS,
  MIN_ONE_INSTANCE_FROM_BLOCK,
  NODE,
  RULES,
  SNAPSHOT,
  SYNC,
} from './facts';
import type { FactRow, FieldDoc, Provenance } from './types';

const json = (value: unknown): string => `\`${JSON.stringify(value)}\``;

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

type Draft = Omit<FieldDoc, 'scope' | 'id' | 'key' | 'prov'> & { prov?: readonly Provenance[] };

function field(scope: 'app' | 'component', key: string, draft: Draft): FieldDoc {
  return { scope, key, id: `${scope}-${key}`, prov: ['source'], ...draft };
}

/** The 13 top level keys, in the order the engine lists them (`LIMITS.appKeys`). */
export function buildAppFields(): FieldDoc[] {
  const L = LIMITS;
  const d = defaultSpec();
  const r = BAKED_PRICING.params;
  const docs: Record<string, Draft> = {
    version: {
      type: 'integer',
      required: 'yes',
      defaultValue: json(d.version),
      limits: [
        `Must be ${SPEC_VERSION} for a new app and for any update that changes the version.`,
        `Versions 1 to ${SPEC_VERSION - 1} still exist on chain so the network can replay old apps. A new app cannot use them.`,
      ],
      summary: `Selects the schema the network checks the rest of the spec against. Version ${SPEC_VERSION} is the only one a new app may use.`,
      mistake:
        'Copying a spec written for version 3 to 7 from an old tutorial: the required fields differ and the network refuses it.',
      lessons: ['first-deploy'],
      lint: ['VERSION_CHANGED'],
      prov: ['source', 'live'],
    },
    name: {
      type: 'string',
      required: 'yes',
      defaultValue: 'none',
      limits: [
        `1 to ${L.name.maxLength} characters: letters, digits and hyphens, with a hyphen only between two other characters.`,
        `Must not start with ${andList(L.name.reservedPrefixes.map((p) => `\`${p}\``))} (case sensitive) and must not be ${andList(L.name.reservedNames.map((p) => `\`${p}\``))} in any case.`,
        'Unique across the whole network, compared without regard to case. The name is free again when the app expires.',
        `Version 7 and older: ${RULES.legacyNameMaxLength} characters, letters and digits only.`,
      ],
      summary:
        'The identity of the app on the network and the first part of its web address, `<name>.app.runonflux.io`. It is also part of every container name.',
      mistake: 'Starting the name with `flux` or `zel`. Both prefixes are reserved.',
      lessons: ['first-deploy'],
      lint: [
        'NAME_MISSING',
        'NAME_FORMAT',
        'NAME_TOO_LONG',
        'NAME_RESERVED_PREFIX',
        'NAME_RESERVED',
        'NAME_TAKEN',
        'NAME_UPPERCASE',
        'NAME_MARKETPLACE_PREFIX',
      ],
      note: 'Registering the name of an expired app does not inherit that app’s old privileges.',
    },
    description: {
      type: 'string',
      required: 'yes',
      defaultValue: 'none',
      limits: [
        `At most ${L.descriptionMaxLength} characters. There is no validator minimum.`,
        'A missing description and an empty string both fail with "Missing Flux App specification parameter name and/or description and/or owner". A single space passes.',
      ],
      summary:
        'Free text about the app. It can also carry `networkWith:[appA,appB]`, which joins the private networks of other apps you own that run on the same node.',
      mistake: 'Writing `networkWith:appA` without the square brackets: the link is ignored.',
      lessons: ['first-deploy', 'multi-component'],
      lint: ['DESCRIPTION_MISSING', 'DESCRIPTION_TOO_LONG', 'NETWORK_WITH_FORMAT'],
      note: 'A `networkWith` link only works when every named app runs on the same node with the same owner. Otherwise the install fails.',
    },
    owner: {
      type: 'string',
      required: 'yes',
      defaultValue: 'your Flux ID, filled in by FluxCloud',
      limits: [
        'A Flux ID, an address that starts with `1`, or an Ethereum address.',
        `An Ethereum address is \`0x\` and ${RULES.ethereumHexDigits} hex characters.`,
        `The linter also checks the length (${L.owner.fluxIdMinLength} to ${L.owner.fluxIdMaxLength} characters) and the checksum of a Flux ID, as the signature library does. The FACTS notes list neither, so read it as a typo check.`,
      ],
      summary:
        'The identity whose signature authorises the registration and every later update. Lose control of it and you lose control of the app.',
      mistake:
        'Leaving a placeholder such as `YOUR_ZELID_HERE`. It is not a valid Flux ID, so the network refuses the spec.',
      lessons: ['your-toolkit'],
      lint: ['OWNER_MISSING', 'OWNER_INVALID'],
      note: 'Changing the owner is an update signed by the old owner.',
      prov: ['source', 'docs'],
    },
    compose: {
      type: 'array of components',
      required: 'yes',
      defaultValue: 'one component',
      limits: [
        `${L.component.min} to ${L.component.max} components.`,
        `Together they must fit ${num(L.totals.cpu)} cores, ${num(L.totals.ram)} MB of RAM and ${num(L.totals.hdd)} GB of disk.`,
        'Component names are unique inside the app and every public port is unique across all of them.',
      ],
      summary:
        'The containers of the app. Every instance runs all of them together on one node, on one private network.',
      mistake:
        'Sizing one component and forgetting the others: the caps and the price are for the sum of every component.',
      lessons: ['multi-component'],
      lint: [
        'COMPOSE_EMPTY',
        'COMPOSE_TOO_MANY',
        'COMPONENT_NAME_DUPLICATE',
        'TOTAL_CPU_EXCEEDED',
        'TOTAL_RAM_EXCEEDED',
        'TOTAL_HDD_EXCEEDED',
      ],
    },
    instances: {
      type: 'integer',
      required: 'yes',
      defaultValue: `${FORM_DEFAULTS.instances} in the FluxCloud form`,
      limits: [
        `${L.instances.min} to ${L.instances.max}, a whole number.`,
        `The minimum was ${L.instances.legacyMin} for versions 3 to 7. A version 8 spec may ask for ${L.instances.min} from block ${num(MIN_ONE_INSTANCE_FROM_BLOCK)}, which is long past.`,
      ],
      summary: 'How many nodes should each run a copy of the app. It drives both availability and price.',
      mistake: `Running one instance for something people rely on. The node that hosts it is the only copy, and a replacement copy can take about two hours after the node dies (${NODE.locationTtlMin} minutes plus the image pull).`,
      lessons: ['redundancy-failover', 'resources-pricing'],
      lint: [
        'INSTANCES_LOW',
        'INSTANCES_HIGH',
        'INSTANCES_FRACTIONAL',
        'INSTANCES_ONE',
        'INSTANCES_PRICE_CLIFF',
        'INSTANCES_EXCEED_NODES',
        'NODES_FEWER_THAN_INSTANCES',
        'STATEFUL_SINGLE_INSTANCE',
        'SYNC_SINGLE_INSTANCE',
      ],
      prov: ['source', 'live'],
    },
    contacts: {
      type: 'array of strings',
      required: 'yes, may be empty',
      defaultValue: json(d.contacts),
      limits: [`At most ${L.contacts.maxCount} entries, each at most ${L.contacts.maxLength} characters.`],
      summary:
        'Contact addresses (emails) that FluxOS and FluxCloud may use for expiry notices. Public unless the app is enterprise.',
      mistake: 'Putting a personal email in a public spec: anyone can read it from the API.',
      lessons: ['operate-your-app'],
      lint: ['CONTACTS_TOO_MANY', 'CONTACT_TOO_LONG', 'CONTACTS_PUBLIC'],
    },
    geolocation: {
      type: 'array of strings',
      required: 'yes, may be empty',
      defaultValue: json(d.geolocation),
      limits: [
        `At most ${L.geolocation.maxCount} entries, each at most ${L.geolocation.maxLength} characters.`,
        'An empty list means no restriction.',
        'A node must match no deny entry and, when there are allow entries, at least one of them.',
      ],
      summary:
        'Allow and deny entries for continents, countries and regions that steer where instances may run. The grammar is below.',
      mistake:
        'Allowing a place and also denying it. When every allowed place is denied, no node qualifies. Registration still accepts that list (allowing and denying Europe was accepted when tested) and nothing is promised to run.',
      lessons: ['geo-placement'],
      lint: ['GEO_TOO_MANY', 'GEO_TOO_LONG', 'GEO_SYNTAX', 'GEO_CONFLICT', 'GEO_LEGACY', 'GEO_ONE_REGION'],
      note: 'Registration is refused when your rules leave some eligible nodes but fewer than your instance count. A node whose location the network could not resolve still counts as eligible. A list that leaves no node at all is accepted and nothing is promised to run. An entry that starts with none of ac, a!c, a or b is skipped and restricts nothing. Region entries match only nodes whose region the network could resolve. This is a placement filter on IP location data, not a compliance certification.',
    },
    expire: {
      type: 'integer (blocks)',
      required: 'yes, not zero',
      defaultValue: `${num(L.expire.default)}, about one month`,
      limits: [
        `${L.expire.min} to ${num(L.expire.max)} blocks, a whole number. A multiple of ${num(RULES.legacyExpireMultiple)} is no longer required.`,
        `One month is ${num(BLOCKS_PER_MONTH)} blocks. The longest subscription is about a year.`,
      ],
      summary:
        'The subscription length in blocks, counted from the block of the latest register or update message. Every update restarts the clock.',
      mistake:
        'Setting 1 to test something. One block is how an app is cancelled: it and its data are removed within minutes to a few hours.',
      lessons: ['resources-pricing', 'operate-your-app'],
      lint: ['EXPIRE_LOW', 'EXPIRE_HIGH', 'EXPIRE_FRACTIONAL', 'EXPIRE_ONE_BLOCK', 'EXPIRE_SHORT'],
    },
    nodes: {
      type: 'array of strings',
      required: 'yes, may be empty',
      defaultValue: json(d.nodes),
      limits: [
        `At most ${L.nodes.maxCount} entries, each at most ${L.nodes.maxLength} characters: a collateral outpoint (\`txhash:index\`) or an IP with an optional port.`,
        'In version 8 only an enterprise spec may name nodes, and the network accepts a non-empty list only from owners on its enterprise owner list.',
      ],
      summary:
        'Pins the app to nodes you name. It adds the enterprise surcharge and limits placement to those nodes.',
      mistake: 'Pinning nodes in an ordinary public app. Version 8 does not allow it.',
      lessons: ['geo-placement'],
      lint: [
        'NODES_TOO_MANY',
        'NODE_ENTRY_TOO_LONG',
        'NODES_NEED_ENTERPRISE',
        'NODES_OWNER_PRIVILEGE',
        'NODES_FORMAT',
        'NODES_DUPLICATE',
        'NODES_FEWER_THAN_INSTANCES',
      ],
    },
    staticip: {
      type: 'boolean',
      required: 'yes',
      defaultValue: json(d.staticip),
      limits: ['`true` or `false`, nothing else.'],
      summary: `Only run on nodes the network classifies as having a static, directly reachable public address. It adds ${usd(r.staticip)} to the bundle the price is built from and narrows the nodes that can host the app.`,
      mistake: 'Turning it on out of habit. You pay more and placement can take longer.',
      lessons: ['geo-placement'],
      lint: ['STATICIP_COST'],
    },
    datacenter: {
      type: 'boolean',
      required: 'no',
      defaultValue: 'omitted',
      limits: [
        '`true`, `false` or left out.',
        '`true` is accepted only from owners on the enterprise owner list, or when the previous spec already had it.',
      ],
      summary: 'Only run on nodes the network classifies as data center nodes.',
      mistake: 'Setting `true` as an ordinary owner: the network does not accept it.',
      lessons: ['geo-placement'],
      lint: ['DATACENTER_PRIVILEGE'],
    },
    enterprise: {
      type: 'string',
      required: 'yes',
      defaultValue: json(d.enterprise),
      limits: [
        'A string that is always present. An empty string means a public app.',
        'Anything else is an encrypted blob that FluxCloud produces. It is not a flag.',
        'Needs ArcaneOS nodes and an `amd64` image for every component.',
      ],
      summary:
        'Seals `contacts` and `compose` in an encrypted blob so only ArcaneOS nodes can read them. It is how an app keeps secrets and uses private images.',
      mistake:
        'Writing `enterprise: "enabled"` or `true`. The field holds the encrypted blob, and FluxCloud creates it.',
      lessons: ['env-and-secrets'],
      lint: ['ENTERPRISE_OPAQUE', 'ENTERPRISE_BLOB_FORMAT', 'ENTERPRISE_PLAIN_COMPOSE', 'ENTERPRISE_AMD64'],
      note: 'Do not confuse an enterprise app with the enterprise network, a signed list of a few nodes and owners that only those owners may use.',
    },
  };
  return L.appKeys.map((key) => {
    const draft = docs[key];
    if (!draft) throw new Error(`reference: no documentation for app field "${key}"`);
    return field('app', key, draft);
  });
}

/** The 13 component keys, in the order the engine lists them (`LIMITS.componentKeys`). */
export function buildComponentFields(): FieldDoc[] {
  const L = LIMITS;
  const c = defaultComponent();
  const r = BAKED_PRICING.params;
  const docs: Record<string, Draft> = {
    name: {
      type: 'string',
      required: 'yes',
      defaultValue: 'none',
      limits: [
        `1 to ${L.component.nameMaxLength} characters: letters and digits only. No hyphens, even in version 8.`,
        `Must not start with ${andList(L.component.reservedPrefixes.map((p) => `\`${p}\``))}. Unique inside the app.`,
      ],
      summary:
        'Becomes the container name `flux<component>_<app>`, which is also how the other components reach it.',
      mistake: 'Naming a component `web-server`. The app name may contain hyphens; a component name may not.',
      lessons: ['multi-component'],
      lint: [
        'COMPONENT_NAME_MISSING',
        'COMPONENT_NAME_FORMAT',
        'COMPONENT_NAME_TOO_LONG',
        'COMPONENT_NAME_RESERVED',
        'COMPONENT_NAME_DUPLICATE',
      ],
    },
    description: {
      type: 'string',
      required: 'yes',
      defaultValue: 'none',
      limits: [`Up to ${L.descriptionMaxLength} characters.`],
      summary: 'Free text about what the component does.',
      mistake: 'Leaving the key out. Every component carries a description.',
      lessons: ['first-deploy'],
      lint: ['COMPONENT_DESCRIPTION_TOO_LONG'],
    },
    repotag: {
      type: 'string',
      required: 'yes',
      defaultValue: 'none',
      limits: [
        `Up to ${L.repotag.maxLength} characters, written \`[HOST[:PORT]/][NAMESPACE/]REPOSITORY[:TAG]\`, with no spaces.`,
        'The image must exist and be pullable. The network looks it up in its registry when you register.',
        `It needs an ${orList(L.repotag.architectures.map((a) => `\`${a}\``))} build, the same one for every component, and its compressed layers may add up to at most ${num(L.repotag.maxImageBytes)} bytes.`,
      ],
      summary:
        'The Docker image to run. It is public by default; a private image needs an enterprise app and `repoauth`.',
      mistake: `Using \`latest\` or no tag. FluxOS is set to recheck the registry about every ${NODE.imageCheckHours} hours and redeploy a changed image under the same tag (read from the source, not observed live).`,
      lessons: ['containers-101'],
      lint: [
        'REPOTAG_EMPTY',
        'REPOTAG_FORMAT',
        'REPOTAG_TOO_LONG',
        'IMAGE_UNTAGGED',
        'IMAGE_LATEST',
        'IMAGE_DOCKER_IO_HOST',
        'IMAGE_UPPERCASE',
        'IMAGE_MAYBE_HUGE',
        'IMAGE_IMPLICIT_REGISTRY',
      ],
    },
    ports: {
      type: 'array of integers',
      required: 'yes, may be empty',
      defaultValue: json([]),
      limits: [
        `At most ${L.ports.perComponentMax} entries per component, each a whole number from ${L.ports.min} to ${L.ports.max}.`,
        'Unique across every component of the app, and free on the node that hosts it.',
        `Not on the banned list of ${bannedCount()} entries (see Networking).`,
        `${feePortsText()} are fee ports: each adds ${usd(r.port)} to the monthly bundle, which is divided by ${BUNDLE_INSTANCES} and billed per instance (${perInstanceFee(r.port)}, growing with the instance count). Each port is published for both TCP and UDP.`,
      ],
      summary:
        'The public ports on the node: one for each port you want reachable from outside. `ports[i]` forwards to `containerPorts[i]`.',
      mistake: `Publishing ${FEE_PORT_EXAMPLES.web} or ${FEE_PORT_EXAMPLES.alt} for a plain web app. Both are fee ports. Publish a port outside ${feePortsText()}, such as ${FREE_PORT_EXAMPLE}, and map it to the container port you need.`,
      lessons: ['ports-and-domains'],
      lint: [
        'PORT_NOT_INTEGER',
        'PORT_RANGE',
        'PORT_BANNED',
        'PORT_DUPLICATE',
        'PORTS_TOO_MANY',
        'PORT_LENGTH_MISMATCH',
        'PORT_FEE',
        'NO_PUBLIC_PORT',
        'DATABASE_PORT_PUBLIC',
      ],
    },
    containerPorts: {
      type: 'array of integers',
      required: 'yes',
      defaultValue: json([]),
      limits: [
        `The same length as \`ports\`; each a whole number from ${L.ports.containerMin} to ${L.ports.containerMax}.`,
        'It must be the port the process really listens on, and the process must listen on `0.0.0.0`.',
      ],
      summary:
        'The port inside the container that traffic is forwarded to: `containerPorts[i]` receives what arrives on `ports[i]`.',
      mistake:
        'Setting it to the public port instead of the port the process listens on. The request arrives and nothing answers.',
      lessons: ['ports-and-domains'],
      lint: [
        'CONTAINER_PORT_RANGE',
        'PORT_LENGTH_MISMATCH',
        'PORT_ENV_MISMATCH',
        'CONTAINER_PORT_UNUSUAL',
        'BIND_LOCALHOST',
        'PORT_PRIVILEGED_CONTAINER',
      ],
    },
    domains: {
      type: 'array of strings',
      required: 'yes',
      defaultValue: json(['']),
      limits: [
        `The same length as \`ports\`; each entry up to ${L.domains.maxLength} characters. Use \`""\` for none.`,
        'One entry may hold several domains separated by commas.',
      ],
      summary:
        'Custom domains the domain manager serves for the port at the same position. Pointing DNS at the app is a separate step.',
      mistake: 'Adding the domain here and forgetting the DNS record, or the reverse. You need both.',
      lessons: ['custom-domains'],
      lint: [
        'DOMAINS_LENGTH_MISMATCH',
        'DOMAIN_TOO_LONG',
        'DOMAIN_FORMAT',
        'DOMAIN_IS_GENERATED',
        'DOMAIN_APEX',
      ],
    },
    environmentParameters: {
      type: 'array of strings',
      required: 'yes, may be empty',
      defaultValue: json([]),
      limits: [
        `At most ${L.environment.maxCount} entries, each at most ${L.environment.maxLength} characters, written \`KEY=value\`.`,
        'Public in the spec unless the app is enterprise.',
        'FluxOS adds `FLUX_APP_NAME` and `FLUX_NODE_HOST_IP` when it starts the container, and its values win.',
      ],
      summary: 'Environment variables for the container.',
      mistake:
        'Putting a password here in a public app. Anyone can read it at `/apps/appspecifications/<name>`.',
      lessons: ['env-and-secrets'],
      lint: [
        'ENV_TOO_MANY',
        'ENV_TOO_LONG',
        'ENV_FORMAT',
        'ENV_WHITESPACE',
        'ENV_SECRET_PUBLIC',
        'ENV_RESERVED_NAME',
        'STORAGE_LINK_INVALID',
      ],
      prov: ['source', 'live'],
    },
    commands: {
      type: 'array of strings',
      required: 'yes, may be empty',
      defaultValue: json([]),
      limits: [
        `At most ${L.commands.maxCount} entries, each at most ${L.commands.maxLength} characters.`,
        'Each entry is one argument. The list is the Docker `Cmd`, not a shell line.',
      ],
      summary:
        'Arguments passed to the image’s entrypoint when the container starts. Leave it empty to use the image’s own default.',
      mistake:
        'Writing one string such as `redis-server --save ""`. Every argument is its own entry: `["redis-server", "--save", ""]`.',
      lessons: ['env-and-secrets'],
      lint: [
        'COMMANDS_TOO_MANY',
        'COMMAND_TOO_LONG',
        'COMMAND_UNSPLIT',
        'COMMAND_PRIVILEGED',
        'STORAGE_LINK_INVALID',
      ],
      note: 'Flux removes a `--privileged` argument silently.',
    },
    containerData: {
      type: 'string',
      required: 'yes',
      defaultValue: `${json(c.containerData)} when you want no data`,
      limits: [
        `${L.containerData.minLength} to ${L.containerData.maxLength} characters. Use \`/tmp\` when you want no persistent data.`,
        `The first mount is the primary mount, and the only one that may carry a sync flag (${andList(L.containerData.syncFlags.map((f) => `\`${f}:\``))}).`,
        'The grammar is below.',
      ],
      summary: 'Where the container keeps data that should outlive it, and how that data is replicated.',
      mistake:
        'Leaving a database on a plain `/path`, including `/tmp`, or on a folder that is not mounted. A plain volume lives on one node only: if that node fails, the replacement starts empty. A folder that is not mounted goes with the container.',
      lessons: ['persistent-storage'],
      lint: [
        'CONTAINER_DATA_TOO_SHORT',
        'CONTAINER_DATA_TOO_LONG',
        'CONTAINER_DATA_SYNTAX',
        'CONTAINER_DATA_COMPONENT_REF',
        'CONTAINER_DATA_SYNC_FLAGS',
        'STATEFUL_NO_VOLUME',
        'STATEFUL_NOT_SYNCED',
        'DB_ON_REPLICATED_MOUNT',
      ],
    },
    repoauth: {
      type: 'string',
      required: 'yes, may be empty',
      defaultValue: json(c.repoauth),
      limits: [
        `Up to ${num(L.repoauth.maxLength)} characters. Empty for a public image.`,
        'Non-empty only when the app is enterprise.',
        '`username:token`, or a provider address that starts with `aws-ecr://`, `azure-acr://` or `google-gar://`. The Simple form hint shows shorter names that the source read does not register.',
      ],
      summary: 'Credentials the node uses to pull a private image.',
      mistake:
        'Putting credentials in a public spec. The network refuses it: `repoauth` is only allowed on an enterprise app.',
      lessons: ['env-and-secrets'],
      lint: ['REPOAUTH_NEEDS_ENTERPRISE', 'REPOAUTH_TOO_LONG', 'REPOAUTH_FORMAT'],
    },
    cpu: {
      type: 'number (cores)',
      required: 'yes',
      defaultValue: `${FORM_DEFAULTS.cpu} in the FluxCloud form`,
      limits: [
        `At most 8 decimals. The FluxCloud form moves in steps of ${FORM_STEPS.cpu}; the validator enforces no step.`,
        `The sum over all components may not exceed ${num(L.totals.cpu)} cores.`,
        'The backend sets no minimum per component for version 4 and later.',
      ],
      summary: `The container’s CPU limit in cores. The bundle price counts ${usd(r.cpu)} per ${FORM_STEPS.cpu} core.`,
      mistake: `Asking for more than the biggest node tier can give. The sum is capped at ${num(L.totals.cpu)} cores.`,
      lessons: ['resources-pricing'],
      lint: [
        'RESOURCE_NOT_POSITIVE',
        'RESOURCE_DECIMALS',
        'CPU_STEP',
        'TOTAL_CPU_EXCEEDED',
        'SIZE_EXCLUDES_CUMULUS',
        'SIZE_NEEDS_STRATUS',
      ],
    },
    ram: {
      type: 'number (MB)',
      required: 'yes',
      defaultValue: `${num(FORM_DEFAULTS.ram)} in the FluxCloud form`,
      limits: [
        `Megabytes. The FluxCloud form moves in steps of ${FORM_STEPS.ramMb}; the validator enforces no step.`,
        `The sum over all components may not exceed ${num(L.totals.ram)} MB.`,
        `Docker gets this much memory plus ${num(NODE.swapMb)} MB of swap.`,
      ],
      prov: ['source', 'inference'],
      summary: `The container’s memory limit in MB. The bundle price counts ${usd(r.ram)} per ${FORM_STEPS.ramMb} MB.`,
      mistake:
        'Sizing RAM to the average instead of the peak. A container that goes over its memory limit can be killed by Docker, and FluxOS restarts exited containers with growing pauses, so it can look like a crash loop.',
      lessons: ['resources-pricing'],
      lint: [
        'RESOURCE_NOT_POSITIVE',
        'RESOURCE_DECIMALS',
        'RAM_STEP',
        'TOTAL_RAM_EXCEEDED',
        'RAM_TOO_SMALL_FOR_IMAGE',
        'SIZE_EXCLUDES_CUMULUS',
        'SIZE_NEEDS_STRATUS',
      ],
    },
    hdd: {
      type: 'number (GB)',
      required: 'yes',
      defaultValue: `${FORM_DEFAULTS.hdd} in the FluxCloud form`,
      limits: [
        'Gigabytes. Whole numbers are the practical choice: the volume is allocated in whole GB.',
        `The sum over all components may not exceed ${num(L.totals.hdd)} GB.`,
        'Every mount of the component shares this one volume.',
      ],
      summary: `The size of the component’s persistent volume, a file on the node formatted as ext4. The bundle price counts ${usd(r.hdd)} per GB.`,
      mistake:
        'Giving a database a tiny volume. When it fills, writes fail with "No space left on device", and growing it later redeploys the app from scratch, so back up first.',
      lessons: ['resources-pricing', 'persistent-storage'],
      lint: [
        'RESOURCE_NOT_POSITIVE',
        'RESOURCE_DECIMALS',
        'HDD_STEP',
        'TOTAL_HDD_EXCEEDED',
        'DISK_SMALL_STATEFUL',
        'SIZE_EXCLUDES_CUMULUS',
        'SIZE_NEEDS_STRATUS',
      ],
    },
  };
  return L.componentKeys.map((key) => {
    const draft = docs[key];
    if (!draft) throw new Error(`reference: no documentation for component field "${key}"`);
    return field('component', key, draft);
  });
}

/** Lint codes about the spec as a whole, which no single field owns. */
export const WHOLE_SPEC_CODES: readonly string[] = ['UNKNOWN_FIELD', 'FIELD_MISSING', 'FIELD_COERCED'];

export function buildFieldDocs(): FieldDoc[] {
  return [...buildAppFields(), ...buildComponentFields()];
}

// ---------------------------------------------------------------------------
// Geolocation grammar
// ---------------------------------------------------------------------------

export interface GeoForm {
  /** Anchor suffix: `geo-form-<id>`. */
  id: string;
  /** The general shape, for example `ac<CONT>_<CC>`. */
  pattern: string;
  /** A concrete entry the table parses live. */
  example: string;
  meaning: string;
  legacy: boolean;
  /** Anything the reader should not miss. Markup. */
  note?: string;
}

/** FACTS 3.5. The `example` of each form is parsed by the engine when the page renders. */
export function buildGeoForms(): GeoForm[] {
  return [
    { id: 'all', pattern: 'acALL', example: 'acALL', meaning: 'Allow every location.', legacy: false },
    {
      id: 'continent',
      pattern: 'ac<CONT>',
      example: 'acEU',
      meaning: 'Allow a continent. `ac<CONT>_ALL` means the same.',
      legacy: false,
    },
    {
      id: 'country',
      pattern: 'ac<CONT>_<CC>',
      example: 'acEU_DE',
      meaning: 'Allow a country.',
      legacy: false,
    },
    {
      id: 'region',
      pattern: 'ac<CONT>_<CC>_<REGION>',
      example: 'acEU_DE_BY',
      meaning: 'Allow a region.',
      legacy: false,
      note: 'The region is an ISO region code. Older region names from the IP database also resolve.',
    },
    {
      id: 'deny-continent',
      pattern: 'a!c<CONT>',
      example: 'a!cNA',
      meaning: 'Deny a continent.',
      legacy: false,
    },
    {
      id: 'deny-country',
      pattern: 'a!c<CONT>_<CC>',
      example: 'a!cNA_US',
      meaning: 'Deny a country.',
      legacy: false,
    },
    {
      id: 'deny-region',
      pattern: 'a!c<CONT>_<CC>_<REGION>',
      example: 'a!cEU_DE_BY',
      meaning: 'Deny a region.',
      legacy: false,
    },
    {
      id: 'legacy-continent',
      pattern: 'a<CONT>',
      example: 'aEU',
      meaning: 'Old style: allow only that continent. The first one wins.',
      legacy: true,
    },
    {
      id: 'legacy-country',
      pattern: 'b<CC>',
      example: 'bDE',
      meaning: 'Old style: allow only that country. The first one wins.',
      legacy: true,
    },
  ];
}

export interface GeoPitfall {
  id: string;
  entry: string;
  text: string;
  prov: readonly Provenance[];
}

/** Entries and behaviours that look right and are not. FACTS 3.5. */
export function buildGeoPitfalls(): GeoPitfall[] {
  return [
    {
      id: 'deny-all',
      entry: 'a!cALL',
      text: 'Denying `ALL` (or `a!cEU_ALL`) bans nothing: the deny entry is compared as a whole. The linter flags it.',
      prov: ['source'],
    },
    {
      id: 'region-pin',
      entry: 'acEU_DE_XX',
      text: 'A region pin is matched on proof only. A node whose region the IP table cannot resolve satisfies no region allow and is caught by no region deny.',
      prov: ['source'],
    },
    {
      id: 'enterprise',
      entry: 'enterprise',
      text: 'FluxCloud says geolocation is not available for enterprise apps. The network’s validator has no such rule, and a live enterprise app does carry deny entries. Treat the FluxCloud statement as a form limit.',
      prov: ['docs', 'live'],
    },
  ];
}

// ---------------------------------------------------------------------------
// containerData grammar
// ---------------------------------------------------------------------------

export interface MountForm {
  /** Anchor suffix: `mount-<id>`. */
  id: string;
  form: string;
  example: string;
  meaning: string;
  /** Markup. */
  note?: string;
  prov: readonly Provenance[];
}

/** FACTS 7.1. */
export function buildMountForms(): MountForm[] {
  return [
    {
      id: 'primary',
      form: '/path',
      example: '/data',
      meaning: 'The primary mount with no sync: a local volume on that node.',
      note: 'The path must be absolute and must not contain `..`.',
      prov: ['source'],
    },
    {
      id: 'primary-r',
      form: 'r:/path',
      example: 'r:/data',
      meaning:
        'The primary mount, synced between instances by Syncthing. Every instance is active and writes.',
      prov: ['source'],
    },
    {
      id: 'primary-g',
      form: 'g:/path',
      example: 'g:/var/lib/mysql',
      meaning:
        'The primary mount in primary and standby mode: one elected instance runs and the others hold a synced copy. The domain manager routes only to the primary.',
      prov: ['source'],
    },
    {
      id: 'primary-s',
      form: 's:/path',
      example: 's:/data',
      meaning:
        'The primary mount synced by Syncthing, with no election and no readiness gating by the sync state machine.',
      note: 'Inferred from the source and not documented anywhere. Use `r:` or `g:` unless you have tested it.',
      prov: ['unverified'],
    },
    {
      id: 'subdir',
      form: 'm:<subdir>:<path>',
      example: '/data|m:logs:/var/log',
      meaning: 'An extra directory on the same volume, a sibling of `appdata`.',
      note: 'The subdirectory name has no `/` or `..` and must not be a reserved name.',
      prov: ['source'],
    },
    {
      id: 'subdir-local',
      form: 'ml:<subdir>:<path>',
      example: '/data|ml:cache:/var/cache',
      meaning: 'An extra directory that is never replicated. Use it for caches and large downloads.',
      prov: ['source'],
    },
    {
      id: 'file',
      form: 'f:<file>:<path>',
      example: '/data|f:config.yaml:/etc/app.yaml',
      meaning: 'A single file mount, created empty. The app has to initialise it.',
      prov: ['source'],
    },
    {
      id: 'other-primary',
      form: '<n>:<path>',
      example: '/data|0:/shared',
      meaning: 'The primary mount of another component, by its position `n` in `compose`.',
      note: 'Only a lower index can be named, so the component that owns the volume comes first.',
      prov: ['source'],
    },
    {
      id: 'other-subdir',
      form: 'c:<n>:<subdir>:<path>',
      example: '/data|c:0:logs:/logs',
      meaning: 'A directory of another component’s volume.',
      prov: ['source'],
    },
    {
      id: 'other-file',
      form: 'cf:<n>:<file>:<path>',
      example: '/data|cf:0:config.yaml:/etc/app.yaml',
      meaning: 'A file of another component’s volume.',
      prov: ['source'],
    },
  ];
}

export interface StorageGuarantee {
  /** Anchor suffix: `storage-<id>`. */
  id: string;
  prefix: string;
  lives: string;
  restart: string;
  nodeLoss: string;
  consistency: string;
  prov: readonly Provenance[];
}

/** FACTS 7.2. */
export function buildStorageGuarantees(): StorageGuarantee[] {
  return [
    {
      id: 'none',
      prefix: 'none',
      lives: 'One volume file on that one node',
      restart: 'Yes',
      nodeLoss: 'No. The replacement instance starts empty on another node.',
      consistency: 'Every instance has its own data, so instances drift apart.',
      prov: ['source'],
    },
    {
      id: 'r',
      prefix: 'r:',
      lives: 'A volume on every instance, replicated by Syncthing. All instances are active.',
      restart: 'Yes',
      nodeLoss: 'Yes, while at least one instance with current data remains.',
      consistency:
        'Eventually consistent. Every instance writes, so conflicts are possible. This is file replication, not a database cluster.',
      prov: ['source'],
    },
    {
      id: 'g',
      prefix: 'g:',
      lives: 'A volume on every instance. Only the primary runs the container.',
      restart: 'Yes',
      nodeLoss: 'Yes, after a new primary is elected, which takes a delay of minutes.',
      consistency: 'One writer. The standby copies receive only.',
      prov: ['source'],
    },
    {
      id: 's',
      prefix: 's:',
      lives: 'A volume on every instance, synced.',
      restart: 'Yes',
      nodeLoss: 'Yes',
      consistency: 'The same as `r:` without the start gating. Not documented.',
      prov: ['unverified'],
    },
  ];
}

export interface StorageMechanic {
  /** Anchor suffix: `mechanic-<id>`. */
  id: string;
  topic: string;
  fact: string;
  prov: readonly Provenance[];
}

/** FACTS 7.3. */
export function buildStorageMechanics(): StorageMechanic[] {
  return [
    {
      id: 'size',
      topic: 'Size',
      fact: '`hdd` gigabytes, a pre-allocated ext4 file loop mounted for the component. Every mount of the component shares it. When it is full the container sees `ENOSPC`.',
      prov: ['source'],
    },
    {
      id: 'rootfs',
      topic: 'Container filesystem',
      fact: `Writes outside a volume go to the container’s own filesystem, which is capped at ${NODE.rootfsGb} GB on nodes whose Docker uses XFS project quota. It does not count against \`hdd\` and the cap depends on the node.`,
      prov: ['source'],
    },
    {
      id: 'redeploy',
      topic: 'Soft and hard redeploy',
      fact: 'A soft redeploy keeps the volume. A hard redeploy recreates it from nothing. A structural change to a version 8 spec escalates a soft redeploy to a hard one, so back up before you change the shape of an app.',
      prov: ['source', 'docs'],
    },
    {
      id: 'synced',
      topic: 'Synced volumes',
      fact: `A new instance must finish the initial sync before it serves. A stalled sync is nudged after ${SYNC.stalledNudgeMin} minutes and removed after ${SYNC.stalledRemoveMin} minutes of evidence.`,
      prov: ['source'],
    },
    {
      id: 'scope',
      topic: 'Sync scope',
      fact: 'A sync flag on the primary mount applies to the whole component folder: `appdata` and every `m:` and `f:` sibling are replicated. `ml:` is the exception.',
      prov: ['source'],
    },
    {
      id: 'permissions',
      topic: 'Permissions',
      fact: 'FluxOS fixes the owner of the volume to what the container expects before a node becomes sync leader. An image that runs as a non-root user may still need its own `chown` at start. The symptom is "permission denied" on the data folder.',
      prov: ['source', 'unverified'],
    },
    {
      id: 'destroyed',
      topic: 'What destroys it',
      fact: 'Remove, hard reinstall, cancel and expiry destroy a plain volume. Download a backup before any of them.',
      prov: ['source', 'docs'],
    },
  ];
}

// ---------------------------------------------------------------------------
// expire and blocks
// ---------------------------------------------------------------------------

export interface ExpireRow {
  /** Anchor suffix: `expire-<id>`. */
  id: string;
  label: string;
  blocks: number;
  /** "about 30 days 13 hours" */
  about: string;
  /** Percent off for a subscription this long, 0 for none. */
  discountPct: number;
}

/** Subscription lengths people pick, in blocks, derived with the engine's blocks helpers. */
export function buildExpireRows(): ExpireRow[] {
  const row = (id: string, label: string, blocks: number): ExpireRow => {
    const months = blocks / BLOCKS_PER_MONTH;
    const disc = durationDiscount(months);
    return {
      id,
      label,
      blocks,
      about: `about ${humanDuration(blocksToSeconds(blocks))}`,
      discountPct: disc ? Math.round((1 - disc.factor) * 100) : 0, // literal: percent
    };
  };
  return [
    row('hour', '1 hour', daysToBlocks(1 / 24)), // literal: hours in a day
    row('day', '1 day', daysToBlocks(1)),
    row('week', '1 week', daysToBlocks(7)),
    row('fortnight', '2 weeks', daysToBlocks(14)), // literal: days in two weeks
    row('month', '1 month, the pricing unit', BLOCKS_PER_MONTH),
    row('quarter', '3 months', monthsToBlocks(3)),
    row('half', '6 months', monthsToBlocks(6)),
    row('year', `${MAX_EXPIRE_BLOCKS / BLOCKS_PER_MONTH} months, the longest`, MAX_EXPIRE_BLOCKS),
  ];
}

// ---------------------------------------------------------------------------
// Pricing, in plain language
// ---------------------------------------------------------------------------

export interface PriceStep {
  id: string;
  title: string;
  /** Markup. */
  body: string;
  /** How well the step is known. Defaults to read in the source and matched against the live calculator. */
  prov?: readonly Provenance[];
}

function percentOff(factor: number): number {
  return Math.round((1 - factor) * 100); // literal: percent
}

/** FACTS 4.3 and 4.4, in the order the calculator applies them. Numbers are read from the engine. */
export function buildPriceSteps(): PriceStep[] {
  const p = BAKED_PRICING.params;
  const discounts = [...DURATION_DISCOUNTS].sort((a, b) => a.minMonths - b.minMonths);
  const [small, mid] = HW_DISCOUNTS;
  if (!small || !mid) throw new Error('reference: HW_DISCOUNTS changed shape');
  const priced = MARKETPLACE_MULTIPLIERS.filter((m) => m.multiplier > 1).slice(0, 2);
  const marketNames = andList(priced.map((m) => `\`${m.name}\``));
  const cliff = HW_DISCOUNT_MAX_INSTANCES + 1;
  return [
    {
      id: 'resources',
      title: 'Add up the resources',
      body: `Add the CPU, RAM and disk of every component and price them at the official rates, which are stated for a bundle of ${BUNDLE_INSTANCES} instances: ${usd(p.cpu)} per ${FORM_STEPS.cpu} core, ${usd(p.ram)} per ${FORM_STEPS.ramMb} MB of RAM and ${usd(p.hdd)} per GB of disk.`,
    },
    {
      id: 'extras',
      title: 'Add the extras to the bundle',
      body: `Add ${usd(p.scope)} when the app is enterprise or pins nodes, ${usd(p.staticip)} for a static IP and ${usd(p.port)} for each fee port. They go into the bundle before it is divided by ${BUNDLE_INSTANCES}, so each one costs about a third of its rate per instance (${perInstanceFee(p.port)} for a fee port or a static IP) and grows with the instance count. It equals the rate only at ${BUNDLE_INSTANCES} instances. The enterprise fee was checked live only through the pinned nodes path, not with a real encrypted spec.`,
    },
    {
      id: 'per-instance',
      title: 'Price one instance',
      body: `Divide the bundle by ${BUNDLE_INSTANCES} and round up to the cent. The rates are stated for ${BUNDLE_INSTANCES} instances, so a third of the bundle is one instance.`,
    },
    {
      id: 'instances',
      title: 'Multiply by the instances',
      body: `One instance price times the number of instances, rounded up to the cent. One exception for cheap apps: when one instance costs less than ${usd(EXTRA_INSTANCE_FLOOR_USD)} and there are more than ${RULES.flatExtraInstancesAbove} instances after the first, each extra instance is a flat ${usd(EXTRA_INSTANCE_FLOOR_USD)}.`,
    },
    {
      id: 'minimum',
      title: 'Apply the minimum',
      body: `No subscription costs less than ${usd(p.minUSDPrice)}, whatever its length. There is no free tier. The floor applies again after the discounts.`,
    },
    {
      id: 'length',
      title: 'Scale to the subscription',
      body: `Multiply by \`expire\` divided by ${num(BLOCKS_PER_MONTH)}. A subscription of ${num(BLOCKS_PER_MONTH)} blocks is one month, so a year costs twelve times the month before any discount.`,
    },
    {
      id: 'small-app',
      title: 'Take the small app discount',
      body: `With ${HW_DISCOUNT_MAX_INSTANCES} instances or fewer, an app under ${small.maxCpu} cores, ${num(small.maxRam)} MB of RAM and ${small.maxHdd} GB of disk gets ${percentOff(small.factor)} percent off. Under ${mid.maxCpu} cores, ${num(mid.maxRam)} MB and ${mid.maxHdd} GB it gets ${percentOff(mid.factor)} percent. The totals of all components count. The discount stops at ${cliff} instances, which is why ${cliff} can cost much more than ${HW_DISCOUNT_MAX_INSTANCES}. For a cheap app the flat ${usd(EXTRA_INSTANCE_FLOOR_USD)} rule of the instances step starts at the same count, so two things change at once.`,
    },
    {
      id: 'marketplace',
      title: 'A few names carry a multiplier',
      body: `A name that starts with a Flux marketplace app that has a price multiplier, such as ${marketNames}, is multiplied by it. Every other name is not. A network wide multiplier also exists and is ${p.multiplier} at the time of writing. The linter warns when a name starts with one of the marketplace names. The names are a snapshot from ${CHECKED.date}, and this step was read in the source: none of the live test quotes used a name with a multiplier.`,
      prov: ['source'],
    },
    {
      id: 'duration',
      title: 'Take the long subscription discount',
      body: `${andList(
        discounts.map((d) => `${d.minMonths} months or more takes ${percentOff(d.factor)} percent off`),
      )}. The minimum applies again after the discount.`,
    },
    {
      id: 'rounding',
      title: 'Round up to .49 or .99',
      body: 'The total is rounded up to the next price that ends in .49 or .99. This is the last step of the USD price.',
    },
    {
      id: 'flux',
      title: 'Convert to FLUX',
      body: `FLUX is the USD price divided by the FLUX price and multiplied by ${p.fluxmultiplier}, so paying in FLUX is ${percentOff(p.fluxmultiplier)} percent cheaper than the USD figure at market.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// At a glance
// ---------------------------------------------------------------------------

export interface CapTile {
  /** Anchor suffix: `cap-<id>`. */
  id: string;
  label: string;
  value: string;
  /** One short sentence. Markup. */
  note: string;
  /** The field row that explains it (`component-ports`). */
  field: string;
}

/** The size caps of a version 8 spec, read from the engine. */
export function buildCaps(): CapTile[] {
  const L = LIMITS;
  const imageGb = L.repotag.maxImageBytes / 1_000_000_000; // literal: bytes in a decimal gigabyte
  return [
    {
      id: 'name',
      label: 'App name',
      value: `${L.name.maxLength} characters`,
      note: 'Letters, digits and inner hyphens.',
      field: 'app-name',
    },
    {
      id: 'components',
      label: 'Components',
      value: `${L.component.min} to ${L.component.max}`,
      note: 'Each one becomes a container.',
      field: 'app-compose',
    },
    {
      id: 'instances',
      label: 'Instances',
      value: `${L.instances.min} to ${L.instances.max}`,
      note: `The small app discount ends at ${L.instances.smallAppDiscountBelow}, and a cheap app then pays a flat ${usd(EXTRA_INSTANCE_FLOOR_USD)} for each instance after the first.`,
      field: 'app-instances',
    },
    {
      id: 'ports',
      label: 'Public ports',
      value: `up to ${L.ports.perComponentMax}`,
      note: 'Per component, unique across the app.',
      field: 'component-ports',
    },
    {
      id: 'cpu',
      label: 'CPU in total',
      value: `${L.totals.cpu} cores`,
      note: 'Added up over every component.',
      field: 'component-cpu',
    },
    {
      id: 'ram',
      label: 'RAM in total',
      value: `${num(L.totals.ram)} MB`,
      note: 'Added up over every component.',
      field: 'component-ram',
    },
    {
      id: 'hdd',
      label: 'Disk in total',
      value: `${L.totals.hdd} GB`,
      note: 'Added up over every component.',
      field: 'component-hdd',
    },
    {
      id: 'env',
      label: 'Variables',
      value: `${L.environment.maxCount} per component`,
      note: `\`KEY=value\`, up to ${L.environment.maxLength} characters each.`,
      field: 'component-environmentParameters',
    },
    {
      id: 'image',
      label: 'Image size',
      value: `${imageGb} GB`,
      note: 'Compressed layers, added up.',
      field: 'component-repotag',
    },
    {
      id: 'expire',
      label: 'Subscription',
      value: `${num(L.expire.max)} blocks`,
      note: `The longest, about ${humanDuration(blocksToSeconds(L.expire.max))}.`,
      field: 'app-expire',
    },
  ];
}

export interface GlanceMistake {
  /** Anchor suffix: `mistake-<id>`. */
  id: string;
  /** What people do. Markup. */
  text: string;
  /** The lint code that catches it. */
  code: string;
  /** The field row to read. */
  field: string;
}

/** The mistakes behind most refused or surprising specs, each with the code that catches it. */
export function buildGlanceMistakes(): GlanceMistake[] {
  const L = LIMITS;
  const prefixes = andList(L.name.reservedPrefixes.map((p) => `\`${p}\``));
  return [
    {
      id: 'name-prefix',
      text: `Starting the app name with ${prefixes}. Both prefixes are reserved.`,
      code: 'NAME_RESERVED_PREFIX',
      field: 'app-name',
    },
    {
      id: 'owner',
      text: 'Leaving a placeholder such as `YOUR_ZELID_HERE` in `owner`.',
      code: 'OWNER_INVALID',
      field: 'app-owner',
    },
    {
      id: 'banned-port',
      text: 'Publishing a port from the banned list, such as the SSH port, instead of mapping it to a container port.',
      code: 'PORT_BANNED',
      field: 'component-ports',
    },
    {
      id: 'port-lengths',
      text: 'Giving `ports`, `containerPorts` and `domains` different lengths. They pair up by position.',
      code: 'PORT_LENGTH_MISMATCH',
      field: 'component-containerPorts',
    },
    {
      id: 'component-name',
      text: 'Putting a hyphen in a component name. App names may have one, component names may not.',
      code: 'COMPONENT_NAME_FORMAT',
      field: 'component-name',
    },
    {
      id: 'latest',
      text: 'Using the `latest` tag, so a node pulls a different image when the tag moves.',
      code: 'IMAGE_LATEST',
      field: 'component-repotag',
    },
    {
      id: 'no-data',
      text: `Leaving \`containerData\` empty. Use \`/tmp\` when no data folder is wanted: it needs at least ${L.containerData.minLength} characters.`,
      code: 'CONTAINER_DATA_TOO_SHORT',
      field: 'component-containerData',
    },
  ];
}

// ---------------------------------------------------------------------------
// nodes, enterprise and datacenter
// ---------------------------------------------------------------------------

/** FACTS 2.5, 3.2, 3.7 and 8.4. */
export function buildEnterpriseFacts(): FactRow[] {
  const L = LIMITS;
  const p = BAKED_PRICING.params;
  const arch = andList(L.enterprise.requiredArchitectures.map((a) => `\`${a}\``));
  return [
    {
      id: 'what',
      label: '`enterprise`',
      text: 'An encrypted app. Its `contacts` and `compose` are stored as an encrypted blob, so the ports, images and variables are not readable on chain. The field holds the blob as base64, and an empty string means a public app.',
      prov: ['source', 'live'],
    },
    {
      id: 'who-runs',
      label: 'Which nodes run it',
      text: 'Only nodes that run ArcaneOS can decrypt the spec. Other nodes skip enterprise apps, so the spec is validated and priced only by an ArcaneOS node.',
      prov: ['source'],
    },
    {
      id: 'architecture',
      label: 'Image architecture',
      text: `Every component needs an ${arch} build, because ArcaneOS nodes are amd64 only. A public app only needs one architecture that all its components share.`,
      prov: ['source'],
    },
    {
      id: 'private-images',
      label: 'Private images',
      text: `\`repoauth\` is only accepted on an enterprise app, up to ${num(L.repoauth.maxLength)} characters. Formats are \`user:token\` or \`aws-ecr://...\`, \`azure-acr://...\` and \`google-gar://...\`.`,
      prov: ['source'],
    },
    {
      id: 'nodes',
      label: '`nodes`',
      text: `Pins the app to named nodes: up to ${L.nodes.maxCount} entries of up to ${L.nodes.maxLength} characters, each \`txhash:outidx\` or \`ip[:port]\`. In version 8 it needs \`enterprise\`, and a live submission with a non empty list is only accepted from owners on the network policy list.`,
      prov: ['source'],
    },
    {
      id: 'datacenter',
      label: '`datacenter`',
      text: 'Only run on nodes classed as data center nodes. `true` is accepted from owners on the network policy list, or when the previous spec already had it. Leave the key out otherwise.',
      prov: ['source'],
    },
    {
      id: 'price',
      label: 'What it costs',
      text: `An enterprise app adds ${usd(p.scope)} to the bundle before it is divided by ${BUNDLE_INSTANCES}, about ${usd(p.scope / BUNDLE_INSTANCES)} per instance, growing with the instance count. That is read in the source. Pricing a real encrypted spec was not run live, so treat the figure as the best reading of the code. The price is stated by the calculator, not by the spec.`,
      prov: ['source', 'docs'],
    },
    {
      id: 'price-pinned',
      label: 'What pinning costs',
      text: `An app that pins nodes adds the same ${usd(p.scope)} to the bundle, through the same code path as an enterprise app. This one was checked against the live calculator.`,
      prov: ['source', 'live'],
    },
    {
      id: 'two-lists',
      label: 'Two meanings of enterprise',
      text: 'The `enterprise` field means the app is encrypted. The enterprise network is a signed list that maps a few node keys to a few owner addresses; apps of those owners run only on those nodes. They are different things.',
      prov: ['source', 'live'],
    },
    {
      id: 'burst',
      label: 'CPU headroom',
      text: 'An enterprise app is also given automatic CPU burst on nodes that support it, and the node keeps more than 4 cores free for it. The reservation is in the source. The burst behaviour was not tested on a live node.',
      prov: ['source', 'unverified'],
    },
  ];
}

// ---------------------------------------------------------------------------
// expire
// ---------------------------------------------------------------------------

/** FACTS 5.1 to 5.4. */
export function buildExpireFacts(): FactRow[] {
  const L = LIMITS;
  const monthText = humanDuration(blocksToSeconds(BLOCKS_PER_MONTH));
  return [
    {
      id: 'unit',
      label: 'What it counts',
      text: 'Blocks of life, counted from the block at which the latest register or update message was mined. The app ends at that block height plus `expire`.',
      prov: ['source'],
    },
    {
      id: 'range',
      label: 'Range',
      text: `${L.expire.min} to ${num(L.expire.max)} blocks, as a whole number. A multiple of ${num(RULES.legacyExpireMultiple)} has not been required since block ${num(RULES.legacyExpireRuleEndBlock)}.`,
      prov: ['source'],
    },
    {
      id: 'pricing-month',
      label: 'A pricing month',
      text: `${num(BLOCKS_PER_MONTH)} blocks, which is about ${monthText} at the target block time. It is a billing unit, not a calendar month.`,
      prov: ['source', 'live'],
    },
    {
      id: 'prepaid',
      label: 'How it is paid',
      text: 'In full, in advance, for the whole subscription. Nothing is charged per block, and the protocol has no refund.',
      prov: ['source', 'docs'],
    },
    {
      id: 'update',
      label: 'An update restarts the clock',
      text: 'The new message starts a new count from its own height. The price credits the unused part of the old subscription, so a normal update with the same `expire` runs for a full `expire` again.',
      prov: ['source'],
    },
    {
      id: 'end',
      label: 'At the end',
      text: 'The app is dropped from the network list, and nodes remove its containers and volumes within minutes to a few hours. There is no grace period. The name becomes free again.',
      prov: ['source', 'docs'],
    },
    {
      id: 'cancel',
      label: 'Cancelling',
      text: `\`expire\` of ${L.expire.min} block cancels the app: it is removed network wide and its data is lost. Back up first.`,
      prov: ['source', 'docs'],
    },
    {
      id: 'ceiling',
      label: 'The ceiling',
      text: `A renewal adds to what is left, and the total cannot pass ${num(L.expire.max)} blocks.`,
      prov: ['source'],
    },
  ];
}

/** An example chain height for the arithmetic: the height when the facts were read. */
export function exampleHeight(): number {
  return SNAPSHOT.blockHeight;
}
