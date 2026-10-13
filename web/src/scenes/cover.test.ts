import { describe, expect, it, vi } from 'vitest';
import { coverStage, onCoverChange, stageCovered } from './cover';

describe('stage cover', () => {
  it('is uncovered until an ambient scene mounts', () => {
    expect(stageCovered()).toBe(false);
    const release = coverStage();
    expect(stageCovered()).toBe(true);
    release();
    expect(stageCovered()).toBe(false);
  });

  it('counts overlapping covers and ignores a double release', () => {
    const a = coverStage();
    const b = coverStage();
    a();
    a();
    expect(stageCovered()).toBe(true);
    b();
    expect(stageCovered()).toBe(false);
  });

  it('notifies listeners on every change and stops after unsubscribe', () => {
    const fn = vi.fn();
    const off = onCoverChange(fn);
    const release = coverStage();
    release();
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    coverStage()();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
