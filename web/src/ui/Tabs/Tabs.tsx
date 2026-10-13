import {
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Glyph } from '../Glyph/Glyph';
import type { GlyphName } from '../Glyph/glyphs';
import { useControllableState } from '../hooks/useControllableState';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { cn } from '../internal/cn';
import { tabIds } from './ids';
import { centerScrollLeft, type OverflowEdges, overflowEdges, toScrollLeft } from './overflow';
import { firstEnabled, rovingTarget } from './roving';
import styles from './Tabs.module.css';

export interface TabItem {
  value: string;
  label: ReactNode;
  /** A glyph before the label. */
  icon?: GlyphName;
  /** A count after the label, in tabular numerals. */
  count?: number | string;
  disabled?: boolean;
  /**
   * Renders the tab as a link (route-backed tabs). With `onValueChange` set, a plain click is
   * handed to you (call your router); modified and middle clicks still open normally.
   */
  href?: string;
  /** A pseudo-state hook for the kit gallery and visual tests. */
  force?: 'hover' | 'press' | 'focus';
}

export interface TabsProps {
  items: readonly TabItem[];
  /** The selected tab (controlled). */
  value?: string;
  /** The initially selected tab (uncontrolled). Defaults to the first enabled tab. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** The base of the element ids: tab `${idBase}-tab-${value}`, panel `${idBase}-panel-${value}`. */
  idBase: string;
  /** Names the tab list for assistive tech. Required. */
  'aria-label': string;
  /**
   * `auto` (default): arrow keys select as they move focus. `manual`: arrows move focus and
   * Enter or Space selects (use when selecting is expensive).
   */
  activation?: 'auto' | 'manual';
  /** `line` (default): a drawn underline with a hex head. `plate`: chamfered plates. */
  variant?: 'line' | 'plate';
  size?: 'sm' | 'md';
  /** Stretch the tabs to share the row equally. */
  fullWidth?: boolean;
  className?: string;
  /** Optional: render the `TabPanel`s here and they pick up the selected value and `idBase`. */
  children?: ReactNode;
}

interface TabsContextValue {
  idBase: string;
  value: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

/**
 * The compaction levels of a row that would otherwise scroll (`data-fit` on the root, styled in the CSS):
 * 0 is the natural size, 1 tightens the padding and the gap, 2 also steps the type down, 3 also drops the
 * icons of tabs that have a label. Past the last level the row scrolls, which is the last resort.
 */
const FIT_LEVELS = 4;

export interface TabPanelProps {
  /** The value of the tab this panel belongs to. */
  value: string;
  /** Defaults to the parent `Tabs` idBase. Required when used without a parent. */
  idBase?: string;
  /** Whether this panel is the selected one. Defaults to the parent `Tabs` selection. */
  active?: boolean;
  /** Keep an inactive panel mounted (hidden). Default false: it is not rendered. */
  keepMounted?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * The content of one tab. Inactive panels are not rendered (or hidden with `keepMounted`).
 * The panel is focusable so a keyboard user can reach content that has no controls.
 */
export function TabPanel({ value, idBase, active, keepMounted = false, className, children }: TabPanelProps) {
  const ctx = useContext(TabsContext);
  const base = idBase ?? ctx?.idBase ?? 'tabs';
  const isActive = active ?? (ctx ? ctx.value === value : false);
  if (!isActive && !keepMounted) return null;
  const ids = tabIds(base, value);
  return (
    <div
      role="tabpanel"
      id={ids.panel}
      aria-labelledby={ids.tab}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the panel is the tab's content region; focusable by APG
      tabIndex={0}
      hidden={isActive ? undefined : true}
      className={cn(styles.panel, className)}
      data-active={isActive ? 'true' : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Tabs: an ARIA tablist with a roving tab stop, arrow/Home/End keys, an indicator that is
 * drawn (a hairline with a hex head and a lit ruler) and slides with transform only, and a
 * scrollable overflow with edge fades that keeps the selected tab in view.
 *
 *   <Tabs idBase="forge" aria-label="Spec view" items={items} value={view} onValueChange={setView}>
 *     <TabPanel value="form">...</TabPanel>
 *     <TabPanel value="json">...</TabPanel>
 *   </Tabs>
 */
export function Tabs({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  idBase,
  'aria-label': ariaLabel,
  activation = 'auto',
  variant = 'line',
  size = 'md',
  fullWidth = false,
  className,
  children,
}: TabsProps) {
  const reduced = useReducedMotion();
  const fallback = items[firstEnabled(items)]?.value ?? '';
  const [value, setValue] = useControllableState<string>(valueProp, defaultValue ?? fallback, onValueChange);
  const selectedIndex = items.findIndex((i) => i.value === value);
  const stopIndex =
    selectedIndex >= 0 && !items[selectedIndex]?.disabled ? selectedIndex : firstEnabled(items);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ x: 0, w: 0, ready: false });
  const [settled, setSettled] = useState(false);
  const [edges, setEdges] = useState<OverflowEdges>({ left: false, right: false });
  const firstScroll = useRef(true);

  // Fit. A row that does not fit its container gives up padding first, then type size, then the icons of
  // labelled tabs (so a label is never the thing that is cut off), and only then scrolls. It is measured on
  // the real layout, widest first, before paint, and again whenever the container or the content changes
  // size (a window resize, a webfont arriving). This effect is declared before the ones that measure the
  // selected tab, so they read the final layout.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the item count, variant and size change the content
  useLayoutEffect(() => {
    const root = rootRef.current;
    const sc = scrollerRef.current;
    const list = listRef.current;
    if (!root || !sc || !list) return;
    const settle = () => {
      let level = 0;
      for (; level < FIT_LEVELS - 1; level += 1) {
        root.dataset.fit = String(level);
        if (sc.scrollWidth <= sc.clientWidth + 1) break;
      }
      root.dataset.fit = String(level);
    };
    settle();
    if (typeof ResizeObserver === 'undefined') return;
    // Settling changes the list's width, which the observer would report again: it runs in a frame of its
    // own (never inside the delivery), and it is idempotent, so the second run changes nothing.
    // When the row still scrolls after a resize, the selected tab is kept in view.
    const reveal = () => {
      if (sc.scrollWidth <= sc.clientWidth + 1) return;
      const el = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!el) return;
      const rtl = getComputedStyle(sc).direction === 'rtl';
      const fromLeft = rtl ? sc.scrollLeft + (sc.scrollWidth - sc.clientWidth) : sc.scrollLeft;
      if (el.offsetLeft >= fromLeft && el.offsetLeft + el.offsetWidth <= fromLeft + sc.clientWidth) return;
      const from = centerScrollLeft(el.offsetLeft, el.offsetWidth, sc.clientWidth, sc.scrollWidth);
      sc.scrollTo({ left: toScrollLeft(from, sc.clientWidth, sc.scrollWidth, rtl), behavior: 'auto' });
    };
    let raf = 0;
    const later = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        settle();
        reveal();
      });
    };
    const ro = new ResizeObserver(later);
    ro.observe(sc);
    ro.observe(list);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [items.length, variant, size]);

  // Measure the selected tab: the indicator lives in the list's own coordinates.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `value` and the item count re-measure
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const el = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!el) {
        setBox((b) => (b.ready ? { ...b, ready: false } : b));
        return;
      }
      const next = { x: el.offsetLeft, w: el.offsetWidth, ready: true };
      setBox((b) => (b.x === next.x && b.w === next.w && b.ready ? b : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    for (const child of Array.from(list.children)) ro.observe(child);
    return () => ro.disconnect();
  }, [value, items.length, variant, size]);

  // Allow transitions only after the first measured frame, so the first paint is not a slide.
  useEffect(() => {
    if (!box.ready || settled) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setSettled(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [box.ready, settled]);

  // Edge fades follow the scroll position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the item count changes the scroll width
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rtl = getComputedStyle(sc).direction === 'rtl';
      const next = overflowEdges(sc.scrollLeft, sc.clientWidth, sc.scrollWidth, rtl);
      setEdges((e) => (e.left === next.left && e.right === next.right ? e : next));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    sc.addEventListener('scroll', schedule, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule);
      ro.observe(sc);
      if (listRef.current) ro.observe(listRef.current);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      sc.removeEventListener('scroll', schedule);
      ro?.disconnect();
    };
  }, [items.length]);

  // Keep the selected tab in view when the list scrolls.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `value` moves the selected tab
  useLayoutEffect(() => {
    const sc = scrollerRef.current;
    const el = listRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!sc || !el) return;
    if (sc.scrollWidth <= sc.clientWidth + 1) return;
    const rtl = getComputedStyle(sc).direction === 'rtl';
    const from = centerScrollLeft(el.offsetLeft, el.offsetWidth, sc.clientWidth, sc.scrollWidth);
    const left = toScrollLeft(from, sc.clientWidth, sc.scrollWidth, rtl);
    const instant = firstScroll.current || reduced;
    firstScroll.current = false;
    sc.scrollTo({ left, behavior: instant ? 'auto' : 'smooth' });
  }, [value, reduced]);

  const tabEls = (): HTMLElement[] =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);

  const select = (index: number) => {
    const item = items[index];
    if (item && !item.disabled && item.value !== value) setValue(item.value);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const tabs = tabEls();
    const current = tabs.findIndex((el) => el === e.target || el.contains(e.target as Node));
    if (current < 0) return;
    if (e.key === ' ' || e.key === 'Enter') {
      // Buttons click themselves; links need Space too.
      if (e.key === ' ' && (e.target as HTMLElement).tagName === 'A') {
        e.preventDefault();
        (e.target as HTMLElement).click();
      }
      return;
    }
    const rtl = listRef.current ? getComputedStyle(listRef.current).direction === 'rtl' : false;
    const target = rovingTarget(items, current, e.key, { orientation: 'horizontal', wrap: true, rtl });
    if (target === null) return;
    e.preventDefault();
    tabs[target]?.focus();
    if (activation === 'auto') select(target);
  };

  const onTabClick = (e: ReactMouseEvent<HTMLElement>, index: number) => {
    const item = items[index];
    if (!item || item.disabled) {
      e.preventDefault();
      return;
    }
    if (
      item.href &&
      onValueChange &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.altKey &&
      e.button === 0
    ) {
      e.preventDefault();
    }
    select(index);
  };

  const list = (
    <div
      ref={rootRef}
      className={cn(styles.root, className)}
      data-variant={variant}
      data-size={size}
      data-full={fullWidth ? 'true' : undefined}
      data-fade-left={edges.left ? 'true' : undefined}
      data-fade-right={edges.right ? 'true' : undefined}
    >
      <div ref={scrollerRef} className={styles.scroller}>
        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          aria-orientation="horizontal"
          className={styles.list}
          style={{ '--x': `${box.x}px`, '--w': box.w } as React.CSSProperties}
          data-settled={settled ? 'true' : undefined}
          onKeyDown={onKeyDown}
        >
          {items.map((item, i) => {
            const ids = tabIds(idBase, item.value);
            const selected = i === selectedIndex;
            const Tag = (item.href ? 'a' : 'button') as 'button';
            const linkProps = item.href
              ? { href: item.disabled ? undefined : item.href, 'aria-disabled': item.disabled || undefined }
              : { type: 'button' as const, disabled: item.disabled };
            return (
              <Tag
                key={item.value}
                role="tab"
                id={ids.tab}
                aria-selected={selected}
                aria-controls={selected ? ids.panel : undefined}
                tabIndex={i === stopIndex && !item.disabled ? 0 : -1}
                className={cn('chamfer', styles.tab)}
                data-selected={selected ? 'true' : undefined}
                data-labelled={item.label ? 'true' : undefined}
                data-force={item.force}
                onClick={(e) => onTabClick(e, i)}
                {...linkProps}
              >
                <span className={styles.edge} aria-hidden="true" />
                <span className={styles.face} aria-hidden="true" />
                <span className={styles.content}>
                  {item.icon ? (
                    <span className={styles.icon}>
                      <Glyph name={item.icon} size={size === 'sm' ? 16 : 18} />
                    </span>
                  ) : null}
                  <span className={styles.label}>{item.label}</span>
                  {item.count != null ? <span className={styles.count}>{item.count}</span> : null}
                </span>
              </Tag>
            );
          })}
          {variant === 'line' ? (
            <>
              <span className={styles.rail} aria-hidden="true" />
              <span
                className={styles.litTicks}
                aria-hidden="true"
                data-ready={box.ready ? 'true' : undefined}
              />
              <span
                className={styles.indicator}
                aria-hidden="true"
                data-ready={box.ready ? 'true' : undefined}
              />
              <span className={styles.head} aria-hidden="true" data-ready={box.ready ? 'true' : undefined} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (children == null) return list;
  return (
    <TabsContext value={{ idBase, value }}>
      <div className={styles.wrap}>
        {list}
        <div className={styles.panels}>{children}</div>
      </div>
    </TabsContext>
  );
}
