/**
 * The frame of a reference topic: breadcrumbs, the one `h1`, the lead and what it was checked against,
 * a sticky rail (search and contents) on wide screens or a contents bar on narrow ones, the sections,
 * the list of unverified statements, and the previous and next pages.
 *
 * The pages render their sections as children, each wrapped in `<Section id>`. The frame numbers them,
 * follows the reader with a scroll spy and takes care of fragment links.
 */

import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { InlineMarkup } from '@/app/InlineMarkup';
import { neighbours, REFERENCE_INDEX, TOPICS, type TopicMeta, topicById } from '@/content/reference';
import { CHECKED } from '@/content/reference/facts';
import { useHotkeyClaim } from '@/system/hotkeys';
import { type BreadcrumbLinkProps, Breadcrumbs } from '@/ui';
import { ContentsPanel, MobileContents, UNVERIFIED_ID } from './Contents';
import { TopicContext } from './context';
import styles from './frame.module.css';
import { useHashTarget, useScrollSpy } from './hooks';
import { numberSections, unverifiedOf } from './model';
import { Art } from './parts/Art';
import { ProvChips, ProvLegend } from './parts/Prov';
import parts from './parts/parts.module.css';
import { Ul } from './parts/Semantics';
import { useReferenceSearch } from './Search';

function RouterLink({ href, className, children, onClick, 'data-force': force }: BreadcrumbLinkProps) {
  return (
    <Link to={href} className={className} onClick={onClick} data-force={force}>
      {children}
    </Link>
  );
}

const CONTENT_ID = 'reference-content';
const SEARCH_ID = 'reference-search';

/** Skip links that come before the rail, so a keyboard user can go straight to the text or the search. */
function SkipLinks({ onSearch }: { onSearch: () => void }) {
  return (
    <>
      <a
        className={styles.skip}
        href={`#${CONTENT_ID}`}
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById(CONTENT_ID);
          el?.focus({ preventScroll: true });
          el?.scrollIntoView({ block: 'start' });
        }}
      >
        Skip to the reference text
      </a>
      <a
        className={styles.skip}
        href={`#${SEARCH_ID}`}
        onClick={(e) => {
          e.preventDefault();
          onSearch();
        }}
      >
        Skip to search
      </a>
    </>
  );
}

export function TopicFrame({ topic, children }: { topic: TopicMeta; children: ReactNode }) {
  const numbered = useMemo(() => numberSections(topic.sections), [topic]);
  const context = useMemo(
    () => ({ topic, sections: new Map(numbered.map((s) => [s.id, s] as const)) }),
    [topic, numbered],
  );
  const unverified = useMemo(() => unverifiedOf(REFERENCE_INDEX, topic.id), [topic.id]);
  const ids = useMemo(
    () => [...numbered.map((s) => s.id), ...(unverified.length > 0 ? [UNVERIFIED_ID] : [])],
    [numbered, unverified.length],
  );
  const active = useScrollSpy(ids, 64);
  useHashTarget();

  const search = useReferenceSearch(topic.id);
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputs = useRef(new Set<HTMLInputElement>());
  const register = useCallback((el: HTMLInputElement | null) => {
    if (el) inputs.current.add(el);
  }, []);
  const findInput = useCallback((): HTMLInputElement | null => {
    for (const el of inputs.current) {
      if (!el.isConnected) inputs.current.delete(el);
      else if (el.offsetParent !== null) return el;
    }
    return null;
  }, []);
  const openSearch = useCallback(() => {
    if (!findInput()) setMobileOpen(true);
    window.requestAnimationFrame(() => {
      const input = findInput();
      input?.focus();
      input?.select();
    });
  }, [findInput]);
  // `/` goes to this page's search. On a narrow screen the field sits in the contents drawer, so open
  // that first and focus on the next frame, when the field exists.
  useHotkeyClaim('/', () => openSearch(), { scope: 'reference', label: 'Search the reference' });

  const { prev, next } = neighbours(topic.id);
  const activeTitle =
    active === UNVERIFIED_ID
      ? 'Unverified on this page'
      : (context.sections.get(active ?? '')?.title ?? topic.sections[0]?.title ?? '');

  return (
    <TopicContext.Provider value={context}>
      <div className={styles.page} data-print-page={`reference-${topic.id}`}>
        <SkipLinks onSearch={openSearch} />
        <header className={styles.head}>
          <Breadcrumbs
            renderLink={RouterLink}
            aria-label="Breadcrumb"
            items={[{ label: 'Reference', href: '/reference' }, { label: topic.name }]}
          />
          <div className={styles.headRow}>
            <div className={styles.headText}>
              <h1 className={styles.h1} tabIndex={-1}>
                {topic.heading}
              </h1>
              <p className={styles.lead}>
                <InlineMarkup text={topic.lead} />
              </p>
              <div className={styles.basis}>
                {topic.basis ? (
                  <p className={styles.basisLine}>
                    {topic.basis.text} <time dateTime={topic.basis.date}>{topic.basis.date}</time>. Prices and
                    spec rules come from the same engine as the other pages, checked against FluxOS{' '}
                    <strong>{CHECKED.fluxos}</strong>.
                  </p>
                ) : (
                  <p className={styles.basisLine}>
                    Checked against FluxOS <strong>{CHECKED.fluxos}</strong> (source of{' '}
                    <time dateTime={CHECKED.sourceDate}>{CHECKED.sourceDate}</time>) and the live network on{' '}
                    <time dateTime={CHECKED.date}>{CHECKED.date}</time>.
                  </p>
                )}
                <div className={styles.basisLinks}>
                  <ProvLegend />
                  {unverified.length > 0 ? (
                    <Link to={{ hash: `#${UNVERIFIED_ID}` }} className={styles.basisLink}>
                      {unverified.length} unverified {unverified.length === 1 ? 'statement' : 'statements'}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
            <Art id={topic.art} size={176} className={styles.headArt} />
          </div>
        </header>

        <div className={styles.layout}>
          <aside id={SEARCH_ID} className={styles.rail} aria-label="Search and contents">
            <ContentsPanel
              topic={topic}
              numbered={numbered}
              active={active}
              search={search}
              unverifiedCount={unverified.length}
              inputRef={register}
              onNavigate={() => undefined}
            />
          </aside>

          <MobileContents title={activeTitle} open={mobileOpen} onOpenChange={setMobileOpen}>
            {(close) => (
              <ContentsPanel
                topic={topic}
                numbered={numbered}
                active={active}
                search={search}
                unverifiedCount={unverified.length}
                inputRef={register}
                onNavigate={close}
              />
            )}
          </MobileContents>

          <div id={CONTENT_ID} className={styles.article} tabIndex={-1}>
            {children}

            {unverified.length > 0 ? (
              <section id={UNVERIFIED_ID} className={styles.unverified} aria-labelledby="unverified-heading">
                <h2 id="unverified-heading" className={styles.unverifiedTitle}>
                  Unverified on this page
                </h2>
                <p className={parts.noteText}>
                  Each of these is marked Unverified where it appears. They come from reading the source or
                  from how Docker normally behaves, and were not confirmed on the network. Test one before you
                  depend on it.
                </p>
                <Ul className={styles.unverifiedList}>
                  {unverified.map((e) => (
                    <li key={e.id} className={styles.unverifiedItem}>
                      <span className={styles.unverifiedGroup}>{e.group}</span>
                      <Link to={e.path} className="link">
                        {e.title}
                      </Link>
                      <ProvChips prov={e.prov ?? []} />
                    </li>
                  ))}
                </Ul>
              </section>
            ) : null}

            <nav className={styles.pager} aria-label="Previous and next reference page">
              {prev ? (
                <Link to={prev.path} className={styles.pagerLink} data-dir="prev">
                  <span className={styles.pagerDir}>Previous</span>
                  <span className={styles.pagerTitle}>{prev.heading}</span>
                  <span className={styles.pagerPromise}>{prev.promise}</span>
                </Link>
              ) : (
                <Link to="/reference" className={styles.pagerLink} data-dir="prev">
                  <span className={styles.pagerDir}>Back to</span>
                  <span className={styles.pagerTitle}>All reference pages</span>
                  <span className={styles.pagerPromise}>The index of the reference pages.</span>
                </Link>
              )}
              {next ? (
                <Link to={next.path} className={styles.pagerLink} data-dir="next">
                  <span className={styles.pagerDir}>Next</span>
                  <span className={styles.pagerTitle}>{next.heading}</span>
                  <span className={styles.pagerPromise}>{next.promise}</span>
                </Link>
              ) : (
                <Link
                  to={topicById(TOPICS[0]?.id ?? 'spec')?.path ?? '/reference'}
                  className={styles.pagerLink}
                  data-dir="next"
                >
                  <span className={styles.pagerDir}>Start again</span>
                  <span className={styles.pagerTitle}>{TOPICS[0]?.heading}</span>
                  <span className={styles.pagerPromise}>{TOPICS[0]?.promise}</span>
                </Link>
              )}
            </nav>
          </div>
        </div>
      </div>
    </TopicContext.Provider>
  );
}
