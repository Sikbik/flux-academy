/**
 * Status tones for the gauge and the meter. `auto` reads thresholds: ok below `warn`, warn
 * from `warn`, crit from `crit` (or the other way round when low is bad, like free space).
 * Pure; the words are what assistive tech and the lg gauge say, because colour alone never
 * carries status.
 */

export type ToneName = 'accent' | 'ok' | 'warn' | 'crit';
export type ToneProp = ToneName | 'auto';

export interface Thresholds {
  /** In the same units as the value. */
  warn?: number;
  crit?: number;
}

export interface ToneInput {
  value: number;
  min: number;
  max: number;
  tone?: ToneProp;
  thresholds?: Thresholds;
  /** Low values are the bad ones (free space, uptime): thresholds trip at or below. */
  lowIsBad?: boolean;
}

/** The thresholds in use: the given ones, or 70 percent and 90 percent of the range. */
export function effectiveThresholds(
  min: number,
  max: number,
  thresholds?: Thresholds,
  lowIsBad = false,
): Required<Thresholds> {
  const span = max - min;
  const defWarn = lowIsBad ? min + span * 0.3 : min + span * 0.7;
  const defCrit = lowIsBad ? min + span * 0.1 : min + span * 0.9;
  return { warn: thresholds?.warn ?? defWarn, crit: thresholds?.crit ?? defCrit };
}

/** The tone for a value. A fixed tone is returned as is; `auto` follows the thresholds. */
export function resolveTone({
  value,
  min,
  max,
  tone = 'accent',
  thresholds,
  lowIsBad = false,
}: ToneInput): ToneName {
  if (tone !== 'auto') return tone;
  const t = effectiveThresholds(min, max, thresholds, lowIsBad);
  if (lowIsBad) {
    if (value <= t.crit) return 'crit';
    if (value <= t.warn) return 'warn';
    return 'ok';
  }
  if (value >= t.crit) return 'crit';
  if (value >= t.warn) return 'warn';
  return 'ok';
}

/**
 * The word that goes with a tone. Empty for the neutral accent. When low is bad the warning
 * says `Low` (free space), otherwise `High` (CPU).
 */
export function toneWord(tone: ToneName, lowIsBad = false): string {
  if (tone === 'ok') return 'Normal';
  if (tone === 'warn') return lowIsBad ? 'Low' : 'High';
  if (tone === 'crit') return 'Critical';
  return '';
}

/**
 * The tone of each of `count` equal cells of a meter, left to right, when tone is `auto`. A
 * cell is judged by the edge that faces the danger (its upper edge, or its lower edge when
 * low is bad), so the zone colours read as bands of the scale.
 */
export function cellTones(
  count: number,
  { min, max, tone = 'accent', thresholds, lowIsBad = false }: Omit<ToneInput, 'value'>,
): ToneName[] {
  const out: ToneName[] = [];
  const n = Math.max(0, Math.floor(count));
  for (let i = 0; i < n; i++) {
    const lower = min + ((max - min) * i) / n;
    const upper = min + ((max - min) * (i + 1)) / n;
    out.push(resolveTone({ value: lowIsBad ? lower : upper, min, max, tone, thresholds, lowIsBad }));
  }
  return out;
}
