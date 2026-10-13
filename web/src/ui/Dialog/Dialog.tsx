import type { ReactNode } from 'react';
import { ModalShell } from '../internal/ModalShell';
import type { PanelTone } from '../Panel/Panel';

export interface DialogProps {
  open: boolean;
  /** Called for Escape, the scrim and the close button. Update your state here. */
  onClose: () => void;
  /** The accessible name and the visible heading. */
  title: ReactNode;
  description?: ReactNode;
  /** sm 420 px, md 560 px (default), lg 760 px. */
  size?: 'sm' | 'md' | 'lg';
  /** Sticky footer: the actions. Put the primary action last. */
  footer?: ReactNode;
  /** Clicking the scrim closes. Default true; set false for destructive confirms. */
  dismissOnScrim?: boolean;
  hideClose?: boolean;
  /** `alertdialog` for a decision that needs a response. Default `dialog`. */
  role?: 'dialog' | 'alertdialog';
  /** Tints the edge for a status (a destructive confirm uses `crit`). */
  tone?: PanelTone;
  /** Called after the exit animation, when the dialog unmounts. */
  onExited?: () => void;
  className?: string;
  children: ReactNode;
}

const WIDTH = { sm: 420, md: 560, lg: 760 } as const;

/**
 * A modal dialog. Focus is trapped, the page behind is `inert` and scroll-locked, Escape
 * closes, and focus returns to what opened it. It starts at its title so a screen reader
 * reads the dialog top to bottom; put `data-autofocus` on the control that should take focus
 * first (the safe action in a destructive confirm).
 *
 *   <Dialog open={open} onClose={() => setOpen(false)} title="Reset progress?" role="alertdialog" tone="crit"
 *     footer={<><Button variant="ghost" onClick={cancel} data-autofocus>Keep it</Button><Button variant="danger">Reset</Button></>}>
 *     This erases XP and achievements on this device.
 *   </Dialog>
 */
export function Dialog({ size = 'md', ...props }: DialogProps) {
  return <ModalShell kind="dialog" width={WIDTH[size]} initialFocus="container" {...props} />;
}
