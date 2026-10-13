/**
 * A slider over a list of sensible stops instead of a straight number line.
 *
 * Resources span two orders of magnitude (0.1 to 15 cores, 100 to 59,000 MB) and most apps live at the
 * small end, so the design system's linear Slider is driven in *index space*: the thumb moves one stop at a
 * time, the stops are dense where apps live and sparse above. A value that is not a stop (typed in the JSON,
 * or from a lesson) is shown at the nearest stop and keeps its exact value until the learner moves the
 * thumb. The exact value is always available in the number field beside it.
 */

import { useMemo } from 'react';
import { Slider, type SliderMark } from '@/ui';

/** Stops for each resource. Every value is valid for the network (steps of 0.1 core, 100 MB, 1 GB). */
export const GRIDS = {
  /** 0.1 to 15 cores. */
  cpu: [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.5, 3,
    3.5, 4, 4.5, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  ],
  /** 100 to 59,000 MB. */
  ram: [
    100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 6000,
    7000, 8000, 9000, 10000, 12000, 14000, 16000, 20000, 24000, 28000, 32000, 40000, 48000, 59000,
  ],
  /** 1 to 820 GB. */
  hdd: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180,
    200, 250, 300, 400, 500, 600, 700, 820,
  ],
  /** 1 to 100 instances. */
  instances: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100],
} as const;

function nearestIndex(stops: readonly number[], value: number): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < stops.length; i++) {
    const d = Math.abs((stops[i] as number) - value);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

export interface GridSliderProps {
  /** The accessible name. */
  label: string;
  value: number;
  stops: readonly number[];
  onChange: (value: number) => void;
  /** Stops above this are not offered (the room left under an app-wide cap). */
  max?: number;
  min?: number;
  disabled?: boolean;
  /** Formats a stop for the spoken value and the end labels. */
  format?: (value: number) => string;
  /** Label the two ends. Default true. */
  marks?: boolean;
  id?: string;
  /** Recolour the rail (tier colour only for tiers). */
  tier?: 'cumulus' | 'nimbus' | 'stratus';
  className?: string;
}

export function GridSlider({
  label,
  value,
  stops,
  onChange,
  max = Number.POSITIVE_INFINITY,
  min = Number.NEGATIVE_INFINITY,
  disabled,
  format = String,
  marks = true,
  id,
  tier,
  className,
}: GridSliderProps) {
  const usable = useMemo(() => stops.filter((s) => s >= min && s <= max), [stops, min, max]);
  const last = Math.max(0, usable.length - 1);
  const index = usable.length > 0 ? nearestIndex(usable, value) : 0;

  const markList = useMemo<SliderMark[] | false>(() => {
    if (!marks || usable.length < 2) return false;
    return [
      { value: 0, label: format(usable[0] as number) },
      { value: last, label: format(usable[last] as number) },
    ];
  }, [marks, usable, last, format]);

  return (
    <Slider
      id={id}
      className={className}
      label={label}
      hideLabel
      readout="none"
      min={0}
      max={Math.max(1, last)}
      step={1}
      value={index}
      disabled={disabled || usable.length < 2}
      ticks={usable.length <= 24}
      marks={markList}
      tier={tier}
      format={(i) => format(usable[Math.min(last, Math.max(0, Math.round(i)))] as number)}
      onValueChange={(i) => {
        const next = usable[Math.min(last, Math.max(0, Math.round(i)))];
        if (next !== undefined && next !== value) onChange(next);
      }}
    />
  );
}
