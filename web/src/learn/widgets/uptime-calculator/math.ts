/**
 * The arithmetic behind the uptime calculator. Pure and framework-free.
 *
 * The model is deliberately the simplest one that teaches: every node is up with the same probability
 * `a`, nodes fail independently, and the app is up when at least one instance is up. That gives
 *
 *     combined availability = 1 - (1 - a) ^ n
 *
 * Two things are ASSUMPTIONS, not measurements, and the UI says so:
 *  - the per-node availability `a` (the docs ask operators for about 97 percent, FACTS 2.2; this course
 *    has no measured figure, so the number is the learner's to set), and
 *  - independence (a region, a bad image or a shared operator breaks it, FACTS 6.2).
 *
 * What it leaves out on purpose: the few seconds the load balancer needs to notice a dead instance
 * (`FDM_EJECT_SEC`, FACTS 6.4), the time a replacement takes (`LOCATION_TTL_MIN` after the node dies, plus the
 * image pull, and more for a synced-storage app, FACTS 6.5 and 6.3) and any capacity limit. Those belong to
 * the failover lab.
 */

/** Minutes in the 30 day month the downtime figures are stated for. */
export const MINUTES_PER_MONTH = 30 * 24 * 60;

/** Instance counts the calculator offers. The network allows 1 to 100 for a v8 app (FACTS 3). */
export const MIN_INSTANCES = 1;
export const MAX_INSTANCES = 12;

/** The docs ask node operators for about 97 percent uptime (FACTS 2.2, DOCS-ONLY). A stated expectation. */
export const DEFAULT_NODE_AVAILABILITY = 0.97;

/** Slider bounds for the assumed per-node availability. */
export const MIN_NODE_AVAILABILITY = 0.9;
export const MAX_NODE_AVAILABILITY = 0.999;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Accepts `99.9` or `0.999` and returns a fraction, or null for something unusable. */
export function normalizeAvailability(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const fraction = value > 1 ? value / 100 : value;
  return fraction > 1 ? null : fraction;
}

/** `1 - (1 - a) ^ n`: the chance that at least one of `n` independent instances is up. */
export function combinedAvailability(instances: number, nodeAvailability: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(instances) ? instances : 0));
  if (n === 0) return 0;
  const a = clamp01(nodeAvailability);
  return 1 - (1 - a) ** n;
}

/** Expected minutes down in a 30 day month at a combined availability. */
export function downtimeMinutesPerMonth(availability: number): number {
  return (1 - clamp01(availability)) * MINUTES_PER_MONTH;
}

/** The number of nines: 0.999 is 3. Capped at 12 so a perfect score stays printable. */
export function nines(availability: number): number {
  const miss = 1 - clamp01(availability);
  if (miss <= 1e-12) return 12;
  return Math.max(0, -Math.log10(miss));
}

/**
 * The busiest an instance may run at peak, as a share of ITS OWN capacity, if the app is to survive losing
 * one instance: `(n - 1) / n`. Zero for a single instance (it survives nothing). This is a utilisation, not
 * a size: see `peakShareToCarry` for what each instance must be able to carry.
 */
export function survivableLoadShare(instances: number): number {
  const n = Math.max(1, Math.floor(instances));
  return (n - 1) / n;
}

/**
 * N minus 1 sizing (FACTS 6.5): with one instance down, the other `n - 1` must carry the whole peak, so
 * each must be able to carry `1 / (n - 1)` of it. 3 instances: one half. 2 instances: all of it. Null for a
 * single instance, because no size survives losing the only one.
 */
export function peakShareToCarry(instances: number): number | null {
  const n = Math.max(1, Math.floor(instances));
  return n < 2 ? null : 1 / (n - 1);
}

/** Minutes of downtime each added instance removes, starting from one instance. */
export function marginalSavings(
  maxInstances: number,
  nodeAvailability: number,
): { instances: number; availability: number; downtimeMin: number; savedMin: number }[] {
  const out: { instances: number; availability: number; downtimeMin: number; savedMin: number }[] = [];
  let previous = MINUTES_PER_MONTH;
  for (let n = 1; n <= maxInstances; n++) {
    const availability = combinedAvailability(n, nodeAvailability);
    const downtimeMin = downtimeMinutesPerMonth(availability);
    out.push({ instances: n, availability, downtimeMin, savedMin: n === 1 ? 0 : previous - downtimeMin });
    previous = downtimeMin;
  }
  return out;
}

/** The fewest instances that reach `target` at `nodeAvailability`, or null when none up to `limit` do. */
export function instancesFor(target: number, nodeAvailability: number, limit = 100): number | null {
  const goal = normalizeAvailability(target);
  if (goal === null) return null;
  for (let n = 1; n <= limit; n++) {
    if (combinedAvailability(n, nodeAvailability) >= goal - 1e-12) return n;
  }
  return null;
}

/** A percentage with as many decimals as the nines need: 0.97 to "97", 0.999973 to "99.9973". */
export function formatAvailability(availability: number): string {
  const a = clamp01(availability);
  if (a >= 0.9999995) return '99.99999+';
  const decimals = Math.min(6, Math.max(1, Math.ceil(nines(a))));
  const text = (a * 100).toFixed(decimals);
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** "21 h 36 min", "38 min", "3.2 min", "40 s", "under 1 s". */
export function formatDowntime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return 'unknown';
  const seconds = minutes * 60;
  if (seconds < 1) return minutes === 0 ? '0 s' : 'under 1 s';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (minutes < 10) return `${(Math.round(minutes * 10) / 10).toString()} min`;
  if (minutes < 120) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes - hours * 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const h = hours - days * 24;
    return h > 0 ? `${days} d ${h} h` : `${days} d`;
  }
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}
