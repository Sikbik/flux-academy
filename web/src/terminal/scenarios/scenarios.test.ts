import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BAKED_PRICING, defaultSpec, lintSpec, quote } from '@shared/flux';
import { describe, expect, it } from 'vitest';
import { Collector } from '@/learn/validate-core';
import { firstMatch, validateScript } from '@/learn/validate-terminal';
import { CommandPattern } from '../engine/regex';
import { createSession, type TerminalSession } from '../engine/session';
import { ManualScheduler } from '../engine/stream';
import { FIXED_NOW } from '../engine/testkit';
import type { TerminalScript } from '../engine/types';
import {
  APP_NOT_FOUND,
  BLOCK_COUNT,
  EXPLORER_LOCATION,
  EXPLORER_SPEC,
  MISSING_NAME,
  NODE_COUNT,
} from '../fixtures/flux-api';
import { PRICE_BODY } from './flux-api';
import { SCENARIOS } from './index';

const FIXED = { now: () => FIXED_NOW, instant: true } as const;

function sessionFor(script: TerminalScript): TerminalSession {
  return createSession({ script, ...FIXED });
}

/** Run a session's own plan to the end, re-planning after every command (state moves examples). */
function solve(s: TerminalSession): string[] {
  const typed: string[] = [];
  for (let guard = 0; guard < 40 && !s.getState().allDone; guard += 1) {
    const step = s.plan()[0];
    if (!step) break;
    typed.push(step.line);
    s.submit(step.line);
  }
  return typed;
}

describe.each(SCENARIOS.map((m) => [m.id, m] as const))('scenario %s', (_id, meta) => {
  const script = meta.script as TerminalScript;

  it('passes the lesson validator without errors', () => {
    const c = new Collector();
    validateScript(script, `scenario ${meta.id}`, c);
    const errors = c.problems.filter((p) => p.severity === 'error');
    expect(errors, errors.map((e) => `${e.code} ${e.path}: ${e.message}`).join('\n')).toEqual([]);
  });

  it('only warns about fallback variants that carry a goal without an example', () => {
    const c = new Collector();
    validateScript(script, `scenario ${meta.id}`, c);
    const odd = c.problems.filter((p) => p.severity === 'warning' && p.code !== 'command-no-example');
    expect(odd, odd.map((e) => `${e.code} ${e.path}: ${e.message}`).join('\n')).toEqual([]);
  });

  it('has every regex usable by the engine, on the built-in backtracking engine', () => {
    for (const [i, cmd] of script.commands.entries()) {
      const p = new CommandPattern(cmd.match);
      expect(p.usable, `command ${i}: ${cmd.match} (${p.problem ?? ''})`).toBe(true);
      expect(p.engine, `command ${i}: ${cmd.match}`).toBe('builtin');
    }
  });

  it('reaches every example through the command that owns it, as the validator does', () => {
    for (const [i, cmd] of script.commands.entries()) {
      if (cmd.example === undefined) continue;
      expect(firstMatch(script, cmd.example), `example of command ${i}: ${cmd.example}`).toBe(i);
    }
  });

  it('can be finished by typing its own examples', () => {
    const s = sessionFor(script);
    const typed = solve(s);
    expect(s.getState().allDone, `typed: ${typed.join(' | ')}`).toBe(true);
    expect(typed.length).toBeGreaterThan(0);
  });

  it('prints no unknown template placeholders and no leftover markup', () => {
    const s = sessionFor(script);
    solve(s);
    for (const e of s.getState().entries) {
      for (const l of e.lines) {
        expect(l.text, `${e.input} -> ${l.text}`).not.toMatch(
          /\{(?:\d|input|cwd|user|host|cmd|file:[^}]*)\}/,
        );
        expect(l.text).not.toMatch(/\[(?:ok|warn|err|dim|note|hi|key|str|num|kw|flag|cmd|path)\]/);
      }
      if (e.explain) expect(e.explain).not.toMatch(/\{(?:\d|file:[^}]*)\}/);
    }
  });

  it('has no em dashes, no emoji and says it is a simulation', () => {
    const all = JSON.stringify(script);
    expect(all).not.toMatch(/—/);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(script.intro?.join(' ')).toMatch(/Simulation/);
  });

  it('is deterministic: two runs print the same transcript', () => {
    const a = sessionFor(script);
    const b = sessionFor(script);
    solve(a);
    solve(b);
    const flat = (s: TerminalSession) => s.getState().entries.flatMap((e) => e.lines.map((l) => l.text));
    expect(flat(a)).toEqual(flat(b));
  });

  it('streams under a manual scheduler and credits goals only at the end of a command', () => {
    const scheduler = new ManualScheduler();
    const s = createSession({ script, scheduler, now: () => FIXED_NOW });
    const first = s.plan()[0];
    if (!first) throw new Error('no plan');
    s.submit(first.line);
    const goal = first.goal;
    // streaming commands have not credited yet; instant ones have
    const entry = s.getState().entries.at(-1);
    if (entry?.state === 'streaming') expect(s.getState().completed).not.toContain(goal);
    scheduler.flush();
    expect(s.getState().completed).toContain(goal);
  });
});

describe('docker-basics', () => {
  const script = SCENARIOS.find((s) => s.id === 'docker-basics')?.script as TerminalScript;

  it('lists nothing before the run and the image after it', () => {
    const s = sessionFor(script);
    s.submit('docker images');
    const empty =
      s
        .getState()
        .entries.at(-1)
        ?.lines.map((l) => l.text) ?? [];
    expect(empty.some((l) => l.includes('nginx'))).toBe(false);
    s.submit('docker run -d --name web -p 8080:80 nginx:1.27-alpine');
    s.submit('docker images');
    const full =
      s
        .getState()
        .entries.at(-1)
        ?.lines.map((l) => l.text) ?? [];
    expect(full.some((l) => l.includes('nginx'))).toBe(true);
  });

  it('shows the published port the learner chose, not a fixed one', () => {
    const s = sessionFor(script);
    s.submit('docker run -d --name shop -p 9090:80 nginx:1.27-alpine');
    s.submit('docker ps');
    const text =
      s
        .getState()
        .entries.at(-1)
        ?.lines.map((l) => l.text)
        .join('\n') ?? '';
    expect(text).toContain('9090->80/tcp');
    expect(text).toContain('shop');
  });

  it('refuses a second container with the same name and does not credit twice', () => {
    const s = sessionFor(script);
    s.submit('docker run -d --name web -p 8080:80 nginx:1.27-alpine');
    s.submit('docker run -d --name web -p 8081:80 nginx:1.27-alpine');
    const last = s.getState().entries.at(-1);
    expect(last?.lines[0]?.text).toContain('already in use');
    expect(last?.goals).toEqual([]);
  });

  it('shows a stopped container only with -a', () => {
    const s = sessionFor(script);
    s.submit('docker run -d --name web -p 8080:80 nginx:1.27-alpine');
    s.submit('docker stop web');
    s.submit('docker ps');
    const ps =
      s
        .getState()
        .entries.at(-1)
        ?.lines.map((l) => l.text)
        .join('\n') ?? '';
    expect(ps).not.toContain('web');
    s.submit('docker ps -a');
    const all =
      s
        .getState()
        .entries.at(-1)
        ?.lines.map((l) => l.text)
        .join('\n') ?? '';
    expect(all).toContain('Exited');
  });
});

describe('build-and-push', () => {
  const script = SCENARIOS.find((s) => s.id === 'build-and-push')?.script as TerminalScript;
  const text = (s: TerminalSession) =>
    s
      .getState()
      .entries.at(-1)
      ?.lines.map((l) => l.text) ?? [];

  it('warns about arm64 after a plain build and does not credit a push of it', () => {
    const s = sessionFor(script);
    s.submit('docker build -t you/app:1.0.0 .');
    expect(text(s).join('\n')).toContain('linux/arm64');
    s.submit('docker push you/app:1.0.0');
    const push = s.getState().entries.at(-1);
    expect(push?.lines.map((l) => l.text).join('\n')).toContain('linux/arm64');
    expect(s.getState().completed).not.toContain('push');
  });

  it('inspect reports arm64, then amd64 after the platform build', () => {
    const s = sessionFor(script);
    const inspect = "docker image inspect --format '{{.Os}}/{{.Architecture}}' you/app:1.0.0";
    s.submit('docker build -t you/app:1.0.0 .');
    s.submit(inspect);
    expect(text(s)[0]).toBe('linux/arm64');
    s.submit('docker build --platform linux/amd64 -t you/app:1.0.0 .');
    s.submit(inspect);
    expect(text(s)[0]).toBe('linux/amd64');
  });

  it('accepts the flags in either order and double quotes in the format', () => {
    const s = sessionFor(script);
    s.submit('docker build -t you/app:1.0.0 --platform=linux/amd64 .');
    expect(s.getState().completed).toEqual(expect.arrayContaining(['amd64', 'build']));
    s.submit('docker inspect -f "{{.Os}}/{{.Architecture}}" you/app:1.0.0');
    expect(text(s)[0]).toBe('linux/amd64');
  });

  it('completes build and amd64 together when the first build is already for amd64', () => {
    const s = sessionFor(script);
    s.submit('cat Dockerfile');
    s.submit('docker build --platform linux/amd64 -t you/app:1.0.0 .');
    expect(s.getState().completed).toEqual(['read', 'amd64', 'build']);
  });

  it('a tag copies the architecture of the moment, and a rebuild moves only its own tag', () => {
    const s = sessionFor(script);
    s.submit('docker build -t you/app:1.0.0 .');
    s.submit('docker tag you/app:1.0.0 you/app:latest');
    s.submit('docker build --platform linux/amd64 -t you/app:1.0.0 .');
    s.submit("docker image inspect --format '{{.Os}}/{{.Architecture}}' you/app:latest");
    expect(text(s)[0]).toBe('linux/arm64');
    s.submit('docker push you/app:1.0.0');
    expect(s.getState().completed).toContain('push');
  });

  it('push of an image that was never built fails with the real message', () => {
    const s = sessionFor(script);
    s.submit('docker push you/app:1.0.0');
    expect(text(s).join('\n')).toContain('An image does not exist locally with the tag: you/app:1.0.0');
  });

  it('images lines up its columns', () => {
    const s = sessionFor(script);
    s.submit('docker build -t you/app:1.0.0 .');
    s.submit('docker tag you/app:1.0.0 you/app:latest');
    s.submit('docker images');
    const lines = text(s).filter((l) => !l.startsWith('[') && l.trim() !== '');
    const col = lines[0]?.indexOf('IMAGE ID') ?? -1;
    expect(col).toBeGreaterThan(0);
    for (const l of lines.slice(1)) expect(l.slice(col, col + 12)).toMatch(/^[0-9a-f]{12}$/);
  });

  it('buildx --push completes build, amd64 and push at once', () => {
    const s = sessionFor(script);
    s.submit('docker buildx build --platform linux/amd64 -t you/app:1.0.0 --push .');
    expect(s.getState().completed).toEqual(expect.arrayContaining(['build', 'amd64', 'push']));
  });
});

describe('flux-api', () => {
  const script = SCENARIOS.find((s) => s.id === 'flux-api')?.script as TerminalScript;
  const BASE = 'https://api.runonflux.io';
  const out = (s: TerminalSession) =>
    s
      .getState()
      .entries.at(-1)
      ?.lines.map((l) => l.text) ?? [];

  it('prints the recorded body, minified, for each GET', () => {
    const s = sessionFor(script);
    s.submit(`curl ${BASE}/daemon/getblockcount`);
    expect(JSON.parse(out(s)[0] ?? '')).toEqual(BLOCK_COUNT);
    s.submit(`curl -s ${BASE}/daemon/getfluxnodecount`);
    expect(JSON.parse(out(s)[0] ?? '')).toEqual(NODE_COUNT);
    s.submit(`curl ${BASE}/apps/appspecifications/explorer`);
    expect(JSON.parse(out(s)[0] ?? '')).toEqual(EXPLORER_SPEC);
    s.submit(`curl ${BASE}/apps/location/explorer`);
    expect(JSON.parse(out(s)[0] ?? '')).toEqual(EXPLORER_LOCATION);
    s.submit(`curl ${BASE}/apps/appspecifications/doesnotexist123`);
    expect(JSON.parse(out(s)[0] ?? '')).toEqual(APP_NOT_FOUND);
    s.submit(`curl ${BASE}/apps/location`);
    expect(JSON.parse(out(s)[0] ?? '')).toEqual(MISSING_NAME);
  });

  it('pipes into the real jq and credits any filter that works', () => {
    const s = sessionFor(script);
    s.submit(`curl -s ${BASE}/daemon/getfluxnodecount | jq '.data["super-enabled"]'`);
    expect(out(s)).toEqual(['1691']);
    expect(s.getState().completed).toContain('jq');
  });

  it('does not credit jq for a filter that fails, and prints a jq style error', () => {
    const s = sessionFor(script);
    s.submit(`curl -s ${BASE}/daemon/getfluxnodecount | jq .data.`);
    expect(s.getState().completed).not.toContain('jq');
    expect(out(s).join('\n')).toMatch(/jq: error/);
  });

  it('-i adds headers and a blank line before the body', () => {
    const s = sessionFor(script);
    s.submit(`curl -i ${BASE}/daemon/getblockcount`);
    const lines = out(s);
    expect(lines[0]).toBe('HTTP/2 200');
    expect(lines).toContain('');
    expect(s.getState().completed).toContain('height');
  });

  it('answers the calculator with the same number quote() gives', () => {
    const s = sessionFor(script);
    s.submit(
      `curl -X POST ${BASE}/apps/calculatefiatandfluxprice -H 'Content-Type: text/plain' -d @spec.json`,
    );
    const body = JSON.parse(out(s)[0] ?? '') as {
      status: string;
      data: { usd: number; flux: number; fluxDiscount: number };
    };
    const q = quote(defaultSpec(), BAKED_PRICING.params, { fluxUsd: BAKED_PRICING.fluxUsd });
    expect(body.status).toBe('success');
    expect(body.data.usd).toBe(q.usdTotal ?? q.usdPerMonth);
    expect(body.data.flux).toBe(q.fluxTotal ?? q.fluxPerMonth);
    expect(body.data.fluxDiscount).toBe(5);
    expect(body).toEqual(PRICE_BODY);
    expect(s.getState().completed).toContain('price');
  });

  it('shows the JSON content type trap and does not credit it', () => {
    const s = sessionFor(script);
    s.submit(
      `curl -X POST ${BASE}/apps/calculatefiatandfluxprice -H "Content-Type: application/json" -d @spec.json`,
    );
    expect(out(s).join('\n')).toMatch(/never replies/);
    expect(s.getState().completed).not.toContain('price');
  });

  it('does not price a spec the learner edited', () => {
    const s = sessionFor(script);
    s.submit("echo '{}' > spec.json");
    s.submit(
      `curl -X POST ${BASE}/apps/calculatefiatandfluxprice -H 'Content-Type: text/plain' -d @spec.json`,
    );
    expect(out(s).join('\n')).toMatch(/only prices the spec\.json/);
    expect(s.getState().completed).not.toContain('price');
  });

  it('the spec in the sandbox is clean under the shared linter', () => {
    const report = lintSpec(defaultSpec());
    expect(report.errors).toBe(0);
  });
});

describe('flux-api fixtures match the research samples', () => {
  const dir = resolve(__dirname, '../../../../docs/research/samples');
  const read = (name: string): unknown => JSON.parse(readFileSync(resolve(dir, name), 'utf8'));

  it.each([
    ['daemon_getblockcount.json', BLOCK_COUNT],
    ['daemon_getfluxnodecount.json', NODE_COUNT],
    ['apps_appspecifications_explorer.json', EXPLORER_SPEC],
    ['apps_location_explorer.json', EXPLORER_LOCATION],
    ['err_app_not_found.json', APP_NOT_FOUND],
    ['err_missing_param.json', MISSING_NAME],
  ])('%s', (file, fixture) => {
    expect(JSON.parse(JSON.stringify(fixture))).toEqual(read(file));
  });
});

describe('dns-check', () => {
  const script = SCENARIOS.find((s) => s.id === 'dns-check')?.script as TerminalScript;
  const out = (s: TerminalSession) =>
    s
      .getState()
      .entries.at(-1)
      ?.lines.map((l) => l.text) ?? [];

  it('the resolver answers the typo and the provider answers the fix', () => {
    const s = sessionFor(script);
    s.submit('dig +short shop.example.com');
    expect(out(s)).toEqual(['lanternshop.runonflux.io.']);
    s.submit('dig +short shop.example.com @ns1.example-dns.net');
    expect(out(s)).toEqual(['lanternshop.app.runonflux.io.']);
  });

  it('the Flux name resolves through the load balancer to a documentation address', () => {
    const s = sessionFor(script);
    s.submit('dig +short lanternshop.app.runonflux.io');
    expect(out(s)).toEqual(['fdm-lb-1-2.runonflux.io.', '203.0.113.40']);
  });

  it('a proxied domain answers with addresses that are not the load balancer', () => {
    const s = sessionFor(script);
    s.submit('dig +short blog.example.com');
    const answers = out(s).filter((l) => /^\d+\.\d+\.\d+\.\d+$/.test(l));
    expect(answers.length).toBeGreaterThan(0);
    expect(answers).not.toContain('203.0.113.40');
    expect(s.getState().completed).toContain('proxy');
  });

  it('uses only reserved names and documentation addresses', () => {
    const s = sessionFor(script);
    solve(s);
    const all = s
      .getState()
      .entries.flatMap((e) => e.lines.map((l) => l.text))
      .join('\n');
    for (const ip of all.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? []) {
      if (ip.startsWith('127.')) continue;
      expect(ip, ip).toMatch(/^(?:192\.0\.2|198\.51\.100|203\.0\.113)\./);
    }
  });
});
