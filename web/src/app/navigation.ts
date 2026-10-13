/**
 * Navigation from outside React: hotkeys, the command deck, toasts. The router registers itself here
 * when it is created, so modules that only need to "go somewhere" never import the router (and with it
 * every route chunk's registry). Same iris, same scroll behaviour as a `<Link>`.
 */

export interface NavigateOptions {
  replace?: boolean;
}

type Navigator = (to: string, options?: NavigateOptions) => void;

let impl: Navigator | null = null;

/** Called once by the router. */
export function setNavigator(fn: Navigator | null): void {
  impl = fn;
}

/**
 * Go to a path inside the app. External URLs open in a new tab. Before the router exists (tests, the
 * first paint) it falls back to a full page load, which is always correct if not pretty.
 */
export function appNavigate(to: string, options: NavigateOptions = {}): void {
  if (/^https?:\/\//i.test(to)) {
    window.open(to, '_blank', 'noopener,noreferrer');
    return;
  }
  if (impl) impl(to, options);
  else if (options.replace) window.location.replace(to);
  else window.location.assign(to);
}
