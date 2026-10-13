/** True for absolute URLs that leave this site (http, https, protocol-relative). */
export function isExternalHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) && !isSameOrigin(href);
}

function isSameOrigin(href: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(href, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/** The rel for a link that opens another site. */
export const EXTERNAL_REL = 'noopener noreferrer';

/**
 * Schemes a markup link may use. Anything else (javascript:, data:, vbscript:) is dropped:
 * content is data, never script.
 */
export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed === '') return false;
  if (/^(?:\/(?!\/)|#|\.\.?\/|\?)/.test(trimmed)) return true; // relative to this site
  return /^(?:https?:\/\/|mailto:)/i.test(trimmed);
}
