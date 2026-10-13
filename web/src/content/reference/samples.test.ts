/**
 * The API samples: every endpoint has one, it parses, it has the envelope, and it equals the research
 * original when that is available (the container build does not ship `docs/`, so the copy is the source
 * of truth at run time and this test is what keeps the two from drifting).
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENDPOINTS } from './endpoints.data';
import { sampleKeys, sampleOf, sampleText } from './samples';

const RESEARCH = fileURLToPath(new URL('../../../../docs/research/samples/', import.meta.url));

describe('samples', () => {
  it('has a sample for every endpoint', () => {
    const missing = ENDPOINTS.filter((e) => sampleOf(e.sample) === undefined).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it('gives every endpoint a unique id and a unique method and path', () => {
    const ids = ENDPOINTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const routes = ENDPOINTS.map((e) => `${e.method} ${e.host} ${e.path}`);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('every sample carries the status envelope', () => {
    for (const key of sampleKeys()) {
      const v = sampleOf(key) as { status?: unknown } | undefined;
      expect(['success', 'error'], key).toContain(v?.status);
    }
  });

  it('pretty prints with two spaces and parses back', () => {
    const text = sampleText('daemon_getblockcount');
    expect(JSON.parse(text)).toEqual(sampleOf('daemon_getblockcount'));
    expect(text).toContain('\n  "status"');
  });

  it('equals the research original, when the repository has it', () => {
    if (!existsSync(RESEARCH)) return;
    for (const key of sampleKeys()) {
      const file = `${RESEARCH}${key}.json`;
      if (!existsSync(file)) continue;
      expect(sampleOf(key), key).toEqual(JSON.parse(readFileSync(file, 'utf8')));
    }
  });

  it('every endpoint has a curl line that names its host', async () => {
    const { curlFor } = await import('./api');
    for (const e of ENDPOINTS) {
      const line = curlFor(e);
      expect(line, e.id).toContain('curl');
      expect(line, e.id).toContain(e.host === 'stats' ? 'stats.runonflux.io' : 'api.runonflux.io');
      if (e.method === 'POST') expect(line).toContain('Content-Type: text/plain');
    }
  });

  it('says text/plain wherever the calculator is described', () => {
    const calc = ENDPOINTS.find((e) => e.method === 'POST');
    expect(calc?.warning).toContain('text/plain');
  });
});
