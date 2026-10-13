import { describe, expect, it } from 'vitest';
import { percent, RequestMeter } from './meter';

describe('RequestMeter', () => {
  it('counts totals since reset', () => {
    const m = new RequestMeter();
    m.record('served', 100);
    m.record('served', 200);
    m.record('failed', 300);
    expect(m.totals()).toEqual({ served: 2, failed: 1, ratio: 2 / 3 });
    m.reset();
    expect(m.totals()).toEqual({ served: 0, failed: 0, ratio: null });
  });

  it('rolls a 60 second window', () => {
    const m = new RequestMeter();
    for (let s = 0; s < 120; s++) m.record(s < 30 ? 'failed' : 'served', s * 1000);
    // At t = 119 s the window is (59 s, 119 s]: all served.
    expect(m.window(119_000)).toEqual({ served: 60, failed: 0, ratio: 1 });
    // At t = 59 s the window is [0, 59 s]: 30 failed, 30 served.
    const early = m.window(59_000);
    expect(early.failed).toBe(30);
    expect(early.served).toBe(30);
    // Totals never roll.
    expect(m.totals().served + m.totals().failed).toBe(120);
  });

  it('reports no ratio when nothing finished in the window', () => {
    const m = new RequestMeter();
    m.record('served', 1000);
    expect(m.window(200_000).ratio).toBeNull();
  });

  it('buckets per second, oldest first, ending at now', () => {
    const m = new RequestMeter();
    m.record('served', 10_100);
    m.record('served', 10_900);
    m.record('failed', 11_500);
    const b = m.buckets(11_999, 3);
    expect(b).toEqual([
      { served: 0, failed: 0 },
      { served: 2, failed: 0 },
      { served: 0, failed: 1 },
    ]);
  });

  it('forgets entries older than twice the window to bound memory', () => {
    const m = new RequestMeter();
    for (let i = 0; i < 1000; i++) m.record('served', i * 1000);
    expect(m.window(999_000).served).toBe(60);
    expect(m.totals().served).toBe(1000);
  });
});

describe('percent', () => {
  it('never rounds a failure away', () => {
    expect(percent(0.9996)).toBe('99.9%');
    expect(percent(1)).toBe('100.0%');
    expect(percent(0.5)).toBe('50.0%');
    expect(percent(null)).toBe('--');
  });
});
