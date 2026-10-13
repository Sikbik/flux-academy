import { createContext, useContext } from 'react';

/**
 * The shared "draw now" signal for annotation parts. A parent (`Annotated`, `Figure`, or a
 * diagram that moves between beats) provides `true` once the figure should draw itself; every
 * part inside uses it unless it was given its own `draw` prop. `undefined` means no provider:
 * parts then show in their drawn state.
 */
export const DrawContext = createContext<boolean | undefined>(undefined);

/**
 * The effective drawn state of a part: its own `draw` prop, else the nearest `DrawContext`,
 * else `true`. Toggling it from false to true plays the draw-in; true to false undraws.
 */
export function useDraw(own?: boolean): boolean {
  const ctx = useContext(DrawContext);
  return own ?? ctx ?? true;
}
