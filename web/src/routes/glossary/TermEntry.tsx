import { lessonById } from '@shared/curriculum';
import { Fragment, useState } from 'react';
import { getTerm } from '@/learn/glossary';
import { MarkupText } from '@/learn/MarkupText';
import type { GlossaryTerm } from '@/learn/types';
import { copyText } from '@/lib/clipboard';
import { announce } from '@/system/announce';
import { Chip, IconButton } from '@/ui';
import type { LessonRef } from './backlinks';
import { LinkChip } from './LinkChip';
import { categoryLabel, highlightPieces, termHref } from './model';
import styles from './TermEntry.module.css';

/** More than this many "mentioned in" chips fold behind a button. */
const FOLD_AT = 4;

function Marked({ text, query }: { text: string; query: string }) {
  const pieces = highlightPieces(text, query);
  return (
    <>
      {pieces.map((p, i) =>
        p.hit ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: a static split of one string
          <mark key={i} className={styles.mark}>
            {p.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: a static split of one string
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

export interface TermEntryProps {
  term: GlossaryTerm;
  /** The search text, so the name and aliases can show where it matched. */
  query: string;
  refs: readonly LessonRef[];
  /** The visitor arrived on this term by a link. */
  targeted: boolean;
}

/** Two digits, so a lesson number lines up in a row of chips. */
function lessonLead(order: number): string {
  return String(order).padStart(2, '0');
}

export function TermEntry({ term, query, refs, targeted }: TermEntryProps) {
  const [expanded, setExpanded] = useState(false);

  const related = (term.related ?? []).map((id) => getTerm(id)).filter((t) => t !== undefined);
  const taught = refs.filter((r) => r.kind !== 'mentioned');
  const mentioned = refs.filter((r) => r.kind === 'mentioned');
  const shownMentioned = expanded ? mentioned : mentioned.slice(0, FOLD_AT);
  const hidden = mentioned.length - shownMentioned.length;
  const nameId = `term-name-${term.id}`;

  const copyLink = async () => {
    const url = `${window.location.origin}${termHref(term.id)}`;
    const ok = await copyText(url);
    announce(ok ? `Link to ${term.term} copied.` : 'The link could not be copied.');
  };

  return (
    <li
      id={term.id}
      className={styles.entry}
      data-target={targeted ? 'true' : undefined}
      aria-labelledby={nameId}
      tabIndex={-1}
    >
      <div className={styles.name}>
        <h3 id={nameId} className={styles.term}>
          <Marked text={term.term} query={query} />
        </h3>
        <Chip size="sm" className={styles.kind}>
          {categoryLabel(term.category)}
        </Chip>
        {term.aka && term.aka.length > 0 ? (
          <p className={styles.aka}>
            <span className={styles.akaLabel}>Also</span>
            <Marked text={term.aka.join(', ')} query={query} />
          </p>
        ) : null}
      </div>

      <div className={styles.body}>
        <p className={styles.short}>
          <MarkupText text={term.short} />
        </p>
        <p className={styles.why}>
          <span className={styles.label}>Why it matters</span>
          <MarkupText text={term.why} />
        </p>

        {related.length > 0 || taught.length > 0 || mentioned.length > 0 || term.docs ? (
          <div className={styles.links}>
            {related.length > 0 ? (
              <div className={styles.row}>
                <span className={styles.rowLabel}>See also</span>
                <ul className={styles.chips}>
                  {related.map((r) => (
                    <li key={r.id}>
                      <LinkChip to={termHref(r.id)} size="sm">
                        {r.term}
                      </LinkChip>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {taught.length > 0 ? (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Taught in</span>
                <ul className={styles.chips}>
                  {taught.map((r) => {
                    const l = lessonById(r.lessonId);
                    if (!l) return null;
                    return (
                      <li key={r.lessonId}>
                        <LinkChip
                          to={`/learn/${l.id}`}
                          size="sm"
                          tier={l.track}
                          lead={lessonLead(l.order)}
                          aria-label={`Lesson ${l.order}: ${l.title}`}
                        >
                          {l.title}
                        </LinkChip>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {mentioned.length > 0 ? (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Also used in</span>
                <ul className={styles.chips}>
                  {shownMentioned.map((r) => {
                    const l = lessonById(r.lessonId);
                    if (!l) return null;
                    return (
                      <li key={r.lessonId}>
                        <LinkChip
                          to={`/learn/${l.id}`}
                          size="sm"
                          lead={lessonLead(l.order)}
                          aria-label={`Lesson ${l.order}: ${l.title}`}
                        >
                          {l.title}
                        </LinkChip>
                      </li>
                    );
                  })}
                  {hidden > 0 ? (
                    <li>
                      <button type="button" className={styles.more} onClick={() => setExpanded(true)}>
                        {hidden} more
                      </button>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            {term.docs ? (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Docs</span>
                <ul className={styles.chips}>
                  <li>
                    <LinkChip to={term.docs} size="sm" icon="book">
                      Official documentation
                    </LinkChip>
                  </li>
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.tools}>
        <IconButton
          icon="link"
          label={`Copy link to ${term.term}`}
          variant="ghost"
          size="sm"
          onClick={copyLink}
          tooltipPlacement="left"
        />
      </div>
    </li>
  );
}
