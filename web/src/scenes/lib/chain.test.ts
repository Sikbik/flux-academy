import { describe, expect, it } from 'vitest';
import { ChainModel, stampPhase } from './chain';

describe('stamp phase', () => {
  it('is quiet before the hash leaves and complete after the ring has run', () => {
    const a = stampPhase(0, 15);
    expect(a.travel).toBe(0);
    expect(a.stamped).toBe(0);
    expect(a.ring).toBe(-1);
    const z = stampPhase(1, 15);
    expect(z.travel).toBe(1);
    expect(z.stamped).toBe(1);
    expect(z.ring).toBe(-1);
  });

  it('runs in order: travel, then stamp and flash, then the ring', () => {
    const t = stampPhase(0.3, 15);
    expect(t.travel).toBeGreaterThan(0.5);
    expect(t.stamped).toBe(0);
    const s = stampPhase(0.46, 15);
    expect(s.stamped).toBe(1);
    expect(s.flash).toBeGreaterThan(0.3);
    const r = stampPhase(0.75, 15);
    expect(r.ring).toBeGreaterThan(0);
    expect(r.ring).toBeLessThan(15);
    expect(stampPhase(0.9, 15).ring).toBeGreaterThan(r.ring);
  });

  it('clamps out of range input', () => {
    expect(stampPhase(-4, 15).travel).toBe(0);
    expect(stampPhase(9, 15).stamped).toBe(1);
  });
});

describe('chain model', () => {
  it('rests with a hot head and a dimming tail', () => {
    const c = new ChainModel(15);
    c.step(0);
    const lit = c.blocks.map((b) => b.lit);
    expect(lit[0]).toBeGreaterThan(0.95);
    for (let i = 1; i < lit.length; i++) expect(lit[i]).toBeLessThan(lit[i - 1] ?? 1);
    expect(lit[14]).toBeGreaterThan(0.2);
  });

  it('slides one slot and flashes the new head when a block lands', () => {
    const c = new ChainModel(15);
    const seeds = c.blocks.map((b) => b.seed);
    c.push();
    c.step(0.016);
    expect(c.slide).toBeGreaterThan(0.9);
    expect(c.blocks[0]?.flash).toBeGreaterThan(0.5);
    // The previous head is now the second block, with its own identicon.
    expect(c.blocks[1]?.seed).toBe(seeds[0]);
    expect(c.blocks).toHaveLength(15);
    for (let i = 0; i < 80; i++) c.step(0.016);
    expect(c.slide).toBe(0);
    expect(c.blocks[0]?.flash).toBeLessThan(0.05);
  });

  it('stamps the head and runs a ring down the row during the register chapter', () => {
    const c = new ChainModel(15);
    c.setStamp(0.46);
    c.step(0.016);
    expect(c.blocks[0]?.stamped).toBeGreaterThan(0.95);
    expect(c.blocks[5]?.stamped).toBeLessThan(0.7);
    c.setStamp(0.75);
    c.step(0.016);
    const rings = c.blocks.map((b) => b.ring);
    expect(Math.max(...rings)).toBeGreaterThan(0.8);
    c.setStamp(null);
    c.step(0.016);
    expect(c.blocks.every((b) => b.ring === 0)).toBe(true);
  });

  it('settles to a still frame without a glide in flight', () => {
    const c = new ChainModel(15);
    c.push();
    c.settle();
    expect(c.slide).toBe(0);
    expect(c.blocks[0]?.flash).toBe(0);
  });
});
