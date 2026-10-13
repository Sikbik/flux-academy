/**
 * Where a simulated app lands, and the timeline of an install. Pure functions, no clock and no randomness:
 * everything is a function of the app name, so a replay is identical.
 *
 * The sequence follows FACTS 6.1 ("How deployment really works end to end"): the message is broadcast, a
 * payment is seen in the next block, each node decides on its own, instances start one by one, nodes announce
 * themselves and the Flux Domain Manager publishes the domains. The timings are illustrative figures inside
 * the ranges FACTS gives (1 to 3 minutes before a node starts installing; "up to 45 minutes after payment" is
 * a fixed label on FluxCloud's screen, with no timer behind it). The FDM publish delay is not documented and
 * is labelled as such.
 *
 * "Deployment Successful!" follows FACTS 6.6: FluxCloud's watcher polls every 30 seconds for 30 minutes and
 * shows it as soon as ONE running copy is listed, so it comes before the other copies and the domains. When
 * no copy ever runs, the watcher gives up after 30 minutes and says so; the deployment itself goes on.
 *
 * The nodes are SAMPLE nodes: addresses come from the three ranges reserved for documentation
 * (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), so they cannot be a real node.
 */

import {
  derivedNames,
  type FluxAppSpec,
  INSTALL_START_USUAL_MIN,
  parseGeolocationEntry,
  TARGET_BLOCK_SEC,
  UI_WATCHER_MIN,
  UI_WATCHER_POLL_SEC,
} from '@shared/flux';

export interface SimNode {
  /** An address from a documentation range. */
  ip: string;
  continent: string;
  continentName: string;
  country: string;
  countryName: string;
  /** ISO 3166-2 style code, the shape FluxCloud's Instances table shows. */
  region: string;
}

/** Sample locations. Continent codes are the ones of FACTS 3.5. */
const SITES: readonly Omit<SimNode, 'ip'>[] = [
  { continent: 'EU', continentName: 'Europe', country: 'DE', countryName: 'Germany', region: 'DE-HE' },
  { continent: 'EU', continentName: 'Europe', country: 'FR', countryName: 'France', region: 'FR-IDF' },
  { continent: 'EU', continentName: 'Europe', country: 'NL', countryName: 'Netherlands', region: 'NL-NH' },
  { continent: 'EU', continentName: 'Europe', country: 'FI', countryName: 'Finland', region: 'FI-18' },
  {
    continent: 'EU',
    continentName: 'Europe',
    country: 'GB',
    countryName: 'United Kingdom',
    region: 'GB-ENG',
  },
  {
    continent: 'NA',
    continentName: 'North America',
    country: 'US',
    countryName: 'United States',
    region: 'US-VA',
  },
  {
    continent: 'NA',
    continentName: 'North America',
    country: 'US',
    countryName: 'United States',
    region: 'US-OR',
  },
  { continent: 'NA', continentName: 'North America', country: 'CA', countryName: 'Canada', region: 'CA-QC' },
  { continent: 'SA', continentName: 'South America', country: 'BR', countryName: 'Brazil', region: 'BR-SP' },
  { continent: 'AS', continentName: 'Asia', country: 'JP', countryName: 'Japan', region: 'JP-13' },
  { continent: 'AS', continentName: 'Asia', country: 'SG', countryName: 'Singapore', region: 'SG-01' },
  { continent: 'AS', continentName: 'Asia', country: 'IN', countryName: 'India', region: 'IN-MH' },
  { continent: 'AF', continentName: 'Africa', country: 'ZA', countryName: 'South Africa', region: 'ZA-GP' },
  { continent: 'OC', continentName: 'Oceania', country: 'AU', countryName: 'Australia', region: 'AU-NSW' },
];

/** The sample locations, for the pickers of the Geolocation tab. */
export const SAMPLE_SITES: readonly Omit<SimNode, 'ip'>[] = SITES;

const RANGES = ['192.0.2', '198.51.100', '203.0.113'] as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** FACTS 3.5: a node must match no deny entry and, if there are allow entries, at least one of them. */
export function siteAllowed(site: Omit<SimNode, 'ip'>, geolocation: readonly string[]): boolean {
  let hasAllow = false;
  let allowed = false;
  for (const raw of geolocation) {
    const g = parseGeolocationEntry(raw);
    switch (g.kind) {
      case 'allow-all':
        hasAllow = true;
        allowed = true;
        break;
      case 'allow-continent':
      case 'legacy-continent':
        hasAllow = true;
        if (g.continent === site.continent) allowed = true;
        break;
      case 'allow-country':
      case 'legacy-country':
        hasAllow = true;
        if (g.country === site.country) allowed = true;
        break;
      case 'allow-region':
        hasAllow = true;
        if (g.country === site.country && g.region === site.region.slice(3)) allowed = true;
        if (g.region === site.region) allowed = true;
        break;
      case 'deny-continent':
        if (g.continent === site.continent && g.continent !== 'ALL') return false;
        break;
      case 'deny-country':
        if (g.country === site.country) return false;
        break;
      case 'deny-region':
        if (g.country === site.country && (g.region === site.region || g.region === site.region.slice(3))) {
          return false;
        }
        break;
      default:
        break;
    }
  }
  return hasAllow ? allowed : true;
}

/** How many of the sample locations the rules leave open. 0 means the sample network cannot place it. */
export function eligibleSites(geolocation: readonly string[]): number {
  return SITES.filter((s) => siteAllowed(s, geolocation)).length;
}

/**
 * Choose where `count` instances land: distinct addresses, each at an allowed sample location, spread by a
 * hash of the app name. Fewer nodes come back only when no location is allowed.
 */
export function placeInstances(spec: Pick<FluxAppSpec, 'name' | 'geolocation'>, count: number): SimNode[] {
  const sites = SITES.filter((s) => siteAllowed(s, spec.geolocation));
  if (sites.length === 0 || count < 1) return [];
  const used = new Set<string>();
  const out: SimNode[] = [];
  const seed = hash(spec.name.toLowerCase());
  // A stride coprime with the number of sites visits every site before it repeats one.
  const stride = coprimeStride(sites.length);
  for (let i = 0; i < count; i++) {
    const site = sites[(seed + i * stride) % sites.length] as Omit<SimNode, 'ip'>;
    let k = hash(`${spec.name}:${i}`);
    let ip = '';
    for (let tries = 0; tries < 800; tries++) {
      const range = RANGES[k % RANGES.length] as string;
      const host = 2 + (Math.floor(k / RANGES.length) % 250);
      ip = `${range}.${host}`;
      if (!used.has(ip)) break;
      k += 1;
    }
    used.add(ip);
    out.push({ ...site, ip });
  }
  return out;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The smallest stride of at least 3 that shares no factor with `n` (1 when there are 2 sites or fewer). */
function coprimeStride(n: number): number {
  if (n <= 2) return 1;
  for (let k = 3; k < n + 3; k++) if (gcd(k, n) === 1) return k;
  return 1;
}

// ---------------------------------------------------------------------------
// The install timeline
// ---------------------------------------------------------------------------

export type TimelineKind =
  | 'paid'
  | 'block'
  | 'listed'
  | 'chosen'
  | 'installing'
  | 'running'
  | 'domain'
  | 'done';

export interface TimelineEvent {
  id: string;
  /** Simulated seconds since the payment was sent. */
  at: number;
  kind: TimelineKind;
  title: string;
  detail: string;
  /** 1-based instance index, for the node events. */
  instance?: number;
  node?: SimNode;
  domain?: string;
}

export interface Timeline {
  events: TimelineEvent[];
  nodes: SimNode[];
  /** The app's own domain (an alias of the first port) and one domain per public port. */
  domains: { host: string; port: number; containerPort: number; alias: boolean }[];
  /** Simulated seconds until the last event. */
  length: number;
  /**
   * Simulated seconds at which FluxCloud's watcher stops: the first 30 second poll after one copy is
   * running ("Deployment Successful!"), or the end of its 30 minutes. Never after `length`.
   */
  successAt: number;
  /** `success`: a copy was listed. `timed-out`: none was, so the watcher gave up after 30 minutes. */
  outcome: 'success' | 'timed-out';
}

/** FACTS 6.6: the UI watcher polls every 30 seconds, for 30 minutes. */
export const WATCH_POLL_S = UI_WATCHER_POLL_SEC;
export const WATCH_LIMIT_S = UI_WATCHER_MIN * 60;

/** FACTS 6.1 row 9: a node usually starts installing 1 to 3 minutes after the listing, in seconds. */
const START_FROM_SEC = INSTALL_START_USUAL_MIN.from * 60;
const START_SPAN_SEC = (INSTALL_START_USUAL_MIN.to - INSTALL_START_USUAL_MIN.from) * 60;

/** Whole minutes and seconds, `m:ss`, for the simulated clock. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Build the timeline for a spec paid by `method`. Event times are in simulated seconds. A node picks the app
 * up 60 to 180 s after the block that lists it (FACTS 6.1 step 9: "1 to 3 min typical"); a pull and start
 * takes 15 to 75 s; FDM publishes the domains about 90 s after the first instance runs (FACTS has no
 * measurement of that delay). FluxCloud's watcher reports success at its first 30 second poll after one copy
 * is listed (FACTS 6.6), which can be before the domains answer.
 */
export function buildTimeline(spec: FluxAppSpec, method: 'card' | 'flux'): Timeline {
  const nodes = placeInstances(spec, spec.instances);
  const events: TimelineEvent[] = [];
  const push = (e: TimelineEvent) => events.push(e);

  push({
    id: 'paid',
    at: 0,
    kind: 'paid',
    title: method === 'card' ? 'Payment accepted by the payment bridge' : 'Payment sent with the message',
    detail:
      method === 'card'
        ? 'The bridge pays the network for you. FluxCloud then waits for the chain to show it.'
        : 'The amount and the registration message go to the payment address in one transaction.',
  });
  push({
    id: 'block',
    at: TARGET_BLOCK_SEC,
    kind: 'block',
    title: 'Seen in the next block',
    detail: `Every node scans each block. A payment that carries a known message links that message to the block (about ${TARGET_BLOCK_SEC} seconds).`,
  });
  push({
    id: 'listed',
    at: 35,
    kind: 'listed',
    title: 'Spec added to the global app list',
    detail: `${spec.name} now appears on every node's list, wanting ${spec.instances} ${spec.instances === 1 ? 'copy' : 'copies'}. Nothing assigns it to a node.`,
  });

  const chosenAt: number[] = [];
  const runningAt: number[] = [];
  nodes.forEach((node, i) => {
    const h = hash(`${spec.name}:${i}:t`);
    const choose = 35 + START_FROM_SEC + ((h % (START_SPAN_SEC + 1)) + i * 9); // 60 to 180 s after the listing, staggered
    const install = 15 + (hash(`${spec.name}:${i}:i`) % 61); // 15 to 75 s
    chosenAt.push(choose);
    runningAt.push(choose + install);
    push({
      id: `chosen-${i + 1}`,
      at: choose,
      kind: 'chosen',
      instance: i + 1,
      node,
      title: `A node picks the app up (copy ${i + 1} of ${nodes.length})`,
      detail: `${node.ip} in ${node.countryName} found the app short of copies and announced that it is installing.`,
    });
    push({
      id: `running-${i + 1}`,
      at: choose + install,
      kind: 'running',
      instance: i + 1,
      node,
      title: `Copy ${i + 1} is running`,
      detail: `${node.ip} pulled the image, started the container and announced that it is running.`,
    });
  });

  const names = domainsOf(spec);

  // Nothing ran: the watcher polls for its 30 minutes and gives up. The deployment is not cancelled.
  if (runningAt.length === 0) {
    push({
      id: 'done',
      at: WATCH_LIMIT_S,
      kind: 'done',
      title: 'Payment monitoring timed out. Please check your application status.',
      detail: `FluxCloud polled every ${UI_WATCHER_POLL_SEC} seconds for ${UI_WATCHER_MIN} minutes and saw no running copy. It stops watching; nothing is cancelled, and any node can still take the app.`,
    });
    events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    return {
      events,
      nodes,
      domains: names,
      length: WATCH_LIMIT_S,
      successAt: WATCH_LIMIT_S,
      outcome: 'timed-out',
    };
  }

  const firstRunning = Math.min(...runningAt);
  const publishAt = firstRunning + 90;
  names.forEach((d, i) => {
    push({
      id: `domain-${i + 1}`,
      at: publishAt + i * 4,
      kind: 'domain',
      domain: d.host,
      title: `${d.host} is live`,
      detail: d.alias
        ? `The app's own domain, an alias for the first port (${d.port}, container port ${d.containerPort}). The Flux Domain Manager puts the running copies behind it.`
        : `The domain of public port ${d.port}, container port ${d.containerPort}.`,
    });
  });
  const lastRunning = Math.max(...runningAt);
  // The watcher asks the location list, not the domains, once every 30 seconds.
  const successAt = (Math.floor(firstRunning / WATCH_POLL_S) + 1) * WATCH_POLL_S;
  push({
    id: 'done',
    at: successAt,
    kind: 'done',
    title: 'Deployment Successful!',
    detail:
      nodes.length > 1
        ? `FluxCloud polls every ${UI_WATCHER_POLL_SEC} seconds. This poll lists one running copy, which is all it checks, so it reports success while the other copies and the domains may still be coming up.`
        : `FluxCloud polls every ${UI_WATCHER_POLL_SEC} seconds. This poll lists the running copy, which is all it checks, so it reports success before the domains are published.`,
  });
  const end = Math.max(lastRunning, publishAt + Math.max(0, names.length - 1) * 4, successAt);
  events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return { events, nodes, domains: names, length: end, successAt, outcome: 'success' };
}

/** FACTS 6.4: `<name>.app.runonflux.io` is an alias for the first port; every port also gets `<name>_<port>`. */
function domainsOf(spec: FluxAppSpec): Timeline['domains'] {
  const names = derivedNames(spec);
  const out: Timeline['domains'] = [];
  const first = names.ports[0];
  if (first) {
    out.push({ host: names.appDomain, port: first.port, containerPort: first.containerPort, alias: true });
  }
  for (const p of names.ports) {
    out.push({ host: p.generatedDomain, port: p.port, containerPort: p.containerPort, alias: false });
  }
  return out;
}

/** The events at or before simulated second `t`. */
export function eventsUntil(timeline: Timeline, t: number): TimelineEvent[] {
  return timeline.events.filter((e) => e.at <= t);
}

/** How many copies are running at simulated second `t`. */
export function runningAt(timeline: Timeline, t: number): number {
  return timeline.events.filter((e) => e.kind === 'running' && e.at <= t).length;
}
