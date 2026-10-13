/**
 * The itemised price: every line of the quote in order, each with its plain-language note, drawn as a
 * waterfall (each bar starts where the running total was and ends where it is now, so a discount steps back).
 *
 * Resource lines are per component and can be many, so they are grouped under their component. Everything
 * that is not a resource (instances, add-ons, minimum, subscription, discounts, rounding) is a row of its own
 * and its note is open: those are the lines that carry the lesson.
 */

import type { Quote, QuoteLineItem } from '@shared/flux/types';
import { type CSSProperties, useMemo, useState } from 'react';
import { Glyph } from '@/ui';
import { money, usdSigned } from '../model/format';
import styles from './reactor.module.css';

interface Row {
  line: QuoteLineItem;
  from: number;
  to: number;
}

interface Group {
  key: string;
  component: string | null;
  rows: Row[];
  subtotal: number;
}

const RESOURCE = new Set(['cpu', 'ram', 'hdd']);

function build(lines: readonly QuoteLineItem[]): { items: (Row | Group)[]; peak: number } {
  const items: (Row | Group)[] = [];
  const groups = new Map<string, Group>();
  let running = 0;
  let peak = 0;
  for (const line of lines) {
    const from = running;
    running += line.usd;
    peak = Math.max(peak, from, running);
    const row: Row = { line, from, to: running };
    if (RESOURCE.has(line.id) && line.component !== undefined) {
      let g = groups.get(line.component);
      if (!g) {
        g = { key: `g:${line.component}`, component: line.component, rows: [], subtotal: 0 };
        groups.set(line.component, g);
        items.push(g);
      }
      g.rows.push(row);
      g.subtotal += line.usd;
    } else {
      items.push(row);
    }
  }
  return { items, peak: peak || 1 };
}

function isGroup(x: Row | Group): x is Group {
  return 'rows' in x;
}

function Bar({ row, peak }: { row: Row; peak: number }) {
  const lo = Math.min(row.from, row.to);
  const hi = Math.max(row.from, row.to);
  const left = (lo / peak) * 100;
  const width = Math.max(0.8, ((hi - lo) / peak) * 100);
  return (
    <span className={styles.wfTrack} aria-hidden="true">
      <span
        className={styles.wfBar}
        data-dir={row.line.usd < 0 ? 'down' : 'up'}
        style={{ insetInlineStart: `${left}%`, inlineSize: `${width}%` } as CSSProperties}
      />
    </span>
  );
}

function RowView({
  row,
  peak,
  open,
  onToggle,
  nested,
  order,
}: {
  row: Row;
  peak: number;
  open: boolean;
  onToggle: () => void;
  nested?: boolean;
  order: number;
}) {
  const { line } = row;
  const hasNote = Boolean(line.note);
  return (
    <li
      className={styles.wfRow}
      data-nested={nested ? 'true' : undefined}
      data-open={open ? 'true' : undefined}
      data-kind={line.usd < 0 ? 'discount' : RESOURCE.has(line.id) ? 'resource' : 'item'}
      style={{ '--i': order } as CSSProperties}
    >
      <button
        type="button"
        className={styles.wfButton}
        aria-expanded={hasNote ? open : undefined}
        disabled={!hasNote}
        onClick={onToggle}
      >
        <span className={styles.wfLabel}>{line.label}</span>
        <span className={styles.wfAmount} data-neg={line.usd < 0 ? 'true' : undefined}>
          {usdSigned(line.usd)}
        </span>
        <Bar row={row} peak={peak} />
      </button>
      {hasNote && open ? <p className={styles.wfNote}>{line.note}</p> : null}
    </li>
  );
}

export function Waterfall({ quote, label }: { quote: Quote; label?: string }) {
  const { items, peak } = useMemo(() => build(quote.lines), [quote.lines]);
  const groupCount = items.filter(isGroup).length;
  // With several components the resource lines start folded; the rows that carry the lesson stay open.
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const [openNotes, setOpenNotes] = useState<ReadonlySet<string>>(new Set());
  const [closedNotes, setClosedNotes] = useState<ReadonlySet<string>>(new Set());

  const groupOpen = (g: Group) => (groupCount <= 2 ? !openGroups.has(`!${g.key}`) : openGroups.has(g.key));
  const toggleGroup = (g: Group) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      const k = groupCount <= 2 ? `!${g.key}` : g.key;
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // A note is open by default for non-resource lines; a press flips it.
  const noteKey = (row: Row, i: string) => `${i}:${row.line.id}:${row.line.component ?? ''}`;
  const noteOpen = (row: Row, key: string) => {
    const byDefault = !RESOURCE.has(row.line.id);
    return byDefault ? !closedNotes.has(key) : openNotes.has(key);
  };
  const toggleNote = (row: Row, key: string) => {
    const byDefault = !RESOURCE.has(row.line.id);
    const set = byDefault ? setClosedNotes : setOpenNotes;
    set((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const total = quote.usdTotal ?? quote.usdPerMonth * quote.months;
  let order = 0;
  return (
    <section className={styles.waterfall} aria-label={label ?? 'Where the money goes'}>
      <h3 className={styles.sectionTitle}>Where the money goes</h3>
      <ol className={styles.wfList}>
        {items.map((item, idx) => {
          if (isGroup(item)) {
            const open = groupOpen(item);
            return (
              <li className={styles.wfGroup} key={item.key} data-open={open ? 'true' : undefined}>
                <button
                  type="button"
                  className={styles.wfGroupButton}
                  aria-expanded={open}
                  onClick={() => toggleGroup(item)}
                >
                  <Glyph name={open ? 'chevron-down' : 'chevron-right'} size={14} />
                  <span className={styles.wfGroupName}>{item.component}</span>
                  <span className={styles.wfGroupHint}>CPU, RAM and disk</span>
                  <span className={styles.wfAmount}>{usdSigned(item.subtotal)}</span>
                </button>
                {open ? (
                  <ol className={styles.wfSub}>
                    {item.rows.map((r) => {
                      const k = noteKey(r, `${idx}`);
                      return (
                        <RowView
                          key={k}
                          row={r}
                          peak={peak}
                          nested
                          order={order++}
                          open={noteOpen(r, k)}
                          onToggle={() => toggleNote(r, k)}
                        />
                      );
                    })}
                  </ol>
                ) : null}
              </li>
            );
          }
          const k = noteKey(item, `${idx}`);
          return (
            <RowView
              key={k}
              row={item}
              peak={peak}
              order={order++}
              open={noteOpen(item, k)}
              onToggle={() => toggleNote(item, k)}
            />
          );
        })}
      </ol>
      <div className={styles.wfTotal}>
        <span>
          Total for{' '}
          {quote.months >= 0.95
            ? `${Number(quote.months.toFixed(1))} ${quote.months === 1 ? 'month' : 'months'}`
            : 'this subscription'}
        </span>
        <span className={styles.wfAmount}>${money(total)}</span>
      </div>
    </section>
  );
}
