/**
 * The App Explorer's pure parts: masking addresses, building the public API URLs a learner can repeat by
 * hand, deciding what to say when a lookup fails, and the seeded suggestions.
 */
import type { ExploreApp, ExploreInstance, Tier } from '@shared/api';
import type { ApiError } from '@/data';

/** The public, read-only Flux API every lookup ultimately calls (FACTS 10.1). */
export const FLUX_API = 'https://api.runonflux.io';

// ---------------------------------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------------------------------

/**
 * Node addresses are public on the real API, but the Explorer teaches placement, not how to find a
 * person's server, so it shows country and tier and a masked address: `5.9.73.116` becomes `5.9.x.x`.
 * IPv6 keeps its first two groups. Anything unreadable becomes `hidden`.
 */
export function maskIp(raw: string): string {
  const ip = raw.trim().replace(/^\[|\]$/g, '');
  const v4 = ip.replace(/:\d+$/, '');
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(v4);
  if (m) return `${m[1]}.${m[2]}.x.x`;
  if (ip.includes(':')) {
    const g = ip.split(':').filter((x) => x !== '');
    if (g.length >= 2) return `${g[0]}:${g[1]}::x`;
  }
  return 'hidden';
}

// ---------------------------------------------------------------------------------------------------
// The calls behind a lookup
// ---------------------------------------------------------------------------------------------------

export interface PublicCall {
  id: 'spec' | 'location';
  title: string;
  /** What the call returns, in a sentence. */
  returns: string;
  url: string;
  curl: string;
}

/** The two public GET calls the Explorer is built from, for the name the learner looked up. */
export function publicCalls(name: string, docs?: { specUrl: string; locationUrl: string }): PublicCall[] {
  const n = encodeURIComponent(name);
  const spec = docs?.specUrl?.startsWith(FLUX_API) ? docs.specUrl : `${FLUX_API}/apps/appspecifications/${n}`;
  const loc = docs?.locationUrl?.startsWith(FLUX_API) ? docs.locationUrl : `${FLUX_API}/apps/location/${n}`;
  return [
    {
      id: 'spec',
      title: 'The spec',
      returns:
        'What the app asks for: its components, images, resources and ports. Encrypted for enterprise apps.',
      url: spec,
      curl: `curl -s ${spec}`,
    },
    {
      id: 'location',
      title: 'Where it runs',
      returns: 'One record per running instance: the node that announced it and when it last did.',
      url: loc,
      curl: `curl -s ${loc}`,
    },
  ];
}

// ---------------------------------------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------------------------------------

export type FailReason =
  | 'not-found'
  | 'bad-name'
  | 'rate-limited'
  | 'unavailable'
  | 'offline'
  | 'sample-only';

export interface FailureView {
  reason: FailReason;
  title: string;
  body: string;
  /** Seconds to wait before retrying, when the server said. */
  retryAfterSec: number | null;
}

/** What to say when the page is in offline sample mode and a learner asks for any other app. */
export function sampleOnlyFailure(name: string): FailureView {
  return {
    reason: 'sample-only',
    title: `"${name}" is not available in sample mode`,
    body: 'This page is in offline sample mode and is not asking the live network, so only the made-up sample app can be shown. Open the sample to see how a result is laid out.',
    retryAfterSec: null,
  };
}

/** Turns a failed lookup into something a learner can act on. `aborted` is not a failure: returns null. */
export function describeFailure(error: ApiError, name: string): FailureView | null {
  if (error.kind === 'aborted') return null;
  const status = error.status;
  if (error.code === 'app_not_found' || status === 404) {
    return {
      reason: 'not-found',
      title: `No app called "${name}"`,
      body: 'Names are not case sensitive, but they must otherwise match exactly. The app may have expired or been removed, or the name may be misspelled. Try searching for part of the name.',
      retryAfterSec: null,
    };
  }
  if (error.code === 'bad_name' || status === 400) {
    return {
      reason: 'bad-name',
      title: 'That is not a valid app name',
      body: 'App names use letters and digits, and hyphens inside the name. Try one of the suggestions, or search for part of a name.',
      retryAfterSec: null,
    };
  }
  if (status === 429 || error.code === 'rate_limited') {
    const wait = error.retryAfterMs ? Math.max(1, Math.ceil(error.retryAfterMs / 1000)) : null;
    return {
      reason: 'rate-limited',
      title: 'Too many lookups for a moment',
      body: `The Academy limits how often one visitor can ask the network.${wait ? ` Try again in ${wait} seconds.` : ' Wait a few seconds and try again.'}`,
      retryAfterSec: wait,
    };
  }
  if (error.code === 'upstream_unavailable' || (status !== undefined && status >= 500)) {
    return {
      reason: 'unavailable',
      title: 'The Flux API did not answer',
      body: 'The network lookup is temporarily unavailable. The rest of the Academy still works. Try again in a minute.',
      retryAfterSec: error.retryAfterMs ? Math.ceil(error.retryAfterMs / 1000) : null,
    };
  }
  return {
    reason: 'offline',
    title: 'The Academy cannot reach the network right now',
    body: 'Lookups need a connection to the live API. You can still try the sample app below to see how a result is laid out.',
    retryAfterSec: null,
  };
}

// ---------------------------------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------------------------------

export interface Suggestion {
  name: string;
  /** A few words on why it is a good one to look at. */
  hint: string;
}

/**
 * Apps that exist on the live network and teach something (confirmed against the live search on
 * 2026-10-12). They are names, not data: a lookup always asks the network, and an app that has since
 * expired simply answers "not found".
 */
export const SEEDED_SUGGESTIONS: readonly Suggestion[] = [
  { name: 'Minecraft', hint: 'A game server on a high port' },
  { name: 'MinecraftBedrock', hint: 'The same idea over UDP' },
  { name: 'minecraftflux', hint: 'Lower case, same network' },
];

/** When the seeded names were last confirmed. Shown next to them. */
export const SUGGESTIONS_AS_OF = '12 Oct 2026';

export const SAMPLE_NAME = 'sample-app';

// ---------------------------------------------------------------------------------------------------
// Presenting a result
// ---------------------------------------------------------------------------------------------------

export interface PlacementSummary {
  /** Distinct countries with at least one instance, biggest first. */
  countries: { cc: string; name: string; instances: number }[];
  /** Instances per tier. */
  tiers: Record<Tier, number>;
  /** Instances with no known tier. */
  unknownTier: number;
  /** Instances with no known country. */
  unlocated: number;
}

export function summarizePlacement(instances: readonly ExploreInstance[]): PlacementSummary {
  const byCountry = new Map<string, { name: string; n: number }>();
  const tiers: Record<Tier, number> = { cumulus: 0, nimbus: 0, stratus: 0 };
  let unknownTier = 0;
  let unlocated = 0;
  for (const i of instances) {
    if (i.tier) tiers[i.tier]++;
    else unknownTier++;
    const cc = i.cc?.toUpperCase();
    if (!cc) {
      unlocated++;
      continue;
    }
    const have = byCountry.get(cc);
    if (have) have.n++;
    else byCountry.set(cc, { name: i.country ?? cc, n: 1 });
  }
  const countries = [...byCountry.entries()]
    .map(([cc, v]) => ({ cc, name: v.name, instances: v.n }))
    .sort((a, b) => b.instances - a.instances || a.name.localeCompare(b.name));
  return { countries, tiers, unknownTier, unlocated };
}

/** The honest status of a lookup: how many of the wanted instances are running. */
export function runningStatus(app: Pick<ExploreApp, 'instancesRunning' | 'instancesWanted'>): {
  tone: 'ok' | 'warn' | 'crit';
  word: string;
  sentence: string;
} {
  const { instancesRunning: run, instancesWanted: want } = app;
  if (want <= 0) {
    return { tone: 'warn', word: 'Unknown', sentence: 'The app does not say how many instances it wants.' };
  }
  if (run >= want) {
    return { tone: 'ok', word: 'Fully placed', sentence: `All ${want} requested instances are running.` };
  }
  if (run === 0) {
    return {
      tone: 'crit',
      word: 'Nothing running',
      sentence: `It asked for ${want} and none is announcing right now. It may be installing, or its nodes may be offline.`,
    };
  }
  return {
    tone: 'warn',
    word: 'Short of its target',
    sentence: `It asked for ${want} and ${run} ${run === 1 ? 'is' : 'are'} running. The rest are installing, or were lost and are waiting for a replacement.`,
  };
}

/** "12 min ago" for an ISO time at `now`, or "unknown" when there is none. */
export function sinceText(iso: string | null, now: number): string {
  if (!iso) return 'unknown';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'unknown';
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 90) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
