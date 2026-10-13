/** Pure helpers for the Slider: snapping, positions and tick generation. */

import { clamp, decimalsOf } from '../internal/math';

/** Clamps to the range and snaps to `step` anchored at `min`, trimming float noise. */
export function snapValue(v: number, min: number, max: number, step: number): number {
  const c = clamp(v, min, max);
  if (!(step > 0)) return c;
  const n = Math.round((c - min) / step);
  const snapped = min + n * step;
  const decimals = Math.max(decimalsOf(step), decimalsOf(min));
  // The last step may not reach max exactly: never exceed it.
  return clamp(Number(snapped.toFixed(decimals)), min, max);
}

/** Where a value sits in the range, 0..1. A degenerate range is 0. */
export function pctOf(v: number, min: number, max: number): number {
  return max === min ? 0 : clamp((v - min) / (max - min), 0, 1);
}

/** The number of whole steps in the range. */
export function stepCount(min: number, max: number, step: number): number {
  return step > 0 ? Math.max(0, Math.round((max - min) / step)) : 0;
}

/**
 * The values that get a tick. Every step when there are at most `maxTicks` intervals,
 * otherwise a stride that divides the range into at most `maxTicks` evenly spaced intervals
 * (always including both ends).
 */
export function tickValues(min: number, max: number, step: number, maxTicks = 24): number[] {
  const steps = stepCount(min, max, step);
  if (steps === 0) return [min];
  let stride = 1;
  while (steps / stride > maxTicks) stride += 1;
  // Prefer a stride that lands on max exactly.
  while (steps % stride !== 0 && stride < steps) stride += 1;
  const out: number[] = [];
  for (let i = 0; i <= steps; i += stride) out.push(snapValue(min + i * step, min, max, step));
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

/** Every `every`th tick is a major tick (always the first and last). */
export function isMajorTick(index: number, count: number, every: number): boolean {
  return index === 0 || index === count - 1 || (every > 0 && index % every === 0);
}

/** Keyboard step for PageUp and PageDown: ten steps, never less than one. */
export function pageStep(min: number, max: number, step: number): number {
  return Math.max(step, Math.round(stepCount(min, max, step) / 10) * step);
}
