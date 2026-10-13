/**
 * Small helpers the reference tests share. Not imported by any page.
 */

/** The provenance labels of a statement in the order the page prints them, as a plain array. */
export function sortedProvLabels(prov: readonly string[]): string[] {
  return [...new Set(prov)].sort();
}
