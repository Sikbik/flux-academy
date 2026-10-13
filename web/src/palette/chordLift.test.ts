import { describe, expect, it } from 'vitest';
import { CHORD_GAP, chordBottom, toastClearance } from './chordLift';

describe('toastClearance', () => {
  it('is how far the stack reaches up from the bottom of the viewport', () => {
    // A 52 px toast whose box ends 20 px above the bottom of an 800 px window.
    expect(toastClearance(728, 52, 800)).toBe(72);
  });

  it('is 0 when there is no stack', () => {
    expect(toastClearance(780, 0, 800)).toBe(0);
  });

  it('never goes negative or non-finite', () => {
    expect(toastClearance(900, 10, 800)).toBe(0);
    expect(toastClearance(Number.NaN, 10, 800)).toBe(0);
    expect(toastClearance(10, 10, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('chordBottom', () => {
  it('keeps the default position when no toast is showing', () => {
    expect(chordBottom(0)).toBeNull();
  });

  it('sits a gap above the toast stack', () => {
    expect(chordBottom(72)).toBe(72 + CHORD_GAP);
  });
});
