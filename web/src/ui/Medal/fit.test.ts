import { describe, expect, it } from 'vitest';
import { fitArt, HEX_ASPECT } from './fit';

describe('fitArt', () => {
  it('centres a symmetric box and fills the badge height', () => {
    const f = fitArt([0.2, 0.1, 0.8, 0.9], 1);
    // lit box is 0.6 wide, 0.8 tall: height-limited gives k = 1 / 0.8 = 1.25,
    // width-limited gives 0.866 / 0.6 = 1.443, so the height wins
    expect(f.k).toBeCloseTo(1.25, 5);
    // image centre lands on the badge centre
    expect(f.x + 0.5 * f.k).toBeCloseTo(HEX_ASPECT / 2, 5);
    expect(f.y + 0.5 * f.k).toBeCloseTo(0.5, 5);
  });

  it('is width-limited for a wide box', () => {
    const f = fitArt([0, 0.4, 1, 0.6], 1);
    expect(f.k).toBeCloseTo(HEX_ASPECT, 5);
  });

  it('leaves margin with a smaller fill', () => {
    const a = fitArt([0.2, 0.1, 0.8, 0.9], 1);
    const b = fitArt([0.2, 0.1, 0.8, 0.9], 0.8);
    expect(b.k).toBeLessThan(a.k);
  });

  it('survives a degenerate box', () => {
    const f = fitArt([0.5, 0.5, 0.5, 0.5]);
    expect(Number.isFinite(f.k)).toBe(true);
    expect(Number.isFinite(f.x)).toBe(true);
  });
});
