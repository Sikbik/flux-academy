/** Makes any string safe to embed in an id: letters, digits, underscore and hyphen. */
export function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * The element ids a tab and its panel share, from a base id and the tab's value. Use it to
 * wire custom layouts: `aria-controls={tabIds(base, v).panel}`.
 */
export function tabIds(idBase: string, value: string): { tab: string; panel: string } {
  const v = sanitizeId(value);
  return { tab: `${idBase}-tab-${v}`, panel: `${idBase}-panel-${v}` };
}
