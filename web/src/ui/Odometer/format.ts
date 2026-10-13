/**
 * Number formatting and digit-strip maths shared by Odometer and CountUp. Pure: no DOM, so it
 * is unit tested in node. Output is fixed to en-US so every visitor sees the same string.
 */

/** The true minus sign (U+2212): it has the width of a digit's neighbours and no hyphen look. */
export const MINUS = '−';

export interface NumberFormat {
  /** Fixed decimals. Default 0. */
  decimals?: number;
  /** Thousands separators. Default true. */
  grouping?: boolean;
  /** Pad the integer part with zeros to at least this many digits (clocks use 2). Default 1. */
  minDigits?: number;
}

/** What is shown for a value that is not a finite number. Never a fake zero. */
export const PLACEHOLDER = '--';

/** Formats a number for display. NaN and infinities come back as `--`. */
export function formatNumber(
  value: number,
  { decimals = 0, grouping = true, minDigits = 1 }: NumberFormat = {},
): string {
  if (!Number.isFinite(value)) return PLACEHOLDER;
  const d = Math.min(12, Math.max(0, Math.floor(decimals)));
  const abs = Math.abs(value);
  const text = abs.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
    useGrouping: grouping,
    minimumIntegerDigits: Math.min(21, Math.max(1, Math.floor(minDigits))),
  });
  // A value that rounds to zero is zero, never "-0".
  const zero = Number(abs.toFixed(d)) === 0;
  return value < 0 && !zero ? `${MINUS}${text}` : text;
}

export interface Cell {
  /** The character. */
  ch: string;
  /** 0..9 for a digit, null for a separator or sign. */
  digit: number | null;
  /** Position counted from the right end of the number, so cells keep their identity when the number grows. */
  fromRight: number;
}

/** Splits a formatted number into cells: digits roll, everything else sits still. */
export function toCells(text: string): Cell[] {
  const chars = Array.from(text);
  const last = chars.length - 1;
  return chars.map((ch, i) => ({
    ch,
    digit: ch >= '0' && ch <= '9' ? ch.charCodeAt(0) - 48 : null,
    fromRight: last - i,
  }));
}

/** +1 when the number went up (digits roll up), -1 when it went down. */
export function rollDirection(prev: number, next: number): 1 | -1 {
  return next >= prev ? 1 : -1;
}

/** Rows in a digit strip: three repeats of 0..9, so a roll can wrap in either direction. */
export const STRIP_ROWS = 30;
/** The first row of the middle repeat: where a digit rests. */
export const STRIP_REST = 10;

/** The resting row of a digit. */
export function restRow(digit: number): number {
  return STRIP_REST + digit;
}

/**
 * Which row of the strip to roll to so the digit passes through its neighbours in the
 * direction of travel. `current` is the row the strip is on now (fractional if a roll is
 * interrupted mid-flight). Up picks the nearest matching row at or below the current one
 * on screen (a higher row index), down the nearest at or above.
 */
export function targetRow(current: number, digit: number, dir: 1 | -1): number {
  let best = restRow(digit);
  let found = false;
  for (let k = 0; k < 3; k++) {
    const row = digit + 10 * k;
    if (dir > 0) {
      if (row >= current - 1e-6 && (!found || row < best)) {
        best = row;
        found = true;
      }
    } else if (row <= current + 1e-6 && (!found || row > best)) {
      best = row;
      found = true;
    }
  }
  return best;
}
