/**
 * The state of the readiness checklist as pure functions: what the learner said about each item, how
 * that adds up, and what is persisted. No React, no DOM.
 *
 * Three answers are legitimate for every item: "I have this" (done), "I will do this later" (later) and
 * the starting answer, not answered yet (todo). The widget reports done when nothing is left unanswered.
 * It reports "You are ready" only when every required item is actually done: a deferred item is a fine
 * answer, but it is still left to do.
 */

import type { ChecklistItem } from './items';

export type ItemState = 'todo' | 'done' | 'later';

/** Item id to state. An id that is absent means `todo`. */
export type States = Readonly<Record<string, ItemState>>;

export const STORAGE_KEY = 'flux-academy:readiness-checklist:v1';

const VALID: readonly ItemState[] = ['todo', 'done', 'later'];

export function stateOf(states: States, id: string): ItemState {
  return states[id] ?? 'todo';
}

/**
 * Read stored state defensively. Anything that is not an object of known answers is dropped, so a
 * corrupt or hand-edited value can never break the widget.
 */
export function parseStored(raw: unknown): States {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const src = (raw as Record<string, unknown>).states;
  if (typeof src !== 'object' || src === null || Array.isArray(src)) return {};
  const out: Record<string, ItemState> = {};
  for (const [id, v] of Object.entries(src as Record<string, unknown>)) {
    if (typeof v === 'string' && (VALID as readonly string[]).includes(v) && v !== 'todo') {
      out[id] = v as ItemState;
    }
  }
  return out;
}

/** What is written to storage. `todo` is the absence of an answer, so it is not stored. */
export function toStored(states: States): { v: 1; states: Record<string, ItemState> } {
  const out: Record<string, ItemState> = {};
  for (const [id, v] of Object.entries(states)) if (v !== 'todo') out[id] = v;
  return { v: 1, states: out };
}

/**
 * Set an answer. Choosing the answer an item already has clears it back to `todo`, so each button is a
 * toggle and a mis-click is undone by clicking again.
 */
export function setAnswer(states: States, id: string, answer: Exclude<ItemState, 'todo'>): States {
  const next = { ...states };
  if (stateOf(states, id) === answer) delete next[id];
  else next[id] = answer;
  return next;
}

export interface Summary {
  total: number;
  done: number;
  later: number;
  todo: number;
  requiredTotal: number;
  requiredDone: number;
  /** 0 to 1 over the required items. 1 when there are none. */
  readiness: number;
  /** Every required item is done. */
  ready: boolean;
  /** Nothing is left unanswered: every item is done or deferred. This is the widget's done condition. */
  complete: boolean;
  /** Required items that are not done, unanswered ones first, in list order within each group. */
  left: ChecklistItem[];
}

export function summarise(items: readonly ChecklistItem[], states: States): Summary {
  let done = 0;
  let later = 0;
  let todo = 0;
  let requiredTotal = 0;
  let requiredDone = 0;
  const leftTodo: ChecklistItem[] = [];
  const leftLater: ChecklistItem[] = [];
  for (const item of items) {
    const s = stateOf(states, item.id);
    if (s === 'done') done += 1;
    else if (s === 'later') later += 1;
    else todo += 1;
    if (item.required) {
      requiredTotal += 1;
      if (s === 'done') requiredDone += 1;
      else if (s === 'later') leftLater.push(item);
      else leftTodo.push(item);
    }
  }
  return {
    total: items.length,
    done,
    later,
    todo,
    requiredTotal,
    requiredDone,
    readiness: requiredTotal === 0 ? 1 : requiredDone / requiredTotal,
    ready: requiredDone === requiredTotal,
    complete: items.length > 0 && todo === 0,
    left: [...leftTodo, ...leftLater],
  };
}

/**
 * "Show me": answer every unanswered item with "I will do this later". It never overwrites what the
 * learner has already said and it never claims they have something they do not.
 */
export function deferUnanswered(items: readonly ChecklistItem[], states: States): States {
  const next: Record<string, ItemState> = { ...states };
  for (const item of items) {
    if (stateOf(states, item.id) === 'todo') next[item.id] = 'later';
  }
  return next;
}

/** One sentence for the polite live region, so every change is spoken once and says what is left. */
export function announcement(s: Summary): string {
  if (s.complete && s.ready) return 'You are ready. Every required item is done.';
  if (s.complete) {
    return `Every item is answered. ${s.requiredTotal - s.requiredDone} required ${
      s.requiredTotal - s.requiredDone === 1 ? 'item is' : 'items are'
    } left to do later.`;
  }
  return `${s.requiredDone} of ${s.requiredTotal} required items done. ${s.todo} ${
    s.todo === 1 ? 'item is' : 'items are'
  } not answered yet.`;
}
