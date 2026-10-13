/**
 * Pure helpers behind the challenge widgets: reordering a list, pairing items, and wording feedback
 * for a wrong estimate. Kept apart from the components so they can be tested without a DOM.
 */

import type { EstimateVerdict, MatchVerdict } from '@/learn/grade';

/** A copy of `list` with the item at `from` moved to `to` (both clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  if (out.length === 0) return out;
  const a = Math.min(out.length - 1, Math.max(0, from));
  const b = Math.min(out.length - 1, Math.max(0, to));
  if (a === b) return out;
  const [item] = out.splice(a, 1);
  out.splice(b, 0, item as T);
  return out;
}

// ---------------------------------------------------------------------------
// Match: click to pair
// ---------------------------------------------------------------------------

export type Side = 'left' | 'right';

export interface Pending {
  side: Side;
  id: string;
}

export interface MatchState {
  /** Left id to the right id it is paired with. */
  assignment: Record<string, string>;
  /** The item waiting for its partner. */
  pending: Pending | null;
  /** Left ids that were confirmed right and can no longer move. */
  locked: string[];
}

export const freshMatch = (): MatchState => ({ assignment: {}, pending: null, locked: [] });

/** Who holds a right-hand item, if anyone. */
export function holderOf(assignment: Readonly<Record<string, string>>, rightId: string): string | null {
  for (const [left, right] of Object.entries(assignment)) if (right === rightId) return left;
  return null;
}

/**
 * One click on an item. Clicking the second item of a pair (one from each column) makes the pair;
 * clicking a paired item breaks the pair and picks that item up again; locked pairs never move.
 */
export function clickItem(state: MatchState, side: Side, id: string): MatchState {
  const { assignment, pending, locked } = state;
  const isLocked = (left: string | null) => left !== null && locked.includes(left);

  // The pair this item is in, if any.
  const leftOf = side === 'left' ? id : holderOf(assignment, id);
  const paired = leftOf !== null && assignment[leftOf] !== undefined;
  if (paired && isLocked(leftOf)) return state;

  if (pending && pending.side !== side) {
    const left = side === 'left' ? id : pending.id;
    const right = side === 'right' ? id : pending.id;
    if (isLocked(left) || isLocked(holderOf(assignment, right))) return { ...state, pending: null };
    const next = { ...assignment };
    // One to one: whoever held this right item, or this left item's old partner, is released.
    const previousHolder = holderOf(next, right);
    if (previousHolder !== null) delete next[previousHolder];
    next[left] = right;
    return { ...state, assignment: next, pending: null };
  }

  if (pending && pending.side === side && pending.id === id) return { ...state, pending: null };

  if (paired && leftOf !== null) {
    const next = { ...assignment };
    delete next[leftOf];
    return { ...state, assignment: next, pending: { side, id } };
  }
  return { ...state, pending: { side, id } };
}

/** Keep only what was confirmed right; everything else is free again. */
export function applyVerdict(state: MatchState, verdict: MatchVerdict): MatchState {
  const assignment: Record<string, string> = {};
  for (const left of verdict.right) {
    const right = state.assignment[left];
    if (right !== undefined) assignment[left] = right;
  }
  return { assignment, pending: null, locked: [...verdict.right] };
}

// ---------------------------------------------------------------------------
// Estimate feedback
// ---------------------------------------------------------------------------

/** Which way a wrong estimate missed, without giving the number away. */
export function estimateDirection(v: EstimateVerdict, answer: number): 'high' | 'low' {
  return answer > v.high ? 'high' : 'low';
}

/** One teaching sentence for a wrong estimate. Never states the true value. */
export function estimateFeedback(v: EstimateVerdict, answer: number, tolerance: number): string {
  const pct = Math.round(tolerance * 100);
  const dir = estimateDirection(v, answer);
  const r = v.ratio;
  let how: string;
  if (r !== null && r >= 2) how = 'That is more than double the real figure.';
  else if (r !== null && r > 0 && r <= 0.5) how = 'That is less than half the real figure.';
  else if (dir === 'high') how = 'That is a little high.';
  else how = 'That is a little low.';
  return `${how} Anything within ${pct} percent counts.`;
}
