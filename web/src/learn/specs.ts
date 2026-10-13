/**
 * How partial specs in lessons become real specs. ONE implementation, used by the player, the tests and
 * (it should be) every stage that shows a spec, so a lesson, its "Show me" and its test agree.
 *
 * Merge semantics (`mergeSpecPatch`), the same as a JSON merge patch with one addition:
 *   - plain objects merge key by key; a key whose patch value is `undefined` is left alone;
 *   - arrays of primitives (`ports`, `geolocation`, `environmentParameters`...) are REPLACED by the patch;
 *   - arrays of objects (`compose`) are REPLACED by the patch array as to length, and element `i` of the
 *     patch is merged over element `i` of the base (so `compose: [{}, { ports: [3001] }]` keeps the first
 *     component and edits the second, while `compose: [{ cpu: 1 }]` removes every component after the first);
 *   - anything else in the patch replaces the base.
 *
 * A stage's `spec` is `defaultSpec()` with the partial merged over it, then normalised. A task's or
 * challenge's `solution` is merged over the spec the learner starts from, then normalised.
 *
 * Pure: the engine functions are injected (`SpecTools`), so this file imports nothing from `shared/flux`.
 */

import type { FluxAppSpec } from '@shared/flux/types';
import type { DeepPartial } from './types';

export interface SpecTools {
  normalizeSpec(input: unknown): { spec: FluxAppSpec };
  defaultSpec(): FluxAppSpec;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);

/** Merge `patch` over `base` (see the header for the rules). Returns a new value; inputs are not changed. */
export function mergeSpecPatch(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return clone(base);
  if (Array.isArray(patch)) {
    const baseArr = Array.isArray(base) ? base : [];
    return patch.map((el, i) => {
      if (isRecord(el) && isRecord(baseArr[i])) return mergeSpecPatch(baseArr[i], el);
      return clone(el);
    });
  }
  if (isRecord(patch)) {
    const out: Record<string, unknown> = isRecord(base) ? (clone(base) as Record<string, unknown>) : {};
    for (const [k, v] of Object.entries(patch)) {
      if (BLOCKED.has(k) || v === undefined) continue;
      out[k] = mergeSpecPatch(out[k], v);
    }
    return out;
  }
  return patch;
}

function clone<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clone) as T;
  if (isRecord(v)) {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (!BLOCKED.has(k)) o[k] = clone(x);
    return o as T;
  }
  return v;
}

/** `defaultSpec()` with `partial` merged over it, normalised. */
export function buildSpec(tools: SpecTools, partial?: DeepPartial<FluxAppSpec> | null): FluxAppSpec {
  const merged = mergeSpecPatch(tools.defaultSpec(), partial ?? {});
  return tools.normalizeSpec(merged).spec;
}

/** `solution` merged over `start`, normalised. `start` is a full spec or a partial one. */
export function applySolution(
  tools: SpecTools,
  start: FluxAppSpec | DeepPartial<FluxAppSpec>,
  solution: DeepPartial<FluxAppSpec>,
): FluxAppSpec {
  return tools.normalizeSpec(mergeSpecPatch(start, solution)).spec;
}

/**
 * Number of components a patch would end up with against a base, for the validator's
 * "this solution drops components" warning.
 */
export function composeLength(spec: unknown): number {
  if (!isRecord(spec)) return 0;
  return Array.isArray(spec.compose) ? spec.compose.length : 0;
}
