/**
 * The command deck (docs/DESIGN.md section 6): Ctrl/Cmd+K or `/` opens a glass modal with a mono prompt
 * and grouped fuzzy results (Actions, Lessons, Labs, Reference, Fix it, Pages, Glossary), highlighted
 * matches, arrows, Enter, Esc and recent items. A leading `>` asks the network (`> block`, `> nodes`,
 * `> price`, `> tiers`, `> quote 2 4000 20 3`). A glossary result opens its card in place.
 *
 * Reference and Fix it reach into the Reference and troubleshooting content (every field, lint code and
 * error message). That content is not in this chunk: it loads on demand (`deep.ts`), and the rows are
 * the pages' own search results, so Enter lands on the same anchor the page would.
 *
 * Focus is trapped and the page behind is inert (the design system's modal stack), the deck is a
 * combobox over a listbox, and focus returns to what opened it.
 */

import {
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { getOverlayLayer } from '@/app/Portal';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/cn';
import { useHotkeyScope } from '@/system/hotkeys';
import { useOverlays } from '@/system/overlays';
import { toast } from '@/system/toasts';
import { Chip, Glyph, IconButton, Kbd, Panel, type PresenceState, useFocusTrap, usePresence } from '@/ui';
import { AskView } from './AskView';
import { type Answer, parseAsk } from './ask';
import styles from './Deck.module.css';
import { DEEP } from './deep';
import { deepSearch } from './deepLoaders';
import { type Range, segments } from './fuzzy';
import { buildItems, type DeckItem } from './items';
import { type DeckGroup, type DeckRow, rank } from './rank';
import { loadRecents, pushRecent, saveRecents } from './recents';
import { describeActions, runItem } from './run';
import { browserRunEnv } from './runEnv';
import { TermCard } from './TermCard';
import { useDeckContext } from './useDeckContext';
import { useScrollRegion } from './useScrollRegion';

const EXIT_MS = 340;

/** How long the deck stays open before it fetches the Reference and troubleshooting content. */
const DEEP_PREFETCH_MS = 250;

/** Said when the connection is metered and the Reference and troubleshooting were left out of a search. */
const METERED_NOTE = 'Reference and troubleshooting are not searched while Data Saver is on.';

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function Highlight({ text, ranges }: { text: string; ranges: readonly Range[] }) {
  if (ranges.length === 0) return <>{text}</>;
  return (
    <>
      {segments(text, ranges).map((s, i) =>
        s.hit ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments of one string are static and ordered
          <span key={i} className={styles.hit}>
            {s.text}
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments of one string are static and ordered
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

function Tile({ tile }: { tile: DeckItem['tile'] }) {
  if ('swatch' in tile) {
    return (
      <span
        className={styles.tile}
        data-swatch=""
        style={{ '--swatch': tile.swatch } as React.CSSProperties}
        aria-hidden="true"
      />
    );
  }
  if ('text' in tile) {
    return (
      <span className={styles.tile} aria-hidden="true">
        {tile.text}
      </span>
    );
  }
  return (
    <span className={styles.tile} aria-hidden="true">
      <Glyph name={tile.glyph} size={18} />
    </span>
  );
}

interface RowViewProps {
  row: DeckRow;
  id: string;
  active: boolean;
  /** The pointer moved over this row (with its client position, to tell real moves from scroll). */
  onPointer: (id: string, x: number, y: number) => void;
  onRun: (row: DeckRow) => void;
}

const RowView = memo(function RowView({ row, id, active, onPointer, onRun }: RowViewProps) {
  const { item } = row;
  const stateLabel =
    item.state === 'on' ? 'On' : item.state === 'off' ? 'Off' : item.state === 'current' ? 'Current' : null;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard use is through the combobox input (aria-activedescendant)
    // biome-ignore lint/a11y/useFocusableInteractive: options are never focused; the combobox points at them
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-active={active ? 'true' : 'false'}
      className={cn('chamfer', styles.row)}
      onMouseDown={(e) => e.preventDefault()}
      onPointerMove={(e) => onPointer(item.id, e.clientX, e.clientY)}
      onClick={() => onRun(row)}
    >
      <Tile tile={item.tile} />
      <span className={styles.text}>
        <span className={styles.title}>
          <Highlight text={item.title} ranges={row.titleRanges} />
        </span>
        <span className={styles.sub}>
          <Highlight text={item.subtitle} ranges={row.subRanges} />
        </span>
      </span>
      <span className={styles.trail}>
        {item.meta ? <span className={styles.meta}>{item.meta}</span> : null}
        {item.badge ? (
          <span className={styles.tag} data-tone={item.badgeTone ?? 'accent'}>
            {item.badge}
          </span>
        ) : null}
        {stateLabel ? (
          <span className={styles.tag} data-tone={item.state === 'off' ? undefined : 'accent'}>
            {stateLabel}
          </span>
        ) : null}
        {item.chord ? (
          <span className={cn(styles.hintKeys, styles.chord)} aria-hidden="true">
            {item.chord.map((k, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a chord can repeat a key (g g)
              <Kbd size="sm" key={`${i}:${k}`}>
                {k.length === 1 ? k.toUpperCase() : k}
              </Kbd>
            ))}
          </span>
        ) : null}
        {item.external ? (
          <>
            <Glyph name="arrow-up-right" size={15} className={styles.external} />
            <span className="sr-only">Opens in a new tab</span>
          </>
        ) : (
          <Glyph name="arrow-right" size={15} className={styles.enter} />
        )}
      </span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// The deck
// ---------------------------------------------------------------------------

function closeDeck(): void {
  useOverlays.getState().closeDeck();
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** The deck's content, mounted only while it is open (so each opening starts fresh). */
function DeckSurface({ open, state }: { open: boolean; state: PresenceState }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const answerRef = useRef<Answer | null>(null);
  const lastInput = useRef<'key' | 'pointer'>('key');
  const uid = useId();
  const listId = `${uid}-list`;
  const statusId = `${uid}-status`;
  const optionId = useCallback((index: number) => `${uid}-opt-${index}`, [uid]);

  const ctx = useDeckContext();
  const items = useMemo(() => buildItems(ctx), [ctx]);
  const validIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  // A seed from the overlay store ("> block" from the header chip, a missing page's words) starts it.
  const [seed] = useState(() => useOverlays.getState().deckSeed);
  const seedAsk = seed.trimStart().startsWith('>');
  const [recents, setRecents] = useState<string[]>(() => loadRecents((id) => validIds.has(id)));
  const [query, setQuery] = useState(() => {
    if (seedAsk) return seed.trimStart().slice(1).trimStart();
    // The words of a missing address are a guess: keep them only when they find something, so the
    // first thing a visitor sees is never "No match".
    return seed && rank(items, seed).rows.length > 0 ? seed : '';
  });
  const [ask, setAsk] = useState(seedAsk);
  const [termId, setTermId] = useState<string | null>(null);
  // The list scrolls, and in a combobox focus stays in the input: while it overflows it is also a
  // focusable region, so a keyboard user can scroll it and a screen reader can name it.
  const list = useScrollRegion<HTMLDivElement>(termId ? 'Definition' : 'Search results');
  const listRef = list.ref;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const queryRef = useRef(query);
  queryRef.current = query;

  // A seed made of a missing page's words is a suggestion: selected, so typing replaces it.
  useEffect(() => {
    if (!seed || seedAsk || queryRef.current !== seed) return;
    const frame = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(frame);
  }, [seed, seedAsk]);

  // ---- the Reference and troubleshooting, on demand -----------------------------------------------

  // Started a moment after the deck opens, and at once on a query of two characters (the page may have
  // been open for less than a beat). On a metered connection it waits for the visitor.
  const deepVersion = useSyncExternalStore(deepSearch.subscribe, deepSearch.version, deepSearch.version);
  const deepStatus = deepSearch.status();
  useEffect(() => {
    const t = window.setTimeout(() => void deepSearch.start(), DEEP_PREFETCH_MS);
    return () => window.clearTimeout(t);
  }, []);
  const wantsDeep = !ask && !termId && query.trim().length >= DEEP.minQuery;
  useEffect(() => {
    if (wantsDeep) void deepSearch.start();
  }, [wantsDeep]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `deepVersion` says a source arrived
  const deepHits = useMemo(
    () => (wantsDeep ? deepSearch.search(query) : []),
    [wantsDeep, query, deepVersion],
  );

  // ---- ranking --------------------------------------------------------------------------

  const ranked = useMemo(
    () =>
      ask || termId
        ? { groups: [], rows: [], total: 0, tokens: [] }
        : rank(items, query, { recents, deep: deepHits }),
    [items, query, recents, ask, termId, deepHits],
  );
  // Nothing found yet, and the answer may still be on its way: do not say "No match" too soon.
  const searching = wantsDeep && deepStatus === 'loading' && ranked.rows.length === 0;
  const metered = wantsDeep && deepStatus === 'skipped';

  const view = useMemo<{ groups: DeckGroup[]; rows: DeckRow[]; empty: boolean }>(() => {
    if (ask || termId) return { groups: [], rows: [], empty: false };
    if (ranked.rows.length > 0 || query.trim() === '' || searching) {
      return { groups: ranked.groups, rows: ranked.rows, empty: false };
    }
    return { groups: [], rows: [], empty: true };
  }, [ranked, query, ask, termId, searching]);

  const activeIndex = useMemo(() => {
    if (view.rows.length === 0) return -1;
    const at = activeId ? view.rows.findIndex((r) => r.item.id === activeId) : -1;
    return at < 0 ? 0 : at;
  }, [view.rows, activeId]);
  const activeRow = activeIndex >= 0 ? (view.rows[activeIndex] ?? null) : null;

  // ---- running -------------------------------------------------------------------------------

  const remember = useCallback((item: DeckItem) => {
    if (item.transient) return;
    setRecents((prev) => {
      const next = pushRecent(prev, item.id);
      saveRecents(next);
      return next;
    });
  }, []);

  const activate = useCallback(
    (row: DeckRow, how: 'primary' | 'secondary') => {
      const item = row.item;
      const mode = how === 'secondary' && describeActions(item).secondary ? 'secondary' : 'primary';

      // Settings, the term card and the `>` mode keep the deck open: nice to flip and watch.
      if (item.keepOpen && !(item.kind === 'term' && mode === 'secondary')) {
        const result = runItem(item, mode, browserRunEnv);
        if (result.terminal) {
          setAsk(true);
          setQuery('');
          setActiveId(null);
          requestAnimationFrame(() => inputRef.current?.focus());
        }
        if (result.term) {
          remember(item);
          setTermId(result.term);
        }
        if (result.announce) setStatus(result.announce);
        return;
      }
      remember(item);
      // Close first so focus returns to where the visitor was; then act on the next frame, so a
      // navigation or the shortcuts sheet sees the right element focused.
      closeDeck();
      requestAnimationFrame(() => runItem(item, mode, browserRunEnv));
    },
    [remember],
  );

  // Hover selects, but only a real move: content scrolling under a still pointer must not steal the
  // selection from the keys.
  const lastPointer = useRef({ x: Number.NaN, y: Number.NaN });
  const onPointer = useCallback((id: string, x: number, y: number) => {
    const p = lastPointer.current;
    if (p.x === x && p.y === y) return;
    lastPointer.current = { x, y };
    lastInput.current = 'pointer';
    setActiveId((cur) => (cur === id ? cur : id));
  }, []);

  const onRunRow = useCallback((row: DeckRow) => activate(row, 'primary'), [activate]);

  // ---- keyboard ----------------------------------------------------------------------------------

  const move = (delta: number) => {
    const n = view.rows.length;
    if (n === 0) return;
    const wrap = Math.abs(delta) === 1;
    const next = wrap ? (activeIndex + delta + n) % n : Math.min(n - 1, Math.max(0, activeIndex + delta));
    lastInput.current = 'key';
    setActiveId(view.rows[next]?.item.id ?? null);
  };

  const leaveAsk = () => {
    setAsk(false);
    setQuery('');
    setActiveId(null);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'PageDown':
        e.preventDefault();
        move(6);
        break;
      case 'PageUp':
        e.preventDefault();
        move(-6);
        break;
      case 'Enter': {
        e.preventDefault();
        if (termId) {
          closeDeck();
          const id = termId;
          requestAnimationFrame(() => browserRunEnv.navigate(`/glossary#${id}`));
          break;
        }
        if (ask) {
          const answer = answerRef.current;
          if (answer && parseAsk(queryRef.current).type !== 'empty') {
            void copyText(answer.plain).then((ok) => {
              if (ok) toast.success('Answer copied');
              else toast.error('Could not copy the answer');
            });
          }
          break;
        }
        if (activeRow) activate(activeRow, e.shiftKey ? 'secondary' : 'primary');
        break;
      }
      case 'Backspace':
        if (ask && query === '') {
          e.preventDefault();
          leaveAsk();
        }
        break;
    }
  };

  const onChange = (value: string) => {
    setActiveId(null);
    lastInput.current = 'key';
    if (termId) setTermId(null);
    if (value.startsWith('>')) {
      // A leading `>` is the mode, not part of the question.
      setAsk(true);
      setQuery(value.slice(1).trimStart());
      return;
    }
    setQuery(value);
  };

  // Ctrl or Cmd+K again closes it, wherever focus is inside.
  const onSurfaceKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      closeDeck();
    }
  };

  // ---- effects --------------------------------------------------------------------------------------

  useFocusTrap(surface, {
    active: open,
    initialFocus: 'first',
    onEscape: () => {
      // Escape steps back (card to results, then close): it never throws away a typed query by accident.
      if (termId) setTermId(null);
      else closeDeck();
    },
  });
  useHotkeyScope('deck', { active: open, exclusive: true });

  // Keep the active row in view when the keys moved it.
  const activeItemId = activeRow?.item.id ?? null;
  useEffect(() => {
    if (lastInput.current !== 'key' || activeIndex < 0 || activeItemId === null) return;
    if (activeIndex === 0) {
      listRef.current?.scrollTo({ top: 0 });
      return;
    }
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, activeItemId, optionId, listRef]);

  // The on-screen keyboard shrinks the visual viewport: size the list to what is visible.
  useEffect(() => {
    const vv = window.visualViewport;
    const root = rootRef.current;
    if (!vv || !root) return;
    const apply = () => root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    apply();
    vv.addEventListener('resize', apply);
    return () => vv.removeEventListener('resize', apply);
  }, []);

  // One polite announcement of how many results, a moment after typing stops.
  useEffect(() => {
    if (ask || termId || query.trim() === '') return;
    const t = window.setTimeout(() => {
      if (searching) setStatus('Searching the reference and troubleshooting');
      else if (view.empty) setStatus(metered ? `No results. ${METERED_NOTE}` : 'No results');
      else setStatus(plural(ranked.total, 'result'));
    }, 350);
    return () => window.clearTimeout(t);
  }, [query, ask, termId, ranked.total, view.empty, searching, metered]);

  // In the `>` mode, announce the answer once per command, not once per second.
  const answerKey = useRef('');
  const onAnswer = useCallback((answer: Answer) => {
    answerRef.current = answer;
    const key = answer.command + answer.title;
    if (answerKey.current === key) return;
    answerKey.current = key;
    setStatus(answer.summary);
  }, []);

  // ---- render --------------------------------------------------------------------------------------------

  const keys = activeRow ? describeActions(activeRow.item) : null;
  const fieldAria =
    ask || termId
      ? { 'aria-describedby': statusId }
      : {
          role: 'combobox' as const,
          'aria-expanded': true,
          'aria-haspopup': 'listbox' as const,
          'aria-controls': listId,
          'aria-activedescendant': activeIndex >= 0 ? optionId(activeIndex) : undefined,
          'aria-autocomplete': 'list' as const,
        };
  const [compact] = useState(() => window.matchMedia?.('(max-width: 720px)').matches ?? false);
  const placeholder = ask
    ? compact
      ? 'block, nodes, price, tiers'
      : 'block, nodes, price, tiers, quote 2 4000 20 3'
    : compact
      ? 'Search the Academy'
      : 'Search, or type > to ask the network';

  return (
    <div ref={rootRef} className={styles.root} data-state={state}>
      <div className={styles.scrim} onPointerDown={closeDeck} aria-hidden="true" />
      <div
        ref={surface}
        className={styles.stack}
        role="dialog"
        aria-modal="true"
        aria-label="Command deck"
        tabIndex={-1}
        onKeyDown={onSurfaceKeyDown}
      >
        <Panel
          variant="glass"
          size="lg"
          padding="none"
          hot="tr"
          pattern="bl"
          className={styles.deck}
          contentClassName={styles.inner}
        >
          <div className={styles.head}>
            {ask ? (
              <span className={styles.promptChar} aria-hidden="true">
                &gt;
              </span>
            ) : (
              <Glyph name="search" size={20} className={styles.promptGlyph} />
            )}
            <input
              ref={inputRef}
              className={styles.input}
              data-autofocus=""
              type="text"
              aria-label={ask ? 'Ask the network' : 'Search the Academy'}
              {...fieldAria}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint={ask ? 'done' : 'go'}
              placeholder={placeholder}
              value={query}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className={styles.headTools}>
              {ask ? (
                <Chip size="sm" tone="accent" icon="terminal" className={styles.mode}>
                  Ask
                </Chip>
              ) : null}
              <IconButton
                icon="close"
                label="Close the command deck"
                size="sm"
                variant="ghost"
                tooltip={false}
                onClick={closeDeck}
              />
            </div>
          </div>

          {termId ? (
            <div ref={list.ref} {...list.props} className={styles.list}>
              <TermCard
                id={termId}
                onBack={() => {
                  setTermId(null);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                onOpenTerm={(id) => setTermId(id)}
                onNavigate={closeDeck}
              />
            </div>
          ) : ask ? (
            <AskView text={query} onAnswer={onAnswer} />
          ) : (
            <div ref={list.ref} {...list.props} className={styles.list}>
              {view.empty ? (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>
                    {metered ? 'No match in the lessons or glossary' : 'No match'}
                  </p>
                  {metered ? null : (
                    <p className={styles.emptyText}>
                      Try a lesson name, a Flux term, an error message or a lint code, or type &gt; to ask the
                      network.
                    </p>
                  )}
                </div>
              ) : null}
              {searching ? (
                <div className={styles.empty}>
                  <p className={styles.emptyText}>Searching the reference and troubleshooting.</p>
                </div>
              ) : null}
              <div role="listbox" id={listId} aria-label="Results">
                {view.groups.map((group) => {
                  const labelId = `${uid}-g-${group.id}`;
                  return (
                    // biome-ignore lint/a11y/useSemanticElements: ARIA group inside a listbox
                    <div role="group" aria-labelledby={labelId} key={group.id}>
                      <div id={labelId} className={styles.groupHead} role="presentation">
                        <span>{group.label}</span>
                        <span className={styles.groupCount}>{group.rows.length}</span>
                      </div>
                      {group.rows.map((row) => (
                        <RowView
                          key={`${group.id}:${row.item.id}`}
                          row={row}
                          id={optionId(row.index)}
                          active={row.index === activeIndex}
                          onPointer={onPointer}
                          onRun={onRunRow}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
              {metered ? (
                <div className={styles.deepNote}>
                  <span>{METERED_NOTE}</span>
                  <button
                    type="button"
                    className={styles.deepNoteButton}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void deepSearch.load()}
                  >
                    Search them
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <div className={styles.foot}>
            {termId ? (
              <>
                <span className={styles.hint}>
                  <Kbd size="sm">↵</Kbd> Open in glossary
                </span>
                <span className={styles.hint}>
                  <Kbd size="sm">Esc</Kbd> Back
                </span>
              </>
            ) : ask ? (
              <>
                <span className={styles.hint}>
                  <Kbd size="sm">↵</Kbd> Copy answer
                </span>
                <span className={styles.hint}>
                  <Kbd size="sm">⌫</Kbd> Back
                </span>
              </>
            ) : (
              <>
                <span className={styles.hint}>
                  <span className={styles.hintKeys}>
                    <Kbd size="sm">↑</Kbd>
                    <Kbd size="sm">↓</Kbd>
                  </span>{' '}
                  Move
                </span>
                {keys ? (
                  <span className={styles.hint}>
                    <Kbd size="sm">↵</Kbd> {keys.primary}
                  </span>
                ) : null}
                {keys?.secondary ? (
                  <span className={styles.hint}>
                    <span className={styles.hintKeys}>
                      <Kbd size="sm">⇧</Kbd>
                      <Kbd size="sm">↵</Kbd>
                    </span>{' '}
                    {keys.secondary}
                  </span>
                ) : (
                  <span className={styles.hint}>
                    <Kbd size="sm">&gt;</Kbd> Ask
                  </span>
                )}
              </>
            )}
            {termId ? null : (
              <span className={cn(styles.hint, styles.escHint)}>
                <Kbd size="sm">Esc</Kbd> Close
              </span>
            )}
            {!ask && !termId && query.trim() !== '' && !view.empty ? (
              <span className={styles.count}>{plural(ranked.total, 'result')}</span>
            ) : null}
          </div>
        </Panel>
        <div id={statusId} className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {status}
        </div>
      </div>
    </div>
  );
}

/** Mounted by the shell; renders nothing until opened. */
export default function Deck() {
  const open = useOverlays((s) => s.deck);
  const { mounted, state } = usePresence(open, EXIT_MS);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(<DeckSurface open={open} state={state} />, getOverlayLayer('palette'));
}
