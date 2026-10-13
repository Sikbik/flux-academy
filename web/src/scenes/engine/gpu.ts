// An optional GPU timer for the debug overlay: EXT_disjoint_timer_query_webgl2 around the whole frame.
// Results arrive a few frames late, so a small ring of queries is kept. Where the extension is absent
// (Safari, privacy settings, headless software rendering) `ms` stays null and the overlay says so.

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export class GpuTimer {
  /** The most recent GPU time of a frame in milliseconds, or null when unavailable. */
  ms: number | null = null;
  readonly available: boolean;
  private readonly gl: WebGL2RenderingContext;
  private readonly ext: TimerExt | null;
  private readonly pending: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    this.available = this.ext !== null;
  }

  begin(): void {
    const { gl, ext } = this;
    if (!ext || this.active || this.pending.length > 6) return;
    const q = gl.createQuery();
    if (!q) return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end(): void {
    const { gl, ext } = this;
    if (!ext || !this.active) return;
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** Collects finished queries. Call once per frame after `end`. */
  poll(): void {
    const { gl, ext } = this;
    if (!ext) return;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length > 0) {
      const q = this.pending[0];
      if (!q) break;
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      if (!disjoint) {
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
        const ms = ns / 1e6;
        this.ms = this.ms === null ? ms : this.ms + (ms - this.ms) * 0.2;
      }
      gl.deleteQuery(q);
    }
  }

  dispose(): void {
    for (const q of this.pending) this.gl.deleteQuery(q);
    this.pending.length = 0;
    if (this.active) this.gl.deleteQuery(this.active);
    this.active = null;
  }
}
