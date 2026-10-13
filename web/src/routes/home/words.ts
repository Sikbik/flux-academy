/**
 * Small, pure helpers that turn a count or a list into the words the home page prints. Counts come from the
 * curriculum (`LABS.length`, `LESSONS.length`, `EXAMPLES.length`); these only spell them, so a lab or a
 * lesson added later changes the copy by itself instead of leaving "five" behind.
 */

const NUMBER_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
] as const;

/** "six" for 6, "twenty" for 20. Anything the table does not hold (negative, fractional, large) stays digits. */
export function numberWord(n: number): string {
  if (!Number.isInteger(n) || n < 0) return String(n);
  return NUMBER_WORDS[n] ?? String(n);
}

/** "Six" for "six": for the start of a heading or a sentence. */
export function capitalise(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** `a`, `a and b`, `a, b and c`: the house list style, with no comma before the "and". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
