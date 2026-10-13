import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { anchor } from '@/content/reference';
import type { FactRow, TroubleRow } from '@/content/reference/types';
import { cn } from '@/lib/cn';
import { Panel } from '@/ui';
import { CopyLink } from './Heading';
import { LintChips } from './LintChip';
import { Md, P } from './Prose';
import { ProvChips } from './Prov';
import styles from './parts.module.css';
import { Ul } from './Semantics';

/** The quiet slab that tables, lists and figures sit on. */
export function Slab({
  children,
  className,
  padded = false,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <Panel
      variant="slab"
      size="sm"
      padding={padded ? 'md' : 'none'}
      marks={false}
      pattern="none"
      halo={false}
      className={cn(styles.slab, className)}
      contentClassName={styles.slabInner}
    >
      {children}
    </Panel>
  );
}

/**
 * A list of statements, each with its basis. Every row has an id of the form `<section>-<row>`, which is
 * what the search index and the deep links use.
 */
export function FactList({
  section,
  rows,
  idOf,
}: {
  section: string;
  rows: readonly FactRow[];
  /** Overrides the id of a row, for lists whose ids the search index names differently. */
  idOf?: (row: FactRow) => string;
}) {
  return (
    <Slab>
      <dl className={styles.facts}>
        {rows.map((row) => {
          const id = idOf ? idOf(row) : anchor.fact(section, row.id);
          return (
            <div key={row.id} id={id} className={styles.fact}>
              <dt id={`${id}-label`} className={styles.factLabel}>
                <span>
                  <Md text={row.label} />
                </span>
                <CopyLink id={id} label={row.label.replace(/`/g, '')} />
              </dt>
              <dd className={styles.factText}>
                <P text={row.text} className={styles.factP} />
                <ProvChips prov={row.prov} />
              </dd>
            </div>
          );
        })}
      </dl>
    </Slab>
  );
}

/** Symptom, cause and fix, each with the codes that catch it before registration. */
export function TroubleList({ section, rows }: { section: string; rows: readonly TroubleRow[] }) {
  return (
    <Ul className={styles.troubles}>
      {rows.map((row) => {
        const id = anchor.trouble(section, row.id);
        return (
          <li key={row.id}>
            <Slab>
              <article id={id} className={styles.trouble} aria-labelledby={`${id}-symptom`}>
                <header className={styles.troubleHead}>
                  <h3 id={`${id}-symptom`} className={styles.troubleSymptom}>
                    <Md text={row.symptom} />
                  </h3>
                  <CopyLink id={id} label="this problem" />
                </header>
                <div className={styles.troubleCols}>
                  <div>
                    <p className={styles.troubleLabel}>Why it happens</p>
                    <P text={row.cause} className={styles.troubleP} />
                  </div>
                  <div>
                    <p className={styles.troubleLabel}>What to do</p>
                    <P text={row.fix} className={styles.troubleP} />
                  </div>
                </div>
                <div className={styles.troubleFoot}>
                  <LintChips codes={row.lint} label="Caught by" />
                  <ProvChips prov={row.prov} />
                </div>
              </article>
            </Slab>
          </li>
        );
      })}
    </Ul>
  );
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export interface Column<T> {
  id: string;
  /** The header text. On a phone it labels the value inside each card. */
  label: string;
  /** A shorter label for the card on a phone, when the header is long. */
  cardLabel?: string;
  /** The label is an identifier, so its case is kept: `containerPorts[i]`, not CONTAINERPORTS[I]. */
  code?: boolean;
  render: (row: T, index: number) => ReactNode;
  /** Mono type, for keys and numbers. */
  mono?: boolean;
  /** Right aligned numbers. */
  numeric?: boolean;
  /** The first cell names the row: the header of the card on a phone. */
  primary?: boolean;
  /** Hide the label on a phone card (for cells that explain themselves). */
  bare?: boolean;
  /** A CSS width for the column on a wide screen. */
  width?: string;
}

/**
 * Whether a table needs the card layout: true while the table is wider than the box it sits in. The
 * width a table needs is read from the table itself, so it follows its column, its text and its
 * language, and no breakpoint has to be guessed. Once cards are on, the width the table asked for is
 * kept, and the table comes back when the box has that much room again.
 */
function useCardLayout(): { box: RefObject<HTMLDivElement | null>; cards: boolean } {
  const box = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    let needed = 0;
    let on = false;
    const measure = () => {
      if (!on) {
        // In table layout the box scrolls when the table is wider than it: scrollWidth is the table's width.
        if (el.scrollWidth > el.clientWidth + 1) {
          needed = el.scrollWidth;
          on = true;
          setCards(true);
        }
      } else if (needed > 0 && el.clientWidth >= needed) {
        on = false;
        setCards(false);
      }
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    const table = el.querySelector('table');
    if (table) observer?.observe(table);
    return () => observer?.disconnect();
  }, []);
  return { box, cards };
}

/**
 * A real table that becomes a stack of labelled cards when it does not fit its box. Roles are explicit
 * because the card layout changes `display`, which would otherwise make some screen readers forget it
 * was a table.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowId,
  className,
}: {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  /** The element id of a row, or undefined for none. */
  rowId?: (row: T, index: number) => string | undefined;
  className?: string;
}) {
  const { box, cards } = useCardLayout();
  return (
    <Slab className={className}>
      <div ref={box} className={styles.tableBox} data-cards={cards ? 'true' : undefined}>
        {/* biome-ignore-start lint/a11y/noRedundantRoles: the phone layout changes display, which drops table semantics in Safari and Chrome; the roles put them back */}
        <table className={styles.table} role="table">
          <caption className="sr-only">{caption}</caption>
          <thead role="rowgroup">
            <tr role="row">
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  role="columnheader"
                  className={styles.th}
                  data-code={c.code ? 'true' : undefined}
                  data-numeric={c.numeric ? 'true' : undefined}
                  style={c.width ? { inlineSize: c.width } : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map((row, i) => {
              const id = rowId?.(row, i);
              return (
                <tr key={id ?? i} id={id} role="row" className={styles.tr}>
                  {columns.map((c) => {
                    const Cell = c.primary ? 'th' : 'td';
                    return (
                      <Cell
                        key={c.id}
                        {...(c.primary ? { scope: 'row' as const } : {})}
                        role={c.primary ? 'rowheader' : 'cell'}
                        className={styles.td}
                        data-label={c.bare ? undefined : (c.cardLabel ?? c.label)}
                        data-code={c.code ? 'true' : undefined}
                        data-mono={c.mono ? 'true' : undefined}
                        data-numeric={c.numeric ? 'true' : undefined}
                        data-primary={c.primary ? 'true' : undefined}
                      >
                        <div className={styles.cell}>{c.render(row, i)}</div>
                      </Cell>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* biome-ignore-end lint/a11y/noRedundantRoles: the table ends here */}
      </div>
    </Slab>
  );
}
