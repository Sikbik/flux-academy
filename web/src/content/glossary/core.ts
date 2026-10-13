/**
 * Glossary, part 1 of 3: the network, the money and the app specification (45 terms).
 *
 * The other two files are `docker.ts` (images and registries) and `ops.ts` (accounts, wallets and running
 * an app). Term ids are the canonical ones other lessons link with `{{term:id}}`; they are permanent.
 *
 * Every definition restates FACTS.md (section 12 seeds, rewritten to the length limits) and carries a
 * `// fact:` tag. Nothing here relies on an UNVERIFIED row: node counts, FLUX price and block height are
 * not quoted. Tier collateral and sizes, block timing, fees, the spec limits and the deployment timers
 * (install waits, location records, balancer probes; `shared/flux/timing.ts`) are read from the domain
 * engine in `shared/flux`, so a definition cannot drift from the simulators. Each carries its fact tag.
 */

import { BLOCKS_PER_MONTH, PON_FORK_HEIGHT, TARGET_BLOCK_SEC } from '@shared/flux/blocks';
import { BAKED_PRICING, BUNDLE_INSTANCES, HW_DISCOUNTS } from '@shared/flux/pricing';
import { LIMITS } from '@shared/flux/spec';
import { TIER_FACTS } from '@shared/flux/tiers';
import {
  FDM_EJECT_SEC,
  FDM_TIMING,
  LOCATION_TTL_MIN,
  LOCATION_TTL_SEC,
  SPAWN_DEFERRAL_MIN,
} from '@shared/flux/timing';
import type { GlossaryTerm } from '@/learn/types';

const num = (v: number): string => v.toLocaleString('en-US');
const { cumulus, nimbus, stratus } = TIER_FACTS;
/** "4 CPU threads, 7,000 MB of RAM and 220 GB of disk": the size FluxOS plans around for a tier. */
const sizeOf = (t: typeof cumulus): string =>
  `${t.nominal.threads} CPU threads, ${num(t.nominal.ramMb)} MB of RAM and ${t.nominal.ssdGb} GB of disk`;
const fluxDiscountPct = Math.round((1 - BAKED_PRICING.params.fluxmultiplier) * 100);
const { port: portFeeUsd, staticip: staticIpFeeUsd, scope: scopeFeeUsd } = BAKED_PRICING.params;
const { totals } = LIMITS;
/** The top of the low port range that carries the port fee: ports 1 to 1023 (port 0 is refused). */
const lowFeePortMax = LIMITS.ports.surchargeRanges[0]?.to ?? 1023;
/**
 * A fee goes into the monthly bundle, which is divided by 3 and billed per instance, so USD 2 is about
 * USD 0.67 per instance per month before discounts (and equals USD 2 only at 3 instances). FACTS 4.3, 4.4.
 */
const perInstanceUsd = (feeUsd: number): string => (feeUsd / BUNDLE_INSTANCES).toFixed(2);
/** "Small app" for the install-wait rule: under 3 cores, 6,000 MB and 150 GB. FACTS 2.4 (spawner cut-offs). */
const smallApp = HW_DISCOUNTS[0] ?? { maxCpu: 3, maxRam: 6000, maxHdd: 150 };
/** Disk a nominal Cumulus node really offers apps (the engine derives it; FACTS 2.3). */
const cumulusUsableDiskGb = cumulus.usableHddGb;

const terms: GlossaryTerm[] = [
  // ---- network ------------------------------------------------------------------------------------------
  {
    id: 'flux',
    term: 'Flux',
    proper: true,
    short:
      'A decentralized cloud made of independently operated nodes, kept in agreement by the FLUX blockchain. You deploy containers to it and pay in FLUX or by card.',
    why: 'It is where your app runs and what you pay for, so its parts, nodes, chain and token, explain most of what you configure.',
    // fact: FACTS 1.1 (positioning), 1.2 (pillars)
    category: 'network',
    related: ['fluxnode', 'fluxos', 'flux-token', 'fluxcloud'],
    lessons: ['what-is-flux'],
    docs: 'https://docs.runonflux.com/fluxcloud/introduction',
  },
  {
    id: 'fluxos',
    term: 'FluxOS',
    proper: true,
    short:
      'The node software that runs on each FluxNode. It installs apps in Docker, talks to the chain, syncs volumes and serves the network API.',
    why: 'Every placement, redeploy and API answer you meet comes from FluxOS. Nodes run the same software, but not always the same version, operating system or size.',
    // fact: FACTS 1.2 (FluxOS row)
    category: 'network',
    related: ['fluxnode', 'arcaneos', 'flux-gravity', 'spawner'],
    lessons: ['what-is-flux'],
    docs: 'https://docs.runonflux.com/fluxnodes/what-are-fluxnodes',
  },
  {
    id: 'fluxnode',
    term: 'FluxNode',
    proper: true,
    aka: ['node', 'Flux node'],
    short:
      'A server that locks FLUX as collateral and runs FluxOS. It hosts app instances and earns block rewards for staying online.',
    why: 'Your instances run on FluxNodes that you do not own. Their tier sets how much room they have and how soon they pick up a small app.',
    // fact: FACTS 1.2 (FluxNodes row), 2.1
    category: 'network',
    related: ['cumulus', 'nimbus', 'stratus', 'collateral', 'fluxos'],
    lessons: ['what-is-flux', 'how-apps-run'],
    docs: 'https://docs.runonflux.com/fluxnodes/what-are-fluxnodes',
  },
  {
    id: 'cumulus',
    term: 'Cumulus',
    proper: true,
    short: `The smallest node tier. ${num(cumulus.collateralFlux)} FLUX collateral and, nominally, ${sizeOf(cumulus)}. Small apps tend to land here.`,
    why: `Bigger tiers wait before they take an app under ${smallApp.maxCpu} cores, ${num(smallApp.maxRam)} MB and ${smallApp.maxHdd} GB. A nominal Cumulus node offers about ${cumulus.appCapacity.cpu} cores, ${num(cumulus.appCapacity.ramMb)} MB and, in practice, about ${cumulusUsableDiskGb} GB of disk. Real nodes can exceed this.`,
    // fact: FACTS 2.1 (collateral), 2.2 and 2.3 (nominal size; 129 GB runtime disk, 160 GB is only the validator ceiling), 2.4 (waits, small-app cut-off)
    category: 'network',
    related: ['nimbus', 'stratus', 'collateral', 'fluxnode'],
    lessons: ['what-is-flux'],
    docs: 'https://docs.runonflux.com/fluxnodes/what-are-fluxnodes',
  },
  {
    id: 'nimbus',
    term: 'Nimbus',
    proper: true,
    short: `The middle node tier. ${num(nimbus.collateralFlux)} FLUX collateral and, nominally, ${sizeOf(nimbus)}.`,
    why: `Nimbus nodes host mid-sized apps. They also pick up a small app after a default wait of ${SPAWN_DEFERRAL_MIN.nimbusSmallApp} minutes, if Cumulus nodes have not taken all its copies.`,
    // fact: FACTS 2.1, 2.2, 2.4 (Nimbus waits 57 minutes for apps under 3 cores, 6000 MB, 150 GB)
    category: 'network',
    related: ['cumulus', 'stratus', 'collateral', 'fluxnode'],
    lessons: ['what-is-flux'],
    docs: 'https://docs.runonflux.com/fluxnodes/what-are-fluxnodes',
  },
  {
    id: 'stratus',
    term: 'Stratus',
    proper: true,
    short: `The largest node tier. ${num(stratus.collateralFlux)} FLUX collateral and, nominally, ${sizeOf(stratus)}.`,
    why: `Only Stratus nodes have room for the biggest specs, up to ${totals.cpu} cores and ${num(totals.ram)} MB of RAM in total. By default they wait longest, ${SPAWN_DEFERRAL_MIN.stratusSmallApp} minutes, before taking a small app.`,
    // fact: FACTS 2.1, 2.2, 2.3 (15 cores and 59,000 MB total), 2.4 (117 minutes)
    category: 'network',
    related: ['cumulus', 'nimbus', 'collateral', 'fluxnode'],
    lessons: ['what-is-flux'],
    docs: 'https://docs.runonflux.com/fluxnodes/what-are-fluxnodes',
  },
  {
    id: 'collateral',
    term: 'collateral',
    short: `FLUX that a node operator locks on the chain to run a node. The amount fixes the tier: ${num(cumulus.collateralFlux)}, ${num(nimbus.collateralFlux)} or ${num(stratus.collateralFlux)} FLUX.`,
    why: 'It makes a node costly to abuse and it decides the tier. Deployers never lock collateral: it belongs to the operator side of the network.',
    // fact: FACTS 2.1 (FluxOS derives the tier from the collateral amount), 2.2
    category: 'network',
    related: ['cumulus', 'nimbus', 'stratus', 'flux-token'],
    lessons: ['what-is-flux'],
    docs: 'https://docs.runonflux.com/fluxnodes/what-are-fluxnodes',
  },
  {
    id: 'arcaneos',
    term: 'ArcaneOS',
    proper: true,
    short:
      'A hardened operating system for FluxNodes with encrypted disks and software integrity checks. Most nodes run it, and enterprise apps require it.',
    why: 'Only ArcaneOS nodes can decrypt an enterprise app, and they are all amd64. That is why private images and secret values depend on it.',
    // fact: FACTS 1.2 (ArcaneOS row), 2.6 (comparison table), 3.7
    category: 'network',
    related: ['enterprise-app', 'fluxos', 'amd64', 'fluxnode'],
    lessons: ['what-is-flux', 'env-and-secrets'],
    docs: 'https://docs.runonflux.com/fluxnodes/arcaneos-fluxnode/',
  },
  {
    id: 'proof-of-node',
    term: 'Proof of Node',
    proper: true,
    aka: ['PoN', 'PON', 'PoUW v2'],
    short: `The consensus rule since block ${num(PON_FORK_HEIGHT)}: confirmed nodes win ${TARGET_BLOCK_SEC} second slots by a hash lottery. Nothing is mined.`,
    why: `It explains why blocks are ${TARGET_BLOCK_SEC} seconds, why a month is ${num(BLOCKS_PER_MONTH)} blocks and why older guides about mining FLUX no longer apply.`,
    // fact: FACTS 1.4 (eras, how blocks are produced), 5.1
    category: 'network',
    related: ['block', 'block-height', 'fluxnode'],
    lessons: ['what-is-flux'],
  },
  {
    id: 'block-height',
    term: 'block height',
    aka: ['height'],
    short: `The number of the latest block on the chain. It only goes up, one about every ${TARGET_BLOCK_SEC} seconds.`,
    why: 'Subscriptions, expiry and payments are all pinned to a height. Reading the height tells you how much of a subscription is left.',
    // fact: FACTS 5.1 (30 s blocks), 5.2 (expire counts from the message height)
    category: 'network',
    related: ['block', 'expire', 'proof-of-node'],
    lessons: ['what-is-flux', 'operate-your-app'],
    docs: 'https://docs.runonflux.com/fluxcloud/dashboard/overview',
  },
  {
    id: 'block',
    term: 'block',
    short: `A batch of transactions that the chain adds about every ${TARGET_BLOCK_SEC} seconds. Your payment is confirmed in one.`,
    why: `Time on Flux is counted in blocks. A month is ${num(BLOCKS_PER_MONTH)} of them, and a payment confirms your app in the next one.`,
    // fact: FACTS 5.1, 6.1 row 8
    category: 'network',
    related: ['block-height', 'proof-of-node', 'expire'],
    lessons: ['what-is-flux', 'how-apps-run'],
  },
  {
    id: 'spawner',
    term: 'spawner',
    short:
      'The loop each FluxOS node runs on its own timer. It finds apps that are short of instances and installs the ones that fit the node.',
    why: 'There is no central scheduler, so the spawner on each node is what places your app. Its waits and filters explain delays and missing copies.',
    // fact: FACTS 6.1 rows 9 and 10, 6.2
    category: 'network',
    related: ['instance', 'fluxos', 'geolocation', 'fault-domain'],
    lessons: ['how-apps-run', 'what-is-flux'],
  },
  {
    id: 'location',
    term: 'location',
    short: `A signed record that a node runs an app, refreshed hourly and valid for ${num(LOCATION_TTL_SEC)} seconds. The set of locations is where an app is running.`,
    why: `A dead node's record fades after up to ${LOCATION_TTL_MIN} minutes, and its copy is replaced only after that. The Academy's App Explorer lab lists the locations of any app.`,
    // fact: FACTS 6.1 row 12, 6.3, 6.5 (replacement can take up to the location TTL plus install time)
    category: 'network',
    related: ['instance', 'spawner', 'failover'],
    lessons: ['how-apps-run', 'redundancy-failover'],
  },
  {
    id: 'fault-domain',
    term: 'fault domain',
    short:
      'A group of nodes that share a hosting organisation or network block and so tend to fail together.',
    why: 'For apps with synced storage, FluxOS caps how many instances share one fault domain, so one hosting problem is less likely to take every copy.',
    // fact: FACTS 6.2 (fault domains for r:, g: and s: apps)
    category: 'network',
    related: ['instance', 'syncthing', 'primary-standby', 'geolocation'],
    lessons: ['geo-placement', 'persistent-storage'],
  },
  {
    id: 'network-policy',
    term: 'network policy',
    short:
      'Signed documents, a blocklist and an enterprise node list, that every node fetches and enforces. They can block names, owners, images and registry namespaces.',
    why: 'An app or image on the blocklist is refused or never installs. There is no image whitelist, so a public image is allowed unless it is listed.',
    // fact: FACTS 3.6 (blocklist, no image whitelist), 2.5 (enterprise nodes list)
    category: 'network',
    related: ['enterprise-app', 'repotag', 'nodes-field'],
    lessons: ['production-checklist', 'env-and-secrets'],
    docs: 'https://github.com/RunOnFlux/fluxos-network-policy',
  },
  {
    id: 'fdm',
    term: 'FDM',
    proper: true,
    aka: ['Flux Domain Manager'],
    short:
      'The Flux Domain Manager. It gives each app a domain, serves it over HTTPS and spreads visitors across running instances. A `g:` app goes only to its primary.',
    why: `FDM is why your app has an address before you buy a domain. It keeps one browser on the same instance for up to ${FDM_TIMING.stickyHours} hours, and drops a dead instance within seconds.`,
    // fact: FACTS 6.4 (FDM table: roundrobin, FDMSERVERID cookie up to 8 h, g: apps primary only)
    category: 'network',
    related: ['haproxy', 'app-domain', 'domains', 'cname'],
    lessons: ['how-apps-run', 'ports-and-domains', 'custom-domains'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/custom-domain-setup',
  },
  {
    id: 'haproxy',
    term: 'HAProxy',
    proper: true,
    short: `FDM's load balancer. It sends new visitors to instances in turn, keeps a browser on one for up to ${FDM_TIMING.stickyHours} hours, and probes each every ${FDM_TIMING.healthIntervalSec} seconds.`,
    why: `An instance is ejected after ${FDM_TIMING.ejectAfterFailures} failed probes, about ${FDM_EJECT_SEC} seconds. That is why traffic leaves a dead instance fast even though a replacement is slow.`,
    // fact: FACTS 6.4 (balance roundrobin, FDMSERVERID cookie up to 8 h; check every 3 s, down after 2 failures)
    category: 'network',
    related: ['fdm', 'failover', 'instance'],
    lessons: ['redundancy-failover', 'ports-and-domains'],
  },
  {
    id: 'internal-dns',
    term: 'Internal DNS',
    proper: true,
    aka: ['internal names', 'container names'],
    short:
      "How components of one app find each other: Docker resolves the container name `flux<component>_<app>` on the app's private network.",
    why: 'A component that is not in `ports` is reachable only through this name, which keeps it off the public internet. The bare component name is not a documented way in.',
    // fact: FACTS 8.2 (components resolve each other by container name), 3.8
    category: 'network',
    related: ['component', 'compose', 'ports'],
    lessons: ['multi-component', 'shared-database'],
  },
  {
    id: 'cname',
    term: 'CNAME',
    proper: true,
    aka: ['CNAME record'],
    short:
      "A DNS record that makes one name an alias for another. A custom domain points at your app's Flux address with one.",
    why: "It is how your domain reaches your app. A CNAME cannot sit at a domain's bare apex, so a root domain needs your DNS provider's flattening feature or an A record to Flux's load balancer, never a node's IP.",
    // fact: FACTS 6.4 (custom domain DNS: CNAME to <name>.app.runonflux.io; an A record to the FDM IPs also works, docs describe only the CNAME), 13 SB-27 (not the node IP)
    category: 'network',
    related: ['domains', 'app-domain', 'fdm'],
    lessons: ['custom-domains'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/custom-domain-setup',
  },
  {
    id: 'flux-gravity',
    term: 'Flux Gravity',
    proper: true,
    short:
      'A label in the FluxCloud dashboard for the node software that the docs call FluxOS. It is not a separate product.',
    why: 'You may see it on the status bar. Treat it as FluxOS, and ignore guides that present it as a product of its own.',
    // fact: FACTS 1.3 (a UI string only)
    category: 'network',
    related: ['fluxos', 'fluxcloud'],
    lessons: ['what-is-flux'],
  },

  // ---- money --------------------------------------------------------------------------------------------
  {
    id: 'flux-token',
    term: 'FLUX',
    proper: true,
    aka: ['FLUX token', 'FLUX coin'],
    short: `The network's token. You pay for apps with it at a ${fluxDiscountPct} percent discount, and node operators lock it as collateral and earn it as block rewards.`,
    why: 'Paying in FLUX is cheaper than paying by card. Nodes read payments only on the Flux chain, so wrapped FLUX on other chains does not pay for an app.',
    // fact: FACTS 1.5 (payment, discount; wrapped FLUX is an inference from the payment-detection code), 4.4 (fluxmultiplier)
    category: 'money',
    related: ['flux-multiplier', 'payment-address', 'collateral'],
    lessons: ['what-is-flux', 'your-toolkit'],
    docs: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
  },
  {
    id: 'price-quote',
    term: 'price quote',
    short:
      "The USD and FLUX amount that the network's calculator returns for a spec. Pay the full quoted amount to register.",
    why: "Quote before you sign. The chain's floor is far lower, and a payment below it is dropped as underpaid, but FluxCloud asks for the quote. The calculator does not run the full validator, so a quote is not a verdict.",
    // fact: FACTS 4.7 (the on-chain floor is far below the quote; the card relay needs 98 percent), 6.1 row 8, 3.10 (the calculator does not validate)
    category: 'money',
    related: ['quote', 'flux-multiplier', 'expire'],
    lessons: ['how-apps-run', 'resources-pricing'],
    docs: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
  },
  {
    id: 'quote',
    term: 'quote',
    aka: ['itemised quote', 'price breakdown'],
    short:
      "The Academy's itemised breakdown of a monthly price: each resource, discount, minimum and rounding step, adding up to the total.",
    why: 'Reading the lines shows where a price comes from, so you can see which change moves it: instances, CPU, a port fee or the minimum.',
    // fact: FACTS 4.3 (the formula), 4.4 (rules worth stating plainly)
    category: 'money',
    related: ['price-quote', 'flux-multiplier', 'instances-field'],
    lessons: ['resources-pricing'],
  },
  {
    id: 'flux-multiplier',
    term: 'fluxmultiplier',
    aka: ['FLUX discount'],
    short: `The factor ${BAKED_PRICING.params.fluxmultiplier} that the network applies when you pay in FLUX, which makes the FLUX price ${fluxDiscountPct} percent lower than the USD price converted.`,
    why: 'It explains the discount chip in FluxCloud. Card and PayPal pay the full USD figure, shown plus VAT.',
    // fact: FACTS 4.4 (fluxmultiplier 0.95), 9.5.1 (card price plus VAT)
    category: 'money',
    related: ['flux-token', 'price-quote'],
    lessons: ['your-toolkit', 'resources-pricing'],
    docs: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
  },
  {
    id: 'payment-address',
    term: 'payment address',
    short:
      'The one address on the Flux chain that receives app payments. FluxCloud shows it to you, together with the message to send.',
    why: 'Pay only the address FluxCloud shows. A payment without the right message cannot be linked to your spec.',
    // fact: FACTS 1.5, 4.7 (one payment address, the hash in OP_RETURN)
    category: 'money',
    related: ['op-return', 'message-hash', 'price-quote'],
    lessons: ['how-apps-run'],
  },
  {
    id: 'op-return',
    term: 'OP_RETURN',
    proper: true,
    aka: ['memo', 'transaction message'],
    short:
      'A transaction output that carries a short note instead of coins. Flux uses it to attach the registration message hash to a payment.',
    why: 'This is how a payment is tied to one app. A payment without the hash links to nothing, and the docs warn against paying from an exchange, which may not attach a memo.',
    // fact: FACTS 1.5 (payment with OP_RETURN), 9.5.1 (exchange warning is docs-only: "no memo, may miss the window")
    category: 'money',
    related: ['message-hash', 'payment-address', 'registration-message'],
    lessons: ['how-apps-run'],
  },
  {
    id: 'renewal',
    term: 'Renewal',
    short:
      'An update that raises `expire` and pays for the added period. You pay the new total minus a credit for the time you have not used.',
    why: 'Nothing renews on its own unless you set card auto-renewal. At expiry the app and its data are removed with no grace period.',
    // fact: FACTS 4.5 (renewal is an update that raises expire), 5.4 (no grace; Stripe auto-renewal)
    category: 'money',
    related: ['expire', 'app-update', 'block-height'],
    lessons: ['operate-your-app', 'production-checklist'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/subscription',
  },

  // ---- app ----------------------------------------------------------------------------------------------
  {
    id: 'app-spec',
    term: 'app specification',
    aka: ['spec', 'app spec'],
    short:
      'The JSON document that describes an app: its components, resources, ports, instances and subscription length. You sign it, price it and pay for it.',
    why: 'Everything the network does with your app starts from this document, and everything you can get wrong is in it.',
    // fact: FACTS 3.2 (top-level fields), 3.9 (a minimal v8 spec)
    category: 'app',
    related: ['spec-version', 'component', 'compose', 'instances-field'],
    lessons: ['how-apps-run', 'first-deploy'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/specifications',
  },
  {
    id: 'spec-version',
    term: 'spec version',
    short: 'The schema number of a spec. The current version is 8, and new apps must use it.',
    why: 'Old tutorials use incompatible versions. Version 8 has no tiered fields and no secrets, and it requires contacts, geolocation, expire, nodes, staticip and enterprise.',
    // fact: FACTS 3.1 (v8 is the only version for new work), 3.2
    category: 'app',
    related: ['app-spec', 'compose'],
    lessons: ['how-apps-run'],
  },
  {
    id: 'component',
    term: 'component',
    short:
      "One container definition in the spec's `compose` array: an image, its ports, its resources and its data. An app has one to ten.",
    why: 'A multi-service app needs one component per service. Names are letters and digits only, with no hyphens, even though the app name allows them.',
    // fact: FACTS 3.3 (component fields; name pattern), 3.2 (compose 1 to 10)
    category: 'app',
    related: ['compose', 'repotag', 'internal-dns'],
    lessons: ['first-deploy', 'multi-component'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
  },
  {
    id: 'compose',
    term: 'compose',
    short:
      'The array in a spec that holds its components, from one to ten. They are priced and named as one app.',
    why: `The validator caps the sum over all components at ${totals.cpu} cores, ${num(totals.ram)} MB of RAM and ${totals.hdd} GB of disk. Splitting an app into components does not raise those totals.`,
    // fact: FACTS 3.2 (compose), 3.3 (total resource caps are validator limits)
    category: 'app',
    related: ['component', 'app-spec', 'instances-field'],
    lessons: ['how-apps-run', 'multi-component'],
  },
  {
    id: 'instance',
    term: 'instance',
    short:
      'One running copy of your app on one node. In practice each copy runs on a different node, though nodes can share a hosting provider.',
    why: 'Redundancy on Flux is the instance count. One instance is down whenever its node is. A replacement copy can take about two hours after a node dies, plus the image pull.',
    // fact: FACTS 6.2 (observed live: no app has two copies on one node IP; not a stated rule), 6.5 (125 min location TTL plus install time)
    category: 'app',
    related: ['instances-field', 'spawner', 'failover', 'location'],
    lessons: ['what-is-flux', 'redundancy-failover'],
  },
  {
    id: 'instances-field',
    term: 'instances',
    aka: ['instance count'],
    short: `The spec field that sets how many nodes should run a copy of your app: ${LIMITS.instances.min} to ${LIMITS.instances.max} in version 8.`,
    why: `It is the main driver of price and availability. The price rises nearly in line with it, and a small app can double in price at instance number ${LIMITS.instances.smallAppDiscountBelow}.`,
    // fact: FACTS 3.2 (1 to 100), 4.4 (the small app cliff at 4 instances)
    category: 'app',
    related: ['instance', 'price-quote', 'failover'],
    lessons: ['resources-pricing', 'redundancy-failover'],
  },
  {
    id: 'ports',
    term: 'ports',
    short:
      'The list of public ports that a component publishes on the node. Each is paired, by position, with an entry in `containerPorts`.',
    why: `Public entry points: up to ${LIMITS.ports.perComponentMax} per component, unique across the app. Ports ${LIMITS.ports.min} to ${lowFeePortMax}, and 8080, 8081, 8443 and 6667, each add USD ${portFeeUsd} to the monthly bundle, about USD ${perInstanceUsd(portFeeUsd)} per instance per month before discounts.`,
    // fact: FACTS 3.3, 3.4 (banned and fee ports; port 0 is refused), 4.4 (fee added to the bundle before the divide by 3), 8.1
    category: 'app',
    related: ['container-ports', 'domains', 'app-domain'],
    lessons: ['ports-and-domains', 'first-deploy'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
  },
  {
    id: 'container-ports',
    term: 'containerPorts',
    short:
      'The ports the process listens on inside the container, paired by position with `ports`. Docker delivers traffic from the public port to this one.',
    why: 'A mismatch is an easy mistake: the app registers and runs, but its address answers with an error or nothing. Set it to the port the process really listens on.',
    // fact: FACTS 11 row 1, 3.3
    category: 'app',
    related: ['ports', 'domains'],
    lessons: ['first-deploy', 'ports-and-domains'],
  },
  {
    id: 'domains',
    term: 'domains',
    short:
      'A per-port list of custom domains that FDM serves for a component, aligned with `ports`. An empty string means none.',
    why: 'A custom domain needs two things: its name in this list and a DNS record that points at your app. Either one alone does nothing.',
    // fact: FACTS 3.3, 6.4 (custom domains), 11 row 27
    category: 'app',
    related: ['cname', 'fdm', 'app-domain', 'ports'],
    lessons: ['custom-domains', 'ports-and-domains'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/custom-domain-setup',
  },
  {
    id: 'container-data',
    term: 'containerData',
    short:
      "The string that defines a component's persistent mounts. A plain path is a local volume, and `r:` and `g:` prefixes replicate it between instances.",
    why: 'It decides whether data survives. A plain volume lives on one node and is lost if that node fails, on a hard redeploy and at expiry.',
    // fact: FACTS 7.1 (grammar), 7.2 (what each prefix guarantees); the s: flag is left out on purpose
    category: 'app',
    related: ['volume', 'syncthing', 'primary-standby', 'hard-redeploy'],
    lessons: ['persistent-storage', 'shared-database'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
  },
  {
    id: 'environment-parameters',
    term: 'environmentParameters',
    aka: ['env vars', 'environment variables'],
    short: `\`KEY=value\` environment variables for a component, up to ${LIMITS.environment.maxCount} of them. FluxOS also sets \`FLUX_APP_NAME\` and \`FLUX_NODE_HOST_IP\`.`,
    why: 'In a public app they are readable by anyone through the API, so passwords and tokens do not belong in them unless the app is an enterprise app.',
    // fact: FACTS 8.3 (format, injected variables, visibility)
    category: 'app',
    related: ['commands', 'enterprise-app', 'repoauth'],
    lessons: ['env-and-secrets'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
  },
  {
    id: 'commands',
    term: 'commands',
    short:
      "Arguments passed to the container's entrypoint, the Docker CMD array. It is a list of arguments, not a shell script.",
    why: 'A wrong command makes the container exit at start, and FluxOS restarts it with growing waits. Read the logs before you change the image.',
    // fact: FACTS 8.3 (commands become the Cmd array), 6.3 (restart backoff), 11 row 21
    category: 'app',
    related: ['environment-parameters', 'component'],
    lessons: ['env-and-secrets'],
  },
  {
    id: 'expire',
    term: 'expire',
    short: `The subscription length in blocks, counted from the latest register or update message. The minimum is ${LIMITS.expire.min} and the maximum is ${num(LIMITS.expire.max)}.`,
    why: `${num(BLOCKS_PER_MONTH)} blocks is about a month. At expiry the app and its data are removed within minutes to hours, with no grace period, so renew early.`,
    // fact: FACTS 5.2, 5.3 (limits), 5.4 (no grace at expiry)
    category: 'app',
    related: ['block', 'renewal', 'block-height'],
    lessons: ['first-deploy', 'resources-pricing', 'operate-your-app'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/subscription',
  },
  {
    id: 'geolocation',
    term: 'geolocation',
    short:
      'An allow and deny list of continents, countries and regions where instances may run. Entries look like `acEU` and `acEU_DE`.',
    why: "This list is how you ask for Europe only, or keep one country out. An empty list allows everywhere. It filters on the network's IP location data and is not a compliance certification.",
    // fact: FACTS 3.5 (syntax and semantics; a filter on IP location data), 6.2
    category: 'app',
    related: ['instances-field', 'spawner', 'fault-domain'],
    lessons: ['geo-placement'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/geolocation',
  },
  {
    id: 'nodes-field',
    term: 'nodes',
    aka: ['nodes field', 'pinned nodes'],
    short:
      'A spec field that pins an app to named nodes. In version 8 it works only for enterprise apps, and only for owners on the allow list.',
    why: `For most deployers it must stay empty. Pinning also adds USD ${scopeFeeUsd} to the monthly bundle, about USD ${perInstanceUsd(scopeFeeUsd)} per instance, and removes the free choice of nodes that makes Flux resilient.`,
    // fact: FACTS 3.2 (nodes row), 4.4 (scope fee added to the bundle before the divide by 3)
    category: 'app',
    related: ['enterprise-app', 'network-policy', 'static-ip'],
    lessons: ['geo-placement', 'production-checklist'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/priority-nodes',
  },
  {
    id: 'static-ip',
    term: 'static IP',
    aka: ['staticip'],
    short: `A spec flag that restricts an app to nodes with a fixed, directly reachable public address. It adds USD ${staticIpFeeUsd} to the monthly bundle and narrows placement.`,
    why: `Use it only when something needs a stable address. The fee is about USD ${perInstanceUsd(staticIpFeeUsd)} per instance per month, and fewer nodes qualify, so instances can take longer to place or stay missing.`,
    // fact: FACTS 3.2 (staticip), 4.4 (USD 2 added to the bundle before the divide by 3), 11 row 26
    category: 'app',
    related: ['nodes-field', 'spawner', 'price-quote'],
    lessons: ['geo-placement', 'resources-pricing'],
  },
  {
    id: 'enterprise-app',
    term: 'enterprise app',
    aka: ['enterprise'],
    short:
      'A version 8 app whose contacts and components are encrypted so that only ArcaneOS nodes can read them. It allows private images and secret values.',
    why: 'It is the way to keep environment variables and registry credentials out of the public spec. Do not confuse it with the allow-listed enterprise network.',
    // fact: FACTS 3.7 (encrypted specs; the two meanings of enterprise)
    category: 'app',
    related: ['arcaneos', 'repoauth', 'environment-parameters', 'network-policy'],
    lessons: ['env-and-secrets'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/general',
  },
  {
    id: 'app-domain',
    term: 'app domain',
    short:
      'The free web address every app gets: `<name>.app.runonflux.io`, or `<name>_<port>.app.runonflux.io` for a specific public port.',
    why: 'It needs no DNS work. It answers only once an instance runs and FDM has added it, and that delay is not documented. The port in the name is the public port, not the container port.',
    // fact: FACTS 6.4 (default and per-port domains), 6.1 rows 12 and 13 (wildcard DNS resolves; FDM publish timing UNVERIFIED), 11 row 3
    category: 'app',
    related: ['fdm', 'ports', 'domains', 'cname'],
    lessons: ['how-apps-run', 'ports-and-domains'],
  },
];

export default terms;
