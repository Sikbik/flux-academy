import { FIXTURES } from '@shared/flux/fixtures';
import { describe, expect, it } from 'vitest';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  canCompress,
  decodeShare,
  encodeShare,
  readShareHash,
  shareUrl,
} from './share';

describe('base64url', () => {
  it('round trips arbitrary bytes without padding or url-unsafe characters', () => {
    const bytes = new Uint8Array(256).map((_, i) => i);
    const text = bytesToBase64Url(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(Array.from(base64UrlToBytes(text) ?? [])).toEqual(Array.from(bytes));
  });

  it('rejects characters outside the alphabet', () => {
    expect(base64UrlToBytes('ab cd')).toBeNull();
    expect(base64UrlToBytes('ab+cd')).toBeNull();
  });
});

describe('share links', () => {
  it('round trips every fixture and is much smaller than the JSON', async () => {
    expect(canCompress()).toBe(true);
    for (const f of FIXTURES) {
      const payload = await encodeShare(f.spec);
      expect(payload.startsWith('d.')).toBe(true);
      const r = await decodeShare(payload);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual(JSON.parse(JSON.stringify(f.spec)));
      expect(payload.length).toBeLessThan(JSON.stringify(f.spec).length);
    }
  });

  it('reads a payload with no method prefix as deflate', async () => {
    const payload = await encodeShare({ name: 'x' });
    const bare = payload.slice(2);
    const r = await decodeShare(bare);
    expect(r.ok).toBe(true);
  });

  it('reads the uncompressed form', async () => {
    const json = JSON.stringify({ name: 'plain', compose: [] });
    const payload = `r.${bytesToBase64Url(new TextEncoder().encode(json))}`;
    const r = await decodeShare(payload);
    expect(r.ok && r.value).toEqual({ name: 'plain', compose: [] });
  });

  it('never throws on damaged input and says why', async () => {
    const good = await encodeShare({ name: 'x', compose: [] });
    const cases: [string, string][] = [
      ['', 'empty'],
      ['d.', 'empty'],
      ['x.abcd', 'format'],
      ['d.@@@@', 'format'],
      [`${good.slice(0, 12)}`, 'corrupt'],
      ['d.AAAAAAAA', 'corrupt'],
      [`r.${bytesToBase64Url(new TextEncoder().encode('[1,2]'))}`, 'notjson'],
      [`r.${bytesToBase64Url(new TextEncoder().encode('{nope'))}`, 'notjson'],
      [`r.${'A'.repeat(70_000)}`, 'toolarge'],
    ];
    for (const [payload, reason] of cases) {
      const r = await decodeShare(payload);
      expect(r.ok, payload.slice(0, 30)).toBe(false);
      if (!r.ok) {
        expect(r.reason, payload.slice(0, 30)).toBe(reason);
        expect(r.message.length).toBeGreaterThan(10);
      }
    }
  });

  it('refuses a decompression bomb', async () => {
    const bomb = await encodeShare({ junk: 'a'.repeat(2_000_000) });
    const r = await decodeShare(bomb);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(['toolarge', 'corrupt']).toContain(r.reason);
  });
});

describe('hash handling', () => {
  it('finds the payload in a hash with other parameters', () => {
    expect(readShareHash('#s=d.abc')).toBe('d.abc');
    expect(readShareHash('#x=1&s=r.zz&y=2')).toBe('r.zz');
    expect(readShareHash('#other')).toBeNull();
    expect(readShareHash('')).toBeNull();
  });

  it('builds a full url', () => {
    const url = shareUrl('d.abc', {
      origin: 'https://academy.app.runonflux.io',
      pathname: '/labs/spec-forge',
    });
    expect(url).toBe('https://academy.app.runonflux.io/labs/spec-forge#s=d.abc');
  });
});
