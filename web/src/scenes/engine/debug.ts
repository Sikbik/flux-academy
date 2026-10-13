// The `?stage=debug` stats overlay: a small monospace block in a corner of the stage. It is a plain DOM
// element the engine creates only when asked, writes to a few times per second, and removes on dispose.

export interface DebugStats {
  tier: number;
  fps: number;
  frameMs: number;
  gpuMs: number | null;
  gpuTimer: boolean;
  drawCalls: number;
  triangles: number;
  cells: number;
  pillars: number;
  particles: number;
  ribbons: number;
  waves: number;
  dpr: number;
  width: number;
  height: number;
  preset: string;
  dataMode: string;
  placed: number;
  healthy: number;
  status: string;
  post: boolean;
}

/** True when the URL asks for the overlay. */
export function debugRequested(search: string): boolean {
  try {
    return new URLSearchParams(search).get('stage') === 'debug';
  } catch {
    return false;
  }
}

export class DebugOverlay {
  private readonly el: HTMLElement;
  private last = 0;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('pre');
    this.el.setAttribute('aria-hidden', 'true');
    this.el.dataset.sceneDebug = 'true';
    this.el.style.cssText = [
      'position:absolute',
      'left:10px',
      'bottom:10px',
      'margin:0',
      'padding:8px 10px',
      'font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',
      'color:#bcd0ff',
      'background:rgba(2,6,16,.72)',
      'border:1px solid rgba(110,150,255,.28)',
      'border-radius:6px',
      'pointer-events:none',
      'z-index:5',
      // Wraps on a phone instead of running off the edge.
      'box-sizing:border-box',
      'max-width:calc(100% - 20px)',
      'white-space:pre-wrap',
      'overflow-wrap:anywhere',
    ].join(';');
    parent.appendChild(this.el);
  }

  /** Throttled to about 4 Hz. */
  update(now: number, s: DebugStats): void {
    if (now - this.last < 250) return;
    this.last = now;
    const gpu = s.gpuTimer ? (s.gpuMs === null ? 'pending' : `${s.gpuMs.toFixed(2)} ms`) : 'n/a';
    this.el.textContent = [
      `scene   tier ${s.tier}  ${s.fps.toFixed(0)} fps  cpu ${s.frameMs.toFixed(1)} ms  gpu ${gpu}`,
      `canvas  ${s.width}x${s.height} @${s.dpr.toFixed(2)}  post ${s.post ? 'on' : 'off'}  preset ${s.preset}`,
      `draw    ${s.drawCalls} calls  ${(s.triangles / 1000).toFixed(1)}k tris`,
      `world   ${s.cells} cells  ${s.pillars} pillars  ${s.particles} dust  ${s.ribbons} ribbons  ${s.waves} waves`,
      `app     ${s.status}  ${s.placed} placed  ${s.healthy} healthy  data ${s.dataMode}`,
    ].join('\n');
  }

  dispose(): void {
    this.el.remove();
  }
}
