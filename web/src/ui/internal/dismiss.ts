/**
 * One Escape stack for everything that blocks or floats: modals, popovers, tooltips.
 *
 * Each open layer registers a dismiss callback when it opens and unregisters when it
 * closes. A single capture listener on the document hands Escape to the layer that opened
 * last, so a popover inside a dialog closes before the dialog, a tooltip closes before
 * either, and an unrelated popover left open behind a dialog never swallows the dialog's
 * Escape. Whatever handles the key stops it, so app-level Escape handlers do not also fire.
 */

interface Entry {
  dismiss: () => void;
}

const stack: Entry[] = [];
let installed = false;

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  e.stopPropagation();
  top.dismiss();
}

function install(): void {
  if (installed || typeof document === 'undefined') return;
  document.addEventListener('keydown', onKeyDown, true);
  installed = true;
}

function uninstall(): void {
  if (!installed || stack.length > 0) return;
  document.removeEventListener('keydown', onKeyDown, true);
  installed = false;
}

/**
 * Puts a layer on top of the Escape stack. Returns the function that removes it. Call it
 * from an effect that runs while the layer is open.
 */
export function registerDismissable(dismiss: () => void): () => void {
  const entry: Entry = { dismiss };
  stack.push(entry);
  install();
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    uninstall();
  };
}

/** How many layers are waiting for Escape. */
export function dismissableCount(): number {
  return stack.length;
}
