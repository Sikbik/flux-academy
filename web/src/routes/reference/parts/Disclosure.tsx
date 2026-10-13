import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { Glyph } from '@/ui';
import { CopyLink } from './Heading';
import styles from './parts.module.css';

/** React's types only know `hidden` as a boolean; the DOM takes `until-found` and React passes it on. */
const HIDDEN_UNTIL_FOUND = { hidden: 'until-found' } as unknown as { hidden: boolean };

export interface DisclosureRowProps {
  /** The element id and the URL fragment. */
  id: string;
  open: boolean;
  onOpenChange: (id: string, open: boolean) => void;
  /** The name of the row: a key, a code, a route. Shown first and named by assistive tech. */
  title: ReactNode;
  /** Plain text of `title`, for the copy link's name. */
  label: string;
  /** Small facts after the title, inside the toggle: chips and the like (not interactive). */
  meta?: ReactNode;
  /** Right aligned and quiet, inside the toggle. */
  aside?: ReactNode;
  /** Always visible under the head. May hold links. */
  summary?: ReactNode;
  /** Heading level of the row. Default 3. */
  level?: 3 | 4;
  /** The part that opens. */
  children?: ReactNode;
  className?: string;
}

/**
 * A row that opens. The head is a real heading holding one button, so a list of rows is a list of
 * headings to a screen reader. A closed body is `hidden="until-found"`: find in page and a link to
 * something inside it open the row first. The copy link sits beside the button, never inside it.
 */
export function DisclosureRow({
  id,
  open,
  onOpenChange,
  title,
  label,
  meta,
  aside,
  summary,
  level = 3,
  children,
  className,
}: DisclosureRowProps) {
  const body = useRef<HTMLDivElement>(null);
  const change = useRef(onOpenChange);
  change.current = onOpenChange;

  // `beforematch` fires when find in page or a fragment lands inside the closed body.
  useEffect(() => {
    const el = body.current;
    if (!el) return undefined;
    const onMatch = () => change.current(id, true);
    el.addEventListener('beforematch', onMatch);
    return () => el.removeEventListener('beforematch', onMatch);
  }, [id]);

  const Heading = level === 3 ? 'h3' : 'h4';
  const titleId = `${id}-title`;
  const metaId = `${id}-meta`;
  return (
    <div id={id} className={cn(styles.row, className)} data-open={open ? 'true' : undefined}>
      <div className={styles.rowHead}>
        <Heading className={styles.rowHeading}>
          <button
            type="button"
            className={styles.rowToggle}
            aria-expanded={open}
            aria-controls={`${id}-body`}
            aria-labelledby={titleId}
            aria-describedby={meta ? metaId : undefined}
            onClick={() => onOpenChange(id, !open)}
          >
            <span className={styles.rowText}>
              <span id={titleId} className={styles.rowTitle}>
                {title}
              </span>
              {meta ? (
                <span id={metaId} className={styles.rowMeta}>
                  {meta}
                </span>
              ) : null}
              {aside ? <span className={styles.rowAside}>{aside}</span> : null}
            </span>
            <span className={styles.rowChevron} aria-hidden="true">
              <Glyph name="chevron-down" size={16} />
            </span>
          </button>
        </Heading>
        <CopyLink id={id} label={label} />
      </div>
      {summary ? <div className={styles.rowSummary}>{summary}</div> : null}
      <div id={`${id}-body`} ref={body} className={styles.rowBody} {...(open ? {} : HIDDEN_UNTIL_FOUND)}>
        <div className={styles.rowBodyInner}>{children}</div>
      </div>
    </div>
  );
}

/** "Expand all" and "Collapse all" for a list of rows. */
export function ExpandAll({
  allOpen,
  onChange,
  count,
}: {
  allOpen: boolean;
  onChange: (open: boolean) => void;
  /** How many rows it controls, for the name. */
  count: number;
}) {
  return (
    <button type="button" className={styles.textButton} onClick={() => onChange(!allOpen)}>
      {allOpen ? 'Collapse all' : 'Expand all'}
      <span className="sr-only"> {count} rows</span>
    </button>
  );
}
