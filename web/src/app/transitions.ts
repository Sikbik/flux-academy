/**
 * Route transitions: records where the visitor pressed, and decides per navigation whether the hex
 * iris plays. Everything DOM-facing lives here so `router.tsx` stays a route table.
 */

import { effectiveReducedMotion } from '@/system/motion';
import { type Activation, activationFor, FADE_MS, IRIS_MS, irisShape, pickOrigin } from './iris';

let lastActivation: Activation | null = null;
let listening = false;

const PRESSABLE = 'a[href], button, [role="link"], [role="button"], [role="tab"], [role="menuitem"]';

function record(e: Event, pointer: { x: number; y: number } | null): void {
  const target = e.target as Element | null;
  const el = target && typeof target.closest === 'function' ? target.closest(PRESSABLE) : null;
  const rect = el ? el.getBoundingClientRect() : null;
  const a = activationFor(rect, pointer, Date.now());
  if (a) lastActivation = a;
}

/** Starts listening for activations (capture phase, passive). Idempotent. Returns a stop function. */
export function trackActivations(): () => void {
  if (listening || typeof document === 'undefined') return () => {};
  listening = true;
  const onPointer = (e: PointerEvent) => record(e, { x: e.clientX, y: e.clientY });
  const onClick = (e: MouseEvent) => {
    // A keyboard "click" has detail 0 and no meaningful coordinates.
    record(e, e.detail > 0 ? { x: e.clientX, y: e.clientY } : null);
  };
  const opts = { capture: true, passive: true } as const;
  document.addEventListener('pointerdown', onPointer, opts);
  document.addEventListener('click', onClick, opts);
  return () => {
    document.removeEventListener('pointerdown', onPointer, opts);
    document.removeEventListener('click', onClick, opts);
    listening = false;
  };
}

/** True when the browser can run the hex iris. */
export function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
}

let clearTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Sets the polygons and the scope attribute for the transition about to start. Call it right before
 * `router.navigate(..., { viewTransition: true })`.
 */
export function prepareIris(): void {
  const root = document.documentElement;
  const vp = { width: window.innerWidth, height: window.innerHeight };
  const origin = pickOrigin(lastActivation, vp, Date.now());
  const shape = irisShape(origin, vp);
  root.style.setProperty('--iris-from', shape.from);
  root.style.setProperty('--iris-to', shape.to);
  root.dataset.nav = 'iris';
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    delete root.dataset.nav;
    root.style.removeProperty('--iris-from');
    root.style.removeProperty('--iris-to');
    clearTimer = null;
  }, IRIS_MS + 400);
}

export interface NavTarget {
  pathname: string;
}

/** Whether a navigation to `to` from the current page should play the iris. Pure given the inputs. */
export function wantsIris(args: {
  to: unknown;
  explicit: boolean | undefined;
  currentPathname: string;
  destinationPathname: string | null;
  reducedMotion: boolean;
  supported: boolean;
}): boolean {
  if (!args.supported || args.reducedMotion) return false;
  if (args.explicit === false) return false;
  if (typeof args.to === 'number') return false;
  if (args.destinationPathname === null) return false;
  return args.destinationPathname !== args.currentPathname;
}

/** The pathname a `to` argument resolves to, or null when it cannot be told. */
export function destinationPathname(to: unknown, base: string): string | null {
  try {
    if (typeof to === 'string') return new URL(to, base).pathname;
    if (typeof to === 'object' && to !== null) {
      const t = to as { pathname?: string };
      return t.pathname === undefined ? new URL(base).pathname : new URL(t.pathname, base).pathname;
    }
  } catch {
    return null;
  }
  return null;
}

export function shouldIris(to: unknown, explicit: boolean | undefined): boolean {
  return wantsIris({
    to,
    explicit,
    currentPathname: window.location.pathname,
    destinationPathname: destinationPathname(to, window.location.href),
    reducedMotion: effectiveReducedMotion(),
    supported: supportsViewTransitions(),
  });
}

export { FADE_MS, IRIS_MS };
