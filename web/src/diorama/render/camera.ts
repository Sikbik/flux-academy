/**
 * A hand-rolled pseudo-3D camera for the bench: a tilted plane with mild perspective, no matrices.
 *
 * World space is the bench's: x east, y SOUTH (towards the viewer), z up, in hex circumradii. The
 * camera sits south of its target and above the ground, looking north and down by `pitch`.
 *
 *   x_cam  = dx
 *   y_cam  = -dy * sin(pitch) + z * cos(pitch)            (up the screen)
 *   depth  = dist - dy * cos(pitch) - z * sin(pitch)      (distance from the eye)
 *   screen = origin + (x_cam, -y_cam) * scale * dist / depth
 *
 * A large `dist` flattens the perspective towards isometric; a small one exaggerates it. Nearer
 * (southern) cells come out bigger, as in the look target.
 */

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class Camera {
  /** World point the camera looks at. */
  tx = 0;
  ty = 0;
  /** Pixels per bench unit at the target's depth. */
  scale = 4;
  /** Elevation of the eye above the ground plane, radians. Pi/2 is straight down. */
  pitch = 0.95;
  /** Eye distance from the target, bench units. */
  dist = 380;
  /** Where the target lands on screen, CSS px. */
  ox = 0;
  oy = 0;

  // Outputs of project().
  sx = 0;
  sy = 0;
  /** Pixels per bench unit at the projected point's depth. */
  ps = 1;

  private se = Math.sin(0.95);
  private ce = Math.cos(0.95);
  private k = 4 * 380;

  /** Call after changing any field above and before projecting. */
  update(): this {
    this.se = Math.sin(this.pitch);
    this.ce = Math.cos(this.pitch);
    this.k = this.scale * this.dist;
    return this;
  }

  /** World point to screen. Reads the result from `sx`, `sy` and `ps`. */
  project(x: number, y: number, z: number): void {
    const dx = x - this.tx;
    const dy = y - this.ty;
    // Horizontal position uses the depth of the ground under the point, so verticals stay vertical
    // (a shifted lens): pillars do not lean outwards towards the edges of the frame.
    const ground = this.dist - dy * this.ce;
    const depth = ground - z * this.se;
    const f = this.k / depth;
    this.sx = this.ox + (dx * this.k) / ground;
    this.sy = this.oy - (-dy * this.se + z * this.ce) * f;
    this.ps = this.k / ground;
  }

  /** Screen point to the world point on the horizontal plane `z`. Writes `gx`, `gy`. */
  gx = 0;
  gy = 0;
  unproject(sx: number, sy: number, z: number): void {
    const q = (this.oy - sy) / this.k;
    const dy = (z * this.ce + q * z * this.se - q * this.dist) / (this.se - q * this.ce);
    const ground = this.dist - dy * this.ce;
    this.gx = this.tx + ((sx - this.ox) * ground) / this.k;
    this.gy = this.ty + dy;
  }

  /** Copies the pose of another camera (for tweening and caches). */
  copyFrom(o: Camera): this {
    this.tx = o.tx;
    this.ty = o.ty;
    this.scale = o.scale;
    this.pitch = o.pitch;
    this.dist = o.dist;
    this.ox = o.ox;
    this.oy = o.oy;
    return this.update();
  }

  /**
   * Frames a list of world points (flat `x, y, z` triples) so they fit a viewport with the given margins
   * (CSS px), centred in the free area. The target is the centre of their ground bounding box.
   */
  fitPoints(
    pts: ArrayLike<number>,
    viewW: number,
    viewH: number,
    pad: { left: number; right: number; top: number; bottom: number },
  ): this {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i + 2 < pts.length; i += 3) {
      const x = pts[i] as number;
      const y = pts[i + 1] as number;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    this.tx = (minX + maxX) / 2;
    this.ty = (minY + maxY) / 2;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.update();
    let x0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    for (let i = 0; i + 2 < pts.length; i += 3) {
      this.project(pts[i] as number, pts[i + 1] as number, pts[i + 2] as number);
      if (this.sx < x0) x0 = this.sx;
      if (this.sx > x1) x1 = this.sx;
      if (this.sy < y0) y0 = this.sy;
      if (this.sy > y1) y1 = this.sy;
    }
    const availW = Math.max(40, viewW - pad.left - pad.right);
    const availH = Math.max(40, viewH - pad.top - pad.bottom);
    const s = Math.min(availW / (x1 - x0), availH / (y1 - y0));
    this.scale = s;
    this.ox = pad.left + (availW - s * (x1 - x0)) / 2 - s * x0;
    this.oy = pad.top + (availH - s * (y1 - y0)) / 2 - s * y0;
    return this.update();
  }

  /**
   * Frames a world box so it fits a viewport with the given margins (CSS px), leaving `headroom` bench
   * units of height above the far corners (pillars) inside the frame. Centres the box in the free area.
   */
  fit(
    box: Box,
    viewW: number,
    viewH: number,
    pad: { left: number; right: number; top: number; bottom: number },
    headroom = 6,
  ): this {
    this.tx = (box.minX + box.maxX) / 2;
    this.ty = (box.minY + box.maxY) / 2;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.update();
    let x0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    const corners: ReadonlyArray<readonly [number, number, number]> = [
      [box.minX, box.minY, headroom],
      [box.maxX, box.minY, headroom],
      [box.maxX, box.maxY, 0],
      [box.minX, box.maxY, 0],
      [box.minX, box.minY, 0],
      [box.maxX, box.minY, 0],
    ];
    for (const [x, y, z] of corners) {
      this.project(x, y, z);
      x0 = Math.min(x0, this.sx);
      x1 = Math.max(x1, this.sx);
      y0 = Math.min(y0, this.sy);
      y1 = Math.max(y1, this.sy);
    }
    const availW = Math.max(40, viewW - pad.left - pad.right);
    const availH = Math.max(40, viewH - pad.top - pad.bottom);
    const s = Math.min(availW / (x1 - x0), availH / (y1 - y0));
    this.scale = s;
    this.ox = pad.left + (availW - s * (x1 - x0)) / 2 - s * x0;
    this.oy = pad.top + (availH - s * (y1 - y0)) / 2 - s * y0;
    return this.update();
  }
}
