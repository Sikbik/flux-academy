import { lessonById } from '@shared/curriculum';
import { Link } from 'react-router';
import { APP_MARKUP } from '@/app/markupContext';
import { appNavigate } from '@/app/navigation';
import { getTerm } from '@/learn/glossary';
import { categoryLabel, termHref } from '@/routes/glossary/model';
import { Glyph, Markup, TermCard as SharedTermCard } from '@/ui';
import styles from './Deck.module.css';

/**
 * A glossary term, shown inside the deck: the shared term card (the same words and layout as a lesson's
 * popover and the glossary page) with a way back to the results and room for the lessons that teach it
 * and the terms to read next.
 */
export function TermCard({
  id,
  onBack,
  onOpenTerm,
  onNavigate,
}: {
  id: string;
  onBack: () => void;
  onOpenTerm: (id: string) => void;
  /** Called before a link inside the card navigates, so the deck can close. */
  onNavigate: () => void;
}) {
  const term = getTerm(id);
  if (!term) {
    return (
      <div className={styles.termCard}>
        <p className={styles.termMissing}>That term is not in the glossary.</p>
        <button type="button" className={styles.termBack} onClick={onBack} data-autofocus="">
          <Glyph name="arrow-left" size={14} />
          Back to results
        </button>
      </div>
    );
  }

  // A link in the definition's own text goes through the router too, and takes the deck down first.
  const context = {
    ...APP_MARKUP,
    navigate: (href: string) => {
      onNavigate();
      appNavigate(href);
    },
  };
  const text = (markup: string) => <Markup inline text={markup} context={context} />;
  const lessons = (term.lessons ?? [])
    .map((l) => lessonById(l))
    .filter((l) => l !== undefined)
    .map((l) => ({ id: l.id, title: l.title, href: `/learn/${l.id}` }));
  const related = (term.related ?? [])
    .map((r) => getTerm(r))
    .filter((t) => t !== undefined)
    .map((t) => ({ id: t.id, name: t.term, href: termHref(t.id) }));

  return (
    <div className={styles.termCard}>
      <div className={styles.termHead}>
        <button type="button" className={styles.termBack} onClick={onBack} data-autofocus="">
          <Glyph name="arrow-left" size={14} />
          Back to results
        </button>
      </div>
      <SharedTermCard
        size="md"
        headingLevel={2}
        maxLessons={4}
        maxRelated={6}
        withDocs
        onOpenTerm={onOpenTerm}
        onNavigate={onNavigate}
        term={{
          id: term.id,
          name: term.term,
          kind: categoryLabel(term.category),
          short: text(term.short),
          why: text(term.why),
          lessons,
          related,
          href: termHref(term.id),
          docs: term.docs,
        }}
        renderLink={({ href, className, children, onClick }) => (
          <Link to={href} className={className} onClick={onClick}>
            {children}
          </Link>
        )}
      />
    </div>
  );
}
