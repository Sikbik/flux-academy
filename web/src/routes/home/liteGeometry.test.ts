import { describe, expect, it } from 'vitest';
import {
  arcPath,
  CELL,
  fieldCells,
  hostSlots,
  LITE_H,
  LITE_W,
  PILLAR_HEIGHT,
  prism,
  SLOT_ORDER,
  SLOTS,
  slotPoint,
} from './liteGeometry';

describe('lite bench geometry', () => {
  it('has twelve distinct slots, all inside the drawing', () => {
    expect(new Set(SLOT_ORDER).size).toBe(SLOTS);
    for (let i = 0; i < SLOTS; i++) {
      const p = slotPoint(i);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(LITE_W);
      expect(p.y).toBeGreaterThan(CELL.y);
      expect(p.y).toBeLessThan(LITE_H);
    }
  });

  it('never moves a copy when another is added', () => {
    for (let n = 1; n < SLOTS; n++) {
      expect(hostSlots(n + 1).slice(0, n)).toEqual(hostSlots(n));
    }
    expect(hostSlots(0)).toEqual([]);
    expect(hostSlots(99)).toHaveLength(SLOTS);
  });

  it('keeps the first three copies far apart', () => {
    const xs = hostSlots(3).map((s) => slotPoint(s).x);
    const sorted = [...xs].sort((a, b) => a - b);
    expect((sorted[1] ?? 0) - (sorted[0] ?? 0)).toBeGreaterThan(120);
    expect((sorted[2] ?? 0) - (sorted[1] ?? 0)).toBeGreaterThan(120);
  });

  it('draws tiers at three heights, tall for Stratus', () => {
    expect(PILLAR_HEIGHT.cumulus).toBeLessThan(PILLAR_HEIGHT.nimbus);
    expect(PILLAR_HEIGHT.nimbus).toBeLessThan(PILLAR_HEIGHT.stratus);
    const p = prism({ x: 100, y: 200 }, 15, 40);
    expect(p.top.split(' ')).toHaveLength(6);
    expect(p.left.split(' ')).toHaveLength(6);
  });

  it('makes arcs that start at the cell and end on the pillar', () => {
    const to = slotPoint(4);
    const d = arcPath(to);
    expect(d.startsWith(`M${CELL.x} `)).toBe(true);
    expect(d.endsWith(`${to.x.toFixed(1).replace(/\.0$/, '')} ${to.y.toFixed(1).replace(/\.0$/, '')}`)).toBe(
      true,
    );
  });

  it('lays a field of cells', () => {
    expect(fieldCells().length).toBeGreaterThan(40);
  });
});
