/**
 * The real API responses, trimmed, that the API page shows. Copied from `docs/research/samples` into this
 * folder because `docs/` is not part of the container build context.
 *
 * Kept apart from `endpoints.data.ts` so that the search index (which the command deck imports) does not
 * pull the JSON in: only the API page and the tests import this module.
 */

const FILES = import.meta.glob('./samples/*.json', { eager: true, import: 'default' }) as Record<
  string,
  unknown
>;

function keyOf(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.json$/, '');
}

const BY_KEY: ReadonlyMap<string, unknown> = new Map(
  Object.entries(FILES).map(([path, value]) => [keyOf(path), value]),
);

/** Every sample key, for example `daemon_getblockcount`. */
export function sampleKeys(): string[] {
  return [...BY_KEY.keys()].sort();
}

/** The parsed sample, or undefined. */
export function sampleOf(key: string): unknown {
  return BY_KEY.get(key);
}

/** The sample as it is displayed: two space indentation. */
export function sampleText(key: string): string {
  const value = BY_KEY.get(key);
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}
