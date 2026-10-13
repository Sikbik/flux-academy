import { describe, expect, it } from 'vitest';
import { lintInput, priceSpec } from './engine';
import { PRESETS, presetById, presetSpec } from './presets';

describe('presets', () => {
  it('has the examples the lab menu promises', () => {
    const ids = PRESETS.map((p) => p.id);
    for (const id of [
      'hello-world',
      'web-app',
      'minecraft',
      'wordpress-mysql',
      'redis-cache',
      'static-site',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('every preset passes the teaching lint without errors or warnings and has a price', () => {
    for (const p of PRESETS) {
      const spec = presetSpec(p.id);
      expect(spec, p.id).not.toBeNull();
      if (!spec) continue;
      const report = lintInput(spec, { teaching: true });
      expect(report.errors, `${p.id} errors`).toBe(0);
      expect(report.warnings, `${p.id} warnings`).toBe(0);
      const q = priceSpec(spec);
      expect(q.usdPerMonth, p.id).toBeGreaterThanOrEqual(0.99);
    }
  });

  it('hands out copies that are safe to edit', () => {
    const a = presetSpec('hello-world');
    const b = presetSpec('hello-world');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    if (a) a.name = 'changed';
    expect(presetSpec('hello-world')?.name).not.toBe('changed');
  });

  it('knows its labels and has one line for each', () => {
    expect(presetById('web-app')?.label).toBe('Web app');
    expect(presetById('nope')).toBeUndefined();
    for (const p of PRESETS) expect(p.description.length).toBeGreaterThan(10);
  });
});
