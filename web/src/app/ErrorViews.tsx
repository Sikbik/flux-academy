import { useEffect } from 'react';
import { isRouteErrorResponse, useLocation, useRouteError } from 'react-router';
import { Button, Glyph, LinkButton, Panel } from '@/ui';
import { AppLinkButton } from './AppLinkButton';
import styles from './ErrorViews.module.css';

/** A failed dynamic import is almost always a new deploy (the old chunk is gone) or no network. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(
    message,
  );
}

interface Described {
  title: string;
  body: string;
  chunk: boolean;
  detail: string;
}

export function describeError(error: unknown): Described {
  if (isChunkLoadError(error)) {
    return {
      title: 'This page could not load',
      body: 'You may be offline, or the site was updated while this tab was open. Reload to get the latest version.',
      chunk: true,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  if (isRouteErrorResponse(error)) {
    return {
      title: error.status === 404 ? 'That page does not exist' : 'The page returned an error',
      body: 'Nothing is lost. Your progress is saved in this browser.',
      chunk: false,
      detail: `${error.status} ${error.statusText}`,
    };
  }
  return {
    title: 'Something went wrong on this page',
    body: 'The rest of the Academy still works, and your progress is saved in this browser. You can try again or go somewhere else.',
    chunk: false,
    detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  };
}

function RecoveryCard({ error, bare = false }: { error: unknown; bare?: boolean }) {
  const d = describeError(error);
  const { pathname } = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) console.error('[route error]', error);
  }, [error]);

  return (
    <section className={styles.wrap} data-bare={bare ? 'true' : undefined}>
      <Panel
        variant="slab"
        tone="warn"
        padding="lg"
        className={styles.card}
        contentClassName={styles.cardContent}
        role="alert"
      >
        <span className={styles.eyebrow}>
          <Glyph name="status-warn" size={16} /> Page error
        </span>
        <h1 className={styles.title} tabIndex={-1}>
          {d.title}
        </h1>
        <p className={styles.body}>{d.body}</p>
        <div className={styles.actions}>
          <Button variant="primary" icon="refresh" onClick={() => window.location.reload()}>
            Reload
          </Button>
          {pathname !== '/' ? (
            <LinkButton href="/" variant="secondary">
              Go home
            </LinkButton>
          ) : null}
          <AppLinkButton href="/learn" variant="secondary">
            Open the course map
          </AppLinkButton>
        </div>
        <details className={styles.details}>
          <summary>Technical detail</summary>
          <pre>{d.detail}</pre>
        </details>
      </Panel>
    </section>
  );
}

/** Inside the shell: the header and footer stay, only the page is replaced. */
export function RouteError() {
  return <RecoveryCard error={useRouteError()} />;
}

/** Outside the shell: the shell itself failed, so this stands alone on the void. */
export function RootError() {
  return (
    <main id="main">
      <RecoveryCard error={useRouteError()} bare />
    </main>
  );
}

/**
 * The last resort, outside the router: something above the route table threw. Plain anchors only (no
 * router hooks), so it renders even when the router itself is the problem.
 */
export function FatalError({ error }: { error: unknown }) {
  const d = describeError(error);
  return (
    <main id="main" className={styles.wrap} data-bare="true">
      <div className={`${styles.card} ${styles.plain}`} role="alert">
        <span className={styles.eyebrow}>Page error</span>
        <h1 className={styles.title} tabIndex={-1}>
          {d.title}
        </h1>
        <p className={styles.body}>{d.body}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
            Reload
          </button>
          <a className={styles.secondary} href="/">
            Go home
          </a>
        </div>
        <details className={styles.details}>
          <summary>Technical detail</summary>
          <pre>{d.detail}</pre>
        </details>
      </div>
    </main>
  );
}
