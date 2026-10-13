/**
 * Reduced motion, as one external store. The effective value is the visitor's explicit
 * choice when the shell mirrors it to `html[data-motion="reduced|full"]`, otherwise the OS
 * `prefers-reduced-motion`. CSS reads the same two inputs through the tokens, so JS and CSS
 * never disagree.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

export function readReducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  const mode = document.documentElement.dataset.motion;
  if (mode === 'reduced') return true;
  if (mode === 'full') return false;
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

export function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia ? window.matchMedia(QUERY) : null;
  mq?.addEventListener('change', onChange);
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  return () => {
    mq?.removeEventListener('change', onChange);
    mo.disconnect();
  };
}
