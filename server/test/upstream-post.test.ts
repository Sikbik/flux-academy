import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ManualClock } from '../src/core/clock.ts';
import { type FetchLike, UpstreamClient, UpstreamError } from '../src/core/upstream.ts';

const jsonRes = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

function client(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const clock = new ManualClock(0);
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return handler(url, init);
  };
  const c = new UpstreamClient({
    hosts: { 'https://api.test': 'api' },
    userAgent: 'test-agent',
    timeoutMs: 500,
    fetch: fetchImpl,
    clock,
    retryBaseMs: 1,
    breaker: { failureThreshold: 2, baseCooldownMs: 1_000 },
  });
  return { c, calls, clock };
}

describe('UpstreamClient.post', () => {
  it('sends the body as text/plain with the POST method and the user agent', async () => {
    const { c, calls } = client(() => jsonRes({ status: 'success', data: { usd: 1 } }));
    const r = await c.post<{ data: { usd: number } }>('https://api.test/calc', '{"a":1}');
    assert.equal(r.value.data.usd, 1);
    const init = calls[0]?.init;
    assert.equal(init?.method, 'POST');
    assert.equal(init?.body, '{"a":1}');
    const h = init?.headers as Record<string, string>;
    assert.match(h['content-type'] ?? '', /^text\/plain/);
    assert.equal(h['user-agent'], 'test-agent');
    assert.equal(init?.redirect, 'error');
  });

  it('refuses origins that are not allow-listed without calling fetch', async () => {
    const { c, calls } = client(() => jsonRes({}));
    await assert.rejects(
      c.post('https://evil.test/x', '{}'),
      (e: unknown) => e instanceof UpstreamError && e.kind === 'blocked',
    );
    assert.equal(calls.length, 0);
  });

  it('treats HTTP 200 with status "error" as a rejected failure, not retried and not a breaker strike', async () => {
    const { c, calls } = client(() => jsonRes({ status: 'error', data: { message: 'bad spec' } }));
    for (let i = 0; i < 5; i++) {
      await assert.rejects(
        c.post('https://api.test/calc', '{}', { retries: 3 }),
        (e: unknown) => e instanceof UpstreamError && e.kind === 'rejected' && /bad spec/.test(e.message),
      );
    }
    assert.equal(calls.length, 5, 'one attempt per call: input errors are never retried');
    assert.equal(c.breaker('api')?.state, 'closed', 'the host stays healthy');
    assert.equal(c.status().api?.lastError?.includes('bad spec'), true);
  });

  it('caches by key with a ttl and shares one request between concurrent callers', async () => {
    let n = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { c, calls, clock } = client(async () => {
      await gate;
      return jsonRes({ status: 'success', data: { n: ++n } });
    });
    const opts = { key: 'q1', ttlMs: 10_000 };
    const all = Promise.all(
      [1, 2, 3].map(() => c.post<{ data: { n: number } }>('https://api.test/calc', 'A', opts)),
    );
    release();
    const rs = await all;
    assert.equal(calls.length, 1);
    assert.deepEqual(
      rs.map((r) => r.value.data.n),
      [1, 1, 1],
    );
    clock.advance(5_000);
    assert.equal((await c.post<{ data: { n: number } }>('https://api.test/calc', 'A', opts)).value.data.n, 1);
    assert.equal(calls.length, 1, 'served from the cache');
    clock.advance(6_000);
    assert.equal((await c.post<{ data: { n: number } }>('https://api.test/calc', 'A', opts)).value.data.n, 2);
  });

  it('retries a 5xx once and then succeeds, re-sending the same body', async () => {
    let n = 0;
    const { c, calls } = client(() =>
      ++n === 1 ? new Response('no', { status: 503 }) : jsonRes({ status: 'success', data: 1 }),
    );
    const r = await c.post('https://api.test/calc', 'BODY', { retries: 1 });
    assert.equal((r.value as { data: number }).data, 1);
    assert.deepEqual(
      calls.map((x) => x.init?.body),
      ['BODY', 'BODY'],
    );
  });

  it('counts timeouts and 5xx against the breaker and rejects while it is open', async () => {
    const { c, calls } = client(() => new Response('x', { status: 502 }));
    for (let i = 0; i < 2; i++) await assert.rejects(c.post('https://api.test/calc', '{}', { retries: 0 }));
    await assert.rejects(c.post('https://api.test/calc', '{}', { retries: 0 }), /circuit|open/i);
    assert.equal(calls.length, 2);
  });

  it('GET is unchanged: method GET, no body, no content type', async () => {
    const { c, calls } = client(() => jsonRes({ ok: 1 }));
    await c.get('https://api.test/x');
    assert.equal(calls[0]?.init?.method, 'GET');
    assert.equal(calls[0]?.init?.body, undefined);
    const headers = (calls[0]?.init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers['content-type'], undefined);
  });

  it('does not treat status "error" on a GET as rejected (existing behaviour)', async () => {
    const { c } = client(() => jsonRes({ status: 'error', data: { message: 'nope' } }));
    const r = await c.get<{ status: string }>('https://api.test/x');
    assert.equal(r.value.status, 'error');
  });
});
