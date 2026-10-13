import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useOverlays } from '@/system/overlays';
import { Drawer, Glyph, useMedia } from '@/ui';
import { usePathChange } from '../usePathChange';
import { AccentSwitcher } from './AccentSwitcher';
import { BlockBeat } from './BlockBeat';
import styles from './MobileSheet.module.css';
import { NAV_ITEMS } from './PillNav';
import { SoundToggle } from './SoundToggle';

const ITEMS = [
  ...NAV_ITEMS,
  { to: '/troubleshoot', label: 'Troubleshoot' },
  { to: '/profile', label: 'Your progress' },
];

/**
 * The phone navigation: a bottom sheet opened from the hex menu button. It holds the nav, the block
 * beat, the accent switcher, the sound toggle and ambient mode (the controls that leave the header on a
 * narrow screen).
 *
 * It is the design system's `Drawer`, so the focus trap, the inert page, the scroll lock, Escape, focus
 * return and drag-to-dismiss behave exactly as in every other modal.
 */
export function MobileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  const desktop = useMedia('(min-width: 900px)');

  // A navigation closes the sheet (not the render it mounted with).
  usePathChange(pathname, () => {
    onClose();
    return undefined;
  });

  // The header's own nav takes over from 900 px: a sheet left open while the window grows closes.
  useEffect(() => {
    if (desktop && open) onClose();
  }, [desktop, open, onClose]);

  return (
    <Drawer open={open && !desktop} onClose={onClose} title="Menu" side="bottom" className={styles.drawer}>
      <nav aria-label="Primary" className={styles.links}>
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={styles.link}
            aria-current={pathname === item.to || pathname.startsWith(`${item.to}/`) ? 'page' : undefined}
          >
            <span>{item.label}</span>
            <Glyph name="arrow-right" size={16} />
          </Link>
        ))}
      </nav>
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>The chain</span>
          <BlockBeat onNavigate={onClose} />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Accent</span>
          <AccentSwitcher />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Sound</span>
          <SoundToggle />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Ambient mode</span>
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              onClose();
              useOverlays.getState().enterAmbient();
            }}
          >
            <Glyph name="ambient" size={16} />
            Start
          </button>
        </div>
      </div>
    </Drawer>
  );
}
