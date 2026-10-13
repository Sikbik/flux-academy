import { describe, expect, it } from 'vitest';
import { ManualScheduler } from '../engine/stream';
import { startTyping } from './typing';

describe('startTyping', () => {
  it('types one character at a time and resolves true', async () => {
    const s = new ManualScheduler();
    const seen: string[] = [];
    const job = startTyping('docker ps', (v) => seen.push(v), { scheduler: s });
    expect(seen).toEqual(['']);
    s.flush();
    expect(await job.done).toBe(true);
    expect(seen.at(-1)).toBe('docker ps');
    expect(seen.length).toBe('docker ps'.length + 1);
    for (let i = 1; i < seen.length; i += 1) expect('docker ps'.startsWith(seen[i] as string)).toBe(true);
  });

  it('is instant when asked', async () => {
    const seen: string[] = [];
    const job = startTyping('ls', (v) => seen.push(v), { instant: true });
    expect(await job.done).toBe(true);
    expect(seen).toEqual(['ls']);
  });

  it('cancel keeps what was typed and resolves false', async () => {
    const s = new ManualScheduler();
    let value = '';
    const job = startTyping(
      'docker images',
      (v) => {
        value = v;
      },
      { scheduler: s },
    );
    s.advance(400);
    const partial = value;
    job.cancel();
    s.flush();
    expect(await job.done).toBe(false);
    expect(value).toBe(partial);
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan('docker images'.length);
  });

  it('finish completes the line at once', async () => {
    const s = new ManualScheduler();
    let value = '';
    const job = startTyping(
      'cat Dockerfile',
      (v) => {
        value = v;
      },
      { scheduler: s },
    );
    s.advance(200);
    job.finish();
    expect(await job.done).toBe(true);
    expect(value).toBe('cat Dockerfile');
    expect(s.pending).toBe(0);
  });

  it('a human pace: a short command takes a fraction of a second to a few seconds', () => {
    const s = new ManualScheduler();
    let value = '';
    startTyping(
      'docker run -d --name web -p 8080:80 nginx:1.27-alpine',
      (v) => {
        value = v;
      },
      { scheduler: s },
    );
    s.advance(500);
    expect(value.length).toBeGreaterThan(3);
    expect(value.length).toBeLessThan(25);
    s.flush();
    expect(value).toBe('docker run -d --name web -p 8080:80 nginx:1.27-alpine');
  });
});
