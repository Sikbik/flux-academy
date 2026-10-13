import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import styles from './Header.module.css';

export interface NavItem {
  to: string;
  label: string;
}

/** The primary navigation. The order is the page order in docs/DESIGN.md section 5. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/learn', label: 'Learn' },
  { to: '/labs', label: 'Labs' },
  { to: '/reference', label: 'Reference' },
  { to: '/glossary', label: 'Glossary' },
];

/** The nav item a pathname belongs to, or -1 (the home page, the profile and so on). */
export function activeIndex(pathname: string, items: readonly NavItem[] = NAV_ITEMS): number {
  return items.findIndex((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
}

/** A pill nav with an indicator that slides to the active link. */
export function PillNav() {
  const { pathname } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const index = activeIndex(pathname);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      if (index < 0) return setBox(null);
      const link = el.querySelectorAll<HTMLElement>('a')[index];
      if (!link) return setBox(null);
      setBox({ x: link.offsetLeft, w: link.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The web font changes text widths after first paint.
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [index]);

  return (
    <nav className={styles.nav} aria-label="Primary">
      <div
        ref={root}
        className={styles.navInner}
        style={{ '--ix': `${box?.x ?? 0}px`, '--iw': `${box?.w ?? 0}px` } as React.CSSProperties}
      >
        <span className={styles.indicator} data-on={box ? 'true' : 'false'} aria-hidden="true" />
        {NAV_ITEMS.map((item, i) => (
          <Link
            key={item.to}
            to={item.to}
            className={styles.navLink}
            aria-current={i === index ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
