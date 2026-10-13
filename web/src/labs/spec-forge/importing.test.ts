import { defaultSpec } from '@shared/flux/spec';
import { describe, expect, it } from 'vitest';
import { encodeShare } from '@/forge/model';
import { readImport } from './importing';

describe('readImport', () => {
  it('reads a spec', async () => {
    const r = await readImport(JSON.stringify(defaultSpec()));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe('json');
      expect(r.value.name).toBe('hello-flux');
    }
  });

  it('says what is wrong with broken JSON and where', async () => {
    const r = await readImport('{"version": 8,\n "name": }');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBe(2);
      expect(r.message.length).toBeGreaterThan(5);
    }
  });

  it('asks for something when there is nothing', async () => {
    const r = await readImport('   ');
    expect(r.ok).toBe(false);
  });

  it('unwraps an API answer and a list with one spec', async () => {
    const spec = defaultSpec();
    const wrapped = await readImport(JSON.stringify({ status: 'success', data: spec }));
    expect(wrapped.ok && wrapped.source).toBe('api');
    const listed = await readImport(JSON.stringify([spec]));
    expect(listed.ok && listed.source).toBe('api');
    const many = await readImport(JSON.stringify([spec, spec]));
    expect(many.ok).toBe(false);
    const empty = await readImport('[]');
    expect(empty.ok).toBe(false);
  });

  it('refuses things that are not a spec', async () => {
    expect((await readImport('42')).ok).toBe(false);
    expect((await readImport('"text"')).ok).toBe(false);
  });

  it('recognises a Docker Compose file and says what to do', async () => {
    const r = await readImport('services:\n  web:\n    image: nginx\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/compose/i);
  });

  it('opens a share link, a fragment and a bare payload', async () => {
    const payload = await encodeShare(defaultSpec());
    for (const text of [`https://academy.example/labs/spec-forge#s=${payload}`, `#s=${payload}`, payload]) {
      const r = await readImport(text);
      expect(r.ok, text.slice(0, 40)).toBe(true);
      if (r.ok) expect(r.source).toBe('link');
    }
  });

  it('reports a damaged link kindly', async () => {
    const r = await readImport('https://academy.example/labs/spec-forge#s=d.not-a-real-payload!');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/link/i);
  });
});
