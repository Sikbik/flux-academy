import { describe, expect, it } from 'vitest';
import { buildSampleBench, type Region } from '@/diorama/model';
import { createSim, type SimEvent } from '@/diorama/sim';
import { appendLine, clock, FOLD_WINDOW_MS, type LogLine, Narrator, safeIp } from './log';
import { RequestMeter } from './meter';
import { SCENARIOS } from './scenarios';

function run(instances: number, regions: Region[], seed = 1) {
  const bench = buildSampleBench(seed);
  const sim = createSim({ bench, seed });
  const narrator = new Narrator(bench);
  const meter = new RequestMeter();
  let lines: LogLine[] = [];
  let id = 0;
  sim.on('*', (e: SimEvent) => {
    if (e.type === 'served') meter.record('served', e.at);
    else if (e.type === 'failed') meter.record('failed', e.at);
    const entry = narrator.describe(e);
    if (entry) lines = appendLine(lines, entry, e.at, ++id);
  });
  sim.setInstances(instances, { regions, spread: 'random' });
  sim.tick(3000);
  return {
    bench,
    sim,
    meter,
    narrator,
    get lines() {
      return lines;
    },
  };
}

describe('safeIp', () => {
  it('passes documentation and shared-space addresses and masks the rest', () => {
    expect(safeIp('203.0.113.17')).toBe('203.0.113.17');
    expect(safeIp('192.0.2.4')).toBe('192.0.2.4');
    expect(safeIp('198.51.100.200')).toBe('198.51.100.200');
    expect(safeIp('100.64.1.9')).toBe('100.64.1.9');
    expect(safeIp('5.9.73.116')).toBe('5.x.x.x');
    expect(safeIp('')).toBe('a sample node');
  });

  it('never lets a real address out of the sample bench', () => {
    const bench = buildSampleBench(3);
    for (const n of bench.nodes) expect(safeIp(n.ip)).toBe(n.ip);
  });
});

describe('clock', () => {
  it('prints mm:ss', () => {
    expect(clock(0)).toBe('00:00');
    expect(clock(61_999)).toBe('01:01');
  });
});

describe('the lab on the real simulation', () => {
  it('a single instance goes down when its node dies, and the log says so', () => {
    const s = run(1, []);
    expect(s.sim.state().app.status).toBe('up');
    s.sim.killRandomInstanceNode();
    s.sim.tick(10_000);
    expect(s.sim.state().app.status).toBe('down');
    const texts = s.lines.map((l) => l.text);
    expect(texts.some((t) => /went dark/.test(t))).toBe(true);
    expect(texts.some((t) => /dropped instance 1/.test(t) && /6 s/.test(t))).toBe(true);
    expect(texts.some((t) => /app is down/.test(t))).toBe(true);
    // No real address anywhere in the log.
    for (const t of texts)
      expect(t).not.toMatch(
        /\b(?!192\.0\.2|198\.51\.100|203\.0\.113|100\.64)\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
      );
  });

  it('three instances survive one failure and reroute the requests that hit it', () => {
    const s = run(3, []);
    for (let i = 0; i < 12; i++) {
      s.sim.send();
      s.sim.tick(150);
    }
    s.sim.killRandomInstanceNode();
    for (let i = 0; i < 30; i++) {
      s.sim.send();
      s.sim.tick(300);
    }
    s.sim.tick(5000);
    expect(s.sim.state().app.status).toBe('degraded');
    const w = s.meter.window(s.sim.state().time);
    expect(w.served).toBeGreaterThan(0);
    expect(s.meter.totals().failed).toBe(0);
    expect(s.lines.some((l) => /rerouted to/.test(l.text) || /dropped instance/.test(l.text))).toBe(true);
  });

  it('every scenario places its instances inside the regions it allows', () => {
    for (const sc of SCENARIOS) {
      const s = run(sc.instances, sc.regions, 7);
      const placed = s.sim.state().instances.filter((i) => i.node >= 0);
      expect(placed.length).toBe(sc.instances);
      if (sc.regions.length > 0) {
        for (const i of placed) {
          expect(sc.regions).toContain(s.bench.nodes[i.node]?.region);
        }
      }
    }
  });

  it('allowed regions do not guarantee spread: some draws put all three on one continent', () => {
    const regionsSeen = new Set<number>();
    let allSame = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = run(3, ['EU', 'NA'], seed);
      const rs = new Set(s.sim.state().instances.map((i) => s.bench.nodes[i.node]?.region));
      regionsSeen.add(rs.size);
      if (rs.size === 1) allSame++;
    }
    expect(regionsSeen.has(2)).toBe(true);
    expect(allSame).toBeGreaterThan(0);
  });

  it('start-up reads as joining the rotation, not as coming back, and says nothing about status', () => {
    const s = run(2, []);
    const texts = s.lines.map((l) => l.text);
    expect(texts.some((t) => /passed two health checks and is taking traffic/.test(t))).toBe(true);
    expect(texts.some((t) => /back in rotation/.test(t))).toBe(false);
    expect(texts.some((t) => /The app is (up|degraded)/.test(t))).toBe(false);
  });

  it('after a drop, the same instance is back in rotation and the status is news again', () => {
    const s = run(2, []);
    s.sim.killRandomInstanceNode();
    s.sim.tick(9000);
    s.sim.reviveAll();
    s.sim.tick(12_000);
    const texts = s.lines.map((l) => l.text);
    expect(texts.some((t) => /is back in rotation/.test(t))).toBe(true);
    expect(texts.some((t) => /The app is degraded/.test(t))).toBe(true);
    expect(texts.some((t) => /The app is up/.test(t))).toBe(true);
  });

  it('breaking a region takes every instance in it', () => {
    const s = run(3, ['EU']);
    s.sim.killRegion('EU');
    s.sim.tick(8000);
    expect(s.sim.state().app.status).toBe('down');
    expect(s.lines.some((l) => /whole of Europe went dark/.test(l.text))).toBe(true);
  });
});

describe('appendLine', () => {
  const entry = (text: string, fold?: boolean) => ({
    key: 'failed:x',
    tone: 'crit' as const,
    text,
    fold: fold ? (_p: LogLine, n: number) => `${n} failed` : undefined,
  });

  it('folds a burst into one line with a counter', () => {
    let lines: LogLine[] = [];
    for (let i = 0; i < 5; i++) lines = appendLine(lines, entry('1 failed', true), 1000 + i * 100, i + 1);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.count).toBe(5);
    expect(lines[0]?.text).toBe('5 failed');
  });

  it('starts a new line after the window', () => {
    let lines: LogLine[] = [];
    lines = appendLine(lines, entry('1 failed', true), 0, 1);
    lines = appendLine(lines, entry('1 failed', true), FOLD_WINDOW_MS + 1, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.id).toBe(2);
  });

  it('caps the list', () => {
    let lines: LogLine[] = [];
    for (let i = 0; i < 10; i++)
      lines = appendLine(lines, { key: `k${i}`, tone: 'info', text: `${i}` }, i, i, 4);
    expect(lines).toHaveLength(4);
    expect(lines[0]?.text).toBe('9');
  });
});
