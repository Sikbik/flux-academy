import { useMemo } from 'react';
import { useToastStore } from '@/system/toasts';
import { ToastViewport, type ToastItem as ViewItem } from '@/ui';
import { Portal } from './Portal';
import styles from './ToastHost.module.css';

/**
 * Renders the toast store through the design system's `ToastViewport` in the toast layer. The viewport
 * is one polite live region, so each toast is announced once without moving focus; the host owns the
 * queue and the timers (`system/toasts`) and pauses a toast's timer while it is hovered or focused.
 * Leaving toasts are not passed down: the viewport plays its own exit transition for a removed one.
 */
export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  const hold = useToastStore((s) => s.hold);

  const toasts = useMemo<ViewItem[]>(
    () =>
      items
        .filter((t) => !t.leaving)
        .map((t) => ({
          id: String(t.id),
          kind: t.kind,
          children: t.message,
          duration: t.duration > 0 ? t.duration : undefined,
          action: t.action
            ? {
                label: t.action.label,
                onClick: () => {
                  t.action?.run();
                  dismiss(t.id);
                },
              }
            : undefined,
          onHoldChange: (held: boolean) => hold(t.id, held),
          // The viewport is the live region; an error keeps its own assertive role.
          role: t.kind === 'error' ? undefined : 'none',
        })),
    [items, dismiss, hold],
  );

  return (
    <Portal layer="toast">
      <ToastViewport className={styles.host} toasts={toasts} onDismiss={(id) => dismiss(Number(id))} />
    </Portal>
  );
}
