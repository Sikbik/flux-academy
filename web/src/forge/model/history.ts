/**
 * Undo and redo with a bound and with coalescing.
 *
 * Typing into a field produces one edit per keystroke; the learner wants one undo step per burst, not one
 * per character. An edit carries a `key` (the field it belongs to). Two edits with the same key, no more
 * than `coalesceMs` apart, replace each other instead of stacking. A pause longer than that starts a new
 * step, so "type a port, think, type another" is two steps.
 *
 * Pure and framework-free. Time is injected so tests do not sleep.
 */

export interface HistoryOptions {
  /** Most undo steps kept. Default 100. */
  limit?: number;
  /** Edits to the same key closer together than this merge into one step. Default 700 ms. */
  coalesceMs?: number;
}

interface Entry<T> {
  value: T;
  key: string | null;
  at: number;
  label: string;
}

export class UndoStack<T> {
  private past: Entry<T>[] = [];
  private future: Entry<T>[] = [];
  private cur: Entry<T>;
  private readonly limit: number;
  private readonly coalesceMs: number;

  constructor(initial: T, opts: HistoryOptions = {}) {
    this.limit = Math.max(1, opts.limit ?? 100);
    this.coalesceMs = opts.coalesceMs ?? 700;
    this.cur = { value: initial, key: null, at: 0, label: 'Start' };
  }

  get present(): T {
    return this.cur.value;
  }

  /** What the next undo would revert, for a tooltip ("Undo: change instances"). */
  get undoLabel(): string | null {
    return this.past.length ? this.cur.label : null;
  }

  get redoLabel(): string | null {
    return this.future.length ? (this.future[this.future.length - 1] as Entry<T>).label : null;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Steps behind the present. */
  get depth(): number {
    return this.past.length;
  }

  /** Record a new present. A value identical to the present is ignored. */
  push(value: T, opts: { key?: string | null; label?: string; now?: number } = {}): void {
    if (Object.is(value, this.cur.value)) return;
    const now = opts.now ?? Date.now();
    const key = opts.key ?? null;
    const label = opts.label ?? 'Edit';
    const merge =
      key !== null && this.cur.key === key && now - this.cur.at <= this.coalesceMs && this.past.length > 0;
    if (merge) {
      this.cur = { value, key, at: now, label };
    } else {
      this.past.push(this.cur);
      if (this.past.length > this.limit) this.past.shift();
      this.cur = { value, key, at: now, label };
    }
    this.future = [];
  }

  /** Step back. Returns the value now present, or null when there is nothing to undo. */
  undo(): T | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.future.push(this.cur);
    this.cur = { ...prev, key: null };
    return this.cur.value;
  }

  /** Step forward. Returns the value now present, or null when there is nothing to redo. */
  redo(): T | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(this.cur);
    this.cur = { ...next, key: null };
    return this.cur.value;
  }

  /** Forget everything and start again from `value`. */
  reset(value: T): void {
    this.past = [];
    this.future = [];
    this.cur = { value, key: null, at: 0, label: 'Start' };
  }
}
