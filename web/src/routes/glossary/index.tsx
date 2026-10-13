/**
 * The glossary: every term the Academy teaches, searchable and filterable, with a deep link for each.
 *
 *   /glossary                  the whole list, A to Z
 *   /glossary#fluxnode         that term, scrolled to and highlighted (the lesson cards link here)
 *   /glossary?q=port           a search; ?track=nimbus and ?kind=docker are the filters
 *
 * `/` focuses the search here (a `useHotkeyClaim`, which wins over the command deck's `/` while the
 * page is mounted). The text of each entry comes from the glossary
 * registry (`@/learn/glossary`), the same source as the lesson cards and the command deck, so a
 * definition never differs between them.
 */

import { TRACKS, type TrackId } from '@shared/curriculum';
import { routeMeta } from '@shared/site';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { AppLinkButton } from '@/app/AppLinkButton';
import { allTerms, getTerm } from '@/learn/glossary';
import type { GlossaryCategory } from '@/learn/types';
import { announce } from '@/system/announce';
import { useHotkeyClaim } from '@/system/hotkeys';
import {
  Button,
  Chip,
  Panel,
  SearchField,
  Surface,
  useElementSize,
  usePointerFine,
  useReducedMotion,
} from '@/ui';
import { useBacklinks } from './backlinks';
import styles from './glossary.module.css';
import {
  ALPHABET,
  CATEGORIES,
  type CategoryFilter,
  countLabel,
  countParts,
  facetCounts,
  filterTerms,
  groupByLetter,
  isFiltered,
  nearestTerms,
  TRACK_ORDER,
  type TrackFilter,
  termIdFromHash,
  termTracks,
} from './model';
import { TermCard } from './TermCard';
import { TermEntry } from './TermEntry';

function parseTrack(value: string | null): TrackFilter {
  return (TRACK_ORDER as readonly string[]).includes(value ?? '') ? (value as TrackId) : 'all';
}

function parseCategory(value: string | null): CategoryFilter {
  return CATEGORIES.some((c) => c.id === value) ? (value as GlossaryCategory) : 'all';
}

const TRACK_NAME: Record<TrackId, string> = Object.fromEntries(TRACKS.map((t) => [t.id, t.name])) as Record<
  TrackId,
  string
>;

export default function Glossary() {
  const meta = routeMeta('/glossary');
  const all = useMemo(() => allTerms(), []);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const reduced = useReducedMotion();
  const finePointer = usePointerFine();

  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const track = parseTrack(params.get('track'));
  const category = parseCategory(params.get('kind'));

  const searchRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toolbarSize = useElementSize(toolbarRef);
  useHotkeyClaim(
    '/',
    () => {
      const input = searchRef.current;
      if (!input || input.disabled) return false;
      input.focus();
      input.select();
      return undefined;
    },
    { scope: 'glossary', label: 'Search the glossary' },
  );

  const filters = useMemo(() => ({ query, track, category }), [query, track, category]);
  const { terms, ranked } = useMemo(() => filterTerms(all, filters), [all, filters]);
  const counts = useMemo(() => facetCounts(all, filters), [all, filters]);
  const grouped = !ranked;
  const groups = useMemo(() => (grouped ? groupByLetter(terms) : []), [grouped, terms]);
  const present = useMemo(() => new Set(groups.map((g) => g.letter)), [groups]);
  const untied = useMemo(() => all.filter((t) => termTracks(t).length === 0).length, [all]);
  const filtered = isFiltered(filters);

  const backlinks = useBacklinks();

  // ---- the URL carries the track and kind filters, and (after a pause) the search ------------------

  const writeParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true, preventScrollReset: true },
      );
    },
    [setParams],
  );

  const paramsRef = useRef(params);
  paramsRef.current = params;
  useEffect(() => {
    const text = query.trim();
    const timer = window.setTimeout(() => {
      if ((paramsRef.current.get('q') ?? '') === text) return;
      writeParams((next) => {
        if (text) next.set('q', text);
        else next.delete('q');
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, writeParams]);

  const setTrack = (value: TrackFilter) =>
    writeParams((next) => {
      if (value === 'all') next.delete('track');
      else next.set('track', value);
    });
  const setCategory = (value: CategoryFilter) =>
    writeParams((next) => {
      if (value === 'all') next.delete('kind');
      else next.set('kind', value);
    });
  const clearAll = () => {
    setQuery('');
    writeParams((next) => {
      next.delete('q');
      next.delete('track');
      next.delete('kind');
    });
  };

  // ---- a link to a term -----------------------------------------------------------------------------

  const targetId = termIdFromHash(location.hash);
  const targetTerm = targetId ? getTerm(targetId) : undefined;
  const unknownTarget = targetId && !targetTerm ? targetId : null;

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Make sure a linked term is in the list, then bring it into view and put focus on it. Focus waits a
  // moment because the shell moves focus to the page heading after a navigation and would win otherwise.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs per navigation, not per keystroke
  useEffect(() => {
    if (!targetTerm) return;
    const f = filtersRef.current;
    const visible = filterTerms(all, f).terms.some((t) => t.id === targetTerm.id);
    if (!visible) {
      setQuery('');
      writeParams((next) => {
        next.delete('q');
        next.delete('track');
        next.delete('kind');
      });
    }
    const place = window.setTimeout(() => {
      document.getElementById(targetTerm.id)?.scrollIntoView({ block: 'start' });
    }, 30);
    const focus = window.setTimeout(() => {
      document.getElementById(targetTerm.id)?.focus({ preventScroll: true });
    }, 140);
    return () => {
      window.clearTimeout(place);
      window.clearTimeout(focus);
    };
  }, [targetTerm?.id, location.key]);

  // A link to a term that does not exist: say so, and search for the words in it.
  useEffect(() => {
    if (unknownTarget) setQuery(unknownTarget.replace(/-/g, ' '));
  }, [unknownTarget]);

  // ---- the letter rail ------------------------------------------------------------------------------

  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  useEffect(() => {
    if (!grouped || groups.length === 0) {
      setActiveLetter(null);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = (toolbarRef.current?.getBoundingClientRect().bottom ?? 120) + 24;
      let current: string | null = groups[0]?.letter ?? null;
      for (const g of groups) {
        const el = document.getElementById(`letter-${g.letter}`);
        if (el && el.getBoundingClientRect().top <= line) current = g.letter;
      }
      setActiveLetter(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [grouped, groups]);

  const jumpTo = (letter: string) => {
    const el = document.getElementById(`letter-${letter}`);
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  };

  // ---- results announcement -------------------------------------------------------------------------

  const countText = countLabel(terms.length, all.length);
  const { figure: countFigure, noun: countNoun } = countParts(terms.length, all.length);
  const announced = useRef(countText);
  useEffect(() => {
    if (announced.current === countText) return;
    announced.current = countText;
    const t = window.setTimeout(() => announce(countText), 500);
    return () => window.clearTimeout(t);
  }, [countText]);

  const empty = terms.length === 0;
  const near = useMemo(
    () => (empty && query.trim() ? nearestTerms(all, query.trim(), 4) : []),
    [empty, query, all],
  );

  const barHeight = `${Math.round(toolbarSize.height)}px`;

  return (
    <div
      className={styles.page}
      data-print-page="glossary"
      style={{ '--bar-h': barHeight } as React.CSSProperties}
    >
      <header className={styles.head}>
        <p className={styles.eyebrow}>Reference</p>
        <h1 className={styles.h1} tabIndex={-1}>
          Glossary
        </h1>
        <p className={styles.lead}>{meta?.description}</p>
      </header>

      <search ref={toolbarRef} className={styles.bar} aria-label="Find a term">
        <Surface size="md" glow={false} className={styles.barSurface}>
          <div className={styles.barBody}>
            <SearchField
              ref={searchRef}
              className={styles.search}
              label="Search the glossary"
              placeholder="Search the glossary"
              value={query}
              onValueChange={setQuery}
              controls="glossary-results"
              shortcut={finePointer ? '/' : undefined}
              size="md"
            />
            <p id="glossary-count" className={styles.count} data-narrowed={terms.length !== all.length}>
              <strong>
                {countFigure}
                <span className={styles.countNoun}> {countNoun}</span>
              </strong>
            </p>
            {filtered ? (
              <Button variant="ghost" size="sm" icon="reset" onClick={clearAll}>
                <span className={styles.shortOnPhone}>Clear</span>
              </Button>
            ) : null}
          </div>
        </Surface>
      </search>

      <div className={styles.facets}>
        <fieldset className={styles.facetGroup}>
          <legend className="sr-only">Filter by track</legend>
          <span className={styles.facetLabel} aria-hidden="true">
            Track
          </span>
          {TRACK_ORDER.map((id) => (
            <Chip
              key={id}
              kind="filter"
              size="sm"
              tier={id}
              selected={track === id}
              count={counts.track[id]}
              onClick={() => setTrack(track === id ? 'all' : id)}
              disabled={counts.track[id] === 0 && track !== id}
            >
              {TRACK_NAME[id]}
            </Chip>
          ))}
        </fieldset>

        <fieldset className={styles.facetGroup}>
          <legend className="sr-only">Filter by kind of term</legend>
          <span className={styles.facetLabel} aria-hidden="true">
            Kind
          </span>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              kind="filter"
              size="sm"
              selected={category === c.id}
              count={counts.category[c.id]}
              onClick={() => setCategory(category === c.id ? 'all' : c.id)}
              disabled={counts.category[c.id] === 0 && category !== c.id}
              title={c.blurb}
            >
              {c.label}
            </Chip>
          ))}
        </fieldset>

        {track !== 'all' && untied > 0 ? (
          <p className={styles.hint}>
            The track filter leaves out {untied} terms that are not tied to a lesson.
          </p>
        ) : null}
      </div>

      {unknownTarget ? (
        <Panel variant="slab" tone="warn" padding="md" marks={false} className={styles.notice} as="section">
          <p className={styles.noticeText}>
            There is no term with the id <code>{unknownTarget}</code>. It may have been renamed. The search
            below is looking for the words in it.
          </p>
        </Panel>
      ) : null}

      <div className={styles.layout}>
        <section
          id="glossary-results"
          className={styles.results}
          aria-label="Terms"
          aria-describedby="glossary-count"
        >
          {empty ? (
            <Panel variant="slab" padding="lg" marks={false} className={styles.empty} as="section">
              <h2 className={styles.emptyTitle}>
                {query.trim() ? (
                  <>
                    No term matches <q>{query.trim()}</q>
                  </>
                ) : (
                  'No term fits these filters'
                )}
              </h2>
              <p className={styles.emptyText}>
                {query.trim()
                  ? 'Try a shorter word, or the name of the thing you saw. If you are looking at an error message or a problem rather than a word, troubleshooting is the better place.'
                  : 'The track and kind you picked do not overlap. Clear the filters to see every term.'}
              </p>
              <div className={styles.emptyActions}>
                <Button variant="secondary" size="sm" icon="reset" onClick={clearAll}>
                  Show every term
                </Button>
                <AppLinkButton
                  variant="ghost"
                  size="sm"
                  href={
                    query.trim() ? `/troubleshoot?q=${encodeURIComponent(query.trim())}` : '/troubleshoot'
                  }
                  iconEnd="arrow-right"
                >
                  Search troubleshooting
                </AppLinkButton>
                <AppLinkButton variant="ghost" size="sm" href="/learn" iconEnd="arrow-right">
                  Browse the lessons
                </AppLinkButton>
              </div>
              {near.length > 0 ? (
                <div className={styles.near}>
                  <h3 className={styles.nearTitle}>Nearest terms</h3>
                  <ul className={styles.nearList}>
                    {near.map((t) => (
                      <li key={t.id}>
                        <Panel variant="slab" padding="md" marks={false} size="sm">
                          <TermCard term={t} headingLevel={4} />
                        </Panel>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Panel>
          ) : grouped ? (
            groups.map((g) => (
              <section key={g.letter} className={styles.group} aria-labelledby={`letter-${g.letter}`}>
                <h2 id={`letter-${g.letter}`} className={styles.letter} tabIndex={-1}>
                  {g.letter}
                </h2>
                <ul className={styles.list}>
                  {g.terms.map((t) => (
                    <TermEntry
                      key={t.id}
                      term={t}
                      query=""
                      refs={backlinks.index.get(t.id) ?? []}
                      targeted={targetTerm?.id === t.id}
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <ul className={styles.list} aria-label="Search results, best match first">
              {terms.map((t) => (
                <TermEntry
                  key={t.id}
                  term={t}
                  query={query}
                  refs={backlinks.index.get(t.id) ?? []}
                  targeted={targetTerm?.id === t.id}
                />
              ))}
            </ul>
          )}
        </section>

        {grouped && !empty ? (
          <nav className={styles.rail} aria-label="Jump to a letter">
            <ul className={styles.railList}>
              {ALPHABET.map((letter) => {
                const has = present.has(letter);
                return (
                  <Fragment key={letter}>
                    <li>
                      {has ? (
                        <button
                          type="button"
                          className={styles.railLetter}
                          aria-current={activeLetter === letter ? 'location' : undefined}
                          onClick={() => jumpTo(letter)}
                        >
                          {letter}
                          <span className="sr-only"> terms</span>
                        </button>
                      ) : (
                        <span className={styles.railLetter} data-empty="true" aria-hidden="true">
                          {letter}
                        </span>
                      )}
                    </li>
                  </Fragment>
                );
              })}
              {present.has('#') ? (
                <li>
                  <button type="button" className={styles.railLetter} onClick={() => jumpTo('#')}>
                    #<span className="sr-only"> terms starting with a digit</span>
                  </button>
                </li>
              ) : null}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
