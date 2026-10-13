/**
 * The country list of the Network Lab: the keyboard and touch equivalent of the bench. Each row is a
 * button. Hovering or focusing a row lights that country on the bench (and the other way round: a pillar
 * hovered on the bench lights its row), and pressing a row pins it, which is how a touch screen does
 * "hover". The list is one tab stop; the arrow keys move between rows.
 */
import { type KeyboardEvent, useEffect, useId, useMemo, useRef } from 'react';
import { formatInt, formatShare } from '@/lib/format';
import { SearchField } from '@/ui';
import styles from './CountryList.module.css';
import { type CountryRow, TIERS_ASC, type TierFilter } from './model';

export interface CountryListProps {
  rows: readonly CountryRow[];
  tier: TierFilter;
  query: string;
  onQuery: (value: string) => void;
  /** The country under the pointer or focus on the list or the bench, or null. */
  hot: string | null;
  /** A country the visitor pressed, kept lit. */
  pinned: string | null;
  /** The country the bench is pointing at. Scrolls its row into view. */
  fromBench: string | null;
  onPreview: (code: string | null) => void;
  onPin: (code: string) => void;
  /** Distinct countries explored so far and the goal, for the medal line. */
  explored: number;
  goal: number;
  medalEarned: boolean;
  loading: boolean;
  className?: string;
}

const TIER_VAR = { cumulus: '--cumulus', nimbus: '--nimbus', stratus: '--stratus' } as const;

export function CountryList({
  rows,
  tier,
  query,
  onQuery,
  hot,
  pinned,
  fromBench,
  onPreview,
  onPin,
  explored,
  goal,
  medalEarned,
  loading,
  className,
}: CountryListProps) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  // One tab stop: the pinned row, else the hot one, else the first.
  const tabCode = useMemo(() => {
    const keep = [pinned, hot].find((c) => c && rows.some((r) => r.code === c));
    return keep ?? rows[0]?.code ?? null;
  }, [pinned, hot, rows]);

  // A pillar hovered on the bench brings its row into view, inside the list only (the page never moves).
  useEffect(() => {
    if (!fromBench) return;
    const list = listRef.current;
    const row = rowRefs.current.get(fromBench);
    if (!list || !row) return;
    const top = row.offsetTop - list.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTo({ top: Math.max(0, top - 8) });
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: bottom - list.clientHeight + 8 });
    }
  }, [fromBench]);

  const move = (current: string, delta: number | 'first' | 'last') => {
    const i = rows.findIndex((r) => r.code === current);
    if (i < 0) return;
    const next =
      delta === 'first'
        ? 0
        : delta === 'last'
          ? rows.length - 1
          : Math.min(rows.length - 1, Math.max(0, i + delta));
    const code = rows[next]?.code;
    if (code) rowRefs.current.get(code)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const code = (e.target as HTMLElement).closest<HTMLElement>('[data-code]')?.dataset.code;
    if (!code) return;
    let handled = true;
    switch (e.key) {
      case 'ArrowDown':
        move(code, 1);
        break;
      case 'ArrowUp':
        move(code, -1);
        break;
      case 'PageDown':
        move(code, 8);
        break;
      case 'PageUp':
        move(code, -8);
        break;
      case 'Home':
        move(code, 'first');
        break;
      case 'End':
        move(code, 'last');
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };

  const tierLabel = tier === 'all' ? 'all tiers' : tier;
  const progress = Math.min(1, explored / goal);

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} data-explain="countries-list">
      <div className={styles.head}>
        <h2 className={styles.title}>Countries</h2>
        <p className={styles.sub}>{loading ? 'Loading' : `${formatInt(rows.length)} shown, ${tierLabel}`}</p>
      </div>

      <SearchField
        label="Find a country"
        placeholder="Find a country"
        value={query}
        onValueChange={onQuery}
        controls={listId}
        clearLabel="Clear the country search"
      />

      <ul
        id={listId}
        ref={listRef}
        className={styles.list}
        aria-label={`Countries by node count, ${tierLabel}`}
        onKeyDown={onKeyDown}
      >
        {rows.map((r) => {
          const parts = TIERS_ASC.filter((t) => tier === 'all' || t === tier).map((t) => ({
            tier: t,
            n: r.tiers[t],
          }));
          const isHot = hot === r.code;
          const isPinned = pinned === r.code;
          return (
            <li key={r.code} className={styles.item}>
              <button
                type="button"
                ref={(el) => {
                  if (el) rowRefs.current.set(r.code, el);
                  else rowRefs.current.delete(r.code);
                }}
                className={styles.row}
                data-code={r.code}
                data-hot={isHot ? '' : undefined}
                aria-pressed={isPinned}
                tabIndex={r.code === tabCode ? 0 : -1}
                onPointerEnter={() => onPreview(r.code)}
                onPointerLeave={(e) => {
                  // A row focused with the keyboard stays lit; one the mouse merely clicked does not.
                  if (!e.currentTarget.matches(':focus-visible')) onPreview(null);
                }}
                onFocus={() => onPreview(r.code)}
                onBlur={() => onPreview(null)}
                onClick={() => onPin(r.code)}
              >
                <span className={styles.name}>{r.name}</span>
                <span className={styles.count}>
                  {formatInt(r.nodes)}
                  <span className="sr-only"> nodes</span>
                </span>
                <span className={styles.share}>{formatShare(r.share, 1)}</span>
                <span className={styles.bar} aria-hidden="true">
                  <span className={styles.fill} style={{ inlineSize: `${Math.max(2, r.bar * 100)}%` }}>
                    {parts.map((p) =>
                      p.n > 0 ? (
                        <i key={p.tier} style={{ flexGrow: p.n, background: `var(${TIER_VAR[p.tier]})` }} />
                      ) : null,
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {!loading && rows.length === 0 ? (
          <li className={styles.empty}>
            {query.trim() ? `No country matches "${query.trim()}".` : 'No country has a node in this tier.'}
          </li>
        ) : null}
      </ul>

      <p className={styles.medal} data-earned={medalEarned ? '' : undefined}>
        <span className={styles.medalBar} aria-hidden="true">
          <span style={{ inlineSize: `${(medalEarned ? 1 : progress) * 100}%` }} />
        </span>
        <span>
          {medalEarned
            ? 'Globetrotter earned.'
            : `${Math.min(explored, goal)} of ${goal} different countries seen. Hover or focus a country to count it.`}
        </span>
      </p>
    </div>
  );
}
