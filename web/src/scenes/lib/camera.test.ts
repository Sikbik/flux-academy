import { describe, expect, it } from 'vitest';
import {
  ambientPose,
  type BenchFrame,
  basisFor,
  CameraRig,
  cameraPosition,
  fitDistance,
  freeAspect,
  freeRect,
  makePose,
  narrowness,
  parallaxOffsets,
  presetFor,
  presetShape,
  resolvePose,
} from './camera';
import { smoothDamp } from './math';

const FRAME: BenchFrame = {
  halfW: 60,
  halfD: 25,
  cell: { x: 0, y: 18.5, z: -6.5 },
  stripHead: { x: 68, y: 0, z: 22 },
  stripTail: { x: 68, y: 0, z: -35 },
};

/** NDC of a world point for a pose and canvas aspect, with the lens shift applied. */
function project(
  p: {
    tx: number;
    ty: number;
    tz: number;
    yaw: number;
    elev: number;
    dist: number;
    fov: number;
    shiftX: number;
    shiftY: number;
  },
  aspect: number,
  x: number,
  y: number,
  z: number,
): { x: number; y: number } {
  const b = basisFor(p.yaw, p.elev);
  const rx = x - p.tx;
  const ry = y - p.ty;
  const rz = z - p.tz;
  const right = rx * b.rx + ry * b.ry + rz * b.rz;
  const up = rx * b.ux + ry * b.uy + rz * b.uz;
  const fwd = rx * b.fx + ry * b.fy + rz * b.fz;
  const depth = p.dist + fwd;
  const th = Math.tan((p.fov * Math.PI) / 360);
  return { x: right / (depth * th * aspect) + p.shiftX, y: up / (depth * th) + p.shiftY };
}

describe('easing and the rig', () => {
  it('smooth damp never overshoots and settles', () => {
    const v = { v: 0 };
    let x = 0;
    let max = 0;
    for (let i = 0; i < 600; i++) {
      x = smoothDamp(x, 10, v, 0.4, 1 / 60);
      max = Math.max(max, x);
    }
    expect(max).toBeLessThanOrEqual(10.0001);
    expect(x).toBeCloseTo(10, 3);
  });

  it('keeps velocity continuous when the target changes mid flight', () => {
    const v = { v: 0 };
    let x = 0;
    const speeds: number[] = [];
    let prev = 0;
    for (let i = 0; i < 240; i++) {
      const target = i < 40 ? 10 : -4;
      x = smoothDamp(x, target, v, 0.4, 1 / 60);
      speeds.push((x - prev) * 60);
      prev = x;
    }
    // A critically damped spring can accelerate at most omega^2 * distance: the per frame change in
    // velocity is bounded by that, so there is never a jump when the target flips in mid flight.
    const omega = 2 / 0.4;
    const bound = omega * omega * 14 * (1 / 60) * 1.2;
    for (let i = 1; i < speeds.length; i++) {
      expect(Math.abs((speeds[i] ?? 0) - (speeds[i - 1] ?? 0))).toBeLessThan(bound);
    }
  });

  it('eases a pose with an S curve: slow start, fast middle, slow end', () => {
    const rig = new CameraRig(0.4);
    const a = makePose();
    const b = { ...makePose(), tx: 30, yaw: 0.8, dist: 60 };
    rig.snap(a);
    const xs: number[] = [];
    for (let i = 0; i < 300; i++) xs.push(rig.step(b, 1 / 60).tx);
    const early = (xs[5] ?? 0) - (xs[0] ?? 0);
    const mid = (xs[40] ?? 0) - (xs[35] ?? 0);
    const late = (xs[290] ?? 0) - (xs[285] ?? 0);
    expect(mid).toBeGreaterThan(early);
    expect(mid).toBeGreaterThan(late);
    expect(xs[299]).toBeCloseTo(30, 1);
  });

  it('swings yaw the short way round', () => {
    const rig = new CameraRig(0.3);
    rig.snap({ ...makePose(), yaw: 3.0 });
    const p = rig.step({ ...makePose(), yaw: -3.0 }, 1 / 60);
    // The short way from 3.0 to -3.0 passes through pi, so yaw keeps increasing past 3.0.
    expect(p.yaw).toBeGreaterThanOrEqual(3.0);
  });
});

describe('framing', () => {
  it('fits every focus point inside the free rectangle', () => {
    for (const aspect of [0.46, 0.8, 1.6, 2.2]) {
      const rect = freeRect({ left: 0.3, right: 0, top: 0.1, bottom: 0.1 });
      const shape = presetShape('hero', FRAME, freeAspect(aspect, rect));
      const pose = resolvePose(shape, aspect, rect);
      for (const f of shape.focus) {
        const n = project(pose, aspect, f.x, f.y, f.z);
        expect(n.x).toBeGreaterThanOrEqual(rect.x0 - 1e-6);
        expect(n.x).toBeLessThanOrEqual(rect.x1 + 1e-6);
        expect(n.y).toBeGreaterThanOrEqual(rect.y0 - 1e-6);
        expect(n.y).toBeLessThanOrEqual(rect.y1 + 1e-6);
      }
    }
  });

  it('centres the picture in the free rectangle with the lens shift', () => {
    const rect = freeRect({ left: 0.4, right: 0, top: 0, bottom: 0 }, 0);
    const pose = resolvePose(presetShape('place', FRAME, 1.2), 1.6, rect);
    expect(pose.shiftX).toBeCloseTo((rect.x0 + rect.x1) / 2, 6);
    expect(pose.shiftX).toBeGreaterThan(0.3);
  });

  it('is farther for a narrower frame and for tighter insets', () => {
    const shape = presetShape('hero', FRAME, 1.6);
    const wide = fitDistance(shape, 1.6, freeRect({ left: 0, right: 0, top: 0, bottom: 0 }), shape.focus);
    const tight = fitDistance(shape, 1.6, freeRect({ left: 0.4, right: 0, top: 0, bottom: 0 }), shape.focus);
    expect(tight).toBeGreaterThan(wide);
  });

  it('turns the bench toward an isometric corner view as the frame gets taller', () => {
    expect(narrowness(2)).toBe(0);
    expect(narrowness(0.4)).toBe(1);
    const a = presetShape('hero', FRAME, 1.8);
    const b = presetShape('hero', FRAME, 0.5);
    expect(b.yaw).toBeGreaterThan(a.yaw + 0.3);
    expect(b.elev).toBeGreaterThanOrEqual(a.elev);
  });

  it('places the camera on the orbit it was asked for', () => {
    const p = { ...makePose(), yaw: 0.5, elev: 0.7, dist: 80, tx: 4, ty: 2, tz: -3 };
    const c = cameraPosition(p);
    expect(Math.hypot(c.x - p.tx, c.y - p.ty, c.z - p.tz)).toBeCloseTo(80, 6);
    expect(c.y - p.ty).toBeCloseTo(80 * Math.sin(0.7), 6);
  });
});

describe('presets and drift', () => {
  it('chooses a preset from the page state', () => {
    expect(presetFor('hero', 0, false)).toBe('hero');
    expect(presetFor('story', 0, false)).toBe('describe');
    expect(presetFor('story', 1, false)).toBe('register');
    expect(presetFor('story', 2, false)).toBe('place');
    expect(presetFor('story', 3, false)).toBe('run');
    expect(presetFor('labs', 2, false)).toBe('backdrop');
    expect(presetFor('hero', 0, true)).toBe('ambient');
  });

  it('ambient drift is a pure function of time and stays inside sane bounds', () => {
    const a = ambientPose(123.4, FRAME, 1.6);
    const b = ambientPose(123.4, FRAME, 1.6);
    expect(a).toEqual(b);
    for (let t = 0; t < 600; t += 7) {
      const p = ambientPose(t, FRAME, 1.6);
      expect(Math.abs(p.tx)).toBeLessThan(FRAME.halfW * 0.5);
      expect(p.elev).toBeGreaterThan(0.3);
      expect(p.elev).toBeLessThan(1.0);
      expect(p.dist).toBeGreaterThan(80);
    }
  });

  it('parallax is small and clamped', () => {
    const o = parallaxOffsets(1, -1, 1);
    expect(Math.abs(o.yaw)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(o.elev)).toBeLessThanOrEqual(0.03);
    const z = parallaxOffsets(1, 1, 0);
    expect(Math.abs(z.yaw)).toBe(0);
    const big = parallaxOffsets(1, 1, 7);
    expect(Math.abs(big.yaw)).toBeLessThanOrEqual(0.05);
  });
});
