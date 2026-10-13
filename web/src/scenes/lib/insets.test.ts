import { describe, expect, it } from 'vitest';
import { MAX_INSET, remainingInsets } from './insets';

const VW = 1440;
const VH = 900;
const stage = { left: 0, top: 0, right: VW, bottom: VH };
const none = { left: 0, right: 0, top: 0, bottom: 0 };

describe('remainingInsets', () => {
  it('insets a full-stage host by the page insets', () => {
    const r = remainingInsets({ left: 0.4, right: 0.05, top: 0.1, bottom: 0.2 }, stage, VW, VH);
    expect(r).toEqual({ left: 576, right: 72, top: 90, bottom: 180 });
  });

  it('is a no-op when the host is already the free area', () => {
    const insets = { left: 0.4, right: 0.05, top: 0.1, bottom: 0.2 };
    const host = { left: 576, top: 90, right: VW - 72, bottom: VH - 180 };
    expect(remainingInsets(insets, host, VW, VH)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });

  it('only insets what is left to do when the host is partly inset', () => {
    // The host already starts 300 px in; the free area starts 576 px in.
    const host = { left: 300, top: 0, right: VW, bottom: VH };
    const r = remainingInsets({ ...none, left: 0.4 }, host, VW, VH);
    expect(r.left).toBe(276);
    expect(r.right).toBe(0);
  });

  it('does nothing for zero insets', () => {
    expect(remainingInsets(none, stage, VW, VH)).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });

  it('clamps an inset like the WebGL scene does', () => {
    const r = remainingInsets({ ...none, left: 5 }, stage, VW, VH);
    expect(r.left).toBe(Math.round(MAX_INSET * VW));
  });

  it('refuses to collapse an axis', () => {
    // 0.8 + 0.8 would leave nothing: the axis is ignored instead.
    const r = remainingInsets({ left: 0.8, right: 0.8, top: 0, bottom: 0 }, stage, VW, VH);
    expect(r.left).toBe(0);
    expect(r.right).toBe(0);
  });

  it('survives nonsense', () => {
    const r = remainingInsets({ left: Number.NaN, right: -1, top: Number.NaN, bottom: 0 }, stage, VW, VH);
    expect(r).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });
});
