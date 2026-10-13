import { describe, expect, it } from 'vitest';
import {
  type ArcPath,
  arcAt,
  arcLength,
  arcTangent,
  buildRibbonIndex,
  LAUNCH_ARC,
  launchDuration,
  makeArc,
  PACKET_ARC,
  packetDuration,
  RIBBON_SEGMENTS,
  RIBBON_STRIDE,
  RIBBON_VERTS,
  type RibbonStyle,
  writeRibbon,
} from './arcs';

const style = (over: Partial<RibbonStyle> = {}): RibbonStyle => ({
  head: 1,
  tail: 0,
  width: 0.2,
  tailR: 0.1,
  tailG: 0.2,
  tailB: 0.3,
  headR: 1,
  headG: 1,
  headB: 1,
  alpha: 1,
  tailAlpha: 0,
  tailWidth: 0.5,
  ...over,
});

describe('arc geometry', () => {
  it('starts and ends where it is told and rises between', () => {
    const a = makeArc(0, 18, -6, 40, 6, 12, LAUNCH_ARC);
    const s = arcAt(a, 0);
    const e = arcAt(a, 1);
    expect([s.x, s.y, s.z]).toEqual([0, 18, -6]);
    expect([e.x, e.y, e.z]).toEqual([40, 6, 12]);
    const m = arcAt(a, 0.5);
    expect(m.y).toBeGreaterThan(Math.max(18, 6));
  });

  it('caps the apex of short and very long arcs', () => {
    const short = makeArc(0, 5, 0, 1, 5, 0, LAUNCH_ARC);
    const long = makeArc(0, 5, 0, 400, 5, 0, LAUNCH_ARC);
    expect(arcAt(short, 0.5).y - 5).toBeGreaterThanOrEqual(LAUNCH_ARC.minApex - 1e-6);
    expect(arcAt(long, 0.5).y - 5).toBeLessThanOrEqual(LAUNCH_ARC.maxApex + 1e-6);
  });

  it('packets run lower than launches', () => {
    const l = makeArc(0, 5, 0, 60, 5, 0, LAUNCH_ARC);
    const p = makeArc(0, 5, 0, 60, 5, 0, PACKET_ARC);
    expect(arcAt(p, 0.5).y).toBeLessThan(arcAt(l, 0.5).y);
  });

  it('has a unit tangent that agrees with the path direction', () => {
    const a = makeArc(0, 10, 0, 30, 10, 0, LAUNCH_ARC);
    const t0 = arcTangent(a, 0);
    expect(Math.hypot(t0.x, t0.y, t0.z)).toBeCloseTo(1, 6);
    expect(t0.x).toBeGreaterThan(0);
    expect(t0.y).toBeGreaterThan(0);
    expect(arcTangent(a, 1).y).toBeLessThan(0);
  });

  it('measures a length at least the chord and at most the control polygon', () => {
    const a = makeArc(0, 0, 0, 30, 0, 0, LAUNCH_ARC);
    const chord = 30;
    const poly = Math.hypot(a.cx, a.cy, a.cz) + Math.hypot(30 - a.cx, 0 - a.cy, 0 - a.cz);
    expect(a.length).toBeGreaterThan(chord);
    expect(a.length).toBeLessThan(poly);
    expect(arcLength(a)).toBeCloseTo(a.length, 9);
  });
});

describe('timing', () => {
  it('keeps every launch inside the motion language (0.7 to 1.15 s)', () => {
    for (const span of [0, 5, 20, 60, 120, 400]) {
      const d = launchDuration(span);
      expect(d).toBeGreaterThanOrEqual(0.7);
      expect(d).toBeLessThanOrEqual(1.15);
    }
    expect(launchDuration(80)).toBeGreaterThan(launchDuration(10));
  });

  it('keeps packets fast', () => {
    for (const span of [0, 30, 300]) {
      const d = packetDuration(span);
      expect(d).toBeGreaterThanOrEqual(0.34);
      expect(d).toBeLessThanOrEqual(0.8);
    }
  });
});

describe('ribbon strip', () => {
  const path: ArcPath = makeArc(0, 10, 0, 40, 4, 10, LAUNCH_ARC);

  it('writes a full strip of finite values', () => {
    const out = new Float32Array(RIBBON_VERTS * RIBBON_STRIDE);
    expect(writeRibbon(out, 0, path, style(), 0, 60, 80)).toBe(RIBBON_VERTS);
    for (const v of out) expect(Number.isFinite(v)).toBe(true);
  });

  it('is widest behind the head and fades to the tail alpha', () => {
    const out = new Float32Array(RIBBON_VERTS * RIBBON_STRIDE);
    writeRibbon(out, 0, path, style({ tailAlpha: 0 }), 0, 60, 80);
    const alphaAt = (i: number) => out[i * 2 * RIBBON_STRIDE + 8] ?? 0;
    expect(alphaAt(0)).toBeCloseTo(0, 6);
    expect(alphaAt(RIBBON_SEGMENTS)).toBeCloseTo(1, 6);
    const width = (i: number) => {
      const a = i * 2 * RIBBON_STRIDE;
      const b = (i * 2 + 1) * RIBBON_STRIDE;
      return Math.hypot(
        (out[a] ?? 0) - (out[b] ?? 0),
        (out[a + 1] ?? 0) - (out[b + 1] ?? 0),
        (out[a + 2] ?? 0) - (out[b + 2] ?? 0),
      );
    };
    expect(width(Math.floor(RIBBON_SEGMENTS * 0.8))).toBeGreaterThan(width(2));
    expect(width(RIBBON_SEGMENTS)).toBeLessThan(width(Math.floor(RIBBON_SEGMENTS * 0.8)));
  });

  it('faces the camera: the strip is perpendicular to the view direction', () => {
    const out = new Float32Array(RIBBON_VERTS * RIBBON_STRIDE);
    const cam = { x: 5, y: 70, z: 90 };
    writeRibbon(out, 0, path, style(), cam.x, cam.y, cam.z);
    const i = 10;
    const a = i * 2 * RIBBON_STRIDE;
    const b = (i * 2 + 1) * RIBBON_STRIDE;
    const mid = [
      ((out[a] ?? 0) + (out[b] ?? 0)) / 2,
      ((out[a + 1] ?? 0) + (out[b + 1] ?? 0)) / 2,
      ((out[a + 2] ?? 0) + (out[b + 2] ?? 0)) / 2,
    ];
    const side = [
      (out[a] ?? 0) - (out[b] ?? 0),
      (out[a + 1] ?? 0) - (out[b + 1] ?? 0),
      (out[a + 2] ?? 0) - (out[b + 2] ?? 0),
    ];
    const view = [cam.x - (mid[0] ?? 0), cam.y - (mid[1] ?? 0), cam.z - (mid[2] ?? 0)];
    const dot = side[0]! * view[0]! + side[1]! * view[1]! + side[2]! * view[2]!;
    const norm = Math.hypot(...side) * Math.hypot(...view);
    expect(Math.abs(dot / norm)).toBeLessThan(1e-4);
  });

  it('draws only the visible part of the arc between tail and head', () => {
    const out = new Float32Array(RIBBON_VERTS * RIBBON_STRIDE);
    writeRibbon(out, 0, path, style({ head: 0.6, tail: 0.3 }), 0, 60, 80);
    const first = out[4] ?? 0;
    const last = out[(RIBBON_VERTS - 1) * RIBBON_STRIDE + 4] ?? 0;
    expect(first).toBeCloseTo(0.3, 5);
    expect(last).toBeCloseTo(0.6, 5);
  });

  it('indexes ribbons without crossing into each other', () => {
    const idx = buildRibbonIndex(3);
    expect(idx.length).toBe(3 * RIBBON_SEGMENTS * 6);
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < RIBBON_SEGMENTS * 6; k++) {
        const v = idx[r * RIBBON_SEGMENTS * 6 + k] ?? 0;
        expect(v).toBeGreaterThanOrEqual(r * RIBBON_VERTS);
        expect(v).toBeLessThan((r + 1) * RIBBON_VERTS);
      }
    }
  });
});
