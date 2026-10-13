/**
 * Search over the whole Reference, in the page. The matching is `searchReference` over `REFERENCE_INDEX`,
 * the same entries the command deck reads, so a result here is a result there.
 *
 * The field is the design system's `SearchField`; the results are a plain list of links (a combobox
 * pattern would need `role="combobox"` on the field, which `SearchField` fixes to `searchbox`). Keyboard:
 * Down from the field enters the list, Up and Down move through it, Escape goes back to the field, and
 * Enter in the field opens the first result.
 */

import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  REFERENCE_INDEX,
  type ReferenceEntry,
  type ReferenceKind,
  type SearchHit,
  searchReference,
  type TopicId,
} from '@/content/reference';
import { highlight } from '@/content/reference/search';
import { announce } from '@/system/announce';
import { SearchField, SegmentedControl } from '@/ui';
import styles from './frame.module.css';
import { Ul } from './parts/Semantics';

export type SearchScope = 'page' | 'all';

const LIMIT = 40;

export interface SearchState {
  query: string;
  setQuery: (q: string) => void;
  scope: SearchScope;
  setScope: (s: SearchScope) => void;
  hits: readonly SearchHit[];
  /** Matches on the other pages, when this page has none. */
  elsewhere: number;
  active: boolean;
}

/** The query, its scope and the ranked hits. `topic` is the page being read, or null on the index. */
export function useReferenceSearch(topic: TopicId | null): SearchState {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>(topic ? 'page' : 'all');
  const effective: SearchScope = topic ? scope : 'all';

  const hits = useMemo(
    () =>
      searchReference(REFERENCE_INDEX, query, {
        limit: LIMIT,
        topic: effective === 'page' && topic ? topic : undefined,
      }),
    [query, effective, topic],
  );
  const elsewhere = useMemo(() => {
    if (effective !== 'page' || query.trim() === '' || hits.length > 0) return 0;
    return searchReference(REFERENCE_INDEX, query, { limit: LIMIT }).length;
  }, [effective, query, hits.length]);

  // Say the count once typing pauses, so a screen reader hears the answer and not every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q === '') return undefined;
    const t = window.setTimeout(() => {
      announce(hits.length === 0 ? `No results for ${q}.` : `${hits.length} results for ${q}.`);
    }, 600);
    return () => window.clearTimeout(t);
  }, [query, hits.length]);

  return {
    query,
    setQuery,
    scope: effective,
    setScope,
    hits,
    elsewhere,
    active: query.trim() !== '',
  };
}

const KIND_LABEL: Readonly<Record<ReferenceKind, string>> = {
  page: 'Page',
  section: 'Section',
  field: 'Field',
  lint: 'Lint code',
  endpoint: 'Endpoint',
  tool: 'Tool',
  fact: 'Note',
};

/** Keys, codes and routes read better in mono. */
function isCode(kind: ReferenceKind): boolean {
  return kind === 'field' || kind === 'lint' || kind === 'endpoint';
}

const TOPIC_NAME: Readonly<Record<TopicId, string>> = {
  spec: 'Application spec',
  networking: 'Networking',
  docker: 'Docker',
  api: 'API',
  orbit: 'Orbit',
  agents: 'Agents and MCP',
};

function Mark({ text, query }: { text: string; query: string }): ReactNode {
  return highlight(text, query).map((seg, i) =>
    seg.match ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: segments of one string, never reordered
      <mark key={i} className={styles.mark}>
        {seg.text}
      </mark>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: segments of one string, never reordered
      <span key={i}>{seg.text}</span>
    ),
  );
}

/** The search field, with its scope switch when the page has one. */
export function SearchBox({
  state,
  topic,
  inputRef,
  resultsId,
  shortcut = true,
  onFirst,
  onDown,
}: {
  state: SearchState;
  /** The topic being read: gives the scope switch. Null on the index. */
  topic: TopicId | null;
  inputRef?: (el: HTMLInputElement | null) => void;
  resultsId: string;
  shortcut?: boolean;
  /** Enter pressed with at least one result. */
  onFirst: (entry: ReferenceEntry) => void;
  onDown: () => void;
}) {
  return (
    <div className={styles.searchBox}>
      <SearchField
        ref={inputRef}
        label="Search the reference"
        placeholder={topic ? 'Search the reference' : 'Search every reference page'}
        value={state.query}
        onValueChange={state.setQuery}
        shortcut={shortcut ? '/' : undefined}
        controls={resultsId}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'ArrowDown' && state.hits.length > 0) {
            e.preventDefault();
            onDown();
          }
        }}
        onSubmit={() => {
          const first = state.hits[0]?.entry;
          if (first) onFirst(first);
        }}
        data-ref-search=""
      />
      {topic ? (
        <SegmentedControl
          size="sm"
          aria-label="Where to search"
          value={state.scope}
          onValueChange={(v) => state.setScope(v === 'all' ? 'all' : 'page')}
          options={[
            { value: 'page', label: 'This page' },
            { value: 'all', label: 'All reference' },
          ]}
        />
      ) : null}
    </div>
  );
}

/** The ranked list. `id` is what the field's `aria-controls` names. */
export function SearchResults({
  id,
  state,
  topic,
  onPick,
  focusFirstSignal,
  onEscape,
}: {
  id: string;
  state: SearchState;
  topic: TopicId | null;
  onPick: () => void;
  /** Changes when the field asks to move into the list. */
  focusFirstSignal: number;
  onEscape: () => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (focusFirstSignal === 0) return;
    list.current?.querySelector<HTMLAnchorElement>('a[data-result]')?.focus();
  }, [focusFirstSignal]);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = [...(list.current?.querySelectorAll<HTMLAnchorElement>('a[data-result]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      onEscape();
      return;
    }
    let next = -1;
    if (e.key === 'ArrowDown') next = Math.min(items.length - 1, at + 1);
    else if (e.key === 'ArrowUp') next = at <= 0 ? -2 : at - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else return;
    e.preventDefault();
    if (next === -2) onEscape();
    else items[next]?.focus();
  };

  const q = state.query.trim();
  const [announceTick, setAnnounceTick] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a tick per query keeps the status text fresh
  useEffect(() => setAnnounceTick((n) => n + 1), [q]);

  if (!state.active) return null;

  return (
    <div className={styles.results} id={id}>
      <p className={styles.resultsCount} role="status" data-tick={announceTick}>
        {state.hits.length === 0
          ? `No results for “${q}”${topic && state.scope === 'page' ? ' on this page' : ''}.`
          : `${state.hits.length} ${state.hits.length === 1 ? 'result' : 'results'}${
              topic && state.scope === 'page' ? ' on this page' : ''
            }`}
      </p>
      {state.hits.length === 0 ? (
        <div className={styles.resultsEmpty}>
          {state.elsewhere > 0 ? (
            <button type="button" className={styles.linkButton} onClick={() => state.setScope('all')}>
              Show {state.elsewhere} {state.elsewhere === 1 ? 'result' : 'results'} on the other pages
            </button>
          ) : (
            <p>
              Try a field name such as <code>containerPorts</code>, a lint code such as{' '}
              <code>PORT_BANNED</code>, or a word such as <em>localhost</em>.
            </p>
          )}
        </div>
      ) : (
        <Ul ref={list} className={styles.resultList} onKeyDown={onKeyDown}>
          {state.hits.map(({ entry }) => (
            <li key={entry.id}>
              <Link
                to={entry.path}
                className={styles.hit}
                data-result=""
                data-kind={entry.kind}
                onClick={(e) => {
                  // Let the browser keep modified clicks (new tab, new window).
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onPick();
                  navigate(entry.path);
                }}
              >
                <span className={styles.hitKind}>{KIND_LABEL[entry.kind]}</span>
                <span className={styles.hitTitle} data-code={isCode(entry.kind) ? 'true' : undefined}>
                  <Mark text={entry.title} query={q} />
                </span>
                <span className={styles.hitGroup}>
                  {state.scope === 'all' && entry.kind !== 'page'
                    ? `${TOPIC_NAME[entry.topic]}, ${entry.group.replace(/^[^,]+,\s*/, '')}`
                    : entry.group}
                </span>
                <span className={styles.hitSummary}>
                  <Mark text={entry.summary} query={q} />
                </span>
              </Link>
            </li>
          ))}
        </Ul>
      )}
    </div>
  );
}
