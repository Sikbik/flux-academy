import type { ReactNode } from 'react';
import { Glyph } from '@/ui';
import { AppLinkButton } from './AppLinkButton';
import styles from './PlaceholderPage.module.css';

export interface PlaceholderPageProps {
  /** The page's single `h1`. */
  title: string;
  /** One or two sentences under the title. */
  summary?: string;
  /** Small label above the title. Default "In progress". */
  eyebrow?: string;
  /** Extra content under the summary. */
  children?: ReactNode;
  /** Show links to the other places a visitor might want. Default true. */
  links?: boolean;
}

const LINKS = [
  { to: '/learn', label: 'Course map' },
  { to: '/labs', label: 'Labs' },
  { to: '/reference', label: 'Reference' },
  { to: '/glossary', label: 'Glossary' },
] as const;

/**
 * A calm holding page for a route whose real page has not shipped. Every placeholder in the app is this
 * component, so the shell is complete and navigable before the pages are. A page that replaces a
 * placeholder simply stops importing it.
 */
export function PlaceholderPage({
  title,
  summary,
  eyebrow = 'In progress',
  children,
  links = true,
}: PlaceholderPageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>
          <Glyph name="clock" size={14} />
          {eyebrow}
        </p>
        <h1 className={styles.title} tabIndex={-1}>
          {title}
        </h1>
        {summary ? <p className={styles.summary}>{summary}</p> : null}
        {children}
        {links ? (
          <nav className={styles.links} aria-label="Elsewhere in the Academy">
            {LINKS.map((l) => (
              <AppLinkButton key={l.to} href={l.to} variant="secondary" size="md" iconEnd="arrow-right">
                {l.label}
              </AppLinkButton>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
