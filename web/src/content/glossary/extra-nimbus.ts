/**
 * Glossary extras for the Nimbus track (first-deploy to operate-your-app): terms the base glossary does not
 * carry. Every number is read from the engine in shared/flux, so a definition cannot drift from the price
 * calculator. Facts are tagged `// fact:` with their FACTS.md section.
 *
 * Display text (`term`) is lower case on purpose: these terms are used mid-sentence in lessons.
 */

import { BLOCKS_PER_MONTH, DURATION_DISCOUNTS, TARGET_BLOCK_SEC } from '@shared/flux/blocks';
import {
  BAKED_PRICING,
  BUNDLE_INSTANCES,
  ENTERPRISE_PORT_RANGES,
  EXTRA_INSTANCE_FLOOR_USD,
  HW_DISCOUNT_MAX_INSTANCES,
  HW_DISCOUNTS,
} from '@shared/flux/pricing';
import { LIMITS } from '@shared/flux/spec';
import { CRASH_BACKOFF_MAX_MIN, CRASH_BACKOFF_SEC, FDM_TIMING } from '@shared/flux/timing';
import type { GlossaryTerm } from '@/learn/types';

/** The crash restart ladder after the first, immediate restart: 30 seconds, then 5, 15 and 30 minutes. */
const CRASH_FIRST_PAUSE_SEC = CRASH_BACKOFF_SEC[1] ?? 0;
const CRASH_MID_MIN = CRASH_BACKOFF_SEC.slice(2, -1)
  .map((sec) => sec / 60)
  .join(', ');

const grouped = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const usd = (n: number): string => `USD ${n.toFixed(2)}`;

const [SMALL, MID] = HW_DISCOUNTS;
const FOURTH = HW_DISCOUNT_MAX_INSTANCES + 1;
const ORDINAL = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const FOURTH_WORD = ORDINAL[FOURTH] ?? `${FOURTH}th`;

/** The fee table starts at port 0, but a public port must be 1 to 65535 (FACTS 3.4), so name the usable range. */
const FEE_PORTS = (() => {
  const parts = ENTERPRISE_PORT_RANGES.map(([lo, hi]) => {
    const from = Math.max(lo, LIMITS.ports.min);
    return from === hi ? String(from) : `${from} to ${hi}`;
  });
  return `${parts[0]}, ${parts.slice(1, -1).join(', ')} or ${parts[parts.length - 1]}`;
})();

const DISCOUNTS = [...DURATION_DISCOUNTS]
  .sort((a, b) => a.minMonths - b.minMonths)
  .map((d) => `${d.label} from ${d.minMonths} months`)
  .join(', ');

const terms: GlossaryTerm[] = [
  // ---- money --------------------------------------------------------------------------------------------
  {
    id: 'minimum-price',
    term: 'minimum price',
    short: `The least any subscription costs, whatever its size or length. At the time of writing it is ${usd(BAKED_PRICING.params.minUSDPrice)} for the whole subscription.`,
    why: 'A tiny app costs the same as a small one, so shrinking below the floor saves nothing. The floor is applied after the small app discount, so it can hide what a small app would otherwise cost.',
    // fact: FACTS 4.1 (minUSDPrice), 4.3 steps D and E (the floor comes after the discount), 4.4
    category: 'money',
    related: ['price-quote', 'small-app-discount'],
    lessons: ['first-deploy', 'resources-pricing'],
    docs: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
  },
  {
    id: 'small-app-discount',
    term: 'small app discount',
    short: `${SMALL?.label} off apps under ${SMALL?.maxCpu} cores, ${grouped(SMALL?.maxRam ?? 0)} MB and ${SMALL?.maxHdd} GB, or ${MID?.label} under ${MID?.maxCpu} cores, ${grouped(MID?.maxRam ?? 0)} MB and ${MID?.maxHdd} GB, with fewer than ${FOURTH} instances.`,
    why: `It ends at the ${FOURTH_WORD} instance. A cheap app also pays a flat ${usd(EXTRA_INSTANCE_FLOOR_USD)} for each instance after the first from then on, so the price can double. Check every instance count.`,
    // fact: FACTS 4.3 step A and D, 4.4 (small app cliff, cheap apps pay 0.50 per extra instance)
    category: 'money',
    related: ['minimum-price', 'instances-field', 'price-quote'],
    lessons: ['resources-pricing'],
    docs: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
  },
  {
    id: 'port-fee',
    term: 'port fee',
    short: `${usd(BAKED_PRICING.params.port)} for each public port among ${FEE_PORTS}, added to the bundle before dividing by ${BUNDLE_INSTANCES}: about ${usd(BAKED_PRICING.params.port / BUNDLE_INSTANCES)} per instance.`,
    why: 'The same app on public port 80 or 8080 can cost several times what it costs on a free port. The container may keep its port: only the public one is charged.',
    // fact: FACTS 3.4 (enterprise ports, range 1 to 65535), 4.4, 11 row 28
    category: 'money',
    related: ['ports', 'container-ports', 'price-quote'],
    lessons: ['resources-pricing', 'first-deploy'],
    docs: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
  },
  {
    id: 'duration-discount',
    term: 'duration discount',
    short: `A discount on the whole price for a long subscription: ${DISCOUNTS}.`,
    why: 'It lowers the monthly cost of an app you mean to keep. The total is then rounded up to .49 or .99, which can swallow the saving of a very small app, so compare totals, not percentages.',
    // fact: FACTS 4.4 (volume discounts are duration only; the charm rounding comes after the discount), 5.3
    category: 'money',
    related: ['expire', 'renewal', 'price-quote'],
    lessons: ['resources-pricing', 'operate-your-app'],
    docs: 'https://docs.runonflux.com/fluxcloud/cost-calculator',
  },
  {
    id: 'free-update',
    term: 'free update',
    short: `An update the network does not charge for: same instances and components, no more CPU, RAM, disk or restricted ports, and at most 8 blocks of extra life.`,
    why: 'Changing an image tag, a variable or a command costs nothing. A free update is also rationed, and a different instance count, a bigger spec or a longer subscription is charged.',
    // fact: FACTS 4.5 (free updates and rate limits), 9.5.4
    category: 'money',
    related: ['app-update', 'renewal', 'expire'],
    lessons: ['operate-your-app'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/subscription',
  },

  // ---- ops ----------------------------------------------------------------------------------------------
  {
    id: 'crash-loop',
    term: 'crash loop',
    short: `A container that exits soon after it starts, again and again. FluxOS restarts it with growing pauses: none, ${CRASH_FIRST_PAUSE_SEC} seconds, ${CRASH_MID_MIN} and ${CRASH_BACKOFF_MAX_MIN} minutes.`,
    why: `The app is never up, and the pauses between restarts grow to ${CRASH_BACKOFF_MAX_MIN} minutes. The Logs tab shows why the process exits.`,
    // fact: FACTS 6.3 (crash backoff ladder, stable run), 11 row 21
    category: 'ops',
    related: ['commands', 'environment-parameters', 'healthcheck', 'hard-redeploy'],
    lessons: ['operate-your-app', 'env-and-secrets'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/logs',
  },
  {
    id: 'expiry-height',
    term: 'expiry height',
    short:
      'The block height at which a subscription ends: the height of the latest register or update message plus expire. After it the app is removed.',
    why: `There is no grace period, and a month is ${grouped(BLOCKS_PER_MONTH)} blocks. Read the height rather than a date, because real block times drift a little from ${TARGET_BLOCK_SEC} seconds.`,
    // fact: FACTS 5.2 (expire counts from the message height), 5.4 (no grace), 5.1 (measured block time)
    category: 'ops',
    related: ['expire', 'renewal', 'block-height'],
    lessons: ['operate-your-app'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/subscription',
  },

  // ---- network and docker ---------------------------------------------------------------------------------
  {
    id: 'round-robin',
    term: 'round robin',
    short:
      'Taking turns. A load balancer gives each new visitor the next instance in its list, so load spreads across the instances that are up.',
    why: `Different visitors land on different instances, so state in one instance's memory is invisible to the others. A cookie keeps a browser on one instance for up to ${FDM_TIMING.stickyHours} hours; a \`g:\` app sends everyone to its primary.`,
    // fact: FACTS 6.4 (balance roundrobin, FDMSERVERID cookie)
    category: 'network',
    related: ['fdm', 'haproxy', 'instance'],
    lessons: ['ports-and-domains'],
    docs: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/instances',
  },
  {
    id: 'bind-address',
    term: 'bind address',
    short:
      'The network interface a server listens on. 0.0.0.0 means every interface of the container. 127.0.0.1 means only the container itself.',
    why: 'A server bound to loopback never receives published traffic. The app starts and the node shows it running, yet every request is refused or comes back empty.',
    // fact: FACTS 8.1 (binding inside the container), 11 row 2
    category: 'docker',
    related: ['container-ports', 'ports', 'container'],
    lessons: ['ports-and-domains', 'first-deploy'],
    docs: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
  },
];

export default terms;
