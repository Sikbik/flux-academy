/**
 * Which key presses the lesson player may take. The player listens for Right and Enter (continue),
 * Left (back) and `g o` (outline), but a key that a focused control already uses must stay with that
 * control: arrows move a slider, a radio group, the step rail and the editors on the stage, and Enter
 * presses a button. Pure over a DOM element, so it is tested without a browser.
 */

/** Controls that use the arrow keys themselves, and the whole stage (editors and the terminal live there). */
export const ARROW_OWNERS =
  'input, textarea, select, [contenteditable="true"], [role="slider"], [role="tab"], [role="tablist"], ' +
  '[role="radiogroup"], [role="radio"], [role="listbox"], [role="option"], [role="menu"], ' +
  '[role="menuitem"], [role="grid"], [role="tree"], [role="application"], [data-seg], [data-lesson-stage]';

/** Everything above, plus the controls that Enter activates. */
export const ENTER_OWNERS = `${ARROW_OWNERS}, button, a[href], summary, [role="button"], [role="link"]`;

/** True when the event may drive the player. `target` is where the key was pressed. */
export function playerMayHandle(
  key: string,
  target: EventTarget | null,
  doc: Pick<Document, 'documentElement' | 'body'> = document,
): boolean {
  // A modal (the outline drawer, a dialog) is open: the page behind it is inert.
  if (doc.documentElement.dataset.scrollLocked === 'true') return false;
  if (!(target instanceof Element)) return true;
  if (target === doc.body || target === doc.documentElement) return true;
  const owners = key === 'Enter' ? ENTER_OWNERS : ARROW_OWNERS;
  return target.closest(owners) === null;
}
