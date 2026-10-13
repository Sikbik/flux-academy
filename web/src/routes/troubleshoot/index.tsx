/**
 * Troubleshoot a deployment.
 *
 *   /troubleshoot                    where are you stuck, or look something up
 *   /troubleshoot#stage-running      the problems of one stage
 *   /troubleshoot#app-stuck-installing   one problem, answered (any symptom id)
 *   /troubleshoot#messages           the error message decoder   (#message-<id> opens one)
 *   /troubleshoot#codes              the lint code list          (#code-PORT_FEE opens one)
 *   /troubleshoot?q=PORT_FEE         the search, filled in (a pasted error message works too)
 *   /troubleshoot?app=myapp&domain=app.example.com#connection-refused   fills commands and addresses
 *
 * The data is `@/content/troubleshoot` (symptoms with ranked causes, checks, fixes and evidence). This
 * file only wires the URL, the search and the views together. `/` focuses the search here.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useDocumentMeta } from '@/app/meta';
import { STAGES, stageById, symptomsOfStage } from '@/content/troubleshoot';
import { readItem, writeItem } from '@/lib/storage';
import { announce } from '@/system/announce';
import { useHotkeyClaim } from '@/system/hotkeys';
import {
  type BreadcrumbItem,
  type BreadcrumbLinkProps,
  Breadcrumbs,
  Callout,
  Chip,
  Kbd,
  Panel,
  SearchField,
  usePointerFine,
} from '@/ui';
import { CodesView } from './CodesView';
import { Landing } from './Landing';
import { MessagesView } from './MessagesView';
import { cleanNames, hrefOf, MAX_QUERY, neededNames, parseHash, search, totalHits, type View } from './model';
import { NamesContext } from './names';
import { SearchResults } from './SearchResults';
import { StageView } from './StageView';
import { StillStuck } from './StillStuck';
import { SymptomView } from './SymptomView';
import styles from './troubleshoot.module.css';
import { YourApp } from './YourApp';

const NAMES_KEY = 'flux-academy:v2:troubleshoot-names';

const EXAMPLES: readonly string[] = ['stuck installing', 'PORT_FEE', 'connection refused'];

/**
 * The address bar follows the search box after a pause (`?q=`). That write is marked, so the page can tell
 * it apart from a person following a link, which moves focus to the answer.
 */
const SEARCH_SYNC = { troubleshootSearchSync: true } as const;

function isSearchSync(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as { troubleshootSearchSync?: unknown }).troubleshootSearchSync === true
  );
}

function readStoredNames(): { app: string; domain: string } {
  try {
    const raw = readItem(NAMES_KEY, 'session');
    if (!raw) return { app: '', domain: '' };
    const v = JSON.parse(raw) as { app?: unknown; domain?: unknown };
    return {
      app: typeof v.app === 'string' ? v.app : '',
      domain: typeof v.domain === 'string' ? v.domain : '',
    };
  } catch {
    return { app: '', domain: '' };
  }
}

function crumbsFor(view: View): BreadcrumbItem[] {
  const root: BreadcrumbItem = { label: 'Troubleshoot', href: '/troubleshoot' };
  switch (view.kind) {
    case 'stage':
      return [root, { label: stageById(view.stage).title }];
    case 'symptom':
      return [
        root,
        { label: stageById(view.symptom.stage).title, href: hrefOf.stage(view.symptom.stage) },
        { label: view.symptom.title },
      ];
    case 'messages':
      return [root, { label: 'Error messages' }];
    case 'codes':
      return [root, { label: 'Lint codes' }];
    default:
      return [];
  }
}

function metaFor(view: View): { title?: string; description?: string } {
  switch (view.kind) {
    case 'stage':
      return { title: `${stageById(view.stage).title} problems | Troubleshoot` };
    case 'symptom':
      return { title: `${view.symptom.title} | Troubleshoot`, description: view.symptom.summary };
    case 'messages':
      return { title: 'Error messages | Troubleshoot' };
    case 'codes':
      return { title: 'Lint codes | Troubleshoot' };
    default:
      return {};
  }
}

function RouterLink({ href, className, children, onClick, 'data-force': force }: BreadcrumbLinkProps) {
  return (
    <Link to={href} className={className} onClick={onClick} data-force={force}>
      {children}
    </Link>
  );
}

export default function Troubleshoot() {
  const location = useLocation();
  const [params] = useSearchParams();
  const finePointer = usePointerFine();

  const view = useMemo(() => parseHash(location.hash), [location.hash]);
  useDocumentMeta(metaFor(view));

  // ---- the visitor's own names -------------------------------------------------------------------
  const [typed, setTyped] = useState(() => {
    const stored = readStoredNames();
    return {
      app: params.get('app') ?? stored.app,
      domain: params.get('domain') ?? stored.domain,
    };
  });
  const names = useMemo(() => cleanNames(typed), [typed]);
  useEffect(() => {
    writeItem(NAMES_KEY, JSON.stringify(typed), 'session');
  }, [typed]);

  // ---- the search ---------------------------------------------------------------------------------
  const [query, setQuery] = useState(() => (params.get('q') ?? '').slice(0, MAX_QUERY));
  const searchRef = useRef<HTMLInputElement>(null);
  useHotkeyClaim(
    '/',
    () => {
      const input = searchRef.current;
      if (!input || input.disabled) return false;
      input.focus();
      input.select();
      return undefined;
    },
    { scope: 'troubleshoot', label: 'Search troubleshooting' },
  );
  const results = useMemo(() => (query.trim() === '' ? null : search(query)), [query]);

  // The address bar carries the search (`?q=`) after a pause. The hash stays: a person who clears the
  // search is put back on the problem they were reading.
  const navigate = useNavigate();
  const here = useRef(location);
  here.current = location;
  useEffect(() => {
    const text = query.trim().slice(0, 200);
    const timer = window.setTimeout(() => {
      const now = here.current;
      const next = new URLSearchParams(now.search);
      if ((next.get('q') ?? '') === text) return;
      if (text) next.set('q', text);
      else next.delete('q');
      const search = next.toString();
      void navigate(
        { pathname: now.pathname, search: search ? `?${search}` : '', hash: now.hash },
        { replace: true, preventScrollReset: true, state: SEARCH_SYNC },
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query, navigate]);

  // Choosing a result changes the hash: leave the search so the answer is what shows.
  const lastHash = useRef(location.hash);
  useEffect(() => {
    if (lastHash.current === location.hash) return;
    lastHash.current = location.hash;
    setQuery('');
  }, [location.hash]);

  const clearSearch = useCallback(() => {
    setQuery('');
    searchRef.current?.focus();
  }, []);

  // ---- focus the answer after a navigation within the page ----------------------------------------
  // A row in the message or code list is the target when the link names one; otherwise the heading.
  const targetId =
    view.kind === 'messages' && view.id
      ? `message-row-${view.id}`
      : view.kind === 'codes' && view.code
        ? `code-row-${view.code}`
        : 'ts-heading';
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs per navigation
  useEffect(() => {
    if (!location.hash) return;
    // The address catching up with what was typed is not a navigation: focus stays in the search.
    if (isSearchSync(location.state)) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(targetId);
      if (!el) return;
      const row = targetId !== 'ts-heading';
      el.scrollIntoView({ block: row ? 'center' : 'start' });
      (row ? (el.closest('button') ?? el) : el).focus({ preventScroll: true });
    }, 160);
    return () => window.clearTimeout(t);
  }, [location.key, location.hash]);

  // Say what the search found, once typing pauses.
  const hitCount = results ? totalHits(results) : -1;
  useEffect(() => {
    if (hitCount < 0) return;
    const t = window.setTimeout(
      () => announce(hitCount === 0 ? 'No matches.' : `${hitCount} ${hitCount === 1 ? 'match' : 'matches'}.`),
      600,
    );
    return () => window.clearTimeout(t);
  }, [hitCount]);

  // ---- render --------------------------------------------------------------------------------------
  // The welcome (the lead line and the example searches) belongs to the front door. Once someone is
  // reading an answer, that space goes to the answer.
  const home = !results && (view.kind === 'home' || view.kind === 'unknown');
  const crumbs = results ? [] : crumbsFor(view);
  const symptomView = !results && view.kind === 'symptom' ? view.symptom : null;
  const needs = symptomView ? neededNames(symptomView) : { app: false, domain: false };
  const siblings = symptomView ? symptomsOfStage(symptomView.stage) : [];

  return (
    <NamesContext value={names}>
      <div className={styles.page} data-print-page="troubleshoot">
        <header className={styles.head}>
          <p className={styles.eyebrow}>When something is wrong</p>
          <h1 className={styles.h1} tabIndex={-1}>
            Troubleshoot a deployment
          </h1>
          {home ? (
            <p className={styles.lead}>
              Pick where you are stuck, or describe the problem in your own words. You get the likely causes
              in the order to check them, how to tell each one, and the fix.
            </p>
          ) : null}
        </header>

        <search className={styles.finder} aria-label="Find a problem">
          <Panel
            variant="glass"
            size="md"
            padding="sm"
            halo={false}
            marks={false}
            pattern="none"
            contentClassName={styles.finderBody}
          >
            <SearchField
              ref={searchRef}
              label="Search problems, error messages and lint codes"
              placeholder="Describe the problem, or paste an error message or a lint code"
              value={query}
              onValueChange={(v) => setQuery(v.slice(0, MAX_QUERY))}
              shortcut={finePointer ? '/' : undefined}
              size={home ? 'lg' : 'md'}
            />
            {home && query.trim() === '' ? (
              <p className={styles.examples}>
                <span className={styles.examplesLabel}>Try</span>
                {EXAMPLES.map((e) => (
                  <Chip key={e} kind="filter" size="sm" onClick={() => setQuery(e)}>
                    {e}
                  </Chip>
                ))}
                {finePointer ? (
                  <span className={styles.slashHint}>
                    Press <Kbd size="sm">/</Kbd> from anywhere on this page.
                  </span>
                ) : null}
              </p>
            ) : null}
          </Panel>
        </search>

        {crumbs.length > 0 ? (
          <Breadcrumbs items={crumbs} renderLink={RouterLink} className={styles.crumbs} />
        ) : null}

        {results ? (
          <SearchResults results={results} onClear={clearSearch} />
        ) : symptomView ? (
          <div className={styles.split}>
            <nav className={styles.side} aria-label={`More ${stageById(symptomView.stage).title} problems`}>
              <Link to={hrefOf.stage(symptomView.stage)} className={styles.sideHead}>
                {stageById(symptomView.stage).title}
              </Link>
              <ul className={styles.sideList}>
                {siblings.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={hrefOf.symptom(s.id)}
                      className={styles.sideLink}
                      aria-current={s.id === symptomView.id ? 'page' : undefined}
                    >
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className={styles.main}>
              <SymptomView
                key={symptomView.id}
                symptom={symptomView}
                namesSlot={
                  needs.app || needs.domain ? (
                    <YourApp
                      needs={needs}
                      app={typed.app}
                      domain={typed.domain}
                      onApp={(v) => setTyped((t) => ({ ...t, app: v }))}
                      onDomain={(v) => setTyped((t) => ({ ...t, domain: v }))}
                    />
                  ) : null
                }
              />
            </div>
          </div>
        ) : view.kind === 'stage' ? (
          <StageView stage={view.stage} />
        ) : view.kind === 'messages' ? (
          <MessagesView selected={view.id} />
        ) : view.kind === 'codes' ? (
          <CodesView selected={view.code} />
        ) : (
          <>
            {view.kind === 'unknown' ? (
              <Callout kind="gotcha" title="That link does not match anything here">
                We have no problem, message or code called <code>{view.hash}</code>. It may have been renamed.
                Search above, or pick where you are stuck.
              </Callout>
            ) : null}
            <Landing />
          </>
        )}

        <StillStuck />
      </div>
    </NamesContext>
  );
}

// Keep the stage list reachable for tests and the deck without importing the page.
export const STAGE_COUNT = STAGES.length;
