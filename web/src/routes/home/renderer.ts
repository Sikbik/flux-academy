/**
 * Which renderer the scene host is showing. The WebGL camera frames the bench inside the free area with a
 * lens shift; the 2D bench has no camera, so the page gives it the free area as its box (StageHost) and
 * offsets what it reports (HoverReadout).
 */

/** Why the host is on its 2D bench, as opposed to still loading or on WebGL. */
const FLAT_REASONS: ReadonlySet<string> = new Set(['forced-off', 'no-webgl', 'context-lost', 'too-slow']);

export function isFlatRenderer(webgl: boolean, reason: string): boolean {
  return !webgl && FLAT_REASONS.has(reason);
}
