import type { ReactNode } from 'react';
import { useIsPhone } from '../hooks/useMedia';
import { ModalShell } from '../internal/ModalShell';

export interface DrawerProps {
  open: boolean;
  /** Called for Escape, the scrim and the close button. Update your state here. */
  onClose: () => void;
  /** The accessible name and the visible heading. */
  title: ReactNode;
  description?: ReactNode;
  /** `auto` (default): a right drawer from 720 px up, a bottom sheet below. */
  side?: 'auto' | 'right' | 'left' | 'bottom';
  /** Desktop width: md 480 px (default), lg 640 px. */
  width?: 'md' | 'lg';
  /** Actions beside the close button (copy link, open in a new tab). */
  actions?: ReactNode;
  /** Sticky footer (the primary action). */
  footer?: ReactNode;
  dismissOnScrim?: boolean;
  /** Called after the exit animation, when the drawer unmounts. */
  onExited?: () => void;
  className?: string;
  children: ReactNode;
}

const WIDTH = { md: 480, lg: 640 } as const;

/**
 * A modal side panel (a bottom sheet on phones, with a drag handle). Focus is trapped, the
 * page behind is `inert` and scroll-locked, Escape closes, focus returns to the trigger.
 * Controlled: render it with `open` driven by your state.
 *
 *   <Drawer open={outline} onClose={close} title="Outline">...</Drawer>
 *
 * Put `data-autofocus` on the element that should take focus first.
 */
export function Drawer({ side = 'auto', width = 'md', ...props }: DrawerProps) {
  const phone = useIsPhone();
  const resolved = side === 'auto' ? (phone ? 'bottom' : 'right') : side;
  return <ModalShell kind="drawer" side={resolved} width={WIDTH[width]} {...props} />;
}
