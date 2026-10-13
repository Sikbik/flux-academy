/**
 * The glossary card: one term, its definition, why it matters and the way to the full entry.
 *
 * It is the design system's `TermCard` with this app's pieces attached (the glossary entry, the router's
 * links and `MarkupText` for the text), so a term reads the same in a lesson's popover, in the command
 * deck and on the glossary page. Exported for reuse:
 *
 *   <TermCard term={term} />                        a card with the name and kind
 *   <TermCard term={term} showTitle={false} />      under a popover that already shows the name
 *
 * The text is rendered with `MarkupText` in `plain` mode, so a definition never opens another card. The
 * card needs a Router above it (its links are `<Link>`s).
 */

import { lessonById } from '@shared/curriculum';
import { Link } from 'react-router';
import { MarkupText } from '@/learn/MarkupText';
import type { GlossaryTerm } from '@/learn/types';
import { TermCard as SharedTermCard } from '@/ui';
import { categoryLabel, termHref } from './model';

export interface TermCardProps {
  term: GlossaryTerm;
  /** Draw the term's name and kind. Pass `false` when the surrounding popover already shows the name. */
  showTitle?: boolean;
  /** Heading level for the name. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Also list the lessons the term is tied to (up to three). Default false. */
  withLessons?: boolean;
  /** Called when a link inside is followed, so a popover or a deck can close. */
  onNavigate?: () => void;
  className?: string;
}

export function TermCard({
  term,
  showTitle = true,
  headingLevel = 3,
  withLessons = false,
  onNavigate,
  className,
}: TermCardProps) {
  const lessons = (term.lessons ?? [])
    .map((id) => lessonById(id))
    .filter((l) => l !== undefined)
    .map((l) => ({ id: l.id, title: l.title, href: `/learn/${l.id}` }));
  return (
    <SharedTermCard
      className={className}
      showTitle={showTitle}
      headingLevel={headingLevel}
      maxLessons={withLessons ? 3 : 0}
      onNavigate={onNavigate}
      term={{
        id: term.id,
        name: term.term,
        kind: categoryLabel(term.category),
        short: <MarkupText text={term.short} plain />,
        why: <MarkupText text={term.why} plain />,
        lessons,
        href: termHref(term.id),
      }}
      renderLink={({ href, className: linkClass, children, onClick }) => (
        <Link to={href} className={linkClass} onClick={onClick}>
          {children}
        </Link>
      )}
    />
  );
}
