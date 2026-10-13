import { describe, expect, it } from 'vitest';
import { Camera } from './camera';

describe('camera', () => {
  it('unprojects what it projects, on the ground and above it', () => {
    const cam = new Camera();
    cam.tx = 10;
    cam.ty = -4;
    cam.scale = 6;
    cam.pitch = 0.7;
    cam.dist = 220;
    cam.ox = 500;
    cam.oy = 300;
    cam.update();
    for (const [x, y, z] of [
      [10, -4, 0],
      [-40, 22, 0],
      [75, -30, 0],
      [12, 5, 6],
      [-20, -18, 3.5],
    ] as const) {
      cam.project(x, y, z);
      const sx = cam.sx;
      const sy = cam.sy;
      cam.unproject(sx, sy, z);
      expect(cam.gx).toBeCloseTo(x, 4);
      expect(cam.gy).toBeCloseTo(y, 4);
    }
  });

  it('draws nearer (southern) points larger and higher points higher on screen', () => {
    const cam = new Camera();
    cam.scale = 5;
    cam.pitch = 0.7;
    cam.dist = 200;
    cam.update();
    cam.project(0, -30, 0);
    const far = cam.ps;
    const farY = cam.sy;
    cam.project(0, 30, 0);
    expect(cam.ps).toBeGreaterThan(far);
    expect(cam.sy).toBeGreaterThan(farY);
    cam.project(0, 0, 0);
    const base = cam.sy;
    cam.project(0, 0, 8);
    expect(cam.sy).toBeLessThan(base);
  });

  it('keeps verticals vertical: the screen x of a point does not depend on its height', () => {
    const cam = new Camera();
    cam.scale = 5;
    cam.dist = 200;
    cam.update();
    cam.project(40, 10, 0);
    const x0 = cam.sx;
    cam.project(40, 10, 12);
    expect(cam.sx).toBeCloseTo(x0, 6);
  });

  it('frames points inside the margins', () => {
    const cam = new Camera();
    const pts: number[] = [];
    for (let i = 0; i < 40; i++) pts.push(-90 + i * 4.5, -30 + ((i * 7) % 40), 0);
    pts.push(0, 0, 9);
    const pad = { left: 20, right: 20, top: 90, bottom: 24 };
    cam.fitPoints(pts, 900, 500, pad);
    for (let i = 0; i + 2 < pts.length; i += 3) {
      cam.project(pts[i] as number, pts[i + 1] as number, pts[i + 2] as number);
      expect(cam.sx).toBeGreaterThanOrEqual(pad.left - 0.5);
      expect(cam.sx).toBeLessThanOrEqual(900 - pad.right + 0.5);
      expect(cam.sy).toBeGreaterThanOrEqual(pad.top - 0.5);
      expect(cam.sy).toBeLessThanOrEqual(500 - pad.bottom + 0.5);
    }
  });
});
