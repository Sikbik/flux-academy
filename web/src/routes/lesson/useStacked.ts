/**
 * Which layout the player is in.
 *
 * Stacked: the stage above the narrative (pinned under the header, collapsible), a bottom bar fixed to the
 * screen, the rail on two rows. It is a phone in portrait, a narrow window, or a tablet in portrait: any
 * viewport narrower than 900 px, with one exception. A phone on its side is short (844x390): stacked, the
 * pinned stage and the bar would leave the narrative no room at all, so a landscape viewport that is both
 * short (500 px or less) and wide enough for two columns (640 px or more) uses the side-by-side layout the
 * wide screens use, with slimmer chrome (see `useCompactStage`).
 *
 * `STACKED_QUERY` is the list of the three media queries that mean "stacked", and the `@media` blocks of this
 * route's CSS spell out the same list, so what React is told and what the CSS does never disagree. (The
 * design system's `useIsPhone` switches at 720px, which would leave tablets half stacked.)
 *
 *   narrower than 900 px, and portrait               (a phone, a tablet)
 *   narrower than 900 px, and taller than 500 px     (a narrow window, a tablet on its side)
 *   narrower than 640 px                             (too narrow for two columns, whatever its height)
 */

import { useMedia } from '@/ui';

export const STACKED_QUERY =
  '(max-width: 899.98px) and (orientation: portrait), (max-width: 899.98px) and (min-height: 500.02px), (max-width: 639.98px)';

/** A short landscape viewport, wide or not: a phone on its side. The chrome has to be slim there. */
export const SHORT_QUERY = '(orientation: landscape) and (max-height: 500px)';

/** True in the stacked layout (stage above the narrative, bar fixed to the screen). */
export function useStacked(): boolean {
  return useMedia(STACKED_QUERY);
}

/**
 * True when the stage is drawn in a short area: above the narrative in the stacked layout, or in the
 * side-by-side layout of a short landscape viewport. It is what the stages receive as `compact`.
 */
export function useCompactStage(): boolean {
  const stacked = useStacked();
  const short = useMedia(SHORT_QUERY);
  return stacked || short;
}
