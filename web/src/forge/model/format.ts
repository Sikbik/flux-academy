/**
 * Number formatting for the forge. Money is always two decimals, always tabular, never "0" for "unknown".
 * (The app-wide `lib/format.ts` prints sub-dollar amounts with four decimals, which suits a FLUX price but
 * not a monthly bill that always ends in .49 or .99.)
 */

const INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const DEC2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const DASH = '--';

function finite(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/** 12.5 -> "12.50". No currency sign: callers add `$` or `USD`. */
export function money(n: number | null | undefined): string {
  return finite(n) ? DEC2.format(n) : DASH;
}

/** 12.5 -> "$12.50", -0.5 -> "-$0.50". */
export function usd(n: number | null | undefined): string {
  if (!finite(n)) return DASH;
  return `${n < 0 ? '-' : ''}$${DEC2.format(Math.abs(n))}`;
}

/** A signed delta for a waterfall: "+$1.50", "-$0.30", "$0.00". */
export function usdSigned(n: number): string {
  if (!finite(n) || Math.abs(n) < 0.005) return '$0.00';
  return `${n < 0 ? '-' : '+'}$${DEC2.format(Math.abs(n))}`;
}

export function int(n: number | null | undefined): string {
  return finite(n) ? INT.format(Math.round(n)) : DASH;
}

/** FLUX amounts: two decimals with grouping. */
export function flux(n: number | null | undefined): string {
  return finite(n) ? DEC2.format(n) : DASH;
}

/** Cores: "0.5", "2", "12.5". */
export function cores(n: number): string {
  if (!finite(n)) return DASH;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** MB as the FluxCloud form shows it: under 1000 MB in MB, otherwise GB with at most one decimal. */
export function memory(mb: number): string {
  if (!finite(mb)) return DASH;
  if (mb < 1000) return `${INT.format(mb)} MB`;
  const gb = mb / 1000;
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`;
}

export function disk(gb: number): string {
  return finite(gb) ? `${INT.format(gb)} GB` : DASH;
}

/** 2.5 -> "2.5 months", 1 -> "1 month", 0.23 -> "7 days". */
export function monthsLabel(months: number): string {
  if (!finite(months)) return DASH;
  if (months < 0.95) {
    const days = Math.max(1, Math.round(months * 30.6));
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  const m = Number.isInteger(months) ? months : Number(months.toFixed(1));
  return `${m} ${m === 1 ? 'month' : 'months'}`;
}

/** "1 instance", "3 instances". */
export function instances(n: number): string {
  return `${INT.format(n)} ${n === 1 ? 'instance' : 'instances'}`;
}
