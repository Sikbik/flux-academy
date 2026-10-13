import { describe, expect, it } from 'vitest';
import { BOOST_DPR_MAX, BOOST_PIXELS, chooseDpr, DPR_FLOOR } from './resolution';

const base = { deviceRatio: 2, tierCap: 1, width: 1440, height: 900, boost: true };

describe('chooseDpr', () => {
  it('follows the tier cap on a desktop sized canvas', () => {
    expect(chooseDpr({ ...base, tierCap: 1 })).toBe(1);
    expect(chooseDpr({ ...base, tierCap: 1.5 })).toBe(1.5);
    expect(chooseDpr({ ...base, tierCap: 2 })).toBe(2);
  });

  it('never exceeds the device ratio', () => {
    expect(chooseDpr({ ...base, deviceRatio: 1, tierCap: 2 })).toBe(1);
    expect(chooseDpr({ ...base, deviceRatio: 1, width: 390, height: 844, tierCap: 1 })).toBe(1);
  });

  it('lets a phone sized canvas draw sharply at tier 1', () => {
    const d = chooseDpr({ ...base, deviceRatio: 3, width: 390, height: 844, tierCap: 1 });
    expect(d).toBe(BOOST_DPR_MAX);
    expect(390 * 844 * d * d).toBeLessThanOrEqual(BOOST_PIXELS * 1.0001);
  });

  it('keeps the pixel budget on a tablet', () => {
    const d = chooseDpr({ ...base, deviceRatio: 2, width: 820, height: 1180, tierCap: 1 });
    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(BOOST_DPR_MAX);
    expect(820 * 1180 * d * d).toBeLessThanOrEqual(BOOST_PIXELS * 1.0001);
  });

  it('ignores a boost that would barely change the ratio', () => {
    // A 1440x900 canvas could afford 1.04: not worth a resample over 1.
    expect(chooseDpr({ ...base, tierCap: 1 })).toBe(1);
  });

  it('drops back to the tier cap when the boost is withdrawn', () => {
    expect(chooseDpr({ ...base, deviceRatio: 3, width: 390, height: 844, tierCap: 1, boost: false })).toBe(1);
    expect(chooseDpr({ ...base, deviceRatio: 3, width: 390, height: 844, tierCap: 1.5, boost: false })).toBe(
      1.5,
    );
  });

  it('is robust to nonsense input', () => {
    expect(chooseDpr({ ...base, deviceRatio: Number.NaN, tierCap: 1 })).toBe(1);
    expect(chooseDpr({ ...base, width: 0, height: 0, tierCap: 1 })).toBe(1);
    expect(chooseDpr({ ...base, deviceRatio: 0.5, tierCap: 1 })).toBe(DPR_FLOOR);
  });
});
