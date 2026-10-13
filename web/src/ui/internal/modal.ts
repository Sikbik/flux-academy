/**
 * Modal stack: marks everything behind the top-most modal `inert`, locks page scroll, and
 * lets the top modal be the only one that answers Escape.
 *
 * The page is `#root`. Modal surfaces are portalled into `#overlay-root` (see layers.ts),
 * outside `#root`, so making the page inert never takes them with it. Toasts and tooltips
 * live in their own layers and are never inert.
 */

interface Entry {
  el: HTMLElement;
}

const stack: Entry[] = [];

function setInert(el: Element | null, inert: boolean): void {
  if (!el) return;
  if (inert) el.setAttribute('inert', '');
  else el.removeAttribute('inert');
}

function sync(): void {
  const hasModal = stack.length > 0;
  setInert(document.getElementById('root'), hasModal);
  for (const [i, entry] of stack.entries()) setInert(entry.el, i < stack.length - 1);
  if (hasModal) document.documentElement.dataset.scrollLocked = 'true';
  else delete document.documentElement.dataset.scrollLocked;
}

/** Registers an open modal container. Returns the unregister function. */
export function registerModal(el: HTMLElement): () => void {
  const entry: Entry = { el };
  stack.push(entry);
  sync();
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    sync();
  };
}

export function isTopModal(el: HTMLElement): boolean {
  return stack.length > 0 && stack[stack.length - 1]?.el === el;
}

export function modalCount(): number {
  return stack.length;
}
