import {
  Fragment,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useIsoLayoutEffect } from '../hooks/useIsoLayoutEffect';
import { cn } from '../internal/cn';
import styles from './Breadcrumbs.module.css';
import { collapsibleIndices, visibleIndices } from './collapse';

export interface BreadcrumbLinkProps {
  href: string;
  className: string;
  children: ReactNode;
  onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void;
  'data-force'?: 'hover' | 'press' | 'focus';
}

export interface BreadcrumbItem {
  label: ReactNode;
  /** Where it goes. The last item is the current page and is never a link. */
  href?: string;
  /** Called on a click, so a router can take over (call `e.preventDefault()` yourself). */
  onNavigate?: (e: ReactMouseEvent<HTMLAnchorElement>) => void;
  /** A pseudo-state hook for the kit gallery and visual tests. */
  force?: 'hover' | 'press' | 'focus';
}

export interface BreadcrumbsProps {
  items: readonly BreadcrumbItem[];
  /** `label` (default): mono, uppercase, tracked, the instrument voice. `text`: sentence case. */
  variant?: 'label' | 'text';
  /**
   * Fold the middle behind a "..." button once there are more than this many items (the first
   * item and the last stay). Without it, the middle folds only when the trail does not fit.
   */
  maxItems?: number;
  /** Render a link yourself (a router `Link`). It must forward `className` and `children`. */
  renderLink?: (props: BreadcrumbLinkProps) => ReactNode;
  /** Default "Breadcrumb". */
  'aria-label'?: string;
  className?: string;
}

/**
 * The trail to the page you are on. Hex bullets separate the levels, the last one is the
 * current page (`aria-current="page"`, not a link) and the middle folds behind a "..."
 * button when the trail does not fit (measured, so a short trail never folds early) or is
 * past `maxItems`.
 *
 *   <Breadcrumbs items={[{ label: 'Learn', href: '/learn' }, { label: 'Cumulus', href: '/learn#cumulus' }, { label: 'A cloud nobody owns' }]} />
 */
export function Breadcrumbs({
  items,
  variant = 'label',
  maxItems,
  renderLink,
  'aria-label': ariaLabel = 'Breadcrumb',
  className,
}: BreadcrumbsProps) {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  /** The index of the level to focus once the fold opens (set by the "..." button). */
  const focusAfterExpand = useRef<number | null>(null);
  const count = items.length;

  const cssFold = expanded ? [] : collapsibleIndices(count);
  const forced = !expanded && maxItems !== undefined && count > Math.max(3, maxItems);
  const forcedHidden = forced ? visibleIndices(count, maxItems, false).collapsible : [];
  const showMore = forced || cssFold.length > 0;
  const firstFolded = forced ? forcedHidden[0] : cssFold[0];

  // Fold the middle when the trail does not fit: it wraps, or the current page is clipped. Measured
  // with everything shown, in a layout effect, so a short trail never folds and nothing flickers.
  const foldable = !expanded && cssFold.length > 0;
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const list = listRef.current;
    if (!root || !list) return;
    if (!foldable) {
      delete root.dataset.fold;
      return;
    }
    const measure = () => {
      delete root.dataset.fold;
      const rows = Array.from(list.querySelectorAll<HTMLElement>(':scope > li[data-index]'));
      const top = rows[0]?.offsetTop ?? 0;
      const wrapped = rows.some((li) => li.offsetTop > top + 4);
      const page = list.querySelector<HTMLElement>('[aria-current="page"]');
      const clipped = page ? page.scrollWidth > page.clientWidth + 1 : false;
      if (wrapped || clipped) root.dataset.fold = 'true';
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    for (const child of Array.from(list.children)) ro.observe(child);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [foldable, count, variant]);

  useEffect(() => {
    if (!expanded || focusAfterExpand.current === null) return;
    const index = focusAfterExpand.current;
    focusAfterExpand.current = null;
    rootRef.current?.querySelector<HTMLElement>(`li[data-index="${index}"] a`)?.focus();
  }, [expanded]);

  return (
    <nav ref={rootRef} aria-label={ariaLabel} className={cn(styles.root, className)} data-variant={variant}>
      <ol ref={listRef} className={styles.list}>
        {items.map((item, i) => {
          if (forcedHidden.includes(i)) return null;
          const last = i === count - 1;
          const folds = cssFold.includes(i);
          const link = (() => {
            if (last || !item.href) return null;
            const props: BreadcrumbLinkProps = {
              href: item.href,
              className: styles.link ?? '',
              children: item.label,
              onClick: item.onNavigate,
              'data-force': item.force,
            };
            return renderLink ? (
              renderLink(props)
            ) : (
              <a
                href={props.href}
                className={props.className}
                onClick={props.onClick}
                data-force={props['data-force']}
              >
                {props.children}
              </a>
            );
          })();
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a trail is ordered and its levels have no id of their own
            <Fragment key={`${i}-${typeof item.label === 'string' ? item.label : ''}`}>
              <li
                className={styles.item}
                data-index={i}
                data-fold={folds ? 'true' : undefined}
                data-current={last ? 'true' : undefined}
              >
                {last ? (
                  <span className={styles.current} aria-current="page">
                    {item.label}
                  </span>
                ) : link ? (
                  link
                ) : (
                  <span className={styles.plain}>{item.label}</span>
                )}
              </li>
              {i === 0 && showMore ? (
                <li className={styles.more} data-forced={forced ? 'true' : undefined}>
                  <button
                    type="button"
                    className={styles.moreBtn}
                    aria-label="Show hidden levels"
                    aria-expanded="false"
                    onClick={() => {
                      focusAfterExpand.current = firstFolded ?? null;
                      setExpanded(true);
                    }}
                  >
                    <span className={styles.dots} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </button>
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
