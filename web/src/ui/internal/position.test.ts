import { describe, expect, it } from 'vitest';
import { computePosition, parsePlacement } from './position';

const viewport = { width: 1000, height: 700 };
const floating = { width: 200, height: 80 };

describe('parsePlacement', () => {
  it('splits side and alignment', () => {
    expect(parsePlacement('top')).toEqual({ side: 'top', align: 'center' });
    expect(parsePlacement('bottom-start')).toEqual({ side: 'bottom', align: 'start' });
    expect(parsePlacement('left-end')).toEqual({ side: 'left', align: 'end' });
  });
});

describe('computePosition', () => {
  const anchor = { left: 400, top: 300, width: 100, height: 40 };

  it('centres above the anchor', () => {
    const r = computePosition({ anchor, floating, viewport, placement: 'top', offset: 10 });
    expect(r.side).toBe('top');
    expect(r.x).toBe(350);
    expect(r.y).toBe(300 - 80 - 10);
    expect(r.arrow).toBe(100);
  });

  it('flips below when there is no room above', () => {
    const near = { left: 400, top: 20, width: 100, height: 40 };
    const r = computePosition({ anchor: near, floating, viewport, placement: 'top' });
    expect(r.side).toBe('bottom');
    expect(r.y).toBe(20 + 40 + 10);
  });

  it('does not flip when flip is off', () => {
    const near = { left: 400, top: 20, width: 100, height: 40 };
    const r = computePosition({ anchor: near, floating, viewport, placement: 'top', flip: false });
    expect(r.side).toBe('top');
    expect(r.y).toBeGreaterThanOrEqual(8);
  });

  it('clamps inside the viewport and keeps the arrow on the anchor', () => {
    const edge = { left: 960, top: 300, width: 30, height: 30 };
    const r = computePosition({ anchor: edge, floating, viewport, placement: 'top' });
    expect(r.x).toBe(1000 - 200 - 8);
    expect(r.arrow).toBe(975 - r.x);
  });

  it('reports an anchor wholly outside the viewport as hidden', () => {
    const below = { left: 400, top: 900, width: 100, height: 40 };
    const above = { left: 400, top: -80, width: 100, height: 40 };
    const beside = { left: 1040, top: 300, width: 100, height: 40 };
    expect(computePosition({ anchor: below, floating, viewport }).hidden).toBe(true);
    expect(computePosition({ anchor: above, floating, viewport }).hidden).toBe(true);
    expect(computePosition({ anchor: beside, floating, viewport }).hidden).toBe(true);
    expect(computePosition({ anchor, floating, viewport }).hidden).toBe(false);
    // Half in view still points at something.
    const half = { left: 400, top: -20, width: 100, height: 40 };
    expect(computePosition({ anchor: half, floating, viewport }).hidden).toBe(false);
  });

  it('aligns to the start edge', () => {
    const r = computePosition({ anchor, floating, viewport, placement: 'bottom-start' });
    expect(r.x).toBe(400);
    expect(r.align).toBe('start');
  });

  it('places left and right of the anchor', () => {
    const l = computePosition({ anchor, floating, viewport, placement: 'left', offset: 12 });
    expect(l.side).toBe('left');
    expect(l.x).toBe(400 - 200 - 12);
    const r = computePosition({ anchor, floating, viewport, placement: 'right', offset: 12 });
    expect(r.x).toBe(500 + 12);
  });
});
