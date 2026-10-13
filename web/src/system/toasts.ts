/**
 * Toasts: one line, glass, 2.4 s, announced in a polite live region (the host is `ToastHost` in the
 * shell). Anyone can call `toast()`:
 *
 *   import { toast } from '@/system/toasts';
 *   toast('Spec copied to the clipboard');
 *   toast('Finish the Nimbus track to unlock this accent.', { kind: 'warn' });
 *   toast.success('Copied');
 *
 * A message is one short sentence in sentence case with no dash and no emoji. Identical messages that
 * arrive within a second collapse into one.
 */

import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

export interface ToastOptions {
  kind?: ToastKind;
  /** Milliseconds on screen. 0 keeps it until dismissed. Default 2400 (4000 for warn and error). */
  duration?: number;
  /** One optional action, for example "Undo". The toast stays until it is used or dismissed. */
  action?: { label: string; run: () => void };
  /** Groups toasts: a new toast with the same key replaces the old one. */
  key?: string;
}

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  duration: number;
  action: ToastOptions['action'] | null;
  key: string | null;
  /** performance.now()-style monotonic ms when it was created. */
  at: number;
  /** True while its exit animation plays. */
  leaving: boolean;
}

export const MAX_VISIBLE = 3;
export const DEFAULT_MS = 2400;
export const LONG_MS = 4000;
export const EXIT_MS = 220;
const DEDUPE_MS = 1000;

/** Pure: the list after adding `item`, applying key replacement, dedupe and the visible cap. */
export function addToList(list: readonly ToastItem[], item: ToastItem): ToastItem[] {
  const live = list.filter((t) => !t.leaving);
  const dup = live.find(
    (t) => t.message === item.message && t.kind === item.kind && item.at - t.at < DEDUPE_MS,
  );
  if (dup) return list as ToastItem[];
  let next = item.key ? list.filter((t) => t.key !== item.key) : [...list];
  next.push(item);
  const visible = next.filter((t) => !t.leaving);
  if (visible.length > MAX_VISIBLE) {
    const drop = new Set(visible.slice(0, visible.length - MAX_VISIBLE).map((t) => t.id));
    next = next.map((t) => (drop.has(t.id) ? { ...t, leaving: true } : t));
  }
  return next;
}

interface ToastState {
  items: ToastItem[];
  add: (message: string, opts?: ToastOptions) => number;
  dismiss: (id: number) => void;
  /**
   * A toast must not vanish under the pointer or the keyboard (WCAG 2.2.1): while it is held (pointer
   * over it, or focus inside it) its timer pauses, and it resumes with whatever time was left.
   */
  hold: (id: number, held: boolean) => void;
  clear: () => void;
}

let seq = 0;

interface Countdown {
  handle: ReturnType<typeof setTimeout> | null;
  /** When the running timer started, ms on `clock()`. */
  startedAt: number;
  /** Time left when it was last (re)started. */
  remaining: number;
}

const timers = new Map<number, Countdown>();

function clock(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],

  add(message, opts = {}) {
    const text = message.trim();
    if (!text) return -1;
    const kind = opts.kind ?? 'info';
    const duration =
      opts.action && opts.duration === undefined
        ? 0
        : (opts.duration ?? (kind === 'warn' || kind === 'error' ? LONG_MS : DEFAULT_MS));
    const item: ToastItem = {
      id: ++seq,
      message: text,
      kind,
      duration,
      action: opts.action ?? null,
      key: opts.key ?? null,
      at: clock(),
      leaving: false,
    };
    const before = get().items;
    const after = addToList(before, item);
    if (after === before) {
      // A duplicate: report the id of the one already showing.
      return before.find((t) => t.message === text && !t.leaving)?.id ?? item.id;
    }
    set({ items: after });
    for (const t of before) {
      if (!after.includes(t) || after.find((x) => x.id === t.id)?.leaving) get().dismiss(t.id);
    }
    if (item.duration > 0) {
      timers.set(item.id, {
        handle: setTimeout(() => get().dismiss(item.id), item.duration),
        startedAt: clock(),
        remaining: item.duration,
      });
    }
    return item.id;
  },

  hold(id, held) {
    const t = timers.get(id);
    if (!t) return;
    if (held) {
      if (t.handle === null) return;
      clearTimeout(t.handle);
      t.handle = null;
      t.remaining = Math.max(0, t.remaining - (clock() - t.startedAt));
      return;
    }
    if (t.handle !== null) return;
    t.startedAt = clock();
    t.handle = setTimeout(() => get().dismiss(id), t.remaining);
  },

  dismiss(id) {
    const timer = timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    timers.delete(id);
    const item = get().items.find((t) => t.id === id);
    if (!item || item.leaving) {
      if (item) set({ items: get().items.filter((t) => t.id !== id) });
      return;
    }
    set({ items: get().items.map((t) => (t.id === id ? { ...t, leaving: true } : t)) });
    setTimeout(() => {
      set({ items: get().items.filter((t) => t.id !== id) });
    }, EXIT_MS);
  },

  clear() {
    for (const t of timers.values()) if (t.handle) clearTimeout(t.handle);
    timers.clear();
    set({ items: [] });
  },
}));

type ToastFn = ((message: string, opts?: ToastOptions) => number) & {
  success: (message: string, opts?: Omit<ToastOptions, 'kind'>) => number;
  warn: (message: string, opts?: Omit<ToastOptions, 'kind'>) => number;
  error: (message: string, opts?: Omit<ToastOptions, 'kind'>) => number;
  dismiss: (id: number) => void;
  clear: () => void;
};

/** Show a toast. Returns its id (usable with `toast.dismiss`). Safe to call from anywhere. */
export const toast: ToastFn = Object.assign(
  (message: string, opts?: ToastOptions) => useToastStore.getState().add(message, opts),
  {
    success: (message: string, opts?: Omit<ToastOptions, 'kind'>) =>
      useToastStore.getState().add(message, { ...opts, kind: 'success' }),
    warn: (message: string, opts?: Omit<ToastOptions, 'kind'>) =>
      useToastStore.getState().add(message, { ...opts, kind: 'warn' }),
    error: (message: string, opts?: Omit<ToastOptions, 'kind'>) =>
      useToastStore.getState().add(message, { ...opts, kind: 'error' }),
    dismiss: (id: number) => useToastStore.getState().dismiss(id),
    clear: () => useToastStore.getState().clear(),
  },
);
