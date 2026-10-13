// Adapted from fluxcommunity/server/test/helpers.ts
import { rmSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Config, loadConfig } from '../src/config.ts';
import { createLogger } from '../src/core/log.ts';
import { type RunningServer, type StartOptions, startServer } from '../src/server.ts';

export const quietLog = createLogger('silent');

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({ PORT: '0', HOST: '127.0.0.1', LOG_LEVEL: 'silent', ...overrides });
}

export interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  text: string;
  json<T = unknown>(): T;
}

/** Raw HTTP request that does NOT decompress, so tests can inspect Content-Encoding and sizes. */
export function request(
  port: number,
  path: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string | Buffer } = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: opts.method ?? 'GET',
        headers: { connection: 'close', ...opts.headers },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body,
            get text() {
              return body.toString('utf8');
            },
            json<T>() {
              return JSON.parse(body.toString('utf8')) as T;
            },
          });
        });
      },
    );
    req.on('error', reject);
    req.end(opts.body);
  });
}

/** POST a JSON value. */
export function postJson(port: number, path: string, value: unknown, headers: Record<string, string> = {}) {
  return request(port, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(value),
  });
}

const temps: string[] = [];
process.once('exit', () => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

/** A temp directory removed when the test process exits. */
export async function makeTempDir(prefix = 'academy-test-'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

export async function makeWebDist(files: Record<string, string | Buffer>): Promise<string> {
  const dir = await makeTempDir('academyweb-');
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, content);
  }
  return dir;
}

export interface TestServer extends RunningServer {
  config: Config;
}

/** A real HTTP server on an ephemeral port. `FIXTURES` defaults to on: fully offline. */
export async function startTestServer(
  overrides: Record<string, string> = {},
  opts: StartOptions = {},
): Promise<TestServer> {
  const config = testConfig({ FIXTURES: '1', ...overrides });
  const running = await startServer(config, quietLog, opts);
  return Object.assign(running, { config });
}

/** Fixtures server; `blockMs` shortens the simulated block interval. */
export function startFixtureServer(
  overrides: Record<string, string> = {},
  opts: StartOptions | number = {},
): Promise<TestServer> {
  return startTestServer(overrides, typeof opts === 'number' ? { blockMs: opts } : opts);
}

export interface Frame {
  event: string;
  data: string;
}

/** Reads SSE frames until `done` says so or `ms` elapses. */
export async function collectFrames(
  port: number,
  done: (frames: Frame[]) => boolean,
  ms = 4_000,
  path = '/api/v1/stream',
): Promise<Frame[]> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const dec = new TextDecoder();
  const frames: Frame[] = [];
  let buf = '';
  const end = Date.now() + ms;
  while (Date.now() < end && !done(frames)) {
    const { value, done: closed } = await reader.read();
    if (closed) break;
    buf += dec.decode(value);
    let i = buf.indexOf('\n\n');
    while (i !== -1) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(raw)?.[1];
      const data = /^data: (.*)$/m.exec(raw)?.[1];
      if (ev && data !== undefined) frames.push({ event: ev, data });
      i = buf.indexOf('\n\n');
    }
  }
  await reader.cancel();
  return frames;
}
