import { describe, expect, it } from 'vitest';
import {
  MAX_WAVES,
  WAVE_KINDS,
  WAVE_PARAMS,
  WaveTracker,
  waveEnvelope,
  waveTablesGlsl,
  waveValue,
} from './waves';

describe('wave profile', () => {
  it('is zero before the ring is born and after its life', () => {
    const p = WAVE_PARAMS.block;
    expect(waveEnvelope(0, p)).toBe(0);
    expect(waveEnvelope(p.life, p)).toBe(0);
    expect(waveEnvelope(p.life * 0.2, p)).toBeGreaterThan(0.9);
  });

  it('peaks at the front and is quiet far ahead of it', () => {
    const p = WAVE_PARAMS.click;
    const age = 1;
    const front = age * p.speed;
    const at = waveValue(front, age, p);
    const ahead = waveValue(front + 20, age, p);
    expect(at).toBeGreaterThan(0.4);
    expect(ahead).toBeLessThan(0.01);
  });

  it('keeps every kind inside a sane envelope', () => {
    for (const k of WAVE_KINDS) {
      const p = WAVE_PARAMS[k];
      expect(p.life).toBeGreaterThan(0.5);
      expect(p.speed).toBeGreaterThan(4);
      expect(p.lift).toBeLessThanOrEqual(1);
    }
    // The Beat is the slowest and widest: it must never feel like an alert.
    expect(WAVE_PARAMS.block.width).toBeGreaterThan(WAVE_PARAMS.land.width);
    expect(WAVE_PARAMS.block.life).toBeGreaterThan(WAVE_PARAMS.land.life);
  });
});

describe('wave tracker', () => {
  it('packs live rings and releases expired ones', () => {
    const w = new WaveTracker();
    const a = new Float32Array(MAX_WAVES * 4);
    const b = new Float32Array(MAX_WAVES * 4);
    w.add('click', 3, 4, 0, 0.5);
    w.add('block', 10, -2, 0.1);
    expect(w.pack(0.5, a, b)).toBe(2);
    expect(a[0]).toBe(3);
    expect(a[1]).toBe(4);
    expect(a[2]).toBeCloseTo(0.5, 6);
    expect(a[3]).toBe(0.5);
    expect(b[0]).toBe(WAVE_KINDS.indexOf('click'));
    expect(w.pack(WAVE_PARAMS.block.life + 1, a, b)).toBe(0);
    expect(w.activeCount()).toBe(0);
  });

  it('replaces the oldest ring when the table is full', () => {
    const w = new WaveTracker();
    for (let i = 0; i < MAX_WAVES + 3; i++) w.add('block', i, 0, i * 0.01);
    expect(w.activeCount()).toBe(MAX_WAVES);
    const a = new Float32Array(MAX_WAVES * 4);
    const b = new Float32Array(MAX_WAVES * 4);
    w.pack(0.2, a, b);
    const xs = Array.from({ length: MAX_WAVES }, (_, i) => a[i * 4] ?? -1);
    expect(xs).not.toContain(0);
    expect(xs).toContain(MAX_WAVES + 2);
  });

  it('beats after a block and decays; nothing before any block', () => {
    const w = new WaveTracker();
    expect(w.beat(5)).toBe(0);
    w.add('block', 0, 0, 10);
    expect(w.beat(10)).toBeCloseTo(0, 3);
    const peak = w.beat(10.15);
    expect(peak).toBeGreaterThan(0.5);
    expect(w.beat(16)).toBeLessThan(peak * 0.2);
  });

  it('generates GLSL tables that match the parameters', () => {
    const g = waveTablesGlsl();
    expect(g).toContain(`WAVE_K0[${WAVE_KINDS.length}]`);
    expect(g).toContain(`vec4(${WAVE_PARAMS.block.speed}.0`);
  });
});
