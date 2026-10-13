import { Fragment, useMemo } from 'react';
import { useHotkey, useHotkeyScope, useHotkeyView } from '@/system/hotkeys';
import { useOverlays } from '@/system/overlays';
import { Dialog, Kbd } from '@/ui';
import styles from './Shortcuts.module.css';
import { buildShortcutGroups, type ShortcutRow } from './shortcuts';
import { useScrollRegion } from './useScrollRegion';

function Keys({ row }: { row: ShortcutRow }) {
  if (row.keys.length === 0) return <span className={styles.note}>{row.note}</span>;
  return (
    <>
      {row.keys.map((combo, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the alternatives of one shortcut are static
        <Fragment key={i}>
          {i > 0 ? <span className={styles.sep}>or</span> : null}
          <Kbd combo={combo} size="sm" />
        </Fragment>
      ))}
    </>
  );
}

/**
 * The shortcuts overlay (`?`): every binding in one place, generated from the live hotkey registry, so
 * it cannot drift from what the keys do and a page's own keys appear while the page is mounted.
 */
export default function ShortcutsSheet() {
  const open = useOverlays((s) => s.shortcuts);
  const defs = useHotkeyView((s) => s.defs);
  const groups = useMemo(() => buildShortcutGroups(defs), [defs]);
  // The dialog body scrolls on a short screen and holds nothing focusable: make the list a region.
  const region = useScrollRegion<HTMLDivElement>('Keyboard shortcuts', { scroller: 'parent' });

  // While it is open only its own scope answers, so `g h` does nothing behind the dialog.
  useHotkeyScope('shortcuts', { active: open, exclusive: true });
  useHotkey({
    id: 'shortcuts.close',
    keys: '?',
    label: 'Close the shortcuts',
    scope: 'shortcuts',
    hidden: true,
    run: () => {
      useOverlays.getState().closeShortcuts();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={() => useOverlays.getState().closeShortcuts()}
      title="Keyboard shortcuts"
      description="Everything in the Academy is reachable from the keyboard."
      size="lg"
    >
      <div ref={region.ref} {...region.props} className={styles.grid}>
        {groups.map((group) => {
          const id = `sc-${group.title.replace(/\s+/g, '-')}`;
          return (
            <section className={styles.group} key={group.title} aria-labelledby={id}>
              <h3 className={styles.groupTitle} id={id}>
                {group.title}
              </h3>
              <dl className={styles.list}>
                {group.rows.map((row) => (
                  <div className={styles.row} key={row.id}>
                    <dt className={styles.label}>{row.label}</dt>
                    <dd className={styles.keys}>
                      <Keys row={row} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
