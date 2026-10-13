// Waves: the expanding rings that cross the bench (the Beat, a click, a landing, a revive). Pure: the
// tracker keeps a small table of live rings and packs them into the two vec4 arrays the shaders read.
// The GLSL tables are generated from the same `WAVE_PARAMS`, so tuning one place tunes both.
// Adapted from fluxcommunity/web/src/stage/pulses.ts (same owner, MIT).

export type WaveKind = 'block' | 'click' | 'success' | 'warn' | 'land' | 'revive' | 'break';

export interface WaveParams {
  /** Wavefront speed, world units per second. */
  speed: number;
  /** Half width of the front at birth, world units. */
  width: number;
  /** Width growth per second. */
  grow: number;
  /** Peak lift of a cell under the front, world units, at strength 1. */
  lift: number;
  /** Seconds until the ring is gone. */
  life: number;
  /** Emission boost under the front. */
  heat: number;
  /** Tint slot (see TINT). */
  tint: number;
}

/** Tint slots shared with the shaders: accent-hot, white-hot, warn, crit, cumulus, nimbus, stratus. */
export const TINT = { accent: 0, white: 1, warn: 2, crit: 3, cumulus: 4, nimbus: 5, stratus: 6 } as const;

/** Kind order is also the index the shader uses. */
export const WAVE_KINDS: readonly WaveKind[] = [
  'block',
  'click',
  'success',
  'warn',
  'land',
  'revive',
  'break',
];

export const WAVE_PARAMS: Record<WaveKind, WaveParams> = {
  // The Beat: broad, slow and soft. It is the site's heartbeat, so it must never feel like an alert.
  block: { speed: 17, width: 2.6, grow: 1.3, lift: 0.5, life: 5.2, heat: 0.85, tint: TINT.accent },
  click: { speed: 15, width: 1.3, grow: 0.8, lift: 0.8, life: 2.6, heat: 0.95, tint: TINT.white },
  success: { speed: 11, width: 2, grow: 1, lift: 0.55, life: 3.4, heat: 1, tint: TINT.white },
  warn: { speed: 8, width: 2, grow: 0.7, lift: 0.4, life: 3, heat: 0.8, tint: TINT.warn },
  // A landing: tight and quick, around one pillar.
  land: { speed: 9, width: 0.8, grow: 0.7, lift: 0.5, life: 1.5, heat: 1.1, tint: TINT.white },
  revive: { speed: 11, width: 0.9, grow: 0.9, lift: 0.55, life: 1.7, heat: 1.2, tint: TINT.white },
  break: { speed: 10, width: 1, grow: 0.9, lift: 0.4, life: 1.5, heat: 1, tint: TINT.crit },
};

export const MAX_WAVES = 12;

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Fast attack, hold, then a smooth release that reaches zero exactly at `life`. 0..1. */
export function waveEnvelope(age: number, p: WaveParams): number {
  if (age <= 0 || age >= p.life) return 0;
  return (1 - Math.exp(-age * 16)) * (1 - smooth(p.life * 0.45, p.life, age));
}

/**
 * The profile of a ring at distance `d` from its origin: about 1 at the front, a damped ripple behind it,
 * 0 far ahead of it. The shader evaluates the same expression per cell.
 */
export function waveValue(d: number, age: number, p: WaveParams): number {
  const env = waveEnvelope(age, p);
  if (env === 0) return 0;
  const r = age * p.speed;
  const w = p.width + p.grow * age;
  const x = d - r;
  const front = Math.exp(-(x * x) / (w * w));
  const trail = x < 0 ? 0.3 * Math.cos((x * 1.9) / (0.6 + w * 0.4)) * Math.exp(x / (w * 2.6)) : 0;
  return ((front + trail) * env) / (1 + 0.02 * r);
}

export interface Wave {
  active: boolean;
  kind: number;
  tint: number;
  x: number;
  z: number;
  /** Seconds on the scene clock when it started. */
  at: number;
  strength: number;
}

export class WaveTracker {
  readonly waves: Wave[] = [];
  /** Scene clock time of the newest block wave, or -Infinity. */
  lastBlockAt = Number.NEGATIVE_INFINITY;

  constructor() {
    for (let i = 0; i < MAX_WAVES; i++) {
      this.waves.push({ active: false, kind: 0, tint: 0, x: 0, z: 0, at: 0, strength: 0 });
    }
  }

  /** Starts a ring. When the table is full the oldest ring is replaced. */
  add(kind: WaveKind, x: number, z: number, now: number, strength = 1, tint?: number): void {
    let slot: Wave | null = null;
    let oldest = this.waves[0]!;
    for (const w of this.waves) {
      if (!w.active) {
        slot = w;
        break;
      }
      const p = WAVE_PARAMS[WAVE_KINDS[w.kind] ?? 'click'];
      if (now - w.at >= p.life) {
        slot = w;
        break;
      }
      if (w.at < oldest.at) oldest = w;
    }
    const s = slot ?? oldest;
    s.active = true;
    s.kind = WAVE_KINDS.indexOf(kind);
    s.tint = tint ?? WAVE_PARAMS[kind].tint;
    s.x = x;
    s.z = z;
    s.at = now;
    s.strength = strength;
    if (kind === 'block') this.lastBlockAt = now;
  }

  /**
   * Writes the live rings into two vec4 arrays: A = (x, z, age, strength) and B = (kind, tint, 0, 0).
   * Expired rings are released. Returns the number written.
   */
  pack(now: number, a: Float32Array, b: Float32Array): number {
    let n = 0;
    for (const w of this.waves) {
      if (!w.active) continue;
      const p = WAVE_PARAMS[WAVE_KINDS[w.kind] ?? 'click'];
      const age = now - w.at;
      if (age >= p.life) {
        w.active = false;
        continue;
      }
      const o = n * 4;
      a[o] = w.x;
      a[o + 1] = w.z;
      a[o + 2] = Math.max(0, age);
      a[o + 3] = w.strength;
      b[o] = w.kind;
      b[o + 1] = w.tint;
      b[o + 2] = 0;
      b[o + 3] = 0;
      n++;
    }
    return n;
  }

  /** 0..1 flash that decays after the newest block wave: the global luminance beat. */
  beat(now: number): number {
    if (!Number.isFinite(this.lastBlockAt)) return 0;
    const age = now - this.lastBlockAt;
    return Math.exp(-age * 1.5) * (1 - Math.exp(-age * 18));
  }

  reset(): void {
    for (const w of this.waves) w.active = false;
    this.lastBlockAt = Number.NEGATIVE_INFINITY;
  }

  activeCount(): number {
    let n = 0;
    for (const w of this.waves) if (w.active) n++;
    return n;
  }
}

/** GLSL constant tables generated from `WAVE_PARAMS`. */
export function waveTablesGlsl(): string {
  const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));
  const k0 = WAVE_KINDS.map((k) => {
    const p = WAVE_PARAMS[k];
    return `vec4(${f(p.speed)}, ${f(p.width)}, ${f(p.grow)}, ${f(p.lift)})`;
  });
  const k1 = WAVE_KINDS.map((k) => {
    const p = WAVE_PARAMS[k];
    return `vec4(${f(p.life)}, ${f(p.heat)}, 0.0, 0.0)`;
  });
  const n = WAVE_KINDS.length;
  return `const vec4 WAVE_K0[${n}] = vec4[${n}](${k0.join(', ')});\nconst vec4 WAVE_K1[${n}] = vec4[${n}](${k1.join(', ')});`;
}
