// Adapted from fluxcommunity/server/test/core.test.ts, plus UpstreamClient tests
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BreakerOpenError, CircuitBreaker } from '../src/core/breaker.ts';
import { jitter, ManualClock } from '../src/core/clock.ts';
import { nextDelay } from '../src/core/loop.ts';
import { KeyedSingleFlight, SingleFlight } from '../src/core/singleflight.ts';
import { SwrCell } from '../src/core/swr.ts';
import { type FetchLike, UpstreamClient, UpstreamError } from '../src/core/upstream.ts';

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('SingleFlight', () => {
  it('shares one in-flight promise between concurrent callers', async () => {
    const sf = new SingleFlight<number>();
    let calls = 0;
    const d = deferred<number>();
    const fn = () => {
      calls += 1;
      return d.promise;
    };
    const a = sf.run(fn);
    const b = sf.run(fn);
    assert.equal(sf.active, true);
    d.resolve(7);
    assert.deepEqual(await Promise.all([a, b]), [7, 7]);
    assert.equal(calls, 1);
    assert.equal(sf.active, false);
    await sf.run(async () => {
      calls += 1;
      return 1;
    });
    assert.equal(calls, 2);
  });

  it('releases the slot after a rejection', async () => {
    const sf = new SingleFlight<number>();
    await assert.rejects(
      sf.run(async () => Promise.reject(new Error('boom'))),
      /boom/,
    );
    assert.equal(await sf.run(async () => 3), 3);
  });

  it('is keyed independently', async () => {
    const kf = new KeyedSingleFlight<string>();
    let calls = 0;
    const mk = (v: string) => async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return v;
    };
    const out = await Promise.all([kf.run('a', mk('a')), kf.run('a', mk('x')), kf.run('b', mk('b'))]);
    assert.deepEqual(out, ['a', 'a', 'b']);
    assert.equal(calls, 2);
    assert.equal(kf.size, 0);
  });
});

describe('SwrCell (ttl + stale-while-revalidate)', () => {
  it('serves fresh, then stale while one background refresh runs', async () => {
    const clock = new ManualClock(1_000_000);
    let n = 0;
    const d: ReturnType<typeof deferred<number>>[] = [];
    const cell = new SwrCell<number>({
      name: 't',
      ttlMs: 1_000,
      clock,
      load: () => {
        n += 1;
        const x = deferred<number>();
        d.push(x);
        return x.promise;
      },
    });
    assert.equal(cell.read().value, null); // empty: kicks the first load
    assert.equal(n, 1);
    (d[0] as ReturnType<typeof deferred<number>>).resolve(10);
    await cell.refresh();
    assert.deepEqual({ v: cell.peek().value, fresh: cell.peek().fresh, n }, { v: 10, fresh: true, n: 1 });

    clock.advance(1_500); // past ttl: stale value is still served
    const r1 = cell.read();
    const r2 = cell.read();
    assert.equal(r1.value, 10);
    assert.equal(r1.fresh, false);
    assert.equal(r2.value, 10);
    assert.equal(n, 2, 'many stale reads trigger exactly one revalidation');
    (d[1] as ReturnType<typeof deferred<number>>).resolve(11);
    await cell.refresh();
    assert.equal(cell.peek().value, 11);
    assert.equal(cell.peek().fresh, true);
  });

  it('keeps the previous value when a refresh fails and records the error', async () => {
    const clock = new ManualClock(0);
    let fail = false;
    const cell = new SwrCell<string>({
      name: 't',
      ttlMs: 100,
      clock,
      load: async () => {
        if (fail) throw new Error('upstream down');
        return 'ok';
      },
    });
    assert.equal(await cell.refresh(), true);
    fail = true;
    clock.advance(500);
    assert.equal(await cell.refresh(), false);
    assert.equal(cell.peek().value, 'ok');
    assert.equal(cell.peek().fresh, false);
    assert.match(cell.lastError ?? '', /upstream down/);
    assert.equal(cell.failures, 1);
  });

  it('drops the value past maxAgeMs', async () => {
    const clock = new ManualClock(0);
    const cell = new SwrCell<number>({ name: 't', ttlMs: 10, maxAgeMs: 100, clock, load: async () => 1 });
    await cell.refresh();
    clock.advance(99);
    assert.equal(cell.peek().value, 1);
    clock.advance(2);
    assert.equal(cell.peek().value, null);
  });

  it('does not hammer a failing upstream from reads', async () => {
    const clock = new ManualClock(0);
    let n = 0;
    const cell = new SwrCell<number>({
      name: 't',
      ttlMs: 1_000,
      clock,
      load: async () => {
        n += 1;
        throw new Error('x');
      },
    });
    cell.read();
    await cell.refresh();
    const before = n;
    cell.read();
    cell.read();
    assert.equal(n, before, 'reads inside the retry gap do not start new loads');
    clock.advance(6_000);
    cell.read();
    assert.equal(n, before + 1);
  });
});

describe('CircuitBreaker', () => {
  const mk = (clock: ManualClock) =>
    new CircuitBreaker({
      name: 'x',
      failureThreshold: 3,
      baseCooldownMs: 1_000,
      maxCooldownMs: 8_000,
      clock,
      rand: () => 0.5, // no jitter
    });

  it('opens after consecutive failures, fails fast, then half-opens with a single trial', async () => {
    const clock = new ManualClock(0);
    const b = mk(clock);
    const boom = async () => {
      throw new Error('boom');
    };
    for (let i = 0; i < 3; i++) await assert.rejects(b.exec(boom), /boom/);
    assert.equal(b.state, 'open');
    let called = false;
    await assert.rejects(
      b.exec(async () => {
        called = true;
      }),
      BreakerOpenError,
    );
    assert.equal(called, false);

    clock.advance(1_001);
    assert.equal(b.allow(), true, 'first trial admitted');
    assert.equal(b.state, 'half-open');
    assert.equal(b.allow(), false, 'only one trial at a time');
    b.success();
    assert.equal(b.state, 'closed');
  });

  it('doubles the cool-down on repeated trips up to the cap', () => {
    const clock = new ManualClock(0);
    const b = mk(clock);
    const trip = () => {
      for (let i = 0; i < 3; i++) b.failure();
    };
    trip();
    assert.equal(b.retryAfterMs, 1_000);
    clock.advance(1_000);
    assert.equal(b.allow(), true);
    b.failure(); // failed trial: re-open with the doubled cool-down
    assert.equal(b.retryAfterMs, 2_000);
    clock.advance(2_000);
    b.allow();
    b.failure();
    assert.equal(b.retryAfterMs, 4_000);
    clock.advance(4_000);
    b.allow();
    b.failure();
    assert.equal(b.retryAfterMs, 8_000);
    clock.advance(8_000);
    b.allow();
    b.failure();
    assert.equal(b.retryAfterMs, 8_000, 'capped');
  });

  it('a success resets the failure streak', async () => {
    const clock = new ManualClock(0);
    const b = mk(clock);
    b.failure();
    b.failure();
    b.success();
    b.failure();
    b.failure();
    assert.equal(b.state, 'closed');
  });
});

describe('scheduling helpers', () => {
  it('jitter stays within the ratio', () => {
    for (const r of [0, 0.25, 0.5, 0.999]) {
      const v = jitter(1000, 0.2, () => r);
      assert.ok(v >= 800 && v <= 1200, String(v));
    }
  });

  it('nextDelay backs off exponentially with a cap', () => {
    const rand = () => 0.5;
    assert.equal(nextDelay(1000, 0, 60_000, 0.1, rand), 1000);
    assert.equal(nextDelay(1000, 1, 60_000, 0.1, rand), 2000);
    assert.equal(nextDelay(1000, 3, 60_000, 0.1, rand), 8000);
    assert.equal(nextDelay(1000, 12, 60_000, 0.1, rand), 60_000);
  });
});

// ---------------------------------------------------------------------------
// UpstreamClient: the cached, single-flight, retrying, circuit-broken GET behind ctx.upstream
// ---------------------------------------------------------------------------

const jsonRes = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

function client(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
  clock = new ManualClock(0),
) {
  const calls: { url: URL; init?: RequestInit }[] = [];
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

describe('UpstreamClient', () => {
  it('sends the user agent, parses JSON and refuses origins that are not allow-listed', async () => {
    const { c, calls } = client(() => jsonRes({ ok: 1 }));
    const r = await c.get<{ ok: number }>('https://api.test/x');
    assert.deepEqual(r.value, { ok: 1 });
    assert.equal(r.source, 'live');
    assert.equal(
      (calls[0]?.init?.headers as Record<string, string> | undefined)?.['user-agent'],
      'test-agent',
    );
    await assert.rejects(
      c.get('https://evil.test/x'),
      (e: unknown) => e instanceof UpstreamError && e.kind === 'blocked',
    );
    assert.equal(calls.length, 1, 'a blocked origin never reaches fetch');
  });

  it('caches within ttl, serves stale while one background refresh runs, then waits past ttl + stale', async () => {
    let n = 0;
    const { c, calls, clock } = client(() => jsonRes({ n: ++n }));
    const opts = { key: 'k', ttlMs: 1_000, staleMs: 5_000 };
    assert.deepEqual((await c.get<{ n: number }>('https://api.test/a', opts)).value, { n: 1 });
    clock.advance(500);
    const hit = await c.get<{ n: number }>('https://api.test/a', opts);
    assert.deepEqual([hit.value.n, hit.source, hit.stale], [1, 'live', false]);
    assert.equal(calls.length, 1);

    clock.advance(1_000); // age 1500: stale window
    const [a, b] = await Promise.all([
      c.get<{ n: number }>('https://api.test/a', opts),
      c.get<{ n: number }>('https://api.test/a', opts),
    ]);
    assert.deepEqual([a.value.n, a.source, a.stale, b.value.n], [1, 'cache', true, 1]);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(calls.length, 2, 'one background refresh for any number of stale readers');
    assert.equal((await c.get<{ n: number }>('https://api.test/a', opts)).value.n, 2);

    clock.advance(10_000); // beyond ttl + stale: the caller waits for upstream
    assert.equal((await c.get<{ n: number }>('https://api.test/a', opts)).value.n, 3);
  });

  it('is single-flight: concurrent cold callers share one request', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const { c, calls } = client(async () => {
      await gate;
      return jsonRes({ v: 1 });
    });
    const opts = { key: 'sf', ttlMs: 10_000 };
    const all = Promise.all([1, 2, 3, 4].map(() => c.get('https://api.test/sf', opts)));
    release();
    await all;
    assert.equal(calls.length, 1);
  });

  it('retries 5xx and network errors with a new attempt, but not 4xx', async () => {
    let n = 0;
    const flaky = client(() => (++n < 2 ? new Response('no', { status: 503 }) : jsonRes({ ok: true })));
    assert.deepEqual((await flaky.c.get('https://api.test/r')).value, { ok: true });
    assert.equal(flaky.calls.length, 2);

    const gone = client(() => new Response('nope', { status: 404 }));
    await assert.rejects(
      gone.c.get('https://api.test/m'),
      (e: unknown) => e instanceof UpstreamError && e.status === 404,
    );
    assert.equal(gone.calls.length, 1, 'a 404 is final');
    const noRetry = client(() => new Response('no', { status: 500 }));
    await assert.rejects(noRetry.c.get('https://api.test/m', { retries: 0 }));
    assert.equal(noRetry.calls.length, 1);
  });

  it('turns a timeout into UpstreamError(timeout)', async () => {
    const { c } = client(() => {
      throw Object.assign(new Error('t'), { name: 'TimeoutError' });
    });
    await assert.rejects(
      c.get('https://api.test/t', { retries: 0 }),
      (e: unknown) => e instanceof UpstreamError && e.kind === 'timeout',
    );
  });

  it('opens the breaker after repeated failures, fails fast, and half-opens after the cool-down', async () => {
    let healthy = false;
    const { c, calls, clock } = client(() =>
      healthy ? jsonRes({ ok: 1 }) : new Response('x', { status: 502 }),
    );
    for (let i = 0; i < 2; i++) await assert.rejects(c.get('https://api.test/b', { retries: 0 }));
    assert.equal(c.breaker('api')?.state, 'open');
    const before = calls.length;
    await assert.rejects(c.get('https://api.test/b'), BreakerOpenError);
    assert.equal(calls.length, before, 'open breaker never calls fetch');
    assert.equal(c.status().api?.ok, false);

    healthy = true;
    clock.advance(1_500);
    assert.deepEqual((await c.get('https://api.test/b')).value, { ok: 1 });
    assert.equal(c.breaker('api')?.state, 'closed');
    assert.equal(c.status().api?.ok, true);
    assert.equal(c.status().api?.lastError, null);
  });

  it('does not count a 404 against the host', async () => {
    const { c } = client(() => new Response('missing', { status: 404 }));
    for (let i = 0; i < 5; i++) await assert.rejects(c.get('https://api.test/q', { retries: 0 }));
    assert.equal(c.breaker('api')?.state, 'closed');
  });

  it('keeps the previous value when validation rejects a newer answer', async () => {
    let body: unknown = { n: 5 };
    const { c, clock } = client(() => jsonRes(body));
    const opts = {
      key: 'v',
      ttlMs: 100,
      staleMs: 10_000,
      retries: 0,
      validate: (raw: unknown) => {
        const n = (raw as { n?: unknown }).n;
        if (typeof n !== 'number') throw new Error('bad shape');
        return n;
      },
    };
    assert.equal((await c.get<number>('https://api.test/v', opts)).value, 5);
    body = { n: 'nope' };
    clock.advance(500);
    const stale = await c.get<number>('https://api.test/v', opts);
    assert.deepEqual([stale.value, stale.source], [5, 'cache']);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal((await c.get<number>('https://api.test/v', opts)).value, 5, 'bad answer never replaces it');
    assert.match(c.status().api?.lastError ?? '', /bad shape/);
    clock.advance(20_000);
    await assert.rejects(c.get<number>('https://api.test/v', opts), UpstreamError);
  });

  it('revalidates with If-None-Match and treats 304 as a renewal', async () => {
    const { c, calls, clock } = client((_u, init) => {
      const inm = (init?.headers as Record<string, string> | undefined)?.['if-none-match'];
      return inm === '"v1"'
        ? new Response(null, { status: 304 })
        : jsonRes({ big: 'payload' }, { headers: { etag: '"v1"' } });
    });
    const opts = { key: 'e', ttlMs: 100, conditional: true };
    const first = await c.get<{ big: string }>('https://api.test/e', opts);
    clock.advance(1_000);
    const second = await c.get<{ big: string }>('https://api.test/e', opts);
    assert.equal(second.value, first.value, 'same object: the body was not re-parsed');
    assert.equal(calls.length, 2);
    assert.equal(second.ageMs, 0);
  });

  it('rejects an oversized body', async () => {
    const { c } = client(() => jsonRes({ pad: 'x'.repeat(5_000) }));
    await assert.rejects(
      c.get('https://api.test/s', { maxBytes: 1_000, retries: 0 }),
      (e: unknown) => e instanceof UpstreamError && e.kind === 'size',
    );
  });

  it('rejects everything when disabled (FIXTURES) and reports why', async () => {
    const c = new UpstreamClient({
      hosts: { 'https://api.test': 'api' },
      userAgent: 't',
      timeoutMs: 100,
      disabled: 'fixtures mode',
      fetch: async () => {
        throw new Error('must not be called');
      },
    });
    await assert.rejects(
      c.get('https://api.test/x'),
      (e: unknown) => e instanceof UpstreamError && e.kind === 'disabled',
    );
    assert.equal(c.status().api?.lastError, 'fixtures mode');
  });
});
