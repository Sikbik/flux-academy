/**
 * Writes text to the clipboard. Prefers the async Clipboard API; falls back to a hidden,
 * read-only textarea and `execCommand('copy')` (insecure origins, older browsers, iframes
 * without permission). Resolves true only when something actually copied, so callers can be
 * honest about the result. Focus is restored afterwards.
 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or no secure context: use the fallback.
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement as HTMLElement | null;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText =
    'position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:1px;block-size:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(area);
  let ok = false;
  try {
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  if (active?.isConnected) active.focus({ preventScroll: true });
  return ok;
}
