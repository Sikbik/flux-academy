import { describe, expect, it } from 'vitest';
import { centerScrollLeft, overflowEdges, toScrollLeft } from './overflow';

describe('overflowEdges', () => {
  it('reports nothing when the content fits', () => {
    expect(overflowEdges(0, 400, 400)).toEqual({ left: false, right: false });
    expect(overflowEdges(0, 400, 400.5)).toEqual({ left: false, right: false });
  });

  it('reports the right edge at the start of a long list', () => {
    expect(overflowEdges(0, 300, 800)).toEqual({ left: false, right: true });
  });

  it('reports both edges in the middle and the left edge at the end', () => {
    expect(overflowEdges(200, 300, 800)).toEqual({ left: true, right: true });
    expect(overflowEdges(500, 300, 800)).toEqual({ left: true, right: false });
  });

  it('understands rtl scroll offsets', () => {
    // At rest in rtl the scroller shows the right end: more content to the left.
    expect(overflowEdges(0, 300, 800, true)).toEqual({ left: true, right: false });
    expect(overflowEdges(-500, 300, 800, true)).toEqual({ left: false, right: true });
    expect(overflowEdges(-250, 300, 800, true)).toEqual({ left: true, right: true });
  });
});

describe('centerScrollLeft', () => {
  it('centres an item and clamps to the range', () => {
    expect(centerScrollLeft(400, 100, 300, 1000)).toBe(300);
    expect(centerScrollLeft(10, 80, 300, 1000)).toBe(0);
    expect(centerScrollLeft(900, 100, 300, 1000)).toBe(700);
  });

  it('is zero when nothing scrolls', () => {
    expect(centerScrollLeft(50, 50, 300, 300)).toBe(0);
  });
});

describe('toScrollLeft', () => {
  it('is the identity in ltr and offsets in rtl', () => {
    expect(toScrollLeft(120, 300, 800, false)).toBe(120);
    expect(toScrollLeft(500, 300, 800, true)).toBe(0);
    expect(toScrollLeft(0, 300, 800, true)).toBe(-500);
  });
});
