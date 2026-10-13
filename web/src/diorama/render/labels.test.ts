import { describe, expect, it } from 'vitest';
import { buildSampleBench } from '../model';
import { createSim, DEFAULT_RULES, type Sim, type VolumeMode } from '../sim';
import { Annotator } from './labels';
import { readPalette } from './palette';
import { SCENES } from './scenes';
import type { Fx, View } from './state';

const bench = buildSampleBench(2);

interface Call {
  fn: string;
  args: unknown[];
  /** The stroke and fill colours in force when the call was made. */
  stroke: unknown;
  fill: unknown;
}

/** A 2D context that records what is drawn and measures text as 6 px a character. */
function recorder(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const own: Record<string, unknown> = {
    font: '',
    textAlign: 'left',
    textBaseline: 'middle',
    letterSpacing: '0px',
    lineWidth: 1,
    fillStyle: '',
    strokeStyle: '',
    lineJoin: 'miter',
    globalAlpha: 1,
  };
  const ctx = new Proxy(own, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
      return (...args: unknown[]) => {
        calls.push({ fn: key, args, stroke: target.strokeStyle, fill: target.fillStyle });
      };
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** Just enough of a view for the annotator: a flat camera, no pillars lifted, a wide figure. */
function view(ctx: CanvasRenderingContext2D, over: Partial<View> = {}): View {
  const cam = {
    sx: 0,
    sy: 0,
    project(x: number, y: number, z: number): void {
      this.sx = 120 + x * 3;
      this.sy = 260 + y * 2 - z;
    },
  };
  const v = {
    ctx,
    cam,
    pal: readPalette(null),
    bench,
    W: 900,
    H: 520,
    t: 0,
    reduced: false,
    narrow: false,
    hBoost: 1,
    lift: new Float32Array(bench.nodes.length),
    scene: SCENES.failover,
    sceneId: 'failover',
    specimen: { x: 450, y: 60, size: 80, lift: 0 },
    mapBox: { x0: 40, y0: 140, x1: 860, y1: 440 },
    region: null,
    tierFilter: 'all',
    ...over,
  };
  return v as unknown as View;
}

const noFx = {} as Fx;
const labelsDrawn = (calls: readonly Call[]): string[] =>
  calls.filter((c) => c.fn === 'fillText').map((c) => String(c.args[0]));

function app(volume: VolumeMode, n = 3): Sim {
  const sim = createSim({ bench, seed: 3, place: { spread: 'regions', volume } });
  sim.setInstances(n);
  sim.tick(DEFAULT_RULES.health.startMs + DEFAULT_RULES.volume.syncMs + 600);
  return sim;
}

function lose(sim: Sim, slot: number): void {
  sim.kill(sim.state().instances[slot]?.nodeId as string);
  sim.tick(DEFAULT_RULES.respawn.delayMs + 400);
}

/**
 * Draws the named annotations at the given animation times, after one frame at time 0 that starts their
 * draw-in (an annotation is first seen at progress 0, so a lone late frame would show nothing).
 */
function frames(sim: Sim, names: string[], times: number[], over: Partial<View> = {}): Call[][] {
  const annot = new Annotator();
  const prime = recorder();
  annot.draw(view(prime.ctx, { t: 0, ...over }), noFx, names, sim.state());
  return times.map((t) => {
    const { ctx, calls } = recorder();
    annot.draw(view(ctx, { t, ...over }), noFx, names, sim.state());
    return calls;
  });
}

describe('the lost-data annotation', () => {
  it('draws EMPTY DISK for a replacement that started on an empty local volume', () => {
    const sim = app('local');
    lose(sim, 1);
    const [first, mid, done] = frames(sim, ['lost-data'], [0, 400, 1200]) as [Call[], Call[], Call[]];
    // It draws itself in: nothing at the first frame, the leader and ring growing, the words last.
    expect(first).toHaveLength(0);
    expect(mid.some((c) => c.fn === 'stroke')).toBe(true);
    expect(labelsDrawn(mid)).toEqual([]);
    expect(labelsDrawn(done)).toEqual(['EMPTY DISK']);
  });

  it('draws a hollow disk, not a letter, in the marker, and the leader in the warning colour', () => {
    const sim = app('local');
    lose(sim, 1);
    const [done] = frames(sim, ['lost-data'], [1200]) as [Call[]];
    // The glyph is an outline of ellipses; no marker letter is drawn (only the label).
    expect(done.filter((c) => c.fn === 'ellipse').length).toBeGreaterThanOrEqual(2);
    expect(labelsDrawn(done)).toEqual(['EMPTY DISK']);
    const pal = readPalette(null);
    const strokes = done.filter((c) => c.fn === 'stroke').map((c) => c.stroke);
    expect(strokes).toContain(pal.rWarn.a(0.75));
    expect(strokes).toContain(pal.rWarn.a(0.95));
    // The ordinary leaders of the figure keep the accent; this one is not among them.
    expect(strokes).not.toContain(pal.rAccentHot.a(0.75));
  });

  it('draws nothing for a volume that kept its data', () => {
    for (const mode of ['replicated', 'primary-standby'] as const) {
      const sim = app(mode);
      lose(sim, 1);
      const [done] = frames(sim, ['lost-data'], [1200]) as [Call[]];
      expect(labelsDrawn(done)).toEqual([]);
    }
  });

  it('draws nothing while a node is merely down, and nothing before any loss', () => {
    const sim = app('local');
    expect(labelsDrawn((frames(sim, ['lost-data'], [1200]) as [Call[]])[0])).toEqual([]);
    sim.kill(sim.state().instances[0]?.nodeId as string);
    sim.tick(2000);
    expect(labelsDrawn((frames(sim, ['lost-data'], [1200]) as [Call[]])[0])).toEqual([]);
  });

  it('marks every instance that restarted empty, once each', () => {
    const sim = app('local');
    sim.kill(sim.state().instances[0]?.nodeId as string);
    sim.kill(sim.state().instances[2]?.nodeId as string);
    sim.tick(DEFAULT_RULES.respawn.delayMs + 400);
    const [done] = frames(sim, ['lost-data'], [1200]) as [Call[]];
    expect(labelsDrawn(done)).toEqual(['EMPTY DISK', 'EMPTY DISK']);
  });

  it('appears at once under reduced motion, on the very first frame', () => {
    const sim = app('local');
    lose(sim, 1);
    const { ctx, calls } = recorder();
    new Annotator().draw(view(ctx, { t: 0, reduced: true }), noFx, ['lost-data'], sim.state());
    expect(labelsDrawn(calls)).toEqual(['EMPTY DISK']);
    // And it is drawn whole: the leader, the ring and the glyph, not a part of them.
    expect(calls.filter((c) => c.fn === 'ellipse').length).toBeGreaterThanOrEqual(2);
  });

  it('clears on reset, and draws itself in again when the next one appears', () => {
    const sim = app('local');
    lose(sim, 1);
    const annot = new Annotator();
    const draw = (t: number): Call[] => {
      const { ctx, calls } = recorder();
      annot.draw(view(ctx, { t }), noFx, ['lost-data'], sim.state());
      return calls;
    };
    expect(labelsDrawn(draw(0))).toEqual([]);
    expect(labelsDrawn(draw(1200))).toEqual(['EMPTY DISK']);
    sim.reset();
    expect(labelsDrawn(draw(1300))).toEqual([]);
    // Run the same story again on the same annotator: the tag is a new one and draws in from nothing.
    sim.setInstances(3);
    sim.tick(DEFAULT_RULES.health.startMs + 600);
    lose(sim, 1);
    expect(labelsDrawn(draw(2000))).toEqual([]);
    expect(labelsDrawn(draw(3200))).toEqual(['EMPTY DISK']);
  });

  it('hangs under the instance label when that is drawn, so the two read together', () => {
    const sim = app('local');
    lose(sim, 1);
    const [done] = frames(sim, ['instances', 'lost-data'], [1200]) as [Call[]];
    expect(labelsDrawn(done)).toContain('EMPTY DISK');
    // Marker rings are the arcs of radius 9: the tag's ring sits straight above or below the label's.
    const rings = done
      .filter((c) => c.fn === 'arc' && c.args[2] === 9)
      .map((c) => ({ x: c.args[0] as number, y: c.args[1] as number }));
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    const stacked = rings.some((a) => rings.some((b) => near(a.x, b.x) && near(Math.abs(a.y - b.y), 27)));
    expect(stacked).toBe(true);
  });

  it('puts the tag at the node itself when the instance labels are not drawn', () => {
    const sim = app('local');
    lose(sim, 1);
    const [done] = frames(sim, ['lost-data'], [1200]) as [Call[]];
    const rings = done
      .filter((c) => c.fn === 'arc' && c.args[2] === 9)
      .map((c) => ({ x: c.args[0] as number, y: c.args[1] as number }));
    expect(rings).toHaveLength(1);
    expect(labelsDrawn(done)).toEqual(['EMPTY DISK']);
  });

  it('is only drawn when named', () => {
    const sim = app('local');
    lose(sim, 1);
    const [done] = frames(sim, ['instances', 'down'], [1200]) as [Call[]];
    expect(labelsDrawn(done)).not.toContain('EMPTY DISK');
  });
});
