import { LESSONS } from '@shared/curriculum';
import { Link, useLocation } from 'react-router';
import { useOverlays } from '@/system/overlays';
import { Button, Glyph, Panel } from '@/ui';
import { AppLinkButton } from './AppLinkButton';
import { useDocumentMeta } from './meta';
import styles from './NotFoundView.module.css';

export interface NotFoundViewProps {
  /** The page's `h1`. Default "That page does not exist". */
  title?: string;
  /** One or two sentences. */
  body?: string;
  /** Document title (without the site suffix). Default "Page not found". */
  documentTitle?: string;
}

const SUGGESTIONS = [
  { to: '/learn', label: 'The course map', hint: `${LESSONS.length} lessons in three tracks` },
  {
    to: '/labs',
    label: 'Labs',
    hint: 'Build a spec, explore network data, break a node, supervise an agent in a simulation',
  },
  {
    to: '/reference',
    label: 'Reference',
    hint: 'The spec, the network, Docker, the API, Orbit and agents, field by field',
  },
  { to: '/glossary', label: 'Glossary', hint: 'Plain-language definitions of the terms the lessons use' },
] as const;

/** Words from the missing path, so the deck can start a useful search from them. */
export function searchSeedFor(pathname: string): string {
  return pathname.split('/').filter(Boolean).slice(-1)[0]?.replace(/[-_]+/g, ' ').trim() ?? '';
}

/** A friendly dead end that is not a dead end: the deck, the course map and the usual places. */
export function NotFoundView({
  title = 'That page does not exist',
  body = 'The link may be old or mistyped. Nothing is broken, and your progress is saved in this browser.',
  documentTitle = 'Page not found',
}: NotFoundViewProps) {
  const { pathname } = useLocation();
  useDocumentMeta({ title: documentTitle, noindex: true });
  const seed = searchSeedFor(pathname);
  const first = LESSONS[0];

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.code} aria-hidden="true">
          404
        </p>
        <h1 className={styles.title} tabIndex={-1}>
          {title}
        </h1>
        <p className={styles.body}>{body}</p>
        <p className={styles.path}>
          <span className="sr-only">Address: </span>
          <code>{pathname}</code>
        </p>
        <div className={styles.actions}>
          <Button
            variant="primary"
            size="lg"
            icon="search"
            onClick={() => useOverlays.getState().openDeck(seed)}
          >
            Search the Academy
          </Button>
          {first ? (
            <AppLinkButton href={`/learn/${first.id}`} variant="secondary" size="lg">
              Start with lesson one
            </AppLinkButton>
          ) : null}
        </div>
        <nav className={styles.grid} aria-label="Places to go">
          {SUGGESTIONS.map((s) => (
            <Panel
              key={s.to}
              as={Link}
              to={s.to}
              interactive
              variant="slab"
              padding="md"
              size="sm"
              className={styles.card}
              contentClassName={styles.cardContent}
            >
              <span className={styles.cardTitle}>
                {s.label}
                <Glyph name="arrow-right" size={14} />
              </span>
              <span className={styles.cardHint}>{s.hint}</span>
            </Panel>
          ))}
        </nav>
      </div>
    </div>
  );
}
