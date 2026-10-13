/**
 * Which accordion items are open. The state is always a list of item values; `single` mode
 * keeps at most one entry. Pure so the rules (collapsible, single, multiple) are tested.
 */

export type AccordionType = 'single' | 'multiple';

/** The next open list after the user toggles `value`. */
export function toggleOpen(
  open: readonly string[],
  value: string,
  type: AccordionType,
  collapsible = true,
): string[] {
  const isOpen = open.includes(value);
  if (type === 'multiple') {
    return isOpen ? open.filter((v) => v !== value) : [...open, value];
  }
  if (isOpen) return collapsible ? [] : [value];
  return [value];
}

/** Normalises the public value (a string, null, or a list) to a list, honouring the type. */
export function normaliseOpen(
  value: string | readonly string[] | null | undefined,
  type: AccordionType,
): string[] {
  if (value == null) return [];
  const list = typeof value === 'string' ? [value] : [...value];
  return type === 'single' ? list.slice(0, 1) : list;
}
