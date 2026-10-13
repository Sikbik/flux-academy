// Quality tiers shared by the hero scene and the diorama.
// Adapted from fluxcommunity/web/src/stage/{governor,env}.ts (same owner, MIT): a pure frame-time
// governor with hysteresis, the start-tier policy, and the `?q=` override. No browser APIs in the
// governor itself, so it is unit tested in node.
//
// Tiers: 3 high, 2 medium, 1 low, 0 none (no WebGL, use the 2D diorama or the CSS fallback).

export type QualityTier = 0 | 1 | 2 | 3;
export type ActiveTier = 1 | 2 | 3;

/** What each tier means for a renderer. Scenes may scale further but should not exceed these. */
export const TIER_PARAMS: Record<
  ActiveTier,
  { dprMax: number; cells: number; post: boolean; particles: number }
> = {
  3: { dprMax: 2, cells: 6000, post: true, particles: 4000 },
  2: { dprMax: 1.5, cells: 3500, post: true, particles: 2000 },
  1: { dprMax: 1, cells: 1500, post: false, particles: 800 },
};

export interface GovernorOptions {
  start: ActiveTier;
  ceiling?: ActiveTier;
  floor?: ActiveTier;
  /** Below this smoothed fps the clock for stepping down runs. */
  downFps?: number;
  downSeconds?: number;
  /** Above this smoothed fps the clock for stepping up runs. */
  upFps?: number;
  upSeconds?: number;
  /** Frames this soon after start (shader compilation, first uploads) are ignored. */
  warmupSeconds?: number;
  /** A gap longer than this is a stall (hidden tab), not a slow frame. */
  stallSeconds?: number;
  /** Quiet time after any change before new evidence counts. */
  settleSeconds?: number;
  /** Smoothing time constant of the frame time average. */
  emaSeconds?: number;
  /** A forced tier (`?q=`): the governor reports it and never moves. */
  locked?: boolean;
}

const DEFAULTS = {
  downFps: 45,
  downSeconds: 2,
  upFps: 58,
  upSeconds: 6,
  warmupSeconds: 1.5,
  stallSeconds: 0.25,
  settleSeconds: 0.8,
  emaSeconds: 0.35,
} as const;

/** A step down this soon after a step up is a bounce and doubles the wait for the next step up. */
const BOUNCE_SECONDS = 20;
const MAX_PENALTY = 8;
const SEVERE_FPS = 24;
const SEVERE_SECONDS = 1;

export class Governor {
  tier: ActiveTier;
  ceiling: ActiveTier;
  floor: ActiveTier;
  locked: boolean;
  /** Smoothed frame time, seconds (0 until the first real frame). */
  ema = 0;
  private readonly o: Required<Omit<GovernorOptions, 'start' | 'ceiling' | 'floor' | 'locked'>>;
  private clock = 0;
  private quiet = 0;
  private below = 0;
  private above = 0;
  private penalty = 1;
  private lastUp = Number.NEGATIVE_INFINITY;

  constructor(opts: GovernorOptions) {
    this.tier = opts.start;
    this.ceiling = opts.ceiling ?? 3;
    this.floor = opts.floor ?? 1;
    this.locked = opts.locked ?? false;
    this.o = {
      downFps: opts.downFps ?? DEFAULTS.downFps,
      downSeconds: opts.downSeconds ?? DEFAULTS.downSeconds,
      upFps: opts.upFps ?? DEFAULTS.upFps,
      upSeconds: opts.upSeconds ?? DEFAULTS.upSeconds,
      warmupSeconds: opts.warmupSeconds ?? DEFAULTS.warmupSeconds,
      stallSeconds: opts.stallSeconds ?? DEFAULTS.stallSeconds,
      settleSeconds: opts.settleSeconds ?? DEFAULTS.settleSeconds,
      emaSeconds: opts.emaSeconds ?? DEFAULTS.emaSeconds,
    };
    this.quiet = this.o.warmupSeconds;
  }

  /** Smoothed frames per second, 0 before any evidence. */
  get fps(): number {
    return this.ema > 0 ? 1 / this.ema : 0;
  }

  /** Feed one drawn frame that took `dt` seconds. Returns the new tier when it changed, else null. */
  frame(dt: number): ActiveTier | null {
    if (!(dt > 0)) return null;
    this.clock += dt;
    if (dt > this.o.stallSeconds) {
      this.below = 0;
      this.above = 0;
      this.quiet = Math.max(this.quiet, 0.4);
      return null;
    }
    if (this.quiet > 0) {
      this.quiet -= dt;
      this.ema = this.ema > 0 ? this.ema + (dt - this.ema) * 0.25 : dt;
      return null;
    }
    const a = 1 - Math.exp(-dt / this.o.emaSeconds);
    this.ema = this.ema > 0 ? this.ema + (dt - this.ema) * a : dt;
    if (this.locked) return null;

    const fps = 1 / this.ema;
    if (fps < this.o.downFps) {
      this.below += dt;
      this.above = 0;
    } else {
      this.below = Math.max(0, this.below - dt * 2);
      this.above = fps > this.o.upFps ? this.above + dt : 0;
    }

    if (this.tier > this.floor) {
      const severe = fps < SEVERE_FPS && this.below >= SEVERE_SECONDS;
      if (this.below >= this.o.downSeconds || severe) {
        const steps = severe && this.tier - 2 >= this.floor ? 2 : 1;
        this.tier = (this.tier - steps) as ActiveTier;
        if (this.clock - this.lastUp < BOUNCE_SECONDS) this.penalty = Math.min(MAX_PENALTY, this.penalty * 2);
        return this.changed();
      }
    }
    if (this.tier < this.ceiling && this.above >= this.o.upSeconds * this.penalty) {
      this.tier = (this.tier + 1) as ActiveTier;
      this.lastUp = this.clock;
      return this.changed();
    }
    return null;
  }

  /** Jump to a tier (clamped to floor and ceiling) and forget the evidence. */
  force(tier: ActiveTier): ActiveTier {
    this.tier = Math.min(this.ceiling, Math.max(this.floor, tier)) as ActiveTier;
    return this.changed();
  }

  private changed(): ActiveTier {
    this.below = 0;
    this.above = 0;
    this.quiet = this.o.settleSeconds;
    this.ema = 0;
    return this.tier;
  }
}

export interface DeviceHints {
  /** Phone or tablet class device (coarse pointer, mobile UA). */
  mobile: boolean;
  saveData: boolean;
  /** navigator.deviceMemory in GB, when exposed. */
  deviceMemory?: number;
  cores?: number;
}

export interface TierPlan {
  start: ActiveTier;
  ceiling: ActiveTier;
}

/** Where to begin and how high the governor may climb. Low-end devices start at 1 and may reach 2. */
export function pickStartTier(h: DeviceHints): TierPlan {
  if (h.mobile || h.saveData || (h.deviceMemory !== undefined && h.deviceMemory <= 4)) {
    return { start: 1, ceiling: 2 };
  }
  if (h.cores !== undefined && h.cores <= 4) return { start: 2, ceiling: 3 };
  return { start: 3, ceiling: 3 };
}

/** `?q=low|medium|high|none` (also 0..3). Returns null when absent or unrecognised. */
export function parseTierQuery(search: string): QualityTier | null {
  const q = new URLSearchParams(search).get('q');
  if (q === null) return null;
  switch (q.toLowerCase()) {
    case 'none':
    case 'off':
    case '0':
      return 0;
    case 'low':
    case '1':
      return 1;
    case 'medium':
    case 'med':
    case '2':
      return 2;
    case 'high':
    case '3':
      return 3;
    default:
      return null;
  }
}

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** Browser probe for the policy above. Never throws. */
export function readDeviceHints(): DeviceHints {
  try {
    const nav = navigator as Navigator & NavigatorExtras;
    const ua = nav.userAgent || '';
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const mobileUa =
      /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (nav.maxTouchPoints > 1 && /Macintosh/.test(ua));
    return {
      mobile: mobileUa || (coarse && Math.min(screen.width, screen.height) < 900),
      saveData: nav.connection?.saveData === true,
      deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
      cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined,
    };
  } catch {
    return { mobile: false, saveData: false };
  }
}

/** Whether a WebGL2 context can be created at all (cheap probe on a throwaway canvas). */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** The tier a renderer should start at: the URL override, else the device policy. */
export function initialPlan(search: string = typeof location === 'undefined' ? '' : location.search): {
  forced: QualityTier | null;
  plan: TierPlan;
} {
  return { forced: parseTierQuery(search), plan: pickStartTier(readDeviceHints()) };
}
