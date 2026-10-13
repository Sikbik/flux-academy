import { type RefObject, useEffect, useRef } from 'react';
import { registerDismissable } from '../internal/dismiss';
import { focusInitial, trapTab } from '../internal/focus';
import { isTopModal, registerModal } from '../internal/modal';

export interface FocusTrapOptions {
  active: boolean;
  /** Called when Escape is pressed and this is the top-most layer (modal, popover, tooltip). */
  onEscape?: () => void;
  /** Return focus to the previously focused element on deactivate. Default true. */
  restoreFocus?: boolean;
  /** Where focus lands: the first tabbable (default) or the container itself. */
  initialFocus?: 'first' | 'container';
}

/**
 * Modal behaviour for a container: registers it in the modal stack (the page goes `inert`,
 * scroll locks), moves focus in, traps Tab, closes on Escape, and returns focus. Used by
 * Dialog and Drawer; exported for overlay modules that build their own surface.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  { active, onEscape, restoreFocus = true, initialFocus = 'first' }: FocusTrapOptions,
): void {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const previous = document.activeElement as HTMLElement | null;
    const unregister = registerModal(el);
    const unregisterEscape = registerDismissable(() => onEscapeRef.current?.());
    // Wait a frame: the surface may still be mounting its content.
    const raf = requestAnimationFrame(() => focusInitial(el, initialFocus));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !isTopModal(el)) return;
      // Floating cards (popovers) are portalled outside the modal but belong to it: they
      // keep their own Tab order.
      const target = e.target as Element | null;
      if (target?.closest?.('[data-floating]')) return;
      trapTab(el, e);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      unregisterEscape();
      unregister();
      if (restoreFocus && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [ref, active, restoreFocus, initialFocus]);
}
