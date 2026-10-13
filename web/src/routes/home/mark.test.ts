import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARK_SHARDS, MARK_VIEWBOX } from './mark';

const SVG = readFileSync(resolve(__dirname, '../../../public/brand/mark/flux-mark-white.svg'), 'utf8');

function paths(svg: string): { d: string; transform: string }[] {
  const out: { d: string; transform: string }[] = [];
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const tag = m[0];
    const d = /\bd="([^"]*)"/.exec(tag)?.[1];
    const transform = /\btransform="([^"]*)"/.exec(tag)?.[1] ?? '';
    if (d) out.push({ d, transform });
  }
  return out;
}

describe('the intro mark', () => {
  it('is the official Flux symbol, byte for byte', () => {
    expect(MARK_SHARDS).toEqual(paths(SVG));
  });

  it('has the official view box', () => {
    const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(SVG);
    expect(vb).not.toBeNull();
    expect(Number(vb?.[1])).toBe(MARK_VIEWBOX.w);
    expect(Number(vb?.[2])).toBe(MARK_VIEWBOX.h);
  });

  it('is four shards', () => {
    expect(MARK_SHARDS).toHaveLength(4);
  });
});
