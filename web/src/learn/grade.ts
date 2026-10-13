/**
 * Graders for checkpoint challenges that do not need a stage: choice, multi, order, match and estimate.
 * Pure. Spec and terminal challenges are graded by `checks.ts` and by terminal goals (see `tasks.ts`).
 */

import type { PricingParams } from '@shared/flux/types';
import type { LessonEngine } from './engine';
import { buildSpec } from './specs';
import type {
  ChoiceChallenge,
  EstimateChallenge,
  MatchChallenge,
  MultiChallenge,
  OrderChallenge,
} from './types';

// ---------------------------------------------------------------------------
// choice, multi
// ---------------------------------------------------------------------------

export function gradeChoice(c: ChoiceChallenge, picked: string | null): boolean {
  return picked !== null && picked === c.answer;
}

export interface MultiVerdict {
  correct: boolean;
  /** Right answers the learner did not pick. */
  missing: string[];
  /** Picked options that are not answers. */
  extra: string[];
}

export function gradeMulti(c: MultiChallenge, picked: readonly string[]): MultiVerdict {
  const want = new Set(c.answers);
  const got = new Set(picked);
  const missing = c.answers.filter((a) => !got.has(a));
  const extra = [...got].filter((p) => !want.has(p));
  return { correct: missing.length === 0 && extra.length === 0, missing, extra };
}

// ---------------------------------------------------------------------------
// order
// ---------------------------------------------------------------------------

export interface OrderVerdict {
  correct: boolean;
  /** For each position in `ids`, whether that item belongs there. */
  positions: boolean[];
}

export function gradeOrder(c: OrderChallenge, ids: readonly string[]): OrderVerdict {
  const positions = c.items.map((item, i) => ids[i] === item.id);
  return { correct: ids.length === c.items.length && positions.every(Boolean), positions };
}

/**
 * A deterministic shuffle of `ids` (seeded by a string) that never returns the original order, for two or
 * more items. The same seed gives the same order, so a re-render does not reshuffle the learner's list.
 */
export function shuffleIds(ids: readonly string[], seed: string): string[] {
  if (ids.length < 2) return [...ids];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const rnd = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const same = (a: string[]) => a.every((v, i) => v === ids[i]);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const a = ids.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j] as string, a[i] as string];
    }
    if (!same(a)) return a;
  }
  // Fallback: rotate by one, which is never the original order for 2 or more distinct items.
  return [...ids.slice(1), ids[0] as string];
}

/** The order challenge's items, shuffled so the correct order is never the starting one. */
export function shuffledOrder(c: OrderChallenge, seed: string): string[] {
  return shuffleIds(
    c.items.map((i) => i.id),
    seed,
  );
}

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

export interface MatchVerdict {
  correct: boolean;
  /** Pair ids whose right-hand side was assigned correctly. */
  right: string[];
  /** Pair ids assigned wrongly or not at all. */
  wrong: string[];
}

/** `assignment` maps a pair id (the left item) to the pair id of the right item the learner chose. */
export function gradeMatch(
  c: MatchChallenge,
  assignment: Readonly<Record<string, string | undefined>>,
): MatchVerdict {
  const right: string[] = [];
  const wrong: string[] = [];
  for (const p of c.pairs) {
    if (assignment[p.id] === p.id) right.push(p.id);
    else wrong.push(p.id);
  }
  return { correct: wrong.length === 0, right, wrong };
}

// ---------------------------------------------------------------------------
// estimate
// ---------------------------------------------------------------------------

export interface EstimatePricing {
  params?: PricingParams;
  fluxUsd?: number | null;
}

/**
 * The true value of an estimate challenge, computed from the shared engine at the baked rate card unless
 * the caller passes live `pricing` (lessons do not, so an answer taught at "the rates read on <date>" is
 * always accepted). Null when it cannot be computed (no spec for a price, a missing value, a quote that threw).
 */
export function estimateTruth(
  c: EstimateChallenge,
  engine: LessonEngine,
  pricing: EstimatePricing = {},
): number | null {
  const fromSpec = c.spec !== undefined ? buildSpec(engine, c.spec) : null;
  switch (c.quantity) {
    case 'usd-per-month':
    case 'flux-per-month': {
      if (!fromSpec) return null;
      try {
        const fluxUsd = pricing.fluxUsd ?? engine.baked.fluxUsd;
        const q = engine.quote(fromSpec, pricing.params ?? engine.baked.params, { fluxUsd, months: 1 });
        const v = c.quantity === 'usd-per-month' ? q.usdPerMonth : q.fluxPerMonth;
        return v !== null && Number.isFinite(v) ? v : null;
      } catch {
        return null;
      }
    }
    case 'blocks':
      if (typeof c.value === 'number') return c.value;
      return fromSpec ? fromSpec.expire : null;
    case 'number':
      return typeof c.value === 'number' ? c.value : null;
  }
}

export interface EstimateVerdict {
  correct: boolean;
  truth: number;
  /** The accepted range. */
  low: number;
  high: number;
  /** answer / truth, to say "about double" or "less than half". */
  ratio: number | null;
}

export function gradeEstimate(c: EstimateChallenge, answer: number, truth: number): EstimateVerdict {
  const slack = Math.abs(truth) * Math.max(0, c.tolerance);
  const low = truth - slack;
  const high = truth + slack;
  const correct = Number.isFinite(answer) && answer >= low - 1e-9 && answer <= high + 1e-9;
  return { correct, truth, low, high, ratio: truth !== 0 && Number.isFinite(answer) ? answer / truth : null };
}

/** Parse what a learner typed ("$1,234.50", "88 000", "0.99") into a number, or null. */
export function parseNumberInput(raw: string): number | null {
  const cleaned = raw
    .replace(/[\s,_$]/g, '')
    .replace(/usd$/i, '')
    .replace(/flux$/i, '');
  if (cleaned === '' || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
