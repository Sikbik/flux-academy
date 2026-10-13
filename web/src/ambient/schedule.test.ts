import { describe, expect, it } from 'vitest';
import { CAPTION_MS, captionAt, driftOffset, nextStart } from './schedule';

describe('captionAt', () => {
  it('holds each caption for 9 seconds', () => {
    expect(CAPTION_MS).toBe(9000);
    expect(captionAt(0, 5).index).toBe(0);
    expect(captionAt(8999, 5).index).toBe(0);
    expect(captionAt(9000, 5).index).toBe(1);
    expect(captionAt(9 * 4 * 1000, 5).index).toBe(4);
  });

  it('loops', () => {
    expect(captionAt(5 * CAPTION_MS, 5).index).toBe(0);
    expect(captionAt(7 * CAPTION_MS + 1, 5).index).toBe(2);
  });

  it('reports progress and time to the next change', () => {
    const t = captionAt(2250, 5);
    expect(t.progress).toBeCloseTo(0.25, 5);
    expect(t.nextInMs).toBe(6750);
    expect(captionAt(8999.5, 5).nextInMs).toBeGreaterThanOrEqual(1);
  });

  it('starts anywhere', () => {
    expect(captionAt(0, 5, 3).index).toBe(3);
    expect(captionAt(CAPTION_MS * 2, 5, 3).index).toBe(0);
    expect(captionAt(0, 5, -1).index).toBe(4);
    expect(captionAt(0, 5, 12).index).toBe(2);
  });

  it('copes with nothing to show and with a clock that went backwards', () => {
    expect(captionAt(1000, 0)).toEqual({ index: 0, progress: 0, nextInMs: CAPTION_MS });
    expect(captionAt(-500, 3).index).toBe(0);
  });
});

describe('nextStart', () => {
  it('continues after the last caption shown', () => {
    expect(nextStart(null, 10)).toBe(0);
    expect(nextStart(0, 10)).toBe(1);
    expect(nextStart(9, 10)).toBe(0);
    expect(nextStart(3, 0)).toBe(0);
  });
});

describe('driftOffset', () => {
  it('stays within a few pixels and is deterministic', () => {
    for (let m = 0; m < 400; m++) {
      const d = driftOffset(m);
      expect(Math.abs(d.x)).toBeLessThanOrEqual(5);
      expect(Math.abs(d.y)).toBeLessThanOrEqual(4);
      expect(driftOffset(m)).toEqual(d);
    }
  });
});
