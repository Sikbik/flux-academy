/** Platform sniffing, kept to the few things the UI genuinely needs. */

export function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Label of the primary modifier key: the Command symbol on Apple platforms, `Ctrl` elsewhere. */
export function modKeyLabel(): string {
  return isMacLike() ? '⌘' : 'Ctrl';
}

/** True on connections where the visitor asked to save data, or the link is very slow. */
export function prefersSaveData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  return !!c && (c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g');
}

/** True when the primary pointer is coarse (a touch screen). */
export function isCoarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}
