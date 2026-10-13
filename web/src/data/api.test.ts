import { API_PATHS } from '@shared/api';
import { describe, expect, it } from 'vitest';
import { createApiClient, MAX_BODY_BYTES } from './api';
import { getBaked } from './baked';
import { envelope } from './testkit';

type Handler = (
  url: string,
  init?: RequestInit,
) => { status: number; body: unknown; headers?: Record<string, string> };

function fakeFetch(handler: Handler) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const r = handler(url, init);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (k: string) => r.headers?.[k.toLowerCase()] ?? null },
      json: async () => {
        if (typeof r.body === 'string') throw new SyntaxError('not json');
        return r.body;
      },
    };
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const noSleep = async () => undefined;

describe('api client', () => {
  it('returns a validated envelope', async () => {
    const f = fakeFetch(() => ({ status: 200, body: envelope(getBaked().network, Date.now()) }));
    const api = createApiClient({ fetch: f.fetchImpl, sleep: noSleep });
    const res = await api.network();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.envelope.data.nodes.total).toBe(getBaked().network.nodes.total);
    expect(f.calls[0]?.url).toBe(API_PATHS.network);
  });

  it('retries a 500 once, then reports an http error with the server message', async () => {
    const f = fakeFetch(() => ({
      status: 503,
      body: { error: { code: 'upstream_down', message: 'The upstream is down.' } },
    }));
    const api = createApiClient({ fetch: f.fetchImpl, sleep: noSleep, retries: 1 });
    const res = await api.geo();
    expect(f.calls).toHaveLength(2);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe('http');
      expect(res.error.code).toBe('upstream_down');
      expect(res.error.message).toBe('The upstream is down.');
    }
  });

  it('does not retry a 404', async () => {
    const f = fakeFetch(() => ({ status: 404, body: 'nope' }));
    const api = createApiClient({ fetch: f.fetchImpl, sleep: noSleep });
    const res = await api.exploreApp('missing');
    expect(f.calls).toHaveLength(1);
    expect(!res.ok && res.error.status).toBe(404);
  });

  it('reports a bad payload as invalid, never a half-built object', async () => {
    const f = fakeFetch(() => ({ status: 200, body: { data: { chain: {} }, meta: envelope(1, 0).meta } }));
    const api = createApiClient({ fetch: f.fetchImpl, sleep: noSleep });
    const res = await api.network();
    expect(!res.ok && res.error.kind).toBe('invalid');
  });

  it('reports a network failure and an abort', async () => {
    const api = createApiClient({
      fetch: (async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof fetch,
      sleep: noSleep,
      retries: 0,
    });
    const res = await api.blocks();
    expect(!res.ok && res.error.kind).toBe('network');

    const controller = new AbortController();
    controller.abort();
    const aborted = await api.blocks({ signal: controller.signal });
    expect(!aborted.ok && aborted.error.kind).toBe('aborted');
  });

  it('times out a request that never answers', async () => {
    const hang = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })) as unknown as typeof fetch;
    const api = createApiClient({ fetch: hang, timeoutMs: 20, retries: 0, sleep: noSleep });
    const res = await api.pricing();
    expect(!res.ok && res.error.kind).toBe('timeout');
  });

  it('posts JSON, validates the quote response, and refuses a body that is too large', async () => {
    const quote = {
      usdPerMonth: 2.99,
      fluxPerMonth: null,
      fluxUsd: null,
      months: 1,
      lines: [{ id: 'cpu', label: 'CPU', usd: 0.5 }],
      minimumApplied: false,
      basis: 'computed',
      paramsSource: 'live',
    };
    const lint = { valid: true, errors: 0, warnings: 0, infos: 0, issues: [] };
    const f = fakeFetch(() => ({ status: 200, body: envelope({ quote, lint }, Date.now()) }));
    const api = createApiClient({ fetch: f.fetchImpl, sleep: noSleep });
    const res = await api.quote({ spec: { name: 'x' }, months: 1 });
    expect(res.ok).toBe(true);
    expect(f.calls[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(f.calls[0]?.init?.body))).toEqual({ spec: { name: 'x' }, months: 1 });

    const big = await api.lint({ blob: 'x'.repeat(MAX_BODY_BYTES) });
    expect(!big.ok && big.error.kind).toBe('too-large');
    expect(f.calls).toHaveLength(1);
  });

  it('keeps what the server said about verification, and ignores a malformed answer', async () => {
    const quote = {
      usdPerMonth: 4.49,
      fluxPerMonth: 51.3,
      fluxUsd: 0.083,
      months: 1,
      lines: [],
      minimumApplied: false,
      basis: 'computed',
      paramsSource: 'live',
    };
    const lint = { valid: true, errors: 0, warnings: 0, infos: 0, issues: [] };
    const answers = [
      { requested: true, confirmed: false, reason: 'rate_limited' },
      { requested: true, confirmed: true, officialUsd: 4.49, drift: false },
      { requested: 'yes' },
    ];
    for (const verification of answers) {
      const f = fakeFetch(() => ({
        status: 200,
        body: envelope({ quote, lint, verification }, Date.now()),
      }));
      const api = createApiClient({ fetch: f.fetchImpl, sleep: noSleep });
      const res = await api.quote({ spec: { name: 'x' }, verify: true });
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      expect(res.envelope.data.verification).toEqual(
        typeof verification.requested === 'boolean' ? verification : undefined,
      );
    }
  });

  it('encodes explore parameters', async () => {
    const f = fakeFetch(() => ({ status: 200, body: envelope({ query: 'a b', names: [] }, Date.now()) }));
    const api = createApiClient({ fetch: f.fetchImpl, sleep: noSleep });
    await api.exploreSearch('a b&c');
    expect(f.calls[0]?.url).toBe(`${API_PATHS.exploreSearch}?q=a%20b%26c`);
  });
});
