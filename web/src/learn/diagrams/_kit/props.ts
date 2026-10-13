/**
 * Readers for the loose `props` a lesson author (or the stage adapter) passes to a diagram. They never
 * throw and always return a usable value, so a malformed prop degrades to the default instead of breaking
 * the figure.
 */

export type Props = Record<string, unknown> | undefined;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A finite number, clamped to [min, max] when given. */
export function num(v: unknown, fallback: number, min?: number, max?: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  let n = v;
  if (min !== undefined && n < min) n = min;
  if (max !== undefined && n > max) n = max;
  return n;
}

/** A non-empty string, trimmed and capped. */
export function str(v: unknown, fallback: string, max = 64): string {
  if (typeof v !== 'string') return fallback;
  const t = v.trim();
  return t ? t.slice(0, max) : fallback;
}

/** A record with a finite number for each key, taking missing or bad values from `fallback`. */
export function numberRecord<K extends string>(
  v: unknown,
  keys: readonly K[],
  fallback: Record<K, number>,
): Record<K, number> {
  const out = { ...fallback };
  if (!isRecord(v)) return out;
  for (const k of keys) {
    const n = v[k];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

/** A list of component names: strings, or objects with a `name`. Letters and digits only. */
export function nameList(v: unknown, fallback: string[], max = 6): string[] {
  if (!Array.isArray(v)) return fallback;
  const names: string[] = [];
  for (const item of v) {
    const raw =
      typeof item === 'string' ? item : isRecord(item) && typeof item.name === 'string' ? item.name : '';
    const clean = raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
    if (clean) names.push(clean);
    if (names.length >= max) break;
  }
  return names.length ? names : fallback;
}
