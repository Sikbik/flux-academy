import { type ReactNode, useId } from 'react';
import { Chip } from '../Chip/Chip';
import { Glyph } from '../Glyph/Glyph';
import { cn } from '../internal/cn';
import { EXTERNAL_REL } from '../internal/links';
import styles from './TermCard.module.css';

/** One glossary term, ready to draw. The text fields are already rendered (inline markup is the host's). */
export interface TermCardTerm {
  id: string;
  /** The canonical display name. */
  name: string;
  /** The kind of term, as the chip says it: "Money", "Apps". */
  kind?: string;
  /** The definition. */
  short: ReactNode;
  /** Why a deployer cares. */
  why?: ReactNode;
  /** The lessons it is tied to. */
  lessons?: ReadonlyArray<{ id: string; title: string; href: string }>;
  /** Terms to read next. */
  related?: ReadonlyArray<{ id: string; name: string; href: string }>;
  /** The glossary entry. */
  href?: string;
  /** The official documentation. */
  docs?: string;
}

export interface TermCardLinkProps {
  href: string;
  className: string;
  children: ReactNode;
  /** Called when the link is followed, so a popover or the deck can close. */
  onClick?: () => void;
}

export interface TermCardProps {
  term: TermCardTerm;
  /** Draw the name and kind. Pass `false` when a popover already shows the name. Default true. */
  showTitle?: boolean;
  /** Heading level for the name. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** `sm` for a popover or a list, `md` where the card is the whole content (the command deck). */
  size?: 'sm' | 'md';
  /** Lessons listed, at most. Default 0: none. */
  maxLessons?: number;
  /** Related terms listed, at most. Default 0: none. */
  maxRelated?: number;
  /** Show the link to the official documentation. Default false. */
  withDocs?: boolean;
  /**
   * How an internal link is drawn: the host owns routing, so the card stays router-free and works in the
   * design system, in a router and inside the deck alike.
   */
  renderLink: (props: TermCardLinkProps) => ReactNode;
  /** Related terms become buttons that call this (the deck swaps the card) instead of links. */
  onOpenTerm?: (id: string) => void;
  /** Called when a link inside is followed. */
  onNavigate?: () => void;
  className?: string;
}

/**
 * The card for one glossary term: what it is, why a deployer cares, and the way to the full entry. It is
 * the one drawing of a term, so it reads the same in a lesson's popover, in the command deck and on the
 * glossary page. It owns layout and wording; the host supplies rendered text and the link renderer.
 *
 *   <TermCard term={{ id, name, short, why, href }} showTitle={false} renderLink={(p) => <a {...p} />} />
 */
export function TermCard({
  term,
  showTitle = true,
  headingLevel = 3,
  size = 'sm',
  maxLessons = 0,
  maxRelated = 0,
  withDocs = false,
  renderLink,
  onOpenTerm,
  onNavigate,
  className,
}: TermCardProps) {
  const Heading = `h${headingLevel}` as 'h3';
  const titleId = useId();
  const lessons = (term.lessons ?? []).slice(0, maxLessons);
  const related = (term.related ?? []).slice(0, maxRelated);
  const docs = withDocs ? term.docs : undefined;

  return (
    <article
      className={cn(styles.card, className)}
      data-term={term.id}
      data-size={size}
      aria-labelledby={showTitle ? titleId : undefined}
    >
      {showTitle ? (
        <header className={styles.head}>
          <Heading id={titleId} className={styles.name}>
            {term.name}
          </Heading>
          {term.kind ? <Chip size="sm">{term.kind}</Chip> : null}
        </header>
      ) : null}
      <p className={styles.short}>{term.short}</p>
      {term.why ? (
        <p className={styles.why}>
          <span className={styles.label}>Why it matters</span>
          {term.why}
        </p>
      ) : null}
      {lessons.length > 0 ? (
        <p className={styles.lessons}>
          <span className={styles.label}>{size === 'md' ? 'Where it comes up' : 'Taught in'}</span>
          {lessons.map((l) => (
            <span key={l.id}>
              {renderLink({
                href: l.href,
                className: styles.lesson as string,
                onClick: onNavigate,
                children: l.title,
              })}
            </span>
          ))}
        </p>
      ) : null}
      {related.length > 0 ? (
        <div className={styles.related}>
          <span className={styles.label}>Related</span>
          <ul className={styles.chips}>
            {related.map((r) => (
              <li key={r.id}>
                {onOpenTerm ? (
                  <button type="button" className={styles.chip} onClick={() => onOpenTerm(r.id)}>
                    {r.name}
                  </button>
                ) : (
                  renderLink({
                    href: r.href,
                    className: styles.chip as string,
                    onClick: onNavigate,
                    children: r.name,
                  })
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {term.href || docs ? (
        <div className={styles.foot}>
          {term.href
            ? renderLink({
                href: term.href,
                className: styles.open as string,
                onClick: onNavigate,
                children: (
                  <>
                    Open in the glossary
                    <Glyph name="arrow-right" size={size === 'md' ? 14 : 13} />
                  </>
                ),
              })
            : null}
          {docs ? (
            <a className={styles.open} href={docs} target="_blank" rel={EXTERNAL_REL}>
              Read the docs
              <Glyph name="arrow-up-right" size={size === 'md' ? 14 : 13} />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
