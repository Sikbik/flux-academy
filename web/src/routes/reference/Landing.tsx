/** `/reference`: the topics, a search across all of them, quick answers and how to read the labels. */

import { routeMeta } from '@shared/site';
import { useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { REFERENCE_INDEX, TOPICS, type TopicMeta } from '@/content/reference';
import { CHECKED } from '@/content/reference/facts';
import { useHotkeyClaim } from '@/system/hotkeys';
import { Glyph, Panel } from '@/ui';
import styles from './landing.module.css';
import { PROV, PROV_ORDER } from './model';
import { Art } from './parts/Art';
import { ProvChip } from './parts/Prov';
import { Ul } from './parts/Semantics';
import { SearchBox, SearchResults, useReferenceSearch } from './Search';

const QUICK: readonly { label: string; to: string }[] = [
  { label: 'Which public ports are banned, and which cost extra?', to: '/reference/networking#ports' },
  {
    label: 'Why does my app answer 502, or refuse the connection?',
    to: '/reference/networking#networking-trouble',
  },
  { label: 'What does the latest tag cost me?', to: '/reference/docker#pin-tags' },
  { label: 'How do my components reach each other?', to: '/reference/networking#internal-dns' },
  { label: 'How is the price made, step by step?', to: '/reference/spec#pricing' },
  { label: 'What does each containerData prefix guarantee?', to: '/reference/spec#container-data' },
  { label: 'Why does my POST to the price calculator fail?', to: '/reference/api#calculator' },
  { label: 'What do the lint codes mean?', to: '/reference/spec#lint-codes' },
  { label: 'What does each Orbit plan include, and what does it cost?', to: '/reference/orbit#plans' },
  { label: 'Which MCP tools can spend money or delete data?', to: '/reference/agents#tools' },
];

const ELSEWHERE: readonly { to: string; label: string; text: string }[] = [
  { to: '/glossary', label: 'Glossary', text: 'Plain definitions of every term, with why it matters.' },
  {
    to: '/troubleshoot',
    label: 'Troubleshoot a deployment',
    text: 'Pick what you see and get the likely cause and fix.',
  },
  { to: '/labs/spec-forge', label: 'Spec Forge', text: 'Build a spec and watch it linted and priced live.' },
  { to: '/labs/explorer', label: 'Network explorer', text: 'Look up a real app and see where it runs.' },
];

function TopicCard({ topic }: { topic: TopicMeta }) {
  const sections = topic.sections.filter((s) => s.level === 2).length;
  return (
    <li className={styles.cardItem}>
      <Panel
        variant="glass"
        size="md"
        padding="lg"
        interactive
        className={styles.card}
        contentClassName={styles.cardInner}
        data-topic={topic.id}
      >
        <div className={styles.cardArt} aria-hidden="true">
          <Art id={topic.art} size={132} />
        </div>
        <div className={styles.cardBody}>
          <p className={styles.cardKind}>
            <Glyph name={topic.glyph} size={16} />
            {topic.name}
          </p>
          <h2 className={styles.cardTitle}>
            <Link to={topic.path} className={styles.cardLink}>
              {topic.heading}
            </Link>
          </h2>
          <p className={styles.cardPromise}>{topic.promise}</p>
          <Ul className={styles.cardJumps} aria-label={`Jump into ${topic.name}`}>
            {topic.highlights.map((h) => (
              <li key={h.anchor}>
                <Link to={`${topic.path}#${h.anchor}`} className={styles.jump}>
                  {h.label}
                </Link>
              </li>
            ))}
          </Ul>
          <p className={styles.cardCount}>{sections} sections</p>
        </div>
      </Panel>
    </li>
  );
}

export default function Landing() {
  const meta = routeMeta('/reference');
  const search = useReferenceSearch(null);
  const resultsId = useId();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement | null>(null);
  const [signal, setSignal] = useState(0);
  useHotkeyClaim(
    '/',
    () => {
      const field = input.current;
      if (!field || field.disabled) return false;
      field.focus();
      field.select();
      return undefined;
    },
    { scope: 'reference', label: 'Search the reference' },
  );

  return (
    <div className={styles.page} data-print-page="reference">
      <header className={styles.head}>
        <p className={styles.eyebrow}>Reference</p>
        <h1 className={styles.h1} tabIndex={-1}>
          Reference
        </h1>
        <p className={styles.lead}>{meta?.description}</p>
      </header>

      <section className={styles.searchSection} aria-label="Search the reference">
        <SearchBox
          state={search}
          topic={null}
          resultsId={resultsId}
          inputRef={(el) => {
            input.current = el;
          }}
          onFirst={(entry) => navigate(entry.path)}
          onDown={() => setSignal((n) => n + 1)}
        />
        <p className={styles.searchNote}>
          {REFERENCE_INDEX.length} entries across the {TOPICS.length} pages: every field, lint code, endpoint,
          tool and rule.
        </p>
        <SearchResults
          id={resultsId}
          state={search}
          topic={null}
          focusFirstSignal={signal}
          onPick={() => search.setQuery('')}
          onEscape={() => input.current?.focus()}
        />
      </section>

      <section aria-labelledby="topics-heading" className={styles.block}>
        <h2 id="topics-heading" className={styles.blockTitle}>
          The {TOPICS.length} pages
        </h2>
        <Ul className={styles.cards}>
          {TOPICS.map((t) => (
            <TopicCard key={t.id} topic={t} />
          ))}
        </Ul>
      </section>

      <div className={styles.twoCol}>
        <section aria-labelledby="quick-heading" className={styles.block}>
          <h2 id="quick-heading" className={styles.blockTitle}>
            Quick answers
          </h2>
          <Ul className={styles.quick}>
            {QUICK.map((q) => (
              <li key={q.to}>
                <Link to={q.to} className={styles.quickLink}>
                  <span>{q.label}</span>
                  <Glyph name="arrow-right" size={16} />
                </Link>
              </li>
            ))}
          </Ul>
        </section>

        <section aria-labelledby="read-heading" className={styles.block}>
          <h2 id="read-heading" className={styles.blockTitle}>
            How to read it
          </h2>
          <p className={styles.blockText}>
            Most statements say how well they are known. The numbers are read from the same engine that lints
            and prices your spec in Spec Forge, so they cannot drift from it. Checked against FluxOS{' '}
            {CHECKED.fluxos} and the live network on {CHECKED.date}. The Orbit and Agents pages were read from
            vendor pages, the npm package and the FluxCloud console, and each says when.
          </p>
          <dl className={styles.legend}>
            {PROV_ORDER.map((p) => (
              <div key={p} className={styles.legendRow}>
                <dt>
                  <ProvChip prov={p} />
                </dt>
                <dd>{PROV[p].meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section aria-labelledby="else-heading" className={styles.block}>
        <h2 id="else-heading" className={styles.blockTitle}>
          Also useful
        </h2>
        <Ul className={styles.elsewhere}>
          {ELSEWHERE.map((e) => (
            <li key={e.to}>
              <Link to={e.to} className={styles.elseLink}>
                <span className={styles.elseLabel}>{e.label}</span>
                <span className={styles.elseText}>{e.text}</span>
              </Link>
            </li>
          ))}
        </Ul>
      </section>
    </div>
  );
}
