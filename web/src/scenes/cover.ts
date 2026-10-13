// An ambient scene is a full-screen overlay: while it runs, the page and the hero scene behind it cannot be
// seen. Hero scenes ask this module whether to keep drawing, so a screensaver left on overnight is one scene
// on the GPU, not two. It is plain module state because both scenes live in the same app and nothing here
// needs React. (The bus cannot carry it: `paused` is shared, and the ambient scene reads it too.)

let covers = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of [...listeners]) fn();
}

/** Called by an ambient scene while it is mounted. Returns the function that releases the cover. */
export function coverStage(): () => void {
  covers++;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    covers = Math.max(0, covers - 1);
    notify();
  };
}

/** True while at least one ambient scene is covering the page. */
export function stageCovered(): boolean {
  return covers > 0;
}

/** Subscribes to changes of `stageCovered()`. Returns the unsubscribe function. */
export function onCoverChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
