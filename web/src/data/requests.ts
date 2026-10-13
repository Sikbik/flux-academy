/**
 * One-shot request helpers: `postLint`, `postQuote`, `exploreApp`, `exploreSearch`. They go through the
 * shared REST client (timeouts, abort, validation) and never throw: a failure is an `ApiResult` with
 * `ok: false` and a short, friendly message.
 *
 * In `?demo=1` the API is not used. Lint and quote still work locally (see quote.ts); app lookups
 * answer with a clearly labelled sample so the Explorer lab can be developed offline.
 */

import type { Envelope, ExploreApp, ExploreSearch, Meta, QuoteRequest, QuoteResponse } from '@shared/api';
import type { LintReport } from '@shared/flux/types';
import { getFlags } from '@/lib/flags';
import { type ApiClient, type ApiResult, createApiClient, type RequestOptions } from './api';

let client: ApiClient | null = null;

/** The app's one REST client. Created on first use. */
export function getApiClient(): ApiClient {
  client ??= createApiClient();
  return client;
}

/** Replace the shared client (tests). Pass null to reset. */
export function setApiClient(next: ApiClient | null): void {
  client = next;
}

function demoFailure<T>(): ApiResult<T> {
  const now = Date.now();
  return {
    ok: false,
    error: { kind: 'network', message: 'Demo mode: the API is not used.' },
    requestStartedAt: now,
    receivedAt: now,
  };
}

/** `POST /api/v1/lint`: teachable validation of a spec, by the server's copy of the shared engine. */
export function postLint(spec: unknown, opts?: RequestOptions): Promise<ApiResult<LintReport>> {
  if (getFlags().demo) return Promise.resolve(demoFailure());
  return getApiClient().lint(spec, opts);
}

/** `POST /api/v1/quote`: the price of a spec. With `verify`, the server may confirm with Flux's own calculator. */
export function postQuote(req: QuoteRequest, opts?: RequestOptions): Promise<ApiResult<QuoteResponse>> {
  if (getFlags().demo) return Promise.resolve(demoFailure());
  return getApiClient().quote(req, opts);
}

const SAMPLE_META: Meta = {
  generatedAt: '2026-10-12T20:21:28.753Z',
  asOf: '2026-10-12T20:21:28.753Z',
  ageMs: 0,
  stale: true,
  source: 'fallback',
};

/** A made-up app for `?demo=1`, so the Explorer can be built offline. Always labelled fallback. */
export const SAMPLE_APP: ExploreApp = {
  name: 'sample-app',
  description: 'A made-up app for the offline sample. Real lookups need the API.',
  version: 8,
  instancesWanted: 5,
  instancesRunning: 5,
  height: null,
  blocksRemaining: null,
  components: [{ name: 'web', repotag: 'nginx:alpine', cpu: 0.5, ram: 500, hdd: 5, ports: [8080] }],
  instances: [
    {
      ip: '192.0.2.10',
      tier: 'cumulus',
      cc: 'DE',
      country: 'Germany',
      lat: 50.1,
      lon: 8.7,
      broadcastedAt: null,
    },
    {
      ip: '192.0.2.11',
      tier: 'nimbus',
      cc: 'FI',
      country: 'Finland',
      lat: 60.2,
      lon: 24.9,
      broadcastedAt: null,
    },
    {
      ip: '192.0.2.12',
      tier: 'stratus',
      cc: 'US',
      country: 'United States',
      lat: 39.0,
      lon: -77.5,
      broadcastedAt: null,
    },
    {
      ip: '192.0.2.13',
      tier: 'cumulus',
      cc: 'FR',
      country: 'France',
      lat: 48.9,
      lon: 2.4,
      broadcastedAt: null,
    },
    {
      ip: '192.0.2.14',
      tier: 'nimbus',
      cc: 'CA',
      country: 'Canada',
      lat: 45.5,
      lon: -73.6,
      broadcastedAt: null,
    },
  ],
  enterprise: false,
  docs: { specUrl: '', locationUrl: '' },
};

function sample<T>(data: T): ApiResult<T> {
  const now = Date.now();
  const envelope: Envelope<T> = { data, meta: SAMPLE_META };
  return { ok: true, envelope, requestStartedAt: now, receivedAt: now };
}

/** `GET /api/v1/explore/app?name=`: where a real app runs right now. */
export function exploreApp(name: string, opts?: RequestOptions): Promise<ApiResult<ExploreApp>> {
  if (getFlags().demo) {
    return Promise.resolve(
      name.trim().toLowerCase() === SAMPLE_APP.name
        ? sample(SAMPLE_APP)
        : {
            ok: false,
            error: { kind: 'http', message: 'Demo mode: only the sample app is available.', status: 404 },
            requestStartedAt: Date.now(),
            receivedAt: Date.now(),
          },
    );
  }
  return getApiClient().exploreApp(name, opts);
}

/** `GET /api/v1/explore/search?q=`: find real app names to look at. */
export function exploreSearch(query: string, opts?: RequestOptions): Promise<ApiResult<ExploreSearch>> {
  if (getFlags().demo) {
    const q = query.trim().toLowerCase();
    const names = SAMPLE_APP.name.includes(q) ? [{ name: SAMPLE_APP.name, instances: 5 }] : [];
    return Promise.resolve(sample({ query, names }));
  }
  return getApiClient().exploreSearch(query, opts);
}
