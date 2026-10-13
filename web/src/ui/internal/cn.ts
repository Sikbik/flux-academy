export type ClassValue = string | false | null | undefined | 0;

/** Joins class names, skipping falsy values. */
export function cn(...values: ClassValue[]): string {
  let out = '';
  for (const v of values) {
    if (v) out = out ? `${out} ${v}` : v;
  }
  return out;
}
