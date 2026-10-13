/**
 * The goal of the cost reactor widget and the pure functions around it: reading `props.target`, deciding
 * whether a spec meets it, saying it in words, and finding a configuration that does (for "Show me").
 *
 * A target is any of: `usdMax` (the monthly price is at most this), `usdMin` (at least this), `instances`
 * (exactly this many), `instancesMin` and `instancesMax`. Prices are monthly USD at the built-in rates, the
 * numbers the lesson text uses.
 */

import type { FluxAppSpec } from '@shared/flux/types';
import { BAKED_CONTEXT, BLOCKS_PER_MONTH, priceSpec } from '@/forge/model';
import { money } from '@/forge/model/format';

export interface Target {
  usdMax?: number;
  usdMin?: number;
  instances?: number;
  instancesMin?: number;
  instancesMax?: number;
}

export type SliderId = 'cpu' | 'ram' | 'hdd' | 'instances';
export const ALL_SLIDERS: readonly SliderId[] = ['cpu', 'ram', 'hdd', 'instances'];

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function readTarget(raw: unknown): Target | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const t: Target = {};
  const usdMax = num(r.usdMax);
  const usdMin = num(r.usdMin);
  const instances = num(r.instances);
  const instancesMin = num(r.instancesMin);
  const instancesMax = num(r.instancesMax);
  if (usdMax !== undefined) t.usdMax = usdMax;
  if (usdMin !== undefined) t.usdMin = usdMin;
  if (instances !== undefined) t.instances = instances;
  if (instancesMin !== undefined) t.instancesMin = instancesMin;
  if (instancesMax !== undefined) t.instancesMax = instancesMax;
  return Object.keys(t).length > 0 ? t : null;
}

export function readSliders(raw: unknown): readonly SliderId[] {
  if (!Array.isArray(raw)) return ALL_SLIDERS;
  const picked = ALL_SLIDERS.filter((s) => raw.includes(s));
  return picked.length > 0 ? picked : ALL_SLIDERS;
}

/** The monthly USD price of a spec at the built-in rates, one month: the lesson validator's number. */
export function monthlyUsd(spec: FluxAppSpec): number {
  return priceSpec({ ...spec, expire: BLOCKS_PER_MONTH }, BAKED_CONTEXT).usdPerMonth;
}

export function meets(target: Target, spec: FluxAppSpec, usd: number): boolean {
  const eps = 1e-9;
  if (target.usdMax !== undefined && usd > target.usdMax + eps) return false;
  if (target.usdMin !== undefined && usd < target.usdMin - eps) return false;
  if (target.instances !== undefined && spec.instances !== target.instances) return false;
  if (target.instancesMin !== undefined && spec.instances < target.instancesMin) return false;
  if (target.instancesMax !== undefined && spec.instances > target.instancesMax) return false;
  return true;
}

/** The goal in one sentence fragment: "at most $1.99 a month and at least 3 instances". */
export function describeTarget(t: Target): string {
  const parts: string[] = [];
  if (t.usdMax !== undefined) parts.push(`at most $${money(t.usdMax)} a month`);
  if (t.usdMin !== undefined) parts.push(`at least $${money(t.usdMin)} a month`);
  if (t.instances !== undefined)
    parts.push(`exactly ${t.instances} ${t.instances === 1 ? 'instance' : 'instances'}`);
  if (t.instancesMin !== undefined) {
    parts.push(`at least ${t.instancesMin} ${t.instancesMin === 1 ? 'instance' : 'instances'}`);
  }
  if (t.instancesMax !== undefined) {
    parts.push(`at most ${t.instancesMax} ${t.instancesMax === 1 ? 'instance' : 'instances'}`);
  }
  return parts.join(' and ');
}

/** What still stands between the spec and the goal, as one short sentence. Empty when it is met. */
export function gapSentence(t: Target, spec: FluxAppSpec, usd: number): string {
  const lines: string[] = [];
  if (t.usdMax !== undefined && usd > t.usdMax + 1e-9) {
    lines.push(`$${money(usd - t.usdMax)} over the limit`);
  }
  if (t.usdMin !== undefined && usd < t.usdMin - 1e-9) {
    lines.push(`$${money(t.usdMin - usd)} under the minimum`);
  }
  if (t.instances !== undefined && spec.instances !== t.instances) {
    lines.push(`needs ${t.instances} ${t.instances === 1 ? 'instance' : 'instances'}`);
  }
  if (t.instancesMin !== undefined && spec.instances < t.instancesMin) {
    lines.push(`needs at least ${t.instancesMin} instances`);
  }
  if (t.instancesMax !== undefined && spec.instances > t.instancesMax) {
    lines.push(`needs at most ${t.instancesMax} instances`);
  }
  return lines.join(', ');
}

// ---------------------------------------------------------------------------
// Finding a configuration that meets the goal
// ---------------------------------------------------------------------------

const STOPS = {
  cpu: [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.5, 3,
    3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  ],
  ram: [
    100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000,
    7000, 8000, 9000, 10000, 12000, 14000, 16000, 20000, 24000, 28000, 32000, 40000, 48000, 59000,
  ],
  hdd: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180,
    200, 250, 300, 400, 500, 600, 700, 820,
  ],
} as const;

type Resource = 'cpu' | 'ram' | 'hdd';
const RESOURCES: readonly Resource[] = ['cpu', 'ram', 'hdd'];

/** The largest stop at or below `v` (the smallest stop when `v` is below all of them). */
function snapDown(list: readonly number[], v: number): number {
  let best = list[0] as number;
  for (const s of list) if (s <= v + 1e-9) best = s;
  return best;
}

/** The smallest stop at or above `v` (the largest stop when `v` is above all of them). */
function snapUp(list: readonly number[], v: number): number {
  for (const s of list) if (s >= v - 1e-9) return s;
  return list[list.length - 1] as number;
}

function scaled(
  spec: FluxAppSpec,
  index: number,
  f: number,
  from: Readonly<Record<Resource, number>>,
  which: readonly Resource[],
): FluxAppSpec {
  const c = spec.compose[index];
  if (!c) return spec;
  const next = { ...c };
  for (const r of which) {
    const raw = from[r] * f;
    next[r] = f <= 1 ? snapDown(STOPS[r], raw) : snapUp(STOPS[r], raw);
  }
  const compose = spec.compose.slice();
  compose[index] = next;
  return { ...spec, compose };
}

/**
 * A spec that meets `target`, reached from `spec` the way a person would size an app down (or up): the
 * instance count the goal names, then CPU, RAM and disk of the chosen component scaled together, on the
 * slider stops, by the smallest factor that does it. Only the sliders the learner has are touched. Null
 * when nothing is found.
 */
export function solveTarget(
  spec: FluxAppSpec,
  index: number,
  target: Target,
  sliders: readonly SliderId[],
): FluxAppSpec | null {
  let cur = spec;
  if (meets(target, cur, monthlyUsd(cur))) return cur;

  // Instances the goal names.
  if (sliders.includes('instances')) {
    let n = cur.instances;
    if (target.instances !== undefined) n = target.instances;
    if (target.instancesMin !== undefined) n = Math.max(n, target.instancesMin);
    if (target.instancesMax !== undefined) n = Math.min(n, target.instancesMax);
    if (n !== cur.instances) cur = { ...cur, instances: n };
  }
  if (meets(target, cur, monthlyUsd(cur))) return cur;

  const usd = monthlyUsd(cur);
  const wantLower = target.usdMax !== undefined && usd > target.usdMax + 1e-9;
  const wantHigher = target.usdMin !== undefined && usd < target.usdMin - 1e-9;
  const which = RESOURCES.filter((r) => sliders.includes(r));
  const c = cur.compose[index];
  if (!c || which.length === 0 || (!wantLower && !wantHigher)) return null;

  const from: Record<Resource, number> = { cpu: c.cpu, ram: c.ram, hdd: c.hdd };
  // Walk the factor from "no change" toward the extreme in small steps; the first spec that meets the goal
  // is the gentlest one.
  const factors: number[] = [];
  if (wantLower) for (let f = 0.98; f >= 0.01; f -= 0.02) factors.push(Number(f.toFixed(2)));
  else for (let f = 1.02; f <= 40; f *= 1.04) factors.push(Number(f.toFixed(3)));
  for (const f of factors) {
    const candidate = scaled(cur, index, f, from, which);
    if (meets(target, candidate, monthlyUsd(candidate))) return candidate;
  }
  return null;
}
