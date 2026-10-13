import { describe, expect, it } from 'vitest';
import { Governor, parseTierQuery, pickStartTier } from './quality';

describe('parseTierQuery', () => {
  it('maps names and numbers', () => {
    expect(parseTierQuery('?q=low')).toBe(1);
    expect(parseTierQuery('?q=3')).toBe(3);
    expect(parseTierQuery('?q=none')).toBe(0);
    expect(parseTierQuery('?q=banana')).toBeNull();
    expect(parseTierQuery('')).toBeNull();
  });
});

describe('pickStartTier', () => {
  it('starts low on constrained devices', () => {
    expect(pickStartTier({ mobile: true, saveData: false })).toEqual({ start: 1, ceiling: 2 });
    expect(pickStartTier({ mobile: false, saveData: true })).toEqual({ start: 1, ceiling: 2 });
    expect(pickStartTier({ mobile: false, saveData: false, cores: 16 })).toEqual({ start: 3, ceiling: 3 });
  });
});

describe('Governor', () => {
  it('steps down after sustained slow frames and ignores stalls', () => {
    const g = new Governor({ start: 3, warmupSeconds: 0, settleSeconds: 0 });
    let changed: number | null = null;
    for (let i = 0; i < 200 && changed === null; i++) changed = g.frame(1 / 30);
    expect(changed).toBe(2);
    const stalled = new Governor({ start: 3, warmupSeconds: 0 });
    expect(stalled.frame(2)).toBeNull();
  });
  it('never moves when locked', () => {
    const g = new Governor({ start: 3, warmupSeconds: 0, locked: true });
    for (let i = 0; i < 400; i++) expect(g.frame(1 / 20)).toBeNull();
    expect(g.tier).toBe(3);
  });
});
