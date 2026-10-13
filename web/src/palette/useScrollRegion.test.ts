import { describe, expect, it } from 'vitest';
import { overflows } from './useScrollRegion';

describe('overflows', () => {
  it('is true when the content is taller than the box', () => {
    expect(overflows({ scrollHeight: 640, clientHeight: 480 })).toBe(true);
  });

  it('is false when it fits, and tolerates a pixel of rounding', () => {
    expect(overflows({ scrollHeight: 480, clientHeight: 480 })).toBe(false);
    expect(overflows({ scrollHeight: 481, clientHeight: 480 })).toBe(false);
    expect(overflows({ scrollHeight: 482, clientHeight: 480 })).toBe(true);
  });
});
