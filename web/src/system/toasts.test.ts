import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addToList, DEFAULT_MS, MAX_VISIBLE, type ToastItem, toast, useToastStore } from './toasts';

function item(over: Partial<ToastItem> & { id: number }): ToastItem {
  return {
    message: `m${over.id}`,
    kind: 'info',
    duration: DEFAULT_MS,
    action: null,
    key: null,
    at: over.id * 10_000,
    leaving: false,
    ...over,
  };
}

describe('addToList', () => {
  it('collapses an identical message within a second', () => {
    const a = item({ id: 1, message: 'Copied', at: 100 });
    const list = addToList([a], item({ id: 2, message: 'Copied', at: 600 }));
    expect(list).toEqual([a]);
  });

  it('lets the same message through later', () => {
    const list = addToList(
      [item({ id: 1, message: 'Copied', at: 0 })],
      item({ id: 2, message: 'Copied', at: 5000 }),
    );
    expect(list).toHaveLength(2);
  });

  it('replaces a toast with the same key', () => {
    const list = addToList(
      [item({ id: 1, key: 'sync', message: 'Syncing' })],
      item({ id: 2, key: 'sync', message: 'Synced' }),
    );
    expect(list.map((t) => t.message)).toEqual(['Synced']);
  });

  it('marks the oldest as leaving past the cap', () => {
    let list: ToastItem[] = [];
    for (let i = 1; i <= MAX_VISIBLE + 1; i++) list = addToList(list, item({ id: i }));
    expect(list.filter((t) => !t.leaving)).toHaveLength(MAX_VISIBLE);
    expect(list[0]?.leaving).toBe(true);
  });
});

describe('toast()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows, then leaves after its duration', () => {
    toast('Spec copied');
    expect(useToastStore.getState().items).toHaveLength(1);
    vi.advanceTimersByTime(DEFAULT_MS + 1);
    expect(useToastStore.getState().items[0]?.leaving).toBe(true);
    vi.advanceTimersByTime(400);
    expect(useToastStore.getState().items).toHaveLength(0);
  });

  it('keeps an action toast until dismissed and ignores empty text', () => {
    expect(toast('   ')).toBe(-1);
    const id = toast('Deleted', { action: { label: 'Undo', run: () => undefined } });
    vi.advanceTimersByTime(60_000);
    expect(useToastStore.getState().items.map((t) => t.id)).toContain(id);
    toast.dismiss(id);
    vi.advanceTimersByTime(400);
    expect(useToastStore.getState().items).toHaveLength(0);
  });

  it('uses a longer duration for warnings', () => {
    toast.warn('Locked');
    expect(useToastStore.getState().items[0]?.duration).toBeGreaterThan(DEFAULT_MS);
  });

  it('pauses while held and resumes with the time that was left', () => {
    const id = toast('Spec copied', { duration: 2000 });
    vi.advanceTimersByTime(1500);
    useToastStore.getState().hold(id, true);
    vi.advanceTimersByTime(60_000);
    expect(useToastStore.getState().items.find((x) => x.id === id)?.leaving).toBe(false);

    useToastStore.getState().hold(id, false);
    vi.advanceTimersByTime(400);
    expect(useToastStore.getState().items.find((x) => x.id === id)?.leaving).toBe(false);
    vi.advanceTimersByTime(200);
    expect(useToastStore.getState().items.find((x) => x.id === id)?.leaving).toBe(true);
  });

  it('ignores a hold on a toast that is gone or has no timer', () => {
    const id = toast('Deleted', { action: { label: 'Undo', run: () => undefined } });
    expect(() => useToastStore.getState().hold(id, true)).not.toThrow();
    expect(() => useToastStore.getState().hold(9999, false)).not.toThrow();
  });
});
