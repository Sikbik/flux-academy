import { routeMeta } from '@shared/site';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation, useMatches, useNavigation } from 'react-router';
import ChordHint from '@/palette/ChordHint';
import { announce } from '@/system/announce';
import { useOverlays } from '@/system/overlays';
import { Backdrop } from '@/ui';
import { Footer } from './Footer';
import { Header } from './Header';
import './iris.css';
import { LiveRegion } from './LiveRegion';
import { applyHead, buildHead, useMetaOverride } from './meta';
import { useFooterHeld, useHoldFooter } from './pending';
import type { RouteMetaOverride } from './routeTypes';
import styles from './Shell.module.css';
import { ToastHost } from './ToastHost';
import { supportsViewTransitions } from './transitions';
import { usePathChange } from './usePathChange';

const Deck = lazy(() => import('@/palette/Deck'));
const Shortcuts = lazy(() => import('@/palette/ShortcutsSheet'));
const Ambient = lazy(() => import('@/ambient/AmbientOverlay'));

interface RouteHandle {
  folder?: string;
  meta?: RouteMetaOverride;
}

/** Lazily mounts an overlay the first time it opens, then keeps it mounted (it animates out itself). */
function useEverOpened(open: boolean): boolean {
  const [ever, setEver] = useState(open);
  useEffect(() => {
    if (open) setEver(true);
  }, [open]);
  return ever || open;
}

/** What a lazily loaded page shows while its chunk arrives on the first visit. */
export function PageSkeleton() {
  // The footer waits for the page: under a skeleton it would sit mid-screen, then jump below the fold.
  useHoldFooter();
  return (
    <div className={styles.skeleton} role="status" aria-busy="true">
      <span className="sr-only">Loading the page</span>
      <div className={styles.skelEyebrow} />
      <div className={styles.skelTitle} />
      <div className={styles.skelLine} />
      <div className={styles.skelLine} style={{ inlineSize: '72%' }} />
      <div className={styles.skelBlock} />
    </div>
  );
}

/** A thin scan line while a navigation is waiting for a route chunk (shown only if it takes a moment). */
function NavProgress() {
  const navigation = useNavigation();
  const [shown, setShown] = useState(false);
  const busy = navigation.state !== 'idle';
  useEffect(() => {
    if (!busy) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(true), 160);
    return () => clearTimeout(t);
  }, [busy]);
  return shown ? <div className={styles.progress} role="presentation" aria-hidden="true" /> : null;
}

/** Moves focus to the page heading and announces the new page, after every pathname change. */
function useRouteAnnouncements(pathname: string, title: string): void {
  const titleRef = useRef(title);
  titleRef.current = title;
  usePathChange(pathname, () => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const main = document.getElementById('main');
        const target = main?.querySelector<HTMLElement>('h1') ?? main;
        if (target) {
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
        announce(`Navigated to ${titleRef.current}`);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  });
}

/** Without view transitions the page fades in over 160 ms instead of the iris. */
function useFadeFallback(pathname: string, main: React.RefObject<HTMLElement | null>): void {
  usePathChange(pathname, () => {
    if (supportsViewTransitions()) return undefined;
    const el = main.current;
    if (!el) return undefined;
    if (document.documentElement.dataset.motion === 'reduced') return undefined;
    el.dataset.enter = 'true';
    const t = setTimeout(() => {
      delete el.dataset.enter;
    }, 200);
    return () => clearTimeout(t);
  });
}

/**
 * The layout route: skip link, header, the page, footer, and the overlays (command deck, shortcuts,
 * ambient, toasts). Pages render into `<main id="main">` and own their single `h1`.
 */
export function Shell() {
  const location = useLocation();
  const matches = useMatches();
  const mainRef = useRef<HTMLElement>(null);
  const override = useMetaOverride((s) => s.override);

  const handle = (matches[matches.length - 1]?.handle ?? {}) as RouteHandle;
  const isHome = location.pathname === '/';
  const kind = routeMeta(location.pathname)?.kind ?? handle.folder ?? 'page';
  const chrome = handle.meta?.chrome;
  const showBackdrop = chrome?.backdrop ?? !isHome;
  const showFooter = chrome?.footer ?? true;

  const head = buildHead(location.pathname, handle.meta, override);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `head` is rebuilt from the same inputs.
  useEffect(() => {
    applyHead(head);
  }, [head.title, head.description, head.canonical, head.noindex]);

  useRouteAnnouncements(location.pathname, head.title.replace(/ \| Flux Academy$/, ''));
  useFadeFallback(location.pathname, mainRef);

  const deck = useOverlays((s) => s.deck);
  const shortcuts = useOverlays((s) => s.shortcuts);
  const ambient = useOverlays((s) => s.ambient);
  const footerHeld = useFooterHeld();
  const deckMounted = useEverOpened(deck);
  const shortcutsMounted = useEverOpened(shortcuts);
  const ambientMounted = useEverOpened(ambient);

  return (
    <div className={styles.shell} data-route={kind} data-home={isHome ? 'true' : undefined}>
      {/* biome-ignore lint/a11y/useValidAnchor: the skip link focuses <main> without adding #main to the URL */}
      <a
        className={styles.skip}
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById('main');
          main?.focus();
          main?.scrollIntoView({ block: 'start' });
        }}
      >
        Skip to content
      </a>

      {showBackdrop ? <Backdrop paused={ambient} /> : null}
      <Header />
      <NavProgress />

      <main id="main" ref={mainRef} className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>

      {showFooter && !footerHeld ? <Footer /> : null}

      <LiveRegion />
      <ToastHost />
      <ChordHint />
      <Suspense fallback={null}>
        {deckMounted ? <Deck /> : null}
        {shortcutsMounted ? <Shortcuts /> : null}
        {ambientMounted ? <Ambient /> : null}
      </Suspense>
      <ScrollRestoration />
    </div>
  );
}
