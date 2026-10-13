import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { TOPICS, type TopicMeta } from '@/content/reference';
import { cn } from '@/lib/cn';
import { Glyph } from '@/ui';
import styles from './frame.module.css';
import type { NumberedSection } from './model';
import { Ol } from './parts/Semantics';
import { SearchBox, SearchResults, type SearchState } from './Search';

export const UNVERIFIED_ID = 'unverified';

/** Short names for the switcher: the full headings are for the page itself. */
const SHORT: Readonly<Record<string, string>> = {
  spec: 'Spec',
  networking: 'Networking',
  docker: 'Docker',
  api: 'API',
  orbit: 'Orbit',
  agents: 'Agents',
};

function Toc({
  numbered,
  active,
  unverifiedCount,
  onNavigate,
}: {
  numbered: readonly NumberedSection[];
  active: string | null;
  unverifiedCount: number;
  onNavigate: () => void;
}) {
  const top = numbered.filter((s) => s.level === 2);
  const link = (s: { id: string; title: string; number: string }, level: 2 | 3) => (
    <Link
      to={{ hash: `#${s.id}` }}
      className={styles.tocLink}
      data-level={level}
      aria-current={active === s.id ? 'location' : undefined}
      onClick={onNavigate}
    >
      <span className={styles.tocNumber} aria-hidden="true">
        {level === 2 ? s.number.padStart(2, '0') : s.number}
      </span>
      <span className={styles.tocTitle}>{s.title}</span>
    </Link>
  );
  return (
    <nav aria-label="On this page" className={styles.toc}>
      <Ol className={styles.tocList}>
        {top.map((s) => {
          const kids = numbered.filter((k) => k.parent === s.id);
          return (
            <li key={s.id}>
              {link(s, 2)}
              {kids.length > 0 ? (
                <Ol className={styles.tocSub}>
                  {kids.map((k) => (
                    <li key={k.id}>{link(k, 3)}</li>
                  ))}
                </Ol>
              ) : null}
            </li>
          );
        })}
        {unverifiedCount > 0 ? (
          <li>
            <Link
              to={{ hash: `#${UNVERIFIED_ID}` }}
              className={styles.tocLink}
              data-level={2}
              data-tail="true"
              aria-current={active === UNVERIFIED_ID ? 'location' : undefined}
              onClick={onNavigate}
            >
              <span className={styles.tocNumber} aria-hidden="true">
                !
              </span>
              <span className={styles.tocTitle}>
                Unverified <span className={styles.tocCount}>{unverifiedCount}</span>
              </span>
            </Link>
          </li>
        ) : null}
      </Ol>
    </nav>
  );
}

/** Search on top, then the page's contents. While a query is typed, the results take the contents' place. */
export function ContentsPanel({
  topic,
  numbered,
  active,
  search,
  unverifiedCount,
  inputRef,
  onNavigate,
  onEscapeFromResults,
}: {
  topic: TopicMeta;
  numbered: readonly NumberedSection[];
  active: string | null;
  search: SearchState;
  unverifiedCount: number;
  inputRef: (el: HTMLInputElement | null) => void;
  onNavigate: () => void;
  onEscapeFromResults?: () => void;
}) {
  const uid = useId();
  const resultsId = `${uid}-results`;
  const [signal, setSignal] = useState(0);
  const field = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  return (
    <div className={styles.panel}>
      <nav aria-label="Reference pages" className={styles.topicSwitch}>
        {TOPICS.map((t) => (
          <Link
            key={t.id}
            to={t.path}
            className={styles.topicLink}
            aria-current={t.id === topic.id ? 'page' : undefined}
            onClick={onNavigate}
          >
            {SHORT[t.id] ?? t.name}
          </Link>
        ))}
      </nav>

      <SearchBox
        state={search}
        topic={topic.id}
        resultsId={resultsId}
        inputRef={(el) => {
          field.current = el;
          inputRef(el);
        }}
        onFirst={(entry) => {
          search.setQuery('');
          onNavigate();
          navigate(entry.path);
        }}
        onDown={() => setSignal((n) => n + 1)}
      />

      {search.active ? (
        <SearchResults
          id={resultsId}
          state={search}
          topic={topic.id}
          focusFirstSignal={signal}
          onPick={() => {
            search.setQuery('');
            onNavigate();
          }}
          onEscape={() => {
            field.current?.focus();
            onEscapeFromResults?.();
          }}
        />
      ) : (
        <Toc numbered={numbered} active={active} unverifiedCount={unverifiedCount} onNavigate={onNavigate} />
      )}
    </div>
  );
}

/**
 * Below the desktop width the rail is a bar that sticks under the header and opens the same panel in
 * place. It names the section being read, so the bar doubles as "where am I".
 */
export function MobileContents({
  title,
  open,
  onOpenChange,
  children,
}: {
  /** The section being read. */
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: (close: () => void) => ReactNode;
}) {
  const setOpen = onOpenChange;
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <div className={styles.mobileBar} data-open={open ? 'true' : undefined}>
      <button
        ref={button}
        type="button"
        className={styles.mobileToggle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <Glyph name="list" size={18} />
        <span className={styles.mobileLabel}>On this page</span>
        <span className={styles.mobileCurrent}>{title}</span>
        <span className={cn(styles.mobileChevron)} aria-hidden="true">
          <Glyph name="chevron-down" size={16} />
        </span>
      </button>
      {open ? (
        <div id={panelId} className={styles.mobilePanel}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
